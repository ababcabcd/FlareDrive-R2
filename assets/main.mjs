const THUMBNAIL_SIZE = 144;

/**
 * @param {File} file
 */
export async function generateThumbnail(file) {
  const canvas = document.createElement("canvas");
  canvas.width = THUMBNAIL_SIZE;
  canvas.height = THUMBNAIL_SIZE;
  var ctx = canvas.getContext("2d");

  /** @type HTMLImageElement */
  if (file.type.startsWith("image/")) {
    let blobUrl = null;
    const image = await new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      blobUrl = URL.createObjectURL(file);
      image.src = blobUrl;
    });
    ctx.drawImage(image, 0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
    URL.revokeObjectURL(blobUrl);
  } else if (file.type === "video/mp4") {
    // Generate thumbnail from video（无需播放，loadeddata 即可取帧）
    let blobUrl = null;
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "auto";

    const cleanup = () => {
      video.removeAttribute("src"); // 先断开，避免 Safari 后台继续加载
      video.load();
      if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null; }
    };

    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          cleanup();
          reject(new Error("Video load timeout"));
        }, 5000);
        video.onloadeddata = () => {
          clearTimeout(timer);
          video.currentTime = 1;
          video.onseeked = () => resolve(video);
        };
        video.onerror = () => {
          clearTimeout(timer);
          cleanup();
          reject(new Error("Video load error"));
        };
        blobUrl = URL.createObjectURL(file);
        video.src = blobUrl;
      });
      ctx.drawImage(video, 0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
    } finally {
      cleanup();
    }
  }

  /** @type Blob */
  const thumbnailBlob = await new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob))
  );

  return thumbnailBlob;
}

/**
 * @param {Blob} blob
 */
export async function blobDigest(blob) {
  const digest = await crypto.subtle.digest("SHA-1", await blob.arrayBuffer());
  const digestArray = Array.from(new Uint8Array(digest));
  const digestHex = digestArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return digestHex;
}

export const SIZE_LIMIT = 25 * 1024 * 1024; // 25MB：更细粒度让进度心跳更短更平滑；满足 R2 单 part ≥5MB 约束，并避开 Pages 对超大请求体的限制

/**
 * @param {string} key
 * @param {File} file
 * @param {Record<string, any>} options
 */
export async function multipartUpload(key, file, options) {
  const headers = options?.headers || {};
  headers["content-type"] = file.type || "application/octet-stream";
  const signal = options?.signal;
  const CONCURRENCY = 4;
  // 文件名含中文/特殊字符时，放路径会导致 wrangler 路由 405，改用 name query 参数
  const nameParam = `name=${encodeURIComponent(key)}`;

  const uploadId = await axios
    .post(`/api/write/items/_fd_?${nameParam}&uploads`, "", { headers, signal })
    .then((res) => res.data.uploadId);
  const totalChunks = Math.ceil(file.size / SIZE_LIMIT);

  // 每个分块当前已上传字节数；uploadedParts[i] 有值表示该块已完成
  const chunkBytes = new Array(totalChunks).fill(0);
  const uploadedParts = new Array(totalChunks);

  /** 汇总所有并行分块的已上传字节数，上报全局进度 */
  const reportProgress = () => {
    if (typeof options?.onUploadProgress !== "function") return;
    let totalLoaded = 0;
    for (let i = 0; i < totalChunks; i++) {
      if (uploadedParts[i]) {
        // 已完成的块：计入完整大小
        totalLoaded += (i < totalChunks - 1) ? SIZE_LIMIT : (file.size - i * SIZE_LIMIT);
      } else {
        totalLoaded += chunkBytes[i];
      }
    }
    options.onUploadProgress({ loaded: totalLoaded, total: file.size });
  };

  /** 上传单个分块 */
  const uploadPart = async (partNumber) => {
    const i = partNumber - 1;
    const start = i * SIZE_LIMIT;
    const end = Math.min((i + 1) * SIZE_LIMIT, file.size);
    const chunk = file.slice(start, end);
    const searchParams = new URLSearchParams({ partNumber, uploadId });

    const res = await axios.put(`/api/write/items/_fd_?${nameParam}&${searchParams}`, chunk, {
      signal,
      onUploadProgress(progressEvent) {
        chunkBytes[i] = progressEvent.loaded;
        reportProgress();
      },
    });

    uploadedParts[i] = { partNumber, etag: res.headers.etag };
    chunkBytes[i] = end - start; // 标记完成
    reportProgress();
  };

  // 并行上传：CONCURRENCY 个 worker 从队列取分块
  const queue = Array.from({ length: totalChunks }, (_, i) => i + 1);
  const workers = [];
  for (let w = 0; w < Math.min(CONCURRENCY, totalChunks); w++) {
    workers.push((async () => {
      while (queue.length > 0) {
        const partNumber = queue.shift();
        await uploadPart(partNumber);
      }
    })());
  }
  await Promise.all(workers);

  const completeParams = new URLSearchParams({ uploadId });
  await axios.post(`/api/write/items/_fd_?${nameParam}&${completeParams}`, {
    parts: uploadedParts,
  }, { signal });
}
