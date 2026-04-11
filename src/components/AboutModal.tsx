"use client";

import { useEffect } from "react";
import { X, Shield, Info, ExternalLink } from "lucide-react";

interface AboutModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function AboutModal({ isOpen, onClose }: AboutModalProps) {
    useEffect(() => {
        if (isOpen) {
            document.body.classList.add('about-open');
        } else {
            document.body.classList.remove('about-open');
        }
        return () => document.body.classList.remove('about-open');
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />
            
            {/* Modal */}
            <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200 dark:border-slate-800">
                {/* Header with Gradient */}
                <div className="h-32 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 relative p-8 flex items-end">
                    <div className="absolute top-4 right-4">
                        <button 
                            onClick={onClose}
                            className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors backdrop-blur-md"
                        >
                            <X size={20} />
                        </button>
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-white tracking-tighter uppercase leading-none">Sobre el Programa</h2>
                        <p className="text-blue-100 text-sm font-bold tracking-tight mt-1 opacity-80">Sistema de Control Proyectos ACT</p>
                    </div>
                </div>

                <div className="p-8 space-y-6">
                    {/* Developer Info */}
                    <div className="flex items-start gap-4 p-5 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800/30">
                        <div className="p-3 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-500/20">
                            <Shield size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-black tracking-widest text-blue-600 dark:text-blue-400 mb-1">Diseñador y Desarrollador</p>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                                Ing. Enrique Saavedra Sada, PE
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
                                Puerto Rico Highway and Transportation Authority (ACT)
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Versión</p>
                            <p className="text-base font-black text-slate-900 dark:text-white">v3.26.0411</p>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Plataforma</p>
                            <p className="text-base font-black text-slate-900 dark:text-white">PACT Windows x64</p>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                            <Info size={18} className="text-blue-600" />
                            <h4 className="font-black uppercase tracking-tight text-sm">Propósito</h4>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                            Este software ha sido diseñado para optimizar la gestión y fiscalización de proyectos de construcción de la ACT, 
                            asegurando el cumplimiento de normativas federales y estatales mediante un control riguroso de certificaciones de pago, 
                            órdenes de cambio y materiales.
                        </p>
                    </div>

                    {/* Footer Links */}
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">
                            &copy; 2026 M2A Group
                        </p>
                        <button 
                            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-xs font-black uppercase tracking-tighter"
                            onClick={() => window.open('https://www.dtop.pr.gov/act/', '_blank')}
                        >
                            Sitio Web ACT <ExternalLink size={14} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
