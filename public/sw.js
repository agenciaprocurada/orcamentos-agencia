// Service worker do PWA da Procurada.
//
// Responsabilidades:
//  1. Instalabilidade (ativa na hora, assume controle das abas abertas).
//  2. Receber Web Push e mostrar a notificação (evento `push`).
//  3. Ao clicar na notificação, focar a aba já aberta ou abrir uma nova,
//     navegando para a aba de Leads.
//
// Sem cache de assets de propósito: o app é online-first (Supabase) e o Vite
// versiona os arquivos com hash. Um cache mal feito serviria versões velhas.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handler de fetch mínimo (passthrough). Presente só para satisfazer o
// critério de instalabilidade de alguns navegadores; não faz cache.
self.addEventListener('fetch', () => {});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Novo lead', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Novo lead';
  const options = {
    body: data.body || 'Você recebeu um novo contato pelo site.',
    icon: '/pwa-192.png',
    badge: '/pwa-192.png',
    tag: data.tag || 'lead',
    renotify: true,
    data: { url: data.url || '/?tab=leads' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/?tab=leads';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ('focus' in client) {
            client.postMessage({ type: 'navigate', tab: 'leads' });
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(target);
        }
      }),
  );
});
