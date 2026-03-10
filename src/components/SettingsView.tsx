import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Settings, Save, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export function SettingsView() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email && !password) return;

        setLoading(true);
        setMessage(null);

        try {
            const updates: { email?: string; password?: string } = {};
            if (email) updates.email = email;
            if (password) updates.password = password;

            const { error } = await supabase.auth.updateUser(updates);

            if (error) {
                throw error;
            }

            setMessage({ type: 'success', text: 'Dados atualizados com sucesso. Talvez seja necessário confirmar o email ou relogar.' });
            setEmail('');
            setPassword('');
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Erro ao atualizar os dados. Tente novamente.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-xl mx-auto bg-white/50 backdrop-blur-lg border border-white/60 rounded-3xl p-8 shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C13584] to-purple-600 shadow-md flex items-center justify-center text-white">
                    <Settings size={20} />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-gray-800">Minha Conta</h2>
                    <p className="text-sm text-gray-500">Altere seu e-mail ou redefina sua senha de acesso</p>
                </div>
            </div>

            {message && (
                <div className={`mb-6 flex items-center gap-2 p-4 rounded-xl text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    <p>{message.text}</p>
                </div>
            )}

            <form onSubmit={handleUpdate} className="flex flex-col gap-6">
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Novo E-mail</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Deixe em branco para não alterar"
                        className="w-full border border-white/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C13584] bg-white/60 backdrop-blur-sm shadow-inner transition-all"
                    />
                    <p className="text-xs text-gray-400 mt-1">Dependendo das configurações do servidor, a troca pode exigir confirmação via link no e-mail novo.</p>
                </div>

                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Nova Senha</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Deixe em branco para não alterar (mín. 6 caracteres)"
                        className="w-full border border-white/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C13584] bg-white/60 backdrop-blur-sm shadow-inner transition-all"
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading || (!email && !password)}
                    className="w-full bg-[#C13584] hover:bg-[#A42D70] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl py-3 px-4 shadow-lg shadow-pink-200 transition-all flex justify-center items-center gap-2 mt-4 cursor-pointer"
                >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    Salvar Alterações
                </button>
            </form>
        </div>
    );
}
