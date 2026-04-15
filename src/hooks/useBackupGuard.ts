"use client";

import { useEffect, useRef, useState } from "react";
import { generateAndDownloadBackup } from "@/lib/backupService";
import { supabase } from "@/lib/supabase";

export type BackupTrigger = "logout" | "exit-button" | "beforeunload" | null;

interface UseBackupGuardReturn {
    isBackupModalOpen: boolean;
    currentTrigger: BackupTrigger;
    openBackupModal: (trigger: BackupTrigger) => void;
    confirmNoBackup: () => void;
    handleBackupAndExit: () => Promise<void>;
    isLoggedIn: boolean;
}

/**
 * Hook que:
 * 1. Detecta si el usuario está logueado.
 * 2. Intercepta el evento `beforeunload` (cierre de pestaña / navegador).
 * 3. Expone métodos para disparar el modal de backup desde logout / botón de salida.
 */
export function useBackupGuard(): UseBackupGuardReturn {
    const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
    const [currentTrigger, setCurrentTrigger] = useState<BackupTrigger>(null);
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    // Guardamos el callback de acción post-backup para ejecutarlo después
    const pendingActionRef = useRef<(() => void) | null>(null);
    // Flag para saber si el beforeunload fue cancelado por el modal
    const backupModalShownRef = useRef(false);

    // Detectar si el usuario está logueado
    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setIsLoggedIn(!!session);
        };
        checkSession();
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
            setIsLoggedIn(!!session);
        });
        return () => subscription.unsubscribe();
    }, []);

    // Interceptar cierre de pestaña / navegador
    useEffect(() => {
        if (!isLoggedIn) return;

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            // Mostrar el diálogo nativo del navegador para que el usuario pueda cancelar
            // (el diálogo de backup lo mostramos solo si el usuario cancela)
            e.preventDefault();
            // returnValue vacío activa el diálogo nativo del browser
            e.returnValue = "";
        };

        const handleUnload = () => {
            // No hay forma confiable de mostrar UI en unload;
            // el usuario ya decidió salir en este punto
        };

        // Para Chrome/Edge/Firefox, el beforeunload muestra el diálogo nativo
        // Solo podemos mostrar nuestro modal ANTES de que el usuario intente cerrar,
        // así que usamos pagehide + visibilitychange para intentar capturar la salida
        const handleVisibilityChange = () => {
            if (document.visibilityState === "hidden" && !backupModalShownRef.current) {
                // La página se ocultó (puede ser cierre inminente)
                // No podemos mostrar UI aquí confiablemente en todos los browsers
            }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [isLoggedIn]);

    /** Abre el modal de backup con un trigger específico */
    const openBackupModal = (trigger: BackupTrigger, onConfirmNoBackup?: () => void) => {
        setCurrentTrigger(trigger);
        setIsBackupModalOpen(true);
        if (onConfirmNoBackup) {
            pendingActionRef.current = onConfirmNoBackup;
        }
    };

    /** El usuario eligió NO hacer backup → ejecutar acción pendiente */
    const confirmNoBackup = () => {
        setIsBackupModalOpen(false);
        const action = pendingActionRef.current;
        pendingActionRef.current = null;
        if (action) action();
    };

    /** Hace el backup y luego ejecuta la acción pendiente */
    const handleBackupAndExit = async () => {
        // El modal se encarga del UX durante el proceso
        // Esta función sólo dispara el servicio; el resultado se maneja en el modal
        const result = await generateAndDownloadBackup();
        return result;
    };

    return {
        isBackupModalOpen,
        currentTrigger,
        openBackupModal,
        confirmNoBackup,
        handleBackupAndExit,
        isLoggedIn,
    };
}
