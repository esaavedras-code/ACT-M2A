"use client";

/* PACT-Administradores - Reportes */
import { useState, useEffect, Suspense, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { 
    getLocalStorageItem, 
    setLocalStorageItem, 
    formatProjectNumber,
    sortItemsNaturally
} from "@/lib/utils";
import { 
    FileText, Download, AlertCircle, CheckCircle2,
    Package, ListChecks, ArrowLeft, Loader2,
    Activity, Info, Files, BadgeAlert, FileDigit,
    ChevronDown, Search, FileCheck, BarChart, Calculator, 
    ShieldCheck as ShieldCheckIcon, Plus, MessageSquare,
    FileSpreadsheet, Calendar
} from "lucide-react";

import {
    generateBalanceReportLogic,
    generateDetailReportLogic,
    generateMfgReportLogic,
    generateIccReportLogic,
    generateMissingMfgReportLogic,
    generateMosReportLogic,
    generateChoReportLogic,
    generateCertReportLogic,
    generateDashboardReportLogic,
    generateFundSourceReportLogic,
    generateProjectedFundDistributionReportLogic,
    generateAct117CReportLogic,
    generateAct117AReportLogic,
    generateAct123ReportLogic,
    generateAct117BReportLogic,
    generateAct122ReportLogic,
    generateAct122BReportLogic,
    generateAct123BReportLogic,
    generateAct32ReportLogic,
    generateAct124ReportLogic,
    generateDOFAEIReportLogic,
    generateRoaReportLogic,
    generateCCMLReportLogic,

    generateEnvironmentalReviewReportLogic,
    generateTimeAnalysisReportLogic,
    generateFinalEstimateReportLogic,
    generateContractFinalReportLogic,
    generateFinalConstructionReportLogic,
    generateLiquidacionItemsReportLogic,

    generateFinalAcceptanceChecklistReportLogic,
    generateFinalAcceptanceReportOfficialLogic,
    generatePayrollCertificationReportLogic,
    generateMaterialCertificationReportLogic,
    generateSolicitudMaterialCertDocxLogic,
    generateSolicitudMaterialCertPdfLogic,
    generateDbeCertificationReportLogic,
    generateSubcontractsReportLogic,
    generateSignedItemsReportLogic,
    generateMissingSignaturesReportLogic,
    generateUnexecutedItemsReportLogic,
    generateMfgItemsReportLogic,
    generateSpec888ItemsReportLogic,
    generateFaResumenAnualLogic,
    generateFaResumenMensualLogic,
    generateFaInformeDiarioLogic,
    generateFaRelacionEquipoLogic,
    generateMinuteReportLogic,
    generateMobilizationReportLogic,
    generateProjectStatusReportLogic,
    formatDate
} from "@/lib/reportLogic";
import { generateCertificationsSummaryExcel } from "@/lib/generateCertificationsSummary";

import ACT45Form from "@/components/ACT45Form";
import ACT96Form from "@/components/ACT96Form";
import { X } from "lucide-react";



// --- Tipos ---
interface ReportOption {
    id: string;
    label: string;
    description: string;
    icon: React.ReactNode;
    onPdf?: () => Promise<void> | void;
    onExcel?: () => Promise<void> | void;
    onWord?: () => Promise<void> | void;
}

interface SelectiveReportOption {
    id: string;
    label: string;
    description: string;
    icon: React.ReactNode;
    items: { id: string, label: string }[];
    selectLabel?: string;
    onPdf?: (selectedIds: string[]) => Promise<void> | void;
    onExcel?: (selectedIds: string[]) => Promise<void> | void;
    onWord?: (selectedIds: string[]) => Promise<void> | void;
}

// --- Componentes ---

function DropdownGroup({ title, children, icon }: { title: string, children: React.ReactNode, icon: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative inline-block text-left w-full group" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between px-6 py-5 rounded-[24px] border transition-all duration-500 shadow-sm ${isOpen
                    ? 'bg-primary text-white border-primary shadow-[0_15px_30px_rgba(0,75,177,0.25)] scale-[1.01]'
                    : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-primary/40 hover:shadow-lg'
                    }`}
            >
                <div className="flex items-center gap-4">
                    <div className={`p-2.5 rounded-xl border transition-colors ${isOpen ? 'bg-white/20 border-white/20' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-800'}`}>
                        {icon}
                    </div>
                    <span className="font-black text-[13px] uppercase tracking-[0.2em]">{title}</span>
                </div>
                <ChevronDown size={20} className={`transition-transform duration-500 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-[100] mt-4 w-full bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-xl rounded-[32px] shadow-[0_30px_60px_rgba(0,0,0,0.15)] border border-white/40 dark:border-slate-800/50 overflow-hidden animate-in fade-in zoom-in-95 duration-300 origin-top p-2">
                    <div className="grid grid-cols-1 gap-1">
                        {children}
                    </div>
                </div>
            )}
        </div>
    );
}

function StandardReportItem({ option, loading, onAction, children, isLiquidation }: { option: ReportOption, loading: boolean, onAction: () => void, children?: React.ReactNode, isLiquidation?: boolean }) {
    return (
        <div className="group/item w-full p-1.5 h-full">
            <div className="flex flex-col h-full rounded-[32px] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] transition-all duration-500 overflow-hidden">
                <div className="p-6 flex-1">
                    <div className="flex gap-4 items-start mb-4">
                        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 shadow-sm shrink-0 group-hover/item:border-primary/20 transition-all">
                            {option.icon}
                        </div>
                        <div className="flex flex-col pt-1">
                            <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                                {option.label}
                            </h3>
                            <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-1 leading-relaxed">
                                {option.description}
                            </p>
                        </div>
                    </div>
                    {children}
                </div>
                
                <div className="px-6 pb-6 mt-auto">
                    <div className="flex gap-2">
                        {option.onPdf && (
                            <button
                                onClick={() => { onAction(); option.onPdf?.(); }}
                                disabled={loading}
                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-md shadow-blue-100 active:scale-95 group/btn"
                            >
                                {loading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} className="group-hover/btn:-translate-y-0.5 transition-transform" />}
                                PDF
                            </button>
                        )}
                        {option.onExcel && (
                            <button
                                onClick={() => { onAction(); option.onExcel?.(); }}
                                disabled={loading}
                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-md shadow-emerald-100 active:scale-95 group/btn"
                            >
                                {loading ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} className="group-hover/btn:-translate-y-0.5 transition-transform" />}
                                EXCEL
                            </button>
                        )}
                        {option.onWord && (
                            <button
                                onClick={() => { onAction(); option.onWord?.(); }}
                                disabled={loading}
                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-md shadow-violet-100 active:scale-95 group/btn"
                            >
                                {loading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} className="group-hover/btn:-translate-y-0.5 transition-transform" />}
                                WORD
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function SelectiveReportItem({ option, loading, onAction, isLiquidation }: { option: SelectiveReportOption, loading: boolean, onAction: () => void, isLiquidation?: boolean }) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState("");

    const filteredItems = option.items.filter(i => i.label.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="group/item w-full p-1.5 h-full">
            <div className={`flex flex-col h-full rounded-[32px] bg-white dark:bg-slate-900 border transition-all duration-500 overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] ${selectedIds.length > 0 ? 'border-primary/40' : 'border-slate-100 dark:border-slate-800'}`}>
                <div className="p-6 flex-1">
                    <div className="flex gap-4 items-start mb-4">
                        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 shadow-sm shrink-0 group-hover/item:border-primary/20 transition-all">
                            {option.icon}
                        </div>
                        <div className="flex flex-col pt-1">
                            <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                                {option.label}
                            </h3>
                            <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-1 leading-relaxed">
                                {option.description}
                            </p>
                        </div>
                    </div>

                    <div className="mt-4">
                        <div className="flex items-center justify-between mb-2">
                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                               {selectedIds.length > 0 ? `${selectedIds.length} seleccionados` : 'Seleccion requerida'}
                           </span>
                           <button
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border ${isMenuOpen ? 'bg-slate-100 dark:bg-slate-800 border-slate-200' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 hover:border-primary/30'}`}
                            >
                                {isMenuOpen ? 'Cerrar Lista' : (option.selectLabel || 'Expandir Lista')}
                            </button>
                        </div>

                        {isMenuOpen && (
                            <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 p-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300 mb-4">
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-2.5 text-slate-400" size={14} />
                                    <input
                                        type="text"
                                        placeholder="Buscar..."
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl pl-8 pr-3 py-2 text-[10px] font-bold focus:ring-1 focus:ring-primary outline-none"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>

                                <div className="max-h-40 overflow-y-auto px-1 space-y-1 custom-scrollbar">
                                    {filteredItems.map(item => (
                                        <label key={item.id} className="flex items-center gap-2 p-2 hover:bg-white dark:hover:bg-slate-900 rounded-lg cursor-pointer transition-colors group/check">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(item.id)}
                                                onChange={() => {
                                                    if (selectedIds.includes(item.id)) setSelectedIds(selectedIds.filter(i => i !== item.id));
                                                    else setSelectedIds([...selectedIds, item.id]);
                                                }}
                                                className="w-3.5 h-3.5 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                                            />
                                            <span className={`text-[10px] font-bold ${selectedIds.includes(item.id) ? 'text-primary' : 'text-slate-600 dark:text-slate-400'}`}>
                                                {item.label}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                
                <div className="px-6 pb-6 mt-auto">
                    <div className="flex gap-2">
                        {option.onPdf && (
                            <button
                                onClick={() => { onAction(); option.onPdf?.(selectedIds); }}
                                disabled={loading || (option.items.length > 0 && selectedIds.length === 0)}
                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-md shadow-blue-100 active:scale-95 group/btn"
                            >
                                {loading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} className="group-hover/btn:-translate-y-0.5 transition-transform" />}
                                PDF
                            </button>
                        )}
                        {option.onExcel && (
                            <button
                                onClick={() => { onAction(); option.onExcel?.(selectedIds); }}
                                disabled={loading || (option.items.length > 0 && selectedIds.length === 0)}
                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-md shadow-emerald-100 active:scale-95 group/btn"
                            >
                                {loading ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} className="group-hover/btn:-translate-y-0.5 transition-transform" />}
                                EXCEL
                            </button>
                        )}
                        {option.onWord && (
                            <button
                                onClick={() => { onAction(); option.onWord?.(selectedIds); }}
                                disabled={loading || (option.items.length > 0 && selectedIds.length === 0)}
                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-md shadow-violet-100 active:scale-95 group/btn"
                            >
                                {loading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} className="group-hover/btn:-translate-y-0.5 transition-transform" />}
                                WORD
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- Pagina Principal ---

function ReportesContent() {
    const searchParams = useSearchParams();
    const projectId = searchParams.get("id");
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const [projectName, setProjectName] = useState<string>("");
    const [projectNum, setProjectNum] = useState<string>("");
    const [mounted, setMounted] = useState(false);
    const [showNoMissingMsg, setShowNoMissingMsg] = useState(false);
    const [reminderMsg, setReminderMsg] = useState<string | null>(null);

    const [endDate, setEndDate] = useState<string>("");
    const [rangeStart, setRangeStart] = useState<string>("");
    const [rangeEnd, setRangeEnd] = useState<string>("");
    const [reportFolderPath, setReportFolderPath] = useState<string | null>(null);

    useEffect(() => {
        const path = getLocalStorageItem("pact_reports_folder");
        if (path) setReportFolderPath(path);
    }, []);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Datos para selectivos
    const [chos, setChos] = useState<any[]>([]);
    const [certs, setCerts] = useState<any[]>([]);
    const [items, setItems] = useState<any[]>([]);
    const [minutes, setMinutes] = useState<any[]>([]);
    const [dailyLogs, setDailyLogs] = useState<any[]>([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isContratista, setIsContratista] = useState(false);
    const [isElectron, setIsElectron] = useState(false);
    const [selectedFaMonth, setSelectedFaMonth] = useState<string>(new Date().getMonth().toString());
    const [selectedFaDate, setSelectedFaDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [showACT45Form, setShowACT45Form] = useState(false);
    const [showACT96Form, setShowACT96Form] = useState(false);

    useEffect(() => {
        setIsElectron(!!(window as any).electronAPI);
    }, []);

    useEffect(() => {
        if (projectId) fetchProjectInfo();
    }, [projectId]);

    const fetchProjectInfo = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        let allowedIds: string[] = [];

        if (session) {
            const { data: userData } = await supabase.from("users").select("role_global").eq("id", session.user.id).single();
            if (userData?.role_global === "A") {
                allowedIds = ["ALL"];
                setIsAdmin(true);
            } else {
                const { data: mems } = await supabase.from("memberships").select("project_id, role").eq("user_id", session.user.id);
                if (mems && mems.length > 0) {
                    allowedIds = mems.map((m: any) => m.project_id);
                    const currentMem = mems.find((m: any) => m.project_id === projectId);
                    if (currentMem?.role === "F") {
                        setIsContratista(true);
                    }
                }
            }
        } else {
            const registrationStr = getLocalStorageItem("pact_registration");
            try {
                const registration = registrationStr ? JSON.parse(registrationStr) : null;
                allowedIds = registration?.allowedProjectIds || [];
            } catch (e) {
                console.error("Error parsing registration", e);
            }
        }

        if (!projectId) {
            window.location.href = "/proyectos";
            return;
        }

        if (!allowedIds.includes("ALL") && !allowedIds.includes(projectId)) {
            console.warn("Acceso denegado a reportes del proyecto:", projectId);
            window.location.href = "/proyectos";
            return;
        }

        const { data: p } = await supabase.from("projects").select("name, num_act").eq("id", projectId).single();
        if (p) {
            setProjectName(p.name);
            setProjectNum(p.num_act || "");
        }

        const { data: c } = await supabase.from("chos").select("id, cho_num, amendment_letter, cho_date, is_admin_amendment").eq("project_id", projectId).order('cho_num');
        if (c) setChos(c);

        const { data: pc } = await supabase.from("payment_certifications").select("id, cert_num, cert_date").eq("project_id", projectId).order('cert_num');
        if (pc) setCerts(pc);

        const { data: ci } = await supabase.from("contract_items").select("id, item_num, description").eq("project_id", projectId).order('item_num');
        if (ci) setItems(sortItemsNaturally(ci));

        const { data: mn } = await supabase.from("meeting_minutes").select("id, meeting_number, meeting_date").eq("project_id", projectId).order('meeting_date', { ascending: false });
        if (mn) setMinutes(mn);

        const { data: dl } = await supabase.from("daily_logs").select("id, log_date").eq("project_id", projectId).order('log_date', { ascending: false });
        if (dl) setDailyLogs(dl);
    };

    const handleAction = () => {
        setLoading(true);
        setStatus("Generando reporte...");
    };

    if (!mounted) return null;
    if (!projectId) return <div className="p-20 text-center">No project selected.</div>;

    return (
        <div className="container mx-auto py-8 font-geist animate-in fade-in duration-500 max-w-6xl relative">
            
            {showNoMissingMsg && (
                <div className="fixed inset-0 flex items-center justify-center z-[1000] bg-white/60 dark:bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 border-[8px] border-red-500 p-12 rounded-[40px] shadow-[0_30px_70px_rgba(220,38,38,0.3)] animate-in zoom-in duration-300 text-center max-w-2xl mx-4">
                        <BadgeAlert size={80} className="text-red-500 mx-auto mb-6 animate-bounce" />
                        <h2 className="text-6xl md:text-7xl font-black text-red-600 uppercase tracking-tighter leading-none mb-4">
                            ¡NO FALTA NINGUNO!
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 font-bold text-xl">Todos los materiales certificados estan al dia.</p>
                        <button 
                            onClick={() => setShowNoMissingMsg(false)}
                            className="mt-8 bg-red-600 text-white px-8 py-3 rounded-2xl font-black uppercase tracking-widest hover:bg-red-700 transition-all active:scale-95"
                        >
                            ENTENDIDO
                        </button>
                    </div>
                </div>
            )}

            {reminderMsg && (
                <div className="fixed inset-0 flex items-center justify-center z-[1000] bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-slate-900 border border-slate-700 p-12 rounded-[40px] shadow-[0_30px_70px_rgba(0,0,0,0.5)] animate-in zoom-in duration-300 text-center max-w-2xl mx-4">
                        <AlertCircle size={80} className="text-amber-400 mx-auto mb-6 animate-pulse" />
                        <h2 className="text-4xl md:text-5xl font-black text-amber-400 uppercase tracking-tighter leading-none mb-4">
                            ¡RECORDATORIO!
                        </h2>
                        <p className="text-slate-300 font-bold text-xl">{reminderMsg}</p>
                        <button 
                            onClick={() => setReminderMsg(null)}
                            className="mt-8 bg-amber-500 text-slate-950 px-8 py-3 rounded-2xl font-black uppercase tracking-widest hover:bg-amber-400 transition-all active:scale-95"
                        >
                            ENTENDIDO Y CONTINUAR
                        </button>
                    </div>
                </div>
            )}

            <div className="mb-12 flex flex-col items-center text-center">
                <Link href={`/proyectos/detalle?id=${projectId}`} className="text-sm flex items-center gap-1.5 text-slate-500 hover:text-primary mb-6 font-black uppercase tracking-widest transition-colors group">
                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Volver al Proyecto
                </Link>
                <div className="bg-primary/5 p-4 rounded-3xl border border-primary/10 mb-4 inline-block">
                    <ReportesLinkIcon />
                </div>
                <h1 className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter mb-2">Central de Reportes</h1>
                {projectName && (
                    <div className="flex flex-col items-center">
                        <p className="text-primary font-black uppercase tracking-[0.3em] text-sm mb-1">{projectName}</p>
                        {projectNum && (
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 px-3 py-1 rounded-full uppercase tracking-widest border border-blue-100 dark:border-blue-800">
                                    {formatProjectNumber(projectNum)}
                                </span>
                            </div>
                        )}
                    </div>
                )}
                <div className="h-1 w-20 bg-primary/20 rounded-full mt-6 mb-8"></div>


                <div className="flex flex-col items-center gap-2 mb-6 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm w-full max-w-[192px] relative">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-full">
                        Fecha de Corte (Opcional)
                    </label>
                    <div className="flex gap-2 w-full">
                        <input 
                            type="date" 
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:ring-1 focus:ring-primary transition-all cursor-pointer"
                        />
                    </div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight text-center mt-1">Si se deja vacio, se usa la fecha de hoy</p>
                </div>


                {/* --- Selector de Carpeta (Electron) --- */}
                {isElectron && (
                    <div className="flex flex-col items-center mb-12">
                        <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 max-w-lg w-full">
                            <div className="flex-1 text-left px-2 overflow-hidden">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Carpeta de Guardado (Auto-Save)</p>
                                <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate">
                                    {reportFolderPath || "No seleccionada (Usa descargas por defecto)"}
                                </p>
                            </div>
                            <button
                                onClick={async () => {
                                    // @ts-ignore
                                    const path = await window.electronAPI.selectFolder();
                                    if (path) {
                                        setReportFolderPath(path);
                                        setLocalStorageItem("pact_reports_folder", path);
                                    }
                                }}
                                className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-slate-700 hover:border-primary transition-all shrink-0"
                            >
                                {reportFolderPath ? "CAMBIAR" : "CONFIGURAR"}
                            </button>
                        </div>
                        {reportFolderPath && (
                            <button 
                                onClick={() => {
                                    setReportFolderPath(null);
                                    localStorage.removeItem("pact_reports_folder");
                                }}
                                className="text-[9px] font-black text-red-400 hover:text-red-500 uppercase tracking-widest mt-2 transition-colors"
                            >
                                Desactivar guardado automatico
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                {/* Informacion General */}
                <DropdownGroup title="Informacion General" icon={<Info size={18} className="text-blue-500" />}>
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'dashboard',
                            label: 'Dashboard Ejecutivo',
                            description: 'Resumen gerencial de costos y tiempo.',
                            icon: <Activity size={18} className="text-indigo-500" />,
                            onExcel: () => generateDashboardReportLogic(projectId, 'excel', endDate)
                                .then(() => setStatus("Reporte generado."))
                                .catch(e => { console.error(e); setStatus(`Error: ${e.message}`); })
                                .finally(() => setLoading(false))
                        }}
                    />
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'project-status',
                            label: 'Project Status',
                            description: 'Reporte completo de estado del proyecto con partidas, montos certificados y remanentes. Estilo ACT en color azul PACT.',
                            icon: <BarChart size={18} className="text-blue-600" />,
                            onExcel: () => generateProjectStatusReportLogic(projectId)
                                .then(() => setStatus("Reporte generado."))
                                .catch(e => { console.error(e); setStatus(`Error: ${e.message}`); })
                                .finally(() => setLoading(false))
                        }}
                    />
                </DropdownGroup>

                {/* Partidas */}
                <DropdownGroup title="Partidas y Subcontratos" icon={<ListChecks size={18} className="text-emerald-500" />}>
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'balance',
                            label: 'Balances Actuales',
                            description: 'Cantidades originales vs ejecutadas.',
                            icon: <ListChecks size={18} className="text-emerald-500" />,

                            onExcel: () => generateBalanceReportLogic(projectId, 'excel', endDate)
                                .then(() => setStatus("Reporte generado."))
                                .catch(e => { console.error(e); setStatus(`Error: ${e.message}`); })
                                .finally(() => setLoading(false))
                        }}
                    />
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'detail',
                            label: 'Detalle de cada partida',
                            description: 'Historial completo por cada partida.',
                            icon: <Files size={18} className="text-teal-500" />,

                            onExcel: () => generateDetailReportLogic(projectId, 'excel', endDate)
                                .then(() => setStatus("Reporte generado."))
                                .catch(e => { console.error(e); setStatus(`Error: ${e.message}`); })
                                .finally(() => setLoading(false))
                        }}
                    />
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'subcontratos',
                            label: 'Desglose de Subcontratos',
                            description: 'Reporte basado en el template de Excel de subcontratos.',
                            icon: <Files size={18} className="text-teal-500" />,
                            onExcel: () => generateSubcontractsReportLogic(projectId)
                                .then(() => setStatus("Reporte generado."))
                                .catch(e => { console.error(e); setStatus(`Error: ${e.message}`); })
                                .finally(() => setLoading(false))
                        }}
                    />
                    <StandardReportItem
                        isLiquidation={true}
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'mobilization-report',
                            label: 'Liquidacion Item No. 001 MOBILIZACION',
                            description: 'Reporte de pagos parciales por movilizacion segun cronograma de avance (2.5%, 5%, 10%).',
                            icon: <Activity size={18} className="text-blue-500" />,
                            onExcel: () => generateMobilizationReportLogic(projectId)
                                .then(() => setStatus("Reporte generado."))
                                .catch(e => setStatus(`Error: ${e.message}`))
                                .finally(() => setLoading(false))
                        }}
                    />
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'unexecuted-items',
                            label: 'Partidas No Ejecutadas',
                            description: 'Lista de partidas del contrato (originales y por CHO) que nunca han sido certificadas durante el proyecto.',
                            icon: <BadgeAlert size={18} className="text-orange-500" />,
                            onPdf: () => generateUnexecutedItemsReportLogic(projectId, 'pdf')
                                .then(() => setStatus("Reporte generado."))
                                .catch(e => { console.error(e); setStatus(`Error: ${e.message}`); })
                                .finally(() => setLoading(false))
                        }}
                    />
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'spec888-items-report',
                            label: 'Partidas con Especificación 888',
                            description: 'Listado de partidas que pertenecen a la especificación técnica 888.',
                            icon: <FileText size={18} className="text-purple-500" />,
                            onPdf: () => generateSpec888ItemsReportLogic(projectId, 'pdf')
                                .then(() => setStatus("Reporte generado."))
                                .catch(e => { console.error(e); setStatus(`Error: ${e.message}`); })
                                .finally(() => setLoading(false))
                        }}
                    />
                </DropdownGroup>

                {/* Manufactura */}
                <DropdownGroup title="Certificados de Manufactura e ICC" icon={<Package size={18} className="text-orange-500" />}>
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'mfg',
                            label: 'Listado de Certificados',
                            description: 'Resumen de aprobaciones de fabrica.',
                            icon: <Package size={18} className="text-orange-500" />,
                            onPdf: () => generateMfgReportLogic(projectId, 'pdf')
                                .then(() => setStatus("Reporte generado."))
                                .catch(e => { console.error(e); setStatus(`Error: ${e.message}`); })
                                .finally(() => setLoading(false))
                        }}
                    />
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'missing',
                            label: 'Certificaciones pendientes',
                            description: 'Materiales pagados sin certificado.',
                            icon: <BadgeAlert size={18} className="text-red-500" />,
                            onPdf: () => generateMissingMfgReportLogic(projectId, 'pdf')
                                .then(() => setStatus("Reporte generado."))
                                .catch(e => {
                                    if (e.message === "NO_FALTA_NINGUNO") {
                                        setShowNoMissingMsg(true);
                                        setTimeout(() => setShowNoMissingMsg(false), 8000);
                                        setStatus(null);
                                    } else {
                                        console.error(e);
                                        setStatus(`Error: ${e.message}`);
                                    }
                                })
                                .finally(() => setLoading(false))
                        }}
                    />
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'icc',
                            label: 'Resumen de ICC',
                            description: 'Vigencia de 60 dias de certificaciones.',
                            icon: <ShieldCheckIcon size={18} className="text-blue-500" />,

                            onExcel: () => generateIccReportLogic(projectId, 'excel')
                                .then(() => setStatus("Reporte generado."))
                                .catch(e => { console.error(e); setStatus(`Error: ${e.message}`); })
                                .finally(() => setLoading(false))
                        }}
                    />
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'mfg-items-report',
                            label: 'Partidas con Certificado de Manufactura',
                            description: 'Listado consolidado y único de partidas que poseen certificados de manufactura registrados.',
                            icon: <Package size={18} className="text-blue-500" />,
                            onPdf: () => generateMfgItemsReportLogic(projectId, 'pdf')
                                .then(() => setStatus("Reporte generado."))
                                .catch(e => { console.error(e); setStatus(`Error: ${e.message}`); })
                                .finally(() => setLoading(false))
                        }}
                    />
                </DropdownGroup>

                {/* MOS */}
                <DropdownGroup title="Material on Site (MOS)" icon={<Package size={18} className="text-amber-500" />}>
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'mos',
                            label: 'Inventario de MOS',
                            description: 'Reporte de facturas y deducciones.',
                            icon: <Package size={18} className="text-amber-500" />,
                            onPdf: () => generateMosReportLogic(projectId, 'pdf', endDate)
                                .then(() => setStatus("Reporte generado."))
                                .catch(e => { console.error(e); setStatus(`Error: ${e.message}`); })
                                .finally(() => setLoading(false))
                        }}
                    />
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'act117b',
                            label: 'ACT-117B',
                            description: 'Balance de Material on Site por partida.',
                            icon: <FileCheck size={18} className="text-amber-600" />,
                            onExcel: async () => {
                                try {
                                    const certId = (window as any).selectedMosCert;
                                    const itemNum = (window as any).selectedMosItem;
                                    if (!certId || !itemNum) { alert("Por favor seleccione certificacion y partida."); throw new Error("Selection required"); }
                                    await generateAct117BReportLogic(projectId, certId, itemNum, 'excel');
                                    setStatus("Reporte generado.");
                                } catch (e: any) { setStatus(`Error: ${e.message}`); } finally { setLoading(false); }
                            }
                        }}
                    >
                        <div className="grid grid-cols-2 gap-2 mt-2">
                            <select
                                id="mos-cert-select"
                                className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-3 py-2.5 text-[10px] font-bold outline-none focus:ring-1 focus:ring-primary transition-all"
                                onChange={(e) => (window as any).selectedMosCert = e.target.value}
                            >
                                <option value="">Certificacion...</option>
                                {certs.map(c => (
                                    <option key={c.id} value={c.id}>Cert #{c.cert_num}</option>
                                ))}
                            </select>
                            <select
                                id="mos-item-select"
                                className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-3 py-2.5 text-[10px] font-bold outline-none focus:ring-1 focus:ring-primary transition-all"
                                onChange={(e) => (window as any).selectedMosItem = e.target.value}
                            >
                                <option value="">Partida...</option>
                                {items.map(i => (
                                    <option key={i.id} value={i.item_num}>{i.item_num} - {i.description.substring(0, 15)}...</option>
                                ))}
                            </select>
                        </div>
                    </StandardReportItem>
                </DropdownGroup>

                {/* Change Orders */}
                <DropdownGroup title="Change Orders" icon={<FileDigit size={18} className="text-purple-500" />}>
                    <SelectiveReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'act122-selective',
                            label: 'ACT-122 (Oficial)',
                            description: 'Seleccione las ordenes de cambio para generar el formulario oficial ACT-122.',
                            icon: <FileCheck size={18} className="text-purple-600" />,
                            selectLabel: "Elegir CHO",
                            items: chos.map(c => ({ id: c.id, label: `CHO #${c.cho_num}${c.amendment_letter || ''} (${formatDate(c.cho_date)})` })),
                            onExcel: async (ids) => {
                                try {
                                    for(const id of ids) { await generateAct122ReportLogic(projectId, id, 'excel'); }
                                    setStatus("Reporte(s) generado(s).");
                                } catch (e: any) { setStatus(`Error: ${e.message}`); } finally { setLoading(false); }
                            }
                        }}
                    />




                    <SelectiveReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'act123b-selective',
                            label: 'ACT-123',
                            description: 'Seleccione las ordenes de cambio para generar el formulario suplementario ACT-123.',
                            icon: <FileCheck size={18} className="text-purple-600" />,
                            selectLabel: "Elegir CHO",
                            items: chos.map(c => ({ id: c.id, label: `CHO #${c.cho_num}${c.amendment_letter || ''} (${formatDate(c.cho_date)})` })),
                            onExcel: async (ids) => {
                                try {
                                    for(const id of ids) { await generateAct123ReportLogic(projectId, id, 'excel'); }
                                    setStatus("Reporte(s) generado(s).");
                                } catch (e: any) { setStatus(`Error: ${e.message}`); } finally { setLoading(false); }
                            }
                        }}
                    />

                    {/* ACT-124 UI Block */}
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'act124',
                            label: 'ACT-124 (Checklist)',
                            description: 'Checklist para ordenes de cambio. Los campos son editables en el PDF.',
                            icon: <FileCheck size={18} className="text-purple-800" />,
                            onPdf: async () => {
                                try {
                                    const choId = (window as any).selectedAct124Cho;
                                    if (!choId) { alert("Por favor seleccione una Orden de Cambio (CHO)."); throw new Error("Selection required"); }
                                    await generateAct124ReportLogic(projectId, choId, [], 'pdf');
                                    setStatus("Reporte generado.");
                                } catch (e: any) { setStatus(`Error: ${e.message}`); } finally { setLoading(false); }
                            }
                        }}
                    >
                        <div className="mt-2">
                            <select
                                id="act124-cho-select"
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-3 py-2.5 text-[10px] font-bold outline-none focus:ring-1 focus:ring-primary transition-all"
                                onChange={(e) => (window as any).selectedAct124Cho = e.target.value}
                            >
                                <option value="">Elegir CHO para Checklist...</option>
                                {chos.map(c => (
                                    <option key={c.id} value={c.id}>CHO #{c.cho_num}{c.amendment_letter || ''} ({formatDate(c.cho_date)})</option>
                                ))}
                            </select>
                        </div>
                    </StandardReportItem>

                    <SelectiveReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'dofaei-selective',
                            label: 'DOFAEI (Federal Aid Eligibility)',
                            description: 'Formulario de determinación de elegibilidad de ayuda federal para la orden de cambio seleccionada.',
                            icon: <FileDigit size={18} className="text-purple-700" />,
                            selectLabel: "Elegir CHO",
                            items: chos.map(c => ({ id: c.id, label: `CHO #${c.cho_num}${c.amendment_letter || ''} (${formatDate(c.cho_date)})` })),
                            onExcel: async (ids) => {
                                try {
                                    for(const id of ids) { await generateDOFAEIReportLogic(projectId, id, 'excel'); }
                                    setStatus("Reporte(s) generado(s).");
                                } catch (e: any) { setStatus(`Error: ${e.message}`); } finally { setLoading(false); }
                            }
                        }}
                    />

                    {/* ROA UI Block */}
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'roa',
                            label: 'ROA (Authorization)',
                            description: 'Record of Authorization to Proceed with Contract Revision.',
                            icon: <FileDigit size={18} className="text-purple-800" />,
                            onPdf: async () => {
                                try {
                                    const choId = (window as any).selectedRoaCho;
                                    if (!choId) { alert("Por favor seleccione una Orden de Cambio (CHO)."); throw new Error("Selection required"); }
                                    await generateRoaReportLogic(projectId, choId, 'pdf');
                                    setStatus("Reporte ROA generado.");
                                } catch (e: any) { setStatus(`Error: ${e.message}`); } finally { setLoading(false); }
                            }
                        }}
                    >
                        <div className="mt-2">
                            <select
                                id="roa-cho-select"
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-3 py-2.5 text-[10px] font-bold outline-none focus:ring-1 focus:ring-primary transition-all"
                                onChange={(e) => (window as any).selectedRoaCho = e.target.value}
                            >
                                <option value="">Elegir CHO para ROA...</option>
                                {chos.map(c => (
                                    <option key={c.id} value={c.id}>CHO #{c.cho_num}{c.amendment_letter || ''} ({formatDate(c.cho_date)})</option>
                                ))}
                            </select>
                        </div>
                    </StandardReportItem>

                    {/* CCML UI Block - Now the main Mod Log v3 */}
                    {!isContratista && (
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'ccml',
                            label: 'CCML (Contract Mod. Log)',
                            description: 'Contract Modification Log usando la plantilla oficial con formulas integradas. Genera un Excel listo para abrir.',
                            icon: <Files size={18} className="text-green-600" />,
                            onExcel: async () => {
                                try {
                                    const choId = (window as any).selectedCmlCho;
                                    await generateCCMLReportLogic(projectId || '', choId || undefined);
                                    setStatus("Reporte CCML generado.");
                                } catch (e: any) { setStatus(`Error: ${e.message}`); } finally { setLoading(false); }
                            }
                        }}
                    >
                        <div className="mt-2 text-left space-y-1">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">CHO especifico (opcional)</p>
                            <select
                                id="ccml-cho-select"
                                className="w-full bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800 rounded-xl px-3 py-2.5 text-[10px] font-bold outline-none focus:ring-1 focus:ring-green-500 transition-all"
                                onChange={(e) => (window as any).selectedCmlCho = e.target.value}
                            >
                                <option value="">Todos los CHOs (reporte completo)</option>
                                {chos.map(c => (
                                    <option key={c.id} value={c.id}>CHO #{c.cho_num}{c.amendment_letter || ''} ({formatDate(c.cho_date)})</option>
                                ))}
                            </select>
                        </div>
                    </StandardReportItem>
                    )}
                    

                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'act32-excel',
                            label: 'ACT-32 (Comité CHO)',
                            description: 'Evaluación de Órdenes de Cambio para presentación al Comité (Excel).',
                            icon: <FileSpreadsheet size={18} className="text-blue-700" />,
                            onExcel: async () => {
                                try {
                                    const choId = (window as any).selectedAct32Cho;
                                    if (!choId) { alert("Por favor seleccione un CHO para el reporte ACT-32."); return; }
                                    await generateAct32ReportLogic(projectId || "", choId);
                                    setStatus("Reporte ACT-32 generado.");
                                } catch (e: any) { setStatus(`Error: ${e.message}`); } finally { setLoading(false); }
                            }
                        }}
                    >
                        <div className="mt-2 text-left space-y-3">
                            <select
                                id="act32-cho-select"
                                className="w-full bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-xl px-3 py-2.5 text-[10px] font-bold outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                                onChange={(e) => (window as any).selectedAct32Cho = e.target.value}
                            >
                                <option value="">Elegir CHO para ACT-32...</option>
                                {chos.map(c => (
                                    <option key={c.id} value={c.id}>CHO #{c.cho_num}{c.amendment_letter || ''} ({formatDate(c.cho_date)})</option>
                                ))}
                            </select>
                        </div>
                    </StandardReportItem>

                    
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'time-ext-chart',
                            label: 'Grafica de Extension de Tiempo',
                            description: 'Grafica oficial de la linea de tiempo del proyecto y extensiones otorgadas.',
                            icon: <BarChart size={18} className="text-orange-500" />,
                            onPdf: async () => {
                                try {
                                    const choId = (window as any).selectedTimeExtCho;
                                    if (!choId) { alert("Por favor seleccione una CHO para la Grafica."); return; }
                                    const { generateTimeExtensionChartLogic } = await import("@/lib/reportLogic");
                                    await generateTimeExtensionChartLogic(projectId || "", choId);
                                    setStatus("Grafica generada.");
                                } catch (e: any) { setStatus(`Error: ${e.message}`); } finally { setLoading(false); }
                            }
                        }}
                    >
                        <div className="mt-2 text-left space-y-3">
                            <select
                                id="time-ext-cho-select"
                                className="w-full bg-orange-50/50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-800 rounded-xl px-3 py-2.5 text-[10px] font-bold outline-none focus:ring-1 focus:ring-orange-500 transition-all"
                                onChange={(e) => (window as any).selectedTimeExtCho = e.target.value}
                            >
                                <option value="">Elegir CHO para Grafica...</option>
                                {chos.map(c => (
                                    <option key={c.id} value={c.id}>CHO #{c.cho_num}{c.amendment_letter || ''} ({formatDate(c.cho_date)})</option>
                                ))}
                            </select>
                        </div>
                    </StandardReportItem>

                 </DropdownGroup>

                {/* 6. Certificaciones */}
                <DropdownGroup title="Certificaciones de Pago" icon={<FileText size={18} className="text-cyan-500" />}>
                    <SelectiveReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'act117c-selective',
                            label: 'ACT-117C (Oficial)',
                            description: 'Seleccione las certificaciones para generar el formulario oficial de pago (Anverso/Reverso).',
                            icon: <FileCheck size={18} className="text-blue-600" />,
                            items: certs.map(c => ({ id: c.id, label: `Cert #${c.cert_num} (${formatDate(c.cert_date)})` })),
                            onExcel: async (ids) => {
                                try {
                                    for (const id of ids) { await generateAct117CReportLogic(projectId, id, 'excel'); }
                                    setStatus("Reporte(s) generado(s).");
                                } catch (e: any) { setStatus(`Error: ${e.message}`); } finally { setLoading(false); }
                            }
                        }}
                    />
                    <SelectiveReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'act117a-selective',
                            label: 'ACT-117A (Item Sheets)',
                            description: 'Hojas de certificación individuales por ítem en formato Excel (Plantilla Oficial).',
                            icon: <FileSpreadsheet size={18} className="text-emerald-600" />,
                            items: certs.map(c => ({ id: c.id, label: `Cert #${c.cert_num} (${formatDate(c.cert_date)})` })),
                            onExcel: async (ids) => {
                                try {
                                    for (const id of ids) { await generateAct117AReportLogic(projectId, id, 'excel'); }
                                    setStatus("Reporte(s) generado(s).");
                                } catch (e: any) { setStatus(`Error: ${e.message}`); } finally { setLoading(false); }
                            }
                        }}
                    />
                    <SelectiveReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'cert-desglose-selective',
                            label: 'Desglose Financiero de Certificacion',
                            description: 'Reporte detallado con todos los valores positivos y negativos de la certificacion seleccionada.',
                            icon: <Calculator size={18} className="text-cyan-700" />,
                            items: certs.map(c => ({ id: c.id, label: `Cert #${c.cert_num} (${formatDate(c.cert_date)})` })),
                            onPdf: async (ids) => {
                                try {
                                    await generateCertReportLogic(projectId, ids, 'pdf');
                                    setStatus("Reporte(s) generado(s).");
                                } catch (e: any) { setStatus(`Error: ${e.message}`); } finally { setLoading(false); }
                            }
                        }}
                    />
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'cert-resumen-excel',
                            label: 'Resumen de Certificaciones',
                            description: 'Reporte consolidado de todas las certificaciones de pago y su estado financiero.',
                            icon: <FileSpreadsheet size={18} className="text-emerald-700" />,
                            onExcel: async () => {
                                try {
                                    const blob = await generateCertificationsSummaryExcel(projectId);
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `Resumen_Certificaciones_${projectId}.xlsx`;
                                    a.click();
                                    URL.revokeObjectURL(url);
                                    setStatus("Reporte generado.");
                                } catch (e: any) { setStatus(`Error: ${e.message}`); } finally { setLoading(false); }
                            }
                        }}
                    />
                </DropdownGroup>

                {/* 7. Liquidacion */}
                {!isContratista && (
                <DropdownGroup title="Liquidacion" icon={<FileCheck size={18} className="text-rose-600" />}>
                    <StandardReportItem
                        isLiquidation={true}
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'acceptance-checklist',
                            label: 'Final Acceptance Checklist (Liquidacion)',
                            description: 'Formulario oficial de cotejo para aceptacion final (Federal-Aid projects).',
                            icon: <FileCheck size={18} className="text-blue-600" />,
                            onPdf: () => generateFinalAcceptanceChecklistReportLogic(projectId, 'pdf')
                                .then(() => setStatus("Reporte generado."))
                                .catch(e => setStatus(`Error: ${e.message}`))
                                .finally(() => setLoading(false))
                        }}
                    />
                    <StandardReportItem
                        isLiquidation={true}
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'liquidacion-items',
                            label: 'Hojas de Liquidacion por Partida',
                            description: 'Una hoja por partida con CHOs, certificaciones y balance. Estructura basada en la forma oficial de liquidacion.',
                            icon: <FileCheck size={18} className="text-rose-600" />,
                            onPdf: () => generateLiquidacionItemsReportLogic(projectId, 'pdf')
                                .then(() => setStatus("Reporte generado."))
                                .catch(e => setStatus(`Error: ${e.message}`))
                                .finally(() => setLoading(false))
                        }}
                    />
                    <StandardReportItem
                        isLiquidation={true}
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'solicitud-material-cert',
                            label: 'Solicitud de Material Certification',
                            description: 'Documento Word/PDF con la plantilla oficial para solicitar la certificacion de materiales consolidando la informacion necesaria.',
                            icon: <FileText size={18} className="text-blue-600" />,
                            onWord: () => generateSolicitudMaterialCertDocxLogic(projectId)
                                .then(() => setStatus("Reporte generado."))
                                .catch(e => setStatus(`Error: ${e.message}`))
                                .finally(() => setLoading(false)),
                            onPdf: () => generateSolicitudMaterialCertPdfLogic(projectId)
                                .then(() => setStatus("Reporte generado."))
                                .catch(e => setStatus(`Error: ${e.message}`))
                                .finally(() => setLoading(false))
                        }}
                    />
                    <StandardReportItem
                        isLiquidation={true}
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'cho-final',
                            label: 'CHO Final',
                            description: 'Forma ACT-122 marcada como FINAL. Requiere que las hojas de liquidacion esten firmadas por el administrador y el contratista.',
                            icon: <FileCheck size={18} className="text-purple-600" />,
                            onExcel: async () => {
                                try {
                                    const { data: proj } = await supabase.from('projects').select('liquidation_data').eq('id', projectId).single();
                                    const { data: ci } = await supabase.from('contract_items').select('item_num').eq('project_id', projectId);
                                    const liqData = proj?.liquidation_data || {};
                                    const liquidatedItems = liqData.liquidated_items || [];
                                    const allSigned = ci?.every(it => {
                                        const liqItem = liquidatedItems.find((l: any) => l.item_num === it.item_num);
                                        return liqItem && liqItem.signed_by_admin && liqItem.signed_by_contractor;
                                    });
                                    if (!allSigned) { alert("Faltan firmas del Administrador o Contratista en las hojas de liquidacion. No se puede generar el reporte CHO Final."); setLoading(false); return; }
                                    const { data: lastCho } = await supabase.from('chos').select('id').eq('project_id', projectId).order('cho_num', { ascending: false }).limit(1);
                                    if (!lastCho || lastCho.length === 0) { alert("No se encontro ningun Change Order."); setLoading(false); return; }
                                    await generateAct122ReportLogic(projectId, lastCho[0].id, 'excel', true);
                                    setStatus("Reporte generado.");
                                } catch (e: any) { setStatus(`Error: ${e.message}`); } finally { setLoading(false); }
                            }
                        }}
                    />
                    <StandardReportItem
                        isLiquidation={true}
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'cert-final',
                            label: 'Certificacion Final',
                            description: 'Forma ACT-117C marcada como FINAL. Requiere que todas las hojas de liquidacion esten firmadas.',
                            icon: <FileCheck size={18} className="text-emerald-600" />,
                            onExcel: async () => {
                                try {
                                    const { data: proj } = await supabase.from('projects').select('liquidation_data').eq('id', projectId).single();
                                    const { data: ci } = await supabase.from('contract_items').select('item_num').eq('project_id', projectId);
                                    const liqData = proj?.liquidation_data || {};
                                    const liquidatedItems = liqData.liquidated_items || [];
                                    const allSigned = ci?.every(it => {
                                        const liqItem = liquidatedItems.find((l: any) => l.item_num === it.item_num);
                                        return liqItem && liqItem.signed_by_admin && liqItem.signed_by_contractor;
                                    });
                                    if (!allSigned) { alert("Faltan firmas en las hojas de liquidacion. No se puede generar la Certificacion Final."); setLoading(false); return; }
                                    await generateAct117CReportLogic(projectId, undefined, 'excel', true);
                                    setStatus("Reporte generado.");
                                } catch (e: any) { setStatus(`Error: ${e.message}`); } finally { setLoading(false); }
                            }
                        }}
                    />
                    <StandardReportItem
                        isLiquidation={true}
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'acceptance-official',
                            label: 'Final Acceptance Report (Oficial)',
                            description: 'Formulario oficial de aceptacion final (FHWA). Replica exacta del formato impreso.',
                            icon: <FileCheck size={18} className="text-indigo-600" />,
                            onPdf: () => generateFinalAcceptanceReportOfficialLogic(projectId, 'pdf')
                                .then(() => setStatus("Reporte generado."))
                                .catch(e => setStatus(`Error: ${e.message}`))
                                .finally(() => setLoading(false))
                        }}
                    />
                    <StandardReportItem
                        isLiquidation={true}
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'payroll-certification',
                            label: 'Payroll Certification',
                            description: 'Certificacion oficial de cumplimiento con leyes laborales federales y estatales.',
                            icon: <FileCheck size={18} className="text-emerald-600" />,
                            onPdf: () => generatePayrollCertificationReportLogic(projectId, 'pdf')
                                .then(() => setStatus("Reporte generado."))
                                .catch(e => setStatus(`Error: ${e.message}`))
                                .finally(() => setLoading(false))
                        }}
                    />
                    <StandardReportItem
                        isLiquidation={true}
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'material-certification',
                            label: 'Material Certification (sin firmas)',
                            description: 'Certificacion oficial de materiales, muestreo y pruebas de aceptacion.',
                            icon: <FileCheck size={18} className="text-orange-600" />,
                            onPdf: () => {
                                setReminderMsg("Este documento de certificacion de materiales es para solicitar las firmas correspondientes del administrador y de la Oficina de Materiales");
                                return generateMaterialCertificationReportLogic(projectId, 'pdf')
                                    .then(() => setStatus("Reporte generado."))
                                    .catch(e => { console.error(e); setStatus(`Error: ${e.message}`); })
                                    .finally(() => setLoading(false));
                            }
                        }}
                    />
                    <StandardReportItem
                        isLiquidation={true}
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'dbe-certification',
                            label: 'Certification of DBE Participation',
                            description: 'Certificacion oficial de participacion y esfuerzos de buena fe de empresas DBE.',
                            icon: <FileCheck size={18} className="text-blue-600" />,
                            onPdf: () => {
                                setReminderMsg("Junto con este reporte, se debe adjuntar la certificacion DBA del contratista.");
                                return generateDbeCertificationReportLogic(projectId, 'pdf')
                                    .then(() => setStatus("Reporte generado."))
                                    .catch(e => { console.error(e); setStatus(`Error: ${e.message}`); })
                                    .finally(() => setLoading(false));
                            }
                        }}
                    />
                    <StandardReportItem
                        isLiquidation={true}
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'final-construction-report',
                            label: 'Final Construction Report',
                            description: 'Informe final de construccion con resumen de partidas ejecutadas y pagos mensuales.',
                            icon: <FileCheck size={18} className="text-purple-600" />,
                            onPdf: () => generateFinalConstructionReportLogic(projectId, 'pdf')
                                .then(() => setStatus("Reporte generado."))
                                .catch((e: any) => setStatus(`Error: ${e.message}`))
                                .finally(() => setLoading(false))
                        }}
                    />
                    <StandardReportItem
                        isLiquidation={true}
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'final-estimate',
                            label: 'Final Estimate',
                            description: 'Desglose y resumen financiero oficial del proyecto (Final Estimate).',
                            icon: <FileCheck size={18} className="text-teal-600" />,
                            onPdf: () => generateFinalEstimateReportLogic(projectId, 'pdf')
                                .then(() => setStatus("Reporte generado."))
                                .catch((e: any) => setStatus(`Error: ${e.message}`))
                                .finally(() => setLoading(false))
                        }}
                    />
                    <StandardReportItem
                        isLiquidation={true}
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'contract-final-report',
                            label: 'Contract Final Report',
                            description: 'Informe final de contrato con resumen de fechas, ordenes de cambio y costos finales.',
                            icon: <FileCheck size={18} className="text-indigo-600" />,
                            onPdf: () => generateContractFinalReportLogic(projectId, 'pdf')
                                .then(() => setStatus("Reporte generado."))
                                .catch((e: any) => setStatus(`Error: ${e.message}`))
                                .finally(() => setLoading(false))
                        }}
                    />
                    <StandardReportItem
                        isLiquidation={true}
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'time-analysis',
                            label: 'Time Analysis (AC-457b)',
                            description: 'Evaluacion de overruns, dias autorizados y calculo de danos liquidos.',
                            icon: <FileCheck size={18} className="text-amber-600" />,
                            onPdf: () => generateTimeAnalysisReportLogic(projectId, 'pdf')
                                .then(() => setStatus("Reporte generado."))
                                .catch((e: any) => setStatus(`Error: ${e.message}`))
                                .finally(() => setLoading(false))
                        }}
                    />
                    <StandardReportItem
                        isLiquidation={true}
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'firmas-partidas',
                            label: 'Reporte de Firmas por Partidas',
                            description: 'Informe con el estado de las firmas (Admin, Contratista, Liquidador) para cada partida en liquidacion.',
                            icon: <FileCheck size={18} className="text-pink-600" />,
                            onPdf: () => generateSignedItemsReportLogic(projectId, 'pdf')
                                .then(() => setStatus("Reporte generado."))
                                .catch((e: any) => setStatus(`Error: ${e.message}`))
                                .finally(() => setLoading(false))
                        }}
                    />
                    <SelectiveReportItem
                        isLiquidation={true}
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'firmas-pendientes-selective',
                            label: 'Partidas con Firmas Pendientes',
                            description: 'Lista de items que aun no tienen todas las firmas requeridas (Admin, Contratista, Liquidador).',
                            icon: <BadgeAlert size={18} className="text-rose-500" />,
                            selectLabel: "Elegir Firmas",
                            items: [
                                { id: 'admin', label: 'Administrador' },
                                { id: 'contractor', label: 'Contratista' },
                                { id: 'liquidator', label: 'Liquidador' }
                            ],
                            onPdf: async (ids) => {
                                try {
                                    const filters = {
                                        admin: ids.includes('admin'),
                                        contractor: ids.includes('contractor'),
                                        liquidator: ids.includes('liquidator')
                                    };
                                    await generateMissingSignaturesReportLogic(projectId, 'pdf', filters);
                                    setStatus("Reporte generado.");
                                } catch (e: any) {
                                    setStatus(`Error: ${e.message}`);
                                } finally {
                                    setLoading(false);
                                }
                            }
                        }}
                    />
                    <StandardReportItem
                        isLiquidation={true}
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'environmental-review',
                            label: 'Environmental Review Certification',
                            description: 'Certificacion de cumplimiento con las revisiones ambientales y compromisos de construccion.',
                            icon: <FileCheck size={18} className="text-emerald-600" />,
                            onPdf: () => generateEnvironmentalReviewReportLogic(projectId, 'pdf')
                                .then(() => setStatus("Reporte generado."))
                                .catch((e: any) => setStatus(`Error: ${e.message}`))
                                .finally(() => setLoading(false))
                        }}
                    />
                </DropdownGroup>
                )}

                {/* 8. Force Account */}
                {!isContratista && (
                 <DropdownGroup title="Force Account" icon={<Calculator size={18} className="text-pink-500" />}>
                      <StandardReportItem
                         onAction={handleAction}
                         loading={loading}
                         option={{
                             id: 'fa-anual',
                             label: 'AC-51 Resumen del Trabajo del FA',
                             description: 'Basado en el formato oficial Resumen Anual de FA.',
                             icon: <FileText size={18} className="text-pink-500" />,
                             onPdf: () => generateFaResumenAnualLogic(projectId, 'pdf')
                                 .then(() => setStatus("Reporte generado."))
                                 .catch((e: any) => { console.error(e); setStatus(`Error: ${e.message}`); })
                                 .finally(() => setLoading(false))
                         }}
                     />
                     <StandardReportItem
                         onAction={handleAction}
                         loading={loading}
                         option={{
                             id: 'fa-equipo',
                             label: 'AC-50 Relación de equipo del FA',
                             description: 'Basado en el formato oficial Relacion de equipo de FA.',
                             icon: <FileText size={18} className="text-pink-500" />,
                             onPdf: () => generateFaRelacionEquipoLogic(projectId, 'pdf', selectedFaMonth)
                                 .then(() => setStatus("Reporte generado."))
                                 .catch((e: any) => { console.error(e); setStatus(`Error: ${e.message}`); })
                                 .finally(() => setLoading(false))
                         }}
                     >
                        <div className="mt-2">
                            <select
                                value={selectedFaMonth}
                                onChange={(e) => setSelectedFaMonth(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-3 py-2.5 text-[10px] font-bold outline-none focus:ring-1 focus:ring-primary transition-all"
                            >
                                <option value="0">Enero</option>
                                <option value="1">Febrero</option>
                                <option value="2">Marzo</option>
                                <option value="3">Abril</option>
                                <option value="4">Mayo</option>
                                <option value="5">Junio</option>
                                <option value="6">Julio</option>
                                <option value="7">Agosto</option>
                                <option value="8">Septiembre</option>
                                <option value="9">Octubre</option>
                                <option value="10">Noviembre</option>
                                <option value="11">Diciembre</option>
                            </select>
                        </div>
                     </StandardReportItem>
                     <StandardReportItem
                         onAction={handleAction}
                         loading={loading}
                         option={{
                             id: 'fa-diario',
                             label: 'AC-49 Diario de trabajos por FA',
                             description: 'Basado en el formato oficial Informe Diario de FA.',
                             icon: <FileText size={18} className="text-pink-500" />,
                             onPdf: () => generateFaInformeDiarioLogic(projectId, 'pdf', selectedFaDate)
                                 .then(() => setStatus("Reporte generado."))
                                 .catch((e: any) => { console.error(e); setStatus(`Error: ${e.message}`); })
                                 .finally(() => setLoading(false))
                         }}
                     >
                        <div className="mt-2">
                            <input 
                                type="date"
                                value={selectedFaDate}
                                onChange={(e) => setSelectedFaDate(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-3 py-2.5 text-[10px] font-bold outline-none focus:ring-1 focus:ring-primary transition-all"
                            />
                        </div>
                     </StandardReportItem>
                     <StandardReportItem
                         onAction={handleAction}
                         loading={loading}
                         option={{
                             id: 'fa-mensual-old',
                             label: 'Resumen Mensual de FA (Anterior)',
                             description: 'Versión previa del resumen mensual.',
                             icon: <FileText size={18} className="text-pink-500" />,
                             onPdf: () => generateFaResumenMensualLogic(projectId, 'pdf')
                                 .then(() => setStatus("Reporte generado."))
                                 .catch((e: any) => { console.error(e); setStatus(`Error: ${e.message}`); })
                                 .finally(() => setLoading(false))
                         }}
                     />
                 </DropdownGroup>
                )}

                {/* 9. Distribucion de Fondos */}
                <DropdownGroup title="Distribucion de Fondos" icon={<Activity size={18} className="text-green-600" />}>
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'fund-source-projected',
                            label: 'Presupuesto Proyectado — ACT vs FHWA',
                            description: 'Distribucion de todo el presupuesto del contrato original mas las ordenes de Cambio, aunque no se hayan pagado.',
                            icon: <Package size={18} className="text-blue-600" />,
                            onPdf: () => generateProjectedFundDistributionReportLogic(projectId, 'pdf', endDate)
                                .then(() => setStatus("Reporte generado."))
                                .catch(e => { console.error(e); setStatus(`Error: ${e.message}`); })
                                .finally(() => setLoading(false)),
                            onExcel: () => generateProjectedFundDistributionReportLogic(projectId, 'excel', endDate)
                                .then(() => setStatus("Reporte generado."))
                                .catch(e => { console.error(e); setStatus(`Error: ${e.message}`); })
                                .finally(() => setLoading(false))
                        }}
                    />
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'fund-source-real',
                            label: 'Distribucion Real — ACT vs FHWA (Pagos)',
                            description: 'Distribucion basada unicamente en las partidas certificadas y pagadas hasta la fecha de corte.',
                            icon: <Activity size={18} className="text-green-600" />,
                            onPdf: () => generateFundSourceReportLogic(projectId, 'pdf', endDate)
                                .then(() => setStatus("Reporte generado."))
                                .catch(e => { console.error(e); setStatus(`Error: ${e.message}`); })
                                .finally(() => setLoading(false)),
                            onExcel: () => generateFundSourceReportLogic(projectId, 'excel', endDate)
                                .then(() => setStatus("Reporte generado."))
                                .catch(e => { console.error(e); setStatus(`Error: ${e.message}`); })
                                .finally(() => setLoading(false))
                        }}
                    />
                </DropdownGroup>

                {/* 9. Minutas de Reunion */}
                <DropdownGroup title="Minutas de Reunion" icon={<Files size={18} className="text-amber-600" />}>
                    <SelectiveReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'minutes-selective',
                            label: 'Minutas de Reunion',
                            description: 'Seleccione la fecha de la reunion para generar la minuta oficial.',
                            icon: <FileText size={18} className="text-amber-700" />,
                            selectLabel: "Elegir Fecha",
                            items: minutes.map(m => ({ id: m.id, label: `${m.meeting_number || 'Reunion'} (${formatDate(m.meeting_date)})` })),
                            onWord: async (ids) => {
                                try {
                                    await generateMinuteReportLogic(projectId, ids[0], 'word');
                                    setStatus("Minuta generada.");
                                } catch (e: any) {
                                    setStatus(`Error: ${e.message}`);
                                } finally {
                                    setLoading(false);
                                }
                            }
                        }}
                    />
                </DropdownGroup>

                {/* 10. Informes de Campo */}
                {!isContratista && (
                    <DropdownGroup title="Informes de Campo" icon={<FileText size={18} className="text-emerald-500" />}>
                    <div className="px-6 py-4 flex flex-col gap-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center px-4">
                            Para crear nuevos informes de campo, diríjase a la sección de "Actividades" en el detalle del proyecto.
                        </p>
                    </div>
                    <SelectiveReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'act45-selective',
                            label: 'ACT-45 Informe Diario',
                            description: 'Seleccione la fecha del reporte para generar el ACT-45 en formato PDF o Excel.',
                            icon: <FileDigit size={18} className="text-emerald-600" />,
                            selectLabel: "Elegir Fecha",
                            items: dailyLogs.map(m => ({ id: m.id, label: `Informe del ${formatDate(m.log_date)}` })),
                            onPdf: async (ids) => {
                                try {
                                    const { generateAct45PdfReport } = await import("@/lib/generateAct45PdfReport");
                                    for (let id of ids) await generateAct45PdfReport(projectId || "", id);
                                    setStatus("Reporte(s) generado(s).");
                                } catch (e: any) { setStatus(`Error: ${e.message}`); } finally { setLoading(false); }
                            },
                            onExcel: async (ids) => {
                                try {
                                    const { generateAct45ExcelReport } = await import("@/lib/generateAct45ExcelReport");
                                    for (let id of ids) await generateAct45ExcelReport(projectId || "", id);
                                    setStatus("Reporte(s) generado(s).");
                                } catch (e: any) { setStatus(`Error: ${e.message}`); } finally { setLoading(false); }
                            }
                        }}
                    />
                    <SelectiveReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'act96-selective',
                            label: 'ACT-96 Informe de Inspeccion',
                            description: 'Seleccione la fecha del reporte para generar el ACT-96 en formato PDF o Excel.',
                            icon: <FileCheck size={18} className="text-emerald-600" />,
                            selectLabel: "Elegir Fecha",
                            items: dailyLogs.map(m => ({ id: m.id, label: `Inspeccion del ${formatDate(m.log_date)}` })),
                            onPdf: async (ids) => {
                                try {
                                    const { generateAct96PdfReport } = await import("@/lib/generateAct96PdfReport");
                                    for (let id of ids) await generateAct96PdfReport(projectId || "", id);
                                    setStatus("Reporte(s) generado(s).");
                                } catch (e: any) { setStatus(`Error: ${e.message}`); } finally { setLoading(false); }
                            },
                            onExcel: async (ids) => {
                                try {
                                    const { generateAct96ExcelReport } = await import("@/lib/generateAct96ExcelReport");
                                    for (let id of ids) await generateAct96ExcelReport(projectId || "", id);
                                    setStatus("Reporte(s) generado(s).");
                                } catch (e: any) { setStatus(`Error: ${e.message}`); } finally { setLoading(false); }
                            }
                        }}
                    />

                    {/* Generación por Periodo (ACT-45 y ACT-96) */}
                    <div className="mx-1.5 mb-1.5 p-6 rounded-[32px] bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                                <Calendar className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">Impresión por Periodo</h4>
                                <p className="text-[9px] font-bold text-slate-400 uppercase">Generar múltiples informes de un rango de fechas</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-6">
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Fecha Inicio</label>
                                <input 
                                    type="date" 
                                    value={rangeStart}
                                    onChange={(e) => setRangeStart(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:ring-1 focus:ring-primary transition-all"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Fecha Fin</label>
                                <input 
                                    type="date" 
                                    value={rangeEnd}
                                    onChange={(e) => setRangeEnd(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:ring-1 focus:ring-primary transition-all"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={async () => {
                                    if (!rangeStart || !rangeEnd) return alert("Seleccione un rango de fechas");
                                    handleAction();
                                    try {
                                        const logsInRange = dailyLogs.filter(l => l.log_date >= rangeStart && l.log_date <= rangeEnd);
                                        if (logsInRange.length === 0) throw new Error("No hay informes en este rango");
                                        const { generateAct45ExcelReport } = await import("@/lib/generateAct45ExcelReport");
                                        for (const log of logsInRange) {
                                            await generateAct45ExcelReport(projectId || "", log.id);
                                            // Pequeña pausa para no saturar el sistema de archivos
                                            await new Promise(r => setTimeout(r, 500));
                                        }
                                        setStatus(`Se generaron ${logsInRange.length} informes ACT-45.`);
                                    } catch (e: any) { setStatus(`Error: ${e.message}`); } finally { setLoading(false); }
                                }}
                                disabled={loading}
                                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all shadow-md shadow-emerald-100 disabled:opacity-50"
                            >
                                ACT-45 (Excel)
                            </button>
                            <button
                                onClick={async () => {
                                    if (!rangeStart || !rangeEnd) return alert("Seleccione un rango de fechas");
                                    handleAction();
                                    try {
                                        const logsInRange = dailyLogs.filter(l => l.log_date >= rangeStart && l.log_date <= rangeEnd);
                                        if (logsInRange.length === 0) throw new Error("No hay informes en este rango");
                                        const { generateAct96ExcelReport } = await import("@/lib/generateAct96ExcelReport");
                                        for (const log of logsInRange) {
                                            await generateAct96ExcelReport(projectId || "", log.id);
                                            await new Promise(r => setTimeout(r, 500));
                                        }
                                        setStatus(`Se generaron ${logsInRange.length} informes ACT-96.`);
                                    } catch (e: any) { setStatus(`Error: ${e.message}`); } finally { setLoading(false); }
                                }}
                                disabled={loading}
                                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all shadow-md shadow-blue-100 disabled:opacity-50"
                            >
                                ACT-96 (Excel)
                            </button>
                        </div>
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tight text-center mt-3">
                            Nota: Se generarán archivos individuales para cada día con datos.
                        </p>
                    </div>
                </DropdownGroup>
                )}

            </div>

            {status && (
                <div className={`mt-12 p-6 rounded-3xl flex items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-4 shadow-xl border ${status.includes('Error') ? 'bg-red-50 text-red-700 border-red-100' :
                    status.includes('generado') ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                        'bg-white dark:bg-slate-900 text-primary border-slate-100 dark:border-slate-800'}`}>
                    {status.includes('generado') ? <CheckCircle2 size={24} /> : status.includes('Error') ? <AlertCircle size={24} /> : <Loader2 size={24} className="animate-spin" />}
                    <p className="font-black text-xl uppercase tracking-widest">{status}</p>
                </div>
            )}

            {/* --- Modal ACT-45 --- */}
            {showACT45Form && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-[#F8FAFC] dark:bg-[#020617] rounded-[48px] shadow-2xl w-full max-w-6xl my-8 relative animate-in zoom-in-95 duration-300 border border-white/20">
                        <button 
                            onClick={() => setShowACT45Form(false)}
                            className="absolute top-8 right-8 p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 z-[110]"
                        >
                            <X size={24} />
                        </button>
                        <div className="p-8 md:p-12">
                            <ACT45Form 
                                projectId={projectId} 
                                onClose={() => setShowACT45Form(false)} 
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* --- Modal ACT-96 --- */}
            {showACT96Form && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-[#F8FAFC] dark:bg-[#020617] rounded-[48px] shadow-2xl w-full max-w-6xl my-8 relative animate-in zoom-in-95 duration-300 border border-white/20">
                        <button 
                            onClick={() => setShowACT96Form(false)}
                            className="absolute top-8 right-8 p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 z-[110]"
                        >
                            <X size={24} />
                        </button>
                        <div className="p-8 md:p-12">
                            <ACT96Form 
                                projectId={projectId} 
                                numAct={projectNum} 
                                onSaved={() => {
                                    fetchProjectInfo();
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* --- Full Screen Loader --- */}
            {loading && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl flex items-center justify-center z-[1000] animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 p-12 rounded-[48px] shadow-2xl flex flex-col items-center gap-6 border border-white/20 animate-in zoom-in-95 duration-300">
                        <div className="relative">
                            <div className="absolute inset-0 animate-ping bg-primary/20 rounded-full" />
                            <Loader2 className="animate-spin text-primary relative" size={64} />
                        </div>
                        <div className="text-center">
                            <p className="font-black text-2xl text-slate-900 dark:text-white mb-2 uppercase tracking-tighter">PROCESANDO REPORTE</p>
                            <div className="flex items-center justify-center gap-2">
                                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" />
                            </div>
                            <p className="text-sm font-bold text-slate-400 mt-4 uppercase tracking-widest">Esto tomará solo unos segundos...</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function ReportesLinkIcon() {
    return (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <line x1="10" y1="9" x2="8" y2="9" />
        </svg>
    )
}

export default function ReportesPage() {
    return (
        <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" size={48} /></div>}>
            <ReportesContent />
        </Suspense>
    );
}
