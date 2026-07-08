// Service worker do PWA da Procurada.
//
// Responsabilidades:
//  1. Instalabilidade: manifest + este SW com um handler de `fetch` real
//     (responde à navegação) fazem o Chrome oferecer a instalação.
//  2. Receber Web Push e mostrar a notificação (evento `push`).
//  3. Ao clicar na notificação, focar a aba aberta ou abrir uma nova na aba Leads.
//
// Cache: apenas o "shell" ('/') para funcionar como app instalável. Os assets
// com hash (JS/CSS) e os dados (Supabase) NÃO são cacheados — vêm sempre da
// rede, então nunca serve versão velha.

const SHELL = 'procurada-shell-v3';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.add('/'))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

// Só intercepta navegação: rede primeiro (e atualiza a cópia offline a cada
// sucesso — o shell nunca fica velho), cai no cache só se estiver offline.
// Demais requisições (assets, API) passam direto sem cache.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put('/', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/')),
    );
  }
});

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
