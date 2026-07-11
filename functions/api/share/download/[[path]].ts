import { notFound, parseBucketPath } from "@/utils/bucket";

// ========================= 边缘缓存层 =========================
const EDGE_CACHE_TTL = 3600;

async function fetchWithEdgeCache(
  pubUrl: string,
  reqHeaders: Headers,
  ctx: any,
): Promise<Response> {
  const cache = typeof caches !== 'undefined' ? caches.default : undefined;
  const range = reqHeaders.get("Range") || "";

  if (cache) {
    const cacheKeyUrl = range
      ? `${pubUrl}${pubUrl.includes("?") ? "&" : "?"}__r=${encodeURIComponent(range)}`
      : pubUrl;
    try {
      const cached = await cache.match(cacheKeyUrl);
      if (cached) return cached;
    } catch (_) { /* dev */ }

    const response = await fetch(new Request(pubUrl, {
      method: "GET",
      headers: reqHeaders,
      redirect: "follow",
    }));

    if (response.status === 206 && ctx?.waitUntil) {
      const cloned = response.clone();
      const cachedHeaders = new Headers(cloned.headers);
      cachedHeaders.set("Cache-Control", `public, max-age=${EDGE_CACHE_TTL}, s-maxage=${EDGE_CACHE_TTL}`);
      cachedHeaders.set("CDN-Cache-Control", `max-age=${EDGE_CACHE_TTL}`);
      ctx.waitUntil(
        cache.put(cacheKeyUrl, new Response(cloned.body, {
          status: cloned.status,
          statusText: cloned.statusText,
          headers: cachedHeaders,
        })).catch(() => {}),
      );
    }

    return response;
  }

  return fetch(new Request(pubUrl, {
    method: "GET",
    headers: reqHeaders,
    redirect: "follow",
  }));
}

const SHARES_PREFIX = "_$flaredrive$/shares/";

// 模块级缓存：避免视频播放期间每次 Range 请求都触发 2 次 R2 API 调用
// （读分享 JSON + HEAD 查文件），这两个操作只在首次校验时执行一次。
// Workers 在同一隔离区（isolate）内复用模块作用域，后续 Range 请求可直接命中。
interface CachedMeta {
  key: string;
  size: number;
  contentType?: string;
  ts: number;
}
const META_CACHE = new Map<string, CachedMeta>();
const META_CACHE_TTL = 60_000; // 60 秒，覆盖同一视频会话的所有 Range 请求
const META_CACHE_MAX = 50;

function metaCacheSet(token: string, meta: CachedMeta) {
  if (META_CACHE.size >= META_CACHE_MAX) {
    let oldestK = '', oldestT = Infinity;
    for (const [k, v] of META_CACHE) {
      if (v.ts < oldestT) { oldestT = v.ts; oldestK = k; }
    }
    if (oldestK) META_CACHE.delete(oldestK);
  }
  META_CACHE.set(token, meta);
}

function metaCacheGet(token: string): CachedMeta | null {
  const entry = META_CACHE.get(token);
  if (!entry) return null;
  if (Date.now() - entry.ts > META_CACHE_TTL) {
    META_CACHE.delete(token);
    return null;
  }
  return entry;
}

// 根据扩展名兜底映射 MIME 类型（R2 上传时可能存成 application/octet-stream）
const EXT_TO_MIME: Record<string, string> = {
  mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime',
  webm: 'video/webm', ogv: 'video/ogg', ogg: 'video/ogg',
  mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac',
  aac: 'audio/aac', m4a: 'audio/mp4', oga: 'audio/ogg',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp',
  svg: 'image/svg+xml', avif: 'image/avif',
};

function resolveContentType(name: string, contentType?: string): string {
  if (contentType && contentType !== 'application/octet-stream') {
    return contentType;
  }
  const ext = (name.split('.').pop() || '').toLowerCase();
  return EXT_TO_MIME[ext] || contentType || 'application/octet-stream';
}

interface ShareMetadata {
  key: string;
  expiresAt: number | undefined;
  maxDownloads: number | undefined;
  currentDownloads: number;
  createdAt: number;
}

function buildCorsHeaders(): Headers {
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Range, Content-Type");
  headers.set("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Length, Content-Type");
  return headers;
}

// RFC 5987 编码 Content-Disposition 文件名，支持中文/特殊字符
function encodeContentDisposition(fileName: string): string {
  const encoded = encodeURIComponent(fileName);
  return `attachment; filename="${fileName}"; filename*=UTF-8''${encoded}`;
}

async function validateAndGetMetadata(bucket: any, token: string): Promise<{ metadata: ShareMetadata; errorResponse?: Response }> {
  const shareObject = await bucket.get(`${SHARES_PREFIX}${token}.json`);
  if (!shareObject) {
    return { metadata: null as any, errorResponse: new Response("分享链接不存在", { status: 404 }) };
  }

  const metadata: ShareMetadata = JSON.parse(await shareObject.text());
  const now = Date.now();

  if (metadata.expiresAt && now > metadata.expiresAt) {
    return { metadata, errorResponse: new Response("分享链接已过期", { status: 410 }) };
  }

  if (metadata.maxDownloads && metadata.currentDownloads >= metadata.maxDownloads) {
    return { metadata, errorResponse: new Response("下载次数已用完", { status: 410 }) };
  }

  return { metadata };
}

async function incrementDownloadCount(bucket: any, token: string, metadata: ShareMetadata, ctx: any) {
  metadata.currentDownloads += 1;
  // 异步更新计数，不阻塞响应（仅在生产环境 Cloudflare Pages 中可用）
  if (ctx?.waitUntil) {
    ctx.waitUntil(
      bucket.put(
        `${SHARES_PREFIX}${token}.json`,
        JSON.stringify(metadata),
        { httpMetadata: { contentType: "application/json" } }
      )
    );
  } else {
    // 降级：同步更新（本地开发环境）
    await bucket.put(
      `${SHARES_PREFIX}${token}.json`,
      JSON.stringify(metadata),
      { httpMetadata: { contentType: "application/json" } }
    );
  }
}

// OPTIONS 预检请求
export async function onRequestOptions(context: any) {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(),
  });
}

// HEAD 请求 — 返回文件元信息
export async function onRequestHead(context: any) {
  const [bucket, _path] = parseBucketPath(context);
  if (!bucket) return notFound();

  const url = new URL(context.request.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return new Response("缺少分享 token", { status: 400 });
  }

  try {
    const { metadata, errorResponse } = await validateAndGetMetadata(bucket, token);
    if (errorResponse) return errorResponse;

    // 仅当显式下载（dl=1）时才计数，避免视频预取/多线程下载的多次 Range 请求重复累加
    if (url.searchParams.get("dl") === "1") {
      await incrementDownloadCount(bucket, token, metadata, context);
    }

    // 用 head 获取文件元信息，不下载内容
    const obj = await bucket.head(metadata.key);
    if (!obj) {
      return new Response("文件不存在", { status: 404 });
    }

    const headers = new Headers();
    if (obj.httpMetadata?.contentType) {
      headers.set("Content-Type", obj.httpMetadata.contentType);
    }
    headers.set("Content-Length", obj.size.toString());
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "no-cache");

    // 合并 CORS 头
    const corsHeaders = buildCorsHeaders();
    corsHeaders.forEach((v, k) => headers.set(k, v));

    return new Response(null, { status: 200, headers });
  } catch (e: any) {
    return new Response("无效的分享链接", { status: 400 });
  }
}

export async function onRequestGet(context: any) {
  const [bucket, _path] = parseBucketPath(context);
  if (!bucket) return notFound();

  const url = new URL(context.request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response("缺少分享 token", { status: 400 });
  }

  try {
    const request = context.request;
    const rangeHeader = request.headers.get('Range');

    // 带 Range 的媒体流式请求优先走模块缓存，跳过 R2 校验开销（~2 次额外 RPC）
    // 首次请求做完整校验 + 写缓存，后续同一视频会话的 Range 请求直接命中缓存
    const cachedMeta = rangeHeader ? metaCacheGet(token) : null;

    let fileKey: string;
    let fileSize: number;
    let fileContentType: string | undefined;

    if (cachedMeta) {
      fileKey = cachedMeta.key;
      fileSize = cachedMeta.size;
      fileContentType = cachedMeta.contentType;
    } else {
      const { metadata, errorResponse } = await validateAndGetMetadata(bucket, token);
      if (errorResponse) return errorResponse;

      fileKey = metadata.key;

      const headObj = await bucket.head(fileKey);
      if (!headObj) {
        return new Response("文件不存在", { status: 404 });
      }

      fileSize = headObj.size;
      fileContentType = headObj.httpMetadata?.contentType;

      // 写入缓存：同一视频后续 Range 请求（数十次）可直接命中，避免重复 R2 I/O
      metaCacheSet(token, {
        key: fileKey,
        size: fileSize,
        contentType: fileContentType,
        ts: Date.now(),
      });
    }

    // 下载计数已统一在 HEAD(?dl=1) 中递增，避免多线程/视频预取的多次 Range 请求重复计数
    const pubUrl = new URL(fileKey, context.env["PUBURL"]).href;
    const secFetchDest = (request.headers.get('Sec-Fetch-Dest') || '').toLowerCase();

    // SW 用 fetch() 转发请求时无法保留 Sec-Fetch-Dest（forbidden header），
    // 导致 Worker 无法识别媒体请求。这里改为混合检测：
    // 1. Sec-Fetch-Dest 直接是 video/audio → 一定是媒体请求（含初始探测）
    // 2. 否则，如果请求带了 Range 且文件扩展名是视频/音频格式 → 也是媒体请求
    //    （SW 转发的流式 Range 请求，Sec-Fetch-Dest 已丢失但保留了 Range）
    // 注：初始探测虽然透传为 200 全文件（不做 clamp），但必须标记为媒体请求，
    //     否则 Worker 会设置 Content-Disposition: attachment 导致 Safari MEDIA_ERR。
    const fileName = fileKey.split('/').pop() || '';
    const mediaExtensions = ['mp4','m4v','mov','webm','ogv','ogg','mp3','wav','flac','aac','m4a','oga'];
    const fileExt = (fileName.split('.').pop() || '').toLowerCase();
    const isMediaExt = mediaExtensions.includes(fileExt);
    const isMediaRequest = (secFetchDest === 'video' || secFetchDest === 'audio')
      || (isMediaExt && rangeHeader !== null);

    // 媒体请求不再手动夹紧 Range，直接原样透传给 R2。
    // Safari 对 moov-at-end 的视频需要自己控制请求范围来获取 metadata；任何
    // 夹紧操作都可能导致响应不完整，进而丢失 moov/duration，进度条显示 --:--。
    // 浏览器有完整的 MP4 解析逻辑，应信任其发出的 Range 请求。

    const reqHeaders = new Headers(request.headers);
    reqHeaders.delete('host');
    reqHeaders.delete('origin');
    reqHeaders.delete('referer');

    // 其他请求代理到 PUBURL，确保 CORS 头完整并设置正确的下载文件名

    const response = await fetchWithEdgeCache(pubUrl, reqHeaders, context);

    const headers = new Headers(response.headers);
    const corsHeaders = buildCorsHeaders();
    corsHeaders.forEach((v, k) => headers.set(k, v));

    if (!headers.has("Accept-Ranges")) {
      headers.set("Accept-Ranges", "bytes");
    }

    // 如果 R2/CDN 返回的 Content-Type 是 octet-stream 或缺失，按扩展名兜底修正
    const resolvedType = resolveContentType(fileName, headers.get('Content-Type') || fileContentType);
    if (resolvedType) {
      headers.set('Content-Type', resolvedType);
    }

    // 视频/音频流式请求不设置 Content-Disposition，避免影响播放器内联解析 Range 响应
    if (!isMediaRequest) {
      if (fileName) {
        headers.set("Content-Disposition", encodeContentDisposition(fileName));
      }
    }

    headers.set("Cache-Control", "private, max-age=3600");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (e: any) {
    return new Response("无效的分享链接", { status: 400 });
  }
}