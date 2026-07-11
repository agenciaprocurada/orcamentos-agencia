// Envio de Web Push (VAPID) compartilhado pelas Edge Functions.
//
// Lê o secret VAPID_KEYS e a tabela push_subscriptions, envia a notificação
// para cada dispositivo inscrito e remove as inscrições expiradas (404/410).
// Best-effort: falha aqui nunca deve derrubar o fluxo que chamou.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush@0.5.0";

export interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}

export async function sendPushToAll(
  supabase: SupabaseClient,
  payload: PushPayload,
): Promise<{ sent: number; removed: number }> {
  const result = { sent: 0, removed: 0 };

  const keysJson = Deno.env.get("VAPID_KEYS");
  if (!keysJson) {
    console.warn("VAPID_KEYS ausente — push não enviado.");
    return result;
  }

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth");
  if (error || !subs || subs.length === 0) return result;

  const vapidKeys = await webpush.importVapidKeys(JSON.parse(keysJson), {
    extractable: false,
  });
  const appServer = await webpush.ApplicationServer.new({
    contactInformation: "mailto:agenciaprocurada@gmail.com",
    vapidKeys,
  });

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    tag: payload.tag ?? "geral",
    url: payload.url ?? "/",
  });

  await Promise.all(
    subs.map(async (s) => {
      try {
        const subscriber = appServer.subscribe({
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh, auth: s.auth },
        });
        await subscriber.pushTextMessage(message, {});
        result.sent++;
      } catch (err) {
        const status = err instanceof webpush.PushMessageError
          ? err.response.status
          : 0;
        if (status === 404 || status === 410) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", s.endpoint);
          result.removed++;
        } else {
          console.error(
            `Falha ao enviar push (status ${status}):`,
            err instanceof Error ? err.toString() : String(err),
          );
        }
      }
    }),
  );

  return result;
}
