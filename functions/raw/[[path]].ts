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
  const [_, path] = parseBucketPath(context);

  const secFetchDest = (request.headers.get('Sec-Fetch-Dest') || '').toLowerCase();
  const rangeHeader = request.headers.get('Range');
  // SW 用 fetch() 转发请求时无法保留 Sec-Fetch-Dest（forbidden header），
  // 这里使用混合检测：Sec-Fetch-Dest 直接为 video/audio → 媒体；否则
  // 带 Range 且扩展名为视频/音频格式 → 也是媒体（SW 流式转发）。
  // 不单纯凭扩展名判断，避免下载导航被误当媒体请求。
  const mediaExtensions = ['mp4','m4v','mov','webm','ogv','ogg','mp3','wav','flac','aac','m4a','oga'];
  const fileExt = ((path || '').split('.').pop() || '').toLowerCase();
  const isMediaRequest = secFetchDest === 'video' || secFetchDest === 'audio'
    || (rangeHeader && mediaExtensions.includes(fileExt));
  const MEDIA_CLAMP = 10 * 1024 * 1024; // 10MB 上限，避免浪费带宽

  const reqHeaders = new Headers(request.headers);
  reqHeaders.delete('host');
  reqHeaders.delete('origin');
  reqHeaders.delete('referer');

  // 媒体请求：夹紧 Range，确保单次 CDN 请求不超过 10MB
  if (isMediaRequest) {
    const parsed = rangeHeader ? parseByteRange(rangeHeader) : null;
    if (!parsed) {
      // 无 Range 或格式不标准（如 bytes=0-）：请求前 10MB
      reqHeaders.set('Range', `bytes=0-${MEDIA_CLAMP - 1}`);
    } else if (parsed.end - parsed.start + 1 > MEDIA_CLAMP) {
      // 超大 Range：夹紧到起始位置 + 10MB
      const clampedEnd = parsed.start + MEDIA_CLAMP - 1;
      reqHeaders.set('Range', `bytes=${parsed.start}-${clampedEnd}`);
    }
    // 小 Range：保持原样（已在 reqHeaders 中）
  }

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
