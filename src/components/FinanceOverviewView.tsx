import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  AlertCircle, ArrowDownRight, ArrowUpRight, Barcode, BarChart3, CheckCircle, ChevronLeft,
  ChevronRight, Eye, EyeOff, ExternalLink, Landmark, Loader2, PieChart, Wallet,
} from 'lucide-react';
import type { AccountTransfer, BankAccount, CashFlow, CashFlowCategoryRecord } from '../types/database';
import { computeAccountBalances, formatBRL, totalBalance } from '../lib/finance';
import { periodLabel, weekStart } from '../lib/projectRecurrence';

// Paleta de reserva para categorias sem cor cadastrada.
const PIE_FALLBACK = ['#C13584', '#059669', '#E11D48', '#F59E0B', '#6366F1', '#0EA5E9', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

// Cores do fluxo (validadas p/ daltonismo; polaridade também é codificada
// pela direção das barras: entradas sobem, saídas descem).
const INCOME = '#059669';
const EXPENSE = '#E11D48';

const toKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Um ponto do gráfico de fluxo (um dia, no modo mensal ou semanal).
type FlowPoint = { date: string; label: string; showLabel: boolean; inPaid: number; inPending: number; outPaid: number; outPending: number; net: number };

export function FinanceOverviewView({ cashFlows, accounts, transfers, categories, onEditCashFlow, refetch }: {
  cashFlows: CashFlow[];
  accounts: BankAccount[];
  transfers: AccountTransfer[];
  categories: CashFlowCategoryRecord[];
  onEditCashFlow: (c: CashFlow) => void;
  refetch: () => void;
}) {
  const today = toKey(new Date());
  const [viewDate, setViewDate] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  // Fluxo de caixa: visão mensal (governada pelo seletor de mês) ou semanal
  // (com navegação própria de semana, começando na semana atual).
  const [flowMode, setFlowMode] = useState<'month' | 'week'>('month');
  const [weekRef, setWeekRef] = useState(() => new Date());
  const [hoverDay, setHoverDay] = useState<number | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [hideBalances, setHideBalances] = useState<boolean>(() => {
    try { return localStorage.getItem('dash_hide_balances') === '1'; } catch { return false; }
  });
  const toggleHide = () => setHideBalances(v => {
    const next = !v;
    try { localStorage.setItem('dash_hide_balances', next ? '1' : '0'); } catch { /* ignore */ }
    return next;
  });
  // Máscara dos saldos de contas quando o modo "ocultar" está ativo.
  const money = (v: number) => (hideBalances ? 'R$ ••••••' : formatBRL(v));

  const monthPrefix = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const monthLabelRaw = viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const monthLabel = monthLabelRaw.charAt(0).toUpperCase() + monthLabelRaw.slice(1);

  // ---- KPIs (sempre relativos a HOJE, independentes do mês exibido no gráfico)
  const kpis = useMemo(() => {
    const endOfMonth = today.slice(0, 7) + '-31';
    let receiveToday = 0, payToday = 0, receiveRest = 0, payRest = 0,
      overdueReceive = 0, overduePay = 0, overdueCount = 0;
    for (const c of cashFlows) {
      if (c.status !== 'Pending') continue;
      const v = Number(c.value) || 0;
      if (c.date === today) { if (c.type === 'Income') receiveToday += v; else payToday += v; }
      else if (c.date < today) { overdueCount++; if (c.type === 'Income') overdueReceive += v; else overduePay += v; }
      else if (c.date <= endOfMonth) { if (c.type === 'Income') receiveRest += v; else payRest += v; }
    }
    return { receiveToday, payToday, receiveRest, payRest, overdueReceive, overduePay, overdueCount };
  }, [cashFlows, today]);

  const activeAccounts = accounts.filter(a => a.active);
  const balances = useMemo(
    () => computeAccountBalances(activeAccounts, cashFlows, transfers),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accounts, cashFlows, transfers],
  );
  const saldoTotal = totalBalance(balances);
  const previstoTotal = balances.reduce((s, b) => s + b.projected, 0);

  // ---- Série do período exibido: um ponto por dia do mês, ou os 7 dias da semana
  const series: FlowPoint[] = useMemo(() => {
    const pts: FlowPoint[] = [];
    if (flowMode === 'week') {
      const names = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
      const start = weekStart(weekRef);
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        pts.push({ date: toKey(d), label: `${names[i]} ${String(d.getDate()).padStart(2, '0')}`, showLabel: true, inPaid: 0, inPending: 0, outPaid: 0, outPending: 0, net: 0 });
      }
    } else {
      for (let i = 1; i <= daysInMonth; i++) {
        const date = `${monthPrefix}-${String(i).padStart(2, '0')}`;
        pts.push({ date, label: String(i), showLabel: i === 1 || i % 5 === 0, inPaid: 0, inPending: 0, outPaid: 0, outPending: 0, net: 0 });
      }
    }
    const idxOf = new Map(pts.map((p, i) => [p.date, i]));
    for (const c of cashFlows) {
      const i = c.date ? idxOf.get(c.date) : undefined;
      if (i === undefined) continue;
      const v = Number(c.value) || 0;
      const p = pts[i];
      if (c.type === 'Income') { if (c.status === 'Paid') p.inPaid += v; else p.inPending += v; }
      else { if (c.status === 'Paid') p.outPaid += v; else p.outPending += v; }
    }
    let acc = 0;
    for (const p of pts) { acc += p.inPaid + p.inPending - p.outPaid - p.outPending; p.net = acc; }
    return pts;
  }, [cashFlows, flowMode, weekRef, monthPrefix, daysInMonth]);

  const hasFlowData = series.some(d => d.inPaid + d.inPending + d.outPaid + d.outPending > 0);
  const weekLabel = periodLabel('weekly', weekRef);

  // ---- Categorias do mês exibido (para os gráficos de pizza)
  const catData = useMemo(() => {
    const colorOf = new Map(categories.map(c => [c.name, c.color]));
    const build = (type: 'Income' | 'Expense') => {
      const totals = new Map<string, number>();
      for (const c of cashFlows) {
        if (c.type !== type || !c.date?.startsWith(monthPrefix)) continue;
        const name = c.category || 'Sem categoria';
        totals.set(name, (totals.get(name) || 0) + (Number(c.value) || 0));
      }
      const rows = [...totals.entries()]
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([name, value], i) => ({ name, value, color: colorOf.get(name) || PIE_FALLBACK[i % PIE_FALLBACK.length] }));
      const total = rows.reduce((s, r) => s + r.value, 0);
      return { rows, total };
    };
    return { income: build('Income'), expense: build('Expense') };
  }, [cashFlows, categories, monthPrefix]);

  // ---- Lista "precisa de atenção": pendentes vencidos ou vencendo hoje
  const attention = useMemo(
    () => cashFlows
      .filter(c => c.status === 'Pending' && c.date <= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 6),
    [cashFlows, today],
  );

  const markPaid = async (c: CashFlow) => {
    setPayingId(c.id);
    const { error } = await supabase.from('cash_flow').update({ status: 'Paid' }).eq('id', c.id);
    if (error) alert(`Não foi possível marcar como pago: ${error.message}`);
    await refetch();
    setPayingId(null);
  };

  // ---- Geometria do gráfico (SVG viewBox fixo, responsivo por largura)
  const W = 960, H = 240, PAD_L = 8, PAD_R = 8, AXIS_Y = 148; // eixo zero
  const innerW = W - PAD_L - PAD_R;
  const slot = innerW / series.length;
  const barW = Math.min(flowMode === 'week' ? 48 : 18, Math.max(6, slot - 4));
  const maxBar = Math.max(1, ...series.map(d => Math.max(d.inPaid + d.inPending, d.outPaid + d.outPending)));
  const maxAbsNet = Math.max(1, ...series.map(d => Math.abs(d.net)));
  const barScale = (AXIS_Y - 26) / maxBar;          // barras: acima e abaixo do eixo
  const netScale = (AXIS_Y - 30) / maxAbsNet;       // linha: mesma origem no eixo zero
  const xOf = (i: number) => PAD_L + slot * i + slot / 2;
  const compact = (v: number) => v >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k` : v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });

  const netPath = series.map((d, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${(AXIS_Y - d.net * netScale).toFixed(1)}`).join(' ');
  const hovered = hoverDay !== null ? series[hoverDay] : null;

  return (
    <div className="flex flex-col gap-6 max-w-6xl [font-variant-numeric:tabular-nums]">

      {/* ---- Seletor de mês (governa o fluxo e os gráficos de categoria) */}
      <div className="flex items-center gap-3">
        <p className="text-sm font-semibold text-[var(--color-ink-2)]">Mês de referência</p>
        <button
          onClick={toggleHide}
          className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-white/60 border border-white/80 shadow-sm text-[var(--color-ink-2)] hover:bg-white transition-colors cursor-pointer"
          aria-label={hideBalances ? 'Mostrar saldos' : 'Ocultar saldos'}
          title={hideBalances ? 'Mostrar saldos' : 'Ocultar saldos'}
        >
          {hideBalances ? <EyeOff size={14} /> : <Eye size={14} />}
          <span className="hidden sm:inline">{hideBalances ? 'Mostrar saldos' : 'Ocultar saldos'}</span>
        </button>
        <div className="ml-auto flex items-center gap-2 bg-white/60 border border-white/80 rounded-xl p-1 shadow-sm">
          <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} className="p-1.5 hover:bg-white rounded-lg transition-colors text-[var(--color-ink-3)] cursor-pointer" aria-label="Mês anterior"><ChevronLeft size={16} /></button>
          <span className="font-semibold text-sm w-36 text-center text-[var(--color-ink-2)]">{monthLabel}</span>
          <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} className="p-1.5 hover:bg-white rounded-lg transition-colors text-[var(--color-ink-3)] cursor-pointer" aria-label="Próximo mês"><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* ---- KPIs de gestão */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="glass-panel p-5 relative overflow-hidden">
          <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-gradient-to-br from-[#C13584]/15 to-violet-500/10 blur-2xl pointer-events-none" />
          <div className="flex items-center gap-2 mb-2">
            <Wallet size={15} className="text-[var(--color-primary)]" />
            <p className="text-[11px] uppercase tracking-wider font-semibold text-[var(--color-ink-3)]">Saldo em contas</p>
          </div>
          <p className={`text-[26px] leading-tight font-bold tracking-tight ${saldoTotal >= 0 ? 'text-[var(--color-ink)]' : 'text-rose-600'}`}>{money(saldoTotal)}</p>
          <p className="text-xs text-[var(--color-ink-3)] mt-1">Previsto com pendentes: <span className="font-semibold">{money(previstoTotal)}</span></p>
        </div>

        <div className="glass-panel p-5">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpRight size={15} style={{ color: INCOME }} />
            <p className="text-[11px] uppercase tracking-wider font-semibold text-[var(--color-ink-3)]">A receber hoje</p>
          </div>
          <p className="text-[26px] leading-tight font-bold tracking-tight" style={{ color: INCOME }}>{formatBRL(kpis.receiveToday)}</p>
          <p className="text-xs text-[var(--color-ink-3)] mt-1">Restante do mês: <span className="font-semibold">{formatBRL(kpis.receiveRest)}</span></p>
        </div>

        <div className="glass-panel p-5">
          <div className="flex items-center gap-2 mb-2">
            <ArrowDownRight size={15} style={{ color: EXPENSE }} />
            <p className="text-[11px] uppercase tracking-wider font-semibold text-[var(--color-ink-3)]">A pagar hoje</p>
          </div>
          <p className="text-[26px] leading-tight font-bold tracking-tight" style={{ color: EXPENSE }}>{formatBRL(kpis.payToday)}</p>
          <p className="text-xs text-[var(--color-ink-3)] mt-1">Restante do mês: <span className="font-semibold">{formatBRL(kpis.payRest)}</span></p>
        </div>

        <div className={`glass-panel p-5 ${kpis.overdueCount > 0 ? 'ring-1 ring-rose-200' : ''}`}>
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={15} className={kpis.overdueCount > 0 ? 'text-rose-500' : 'text-[var(--color-ink-3)]'} />
            <p className="text-[11px] uppercase tracking-wider font-semibold text-[var(--color-ink-3)]">Vencidos</p>
          </div>
          {kpis.overdueCount === 0 ? (
            <p className="text-[26px] leading-tight font-bold tracking-tight text-[var(--color-ink)]">Em dia ✓</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              <p className="text-sm text-[var(--color-ink-2)]">Receber <span className="font-bold" style={{ color: INCOME }}>{formatBRL(kpis.overdueReceive)}</span></p>
              <p className="text-sm text-[var(--color-ink-2)]">Pagar <span className="font-bold" style={{ color: EXPENSE }}>{formatBRL(kpis.overduePay)}</span></p>
            </div>
          )}
          <p className="text-xs text-[var(--color-ink-3)] mt-1">{kpis.overdueCount === 0 ? 'Nenhum lançamento atrasado.' : `${kpis.overdueCount} lançamento(s) atrasado(s)`}</p>
        </div>
      </div>

      {/* ---- Fluxo + categorias (pizza): lado a lado no desktop, empilhados no mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">

      {/* Fluxo de caixa do período (mês exibido ou semana navegável) */}
      <div className="glass-panel overflow-hidden">
        <div className="p-4 sm:px-6 border-b border-white/40 bg-white/20 flex items-start gap-2 flex-wrap">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--color-ink-2)]">Fluxo de caixa {flowMode === 'week' ? 'da semana' : 'diário'}</p>
            <p className="text-xs text-[var(--color-ink-3)]">Entradas e saídas por dia de vencimento; a linha é o acumulado do período.</p>
          </div>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {flowMode === 'week' && (
              <div className="flex items-center gap-1 bg-white/60 border border-white/80 rounded-lg p-0.5 shadow-sm">
                <button onClick={() => { setHoverDay(null); setWeekRef(w => new Date(w.getFullYear(), w.getMonth(), w.getDate() - 7)); }} className="p-1 hover:bg-white rounded-md transition-colors text-[var(--color-ink-3)] cursor-pointer" aria-label="Semana anterior"><ChevronLeft size={14} /></button>
                <span className="text-[11px] font-semibold text-[var(--color-ink-2)] px-1 whitespace-nowrap">{weekLabel}</span>
                <button onClick={() => { setHoverDay(null); setWeekRef(w => new Date(w.getFullYear(), w.getMonth(), w.getDate() + 7)); }} className="p-1 hover:bg-white rounded-md transition-colors text-[var(--color-ink-3)] cursor-pointer" aria-label="Próxima semana"><ChevronRight size={14} /></button>
              </div>
            )}
            <div className="flex items-center bg-white/60 border border-white/80 rounded-lg p-0.5 shadow-sm">
              {([['month', 'Mês'], ['week', 'Semana']] as const).map(([key, lbl]) => (
                <button
                  key={key}
                  onClick={() => { setHoverDay(null); setFlowMode(key); }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${flowMode === key ? 'bg-white text-[var(--color-primary)] shadow-sm' : 'text-[var(--color-ink-3)] hover:text-[var(--color-ink-2)]'}`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>
        </div>

        {!hasFlowData ? (
          <div className="p-10 text-center text-sm text-[var(--color-ink-3)]">
            {flowMode === 'week'
              ? `Nenhum lançamento na ${weekLabel.toLowerCase()}.`
              : `Nenhum lançamento em ${monthLabel}. Registre uma receita ou despesa para ver o fluxo do mês.`}
          </div>
        ) : (
          <div className="p-4 sm:p-6 relative">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" role="img" aria-label={`Fluxo de caixa de ${flowMode === 'week' ? weekLabel : monthLabel}`}>
              {/* grid: eixo zero + topo/fundo sutis */}
              <line x1={PAD_L} x2={W - PAD_R} y1={AXIS_Y} y2={AXIS_Y} stroke="#1b1420" strokeOpacity="0.18" strokeWidth="1" />
              <line x1={PAD_L} x2={W - PAD_R} y1={AXIS_Y - maxBar * barScale} y2={AXIS_Y - maxBar * barScale} stroke="#1b1420" strokeOpacity="0.06" strokeWidth="1" />
              <text x={PAD_L} y={AXIS_Y - maxBar * barScale - 4} fontSize="10" fill="#1b1420" fillOpacity="0.45">R$ {compact(maxBar)}</text>

              {series.map((d, i) => {
                const x = xOf(i) - barW / 2;
                const inP = d.inPaid * barScale, inPe = d.inPending * barScale;
                const outP = d.outPaid * barScale, outPe = d.outPending * barScale;
                const isHover = hoverDay === i;
                const isToday = d.date === today;
                return (
                  <g key={d.date}>
                    {isToday && <rect x={PAD_L + slot * i} y={12} width={slot} height={H - 40} fill="#1b1420" fillOpacity="0.045" rx="4" />}
                    {isToday && <rect x={xOf(i) - barW / 2} y={H - 26} width={barW} height={3} rx="1.5" fill="#C13584" />}
                    {isHover && <rect x={PAD_L + slot * i} y={12} width={slot} height={H - 40} fill="#1b1420" fillOpacity="0.05" rx="4" />}
                    {/* entradas (acima do eixo): pagas sólidas, pendentes translúcidas */}
                    {inP > 0 && <rect x={x} y={AXIS_Y - inP} width={barW} height={inP} fill={INCOME} rx="2.5" />}
                    {inPe > 0 && <rect x={x} y={AXIS_Y - inP - inPe - (inP > 0 ? 2 : 0)} width={barW} height={inPe} fill={INCOME} fillOpacity="0.35" rx="2.5" />}
                    {/* saídas (abaixo do eixo) */}
                    {outP > 0 && <rect x={x} y={AXIS_Y + 1} width={barW} height={outP} fill={EXPENSE} rx="2.5" />}
                    {outPe > 0 && <rect x={x} y={AXIS_Y + 1 + outP + (outP > 0 ? 2 : 0)} width={barW} height={outPe} fill={EXPENSE} fillOpacity="0.35" rx="2.5" />}
                    {/* rótulo do dia (mensal: a cada 5 + hoje; semanal: todos) */}
                    {(d.showLabel || isToday) && (
                      <text x={xOf(i)} y={H - 10} fontSize="10" textAnchor="middle" fill="#1b1420" fillOpacity={isToday ? 0.9 : 0.45} fontWeight={isToday ? 700 : 400}>{d.label}</text>
                    )}
                    {/* alvo de hover: coluna inteira */}
                    <rect x={PAD_L + slot * i} y={0} width={slot} height={H} fill="transparent"
                      onMouseEnter={() => setHoverDay(i)} onMouseLeave={() => setHoverDay(null)} />
                  </g>
                );
              })}

              {/* linha do acumulado */}
              <path d={netPath} fill="none" stroke="#1b1420" strokeOpacity="0.75" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              {hovered && (
                <circle cx={xOf(hoverDay!)} cy={AXIS_Y - hovered.net * netScale} r="4.5" fill="#fff" stroke="#1b1420" strokeWidth="2" />
              )}
            </svg>

            {/* tooltip */}
            {hovered && (
              <div className="absolute z-10 pointer-events-none bg-white/95 backdrop-blur border border-white/80 shadow-lg rounded-xl px-3.5 py-2.5 text-xs"
                style={{ left: `${(xOf(hoverDay!) / W) * 100}%`, top: 8, transform: xOf(hoverDay!) > W * 0.72 ? 'translateX(-105%)' : 'translateX(8px)' }}>
                <p className="font-bold text-[var(--color-ink)] mb-1">{new Date(hovered.date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                <p className="text-[var(--color-ink-2)]">Entradas: <span className="font-semibold" style={{ color: INCOME }}>{formatBRL(hovered.inPaid + hovered.inPending)}</span>{hovered.inPending > 0 && <span className="text-[var(--color-ink-3)]"> ({formatBRL(hovered.inPending)} pend.)</span>}</p>
                <p className="text-[var(--color-ink-2)]">Saídas: <span className="font-semibold" style={{ color: EXPENSE }}>{formatBRL(hovered.outPaid + hovered.outPending)}</span>{hovered.outPending > 0 && <span className="text-[var(--color-ink-3)]"> ({formatBRL(hovered.outPending)} pend.)</span>}</p>
                <p className="text-[var(--color-ink-2)] mt-0.5 pt-0.5 border-t border-gray-100">Acumulado: <span className={`font-bold ${hovered.net >= 0 ? 'text-[var(--color-ink)]' : 'text-rose-600'}`}>{formatBRL(hovered.net)}</span></p>
              </div>
            )}

            {/* legenda */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-1 px-1 text-xs text-[var(--color-ink-3)]">
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ backgroundColor: INCOME }} /> Entradas</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ backgroundColor: EXPENSE }} /> Saídas</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] opacity-35" style={{ backgroundColor: INCOME }} /> Pendente</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-4 h-0.5 rounded bg-[#1b1420]/75" /> Acumulado do período</span>
            </div>
          </div>
        )}
      </div>

      {/* Categorias do mês (pizza): despesas e receitas */}
        <CategoryPie title="Despesas por categoria" rows={catData.expense.rows} total={catData.expense.total} centerColor={EXPENSE} />
        <CategoryPie title="Receitas por categoria" rows={catData.income.rows} total={catData.income.total} centerColor={INCOME} />
      </div>

      {/* ---- Atenção + saldo por conta */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        <div className="glass-panel overflow-hidden">
          <div className="p-4 border-b border-white/40 bg-white/20 flex items-center gap-2">
            <AlertCircle size={15} className={attention.length > 0 ? 'text-rose-500' : 'text-[var(--color-ink-3)]'} />
            <p className="text-sm font-semibold text-[var(--color-ink-2)]">Precisa de atenção</p>
            {attention.length > 0 && <span className="text-[11px] font-semibold bg-rose-50 text-rose-600 border border-rose-200 px-2 py-0.5 rounded-full">{attention.length}</span>}
          </div>
          {attention.length === 0 ? (
            <div className="p-8 text-center text-sm text-[var(--color-ink-3)]">
              <CheckCircle size={22} className="mx-auto mb-2 text-emerald-500" />
              Tudo em dia — nenhum pendente vencido ou vencendo hoje.
            </div>
          ) : (
            <ul className="divide-y divide-white/30">
              {attention.map(c => {
                const overdue = c.date < today;
                return (
                  <li key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/30 transition-colors">
                    <button onClick={() => onEditCashFlow(c)} className="flex-1 min-w-0 text-left cursor-pointer">
                      <p className="text-sm font-medium text-[var(--color-ink)] truncate">{c.description || c.category}</p>
                      <p className="text-xs mt-0.5">
                        <span className={overdue ? 'text-rose-600 font-semibold' : 'text-[var(--color-ink-3)]'}>
                          {overdue ? 'Venceu' : 'Vence hoje'} {overdue ? new Date(c.date + 'T12:00:00').toLocaleDateString('pt-BR') : ''}
                        </span>
                        <span className="text-[var(--color-ink-3)]"> · {c.type === 'Income' ? 'a receber' : 'a pagar'}</span>
                      </p>
                    </button>
                    <span className="text-sm font-bold whitespace-nowrap" style={{ color: c.type === 'Income' ? INCOME : EXPENSE }}>{formatBRL(Number(c.value))}</span>
                    {c.boleto_url && (
                      <a href={c.boleto_url} target="_blank" rel="noopener noreferrer" className="icon-action" title="Abrir boleto">
                        <Barcode size={15} /><ExternalLink size={10} className="-ml-1 -mt-2" />
                      </a>
                    )}
                    <button onClick={() => markPaid(c)} disabled={payingId === c.id}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap">
                      {payingId === c.id ? <Loader2 size={12} className="animate-spin" /> : 'Marcar pago'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="glass-panel overflow-hidden">
          <div className="p-4 border-b border-white/40 bg-white/20 flex items-center gap-2">
            <Landmark size={15} className="text-[var(--color-ink-3)]" />
            <p className="text-sm font-semibold text-[var(--color-ink-2)]">Saldo por conta</p>
            <span className="ml-auto text-sm font-bold text-[var(--color-ink)]">{money(saldoTotal)}</span>
          </div>
          {balances.length === 0 ? (
            <div className="p-8 text-center text-sm text-[var(--color-ink-3)]">Nenhuma conta cadastrada. Crie suas contas em Financeiro → Contas.</div>
          ) : (
            <ul className="divide-y divide-white/30">
              {balances.map(({ account, balance, projected }) => (
                <li key={account.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0" style={{ backgroundColor: account.color }}>
                    <Landmark size={14} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--color-ink)] truncate">
                      {account.name}
                      {account.system_key === 'asaas' && <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded-full">Automática</span>}
                    </p>
                    <p className="text-xs text-[var(--color-ink-3)]">Previsto: {money(projected)}</p>
                  </div>
                  <span className={`text-sm font-bold ${balance >= 0 ? 'text-[var(--color-ink)]' : 'text-rose-600'}`}>{money(balance)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Gráfico de pizza cheia com rótulos externos (nome + %), estilo planilha.
function CategoryPie({ title, rows, total, centerColor }: {
  title: string;
  rows: { name: string; value: number; color: string }[];
  total: number;
  centerColor: string;
}) {
  const [chart, setChart] = useState<'pie' | 'bar'>('pie');
  const CX = 180, CY = 132, R = 70;
  const pt = (frac: number, radius: number) => {
    const a = (-90 + 360 * frac) * Math.PI / 180;
    return { x: CX + radius * Math.cos(a), y: CY + radius * Math.sin(a) };
  };
  const trunc = (s: string) => (s.length > 20 ? s.slice(0, 19) + '…' : s);

  let acc = 0;
  const slices = rows.map(r => {
    const frac = total > 0 ? r.value / total : 0;
    const start = acc, end = acc + frac;
    acc = end;
    const mid = (start + end) / 2;
    const p0 = pt(start, R), p1 = pt(end, R);
    const large = frac > 0.5 ? 1 : 0;
    // Fatia única de 100% precisa de dois arcos (SVG não fecha círculo completo).
    const d = frac >= 0.999
      ? `M ${CX} ${(CY - R).toFixed(2)} A ${R} ${R} 0 1 1 ${(CX - 0.01).toFixed(2)} ${(CY - R).toFixed(2)} Z`
      : `M ${CX} ${CY} L ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} Z`;
    const lp = pt(mid, R + 12);
    const cosMid = Math.cos((-90 + 360 * mid) * Math.PI / 180);
    return { ...r, frac, d, lx: lp.x, ly: lp.y, anchor: cosMid >= 0 ? 'start' : 'end', pct: Math.round(frac * 100) };
  });

  return (
    <div className="glass-panel overflow-hidden">
      <div className="p-4 border-b border-white/40 bg-white/20 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: centerColor }} />
        <p className="text-sm font-semibold text-[var(--color-ink-2)]">{title}</p>
        <span className="ml-auto text-xs text-[var(--color-ink-3)] hidden sm:inline">{formatBRL(total)}</span>
        <div className="ml-auto sm:ml-2 flex items-center bg-white/60 border border-white/80 rounded-lg p-0.5 shadow-sm">
          <button onClick={() => setChart('pie')} className={`p-1.5 rounded-md transition-colors cursor-pointer ${chart === 'pie' ? 'bg-white text-[var(--color-primary)] shadow-sm' : 'text-[var(--color-ink-3)] hover:text-[var(--color-ink-2)]'}`} aria-label="Gráfico de pizza" title="Pizza"><PieChart size={15} /></button>
          <button onClick={() => setChart('bar')} className={`p-1.5 rounded-md transition-colors cursor-pointer ${chart === 'bar' ? 'bg-white text-[var(--color-primary)] shadow-sm' : 'text-[var(--color-ink-3)] hover:text-[var(--color-ink-2)]'}`} aria-label="Gráfico de barras" title="Barras"><BarChart3 size={15} /></button>
        </div>
      </div>

      {total === 0 ? (
        <div className="p-8 text-center text-sm text-[var(--color-ink-3)]">Nenhum lançamento neste mês.</div>
      ) : chart === 'pie' ? (
        <div className="p-3 sm:p-4 flex justify-center">
          <svg viewBox="0 0 360 268" className="w-full max-w-[380px] h-auto" role="img" aria-label={title}>
            {slices.map(s => (
              <path key={s.name} d={s.d} fill={s.color} stroke="#fff" strokeWidth="2">
                <title>{s.name}: {formatBRL(s.value)} ({s.pct}%)</title>
              </path>
            ))}
            {slices.filter(s => s.frac >= 0.04).map(s => (
              <text key={s.name} x={s.lx} y={s.ly} textAnchor={s.anchor as 'start' | 'end'} fontSize="11" fill="#1b1420">
                <tspan x={s.lx} dy="-1" fontWeight="600">{trunc(s.name)}</tspan>
                <tspan x={s.lx} dy="12" fillOpacity="0.55">{s.pct}%</tspan>
              </text>
            ))}
          </svg>
        </div>
      ) : (
        <div className="p-4 flex flex-col gap-3">
          {slices.map(s => (
            <div key={s.name}>
              <div className="flex items-baseline gap-2 text-xs mb-1">
                <span className="font-medium text-[var(--color-ink-2)] truncate min-w-0">{s.name}</span>
                <span className="ml-auto text-[var(--color-ink-3)] tabular-nums whitespace-nowrap">{s.pct}% · <span className="font-semibold text-[var(--color-ink)]">{formatBRL(s.value)}</span></span>
              </div>
              <div className="h-2.5 rounded-full bg-black/5 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.max(s.frac * 100, 1)}%`, backgroundColor: s.color }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
