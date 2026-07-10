/**
 * 预取专用端点 — 轻量级代理，完全绕过 Service Worker
 *
 * 浏览器视频分段预取请求直接走此端点：
 * - Auth 校验（与 /raw/ 一致）
 * - 夹紧 Range 到 2MB（与预取 CHUNK_SIZE 对齐）
 * - 代理到 PUBURL，返回 CORS 响应
 * - 不做媒体类型检测、Content-Disposition、MIME fallback（预取不关心这些）
 *
 * SW 不拦截 /api/prefetch/ 路径，省去 cache 查询 / fetchAndCache 包装开销。
 */

import { notFound, parseBucketPath } from "@/utils/bucket";
import { can_access_path } from "@/utils/auth";

// ------------------------- 工具函数 -------------------------

const CORS_HEADERS: [string, string][] = [
  ["Access-Control-Allow-Origin", "*"],
  ["Access-Control-Allow-Methods", "GET, HEAD, OPTIONS"],
  ["Access-Control-Allow-Headers", "Range, Content-Type, X-Flare-Auth"],
  ["Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Length, Content-Type"],
  ["Access-Control-Max-Age", "86400"],
];

function applyCors(headers: Headers): void {
  for (const [k, v] of CORS_HEADERS) {
    if (!headers.has(k)) headers.set(k, v);
  }
}

function checkAuth(context: any): Response | null {
  const [bucket, path] = parseBucketPath(context);
  if (!bucket) return notFound();
  if (!can_access_path(context, path || "")) {
    const h = new Headers();
    h.set("WWW-Authenticate", 'Basic realm="需要登录"');
    return new Response("没有读取权限", { status: 401, headers: h });
  }
  return null;
}

function getPubUrl(context: any): string {
  const requestUrl = new URL(context.request.url);
  const nameParam = requestUrl.searchParams.get("name");
  const filePath = nameParam !== null
    ? nameParam
    : requestUrl.pathname.replace(/^\/api\/prefetch\//, "");
  return new URL(filePath, context.env["PUBURL"]).href;
}

const PREFETCH_CLAMP = 2 * 1024 * 1024; // 2MB，与 App.vue 的 CHUNK_SIZE 对齐

// ------------------------- Route Handlers -------------------------

export async function onRequestOptions(context: any) {
  const authError = checkAuth(context);
  if (authError) return authError;
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/** HEAD — 返回文件大小等元信息 */
export async function onRequestHead(context: any) {
  const authError = checkAuth(context);
  if (authError) return authError;

  const url = getPubUrl(context);
  const response = await fetch(new Request(url, {
    method: "HEAD",
    headers: context.request.headers,
    redirect: "follow",
  }));

  const headers = new Headers(response.headers);
  applyCors(headers);
  if (!headers.has("Accept-Ranges")) headers.set("Accept-Ranges", "bytes");

  return new Response(null, { status: response.status, statusText: response.statusText, headers });
}

/** GET — 代理 Range 请求到 PUBURL */
export async function onRequestGet(context: any) {
  const authError = checkAuth(context);
  if (authError) return authError;

  const pubUrl = getPubUrl(context);
  const request = context.request;
  const rangeHeader = request.headers.get("Range");

  const reqHeaders = new Headers(request.headers);
  reqHeaders.delete("host");
  reqHeaders.delete("origin");
  reqHeaders.delete("referer");

  // 夹紧 Range：预取固定 2MB chunk，做一次安全上限检查
  if (rangeHeader) {
    const m = rangeHeader.match(/^bytes=(\d+)-(\d+)$/);
    if (m) {
      const start = parseInt(m[1], 10);
      const end = parseInt(m[2], 10);
      if (end - start + 1 > PREFETCH_CLAMP) {
        reqHeaders.set("Range", `bytes=${start}-${start + PREFETCH_CLAMP - 1}`);
      }
    }
  }

  const response = await fetch(new Request(pubUrl, {
    method: "GET",
    headers: reqHeaders,
    redirect: "follow",
  }));

  const headers = new Headers(response.headers);
  applyCors(headers);
  if (!headers.has("Accept-Ranges")) headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, max-age=3600");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
