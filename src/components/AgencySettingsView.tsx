import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Building2, Save, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import type { AgencySettings } from '../types/database';

// Agency (CONTRATADA) legal data. Feeds the {{AGENCIA_*}} contract variables.
export function AgencySettingsView({ onSaved }: { onSaved?: () => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [id, setId] = useState<string | null>(null);
  const [form, setForm] = useState({
    razao_social: '', cnpj: '', endereco: '', cidade: '', uf: '', email: '', telefone: '',
    pix_key: '', pix_beneficiario: '',
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('agency_settings')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        const a = data as AgencySettings;
        setId(a.id);
        setForm({
          razao_social: a.razao_social || '', cnpj: a.cnpj || '', endereco: a.endereco || '',
          cidade: a.cidade || '', uf: a.uf || '', email: a.email || '', telefone: a.telefone || '',
          pix_key: a.pix_key || '', pix_beneficiario: a.pix_beneficiario || '',
        });
      }
      setLoading(false);
    })();
  }, []);

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const payload = { ...form, updated_at: new Date().toISOString() };
      if (id) {
        const { error } = await supabase.from('agency_settings').update(payload).eq('id', id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('agency_settings').insert(form).select().single();
        if (error) throw error;
        setId(data.id);
      }
      setMessage({ type: 'success', text: 'Dados da agência salvos com sucesso.' });
      onSaved?.();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao salvar os dados.' });
    } finally {
      setSaving(false);
    }
  };

  const fieldClass = 'w-full border border-white/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C13584] bg-white/60 backdrop-blur-sm shadow-inner transition-all';

  return (
    <div className="bg-white/50 backdrop-blur-lg border border-white/60 rounded-3xl p-8 shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C13584] to-purple-600 shadow-md flex items-center justify-center text-white">
          <Building2 size={20} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800">Dados da Agência</h2>
          <p className="text-sm text-gray-500">Usados nos contratos via variáveis <span className="font-mono text-[#C13584]">{'{{AGENCIA_...}}'}</span></p>
        </div>
      </div>

      {message && (
        <div className={`mb-6 flex items-center gap-2 p-4 rounded-xl text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <p>{message.text}</p>
        </div>
      )}

      {loading ? (
        <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-[#C13584]" size={28} /></div>
      ) : (
        <form onSubmit={handleSave} className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Razão Social <span className="font-mono text-xs text-[#C13584]">{'{{AGENCIA_RAZAO_SOCIAL}}'}</span></label>
            <input type="text" value={form.razao_social} onChange={e => set('razao_social', e.target.value)} className={fieldClass} placeholder="Ex: OCTO Marketing Digital LTDA" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">CNPJ <span className="font-mono text-xs text-[#C13584]">{'{{AGENCIA_CNPJ}}'}</span></label>
              <input type="text" value={form.cnpj} onChange={e => set('cnpj', e.target.value)} className={fieldClass} placeholder="00.000.000/0001-00" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">E-mail <span className="font-mono text-xs text-[#C13584]">{'{{AGENCIA_EMAIL}}'}</span></label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className={fieldClass} placeholder="contato@agencia.com" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Endereço <span className="font-mono text-xs text-[#C13584]">{'{{AGENCIA_ENDERECO}}'}</span></label>
            <input type="text" value={form.endereco} onChange={e => set('endereco', e.target.value)} className={fieldClass} placeholder="Rua, número, bairro, CEP" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Cidade <span className="font-mono text-xs text-[#C13584]">{'{{AGENCIA_CIDADE}}'}</span></label>
              <input type="text" value={form.cidade} onChange={e => set('cidade', e.target.value)} className={fieldClass} placeholder="Cachoeirinha" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">UF <span className="font-mono text-xs text-[#C13584]">{'{{AGENCIA_UF}}'}</span></label>
              <input type="text" maxLength={2} value={form.uf} onChange={e => set('uf', e.target.value.toUpperCase())} className={fieldClass} placeholder="RS" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Telefone <span className="font-mono text-xs text-[#C13584]">{'{{AGENCIA_TELEFONE}}'}</span></label>
              <input type="text" value={form.telefone} onChange={e => set('telefone', e.target.value)} className={fieldClass} placeholder="(51) 99999-9999" />
            </div>
          </div>

          <div className="border-t border-white/50 pt-5 mt-1">
            <p className="text-sm font-bold text-gray-700 mb-3">Pagamento via PIX</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Chave PIX <span className="font-mono text-xs text-[#C13584]">{'{{CHAVE_PIX}}'}</span></label>
                <input type="text" value={form.pix_key} onChange={e => set('pix_key', e.target.value)} className={fieldClass} placeholder="CNPJ, e-mail, telefone ou chave aleatória" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Beneficiário <span className="font-mono text-xs text-[#C13584]">{'{{BENEFICIARIO_PIX}}'}</span></label>
                <input type="text" value={form.pix_beneficiario} onChange={e => set('pix_beneficiario', e.target.value)} className={fieldClass} placeholder="Nome do titular da conta" />
              </div>
            </div>
          </div>

          <button type="submit" disabled={saving}
            className="w-full bg-[#C13584] hover:bg-[#A42D70] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl py-3 px-4 shadow-lg shadow-pink-200 transition-all flex justify-center items-center gap-2 mt-2 cursor-pointer">
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Salvar Dados da Agência
          </button>
        </form>
      )}
    </div>
  );
}
