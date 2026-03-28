"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Users, X, ShieldAlert } from "lucide-react";
import { useState, useEffect } from "react";
import ProjectMemberships from "./ProjectMemberships";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function ProjectHeaderActions() {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const [role, setRole] = useState("C");
    const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
    
    const searchParams = useSearchParams();
    const projectId = searchParams.get("id");

    // Only show if we are on a project detail page OR if we are global admin
    const isProjectDetail = pathname?.startsWith("/proyectos/detalle");
    const isLoginPage = pathname === "/login";
    
    useEffect(() => {
        fetchUserRole();
    }, [isProjectDetail, projectId, isLoginPage]);

    const fetchUserRole = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || isLoginPage) return;

        const userId = session.user.id;
        
        // Check global level first
        const { data: userData } = await supabase.from("users").select("role_global").eq("id", userId).single();
        if (userData?.role_global === "A") {
            setRole("A");
            setIsGlobalAdmin(true);
            return;
        }

        // Check memberships if in project detail
        if (isProjectDetail && projectId) {
            const { data: memData } = await supabase.from("memberships").select("role").eq("project_id", projectId).eq("user_id", userId).single();
            if (memData) setRole(memData.role);
        }
    };

    // Show button ONLY for global admins (not for regular project members)
    const shouldShow = (!isLoginPage && isGlobalAdmin);

    if (!shouldShow) return null;

    return (
        <>
            <Link 
                    href="/admin/requests"
                    className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-2xl transition-all text-white font-black text-[11px] uppercase tracking-widest border border-white/20 backdrop-blur-md"
                    suppressHydrationWarning
                >
                    <Users size={16} className="text-blue-200" />
                    <span>Usuarios</span>
                </Link>

            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setIsOpen(false)}></div>
                    <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                                    <Users className="text-primary" size={28} /> Gestión de Colaboradores
                                </h3>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                                    Nivel de Acceso: {isGlobalAdmin ? "Administrador Global (Programa)" : `Nivel ${role}`}
                                </p>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="p-3 bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/40 text-slate-400 hover:text-red-500 rounded-2xl transition-all">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-8 max-h-[75vh] overflow-y-auto custom-scrollbar">
                            {isGlobalAdmin ? (
                                <div className="space-y-8">
                                    <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800 p-6 rounded-3xl flex items-center gap-6">
                                        <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center text-amber-600 shrink-0">
                                            <ShieldAlert size={32} />
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-black text-slate-900 dark:text-white">Panel de Administración Global</h4>
                                            <p className="text-sm text-slate-500 font-medium">Como Administrador del Programa, puedes gestionar solicitudes de acceso globales o navegar a un proyecto para gestionar sus miembros específicos.</p>
                                        </div>
                                        <Link 
                                            href="/admin/requests" 
                                            onClick={() => setIsOpen(false)}
                                            className="ml-auto bg-primary text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:scale-105 transition-all text-center"
                                        >
                                            Ver Solicitudes
                                        </Link>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Link 
                                            href="/proyectos" 
                                            onClick={() => setIsOpen(false)}
                                            className="p-8 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800 hover:border-primary/50 transition-all text-center group"
                                        >
                                            <Users size={32} className="mx-auto text-primary mb-4 group-hover:scale-110 transition-transform" />
                                            <h5 className="font-bold text-slate-900 dark:text-white">Gestionar por Proyecto</h5>
                                            <p className="text-xs text-slate-400 mt-2">Selecciona un proyecto para dar de alta a nuevos colaboradores.</p>
                                        </Link>
                                        
                                        <div className="p-8 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800 opacity-60 flex flex-col items-center justify-center italic text-slate-400">
                                            <p className="text-xs font-medium">Próximamente: Buscador global de usuarios</p>
                                        </div>
                                    </div>

                                    {projectId && (
                                        <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Acceso rápido a este proyecto:</h4>
                                            <ProjectMemberships projectId={projectId} currentUserRole={role} />
                                        </div>
                                    )}
                                </div>
                            ) : projectId ? (
                                <ProjectMemberships projectId={projectId} currentUserRole={role} />
                            ) : (
                                <div className="text-center py-12 text-slate-400 italic font-medium">
                                    Por favor, selecciona un proyecto para gestionar colaboradores.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
