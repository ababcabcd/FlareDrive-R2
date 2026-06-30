import { notFound } from "@/utils/bucket";
import { get_allow_list } from "@/utils/auth";

const SHARES_PREFIX = "_$flaredrive$/shares/";

interface ShareMetadata {
  key: string;
  expiresAt: number | undefined;
  maxDownloads: number | undefined;
  currentDownloads: number;
  createdAt: number;
}

function getBucket(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const driveid = url.hostname.replace(/\..*/, "");
  return env[driveid] || env["BUCKET"];
}

export async function onRequestGet(context) {
  const bucket = getBucket(context);
  if (!bucket) return notFound();
  
  const allowList = get_allow_list(context);
  if (!allowList) {
    const headers = new Headers();
    headers.set("WWW-Authenticate", 'Basic realm="需要登录"');
    return new Response("没有读取权限", { status: 401, headers });
  }

  const sharesList = await bucket.list({
    prefix: SHARES_PREFIX,
  });

  const shares = [];
  const now = Date.now();
  const origin = new URL(context.request.url).origin;

  for (const obj of sharesList.objects) {
    const shareId = obj.key.split("/").pop()?.replace(".json", "");
    if (!shareId) continue;

    const shareObject = await bucket.get(obj.key);
    if (!shareObject) continue;

    const metadata: ShareMetadata = JSON.parse(await shareObject.text());

    const isExpired = !!(metadata.expiresAt && now > metadata.expiresAt);
    const fileName = metadata.key.split("/").pop();

    shares.push({
      shareId,
      shareUrl: `${origin}/share/${shareId}`,
      key: metadata.key,
      fileName,
      expiresAt: metadata.expiresAt,
      maxDownloads: metadata.maxDownloads,
      currentDownloads: metadata.currentDownloads || 0,
      createdAt: metadata.createdAt,
      isExpired,
    });
  }

  shares.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  return new Response(JSON.stringify({ shares }), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequestDelete(context) {
  const bucket = getBucket(context);
  if (!bucket) return notFound();
  
  const allowList = get_allow_list(context);
  if (!allowList) {
    const headers = new Headers();
    headers.set("WWW-Authenticate", 'Basic realm="需要登录"');
    return new Response("没有操作权限", { status: 401, headers });
  }

  const url = new URL(context.request.url);
  const shareId = url.searchParams.get("shareId");

  if (!shareId) {
    return new Response("缺少分享 ID", { status: 400 });
  }

  const shareKey = `${SHARES_PREFIX}${shareId}.json`;
  
  const shareExists = await bucket.head(shareKey);
  if (!shareExists) {
    return new Response("分享链接不存在", { status: 404 });
  }

  await bucket.delete(shareKey);

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
}