import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { FileUp, Loader2, Upload, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { BankAccount, CashFlowCategoryRecord } from '../types/database';
import { formatBRL } from '../lib/finance';

// Lançamento candidato que volta da Edge Function import-statement.
type Candidate = {
  date: string; // 'YYYY-MM-DD'
  value: number; // positivo
  type: 'Income' | 'Expense';
  description: string;
  category: string | null; // sugestão do Gemini (texto); mapeada abaixo
  fingerprint: string;
  duplicate: boolean; // já existe no cash_flow
};

// Linha na tela: candidato + escolhas do usuário (categoria, conta, selecionado).
type Row = Candidate & {
  selected: boolean;
  categoryName: string; // categoria escolhida (nome existente) — '' = pendente
  accountId: string; // conta destino
};

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
    r.readAsDataURL(file);
  });

// Casa a sugestão do Gemini com uma categoria existente do tipo certo (ignora
// acento/caixa). Vazio se não achar — o usuário escolhe no dropdown.
function matchCategory(
  suggestion: string | null,
  type: 'Income' | 'Expense',
  categories: CashFlowCategoryRecord[],
): string {
  if (!suggestion) return '';
  const norm = (s: string) =>
    s.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const hit = categories.find(c => c.type === type && norm(c.name) === norm(suggestion));
  return hit ? hit.name : '';
}

export function StatementImportView({ accounts, categories, refetch }: {
  accounts: BankAccount[];
  categories: CashFlowCategoryRecord[];
  refetch: () => void;
}) {
  const activeAccounts = accounts.filter(a => a.active);
  const [accountId, setAccountId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleParse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId || !file) return;
    setParsing(true);
    setMessage(null);
    setRows(null);
    try {
      const fileBase64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke('import-statement', {
        body: { action: 'parse', account_id: accountId, filename: file.name, mime: file.type, fileBase64 },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const candidates: Candidate[] = data?.candidates ?? [];
      if (candidates.length === 0) {
        setMessage({ type: 'error', text: 'Nenhuma transação encontrada no arquivo.' });
        return;
      }
      setRows(candidates.map(c => ({
        ...c,
        // Duplicado já vem desmarcado; o resto marcado pra lançar.
        selected: !c.duplicate,
        categoryName: matchCategory(c.category, c.type, categories),
        accountId,
      })));
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Erro ao ler o extrato.' });
    } finally {
      setParsing(false);
    }
  };

  const update = (i: number, patch: Partial<Row>) =>
    setRows(rs => rs ? rs.map((r, j) => (j === i ? { ...r, ...patch } : r)) : rs);

  const selectedRows = (rows ?? []).filter(r => r.selected);
  const missingCategory = selectedRows.filter(r => !r.categoryName).length;

  const handleImport = async () => {
    if (!rows) return;
    const toInsert = rows.filter(r => r.selected && r.categoryName);
    if (toInsert.length === 0) {
      setMessage({ type: 'error', text: 'Selecione ao menos um lançamento com categoria definida.' });
      return;
    }
    setImporting(true);
    setMessage(null);
    const payload = toInsert.map(r => ({
      type: r.type,
      category: r.categoryName,
      value: r.value,
      date: r.date,
      description: r.description,
      status: 'Paid' as const, // extrato = já aconteceu
      account_id: r.accountId || null,
      source: 'extrato',
      import_fingerprint: r.fingerprint,
    }));
    // upsert ignorando duplicados: o índice único em import_fingerprint pula o
    // que já foi importado antes sem derrubar o lote inteiro.
    const { error } = await supabase
      .from('cash_flow')
      .upsert(payload, { onConflict: 'import_fingerprint', ignoreDuplicates: true });
    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: `${toInsert.length} lançamento(s) importado(s) no Fluxo de Caixa.` });
      setRows(null);
      setFile(null);
      refetch();
    }
    setImporting(false);
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {message && (
        <div className={`p-4 rounded-xl text-sm border flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {message.text}
        </div>
      )}

      <form onSubmit={handleParse} className="glass-panel p-6 flex flex-col gap-4">
        <div>
          <h4 className="font-semibold text-[var(--color-ink-2)] text-sm uppercase tracking-wider">Importar extrato bancário</h4>
          <p className="text-xs text-[var(--color-ink-3)] mt-1">
            Suba o extrato (OFX, PDF, imagem ou CSV). A IA lê as transações e já escolhe a categoria de cada uma —
            você só confere e ajusta o que quiser antes de lançar. Nada é lançado automaticamente. Reimportar o mesmo extrato não duplica.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[var(--color-ink-3)] mb-1">Conta bancária do extrato *</label>
            <select value={accountId} onChange={e => setAccountId(e.target.value)} required className="field-input">
              <option value="">Selecione…</option>
              {activeAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-ink-3)] mb-1">Arquivo *</label>
            <input
              type="file"
              accept=".ofx,.pdf,.csv,.txt,image/*"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              required
              className="field-input file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-white/70 file:text-[var(--color-ink-2)] file:cursor-pointer"
            />
          </div>
        </div>
        <div>
          <button type="submit" disabled={parsing || !accountId || !file} className="btn-primary">
            {parsing ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
            {parsing ? 'Lendo extrato…' : 'Ler extrato'}
          </button>
        </div>
      </form>

      {rows && (
        <div className="glass-panel overflow-hidden">
          <div className="p-4 border-b border-white/40 bg-white/20 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--color-ink-2)]">
                {rows.length} transação(ões) lida(s) · {selectedRows.length} selecionada(s)
              </p>
              {missingCategory > 0 && (
                <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                  <AlertTriangle size={12} /> {missingCategory} sem categoria — defina para poder lançar.
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setRows(null); setFile(null); }} className="btn-outline-brand" type="button">
                <X size={16} /> Descartar
              </button>
              <button onClick={handleImport} disabled={importing || selectedRows.length === 0} className="btn-primary" type="button">
                {importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                Lançar selecionados
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-[var(--color-ink-3)] bg-white/20">
                <tr>
                  <th className="p-2 w-8"></th>
                  <th className="p-2 text-left font-semibold">Data</th>
                  <th className="p-2 text-left font-semibold">Descrição</th>
                  <th className="p-2 text-left font-semibold">Categoria</th>
                  <th className="p-2 text-left font-semibold">Conta</th>
                  <th className="p-2 text-right font-semibold">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/30">
                {rows.map((r, i) => (
                  <tr key={r.fingerprint} className={`${!r.selected ? 'opacity-45' : ''} ${r.duplicate ? 'bg-amber-50/40' : ''}`}>
                    <td className="p-2 text-center">
                      <input type="checkbox" checked={r.selected} onChange={e => update(i, { selected: e.target.checked })} className="w-4 h-4 accent-[#C13584]" />
                    </td>
                    <td className="p-2 whitespace-nowrap text-[var(--color-ink-2)]">{r.date.slice(8, 10)}/{r.date.slice(5, 7)}</td>
                    <td className="p-2 min-w-[180px]">
                      <span className="text-[var(--color-ink)]">{r.description}</span>
                      {r.duplicate && <span className="ml-2 text-[10px] font-semibold uppercase bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Já importado</span>}
                    </td>
                    <td className="p-2">
                      <select value={r.categoryName} onChange={e => update(i, { categoryName: e.target.value })}
                        className={`field-input !py-1 !text-xs min-w-[140px] ${r.selected && !r.categoryName ? '!border-amber-400' : ''}`}>
                        <option value="">Selecione…</option>
                        {categories.filter(c => c.type === r.type).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </select>
                    </td>
                    <td className="p-2">
                      <select value={r.accountId} onChange={e => update(i, { accountId: e.target.value })} className="field-input !py-1 !text-xs min-w-[120px]">
                        {activeAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </td>
                    <td className={`p-2 text-right font-bold whitespace-nowrap [font-variant-numeric:tabular-nums] ${r.type === 'Income' ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {r.type === 'Income' ? '+' : '−'} {formatBRL(r.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
