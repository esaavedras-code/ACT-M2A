"use client";

import { LogOut } from "lucide-react";
import { useBackupGuardContext } from "@/components/BackupModal";
import { supabase } from "@/lib/supabase";
import { useState, useEffect } from "react";

/**
 * Botón de salida manual que aparece en la barra superior (MainHeader).
 * Al hacer clic muestra el modal de backup antes de hacer logout.
 */
export default function ExitButton() {
    const { requestExitWithBackupCheck } = useBackupGuardContext();
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        const check = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setIsLoggedIn(!!session);
        };
        check();
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setIsLoggedIn(!!s));
        return () => subscription.unsubscribe();
    }, []);

    if (!isLoggedIn) return null;

    const doLogout = async () => {
        try {
            localStorage.removeItem("pact_registration");
            sessionStorage.removeItem("pact_registration");
            localStorage.removeItem("pact_keep_connected");
        } catch (_) {}
        await supabase.auth.signOut();
        window.location.href = "/login";
    };

    const handleClick = () => {
        requestExitWithBackupCheck(doLogout, "exit-button");
    };

    return (
        <button
            onClick={handleClick}
            id="pact-exit-button"
            title="Salir del sistema"
            aria-label="Salir del sistema"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-red-500/80 active:scale-95 border border-white/20 hover:border-red-400 text-white text-[11px] font-bold uppercase tracking-wide transition-all duration-200 group shrink-0"
        >
            <LogOut
                size={14}
                className="transition-transform duration-200 group-hover:translate-x-0.5"
            />
            <span className="hidden sm:inline">Salir</span>
        </button>
    );
}
