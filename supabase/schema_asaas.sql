-- Integração Asaas (boletos das parcelas)
-- Rode este arquivo no SQL Editor do Supabase.

-- 1. Dados necessários para emitir boleto no pagador (cliente)
ALTER TABLE public.clients
    ADD COLUMN IF NOT EXISTS cpf text,
    ADD COLUMN IF NOT EXISTS asaas_customer_id text;

-- 2. Vínculo da parcela (cash_flow) com proposta/cliente + dados do boleto Asaas
ALTER TABLE public.cash_flow
    ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS installment_number int,
    ADD COLUMN IF NOT EXISTS asaas_payment_id text,
    ADD COLUMN IF NOT EXISTS boleto_url text,
    -- Espelha o status do boleto no Asaas: PENDING, RECEIVED, CONFIRMED, OVERDUE, REFUNDED...
    ADD COLUMN IF NOT EXISTS boleto_status text,
    -- Forma de pagamento da parcela: 'Boleto' (vai ao Asaas) ou Pix/Cartão/Depósito/Dinheiro.
    ADD COLUMN IF NOT EXISTS payment_method text;

-- 3. Índice para o webhook localizar a parcela pelo id do pagamento Asaas
CREATE INDEX IF NOT EXISTS idx_cash_flow_asaas_payment_id
    ON public.cash_flow (asaas_payment_id);

-- 4. Configuração da integração (dados NÃO-secretos, editáveis na tela).
--    A API key e o token do webhook ficam como secrets da Edge Function,
--    NUNCA aqui — o RLS é anon e vazaria a credencial.
CREATE TABLE IF NOT EXISTS public.integration_settings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    asaas_environment text CHECK (asaas_environment IN ('sandbox', 'production')) DEFAULT 'sandbox' NOT NULL,
    asaas_enabled boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for anon users" ON public.integration_settings;
CREATE POLICY "Enable all for anon users" ON public.integration_settings FOR ALL USING (true);

-- Garante exatamente uma linha de configuração.
INSERT INTO public.integration_settings (asaas_environment, asaas_enabled)
SELECT 'sandbox', false
WHERE NOT EXISTS (SELECT 1 FROM public.integration_settings);
