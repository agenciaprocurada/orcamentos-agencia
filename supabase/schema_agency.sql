-- Agency (CONTRATADA) legal data — a single shared row used to resolve the
-- {{AGENCIA_*}} variables in contract templates.

CREATE TABLE public.agency_settings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    razao_social text,
    cnpj text,
    endereco text,
    cidade text,
    uf text,
    email text,
    telefone text,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.agency_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated admins manage agency settings"
    ON public.agency_settings FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- Seed one empty row so the app always has a record to edit.
INSERT INTO public.agency_settings (razao_social) VALUES (NULL);
