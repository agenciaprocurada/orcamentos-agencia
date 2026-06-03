// Supabase Edge Function: public contract reading + signing.
//
// Read:  GET  /contract?token=<public_token>
//        POST /contract  { action: "read", token }
//        -> returns the contract for display
// Sign:  POST /contract  { token, signer_values, signature_data }
//        -> validates, resolves the final body, captures the real client IP
//           (server-side) and stores the signature.
//
// Business-rule problems (not found, expired, already signed, missing field)
// are returned as HTTP 200 with an { error } field so the client can read them
// uniformly via supabase.functions.invoke. Only true server faults return 500.
//
// Deploy:  supabase functions deploy contract
// (uses the SERVICE_ROLE key available in the function environment, so it
//  bypasses RLS — the contracts table stays private to authenticated admins.)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Replace {{KEY}} placeholders with provided values.
function resolveVars(html: string, vars: Record<string, string>): string {
  if (!html) return html;
  return Object.entries(vars).reduce(
    (text, [key, val]) => text.split(`{{${key}}}`).join(val ?? ""),
    html,
  );
}

// Maps contract variable keys to columns on the clients table.
const CLIENT_FIELD_MAP: Record<string, string> = {
  NOME_CLIENTE: "name",
  EMPRESA_CLIENTE: "company_name",
  EMAIL_CLIENTE: "email",
  CNPJ_CLIENTE: "cnpj",
  TELEFONE_CLIENTE: "phone",
  CIDADE_CLIENTE: "city",
  ESTADO_CLIENTE: "state",
};

// Build a clients-table update object from the signer values map.
function buildClientUpdate(sv: Record<string, string>): Record<string, string> {
  const upd: Record<string, string> = {};
  for (const [varKey, col] of Object.entries(CLIENT_FIELD_MAP)) {
    const v = String(sv[varKey] ?? "").trim();
    if (v) upd[col] = v;
  }
  return upd;
}

async function updateLinkedClient(proposalId: string | null, sv: Record<string, string>) {
  if (!proposalId) return;
  const { data: prop } = await supabase
    .from("proposals")
    .select("client_id")
    .eq("id", proposalId)
    .maybeSingle();
  if (!prop?.client_id) return;
  const upd = buildClientUpdate(sv);
  if (Object.keys(upd).length > 0) {
    await supabase.from("clients").update(upd).eq("id", prop.client_id);
  }
}

function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function readContract(token: string | null | undefined) {
  if (!token) return json({ error: "Token ausente." });

  const { data, error } = await supabase
    .from("contracts")
    .select(
      "id, proposal_id, title, body, merge_vars, signer_fields, brand, signer_name, signer_email, signer_values, status, signature_data, signed_body, signed_at, signer_ip, valid_until",
    )
    .eq("public_token", token)
    .maybeSingle();

  if (error) return json({ error: error.message }, 500);
  if (!data) return json({ error: "Contrato não encontrado." });

  // Current CRM client data so the page can pre-fill and request missing fields.
  let client: Record<string, unknown> | null = null;
  if (data.proposal_id) {
    const { data: prop } = await supabase
      .from("proposals")
      .select("client_id")
      .eq("id", data.proposal_id)
      .maybeSingle();
    if (prop?.client_id) {
      const { data: cl } = await supabase
        .from("clients")
        .select("name, email, company_name, cnpj, phone, whatsapp, city, state")
        .eq("id", prop.client_id)
        .maybeSingle();
      client = cl;
    }
  }

  const expired = data.valid_until
    ? new Date(data.valid_until + "T23:59:59Z") < new Date()
    : false;

  return json({ contract: data, client, expired });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ---- READ via GET (?token=) ----
    if (req.method === "GET") {
      const url = new URL(req.url);
      return await readContract(url.searchParams.get("token"));
    }

    // ---- POST: read (action="read") or sign ----
    if (req.method === "POST") {
      const payload = await req.json().catch(() => null);
      const token = payload?.token as string | undefined;

      if (payload?.action === "read") {
        return await readContract(token);
      }

      // ---- SAVE PROGRESS: persist the client's data before signing ----
      if (payload?.action === "save-progress") {
        if (!token) return json({ error: "Token ausente." });
        const sv = (payload?.signer_values ?? {}) as Record<string, string>;
        const name = (payload?.signer_name as string | undefined)?.trim();
        const email = (payload?.signer_email as string | undefined)?.trim();

        const { data: c, error: cErr } = await supabase
          .from("contracts")
          .select("id, proposal_id, status")
          .eq("public_token", token)
          .maybeSingle();
        if (cErr) return json({ error: cErr.message }, 500);
        if (!c) return json({ error: "Contrato não encontrado." });
        if (c.status === "signed") {
          return json({ error: "Este contrato já foi assinado." });
        }

        // Update the contract with the data filled so far.
        const contractUpd: Record<string, unknown> = { signer_values: sv };
        if (name) contractUpd.signer_name = name;
        if (email) contractUpd.signer_email = email;
        await supabase.from("contracts").update(contractUpd).eq("id", c.id);

        // Update the linked CRM client immediately (full field map).
        await updateLinkedClient(c.proposal_id, sv);

        return json({ success: true });
      }

      const signerValues = (payload?.signer_values ?? {}) as Record<
        string,
        string
      >;
      const signatureData = payload?.signature_data as string | undefined;
      const signerName = payload?.signer_name as string | undefined;
      const signerEmail = payload?.signer_email as string | undefined;

      if (!token) return json({ error: "Token ausente." });
      if (!signatureData || !signatureData.startsWith("data:image")) {
        return json({ error: "Assinatura inválida." });
      }

      const { data: contract, error: readErr } = await supabase
        .from("contracts")
        .select("*")
        .eq("public_token", token)
        .maybeSingle();

      if (readErr) return json({ error: readErr.message }, 500);
      if (!contract) return json({ error: "Contrato não encontrado." });
      if (contract.status === "signed") {
        return json({ error: "Este contrato já foi assinado." });
      }
      if (contract.status === "cancelled") {
        return json({ error: "Este contrato foi cancelado." });
      }
      if (
        contract.valid_until &&
        new Date(contract.valid_until + "T23:59:59Z") < new Date()
      ) {
        return json({ error: "O link de assinatura expirou." });
      }

      // Validate required signer fields
      const fields = (contract.signer_fields ?? []) as Array<
        { key: string; label: string; required?: boolean }
      >;
      for (const f of fields) {
        if (f.required && !String(signerValues[f.key] ?? "").trim()) {
          return json({ error: `Campo obrigatório: ${f.label}` });
        }
      }

      // Build the frozen, resolved document body
      const mergeVars = (contract.merge_vars ?? {}) as Record<string, string>;
      const allVars: Record<string, string> = { ...mergeVars };
      for (const [k, v] of Object.entries(signerValues)) {
        allVars[k] = String(v ?? "");
      }
      const signedBody = resolveVars(contract.body ?? "", allVars);

      const signedAt = new Date().toISOString();
      const ip = getClientIp(req);
      const userAgent = req.headers.get("user-agent") || "";

      const { error: updErr } = await supabase
        .from("contracts")
        .update({
          status: "signed",
          signer_values: signerValues,
          signer_name: (signerName && signerName.trim()) || contract.signer_name,
          signer_email: (signerEmail && signerEmail.trim()) || contract.signer_email,
          signature_data: signatureData,
          signed_body: signedBody,
          signed_at: signedAt,
          signer_ip: ip,
          signer_user_agent: userAgent,
        })
        .eq("id", contract.id);

      if (updErr) return json({ error: updErr.message }, 500);

      // Keep the CRM client in sync with the final signed data.
      await updateLinkedClient(contract.proposal_id, signerValues);

      return json({ success: true, signed_at: signedAt, signer_ip: ip });
    }

    return json({ error: "Método não suportado." }, 405);
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : "Erro inesperado." },
      500,
    );
  }
});
