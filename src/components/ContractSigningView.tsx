import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { SignaturePad, type SignaturePadHandle } from './SignaturePad';
import { Loader2, CheckCircle, AlertCircle, RefreshCw, PenTool, ArrowRight, ArrowLeft } from 'lucide-react';
import type { Contract, SignerField } from '../types/database';

function resolveVars(html: string, vars: Record<string, string>): string {
  if (!html) return html;
  return Object.entries(vars).reduce(
    (text, [key, val]) => text.split(`{{${key}}}`).join(val ?? ''),
    html
  );
}

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' });

function BrandTitle({ brand }: { brand: string }) {
  if (brand === 'vinicius') return <>Vinicius Kolling.</>;
  if (brand === 'procurada') return <>agência PROCURADA.</>;
  return <>agência OCTO.</>;
}

// Standard client (contratante) data. `col` maps to the clients table column.
// `always` shows the field even when already filled (so the name is confirmed).
// Other fields are requested only when missing on the client record.
type StdField = { key: string; col: string; label: string; type: SignerField['type']; required: boolean; always?: boolean };
const STANDARD_CLIENT_FIELDS: StdField[] = [
  { key: 'NOME_CLIENTE', col: 'name', label: 'Nome completo', type: 'text', required: true, always: true },
  { key: 'EMAIL_CLIENTE', col: 'email', label: 'E-mail', type: 'email', required: true },
  { key: 'TELEFONE_CLIENTE', col: 'phone', label: 'Telefone', type: 'text', required: true },
  { key: 'EMPRESA_CLIENTE', col: 'company_name', label: 'Empresa / Razão Social', type: 'text', required: false },
  { key: 'CNPJ_CLIENTE', col: 'cnpj', label: 'CNPJ', type: 'text', required: false },
  { key: 'CIDADE_CLIENTE', col: 'city', label: 'Cidade', type: 'text', required: true },
  { key: 'ESTADO_CLIENTE', col: 'state', label: 'Estado (UF)', type: 'text', required: true },
];

// Public, no-auth contract signing page. Rendered when the URL is /assinar/<token>.
export function ContractSigningView({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [contract, setContract] = useState<Contract | null>(null);
  const [clientData, setClientData] = useState<Record<string, string>>({});

  const [values, setValues] = useState<Record<string, string>>({});
  const [step, setStep] = useState<'form' | 'sign'>('sign');
  const [formError, setFormError] = useState<string | null>(null);
  const [savingProgress, setSavingProgress] = useState(false);
  const [signEmpty, setSignEmpty] = useState(true);
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const [justSigned, setJustSigned] = useState<{ signed_at: string; signer_ip: string } | null>(null);

  const padRef = useRef<SignaturePadHandle | null>(null);

  // Fields rendered in the data step: the name (always) + any standard client
  // field missing on the record + the template's configurable signer fields.
  const computeFormFields = (c: Contract, client: Record<string, string>) => {
    const std = STANDARD_CLIENT_FIELDS.filter(f => f.always || !String(client[f.col] || '').trim());
    const signerFields = (c.signer_fields as SignerField[]) || [];
    return [...std, ...signerFields];
  };

  // The data step is needed when any standard client field is missing or the
  // template has configurable fields (e.g. CPF) to fill.
  const computeNeedsForm = (c: Contract, client: Record<string, string>) => {
    const missingStd = STANDARD_CLIENT_FIELDS.some(f => !String(client[f.col] || '').trim());
    const hasSignerFields = ((c.signer_fields as SignerField[]) || []).length > 0;
    return missingStd || hasSignerFields;
  };

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase.functions.invoke('contract', { body: { action: 'read', token } });
    if (error) {
      setLoadError('Não foi possível carregar o contrato. Verifique sua conexão e tente novamente.');
    } else if (data?.error) {
      setLoadError(data.error);
    } else if (data?.contract) {
      const c = data.contract as Contract;
      const client = (data.client as Record<string, string>) || {};
      setContract(c);
      setClientData(client);
      setExpired(Boolean(data.expired));
      // Seed values: live client data per standard field + merge_vars fallback
      // + any previously stored signer values.
      const mv = (c.merge_vars as Record<string, string>) || {};
      const seed: Record<string, string> = {};
      for (const f of STANDARD_CLIENT_FIELDS) {
        const col = f.col === 'phone' ? (client.phone || client.whatsapp) : client[f.col];
        seed[f.key] = (col || mv[f.key] || '').toString();
      }
      Object.assign(seed, (c.signer_values as Record<string, string>) || {});
      setValues(seed);
      // Decide first step: ask for data when something is missing/required.
      const needsForm = c.status !== 'signed' && computeNeedsForm(c, client);
      setStep(needsForm ? 'form' : 'sign');
    } else {
      setLoadError('Contrato não encontrado.');
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => { document.title = 'Contrato para Assinatura'; }, []);

  const formFields = contract ? computeFormFields(contract, clientData) : [];
  const needsForm = contract ? computeNeedsForm(contract, clientData) : false;
  const isSigned = contract?.status === 'signed' || !!justSigned;

  // Resolve the document body live as the client fills the fields.
  const resolvedBody = (() => {
    if (!contract) return '';
    if (contract.status === 'signed' && contract.signed_body) return contract.signed_body;
    const vars: Record<string, string> = { ...(contract.merge_vars as Record<string, string> || {}) };
    for (const [k, v] of Object.entries(values)) if (v) vars[k] = v;
    return resolveVars(contract.body || '', vars);
  })();

  const renderField = (f: { key: string; label: string; type: SignerField['type']; required: boolean }) => (
    <div key={f.key}>
      <label className="block text-sm font-medium text-[var(--color-ink-2)] mb-1.5">
        {f.label}{f.required && <span className="text-red-400"> *</span>}
      </label>
      {f.type === 'textarea' ? (
        <textarea
          rows={3}
          value={values[f.key] || ''}
          onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C13584] resize-y"
        />
      ) : (
        <input
          type={f.type === 'email' ? 'email' : f.type === 'date' ? 'date' : 'text'}
          inputMode={f.type === 'cpf' ? 'numeric' : undefined}
          value={values[f.key] || ''}
          onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C13584]"
        />
      )}
    </div>
  );

  const handleContinue = async () => {
    setFormError(null);
    for (const f of formFields) {
      if (f.required && !String(values[f.key] || '').trim()) {
        setFormError(`Preencha o campo obrigatório: ${f.label}`);
        return;
      }
    }
    // Persist the filled data immediately (contract + CRM client).
    setSavingProgress(true);
    const { data, error } = await supabase.functions.invoke('contract', {
      body: {
        token,
        action: 'save-progress',
        signer_values: values,
        signer_name: values['NOME_CLIENTE'] || contract?.signer_name || '',
        signer_email: values['EMAIL_CLIENTE'] || contract?.signer_email || '',
      },
    });
    setSavingProgress(false);
    if (error || data?.error) {
      setFormError(data?.error || 'Não foi possível salvar seus dados. Tente novamente.');
      return;
    }
    setStep('sign');
  };

  const handleSign = async () => {
    if (!contract) return;
    setSignError(null);

    // Re-validate all required data (in case the contract had no form step).
    for (const f of formFields) {
      if (f.required && !String(values[f.key] || '').trim()) {
        setStep('form');
        setFormError(`Preencha o campo obrigatório: ${f.label}`);
        return;
      }
    }
    if (!padRef.current || padRef.current.isEmpty()) {
      setSignError('Por favor, desenhe sua assinatura no quadro abaixo.');
      return;
    }

    setSigning(true);
    const signatureData = padRef.current.toDataURL();
    const { data, error } = await supabase.functions.invoke('contract', {
      body: {
        token,
        signer_values: values,
        signature_data: signatureData,
        signer_name: values['NOME_CLIENTE'] || contract.signer_name || '',
        signer_email: values['EMAIL_CLIENTE'] || contract.signer_email || '',
      },
    });
    setSigning(false);

    if (error) { setSignError('Falha ao enviar a assinatura. Tente novamente.'); return; }
    if (data?.error) { setSignError(data.error); return; }
    if (data?.success) {
      setJustSigned({ signed_at: data.signed_at, signer_ip: data.signer_ip });
      await load();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#F1F0EE]">
        <Loader2 className="animate-spin text-[#C13584]" size={40} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#F1F0EE] p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={24} />
          </div>
          <h1 className="text-lg font-bold text-[var(--color-ink)] mb-1">Contrato indisponível</h1>
          <p className="text-sm text-[var(--color-ink-3)]">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!contract) return null;

  const statusBadge = isSigned
    ? <span className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-semibold whitespace-nowrap">Assinado</span>
    : expired
      ? <span className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-semibold whitespace-nowrap">Link expirado</span>
      : <span className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs font-semibold whitespace-nowrap">Aguardando assinatura</span>;

  // Header card (shared)
  const header = (
    <div className="bg-white rounded-2xl shadow-sm p-5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C13584] to-purple-600 shadow-md flex items-center justify-center text-white font-bold flex-shrink-0">
          {(contract.brand || 'o').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-[var(--color-ink)] truncate"><BrandTitle brand={contract.brand} /></p>
          <p className="text-sm text-[var(--color-ink-3)] truncate">{contract.title}</p>
        </div>
      </div>
      {statusBadge}
    </div>
  );

  // STEP 1 — collect the client's data before showing the contract.
  if (!isSigned && !expired && step === 'form') {
    return (
      <div className="min-h-screen w-full bg-[#F1F0EE] py-8 px-4">
        <div className="max-w-xl mx-auto flex flex-col gap-4">
          {header}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <p className="text-xs font-bold tracking-widest text-[var(--color-ink-3)] uppercase mb-1">Etapa 1 de 2</p>
            <h2 className="text-lg font-bold text-[var(--color-ink)]">Confirme seus dados</h2>
            <p className="text-sm text-[var(--color-ink-3)] mb-5">Precisamos destas informações para preencher o contrato antes da assinatura.</p>

            <div className="flex flex-col gap-4">
              {formFields.map(renderField)}
            </div>

            {formError && (
              <div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-600 text-sm">
                <AlertCircle size={16} className="flex-shrink-0" /> {formError}
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button type="button" onClick={handleContinue} disabled={savingProgress}
                className="btn-primary px-6">
                {savingProgress ? <Loader2 size={16} className="animate-spin" /> : null}
                Continuar para o contrato {!savingProgress && <ArrowRight size={16} />}
              </button>
            </div>
          </div>
          <p className="text-center text-xs text-[var(--color-ink-3)] pb-4">
            {contract.valid_until ? `Link válido até ${fmtDate(contract.valid_until)}` : ''}
          </p>
        </div>
      </div>
    );
  }

  // STEP 2 — contract + signature (or signed result).
  return (
    <div className="min-h-screen w-full bg-[#F1F0EE] py-8 px-4">
      <div className="max-w-xl mx-auto flex flex-col gap-4">
        {header}

        {/* Contratante */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <p className="text-xs font-bold tracking-widest text-[var(--color-ink-3)] uppercase">Contratante</p>
            {!isSigned && !expired && needsForm && (
              <button type="button" onClick={() => setStep('form')} className="text-xs text-[#C13584] hover:underline cursor-pointer flex items-center gap-1">
                <ArrowLeft size={12} /> Editar dados
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-[var(--color-ink-3)] flex-shrink-0 text-lg font-semibold">
              {(values['NOME_CLIENTE'] || contract.signer_name || '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-[var(--color-ink)] truncate">{values['NOME_CLIENTE'] || contract.signer_name || '—'}</p>
              {(values['EMAIL_CLIENTE'] || contract.signer_email) && <p className="text-sm text-[var(--color-ink-3)] truncate">{values['EMAIL_CLIENTE'] || contract.signer_email}</p>}
            </div>
          </div>
        </div>

        {/* Termos */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <p className="text-xs font-bold tracking-widest text-[var(--color-ink-3)] uppercase mb-3">Termos do Contrato</p>
          <div className="bg-gray-50 rounded-xl border border-gray-100 p-5 text-sm text-[var(--color-ink-2)] leading-relaxed contract-body" dangerouslySetInnerHTML={{ __html: resolvedBody }} />
        </div>

        {/* Assinatura */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <p className="text-xs font-bold tracking-widest text-[var(--color-ink-3)] uppercase mb-1">Assinatura Digital</p>

          {isSigned ? (
            <div className="mt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="border border-gray-200 rounded-xl bg-gray-50 p-4 flex flex-col items-center justify-center min-h-[8rem]">
                  {contract.signature_data
                    ? <img src={contract.signature_data} alt="Assinatura do contratante" className="max-h-24" />
                    : <span className="text-[var(--color-ink-3)] text-sm">Assinatura registrada</span>}
                  <span className="mt-2 text-xs text-[var(--color-ink-3)] uppercase tracking-wider">Contratante</span>
                </div>
                {contract.agency_signature && (
                  <div className="border border-gray-200 rounded-xl bg-gray-50 p-4 flex flex-col items-center justify-center min-h-[8rem]">
                    <img src={contract.agency_signature} alt="Assinatura da contratada" className="max-h-24" />
                    <span className="mt-2 text-xs text-[var(--color-ink-3)] uppercase tracking-wider">Contratada</span>
                  </div>
                )}
              </div>
              <div className="mt-4 flex items-center gap-2 p-4 rounded-xl bg-green-50 text-green-700 text-sm">
                <CheckCircle size={18} className="flex-shrink-0" />
                <div>
                  <p className="font-semibold">Contrato assinado com sucesso.</p>
                  <p className="text-green-600/90 text-xs mt-0.5">
                    {(justSigned?.signed_at || contract.signed_at) && `Assinado em ${fmtDateTime(justSigned?.signed_at || contract.signed_at!)}`}
                    {(justSigned?.signer_ip || contract.signer_ip) && ` • IP ${justSigned?.signer_ip || contract.signer_ip}`}
                  </p>
                </div>
              </div>
            </div>
          ) : expired ? (
            <p className="text-sm text-[var(--color-ink-3)] mt-2">Este link de assinatura expirou. Solicite um novo link.</p>
          ) : (
            <>
              <p className="text-sm text-[var(--color-ink-3)] mb-3">Ao assinar, você declara que leu e concorda com todos os termos acima.</p>
              <div className="relative border-2 border-dashed border-gray-300 rounded-xl h-44 bg-white">
                <SignaturePad ref={padRef} onChange={setSignEmpty} />
                {signEmpty && (
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-gray-300 text-sm">
                    Assine aqui com o mouse ou dedo
                  </span>
                )}
              </div>

              {signError && (
                <div className="mt-3 flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-600 text-sm">
                  <AlertCircle size={16} className="flex-shrink-0" /> {signError}
                </div>
              )}

              <div className="mt-4 flex items-center justify-end gap-3">
                <button type="button" onClick={() => padRef.current?.clear()}
                  className="flex items-center gap-2 px-5 py-2.5 border border-gray-200 text-[var(--color-ink-2)] rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer">
                  <RefreshCw size={16} /> Limpar
                </button>
                <button type="button" onClick={handleSign} disabled={signing}
                  className="btn-primary px-5">
                  {signing ? <Loader2 size={16} className="animate-spin" /> : <PenTool size={16} />}
                  Assinar Contrato
                </button>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-xs text-[var(--color-ink-3)] pb-4">
          {contract.valid_until ? `Link válido até ${fmtDate(contract.valid_until)} · ` : ''}GorillaOS
        </p>
      </div>
    </div>
  );
}
