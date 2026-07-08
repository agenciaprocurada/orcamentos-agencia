import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, Pencil, Plus, Trash2, Truck, X } from 'lucide-react';
import type { CashFlow, Supplier } from '../types/database';

export function SuppliersView({ suppliers, cashFlows, refetch }: {
  suppliers: Supplier[];
  cashFlows: CashFlow[];
  refetch: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [name, setName] = useState('');
  const [document, setDocument] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const expenseCount = (id: string) => cashFlows.filter(c => c.supplier_id === id).length;

  const openNew = () => {
    setEditing(null);
    setName(''); setDocument(''); setEmail(''); setPhone(''); setNotes('');
    setShowForm(true);
  };

  const openEdit = (s: Supplier) => {
    setEditing(s);
    setName(s.name); setDocument(s.document || ''); setEmail(s.email || ''); setPhone(s.phone || ''); setNotes(s.notes || '');
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    const payload = {
      name: name.trim(),
      document: document.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      notes: notes.trim() || null,
    };
    const q = editing
      ? supabase.from('suppliers').update(payload).eq('id', editing.id)
      : supabase.from('suppliers').insert(payload);
    const { error: err } = await q;
    if (err) setError(err.message);
    else {
      setShowForm(false);
      refetch();
    }
    setSaving(false);
  };

  const handleDelete = async (s: Supplier) => {
    const n = expenseCount(s.id);
    const warn = n > 0 ? ` ${n} despesa(s) vinculada(s) ficarão sem fornecedor (não são apagadas).` : '';
    if (!confirm(`Excluir o fornecedor "${s.name}"?${warn}`)) return;
    setDeleting(s.id);
    const { error: err } = await supabase.from('suppliers').delete().eq('id', s.id);
    if (err) setError(err.message);
    refetch();
    setDeleting(null);
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {error && <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

      <div className="flex justify-end">
        <button onClick={openNew} className="btn-primary"><Plus size={18} /> Novo Fornecedor</button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="glass-panel p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-[var(--color-ink-2)] text-sm uppercase tracking-wider">
              {editing ? `Editar fornecedor — ${editing.name}` : 'Novo fornecedor'}
            </h4>
            <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--color-ink-3)] mb-1">Nome *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Ex: Hostinger, Contador..." className="field-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-ink-3)] mb-1">CNPJ / CPF</label>
              <input type="text" value={document} onChange={e => setDocument(e.target.value)} className="field-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-ink-3)] mb-1">E-mail</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="field-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-ink-3)] mb-1">Telefone</label>
              <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className="field-input" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[var(--color-ink-3)] mb-1">Observações</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="field-input" />
            </div>
          </div>
          <div>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              {editing ? 'Salvar alterações' : 'Criar fornecedor'}
            </button>
          </div>
        </form>
      )}

      <div className="glass-panel overflow-hidden">
        <div className="p-4 border-b border-white/40 bg-white/20">
          <p className="text-sm font-semibold text-[var(--color-ink-2)]">{suppliers.length} fornecedor{suppliers.length !== 1 ? 'es' : ''}</p>
        </div>
        {suppliers.length === 0 ? (
          <div className="p-8 text-center text-[var(--color-ink-3)] text-sm">Nenhum fornecedor cadastrado ainda.</div>
        ) : (
          <ul className="divide-y divide-white/30">
            {suppliers.map(s => (
              <li key={s.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/30 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-white/60 flex items-center justify-center text-[var(--color-ink-3)] flex-shrink-0">
                  <Truck size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-ink)] truncate">{s.name}</p>
                  <p className="text-xs text-[var(--color-ink-3)] truncate">
                    {[s.document, s.email, s.phone].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
                {expenseCount(s.id) > 0 && (
                  <span className="text-[11px] text-[var(--color-ink-3)] bg-white/60 px-2 py-0.5 rounded-full flex-shrink-0">
                    {expenseCount(s.id)} despesa{expenseCount(s.id) !== 1 ? 's' : ''}
                  </span>
                )}
                <button onClick={() => openEdit(s)} className="icon-action flex-shrink-0"><Pencil size={15} /></button>
                <button onClick={() => handleDelete(s)} disabled={deleting === s.id}
                  className="text-gray-300 hover:text-red-500 transition-colors cursor-pointer p-1 flex-shrink-0">
                  {deleting === s.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
