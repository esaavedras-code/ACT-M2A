"use client";

import { useEffect, useState } from "react";
import { User, LogOut, ShieldCheck, Settings, Key, History, Users, Info } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { setLocalStorageItem } from "@/lib/utils";

export default function UserAccessButton() {
    const [userName, setUserName] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [maintenanceMode, setMaintenanceMode] = useState<boolean | null>(null);
    const [loadingToggle, setLoadingToggle] = useState(false);

    useEffect(() => {
        const loadUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setUserName(session.user.user_metadata?.name || session.user.email?.split("@")[0] || "Usuario");
                setUserEmail(session.user.email || "Sin correo");
                // Check if global admin or project admin
                const { data: userData } = await supabase.from("users").select("name, avatar_url, role_global").eq("id", session.user.id).single();
                
                if (userData) {
                    setUserName(userData.name || session.user.user_metadata?.name || session.user.email?.split("@")[0] || "Usuario");
                    setAvatarUrl(userData.avatar_url);
                } else {
                    setUserName(session.user.user_metadata?.name || session.user.email?.split("@")[0] || "Usuario");
                }

                let hasAdmin = userData?.role_global === "A";
                if (!hasAdmin) {
                    const { count } = await supabase.from("memberships").select("*", { count: "exact", head: true }).eq("user_id", session.user.id).eq("role", "B");
                    if (count && count > 0) hasAdmin = true;
                }
                if (hasAdmin) setIsAdmin(true);
            } else {
                setUserName(null);
                setUserEmail(null);
            }

            // Check if Maintenance project configuration exists
            const { data: config } = await supabase.from('projects')
                .select('contractor_name')
                .eq('name', 'PACT_SYSTEM_CONFIG')
                .maybeSingle();

            if (config) {
                setMaintenanceMode(config.contractor_name === 'MAINTENANCE_ON');
            } else {
                setMaintenanceMode(false);
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
        try {
            localStorage.removeItem("pact_registration");
            sessionStorage.removeItem("pact_registration");
            localStorage.removeItem("pact_keep_connected");
        } catch (e) {
            console.warn("Error clearing storage:", e);
        }
        await supabase.auth.signOut();
        window.location.href = "/login";
    };

    const toggleMaintenanceMode = async () => {
        setIsMenuOpen(false);
        setLoadingToggle(true);
        try {
            const newValue = maintenanceMode ? 'MAINTENANCE_OFF' : 'MAINTENANCE_ON';
            
            // Check if exists
            const { data: exists } = await supabase.from('projects').select('id').eq('name', 'PACT_SYSTEM_CONFIG').maybeSingle();
            
            if (exists) {
                await supabase.from('projects').update({ contractor_name: newValue, num_act: 'AC-999999' }).eq('id', exists.id);
            } else {
                await supabase.from('projects').insert([{
                    name: 'PACT_SYSTEM_CONFIG',
                    num_act: 'AC-999999',
                    contractor_name: newValue,
                    municipios: 'System',
                    carreteras: 'Config'
                }]);
            }
            
            setMaintenanceMode(!maintenanceMode);
            alert(`El sistema ha sido ${newValue === 'MAINTENANCE_ON' ? 'BLOQUEADO' : 'DESBLOQUEADO'} para el resto de los usuarios.`);
        } catch (e: any) {
            console.error(e);
            alert("Error cambiando modo: " + e.message);
        } finally {
            setLoadingToggle(false);
        }
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
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-[10px] font-black border border-white/30 backdrop-blur-md overflow-hidden shrink-0">
                    {avatarUrl ? (
                        <img src={avatarUrl} alt={userName || ""} className="w-full h-full object-cover" />
                    ) : (
                        initials
                    )}
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
                            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white shrink-0 shadow-lg overflow-hidden border-2 border-white dark:border-slate-700">
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt={userName || ""} className="w-full h-full object-cover" />
                                ) : (
                                    <User size={20} />
                                )}
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
                                    <span className="text-[10px] text-slate-400 font-medium">Gestionar nombre y contraseña</span>
                                </div>
                            </button>

                            <button
                                onClick={() => { setIsMenuOpen(false); window.location.href = "/acerca-de"; }}
                                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-sky-50 dark:hover:bg-sky-900/20 text-slate-700 dark:text-slate-300 transition-all group"
                            >
                                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg group-hover:bg-sky-500/10 transition-colors text-slate-500 group-hover:text-sky-600">
                                    <Info size={16} />
                                </div>
                                <div className="text-left">
                                    <span className="block text-sm font-bold">Acerca de PACT</span>
                                    <span className="text-[10px] text-slate-400 font-medium">Versión, autor y contacto</span>
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

                            {/* Admin-only links */}
                            {isAdmin && (
                                <>
                                    <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
                                    <button
                                        onClick={() => { setIsMenuOpen(false); window.location.href = "/admin/audit-logs"; }}
                                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-slate-700 dark:text-slate-300 transition-all group"
                                    >
                                        <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg group-hover:bg-indigo-500/10 transition-colors text-slate-500 group-hover:text-indigo-600">
                                            <History size={16} />
                                        </div>
                                        <div className="text-left">
                                            <span className="block text-sm font-bold">Logs de Auditoría</span>
                                            <span className="text-[10px] text-slate-400 font-medium">Historial de cambios en el sistema</span>
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => { setIsMenuOpen(false); window.location.href = "/admin/requests"; }}
                                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-slate-700 dark:text-slate-300 transition-all group"
                                    >
                                        <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg group-hover:bg-emerald-500/10 transition-colors text-slate-500 group-hover:text-emerald-600">
                                            <Users size={16} />
                                        </div>
                                        <div className="text-left">
                                            <span className="block text-sm font-bold">Solicitudes de Acceso</span>
                                            <span className="text-[10px] text-slate-400 font-medium">Gestionar usuarios y permisos</span>
                                        </div>
                                    </button>
                                    
                                    <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
                                    
                                    <button
                                        onClick={toggleMaintenanceMode}
                                        disabled={loadingToggle || maintenanceMode === null}
                                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all group ${
                                            maintenanceMode
                                                ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100'
                                                : 'hover:bg-amber-50 dark:hover:bg-amber-900/20'
                                        }`}
                                    >
                                        <div className={`p-2 rounded-lg transition-colors ${
                                            maintenanceMode
                                                ? 'bg-red-500 text-white'
                                                : 'bg-slate-100 dark:bg-slate-800 group-hover:bg-amber-500/10 text-slate-500 group-hover:text-amber-500'
                                        }`}>
                                            <ShieldCheck size={16} />
                                        </div>
                                        <div className="text-left">
                                            <span className={`block text-sm font-bold ${maintenanceMode ? 'text-red-700 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                                {maintenanceMode ? 'Apagar Mantenimiento' : 'Encender Mantenimiento'}
                                            </span>
                                            <span className={`text-[10px] font-medium leading-tight ${maintenanceMode ? 'text-red-500' : 'text-slate-400'}`}>
                                                {maintenanceMode ? 'Web Bloqueada. Clic para dar acceso.' : 'Bloquear web para todos los usuarios'}
                                            </span>
                                        </div>
                                    </button>
                                </>
                            )}
                            
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

