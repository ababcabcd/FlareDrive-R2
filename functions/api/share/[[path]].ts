import { notFound, parseBucketPath } from "@/utils/bucket";
import { can_access_path } from "@/utils/auth";

const SHARES_PREFIX = "_$flaredrive$/shares/";

// 根据扩展名兜底映射 MIME 类型（R2 上传时可能存成 application/octet-stream）
const EXT_TO_MIME: Record<string, string> = {
  mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime',
  webm: 'video/webm', ogv: 'video/ogg', ogg: 'video/ogg',
  mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac',
  aac: 'audio/aac', m4a: 'audio/mp4', oga: 'audio/ogg',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp',
  svg: 'image/svg+xml', avif: 'image/avif',
};

function resolveContentType(name: string, contentType?: string): string {
  if (contentType && contentType !== 'application/octet-stream') {
    return contentType;
  }
  const ext = (name.split('.').pop() || '').toLowerCase();
  return EXT_TO_MIME[ext] || contentType || 'application/octet-stream';
}

interface ShareMetadata {
  key: string;
  expiresAt: number | undefined;
  maxDownloads: number | undefined;
  currentDownloads: number;
  createdAt: number;
}

function generateShareId(): string {
  return Math.random().toString(36).substring(2, 12);
}

async function generateUniqueShareId(bucket): Promise<string> {
  let shareId = "";
  let attempts = 0;
  const maxAttempts = 5;
  
  while (attempts < maxAttempts) {
    shareId = generateShareId();
    const existingShare = await bucket.head(`${SHARES_PREFIX}${shareId}.json`);
    if (!existingShare) {
      break;
    }
    attempts++;
  }
  
  return shareId;
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
  
  const shareId = await generateUniqueShareId(bucket);
  
  const expiresAt = expiresInMinutes > 0 
    ? Date.now() + expiresInMinutes * 60 * 1000 
    : undefined;

  const shareMetadata: ShareMetadata = {
    key: path,
    expiresAt,
    maxDownloads: body.maxDownloads || undefined,
    currentDownloads: 0,
    createdAt: Date.now(),
  };

  await bucket.put(
    `${SHARES_PREFIX}${shareId}.json`,
    JSON.stringify(shareMetadata),
    {
      httpMetadata: { contentType: "application/json" },
    }
  );

  const shareUrl = `${new URL(request.url).origin}/share/${shareId}`;

  return new Response(JSON.stringify({ shareUrl, shareId, expiresAt }), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequestGet(context) {
  const [bucket, path] = parseBucketPath(context);
  if (!bucket) return notFound();

  const url = new URL(context.request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response(JSON.stringify({ valid: false, message: "缺少分享 token" }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }

  try {
    const shareObject = await bucket.get(`${SHARES_PREFIX}${token}.json`);
    if (!shareObject) {
      return new Response(JSON.stringify({ valid: false, message: "分享链接不存在" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const metadata: ShareMetadata = JSON.parse(await shareObject.text());
    const now = Date.now();

    if (metadata.expiresAt && now > metadata.expiresAt) {
      return new Response(JSON.stringify({ valid: false, message: "分享链接已过期" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (metadata.maxDownloads && metadata.currentDownloads >= metadata.maxDownloads) {
      return new Response(JSON.stringify({ valid: false, message: "下载次数已用完" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const obj = await bucket.head(metadata.key);
    if (!obj) {
      return new Response(JSON.stringify({ valid: false, message: "文件不存在" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const fileName = metadata.key.split("/").pop() || "";
    return new Response(JSON.stringify({
      valid: true,
      path: metadata.key,
      fileName,
      size: obj.size,
      contentType: resolveContentType(fileName, obj.httpMetadata?.contentType),
      currentDownloads: metadata.currentDownloads,
      maxDownloads: metadata.maxDownloads,
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ valid: false, message: "无效的分享链接" }), {
      headers: { "Content-Type": "application/json" },
    });
  }
}