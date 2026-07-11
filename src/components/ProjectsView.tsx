import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import Gantt, { type GanttTask } from 'frappe-gantt';
// O "exports" do pacote não expõe o css; importa direto do arquivo.
import '../../node_modules/frappe-gantt/dist/frappe-gantt.css';
import type { Project, ProjectTask, ProjectTaskGroup, ProjectType, ProjectFrequency, ProjectStatus, Client } from '../types/database';
import { Modal } from './Modal';
import {
    ensureRecurringInstances,
    isoDate,
    todayISO,
    periodKey,
    periodLabel,
    weekStart,
    nextBusinessDayISO,
    nextWorkStart,
    workDueDate,
    upcomingOccurrences,
    type VirtualOccurrence,
} from '../lib/projectRecurrence';
import {
    Plus,
    FolderKanban,
    ChevronLeft,
    ChevronRight,
    CalendarDays,
    CalendarRange,
    ListChecks,
    CircleCheck,
    Circle,
    Trash2,
    Edit2,
    Repeat,
    Target,
    Loader2,
    AlertCircle,
    Link2,
    Unlink,
    RefreshCw,
    GripVertical,
} from 'lucide-react';

// -------------------------------------------------------------
// Constantes e helpers
// -------------------------------------------------------------

const PROJECT_COLORS = ['#C13584', '#6366F1', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#14B8A6'];

const STATUS_META: Record<ProjectStatus, { label: string; badge: string }> = {
    active: { label: 'Ativo', badge: 'badge badge-success' },
    paused: { label: 'Pausado', badge: 'badge badge-warning' },
    completed: { label: 'Concluído', badge: 'badge badge-neutral' },
};

const WEEKDAY_LABELS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

function fmtDate(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('pt-BR');
}

function isOverdue(t: ProjectTask): boolean {
    return !t.completed && !!t.due_date && t.due_date < todayISO();
}

function typeLabel(p: Project): string {
    if (p.type === 'recurring') return p.frequency === 'weekly' ? 'Recorrente · Semanal' : 'Recorrente · Mensal';
    return 'Pontual';
}

// -------------------------------------------------------------
// View principal
// -------------------------------------------------------------

type Props = {
    projects: Project[];
    groups: ProjectTaskGroup[];
    tasks: ProjectTask[];
    clients: Client[];
    refetch: () => void;
};

type SubTab = 'projetos' | 'tarefas' | 'calendario' | 'gantt';

export function ProjectsView({ projects, groups, tasks, clients, refetch }: Props) {
    const [tab, setTab] = useState<SubTab>('projetos');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [projectModal, setProjectModal] = useState<{ project: Project | null } | null>(null);

    // Espelho local para toggles otimistas (o board não pisca a cada clique).
    const [items, setItems] = useState<ProjectTask[]>(tasks);
    useEffect(() => { setItems(tasks); }, [tasks]);

    // Gera as instâncias do período dos projetos recorrentes (1x por montagem,
    // assim que os dados chegam). O índice único no banco evita duplicatas.
    const generated = useRef(false);
    useEffect(() => {
        if (generated.current || projects.length === 0) return;
        generated.current = true;
        ensureRecurringInstances(projects, tasks)
            .then(inserted => { if (inserted) refetch(); })
            .catch(() => { /* sem rede: gera na próxima abertura */ });
    }, [projects, tasks, refetch]);

    const toggleTask = useCallback(async (t: ProjectTask) => {
        const completed = !t.completed;
        setItems(prev => prev.map(x => (x.id === t.id ? { ...x, completed } : x)));
        await supabase
            .from('project_tasks')
            .update({ completed, completed_at: completed ? new Date().toISOString() : null })
            .eq('id', t.id);
        refetch();
    }, [refetch]);

    // Arrastar tarefa para outro grupo (atualização otimista, como no board de Leads).
    const moveTask = useCallback(async (taskId: string, groupId: string | null) => {
        const t = items.find(x => x.id === taskId);
        if (!t || t.group_id === groupId) return;
        setItems(prev => prev.map(x => (x.id === taskId ? { ...x, group_id: groupId } : x)));
        await supabase.from('project_tasks').update({ group_id: groupId }).eq('id', taskId);
        refetch();
    }, [items, refetch]);

    const selected = selectedId ? projects.find(p => p.id === selectedId) ?? null : null;

    const TABS: { key: SubTab; label: string; icon: React.ReactNode }[] = [
        { key: 'projetos', label: 'Projetos', icon: <FolderKanban size={15} /> },
        { key: 'tarefas', label: 'Tarefas', icon: <ListChecks size={15} /> },
        { key: 'calendario', label: 'Calendário', icon: <CalendarDays size={15} /> },
        { key: 'gantt', label: 'Linha do Tempo', icon: <CalendarRange size={15} /> },
    ];

    return (
        <div className="flex flex-col gap-5">
            <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 glass-inset rounded-xl p-1">
                    {TABS.map(t => (
                        <button
                            key={t.key}
                            onClick={() => { setTab(t.key); setSelectedId(null); }}
                            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-semibold transition-all cursor-pointer ${tab === t.key ? 'bg-white shadow-sm text-[var(--color-primary)]' : 'text-[var(--color-ink-3)] hover:text-[var(--color-ink)]'}`}
                        >
                            {t.icon} {t.label}
                        </button>
                    ))}
                </div>
                <button onClick={() => setProjectModal({ project: null })} className="btn-primary ml-auto">
                    <Plus size={18} /> Novo Projeto
                </button>
            </div>

            {tab === 'projetos' && !selected && (
                <ProjectList projects={projects} tasks={items} clients={clients} onOpen={setSelectedId} />
            )}
            {tab === 'projetos' && selected && (
                <ProjectDetail
                    project={selected}
                    groups={groups.filter(g => g.project_id === selected.id)}
                    tasks={items.filter(t => t.project_id === selected.id)}
                    client={clients.find(c => c.id === selected.client_id) ?? null}
                    refetch={refetch}
                    onToggle={toggleTask}
                    onMove={moveTask}
                    onBack={() => setSelectedId(null)}
                    onEdit={() => setProjectModal({ project: selected })}
                    onDeleted={() => { setSelectedId(null); refetch(); }}
                />
            )}
            {tab === 'tarefas' && (
                <AgendaView projects={projects} tasks={items} onToggle={toggleTask} onOpenProject={(id) => { setTab('projetos'); setSelectedId(id); }} />
            )}
            {tab === 'calendario' && (
                <CalendarView projects={projects} tasks={items} onToggle={toggleTask} />
            )}
            {tab === 'gantt' && (
                <GanttView projects={projects} tasks={items} refetch={refetch} />
            )}

            {projectModal && (
                <ProjectFormModal
                    clients={clients}
                    project={projectModal.project}
                    onClose={() => setProjectModal(null)}
                    onSaved={() => { setProjectModal(null); refetch(); }}
                />
            )}
        </div>
    );
}

// -------------------------------------------------------------
// Lista de projetos (cards)
// -------------------------------------------------------------

function ProjectList({ projects, tasks, clients, onOpen }: {
    projects: Project[];
    tasks: ProjectTask[];
    clients: Client[];
    onOpen: (id: string) => void;
}) {
    if (projects.length === 0) {
        return (
            <div className="glass-panel p-12 flex flex-col items-center justify-center text-center gap-3">
                <FolderKanban size={40} className="text-[var(--color-primary)]/40" />
                <p className="font-semibold text-[var(--color-ink)]">Nenhum projeto ainda</p>
                <p className="text-sm text-[var(--color-ink-3)] max-w-sm">
                    Aprove uma proposta para criar um projeto automaticamente, ou clique em "Novo Projeto" para criar um manualmente.
                </p>
            </div>
        );
    }

    const now = new Date();
    const order: Record<ProjectStatus, number> = { active: 0, paused: 1, completed: 2 };
    const sorted = [...projects].sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name));

    return (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sorted.map(p => {
                const client = clients.find(c => c.id === p.client_id);
                // Progresso: recorrente conta só o período atual; pontual conta tudo.
                const scope = tasks.filter(t => t.project_id === p.id && !t.is_template
                    && (p.type !== 'recurring' || !p.frequency || t.period === periodKey(p.frequency, now)));
                const done = scope.filter(t => t.completed).length;
                const pct = scope.length ? Math.round((done / scope.length) * 100) : 0;
                const late = tasks.filter(t => t.project_id === p.id && !t.is_template && isOverdue(t)).length;
                return (
                    <button
                        key={p.id}
                        onClick={() => onOpen(p.id)}
                        className={`glass-card-hover text-left p-5 flex flex-col gap-3 cursor-pointer ${p.status === 'completed' ? 'opacity-60' : ''}`}
                    >
                        <div className="flex items-start gap-2.5">
                            <span className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: p.color }} />
                            <div className="min-w-0 flex-1">
                                <p className="font-bold text-[var(--color-ink)] leading-snug truncate">{p.name}</p>
                                <p className="text-xs text-[var(--color-ink-3)] truncate mt-0.5">
                                    {client ? (client.company_name || client.name) : 'Sem cliente'}
                                </p>
                            </div>
                            {p.proposal_id && <Link2 size={14} className="text-[var(--color-ink-3)] flex-shrink-0 mt-1" aria-label="Criado a partir de proposta" />}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={p.type === 'recurring' ? 'badge badge-info' : 'badge badge-purple'}>
                                {p.type === 'recurring' ? <Repeat size={11} /> : <Target size={11} />} {typeLabel(p)}
                            </span>
                            <span className={STATUS_META[p.status].badge}>{STATUS_META[p.status].label}</span>
                            {late > 0 && <span className="badge badge-danger"><AlertCircle size={11} /> {late} atrasada{late > 1 ? 's' : ''}</span>}
                        </div>
                        <div className="flex items-center gap-2.5">
                            <div className="flex-1 h-1.5 rounded-full bg-black/5 overflow-hidden">
                                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: p.color }} />
                            </div>
                            <span className="text-[11px] font-semibold text-[var(--color-ink-3)] tabular-nums">{done}/{scope.length}</span>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}

// -------------------------------------------------------------
// Detalhe do projeto (grupos + tarefas / modelo recorrente)
// -------------------------------------------------------------

function ProjectDetail({ project, groups, tasks, client, refetch, onToggle, onMove, onBack, onEdit, onDeleted }: {
    project: Project;
    groups: ProjectTaskGroup[];
    tasks: ProjectTask[];
    client: Client | null;
    refetch: () => void;
    onToggle: (t: ProjectTask) => void;
    onMove: (taskId: string, groupId: string | null) => void;
    onBack: () => void;
    onEdit: () => void;
    onDeleted: () => void;
}) {
    const [taskModal, setTaskModal] = useState<{ task: ProjectTask | null; isTemplate: boolean; groupId: string | null } | null>(null);
    const [groupModal, setGroupModal] = useState<ProjectTaskGroup | null>(null);
    const [newGroupName, setNewGroupName] = useState('');
    const [busy, setBusy] = useState(false);
    const [recalcing, setRecalcing] = useState(false);
    // Drag-and-drop de tarefa entre grupos.
    const [dragId, setDragId] = useState<string | null>(null);
    const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);

    const isRecurring = project.type === 'recurring' && !!project.frequency;
    const currentPeriod = isRecurring ? periodKey(project.frequency!, new Date()) : null;

    const templates = tasks.filter(t => t.is_template);
    const currentTasks = isRecurring
        ? tasks.filter(t => !t.is_template && t.period === currentPeriod)
        : tasks.filter(t => !t.is_template);
    const pastPending = isRecurring
        ? tasks.filter(t => !t.is_template && t.period && t.period !== currentPeriod && !t.completed)
        : [];

    const setStatus = async (status: ProjectStatus) => {
        await supabase.from('projects').update({ status }).eq('id', project.id);
        refetch();
    };

    const deleteProject = async () => {
        if (!window.confirm(`Excluir o projeto "${project.name}"? Todas as tarefas e grupos serão apagados.`)) return;
        setBusy(true);
        await supabase.from('projects').delete().eq('id', project.id);
        onDeleted();
    };

    const addGroup = async () => {
        const name = newGroupName.trim();
        if (!name) return;
        setNewGroupName('');
        await supabase.from('project_task_groups').insert({ project_id: project.id, name, sort_order: groups.length });
        refetch();
    };

    const deleteGroup = async (g: ProjectTaskGroup) => {
        if (!window.confirm(`Excluir o grupo "${g.name}"? As tarefas dele ficam sem grupo (não são apagadas).`)) return;
        await supabase.from('project_task_groups').delete().eq('id', g.id);
        refetch();
    };

    const deleteTask = async (t: ProjectTask) => {
        const msg = t.is_template
            ? `Excluir a tarefa-modelo "${t.title}"? As tarefas já geradas por ela também serão apagadas.`
            : `Excluir a tarefa "${t.title}"?`;
        if (!window.confirm(msg)) return;
        await supabase.from('project_tasks').delete().eq('id', t.id);
        refetch();
    };

    // Grupo "efetivo" de uma tarefa (grupo apagado conta como "Sem grupo").
    const groupKeyOf = (t: ProjectTask): string | null =>
        t.group_id && groups.some(g => g.id === t.group_id) ? t.group_id : null;

    // Janela de datas de cada grupo, encadeando as dependências: grupo
    // dependente começa no dia útil seguinte ao fim do grupo anterior;
    // independente usa a própria data (ou o início do projeto). O bucket
    // "Sem grupo" fecha a corrente. O fim vem do maior prazo das tarefas
    // (ou da data fim do próprio grupo).
    const anchorStart = nextBusinessDayISO(project.start_date || todayISO());
    const groupWindows = useMemo(() => {
        const map = new Map<string | null, { start: string; end: string | null }>();
        const ordered = [...groups].sort((a, b) => a.sort_order - b.sort_order);
        let prevEnd: string | null = null;
        for (const g of [...ordered, null] as (ProjectTaskGroup | null)[]) {
            const key = g?.id ?? null;
            const depends = g ? g.depends_on_previous : true;
            let start = depends && prevEnd
                ? nextWorkStart(prevEnd)
                : (g?.start_date ? nextBusinessDayISO(g.start_date) : anchorStart);
            if (start < anchorStart) start = anchorStart;
            const dues = currentTasks
                .filter(t => groupKeyOf(t) === key)
                .map(t => t.due_date || t.start_date)
                .filter((d): d is string => !!d);
            if (g?.end_date) dues.push(g.end_date);
            const end = dues.length ? [...dues].sort().pop()! : null;
            map.set(key, { start, end });
            if (end) prevEnd = end;
        }
        return map;
    }, [groups, currentTasks, anchorStart]); // eslint-disable-line react-hooks/exhaustive-deps

    // Início sugerido para nova tarefa: dependente = dia útil seguinte ao fim
    // da última tarefa do grupo; independente = início do próprio grupo.
    const suggestStart = (groupId: string | null, list: ProjectTask[], depends = true): string => {
        const groupStart = groupWindows.get(groupId)?.start ?? anchorStart;
        if (!depends) return groupStart;
        const rows = list.filter(t => groupKeyOf(t) === groupId);
        const last = rows.reduce<string | null>((max, t) => {
            const d = t.due_date || t.start_date;
            return d && (!max || d > max) ? d : max;
        }, null);
        const suggestion = last ? nextWorkStart(last) : groupStart;
        return suggestion < anchorStart ? anchorStart : suggestion;
    };

    // Recalcula o cronograma inteiro na ordem dos grupos e das tarefas:
    // dependentes são encadeadas (início = dia útil após o fim do anterior,
    // prazo = início + duração a 8h úteis/dia); independentes e concluídas
    // mantêm as próprias datas, mas seguem contando na corrente.
    const recalcSchedule = async () => {
        if (!window.confirm('Recalcular início e prazo das tarefas não concluídas, seguindo ordem, dependências e durações? Tarefas independentes e concluídas mantêm as próprias datas.')) return;
        setRecalcing(true);
        try {
            const ordered = [...groups].sort((a, b) => a.sort_order - b.sort_order);
            const updates: { id: string; start_date: string; due_date: string }[] = [];
            let prevEnd: string | null = null;
            for (const g of [...ordered, null] as (ProjectTaskGroup | null)[]) {
                const key = g?.id ?? null;
                const dependsGroup = g ? g.depends_on_previous : true;
                let cursor = dependsGroup && prevEnd
                    ? nextWorkStart(prevEnd)
                    : (g?.start_date ? nextBusinessDayISO(g.start_date) : anchorStart);
                if (cursor < anchorStart) cursor = anchorStart;
                let groupEnd: string | null = g?.end_date ?? null;
                for (const t of currentTasks.filter(x => groupKeyOf(x) === key)) {
                    let start: string;
                    let due: string;
                    if (t.completed || (!t.depends_on_previous && t.start_date)) {
                        start = t.start_date ?? cursor;
                        due = t.due_date ?? (t.duration_hours ? workDueDate(start, t.duration_hours) : start);
                    } else {
                        start = cursor;
                        due = workDueDate(start, t.duration_hours ?? 8);
                        if (t.start_date !== start || t.due_date !== due) {
                            updates.push({ id: t.id, start_date: start, due_date: due });
                        }
                    }
                    cursor = nextWorkStart(due);
                    if (!groupEnd || due > groupEnd) groupEnd = due;
                }
                if (groupEnd) prevEnd = groupEnd;
            }
            if (updates.length > 0) {
                await Promise.all(updates.map(u =>
                    supabase.from('project_tasks').update({ start_date: u.start_date, due_date: u.due_date }).eq('id', u.id)
                ));
                refetch();
            }
        } finally {
            setRecalcing(false);
        }
    };

    // Adição rápida direto no grupo (só o título; o resto usa as sugestões).
    const addInlineTask = async (groupId: string | null, title: string, asTemplate: boolean, list: ProjectTask[]) => {
        const payload: Record<string, unknown> = {
            project_id: project.id,
            group_id: groupId,
            title,
            is_template: asTemplate,
        };
        if (!asTemplate) {
            payload.start_date = suggestStart(groupId, list);
            if (isRecurring) payload.period = currentPeriod;
        }
        await supabase.from('project_tasks').insert(payload);
        refetch();
    };

    // Bloco de tarefas agrupadas (usado tanto no pontual quanto no período recorrente).
    // Cada seção de grupo é alvo de soltura do drag-and-drop; o "Sem grupo"
    // aparece durante o arrasto mesmo vazio, para permitir desagrupar.
    const renderGrouped = (list: ProjectTask[], allowTemplateEdit: boolean) => {
        const sections: { group: ProjectTaskGroup | null; rows: ProjectTask[] }[] = [
            ...groups.map(g => ({ group: g as ProjectTaskGroup | null, rows: list.filter(t => t.group_id === g.id) })),
            { group: null, rows: list.filter(t => !t.group_id || !groups.some(g => g.id === t.group_id)) },
        ];
        return sections
            .filter(s => s.group !== null || s.rows.length > 0 || dragId !== null)
            .map((s, i) => {
                const key = s.group?.id ?? 'none';
                const over = dragOverGroup === key;
                return (
                    <div
                        key={s.group?.id ?? `nogroup-${i}`}
                        onDragOver={e => { e.preventDefault(); setDragOverGroup(key); }}
                        onDragLeave={() => setDragOverGroup(cur => (cur === key ? null : cur))}
                        onDrop={e => {
                            e.preventDefault();
                            const id = e.dataTransfer.getData('text/plain') || dragId;
                            setDragId(null);
                            setDragOverGroup(null);
                            if (id) onMove(id, s.group?.id ?? null);
                        }}
                        className={`flex flex-col gap-1 rounded-xl transition-colors ${over ? 'bg-[var(--color-primary-50)] ring-1 ring-[var(--color-primary)]/30' : ''}`}
                    >
                        <div className="flex items-center gap-2 mt-2">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">
                                {s.group ? s.group.name : 'Sem grupo'}
                            </p>
                            {s.group && !s.group.depends_on_previous && (
                                <span title="Independente do grupo anterior (usa datas próprias)">
                                    <Unlink size={11} className="text-amber-500" />
                                </span>
                            )}
                            {s.group && (
                                <>
                                    <button onClick={() => setGroupModal(s.group!)} className="text-[var(--color-ink-3)]/50 hover:text-[var(--color-primary)] transition-colors cursor-pointer" aria-label="Editar grupo">
                                        <Edit2 size={12} />
                                    </button>
                                    <button onClick={() => deleteGroup(s.group!)} className="text-[var(--color-ink-3)]/50 hover:text-rose-500 transition-colors cursor-pointer" aria-label="Excluir grupo">
                                        <Trash2 size={12} />
                                    </button>
                                </>
                            )}
                            {!allowTemplateEdit && (() => {
                                const win = groupWindows.get(s.group?.id ?? null);
                                if (!win) return null;
                                return (
                                    <span className="text-[10px] text-[var(--color-ink-3)]/70 tabular-nums whitespace-nowrap">
                                        {fmtDate(win.start)}{win.end ? ` – ${fmtDate(win.end)}` : ''}
                                    </span>
                                );
                            })()}
                            <div className="flex-1 border-t border-black/5" />
                        </div>
                        {s.rows.length === 0 && (
                            <p className="text-xs text-[var(--color-ink-3)]/70 italic px-1 py-1">
                                {dragId ? 'Solte aqui' : 'Sem tarefas neste grupo'}
                            </p>
                        )}
                        {s.rows.map(t => (
                            <TaskRow
                                key={t.id}
                                task={t}
                                onToggle={allowTemplateEdit ? undefined : () => onToggle(t)}
                                onEdit={() => setTaskModal({ task: t, isTemplate: t.is_template, groupId: t.group_id })}
                                onDelete={() => deleteTask(t)}
                                frequency={allowTemplateEdit ? project.frequency : null}
                                drag={{
                                    onStart: e => { e.dataTransfer.setData('text/plain', t.id); e.dataTransfer.effectAllowed = 'move'; setDragId(t.id); },
                                    onEnd: () => { setDragId(null); setDragOverGroup(null); },
                                    dragging: dragId === t.id,
                                }}
                            />
                        ))}
                        <InlineTaskAdd
                            placeholder={allowTemplateEdit ? 'Nova tarefa-modelo…' : 'Nova tarefa…'}
                            onAdd={title => addInlineTask(s.group?.id ?? null, title, allowTemplateEdit, list)}
                        />
                    </div>
                );
            });
    };

    return (
        <div className="flex flex-col gap-5">
            <div className="glass-panel p-5 flex flex-col gap-4">
                <div className="flex items-start gap-3">
                    <button onClick={onBack} className="icon-action mt-0.5" aria-label="Voltar">
                        <ChevronLeft size={18} />
                    </button>
                    <span className="w-3 h-3 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: project.color }} />
                    <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-[var(--color-ink)] leading-snug">{project.name}</h3>
                        <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                            <span className={project.type === 'recurring' ? 'badge badge-info' : 'badge badge-purple'}>
                                {project.type === 'recurring' ? <Repeat size={11} /> : <Target size={11} />} {typeLabel(project)}
                            </span>
                            {client && <span className="badge badge-neutral">{client.company_name || client.name}</span>}
                            {project.start_date && (
                                <span className="badge badge-neutral">
                                    {fmtDate(project.start_date)}{project.end_date ? ` → ${fmtDate(project.end_date)}` : ''}
                                </span>
                            )}
                        </div>
                        {project.notes && <p className="text-sm text-[var(--color-ink-3)] mt-2 whitespace-pre-wrap">{project.notes}</p>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={onEdit} className="icon-action" aria-label="Editar projeto"><Edit2 size={16} /></button>
                        <button onClick={deleteProject} disabled={busy} className="icon-action hover:text-rose-500" aria-label="Excluir projeto">
                            {busy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                        </button>
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    {(Object.keys(STATUS_META) as ProjectStatus[]).map(s => (
                        <button
                            key={s}
                            onClick={() => setStatus(s)}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${project.status === s ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'bg-black/5 text-[var(--color-ink-3)] hover:bg-black/10'}`}
                        >
                            {STATUS_META[s].label}
                        </button>
                    ))}
                </div>
            </div>

            {isRecurring ? (
                <>
                    <div className="glass-panel p-5 flex flex-col gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                            <p className="panel-title capitalize">Período atual — {periodLabel(project.frequency!, new Date())}</p>
                            <span className="text-xs text-[var(--color-ink-3)] ml-auto tabular-nums">
                                {currentTasks.filter(t => t.completed).length}/{currentTasks.length} concluídas
                            </span>
                        </div>
                        {currentTasks.length === 0 && (
                            <p className="text-sm text-[var(--color-ink-3)] italic">
                                Nenhuma tarefa neste período. Adicione tarefas-modelo abaixo — elas são geradas automaticamente a cada {project.frequency === 'weekly' ? 'semana' : 'mês'}.
                            </p>
                        )}
                        {renderGrouped(currentTasks, false)}
                    </div>

                    {pastPending.length > 0 && (
                        <div className="glass-panel p-5 flex flex-col gap-1">
                            <p className="panel-title mb-1">Pendências de períodos anteriores</p>
                            {pastPending.map(t => (
                                <TaskRow key={t.id} task={t} onToggle={() => onToggle(t)} onDelete={() => deleteTask(t)} showPeriod />
                            ))}
                        </div>
                    )}

                    <div className="glass-panel p-5 flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <p className="panel-title">Tarefas-modelo</p>
                            <span className="text-xs text-[var(--color-ink-3)]">geram as tarefas de cada período</span>
                            <button onClick={() => setTaskModal({ task: null, isTemplate: true, groupId: null })} className="btn-outline-brand ml-auto !px-3 !py-1.5 text-xs">
                                <Plus size={14} /> Tarefa-modelo
                            </button>
                        </div>
                        {templates.length === 0 && <p className="text-sm text-[var(--color-ink-3)] italic">Nenhuma tarefa-modelo ainda.</p>}
                        {renderGrouped(templates, true)}
                        <GroupAdder value={newGroupName} onChange={setNewGroupName} onAdd={addGroup} />
                    </div>
                </>
            ) : (
                <div className="glass-panel p-5 flex flex-col gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="panel-title">Tarefas</p>
                        <span className="text-xs text-[var(--color-ink-3)] tabular-nums">
                            {currentTasks.filter(t => t.completed).length}/{currentTasks.length} concluídas
                        </span>
                        <button onClick={recalcSchedule} disabled={recalcing || currentTasks.length === 0}
                            title="Reagenda as tarefas na ordem, seguindo dependências e durações"
                            className="btn-ghost ml-auto !px-3 !py-1.5 text-xs disabled:opacity-40">
                            {recalcing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Recalcular datas
                        </button>
                        <button onClick={() => setTaskModal({ task: null, isTemplate: false, groupId: null })} className="btn-outline-brand !px-3 !py-1.5 text-xs">
                            <Plus size={14} /> Nova tarefa
                        </button>
                    </div>
                    {currentTasks.length === 0 && groups.length === 0 && (
                        <p className="text-sm text-[var(--color-ink-3)] italic">Nenhuma tarefa ainda. Crie grupos (ex.: fases do projeto) e tarefas com prazo.</p>
                    )}
                    {renderGrouped(currentTasks, false)}
                    <GroupAdder value={newGroupName} onChange={setNewGroupName} onAdd={addGroup} />
                </div>
            )}

            {taskModal && (
                <TaskFormModal
                    project={project}
                    groups={groups}
                    task={taskModal.task}
                    isTemplate={taskModal.isTemplate}
                    initialGroupId={taskModal.groupId}
                    suggestedStart={!taskModal.task && !taskModal.isTemplate ? suggestStart(taskModal.groupId, currentTasks) : null}
                    suggestedGroupStart={!taskModal.task && !taskModal.isTemplate ? (groupWindows.get(taskModal.groupId)?.start ?? anchorStart) : null}
                    onClose={() => setTaskModal(null)}
                    onSaved={() => { setTaskModal(null); refetch(); }}
                />
            )}
            {groupModal && (
                <GroupFormModal
                    group={groupModal}
                    onClose={() => setGroupModal(null)}
                    onSaved={() => { setGroupModal(null); refetch(); }}
                />
            )}
        </div>
    );
}

// Adição rápida de tarefa dentro do grupo (Enter salva e mantém aberto
// para digitar a próxima; Esc fecha).
function InlineTaskAdd({ placeholder, onAdd }: { placeholder: string; onAdd: (title: string) => void }) {
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState('');

    if (!open) {
        return (
            <button
                onClick={() => setOpen(true)}
                className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-[var(--color-ink-3)]/70 hover:text-[var(--color-primary)] transition-colors cursor-pointer self-start"
            >
                <Plus size={13} /> Adicionar tarefa
            </button>
        );
    }

    const submit = () => {
        const t = value.trim();
        if (!t) return;
        onAdd(t);
        setValue('');
    };

    return (
        <div className="flex items-center gap-2 px-2 py-1">
            <input
                autoFocus
                value={value}
                onChange={e => setValue(e.target.value)}
                onKeyDown={e => {
                    if (e.key === 'Enter') submit();
                    if (e.key === 'Escape') { setValue(''); setOpen(false); }
                }}
                onBlur={() => { if (!value.trim()) setOpen(false); }}
                placeholder={placeholder}
                className="field-input flex-1 !py-1.5 text-sm"
            />
            <button onClick={submit} disabled={!value.trim()} className="btn-secondary !px-3 !py-1.5 text-xs disabled:opacity-40">
                <Plus size={14} /> Adicionar
            </button>
        </div>
    );
}

function GroupAdder({ value, onChange, onAdd }: { value: string; onChange: (v: string) => void; onAdd: () => void }) {
    return (
        <div className="flex items-center gap-2 mt-2">
            <input
                value={value}
                onChange={e => onChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') onAdd(); }}
                placeholder="Novo grupo (ex.: Fase 1 — Briefing)"
                className="field-input flex-1 !py-1.5 text-sm"
            />
            <button onClick={onAdd} disabled={!value.trim()} className="btn-secondary !px-3 !py-1.5 text-xs disabled:opacity-40">
                <Plus size={14} /> Grupo
            </button>
        </div>
    );
}

// -------------------------------------------------------------
// Linha de tarefa
// -------------------------------------------------------------

function TaskRow({ task, onToggle, onEdit, onDelete, showProject, showPeriod, frequency, drag }: {
    task: ProjectTask;
    onToggle?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    showProject?: { name: string; color: string } | null | undefined | false;
    showPeriod?: boolean;
    frequency?: ProjectFrequency | null;
    // Presente apenas no detalhe do projeto: arrastar a linha para outro grupo.
    drag?: { onStart: (e: React.DragEvent) => void; onEnd: () => void; dragging: boolean };
}) {
    const overdue = isOverdue(task);
    // Rótulo do prazo: tarefa normal mostra a data; modelo mostra a regra.
    const dueLabel = task.is_template
        ? (task.due_rule == null
            ? (frequency === 'weekly' ? 'fim da semana' : 'fim do mês')
            : (frequency === 'weekly' ? WEEKDAY_LABELS[task.due_rule - 1] : `dia ${task.due_rule}`))
        : (task.due_date ? fmtDate(task.due_date) : null);

    return (
        <div
            draggable={!!drag}
            onDragStart={drag?.onStart}
            onDragEnd={drag?.onEnd}
            className={`group flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-white/60 transition-colors ${drag ? 'cursor-grab active:cursor-grabbing' : ''} ${drag?.dragging ? 'opacity-40' : ''}`}
        >
            {drag && <GripVertical size={13} className="text-[var(--color-ink-3)]/30 group-hover:text-[var(--color-ink-3)]/70 flex-shrink-0 -ml-1 -mr-1" />}
            {onToggle ? (
                <button onClick={onToggle} className="flex-shrink-0 cursor-pointer" aria-label={task.completed ? 'Reabrir tarefa' : 'Concluir tarefa'}>
                    {task.completed
                        ? <CircleCheck size={19} className="text-emerald-500" />
                        : <Circle size={19} className={overdue ? 'text-rose-400' : 'text-[var(--color-ink-3)]/50 hover:text-[var(--color-primary)]'} />}
                </button>
            ) : (
                <Repeat size={15} className="text-[var(--color-ink-3)]/60 flex-shrink-0 ml-0.5" />
            )}
            <div className="flex-1 min-w-0">
                <p className={`text-sm leading-snug truncate ${task.completed ? 'line-through text-[var(--color-ink-3)]' : 'text-[var(--color-ink)]'}`}>
                    {task.title}
                </p>
                {task.description && <p className="text-xs text-[var(--color-ink-3)] truncate">{task.description}</p>}
            </div>
            {showProject && (
                <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-[var(--color-ink-3)] max-w-[140px] truncate">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: showProject.color }} />
                    {showProject.name}
                </span>
            )}
            {showPeriod && task.period && <span className="badge badge-neutral">{task.period}</span>}
            {!task.is_template && !task.depends_on_previous && (
                <span title="Independente da tarefa anterior (datas próprias)" className="flex-shrink-0">
                    <Unlink size={12} className="text-amber-500/80" />
                </span>
            )}
            {task.duration_hours != null && (
                <span className="text-[11px] text-[var(--color-ink-3)]/70 tabular-nums flex-shrink-0">
                    {task.duration_hours % 8 === 0 ? `${task.duration_hours / 8}d` : `${task.duration_hours}h`}
                </span>
            )}
            {dueLabel && (
                <span className={`text-[11px] font-semibold tabular-nums flex-shrink-0 ${overdue ? 'text-rose-500' : 'text-[var(--color-ink-3)]'}`}>
                    {overdue && <AlertCircle size={11} className="inline mr-0.5 -mt-0.5" />}{dueLabel}
                </span>
            )}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                {onEdit && <button onClick={onEdit} className="icon-action !p-1" aria-label="Editar"><Edit2 size={13} /></button>}
                {onDelete && <button onClick={onDelete} className="icon-action !p-1 hover:text-rose-500" aria-label="Excluir"><Trash2 size={13} /></button>}
            </div>
        </div>
    );
}

// -------------------------------------------------------------
// Agenda (Hoje / Semana / Mês)
// -------------------------------------------------------------

function AgendaView({ projects, tasks, onToggle, onOpenProject }: {
    projects: Project[];
    tasks: ProjectTask[];
    onToggle: (t: ProjectTask) => void;
    onOpenProject: (id: string) => void;
}) {
    const [range, setRange] = useState<'dia' | 'semana' | 'mes'>('dia');
    const today = todayISO();

    const { start, end } = useMemo(() => {
        const now = new Date();
        if (range === 'dia') return { start: today, end: today };
        if (range === 'semana') {
            const ws = weekStart(now);
            const we = new Date(ws); we.setDate(we.getDate() + 6);
            return { start: isoDate(ws), end: isoDate(we) };
        }
        return {
            start: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
            end: isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
        };
    }, [range, today]);

    const real = tasks.filter(t => !t.is_template && t.due_date);
    const overdue = real.filter(t => isOverdue(t) && t.due_date! < start).sort((a, b) => a.due_date!.localeCompare(b.due_date!));
    const inRange = real.filter(t => t.due_date! >= start && t.due_date! <= end).sort((a, b) => a.due_date!.localeCompare(b.due_date!));
    const done = inRange.filter(t => t.completed).length;

    const projectChip = (t: ProjectTask) => {
        const p = projects.find(x => x.id === t.project_id);
        return p ? { name: p.name, color: p.color } : null;
    };

    // Agrupa por data para exibir com cabeçalho ("qui, 10 de julho").
    const byDate = inRange.reduce<Record<string, ProjectTask[]>>((acc, t) => {
        (acc[t.due_date!] ??= []).push(t);
        return acc;
    }, {});

    const dateHeader = (iso: string) => {
        const [y, m, d] = iso.split('-').map(Number);
        const label = new Date(y, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'long' });
        return iso === today ? `Hoje · ${label}` : label;
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 flex-wrap">
                {([['dia', 'Hoje'], ['semana', 'Esta semana'], ['mes', 'Este mês']] as const).map(([key, label]) => (
                    <button
                        key={key}
                        onClick={() => setRange(key)}
                        className={`px-3.5 py-1.5 rounded-lg text-[13px] font-semibold transition-all cursor-pointer ${range === key ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'bg-black/5 text-[var(--color-ink-3)] hover:bg-black/10'}`}
                    >
                        {label}
                    </button>
                ))}
                <span className="text-xs text-[var(--color-ink-3)] ml-auto tabular-nums">{done}/{inRange.length} concluídas</span>
            </div>

            {overdue.length > 0 && (
                <div className="glass-panel p-4 flex flex-col gap-1 border-l-4 border-rose-400">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-rose-500 mb-1">Atrasadas</p>
                    {overdue.map(t => {
                        const chip = projectChip(t);
                        return (
                            <TaskRow key={t.id} task={t} onToggle={() => onToggle(t)} showProject={chip}
                                onEdit={chip ? () => onOpenProject(t.project_id) : undefined} />
                        );
                    })}
                </div>
            )}

            {inRange.length === 0 ? (
                <div className="glass-panel p-10 flex flex-col items-center gap-2 text-center">
                    <CircleCheck size={32} className="text-emerald-400" />
                    <p className="text-sm text-[var(--color-ink-3)]">Nenhuma tarefa com prazo {range === 'dia' ? 'para hoje' : range === 'semana' ? 'nesta semana' : 'neste mês'}.</p>
                </div>
            ) : (
                <div className="glass-panel p-4 flex flex-col gap-1">
                    {Object.entries(byDate).map(([date, rows]) => (
                        <div key={date} className="flex flex-col gap-0.5">
                            <p className={`text-[11px] font-bold uppercase tracking-wider mt-2 mb-0.5 ${date === today ? 'text-[var(--color-primary)]' : 'text-[var(--color-ink-3)]'}`}>
                                {dateHeader(date)}
                            </p>
                            {rows.map(t => {
                                const chip = projectChip(t);
                                return (
                                    <TaskRow key={t.id} task={t} onToggle={() => onToggle(t)} showProject={chip}
                                        onEdit={chip ? () => onOpenProject(t.project_id) : undefined} />
                                );
                            })}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// -------------------------------------------------------------
// Calendário mensal
// -------------------------------------------------------------

function CalendarView({ projects, tasks, onToggle }: {
    projects: Project[];
    tasks: ProjectTask[];
    onToggle: (t: ProjectTask) => void;
}) {
    const [mode, setMode] = useState<'month' | 'week'>('month');
    const [anchor, setAnchor] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); });
    const today = todayISO();

    const cells = useMemo(() => {
        if (mode === 'week') {
            const start = weekStart(anchor);
            return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; });
        }
        const gridStart = weekStart(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
        const out: Date[] = [];
        const d = new Date(gridStart);
        // 6 semanas cobrem qualquer mês
        for (let i = 0; i < 42; i++) { out.push(new Date(d)); d.setDate(d.getDate() + 1); }
        return out;
    }, [mode, anchor]);

    const real = tasks.filter(t => !t.is_template && t.due_date);
    const byDate = real.reduce<Record<string, ProjectTask[]>>((acc, t) => {
        (acc[t.due_date!] ??= []).push(t);
        return acc;
    }, {});

    // Ocorrências recorrentes previstas (períodos ainda não gerados) do mês visível.
    const virtuals = useMemo(
        () => upcomingOccurrences(projects, tasks, isoDate(cells[0]), isoDate(cells[cells.length - 1])),
        [projects, tasks, cells]
    );
    const virtualByDate = virtuals.reduce<Record<string, VirtualOccurrence[]>>((acc, v) => {
        (acc[v.due_date] ??= []).push(v);
        return acc;
    }, {});

    // Navegação: semana anda de 7 em 7 dias; mês, de mês em mês.
    const shift = (dir: 1 | -1) => setAnchor(a => mode === 'week'
        ? new Date(a.getFullYear(), a.getMonth(), a.getDate() + dir * 7)
        : new Date(a.getFullYear(), a.getMonth() + dir, 1));

    const label = mode === 'week'
        ? periodLabel('weekly', anchor)
        : anchor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    const maxChips = mode === 'week' ? 10 : 3;

    return (
        <div className="glass-panel p-4 sm:p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 glass-inset rounded-xl p-1">
                    {([['month', 'Mês'], ['week', 'Semana']] as const).map(([key, lbl]) => (
                        <button
                            key={key}
                            onClick={() => setMode(key)}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${mode === key ? 'bg-white shadow-sm text-[var(--color-primary)]' : 'text-[var(--color-ink-3)] hover:text-[var(--color-ink)]'}`}
                        >
                            {lbl}
                        </button>
                    ))}
                </div>
                <button onClick={() => shift(-1)} className="icon-action ml-auto" aria-label={mode === 'week' ? 'Semana anterior' : 'Mês anterior'}><ChevronLeft size={18} /></button>
                <p className="font-bold text-[var(--color-ink)] capitalize text-center min-w-[180px] text-sm sm:text-base">{label}</p>
                <button onClick={() => shift(1)} className="icon-action" aria-label={mode === 'week' ? 'Próxima semana' : 'Próximo mês'}><ChevronRight size={18} /></button>
                <button
                    onClick={() => { const n = new Date(); setAnchor(new Date(n.getFullYear(), n.getMonth(), n.getDate())); }}
                    className="btn-ghost !px-3 !py-1 text-xs"
                >
                    Hoje
                </button>
            </div>
            <div className="overflow-x-auto">
                <div className="min-w-[640px]">
                    <div className="grid grid-cols-7 gap-px mb-1">
                        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(d => (
                            <p key={d} className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)] text-center py-1">{d}</p>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-px bg-black/5 rounded-xl overflow-hidden">
                        {cells.map(d => {
                            const iso = isoDate(d);
                            const inMonth = mode === 'week' || d.getMonth() === anchor.getMonth();
                            const dayTasks = byDate[iso] ?? [];
                            const dayVirtual = virtualByDate[iso] ?? [];
                            const total = dayTasks.length + dayVirtual.length;
                            return (
                                <div key={iso} className={`${mode === 'week' ? 'min-h-[240px]' : 'min-h-[92px]'} p-1.5 flex flex-col gap-1 ${inMonth ? 'bg-white/80' : 'bg-white/40'}`}>
                                    <span className={`text-[11px] font-semibold tabular-nums self-end w-5 h-5 flex items-center justify-center rounded-full ${iso === today ? 'bg-[var(--color-primary)] text-white' : inMonth ? 'text-[var(--color-ink-2)]' : 'text-[var(--color-ink-3)]/50'}`}>
                                        {d.getDate()}
                                    </span>
                                    {dayTasks.slice(0, maxChips).map(t => {
                                        const p = projects.find(x => x.id === t.project_id);
                                        return (
                                            <button
                                                key={t.id}
                                                onClick={() => onToggle(t)}
                                                title={`${t.title}${p ? ` — ${p.name}` : ''} (clique para ${t.completed ? 'reabrir' : 'concluir'})`}
                                                className={`text-left text-[10px] leading-tight px-1.5 py-0.5 rounded-md truncate cursor-pointer transition-opacity hover:opacity-80 ${t.completed ? 'line-through opacity-50' : ''}`}
                                                style={{ backgroundColor: `${p?.color ?? '#C13584'}22`, color: p?.color ?? '#C13584' }}
                                            >
                                                {t.title}
                                            </button>
                                        );
                                    })}
                                    {dayVirtual.slice(0, Math.max(0, maxChips - dayTasks.length)).map(v => {
                                        const p = projects.find(x => x.id === v.project_id);
                                        return (
                                            <span
                                                key={v.id}
                                                title={`${v.title}${p ? ` — ${p.name}` : ''} (recorrente prevista — será gerada automaticamente no período)`}
                                                className="text-left text-[10px] leading-tight px-1.5 py-0.5 rounded-md truncate border border-dashed opacity-70"
                                                style={{ borderColor: `${p?.color ?? '#C13584'}66`, color: p?.color ?? '#C13584' }}
                                            >
                                                {v.title}
                                            </span>
                                        );
                                    })}
                                    {total > maxChips && (
                                        <span className="text-[10px] text-[var(--color-ink-3)] px-1">+{total - maxChips}</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

// -------------------------------------------------------------
// Linha do tempo (Gantt — frappe-gantt)
// -------------------------------------------------------------

function GanttView({ projects, tasks, refetch }: {
    projects: Project[];
    tasks: ProjectTask[];
    refetch: () => void;
}) {
    const [scope, setScope] = useState<'projects' | 'tasks'>('projects');
    const [projectFilter, setProjectFilter] = useState<string>('all');
    const [viewMode, setViewMode] = useState<'Day' | 'Week' | 'Month'>('Week');

    // Ocorrências recorrentes previstas nos próximos 90 dias (barras "fantasma").
    const virtuals = useMemo<VirtualOccurrence[]>(() => {
        if (scope !== 'tasks') return [];
        const horizon = new Date();
        horizon.setDate(horizon.getDate() + 90);
        return upcomingOccurrences(projects, tasks, todayISO(), isoDate(horizon))
            .filter(v => projectFilter === 'all' || v.project_id === projectFilter);
    }, [scope, projectFilter, projects, tasks]);

    const bars = useMemo<GanttTask[]>(() => {
        if (scope === 'projects') {
            return projects
                .filter(p => p.start_date && p.status !== 'completed')
                .map(p => {
                    const scoped = tasks.filter(t => t.project_id === p.id && !t.is_template);
                    const done = scoped.filter(t => t.completed).length;
                    // Sem data fim: barra até o maior prazo de tarefa, ou 30 dias.
                    const fallbackEnd = scoped.reduce<string | null>((max, t) => (t.due_date && (!max || t.due_date > max) ? t.due_date : max), null);
                    const plus30 = new Date(); plus30.setDate(plus30.getDate() + 30);
                    return {
                        id: p.id,
                        name: p.name,
                        start: p.start_date!,
                        end: p.end_date || fallbackEnd || isoDate(plus30),
                        progress: scoped.length ? Math.round((done / scoped.length) * 100) : 0,
                        color: p.color,
                    };
                });
        }
        const real = tasks
            .filter(t => !t.is_template && (t.start_date || t.due_date) && (projectFilter === 'all' || t.project_id === projectFilter))
            .map(t => {
                const p = projects.find(x => x.id === t.project_id);
                return {
                    id: t.id,
                    name: t.title,
                    start: t.start_date || t.due_date!,
                    end: t.due_date || t.start_date!,
                    progress: t.completed ? 100 : 0,
                    color: p?.color,
                };
            });
        const ghosts = virtuals.map(v => {
            const p = projects.find(x => x.id === v.project_id);
            return {
                id: v.id,
                name: `${v.title} (prevista)`,
                start: v.start_date || v.due_date,
                end: v.due_date,
                progress: 0,
                color: p?.color,
                custom_class: 'gantt-virtual',
            };
        });
        return [...real, ...ghosts];
    }, [scope, projectFilter, projects, tasks, virtuals]);

    // Arrastar barra no gráfico persiste as novas datas.
    const onDateChange = useCallback(async (bar: GanttTask, start: Date, end: Date) => {
        // Barra prevista (recorrência futura) não existe no banco: só re-renderiza.
        if (bar.id.startsWith('virtual-')) { refetch(); return; }
        if (scope === 'projects') {
            await supabase.from('projects').update({ start_date: isoDate(start), end_date: isoDate(end) }).eq('id', bar.id);
        } else {
            await supabase.from('project_tasks').update({ start_date: isoDate(start), due_date: isoDate(end) }).eq('id', bar.id);
        }
        refetch();
    }, [scope, refetch]);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 glass-inset rounded-xl p-1">
                    {([['projects', 'Projetos'], ['tasks', 'Tarefas']] as const).map(([key, label]) => (
                        <button key={key} onClick={() => setScope(key)}
                            className={`px-3.5 py-1.5 rounded-lg text-[13px] font-semibold transition-all cursor-pointer ${scope === key ? 'bg-white shadow-sm text-[var(--color-primary)]' : 'text-[var(--color-ink-3)] hover:text-[var(--color-ink)]'}`}>
                            {label}
                        </button>
                    ))}
                </div>
                {scope === 'tasks' && (
                    <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} className="field-input !w-auto !py-1.5 text-sm">
                        <option value="all">Todos os projetos</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                )}
                <div className="flex items-center gap-1 ml-auto">
                    {(['Day', 'Week', 'Month'] as const).map(m => (
                        <button key={m} onClick={() => setViewMode(m)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${viewMode === m ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'bg-black/5 text-[var(--color-ink-3)] hover:bg-black/10'}`}>
                            {m === 'Day' ? 'Dia' : m === 'Week' ? 'Semana' : 'Mês'}
                        </button>
                    ))}
                </div>
            </div>

            {bars.length === 0 ? (
                <div className="glass-panel p-10 flex flex-col items-center gap-2 text-center">
                    <CalendarRange size={32} className="text-[var(--color-primary)]/40" />
                    <p className="text-sm text-[var(--color-ink-3)]">
                        {scope === 'projects'
                            ? 'Nenhum projeto ativo com data de início definida.'
                            : 'Nenhuma tarefa com data neste filtro.'}
                    </p>
                </div>
            ) : (
                <div className="glass-panel p-3 overflow-hidden">
                    {/* Barras "fantasma" (recorrências previstas) ficam translúcidas */}
                    <style>{'.gantt .gantt-virtual{opacity:.45}'}</style>
                    <p className="text-[11px] text-[var(--color-ink-3)] italic px-2 pb-2">
                        Arraste as barras para ajustar as datas{scope === 'tasks' && virtuals.length > 0 ? ' · barras translúcidas são recorrências previstas (geradas automaticamente no período)' : ''}
                    </p>
                    <GanttChart bars={bars} viewMode={viewMode} onDateChange={onDateChange} />
                </div>
            )}
        </div>
    );
}

function GanttChart({ bars, viewMode, onDateChange }: {
    bars: GanttTask[];
    viewMode: string;
    onDateChange: (bar: GanttTask, start: Date, end: Date) => void;
}) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.innerHTML = '';
        new Gantt(el, bars, {
            view_mode: viewMode,
            language: 'pt-BR',
            readonly_progress: true,
            popup_on: 'click',
            container_height: Math.max(220, bars.length * 44 + 100),
            on_date_change: onDateChange,
        });
        return () => { el.innerHTML = ''; };
    }, [bars, viewMode, onDateChange]);

    return <div ref={ref} className="rounded-xl overflow-hidden bg-white" />;
}

// -------------------------------------------------------------
// Modal: criar/editar projeto
// -------------------------------------------------------------

function ProjectFormModal({ clients, project, onClose, onSaved }: {
    clients: Client[];
    project: Project | null;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [name, setName] = useState(project?.name ?? '');
    const [clientId, setClientId] = useState(project?.client_id ?? '');
    const [type, setType] = useState<ProjectType>(project?.type ?? 'oneoff');
    const [frequency, setFrequency] = useState<ProjectFrequency>(project?.frequency ?? 'monthly');
    const [startDate, setStartDate] = useState(project?.start_date ?? todayISO());
    const [endDate, setEndDate] = useState(project?.end_date ?? '');
    const [color, setColor] = useState(project?.color ?? PROJECT_COLORS[0]);
    const [notes, setNotes] = useState(project?.notes ?? '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const save = async () => {
        if (!name.trim()) { setError('Informe o nome do projeto.'); return; }
        setSaving(true);
        setError(null);
        const payload = {
            name: name.trim(),
            client_id: clientId || null,
            type,
            frequency: type === 'recurring' ? frequency : null,
            start_date: startDate || null,
            end_date: type === 'oneoff' && endDate ? endDate : null,
            color,
            notes: notes.trim() || null,
        };
        const { error: err } = project
            ? await supabase.from('projects').update(payload).eq('id', project.id)
            : await supabase.from('projects').insert(payload);
        if (err) { setError(err.message); setSaving(false); return; }
        onSaved();
    };

    return (
        <Modal isOpen onClose={onClose} title={project ? 'Editar Projeto' : 'Novo Projeto'}>
            <div className="flex flex-col gap-4">
                <div>
                    <label className="field-label">Nome do projeto</label>
                    <input value={name} onChange={e => setName(e.target.value)} className="field-input" placeholder="Ex.: Site Institucional — Empresa X" autoFocus />
                </div>
                <div>
                    <label className="field-label">Cliente (opcional)</label>
                    <select value={clientId} onChange={e => setClientId(e.target.value)} className="field-input">
                        <option value="">Sem cliente</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.company_name || c.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="field-label">Tipo</label>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => setType('oneoff')}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${type === 'oneoff' ? 'border-[var(--color-primary)] bg-[var(--color-primary-50)] text-[var(--color-primary)]' : 'border-black/10 text-[var(--color-ink-3)] hover:border-black/20'}`}>
                            <Target size={16} /> Com conclusão
                        </button>
                        <button onClick={() => setType('recurring')}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${type === 'recurring' ? 'border-[var(--color-primary)] bg-[var(--color-primary-50)] text-[var(--color-primary)]' : 'border-black/10 text-[var(--color-ink-3)] hover:border-black/20'}`}>
                            <Repeat size={16} /> Recorrente
                        </button>
                    </div>
                </div>
                {type === 'recurring' && (
                    <div>
                        <label className="field-label">Frequência</label>
                        <select value={frequency} onChange={e => setFrequency(e.target.value as ProjectFrequency)} className="field-input">
                            <option value="weekly">Semanal</option>
                            <option value="monthly">Mensal</option>
                        </select>
                    </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="field-label">Início</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="field-input" />
                    </div>
                    {type === 'oneoff' && (
                        <div>
                            <label className="field-label">Previsão de fim</label>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="field-input" />
                        </div>
                    )}
                </div>
                <div>
                    <label className="field-label">Cor</label>
                    <div className="flex items-center gap-2 flex-wrap">
                        {PROJECT_COLORS.map(c => (
                            <button key={c} onClick={() => setColor(c)} aria-label={`Cor ${c}`}
                                className={`w-7 h-7 rounded-full transition-transform cursor-pointer ${color === c ? 'ring-2 ring-offset-2 ring-[var(--color-ink-3)] scale-110' : 'hover:scale-110'}`}
                                style={{ backgroundColor: c }} />
                        ))}
                    </div>
                </div>
                <div>
                    <label className="field-label">Observações (opcional)</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} className="field-input min-h-[70px]" />
                </div>
                {error && <p className="text-sm text-rose-500 flex items-center gap-1.5"><AlertCircle size={15} /> {error}</p>}
                <div className="flex items-center justify-end gap-2 pt-1">
                    <button onClick={onClose} className="btn-ghost">Cancelar</button>
                    <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-50">
                        {saving && <Loader2 size={15} className="animate-spin" />} {project ? 'Salvar' : 'Criar Projeto'}
                    </button>
                </div>
            </div>
        </Modal>
    );
}

// -------------------------------------------------------------
// Modal: editar grupo (nome, datas e dependência do grupo anterior)
// -------------------------------------------------------------

function GroupFormModal({ group, onClose, onSaved }: {
    group: ProjectTaskGroup;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [name, setName] = useState(group.name);
    const [depends, setDepends] = useState(group.depends_on_previous);
    const [startDate, setStartDate] = useState(group.start_date ?? '');
    const [endDate, setEndDate] = useState(group.end_date ?? '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const save = async () => {
        if (!name.trim()) { setError('Informe o nome do grupo.'); return; }
        setSaving(true);
        setError(null);
        const { error: err } = await supabase.from('project_task_groups').update({
            name: name.trim(),
            depends_on_previous: depends,
            start_date: startDate || null,
            end_date: endDate || null,
        }).eq('id', group.id);
        if (err) { setError(err.message); setSaving(false); return; }
        onSaved();
    };

    return (
        <Modal isOpen onClose={onClose} title="Editar Grupo">
            <div className="flex flex-col gap-4">
                <div>
                    <label className="field-label">Nome</label>
                    <input value={name} onChange={e => setName(e.target.value)} className="field-input" autoFocus />
                </div>
                <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={depends}
                        onChange={e => setDepends(e.target.checked)}
                        className="mt-0.5 accent-[var(--color-primary)]"
                    />
                    <span className="text-sm text-[var(--color-ink-2)]">
                        Depende do grupo anterior
                        <span className="block text-[11px] text-[var(--color-ink-3)]">
                            Começa no dia útil seguinte ao fim do grupo anterior. Desmarque para usar a data própria abaixo.
                        </span>
                    </span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="field-label">Início próprio</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="field-input" disabled={depends} />
                        {depends && <p className="text-[11px] text-[var(--color-ink-3)] mt-1">Calculado pelo grupo anterior</p>}
                    </div>
                    <div>
                        <label className="field-label">Fim (opcional)</label>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="field-input" />
                    </div>
                </div>
                {error && <p className="text-sm text-rose-500 flex items-center gap-1.5"><AlertCircle size={15} /> {error}</p>}
                <div className="flex items-center justify-end gap-2 pt-1">
                    <button onClick={onClose} className="btn-ghost">Cancelar</button>
                    <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-50">
                        {saving && <Loader2 size={15} className="animate-spin" />} Salvar
                    </button>
                </div>
            </div>
        </Modal>
    );
}

// -------------------------------------------------------------
// Modal: criar/editar tarefa (normal ou tarefa-modelo)
// -------------------------------------------------------------

function TaskFormModal({ project, groups, task, isTemplate, initialGroupId, suggestedStart, suggestedGroupStart, onClose, onSaved }: {
    project: Project;
    groups: ProjectTaskGroup[];
    task: ProjectTask | null;
    isTemplate: boolean;
    initialGroupId?: string | null;
    suggestedStart?: string | null;
    suggestedGroupStart?: string | null;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [title, setTitle] = useState(task?.title ?? '');
    const [description, setDescription] = useState(task?.description ?? '');
    const [groupId, setGroupId] = useState(task?.group_id ?? initialGroupId ?? '');
    const [dependsPrev, setDependsPrev] = useState(task?.depends_on_previous ?? true);
    const [startDate, setStartDate] = useState(task?.start_date ?? suggestedStart ?? '');
    const [dueDate, setDueDate] = useState(task?.due_date ?? '');
    const [dueRule, setDueRule] = useState<string>(task?.due_rule != null ? String(task.due_rule) : '');
    // Duração em dias úteis (8h) ou horas; guardada sempre em horas no banco.
    const [durationMode, setDurationMode] = useState<'days' | 'hours'>(
        task?.duration_hours != null && task.duration_hours % 8 !== 0 ? 'hours' : 'days'
    );
    const [durationValue, setDurationValue] = useState<string>(() => {
        if (task?.duration_hours == null) return '';
        return task.duration_hours % 8 === 0 ? String(task.duration_hours / 8) : String(task.duration_hours);
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const weekly = project.frequency === 'weekly';

    const durationHours = (() => {
        const n = Number(durationValue);
        if (!durationValue || Number.isNaN(n) || n <= 0) return null;
        return durationMode === 'days' ? Math.round(n * 8) : Math.round(n);
    })();

    // Prazo recalculado quando início ou duração mudam (8h úteis/dia, seg-sex).
    // Editar só o prazo manualmente continua possível.
    useEffect(() => {
        if (isTemplate || !startDate || durationHours == null) return;
        setDueDate(workDueDate(startDate, durationHours));
    }, [isTemplate, startDate, durationHours]);

    const save = async () => {
        if (!title.trim()) { setError('Informe o título da tarefa.'); return; }
        if (!isTemplate && project.start_date && startDate && startDate < project.start_date) {
            setError(`A tarefa não pode começar antes do início do projeto (${fmtDate(project.start_date)}).`);
            return;
        }
        setSaving(true);
        setError(null);
        const payload = {
            project_id: project.id,
            group_id: groupId || null,
            title: title.trim(),
            description: description.trim() || null,
            start_date: isTemplate ? null : (startDate || null),
            due_date: isTemplate ? null : (dueDate || null),
            duration_hours: durationHours,
            depends_on_previous: isTemplate ? true : dependsPrev,
            is_template: isTemplate,
            due_rule: isTemplate && dueRule !== '' ? Number(dueRule) : null,
        };
        const { error: err } = task
            ? await supabase.from('project_tasks').update(payload).eq('id', task.id)
            : await supabase.from('project_tasks').insert(payload);
        if (err) { setError(err.message); setSaving(false); return; }
        onSaved();
    };

    return (
        <Modal isOpen onClose={onClose} title={task ? (isTemplate ? 'Editar Tarefa-modelo' : 'Editar Tarefa') : (isTemplate ? 'Nova Tarefa-modelo' : 'Nova Tarefa')}>
            <div className="flex flex-col gap-4">
                <div>
                    <label className="field-label">Título</label>
                    <input value={title} onChange={e => setTitle(e.target.value)} className="field-input" placeholder="Ex.: Criar 4 posts para o feed" autoFocus />
                </div>
                <div>
                    <label className="field-label">Descrição (opcional)</label>
                    <textarea value={description} onChange={e => setDescription(e.target.value)} className="field-input min-h-[60px]" />
                </div>
                {groups.length > 0 && (
                    <div>
                        <label className="field-label">Grupo</label>
                        <select value={groupId} onChange={e => setGroupId(e.target.value)} className="field-input">
                            <option value="">Sem grupo</option>
                            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                    </div>
                )}
                {isTemplate ? (
                    <>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="field-label">Dia de execução</label>
                                <select value={dueRule} onChange={e => setDueRule(e.target.value)} className="field-input">
                                    <option value="">{weekly ? 'Sem dia fixo (fim da semana)' : 'Sem dia fixo (fim do mês)'}</option>
                                    {weekly
                                        ? WEEKDAY_LABELS.map((d, i) => <option key={i + 1} value={i + 1}>{d}</option>)
                                        : Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>Dia {i + 1}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="field-label">Duração (opcional)</label>
                                <div className="flex gap-1.5">
                                    <input
                                        type="number"
                                        min={1}
                                        value={durationValue}
                                        onChange={e => setDurationValue(e.target.value)}
                                        className="field-input !w-20"
                                        placeholder="—"
                                    />
                                    <select value={durationMode} onChange={e => setDurationMode(e.target.value as 'days' | 'hours')} className="field-input flex-1">
                                        <option value="days">dias úteis</option>
                                        <option value="hours">horas</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <p className="text-[11px] text-[var(--color-ink-3)] -mt-1.5">
                            Gerada automaticamente a cada {weekly ? 'semana' : 'mês'}: começa no dia de execução e o prazo é calculado pela duração (8h úteis por dia, seg–sex). Alterações no modelo valem a partir do próximo período.
                        </p>
                    </>
                ) : (
                    <>
                        <label className="flex items-start gap-2.5 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={dependsPrev}
                                onChange={e => {
                                    setDependsPrev(e.target.checked);
                                    // Tarefa nova: troca a sugestão de início conforme a dependência.
                                    if (!task) {
                                        const next = e.target.checked ? suggestedStart : suggestedGroupStart;
                                        if (next) setStartDate(next);
                                    }
                                }}
                                className="mt-0.5 accent-[var(--color-primary)]"
                            />
                            <span className="text-sm text-[var(--color-ink-2)]">
                                Depende da tarefa anterior
                                <span className="block text-[11px] text-[var(--color-ink-3)]">
                                    Começa no dia útil seguinte ao fim da tarefa anterior do grupo. Desmarque para usar datas independentes.
                                </span>
                            </span>
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="field-label">Início</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    min={project.start_date ?? undefined}
                                    onChange={e => setStartDate(e.target.value)}
                                    className="field-input"
                                />
                                {project.start_date && (
                                    <p className="text-[11px] text-[var(--color-ink-3)] mt-1">Projeto inicia em {fmtDate(project.start_date)}</p>
                                )}
                            </div>
                            <div>
                                <label className="field-label">Duração (opcional)</label>
                                <div className="flex gap-1.5">
                                    <input
                                        type="number"
                                        min={1}
                                        value={durationValue}
                                        onChange={e => setDurationValue(e.target.value)}
                                        className="field-input !w-20"
                                        placeholder="—"
                                    />
                                    <select value={durationMode} onChange={e => setDurationMode(e.target.value as 'days' | 'hours')} className="field-input flex-1">
                                        <option value="days">dias úteis</option>
                                        <option value="hours">horas</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="field-label">Prazo</label>
                            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="field-input" />
                            <p className="text-[11px] text-[var(--color-ink-3)] mt-1.5">
                                Calculado pela duração: 8h úteis por dia, segunda a sexta. Você pode ajustar manualmente (inclusive para fim de semana).
                            </p>
                        </div>
                    </>
                )}
                {error && <p className="text-sm text-rose-500 flex items-center gap-1.5"><AlertCircle size={15} /> {error}</p>}
                <div className="flex items-center justify-end gap-2 pt-1">
                    <button onClick={onClose} className="btn-ghost">Cancelar</button>
                    <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-50">
                        {saving && <Loader2 size={15} className="animate-spin" />} Salvar
                    </button>
                </div>
            </div>
        </Modal>
    );
}
