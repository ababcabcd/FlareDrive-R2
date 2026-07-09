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

export const SIZE_LIMIT = 100 * 1000 * 1000; // 100MB

/**
 * @param {string} key
 * @param {File} file
 * @param {Record<string, any>} options
 */
export async function multipartUpload(key, file, options) {
  const headers = options?.headers || {};
  headers["content-type"] = file.type;
  const signal = options?.signal;

  const uploadId = await axios
    .post(`/api/write/items/${key}?uploads`, "", { headers, signal })
    .then((res) => res.data.uploadId);
  const totalChunks = Math.ceil(file.size / SIZE_LIMIT);

  const promiseGenerator = function* () {
    for (let i = 1; i <= totalChunks; i++) {
      const chunk = file.slice((i - 1) * SIZE_LIMIT, i * SIZE_LIMIT);
      const searchParams = new URLSearchParams({ partNumber: i, uploadId });
      yield axios
        .put(`/api/write/items/${key}?${searchParams}`, chunk, {
          signal,
          onUploadProgress(progressEvent) {
            if (typeof options?.onUploadProgress !== "function") return;
            options.onUploadProgress({
              loaded: (i - 1) * SIZE_LIMIT + progressEvent.loaded,
              total: file.size,
            });
          },
        })
        .then((res) => ({
          partNumber: i,
          etag: res.headers.etag,
        }));
    }
  };

  const uploadedParts = [];
  for (const part of promiseGenerator()) {
    const { partNumber, etag } = await part;
    uploadedParts[partNumber - 1] = { partNumber, etag };
  }
  const completeParams = new URLSearchParams({ uploadId });
  await axios.post(`/api/write/items/${key}?${completeParams}`, {
    parts: uploadedParts,
  }, { signal });
}
