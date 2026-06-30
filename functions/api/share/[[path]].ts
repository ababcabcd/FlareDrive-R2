import { notFound, parseBucketPath } from "@/utils/bucket";
import { can_access_path } from "@/utils/auth";

function generateShareToken(path: string, expiresInMinutes: number): string {
  const expires = Date.now() + expiresInMinutes * 60 * 1000;
  const random = Math.random().toString(36).substring(2, 15);
  const data = JSON.stringify({ path, expires, random });
  return btoa(data);
}

export async function onRequestPost(context) {
  const [bucket, path] = parseBucketPath(context);
  if (!bucket) return notFound();
  
  if (!can_access_path(context, path)) {
    const headers = new Headers();
    headers.set("WWW-Authenticate", 'Basic realm="需要登录"');
    return new Response("没有操作权限", { status: 401, headers });
  }

  const request = context.request;
  const body = await request.json();
  const expiresInMinutes = body.expiresInMinutes || 24 * 60;

  const token = generateShareToken(path, expiresInMinutes);
  const shareUrl = `${new URL(request.url).origin}/share/${token}`;

  return new Response(JSON.stringify({ shareUrl, token, expiresInMinutes }), {
    headers: { "Content-Type": "application/json" },
  });
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
    const decoded = JSON.parse(atob(token));
    if (Date.now() > decoded.expires) {
      return new Response(JSON.stringify({ valid: false, message: "分享链接已过期" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const obj = await bucket.get(decoded.path);
    if (!obj) {
      return new Response(JSON.stringify({ valid: false, message: "文件不存在" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      valid: true,
      path: decoded.path,
      fileName: decoded.path.split("/").pop(),
      size: obj.size,
      contentType: obj.httpMetadata?.contentType,
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ valid: false, message: "无效的分享链接" }), {
      headers: { "Content-Type": "application/json" },
    });
  }
}