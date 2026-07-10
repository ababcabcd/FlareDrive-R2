export async function onRequestGet(context) {
  const { params } = context;
  const token = params.path?.[0] || "";
  
  const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>文件分享</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      height: 100vh;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    
    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      padding: 40px;
      max-width: 500px;
      width: 100%;
      text-align: center;
      transition: max-width 0.3s ease;
      max-height: calc(100vh - 40px);
      overflow-y: auto;
    }
    
    .container.media {
      max-width: 900px;
      height: calc(100vh - 40px);
      overflow-y: hidden;
      display: flex;
      flex-direction: column;
    }
    
    .icon {
      width: 100px;
      height: 100px;
      margin: 0 auto 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 60px;
    }
    
    .success-icon {
      color: #10b981;
    }
    
    .error-icon {
      color: #ef4444;
    }
    
    .loading-icon {
      color: #6366f1;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    
    h1 {
      font-size: 24px;
      color: #1f2937;
      margin-bottom: 16px;
    }
    
    p {
      color: #6b7280;
      margin-bottom: 24px;
    }
    
    .file-info {
      background: #f3f4f6;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
      text-align: left;
    }
    
    .file-info div {
      margin-bottom: 8px;
    }
    
    .file-info div:last-child {
      margin-bottom: 0;
    }
    
    .file-label {
      font-size: 14px;
      color: #9ca3af;
      display: block;
      margin-bottom: 4px;
    }
    
    .file-value {
      font-size: 16px;
      color: #1f2937;
      font-weight: 500;
      word-break: break-all;
    }
    
    .preview-area {
      margin-bottom: 20px;
      border-radius: 8px;
      overflow: hidden;
      background: #000;
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 1 1 0%;
      min-height: 0;
    }
    
    .preview-image {
      width: 100%;
      max-height: 100%;
      object-fit: contain;
      display: block;
    }
    
    .preview-video {
      width: 100%;
      max-height: 100%;
      outline: none;
    }
    
    .preview-audio {
      width: 100%;
      outline: none;
      flex-shrink: 0;
      margin: 10px 0;
    }
    
    .btn-row {
      display: flex;
      gap: 12px;
    }
    
    .container.media .download-btn {
      flex: 0 0 auto;
    }
    
    .download-btn {
      flex: 1;
      padding: 14px 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 18px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    
    .download-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
    }
    
    .download-btn:active {
      transform: translateY(0);
    }
    
    .btn-icon {
      font-size: 20px;
    }
    
    .expired {
      background: #ef4444 !important;
    }
    
    .expired:hover {
      box-shadow: 0 10px 30px rgba(239, 68, 68, 0.4) !important;
    }
    
    .error-box {
      background: #fee2e2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
    }
    
    .error-box p {
      color: #dc2626;
      margin-bottom: 0;
    }
  </style>
</head>
<body>
  <div class="container" id="app">
    <div class="icon loading-icon">⏳</div>
    <h1>验证分享链接...</h1>
    <p>正在检查链接有效性，请稍候</p>
  </div>
  
  <script>
    var token = "${token}";
    var fileUrl = '/api/share/download/?token=' + token;
    var prefetchUrl = '/api/share/prefetch/?token=' + token;
    var shareFileName = '';

    // 分享落地页独立打开时也可能没有 SW，主动注册以确保视频缓存生效
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.mjs', { scope: '/', updateViaCache: 'none' })
        .then(function(reg) { reg.update().catch(function() {}); })
        .catch(function() {});
    }
    
    function isImage(type) { return type && /^image\\//.test(type); }
    function isVideo(type) { return type && /^video\\//.test(type); }
    function isAudio(type) { return type && /^audio\\//.test(type); }
    function isMedia(type) { return isImage(type) || isVideo(type) || isAudio(type); }

    // ===== 视频多线程预取（同源 fileUrl，兼容 Safari CORS 限制）=====
    var _pf = { active: false, running: false, ctrl: null, size: 0, endByte: 0 };

    function _pfByte(vid) {
      var d = vid.duration;
      if (!d || !isFinite(d) || !_pf.size) return 0;
      return Math.floor((vid.currentTime / d) * _pf.size);
    }

    async function _pfGo(from) {
      if (_pf.running) return;
      _pf.running = true;
      var CH = 2 * 1024 * 1024, BA = 3, PA = 1;
      var b = from;
      while (b < _pf.size && _pf.active) {
        var fs = [], e = b, n = 0;
        while (n < BA && e < _pf.size) { var ce = Math.min(e + CH - 1, _pf.size - 1); fs.push({ s: e, e: ce }); n++; e = ce + 1; }
        _pf.endByte = e;
        console.log('[Prefetch] batch bytes', fs[0].s + '-' + fs[fs.length - 1].e);
        for (var i = 0; i < fs.length; i += PA) {
          if (!_pf.active) return;
          var sl = fs.slice(i, i + PA);
          // 预取走 /api/share/prefetch/，绕过 SW 缓存查询开销，直达 Worker
          await Promise.allSettled(sl.map(function(ch) {
            return fetch(prefetchUrl, { headers: { Range: 'bytes=' + ch.s + '-' + ch.e }, signal: _pf.ctrl.signal })
              .then(function(r) { if (r.ok) return r.arrayBuffer(); throw new Error(String(r.status)); });
          }));
        }
        b = e;
      }
      _pf.running = false;
    }

    function _pfOnTime(e) {
      if (!_pf.active || _pf.running) return;
      var b = _pfByte(e.target), m = 15 * 1024 * 1024;
      if (b + m >= _pf.endByte && _pf.endByte < _pf.size) _pfGo(_pf.endByte);
    }

    function _pfOnSeek(e) {
      if (!_pf.active) return;
      var b = _pfByte(e.target);
      // 只在向前跳到预取范围之外时才重启；向后跳说明用户在重看已缓存区域，切勿干预
      if (b > _pf.endByte + 10 * 1024 * 1024) {
        if (_pf.ctrl) _pf.ctrl.abort();
        _pf.ctrl = new AbortController();
        _pf.running = false;
        _pfGo(b);
      }
    }

    async function _pfStart(vid) {
      if (_pf.active) return;
      _pf.active = true;
      _pf.ctrl = new AbortController();
      // HEAD 获取文件大小（兼容 Safari，不会触发 body.cancel() 报错）
      try {
        var hr = await fetch(prefetchUrl, { method: 'HEAD', signal: _pf.ctrl.signal });
        _pf.size = parseInt(hr.headers.get('Content-Length'), 10) || 0;
      } catch(e) { if (e.name !== 'AbortError') { _pfStop(); } return; }
      if (_pf.size <= 0) { _pfStop(); return; }
      console.log('[Prefetch] start, size=', (_pf.size / 1024 / 1024).toFixed(1) + 'MB');
      vid.addEventListener('timeupdate', _pfOnTime);
      vid.addEventListener('seeked', _pfOnSeek);
      _pfGo(0);
    }

    function _pfStop() {
      _pf.active = false; _pf.running = false;
      if (_pf.ctrl) { _pf.ctrl.abort(); _pf.ctrl = null; }
    }
    // ===== 预取结束 =====
    
    function getIcon(type) {
      if (isImage(type)) return '🖼️';
      if (isVideo(type)) return '🎬';
      if (isAudio(type)) return '🎵';
      return '📁';
    }
    
    function getLabel(type) {
      if (isImage(type)) return '图片';
      if (isVideo(type)) return '视频';
      if (isAudio(type)) return '音频';
      return '文件';
    }
    
    async function validateShare() {
      var response = await fetch('/api/share/?token=' + token);
      var data = await response.json();
      
      var app = document.getElementById('app');
      
      if (data.valid) {
        shareFileName = data.fileName;
        var icon = getIcon(data.contentType);
        var label = getLabel(data.contentType);
        
        if (isMedia(data.contentType)) {
          app.classList.add('media');
          
          var previewHtml = '';
          if (isImage(data.contentType)) {
            previewHtml = '<div class="preview-area"><img src="' + fileUrl + '" alt="' + data.fileName + '" class="preview-image" onerror="this.parentElement.innerHTML=\\'<p style=color:#999;padding:40px>图片加载失败</p>\\'"></div>';
          } else if (isVideo(data.contentType)) {
            previewHtml = '<div class="preview-area"><video src="' + fileUrl + '" controls autoplay preload="metadata" playsinline class="preview-video" onerror="this.parentElement.innerHTML=\\'<p style=color:#999;padding:40px>视频加载失败</p>\\'"></video></div>';
          } else if (isAudio(data.contentType)) {
            previewHtml = '<audio src="' + fileUrl + '" controls autoplay class="preview-audio" onerror="this.style.display=\\'none\\'"></audio>';
          }
          
          app.innerHTML = 
            previewHtml +
            '<div class="file-info">' +
              '<div><span class="file-label">文件名</span><span class="file-value">' + data.fileName + '</span></div>' +
              '<div><span class="file-label">文件大小</span><span class="file-value">' + formatSize(data.size) + '</span></div>' +
            '</div>' +
            '<button class="download-btn" onclick="downloadFile()">' +
              '<span class="btn-icon">⬇️</span><span>下载' + label + '</span>' +
            '</button>';
          // 视频预取：只在用户主动点击视频后才启动（click once），
          // autoplay 不应触发预取，避免浪费带宽和 R2 请求。
          if (isVideo(data.contentType)) {
            var v = app.querySelector('video');
            if (v) {
              v.addEventListener('click', function() { _pfStart(v); }, { once: true });
            }
          }
        } else {
          app.innerHTML = 
            '<div class="icon success-icon">📁</div>' +
            '<h1>文件分享</h1>' +
            '<p>点击下方按钮下载文件</p>' +
            '<div class="file-info">' +
              '<div><span class="file-label">文件名</span><span class="file-value">' + data.fileName + '</span></div>' +
              '<div><span class="file-label">文件大小</span><span class="file-value">' + formatSize(data.size) + '</span></div>' +
            '</div>' +
            '<button class="download-btn" onclick="downloadFile()">' +
              '<span class="btn-icon">⬇️</span><span>下载文件</span>' +
            '</button>';
        }
      } else {
        app.innerHTML = 
          '<div class="icon error-icon">❌</div>' +
          '<h1>分享链接无效</h1>' +
          '<div class="error-box"><p>' + data.message + '</p></div>' +
          '<button class="download-btn expired" disabled><span>链接已失效</span></button>';
      }
    }
    
    function downloadFile() {
      // 优先网页内多线程下载；不支持流式落盘(Firefox/Safari)或小文件时回退原生单线程
      multiThreadDownload();
    }

    var _dl = { active: false, ctrl: null, writable: null };

    function showDlProgress(pct, label) {
      var el = document.getElementById('dlProgress');
      if (!el) {
        el = document.createElement('div');
        el.id = 'dlProgress';
        el.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:rgba(17,17,17,.85);color:#fff;padding:12px 18px;border-radius:12px;font-size:14px;z-index:9999;min-width:260px;box-shadow:0 8px 24px rgba(0,0,0,.3)';
        document.body.appendChild(el);
      }
      el.innerHTML = '<div style="margin-bottom:8px">' + (label || '下载中') + ' <b>' + Math.round(pct) + '%</b></div>' +
        '<progress value="' + pct + '" max="100" style="width:100%"></progress>';
      el.style.display = 'block';
    }
    function hideDlProgress() { var el = document.getElementById('dlProgress'); if (el) el.style.display = 'none'; }

    // 网页内多线程（分块 Range）下载：HEAD 拿大小，并行拉取多区间，
    // 通过 File System Access API 流式落盘（大文件不占满内存）；不支持则回退原生下载。
    // 计数在“真正开始下载”时发一次 HEAD(?dl=1)，取消保存对话框不计。
    async function multiThreadDownload() {
      if (_dl.active) return;
      // 1) HEAD 拿大小（不计）
      var head;
      try { head = await fetch(fileUrl, { method: 'HEAD' }); }
      catch (e) { window.location.href = fileUrl; return; }
      var total = parseInt(head.headers.get('Content-Length') || '0', 10);
      var contentType = head.headers.get('Content-Type') || 'application/octet-stream';
      // 小文件或不支持 File System Access：原生下载（计一次数）
      if (!total || total < 1024 * 1024 || typeof window.showSaveFilePicker !== 'function') {
        try { await fetch(fileUrl + '&dl=1', { method: 'HEAD' }); } catch (_) {}
        window.location.href = fileUrl;
        return;
      }
      var writable = null;
      try {
        var handle = await window.showSaveFilePicker({ suggestedName: shareFileName });
        writable = await handle.createWritable();
      } catch (e) {
        if (e && e.name === 'AbortError') return; // 用户取消保存：不计下载数
        try { await fetch(fileUrl + '&dl=1', { method: 'HEAD' }); } catch (_) {}
        window.location.href = fileUrl; return;
      }
      // 开始下载：计一次数
      try { await fetch(fileUrl + '&dl=1', { method: 'HEAD' }); } catch (_) {}
      _dl.active = true; _dl.writable = writable; _dl.ctrl = new AbortController();
      showDlProgress(0, '下载 ' + shareFileName + ' ...');
      var threads = Math.max(2, Math.min(8, Math.ceil(total / (25 * 1024 * 1024))));
      var chunk = Math.ceil(total / threads);
      var ranges = [];
      for (var i = 0; i < threads; i++) {
        var s = i * chunk, e = Math.min(total - 1, s + chunk - 1);
        if (s > e) break;
        ranges.push({ s: s, e: e, index: i });
      }
      var received = 0, writeChain = Promise.resolve(), queue = ranges.slice();
      function worker() {
        return (async function () {
          while (queue.length) {
            var r = queue.shift();
            var res = await fetch(fileUrl, { headers: { Range: 'bytes=' + r.s + '-' + r.e }, signal: _dl.ctrl.signal });
            if (res.status !== 206 && res.status !== 200) throw new Error('分块 ' + r.index + ' 返回 ' + res.status);
            // 流式读取：每收到一个网络 chunk 就更新进度，避免整段 arrayBuffer 完成前进度卡在 0%
            var reader = res.body.getReader();
            var chunks = [];
            var chunkReceived = 0;
            while (true) {
              var result = await reader.read();
              if (result.done) break;
              chunks.push(result.value);
              chunkReceived += result.value.length;
              received += result.value.length;
              var pct = total ? (received / total) * 100 : 0;
              showDlProgress(pct, '下载 ' + shareFileName + ' ...');
            }
            // 合并本分块并按顺序写入
            var buf = new Uint8Array(chunkReceived);
            var offset = 0;
            for (var i = 0; i < chunks.length; i++) {
              buf.set(chunks[i], offset);
              offset += chunks[i].length;
            }
            // 顺序写：每个写操作挂在前一个之后，保证字节顺序；用 IIFE 捕获当前 buf 避免闭包串块
            (function (b) { writeChain = writeChain.then(function () { return writable.write(b); }); })(buf);
          }
        })();
      }
      try {
        await Promise.all(Array.from({ length: threads }, worker));
        await writeChain;
        await writable.close();
        showDlProgress(100, '下载完成: ' + shareFileName);
        setTimeout(hideDlProgress, 800);
      } catch (e) {
        if (_dl.ctrl.signal.aborted) showDlProgress(0, '已取消下载');
        else { console.error('多线程下载失败', e); try { await writable.close(); } catch (_) {} window.location.href = fileUrl; }
      } finally { _dl.active = false; }
    }
    
    function formatSize(size) {
      var units = ['B', 'KB', 'MB', 'GB', 'TB'];
      var i = 0;
      while (size >= 1024) {
        size /= 1024;
        i++;
      }
      return size.toFixed(1) + ' ' + units[i];
    }
    
    validateShare();
  </script>
</body>
</html>
  `;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}