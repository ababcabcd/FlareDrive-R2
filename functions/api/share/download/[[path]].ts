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

    const headers = buildCorsHeaders();
    headers.set("Location", pubUrl);
    headers.set("Cache-Control", "no-cache");

    return new Response(null, { status: 302, headers });
  } catch (e: any) {
    return new Response("无效的分享链接", { status: 400 });
  }
}