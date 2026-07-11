-- Gestão > Projetos
-- Projeto nasce de proposta aprovada (automático) ou é criado manualmente.
-- type: 'oneoff' (com conclusão) | 'recurring' (semanal/mensal).
-- Em projetos recorrentes, tarefas com is_template = true são o modelo;
-- as instâncias do período são geradas pelo app (template_id + period).

create table if not exists public.projects (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    client_id uuid references public.clients(id) on delete set null,
    proposal_id uuid references public.proposals(id) on delete set null,
    type text not null default 'oneoff' check (type in ('oneoff', 'recurring')),
    frequency text check (frequency in ('weekly', 'monthly')),
    status text not null default 'active' check (status in ('active', 'paused', 'completed')),
    start_date date,
    end_date date,
    color text not null default '#C13584',
    notes text,
    created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.project_task_groups (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    name text not null,
    sort_order integer not null default 0,
    created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.project_tasks (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    group_id uuid references public.project_task_groups(id) on delete set null,
    title text not null,
    description text,
    start_date date,
    due_date date,
    completed boolean not null default false,
    completed_at timestamptz,
    sort_order integer not null default 0,
    -- Recorrência: modelo x instância gerada por período
    is_template boolean not null default false,
    template_id uuid references public.project_tasks(id) on delete cascade,
    period text, -- 'YYYY-MM' (mensal) ou 'YYYY-Www' (semanal)
    due_rule integer, -- modelo: dia do mês (1-31) ou dia da semana (1=seg..7=dom)
    -- Futuro multiusuário: responsável pela tarefa
    assignee text,
    created_at timestamptz not null default timezone('utc', now())
);

-- Antiduplicata da geração recorrente: 1 instância por modelo por período.
create unique index if not exists project_tasks_template_period_uniq
    on public.project_tasks (template_id, period);

create index if not exists project_tasks_project_idx on public.project_tasks (project_id);
create index if not exists project_tasks_due_idx on public.project_tasks (due_date);

-- Duração estimada da tarefa em horas de trabalho (8h úteis/dia, seg-sex).
-- O prazo é calculado a partir do início + duração, pulando fins de semana.
alter table public.project_tasks add column if not exists duration_hours integer;

-- Dependências do cronograma: por padrão cada grupo depende do grupo anterior
-- e cada tarefa depende da tarefa anterior (o início sugerido/recalculado é o
-- dia útil seguinte ao fim do antecessor). Itens independentes usam as
-- próprias datas. Grupos também podem ter datas próprias.
alter table public.project_task_groups add column if not exists start_date date;
alter table public.project_task_groups add column if not exists end_date date;
alter table public.project_task_groups add column if not exists depends_on_previous boolean not null default true;
alter table public.project_tasks add column if not exists depends_on_previous boolean not null default true;

alter table public.projects enable row level security;
alter table public.project_task_groups enable row level security;
alter table public.project_tasks enable row level security;

drop policy if exists "Enable all for anon users" on public.projects;
create policy "Enable all for anon users" on public.projects for all using (true);

drop policy if exists "Enable all for anon users" on public.project_task_groups;
create policy "Enable all for anon users" on public.project_task_groups for all using (true);

drop policy if exists "Enable all for anon users" on public.project_tasks;
create policy "Enable all for anon users" on public.project_tasks for all using (true);
