import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Lead, LeadStatus } from '../types/database';
import { PushToggle } from './PushToggle';
import {
  Phone,
  MessageCircle,
  Trash2,
  Clock,
  Inbox,
  X,
  StickyNote,
  Loader2,
} from 'lucide-react';

// Colunas do funil (ordem = fluxo do lead da esquerda para a direita).
const COLUMNS: { key: LeadStatus; label: string; accent: string; dot: string }[] = [
  { key: 'novo', label: 'Novos Leads', accent: 'text-blue-600', dot: 'bg-blue-500' },
  { key: 'respondido', label: 'Respondido', accent: 'text-amber-600', dot: 'bg-amber-500' },
  { key: 'proposta', label: 'Enviado proposta', accent: 'text-violet-600', dot: 'bg-violet-500' },
  { key: 'concluido', label: 'Concluído', accent: 'text-emerald-600', dot: 'bg-emerald-500' },
];

// Monta o link do WhatsApp a partir do telefone (só dígitos, DDI 55 default).
function whatsappHref(phone: string | null): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length <= 11) digits = '55' + digits; // sem DDI -> assume Brasil
  return `https://wa.me/${digits}`;
}

// "há 2 h", "há 3 dias"...
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d} ${d === 1 ? 'dia' : 'dias'}`;
  const mo = Math.floor(d / 30);
  return `há ${mo} ${mo === 1 ? 'mês' : 'meses'}`;
}

export function LeadsView({ leads, refetch }: { leads: Lead[]; refetch: () => void }) {
  // Espelho local para movimentação otimista (o board não pisca a cada drag).
  const [items, setItems] = useState<Lead[]>(leads);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<LeadStatus | null>(null);
  const [detail, setDetail] = useState<Lead | null>(null);

  useEffect(() => { setItems(leads); }, [leads]);

  const moveLead = async (id: string, status: LeadStatus) => {
    const current = items.find(l => l.id === id);
    if (!current || current.status === status) return;
    setItems(prev => prev.map(l => (l.id === id ? { ...l, status } : l)));
    await supabase
      .from('leads')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
    refetch();
  };

  const handleDrop = (e: React.DragEvent, status: LeadStatus) => {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData('text/plain') || dragId;
    setDragId(null);
    if (id) moveLead(id, status);
  };

  const totalNovos = items.filter(l => l.status === 'novo').length;

  return (
    <div className="flex flex-col gap-5 h-full">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-[var(--color-ink-2)]">
          <Inbox size={18} className="text-[var(--color-primary)]" />
          <span className="text-sm font-medium">
            {items.length} {items.length === 1 ? 'lead' : 'leads'} no total
          </span>
        </div>
        {totalNovos > 0 && (
          <span className="badge badge-brand">
            <span className="badge-dot" /> {totalNovos} novo{totalNovos > 1 ? 's' : ''}
          </span>
        )}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-[var(--color-ink-3)] italic hidden lg:block">
            Arraste os cartões entre as colunas para mudar o status
          </span>
          <PushToggle />
        </div>
      </div>

      <div className="flex gap-4 flex-1 overflow-x-auto pb-4 -mx-1 px-1">
        {COLUMNS.map(col => {
          const colLeads = items.filter(l => l.status === col.key);
          const isOver = dragOver === col.key;
          return (
            <div
              key={col.key}
              onDragOver={e => { e.preventDefault(); setDragOver(col.key); }}
              onDragLeave={e => {
                // só limpa se realmente saiu da coluna (não ao passar por um filho)
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null);
              }}
              onDrop={e => handleDrop(e, col.key)}
              className={`flex flex-col w-[300px] flex-shrink-0 rounded-[var(--radius-card)] transition-colors ${
                isOver ? 'bg-[var(--color-primary-50)]/80 ring-2 ring-[var(--color-primary)]/30' : 'bg-white/35'
              } border border-white/60`}
            >
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/60">
                <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                <h3 className={`text-sm font-semibold ${col.accent}`}>{col.label}</h3>
                <span className="ml-auto text-xs font-medium text-[var(--color-ink-3)] bg-white/70 rounded-full px-2 py-0.5">
                  {colLeads.length}
                </span>
              </div>

              <div className="flex flex-col gap-2.5 p-3 overflow-y-auto flex-1 min-h-[120px]">
                {colLeads.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-center text-xs text-[var(--color-ink-3)]/70 border border-dashed border-white/70 rounded-xl py-8">
                    {isOver ? 'Solte aqui' : 'Nenhum lead'}
                  </div>
                ) : (
                  colLeads.map(lead => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      dragging={dragId === lead.id}
                      onDragStart={e => { e.dataTransfer.setData('text/plain', lead.id); setDragId(lead.id); }}
                      onDragEnd={() => { setDragId(null); setDragOver(null); }}
                      onClick={() => setDetail(lead)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {detail && (
        <LeadDetailModal
          lead={detail}
          onClose={() => setDetail(null)}
          onChanged={() => { setDetail(null); refetch(); }}
        />
      )}
    </div>
  );
}

function LeadCard({
  lead, dragging, onDragStart, onDragEnd, onClick,
}: {
  lead: Lead;
  dragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onClick: () => void;
}) {
  const wa = whatsappHref(lead.phone);
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`glass-card p-3.5 cursor-grab active:cursor-grabbing group ${
        dragging ? 'opacity-40' : 'glass-card-hover'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-sm text-[var(--color-ink)] leading-snug truncate">{lead.name}</p>
        <span className="text-[10px] text-[var(--color-ink-3)] whitespace-nowrap flex items-center gap-1 flex-shrink-0 mt-0.5">
          <Clock size={10} /> {timeAgo(lead.created_at)}
        </span>
      </div>

      {lead.phone && (
        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-[var(--color-ink-2)]">
          <Phone size={12} className="text-[var(--color-ink-3)]" />
          <span className="truncate">{lead.phone}</span>
        </div>
      )}

      {lead.services && lead.services.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2.5">
          {lead.services.map((s, i) => (
            <span key={i} className="px-2 py-0.5 text-[10px] rounded-md bg-[var(--color-primary-50)] text-[var(--color-primary-700)] border border-[var(--color-primary-100)] font-medium">
              {s}
            </span>
          ))}
        </div>
      )}

      {lead.notes && (
        <p className="mt-2.5 text-[11px] text-[var(--color-ink-3)] flex items-start gap-1 line-clamp-2">
          <StickyNote size={11} className="mt-0.5 flex-shrink-0" /> {lead.notes}
        </p>
      )}

      {wa && (
        <a
          href={wa}
          target="_blank"
          rel="noreferrer"
          onClick={e => e.stopPropagation()}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
        >
          <MessageCircle size={13} /> WhatsApp
        </a>
      )}
    </div>
  );
}

function LeadDetailModal({
  lead, onClose, onChanged,
}: {
  lead: Lead;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [notes, setNotes] = useState(lead.notes ?? '');
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const wa = whatsappHref(lead.phone);

  const handleSave = async () => {
    setSaving(true);
    await supabase
      .from('leads')
      .update({ notes: notes.trim() || null, status, updated_at: new Date().toISOString() })
      .eq('id', lead.id);
    setSaving(false);
    onChanged();
  };

  const handleDelete = async () => {
    if (!confirm(`Excluir o lead "${lead.name}"? Esta ação não pode ser desfeita.`)) return;
    setDeleting(true);
    await supabase.from('leads').delete().eq('id', lead.id);
    setDeleting(false);
    onChanged();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1b1420]/40 backdrop-blur-sm p-4">
      <div className="glass-panel bg-white/85 backdrop-blur-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-white/60">
          <div>
            <h2 className="panel-title">{lead.name}</h2>
            <p className="text-xs text-[var(--color-ink-3)] mt-0.5">Recebido {timeAgo(lead.created_at)}</p>
          </div>
          <button onClick={onClose} className="icon-action"><X size={20} /></button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          {lead.phone && (
            <div className="flex items-center gap-2 text-sm text-[var(--color-ink-2)]">
              <Phone size={15} className="text-[var(--color-ink-3)]" />
              <span>{lead.phone}</span>
              {wa && (
                <a href={wa} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700">
                  <MessageCircle size={14} /> Abrir WhatsApp
                </a>
              )}
            </div>
          )}

          {lead.services && lead.services.length > 0 && (
            <div>
              <p className="field-label">Serviços de interesse</p>
              <div className="flex flex-wrap gap-1.5">
                {lead.services.map((s, i) => (
                  <span key={i} className="px-2.5 py-1 text-xs rounded-md bg-[var(--color-primary-50)] text-[var(--color-primary-700)] border border-[var(--color-primary-100)] font-medium">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {lead.message && (
            <div>
              <p className="field-label">Mensagem</p>
              <p className="text-sm text-[var(--color-ink-2)] bg-white/50 rounded-xl border border-white/70 p-3 whitespace-pre-wrap">{lead.message}</p>
            </div>
          )}

          <div>
            <label className="field-label">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as LeadStatus)} className="field-input">
              {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>

          <div>
            <label className="field-label">Anotações internas</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Observações sobre o atendimento deste lead…"
              className="field-input resize-none"
            />
          </div>
        </div>

        <div className="px-6 pb-6 flex items-center gap-3">
          <button onClick={handleDelete} disabled={deleting || saving} className="btn-ghost text-rose-600 hover:bg-rose-50/70 !px-3">
            {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
          </button>
          <button onClick={onClose} disabled={saving || deleting} className="btn-secondary ml-auto">Cancelar</button>
          <button onClick={handleSave} disabled={saving || deleting} className="btn-primary">
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
