import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Landmark, Plus, Loader2, Pencil, Archive, ArchiveRestore, Wallet, X } from 'lucide-react';
import type { AccountTransfer, BankAccount, CashFlow } from '../types/database';
import { computeAccountBalances, totalBalance, formatBRL } from '../lib/finance';

const PRESET_COLORS = ['#C13584', '#8B5CF6', '#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#F97316', '#0030B9', '#64748B'];

export function FinanceAccountsView({ accounts, cashFlows, transfers, refetch }: {
  accounts: BankAccount[];
  cashFlows: CashFlow[];
  transfers: AccountTransfer[];
  refetch: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [name, setName] = useState('');
  const [bankName, setBankName] = useState('');
  const [initialBalance, setInitialBalance] = useState('0');
  const [color, setColor] = useState('#3B82F6');
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const balances = computeAccountBalances(accounts, cashFlows, transfers);
  const activeBalances = balances.filter(b => b.account.active);
  const archived = balances.filter(b => !b.account.active);

  const openNew = () => {
    setEditing(null);
    setName(''); setBankName(''); setInitialBalance('0'); setColor('#3B82F6'); setIsDefault(false);
    setError(null);
    setShowForm(true);
  };

  const openEdit = (acc: BankAccount) => {
    setEditing(acc);
    setName(acc.name); setBankName(acc.bank_name || ''); setInitialBalance(String(acc.initial_balance));
    setColor(acc.color); setIsDefault(acc.is_default);
    setError(null);
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        bank_name: bankName.trim() || null,
        initial_balance: Number(initialBalance) || 0,
        color,
        is_default: isDefault,
      };
      // Só existe uma conta padrão: ao marcar esta, desmarca as outras.
      if (isDefault) {
        const { error: err } = await supabase.from('bank_accounts').update({ is_default: false }).eq('is_default', true);
        if (err) throw err;
      }
      const q = editing
        ? supabase.from('bank_accounts').update(payload).eq('id', editing.id)
        : supabase.from('bank_accounts').insert(payload);
      const { error: err } = await q;
      if (err) throw err;
      setShowForm(false);
      refetch();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar conta.');
    } finally {
      setSaving(false);
    }
  };

  const toggleArchive = async (acc: BankAccount) => {
    if (acc.system_key === 'asaas') return;
    if (acc.active && !confirm(`Arquivar a conta "${acc.name}"? Os lançamentos dela são mantidos; ela só some das listas de seleção.`)) return;
    setBusy(acc.id);
    const { error: err } = await supabase.from('bank_accounts').update({ active: !acc.active }).eq('id', acc.id);
    if (err) setError(err.message);
    refetch();
    setBusy(null);
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {/* Saldo geral */}
      <div className="glass-panel p-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#C13584] to-violet-600 shadow-md flex items-center justify-center text-white flex-shrink-0">
          <Wallet size={22} />
        </div>
        <div className="flex-1">
          <p className="text-xs uppercase tracking-wider font-semibold text-[var(--color-ink-3)]">Saldo geral (contas ativas)</p>
          <p className={`text-2xl font-bold ${totalBalance(activeBalances) >= 0 ? 'text-[var(--color-ink)]' : 'text-red-600'}`}>
            {formatBRL(totalBalance(activeBalances))}
          </p>
        </div>
        <button onClick={openNew} className="btn-primary flex-shrink-0">
          <Plus size={18} /> Nova Conta
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSave} className="glass-panel p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-[var(--color-ink-2)] text-sm uppercase tracking-wider">
              {editing ? `Editar conta — ${editing.name}` : 'Nova conta bancária'}
            </h4>
            <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--color-ink-3)] mb-1">Nome da conta *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Ex: Nubank PJ" className="field-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-ink-3)] mb-1">Banco</label>
              <input type="text" value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Ex: Nubank" className="field-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-ink-3)] mb-1">Saldo inicial (R$)</label>
              <input type="number" step="0.01" value={initialBalance} onChange={e => setInitialBalance(e.target.value)} className="field-input" />
              <p className="text-[11px] text-[var(--color-ink-3)] mt-1">Saldo que a conta tinha antes dos lançamentos registrados aqui.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-ink-3)] mb-1">Cor</label>
              <div className="flex gap-1.5 flex-wrap pt-1">
                {PRESET_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setColor(c)}
                    className={`w-6 h-6 rounded-full transition-all cursor-pointer ${color === c ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : 'hover:scale-110'}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--color-ink-2)] cursor-pointer w-fit">
            <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} className="w-4 h-4 accent-[#C13584]" />
            Conta padrão (pré-selecionada nos novos lançamentos)
          </label>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              {editing ? 'Salvar alterações' : 'Criar conta'}
            </button>
          </div>
        </form>
      )}

      {/* Cards das contas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {activeBalances.map(({ account, balance, projected }) => (
          <div key={account.id} className="glass-panel p-5 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl shadow-md flex items-center justify-center text-white flex-shrink-0" style={{ backgroundColor: account.color }}>
                <Landmark size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[var(--color-ink)] truncate">{account.name}</p>
                <p className="text-xs text-[var(--color-ink-3)] truncate">{account.bank_name || '—'}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {account.system_key === 'asaas' && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">Automática</span>
                )}
                {account.is_default && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider bg-[var(--color-primary-50)] text-[var(--color-primary)] px-2 py-0.5 rounded-full">Padrão</span>
                )}
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-[var(--color-ink-3)]">Saldo</p>
                <p className={`text-xl font-bold ${balance >= 0 ? 'text-[var(--color-ink)]' : 'text-red-600'}`}>{formatBRL(balance)}</p>
                <p className="text-[11px] text-[var(--color-ink-3)]">Previsto (com pendentes): {formatBRL(projected)}</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(account)} title="Editar" className="icon-action"><Pencil size={15} /></button>
                {account.system_key !== 'asaas' && (
                  <button onClick={() => toggleArchive(account)} disabled={busy === account.id} title="Arquivar" className="icon-action">
                    {busy === account.id ? <Loader2 size={15} className="animate-spin" /> : <Archive size={15} />}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Arquivadas */}
      {archived.length > 0 && (
        <div className="glass-panel overflow-hidden">
          <button onClick={() => setShowArchived(v => !v)} className="w-full p-4 text-left text-sm font-semibold text-[var(--color-ink-3)] hover:bg-white/30 cursor-pointer">
            {showArchived ? '▾' : '▸'} Contas arquivadas ({archived.length})
          </button>
          {showArchived && (
            <ul className="divide-y divide-white/30">
              {archived.map(({ account, balance }) => (
                <li key={account.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full opacity-50" style={{ backgroundColor: account.color }} />
                    <span className="text-sm text-[var(--color-ink-3)]">{account.name}</span>
                    <span className="text-xs text-[var(--color-ink-3)]">{formatBRL(balance)}</span>
                  </div>
                  <button onClick={() => toggleArchive(account)} disabled={busy === account.id} title="Reativar" className="icon-action">
                    {busy === account.id ? <Loader2 size={15} className="animate-spin" /> : <ArchiveRestore size={15} />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
