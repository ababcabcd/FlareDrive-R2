import { notFound, parseBucketPath } from "@/utils/bucket";
import { can_access_path } from "@/utils/auth";

// ========================= 边缘缓存层 =========================
// 使用 Cloudflare Cache API（caches.default）在 Worker 层缓存 PUBURL 响应。
// 同一视频被多人/多次观看时，后续 Range 请求直接从边缘节点返回，避免回源 R2。
// 注意：cache.match 在 dev 环境可能不可用，此时 fallback 到直接 fetch。
const EDGE_CACHE_TTL = 3600; // 边缘缓存 1 小时

async function fetchWithEdgeCache(
  pubUrl: string,
  reqHeaders: Headers,
  ctx: any,
): Promise<Response> {
  const cache = typeof caches !== 'undefined' ? caches.default : undefined;
  const range = reqHeaders.get("Range") || "";

  // 有边缘缓存时，优先查缓存
  if (cache) {
    const cacheKeyUrl = range
      ? `${pubUrl}${pubUrl.includes("?") ? "&" : "?"}__r=${encodeURIComponent(range)}`
      : pubUrl;
    try {
      const cached = await cache.match(cacheKeyUrl);
      if (cached) return cached;
    } catch (_) { /* dev 环境 fallthrough */ }

    const response = await fetch(new Request(pubUrl, {
      method: "GET",
      headers: reqHeaders,
      redirect: "follow",
    }));

    // 将 206 响应写入边缘缓存，后续命中的请求零回源
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

  // 无边缘缓存（dev / 非标准环境）：直接回源
  return fetch(new Request(pubUrl, {
    method: "GET",
    headers: reqHeaders,
    redirect: "follow",
  }));
}

// MIME 类型修正映射：浏览器可内联预览的类型 vs R2 可能错误返回的 octet-stream
const MIME_FALLBACK: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  ogg: "video/ogg",
  ogv: "video/ogg",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  flac: "audio/flac",
  aac: "audio/aac",
  m4a: "audio/mp4",
  oga: "audio/ogg",
  pdf: "application/pdf",
};

function fixContentType(headers: Headers, path: string | undefined): void {
  if (!path) return;
  const ct = headers.get("Content-Type") || "";
  // 只在 R2 返回了错误/缺失的 MIME 类型时才修正（包括 axios 默认的 x-www-form-urlencoded）
  if (ct === "application/octet-stream" || ct === "application/x-www-form-urlencoded" || !ct || ct.startsWith("binary/")) {
    const ext = (path.split(".").pop() || "").toLowerCase();
    if (MIME_FALLBACK[ext]) {
      headers.set("Content-Type", MIME_FALLBACK[ext]);
      // 移除可能存在的 download 头，确保浏览器内联预览
      headers.delete("Content-Disposition");
    }
  }
}

function buildCorsHeaders(): Headers {
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Range, Content-Type, Authorization");
  headers.set("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Length, Content-Type, ETag");
  headers.set("Access-Control-Max-Age", "86400");
  return headers;
}

// RFC 5987 编码 Content-Disposition 文件名，支持中文/特殊字符
function encodeContentDisposition(fileName: string, disposition: 'inline' | 'attachment' = 'inline'): string {
  const encoded = encodeURIComponent(fileName);
  return `${disposition}; filename="${fileName}"; filename*=UTF-8''${encoded}`;
}

// 鉴权检查的公共逻辑
function checkAuth(context: any): Response | null {
  const [bucket, path] = parseBucketPath(context);
  if (!bucket) return notFound();
  if (!can_access_path(context, path || "")) {
    const headers = new Headers();
    headers.set("WWW-Authenticate", 'Basic realm="需要登录"');
    return new Response("没有读取权限", { status: 401, headers });
  }
  return null;
}

// OPTIONS 预检请求
export async function onRequestOptions(context: any) {
  const authError = checkAuth(context);
  if (authError) return authError;

  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(),
  });
}

// 构造 PUBURL 的完整 URL（处理中文等特殊字符的编码）
function getPubUrl(context: any): string {
  const requestUrl = new URL(context.request.url);
  // 优先使用 name query 参数（中文/特殊字符放路径会导致 wrangler 路由 404/405）
  const nameParam = requestUrl.searchParams.get("name");
  const filePath = nameParam !== null ? nameParam : requestUrl.pathname.replace(/^\/raw\//, "");
  return new URL(filePath, context.env["PUBURL"]).href;
}

// HEAD 请求 — 返回文件元信息（大小、类型、是否支持 Range）
export async function onRequestHead(context: any) {
  const authError = checkAuth(context);
  if (authError) return authError;

  const [bucket, urlPath] = parseBucketPath(context);
  const url = getPubUrl(context);

  // 当使用 /_fd_?name= 占位 URL 时，urlPath 永远是 _fd_，无法用于扩展名匹配。
  // 必须从 name 参数中提取真实文件路径。
  const requestUrl = new URL(context.request.url);
  const nameParam = requestUrl.searchParams.get("name");
  const effectivePath = nameParam !== null ? nameParam : (urlPath || '');

  const response = await fetch(new Request(url, {
    method: "HEAD",
    headers: context.request.headers,
    redirect: "follow",
  }));

  const headers = new Headers(response.headers);
  const corsHeaders = buildCorsHeaders();
  corsHeaders.forEach((v, k) => headers.set(k, v));

  // 兜底：修正 R2 未识别的 MIME 类型
  fixContentType(headers, effectivePath);

  // 确保告知客户端支持 Range 请求
  if (!headers.has("Accept-Ranges")) {
    headers.set("Accept-Ranges", "bytes");
  }

  if (urlPath && urlPath.startsWith("_$flaredrive$/thumbnails/")) {
    headers.set("Cache-Control", "max-age=31536000");
  }

  return new Response(null, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

// GET 请求 — 浏览器原生 <video>/<audio> 请求全部走 Worker 代理：
// - 无 Range：请求前 10MB，返回 206，浏览器据此获知文件大小并自行发送后续小范围请求
// - 大 Range（如 Safari 的 2.9GB 整文件请求）：夹紧到 10MB，避免 302 重定向后跨域直连 CDN 下载整文件失败
// - 中小 Range（seek / prefetch 的 2MB chunk）：原样转发
// 一律不走 302，避免 Safari 跨域直连 CDN 时超大 Range 请求超时/断连导致的“失败请求”
export async function onRequestGet(context: any) {
  const authError = checkAuth(context);
  if (authError) return authError;

  const url = getPubUrl(context);
  const request = context.request;
  const [_, urlPath] = parseBucketPath(context);

  // 当使用 /_fd_?name= 占位 URL 时，urlPath 永远是 _fd_，无法用于扩展名匹配和
  // MIME 修正。必须从 name 参数中提取真实文件路径。
  const requestUrl = new URL(context.request.url);
  const nameParam = requestUrl.searchParams.get("name");
  const effectivePath = nameParam !== null ? nameParam : (urlPath || '');

  const secFetchDest = (request.headers.get('Sec-Fetch-Dest') || '').toLowerCase();
  // SW 用 fetch() 转发请求时无法保留 Sec-Fetch-Dest（forbidden header），
  // 浏览器 new fetch() 中 Sec-Fetch-Dest 为 empty，因此依赖扩展名判断。
  // 只要文件扩展名是媒体格式，一律视为媒体请求，不设 Content-Disposition，
  // 也不依赖 Range 头（Safari 初始探测不带 Range）。
  const mediaExtensions = ['mp4','m4v','mov','webm','ogv','ogg','mp3','wav','flac','aac','m4a','oga'];
  const fileExt = (effectivePath.split('.').pop() || '').toLowerCase();
  const isMediaExt = mediaExtensions.includes(fileExt);
  const isMediaRequest = (secFetchDest === 'video' || secFetchDest === 'audio')
    || isMediaExt;
  const reqHeaders = new Headers(request.headers);
  reqHeaders.delete('host');
  reqHeaders.delete('origin');
  reqHeaders.delete('referer');

  // 媒体请求不再手动夹紧 Range，直接原样透传给 R2。
  // Safari 对 moov-at-end 的视频需要自己控制请求范围来获取 metadata；任何
  // 夹紧操作都可能导致响应不完整，进而丢失 moov/duration，进度条显示 --:--。
  // 浏览器有完整的 MP4 解析逻辑，应信任其发出的 Range 请求。

  const response = await fetchWithEdgeCache(url, reqHeaders, context);

  const headers = new Headers(response.headers);
  const corsHeaders = buildCorsHeaders();
  corsHeaders.forEach((v, k) => headers.set(k, v));

  // 兜底：修正 R2 未识别的 MIME 类型（如已上传的视频/音频被存为 octet-stream）
  fixContentType(headers, effectivePath);

  // 设置 Content-Disposition 以便浏览器下载时使用正确的文件名
  // （URL 路径中的 _fd_ 占位段不含真实文件名，浏览器会错误地使用 _fd_ 作为文件名）
  // 注意：视频/音频流式请求不设置，避免影响播放器内联解析 Range 响应。
  // 显式下载请求（?dl=1）强制设置 attachment，确保浏览器/下载工具正确保存文件名。
  const isDownload = requestUrl.searchParams.get("dl") === "1";
  if (effectivePath && !effectivePath.startsWith("_$flaredrive$/thumbnails/") && (isDownload || !isMediaRequest)) {
    const fileName = effectivePath.split('/').pop();
    if (fileName) {
      headers.set("Content-Disposition", encodeContentDisposition(fileName, isDownload && isMediaRequest ? 'attachment' : 'inline'));
    }
  }

  if (!headers.has("Accept-Ranges")) {
    headers.set("Accept-Ranges", "bytes");
  }

  if (urlPath && urlPath.startsWith("_$flaredrive$/thumbnails/")) {
    headers.set("Cache-Control", "max-age=31536000");
  } else {
    // 允许浏览器缓存 Range 响应，预取和视频播放器可复用同一 chunk
    // private：按用户缓存（auth header 参与缓存键），不共享
    headers.set("Cache-Control", "private, max-age=3600");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
