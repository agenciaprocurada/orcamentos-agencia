-- Categorias do fluxo de caixa (versionamento tardio).
-- A tabela já existe em produção (foi criada direto no SQL Editor sem arquivo
-- versionado). Este arquivo registra o schema e é idempotente: rodar de novo é no-op.

CREATE TABLE IF NOT EXISTS public.cash_flow_categories (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    type text CHECK (type IN ('Income', 'Expense')) NOT NULL,
    color text DEFAULT '#6B7280' NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.cash_flow_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for anon users" ON public.cash_flow_categories;
CREATE POLICY "Enable all for anon users" ON public.cash_flow_categories FOR ALL USING (true);

-- Legado: schema.sql criou cash_flow.category com CHECK fixo em 4 valores
-- (Ads_Recurring, Project_Spot, Tool_Cost, Tax), mas a produção usa categorias
-- dinâmicas desta tabela. Remove o CHECK defensivamente (no-op se já removido).
ALTER TABLE public.cash_flow DROP CONSTRAINT IF EXISTS cash_flow_category_check;
