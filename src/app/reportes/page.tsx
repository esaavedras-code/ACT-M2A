
"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
    FileText, Download, AlertCircle, CheckCircle2,
    Package, ListChecks, ArrowLeft, Loader2,
    Activity, Info, Files, BadgeAlert, FileDigit,
    ChevronDown, Search, FileCheck, BarChart, Calculator
} from "lucide-react";
import Link from "next/link";
import { getLocalStorageItem, setLocalStorageItem } from "@/lib/utils";
import {
    generateBalanceReportLogic,
    generateDetailReportLogic,
    generateMfgReportLogic,
    generateMissingMfgReportLogic,
    generateMosReportLogic,
    generateChoReportLogic,
    generateCertReportLogic,
    generateDashboardReportLogic,
    generateFundSourceReportLogic,
    generateProjectedFundDistributionReportLogic,
    generateAct117CReportLogic,
    generateAct117BReportLogic,
    generateAct122ReportLogic,
    generateAct123ReportLogic,
    generateAct123BReportLogic,
    generateAct124ReportLogic,
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
    generateDbeCertificationReportLogic,
    generateSignedItemsReportLogic,
    generateMissingSignaturesReportLogic,
    generateFaResumenAnualLogic,
    generateFaResumenMensualLogic,
    generateFaInformeDiarioLogic,
    generateFaRelacionEquipoLogic,
    formatDate
} from "@/lib/reportLogic";
import { generateAct117C } from "@/lib/generateAct117C";



// --- Tipos ---
interface ReportOption {
    id: string;
    label: string;
    description: string;
    icon: React.ReactNode;
    action: () => Promise<void> | void;
}

interface SelectiveReportOption {
    id: string;
    label: string;
    description: string;
    icon: React.ReactNode;
    items: { id: string, label: string }[];
    selectLabel?: string;
    onGenerate: (selectedIds: string[]) => Promise<void> | void;
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

function StandardReportItem({ option, loading, onAction, children }: { option: ReportOption, loading: boolean, onAction: () => void, children?: React.ReactNode }) {
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
                
                <div className="px-6 pb-6">
                    <button
                        onClick={() => { onAction(); option.action(); }}
                        disabled={loading}
                        className="w-full bg-[#004bb1] text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.15em] hover:bg-[#003d8f] transition-all shadow-[0_10px_20px_rgba(0,75,177,0.2)] active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50 group/btn"
                    >
                        {loading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} className="group-hover/btn:-translate-y-0.5 transition-transform" />} 
                        {loading ? 'Generando...' : 'GENERAR REPORTE'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function SelectiveReportItem({ option, loading, onAction }: { option: SelectiveReportOption, loading: boolean, onAction: () => void }) {
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
                               {selectedIds.length > 0 ? `${selectedIds.length} seleccionados` : 'Selección requerida'}
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
                
                <div className="px-6 pb-6">
                    <button
                        onClick={() => { onAction(); option.onGenerate(selectedIds); }}
                        disabled={loading || (option.items.length > 0 && selectedIds.length === 0)}
                        className="w-full bg-[#004bb1] text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.15em] hover:bg-[#003d8f] transition-all shadow-[0_10px_20px_rgba(0,75,177,0.2)] active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-30 group/btn"
                    >
                        {loading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} className="group-hover/btn:-translate-y-0.5 transition-transform" />} 
                        {loading ? 'Generando...' : selectedIds.length > 0 ? `GENERAR ${selectedIds.length} REPORTES` : 'GENERAR REPORTE'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// --- Página Principal ---

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
    const [reportFormat, setReportFormat] = useState<'pdf' | 'excel'>('pdf');
    const [endDate, setEndDate] = useState<string>("");
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
    const [isElectron, setIsElectron] = useState(false);

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
                const { data: mems } = await supabase.from("memberships").select("project_id").eq("user_id", session.user.id);
                if (mems && mems.length > 0) {
                    allowedIds = mems.map((m: any) => m.project_id);
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

        const { data: c } = await supabase.from("chos").select("id, cho_num, amendment_letter, cho_date").eq("project_id", projectId).order('cho_num');
        if (c) setChos(c);

        const { data: pc } = await supabase.from("payment_certifications").select("id, cert_num, cert_date").eq("project_id", projectId).order('cert_num');
        if (pc) setCerts(pc);

        const { data: ci } = await supabase.from("contract_items").select("id, item_num, description").eq("project_id", projectId).order('item_num');
        if (ci) setItems(ci);

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
                        <p className="text-slate-500 dark:text-slate-400 font-bold text-xl">Todos los materiales certificados están al día.</p>
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
                                    {projectNum}
                                </span>
                            </div>
                        )}
                    </div>
                )}
                <div className="h-1 w-20 bg-primary/20 rounded-full mt-6 mb-8"></div>

                {/* --- Selector de Formato --- */}
                <div className="flex items-center gap-4 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm mb-4">
                    <button 
                        onClick={() => setReportFormat('pdf')}
                        className={`px-6 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 ${reportFormat === 'pdf' ? 'bg-primary text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >
                         <FileText size={16} /> PDF
                    </button>
                    <button 
                        onClick={() => setReportFormat('excel')}
                        className={`px-6 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 ${reportFormat === 'excel' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >
                         <FileDigit size={16} /> EXCEL
                    </button>
                </div>
                <div className="flex flex-col items-center gap-2 mb-6 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm w-full max-w-sm relative">
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
                        <button 
                            title="Seleccionar hoy"
                            onClick={() => {
                                const localDate = new Date();
                                const offset = localDate.getTimezoneOffset();
                                const adjustedDate = new Date(localDate.getTime() - (offset*60*1000));
                                setEndDate(adjustedDate.toISOString().split('T')[0]);
                            }}
                            className="bg-primary/10 text-primary hover:bg-primary/20 dark:bg-primary/20 dark:hover:bg-primary/30 transition-colors rounded-xl px-4 flex items-center justify-center font-bold text-[10px] uppercase tracking-widest border border-primary/20"
                        >
                            HOY
                        </button>
                    </div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight text-center mt-1">Si se deja vacío, se usa la fecha de hoy</p>
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Seleccione el formato preferido para sus reportes</p>

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
                                Desactivar guardado automático
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                {/* 1. Información General */}
                <DropdownGroup title="1. Información General" icon={<Info size={18} className="text-blue-500" />}>
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'dashboard',
                            label: '1. Dashboard Ejecutivo',
                            description: 'Resumen gerencial de costos y tiempo.',
                            icon: <Activity size={18} className="text-indigo-500" />,
                            action: () => {
                                if (reportFormat === 'excel') {
                                    alert("El reporte de información principal no está disponible en formato Excel por requerimiento.");
                                    setLoading(false);
                                    return;
                                }
                                generateDashboardReportLogic(projectId, reportFormat, endDate)
                                    .then(() => setStatus("Reporte generado."))
                                    .catch(e => {
                                        console.error(e);
                                        setStatus(`Error: ${e.message}`);
                                    })
                                    .finally(() => setLoading(false))
                            }
                        }}
                    />
                </DropdownGroup>

                {/* 2. Partidas */}
                <DropdownGroup title="2. Gestión de Partidas" icon={<ListChecks size={18} className="text-emerald-500" />}>
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'balance',
                            label: '1. Balances Actuales',
                            description: 'Cantidades originales vs ejecutadas.',
                            icon: <ListChecks size={18} className="text-emerald-500" />,
                            action: () => generateBalanceReportLogic(projectId, reportFormat, endDate)
                                .then(() => setStatus("Reporte generado."))
                                .catch(e => {
                                    console.error(e);
                                    setStatus(`Error: ${e.message}`);
                                })
                                .finally(() => setLoading(false))
                        }}
                    />
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'detail',
                            label: '2. Detalle de cada partida',
                            description: 'Historial completo por cada partida.',
                            icon: <Files size={18} className="text-teal-500" />,
                            action: () => generateDetailReportLogic(projectId, reportFormat, endDate)
                                .then(() => setStatus("Reporte generado."))
                                .catch(e => {
                                    console.error(e);
                                    setStatus(`Error: ${e.message}`);
                                })
                                .finally(() => setLoading(false))
                        }}
                    />
                </DropdownGroup>

                {/* 3. Manufactura */}
                <DropdownGroup title="3. Certificados de Manufactura" icon={<Package size={18} className="text-orange-500" />}>
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'mfg',
                            label: '1. Listado de Certificados',
                            description: 'Resumen de aprobaciones de fábrica.',
                            icon: <Package size={18} className="text-orange-500" />,
                            action: () => generateMfgReportLogic(projectId, reportFormat)
                                .then(() => setStatus("Reporte generado."))
                                .catch(e => {
                                    console.error(e);
                                    setStatus(`Error: ${e.message}`);
                                })
                                .finally(() => setLoading(false))
                        }}
                    />
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'missing',
                            label: '2. Certificaciones pendientes',
                            description: 'Materiales pagados sin certificado.',
                            icon: <BadgeAlert size={18} className="text-red-500" />,
                            action: () => generateMissingMfgReportLogic(projectId, reportFormat)
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
                </DropdownGroup>

                {/* 4. MOS */}
                <DropdownGroup title="4. Material on Site (MOS)" icon={<Package size={18} className="text-amber-500" />}>
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'mos',
                            label: '1. Inventario de MOS',
                            description: 'Reporte de facturas y deducciones.',
                            icon: <Package size={18} className="text-amber-500" />,
                            action: () => generateMosReportLogic(projectId, reportFormat)
                                .then(() => setStatus("Reporte generado."))
                                .catch(e => {
                                    console.error(e);
                                    setStatus(`Error: ${e.message}`);
                                })
                                .finally(() => setLoading(false))
                        }}
                    />
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'act117b',
                            label: '2. ACT-117B',
                            description: 'Balance de Material on Site por partida.',
                            icon: <FileCheck size={18} className="text-amber-600" />,
                            action: async () => {
                                try {
                                    const certId = (window as any).selectedMosCert;
                                    const itemNum = (window as any).selectedMosItem;
                                    if (!certId || !itemNum) {
                                        alert("Por favor seleccione certificación y partida.");
                                        throw new Error("Selection required");
                                    }
                                    if (reportFormat === 'excel') {
                                        alert("El reporte ACT-117B no está disponible en formato Excel por requerimiento.");
                                        setLoading(false);
                                        return;
                                    }
                                    await generateAct117BReportLogic(projectId, certId, itemNum, reportFormat);
                                    setStatus("Reporte generado.");
                                } catch (e: any) {
                                    setStatus(`Error: ${e.message}`);
                                } finally {
                                    setLoading(false);
                                }
                            }
                        }}
                    >
                        <div className="grid grid-cols-2 gap-2 mt-2">
                            <select
                                id="mos-cert-select"
                                className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-3 py-2.5 text-[10px] font-bold outline-none focus:ring-1 focus:ring-primary transition-all"
                                onChange={(e) => (window as any).selectedMosCert = e.target.value}
                            >
                                <option value="">Certificación...</option>
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

                {/* 5. Change Orders */}
                <DropdownGroup title="5. Change Orders" icon={<FileDigit size={18} className="text-purple-500" />}>
                    <SelectiveReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'act122-selective',
                            label: '1. ACT-122 (Oficial)',
                            description: 'Seleccione las órdenes de cambio para generar el formulario oficial ACT-122.',
                            icon: <FileCheck size={18} className="text-purple-600" />,
                            selectLabel: "Elegir CHO",
                            items: chos.map(c => ({ id: c.id, label: `CHO #${c.cho_num}${c.amendment_letter || ''} (${formatDate(c.cho_date)})` })),
                            onGenerate: async (ids) => {
                                try {
                                    for(const id of ids) {
                                        await generateAct122ReportLogic(projectId, id, reportFormat);
                                    }
                                    setStatus("Reporte(s) generado(s).");
                                } catch (e: any) {
                                    setStatus(`Error: ${e.message}`);
                                } finally {
                                    setLoading(false);
                                }
                            }
                        }}
                    />

                    <SelectiveReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'act123-selective',
                            label: '2. ACT-123 (Supplementary Form)',
                            description: 'Seleccione las órdenes de cambio para generar el formulario suplementario ACT-123.',
                            icon: <FileCheck size={18} className="text-purple-600" />,
                            selectLabel: "Elegir CHO",
                            items: chos.map(c => ({ id: c.id, label: `CHO #${c.cho_num}${c.amendment_letter || ''} (${formatDate(c.cho_date)})` })),
                            onGenerate: async (ids) => {
                                try {
                                    for(const id of ids) {
                                        await generateAct123ReportLogic(projectId, id, reportFormat);
                                    }
                                    setStatus("Reporte(s) generado(s).");
                                } catch (e: any) {
                                    setStatus(`Error: ${e.message}`);
                                } finally {
                                    setLoading(false);
                                }
                            }
                        }}
                    />

                    <SelectiveReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'act123b-selective',
                            label: '3. ACT-123B (Supplementary Form B)',
                            description: 'Seleccione las órdenes de cambio para generar el formulario suplementario ACT-123B.',
                            icon: <FileCheck size={18} className="text-purple-600" />,
                            selectLabel: "Elegir CHO",
                            items: chos.map(c => ({ id: c.id, label: `CHO #${c.cho_num}${c.amendment_letter || ''} (${formatDate(c.cho_date)})` })),
                            onGenerate: async (ids) => {
                                try {
                                    for(const id of ids) {
                                        await generateAct123BReportLogic(projectId, id, reportFormat);
                                    }
                                    setStatus("Reporte(s) generado(s).");
                                } catch (e: any) {
                                    setStatus(`Error: ${e.message}`);
                                } finally {
                                    setLoading(false);
                                }
                            }
                        }}
                    />

                    {/* ACT-124 UI Block */}
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'act124',
                            label: '3. ACT-124 (Checklist)',
                            description: 'Checklist para órdenes de cambio. Los campos son editables en el PDF.',
                            icon: <FileCheck size={18} className="text-purple-800" />,
                            action: async () => {
                                try {
                                    const choId = (window as any).selectedAct124Cho;
                                    if (!choId) {
                                        alert("Por favor seleccione una Orden de Cambio (CHO).");
                                        throw new Error("Selection required");
                                    }
                                    if (reportFormat === 'excel') {
                                        alert("El reporte ACT-124 no está disponible en formato Excel por requerimiento.");
                                        setLoading(false);
                                        return;
                                    }
                                    await generateAct124ReportLogic(projectId, choId, [], reportFormat);
                                    setStatus("Reporte generado.");
                                } catch (e: any) {
                                    setStatus(`Error: ${e.message}`);
                                } finally {
                                    setLoading(false);
                                }
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

                    {/* ROA UI Block */}
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'roa',
                            label: '4. ROA (Authorization)',
                            description: 'Record of Authorization to Proceed with Contract Revision.',
                            icon: <FileDigit size={18} className="text-purple-800" />,
                            action: async () => {
                                try {
                                    const choId = (window as any).selectedRoaCho;
                                    if (!choId) {
                                        alert("Por favor seleccione una Orden de Cambio (CHO).");
                                        throw new Error("Selection required");
                                    }
                                    if (reportFormat === 'excel') {
                                        alert("El reporte ROA no está disponible en formato Excel por requerimiento.");
                                        setLoading(false);
                                        return;
                                    }
                                    await generateRoaReportLogic(projectId, choId, reportFormat);
                                    setStatus("Reporte ROA generado.");
                                } catch (e: any) {
                                    setStatus(`Error: ${e.message}`);
                                } finally {
                                    setLoading(false);
                                }
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
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'ccml',
                            label: '5. CCML (Contract Mod. Log)',
                            description: 'Contract Modification Log usando la plantilla oficial con fórmulas integradas. Genera un Excel listo para abrir.',
                            icon: <Files size={18} className="text-green-600" />,
                            action: async () => {
                                try {
                                    const choId = (window as any).selectedCmlCho;
                                    // choId is optional — if empty, generates for ALL CHOs
                                    await generateCCMLReportLogic(projectId || '', choId || undefined);
                                    setStatus("Reporte CCML generado.");
                                } catch (e: any) {
                                    setStatus(`Error: ${e.message}`);
                                } finally {
                                    setLoading(false);
                                }
                            }
                        }}
                    >
                        <div className="mt-2 text-left space-y-1">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">CHO específico (opcional)</p>
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
                    
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'time-ext-chart',
                            label: '6. Gráfica de Extensión de Tiempo',
                            description: 'Gráfica oficial de la línea de tiempo del proyecto y extensiones otorgadas.',
                            icon: <BarChart size={18} className="text-orange-500" />,
                            action: async () => {
                                try {
                                    const choId = (window as any).selectedTimeExtCho;
                                    if (!choId) {
                                        alert("Por favor seleccione una CHO para la Gráfica.");
                                        return;
                                    }
                                    if (reportFormat === 'excel') {
                                        alert("La gráfica de extensión de tiempo no está disponible en formato Excel por requerimiento.");
                                        setLoading(false);
                                        return;
                                    }
                                    const { generateTimeExtensionChartLogic } = await import("@/lib/reportLogic");
                                    await generateTimeExtensionChartLogic(projectId || "", choId);
                                    setStatus("Gráfica generada.");
                                } catch (e: any) {
                                    setStatus(`Error: ${e.message}`);
                                } finally {
                                    setLoading(false);
                                }
                            }
                        }}
                    >
                        <div className="mt-2 text-left space-y-3">
                            <select
                                id="time-ext-cho-select"
                                className="w-full bg-orange-50/50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-800 rounded-xl px-3 py-2.5 text-[10px] font-bold outline-none focus:ring-1 focus:ring-orange-500 transition-all"
                                onChange={(e) => (window as any).selectedTimeExtCho = e.target.value}
                            >
                                <option value="">Elegir CHO para Gráfica...</option>
                                {chos.map(c => (
                                    <option key={c.id} value={c.id}>CHO #{c.cho_num}{c.amendment_letter || ''} ({formatDate(c.cho_date)})</option>
                                ))}
                            </select>
                        </div>
                    </StandardReportItem>

                 </DropdownGroup>

                {/* 6. Certificaciones */}
                <DropdownGroup title="6. Certificaciones de Pago" icon={<FileText size={18} className="text-cyan-500" />}>
                    <SelectiveReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'act117c-selective',
                            label: '1. ACT-117C (Oficial)',
                            description: 'Seleccione las certificaciones para generar el formulario oficial de pago (Anverso/Reverso).',
                            icon: <FileCheck size={18} className="text-blue-600" />,
                            items: certs.map(c => ({ id: c.id, label: `Cert #${c.cert_num} (${formatDate(c.cert_date)})` })),
                            onGenerate: async (ids) => {
                                try {
                                    for (const id of ids) {
                                        const cert = certs.find(c => c.id === id);
                                        if (cert) {
                                            const { downloadBlob, generateReport, createExcelBlob } = await import("@/lib/reportLogic");
                                            if (reportFormat === 'excel') {
                                                const { data: certItems } = await supabase.from('payment_certifications').select('items').eq('id', cert.id).single();
                                                const itemsList = Array.isArray(certItems?.items) ? certItems.items : (certItems?.items?.list || []);
                                                const projectInfo = { name: projectName, num_act: projectNum };
                                                const excelData = [
                                                    ['Item No.', 'Spec. Code', 'Description', 'Unit', 'Quantity', 'Unit Price', 'Amount'],
                                                    ...itemsList.map((it: any) => [it.item_num, it.specification, it.description, it.unit, it.quantity, it.unit_price, (it.quantity * it.unit_price)])
                                                ];
                                                await generateReport(`ACT-117C - Certificación de Pago #${cert.cert_num}`, excelData, projectInfo, [60, 80, 200, 60, 60, 80, 80], 'portrait', 'excel', `ACT-117C_Cert_${cert.cert_num}.pdf`);
                                            } else {
                                                const blob = await generateAct117C(projectId, cert.id, cert.cert_num, cert.cert_date);
                                                downloadBlob(blob, `ACT-117C_Cert_${cert.cert_num}.pdf`);
                                            }
                                        }
                                    }
                                    setStatus("Reporte(s) generado(s).");
                                } catch (e: any) {
                                    setStatus(`Error: ${e.message}`);
                                } finally {
                                    setLoading(false);
                                }
                            }
                        }}
                    />
                    <SelectiveReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'cert-desglose-selective',
                            label: '2. Desglose Financiero de Certificación',
                            description: 'Reporte detallado con todos los valores positivos y negativos de la certificación seleccionada.',
                            icon: <Calculator size={18} className="text-cyan-700" />,
                            items: certs.map(c => ({ id: c.id, label: `Cert #${c.cert_num} (${formatDate(c.cert_date)})` })),
                            onGenerate: async (ids) => {
                                try {
                                    await generateCertReportLogic(projectId, ids, reportFormat);
                                    setStatus("Reporte(s) generado(s).");
                                } catch (e: any) {
                                    setStatus(`Error: ${e.message}`);
                                } finally {
                                    setLoading(false);
                                }
                            }
                        }}
                    />
                </DropdownGroup>

                {/* 7. Liquidación */}
                <DropdownGroup title="7. Liquidación" icon={<FileCheck size={18} className="text-rose-600" />}>
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'acceptance-checklist',
                            label: '1. Final Acceptance Checklist (Liquidación)',
                            description: 'Formulario oficial de cotejo para aceptación final (Federal-Aid projects).',
                            icon: <FileCheck size={18} className="text-blue-600" />,
                            action: () => generateFinalAcceptanceChecklistReportLogic(projectId, reportFormat)
                                .then(() => setStatus("Reporte generado."))
                                .catch(e => setStatus(`Error: ${e.message}`))
                                .finally(() => setLoading(false))
                        }}
                    />
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'liquidacion-items',
                            label: '2. Hojas de Liquidación por Partida',
                            description: 'Una hoja por partida con CHOs, certificaciones y balance. Estructura basada en la forma oficial de liquidación.',
                            icon: <FileCheck size={18} className="text-rose-600" />,
                            action: () => generateLiquidacionItemsReportLogic(projectId, reportFormat)
                                .then(() => setStatus("Reporte generado."))
                                .catch(e => setStatus(`Error: ${e.message}`))
                                .finally(() => setLoading(false))
                        }}
                    />
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'acceptance-official',
                            label: '3. Final Acceptance Report (Oficial)',
                            description: 'Formulario oficial de aceptación final (FHWA). Réplica exacta del formato impreso.',
                            icon: <FileCheck size={18} className="text-indigo-600" />,
                            action: () => generateFinalAcceptanceReportOfficialLogic(projectId, reportFormat)
                                .then(() => setStatus("Reporte generado."))
                                .catch(e => setStatus(`Error: ${e.message}`))
                                .finally(() => setLoading(false))
                        }}
                    />
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'payroll-certification',
                            label: '4. Payroll Certification',
                            description: 'Certificación oficial de cumplimiento con leyes laborales federales y estatales.',
                            icon: <FileCheck size={18} className="text-emerald-600" />,
                            action: () => generatePayrollCertificationReportLogic(projectId, reportFormat)
                                .then(() => setStatus("Reporte generado."))
                                .catch(e => setStatus(`Error: ${e.message}`))
                                .finally(() => setLoading(false))
                        }}
                    />
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'material-certification',
                            label: '5. Material Certification (sin firmas)',
                            description: 'Certificación oficial de materiales, muestreo y pruebas de aceptación.',
                            icon: <FileCheck size={18} className="text-orange-600" />,
                            action: () => {
                                setReminderMsg("Este documento de certificación de materiales es para solicitar las firmas correspondientes del administrador y de la Oficina de Materiales");
                                return generateMaterialCertificationReportLogic(projectId, reportFormat)
                                    .then(() => setStatus("Reporte generado."))
                                    .catch(e => {
                                        console.error(e);
                                        setStatus(`Error: ${e.message}`);
                                    })
                                    .finally(() => setLoading(false));
                            }
                        }}
                    />
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'dbe-certification',
                            label: '6. Certification of DBE Participation',
                            description: 'Certificación oficial de participación y esfuerzos de buena fe de empresas DBE.',
                            icon: <FileCheck size={18} className="text-blue-600" />,
                            action: () => {
                                setReminderMsg("Junto con este reporte, se debe adjuntar la certificación DBA del contratista.");
                                return generateDbeCertificationReportLogic(projectId, reportFormat)
                                    .then(() => setStatus("Reporte generado."))
                                    .catch(e => {
                                        console.error(e);
                                        setStatus(`Error: ${e.message}`);
                                    })
                                    .finally(() => setLoading(false));
                            }
                        }}
                    />
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'final-construction-report',
                            label: '7. Final Construction Report',
                            description: 'Informe final de construcción con resumen de partidas ejecutadas y pagos mensuales.',
                            icon: <FileCheck size={18} className="text-purple-600" />,
                            action: () => generateFinalConstructionReportLogic(projectId, reportFormat)
                                .then(() => setStatus("Reporte generado."))
                                .catch((e: any) => setStatus(`Error: ${e.message}`))
                                .finally(() => setLoading(false))
                        }}
                    />
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'final-estimate',
                            label: '8. Final Estimate',
                            description: 'Desglose y resumen financiero oficial del proyecto (Final Estimate).',
                            icon: <FileCheck size={18} className="text-teal-600" />,
                            action: () => generateFinalEstimateReportLogic(projectId, reportFormat)
                                .then(() => setStatus("Reporte generado."))
                                .catch((e: any) => setStatus(`Error: ${e.message}`))
                                .finally(() => setLoading(false))
                        }}
                    />
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'contract-final-report',
                            label: '9. Contract Final Report',
                            description: 'Informe final de contrato con resumen de fechas, órdenes de cambio y costos finales.',
                            icon: <FileCheck size={18} className="text-indigo-600" />,
                            action: () => generateContractFinalReportLogic(projectId, reportFormat)
                                .then(() => setStatus("Reporte generado."))
                                .catch((e: any) => setStatus(`Error: ${e.message}`))
                                .finally(() => setLoading(false))
                        }}
                    />
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'time-analysis',
                            label: '10. Time Analysis (AC-457b)',
                            description: 'Evaluación de overruns, días autorizados y cálculo de daños líquidos.',
                            icon: <FileCheck size={18} className="text-amber-600" />,
                            action: () => generateTimeAnalysisReportLogic(projectId, reportFormat)
                                .then(() => setStatus("Reporte generado."))
                                .catch((e: any) => setStatus(`Error: ${e.message}`))
                                .finally(() => setLoading(false))
                        }}
                    />
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'firmas-partidas',
                            label: '11. Reporte de Firmas por Partidas',
                            description: 'Informe con el estado de las firmas (Admin, Contratista, Liquidador) para cada partida en liquidación.',
                            icon: <FileCheck size={18} className="text-pink-600" />,
                            action: () => generateSignedItemsReportLogic(projectId, reportFormat)
                                .then(() => setStatus("Reporte generado."))
                                .catch((e: any) => setStatus(`Error: ${e.message}`))
                                .finally(() => setLoading(false))
                        }}
                    />
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'firmas-pendientes',
                            label: '12. Partidas con Firmas Pendientes',
                            description: 'Lista de ítems que aún no tienen todas las firmas requeridas (Admin, Contratista, Liquidador).',
                            icon: <BadgeAlert size={18} className="text-rose-500" />,
                            action: () => generateMissingSignaturesReportLogic(projectId, reportFormat)
                                .then(() => setStatus("Reporte generado."))
                                .catch((e: any) => setStatus(`Error: ${e.message}`))
                                .finally(() => setLoading(false))
                        }}
                    />
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'environmental-review',
                            label: '13. Environmental Review Certification',
                            description: 'Certificación de cumplimiento con las revisiones ambientales y compromisos de construcción.',
                            icon: <FileCheck size={18} className="text-emerald-600" />,
                            action: () => generateEnvironmentalReviewReportLogic(projectId, reportFormat)
                                .then(() => setStatus("Reporte generado."))
                                .catch((e: any) => setStatus(`Error: ${e.message}`))
                                .finally(() => setLoading(false))
                        }}
                    />
                </DropdownGroup>

                {/* 8. Force Account */}
                <DropdownGroup title="8. Force Account" icon={<Calculator size={18} className="text-pink-500" />}>
                     <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'fa-anual',
                            label: '1. Resumen Anual de FA',
                            description: 'Basado en el formato oficial Resumen Anual de FA.',
                            icon: <FileText size={18} className="text-pink-500" />,
                            action: () => generateFaResumenAnualLogic(projectId, reportFormat)
                                .then(() => setStatus("Reporte generado."))
                                .catch((e: any) => { console.error(e); setStatus(`Error: ${e.message}`); })
                                .finally(() => setLoading(false))
                        }}
                    />
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'fa-mensual',
                            label: '2. Resumen Mensual de FA',
                            description: 'Basado en el formato oficial Resumen Mensual de FA.',
                            icon: <FileText size={18} className="text-pink-500" />,
                            action: () => generateFaResumenMensualLogic(projectId, reportFormat)
                                .then(() => setStatus("Reporte generado."))
                                .catch((e: any) => { console.error(e); setStatus(`Error: ${e.message}`); })
                                .finally(() => setLoading(false))
                        }}
                    />
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'fa-diario',
                            label: '3. Informe Diario de FA',
                            description: 'Basado en el formato oficial Informe Diario de FA.',
                            icon: <FileText size={18} className="text-pink-500" />,
                            action: () => generateFaInformeDiarioLogic(projectId, reportFormat)
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
                            label: '4. Relación de Equipo de FA',
                            description: 'Basado en el formato oficial Relación de equipo de FA.',
                            icon: <FileText size={18} className="text-pink-500" />,
                            action: () => generateFaRelacionEquipoLogic(projectId, reportFormat)
                                .then(() => setStatus("Reporte generado."))
                                .catch((e: any) => { console.error(e); setStatus(`Error: ${e.message}`); })
                                .finally(() => setLoading(false))
                        }}
                    />
                </DropdownGroup>

                {/* 9. Distribución de Fondos */}
                <DropdownGroup title="8. Distribución de Fondos" icon={<Activity size={18} className="text-green-600" />}>
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'fund-source-projected',
                            label: '1. Presupuesto Proyectado — ACT vs FHWA',
                            description: 'Distribución de todo el presupuesto del contrato original más las Órdenes de Cambio, aunque no se hayan pagado.',
                            icon: <Package size={18} className="text-blue-600" />,
                            action: () => generateProjectedFundDistributionReportLogic(projectId, reportFormat)
                                .then(() => setStatus("Reporte generado."))
                                .catch(e => {
                                    console.error(e);
                                    setStatus(`Error: ${e.message}`);
                                })
                                .finally(() => setLoading(false))
                        }}
                    />
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'fund-source-real',
                            label: '2. Distribución Real — ACT vs FHWA (Pagos)',
                            description: 'Distribución basada únicamente en las partidas certificadas y pagadas hasta la fecha de corte.',
                            icon: <Activity size={18} className="text-green-600" />,
                            action: () => generateFundSourceReportLogic(projectId, reportFormat, endDate)
                                .then(() => setStatus("Reporte generado."))
                                .catch(e => {
                                    console.error(e);
                                    setStatus(`Error: ${e.message}`);
                                })
                                .finally(() => setLoading(false))
                        }}
                    />
                </DropdownGroup>

                {/* 9. Minutas de Reunión */}
                <DropdownGroup title="9. Minutas de Reunión" icon={<Files size={18} className="text-amber-600" />}>
                    <SelectiveReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'minutes-selective',
                            label: '1. Minutas de Reunión',
                            description: 'Seleccione la fecha de la reunión para generar la minuta oficial.',
                            icon: <FileText size={18} className="text-amber-700" />,
                            selectLabel: "Elegir Fecha",
                            items: minutes.map(m => ({ id: m.id, label: `${m.meeting_number || 'Reunión'} (${formatDate(m.meeting_date)})` })),
                            onGenerate: async (ids) => {
                                try {
                                    const ReportLogic = await import("@/lib/reportLogic");
                                    if (ReportLogic && ReportLogic.generateMinuteReportLogic) {
                                        await ReportLogic.generateMinuteReportLogic(projectId, ids[0], reportFormat);
                                        setStatus("Minuta generada.");
                                    } else {
                                        throw new Error("La función generateMinuteReportLogic no se encontró en el módulo.");
                                    }
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
                <DropdownGroup title="10. Informes de Campo" icon={<FileText size={18} className="text-emerald-500" />}>
                    <SelectiveReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'act45-selective',
                            label: '1. ACT-45 Informe Diario',
                            description: 'Seleccione la fecha del reporte para generar el ACT-45 en formato PDF o Excel.',
                            icon: <FileDigit size={18} className="text-emerald-600" />,
                            selectLabel: "Elegir Fecha",
                            items: dailyLogs.map(m => ({ id: m.id, label: `Informe del ${formatDate(m.log_date)}` })),
                            onGenerate: async (ids) => {
                                try {
                                    if (reportFormat === 'excel') {
                                        const { generateAct45ExcelReport } = await import("@/lib/generateAct45ExcelReport");
                                        for (let id of ids) await generateAct45ExcelReport(projectId || "", id);
                                    } else {
                                        const { generateAct45PdfReport } = await import("@/lib/generateAct45PdfReport");
                                        for (let id of ids) await generateAct45PdfReport(projectId || "", id);
                                    }
                                    setStatus("Reporte(s) generado(s).");
                                } catch (e: any) {
                                    setStatus(`Error: ${e.message}`);
                                } finally {
                                    setLoading(false);
                                }
                            }
                        }}
                    />
                    <SelectiveReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'act96-selective',
                            label: '2. ACT-96 Informe de Inspección',
                            description: 'Seleccione la fecha del reporte para generar el ACT-96 en formato PDF o Excel.',
                            icon: <FileCheck size={18} className="text-emerald-600" />,
                            selectLabel: "Elegir Fecha",
                            items: dailyLogs.map(m => ({ id: m.id, label: `Inspección del ${formatDate(m.log_date)}` })),
                            onGenerate: async (ids) => {
                                try {
                                    if (reportFormat === 'excel') {
                                        const { generateAct96ExcelReport } = await import("@/lib/generateAct96ExcelReport");
                                        for (let id of ids) await generateAct96ExcelReport(projectId || "", id);
                                    } else {
                                        const { generateAct96PdfReport } = await import("@/lib/generateAct96PdfReport");
                                        for (let id of ids) await generateAct96PdfReport(projectId || "", id);
                                    }
                                    setStatus("Reporte(s) generado(s).");
                                } catch (e: any) {
                                    setStatus(`Error: ${e.message}`);
                                } finally {
                                    setLoading(false);
                                }
                            }
                        }}
                    />
                </DropdownGroup>

            </div>

            {status && (
                <div className={`mt-12 p-6 rounded-3xl flex items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-4 shadow-xl border ${status.includes('Error') ? 'bg-red-50 text-red-700 border-red-100' :
                    status.includes('generado') ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                        'bg-white dark:bg-slate-900 text-primary border-slate-100 dark:border-slate-800'}`}>
                    {status.includes('generado') ? <CheckCircle2 size={24} /> : status.includes('Error') ? <AlertCircle size={24} /> : <Loader2 size={24} className="animate-spin" />}
                    <p className="font-black text-xl uppercase tracking-widest">{status}</p>
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
