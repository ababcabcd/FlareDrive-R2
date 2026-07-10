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
const MAX_CACHE_SIZE = 10 * 1024 * 1024; // 单 chunk 最大缓存 10MB（对齐 Worker clamp 上限）
const MAX_CACHE_ENTRIES = 60; // 最多保留 60 个 chunk

// ------------------------- Range 解析 -------------------------

function parseRange(header) {
  if (!header) return null;
  const m = header.match(/^bytes=(\d+)-(\d+)$/);
  if (!m) return null;
  const start = parseInt(m[1], 10), end = parseInt(m[2], 10);
  if (isNaN(start) || isNaN(end) || start > end) return null;
  return { start, end };
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
  let totalSize = null;

  // 1. 精确匹配：请求 Range 与缓存 key 完全一致
  const exactKey = `${url}|${range.start}-${range.end}`;
  const exactMatch = await cache.match(exactKey);
  if (exactMatch) {
    contentType = exactMatch.headers.get('Content-Type') || contentType;
    totalSize = getTotalSize(exactMatch) || totalSize;
    const buffer = await exactMatch.arrayBuffer();
    return build206Response(buffer, range, contentType, totalSize);
  }

  // 2. 收集与请求区间有交集的缓存 chunk（不要求 2MB 对齐）
  //    支持管理页 10MB chunk 和分享页 2MB chunk 混存
  const keys = await cache.keys();
  const overlapping = [];

  for (const req of keys) {
    const keyUrl = req.url;
    if (!keyUrl.startsWith(url + '|')) continue;
    const cacheRange = extractRange(keyUrl);
    if (!cacheRange) continue;
    // 区间交集：两个区间 [a,b] 和 [c,d] 相交当且仅当 a<=d 且 c<=b
    if (cacheRange.start <= range.end && cacheRange.end >= range.start) {
      overlapping.push({ req, range: cacheRange });
    }
  }

  if (overlapping.length === 0) return null;

  // 3. 排序并检查是否覆盖整个请求区间（无空洞）
  overlapping.sort((a, b) => a.range.start - b.range.start);
  let coverEnd = -1;
  for (const ch of overlapping) {
    if (coverEnd >= 0 && ch.range.start > coverEnd + 1) {
      return null; // 有空洞，缓存不足以覆盖
    }
    coverEnd = Math.max(coverEnd, ch.range.end);
  }
  if (overlapping[0].range.start > range.start || coverEnd < range.end) {
    return null; // 缓存区间未能完全覆盖请求区间
  }

  // 4. 读取各 chunk 并拼接
  const buffers = [];
  for (const ch of overlapping) {
    const entry = await cache.match(ch.req);
    if (!entry) return null;
    const buffer = await entry.arrayBuffer();
    contentType = entry.headers.get('Content-Type') || contentType;
    if (!totalSize) totalSize = getTotalSize(entry);
    buffers.push({ buffer: new Uint8Array(buffer), range: ch.range });
  }

  // 5. 合并：各 chunk 中属于请求区间 [range.start, range.end] 的部分写入
  const mergedLen = range.end - range.start + 1;
  const merged = new Uint8Array(mergedLen);
  for (const { buffer, range: cr } of buffers) {
    const partStart = Math.max(cr.start, range.start);
    const partEnd = Math.min(cr.end, range.end);
    if (partStart <= partEnd) {
      const srcOff = partStart - cr.start;
      const dstOff = partStart - range.start;
      const len = partEnd - partStart + 1;
      merged.set(buffer.slice(srcOff, srcOff + len), dstOff);
    }
  }

  return build206Response(merged.buffer, range, contentType, totalSize);
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

// ------------------------- 网络请求 + 后台缓存 -------------------------

async function fetchAndCache(request, event) {
  // 不使用 event.request 直接 fetch：Safari 可能保留原始请求的 opaque/no-cors 模式，
  // 导致 SW 拿不到带 CORS 头的完整响应。
  // 使用 fetch(url, opts) 而非 new Request()：后者在 Safari SW 中有兼容问题，
  // 且需要手动传递 method（否则 HEAD 变 GET 会导致分享页阻塞下载全文件）。
  const url = request.url;
  const rawResponse = await fetch(url, {
    method: request.method,
    headers: request.headers,
  });

  // 只缓存 206 响应（分段请求），不缓存整文件（200）以免撑爆存储。
  // 不要求请求必须有 Range：Safari 初始请求可能不带 Range，但 Worker 会补上并
  // 返回 206，这个响应按实际 Content-Range 缓存即可。
  // 也不要求请求 Range 与响应 Range 一致：Worker 会把大 Range 夹紧，实际
  // Content-Range 才是 response body 的真实区间。
  if (rawResponse.ok && rawResponse.status === 206 && event) {
    const actualRange = parseContentRange(rawResponse.headers.get('Content-Range'));
    if (actualRange) {
      const actualSize = actualRange.end - actualRange.start + 1;
      // 缓存不超过 MAX_CACHE_SIZE（10MB）的 chunk，覆盖管理页 10MB 和分享页 2MB
      if (actualSize <= MAX_CACHE_SIZE) {
        const cloned = rawResponse.clone();
        // 仅保留 serveFromCache 重建 206 所需的最小头集合：
        // Content-Type → 构建 206 时设置
        // X-Total-Size → 文件总大小
        // Range 信息已在缓存 key URL（|start-end）中，无需额外存储。
        const cachedHeaders = new Headers();
        const ct = cloned.headers.get('Content-Type');
        if (ct) cachedHeaders.set('Content-Type', ct);
        if (actualRange.total) {
          cachedHeaders.set('X-Total-Size', String(actualRange.total));
        }
        // Cache API 不允许存储 206，改为 200；
        // serveFromCache 会从 buffer + key URL + X-Total-Size 重建 206
        const cachedResponse = new Response(cloned.body, {
          status: 200,
          statusText: 'OK',
          headers: cachedHeaders,
        });
        event.waitUntil(
          caches.open(VIDEO_CACHE).then(async (cache) => {
            try {
              await cache.put(`${url}|${actualRange.start}-${actualRange.end}`, cachedResponse);
              // LRU 淘汰：超过上限则删除最早的条目
              const keys = await cache.keys();
              if (keys.length > MAX_CACHE_ENTRIES) {
                const toDelete = keys.slice(0, keys.length - MAX_CACHE_ENTRIES);
                await Promise.all(toDelete.map(k => cache.delete(k)));
              }
            } catch (e) {
              console.warn('[SW] cache store failed:', e.message);
            }
          })
        );
      }
    }
  }

  // 显式追加 CORS 头：Safari 对 SW 拦截的媒体请求要求 Response 必须包含 Allow-Origin
  return withCors(rawResponse);
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

  // 只拦截视频/下载端点
  if (!url.pathname.startsWith('/raw/') && !url.pathname.startsWith('/api/share/download/')) {
    // 非目标路径：也必须调用 respondWith，否则 Safari 会因注册了 fetch 监听器
    // 而不自动 fallback 到网络，导致页面请求挂起
    event.respondWith(fetch(event.request));
    return;
  }

  // 仅拦截带 Range 头的请求（视频/音频流式播放 + 预取），其余请求（图片加载、
  // 文件下载导航、整文件请求等）直接透传，避免 SW 中间跳增加不必要的延迟。
  // Range 是 SW 缓存命中判断的必要条件：无 Range 的请求返回 200，不会被缓存，
  // 经过 SW 反而多一跳 fetch，对图片等小文件拖慢明显。
  const rangeHeader = event.request.headers.get('Range');
  if (!rangeHeader) {
    // Safari 视频元素初始探测请求不带 Range，SW 的 event.request 直接 fetch
    // 可能导致响应不被视作合格媒体源，返回 MEDIA_ERR_SRC_NOT_SUPPORTED。
    // 显式 fetch + withCors 包装确保浏览器收到完整 CORS 头 + 正确 Content-Type。
    event.respondWith(
      (async () => {
        const rawResponse = await fetch(url.href, {
          method: event.request.method,
          headers: event.request.headers,
        });
        return withCors(rawResponse);
      })()
    );
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
          const cached = await serveFromCache(url.href, range);
          if (cached) {
            console.log(`[SW] cache HIT  ${range.start}-${range.end}`);
            return cached;
          }
          console.log(`[SW] cache MISS ${range.start}-${range.end}, fetching from network`);
        }
      }
      // 网络获取 + 异步缓存
      return fetchAndCache(event.request, event);
    })()
  );
});
