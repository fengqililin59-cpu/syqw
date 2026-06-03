/**
 * Service Worker — 浏览器推送通知处理
 *
 * 监听 push 事件，显示浏览器原生通知。
 * 点击通知时根据 data.url 跳转到对应页面。
 */

// 安装事件：立即激活
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// 激活事件：接管所有页面
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Push 事件：接收服务端推送并显示通知
self.addEventListener('push', (event) => {
  if (!event.data) {
    console.log('[SW] Push received but no data');
    return;
  }

  try {
    const payload = event.data.json();
    const { title, body, icon, badge, data, tag, timestamp } = payload;

    const options = {
      body: body || '',
      icon: icon || '/logo192.png',
      badge: badge || '/logo192.png',
      data: data || {},
      tag: tag || 'default',
      timestamp: timestamp || Date.now(),
      vibrate: [200, 100, 200],
      requireInteraction: false,
      actions: data?.url ? [
        { action: 'open', title: '查看详情' },
        { action: 'close', title: '关闭' },
      ] : [],
    };

    event.waitUntil(
      self.registration.showNotification(title || '新通知', options)
    );
  } catch (e) {
    console.error('[SW] Failed to show notification:', e);
  }
});

// 通知点击事件
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const { data } = event.notification;
  const urlToOpen = data?.url || '/app/notifications';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 如果已有打开的窗口，聚焦并导航
      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      // 否则打开新窗口
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
