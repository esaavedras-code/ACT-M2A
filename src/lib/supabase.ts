import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Configuración de almacenamiento personalizado para respetar la preferencia del usuario
const customStorage = {
    getItem: (key: string): string | null => {
        if (typeof window === 'undefined') return null;
        try {
            // Verificamos la preferencia para saber dónde buscar primero
            const keepConnected = localStorage.getItem('pact_keep_connected') === 'true';
            
            if (keepConnected) {
                const item = localStorage.getItem(key);
                if (item) return item;
            }
            
            // Si no está en la ubicación preferida o no hay preferencia, probamos ambas
            return sessionStorage.getItem(key) || localStorage.getItem(key);
        } catch (e) {
            console.warn("Storage access denied:", e);
            return null;
        }
    },
    setItem: (key: string, value: string): void => {
        if (typeof window === 'undefined') return;
        try {
            // Verificamos si el usuario marcó "Mantener sesión iniciada"
            // Esta preferencia se guarda en el login
            const keepConnected = localStorage.getItem('pact_keep_connected') === 'true';

            if (keepConnected) {
                localStorage.setItem(key, value);
                sessionStorage.removeItem(key);
            } else {
                sessionStorage.setItem(key, value);
                localStorage.removeItem(key);
            }
        } catch (e) {
            console.warn("Storage access denied:", e);
        }
    },
    removeItem: (key: string): void => {
        if (typeof window === 'undefined') return;
        try {
            localStorage.removeItem(key);
            sessionStorage.removeItem(key);
        } catch (e) {
            console.warn("Storage access denied:", e);
        }
    },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        storage: customStorage,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});
