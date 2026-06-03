-- Agency (CONTRATADA) signature image, applied to a contract only after the
-- client signs. `agency_settings.signature_data` holds the reusable signature;
-- `contracts.agency_signature` is the snapshot frozen at the moment of signing.
ALTER TABLE public.agency_settings ADD COLUMN IF NOT EXISTS signature_data text;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS agency_signature text;
