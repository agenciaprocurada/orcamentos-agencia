import type { AccountTransfer, BankAccount, CashFlow } from '../types/database';

// Agregações financeiras puras (sem I/O). O app carrega cash_flow inteiro
// no cliente, então saldos e DRE são calculados aqui em memória.

export type AccountBalance = {
  account: BankAccount;
  /** Saldo real: inicial + receitas Pagas − despesas Pagas ± transferências. */
  balance: number;
  /** Saldo previsto: balance ± lançamentos Pendentes. */
  projected: number;
};

export function computeAccountBalances(
  accounts: BankAccount[],
  cashFlows: CashFlow[],
  transfers: AccountTransfer[],
): AccountBalance[] {
  return accounts.map((account) => {
    let balance = Number(account.initial_balance) || 0;
    let projected = 0;
    for (const cf of cashFlows) {
      if (cf.account_id !== account.id) continue;
      const signed = (Number(cf.value) || 0) * (cf.type === 'Income' ? 1 : -1);
      if (cf.status === 'Paid') balance += signed;
      else projected += signed;
    }
    for (const t of transfers) {
      const v = Number(t.value) || 0;
      if (t.to_account_id === account.id) balance += v;
      if (t.from_account_id === account.id) balance -= v;
    }
    return { account, balance, projected: balance + projected };
  });
}

export function totalBalance(balances: AccountBalance[]): number {
  return balances.reduce((sum, b) => sum + b.balance, 0);
}

export type DreRegime = 'paid' | 'all';

export type MonthlyCategoryTotals = {
  income: { category: string; total: number }[];
  expense: { category: string; total: number }[];
  incomeTotal: number;
  expenseTotal: number;
  result: number;
};

/** Lançamentos do mês agrupados por categoria (DRE). Transferências não
 *  entram por construção: vivem em account_transfers, fora do cash_flow. */
export function monthlyByCategory(
  cashFlows: CashFlow[],
  month: string, // 'YYYY-MM'
  regime: DreRegime,
): MonthlyCategoryTotals {
  const income = new Map<string, number>();
  const expense = new Map<string, number>();
  for (const cf of cashFlows) {
    if (!cf.date?.startsWith(month)) continue;
    if (regime === 'paid' && cf.status !== 'Paid') continue;
    const map = cf.type === 'Income' ? income : expense;
    map.set(cf.category, (map.get(cf.category) || 0) + (Number(cf.value) || 0));
  }
  const toSorted = (m: Map<string, number>) =>
    [...m.entries()].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
  const incomeRows = toSorted(income);
  const expenseRows = toSorted(expense);
  const incomeTotal = incomeRows.reduce((s, r) => s + r.total, 0);
  const expenseTotal = expenseRows.reduce((s, r) => s + r.total, 0);
  return { income: incomeRows, expense: expenseRows, incomeTotal, expenseTotal, result: incomeTotal - expenseTotal };
}

/** Últimos N meses terminando em `endMonth` ('YYYY-MM'), em ordem cronológica. */
export function lastMonths(endMonth: string, count: number): string[] {
  const [y, m] = endMonth.split('-').map(Number);
  const months: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

export const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const formatMonthLabel = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
};
