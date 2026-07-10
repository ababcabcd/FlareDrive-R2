/**
 * 分享页预取专用端点 — 轻量级代理，完全绕过 Service Worker
 *
 * 与 /api/share/download/ 的功能对齐但精简：
 * - 验证 share token 有效性
 * - 夹紧 Range 到 2MB（与预取 CHUNK_SIZE 对齐）
 * - 代理到 PUBURL，返回 CORS 响应
 * - 不做 Content-Disposition、不计数下载、不做 MIME fallback
 *
 * SW 不拦截 /api/share/prefetch/ 路径，省去 cache 查询 / fetchAndCache 包装开销。
 */

import { notFound, parseBucketPath } from "@/utils/bucket";

// ========================= 边缘缓存层 =========================
const EDGE_CACHE_TTL = 3600;

async function fetchWithEdgeCache(
  pubUrl: string,
  reqHeaders: Headers,
  ctx: any,
): Promise<Response> {
  const cache = (caches as any)?.default as Cache | undefined;
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

// ------------------------- CORS -------------------------

const CORS_HEADERS: [string, string][] = [
  ["Access-Control-Allow-Origin", "*"],
  ["Access-Control-Allow-Methods", "GET, HEAD, OPTIONS"],
  ["Access-Control-Allow-Headers", "Range, Content-Type"],
  ["Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Length, Content-Type"],
  ["Access-Control-Max-Age", "86400"],
];

function applyCors(headers: Headers): void {
  for (const [k, v] of CORS_HEADERS) {
    if (!headers.has(k)) headers.set(k, v);
  }
}

// ------------------------- 缓存 -------------------------

const SHARES_PREFIX = "_$flaredrive$/shares/";

interface ShareMetadata {
  key: string;
  expiresAt: number | undefined;
  maxDownloads: number | undefined;
  currentDownloads: number;
  createdAt: number;
}

interface CachedMeta {
  key: string;
  ts: number;
}

const META_CACHE = new Map<string, CachedMeta>();
const META_CACHE_TTL = 60_000;
const META_CACHE_MAX = 50;

function metaCacheGet(token: string): CachedMeta | null {
  const entry = META_CACHE.get(token);
  if (!entry) return null;
  if (Date.now() - entry.ts > META_CACHE_TTL) {
    META_CACHE.delete(token);
    return null;
  }
  return entry;
}

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

// ------------------------- 辅助 -------------------------

async function validateShare(bucket: any, token: string): Promise<{ key: string | null; errorResponse?: Response }> {
  const shareObject = await bucket.get(`${SHARES_PREFIX}${token}.json`);
  if (!shareObject) {
    return { key: null, errorResponse: new Response("分享链接不存在", { status: 404 }) };
  }

  const metadata: ShareMetadata = JSON.parse(await shareObject.text());
  const now = Date.now();

  if (metadata.expiresAt && now > metadata.expiresAt) {
    return { key: null, errorResponse: new Response("分享链接已过期", { status: 410 }) };
  }

  if (metadata.maxDownloads && metadata.currentDownloads >= metadata.maxDownloads) {
    return { key: null, errorResponse: new Response("下载次数已用完", { status: 410 }) };
  }

  return { key: metadata.key };
}

const PREFETCH_CLAMP = 10 * 1024 * 1024; // 10MB

// ------------------------- Route Handlers -------------------------

export async function onRequestOptions(context: any) {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/** GET — 验证 token 后代理 Range 请求到 PUBURL */
export async function onRequestGet(context: any) {
  const [bucket, _path] = parseBucketPath(context);
  if (!bucket) return notFound();

  const url = new URL(context.request.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return new Response("缺少分享 token", { status: 400 });
  }

  try {
    // 优先走模块缓存，跳过 R2 校验（与 /api/share/download/ 一致）
    const isRangeReq = !!context.request.headers.get("Range");
    const cachedMeta = isRangeReq ? metaCacheGet(token) : null;

    let fileKey: string;
    if (cachedMeta) {
      fileKey = cachedMeta.key;
    } else {
      const { key, errorResponse } = await validateShare(bucket, token);
      if (errorResponse) return errorResponse;
      if (!key) return new Response("文件不存在", { status: 404 });
      fileKey = key;
      metaCacheSet(token, { key: fileKey, ts: Date.now() });
    }

    const pubUrl = new URL(fileKey, context.env["PUBURL"]).href;
    const request = context.request;
    const rangeHeader = request.headers.get("Range");

    const reqHeaders = new Headers(request.headers);
    reqHeaders.delete("host");
    reqHeaders.delete("origin");
    reqHeaders.delete("referer");

    // 夹紧 Range：预取固定 2MB chunk
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

    const response = await fetchWithEdgeCache(pubUrl, reqHeaders, context);

    const headers = new Headers(response.headers);
    applyCors(headers);
    if (!headers.has("Accept-Ranges")) headers.set("Accept-Ranges", "bytes");
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
