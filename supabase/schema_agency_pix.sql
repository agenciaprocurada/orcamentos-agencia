-- Add PIX payment data to the agency settings (used by the {{CHAVE_PIX}},
-- {{BENEFICIARIO_PIX}} and {{PAGAMENTO_PIX}} contract variables).
ALTER TABLE public.agency_settings ADD COLUMN IF NOT EXISTS pix_key text;
ALTER TABLE public.agency_settings ADD COLUMN IF NOT EXISTS pix_beneficiario text;
