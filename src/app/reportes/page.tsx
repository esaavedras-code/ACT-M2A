
"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { FileText, Download, AlertCircle, CheckCircle2, Package, ListChecks, ArrowLeft, Loader2, Activity } from "lucide-react";
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
    formatDate
} from "@/lib/reportLogic";



function SelectionReportCard({ title, description, icon, items, selectedIds, onToggle, onGenerate, loading }: {
    title: string,
    description: string,
    icon: React.ReactNode,
    items: { id: string, label: string }[],
    selectedIds: string[],
    onToggle: (id: string) => void,
    onGenerate: () => void,
    loading: boolean
}) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm hover:shadow-lg hover:border-primary/20 transition-all group relative overflow-hidden flex flex-col h-full">
            <div className="absolute top-0 right-0 w-16 h-16 bg-slate-50 dark:bg-slate-800/30 rounded-full -mr-8 -mt-8 group-hover:bg-primary/5 transition-colors" />
            <div className="relative z-10 flex items-start justify-between mb-3">
                <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-xl group-hover:bg-white dark:group-hover:bg-slate-700 shadow-inner transition-colors">
                    {icon}
                </div>
                <button
                    onClick={onGenerate}
                    disabled={loading || selectedIds.length === 0}
                    className="flex items-center gap-1 bg-slate-900 dark:bg-slate-700 hover:bg-primary text-white px-1 py-0.5 rounded text-[10px] font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 shadow shadow-slate-200 dark:shadow-none"
                >
                    <Download size={11} /> ({selectedIds.length})
                </button>
            </div>
            <h3 className="text-xs font-extrabold text-slate-900 dark:text-white mb-1 group-hover:text-primary transition-colors leading-tight">{title}</h3>
            <p className="text-slate-500 dark:text-slate-400 text-[10px] leading-relaxed font-medium mb-3">{description}</p>

            <div className="mt-auto">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full text-left flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-[10px] font-bold text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-800"
                >
                    {isOpen ? "Ocultar..." : `Ver ${items.length} opciones...`}
                    <span className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
                </button>

                {isOpen && (
                    <div className="mt-2 max-h-36 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-lg p-1.5 space-y-0.5 bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm">
                        {items.length === 0 ? (
                            <p className="text-center py-3 text-slate-400 text-[10px] italic">No hay registros disponibles</p>
                        ) : (
                            items.map(item => (
                                <label key={item.id} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded cursor-pointer transition-colors group/item">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.includes(item.id)}
                                        onChange={() => onToggle(item.id)}
                                        className="w-3 h-3 rounded border-slate-300 text-primary focus:ring-primary transition-all cursor-pointer"
                                    />
                                    <span className={`text-[10px] font-medium transition-colors ${selectedIds.includes(item.id) ? 'text-primary' : 'text-slate-600 dark:text-slate-400'}`}>
                                        {item.label}
                                    </span>
                                </label>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function ReportesContent() {
    const searchParams = useSearchParams();
    const projectId = searchParams.get("id");
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const [projectName, setProjectName] = useState<string>("");

    // Selection state
    const [chos, setChos] = useState<any[]>([]);
    const [certs, setCerts] = useState<any[]>([]);
    const [selectedChos, setSelectedChos] = useState<string[]>([]);
    const [selectedCerts, setSelectedCerts] = useState<string[]>([]);

    useEffect(() => {
        if (projectId) {
            fetchProjectInfo();
        }
    }, [projectId]);

    const fetchProjectInfo = async () => {
        // Verificar autorización
        const registrationStr = localStorage.getItem("pact_registration");
        const registration = registrationStr ? JSON.parse(registrationStr) : null;
        const allowedIds = registration?.allowedProjectIds || [];

        if (!allowedIds.includes(projectId)) {
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
    };

    const handleGenerate = async (type: string) => {
        if (!projectId) return;
        setLoading(true);
        setStatus(`Generando reporte...`);
        try {
            switch (type) {
                case "balance": await generateBalanceReportLogic(projectId); break;
                case "detail": await generateDetailReportLogic(projectId); break;
                case "mfg": await generateMfgReportLogic(projectId); break;
                case "missing": await generateMissingMfgReportLogic(projectId); break;
                case "mos": await generateMosReportLogic(projectId); break;
                case "info": await generateInfoReportLogic(projectId); break;
                case "dashboard": await generateDashboardReportLogic(projectId); break;
                case "chos":
                    if (selectedChos.length === 0) throw new Error("Debe seleccionar al menos un CHO");
                    await generateChoReportLogic(projectId, selectedChos);
                    break;
                case "certs":
                    if (selectedCerts.length === 0) throw new Error("Debe seleccionar al menos una certificación");
                    await generateCertReportLogic(projectId, selectedCerts);
                    break;
            }
            setStatus("Reporte generado con éxito.");
        } catch (error: any) {
            console.error(error);
            setStatus(`Error: ${error.message || "No se pudo generar el reporte"}`);
        } finally {
            setLoading(false);
        }
    };

    const toggleSelection = (id: string, list: string[], setList: (l: string[]) => void) => {
        if (list.includes(id)) {
            setList(list.filter(i => i !== id));
        } else {
            setList([...list, id]);
        }
    };

    if (!projectId) {
        return (
            <div className="container mx-auto py-20 text-center">
                <AlertCircle size={48} className="mx-auto text-amber-500 mb-4" />
                <h1 className="text-2xl font-bold mb-2 text-slate-900 dark:text-white">No se ha seleccionado un proyecto</h1>
                <p className="text-slate-500 mb-6 font-medium">Regrese a la lista de proyectos y seleccione uno para generar reportes.</p>
                <Link href="/proyectos" className="bg-primary text-white px-8 py-3 rounded-xl font-bold hover:shadow-lg transition-all active:scale-95 inline-block">
                    Ver Proyectos
                </Link>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8 font-geist animate-in fade-in duration-500">
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <Link href={`/proyectos/detalle?id=${projectId}`} className="text-sm flex items-center gap-1.5 text-slate-500 hover:text-primary mb-3 font-semibold transition-colors group">
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Volver al Proyecto
                    </Link>
                    <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">Generación de Reportes</h1>
                    {projectName && <p className="text-primary font-bold mt-2 text-lg">{projectName}</p>}
                </div>
                <p className="text-slate-400 font-medium max-w-xs text-right">M2A Group - Sistema de Control de Proyectos Professional Edition</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <ReportCard
                    title="1. Balances de Partidas"
                    description="Muestra el balance actual de cada partida (Original + CHO - Certificado)."
                    icon={<ListChecks className="text-blue-500" />}
                    onClick={() => handleGenerate("balance")}
                    loading={loading}
                />

                <ReportCard
                    title="2. Detalle de Partidas (CHO y Certs)"
                    description="Listado detallado de cada partida con su historial de cambios y pagos realizados."
                    icon={<FileText className="text-purple-500" />}
                    onClick={() => handleGenerate("detail")}
                    loading={loading}
                />

                <ReportCard
                    title="3. Certificados de Manufactura"
                    description="Listado de todos los certificados de manufactura ingresados al sistema."
                    icon={<Package className="text-emerald-500" />}
                    onClick={() => handleGenerate("mfg")}
                    loading={loading}
                />

                <ReportCard
                    title="4. Certificados de manufactura que faltan"
                    description="Identifica las partidas pagadas que requieren certificado de manufactura y aún no lo tienen."
                    icon={<AlertCircle className="text-red-500" />}
                    onClick={() => handleGenerate("missing")}
                    loading={loading}
                />

                <ReportCard
                    title="5. Material on Site (MOS)"
                    description="Reporte de adiciones (facturas) y deducciones (uso) de materiales en el inventario."
                    icon={<Package className="text-amber-500" />}
                    onClick={() => handleGenerate("mos")}
                    loading={loading}
                />

                <ReportCard
                    title="6. Información General del Proyecto"
                    description="Resumen completo de los datos generales, contratista y funcionarios de la ACT."
                    icon={<ListChecks className="text-slate-700" />}
                    onClick={() => handleGenerate("info")}
                    loading={loading}
                />

                <ReportCard
                    title="7. Reporte de Información Principal (Dashboard)"
                    description="Reporte ejecutivo con balances de tiempo, costos, penalidades y órdenes de cambio."
                    icon={<Activity className="text-primary" />}
                    onClick={() => handleGenerate("dashboard")}
                    loading={loading}
                />

                {/* New Selective Reports */}
                <SelectionReportCard
                    title="8. Reporte de Ordenes de Cambio (CHO)"
                    description="Seleccione los CHO que desea incluir en el reporte."
                    items={chos.map(c => ({ id: c.id, label: `CHO #${c.cho_num} (${formatDate(c.cho_date)})` }))}
                    selectedIds={selectedChos}
                    onToggle={(id) => toggleSelection(id, selectedChos, setSelectedChos)}
                    onGenerate={() => handleGenerate("chos")}
                    loading={loading}
                    icon={<FileText className="text-orange-500" />}
                />

                <SelectionReportCard
                    title="9. Reporte de Certificaciones de Pago"
                    description="Seleccione las certificaciones que desea incluir en el reporte."
                    items={certs.map(c => ({ id: c.id, label: `Cert #${c.cert_num} (${formatDate(c.cert_date)})` }))}
                    selectedIds={selectedCerts}
                    onToggle={(id) => toggleSelection(id, selectedCerts, setSelectedCerts)}
                    onGenerate={() => handleGenerate("certs")}
                    loading={loading}
                    icon={<FileText className="text-cyan-500" />}
                />
            </div>

            {status && (
                <div className={`mt-10 p-6 rounded-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 shadow-sm border ${status.includes('Error') ? 'bg-red-50 text-red-700 border-red-100' :
                    status.includes('éxito') ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                        'bg-primary/5 text-primary border-primary/10'}`}>
                    {status.includes('éxito') ? <CheckCircle2 size={24} /> : status.includes('Error') ? <AlertCircle size={24} /> : <Loader2 size={24} className="animate-spin" />}
                    <p className="font-bold text-lg">{status}</p>
                </div>
            )}
        </div>
    );
}

export default function ReportesPage() {
    return (
        <Suspense fallback={<div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>}>
            <ReportesContent />
        </Suspense>
    );
}

function ReportCard({ title, description, icon, onClick, loading }: { title: string, description: string, icon: React.ReactNode, onClick: () => void, loading: boolean }) {
    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm hover:shadow-lg hover:border-primary/20 transition-all group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-slate-50 dark:bg-slate-800/30 rounded-full -mr-8 -mt-8 group-hover:bg-primary/5 transition-colors" />
            <div className="relative z-10 flex items-start justify-between">
                <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-xl mb-3 group-hover:bg-white dark:group-hover:bg-slate-700 shadow-inner transition-colors">
                    {icon}
                </div>
                <button
                    onClick={onClick}
                    disabled={loading}
                    className="flex items-center gap-1 bg-slate-900 dark:bg-slate-700 hover:bg-primary text-white px-1 py-0.5 rounded text-[10px] font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                    <Download size={11} /> PDF
                </button>
            </div>
            <h3 className="text-xs font-extrabold text-slate-900 dark:text-white mb-1 group-hover:text-primary transition-colors leading-tight">{title}</h3>
            <p className="text-slate-500 dark:text-slate-400 text-[10px] leading-relaxed font-medium">{description}</p>
        </div>
    );
}
