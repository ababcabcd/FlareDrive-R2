export function notFound() {
  return new Response("Not found", { status: 404 });
}

export function parseBucketPath(context): [any, string] {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.search);

  // 优先使用 name query 参数（文件名含中文/特殊字符时，放在路径里会导致 wrangler 路由 405）
  const nameParam = searchParams.get("name");
  const path = nameParam !== null
    ? nameParam
    : decodeURIComponent((params.path || [] as String[]).join("/"));
  const driveid = url.hostname.replace(/\..*/, "");

  return [env[driveid] || env["BUCKET"], path];
}
