
"use client";

import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
    FileText, ListChecks, Package, AlertCircle,
    ChevronDown, Download, Loader2, FileBarChart,
    ExternalLink, FileCheck
} from "lucide-react";
import {
    generateBalanceReportLogic,
    generateDetailReportLogic,
    generateMfgReportLogic,
    generateMissingMfgReportLogic,
    generateAct117CReportLogic
} from "@/lib/reportLogic";
import Link from "next/link";

export default function ReportesMenu() {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const searchParams = useSearchParams();
    const projectId = searchParams.get("id");
    const menuRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Optimized hover behavior to prevent flickering
    const handleMouseEnter = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setIsOpen(true);
    };

    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => {
            setIsOpen(false);
        }, 300); // Small delay to allow moving to the menu
    };

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    const handleGenerate = async (type: string) => {
        if (!projectId) return;

        setLoading(true);
        setIsOpen(false);
        try {
            switch (type) {
                case "balance": await generateBalanceReportLogic(projectId); break;
                case "detail": await generateDetailReportLogic(projectId); break;
                case "mfg": await generateMfgReportLogic(projectId); break;
                case "missing": await generateMissingMfgReportLogic(projectId); break;
                case "act117c": await generateAct117CReportLogic(projectId); break;
            }
        } catch (error) {
            console.error(error);
            alert("Error al generar el reporte.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="relative"
            ref={menuRef}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <button
                className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 font-bold text-sm ${isOpen
                    ? "bg-white/20 text-white shadow-inner"
                    : "hover:bg-white/10 text-blue-50"
                    }`}
            >
                <FileBarChart size={18} className={isOpen ? "animate-pulse" : ""} />
                Reportes
                <ChevronDown size={14} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-[320px] z-[100] animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-slate-100 dark:border-slate-800 overflow-hidden ring-1 ring-black/5">
                        <div className="bg-slate-50 dark:bg-slate-800/50 px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Generador de Reportes</span>
                            {!projectId && (
                                <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                                    <AlertCircle size={10} /> Sin Proyecto
                                </span>
                            )}
                        </div>

                        <div className="p-2">
                            <ReportItem
                                icon={<ListChecks size={18} className="text-blue-500" />}
                                label="Balances de Partidas"
                                description="Estado actual de cantidades y dinero."
                                onClick={() => handleGenerate("balance")}
                                disabled={!projectId}
                            />
                            <ReportItem
                                icon={<FileText size={18} className="text-purple-500" />}
                                label="Detalle de Ejecución"
                                description="Historial de CHO y certificaciones."
                                onClick={() => handleGenerate("detail")}
                                disabled={!projectId}
                            />
                            <div className="h-px bg-slate-50 dark:bg-slate-800 my-1 mx-2" />
                            <ReportItem
                                icon={<Package size={18} className="text-emerald-500" />}
                                label="Certificados de Manufactura"
                                description="Resumen de materiales aprobados."
                                onClick={() => handleGenerate("mfg")}
                                disabled={!projectId}
                            />
                            <ReportItem
                                icon={<AlertCircle size={18} className="text-red-500" />}
                                label="Materiales Faltantes"
                                description="Pendientes de certificación MFG."
                                onClick={() => handleGenerate("missing")}
                                disabled={!projectId}
                            />
                            <ReportItem
                                icon={<FileCheck size={18} className="text-blue-600" />}
                                label="Certificación ACT-117C"
                                description="Formulario mensual de pago (Anverso/Reverso)."
                                onClick={() => handleGenerate("act117c")}
                                onChoose={() => { setIsOpen(false); window.location.href = `/reportes?id=${projectId}&open=act117c`; }}
                                disabled={!projectId}
                            />
                        </div>

                        <Link
                            href={projectId ? `/reportes?id=${projectId}` : "/reportes"}
                            className="bg-slate-50 dark:bg-slate-800/50 hover:bg-primary hover:text-white transition-all flex items-center justify-center gap-2 py-3.5 text-xs font-bold text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800 group"
                            onClick={() => setIsOpen(false)}
                        >
                            <span>CENTRO DE REPORTES</span>
                            <ExternalLink size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </Link>
                    </div>
                </div>
            )}

            {loading && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-[200] animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-5 border border-white/20">
                        <div className="relative">
                            <div className="absolute inset-0 animate-ping bg-primary/20 rounded-full" />
                            <Loader2 className="animate-spin text-primary relative" size={48} />
                        </div>
                        <div className="text-center">
                            <p className="font-black text-xl text-slate-900 dark:text-white mb-1">PROCESANDO PDF</p>
                            <p className="text-sm font-medium text-slate-500">Esto tomará solo unos segundos...</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function ReportItem({ icon, label, description, onClick, onChoose, disabled }: { icon: React.ReactNode, label: string, description: string, onClick: () => void, onChoose?: () => void, disabled?: boolean }) {
    return (
        <div className="flex items-center gap-2 group">
            <button
                onClick={onClick}
                disabled={disabled}
                className={`flex-1 flex items-center gap-4 px-3 py-2.5 rounded-xl transition-all ${disabled
                    ? 'opacity-30 cursor-not-allowed grayscale'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.98]'
                    }`}
            >
                <div className={`p-2.5 rounded-xl shadow-sm transition-colors ${disabled
                    ? 'bg-slate-100 dark:bg-slate-800'
                    : 'bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 group-hover:border-primary/20 group-hover:shadow-md'
                    }`}>
                    {icon}
                </div>
                <div className="flex flex-col items-start truncate overflow-hidden">
                    <span className={`text-sm font-bold truncate ${disabled ? 'text-slate-500' : 'text-slate-900 dark:text-white group-hover:text-primary transition-colors'}`}>
                        {label}
                    </span>
                    <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 truncate leading-tight">
                        {description}
                    </span>
                </div>
                {!disabled && !onChoose && (
                    <div className="ml-auto opacity-0 group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0">
                        <Download size={14} className="text-primary" />
                    </div>
                )}
            </button>
            {onChoose && !disabled && (
                <button
                    onClick={onChoose}
                    className="flex flex-col items-center justify-center p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-primary/10 hover:border-primary/40 transition-all gap-1 h-[56px] min-w-[56px]"
                    title="Elegir certificaciones"
                >
                    <Search size={14} className="text-primary" />
                    <span className="text-[8px] font-black text-primary uppercase">Elegir</span>
                </button>
            )}
        </div>
    );
}

import { Search } from "lucide-react";
