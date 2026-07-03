import { parseBucketPath } from "@/utils/bucket";
import { can_access_path, get_allow_list } from "@/utils/auth";

export async function onRequestGet(context) {
  try {
    const { request } = context;
    const url = new URL(request.url);
    const query = url.searchParams.get("q");
    const path = url.searchParams.get("path") || "";
    
    if (!query || query.trim() === "") {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const [bucket] = parseBucketPath(context);
    if (!bucket) return new Response("Bucket not found", { status: 404 });

    const allowList = get_allow_list(context);
    if (!allowList) {
      const headers = new Headers();
      headers.set("WWW-Authenticate", 'Basic realm="需要登录"');
      return new Response("没有读取权限", { status: 401, headers });
    }

    const prefix = path ? `${path}/` : "";
    const results = [];
    const maxResults = 100;
    
    let marker = undefined;
    do {
      const objList = await bucket.list({
        prefix,
        include: ["httpMetadata", "customMetadata"],
      });

      for (const obj of objList.objects) {
        if (results.length >= maxResults) break;
        
        const key = obj.key;
        if (key.endsWith("/_$folder$")) continue;
        
        const fileName = key.split("/").pop();
        if (!fileName) continue;
        
        if (fileName.toLowerCase().includes(query.toLowerCase())) {
          const parentPath = key.substring(0, key.lastIndexOf("/"));
          results.push({
            key,
            name: fileName,
            path: parentPath + "/",
            size: obj.size,
            uploaded: obj.uploaded,
            httpMetadata: obj.httpMetadata,
            customMetadata: obj.customMetadata,
          });
        }
      }
      
      marker = objList.truncated ? objList.objects[objList.objects.length - 1]?.key : undefined;
    } while (marker && results.length < maxResults);

    return new Response(JSON.stringify({ results }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(e.toString(), { status: 500 });
  }
}