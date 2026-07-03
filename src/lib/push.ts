// Web Push no cliente: registra o service worker, gerencia a inscrição do
// dispositivo (Push API) e persiste/remove a inscrição na tabela
// `push_subscriptions` do Supabase. Só o admin logado grava lá (RLS).

import { supabase } from './supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

// Push web só funciona em contexto seguro (https) ou localhost.
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

// Registra o SW uma vez e devolve o registration pronto.
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    return reg;
  } catch (err) {
    console.error('Falha ao registrar service worker:', err);
    return null;
  }
}

// VAPID pública vem em base64url; a Push API exige Uint8Array.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export type PushState = 'unsupported' | 'denied' | 'subscribed' | 'idle';

export async function getPushState(): Promise<PushState> {
  if (!isPushSupported() || !VAPID_PUBLIC_KEY) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? 'subscribed' : 'idle';
}

// Pede permissão, cria a inscrição push e salva no Supabase.
// Devolve true se ficou inscrito.
export async function enablePush(): Promise<{ ok: boolean; reason?: string }> {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' };
  if (!VAPID_PUBLIC_KEY) return { ok: false, reason: 'missing-vapid' };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: 'denied' };

  const reg = (await registerServiceWorker());
  if (!reg) return { ok: false, reason: 'no-sw' };

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = sub.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      user_agent: navigator.userAgent.slice(0, 300),
    },
    { onConflict: 'endpoint' },
  );

  if (error) return { ok: false, reason: error.message };

  // Notificação local de confirmação: dá feedback imediato e, na prática, testa
  // se as notificações realmente aparecem neste aparelho (permissão/SO ok).
  try {
    await reg.showNotification('Avisos ativados ✅', {
      body: 'Você será avisado aqui quando entrar um novo lead.',
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      tag: 'welcome',
    });
  } catch {
    // showNotification pode falhar em alguns navegadores; não é crítico.
  }

  return { ok: true };
}

// Cancela a inscrição no navegador e remove do Supabase.
export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => {});
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
}
