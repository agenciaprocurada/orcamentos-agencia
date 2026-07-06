-- Section templates restricted per service.
-- NULL or empty array = template available for every service (backward compatible).
ALTER TABLE public.proposal_section_templates
    ADD COLUMN IF NOT EXISTS service_ids uuid[] DEFAULT '{}'::uuid[];
