
"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
    FileText, Download, AlertCircle, CheckCircle2,
    Package, ListChecks, ArrowLeft, Loader2,
    Activity, Info, Files, BadgeAlert, FileDigit,
    ChevronDown, Search, FileCheck
} from "lucide-react";
import Link from "next/link";
import {
    generateBalanceReportLogic,
    generateDetailReportLogic,
    generateMfgReportLogic,
    generateMissingMfgReportLogic,
    generateMosReportLogic,
    generateInfoReportLogic,
    generateChoReportLogic,
    generateCertReportLogic,
    generateDashboardReportLogic,
    generateFundSourceReportLogic,
    generateProjectedFundDistributionReportLogic,
    generateAct117CReportLogic,
    generateAct117BReportLogic,
    generateAct122ReportLogic,
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
                className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl border transition-all duration-300 shadow-sm ${isOpen
                    ? 'bg-primary text-white border-primary shadow-lg scale-[1.01]'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-primary/40 hover:shadow-md'
                    }`}
            >
                <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-xl border ${isOpen ? 'bg-white/20 border-white/20' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-800'}`}>
                        {icon}
                    </div>
                    <span className="font-black text-xs uppercase tracking-[0.15em]">{title}</span>
                </div>
                <ChevronDown size={18} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-[100] mt-3 w-full bg-white dark:bg-slate-900 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-slate-100 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top">
                    <div className="p-2 space-y-1">
                        {children}
                    </div>
                </div>
            )}
        </div>
    );
}

function StandardReportItem({ option, loading, onAction }: { option: ReportOption, loading: boolean, onAction: () => void }) {
    return (
        <button
            onClick={() => { onAction(); option.action(); }}
            disabled={loading}
            className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all group/item text-left disabled:opacity-50"
        >
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 shadow-sm group-hover/item:border-primary/20 group-hover/item:shadow-md transition-all">
                {option.icon}
            </div>
            <div className="flex flex-col flex-1">
                <span className="text-sm font-black text-slate-900 dark:text-white group-hover/item:text-primary transition-colors">
                    {option.label}
                </span>
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 leading-tight">
                    {option.description}
                </span>
            </div>
            <Download size={16} className="text-slate-300 group-hover/item:text-primary transition-all group-hover/item:translate-y-0.5" />
        </button>
    );
}

function SelectiveReportItem({ option, loading, onAction }: { option: SelectiveReportOption, loading: boolean, onAction: () => void }) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState("");

    const filteredItems = option.items.filter(i => i.label.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="p-1">
            <div className={`flex items-center gap-4 px-4 py-3.5 rounded-xl border transition-all ${selectedIds.length > 0 ? 'bg-primary/5 border-primary/40 shadow-sm' : 'bg-slate-50/50 dark:bg-slate-800/30 border-dashed border-slate-200 dark:border-slate-700'}`}>

                {/* Botón Generar arriba a la izquierda del título */}
                {selectedIds.length > 0 ? (
                    <button
                        disabled={loading}
                        onClick={() => { onAction(); option.onGenerate(selectedIds); }}
                        className="bg-primary text-white px-3 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-primary-dark transition-all shadow-md flex items-center gap-2 animate-in zoom-in duration-300 shrink-0"
                    >
                        <Download size={14} /> IMPRIMIR ({selectedIds.length})
                    </button>
                ) : (
                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 shrink-0">
                        {option.icon}
                    </div>
                )}

                <div className="flex flex-col flex-1 truncate">
                    <span className="text-sm font-black text-slate-900 dark:text-white truncate">{option.label}</span>
                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                        {selectedIds.length > 0 ? `${selectedIds.length} seleccionados` : 'Selección múltiple requerida'}
                    </span>
                </div>
                <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow-sm border ${isMenuOpen ? 'bg-slate-200 dark:bg-slate-700 border-slate-300' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-primary'}`}
                >
                    {isMenuOpen ? 'Ocultar Lista' : (option.selectLabel || 'Elegir certificaciones')}
                </button>
            </div>

            {isMenuOpen && (
                <div className="mt-2 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-3 animate-in slide-in-from-top-2 duration-300">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder="Buscar..."
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-[10px] font-medium focus:ring-1 focus:ring-primary outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="max-h-60 overflow-y-auto px-1 space-y-1 custom-scrollbar">
                        {filteredItems.map(item => (
                            <label key={item.id} className="flex items-center gap-2 p-1.5 hover:bg-white dark:hover:bg-slate-900 rounded cursor-pointer transition-colors group/check">
                                <input
                                    type="checkbox"
                                    checked={selectedIds.includes(item.id)}
                                    onChange={() => {
                                        if (selectedIds.includes(item.id)) setSelectedIds(selectedIds.filter(i => i !== item.id));
                                        else setSelectedIds([...selectedIds, item.id]);
                                    }}
                                    className="w-3 h-3 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
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
    );
}

// --- Página Principal ---

function ReportesContent() {
    const searchParams = useSearchParams();
    const projectId = searchParams.get("id");
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const [projectName, setProjectName] = useState<string>("");
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Datos para selectivos
    const [chos, setChos] = useState<any[]>([]);
    const [certs, setCerts] = useState<any[]>([]);
    const [items, setItems] = useState<any[]>([]);

    useEffect(() => {
        if (projectId) fetchProjectInfo();
    }, [projectId]);

    const fetchProjectInfo = async () => {
        const registrationStr = localStorage.getItem("pact_registration");
        let registration = null;
        try {
            registration = registrationStr ? JSON.parse(registrationStr) : null;
        } catch (e) {
            console.error("Error parsing registration", e);
        }
        let allowedIds = registration?.allowedProjectIds || [];

        // Verificar si el usuario tiene acceso global via base de datos para mayor robustez
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            const { data: userData } = await supabase.from("users").select("role_global").eq("id", session.user.id).single();
            if (userData?.role_global === "A") {
                allowedIds = ["ALL"];
            }
        }

        if (!allowedIds.includes("ALL") && !allowedIds.includes(projectId)) {
            alert("Acceso denegado: No tiene autorización para generar reportes de este proyecto.");
            window.location.href = "/proyectos";
            return;
        }

        const { data: p } = await supabase.from("projects").select("name").eq("id", projectId).single();
        if (p) setProjectName(p.name);

        const { data: c } = await supabase.from("chos").select("id, cho_num, cho_date").eq("project_id", projectId).order('cho_num');
        if (c) setChos(c);

        const { data: pc } = await supabase.from("payment_certifications").select("id, cert_num, cert_date").eq("project_id", projectId).order('cert_num');
        if (pc) setCerts(pc);

        const { data: ci } = await supabase.from("contract_items").select("id, item_num, description").eq("project_id", projectId).order('item_num');
        if (ci) setItems(ci);
    };

    const handleAction = () => {
        setLoading(true);
        setStatus("Generando reporte...");
    };

    if (!mounted) return null;
    if (!projectId) return <div className="p-20 text-center">No project selected.</div>;

    return (
        <div className="container mx-auto py-8 font-geist animate-in fade-in duration-500 max-w-6xl">
            <div className="mb-12 flex flex-col items-center text-center">
                <Link href={`/proyectos/detalle?id=${projectId}`} className="text-sm flex items-center gap-1.5 text-slate-500 hover:text-primary mb-6 font-black uppercase tracking-widest transition-colors group">
                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Volver al Proyecto
                </Link>
                <div className="bg-primary/5 p-4 rounded-3xl border border-primary/10 mb-4 inline-block">
                    <ReportesLinkIcon />
                </div>
                <h1 className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter mb-2">Central de Reportes</h1>
                {projectName && <p className="text-primary font-black uppercase tracking-[0.3em] text-sm">{projectName}</p>}
                <div className="h-1 w-20 bg-primary/20 rounded-full mt-6"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                {/* 1. Información General */}
                <DropdownGroup title="1. Información General" icon={<Info size={18} className="text-blue-500" />}>
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'info',
                            label: '1. Datos de Proyecto',
                            description: 'Resumen completo de funcionarios y contratistas.',
                            icon: <Files size={18} className="text-blue-500" />,
                            action: () => generateInfoReportLogic(projectId)
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
                            id: 'dashboard',
                            label: '2. Dashboard Ejecutivo',
                            description: 'Resumen gerencial de costos y tiempo.',
                            icon: <Activity size={18} className="text-indigo-500" />,
                            action: () => generateDashboardReportLogic(projectId)
                                .then(() => setStatus("Reporte generado."))
                                .catch(e => {
                                    console.error(e);
                                    setStatus(`Error: ${e.message}`);
                                })
                                .finally(() => setLoading(false))
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
                            action: () => generateBalanceReportLogic(projectId)
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
                            label: '2. Detalle de Ejecución',
                            description: 'Historial completo por cada partida.',
                            icon: <Files size={18} className="text-teal-500" />,
                            action: () => generateDetailReportLogic(projectId)
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
                            action: () => generateMfgReportLogic(projectId)
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
                            label: '2. Pendientes de Certificación',
                            description: 'Materiales pagados sin certificado.',
                            icon: <BadgeAlert size={18} className="text-red-500" />,
                            action: () => generateMissingMfgReportLogic(projectId)
                                .then(() => setStatus("Reporte generado."))
                                .catch(e => {
                                    console.error(e);
                                    setStatus(`Error: ${e.message}`);
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
                            label: '1. Inventario de Materiales',
                            description: 'Reporte de facturas y deducciones.',
                            icon: <Package size={18} className="text-amber-500" />,
                            action: () => generateMosReportLogic(projectId)
                                .then(() => setStatus("Reporte generado."))
                                .catch(e => {
                                    console.error(e);
                                    setStatus(`Error: ${e.message}`);
                                })
                                .finally(() => setLoading(false))
                        }}
                    />
                    <div className="p-1">
                        <div className="flex flex-col gap-2 p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 shadow-sm">
                                    <FileCheck size={18} className="text-amber-600" />
                                </div>
                                <div className="flex flex-col flex-1">
                                    <span className="text-sm font-black text-slate-900 dark:text-white">2. ACT-117B</span>
                                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 leading-tight">Balance de Material on Site por partida.</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 mt-2">
                                <select
                                    id="mos-cert-select"
                                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-[10px] font-bold outline-none focus:ring-1 focus:ring-primary"
                                    onChange={(e) => (window as any).selectedMosCert = e.target.value}
                                >
                                    <option value="">Elegir Certificación...</option>
                                    {certs.map(c => (
                                        <option key={c.id} value={c.id}>Cert #{c.cert_num}</option>
                                    ))}
                                </select>
                                <select
                                    id="mos-item-select"
                                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-[10px] font-bold outline-none focus:ring-1 focus:ring-primary"
                                    onChange={(e) => (window as any).selectedMosItem = e.target.value}
                                >
                                    <option value="">Elegir Partida...</option>
                                    {items.map(i => (
                                        <option key={i.id} value={i.item_num}>{i.item_num} - {i.description.substring(0, 20)}...</option>
                                    ))}
                                </select>
                            </div>

                            <button
                                onClick={async () => {
                                    const certId = (window as any).selectedMosCert;
                                    const itemNum = (window as any).selectedMosItem;
                                    if (!certId || !itemNum) {
                                        alert("Por favor seleccione certificación y partida.");
                                        return;
                                    }
                                    handleAction();
                                    try {
                                        await generateAct117BReportLogic(projectId, certId, itemNum);
                                        setStatus("Reporte generado.");
                                    } catch (e: any) {
                                        setStatus(`Error: ${e.message}`);
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                                disabled={loading}
                                className="w-full mt-2 bg-primary text-white py-2 rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-primary-dark transition-all shadow-md flex items-center justify-center gap-2"
                            >
                                <Download size={14} /> GENERAR ACT-117B
                            </button>
                        </div>
                    </div>
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
                            items: chos.map(c => ({ id: c.id, label: `CHO #${c.cho_num} (${formatDate(c.cho_date)})` })),
                            onGenerate: async (ids) => {
                                try {
                                    for (const id of ids) {
                                        await generateAct122ReportLogic(projectId, id);
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
                    <div className="p-1">
                        <div className="flex flex-col gap-2 p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                            <button
                                onClick={async () => {
                                    const choId = (window as any).selectedAct124Cho;
                                    if (!choId) {
                                        alert("Por favor seleccione una Orden de Cambio (CHO).");
                                        return;
                                    }
                                    handleAction();
                                    try {
                                        await generateAct124ReportLogic(projectId, choId, []);
                                        setStatus("Reporte generado.");
                                    } catch (e: any) {
                                        setStatus(`Error: ${e.message}`);
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                                disabled={loading}
                                className="w-full bg-primary text-white py-2 rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-primary-dark transition-all shadow-md flex items-center justify-center gap-2 mb-2"
                            >
                                <Download size={16} /> GENERAR ACT-124
                            </button>

                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 shadow-sm">
                                    <FileCheck size={16} className="text-purple-800" />
                                </div>
                                <select
                                    id="act124-cho-select"
                                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-[10px] font-bold outline-none focus:ring-1 focus:ring-primary"
                                    onChange={(e) => (window as any).selectedAct124Cho = e.target.value}
                                >
                                    <option value="">Elegir CHO para Checklist...</option>
                                    {chos.map(c => (
                                        <option key={c.id} value={c.id}>CHO #{c.cho_num} ({formatDate(c.cho_date)})</option>
                                    ))}
                                </select>
                            </div>
                            <p className="text-[9px] text-slate-500 font-medium px-1">Nota: Los checkboxes son editables directamente en el PDF.</p>
                        </div>
                    </div>

                    {/* ROA UI Block */}
                    <div className="p-1">
                        <div className="flex flex-col gap-2 p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                            <button
                                onClick={async () => {
                                    const choId = (window as any).selectedRoaCho;
                                    if (!choId) {
                                        alert("Por favor seleccione una Orden de Cambio (CHO).");
                                        return;
                                    }
                                    handleAction();
                                    try {
                                        await generateRoaReportLogic(projectId, choId);
                                        setStatus("Reporte ROA generado.");
                                    } catch (e: any) {
                                        setStatus(`Error: ${e.message}`);
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                                disabled={loading}
                                className="w-full bg-primary text-white py-2 rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-primary-dark transition-all shadow-md flex items-center justify-center gap-2 mb-2"
                            >
                                <Download size={16} /> GENERAR ROA
                            </button>

                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 shadow-sm">
                                    <FileDigit size={16} className="text-purple-800" />
                                </div>
                                <select
                                    id="roa-cho-select"
                                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-[10px] font-bold outline-none focus:ring-1 focus:ring-primary"
                                    onChange={(e) => (window as any).selectedRoaCho = e.target.value}
                                >
                                    <option value="">Elegir CHO para ROA...</option>
                                    {chos.map(c => (
                                        <option key={c.id} value={c.id}>CHO #{c.cho_num} ({formatDate(c.cho_date)})</option>
                                    ))}
                                </select>
                            </div>
                            <p className="text-[9px] text-slate-500 font-medium px-1 leading-tight">Record of Authorization to Proceed with Contract Revision.</p>
                            <p className="text-[9px] text-amber-600 font-bold px-1 leading-tight mt-1">📝 Nota: Los checkboxes y los campos de PRINT NAME son editables directamente en el PDF generado.</p>
                        </div>
                    </div>
                    {/* CCML UI Block */}
                    <div className="p-1">
                        <div className="flex flex-col gap-2 p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                            <button
                                onClick={async () => {
                                    const choId = (window as any).selectedCCMLCho;
                                    if (!choId) {
                                        alert("Por favor seleccione una Orden de Cambio (CHO).");
                                        return;
                                    }
                                    handleAction();
                                    try {
                                        await generateCCMLReportLogic(projectId, choId);
                                        setStatus("Reporte CCML generado.");
                                    } catch (e: any) {
                                        setStatus(`Error: ${e.message}`);
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                                disabled={loading}
                                className="w-full bg-primary text-white py-2 rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-primary-dark transition-all shadow-md flex items-center justify-center gap-2 mb-2"
                            >
                                <Download size={16} /> GENERAR CCML
                            </button>

                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 shadow-sm">
                                    <Files size={16} className="text-purple-800" />
                                </div>
                                <select
                                    id="ccml-cho-select"
                                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-[10px] font-bold outline-none focus:ring-1 focus:ring-primary"
                                    onChange={(e) => (window as any).selectedCCMLCho = e.target.value}
                                >
                                    <option value="">Elegir CHO para CCML...</option>
                                    {chos.map(c => (
                                        <option key={c.id} value={c.id}>CHO #{c.cho_num} ({formatDate(c.cho_date)})</option>
                                    ))}
                                </select>
                            </div>
                            <p className="text-[9px] text-slate-500 font-medium px-1 leading-tight">Construction Contract Modification Log.</p>
                        </div>
                    </div>
                    
                    <SelectiveReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'chos',
                            label: '3. Reporte Selectivo CHO (Tabla)',
                            description: 'Resumen tabular de las órdenes de cambio seleccionadas.',
                            icon: <FileDigit size={18} className="text-purple-500" />,
                            selectLabel: "Elegir CHO",
                            items: chos.map(c => ({ id: c.id, label: `CHO #${c.cho_num} (${formatDate(c.cho_date)})` })),
                            onGenerate: (ids) => generateChoReportLogic(projectId, ids)
                                .then(() => setStatus("Reporte generado."))
                                .catch(e => {
                                    console.error(e);
                                    setStatus(`Error: ${e.message}`);
                                })
                                .finally(() => setLoading(false))
                        }}
                    />

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
                                            const blob = await generateAct117C(projectId, cert.id, cert.cert_num, cert.cert_date);
                                            const { downloadBlob } = await import("@/lib/reportLogic");
                                            downloadBlob(blob, `ACT-117C_Cert_${cert.cert_num}.pdf`);
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
                            action: () => generateFinalAcceptanceChecklistReportLogic(projectId)
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
                            action: () => generateLiquidacionItemsReportLogic(projectId)
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
                            action: () => generateFinalAcceptanceReportOfficialLogic(projectId)
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
                            action: () => generatePayrollCertificationReportLogic(projectId)
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
                            label: '5. Material Certification',
                            description: 'Certificación oficial de materiales, muestreo y pruebas de aceptación.',
                            icon: <FileCheck size={18} className="text-orange-600" />,
                            action: () => generateMaterialCertificationReportLogic(projectId)
                                .then(() => setStatus("Reporte generado."))
                                .catch(e => setStatus(`Error: ${e.message}`))
                                .finally(() => setLoading(false))
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
                            action: () => generateDbeCertificationReportLogic(projectId)
                                .then(() => setStatus("Reporte generado."))
                                .catch(e => setStatus(`Error: ${e.message}`))
                                .finally(() => setLoading(false))
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
                            action: () => generateFinalConstructionReportLogic(projectId)
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
                            action: () => generateFinalEstimateReportLogic(projectId)
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
                            action: () => generateContractFinalReportLogic(projectId)
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
                            label: '10. Análisis de Tiempo (AC-457b)',
                            description: 'Evaluación de overruns, días autorizados y cálculo de daños líquidos.',
                            icon: <FileCheck size={18} className="text-orange-600" />,
                            action: () => generateTimeAnalysisReportLogic(projectId)
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
                            label: '11. Environmental Review Certification',
                            description: 'Certificación de cumplimiento con las revisiones ambientales y compromisos de construcción.',
                            icon: <FileCheck size={18} className="text-emerald-600" />,
                            action: () => generateEnvironmentalReviewReportLogic(projectId)
                                .then(() => setStatus("Reporte generado."))
                                .catch((e: any) => setStatus(`Error: ${e.message}`))
                                .finally(() => setLoading(false))
                        }}
                    />
                </DropdownGroup>

                {/* 8. Distribución de Fondos */}
                <DropdownGroup title="8. Distribución de Fondos" icon={<Activity size={18} className="text-green-600" />}>
                    <StandardReportItem
                        onAction={handleAction}
                        loading={loading}
                        option={{
                            id: 'fund-source-projected',
                            label: '1. Presupuesto Proyectado — ACT vs FHWA',
                            description: 'Distribución de todo el presupuesto del contrato original más las Órdenes de Cambio, aunque no se hayan pagado.',
                            icon: <Package size={18} className="text-blue-600" />,
                            action: () => generateProjectedFundDistributionReportLogic(projectId)
                                .then(() => setStatus("Reporte generado."))
                                .catch(e => {
                                    console.error(e);
                                    setStatus(`Error: ${e.message}`);
                                })
                                .finally(() => setLoading(false))
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
