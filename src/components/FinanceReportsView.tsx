import { useState } from 'react';
import { ChevronLeft, ChevronRight, Landmark, TrendingDown, TrendingUp } from 'lucide-react';
import type { AccountTransfer, BankAccount, CashFlow, CashFlowCategoryRecord } from '../types/database';
import { computeAccountBalances, formatBRL, formatMonthLabel, lastMonths, monthlyByCategory, totalBalance, type DreRegime } from '../lib/finance';

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const shiftMonth = (month: string, delta: number) => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export function FinanceReportsView({ cashFlows, categories, accounts, transfers }: {
  cashFlows: CashFlow[];
  categories: CashFlowCategoryRecord[];
  accounts: BankAccount[];
  transfers: AccountTransfer[];
}) {
  const [month, setMonth] = useState(currentMonth());
  const [regime, setRegime] = useState<DreRegime>('paid');

  const dre = monthlyByCategory(cashFlows, month, regime);
  const months = lastMonths(month, 6);
  const series = months.map(m => ({ month: m, ...monthlyByCategory(cashFlows, m, regime) }));
  const balances = computeAccountBalances(accounts.filter(a => a.active), cashFlows, transfers);

  const categoryColor = (name: string) => categories.find(c => c.name === name)?.color || '#94A3B8';
  const monthTitle = new Date(Number(month.split('-')[0]), Number(month.split('-')[1]) - 1, 1)
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      {/* Controles: mês + regime */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 glass-card p-1.5">
          <button onClick={() => setMonth(shiftMonth(month, -1))} className="icon-action"><ChevronLeft size={18} /></button>
          <span className="px-3 text-sm font-semibold text-[var(--color-ink)] capitalize min-w-[160px] text-center">{monthTitle}</span>
          <button onClick={() => setMonth(shiftMonth(month, 1))} className="icon-action"><ChevronRight size={18} /></button>
        </div>
        <div className="flex gap-1 glass-card p-1.5">
          {([['paid', 'Caixa (só pagos)'], ['all', 'Competência (todos)']] as const).map(([r, label]) => (
            <button key={r} onClick={() => setRegime(r)}
              className={`px-4 py-1.5 rounded-xl text-[13px] font-semibold transition-all cursor-pointer ${regime === r
                ? 'bg-[var(--color-primary)] text-white shadow-md'
                : 'text-[var(--color-ink-3)] hover:bg-white/60'}`}>
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--color-ink-3)] w-full sm:w-auto">
          Transferências entre contas não entram nestes números.
        </p>
      </div>

      {/* DRE do mês */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-panel overflow-hidden">
          <div className="p-4 border-b border-white/40 bg-white/20 flex items-center gap-2">
            <TrendingUp size={16} className="text-green-600" />
            <p className="text-sm font-semibold text-[var(--color-ink-2)]">Receitas por categoria</p>
            <span className="ml-auto text-sm font-bold text-green-600">{formatBRL(dre.incomeTotal)}</span>
          </div>
          {dre.income.length === 0 ? (
            <div className="p-6 text-center text-[var(--color-ink-3)] text-sm">Sem receitas no mês.</div>
          ) : (
            <ul className="divide-y divide-white/30">
              {dre.income.map(r => (
                <li key={r.category} className="flex items-center gap-3 px-5 py-3">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: categoryColor(r.category) }} />
                  <span className="text-sm text-[var(--color-ink)] flex-1 truncate">{r.category}</span>
                  <span className="text-sm font-semibold text-[var(--color-ink)]">{formatBRL(r.total)}</span>
                  <span className="text-xs text-[var(--color-ink-3)] w-12 text-right">
                    {dre.incomeTotal > 0 ? `${Math.round((r.total / dre.incomeTotal) * 100)}%` : '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="glass-panel overflow-hidden">
          <div className="p-4 border-b border-white/40 bg-white/20 flex items-center gap-2">
            <TrendingDown size={16} className="text-red-500" />
            <p className="text-sm font-semibold text-[var(--color-ink-2)]">Despesas por categoria</p>
            <span className="ml-auto text-sm font-bold text-red-600">{formatBRL(dre.expenseTotal)}</span>
          </div>
          {dre.expense.length === 0 ? (
            <div className="p-6 text-center text-[var(--color-ink-3)] text-sm">Sem despesas no mês.</div>
          ) : (
            <ul className="divide-y divide-white/30">
              {dre.expense.map(r => (
                <li key={r.category} className="flex items-center gap-3 px-5 py-3">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: categoryColor(r.category) }} />
                  <span className="text-sm text-[var(--color-ink)] flex-1 truncate">{r.category}</span>
                  <span className="text-sm font-semibold text-[var(--color-ink)]">{formatBRL(r.total)}</span>
                  <span className="text-xs text-[var(--color-ink-3)] w-12 text-right">
                    {dre.expenseTotal > 0 ? `${Math.round((r.total / dre.expenseTotal) * 100)}%` : '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Resultado do mês */}
      <div className={`glass-panel p-5 flex items-center justify-between ${dre.result >= 0 ? '' : ''}`}>
        <p className="text-sm font-semibold text-[var(--color-ink-2)]">Resultado do mês (receitas − despesas)</p>
        <p className={`text-2xl font-bold ${dre.result >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatBRL(dre.result)}</p>
      </div>

      {/* Comparativo últimos 6 meses */}
      <div className="glass-panel overflow-hidden">
        <div className="p-4 border-b border-white/40 bg-white/20">
          <p className="text-sm font-semibold text-[var(--color-ink-2)]">Comparativo — últimos 6 meses</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--color-ink-3)] uppercase tracking-wider">
                <th className="px-5 py-3 font-semibold">Mês</th>
                <th className="px-4 py-3 font-semibold text-right">Receitas</th>
                <th className="px-4 py-3 font-semibold text-right">Despesas</th>
                <th className="px-5 py-3 font-semibold text-right">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/30">
              {series.map(s => (
                <tr key={s.month} className={`hover:bg-white/30 transition-colors ${s.month === month ? 'bg-[var(--color-primary-50)]/40' : ''}`}>
                  <td className="px-5 py-3 font-medium capitalize text-[var(--color-ink)]">{formatMonthLabel(s.month)}</td>
                  <td className="px-4 py-3 text-right text-green-600">{formatBRL(s.incomeTotal)}</td>
                  <td className="px-4 py-3 text-right text-red-500">{formatBRL(s.expenseTotal)}</td>
                  <td className={`px-5 py-3 text-right font-bold ${s.result >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatBRL(s.result)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Saldo por conta */}
      <div className="glass-panel overflow-hidden">
        <div className="p-4 border-b border-white/40 bg-white/20 flex items-center gap-2">
          <Landmark size={16} className="text-[var(--color-ink-3)]" />
          <p className="text-sm font-semibold text-[var(--color-ink-2)]">Saldo por conta</p>
          <span className="ml-auto text-sm font-bold text-[var(--color-ink)]">{formatBRL(totalBalance(balances))}</span>
        </div>
        <ul className="divide-y divide-white/30">
          {balances.map(({ account, balance, projected }) => (
            <li key={account.id} className="flex items-center gap-3 px-5 py-3">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: account.color }} />
              <span className="text-sm text-[var(--color-ink)] flex-1 truncate">{account.name}</span>
              <span className="text-xs text-[var(--color-ink-3)]">previsto {formatBRL(projected)}</span>
              <span className={`text-sm font-semibold w-32 text-right ${balance >= 0 ? 'text-[var(--color-ink)]' : 'text-red-600'}`}>{formatBRL(balance)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
