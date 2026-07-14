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
    
    .container.media .download-btn,
    .container.media .copy-btn {
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
    
    .copy-btn {
      padding: 14px 24px;
      background: white;
      color: #667eea;
      border: 2px solid #667eea;
      border-radius: 10px;
      font-size: 18px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      flex-shrink: 0;
    }
    
    .copy-btn:hover {
      background: #667eea;
      color: white;
      transform: translateY(-2px);
      box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);
    }
    
    .copy-btn:active {
      transform: translateY(0);
    }
    
    .aria2-btn {
      padding: 14px 24px;
      background: white;
      color: #059669;
      border: 2px solid #059669;
      border-radius: 10px;
      font-size: 18px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      flex: 1;
    }
    
    .aria2-btn:hover {
      background: #059669;
      color: white;
      transform: translateY(-2px);
      box-shadow: 0 10px 30px rgba(5, 150, 105, 0.3);
    }
    
    .aria2-btn:active {
      transform: translateY(0);
    }
    
    .container.media .aria2-btn {
      flex: 0 0 auto;
    }
    
    .aria2-settings-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,.5);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    
    .aria2-settings {
      background: white;
      border-radius: 16px;
      padding: 32px;
      max-width: 420px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0,0,0,.3);
    }
    
    .aria2-settings h3 {
      font-size: 20px;
      color: #1f2937;
      margin-bottom: 24px;
      margin-top: 0;
    }
    
    .aria2-settings .field {
      margin-bottom: 16px;
      text-align: left;
    }
    
    .aria2-settings .field label {
      display: block;
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 6px;
      font-weight: 500;
    }
    
    .aria2-settings .field input {
      width: 100%;
      padding: 10px 14px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      font-size: 15px;
      outline: none;
      transition: border-color .2s;
      box-sizing: border-box;
    }
    
    .aria2-settings .field input:focus {
      border-color: #059669;
    }
    
    .aria2-settings .hint {
      font-size: 12px;
      color: #9ca3af;
      margin-top: 4px;
    }
    
    .aria2-help-toggle {
      width: 100%;
      padding: 10px 14px;
      border: 1px dashed #d1d5db;
      border-radius: 8px;
      background: #f9fafb;
      font-size: 14px;
      color: #6b7280;
      cursor: pointer;
      text-align: left;
      transition: all .2s;
    }
    
    .aria2-help-toggle:hover {
      border-color: #059669;
      color: #059669;
      background: #f0fdf4;
    }
    
    .aria2-help-content {
      margin-top: 12px;
      padding: 16px;
      background: #f9fafb;
      border-radius: 8px;
      font-size: 13px;
      line-height: 1.6;
      color: #374151;
    }
    
    .aria2-help-content h4 {
      font-size: 13px;
      color: #1f2937;
      margin: 14px 0 6px;
    }
    
    .aria2-help-content h4:first-child {
      margin-top: 0;
    }
    
    .aria2-help-content code {
      display: block;
      padding: 8px 12px;
      background: #1f2937;
      color: #10b981;
      border-radius: 6px;
      font-size: 12px;
      margin: 4px 0;
      word-break: break-all;
      user-select: all;
    }
    
    .code-wrap {
      position: relative;
      margin: 4px 0;
    }
    .code-wrap code {
      padding-right: 42px;
    }
    .copy-code-btn {
      position: absolute;
      top: 4px;
      right: 4px;
      background: rgba(255,255,255,.08);
      border: 1px solid rgba(255,255,255,.12);
      color: #9ca3af;
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
      padding: 2px 8px;
      line-height: 1.4;
      transition: all .2s;
      user-select: none;
    }
    .copy-code-btn:hover {
      background: rgba(255,255,255,.18);
      color: #fff;
    }
    
    .aria2-help-content .hint {
      font-size: 12px;
      color: #9ca3af;
      margin: 4px 0 0;
    }
    
    .aria2-help-content a {
      color: #059669;
    }
    
    .aria2-toast {
      position: fixed;
      left: 50%;
      bottom: 24px;
      transform: translateX(-50%);
      background: rgba(17,17,17,.85);
      color: #fff;
      padding: 12px 18px;
      border-radius: 12px;
      font-size: 14px;
      z-index: 9999;
      box-shadow: 0 8px 24px rgba(0,0,0,.3);
      animation: toastIn .3s ease;
    }
    
    .aria2-toast.success { background: rgba(5,150,105,.9); }
    .aria2-toast.error { background: rgba(239,68,68,.9); }
    
    @keyframes toastIn {
      from { opacity: 0; transform: translateX(-50%) translateY(10px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
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
  
  <template id="aria2Tutorial">
    <h4>1. 安装 Caddy（macOS）</h4>
    <div class="code-wrap"><code>brew install caddy</code><button class="copy-code-btn" onclick="copyCode(this)">📋</button></div>
    <p class="hint">其他系统：<a href="https://caddyserver.com/download" target="_blank">caddyserver.com/download</a></p>
    <h4>2. 信任证书（首次）</h4>
    <div class="code-wrap"><code>caddy trust</code><button class="copy-code-btn" onclick="copyCode(this)">📋</button></div>
    <p class="hint">将 Caddy 自签 CA 加入系统信任，避免浏览器证书警告</p>
    <h4>3. 设为开机自启（macOS）</h4>
    <div class="code-wrap"><code>which caddy</code><button class="copy-code-btn" onclick="copyCode(this)">📋</button></div>
    <div class="code-wrap"><code style="white-space:pre-wrap">cat &gt; ~/Library/LaunchAgents/com.aria2-proxy.plist &lt;&lt; EOF
	&lt;?xml version=&quot;1.0&quot; encoding=&quot;UTF-8&quot;?&gt;
	&lt;!DOCTYPE plist PUBLIC &quot;-//Apple//DTD PLIST 1.0//EN&quot; &quot;http://www.apple.com/DTDs/PropertyList-1.0.dtd&quot;&gt;
	&lt;plist version=&quot;1.0&quot;&gt;
	&lt;dict&gt;
	    &lt;key&gt;Label&lt;/key&gt;
	    &lt;string&gt;com.aria2-proxy&lt;/string&gt;
	    &lt;key&gt;ProgramArguments&lt;/key&gt;
	    &lt;array&gt;
	        &lt;string&gt;{CADDY_PATH}&lt;/string&gt;
	        &lt;string&gt;reverse-proxy&lt;/string&gt;
	        &lt;string&gt;--from&lt;/string&gt;
	        &lt;string&gt;https://localhost:16801&lt;/string&gt;
	        &lt;string&gt;--to&lt;/string&gt;
	        &lt;string&gt;http://localhost:16800&lt;/string&gt;
	    &lt;/array&gt;
	    &lt;key&gt;RunAtLoad&lt;/key&gt;
	    &lt;true/&gt;
	    &lt;key&gt;KeepAlive&lt;/key&gt;
	    &lt;true/&gt;
	&lt;/dict&gt;
	&lt;/plist&gt;
	EOF</code><button class="copy-code-btn" onclick="copyCode(this)">📋</button></div>
    <div class="code-wrap"><code>launchctl load ~/Library/LaunchAgents/com.aria2-proxy.plist</code><button class="copy-code-btn" onclick="copyCode(this)">📋</button></div>
    <p class="hint">用 <code style="display:inline;padding:2px 4px;margin:0;font-size:11px">which caddy</code> 查路径替换 {CADDY_PATH}。<br>管理：<code style="display:inline;padding:2px 4px;margin:0;font-size:11px">launchctl unload ~/Library/LaunchAgents/com.aria2-proxy.plist</code> 停止，<code style="display:inline;padding:2px 4px;margin:0;font-size:11px">launchctl load ...</code> 重新加载。</p>
    <h4>4. 在此页面配置</h4>
    <p class="hint">协议选 <b>HTTPS</b>，主机 <b>localhost</b>，端口 <b>16801</b>，填入 Motrix 的 RPC 密钥</p>
  </template>

  <script>
    var token = "${token}";
    var fileUrl = '/api/share/download/?token=' + token;
    // 使用与 <video> 相同的 URL，SW 才会拦截并写入缓存。
    // X-Prefetch 头告知 SW 跳过 serveFromCache 查询但保留 fetchAndCache 写入。
    var prefetchUrl = fileUrl;
    var shareFileName = '';

    // 分享落地页独立打开时也可能没有 SW，主动注册以确保视频缓存生效
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.mjs', { scope: '/', updateViaCache: 'none' })
        .then(function(reg) { reg.update().catch(function() {}); })
        .catch(function() {});
      // 监听 SW 诊断消息，在页面控制台直接显示 SW 状态
      navigator.serviceWorker.addEventListener('message', function(ev) {
        if (ev.data && ev.data.source === 'SW') {
          var d = ev.data;
          if (d.type === 'cache-hit') {
            console.log('[SW→Page] ' + (d.mode==='exact'?'精确':'合并') + '命中 ' + d.range + (d.chunks?(' ('+d.chunks+'块)'):''));
          } else if (d.type === 'cache-miss') {
            console.log('[SW→Page] 未命中 ' + d.range + (d.normalized?(' → '+d.normalized):''));
          } else if (d.type === 'cache-write') {
            console.log('[SW→Page] 写入 ' + (d.key?d.key.split('|').pop():''));
          } else if (d.type === 'cache-skip') {
            console.log('[SW→Page] 跳过写入 ' + d.reason);
          }
        }
      });
    }
    
    function resolveContentType(name, contentType) {
      var ct = (contentType || '').toLowerCase();
      if (ct && ct !== 'application/octet-stream' && ct !== 'application/x-www-form-urlencoded' && !ct.startsWith('binary/')) return ct;
      var ext = (name.split('.').pop() || '').toLowerCase();
      var map = {
        mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime',
        webm: 'video/webm', ogv: 'video/ogg', ogg: 'video/ogg',
        mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac',
        aac: 'audio/aac', m4a: 'audio/mp4', oga: 'audio/ogg',
        png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
        gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp',
        svg: 'image/svg+xml', avif: 'image/avif'
      };
      return map[ext] || ct || 'application/octet-stream';
    }

    function isImage(type) { return type && /^image\\//.test(type); }
    function isVideo(type) { return type && /^video\\//.test(type); }
    function isAudio(type) { return type && /^audio\\//.test(type); }
    function isMedia(type) { return isImage(type) || isVideo(type) || isAudio(type); }

    // ===== 视频多线程预取（同源 fileUrl，兼容 Safari CORS 限制）=====
    var _pf = { active: false, running: false, ctrl: null, size: 0, endByte: 0, vid: null, _bufTimer: null, _bufHandler: null };

    function _pfByte(vid) {
      var d = vid.duration;
      if (!d || !isFinite(d) || !_pf.size) return 0;
      return Math.floor((vid.currentTime / d) * _pf.size);
    }

    async function _pfGo(from) {
      if (_pf.running) return;
      _pf.running = true;
      var CH = 2 * 1024 * 1024;

      // 单段预取：每次只下载一个 chunk，不做 while 批量循环。
      // 下一段由 _pfOnTime 在播放到当前段末尾附近时触发。
      if (from >= _pf.size || !_pf.active) { _pf.running = false; return; }

      var start = from;
      var end = Math.min(start + CH - 1, _pf.size - 1);
      _pf.endByte = end + 1;

      try {
        console.log('[Prefetch] chunk bytes ' + start + '-' + end);
        await fetch(prefetchUrl, { headers: { 'X-Prefetch': '1', Range: 'bytes=' + start + '-' + end }, signal: _pf.ctrl.signal })
          .then(function(r) { if (r.ok) return r.arrayBuffer(); throw new Error(String(r.status)); });
        console.log('[Prefetch] done: 1 chunk, ' + ((end - start + 1) / 1024 / 1024).toFixed(1) + 'MB');
      } catch(e) {
        if (e.name !== 'AbortError') console.warn('[Prefetch] chunk failed:', e.message);
      }

      _pf.running = false;
    }

    function _pfOnTime(e) {
      if (!_pf.active || _pf.running) return;
      var b = _pfByte(e.target);
      var CH = 2 * 1024 * 1024;
      if (_pf.endByte >= _pf.size) return;
      // 播放到距当前预取末尾半 chunk 以内时，触发下个 chunk
      if (b >= _pf.endByte - CH / 2) {
        console.log('[Prefetch] timeupdate trigger from byte', b);
        _pfGo(_pf.endByte);
      }
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
      _pf.vid = vid;
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

      var MEDIA_CLAMP = 10 * 1024 * 1024; // 与 SW 标准化保持一致
      var startByte = Math.min(_pf.size, MEDIA_CLAMP);
      var BUFFER_THRESHOLD = 5 * 1024 * 1024; // 缓冲到 5MB（钳位的一半）再启动
      var MAX_WAIT = 8000; // 最多等 8 秒

      // 已缓冲够 → 直接启动
      if (vid.buffered.length > 0 && vid.buffered.end(0) >= BUFFER_THRESHOLD) {
        console.log('[Prefetch] buffer already >= 5MB, start from byte', startByte);
        _pfGo(startByte);
        return;
      }

      console.log('[Prefetch] waiting for buffer >= 5MB before starting...');
      var started = false;

      _pf._bufHandler = function() {
        if (started || !_pf.active) return;
        if (vid.buffered.length > 0 && vid.buffered.end(0) >= BUFFER_THRESHOLD) {
          started = true;
          vid.removeEventListener('progress', _pf._bufHandler);
          _pf._bufHandler = null;
          if (_pf._bufTimer) { clearTimeout(_pf._bufTimer); _pf._bufTimer = null; }
          console.log('[Prefetch] buffer reached, start from byte', startByte);
          _pfGo(startByte);
        }
      };

      _pf._bufTimer = setTimeout(function() {
        if (started || !_pf.active) return;
        started = true;
        vid.removeEventListener('progress', _pf._bufHandler);
        _pf._bufHandler = null;
        console.log('[Prefetch] timeout, force start from byte', startByte);
        _pfGo(startByte);
      }, MAX_WAIT);

      vid.addEventListener('progress', _pf._bufHandler);
    }

    function _pfStop() {
      _pf.active = false; _pf.running = false;
      if (_pf.ctrl) { _pf.ctrl.abort(); _pf.ctrl = null; }
      if (_pf._bufTimer) { clearTimeout(_pf._bufTimer); _pf._bufTimer = null; }
      if (_pf._bufHandler && _pf.vid) {
        _pf.vid.removeEventListener('progress', _pf._bufHandler);
        _pf._bufHandler = null;
      }
      _pf.vid = null;
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
      try {
      var response = await fetch('/api/share/?token=' + token);
      var data = await response.json();
      
      var app = document.getElementById('app');
      
      if (data.valid) {
        shareFileName = data.fileName;
        // 兜底修正 Content-Type，兼容 R2 存成 octet-stream 的情况
        data.contentType = resolveContentType(data.fileName, data.contentType);
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
            '<div class="btn-row">' +
              '<button class="download-btn" onclick="downloadFile()">' +
                '<span class="btn-icon">⬇️</span><span>下载' + label + '</span>' +
              '</button>' +
              '<button class="copy-btn" onclick="copyLink()">' +
                '<span class="btn-icon">📋</span><span>复制链接</span>' +
              '</button>' +
            '</div>' +
            '<div class="btn-row" style="margin-top:12px">' +
              '<button class="aria2-btn" onclick="sendToAria2()">' +
                '<span class="btn-icon">🚀</span><span>发送到 Aria2</span>' +
              '</button>' +
              '<button class="aria2-btn" onclick="showAria2Settings()" style="flex:0 0 auto;min-width:48px;padding:14px 16px">' +
                '<span class="btn-icon">⚙️</span>' +
              '</button>' +
            '</div>';
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
            '<div class="btn-row">' +
              '<button class="download-btn" onclick="downloadFile()">' +
                '<span class="btn-icon">⬇️</span><span>下载文件</span>' +
              '</button>' +
              '<button class="copy-btn" onclick="copyLink()">' +
                '<span class="btn-icon">📋</span><span>复制链接</span>' +
              '</button>' +
            '</div>' +
            '<div class="btn-row" style="margin-top:12px">' +
              '<button class="aria2-btn" onclick="sendToAria2()">' +
                '<span class="btn-icon">🚀</span><span>发送到 Aria2</span>' +
              '</button>' +
              '<button class="aria2-btn" onclick="showAria2Settings()" style="flex:0 0 auto;min-width:48px;padding:14px 16px">' +
                '<span class="btn-icon">⚙️</span>' +
              '</button>' +
            '</div>';
        }
      } else {
        app.innerHTML = 
          '<div class="icon error-icon">❌</div>' +
          '<h1>分享链接无效</h1>' +
          '<div class="error-box"><p>' + data.message + '</p></div>' +
          '<button class="download-btn expired" disabled><span>链接已失效</span></button>';
      }
      } catch (e) {
        document.getElementById('app').innerHTML =
          '<div class="icon error-icon">❌</div>' +
          '<h1>网络请求失败</h1>' +
          '<div class="error-box"><p>无法连接到服务器，请检查网络后刷新页面重试</p></div>' +
          '<button class="download-btn" onclick="location.reload()"><span>重新加载</span></button>';
      }
    }
    
    function downloadFile() {
      // 优先网页内多线程下载；不支持流式落盘(Firefox/Safari)或小文件时回退原生单线程
      multiThreadDownload();
    }

    function copyLink() {
      var url = location.origin + fileUrl + '&dl=1';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function() {
          alert('下载链接已复制到粘贴板');
        }).catch(function() {
          prompt('复制失败，请手动复制:', url);
        });
      } else {
        prompt('请手动复制链接:', url);
      }
    }

    // ===== Aria2 RPC =====
    function loadAria2Settings() {
      try {
        var s = localStorage.getItem('aria2_settings');
        if (s) return JSON.parse(s);
      } catch(e) {}
      return { protocol: 'http', host: 'localhost', port: 16800, secret: '' };
    }

    function saveAria2Settings(settings) {
      try { localStorage.setItem('aria2_settings', JSON.stringify(settings)); } catch(e) {}
    }

    function aria2Toast(msg, type) {
      var el = document.getElementById('aria2Toast');
      if (el) el.remove();
      el = document.createElement('div');
      el.id = 'aria2Toast';
      el.className = 'aria2-toast' + (type ? ' ' + type : '');
      el.textContent = msg;
      document.body.appendChild(el);
      setTimeout(function() { if (el.parentNode) el.remove(); }, 3000);
    }

    function showAria2Settings() {
      var s = loadAria2Settings();
      var overlay = document.createElement('div');
      overlay.className = 'aria2-settings-overlay';
      overlay.id = 'aria2SettingsOverlay';
      overlay.innerHTML = '<div class="aria2-settings">' +
        '<h3>Aria2 RPC 设置</h3>' +
        '<div class="field"><label>协议</label><select id="aria2Proto" style="width:100%;padding:10px 14px;border:2px solid #e5e7eb;border-radius:8px;font-size:15px;outline:none;box-sizing:border-box">' +
          '<option value="http"' + (s.protocol === 'http' ? ' selected' : '') + '>HTTP</option>' +
          '<option value="https"' + (s.protocol === 'https' ? ' selected' : '') + '>HTTPS</option>' +
        '</select><div class="hint">HTTPS 页面请求 HTTP 地址会被浏览器拦截，Motrix 等默认 HTTP 需加反向代理</div></div>' +
        '<div class="field"><label>RPC 主机</label><input id="aria2Host" value="' + s.host + '" placeholder="localhost"></div>' +
        '<div class="field"><label>RPC 端口</label><input id="aria2Port" type="number" value="' + s.port + '" placeholder="16800"></div>' +
        '<div class="field"><label>RPC 密钥</label><input id="aria2Secret" type="password" value="' + s.secret + '" placeholder="（可选）"><div class="hint">留空表示无密钥</div></div>' +
        '<button class="aria2-help-toggle" onclick="toggleAria2Help(this)">📖 Motrix / HTTP Aria2 如何连接？</button>' +
        '<div class="aria2-help-content" style="display:none"></div>' +
        '<div class="btn-row" style="margin-top:8px">' +
          '<button class="copy-btn" onclick="hideAria2Settings()" style="flex:1">取消</button>' +
          '<button class="download-btn" onclick="saveAria2Config()" style="flex:1;margin-left:8px">保存</button>' +
        '</div>' +
      '</div>';
      document.body.appendChild(overlay);
      var tpl = document.getElementById('aria2Tutorial');
      var helpDiv = overlay.querySelector('.aria2-help-content');
      if (tpl && helpDiv) {
        helpDiv.appendChild(tpl.content.cloneNode(true));
      }
      overlay.addEventListener('mousedown', function(e) { if (e.target === overlay) hideAria2Settings(); });
    }

    function toggleAria2Help(btn) {
      var c = btn.nextElementSibling;
      if (c) c.style.display = c.style.display === 'none' ? 'block' : 'none';
    }

    function copyCode(btn) {
      var code = btn.parentElement.querySelector('code');
      navigator.clipboard.writeText(code.textContent || '').then(function() {
        var orig = btn.textContent;
        btn.textContent = '已复制';
        setTimeout(function() { btn.textContent = orig; }, 1500);
      });
    }

    function hideAria2Settings() {
      var el = document.getElementById('aria2SettingsOverlay');
      if (el) el.remove();
    }

    function saveAria2Config() {
      var protocol = document.getElementById('aria2Proto').value;
      var host = document.getElementById('aria2Host').value.trim() || 'localhost';
      var port = parseInt(document.getElementById('aria2Port').value, 10) || 16800;
      var secret = document.getElementById('aria2Secret').value.trim();
      saveAria2Settings({ protocol: protocol, host: host, port: port, secret: secret });
      hideAria2Settings();
      aria2Toast('Aria2 设置已保存', 'success');
    }

    async function sendToAria2() {
      var s = loadAria2Settings();
      var url = location.origin + fileUrl + '&dl=1';
      var proto = s.protocol || 'http';
      var rpcUrl = proto + '://' + s.host + ':' + s.port + '/jsonrpc';
      var params = s.secret ? ['token:' + s.secret, [url], {}] : [[url], {}];

      aria2Toast('正在发送到 Aria2...');

      try {
        var res = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 'flaredrive', method: 'aria2.addUri', params: params })
        });
        var data = await res.json();
        if (data.error) {
          aria2Toast('Aria2 错误: ' + (data.error.message || JSON.stringify(data.error)), 'error');
        } else {
          aria2Toast('已发送到 Aria2! GID: ' + data.result, 'success');
        }
      } catch(e) {
        if (location.protocol === 'https:' && proto === 'http') {
          aria2Toast('HTTPS 页面无法访问 HTTP Aria2，请在设置中切换到 HTTPS，并配置反向代理', 'error');
        } else {
          aria2Toast('无法连接 Aria2 (' + proto + '://' + s.host + ':' + s.port + ')，请检查设置', 'error');
        }
      }
    }
    // ===== Aria2 结束 =====

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
      catch (e) { window.location.href = fileUrl + '&dl=1'; return; }
      var total = parseInt(head.headers.get('Content-Length') || '0', 10);
      var contentType = head.headers.get('Content-Type') || 'application/octet-stream';
      // 小文件或不支持 File System Access：原生下载（计一次数）
      if (!total || total < 1024 * 1024 || typeof window.showSaveFilePicker !== 'function') {
        try { await fetch(fileUrl + '&dl=1', { method: 'HEAD' }); } catch (_) {}
        window.location.href = fileUrl + '&dl=1';
        return;
      }
      var writable = null;
      try {
        var handle = await window.showSaveFilePicker({ suggestedName: shareFileName });
        writable = await handle.createWritable();
      } catch (e) {
        if (e && e.name === 'AbortError') return; // 用户取消保存：不计下载数
        try { await fetch(fileUrl + '&dl=1', { method: 'HEAD' }); } catch (_) {}
        window.location.href = fileUrl + '&dl=1'; return;
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
        else { console.error('多线程下载失败', e); try { await writable.close(); } catch (_) {} window.location.href = fileUrl + '&dl=1'; }
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