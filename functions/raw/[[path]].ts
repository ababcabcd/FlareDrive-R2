import { notFound, parseBucketPath } from "@/utils/bucket";
import { can_access_path } from "@/utils/auth";

// 常见的视频/音频 MIME 类型，这些文件需要支持流式播放
const STREAMABLE_TYPES = [
  "video/", "audio/", "application/ogg",
];

function isStreamable(contentType: string | null): boolean {
  if (!contentType) return false;
  return STREAMABLE_TYPES.some((t) => contentType!.startsWith(t));
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
  const filePath = requestUrl.pathname.replace(/^\/raw\//, "");
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

// GET 请求 — 支持 Range 的流式文件服务
export async function onRequestGet(context: any) {
  const authError = checkAuth(context);
  if (authError) return authError;

  const [bucket, path] = parseBucketPath(context);
  const url = getPubUrl(context);

  // 转发客户端的所有请求头（包括 Range）到 R2
  const fetchHeaders = new Headers(context.request.headers);
  // 移除 host 头，避免 host 不匹配导致的问题
  fetchHeaders.delete("host");

  const response = await fetch(new Request(url, {
    headers: fetchHeaders,
    method: "GET",
    redirect: "follow",
  }));

  const headers = new Headers(response.headers);
  const corsHeaders = buildCorsHeaders();
  corsHeaders.forEach((v, k) => headers.set(k, v));

  const contentType = headers.get("Content-Type");

  // 确保告知客户端支持 Range 请求（流式播放的关键）
  if (!headers.has("Accept-Ranges")) {
    headers.set("Accept-Ranges", "bytes");
  }

  // 缩略图长期缓存
  if (path && path.startsWith("_$flaredrive$/thumbnails/")) {
    headers.set("Cache-Control", "max-age=31536000");
  } else if (isStreamable(contentType)) {
    // 流媒体文件使用短缓存覆盖单次播放的所有 Range 请求，减少回源延迟
    headers.set("Cache-Control", "max-age=300, must-revalidate");
    // 保留 ETag 和 Last-Modified 让浏览器可以做条件请求
  }

  // 206 响应不做额外缓存处理，R2 已正确设置相关头
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}
