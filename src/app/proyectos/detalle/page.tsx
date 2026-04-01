"use client";

import { useState, useEffect, Suspense, lazy, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { 
    FileText, Building2, ChevronLeft, Loader2, 
    ListChecks, Users, PackageSearch, ShieldCheck, 
    FileCheck, FileEdit, LayoutDashboard, Calculator,
    Mic, TrendingUp, Cloud, Factory, Info, FolderOpen, AlertTriangle
} from "lucide-react";
import { getLocalStorageItem } from "@/lib/utils";

import ProjectForm from "@/components/ProjectForm";
import ContractorForm from "@/components/ContractorForm";
import ItemsForm from "@/components/ItemsForm";
import PersonnelForm from "@/components/PersonnelForm";
import MaterialsForm from "@/components/MaterialsForm";
import ComplianceForm from "@/components/ComplianceForm";
import CHOForm from "@/components/CHOForm";
import PaymentCertForm from "@/components/PaymentCertForm";
import MinutesForm from "@/components/MinutesForm";
import DailyLogForm from "@/components/DailyLogForm";
import LiquidationForm from "@/components/LiquidationForm";
import MfgCertForm from "@/components/MfgCertForm";
import ForceAccountForm from "@/components/ForceAccountForm";
import InspectionForm from "@/components/InspectionForm";
import CCMLModificationsForm from "@/components/CCMLModificationsForm";
import ProjectFilesExplorer from "@/components/ProjectFilesExplorer";

const SummaryDashboard = lazy(() => import("@/components/SummaryDashboard"));

function ProjectDetailContent() {
    const searchParams = useSearchParams();
    const id = searchParams.get("id");
    const [projectName, setProjectName] = useState("");
    const [numAct, setNumAct] = useState("");
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "dashboard");
    const [isDirty, setIsDirty] = useState(false);
    const [role, setRole] = useState("C");
    const [dirtyDialog, setDirtyDialog] = useState<{ show: boolean; targetTab: string }>({ show: false, targetTab: "" });

    // Orden: Resumen → Proyecto (incluye Contratista) → Firmas ACT → Partidas → Materiales
    //        → Cumplimiento → Change Orders → Pagos → Cert CM → Minutas → Actividades
    //        → Inspección → Force Account → Liquidación
    const tabs = [
        { id: "dashboard",   label: "0. Resumen",        icon: <LayoutDashboard size={12} /> },
        ...(role !== 'E' ? [{ id: "files",       label: "📁 Archivos",        icon: <FolderOpen size={12} /> }] : []),
        { id: "project",     label: "1. Datos Proyecto",       icon: <FileText size={12} /> },
        { id: "personnel",   label: "2. Firmas ACT",     icon: <Users size={12} /> },
        { id: "items",       label: "3. Partidas contrato",  icon: <ListChecks size={12} /> },
        { id: "materials",   label: "4. Mat. on Site",   icon: <PackageSearch size={12} /> },
        { id: "compliance",  label: "5. Cumplimiento",   icon: <ShieldCheck size={12} /> },
        { id: "cho",         label: "6. Change Orders",  icon: <FileEdit size={12} /> },
        { id: "payment",     label: "7. Pagos",          icon: <FileCheck size={12} /> },
        { id: "mfg",         label: "8. Cert. CM",       icon: <Factory size={12} /> },
        { id: "minutes",     label: "9. Minutas",        icon: <Mic size={12} /> },
        { id: "logs",        label: "10. Actividades",   icon: <Cloud size={12} /> },
        { id: "inspection",  label: "11. Inspección",    icon: <FileCheck size={12} /> },
        { id: "force",       label: "12. Force Account", icon: <Calculator size={12} /> },
        { id: "liquidation", label: "13. Liquidación",   icon: <TrendingUp size={12} /> },
        { id: "ccml",        label: "14. Cambios al CCML", icon: <FileEdit size={12} /> },
    ];

    const handleTabChange = (newTab: string) => {
        if (newTab === activeTab) return;
        if (isDirty) {
            setDirtyDialog({ show: true, targetTab: newTab });
            return;
        }
        setIsDirty(false);
        setActiveTab(newTab);
    };

    const getReportNote = (tab: string) => {
        switch (tab) {
            case "dashboard": return "El Dashboard Ejecutivo del proyecto pueden verlo en la pestaña de REPORTES, opción '1. Información General'.";
            case "project": return "La información del proyecto y del contratista se gestiona en esta sección.";
            case "personnel": return "El personal de ACT asignado al proyecto se gestiona en esta sección.";
            case "items": return "Los balances y modificaciones de partidas los pueden ver en la pestaña de REPORTES, opción '2. Gestión de Partidas'.";
            case "materials": return "El reporte oficial de materiales 'ACT-117B' lo pueden ver en la pestaña de REPORTES, opción '4. Material on Site (MOS)'.";
            case "compliance": return "La documentación de cumplimiento los pueden ver en la pestaña de REPORTES.";
            case "cho": return "Los reportes ACT-122, ACT-124, ROA y CCML los pueden ver en la pestaña de REPORTES, opción '5. Change Orders'.";
            case "payment": return "Las certificaciones de pago 'ACT-117C' las pueden ver en la pestaña de REPORTES, opción '6. Certificaciones de Pago'.";
            case "mfg": return "Los 'Certificados de Manufactura' los pueden ver en la pestaña de REPORTES, opción '3. Certificados de Manufactura'.";
            case "minutes": return "Las minutas documentadas las pueden ver en la pestaña de REPORTES.";
            case "logs": return "Los controles de tiempo de actividades los pueden ver en la pestaña de REPORTES.";
            case "inspection": return "Los informes de inspección los pueden ver en la pestaña de REPORTES.";
            case "force": return "El balance de Force Account lo pueden ver en la pestaña de REPORTES.";
            case "liquidation": return "Las hojas de liquidación y checklists (Final Acceptance) los pueden ver en la pestaña de REPORTES, opción '7. Liquidación'.";
            case "ccml": return "La información de las Cartas de Requerimiento de Modificación (Project Modification Letters) se gestiona en esta sección.";
            default: return "Los reportes de esta sección los pueden ver en la pestaña de REPORTES de este proyecto.";
        }
    };

    useEffect(() => {
        if (!id) return;

        async function loadProject() {
            setLoading(true);
            try {
                const { data: { session } } = await supabase.auth.getSession();
                let isAuthorized = false;
                let currentRole = "C";

                if (session) {
                    // Get user data by ID first (preferred)
                    let { data: userData } = await supabase.from("users").select("id, role_global").eq("id", session.user.id).single();
                    
                    // If ID match fails, try by email as a fallback (resilience)
                    if (!userData && session.user.email) {
                        const { data: userDataByEmail } = await supabase.from("users").select("id, role_global").eq("email", session.user.email.toLowerCase()).single();
                        userData = userDataByEmail;
                    }

                    if (userData?.role_global === "A") {
                        isAuthorized = true;
                        currentRole = "A";
                    } else {
                        // 2. Verificar membresía específica usando el ID que encontramos (o el de la sesión)
                        const queryId = userData?.id || session.user.id;
                        const { data: mem } = await supabase
                            .from("memberships")
                            .select("role")
                            .eq("project_id", id)
                            .eq("user_id", queryId)
                            .is("revoked_at", null)
                            .eq("is_active", true)
                            .maybeSingle();

                        if (mem) {
                            isAuthorized = true;
                            currentRole = mem.role;
                        }
                    }
                } else {
                    // 3. Fallback a localStorage solo si no hay sesión (compatibilidad)
                    const registrationStr = getLocalStorageItem("pact_registration");
                    if (registrationStr) {
                        try {
                            const registration = JSON.parse(registrationStr);
                            const allowedIds = registration?.allowedProjectIds || [];
                            if (allowedIds.includes("ALL") || allowedIds.includes(id)) {
                                isAuthorized = true;
                            }
                        } catch (e) {
                            console.error("Error parsing registration", e);
                        }
                    }
                }

                if (!isAuthorized) {
                    console.warn("Acceso no autorizado al proyecto:", id);
                    window.location.href = "/proyectos";
                    return;
                }

                if (currentRole === 'E' && !searchParams.get("tab")) {
                    setActiveTab('logs');
                }
                setRole(currentRole);

                // Cargar datos del proyecto
                const { data: project } = await supabase.from("projects").select("name, num_act").eq("id", id).single();
                if (project) {
                    setProjectName(project.name);
                    setNumAct(project.num_act);
                }
            } catch (err) {
                console.error("Error loading project:", err);
                window.location.href = "/proyectos";
            } finally {
                setLoading(false);
            }
        }

        loadProject();
    }, [id]);

    if (!id) return <div className="p-20 text-center font-bold text-red-500 uppercase tracking-widest">Error: Proyecto no encontrado</div>;

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
            <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-[10px]">Cargando expediente...</p>
        </div>
    );

    return (
        <div className="py-2 animate-in fade-in duration-500">
            {/* Modal: Datos sin guardar */}
            {dirtyDialog.show && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md mx-4 overflow-hidden">
                        <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800 px-6 py-4">
                            <AlertTriangle size={22} className="text-amber-600 shrink-0" />
                            <h3 className="text-base font-black text-amber-800 dark:text-amber-300">Datos sin guardar</h3>
                        </div>
                        <div className="px-6 py-5">
                            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                Tiene datos sin guardar en esta pestaña. ¿Qué desea hacer?
                            </p>
                        </div>
                        <div className="px-6 pb-5 flex flex-col gap-2">
                            <button
                                onClick={() => { setDirtyDialog({ show: false, targetTab: "" }); }}
                                className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                Cancelar — quedarme y guardar manualmente
                            </button>
                            <button
                                onClick={() => {
                                    setDirtyDialog({ show: false, targetTab: "" });
                                    setIsDirty(false);
                                    setActiveTab(dirtyDialog.targetTab);
                                }}
                                className="w-full py-2.5 px-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm font-bold text-red-700 dark:text-red-300 hover:bg-red-100 transition-colors"
                            >
                                No quiero guardar los cambios
                            </button>
                            <button
                                onClick={() => { setDirtyDialog({ show: false, targetTab: "" }); }}
                                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 text-sm font-black text-white hover:bg-blue-700 transition-colors"
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Encabezado Superior (Proyecto y Botón Atrás) */}
            <div className="sticky top-0 z-50 bg-[#F8FAFC]/80 dark:bg-[#020617]/80 backdrop-blur-md pt-4 pb-4 border-b border-slate-200 dark:border-slate-800 mb-6 px-4 -mx-4">
                <div className="flex items-center gap-4">
                    <Link href="/proyectos" className="p-2.5 hover:bg-white rounded-2xl transition-all shadow-sm border border-transparent hover:border-slate-100 group bg-slate-100 dark:bg-slate-800">
                        <ChevronLeft size={24} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase line-clamp-1">{projectName || "Nuevo Proyecto"}</h1>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-3 py-1 rounded-full uppercase tracking-widest border border-blue-100">ACT: {numAct || "N/A"}</span>
                            <span className="text-[10px] font-black bg-slate-100 text-slate-400 dark:bg-slate-800 px-3 py-1 rounded-full uppercase tracking-widest">{role === 'A' ? 'Administrador' : 'Colaborador'}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8 items-start relative">
                {/* Botones de Navegación Lateral (Flotantes) */}
                <div className="lg:sticky lg:top-[160px] z-[40] w-full lg:w-[280px] shrink-0 self-start transition-all duration-300">
                    <div className="flex flex-row lg:flex-col flex-wrap lg:flex-nowrap gap-2.5 bg-white/80 dark:bg-slate-900/90 backdrop-blur-2xl p-5 rounded-[2.5rem] border border-white dark:border-slate-800 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.15)] dark:shadow-none max-h-[calc(100vh-200px)] overflow-y-auto custom-scrollbar">
                        {tabs.filter(t => role !== 'E' || t.id === 'logs').map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => handleTabChange(tab.id)}
                                className={`flex items-center gap-4 px-6 py-4 rounded-[1.8rem] font-black text-[10px] uppercase tracking-[0.15em] transition-all whitespace-nowrap lg:whitespace-normal text-left active:scale-95 group relative overflow-hidden ${
                                    activeTab === tab.id 
                                    ? 'bg-blue-600 text-white shadow-2xl shadow-blue-600/40 ring-2 ring-blue-600 ring-offset-2 ring-offset-white' 
                                    : 'bg-white/60 dark:bg-slate-800/60 text-slate-500 border border-slate-100 dark:border-slate-800 hover:border-blue-500 hover:text-blue-600 hover:bg-white shadow-sm hover:shadow-lg'
                                }`}
                            >
                                <span className={`shrink-0 transition-all duration-500 ${activeTab === tab.id ? 'text-white scale-110 rotate-3' : 'text-blue-500 group-hover:scale-125 group-hover:-rotate-3'}`}>{tab.icon}</span>
                                <span className={`line-clamp-2 transition-all duration-300 ${activeTab === tab.id ? 'translate-x-1 font-black' : 'group-hover:translate-x-1'}`}>{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Área de Contenido Principal */}
                <div className="flex-1 w-full min-w-0">
                    <div className="bg-white dark:bg-slate-950 rounded-[2.5rem] p-4 md:p-10 shadow-2xl shadow-blue-900/5 border border-white dark:border-slate-900 relative min-h-[60vh]">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/40 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>
                        <div className="relative z-10">
                            <div className="mb-8 px-6 py-3 border-l-4 border-blue-500 bg-blue-50/30 dark:bg-blue-900/10 rounded-r shadow-sm flex items-center gap-3">
                                <Info size={18} className="text-blue-600 shrink-0" />
                                <span className="text-xs font-bold text-blue-800 dark:text-blue-300 leading-relaxed">{getReportNote(activeTab)}</span>
                            </div>

                            <Suspense fallback={<div className="p-20 text-center flex flex-col items-center gap-4"><Loader2 className="animate-spin text-blue-500" size={32} /><span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Preparando sección...</span></div>}>
                                {activeTab === "dashboard"   && <SummaryDashboard projectId={id} />}
                                {activeTab === "project"     && (
                                    <div className="space-y-12">
                                        <ProjectForm projectId={id} onSaved={() => setIsDirty(false)} onDirty={() => setIsDirty(true)} />
                                        <ContractorForm projectId={id} numAct={numAct} onSaved={() => setIsDirty(false)} onDirty={() => setIsDirty(true)} />
                                    </div>
                                )}
                                {activeTab === "personnel"   && <PersonnelForm projectId={id} onSaved={() => setIsDirty(false)} onDirty={() => setIsDirty(true)} />}
                                {activeTab === "items"       && <ItemsForm projectId={id} onSaved={() => setIsDirty(false)} onDirty={() => setIsDirty(true)} />}
                                {activeTab === "materials"   && <MaterialsForm projectId={id} onSaved={() => setIsDirty(false)} onDirty={() => setIsDirty(true)} />}
                                {activeTab === "compliance"  && <ComplianceForm projectId={id} onSaved={() => setIsDirty(false)} onDirty={() => setIsDirty(true)} />}
                                {activeTab === "cho"         && <CHOForm projectId={id} onSaved={() => setIsDirty(false)} onDirty={() => setIsDirty(true)} />}
                                {activeTab === "payment"     && <PaymentCertForm projectId={id} onSaved={() => setIsDirty(false)} onDirty={() => setIsDirty(true)} />}
                                {activeTab === "mfg"         && <MfgCertForm projectId={id} onSaved={() => setIsDirty(false)} onDirty={() => setIsDirty(true)} />}
                                {activeTab === "minutes"     && <MinutesForm projectId={id} projectName={projectName} numAct={numAct} onSaved={() => setIsDirty(false)} onDirty={() => setIsDirty(true)} />}
                                {activeTab === "logs"        && <DailyLogForm projectId={id} onSaved={() => setIsDirty(false)} onDirty={() => setIsDirty(true)} />}
                                {activeTab === "inspection"  && <InspectionForm projectId={id} onSaved={() => setIsDirty(false)} onDirty={() => setIsDirty(true)} />}
                                {activeTab === "force"       && <ForceAccountForm projectId={id} onSaved={() => setIsDirty(false)} onDirty={() => setIsDirty(true)} />}
                                {activeTab === "liquidation" && <LiquidationForm projectId={id} onSaved={() => setIsDirty(false)} onDirty={() => setIsDirty(true)} />}
                                {activeTab === "ccml"        && <CCMLModificationsForm projectId={id} onSaved={() => setIsDirty(false)} onDirty={() => setIsDirty(true)} />}
                                {activeTab === "files"       && <ProjectFilesExplorer projectId={id} />}
                            </Suspense>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function ProjectDetailPage() {
    return (
        <Suspense fallback={<div className="p-20 text-center uppercase font-black text-[10px] tracking-widest">Iniciando PACT...</div>}>
            <ProjectDetailContent />
        </Suspense>
    );
}
