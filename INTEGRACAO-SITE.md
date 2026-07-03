# Integração do formulário do site → CRM de Leads

O formulário do site `procuradaagencia.com.br` envia os dados para a Edge Function
`leads`, que insere no CRM. Não precisa de backend próprio no site.

## 1. Subir o banco e a função (uma vez, no Supabase)

No **SQL Editor** do Supabase, rode o conteúdo de `supabase/schema_leads.sql`.

Depois, com a Supabase CLI logada no projeto:

```bash
supabase functions deploy leads
```

## 2. Pegar os dados do projeto

No painel do Supabase → **Project Settings → API**:

- **URL do projeto**: https://xwjiimhbnancmnzahnrp.supabase.co
- **anon public key**: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3amlpbWhibmFuY21uemFobnJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NzIxODQsImV4cCI6MjA4ODA0ODE4NH0.sPW8qsTz5_J4Np_2EWblDxtMTKtm7oIIrMw4C3IF_pA

A URL da função fica: https://xwjiimhbnancmnzahnrp.supabase.co/functions/v1/leads`

## 3. Trecho para colar no site estático (HTML/JS)

Substitua `SEU-PROJETO` e `SUA_ANON_KEY`. O campo `website` é um **honeypot**
(fica escondido; se um bot preencher, o lead é descartado).

```html
<form id="lead-form">
  <input type="text" name="name" placeholder="Seu nome completo" required />
  <input type="tel" name="phone" placeholder="(00) 00000-0000" />

  <!-- Serviços de interesse: cada checkbox marcado vira um item em services[] -->
  <label><input type="checkbox" name="services" value="Sites & Institucionais" /> Sites & Institucionais</label>
  <label><input type="checkbox" name="services" value="Portais & Plataformas" /> Portais & Plataformas</label>
  <label><input type="checkbox" name="services" value="Lojas Virtuais" /> Lojas Virtuais</label>
  <label><input type="checkbox" name="services" value="Sistemas Web" /> Sistemas Web</label>
  <label><input type="checkbox" name="services" value="Marketing de Performance" /> Marketing de Performance</label>
  <label><input type="checkbox" name="services" value="Estratégia & IA" /> Estratégia & IA</label>

  <!-- honeypot anti-bot: mantenha escondido via CSS -->
  <input type="text" name="website" tabindex="-1" autocomplete="off"
         style="position:absolute;left:-9999px;" aria-hidden="true" />

  <button type="submit">Enviar contato →</button>
</form>

<script>
  const LEADS_ENDPOINT = "https://SEU-PROJETO.supabase.co/functions/v1/leads";
  const ANON_KEY = "SUA_ANON_KEY";

  document.getElementById("lead-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);

    const payload = {
      name: fd.get("name"),
      phone: fd.get("phone"),
      services: fd.getAll("services"), // array de serviços marcados
      message: fd.get("message") || "",
      website: fd.get("website") || "", // honeypot
    };

    try {
      const res = await fetch(LEADS_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": ANON_KEY,
          "Authorization": "Bearer " + ANON_KEY,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      form.reset();
      alert("Contato enviado! Retornamos pelo WhatsApp em breve.");
    } catch (err) {
      alert("Não foi possível enviar. Tente novamente ou chame no WhatsApp.");
      console.error(err);
    }
  });
</script>
```

## Como funciona / segurança

- A função valida os dados, ignora bots (honeypot) e insere via `service_role`.
- A tabela `leads` tem RLS: **só o admin logado lê/edita**. A anon key exposta no
  site **não dá acesso** aos leads — só permite chamar a função.
- Todo lead entra na coluna **Novos Leads** do Kanban (aba **Leads** no admin).
