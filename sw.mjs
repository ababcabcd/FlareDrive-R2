/**
 * Service Worker - 仅保留 install/activate/ping，不做请求拦截。
 *
 * 原因：Safari 只要注册了 fetch 监听器，就会把所有页面请求
 * （包括 <video> 的 Range 请求）路由到 SW 线程，即使 handler 中
 * 不调用 respondWith()，Safari 也不会自动 fallback 到网络，
 * 导致视频播放器无限转圈。
 *
 * 当前架构中，预取由主线程 App.vue 的 fetch() 直接完成，
 * 不需要 SW 做中转。
 */

self.addEventListener('install', (event) => {
  console.log('[SW] install');
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  console.log('[SW] activate');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data === 'ping') {
    event.ports[0]?.postMessage('pong');
  }
});
