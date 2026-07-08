-- Módulo Financeiro: contas bancárias, transferências, despesas recorrentes
-- e fornecedores. Rode este arquivo no SQL Editor do Supabase.
--
-- IMPORTANTE: tudo aqui é ADITIVO. Nada do fluxo Asaas em produção é alterado:
-- as colunas novas em cash_flow são anuláveis e o único objeto que toca o
-- caminho dos boletos é um trigger que apenas preenche account_id quando nulo.
-- As Edge Functions asaas/asaas-webhook NÃO precisam de mudança nem redeploy.
--
-- Rode ANTES o schema_cash_flow_categories.sql (versiona a tabela de categorias).

-- =====================================================================
-- 1. Contas bancárias
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.bank_accounts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    bank_name text,
    -- 'asaas' marca a conta especial onde os boletos caem automaticamente.
    -- NULL nas contas comuns.
    system_key text UNIQUE,
    initial_balance numeric(12,2) DEFAULT 0 NOT NULL,
    color text DEFAULT '#3B82F6' NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    -- Contas não podem ser excluídas se tiverem lançamentos; arquive (active=false).
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =====================================================================
-- 2. Fornecedores
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.suppliers (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    document text, -- CNPJ ou CPF
    email text,
    phone text,
    notes text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =====================================================================
-- 3. Recorrências (receitas e despesas fixas mensais)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.recurring_expenses (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    description text NOT NULL,
    value numeric(12,2) NOT NULL,
    category text NOT NULL,
    type text CHECK (type IN ('Income', 'Expense')) DEFAULT 'Expense' NOT NULL,
    account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
    supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
    due_day int CHECK (due_day BETWEEN 1 AND 31) NOT NULL,
    active boolean DEFAULT true NOT NULL,
    start_date date DEFAULT CURRENT_DATE NOT NULL,
    end_date date,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Instalações que rodaram a versão anterior deste arquivo (sem type):
ALTER TABLE public.recurring_expenses
    ADD COLUMN IF NOT EXISTS type text CHECK (type IN ('Income', 'Expense')) DEFAULT 'Expense' NOT NULL;

-- =====================================================================
-- 4. Transferências entre contas
--    Fora do cash_flow de propósito: não são receita nem despesa e assim
--    ficam automaticamente fora do DRE. FKs sem ON DELETE: conta com
--    transferência não pode ser apagada (arquive-a).
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.account_transfers (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    from_account_id uuid REFERENCES public.bank_accounts(id) NOT NULL,
    to_account_id uuid REFERENCES public.bank_accounts(id) NOT NULL,
    value numeric(12,2) NOT NULL CHECK (value > 0),
    date date NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CHECK (from_account_id <> to_account_id)
);

-- =====================================================================
-- 5. Colunas novas em cash_flow (todas anuláveis => aditivo, Asaas intacto)
--    account_id sem ON DELETE: apagar conta usada em lançamento falha.
-- =====================================================================
ALTER TABLE public.cash_flow
    ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.bank_accounts(id),
    ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS recurring_expense_id uuid REFERENCES public.recurring_expenses(id) ON DELETE SET NULL,
    -- 'YYYY-MM' do mês de competência quando o lançamento foi gerado por recorrência.
    ADD COLUMN IF NOT EXISTS competence text;

CREATE INDEX IF NOT EXISTS idx_cash_flow_account_id ON public.cash_flow (account_id);

-- Garante 1 lançamento por recorrência por mês (idempotência da geração).
CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_flow_recurring_once
    ON public.cash_flow (recurring_expense_id, competence)
    WHERE recurring_expense_id IS NOT NULL;

-- =====================================================================
-- 6. RLS (padrão schema_leads.sql: só o admin logado gerencia)
-- =====================================================================
ALTER TABLE public.bank_accounts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_transfers  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated manage bank_accounts" ON public.bank_accounts;
CREATE POLICY "Authenticated manage bank_accounts" ON public.bank_accounts
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated manage suppliers" ON public.suppliers;
CREATE POLICY "Authenticated manage suppliers" ON public.suppliers
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated manage recurring_expenses" ON public.recurring_expenses;
CREATE POLICY "Authenticated manage recurring_expenses" ON public.recurring_expenses
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated manage account_transfers" ON public.account_transfers;
CREATE POLICY "Authenticated manage account_transfers" ON public.account_transfers
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =====================================================================
-- 7. Trigger: tudo que tem boleto Asaas cai na conta 'Asaas' automaticamente.
--    Cobre o insert do ApprovalModal, o update do action=generate e o update
--    do webhook — por isso NENHUMA Edge Function precisa mudar.
--    SECURITY DEFINER: o preenchimento não depende da RLS de quem gravou.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.fn_cash_flow_asaas_account()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NEW.asaas_payment_id IS NOT NULL AND NEW.account_id IS NULL THEN
        SELECT id INTO NEW.account_id FROM public.bank_accounts
        WHERE system_key = 'asaas' LIMIT 1;
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cash_flow_asaas_account ON public.cash_flow;
CREATE TRIGGER trg_cash_flow_asaas_account
    BEFORE INSERT OR UPDATE ON public.cash_flow
    FOR EACH ROW EXECUTE FUNCTION public.fn_cash_flow_asaas_account();

-- =====================================================================
-- 8. Geração idempotente das recorrências (receitas e despesas) de um mês.
--    Default: mês atual. Chamada na carga do app e pelo botão "Gerar
--    lançamentos do mês". Rodar 2x no mesmo mês não duplica nada
--    (ON CONFLICT no índice único parcial). Dia 29-31 é limitado ao
--    último dia do mês (fevereiro etc.).
--    Meses retroativos: SELECT generate_recurring_expenses('2026-05');
-- =====================================================================
CREATE OR REPLACE FUNCTION public.generate_recurring_expenses(
    p_month text DEFAULT to_char(CURRENT_DATE, 'YYYY-MM')
) RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_first date := to_date(p_month || '-01', 'YYYY-MM-DD');
    v_last  date := (v_first + interval '1 month' - interval '1 day')::date;
    v_count int;
BEGIN
    INSERT INTO public.cash_flow
        (type, category, description, value, date, status,
         account_id, supplier_id, recurring_expense_id, competence)
    SELECT r.type, r.category, r.description, r.value,
           LEAST(v_first + (r.due_day - 1), v_last),
           'Pending', r.account_id, r.supplier_id, r.id, p_month
    FROM public.recurring_expenses r
    WHERE r.active
      AND r.start_date <= v_last
      AND (r.end_date IS NULL OR r.end_date >= v_first)
    ON CONFLICT (recurring_expense_id, competence)
        WHERE recurring_expense_id IS NOT NULL
        DO NOTHING;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END $$;

-- =====================================================================
-- 9. Seeds: conta Asaas + conta padrão (só na primeira execução)
-- =====================================================================
INSERT INTO public.bank_accounts (name, system_key, color, bank_name)
SELECT 'Asaas', 'asaas', '#0030B9', 'Asaas'
WHERE NOT EXISTS (SELECT 1 FROM public.bank_accounts WHERE system_key = 'asaas');

INSERT INTO public.bank_accounts (name, is_default)
SELECT 'Conta Principal', true
WHERE NOT EXISTS (SELECT 1 FROM public.bank_accounts WHERE is_default);

-- =====================================================================
-- 10. Migração dos lançamentos antigos:
--     boletos (gerados ou marcados) -> conta Asaas; resto -> conta padrão.
--     Depois é só reatribuir manualmente na tela o que for de outro banco.
-- =====================================================================
UPDATE public.cash_flow
SET account_id = (SELECT id FROM public.bank_accounts WHERE system_key = 'asaas')
WHERE account_id IS NULL
  AND (asaas_payment_id IS NOT NULL OR payment_method = 'Boleto');

UPDATE public.cash_flow
SET account_id = (SELECT id FROM public.bank_accounts WHERE is_default LIMIT 1)
WHERE account_id IS NULL;

-- =====================================================================
-- Verificações (rodar após executar este arquivo):
--   SELECT * FROM bank_accounts;                          -- 2 contas
--   SELECT count(*) FROM cash_flow WHERE account_id IS NULL;  -- 0
--   SELECT count(*) FROM cash_flow
--    WHERE asaas_payment_id IS NOT NULL
--      AND account_id <> (SELECT id FROM bank_accounts WHERE system_key='asaas'); -- 0
--   SELECT generate_recurring_expenses();  -- 0 (rodar 2x: continua 0)
--
-- Rollback (se necessário — remove TUDO deste arquivo):
--   DROP TRIGGER IF EXISTS trg_cash_flow_asaas_account ON public.cash_flow;
--   DROP FUNCTION IF EXISTS public.fn_cash_flow_asaas_account();
--   DROP FUNCTION IF EXISTS public.generate_recurring_expenses(text);
--   ALTER TABLE public.cash_flow
--       DROP COLUMN IF EXISTS account_id,
--       DROP COLUMN IF EXISTS supplier_id,
--       DROP COLUMN IF EXISTS recurring_expense_id,
--       DROP COLUMN IF EXISTS competence;
--   DROP TABLE IF EXISTS public.account_transfers;
--   DROP TABLE IF EXISTS public.recurring_expenses;
--   DROP TABLE IF EXISTS public.suppliers;
--   DROP TABLE IF EXISTS public.bank_accounts;
-- =====================================================================
