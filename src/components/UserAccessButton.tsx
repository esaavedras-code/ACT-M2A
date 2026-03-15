"use client";

import { useEffect, useState } from "react";
import { User, LogOut, ShieldCheck, Settings, Key } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function UserAccessButton() {
    const [userName, setUserName] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    useEffect(() => {
        const loadUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                // To fetch the name from public map if needed, or meta-data
                setUserName(session.user.user_metadata?.name || session.user.email?.split("@")[0] || "Usuario");
                setUserEmail(session.user.email || "Sin correo");
            } else {
                setUserName(null);
                setUserEmail(null);
            }
        };

        loadUser();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) {
                setUserName(session.user.user_metadata?.name || session.user.email?.split("@")[0] || "Usuario");
                setUserEmail(session.user.email || "Sin correo");
            } else {
                setUserName(null);
                setUserEmail(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    if (!userName) return null;

    const initials = userName
        .split(" ")
        .map(n => n[0])
        .join("")
        .toUpperCase()
        .substring(0, 2);

    const handleLogout = async () => {
        setIsMenuOpen(false);
        localStorage.removeItem("pact_registration"); // clean up legacy stuff
        await supabase.auth.signOut();
        window.location.href = "/login";
    };

    return (
        <div className="relative" suppressHydrationWarning>
            <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex items-center gap-2 group hover:bg-white/10 px-3 py-1.5 rounded-xl transition-all"
                suppressHydrationWarning
            >
                <div className="flex flex-col items-end hidden sm:flex">
                    <span className="text-xs font-bold text-white leading-none">{userName}</span>
                    <span className="text-[10px] text-blue-200 font-medium truncate max-w-[120px]">{userEmail}</span>
                </div>
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-[10px] font-black border border-white/30 backdrop-blur-md">
                    {initials}
                </div>
            </button>

            {isMenuOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsMenuOpen(false)}
                    ></div>
                    <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white shrink-0 scale-90">
                                <User size={20} />
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{userName}</p>
                                <p className="text-[10px] text-slate-500 font-medium font-mono uppercase tracking-tighter truncate">{userEmail}</p>
                            </div>
                        </div>
                        <div className="p-2 space-y-1">
                            <button
                                onClick={() => { setIsMenuOpen(false); window.location.href = "/perfil"; }}
                                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all group"
                            >
                                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg group-hover:bg-primary/10 transition-colors text-slate-500 group-hover:text-primary">
                                    <Settings size={16} />
                                </div>
                                <div className="text-left">
                                    <span className="block text-sm font-bold">Mi Perfil</span>
                                    <span className="text-[10px] text-slate-400 font-medium">Gestionar nombre y proyectos</span>
                                </div>
                            </button>

                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-700 dark:text-slate-300 hover:text-red-500 transition-all group"
                            >
                                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg group-hover:bg-red-500/10 transition-colors text-slate-500 group-hover:text-red-500">
                                    <LogOut size={16} />
                                </div>
                                <div className="text-left">
                                    <span className="block text-sm font-bold">Cerrar Sesión</span>
                                    <span className="text-[10px] text-slate-400 font-medium">Salir del sistema protegido</span>
                                </div>
                            </button>
                            
                            <div className="mt-2 p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100/50 dark:border-blue-800/50">
                                <div className="flex items-center gap-2 text-[10px] font-bold text-primary uppercase tracking-wider mb-1">
                                    <ShieldCheck size={12} />
                                    <span>Seguridad encriptada</span>
                                </div>
                                <p className="text-[10px] text-slate-500 leading-tight">
                                    Sesión oficial de Supabase Auth validada.
                                </p>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

