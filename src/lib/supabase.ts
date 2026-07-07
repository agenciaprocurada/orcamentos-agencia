import { createClient, type User } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase variables are missing from .env');
}

export const supabase = createClient<any>(supabaseUrl, supabaseAnonKey);

// Reads the session persisted by supabase-js synchronously, so the UI can
// render logged-in immediately on refresh instead of waiting for getSession().
// onAuthStateChange remains the source of truth and corrects this if the
// stored session turns out to be invalid.
const authStorageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
export function getStoredUser(): User | null {
    try {
        const raw = localStorage.getItem(authStorageKey);
        if (!raw) return null;
        return JSON.parse(raw)?.user ?? null;
    } catch {
        return null;
    }
}
