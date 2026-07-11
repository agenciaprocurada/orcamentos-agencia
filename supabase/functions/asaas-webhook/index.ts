// Supabase Edge Function: webhook do Asaas (baixa automática das parcelas).
//
// O Asaas envia POST a cada evento de cobrança. Quando o boleto é pago
// (PAYMENT_RECEIVED / PAYMENT_CONFIRMED), a parcela correspondente em
// cash_flow vira status 'Paid'. Outros eventos só atualizam boleto_status.
//
// Segurança: configure no painel do Asaas um "Token de autenticação" para o
// webhook; o Asaas o envia no header `asaas-access-token`. Guardamos o mesmo
// valor no secret ASAAS_WEBHOOK_TOKEN e comparamos. Sem token, rejeita.
//
// Secret necessário:  ASAAS_WEBHOOK_TOKEN
// Deploy:  supabase functions deploy asaas-webhook --no-verify-jwt
//   (--no-verify-jwt porque o Asaas não manda JWT do Supabase; a autenticação
//    é feita pelo token acima.)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendPushToAll } from "../_shared/push.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const WEBHOOK_TOKEN = Deno.env.get("ASAAS_WEBHOOK_TOKEN") || "";

// Eventos que indicam pagamento efetivado.
const PAID_EVENTS = new Set(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"]);

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Autenticação por token compartilhado.
  const token = req.headers.get("asaas-access-token") || "";
  if (!WEBHOOK_TOKEN || token !== WEBHOOK_TOKEN) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const event = body?.event as string | undefined;
  const payment = body?.payment;
  const paymentId = payment?.id as string | undefined;
  const externalRef = payment?.externalReference as string | undefined;
  const paymentStatus = payment?.status as string | undefined;

  if (!event || !paymentId) {
    // Nada a fazer, mas responde 200 para o Asaas não reenfileirar.
    return new Response(JSON.stringify({ ignored: true }), { status: 200 });
  }

  // Localiza a parcela pelo id do pagamento; fallback: externalReference (id da linha).
  const update: Record<string, unknown> = { boleto_status: paymentStatus || event };
  if (PAID_EVENTS.has(event)) update.status = "Paid";

  let query = supabase.from("cash_flow").update(update);
  query = externalRef
    ? query.eq("id", externalRef)
    : query.eq("asaas_payment_id", paymentId);

  // .select() devolve a(s) parcela(s) afetada(s) para compor o aviso de push.
  const { data: rows, error } = await query.select("value, description");
  if (error) {
    // 500 faz o Asaas reenviar depois — desejável em falha transitória.
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  // Push de "boleto pago" — só quando o pagamento foi de fato efetivado e uma
  // parcela foi atualizada. Best-effort: nunca falha a resposta ao Asaas.
  if (PAID_EVENTS.has(event) && rows && rows.length > 0) {
    try {
      const row = rows[0] as { value: number | null; description: string | null };
      const valor = Number(payment?.value ?? row.value ?? 0).toLocaleString(
        "pt-BR",
        { style: "currency", currency: "BRL" },
      );
      const desc = (row.description || "").trim();
      await sendPushToAll(supabase, {
        title: `Boleto pago: ${valor}`,
        body: desc ? `Recebido — ${desc}` : "Pagamento recebido no Financeiro.",
        tag: `boleto-${paymentId}`,
        url: "/?tab=cashflow",
      });
    } catch (err) {
      console.error("push boleto pago falhou:", err);
    }
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});
