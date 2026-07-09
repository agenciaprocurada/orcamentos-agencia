// Supabase Edge Function: recepção pública de leads do formulário do site.
//
// POST /leads  { name, phone, services, message, website? }
//   -> valida, ignora bots (honeypot "website"), insere na tabela `leads` e
//      dispara um Web Push para os dispositivos inscritos (aviso de novo lead).
//
// Usa a SERVICE_ROLE key (disponível no ambiente da função), então ignora o RLS
// e a tabela `leads` continua privada para o admin. O site estático faz um
// fetch POST enviando a chave anon (pública) nos headers — mesmo padrão da
// função `contract`. A anon key não dá acesso à tabela; só permite invocar a
// função, que valida e insere via service_role.
//
// Push: precisa do secret VAPID_KEYS (JSON { publicKey, privateKey } gerado
// junto com a VITE_VAPID_PUBLIC_KEY do front). Sem ele, o lead entra normal e o
// push é apenas ignorado.
//
// Deploy:  supabase functions deploy leads
//   Secret: supabase secrets set VAPID_KEYS='{"publicKey":...,"privateKey":...}'

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush@0.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Envia um Web Push para cada inscrição salva. Best-effort: qualquer falha aqui
// é engolida (o lead já foi inserido). Endpoints expirados (404/410) são
// removidos da tabela para não acumular lixo.
async function notifyNewLead(lead: {
  name: string;
  phone: string | null;
  services: string[];
}) {
  const keysJson = Deno.env.get("VAPID_KEYS");
  if (!keysJson) {
    console.warn("VAPID_KEYS ausente — push não enviado.");
    return;
  }

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth");

  if (error || !subs || subs.length === 0) return;

  const vapidKeys = await webpush.importVapidKeys(JSON.parse(keysJson), {
    extractable: false,
  });
  const appServer = await webpush.ApplicationServer.new({
    contactInformation: "mailto:agenciaprocurada@gmail.com",
    vapidKeys,
  });

  const parts = [lead.services.join(", "), lead.phone].filter(Boolean);
  const message = JSON.stringify({
    title: `Novo lead: ${lead.name}`,
    body: parts.length ? parts.join(" • ") : "Novo contato pelo site.",
    tag: "lead",
    url: "/?tab=leads",
  });

  await Promise.all(
    subs.map(async (s) => {
      try {
        const subscriber = appServer.subscribe({
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh, auth: s.auth },
        });
        await subscriber.pushTextMessage(message, {});
      } catch (err) {
        // PushMessageError não preenche .message — o status vem em .response.
        const status = err instanceof webpush.PushMessageError
          ? err.response.status
          : 0;
        if (status === 404 || status === 410) {
          // Inscrição expirada/revogada: remove para não acumular lixo.
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", s.endpoint);
        } else {
          console.error(
            `Falha ao enviar push (status ${status}):`,
            err instanceof Error ? err.toString() : String(err),
          );
        }
      }
    }),
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Método não suportado." }, 405);
  }

  try {
    const payload = await req.json().catch(() => null);
    if (!payload) return json({ error: "Payload inválido." });

    // Honeypot: campo invisível preenchido = bot. Responde sucesso e descarta.
    if (String(payload.website ?? "").trim()) {
      return json({ success: true });
    }

    const name = String(payload.name ?? "").trim();
    if (!name) return json({ error: "Nome é obrigatório." });

    const phone = String(payload.phone ?? "").trim() || null;
    const message = String(payload.message ?? "").trim() || null;

    // services pode vir como array ou string única; normaliza para text[].
    let services: string[] = [];
    if (Array.isArray(payload.services)) {
      services = payload.services;
    } else if (payload.services) {
      services = [payload.services];
    }
    services = services
      .map((s: unknown) => String(s).trim())
      .filter(Boolean)
      .slice(0, 20);

    const { error } = await supabase.from("leads").insert({
      name: name.slice(0, 200),
      phone: phone?.slice(0, 40) ?? null,
      services,
      message: message?.slice(0, 2000) ?? null,
      source: "site",
      status: "novo",
    });

    if (error) return json({ error: error.message }, 500);

    // Push de aviso — não bloqueia nem falha a resposta ao site.
    try {
      await notifyNewLead({ name: name.slice(0, 200), phone, services });
    } catch (err) {
      console.error("notifyNewLead falhou:", err);
    }

    return json({ success: true });
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : "Erro inesperado." },
      500,
    );
  }
});
