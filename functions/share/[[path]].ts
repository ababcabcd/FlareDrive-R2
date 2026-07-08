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
      flex: 1 1 auto;
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
    
    function isImage(type) { return type && /^image\\//.test(type); }
    function isVideo(type) { return type && /^video\\//.test(type); }
    function isAudio(type) { return type && /^audio\\//.test(type); }
    function isMedia(type) { return isImage(type) || isVideo(type) || isAudio(type); }
    
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
      window.location.href = fileUrl;
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