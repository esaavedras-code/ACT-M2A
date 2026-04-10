"use client";

import { useState, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { 
    Menu, X, Home, Briefcase, History, FileText, LayoutDashboard, 
    ListChecks, Package, ShieldCheck, FileEdit, FileCheck, Mic, 
    Cloud, Calculator, TrendingUp, FolderOpen, ChevronRight, LayoutList, User
} from "lucide-react";
import BrandName from "@/components/BrandName";
import { useUserRole } from "@/hooks/useUserRole";
import AboutModal from "@/components/AboutModal";
 
 export default function MobileMenu() {
     const [isOpen, setIsOpen] = useState(false);
     const [isAboutOpen, setIsAboutOpen] = useState(false);
     const pathname = usePathname();
     const { role } = useUserRole();
     const isAdmin = role === 'A';
 
     const [userName, setUserName] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    
    useEffect(() => {
        const loadUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const { data: userData } = await supabase.from("users").select("name, avatar_url").eq("id", session.user.id).maybeSingle();
                setUserName(userData?.name || session.user.user_metadata?.name || "Usuario");
                setAvatarUrl(userData?.avatar_url);
                setUserEmail(session.user.email || "");
            }
        };
        loadUser();
    }, []);

    const searchParams = useSearchParams();
    const isProjectDetail = pathname === "/proyectos/detalle";
    const projectId = searchParams.get("id");
    const activeTab = searchParams.get("tab") || "dashboard";

    const menuItems = [
        { name: "Dashboard", href: "/", icon: LayoutDashboard },
        { name: "Proyectos", href: "/proyectos", icon: Briefcase },
        { name: "Historial de precios", href: "/precios", icon: History },
        { name: "Centro de Reportes", href: projectId ? `/reportes?id=${projectId}` : "/reportes", icon: TrendingUp },
        { name: "Mi Perfil", href: "/perfil", icon: FileText },
    ];

    if (isAdmin) {
        menuItems.push({ name: "Solicitudes de Acceso", href: "/admin/requests", icon: Briefcase });
    }

    const toggleMenu = () => setIsOpen(!isOpen);


    const projectTabs = [
        { id: "dashboard",   label: "Resumen",        icon: LayoutDashboard },
        { id: "files",       label: "Archivos",        icon: FolderOpen },
        { id: "project",     label: "Datos Proyecto",       icon: FileText },
        { id: "personnel",   label: "Firmas ACT",     icon: Home }, // Users -> Home fallback if needed, but I'll use Home for simplicity or import others
        { id: "items",       label: "Partidas contrato",  icon: ListChecks },
        { id: "materials",   label: "Mat. on Site",   icon: Package },
        { id: "compliance",  label: "Cumplimiento",   icon: ShieldCheck },
        { id: "cho",         label: "Change Orders",  icon: FileEdit },
        { id: "payment",     label: "Pagos",          icon: FileCheck },
        { id: "mfg",         label: "Cert. CM",       icon: FileText },
        { id: "minutes",     label: "Minutas",        icon: Mic },
        { id: "logs",        label: "Actividades",   icon: Cloud },
        { id: "inspection",  label: "Inspección",    icon: FileCheck },
        { id: "force",       label: "Force Account", icon: Calculator },
        { id: "liquidation", label: "Liquidación",   icon: TrendingUp },
        { id: "ccml",        label: "Cambios al CCML", icon: FileEdit },
    ];

    return (
        <div className="lg:hidden">
            <button
                onClick={toggleMenu}
                className="p-2 text-white hover:bg-white/10 rounded-xl transition-colors focus:outline-none"
                aria-label="Abrir menú"
            >
                {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[60]"
                    onClick={toggleMenu}
                />
            )}

            {/* Drawer */}
            <div
                className={`fixed top-0 right-0 h-full w-[280px] bg-white dark:bg-slate-950 shadow-2xl z-[70] transform transition-transform duration-300 ease-in-out border-l border-slate-200 dark:border-slate-800 ${
                    isOpen ? "translate-x-0" : "translate-x-full"
                }`}
            >
                <div className="flex flex-col h-full">
                    <div className="p-6 bg-primary/5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                        <span className="font-black text-2xl tracking-tighter text-primary dark:text-blue-400"><BrandName /></span>
                        <button onClick={toggleMenu} className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">
                            <X size={24} />
                        </button>
                    </div>

                    <nav className="flex-grow p-4 space-y-3 overflow-y-auto">
                        <p className="text-xs font-black text-slate-500 uppercase tracking-widest px-4 mb-4 mt-2">Navegación Principal</p>
                        {menuItems.map((item) => {
                            const Icon = item.icon;
                            let isActive = false;
                            
                            // Logica especial para marcar activo Centro de Reportes sin incluir parametros GET
                            if (item.name === "Centro de Reportes" && pathname.startsWith("/reportes")) {
                                isActive = true;
                            } else {
                                isActive = pathname === item.href.split('?')[0];
                            }
                            
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    onClick={toggleMenu}
                                    className={`flex items-center gap-4 py-4 px-5 rounded-[1.25rem] font-bold text-base transition-all shadow-sm ${
                                        isActive
                                            ? `${role === 'F' ? 'bg-[#670010]' : 'bg-primary'} text-white shadow-primary/40 scale-[1.02] border-transparent`
                                            : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                                    }`}
                                >
                                    <Icon size={24} className={isActive ? "text-white" : (role === 'F' ? "text-[#670010]" : "text-primary dark:text-blue-400")} />
                                    <div className="flex items-center justify-between flex-1">
                                        <span>{item.name}</span>
                                        {item.name === "Historial de precios" && (
                                            <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full text-[8px] font-black uppercase">WIP</span>
                                        )}
                                    </div>
                                </Link>
                            );
                        })}

                        {isProjectDetail && projectId && (
                            <>
                                <div className="mt-8 mb-4 flex items-center gap-2 px-4">
                                    <div className="h-px flex-1 bg-slate-300 dark:bg-slate-800"></div>
                                    <p className="text-[10px] font-black text-slate-800 dark:text-slate-300 uppercase tracking-widest whitespace-nowrap">Secciones del Proyecto</p>
                                    <div className="h-px flex-1 bg-slate-300 dark:bg-slate-800"></div>
                                </div>
                                
                                <div className="space-y-1 pb-10">
                                    {projectTabs.map((tab) => {
                                        const TabIcon = tab.icon;
                                        const isTabActive = activeTab === tab.id;
                                        return (
                                            <Link
                                                key={tab.id}
                                                href={`/proyectos/detalle?id=${projectId}&tab=${tab.id}`}
                                                onClick={toggleMenu}
                                                className={`flex items-center justify-between py-3.5 px-4 rounded-2xl transition-all ${
                                                    isTabActive
                                                        ? `${role === 'F' ? 'bg-[#670010]/10 border-[#670010]/20 text-[#670010]' : 'bg-primary/10 border-primary/20 text-primary'} font-black shadow-inner`
                                                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent"
                                                }`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={`p-2.5 rounded-xl ${isTabActive ? (role === 'F' ? "bg-[#670010] text-white" : "bg-primary text-white") : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>
                                                        <TabIcon size={18} />
                                                    </div>
                                                    <span className="text-sm font-bold uppercase tracking-tight">{tab.label}</span>
                                                </div>
                                                {isTabActive && <ChevronRight size={18} />}
                                            </Link>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </nav>

                    <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                        <Link 
                            href="/perfil" 
                            onClick={toggleMenu}
                            className="flex items-center gap-3 p-2 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700 group"
                        >
                            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white shrink-0 overflow-hidden shadow-sm border border-white dark:border-slate-700">
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt={userName || ""} className="w-full h-full object-cover" />
                                ) : (
                                    <User size={20} />
                                )}
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <p className="text-sm font-black text-slate-900 dark:text-white truncate">{userName}</p>
                                <p className="text-[10px] text-slate-500 font-bold truncate">{userEmail}</p>
                            </div>
                            <ChevronRight size={16} className="text-slate-300 group-hover:text-primary transition-colors" />
                        </Link>
                        
                        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 text-center">
                            <button 
                                onClick={() => setIsAboutOpen(true)}
                                className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-primary transition-colors cursor-pointer"
                            >
                                M2A Group - <BrandName /> v3.26.0410
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
        </div>
    );
}
