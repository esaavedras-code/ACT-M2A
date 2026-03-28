"use client";

import { useState } from "react";
import { Menu, X, Home, Briefcase, History, FileText, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function MobileMenu() {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();

    const menuItems = [
        { name: "Dashboard", href: "/", icon: LayoutDashboard },
        { name: "Proyectos", href: "/proyectos", icon: Briefcase },
        { name: "Historial de precios de la ACT", href: "/precios", icon: History },
    ];

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
                    className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[60]"
                    onClick={toggleMenu}
                />
            )}

            {/* Drawer */}
            <div
                className={`fixed top-0 right-0 h-full w-[280px] bg-white dark:bg-slate-900 shadow-2xl z-[70] transform transition-transform duration-300 ease-in-out ${
                    isOpen ? "translate-x-0" : "translate-x-full"
                }`}
            >
                <div className="flex flex-col h-full">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                        <span className="font-black text-xl tracking-tighter text-blue-700 dark:text-blue-400">PACT</span>
                        <button onClick={toggleMenu} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                            <X size={24} />
                        </button>
                    </div>

                    <nav className="flex-grow p-4 space-y-2">
                        {menuItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    onClick={toggleMenu}
                                    className={`flex items-center gap-4 p-4 rounded-2xl font-bold transition-all ${
                                        isActive
                                            ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                                    }`}
                                >
                                    <Icon size={20} className={isActive ? "text-blue-600" : "text-slate-400"} />
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
