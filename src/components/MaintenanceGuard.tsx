"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { AlertTriangle, Lock } from "lucide-react";
import { usePathname } from "next/navigation";

export default function MaintenanceGuard() {
    const [isMaintenance, setIsMaintenance] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const pathname = usePathname();

    useEffect(() => {
        // Ignorar la página de login para no bloquear el inicio de sesión
        if (pathname === '/login') {
            setLoading(false);
            return;
        }

        const checkStatus = async () => {
            try {
                // 1. Verificar si el usuario actual es admin
                const { data: { session } } = await supabase.auth.getSession();
                let userIsAdmin = false;
                
                if (session) {
                    const { data: userData } = await supabase
                        .from("users")
                        .select("role_global")
                        .eq("id", session.user.id)
                        .maybeSingle();
                        
                    if (userData?.role_global === "A") {
                        userIsAdmin = true;
                    }
                }
                setIsAdmin(userIsAdmin);

                // 2. Verificar estado de mantenimiento en un proyecto ficticio como configuración
                const { data: configProject } = await supabase
                    .from("projects")
                    .select("id, num_act, contractor_name")
                    .eq("name", "PACT_SYSTEM_CONFIG")
                    .maybeSingle();

                if (configProject && configProject.contractor_name === "MAINTENANCE_ON") {
                    setIsMaintenance(true);
                } else {
                    setIsMaintenance(false);
                }
            } catch (err) {
                console.error("Error validando mantenimiento", err);
            } finally {
                setLoading(false);
            }
        };

        checkStatus();

        // Polling cada 3 minutos para atrapar cambios rápidos
        const interval = setInterval(checkStatus, 3 * 60 * 1000);
        return () => clearInterval(interval);
    }, [pathname]);

    if (loading) return null;

    if (isMaintenance && !isAdmin) {
        return (
            <div className="fixed inset-0 z-[99999] bg-slate-900/95 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in fade-in duration-500">
                <div className="bg-white dark:bg-slate-900 border border-red-500/30 p-8 rounded-3xl shadow-2xl max-w-md w-full text-center space-y-6">
                    <div className="mx-auto w-24 h-24 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center text-red-500 mb-2 relative shadow-inner">
                        <Lock size={48} className="relative z-10" />
                        <div className="absolute inset-0 border-4 border-red-500 rounded-full animate-ping opacity-20"></div>
                    </div>
                    
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter mb-2">Sistema en Mantenimiento</h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium">
                            El administrador ha suspendido temporalmente el acceso a la plataforma PACT-Administradores para realizar actualizaciones o tareas críticas.
                        </p>
                    </div>
                    
                    <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-200 dark:border-amber-800 flex gap-3 text-left">
                        <AlertTriangle size={24} className="text-amber-500 shrink-0" />
                        <p className="text-xs font-bold text-amber-700 dark:text-amber-400">
                            Por favor, inténtelo de nuevo más tarde. Si está en medio de una tarea y cree que esto es un error, contacte con soporte IT.
                        </p>
                    </div>
                    
                    <button 
                        onClick={() => window.location.reload()}
                        className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 py-3 rounded-xl font-bold transition-all uppercase text-[11px] tracking-widest"
                    >
                        Volver a intentar
                    </button>
                    
                    <button onClick={async () => {
                        await supabase.auth.signOut();
                        window.location.href = "/login";
                    }} className="text-[10px] uppercase font-black tracking-widest text-slate-400 hover:text-red-500 mt-2 hover:underline">
                        Cerrar Sesión Segura
                    </button>
                </div>
            </div>
        );
    }

    return null; // Si no hay mantenimiento o si es Admin, simplemente no renderiza nada y permite usar la app
}
