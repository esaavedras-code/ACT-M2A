"use client";

import { useState } from "react";
import { HelpCircle, X, ChevronRight, BookOpen, FileText, BarChart3, ShieldCheck, Mail } from "lucide-react";

export default function QuickHelpModal() {
    const [isOpen, setIsOpen] = useState(false);

    const sections = [
        { title: "Navegación", text: "Dashboard (inicio), Proyectos (gestión) y Reportes (oficiales)." },
        { title: "Proyectos", text: "Gestiona contratista, personal ACT, partidas, materiales y cumplimiento." },
        { title: "Control Diario", text: "Registra minutas, actividades e informes de inspección con voz o texto." },
        { title: "Reportes", text: "Genera ACT-117 (Pagos/MOS), ACT-122 (CHO) y balances en PDF/Excel." },
        { title: "Archivos", text: "📂 Sube y descarga documentos por sección. El inspector no tiene acceso." },
        { title: "Administración", text: "Gestión de accesos y roles (A, B, C, D, E) con seguridad de doble paso." }
    ];

    if (!isOpen) {
        return (
            <button 
                onClick={() => setIsOpen(true)}
                className="fixed bottom-10 right-10 z-[2000] bg-primary text-white p-4 rounded-full shadow-2xl hover:bg-blue-700 transition-all hover:scale-110 group animate-bounce"
                title="Ayuda del Sistema"
            >
                <HelpCircle size={28} />
                <span className="absolute right-full mr-4 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    Guía Rápida
                </span>
            </button>
        );
    }

    return (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="bg-primary p-6 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-xl">
                            <BookOpen size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black uppercase tracking-widest">Guía Elemental PACT</h2>
                            <p className="text-[10px] text-blue-100 font-bold opacity-80 uppercase tracking-widest">Plataforma de Control de Obras</p>
                        </div>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto no-scrollbar">
                    <div className="grid grid-cols-1 gap-4">
                        {sections.map((s, i) => (
                            <div key={i} className="flex gap-4 items-start p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-2xl transition-colors border-l-4 border-primary/20 hover:border-primary">
                                <div className="mt-1 text-primary">
                                    <ChevronRight size={16} />
                                </div>
                                <div>
                                    <h4 className="font-black text-xs uppercase tracking-widest text-slate-800 dark:text-white mb-1">{s.title}</h4>
                                    <p className="text-sm text-slate-500 font-medium leading-relaxed">{s.text}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-900/10 border-2 border-dashed border-amber-200 dark:border-amber-800 p-6 rounded-3xl text-center">
                        <p className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-2 flex items-center justify-center gap-2">
                            <ShieldCheck size={16} /> Seguridad y Soporte
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                            El Inspector (Rol E) tiene acceso restringido a reportes y archivos sensibles.
                        </p>
                        <div className="mt-4 flex items-center justify-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest">
                            <Mail size={14} /> administrador@m2agroup.pr
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 flex justify-center border-t border-slate-100 dark:border-slate-800">
                    <button 
                        onClick={() => setIsOpen(false)}
                        className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 shadow-xl"
                    >
                        Entendido
                    </button>
                </div>
            </div>
        </div>
    );
}
