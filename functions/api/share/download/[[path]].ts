import { notFound, parseBucketPath } from "@/utils/bucket";

const SHARES_PREFIX = "_$flaredrive$/shares/";

interface ShareMetadata {
  key: string;
  expiresAt: number | undefined;
  maxDownloads: number | undefined;
  currentDownloads: number;
  createdAt: number;
}

export async function onRequestGet(context) {
  const [bucket, path] = parseBucketPath(context);
  if (!bucket) return notFound();

  const url = new URL(context.request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response("缺少分享 token", { status: 400 });
  }

  try {
    const shareObject = await bucket.get(`${SHARES_PREFIX}${token}.json`);
    if (!shareObject) {
      return new Response("分享链接不存在", { status: 404 });
    }

    const metadata: ShareMetadata = JSON.parse(await shareObject.text());
    const now = Date.now();

    if (metadata.expiresAt && now > metadata.expiresAt) {
      return new Response("分享链接已过期", { status: 410 });
    }

    if (metadata.maxDownloads && metadata.currentDownloads >= metadata.maxDownloads) {
      return new Response("下载次数已用完", { status: 410 });
    }

    const obj = await bucket.get(metadata.key);
    if (!obj) {
      return new Response("文件不存在", { status: 404 });
    }

    metadata.currentDownloads += 1;
    await bucket.put(
      `${SHARES_PREFIX}${token}.json`,
      JSON.stringify(metadata),
      {
        httpMetadata: { contentType: "application/json" },
      }
    );

    const fileName = metadata.key.split("/").pop();
    const headers = new Headers();
    
    if (obj.httpMetadata?.contentType) {
      headers.set("Content-Type", obj.httpMetadata.contentType);
    }
    headers.set("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);
    headers.set("Content-Length", obj.size.toString());
    headers.set("Cache-Control", "no-cache");

    return new Response(obj.body, { headers });
  } catch (e) {
    return new Response("无效的分享链接", { status: 400 });
  }
}