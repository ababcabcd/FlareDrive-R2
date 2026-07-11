import { notFound, parseBucketPath } from "@/utils/bucket";
import { can_access_path, get_allow_list } from "@/utils/auth";

// OPTIONS 预检请求处理
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "X-Flare-Auth, Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function onRequestPost(context) {
  try {
    const [bucket, rawPath] = parseBucketPath(context);
    const path = rawPath ? rawPath.replace(/\/+$/, "") : "";
    if (!bucket || (path && `${path}/`.startsWith("_$flaredrive$/"))) return notFound();
    const allowList = get_allow_list(context);
    if (!allowList) {
      const headers = new Headers();
      headers.set("WWW-Authenticate", 'Basic realm="需要登录"');
      return new Response("没有读取权限", { status: 401, headers });
    }
    if (path && !can_access_path(context, path)) {
      const headers = new Headers();
      headers.set("WWW-Authenticate", 'Basic realm="需要登录"');
      return new Response("没有读取权限", { status: 401, headers });
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    return new Response(e.toString(), { status: 500 });
  }
}

export async function onRequestGet(context) {
  try {
    const [bucket, rawPath] = parseBucketPath(context);
    // 去掉尾部斜杠，避免拼接出双斜杠前缀导致 R2 列表查不到结果
    const path = rawPath ? rawPath.replace(/\/+$/, '') : '';
    const prefix = path && `${path}/`;
    if (!bucket || prefix.startsWith("_$flaredrive$/")) return notFound();
    const allowList = get_allow_list(context);
    if (!allowList) {
      const headers = new Headers();
      headers.set("WWW-Authenticate", 'Basic realm="需要登录"');
      return new Response("没有读取权限", { status: 401, headers });
    }
    if (prefix && !can_access_path(context, prefix)) {
      const headers = new Headers();
      headers.set("WWW-Authenticate", 'Basic realm="需要登录"');
      return new Response("没有读取权限", { status: 401, headers });
    }

    const objList = await bucket.list({
      prefix,
      delimiter: "/",
      include: ["httpMetadata", "customMetadata"],
    });
    let objKeys = objList.objects
      .filter((obj) => !obj.key.endsWith("/_$folder$") && !obj.key.endsWith("/"))
      .map((obj) => {
        const { key, size, uploaded, httpMetadata, customMetadata } = obj;
        return { key, size, uploaded, httpMetadata, customMetadata };
      });

    let folders = objList.delimitedPrefixes;
    if (!path)
      folders = folders.filter((folder) => folder !== "_$flaredrive$/");
    if (!allowList.includes("*") && !path) {
      objKeys = objKeys.filter((obj) =>
        allowList.some((allow) => obj.key.startsWith(allow))
      );
      folders = folders.filter((folder) =>
        allowList.some((allow) => folder.startsWith(allow))
      );
      for (const allow of allowList) {
        if (!folders.includes(allow)) folders.push(allow);
      }
    }

    return new Response(JSON.stringify({ value: objKeys, folders }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    return new Response(e.toString(), { status: 500 });
  }
}
