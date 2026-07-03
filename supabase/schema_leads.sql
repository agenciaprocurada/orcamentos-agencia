-- Leads (CRM) — inbound de contatos vindos do formulário do site.
--
-- O formulário público NÃO escreve aqui diretamente. Ele bate na Edge Function
-- `leads` (que usa a SERVICE_ROLE key e portanto ignora o RLS). Assim a tabela
-- fica totalmente privada: só o admin logado lê e gerencia os leads. Bots com a
-- chave anon pública NÃO conseguem ler nem escrever nesta tabela.

CREATE TABLE public.leads (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    phone text,
    services text[] DEFAULT '{}',
    message text,
    source text DEFAULT 'site',
    status text CHECK (status IN ('novo', 'respondido', 'proposta', 'concluido')) DEFAULT 'novo' NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX leads_status_idx ON public.leads (status);
CREATE INDEX leads_created_at_idx ON public.leads (created_at DESC);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Só usuários autenticados (o admin logado) leem/gerenciam os leads.
-- A entrada pública é feita pela Edge Function com service_role.
CREATE POLICY "Authenticated manage leads" ON public.leads
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
