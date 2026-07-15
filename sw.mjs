/**
 * Service Worker - 视频 chunk 缓存层
 *
 * 问题：浏览器（尤其是 Safari）对 206 Partial Content 响应的 HTTP 缓存不可靠。
 * 拖动进度条到已播放过的位置时，浏览器不会复用之前的 206 响应缓存，而是重新请求。
 *
 * 本 SW 使用 Cache API 实现稳定的视频分段缓存：
 * - <video> 的 Range 请求 → 优先查缓存，命中后零网络消耗
 * - App.vue 的预取请求 → 自动写入缓存
 * - 支持精确 Range 匹配和覆盖匹配（大段缓存可服务于子区间）
 */

const VIDEO_CACHE = 'video-chunks-v5';
const MAX_CACHE_SIZE = 10 * 1024 * 1024; // 单 chunk 最大缓存 10MB
const MIN_CACHE_SIZE = 32 * 1024; // 小于 32KB 的响应不缓存（避免极小探测请求污染缓存）
const MAX_CACHE_ENTRIES = 60; // 最多保留 60 个 chunk
const CHUNK_SIZE = 10 * 1024 * 1024; // 开放区间标准化为 10MB 闭合区间
const MIN_COVERAGE = 1 * 1024 * 1024; // 开放区间命中缓存的最小连续覆盖长度

// ------------------------- Range 解析 -------------------------

function parseRange(header) {
  if (!header) return null;
  // 闭合区间: bytes=X-Y
  let m = header.match(/^bytes=(\d+)-(\d+)$/);
  if (m) {
    const start = parseInt(m[1], 10), end = parseInt(m[2], 10);
    if (isNaN(start) || isNaN(end) || start > end) return null;
    return { start, end };
  }
  // 开放区间: bytes=X- (Safari 初始探测/seek 可能发送)
  m = header.match(/^bytes=(\d+)-$/);
  if (m) {
    const start = parseInt(m[1], 10);
    if (isNaN(start)) return null;
    return { start, end: -1 }; // -1 = 到文件末尾
  }
  return null;
}

function extractRange(keyUrl) {
  const idx = keyUrl.lastIndexOf('|');
  if (idx < 0) return null;
  const part = keyUrl.slice(idx + 1);
  const sep = part.indexOf('-');
  if (sep < 0) return null;
  const start = parseInt(part.slice(0, sep)), end = parseInt(part.slice(sep + 1));
  if (isNaN(start) || isNaN(end)) return null;
  return { start, end };
}

// 解析响应 Content-Range: bytes start-end/total，返回实际区间与总大小
function parseContentRange(header) {
  if (!header) return null;
  const m = header.match(/^bytes (\d+)-(\d+)\/(\d+|\*)$/);
  if (!m) return null;
  const start = parseInt(m[1], 10);
  const end = parseInt(m[2], 10);
  const total = m[3] === '*' ? null : parseInt(m[3], 10);
  if (isNaN(start) || isNaN(end) || start > end) return null;
  return { start, end, total };
}

// 从已缓存响应中提取文件总大小（优先 X-Total-Size，其次 Content-Range）
function getTotalSize(response) {
  const custom = response.headers.get('X-Total-Size');
  if (custom) {
    const n = parseInt(custom, 10);
    if (!isNaN(n) && n > 0) return n;
  }
  const cr = response.headers.get('Content-Range');
  if (cr) {
    const m = cr.match(/\/(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n) && n > 0) return n;
    }
  }
  return null;
}

// ------------------------- 响应构建 -------------------------

function build206Response(buffer, range, contentType, totalSize) {
  const headers = new Headers();
  headers.set('Content-Type', contentType || 'video/mp4');
  headers.set('Content-Range', `bytes ${range.start}-${range.end}/${totalSize || '*'}`);
  headers.set('Content-Length', String(buffer.byteLength));
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', 'private, max-age=3600');
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length, Content-Type');
  return new Response(buffer, { status: 206, headers });
}

// ------------------------- 缓存查询 -------------------------

async function serveFromCache(url, range) {
  const cache = await caches.open(VIDEO_CACHE);
  let contentType = 'video/mp4';
  const isOpenEnded = range.end < 0;

  // 1. 精确匹配：仅闭合区间
  if (!isOpenEnded) {
    const exactKey = `${url}|${range.start}-${range.end}`;
    const exactMatch = await cache.match(exactKey);
    if (exactMatch) {
      const totalSize = getTotalSize(exactMatch);
      contentType = exactMatch.headers.get('Content-Type') || contentType;
      const buffer = await exactMatch.arrayBuffer();
      console.log(`[SW] cache exact HIT  ${range.start}-${range.end}`);
      sendDiag('cache-hit', { range: `${range.start}-${range.end}`, mode: 'exact' });
      return build206Response(buffer, range, contentType, totalSize);
    }
  }

  // 2. 收集与请求区间有交集的缓存 chunk
  //    开放区间用 MAX_SAFE_INTEGER 作为搜索上界
  const keys = await cache.keys();
  const overlapping = [];
  const searchEnd = isOpenEnded ? Number.MAX_SAFE_INTEGER : range.end;

  for (const req of keys) {
    const keyUrl = req.url;
    if (!keyUrl.startsWith(url + '|')) continue;
    const cacheRange = extractRange(keyUrl);
    if (!cacheRange) continue;
    if (cacheRange.start <= searchEnd && cacheRange.end >= range.start) {
      overlapping.push({ req, range: cacheRange });
    }
  }

  if (overlapping.length === 0) return null;

  // 3. 排序并检查是否覆盖整个请求区间（无空洞）
  overlapping.sort((a, b) => a.range.start - b.range.start);
  let coverEnd = -1;
  for (const ch of overlapping) {
    if (coverEnd >= 0 && ch.range.start > coverEnd + 1) {
      return null; // 有空洞
    }
    coverEnd = Math.max(coverEnd, ch.range.end);
  }
  if (overlapping[0].range.start > range.start) return null;
  if (!isOpenEnded && coverEnd < range.end) return null; // 闭合区间未完全覆盖

  // 4. 读取所有 chunk 并获取总大小
  const buffers = [];
  let totalSize = null;
  for (const ch of overlapping) {
    const entry = await cache.match(ch.req);
    if (!entry) return null;
    const buffer = await entry.arrayBuffer();
    contentType = entry.headers.get('Content-Type') || contentType;
    if (!totalSize) totalSize = getTotalSize(entry);
    buffers.push({ buffer: new Uint8Array(buffer), range: ch.range });
  }

  // 5. 开放区间：确保连续覆盖长度足够，避免只命中一个极小的探测 chunk 就给浏览器返回几 KB
  if (isOpenEnded) {
    const coverage = coverEnd - range.start + 1;
    const reachesEof = totalSize && coverEnd >= totalSize - 1;
    if (coverage < MIN_COVERAGE && !reachesEof) return null;
  }

  // 6. 合并：各 chunk 中属于请求区间 [effectiveRange.start, effectiveRange.end] 的部分写入
  const effectiveRange = isOpenEnded
    ? { start: range.start, end: coverEnd }
    : range;
  const mergedLen = effectiveRange.end - effectiveRange.start + 1;
  const merged = new Uint8Array(mergedLen);
  for (const { buffer, range: cr } of buffers) {
    const partStart = Math.max(cr.start, effectiveRange.start);
    const partEnd = Math.min(cr.end, effectiveRange.end);
    if (partStart <= partEnd) {
      const srcOff = partStart - cr.start;
      const dstOff = partStart - effectiveRange.start;
      const len = partEnd - partStart + 1;
      merged.set(buffer.slice(srcOff, srcOff + len), dstOff);
    }
  }

  console.log(`[SW] cache merge HIT  ${effectiveRange.start}-${effectiveRange.end}`);
  sendDiag('cache-hit', { range: `${effectiveRange.start}-${effectiveRange.end}`, mode: 'merge', chunks: overlapping.length });
  return build206Response(merged.buffer, effectiveRange, contentType, totalSize);
}

// ------------------------- 页面诊断通道 -------------------------

// 把 SW 内部事件广播给所有受控页面，让用户在页面控制台就能看到 SW 状态
// 解决 Safari 中 SW 控制台独立、不易发现的问题
function sendDiag(type, payload) {
  self.clients.matchAll().then(clients => {
    const msg = { source: 'SW', type, ...payload, ts: Date.now() };
    clients.forEach(c => c.postMessage(msg));
  }).catch(() => {});
}

// ------------------------- CORS 安全响应包装 -------------------------

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length, Content-Type',
};

function withCors(response) {
  // 已包含 Allow-Origin 头则跳过（避免重复）
  if (response.headers.has('Access-Control-Allow-Origin')) return response;
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  // Safari SW 返回的 Response 若被识别为 opaque，媒体元素会拒绝播放；
  // 显式构造新 Response 确保 CORS 头嵌入
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// ------------------------- 网络请求 + 同步缓存 -------------------------

async function fetchAndCache({ url, method, headers }) {
  // 不使用 event.request 直接 fetch：Safari 可能保留原始请求的 opaque/no-cors 模式，
  // 导致 SW 拿不到带 CORS 头的完整响应。
  // 使用 fetch(url, opts) 而非 new Request()：后者在 Safari SW 中有兼容问题，
  // 且需要手动传递 method（否则 HEAD 变 GET 会导致分享页阻塞下载全文件）。
  const rawResponse = await fetch(url, {
    method,
    headers,
  });

  const contentRange = rawResponse.headers.get('Content-Range');
  const actualRange = parseContentRange(contentRange);
  console.log(`[SW] fetch response status=${rawResponse.status}, content-range=${contentRange}, parsed=${actualRange ? actualRange.start+'-'+actualRange.end : 'null'}`);

  // 只缓存 206 响应（分段请求），不缓存整文件（200）以免撑爆存储。
  if (rawResponse.ok && rawResponse.status === 206) {
    if (actualRange) {
      const actualSize = actualRange.end - actualRange.start + 1;
      // 只缓存大小在 [MIN_CACHE_SIZE, MAX_CACHE_SIZE] 之间的 chunk，
      // 既避免大响应撑爆缓存，也避免 tiny probe 污染缓存。
      if (actualSize >= MIN_CACHE_SIZE && actualSize <= MAX_CACHE_SIZE) {
        const cacheKey = `${url}|${actualRange.start}-${actualRange.end}`;
        // 非阻塞写入：clone 一份专门给缓存，不阻塞返回给浏览器的响应。
        // await cache.put() 会消费 clone 的 body，如果在此处 await，
        // 某些浏览器实现可能导致原始 rawResponse.body 的流状态异常，
        // 进而让浏览器端视频元素收到不完整的响应，触发 MEDIA_ERR。
        const cloned = rawResponse.clone();
        scheduleCacheWrite(cloned, cacheKey, actualRange.total);
      } else {
        console.log(`[SW] cache write SKIP: size=${actualSize} out of [${MIN_CACHE_SIZE}, ${MAX_CACHE_SIZE}]`);
        sendDiag('cache-skip', { reason: 'size', size: actualSize, min: MIN_CACHE_SIZE, max: MAX_CACHE_SIZE });
      }
    } else {
      console.log('[SW] cache write SKIP: Content-Range parse failed');
      sendDiag('cache-skip', { reason: 'parse', contentRange });
    }
  }

  // 显式追加 CORS 头：Safari 对 SW 拦截的媒体请求要求 Response 必须包含 Allow-Origin
  return withCors(rawResponse);
}

// 非阻塞缓存写入：fire-and-forget，不阻塞 fetch 响应返回
async function scheduleCacheWrite(response, cacheKey, totalSize) {
  try {
    const cachedHeaders = new Headers();
    const ct = response.headers.get('Content-Type');
    if (ct) cachedHeaders.set('Content-Type', ct);
    if (totalSize) {
      cachedHeaders.set('X-Total-Size', String(totalSize));
    }
    const cachedResponse = new Response(response.body, {
      status: 200,
      statusText: 'OK',
      headers: cachedHeaders,
    });
    const cache = await caches.open(VIDEO_CACHE);
    await cache.put(cacheKey, cachedResponse);
    console.log(`[SW] cache write OK: ${cacheKey}`);
    sendDiag('cache-write', { key: cacheKey, size: undefined });
    // LRU 淘汰
    const keys = await cache.keys();
    if (keys.length > MAX_CACHE_ENTRIES) {
      const toDelete = keys.slice(0, keys.length - MAX_CACHE_ENTRIES);
      await Promise.all(toDelete.map(k => cache.delete(k)));
    }
  } catch (e) {
    console.warn('[SW] cache write FAIL:', e.message);
  }
}

// ===================== Event Listeners =====================

self.addEventListener('install', (event) => {
  console.log('[SW] install');
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  console.log('[SW] activate');
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // 清理旧版本缓存
      caches.keys().then(names =>
        Promise.all(
          names.filter(n => n !== VIDEO_CACHE && n.startsWith('video-chunks-'))
            .map(n => caches.delete(n))
        )
      ),
    ])
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'ping') {
    event.ports[0]?.postMessage('pong');
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // mt=1 标记：多线程下载通过 Worker 代理，跳过 SW 缓存层直连
  if (url.searchParams.has('mt')) {
    event.respondWith(fetch(event.request.url, {
      method: event.request.method,
      headers: event.request.headers,
    }));
    return;
  }

  // 跨域 R2 直连请求：SW 代理并注入 CORS 头，让页面能读取 R2 响应。
  // SW 的 fetch() 不受 CORS 限制，拿到完整响应后包装 withCors() 返回给页面。
  // 仅拦截带 Range 头的下载请求，非 Range（图片等）交给浏览器原生处理。
  if (url.origin !== self.location.origin) {
    const rangeHeader = event.request.headers.get('Range');
    if (rangeHeader) {
      event.respondWith(
        fetch(event.request.url, { method: event.request.method, headers: event.request.headers })
          .then(r => withCors(r))
      );
    }
    return;
  }

  // 只拦截视频/下载端点
  if (!url.pathname.startsWith('/raw/') && !url.pathname.startsWith('/api/share/download/')) {
  // 非目标路径：也必须调用 respondWith，否则 Safari 会因注册了 fetch 监听器
  // 而不自动 fallback 到网络，导致页面请求挂起。
  // 导航请求（mode=navigate）不能直接用 fetch(event.request)，浏览器不允许 SW
  // 对同一个导航请求再发起导航。改用普通 GET 请求：preloadResponse 如果启用了
  // navigation preload 会直接返回缓存响应，否则 resolve 为 undefined 需要 fallback。
  if (event.request.mode === 'navigate') {
    const p = event.preloadResponse
      .then(r => r || fetch(event.request.url, { method: 'GET' }))
      .catch(() => fetch(event.request.url, { method: 'GET' }));
    event.respondWith(p);
  } else {
    // 非导航请求（如 POST /api/children/）必须原样透传，保留 method/headers/body
    event.respondWith(fetch(event.request));
  }
  return;
}

  const rangeHeader = event.request.headers.get('Range');
  if (!rangeHeader) {
    event.respondWith(fetch(event.request.url, {
      method: event.request.method,
      headers: event.request.headers,
    }));
    return;
  }

  event.respondWith(
    (async () => {
      // 预取请求（App.vue 的分段预加载）：这些请求的目标是未来 chunk，缓存命中率极低，
      // 跳过 serveFromCache 的 IndexedDB 查询（精确匹配 + keys 遍历 + 多块拼接），
      // 直接走网络，收益更大。SW 的 fetchAndCache 会自动将 206 响应写入缓存，
      // 当浏览器后续真正需要这些 chunk 时仍能命中。
      const isPrefetch = event.request.headers.has('X-Prefetch');
      if (!isPrefetch) {
        const range = parseRange(rangeHeader);
        if (range) {
          const cached = await serveFromCache(event.request.url, range);
          if (cached) return cached;

          // 开放区间（如 bytes=0- / bytes=491520-）会让 R2 返回从 start 到文件末尾的大段，
          // 远超 MAX_CACHE_SIZE，导致 cache 永远写不进去。标准化为 10MB 闭合区间后，
          // 响应可被缓存，且后续 seek 回该区间时能命中缓存。
          if (range.end < 0) {
            const normalizedEnd = range.start + CHUNK_SIZE - 1;
            const headers = new Headers(event.request.headers);
            headers.set('Range', `bytes=${range.start}-${normalizedEnd}`);
            console.log(`[SW] cache MISS ${range.start}-open, normalize to ${range.start}-${normalizedEnd}`);
            sendDiag('cache-miss', { range: `${range.start}-open`, normalized: `${range.start}-${normalizedEnd}` });
            return fetchAndCache({ url: event.request.url, method: event.request.method, headers });
          }

          // Safari 经常发送超大闭区间（如 30MB 的 bytes=12451840-42860543），
          // 响应远超 MAX_CACHE_SIZE 导致无法缓存。和开放区间一样 clamp 到 10MB。
          const rangeSize = range.end - range.start + 1;
          if (rangeSize > CHUNK_SIZE) {
            const clampedEnd = range.start + CHUNK_SIZE - 1;
            const headers = new Headers(event.request.headers);
            headers.set('Range', `bytes=${range.start}-${clampedEnd}`);
            console.log(`[SW] cache MISS ${range.start}-${range.end} (${(rangeSize/1024/1024).toFixed(1)}MB), clamp to ${range.start}-${clampedEnd}`);
            sendDiag('cache-miss', { range: `${range.start}-${range.end}`, clamped: `${(rangeSize/1024/1024).toFixed(1)}MB → ${range.start}-${clampedEnd}` });
            return fetchAndCache({ url: event.request.url, method: event.request.method, headers });
          }

          console.log(`[SW] cache MISS ${range.start}-${range.end}, fetching from network`);
          sendDiag('cache-miss', { range: `${range.start}-${range.end}` });
        }
      }
      // 网络获取 + 同步缓存
      return fetchAndCache({ url: event.request.url, method: event.request.method, headers: event.request.headers });
    })()
  );
});
