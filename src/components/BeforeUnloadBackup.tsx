"use client";

import { useEffect, useRef } from "react";
import { useBackupGuardContext } from "@/components/BackupModal";
import { supabase } from "@/lib/supabase";

/**
 * Componente sin UI que:
 * 1. Registra el evento `beforeunload` para mostrar el diálogo nativo del navegador.
 * 2. Cuando el usuario confirma la salida, el navegador cierra la página.
 *
 * Nota sobre el flujo:
 * - En cierres de pestaña/navegador, los navegadores modernos NO permiten mostrar UI personalizada.
 *   Solo se puede mostrar el diálogo nativo ("¿Salir de esta página?").
 * - Para el caso de LOGOUT y BOTÓN DE SALIDA, usamos el BackupModal completo.
 * - Este componente agrega la advertencia nativa del navegador como capa de protección.
 */
export default function BeforeUnloadBackup() {
    const { requestExitWithBackupCheck } = useBackupGuardContext();
    const isLoggedIn = useRef(false);

    useEffect(() => {
        // Verificar si hay sesión activa
        supabase.auth.getSession().then(({ data: { session } }) => {
            isLoggedIn.current = !!session;
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
            isLoggedIn.current = !!session;
        });

        /**
         * El evento beforeunload en navegadores modernos solo puede mostrar el diálogo nativo.
         * Si el usuario hace clic en "Salir" en el diálogo nativo, el navegador cerrará la página.
         * No podemos interceptar ese momento para mostrar UI.
         *
         * SOLUCIÓN: Usamos el botón de Salida dedicado (ExitButton) y el logout como puntos
         * donde sí podemos mostrar el modal completo de backup.
         */
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (!isLoggedIn.current) return;
            e.preventDefault();
            // Este mensaje puede o no mostrarse según el navegador; el texto nativo varía
            e.returnValue = "¿Desea salir? Considere hacer un backup de sus datos antes de cerrar.";
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
            subscription.unsubscribe();
        };
    }, [requestExitWithBackupCheck]);

    return null;
}
