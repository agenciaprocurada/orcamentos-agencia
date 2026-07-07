import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  Landmark, Save, Loader2, CheckCircle, AlertCircle, Plug, ShieldCheck, ShieldAlert,
} from 'lucide-react';
import type { AsaasEnvironment, IntegrationSettings } from '../types/database';

type Status = { hasKey: boolean; environment: AsaasEnvironment; enabled: boolean };

// Área de Configurações da integração com o Asaas.
// Guarda APENAS dados não-secretos (ambiente + ligado) na tabela
// integration_settings. A API key e o token do webhook vivem como secrets da
// Edge Function — esta tela só mostra o status e testa a conexão.
export function AsaasSettingsView() {
  const [settings, setSettings] = useState<IntegrationSettings | null>(null);
  const [environment, setEnvironment] = useState<AsaasEnvironment>('sandbox');
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadStatus = async () => {
    const { data } = await supabase.functions.invoke('asaas', { body: { action: 'status' } });
    if (data && !data.error) setStatus(data as Status);
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('integration_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (data) {
        setSettings(data as IntegrationSettings);
        setEnvironment(data.asaas_environment);
        setEnabled(data.asaas_enabled);
      }
      await loadStatus();
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const payload = { asaas_environment: environment, asaas_enabled: enabled, updated_at: new Date().toISOString() };
      const q = settings?.id
        ? supabase.from('integration_settings').update(payload).eq('id', settings.id)
        : supabase.from('integration_settings').insert(payload);
      const { error } = await q;
      if (error) throw error;
      setMessage({ type: 'success', text: 'Configuração salva.' });
      await loadStatus();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao salvar.' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke('asaas', { body: { action: 'test' } });
      if (error) throw error;
      if (data?.error) {
        setMessage({ type: 'error', text: data.error });
      } else {
        setMessage({ type: 'success', text: `Conexão OK (ambiente ${data?.environment || environment}).` });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Falha ao testar.' });
    } finally {
      setTesting(false);
    }
  };

  const hasKey = status?.hasKey ?? false;

  return (
    <div className="bg-white/50 backdrop-blur-lg border border-white/60 rounded-3xl p-8 shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 shadow-md flex items-center justify-center text-white">
          <Landmark size={20} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[var(--color-ink)]">Integração Asaas</h2>
          <p className="text-sm text-[var(--color-ink-3)]">Emissão de boletos das parcelas no Fluxo de Caixa</p>
        </div>
      </div>

      {message && (
        <div className={`mb-6 flex items-center gap-2 p-4 rounded-xl text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <p>{message.text}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-[var(--color-ink-3)] text-sm py-6">
          <Loader2 size={18} className="animate-spin" /> Carregando…
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Status da chave (secret) */}
          <div className={`flex items-start gap-3 p-4 rounded-xl border text-sm ${hasKey ? 'bg-green-50 border-green-200 text-green-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
            {hasKey ? <ShieldCheck size={18} className="mt-0.5" /> : <ShieldAlert size={18} className="mt-0.5" />}
            <div>
              <p className="font-semibold">
                {hasKey ? 'Chave da API configurada' : 'Chave da API não configurada'}
              </p>
              <p className="text-xs mt-0.5 opacity-90">
                Por segurança, a chave do Asaas fica como <strong>secret</strong> da Edge Function, nunca no navegador.
                {!hasKey && ' Peça ao administrador para definir o secret ASAAS_API_KEY.'}
              </p>
            </div>
          </div>

          {/* Ambiente */}
          <div>
            <label className="block text-sm font-semibold text-[var(--color-ink-2)] mb-2">Ambiente</label>
            <div className="grid grid-cols-2 gap-3">
              {(['sandbox', 'production'] as AsaasEnvironment[]).map((env) => (
                <button
                  key={env}
                  type="button"
                  onClick={() => setEnvironment(env)}
                  className={`px-4 py-3 rounded-xl text-sm font-semibold border transition-all cursor-pointer ${environment === env
                    ? 'bg-[#C13584] text-white border-[#C13584] shadow-lg shadow-pink-200'
                    : 'bg-white/60 text-[var(--color-ink-2)] border-white/60 hover:bg-white/80'}`}
                >
                  {env === 'sandbox' ? 'Sandbox (testes)' : 'Produção (boletos reais)'}
                </button>
              ))}
            </div>
            <p className="text-xs text-[var(--color-ink-3)] mt-1">
              Ao trocar o ambiente, o secret ASAAS_API_KEY também precisa ser a chave correspondente.
            </p>
          </div>

          {/* Ligar/desligar */}
          <label className="flex items-center justify-between gap-3 p-4 rounded-xl bg-white/60 border border-white/60 cursor-pointer">
            <div>
              <p className="text-sm font-semibold text-[var(--color-ink-2)]">Integração ativada</p>
              <p className="text-xs text-[var(--color-ink-3)]">Quando desligada, o sistema não gera boletos.</p>
            </div>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="w-5 h-5 accent-[#C13584] cursor-pointer"
            />
          </label>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-[#C13584] hover:bg-[#A42D70] disabled:opacity-50 text-white font-bold rounded-xl py-3 px-4 shadow-lg shadow-pink-200 transition-all flex justify-center items-center gap-2 cursor-pointer"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Salvar
            </button>
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || !hasKey}
              title={!hasKey ? 'Configure a chave da API primeiro' : 'Testar conexão com o Asaas'}
              className="px-5 bg-white/70 hover:bg-white disabled:opacity-50 text-[var(--color-ink-2)] font-semibold rounded-xl py-3 border border-white/60 transition-all flex items-center gap-2 cursor-pointer"
            >
              {testing ? <Loader2 size={18} className="animate-spin" /> : <Plug size={18} />}
              Testar conexão
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
