-- 1. Create Services Table
CREATE TABLE public.services (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    base_price numeric(10,2) DEFAULT 0.00 NOT NULL,
    vision_template text,
    engine_template text,
    scope_template text,
    investment_template text,
    phases_template jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Setup RLS for Services
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for anon users on services" ON public.services FOR ALL USING (true);

-- 3. Modify Proposals Table
-- Drop the check constraint on service_type to allow dynamic names
ALTER TABLE public.proposals DROP CONSTRAINT IF EXISTS proposals_service_type_check;

-- Add new columns for dynamic services and templates in proposals
ALTER TABLE public.proposals ADD COLUMN service_id uuid REFERENCES public.services(id) ON DELETE SET NULL;
ALTER TABLE public.proposals ADD COLUMN start_date date;
ALTER TABLE public.proposals ADD COLUMN vision_text text;
ALTER TABLE public.proposals ADD COLUMN engine_text text;
ALTER TABLE public.proposals ADD COLUMN scope_text text;
ALTER TABLE public.proposals ADD COLUMN investment_text text;
ALTER TABLE public.proposals ADD COLUMN project_phases jsonb DEFAULT '[]'::jsonb;
