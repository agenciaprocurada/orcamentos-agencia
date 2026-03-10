require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing env variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createAdmin() {
    console.log('Tentando criar usuário admin...');
    const { data, error } = await supabase.auth.signUp({
        email: 'admin@octaos.com',
        password: 'adminpassword123',
    });

    if (error) {
        console.error('Erro ao criar usuário:', error.message);
    } else {
        console.log('Usuário admin criado com sucesso (ou já existe)!');
        console.log('Dados:', data.user?.email);
    }
}

createAdmin();
