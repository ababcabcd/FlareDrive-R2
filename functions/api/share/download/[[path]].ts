import { notFound, parseBucketPath } from "@/utils/bucket";

const SHARES_PREFIX = "_$flaredrive$/shares/";

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
    const { metadata, errorResponse } = await validateAndGetMetadata(bucket, token);
    if (errorResponse) return errorResponse;

    // 确认文件存在
    const headObj = await bucket.head(metadata.key);
    if (!headObj) {
      return new Response("文件不存在", { status: 404 });
    }

    // 下载计数已统一在 HEAD(?dl=1) 中递增，避免多线程/视频预取的多次 Range 请求重复计数
    const pubUrl = new URL(metadata.key, context.env["PUBURL"]).href;
    const request = context.request;
    const secFetchDest = (request.headers.get('Sec-Fetch-Dest') || '').toLowerCase();
    const rangeHeader = request.headers.get('Range');
    const isMediaRequest = secFetchDest === 'video' || secFetchDest === 'audio';
    const MAX_PROXY_MEDIA_RANGE = 100 * 1024 * 1024; // 100MB

    // 浏览器原生 <video>/<audio> 的完整 GET/超大/开放式 Range 走 302 直连 CDN；
    // 中小 Range 走 Worker 代理，和 prefetch 共享缓存并确保 206 正确返回。
    if (isMediaRequest && (!rangeHeader || !isSmallRange(rangeHeader, MAX_PROXY_MEDIA_RANGE))) {
      const headers = buildCorsHeaders();
      headers.set("Location", pubUrl);
      headers.set("Cache-Control", "no-cache");
      return new Response(null, { status: 302, headers });
    }

    // 其他请求代理到 PUBURL，确保 CORS 头完整并设置正确的下载文件名
    const reqHeaders = new Headers(request.headers);
    reqHeaders.delete('host');
    reqHeaders.delete('origin');
    reqHeaders.delete('referer');

    const response = await fetch(new Request(pubUrl, {
      method: "GET",
      headers: reqHeaders,
      redirect: "follow",
    }));

    const headers = new Headers(response.headers);
    const corsHeaders = buildCorsHeaders();
    corsHeaders.forEach((v, k) => headers.set(k, v));

    if (!headers.has("Accept-Ranges")) {
      headers.set("Accept-Ranges", "bytes");
    }

    // 视频/音频流式请求不设置 Content-Disposition，避免影响播放器内联解析 Range 响应
    if (!isMediaRequest) {
      const fileName = metadata.key.split('/').pop();
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