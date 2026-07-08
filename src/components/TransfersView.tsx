import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowRightLeft, Loader2, Plus, Trash2 } from 'lucide-react';
import type { AccountTransfer, BankAccount } from '../types/database';
import { formatBRL } from '../lib/finance';

export function TransfersView({ accounts, transfers, refetch }: {
  accounts: BankAccount[];
  transfers: AccountTransfer[];
  refetch: () => void;
}) {
  const activeAccounts = accounts.filter(a => a.active);
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [value, setValue] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const accountName = (id: string) => accounts.find(a => a.id === id)?.name || '—';
  const accountColor = (id: string) => accounts.find(a => a.id === id)?.color || '#64748B';

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!fromId || !toId || fromId === toId) {
      setError('Escolha contas de origem e destino diferentes.');
      return;
    }
    const v = Number(value);
    if (!v || v <= 0) {
      setError('Informe um valor maior que zero.');
      return;
    }
    setSaving(true);
    const { error: err } = await supabase.from('account_transfers').insert({
      from_account_id: fromId,
      to_account_id: toId,
      value: v,
      date,
      description: description.trim() || null,
    });
    if (err) setError(err.message);
    else {
      setValue(''); setDescription('');
      refetch();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta transferência? Os saldos das duas contas serão recalculados.')) return;
    setDeleting(id);
    const { error: err } = await supabase.from('account_transfers').delete().eq('id', id);
    if (err) setError(err.message);
    refetch();
    setDeleting(null);
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {error && <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

      <div className="glass-panel p-6">
        <h4 className="font-semibold text-[var(--color-ink-2)] mb-1 text-sm uppercase tracking-wider">Nova transferência</h4>
        <p className="text-xs text-[var(--color-ink-3)] mb-4">
          Move dinheiro entre suas contas (ex.: saque do Asaas para o banco). Não conta como receita nem despesa e fica fora do DRE.
        </p>
        <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[var(--color-ink-3)] mb-1">De (origem) *</label>
            <select value={fromId} onChange={e => setFromId(e.target.value)} required className="field-input">
              <option value="">Selecione…</option>
              {activeAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-ink-3)] mb-1">Para (destino) *</label>
            <select value={toId} onChange={e => setToId(e.target.value)} required className="field-input">
              <option value="">Selecione…</option>
              {activeAccounts.filter(a => a.id !== fromId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-ink-3)] mb-1">Valor (R$) *</label>
            <input type="number" step="0.01" min="0.01" value={value} onChange={e => setValue(e.target.value)} required className="field-input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-ink-3)] mb-1">Data *</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="field-input" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-[var(--color-ink-3)] mb-1">Descrição</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Saque Asaas → Nubank" className="field-input" />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Registrar transferência
            </button>
          </div>
        </form>
      </div>

      <div className="glass-panel overflow-hidden">
        <div className="p-4 border-b border-white/40 bg-white/20">
          <p className="text-sm font-semibold text-[var(--color-ink-2)]">{transfers.length} transferência{transfers.length !== 1 ? 's' : ''}</p>
        </div>
        {transfers.length === 0 ? (
          <div className="p-8 text-center text-[var(--color-ink-3)] text-sm">Nenhuma transferência registrada ainda.</div>
        ) : (
          <ul className="divide-y divide-white/30">
            {transfers.map(t => (
              <li key={t.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/30 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-white/60 flex items-center justify-center text-[var(--color-ink-3)] flex-shrink-0">
                  <ArrowRightLeft size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-ink)] truncate">
                    <span style={{ color: accountColor(t.from_account_id) }}>{accountName(t.from_account_id)}</span>
                    {' → '}
                    <span style={{ color: accountColor(t.to_account_id) }}>{accountName(t.to_account_id)}</span>
                  </p>
                  <p className="text-xs text-[var(--color-ink-3)] truncate">
                    {new Date(t.date + 'T12:00:00').toLocaleDateString('pt-BR')}{t.description ? ` — ${t.description}` : ''}
                  </p>
                </div>
                <span className="text-sm font-bold text-[var(--color-ink)] flex-shrink-0">{formatBRL(Number(t.value))}</span>
                <button onClick={() => handleDelete(t.id)} disabled={deleting === t.id}
                  className="text-gray-300 hover:text-red-500 transition-colors cursor-pointer p-1 flex-shrink-0">
                  {deleting === t.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
