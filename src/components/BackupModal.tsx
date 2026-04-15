"use client";

import { useState, useCallback, createContext, useContext, useRef } from "react";
import { Database, Download, X, AlertTriangle, CheckCircle2, Loader2, ShieldCheck, LogOut } from "lucide-react";
import { generateAndDownloadBackup } from "@/lib/backupService";
import { supabase } from "@/lib/supabase";

// ─────────────────────────────────────────────────────────
// Context para compartir el modal con toda la aplicación
// ─────────────────────────────────────────────────────────
interface BackupGuardContextValue {
    requestExitWithBackupCheck: (onConfirm: () => void, triggerLabel?: string) => void;
}

const BackupGuardContext = createContext<BackupGuardContextValue>({
    requestExitWithBackupCheck: (onConfirm) => onConfirm(),
});

export function useBackupGuardContext() {
    return useContext(BackupGuardContext);
}

// ─────────────────────────────────────────────────────────
// Provider + Modal combinados
// ─────────────────────────────────────────────────────────
export function BackupGuardProvider({ children }: { children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [backupFilename, setBackupFilename] = useState<string | null>(null);
    const [projectsCount, setProjectsCount] = useState<number>(0);
    const pendingAction = useRef<(() => void) | null>(null);

    /** Abre el modal y guarda la acción que debe ejecutarse al salir */
    const requestExitWithBackupCheck = useCallback((onConfirm: () => void, _triggerLabel?: string) => {
        pendingAction.current = onConfirm;
        setStatus("idle");
        setErrorMsg(null);
        setBackupFilename(null);
        setIsOpen(true);
    }, []);

    const executeAction = useCallback(() => {
        setIsOpen(false);
        const action = pendingAction.current;
        pendingAction.current = null;
        if (action) action();
    }, []);

    /** Usuario elige NO hacer backup → salir de inmediato */
    const handleSkip = useCallback(() => {
        executeAction();
    }, [executeAction]);

    /** Usuario elige SÍ hacer backup */
    const handleBackup = useCallback(async () => {
        setStatus("loading");
        setErrorMsg(null);

        const result = await generateAndDownloadBackup();

        if (result.success) {
            setBackupFilename(result.filename || null);
            setProjectsCount(result.projectsCount || 0);
            setStatus("success");
        } else if (result.error === "CANCELLED") {
            // Usuario canceló el selector de archivos → volver a estado idle
            setStatus("idle");
        } else {
            setErrorMsg(result.error || "Error desconocido.");
            setStatus("error");
        }
    }, []);

    /** Después de backup exitoso → continuar con la salida */
    const handleContinueAfterBackup = useCallback(() => {
        executeAction();
    }, [executeAction]);

    /** Reintentar backup */
    const handleRetry = useCallback(() => {
        setStatus("idle");
        setErrorMsg(null);
    }, []);

    return (
        <BackupGuardContext.Provider value={{ requestExitWithBackupCheck }}>
            {children}

            {isOpen && (
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="backup-modal-title"
                >
                    {/* Overlay */}
                    <div
                        className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm"
                        onClick={status === "loading" ? undefined : handleSkip}
                    />

                    {/* Panel */}
                    <div className="relative w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        
                        {/* Header */}
                        <div className="bg-gradient-to-r from-blue-700 to-blue-600 px-6 py-5 flex items-center gap-3">
                            <div className="p-2 bg-white/20 rounded-xl">
                                <Database size={22} className="text-white" />
                            </div>
                            <div>
                                <h2 id="backup-modal-title" className="text-white font-black text-base leading-tight">
                                    Backup de Datos
                                </h2>
                                <p className="text-blue-200 text-[11px] font-medium mt-0.5 leading-tight">
                                    PACT · Sistema de Control de Proyectos
                                </p>
                            </div>
                            {status !== "loading" && (
                                <button
                                    onClick={handleSkip}
                                    className="ml-auto p-1.5 rounded-lg hover:bg-white/20 text-white/70 hover:text-white transition-colors"
                                    aria-label="Cerrar"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>

                        {/* Body */}
                        <div className="p-6">
                            {/* ── ESTADO IDLE ── */}
                            {status === "idle" && (
                                <>
                                    <div className="flex items-start gap-3 mb-5">
                                        <div className="p-2.5 bg-amber-50 rounded-xl shrink-0 mt-0.5">
                                            <ShieldCheck size={20} className="text-amber-500" />
                                        </div>
                                        <div>
                                            <p className="text-slate-800 font-bold text-sm leading-snug">
                                                ¿Desea realizar un backup antes de salir?
                                            </p>
                                            <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
                                                Se generará un archivo JSON con todos los datos de los proyectos
                                                a los que usted tiene acceso. Podrá elegir dónde guardarlo en su equipo.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="bg-blue-50 rounded-xl p-3 mb-5 border border-blue-100">
                                        <p className="text-[11px] text-blue-700 font-semibold flex items-center gap-1.5">
                                            <Database size={12} />
                                            El backup incluye: proyectos, certificaciones, ítems de contrato, personal, compliance, logs de campo y más.
                                        </p>
                                    </div>

                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <button
                                            onClick={handleBackup}
                                            className="flex-1 flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 active:scale-[0.98] text-white font-bold text-sm py-3 px-4 rounded-xl transition-all shadow-md shadow-blue-700/20"
                                        >
                                            <Download size={16} />
                                            Sí, realizar backup
                                        </button>
                                        <button
                                            onClick={handleSkip}
                                            className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-700 font-bold text-sm py-3 px-4 rounded-xl transition-all"
                                        >
                                            <LogOut size={16} />
                                            No, salir sin backup
                                        </button>
                                    </div>
                                </>
                            )}

                            {/* ── ESTADO LOADING ── */}
                            {status === "loading" && (
                                <div className="flex flex-col items-center py-6 gap-4">
                                    <div className="relative">
                                        <div className="w-16 h-16 rounded-full border-4 border-blue-100 flex items-center justify-center">
                                            <Loader2 size={32} className="text-blue-600 animate-spin" />
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-slate-800 font-bold text-sm">Generando backup…</p>
                                        <p className="text-slate-500 text-xs mt-1">
                                            Recopilando datos de sus proyectos. Por favor espere.
                                        </p>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                        <div className="h-full bg-blue-600 rounded-full animate-pulse w-4/5" />
                                    </div>
                                </div>
                            )}

                            {/* ── ESTADO SUCCESS ── */}
                            {status === "success" && (
                                <>
                                    <div className="flex flex-col items-center py-4 gap-3 mb-5">
                                        <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center">
                                            <CheckCircle2 size={32} className="text-emerald-500" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-slate-800 font-black text-base">
                                                ¡Backup completado!
                                            </p>
                                            <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
                                                {projectsCount} proyecto{projectsCount !== 1 ? "s" : ""} respaldado{projectsCount !== 1 ? "s" : ""} exitosamente.
                                            </p>
                                        </div>
                                    </div>

                                    {backupFilename && (
                                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 mb-5 flex items-start gap-2">
                                            <Download size={14} className="text-emerald-600 mt-0.5 shrink-0" />
                                            <div>
                                                <p className="text-[11px] text-emerald-700 font-bold">Archivo guardado:</p>
                                                <p className="text-[10px] text-emerald-600 font-mono break-all">{backupFilename}</p>
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        onClick={handleContinueAfterBackup}
                                        className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold text-sm py-3 px-4 rounded-xl transition-all shadow-md shadow-emerald-600/20"
                                    >
                                        <LogOut size={16} />
                                        Continuar y salir
                                    </button>
                                </>
                            )}

                            {/* ── ESTADO ERROR ── */}
                            {status === "error" && (
                                <>
                                    <div className="flex items-start gap-3 mb-5">
                                        <div className="p-2.5 bg-red-50 rounded-xl shrink-0 mt-0.5">
                                            <AlertTriangle size={20} className="text-red-500" />
                                        </div>
                                        <div>
                                            <p className="text-slate-800 font-bold text-sm">Error al generar el backup</p>
                                            <p className="text-red-500 text-xs mt-1.5 leading-relaxed font-mono">
                                                {errorMsg}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <button
                                            onClick={handleRetry}
                                            className="flex-1 flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 active:scale-[0.98] text-white font-bold text-sm py-3 px-4 rounded-xl transition-all shadow-md shadow-blue-700/20"
                                        >
                                            <Download size={16} />
                                            Intentar de nuevo
                                        </button>
                                        <button
                                            onClick={handleSkip}
                                            className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-700 font-bold text-sm py-3 px-4 rounded-xl transition-all"
                                        >
                                            <LogOut size={16} />
                                            Salir sin backup
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 pb-4">
                            <p className="text-[10px] text-slate-400 text-center font-medium">
                                Diseñado por Ing. Enrique Saavedra Sada, PE · PACT v2026
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </BackupGuardContext.Provider>
    );
}
