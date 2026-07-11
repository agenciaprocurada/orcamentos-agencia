import { supabase } from './supabase';
import type { Project, ProjectTask, ProjectFrequency } from '../types/database';

// Datas sempre no fuso local (toISOString converte para UTC e vira o dia
// seguinte à noite no Brasil).
export function isoDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function todayISO(): string {
    return isoDate(new Date());
}

// Semana ISO 8601 (semana começa na segunda; semana 1 = a que contém a 1ª quinta).
export function isoWeek(d: Date): { year: number; week: number } {
    const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = (date.getDay() + 6) % 7; // seg=0 .. dom=6
    date.setDate(date.getDate() - day + 3); // quinta desta semana
    const firstThursday = new Date(date.getFullYear(), 0, 4);
    const fDay = (firstThursday.getDay() + 6) % 7;
    firstThursday.setDate(firstThursday.getDate() - fDay + 3);
    const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86400000));
    return { year: date.getFullYear(), week };
}

// Segunda-feira da semana da data informada.
export function weekStart(d: Date): Date {
    const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    return date;
}

// Chave do período corrente: 'YYYY-MM' (mensal) ou 'YYYY-Www' (semanal).
export function periodKey(frequency: ProjectFrequency, d: Date): string {
    if (frequency === 'monthly') {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    const { year, week } = isoWeek(d);
    return `${year}-W${String(week).padStart(2, '0')}`;
}

// Rótulo amigável do período: "julho de 2026" / "Semana 28 · 06/07 – 12/07".
export function periodLabel(frequency: ProjectFrequency, d: Date): string {
    if (frequency === 'monthly') {
        return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    }
    const { week } = isoWeek(d);
    const start = weekStart(d);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const fmt = (x: Date) => x.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    return `Semana ${week} · ${fmt(start)} – ${fmt(end)}`;
}

// Prazo da instância gerada. due_rule: dia do mês (mensal) ou 1=seg..7=dom
// (semanal); sem regra, o prazo é o fim do período.
export function periodDueDate(frequency: ProjectFrequency, d: Date, dueRule: number | null): string {
    if (frequency === 'monthly') {
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        const day = Math.min(Math.max(dueRule ?? lastDay, 1), lastDay);
        return isoDate(new Date(d.getFullYear(), d.getMonth(), day));
    }
    const start = weekStart(d);
    const offset = Math.min(Math.max(dueRule ?? 7, 1), 7) - 1;
    const due = new Date(start);
    due.setDate(due.getDate() + offset);
    return isoDate(due);
}

// --- Dias úteis (jornada de 8h, segunda a sexta) ---

function parseISO(iso: string): Date {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
}

export function isBusinessDay(d: Date): boolean {
    return d.getDay() !== 0 && d.getDay() !== 6;
}

// Se a data cair no fim de semana, empurra para a segunda seguinte.
export function nextBusinessDayISO(iso: string): string {
    const d = parseISO(iso);
    while (!isBusinessDay(d)) d.setDate(d.getDate() + 1);
    return isoDate(d);
}

// Prazo calculado: início + horas de trabalho, contando 8h por dia útil.
// O dia de início conta como o 1º dia trabalhado (mesmo se for fim de semana,
// caso o usuário tenha datado manualmente); os dias seguintes pulam sáb/dom.
export function workDueDate(startIso: string, hours: number): string {
    const days = Math.max(1, Math.ceil(hours / 8));
    const d = parseISO(startIso);
    let remaining = days - 1;
    while (remaining > 0) {
        d.setDate(d.getDate() + 1);
        if (isBusinessDay(d)) remaining -= 1;
    }
    return isoDate(d);
}

// Início sugerido para a próxima tarefa: dia útil seguinte ao prazo informado.
export function nextWorkStart(afterIso: string): string {
    const d = parseISO(afterIso);
    d.setDate(d.getDate() + 1);
    while (!isBusinessDay(d)) d.setDate(d.getDate() + 1);
    return isoDate(d);
}

// Datas de uma ocorrência gerada a partir do modelo: o due_rule define o DIA
// DE EXECUÇÃO (início) e a duração define o prazo (8h úteis/dia, seg-sex).
// Sem dia definido, mantém o comportamento antigo: prazo no fim do período.
export function occurrenceDates(frequency: ProjectFrequency, ref: Date, dueRule: number | null, durationHours: number | null): { start: string | null; due: string } {
    if (dueRule == null) {
        return { start: null, due: periodDueDate(frequency, ref, null) };
    }
    const start = periodDueDate(frequency, ref, dueRule);
    return { start, due: workDueDate(start, durationHours ?? 8) };
}

// Gera as instâncias do período corrente para todo projeto recorrente ativo
// que ainda não as tenha. Retorna true se inseriu algo (o chamador dá refetch).
// O upsert com ignoreDuplicates usa o índice único (template_id, period):
// duas abas abertas ao mesmo tempo não duplicam tarefas.
export async function ensureRecurringInstances(projects: Project[], tasks: ProjectTask[]): Promise<boolean> {
    const now = new Date();
    const inserts: Record<string, unknown>[] = [];

    for (const project of projects) {
        if (project.type !== 'recurring' || project.status !== 'active' || !project.frequency) continue;
        const period = periodKey(project.frequency, now);
        const templates = tasks.filter(t => t.project_id === project.id && t.is_template);
        for (const tpl of templates) {
            const exists = tasks.some(t => t.template_id === tpl.id && t.period === period);
            if (exists) continue;
            const { start, due } = occurrenceDates(project.frequency, now, tpl.due_rule, tpl.duration_hours);
            inserts.push({
                project_id: project.id,
                group_id: tpl.group_id,
                title: tpl.title,
                description: tpl.description,
                start_date: start,
                due_date: due,
                duration_hours: tpl.duration_hours,
                sort_order: tpl.sort_order,
                template_id: tpl.id,
                period,
            });
        }
    }

    if (inserts.length === 0) return false;
    const { error } = await supabase
        .from('project_tasks')
        .upsert(inserts, { onConflict: 'template_id,period', ignoreDuplicates: true });
    if (error) throw error;
    return true;
}

// --- Projeção de ocorrências futuras (calendário / linha do tempo) ---

// Ocorrência prevista de uma tarefa-modelo em período ainda não gerado.
// Só existe em memória, para exibição; a tarefa real é criada quando o
// período chega (ensureRecurringInstances).
export type VirtualOccurrence = {
    id: string; // 'virtual-<template>-<period>' — nunca colide com uuid real
    project_id: string;
    title: string;
    start_date: string | null;
    due_date: string;
    period: string;
    virtual: true;
};

// Ocorrências previstas dentro do intervalo [fromIso, toIso], pulando períodos
// que já têm instância real gerada (para não duplicar na tela).
export function upcomingOccurrences(projects: Project[], tasks: ProjectTask[], fromIso: string, toIso: string): VirtualOccurrence[] {
    const out: VirtualOccurrence[] = [];
    const from = parseISO(fromIso);
    const to = parseISO(toIso);

    for (const p of projects) {
        if (p.type !== 'recurring' || p.status !== 'active' || !p.frequency) continue;
        const templates = tasks.filter(t => t.project_id === p.id && t.is_template);
        if (templates.length === 0) continue;

        // Uma data de referência por período que toca o intervalo.
        const refs: Date[] = [];
        if (p.frequency === 'monthly') {
            const d = new Date(from.getFullYear(), from.getMonth(), 1);
            while (d <= to) { refs.push(new Date(d)); d.setMonth(d.getMonth() + 1); }
        } else {
            const d = weekStart(from);
            while (d <= to) { refs.push(new Date(d)); d.setDate(d.getDate() + 7); }
        }

        for (const ref of refs) {
            const periodEnd = periodDueDate(p.frequency, ref, null);
            if (p.start_date && periodEnd < p.start_date) continue; // antes do projeto começar
            if (p.end_date && isoDate(ref) > p.end_date) continue; // projeto já encerrado
            const period = periodKey(p.frequency, ref);
            for (const tpl of templates) {
                if (tasks.some(t => t.template_id === tpl.id && t.period === period)) continue;
                const { start, due } = occurrenceDates(p.frequency, ref, tpl.due_rule, tpl.duration_hours);
                if (due < fromIso || (start ?? due) > toIso) continue;
                out.push({
                    id: `virtual-${tpl.id}-${period}`,
                    project_id: p.id,
                    title: tpl.title,
                    start_date: start,
                    due_date: due,
                    period,
                    virtual: true,
                });
            }
        }
    }
    return out;
}
