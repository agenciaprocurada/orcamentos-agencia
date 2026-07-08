import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { CalendarClock, Loader2, Pencil, Plus, Trash2, X, Zap } from 'lucide-react';
import type { BankAccount, CashFlowCategoryRecord, RecurringExpense, Supplier } from '../types/database';
import { formatBRL } from '../lib/finance';

export function RecurringExpensesView({ recurring, accounts, suppliers, categories, refetch }: {
  recurring: RecurringExpense[];
  accounts: BankAccount[];
  suppliers: Supplier[];
  categories: CashFlowCategoryRecord[];
  refetch: () => void;
}) {
  const activeAccounts = accounts.filter(a => a.active);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RecurringExpense | null>(null);
  const [description, setDescription] = useState('');
  const [value, setValue] = useState('');
  const [category, setCategory] = useState('');
  const [accountId, setAccountId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [dueDay, setDueDay] = useState('5');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const active_ = recurring.filter(r => r.active);
  const monthlyExpense = active_.filter(r => r.type !== 'Income').reduce((s, r) => s + Number(r.value), 0);
  const monthlyIncome = active_.filter(r => r.type === 'Income').reduce((s, r) => s + Number(r.value), 0);
  // Categorias compatíveis com o tipo da recorrência em edição.
  const formCategories = categories.filter(c => c.type === (editing?.type === 'Income' ? 'Income' : 'Expense'));

  const openEdit = (r: RecurringExpense) => {
    setEditing(r);
    setDescription(r.description); setValue(String(r.value)); setCategory(r.category);
    setAccountId(r.account_id || ''); setSupplierId(r.supplier_id || '');
    setDueDay(String(r.due_day)); setActive(r.active);
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !category) return;
    setSaving(true);
    setMessage(null);
    const payload = {
      description: description.trim(),
      value: Number(value) || 0,
      category,
      account_id: accountId || null,
      supplier_id: supplierId || null,
      due_day: Number(dueDay) || 1,
      active,
    };
    const q = editing
      ? supabase.from('recurring_expenses').update(payload).eq('id', editing.id)
      : supabase.from('recurring_expenses').insert(payload);
    const { error: err } = await q;
    if (err) setMessage({ type: 'error', text: err.message });
    else {
      setShowForm(false);
      refetch();
    }
    setSaving(false);
  };

  const handleDelete = async (r: RecurringExpense) => {
    if (!confirm(`Excluir a recorrência "${r.description}"? Lançamentos já gerados são mantidos.`)) return;
    setDeleting(r.id);
    const { error: err } = await supabase.from('recurring_expenses').delete().eq('id', r.id);
    if (err) setMessage({ type: 'error', text: err.message });
    refetch();
    setDeleting(null);
  };

  // Gera os lançamentos Pendentes do mês atual. Idempotente no banco:
  // clicar de novo não duplica nada.
  const handleGenerate = async () => {
    setGenerating(true);
    setMessage(null);
    const { data, error: err } = await supabase.rpc('generate_recurring_expenses');
    if (err) setMessage({ type: 'error', text: err.message });
    else {
      const n = Number(data) || 0;
      setMessage({
        type: 'success',
        text: n > 0 ? `${n} lançamento(s) gerado(s) no Fluxo de Caixa.` : 'Nada a gerar: o mês atual já está em dia.',
      });
      if (n > 0) refetch();
    }
    setGenerating(false);
  };

  const accountName = (id: string | null) => accounts.find(a => a.id === id)?.name;
  const supplierName = (id: string | null) => suppliers.find(s => s.id === id)?.name;

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {message && (
        <div className={`p-4 rounded-xl text-sm border ${message.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <div className="glass-panel p-6 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px]">
          <p className="text-xs uppercase tracking-wider font-semibold text-[var(--color-ink-3)]">Fixo mensal (ativas)</p>
          <p className="text-2xl font-bold [font-variant-numeric:tabular-nums]">
            <span className="text-emerald-700">+ {formatBRL(monthlyIncome)}</span>
            <span className="text-[var(--color-ink-3)] font-normal text-lg mx-2">·</span>
            <span className="text-rose-600">− {formatBRL(monthlyExpense)}</span>
          </p>
          <p className="text-xs text-[var(--color-ink-3)] mt-0.5">
            Para criar, lance uma receita ou despesa e marque "recorrente".
            Os lançamentos do mês entram automaticamente como pendentes ao abrir o sistema.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleGenerate} disabled={generating} className="btn-outline-brand">
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
            Gerar lançamentos do mês
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="glass-panel p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-[var(--color-ink-2)] text-sm uppercase tracking-wider">
              {editing ? `Editar recorrência — ${editing.description}` : 'Nova despesa recorrente'}
            </h4>
            <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[var(--color-ink-3)] mb-1">Descrição *</label>
              <input type="text" value={description} onChange={e => setDescription(e.target.value)} required placeholder="Ex: Aluguel do escritório" className="field-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-ink-3)] mb-1">Valor (R$) *</label>
              <input type="number" step="0.01" min="0.01" value={value} onChange={e => setValue(e.target.value)} required className="field-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-ink-3)] mb-1">Dia do vencimento *</label>
              <input type="number" min="1" max="31" value={dueDay} onChange={e => setDueDay(e.target.value)} required className="field-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-ink-3)] mb-1">Categoria *</label>
              <select value={category} onChange={e => setCategory(e.target.value)} required className="field-input">
                <option value="">Selecione…</option>
                {formCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-ink-3)] mb-1">Conta</label>
              <select value={accountId} onChange={e => setAccountId(e.target.value)} className="field-input">
                <option value="">Sem conta</option>
                {activeAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            {editing?.type !== 'Income' && (
              <div>
                <label className="block text-xs font-medium text-[var(--color-ink-3)] mb-1">Fornecedor</label>
                <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className="field-input">
                  <option value="">Sem fornecedor</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm text-[var(--color-ink-2)] cursor-pointer w-fit pt-5">
              <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} className="w-4 h-4 accent-[#C13584]" />
              Ativa (gera lançamento todo mês)
            </label>
          </div>
          <div>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              {editing ? 'Salvar alterações' : 'Criar recorrência'}
            </button>
          </div>
        </form>
      )}

      <div className="glass-panel overflow-hidden">
        <div className="p-4 border-b border-white/40 bg-white/20">
          <p className="text-sm font-semibold text-[var(--color-ink-2)]">{recurring.length} recorrência{recurring.length !== 1 ? 's' : ''}</p>
        </div>
        {recurring.length === 0 ? (
          <div className="p-8 text-center text-[var(--color-ink-3)] text-sm">
            Nenhuma recorrência ainda. Lance uma receita ou despesa e marque "recorrente" para ela aparecer aqui.
          </div>
        ) : (
          <ul className="divide-y divide-white/30">
            {recurring.map(r => (
              <li key={r.id} className={`flex items-center gap-3 px-5 py-3.5 hover:bg-white/30 transition-colors ${!r.active ? 'opacity-50' : ''}`}>
                <div className="w-8 h-8 rounded-lg bg-white/60 flex items-center justify-center text-[var(--color-ink-3)] flex-shrink-0">
                  <CalendarClock size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-ink)] truncate">
                    {r.description}
                    {!r.active && <span className="ml-2 text-[10px] font-semibold uppercase bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Pausada</span>}
                  </p>
                  <p className="text-xs text-[var(--color-ink-3)] truncate">
                    Dia {r.due_day} · {r.category}
                    {accountName(r.account_id) ? ` · ${accountName(r.account_id)}` : ''}
                    {supplierName(r.supplier_id) ? ` · ${supplierName(r.supplier_id)}` : ''}
                  </p>
                </div>
                <span className={`text-sm font-bold flex-shrink-0 [font-variant-numeric:tabular-nums] ${r.type === 'Income' ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {r.type === 'Income' ? '+' : '−'} {formatBRL(Number(r.value))}
                </span>
                <button onClick={() => openEdit(r)} className="icon-action flex-shrink-0"><Pencil size={15} /></button>
                <button onClick={() => handleDelete(r)} disabled={deleting === r.id}
                  className="text-gray-300 hover:text-red-500 transition-colors cursor-pointer p-1 flex-shrink-0">
                  {deleting === r.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
