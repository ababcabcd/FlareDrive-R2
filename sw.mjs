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

const VIDEO_CACHE = 'video-chunks-v2';
const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB 对齐单位
const MAX_CACHE_ENTRIES = 60; // 最多保留 60 个 chunk (~120MB)

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

// ------------------------- 响应构建 -------------------------

function build206Response(buffer, range, contentType) {
  const headers = new Headers();
  headers.set('Content-Type', contentType || 'video/mp4');
  headers.set('Content-Range', `bytes ${range.start}-${range.end}/*`);
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

  // 1. 精确匹配：prefetch 写入的 chunk 与 video 请求的 Range 完全一致
  const exactKey = `${url}|${range.start}-${range.end}`;
  const exactMatch = await cache.match(exactKey);
  if (exactMatch) {
    contentType = exactMatch.headers.get('Content-Type') || contentType;
    const buffer = await exactMatch.arrayBuffer();
    return build206Response(buffer, range, contentType);
  }

  // 2. 覆盖匹配：已有更大的缓存 chunk，从中切出所需的子区间
  const keys = await cache.keys();
  for (const req of keys) {
    const keyUrl = req.url;
    if (!keyUrl.startsWith(url + '|')) continue;
    const cacheRange = extractRange(keyUrl);
    if (!cacheRange) continue;
    if (cacheRange.start <= range.start && cacheRange.end >= range.end) {
      const entry = await cache.match(req);
      if (entry) {
        contentType = entry.headers.get('Content-Type') || contentType;
        const buffer = await entry.arrayBuffer();
        const offset = range.start - cacheRange.start;
        const length = range.end - range.start + 1;
        return build206Response(buffer.slice(offset, offset + length), range, contentType);
      }
    }
  }

  // 3. 多 chunk 拼接：跨越多块已缓存数据，从各块中拼出完整区间
  const firstChunk = Math.floor(range.start / CHUNK_SIZE);
  const lastChunk = Math.floor(range.end / CHUNK_SIZE);
  if (firstChunk !== lastChunk) {
    // 收集所有需要的 chunk key
    const neededKeys = [];
    for (let i = firstChunk; i <= lastChunk; i++) {
      const chunkStart = i * CHUNK_SIZE;
      const chunkEnd = chunkStart + CHUNK_SIZE - 1;
      neededKeys.push({ key: `${url}|${chunkStart}-${chunkEnd}`, start: chunkStart });
    }

    const chunkEntries = [];
    for (const { key, start } of neededKeys) {
      const entry = await cache.match(key);
      if (!entry) { chunkEntries.length = 0; break; } // 缺失任一块则放弃拼接
      const buffer = await entry.arrayBuffer();
      contentType = entry.headers.get('Content-Type') || contentType;
      chunkEntries.push({ buffer, start });
    }

    if (chunkEntries.length === neededKeys.length) {
      const totalLen = chunkEntries.reduce((s, c) => s + c.buffer.byteLength, 0);
      const merged = new Uint8Array(totalLen);
      let offset = 0;
      for (const c of chunkEntries) {
        merged.set(new Uint8Array(c.buffer), offset);
        offset += c.buffer.byteLength;
      }
      const sliceStart = range.start - firstChunk * CHUNK_SIZE;
      const sliceEnd = sliceStart + (range.end - range.start);
      return build206Response(merged.slice(sliceStart, sliceEnd + 1), range, contentType);
    }
  }

  return null; // 缓存未命中
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
  const rangeHeader = request.headers.get('Range');
  const rawResponse = await fetch(url, {
    method: request.method,
    headers: request.headers,
  });

  // 只缓存 206 响应（分段请求），不缓存整文件（200）以免撑爆存储
  if (rawResponse.ok && rawResponse.status === 206 && rangeHeader && event) {
    const range = parseRange(rangeHeader);
    if (range) {
      const cloned = rawResponse.clone();
      event.waitUntil(
        caches.open(VIDEO_CACHE).then(async (cache) => {
          try {
            await cache.put(`${url}|${range.start}-${range.end}`, cloned);
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

  const secFetchDest = (event.request.headers.get('Sec-Fetch-Dest') || '').toLowerCase();
  const isMediaRequest = secFetchDest === 'video' || secFetchDest === 'audio';

  event.respondWith(
    (async () => {
      if (isMediaRequest) {
        // <video>/<audio> 元素请求：优先命中缓存
        const range = parseRange(event.request.headers.get('Range'));
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
