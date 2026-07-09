-- Importação de extrato bancário -> lançamentos do cash_flow.
--
-- ADITIVO e reversível: só acrescenta duas colunas anuláveis em cash_flow e um
-- índice único parcial. Nada do fluxo Asaas/recorrências muda. Rode depois do
-- schema_financeiro.sql (precisa de cash_flow.account_id).
--
-- O objetivo do fingerprint é a IDEMPOTÊNCIA da importação: reimportar o mesmo
-- extrato (ou meses que se sobrepõem) NÃO duplica lançamento. A Edge Function
-- import-statement grava o fingerprint e o insert usa ON CONFLICT DO NOTHING.
--   - OFX: fingerprint = 'ofx:' || account_id || ':' || FITID (id único do banco).
--   - PDF/CSV sem id: fingerprint = 'hash:' || account_id || ':' || sha1(data|valor|descrição)
--                     + sufixo de desempate quando há linhas idênticas no mesmo lote.

ALTER TABLE public.cash_flow
    -- Impressão digital do lançamento importado. NULL nos lançamentos manuais
    -- e nos gerados por Asaas/recorrência (não passam por importação).
    ADD COLUMN IF NOT EXISTS import_fingerprint text,
    -- Origem do lançamento: 'extrato' quando veio da importação. NULL no resto.
    ADD COLUMN IF NOT EXISTS source text;

-- Barreira anti-duplicata: dois lançamentos não podem ter o mesmo fingerprint.
-- Índice único SIMPLES (não parcial) de propósito: no Postgres vários NULL são
-- considerados distintos entre si, então as milhares de linhas antigas (todas com
-- fingerprint NULL) não colidem. Simples permite que o `upsert onConflict` do
-- front infira este índice e pule os já-importados sem derrubar o lote inteiro.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_flow_import_fingerprint
    ON public.cash_flow (import_fingerprint);

-- =====================================================================
-- Rollback (remove TUDO deste arquivo):
--   DROP INDEX IF EXISTS public.idx_cash_flow_import_fingerprint;
--   ALTER TABLE public.cash_flow
--       DROP COLUMN IF EXISTS import_fingerprint,
--       DROP COLUMN IF EXISTS source;
-- =====================================================================
