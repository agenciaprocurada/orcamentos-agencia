# PWA + Notificações Push (aviso de novos leads)

O app virou um PWA instalável e, quando um **lead novo** entra pelo formulário do
site, a agência recebe uma **notificação push** no celular/desktop.

Como funciona: formulário do site → Edge Function `leads` → insere o lead →
dispara Web Push (VAPID) para todos os dispositivos que ativaram os avisos.

---

## Passo a passo para colocar no ar (uma vez)

### 1. Subir a tabela de inscrições

No **SQL Editor** do Supabase, rode o conteúdo de `supabase/schema_push.sql`.

### 2. Chaves VAPID (já configuradas)

- Chave **pública**: no `.env` (`VITE_VAPID_PUBLIC_KEY`) e no `Dockerfile` — vai no app.
- Chave **privada**: já foi gravada como secret `VAPID_KEYS` no Supabase.

> **Nunca** coloque a chave privada em arquivo versionado (repo/Git). Ela vive só
> no secret do Supabase. Para conferir: `supabase secrets list`.
>
> Se algum dia precisar **gerar um novo par** (as duas chaves são um par e trocam
> juntas): rode um gerador VAPID, ponha a pública no `.env`/`Dockerfile` e a
> privada no secret com
> `supabase secrets set VAPID_KEYS='<json com publicKey e privateKey>'`
> (cole o JSON na hora, sem salvar em arquivo do repo).

### 3. Fazer deploy da função `leads`

```bash
supabase functions deploy leads
```

### 4. Publicar o app (front)

`npm run build` e suba a pasta `dist/` para onde o app é hospedado.

> **Precisa ser HTTPS.** Push web só funciona em site seguro (https) ou em
> `localhost`. Sem https em produção, o botão de ativar não aparece/funciona.

---

## Como ativar os avisos (cada aparelho, uma vez)

1. Abra o app, vá na aba **Leads**.
2. Clique em **"Ativar avisos de leads"** e permita as notificações.
3. O botão fica verde ("Avisos ativos"). Pronto — aquele aparelho recebe push.

Repita em cada dispositivo/navegador que deve receber (celular, notebook...).
A inscrição é **por aparelho**.

### iPhone / iPad (importante)

No iOS, push web **só funciona com o app instalado na tela inicial**:
Safari → Compartilhar → **Adicionar à Tela de Início**. Abra pelo ícone
instalado e então ative os avisos. (Requer iOS 16.4 ou superior.) No Android e
no desktop funciona direto pelo navegador.

---

## Testar

1. Ative os avisos em um aparelho (passo acima).
2. Envie um lead pelo formulário do site (ou pela função direto):

```bash
curl -X POST "https://xwjiimhbnancmnzahnrp.supabase.co/functions/v1/leads" \
  -H "Content-Type: application/json" \
  -H "apikey: SUA_ANON_KEY" \
  -H "Authorization: Bearer SUA_ANON_KEY" \
  -d '{"name":"Teste Push","phone":"11999999999","services":["Sites & Institucionais"]}'
```

3. A notificação "Novo lead: Teste Push" deve aparecer. Ao clicar, abre o app na
   aba Leads.

Se não chegar, veja os logs: `supabase functions logs leads` (procure por
"VAPID_KEYS ausente" ou "Falha ao enviar push").
