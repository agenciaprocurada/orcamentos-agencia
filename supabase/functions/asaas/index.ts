// Supabase Edge Function: integração Asaas (boletos das parcelas).
//
// POST /asaas  { action: "generate", proposal_id }
//   -> garante o cliente no Asaas (cria/reusa asaas_customer_id),
//      cria 1 boleto (billingType BOLETO) por parcela pendente da proposta
//      que ainda não tem asaas_payment_id, e grava id + link do boleto na
//      linha de cash_flow.
// POST /asaas  { action: "status" }
//   -> { hasKey, environment, enabled } para a tela de Configurações.
// POST /asaas  { action: "test" }
//   -> testa a chave batendo em /customers no Asaas. { ok } ou { error }.
//
// O ambiente (sandbox/produção) vem da tabela integration_settings.
// A API key vive SÓ como secret da função (nunca no banco/navegador):
//   ASAAS_API_KEY      -> chave da API do Asaas
//   ASAAS_BASE_URL     -> opcional. Sobrepõe a URL derivada do ambiente.
//
// Regras de negócio voltam como HTTP 200 { error } para o front ler uniforme.
// Deploy: supabase functions deploy asaas

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const BASE_URLS: Record<string, string> = {
  sandbox: "https://api-sandbox.asaas.com/v3",
  production: "https://api.asaas.com/v3",
};

const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY") || "";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Lê ambiente/ligado da tabela de configuração (linha única).
async function loadSettings(): Promise<{ environment: string; enabled: boolean }> {
  const { data } = await supabase
    .from("integration_settings")
    .select("asaas_environment, asaas_enabled")
    .limit(1)
    .maybeSingle();
  return {
    environment: data?.asaas_environment === "production" ? "production" : "sandbox",
    enabled: data?.asaas_enabled ?? false,
  };
}

function baseUrlFor(environment: string): string {
  return Deno.env.get("ASAAS_BASE_URL") || BASE_URLS[environment] || BASE_URLS.sandbox;
}

// Chamada genérica à API do Asaas. Lança em erro HTTP com a mensagem do Asaas.
async function asaas(baseUrl: string, path: string, method: string, body?: unknown) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      access_token: ASAAS_API_KEY,
      "User-Agent": "proc-orcamentos",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.errors?.[0]?.description ||
      data?.message ||
      `Asaas HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

const onlyDigits = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

// Data de hoje (YYYY-MM-DD) no fuso de São Paulo — evita erro de vencimento
// por diferença de UTC perto da meia-noite. en-CA formata como YYYY-MM-DD.
function todaySaoPaulo(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

// Garante um customer no Asaas para o cliente. Reusa asaas_customer_id se já
// existir; senão cria e persiste. cpfCnpj: usa CNPJ se houver, senão CPF.
async function ensureCustomer(baseUrl: string, client: {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  cpf: string | null;
  cnpj: string | null;
  asaas_customer_id: string | null;
}): Promise<{ customerId: string } | { error: string }> {
  if (client.asaas_customer_id) return { customerId: client.asaas_customer_id };

  // Escolhe pelo tamanho: CNPJ tem 14 dígitos, CPF tem 11. Evita mandar um
  // documento com quantidade errada de dígitos quando o outro campo é válido.
  const cnpj = onlyDigits(client.cnpj);
  const cpf = onlyDigits(client.cpf);
  const cpfCnpj = cnpj.length === 14 ? cnpj : cpf.length === 11 ? cpf : (cnpj || cpf);
  if (!cpfCnpj) {
    return { error: "Cliente sem CPF/CNPJ. Preencha antes de gerar o boleto." };
  }

  const created = await asaas(baseUrl, "/customers", "POST", {
    name: client.name,
    cpfCnpj,
    email: client.email || undefined,
    mobilePhone: onlyDigits(client.phone || client.whatsapp) || undefined,
    externalReference: client.id,
  });

  await supabase
    .from("clients")
    .update({ asaas_customer_id: created.id })
    .eq("id", client.id);

  return { customerId: created.id };
}

async function handleGenerate(proposalId: string, baseUrl: string) {
  // Proposta -> cliente
  const { data: proposal, error: pErr } = await supabase
    .from("proposals")
    .select("id, client_id")
    .eq("id", proposalId)
    .maybeSingle();
  if (pErr) return json({ error: pErr.message }, 500);
  if (!proposal?.client_id) return json({ error: "Proposta ou cliente não encontrado." });

  const { data: client, error: cErr } = await supabase
    .from("clients")
    .select("id, name, email, phone, whatsapp, cpf, cnpj, asaas_customer_id")
    .eq("id", proposal.client_id)
    .maybeSingle();
  if (cErr) return json({ error: cErr.message }, 500);
  if (!client) return json({ error: "Cliente não encontrado." });

  // Parcelas pendentes desta proposta que ainda não têm boleto
  const { data: rows, error: rErr } = await supabase
    .from("cash_flow")
    .select("id, value, date, description")
    .eq("proposal_id", proposalId)
    .is("asaas_payment_id", null)
    .eq("type", "Income")
    // Só parcelas marcadas como boleto (ou legadas sem método definido).
    .or("payment_method.eq.Boleto,payment_method.is.null")
    .order("date", { ascending: true });
  if (rErr) return json({ error: rErr.message }, 500);
  if (!rows || rows.length === 0) return json({ error: "Nenhuma parcela pendente sem boleto." });

  let customer: { customerId: string } | { error: string };
  try {
    customer = await ensureCustomer(baseUrl, client);
  } catch (err) {
    // Erro do Asaas ao criar cliente (ex.: CPF/CNPJ inválido) -> 200 com mensagem.
    return json({ error: err instanceof Error ? err.message : "Erro ao criar cliente no Asaas." });
  }
  if ("error" in customer) return json({ error: customer.error });

  const today = todaySaoPaulo();
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];
  for (const row of rows) {
    try {
      // Boleto não aceita vencimento no passado: se a parcela já venceu, o
      // boleto sai com vencimento hoje (a data no fluxo de caixa não muda).
      const dueDate = row.date < today ? today : row.date;
      const payment = await asaas(baseUrl, "/payments", "POST", {
        customer: customer.customerId,
        billingType: "BOLETO",
        value: Number(row.value),
        dueDate, // YYYY-MM-DD
        description: row.description || undefined,
        externalReference: row.id,
      });

      await supabase
        .from("cash_flow")
        .update({
          asaas_payment_id: payment.id,
          boleto_url: payment.bankSlipUrl || payment.invoiceUrl || null,
          boleto_status: payment.status || "PENDING",
        })
        .eq("id", row.id);

      results.push({ id: row.id, ok: true });
    } catch (err) {
      results.push({
        id: row.id,
        ok: false,
        error: err instanceof Error ? err.message : "Erro ao gerar boleto.",
      });
    }
  }

  const created = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  return json({ success: failed.length === 0, created, failed: failed.length, results });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não suportado." }, 405);

  try {
    const payload = await req.json().catch(() => null);
    const action = payload?.action as string | undefined;
    const settings = await loadSettings();
    const baseUrl = baseUrlFor(settings.environment);

    // Status: não requer chave; alimenta a tela de Configurações.
    if (action === "status") {
      return json({
        hasKey: !!ASAAS_API_KEY,
        environment: settings.environment,
        enabled: settings.enabled,
      });
    }

    if (!ASAAS_API_KEY) {
      return json({ error: "Chave da API do Asaas não configurada (secret ASAAS_API_KEY)." });
    }

    // Teste de conexão: bate no Asaas com a chave atual.
    if (action === "test") {
      try {
        await asaas(baseUrl, "/customers?limit=1", "GET");
        return json({ ok: true, environment: settings.environment });
      } catch (err) {
        return json({ error: err instanceof Error ? err.message : "Falha ao conectar." });
      }
    }

    // Cancela (exclui) um boleto no Asaas. Só funciona em cobrança NÃO recebida.
    if (action === "cancel") {
      const paymentId = payload?.payment_id as string | undefined;
      if (!paymentId) return json({ error: "payment_id ausente." });
      try {
        await asaas(baseUrl, `/payments/${paymentId}`, "DELETE");
        return json({ ok: true });
      } catch (err) {
        return json({ error: err instanceof Error ? err.message : "Erro ao cancelar boleto." });
      }
    }

    if (action === "generate") {
      if (!settings.enabled) return json({ error: "Integração Asaas está desativada nas Configurações." });
      const proposalId = payload?.proposal_id as string | undefined;
      if (!proposalId) return json({ error: "proposal_id ausente." });
      return await handleGenerate(proposalId, baseUrl);
    }

    return json({ error: "Ação inválida." });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Erro inesperado." }, 500);
  }
});
