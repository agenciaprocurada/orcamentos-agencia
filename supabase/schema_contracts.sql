-- Online Contract Signing feature
-- Reusable contract templates with variables + per-contract signing via public link.
-- The public signing page reads/writes through the `contract` Edge Function
-- (service role), so the contracts table itself is restricted to authenticated admins.

-- 1. Reusable contract templates
CREATE TABLE public.contract_templates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    body text,                                  -- HTML with {{VARIABLES}}
    signer_fields jsonb DEFAULT '[]'::jsonb,    -- [{ key, label, type, required }]
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Generated contracts (one per proposal/send)
CREATE TABLE public.contracts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL,
    template_id uuid REFERENCES public.contract_templates(id) ON DELETE SET NULL,
    public_token text NOT NULL UNIQUE,          -- random token used in the public link
    status text CHECK (status IN ('pending', 'signed', 'cancelled')) DEFAULT 'pending' NOT NULL,

    title text NOT NULL,                         -- snapshot of template title
    body text,                                   -- snapshot of template body (with {{VARIABLES}})
    merge_vars jsonb DEFAULT '{}'::jsonb,         -- values resolved from the proposal at creation
    signer_fields jsonb DEFAULT '[]'::jsonb,      -- snapshot of fields the client must fill
    brand text DEFAULT 'octo' NOT NULL,           -- header brand (octo/vinicius/procurada)

    signer_name text,                             -- pre-filled from proposal client
    signer_email text,
    signer_values jsonb DEFAULT '{}'::jsonb,      -- values the client filled at signing

    signature_data text,                          -- base64 PNG of the drawn signature
    signed_body text,                             -- final resolved HTML, frozen at signing
    signed_at timestamp with time zone,
    signer_ip text,                               -- captured server-side by the Edge Function
    signer_user_agent text,

    valid_until date,                             -- link expiration
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX idx_contracts_public_token ON public.contracts (public_token);
CREATE INDEX idx_contracts_proposal_id ON public.contracts (proposal_id);

-- 3. RLS — admin-only via the JS client. The public page never touches these
--    tables directly; it goes through the `contract` Edge Function (service role).
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated admins manage contract templates"
    ON public.contract_templates FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated admins manage contracts"
    ON public.contracts FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
