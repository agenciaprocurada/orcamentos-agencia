// TEMPORÁRIA — diagnóstico do envio de Web Push. Remover após depurar.
// Lê as inscrições, tenta enviar um push de teste e devolve o resultado
// detalhado (nº de inscrições, passos concluídos e erro exato de cada envio).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush@0.5.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const result: {
    steps: string[];
    subs: number;
    sent: number;
    errors: string[];
  } = { steps: [], subs: 0, sent: 0, errors: [] };

  try {
    const keysJson = Deno.env.get("VAPID_KEYS");
    result.steps.push("vapid_present:" + !!keysJson);
    if (!keysJson) return json(result);

    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth");
    if (error) {
      result.errors.push("select:" + error.message);
      return json(result);
    }
    result.subs = subs?.length ?? 0;

    const vapidKeys = await webpush.importVapidKeys(JSON.parse(keysJson), {
      extractable: false,
    });
    result.steps.push("imported_keys");

    const appServer = await webpush.ApplicationServer.new({
      contactInformation: "mailto:agenciaprocurada@gmail.com",
      vapidKeys,
    });
    result.steps.push("appserver_ready");

    for (const s of subs ?? []) {
      try {
        const subscriber = appServer.subscribe({
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh, auth: s.auth },
        });
        await subscriber.pushTextMessage(
          JSON.stringify({
            title: "Teste Procurada",
            body: "Se você está vendo isto, o push funciona! 🎉",
            url: "/?tab=leads",
          }),
          {},
        );
        result.sent++;
      } catch (e) {
        const status = e instanceof webpush.PushMessageError
          ? e.response.status
          : 0;
        if (status === 404 || status === 410) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", s.endpoint);
          result.errors.push(
            `send: ${status} (inscricao morta, REMOVIDA) | ${String(s.endpoint).slice(0, 50)}`,
          );
        } else {
          result.errors.push(
            `send: status=${status} ${e instanceof Error ? e.toString() : String(e)} | ${String(s.endpoint).slice(0, 50)}`,
          );
        }
      }
    }
  } catch (e) {
    result.errors.push(
      "fatal: " + (e instanceof Error ? e.stack || e.message : String(e)),
    );
  }

  return json(result);
});
