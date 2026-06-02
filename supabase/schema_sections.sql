-- Additional Proposal Sections feature
-- Reusable section templates (e.g. "GARANTIA E SUPORTE", "MATERIAIS A SER FORNECIDOS PELO CLIENTE")
-- Sections linked to a template render live from the template, so editing the
-- template updates every proposal that references it.

-- 1. Reusable section templates table
CREATE TABLE public.proposal_section_templates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    content text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. RLS for section templates (anon access, consistent with the rest of the MVP)
ALTER TABLE public.proposal_section_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for anon users on section templates"
    ON public.proposal_section_templates FOR ALL USING (true);

-- 3. Per-proposal list of additional sections.
-- Each array item is one of:
--   { "kind": "template", "template_id": "<uuid>" }   -> linked, resolved live from the template
--   { "kind": "custom",   "title": "...", "content": "..." } -> one-off / detached copy
ALTER TABLE public.proposals
    ADD COLUMN IF NOT EXISTS additional_sections jsonb DEFAULT '[]'::jsonb;
