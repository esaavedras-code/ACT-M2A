"use client";

import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { 
    LayoutDashboard, Briefcase, LayoutList, User, ChevronRight, X,
    FileText, Users, ListChecks, Package, ShieldCheck, FileCheck, 
    FileEdit, Factory, Mic, Cloud, Calculator, TrendingUp, FolderOpen
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function BottomNav() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const router = useRouter();
    const [isSectionsOpen, setIsSectionsOpen] = useState(false);
    const [role, setRole] = useState("C");

    const projectId = searchParams.get("id");
    const activeTab = searchParams.get("tab") || "dashboard";

    useEffect(() => {
        const checkRole = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const { data: userData } = await supabase.from("users").select("role_global").eq("id", session.user.id).single();
                if (userData?.role_global === "A") {
                    setRole("A");
                } else if (projectId) {
                    const { data: mem } = await supabase.from("memberships").select("role").eq("project_id", projectId).eq("user_id", session.user.id).single();
                    if (mem) setRole(mem.role);
                }
            }
        };
        checkRole();
    }, [projectId]);

    const projectTabs = [
        { id: "dashboard",   label: "0. Resumen",        icon: LayoutDashboard },
        ...(role !== 'E' ? [{ id: "files",       label: "📁 Archivos",        icon: FolderOpen }] : []),
        { id: "project",     label: "1. Datos Proyecto",       icon: FileText },
        { id: "personnel",   label: "2. Firmas ACT",     icon: Users },
        { id: "items",       label: "3. Partidas contrato",  icon: ListChecks },
        { id: "materials",   label: "4. Mat. on Site",   icon: Package },
        { id: "compliance",  label: "5. Cumplimiento",   icon: ShieldCheck },
        { id: "cho",         label: "6. Change Orders",  icon: FileEdit },
        { id: "payment",     label: "7. Pagos",          icon: FileCheck },
        { id: "mfg",         label: "8. Cert. CM",       icon: Factory },
        { id: "minutes",     label: "9. Minutas",        icon: Mic },
        { id: "logs",        label: "10. Actividades",   icon: Cloud },
        { id: "inspection",  label: "11. Inspección",    icon: FileCheck },
        { id: "force",       label: "12. Force Account", icon: Calculator },
        { id: "liquidation", label: "13. Liquidación",   icon: TrendingUp },
        { id: "ccml",        label: "14. Cambios al CCML", icon: FileEdit },
    ];

    const navItems = [
        { name: "Dashboard", href: "/", icon: LayoutDashboard },
        { name: "Proyectos", href: "/proyectos", icon: Briefcase },
        { name: "Secciones", action: () => setIsSectionsOpen(true), icon: LayoutList, badge: projectId ? "!" : null },
        { name: "Perfil", href: "/perfil", icon: User },
    ];

    const handleTabClick = (tabId: string) => {
        if (!projectId) return;
        router.push(`/proyectos/detalle?id=${projectId}&tab=${tabId}`);
        setIsSectionsOpen(false);
    };

    return (
        <>
            {/* Bottom Nav Bar */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 h-20 px-4 pb-2 pt-2 z-50 flex justify-between items-center shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.href ? (pathname === item.href && !isSectionsOpen) : false;
                    const isSecciones = item.name === "Secciones";

                    if (item.href) {
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`flex flex-col items-center justify-center gap-1.5 px-3 py-1 flex-1 transition-all ${
                                    isActive ? "text-primary" : "text-slate-500 dark:text-slate-400"
                                }`}
                            >
                                <div className={`p-2 rounded-2xl transition-all ${isActive ? "bg-primary/10 shadow-sm" : ""}`}>
                                    <Icon size={22} strokeWidth={isActive ? 3 : 2} />
                                </div>
                                <span className={`text-[9px] font-black uppercase tracking-widest ${isActive ? "opacity-100" : "opacity-60"}`}>{item.name}</span>
                            </Link>
                        );
                    } else {
                        return (
                            <button
                                key={item.name}
                                onClick={item.action}
                                className={`flex flex-col items-center justify-center gap-1.5 px-3 py-1 flex-1 transition-all relative ${
                                    isSectionsOpen ? "text-primary" : "text-slate-500 dark:text-slate-400"
                                }`}
                            >
                                <div className={`p-2 rounded-2xl transition-all ${isSectionsOpen ? "bg-primary/10 shadow-sm" : ""}`}>
                                    <Icon size={22} strokeWidth={isSectionsOpen ? 3 : 2} />
                                </div>
                                <span className={`text-[9px] font-black uppercase tracking-widest ${isSectionsOpen ? "opacity-100" : "opacity-60"}`}>{item.name}</span>
                                {item.badge && (
                                    <span className="absolute top-1 right-1/4 w-4 h-4 bg-red-500 text-white text-[8px] flex items-center justify-center rounded-full border-2 border-white dark:border-slate-900 font-bold">
                                        {item.badge}
                                    </span>
                                )}
                            </button>
                        );
                    }
                })}
            </div>

            {/* Sections Drawer (Bottom Sheet) */}
            <div 
                className={`lg:hidden fixed inset-0 z-[60] transition-opacity duration-300 ${isSectionsOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
            >
                <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setIsSectionsOpen(false)} />
                <div 
                    className={`absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-950 rounded-t-[3rem] shadow-2xl transition-transform duration-500 border-t border-slate-200 dark:border-slate-800 ${
                        isSectionsOpen ? "translate-y-0" : "translate-y-full"
                    }`}
                >
                    <div className="flex flex-col max-h-[85vh]">
                        <div className="p-6 flex justify-between items-center border-b border-slate-100 dark:border-slate-800">
                            <div className="space-y-1">
                                <h3 className="font-black text-xl tracking-tighter text-slate-900 dark:text-white uppercase">Secciones del Proyecto</h3>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest italic">Navegación rápida de módulos</p>
                            </div>
                            <button 
                                onClick={() => setIsSectionsOpen(false)}
                                className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 hover:text-slate-900 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="flex-grow overflow-y-auto p-4 custom-scrollbar pb-10">
                            {!projectId ? (
                                <div className="py-20 text-center space-y-4">
                                    <div className="mx-auto w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center text-slate-300">
                                        <Briefcase size={32} />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-black text-slate-900 dark:text-white uppercase text-sm tracking-widest">Sin Proyecto Seleccionado</p>
                                        <p className="text-[10px] text-slate-500 font-bold">Abre un proyecto primero para ver sus secciones.</p>
                                    </div>
                                    <Link 
                                        href="/proyectos" 
                                        onClick={() => setIsSectionsOpen(false)}
                                        className="inline-block mt-4 bg-primary text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest"
                                    >
                                        Ver Proyectos
                                    </Link>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-1">
                                    {projectTabs.map((tab) => {
                                        const TabIcon = tab.icon;
                                        const isTabActive = activeTab === tab.id && pathname === "/proyectos/detalle";
                                        return (
                                            <button
                                                key={tab.id}
                                                onClick={() => handleTabClick(tab.id)}
                                                className={`flex items-center justify-between p-4 rounded-2xl transition-all ${
                                                    isTabActive 
                                                        ? "bg-primary text-white shadow-xl shadow-primary/20" 
                                                        : "bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800"
                                                }`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={`p-2 rounded-xl ${isTabActive ? "bg-white/20" : "bg-white dark:bg-slate-800 shadow-sm"}`}>
                                                        <TabIcon size={18} />
                                                    </div>
                                                    <span className={`text-[11px] font-black uppercase tracking-widest ${isTabActive ? "text-white" : "text-slate-900 dark:text-slate-100"}`}>
                                                        {tab.label}
                                                    </span>
                                                </div>
                                                {isTabActive ? <ChevronRight size={14} className="opacity-60" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
