"use client";

import { useState, useEffect, Suspense, lazy, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { 
    FileText, Building2, ChevronLeft, Loader2, 
    ListChecks, Users, Package, ShieldCheck, 
    FileCheck, FileEdit, LayoutDashboard, Calculator,
    Mic, TrendingUp, Cloud, Factory, Info, FolderOpen, AlertTriangle,
    Save, Presentation, RefreshCcw, Handshake
} from "lucide-react";
import { getLocalStorageItem, formatProjectNumber } from "@/lib/utils";
import FloatingFormActions from "@/components/FloatingFormActions";

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
import PriceComparison from "@/components/PriceComparison";
import ProjectFilesExplorer from "@/components/ProjectFilesExplorer";
import MonthlyPresentations from "@/components/MonthlyPresentations";
import UpdateTablesForm from "@/components/UpdateTablesForm";
import PriceHistoryLink from "@/components/PriceHistoryLink";

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
    const [isSaving, setIsSaving] = useState(false);

    // Refs para guardado unificado
    const projectFormRef = useRef<any>(null);
    const contractorFormRef = useRef<any>(null);
    const activeRef = useRef<any>(null);

    const saveActiveTab = async () => {
        setIsSaving(true);
        try {
            if (activeTab === "project") {
                await Promise.all([
                    projectFormRef.current?.save(),
                    contractorFormRef.current?.save()
                ]);
            } else {
                if (activeRef.current?.save) {
                    await activeRef.current.save();
                } else {
                    console.warn("La pestaña actual no soporta guardado remoto (activeRef.current.save no existe)");
                }
            }
            
            setIsDirty(false);
            
            // Si el diálogo estaba abierto, lo cerramos y navegamos a la pestaña objetivo
            if (dirtyDialog.show) {
                const target = dirtyDialog.targetTab;
                setDirtyDialog({ show: false, targetTab: "" });
                if (target) setActiveTab(target);
            }
        } catch (error) {
            console.error("Error al guardar sección:", error);
            alert("Hubo un error al intentar guardar los cambios automáticamente.");
        } finally {
            setIsSaving(false);
        }
    };

    const saveProjectSection = async () => {
        setIsSaving(true);
        try {
            // Guardar todos los formularios de la sección en paralelo
            // Esto incluye: 
            // 1. ProjectForm -> (Fechas, CCML, Documentación Crítica)
            // 2. ProjectAgreementForm (vía ref interna de ProjectForm) -> (Fondos Originales)
            // 3. ContractorForm -> (Información del Contratista)
            await Promise.all([
                projectFormRef.current?.save(),
                contractorFormRef.current?.save()
            ]);
            
            setIsDirty(false);
            alert("Se ha actualizado correctamente toda la información de 'Datos Proyecto' (Documentación, Fechas, CCML, Fondos y Contratista).");
        } catch (error) {
            console.error("Error al guardar sección:", error);
            alert("Error al intentar guardar la información de la sección.");
        } finally {
            setIsSaving(false);
        }
    };

    // Orden: Resumen → Proyecto (incluye Contratista) → Firmas ACT → Partidas → Materiales
    //        → Cumplimiento → Change Orders → Pagos → Cert CM → Minutas → Actividades
    //        → Inspección → Force Account → Liquidación
    const tabs = [
        { id: "dashboard",   label: "Resumen",        icon: <LayoutDashboard size={12} /> },
        ...(role !== 'E' ? [{ id: "files",       label: "📁 Archivos",        icon: <FolderOpen size={12} /> }] : []),
        { id: "project",     label: "Datos Proyecto",       icon: <FileText size={12} /> },
        { id: "personnel",   label: "Firmas ACT",     icon: <Users size={12} /> },
        { id: "items",       label: "Todas las partidas",  icon: <ListChecks size={12} /> },
        { id: "materials",   label: "Mat. on Site",   icon: <Package size={12} /> },
        { id: "compliance",  label: "Cumplimiento laboral",   icon: <ShieldCheck size={12} /> },
        { id: "cho",         label: "Change Orders",  icon: <FileEdit size={12} /> },
        { id: "payment",     label: "Pagos",          icon: <FileCheck size={12} /> },
        { id: "mfg",         label: "Certificados de manufactura",       icon: <Factory size={12} /> },
        { id: "minutes",     label: "Minutas",        icon: <Mic size={12} />, wip: true },
        { id: "logs",        label: "Actividades",   icon: <Cloud size={12} />, wip: true },
        { id: "inspection",  label: "Inspección",    icon: <FileCheck size={12} />, wip: true },
        { id: "force",       label: "Force Account", icon: <Calculator size={12} />, wip: true },
        { id: "liquidation", label: "Liquidación",   icon: <TrendingUp size={12} /> },
        { id: "ccml",        label: "Cambios al CCML", icon: <FileEdit size={12} /> },
        { id: "presentations", label: "Presentaciones", icon: <Presentation size={12} />, wip: true },
        { id: "update-tables", label: "Actualizar tablas", icon: <RefreshCcw size={12} />, wip: true },
        { id: "negotiation", label: "Negociación", icon: <Handshake size={12} />, wip: true },
    ];

    // Filtrar pestañas basadas en roles
    const hiddenForContratista = ["update-tables", "ccml", "liquidation", "force", "inspection", "logs", "presentations", "personnel"];
    const filteredTabs = tabs.filter(t => {
        // Reglas generales para No Administradores
        if (role !== 'A') {
            if (t.wip) return false;
            if (t.id === 'force' || t.id === 'minutes' || t.id === 'logs' || t.id === 'inspection') return false;
        }
        // Reglas específicas adicionales para Contratista ('F')
        if (role === 'F' && hiddenForContratista.includes(t.id)) {
            return false;
        }
        return true;
    });

    const handleTabChange = (newTab: string) => {
        const targetTab = tabs.find(t => t.id === newTab) || filteredTabs.find(t => t.id === newTab);
        if (targetTab?.wip) {
            alert(`La sección de '${targetTab.label}' se encuentra actualmente EN CONSTRUCCIÓN.`);
            // No retornamos para dejarle ver qué hay, o podríamos retornar para bloquearlo.
            // Según la instrucción de Enrique, solo pide poner el mensaje.
        }
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
            case "presentations": return "Cree reportes ejecutivos mensuales con actividades y fotos para exportar a PowerPoint.";
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
            case "update-tables": return "";
            case "negotiation": return "Zona de negociación y consulta de historial de precios de la ACT.";
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

                // Inyección de Tema y Cambio de Título para Contratista ('F')
                if (currentRole === 'F') {
                    const style = document.createElement('style');
                    style.innerHTML = `
                        .bg-blue-700, .bg-blue-600, .bg-primary { background-color: #670010 !important; }
                        .text-blue-600, .text-primary, .text-blue-700 { color: #670010 !important; }
                        .border-primary, .border-blue-600 { border-color: #670010 !important; }
                        .focus\\:border-primary:focus { border-color: #670010 !important; }
                        .focus\\:ring-blue-100:focus { --tw-ring-color: rgba(103, 0, 16, 0.2) !important; }
                        .hover\\:bg-blue-700:hover { background-color: #4a000b !important; }
                    `;
                    style.id = 'theme-contratista';
                    document.head.appendChild(style);

                    const titleEls = document.querySelectorAll('header span.truncate');
                    titleEls.forEach(el => {
                        if (el.textContent === "PACT-Administradores") {
                            el.textContent = "PACT-Contratista";
                        }
                    });
                    document.title = "PACT-Contratista - Sistema de Control de Proyectos";
                }

                return () => {
                    document.getElementById('theme-contratista')?.remove();
                };

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
                                onClick={saveActiveTab}
                                disabled={isSaving}
                                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 text-sm font-black text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                                {isSaving ? "Grabando..." : "Grabar"}
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
                            <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-3 py-1 rounded-full uppercase tracking-widest border border-blue-100">ACT: {formatProjectNumber(numAct)}</span>
                            <span className="text-[10px] font-black bg-slate-100 text-slate-400 dark:bg-slate-800 px-3 py-1 rounded-full uppercase tracking-widest">{role === 'A' ? 'Administrador' : 'Colaborador'}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8 items-start relative">
                {/* Botones de Navegación Lateral (Flotantes - Fixed) */}
                <div className="md:fixed md:top-[128px] md:left-4 z-[90] w-full md:w-[200px] lg:w-[220px] shrink-0 transition-all duration-300">
                    <div className="flex flex-row md:flex-col flex-wrap md:flex-nowrap gap-2 bg-white/80 dark:bg-slate-900/90 backdrop-blur-2xl p-3 rounded-[2rem] border border-white dark:border-slate-800 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] dark:shadow-none max-h-[calc(100vh-160px)] overflow-y-auto custom-scrollbar">
                        {filteredTabs.filter(t => role !== 'E' || t.id === 'logs').map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => handleTabChange(tab.id)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-[1.4rem] font-black text-[9px] uppercase tracking-[0.1em] transition-all whitespace-nowrap lg:whitespace-normal text-left active:scale-95 group relative overflow-hidden ${
                                    activeTab === tab.id 
                                    ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/30 ring-1 ring-blue-600 ring-offset-2 ring-offset-white' 
                                    : 'bg-white/60 dark:bg-slate-800/60 text-slate-500 border border-slate-100 dark:border-slate-800 hover:border-blue-500 hover:text-blue-600 hover:bg-white shadow-sm hover:shadow-md'
                                }`}
                            >
                                <span className={`shrink-0 transition-all duration-500 ${activeTab === tab.id ? 'text-white scale-110 rotate-3' : 'text-blue-500 group-hover:scale-125 group-hover:-rotate-3'}`}>{tab.icon}</span>
                                <span className={`line-clamp-2 transition-all duration-300 ${activeTab === tab.id ? 'translate-x-1 font-black' : 'group-hover:translate-x-1'}`}>
                                    {tab.label}
                                    {tab.wip && <span className="ml-2 bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded text-[7px] font-black uppercase">WIP</span>}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Área de Contenido Principal */}
                <div className="flex-1 w-full min-w-0 md:ml-[220px] lg:ml-[240px]">
                    <div className="bg-white dark:bg-slate-950 rounded-[2.5rem] p-4 md:p-10 shadow-2xl shadow-blue-900/5 border border-white dark:border-slate-900 relative min-h-[60vh]">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/40 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>
                        <div className="relative z-10">
                            {getReportNote(activeTab) && (
                                <div className="mb-8 px-6 py-3 border-l-4 border-blue-500 bg-blue-50/30 dark:bg-blue-900/10 rounded-r shadow-sm flex items-center gap-3">
                                    <Info size={18} className="text-blue-600 shrink-0" />
                                    <span className="text-xs font-bold text-blue-800 dark:text-blue-300 leading-relaxed">{getReportNote(activeTab)}</span>
                                </div>
                            )}

                            <Suspense fallback={<div className="p-20 text-center flex flex-col items-center gap-4"><Loader2 className="animate-spin text-blue-500" size={32} /><span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Preparando sección...</span></div>}>
                                {activeTab === "dashboard"   && <SummaryDashboard projectId={id} />}
                                {activeTab === "project"     && (
                                    <div className="space-y-12">
                                        <ProjectForm 
                    ref={projectFormRef}
                    projectId={id} 
                    onSaved={(newId) => {
                      setIsDirty(false);
                      if (newId && !id) {
                        // Si es un proyecto nuevo, redirigimos a la misma página pero con el ID real
                        window.location.search = `?id=${newId}`;
                      } else {
                        // Si era edición, solo quitamos el estado sucio (o podrías recargar si es necesario)
                      }
                    }} 
                    onDirty={() => setIsDirty(true)} 
                  />
                                        <ContractorForm 
                                            ref={contractorFormRef}
                                            projectId={id} numAct={numAct} onSaved={() => setIsDirty(false)} onDirty={() => setIsDirty(true)} />
                                        
                                        <FloatingFormActions
                                            actions={[
                                                {
                                                    label: isSaving ? "Guardando..." : "Guardar cambios",
                                                    icon: <Save />,
                                                    onClick: saveProjectSection,
                                                    description: "Actualizando la información de Datos proyecto",
                                                    variant: 'primary' as const,
                                                    disabled: isSaving
                                                }
                                            ]}
                                        />
                                    </div>
                                )}
                                {activeTab === "personnel"   && <PersonnelForm ref={activeRef} projectId={id} onSaved={() => setIsDirty(false)} onDirty={() => setIsDirty(true)} />}
                                {activeTab === "items"       && <ItemsForm ref={activeRef} projectId={id} onSaved={() => setIsDirty(false)} onDirty={() => setIsDirty(true)} />}
                                {activeTab === "materials"   && <MaterialsForm ref={activeRef} projectId={id} onSaved={() => setIsDirty(false)} onDirty={() => setIsDirty(true)} />}
                                {activeTab === "compliance"  && <ComplianceForm ref={activeRef} projectId={id} onSaved={() => setIsDirty(false)} onDirty={() => setIsDirty(true)} />}
                                {activeTab === "cho"         && <CHOForm ref={activeRef} projectId={id} onSaved={() => setIsDirty(false)} onDirty={() => setIsDirty(true)} />}
                                {activeTab === "payment"     && <PaymentCertForm ref={activeRef} projectId={id} onSaved={() => setIsDirty(false)} onDirty={() => setIsDirty(true)} />}
                                {activeTab === "mfg"         && <MfgCertForm ref={activeRef} projectId={id} onSaved={() => setIsDirty(false)} onDirty={() => setIsDirty(true)} />}
                                { activeTab === "minutes"     && <MinutesForm ref={activeRef} projectId={id} projectName={projectName} numAct={numAct} onSaved={() => setIsDirty(false)} onDirty={() => setIsDirty(true)} />}
                                { activeTab === "logs"        && <DailyLogForm ref={activeRef} projectId={id} onSaved={() => setIsDirty(false)} onDirty={() => setIsDirty(true)} />}
                                { activeTab === "presentations" && <MonthlyPresentations ref={activeRef} projectId={id} numAct={numAct} onSaved={() => setIsDirty(false)} onDirty={() => setIsDirty(true)} />}
                                { activeTab === "inspection"  && <InspectionForm ref={activeRef} projectId={id} onSaved={() => setIsDirty(false)} onDirty={() => setIsDirty(true)} />}
                                {activeTab === "force"       && <ForceAccountForm ref={activeRef} projectId={id} onSaved={() => setIsDirty(false)} onDirty={() => setIsDirty(true)} />}
                                {activeTab === "liquidation" && <LiquidationForm ref={activeRef} projectId={id} onSaved={() => setIsDirty(false)} onDirty={() => setIsDirty(true)} />}
                                {activeTab === "ccml"        && <CCMLModificationsForm ref={activeRef} projectId={id} onSaved={() => setIsDirty(false)} onDirty={() => setIsDirty(true)} />}
                                {activeTab === "files"       && <ProjectFilesExplorer projectId={id} userRole={role} />}
                                {activeTab === "update-tables" && <UpdateTablesForm projectId={id || ""} numAct={numAct} />}
                                {activeTab === "negotiation" && (
                                    <div className="p-8 bg-blue-50 dark:bg-blue-900/10 rounded-3xl border border-blue-100 dark:border-blue-800 flex flex-col items-center justify-center text-center gap-6">
                                        <Handshake size={64} className="text-blue-600 mb-2" />
                                        <div>
                                            <h3 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Zona de Negociación</h3>
                                            <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto">Consulte el historial de precios oficial de la ACT para apoyar los procesos de negociación y estimación.</p>
                                        </div>
                                            <PriceComparison projectId={id || undefined} />
                                    </div>
                                )}
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
