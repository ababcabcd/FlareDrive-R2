import { notFound, parseBucketPath } from "@/utils/bucket";
import { can_access_path } from "@/utils/auth";

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
  // 只在 R2 返回了错误/缺失的 MIME 类型时才修正
  if (ct === "application/octet-stream" || !ct || ct.startsWith("binary/")) {
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
function encodeContentDisposition(fileName: string): string {
  const encoded = encodeURIComponent(fileName);
  return `inline; filename="${fileName}"; filename*=UTF-8''${encoded}`;
}

// 解析单区间 Range 头：bytes=start-end
type ByteRange = { start: number; end: number };
function parseByteRange(rangeHeader: string | null): ByteRange | null {
  if (!rangeHeader) return null;
  const match = rangeHeader.match(/^bytes=(\d+)-(\d+)$/);
  if (!match) return null;
  const start = parseInt(match[1], 10);
  const end = parseInt(match[2], 10);
  if (isNaN(start) || isNaN(end) || start < 0 || end < start) return null;
  return { start, end };
}

// 判断 Range 是否为显式小范围，可安全走 Worker 代理
function isSmallRange(rangeHeader: string | null, maxBytes: number): boolean {
  const range = parseByteRange(rangeHeader);
  if (!range) return false;
  return range.end - range.start + 1 <= maxBytes;
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

  const [bucket, path] = parseBucketPath(context);
  const url = getPubUrl(context);

  const response = await fetch(new Request(url, {
    method: "HEAD",
    headers: context.request.headers,
    redirect: "follow",
  }));

  const headers = new Headers(response.headers);
  const corsHeaders = buildCorsHeaders();
  corsHeaders.forEach((v, k) => headers.set(k, v));

  // 兜底：修正 R2 未识别的 MIME 类型
  fixContentType(headers, path);

  // 确保告知客户端支持 Range 请求
  if (!headers.has("Accept-Ranges")) {
    headers.set("Accept-Ranges", "bytes");
  }

  if (path && path.startsWith("_$flaredrive$/thumbnails/")) {
    headers.set("Cache-Control", "max-age=31536000");
  }

  return new Response(null, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

// GET 请求 — 浏览器原生 <video>/<audio> 的完整 GET/超大 Range 走 302 直连 CDN，
// 中小 Range（seek、prefetch）走 Worker 代理，和 prefetch 共享缓存并确保 206 正确返回。
// 其他请求（JS fetch 预取、图片、下载等）代理 R2 内容，确保 CORS 头完整返回。
export async function onRequestGet(context: any) {
  const authError = checkAuth(context);
  if (authError) return authError;

  const url = getPubUrl(context);
  const request = context.request;
  const [_, path] = parseBucketPath(context);

  // 浏览器原生 <video>/<audio> 请求处理策略：
  // - 无 Range 或超大/开放式 Range（如 Safari 2.9GB）走 302 直连 CDN，避免 Worker 代理超时/断连。
  // - 明确的中小 Range（seek、prefetch 的 2MB chunk 等）走 Worker 代理，和 prefetch 共享缓存，
  //   并确保返回正确的 206 Partial Content，解决拖动进度条后无法播放的问题。
  const secFetchDest = (request.headers.get('Sec-Fetch-Dest') || '').toLowerCase();
  const rangeHeader = request.headers.get('Range');
  const isMediaRequest = secFetchDest === 'video' || secFetchDest === 'audio';
  const MAX_PROXY_MEDIA_RANGE = 100 * 1024 * 1024; // 100MB

  if (isMediaRequest && (!rangeHeader || !isSmallRange(rangeHeader, MAX_PROXY_MEDIA_RANGE))) {
    const redirectHeaders = new Headers(buildCorsHeaders());
    redirectHeaders.set('Location', url);
    redirectHeaders.set('Cache-Control', 'no-cache');
    return new Response(null, { status: 302, headers: redirectHeaders });
  }

  const reqHeaders = new Headers(request.headers);
  reqHeaders.delete('host');
  reqHeaders.delete('origin');
  reqHeaders.delete('referer');

  const response = await fetch(new Request(url, {
    method: "GET",
    headers: reqHeaders,
    redirect: "follow",
  }));

  const headers = new Headers(response.headers);
  const corsHeaders = buildCorsHeaders();
  corsHeaders.forEach((v, k) => headers.set(k, v));

  // 兜底：修正 R2 未识别的 MIME 类型（如已上传的视频/音频被存为 octet-stream）
  fixContentType(headers, path);

  // 设置 Content-Disposition 以便浏览器下载时使用正确的文件名
  // （URL 路径中的 _fd_ 占位段不含真实文件名，浏览器会错误地使用 _fd_ 作为文件名）
  // 注意：视频/音频流式请求不设置，避免影响播放器内联解析 Range 响应。
  if (path && !path.startsWith("_$flaredrive$/thumbnails/") && !isMediaRequest) {
    const fileName = path.split('/').pop();
    if (fileName) {
      headers.set("Content-Disposition", encodeContentDisposition(fileName));
    }
  }

  if (!headers.has("Accept-Ranges")) {
    headers.set("Accept-Ranges", "bytes");
  }

  if (path && path.startsWith("_$flaredrive$/thumbnails/")) {
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
