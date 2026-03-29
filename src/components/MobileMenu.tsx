"use client";

import { useState, useEffect } from "react";
import { Menu, X, Home, Briefcase, History, FileText, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function MobileMenu() {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();

    const [isAdmin, setIsAdmin] = useState(false);
    
    useEffect(() => {
        const checkAdmin = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const { data: userData } = await supabase.from("users").select("role_global").eq("id", session.user.id).single();
                if (userData?.role_global === "A") setIsAdmin(true);
            }
        };
        checkAdmin();
    }, []);

    const menuItems = [
        { name: "Dashboard", href: "/", icon: LayoutDashboard },
        { name: "Proyectos", href: "/proyectos", icon: Briefcase },
        { name: "Historial de precios", href: "/precios", icon: History },
        { name: "Mi Perfil", href: "/perfil", icon: FileText }, // Added Perfil
    ];

    if (isAdmin) {
        menuItems.push({ name: "Solicitudes de Acceso", href: "/admin/requests", icon: Briefcase });
    }

    const toggleMenu = () => setIsOpen(!isOpen);

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
                        <span className="font-black text-2xl tracking-tighter text-primary dark:text-blue-400">PACT</span>
                        <button onClick={toggleMenu} className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">
                            <X size={24} />
                        </button>
                    </div>

                    <nav className="flex-grow p-4 space-y-3 overflow-y-auto">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mb-2">Secciones Principales</p>
                        {menuItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    onClick={toggleMenu}
                                    className={`flex items-center gap-4 p-4 rounded-2xl font-black text-sm transition-all shadow-sm ${
                                        isActive
                                            ? "bg-primary text-white shadow-primary/20 scale-[1.02]"
                                            : "bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"
                                    }`}
                                >
                                    <Icon size={20} className={isActive ? "text-white" : "text-primary"} />
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="p-6 border-t border-slate-100 dark:border-slate-800">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center">
                            M2A Group - PACT v3.2
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
