import { notFound, parseBucketPath } from "@/utils/bucket";

export async function onRequestGet(context) {
  const [bucket, path] = parseBucketPath(context);
  if (!bucket) return notFound();

  const url = new URL(context.request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response("缺少分享 token", { status: 400 });
  }

  try {
    const decoded = JSON.parse(atob(token));
    if (Date.now() > decoded.expires) {
      return new Response("分享链接已过期", { status: 410 });
    }

    const obj = await bucket.get(decoded.path);
    if (!obj) {
      return new Response("文件不存在", { status: 404 });
    }

    const fileName = decoded.path.split("/").pop();
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