/**
 * videoProcess.mjs — 浏览器端视频 faststart 优化
 * 纯 JS 实现，零外部依赖，将 moov 原子移到文件头，
 * 让视频在 Safari 中无需爬完整个文件即可开始播放。
 *
 * 原理：解析 MP4 box 树 → 找到 stco/co64 更新偏移量 → 重排为 ftyp→moov→mdat→其他
 */

// ── 工具函数 ────────────────────────────────────────────

/** 读大端 uint32 */
function readU32(data, i) {
  return ((data[i] << 24) | (data[i + 1] << 16) | (data[i + 2] << 8) | data[i + 3]) >>> 0;
}

/** 写大端 uint32 */
function writeU32(data, i, v) {
  data[i] = (v >>> 24) & 0xff;
  data[i + 1] = (v >>> 16) & 0xff;
  data[i + 2] = (v >>> 8) & 0xff;
  data[i + 3] = v & 0xff;
}

/** 读大端 uint64 → Number（仅安全范围） */
function readU64(data, i) {
  const hi = readU32(data, i);
  const lo = readU32(data, i + 4);
  return hi * 0x100000000 + lo;
}

/** 写大端 uint64 */
function writeU64(data, i, v) {
  writeU32(data, i, Math.floor(v / 0x100000000));
  writeU32(data, i + 4, v % 0x100000000);
}

/** 读取 box header，返回 { offset, size, type, headerSize } */
function readBox(data, offset) {
  if (offset + 8 > data.length) return null;
  let size = readU32(data, offset);
  const type = String.fromCharCode(
    data[offset + 4], data[offset + 5], data[offset + 6], data[offset + 7]
  );
  let headerSize = 8;

  if (size === 1) {
    if (offset + 16 > data.length) return null;
    size = readU64(data, offset + 8);
    headerSize = 16;
  } else if (size === 0) {
    size = data.length - offset;
  }

  return { offset, size: Number(size), type, headerSize };
}

// ── 检测 ────────────────────────────────────────────────

/**
 * 快速检测 moov 是否已在文件头部
 */
async function isAlreadyFaststart(file) {
  const CHECK = 1024 * 1024;
  const head = new Uint8Array(
    await file.slice(0, Math.min(file.size, CHECK)).arrayBuffer()
  );
  let off = 0;
  while (off + 8 <= head.length) {
    const box = readBox(head, off);
    if (!box) break;
    if (box.type === 'moov') return true;
    if (box.size <= 0 || box.size > head.length - off) break;
    off += box.size;
  }
  return false;
}

// ── 核心：faststart ─────────────────────────────────────

/**
 * 递归更新 moov 子树内所有 stco / co64 的 chunk 偏移
 * @param {Uint8Array} buf  完整文件的 buffer
 * @param {number} boxOffset 当前 box 起始偏移
 * @param {number} boxSize   当前 box 大小
 * @param {number} shift     偏移增量（moov 移动到了 mdat 前面，mdat 向后移动的量）
 */
function updateChunkOffsets(buf, boxOffset, boxSize, shift) {
  let off = boxOffset;
  const end = boxOffset + boxSize;
  while (off + 8 <= end) {
    const box = readBox(buf, off);
    if (!box || box.offset + box.size > end) break;

    if (box.type === 'stco') {
      // stco: version(1) + flags(3) + entry_count(4) + entries(entry_count × 4)
      const entryCount = readU32(buf, box.offset + box.headerSize + 4);
      let p = box.offset + box.headerSize + 8;
      for (let i = 0; i < entryCount; i++, p += 4) {
        writeU32(buf, p, readU32(buf, p) + shift);
      }
    } else if (box.type === 'co64') {
      // co64: version(1) + flags(3) + entry_count(4) + entries(entry_count × 8)
      const entryCount = readU32(buf, box.offset + box.headerSize + 4);
      let p = box.offset + box.headerSize + 8;
      for (let i = 0; i < entryCount; i++, p += 8) {
        writeU64(buf, p, readU64(buf, p) + shift);
      }
    } else if (isContainerBox(box.type)) {
      updateChunkOffsets(buf, box.offset + box.headerSize, box.size - box.headerSize, shift);
    }

    off += box.size;
  }
}

/** 容器 box 类型，递归进入查找 stco/co64 */
function isContainerBox(type) {
  return ['moov', 'trak', 'mdia', 'minf', 'stbl', 'udta', 'edts', 'dinf'].includes(type);
}

/**
 * 纯 JS 实现 MP4 faststart：ftyp → moov → mdat → 其他
 * @param {ArrayBuffer} arrayBuffer  完整 MP4 数据
 * @returns {{ data: ArrayBuffer, shifted: boolean } | null}
 */
function doFaststart(arrayBuffer) {
  const src = new Uint8Array(arrayBuffer);

  // 1. 解析所有顶层 box
  const topBoxes = [];
  let off = 0;
  while (off + 8 <= src.length) {
    const box = readBox(src, off);
    if (!box || box.size <= 0) break;
    topBoxes.push(box);
    off += box.size;
  }

  const ftyp = topBoxes.find(b => b.type === 'ftyp');
  const moov = topBoxes.find(b => b.type === 'moov');

  if (!moov) return null; // 没有 moov，无法处理

  // 检查是否已经 faststart（moov 已经在所有媒体数据之前）
  const moovIdx = topBoxes.indexOf(moov);
  // 判断：如果 mdat 不存在，或者 moov 已经在 mdat 之前 → 无需处理
  const mdatIdx = topBoxes.findIndex(b => b.type === 'mdat');
  if (mdatIdx === -1 || moovIdx < mdatIdx) return null;

  if (!ftyp) return null;

  // 2. 构建：ftyp → moov → 其余（mdat + 其他 box）
  const moovData = src.slice(moov.offset, moov.offset + moov.size);
  const moovSize = moov.size;

  // moov 移到 mdat 前面 → mdat 内数据的绝对偏移都增加了 moovSize
  updateChunkOffsets(moovData, moov.headerSize, moov.size - moov.headerSize, moovSize);

  // 2. 拼接输出：ftyp → moov → 其余
  const ftypData = src.slice(ftyp.offset, ftyp.offset + ftyp.size);
  const restBoxes = topBoxes.filter(b => b !== ftyp && b !== moov);
  const restParts = restBoxes.map(b => src.slice(b.offset, b.offset + b.size));
  const restLen = restParts.reduce((s, p) => s + p.length, 0);

  const out = new Uint8Array(ftyp.size + moovSize + restLen);
  let w = 0;
  out.set(ftypData, w); w += ftyp.size;
  out.set(moovData, w); w += moovSize;
  for (const p of restParts) { out.set(p, w); w += p.length; }

  console.log(`[VideoProcess] faststart: moov ${moov.offset}→${ftyp.size}, shift=${moovSize}`);
  return { data: out.buffer, shifted: true };
}

/**
 * 分块读取文件到 ArrayBuffer，上报真实进度
 * @param {File} file
 * @param {(pct: number) => void} onProgress 0..1
 * @returns {Promise<ArrayBuffer>}
 */
async function readWithProgress(file, onProgress, signal) {
  const CHUNK = 4 * 1024 * 1024; // 4MB 分块
  const total = file.size;
  let loaded = 0;
  const chunks = [];
  while (loaded < total) {
    if (signal?.aborted) throw new DOMException("Upload cancelled", "AbortError");
    const end = Math.min(loaded + CHUNK, total);
    chunks.push(await file.slice(loaded, end).arrayBuffer());
    loaded = end;
    onProgress(loaded / total);
  }
  // 合并所有分块
  const buf = new Uint8Array(total);
  let off = 0;
  for (const chunk of chunks) {
    buf.set(new Uint8Array(chunk), off);
    off += chunk.byteLength;
  }
  return buf.buffer;
}

// ── 对外接口 ────────────────────────────────────────────

/**
 * 优化视频文件：若 moov 在尾部则重排到头部
 * @param {File} file
 * @param {(pct: number) => void} [onProgress]
 * @param {AbortSignal} [signal] 取消信号
 * @returns {Promise<{ file: File, optimized: boolean }>}
 */
export async function optimizeVideo(file, onProgress, signal) {
  if (signal?.aborted) throw new DOMException("Upload cancelled", "AbortError");
  if (!file.type?.startsWith('video/')) return { file, optimized: false };

  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!['mp4', 'mov', 'm4v'].includes(ext)) return { file, optimized: false };

  const MAX_MB = 500;
  if (file.size > MAX_MB * 1024 * 1024) {
    console.warn(
      `[VideoProcess] ${(file.size / 1024 / 1024).toFixed(0)}MB > ${MAX_MB}MB，跳过 faststart，建议本地:\n` +
      `  ffmpeg -i "${file.name}" -c copy -movflags faststart output.mp4`
    );
    return { file, optimized: false };
  }

  try {
    onProgress?.(0.01);
    console.log(`[VideoProcess] 检测 ${file.name} ...`);

    // 已经是 faststart，跳过
    if (await isAlreadyFaststart(file)) {
      console.log(`[VideoProcess] moov 已在文件头，跳过: ${file.name}`);
      return { file, optimized: false };
    }

    onProgress?.(0.05);

    // 分块读取文件，上报真实进度 (0.05 → 0.20)
    const buf = await readWithProgress(file, (pct) => {
      onProgress?.(0.05 + pct * 0.15);
    }, signal);

    onProgress?.(0.20);
    console.log(`[VideoProcess] faststart 处理中: ${(buf.byteLength / 1024 / 1024).toFixed(1)}MB`);

    const result = doFaststart(buf);
    if (!result || !result.shifted) {
      console.log('[VideoProcess] 无需重排，可能已是 faststart');
      return { file, optimized: false };
    }

    onProgress?.(0.95);

    return {
      file: new File([result.data], file.name, { type: file.type || 'video/mp4' }),
      optimized: true,
    };
  } catch (e) {
    console.error('[VideoProcess] 处理失败，使用原始文件:', e);
    return { file, optimized: false };
  }
}
