-- Tasks table for the task management module
CREATE TABLE public.tasks (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    notes text,
    due_date date,
    completed boolean DEFAULT false NOT NULL,
    completed_at timestamp with time zone,
    priority text CHECK (priority IN ('none', 'low', 'medium', 'high', 'urgent')) DEFAULT 'none' NOT NULL,
    parent_task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
    project text,
    labels text[] DEFAULT '{}',
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for anon users" ON public.tasks FOR ALL USING (true);
