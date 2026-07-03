import { useState, useEffect } from 'react';
import { Bell, BellRing, BellOff, Loader2 } from 'lucide-react';
import { getPushState, enablePush, disablePush, type PushState } from '../lib/push';

// Botão para ligar/desligar os avisos de novos leads neste dispositivo.
// Cada navegador/aparelho precisa ativar uma vez (a inscrição é por dispositivo).
export function PushToggle() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    getPushState().then(setState);
  }, []);

  if (state === null) return null; // ainda verificando
  if (state === 'unsupported') return null; // navegador sem suporte a push

  const activate = async () => {
    setBusy(true);
    setMsg(null);
    const res = await enablePush();
    setBusy(false);
    if (res.ok) {
      setState('subscribed');
      setMsg('Avisos ativados neste dispositivo.');
    } else if (res.reason === 'denied') {
      setState('denied');
    } else {
      setMsg('Não foi possível ativar. Tente novamente.');
    }
  };

  const deactivate = async () => {
    setBusy(true);
    setMsg(null);
    await disablePush();
    setBusy(false);
    setState('idle');
  };

  if (state === 'denied') {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-xs text-[var(--color-ink-3)]"
        title="As notificações estão bloqueadas nas permissões do navegador para este site. Libere lá para ativar."
      >
        <BellOff size={15} /> Avisos bloqueados
      </span>
    );
  }

  const subscribed = state === 'subscribed';

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={subscribed ? deactivate : activate}
        disabled={busy}
        className={`inline-flex items-center gap-1.5 rounded-[var(--radius-btn)] px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 ${
          subscribed
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
            : 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]'
        }`}
        title={subscribed ? 'Clique para desativar os avisos neste dispositivo' : 'Receber notificação quando entrar um novo lead'}
      >
        {busy ? (
          <Loader2 size={15} className="animate-spin" />
        ) : subscribed ? (
          <BellRing size={15} />
        ) : (
          <Bell size={15} />
        )}
        {subscribed ? 'Avisos ativos' : 'Ativar avisos de leads'}
      </button>
      {msg && <span className="text-xs text-[var(--color-ink-3)]">{msg}</span>}
    </div>
  );
}
