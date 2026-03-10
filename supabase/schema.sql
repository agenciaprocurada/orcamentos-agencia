-- 1. Create Tables

CREATE TABLE public.clients (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    email text,
    whatsapp text,
    company_name text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.proposals (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    service_type text CHECK (service_type IN ('Site', 'WebSystem', 'Ads', 'SEO')) NOT NULL,
    value numeric(10,2) NOT NULL,
    status text CHECK (status IN ('Draft', 'Sent', 'Approved', 'Rejected')) DEFAULT 'Draft' NOT NULL,
    content_json jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.cash_flow (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    type text CHECK (type IN ('Income', 'Expense')) NOT NULL,
    category text CHECK (category IN ('Ads_Recurring', 'Project_Spot', 'Tool_Cost', 'Tax')) NOT NULL,
    value numeric(10,2) NOT NULL,
    date date NOT NULL,
    description text,
    status text CHECK (status IN ('Paid', 'Pending')) DEFAULT 'Pending' NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Setup RLS (Row Level Security)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_flow ENABLE ROW LEVEL SECURITY;

-- 3. Create Policies (Allowing Anonymous access for the MVP without Login screen)
CREATE POLICY "Enable all for anon users" ON public.clients FOR ALL USING (true);
CREATE POLICY "Enable all for anon users" ON public.proposals FOR ALL USING (true);
CREATE POLICY "Enable all for anon users" ON public.cash_flow FOR ALL USING (true);
