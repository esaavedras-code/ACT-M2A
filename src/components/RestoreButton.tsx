"use client";

import { useSearchParams } from "next/navigation";
import { RotateCcw, Check, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function RestoreButton() {
    const searchParams = useSearchParams();
    const projectId = searchParams.get("id");
    const [isUndoing, setIsUndoing] = useState(false);
    const [undoStatus, setUndoStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [role, setRole] = useState("C");
    const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);

    useEffect(() => {
        fetchUserRole();
    }, [projectId]);

    const fetchUserRole = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const userId = session.user.id;
        
        // Check global level first
        const { data: userData } = await supabase.from("users").select("role_global").eq("id", userId).single();
        if (userData?.role_global === "A") {
            setRole("A");
            setIsGlobalAdmin(true);
            return;
        }

        if (projectId) {
            const { data: memData } = await supabase.from("memberships").select("role").eq("project_id", projectId).eq("user_id", userId).single();
            if (memData) setRole(memData.role);
        }
    };

    const handleUndo = async () => {
        if (!projectId || isUndoing) return;
        
        if (!confirm("¿Estás seguro de que deseas deshacer la última acción grabada en este proyecto?")) return;

        setIsUndoing(true);
        setUndoStatus('idle');

        try {
            // Get the last audit log entry for this project
            const { data: lastLog, error: fetchError } = await supabase
                .from("audit_log")
                .select("*")
                .eq("proyecto_id", projectId)
                .order("timestamp_utc", { ascending: false })
                .limit(1)
                .single();

            if (fetchError || !lastLog) {
                console.error("No se encontró ninguna acción para deshacer:", fetchError);
                setUndoStatus('error');
                setTimeout(() => setUndoStatus('idle'), 3000);
                return;
            }

            if (!lastLog.datos_anteriores) {
                alert("La última acción no tiene datos previos registrados para deshacer.");
                setUndoStatus('error');
                setTimeout(() => setUndoStatus('idle'), 3000);
                return;
            }

            // Perform the undo: restore previous data
            const { error: undoError } = await supabase
                .from(lastLog.tabla)
                .update(lastLog.datos_anteriores)
                .eq("id", lastLog.fila_id);

            if (undoError) {
                console.error("Error al restaurar datos:", undoError);
                setUndoStatus('error');
            } else {
                // Delete the log entry so we can't undo it twice (or we could mark it)
                await supabase.from("audit_log").delete().eq("id", lastLog.id);
                setUndoStatus('success');
                // Refresh the page to reflect changes
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            }
        } catch (err) {
            console.error("Excepción en Undo:", err);
            setUndoStatus('error');
        } finally {
            setIsUndoing(false);
            if (undoStatus !== 'success') {
                setTimeout(() => setUndoStatus('idle'), 3000);
            }
        }
    };

    // Show button for global admins OR for project admins (Level B) when in a project
    const shouldShow = projectId && (isGlobalAdmin || role === "B");

    if (!shouldShow) return null;

    return (
        <button 
            onClick={handleUndo}
            disabled={isUndoing}
            title="Deshacer última acción (Restore)"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all font-bold text-[11px] uppercase tracking-wide border backdrop-blur-md shrink-0 ${
                undoStatus === 'success' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200' :
                undoStatus === 'error' ? 'bg-red-500/20 border-red-500 text-red-200' :
                'bg-white/10 hover:bg-white/20 border-white/20 text-white'
            }`}
        >
            {isUndoing ? (
                <RotateCcw size={14} className="animate-spin" />
            ) : undoStatus === 'success' ? (
                <Check size={14} />
            ) : undoStatus === 'error' ? (
                <AlertCircle size={14} />
            ) : (
                <RotateCcw size={14} className="text-blue-200" />
            )}
            <span className="hidden md:inline">{undoStatus === 'success' ? 'Hecho' : undoStatus === 'error' ? 'Error' : 'Restore'}</span>
        </button>
    );
}
