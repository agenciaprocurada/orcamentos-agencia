-- Web Push — inscrições dos dispositivos que recebem aviso de novos leads.
--
-- Cada navegador/dispositivo do admin que ativa notificações grava uma linha
-- aqui (endpoint + chaves da Push API). A Edge Function `leads` lê esta tabela
-- via service_role e dispara o push para todos os endpoints ao entrar um lead.

CREATE TABLE public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    endpoint text UNIQUE NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    user_agent text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Só o admin logado cria/lê/remove suas inscrições pelo app.
-- O envio é feito pela Edge Function com service_role (ignora o RLS).
CREATE POLICY "Authenticated manage push subscriptions" ON public.push_subscriptions
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
