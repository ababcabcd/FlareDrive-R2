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

// GET 请求 — 与 HEAD 不同，浏览器 <video>/<audio>（no-cors 模式，不需要 CORS 头）直接 302 到 CDN
// 其他请求（JS fetch 预取、图片等）代理 R2 内容，确保 CORS 头完整返回
export async function onRequestGet(context: any) {
  const authError = checkAuth(context);
  if (authError) return authError;

  const url = getPubUrl(context);
  const request = context.request;
  const [_, path] = parseBucketPath(context);

  // 浏览器原生 <video>/<audio> 请求（Sec-Fetch-Dest: video/audio）使用 no-cors 模式，
  // 且 Safari 对 faststart 视频会发巨量 Range（如 2.9GB），Pages Function 代理会超时/断连。
  // 走 302 直连 CDN，绕过 Worker 体量限制。
  const secFetchDest = (request.headers.get('Sec-Fetch-Dest') || '').toLowerCase();
  if (secFetchDest === 'video' || secFetchDest === 'audio') {
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
  if (path && !path.startsWith("_$flaredrive$/thumbnails/")) {
    const fileName = path.split('/').pop();
    if (fileName) {
      headers.set("Content-Disposition", `inline; filename="${encodeURIComponent(fileName)}"`);
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
