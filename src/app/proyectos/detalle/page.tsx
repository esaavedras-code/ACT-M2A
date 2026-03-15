"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ProjectForm from "@/components/ProjectForm";
import ContractorForm from "@/components/ContractorForm";
import PersonnelForm from "@/components/PersonnelForm";
import ItemsForm from "@/components/ItemsForm";
import CHOForm from "@/components/CHOForm";
import PaymentCertForm from "@/components/PaymentCertForm";
import MfgCertForm from "@/components/MfgCertForm";
import MaterialsForm from "@/components/MaterialsForm";
import ComplianceForm from "@/components/ComplianceForm";
import LiquidationForm from "@/components/LiquidationForm";
import ForceAccountForm from "@/components/ForceAccountForm";
import DailyLogForm from "@/components/DailyLogForm";
import MinutesForm from "@/components/MinutesForm";
import SummaryDashboard from "@/components/SummaryDashboard";
import ProjectMemberships from "@/components/ProjectMemberships";
import type { FormRef } from "@/components/ProjectForm";
import {
    ListChecks, User, Building2, FileText, FileEdit,
    LayoutDashboard, FileCheck, Factory, PackageSearch, ShieldCheck,
    FileCheck2, ChevronLeft, Cloud, CheckCircle2, Loader2, Trash2, Users, Calculator, Mic
} from "lucide-react";
import Link from "next/link";

function ProjectDetailContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const id = searchParams.get("id") as string;
    const [activeTab, setActiveTab] = useState("summary");
    const [projectName, setProjectName] = useState("");
    const [numAct, setNumAct] = useState("");
    const [currentUserRole, setCurrentUserRole] = useState("C");
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

    // Refs para cada formulario con su función save()
    const projectRef = useRef<FormRef>(null);
    const contractorRef = useRef<FormRef>(null);
    const personnelRef = useRef<FormRef>(null);
    const itemsRef = useRef<FormRef>(null);
    const choRef = useRef<FormRef>(null);
    const certsRef = useRef<FormRef>(null);
    const mfgRef = useRef<FormRef>(null);
    const materialsRef = useRef<FormRef>(null);
    const complianceRef = useRef<FormRef>(null);
    const liquidationRef = useRef<FormRef>(null);
    const forceAccountRef = useRef<FormRef>(null);
    const dailyLogRef = useRef<FormRef>(null);
    const minutesRef = useRef<FormRef>(null);

    // Mapa tab → ref
    const tabRefs: Record<string, React.RefObject<FormRef | null>> = {
        project: projectRef,
        contractor: contractorRef,
        personnel: personnelRef,
        items: itemsRef,
        cho: choRef,
        certs: certsRef,
        mfg: mfgRef,
        materials: materialsRef,
        compliance: complianceRef,
        liquidation: liquidationRef,
        forceAccount: forceAccountRef,
        dailyLog: dailyLogRef,
        minutes: minutesRef,
    };

    useEffect(() => {
        if (id) fetchProjectData();

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = "";
            }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [id]);

    const fetchProjectData = async () => {
        // Verificar autorización (mantenemos retrocompatibilidad con cache si lo hay o session base)
        const registrationStr = localStorage.getItem("pact_registration");
        let registration = null;
        try {
            registration = registrationStr ? JSON.parse(registrationStr) : null;
        } catch (e) {
            console.error("Error parsing registration", e);
        }
        let allowedIds = registration?.allowedProjectIds || [];

        // Obtener la sesión real del usuario para determinar el currentUserRole real (A, B, C, D)
        const { data: { session } } = await supabase.auth.getSession();
        
        let role = "C"; // Default visual fallback
        if (session) {
             const userId = session.user.id;
             // Verificamos nivel global primero
             const { data: userData } = await supabase.from("users").select("role_global").eq("id", userId).single();
             if (userData?.role_global === "A") {
                 role = "A";
                 allowedIds = ["ALL"]; // Forzar acceso total
             } else {
                 // Verificamos en membresías de este proyecto
                 const { data: memData } = await supabase.from("memberships").select("role").eq("project_id", id).eq("user_id", userId).single();
                 if (memData) role = memData.role;
             }
        }
        
        setCurrentUserRole(role);

        // Si es global override 
        if (allowedIds.includes("ALL")) {
            const { data } = await supabase.from("projects").select("name, num_act").eq("id", id).single();
            if (data) {
                setProjectName(data.name);
                setNumAct(data.num_act);
            }
            return;
        }

        if (!allowedIds.includes(id)) {
            alert("Acceso denegado: No tiene autorización para este proyecto.");
            router.push("/proyectos");
            return;
        }

        const { data } = await supabase.from("projects").select("name, num_act").eq("id", id).single();
        if (data) {
            setProjectName(data.name);
            setNumAct(data.num_act);
        }
    };

    const handleDeleteProject = async () => {
        const confirmDelete = window.confirm(
            `¿Estás seguro que deseas ELIMINAR el proyecto "${projectName}"? Esta acción no se puede deshacer y borrará todos los datos asociados (contratistas, partidas, pagos, etc.).`
        );

        if (confirmDelete) {
            try {
                const { error } = await supabase.from('projects').delete().eq('id', id);
                if (error) throw error;

                alert("Proyecto eliminado exitosamente.");
                router.push("/proyectos");
            } catch (error) {
                console.error("Error eliminando proyecto:", error);
                alert("Hubo un error al intentar eliminar el proyecto.");
            }
        }
    };

    const handleTabChange = async (tabId: string) => {
        if (tabId === activeTab) return;

        // Preguntar si desea guardar antes de cambiar de sección
        if (hasUnsavedChanges) {
            const confirmSave = window.confirm("Tienes cambios sin guardar en esta sección. ¿Deseas guardarlos antes de cambiar?");
            if (confirmSave) {
                const currentRef = tabRefs[activeTab];
                if (currentRef?.current?.save) {
                    setAutoSaveStatus("saving");
                    try {
                        await currentRef.current.save();
                        setAutoSaveStatus("saved");
                        setTimeout(() => setAutoSaveStatus("idle"), 2500);
                    } catch {
                        setAutoSaveStatus("idle");
                    }
                }
            } else {
                // Si el usuario presiona "Cancelar", abortamos el cambio de tab.
                return;
            }
        }

        setHasUnsavedChanges(false);
        setActiveTab(tabId);
    };

    const tabs = [
        { id: "summary", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
        { id: "project", label: "1. Proyecto", icon: <FileText size={18} /> },
        { id: "contractor", label: "2. Contratista", icon: <Building2 size={18} /> },
        { id: "personnel", label: "3. Firmas ACT", icon: <User size={18} /> },
        { id: "items", label: "4. Partidas", icon: <ListChecks size={18} /> },
        { id: "cho", label: "5. CHO", icon: <FileEdit size={18} /> },
        { id: "certs", label: "6. Pagos", icon: <FileCheck size={18} /> },
        { id: "mfg", label: "7. Manufactura", icon: <Factory size={18} /> },
        { id: "materials", label: "8. Materiales", icon: <PackageSearch size={18} /> },
        { id: "compliance", label: "9. Cumplimiento", icon: <ShieldCheck size={18} /> },
        { id: "liquidation", label: "10. Liquidación", icon: <FileCheck2 size={18} /> },
        { id: "forceAccount", label: "11. Force Account", icon: <Calculator size={18} /> },
        { id: "dailyLog", label: "12. Daily Log", icon: <FileEdit size={18} /> },
        { id: "minutes", label: "13. Minutas de Reunión", icon: <Mic size={18} /> },
    ];

    return (
        <div className="py-6 space-y-8 font-geist">
            <div className="flex items-center gap-4">
                <Link
                    href="/proyectos"
                    onClick={async (e) => {
                        if (hasUnsavedChanges) {
                            e.preventDefault();
                            const confirmSave = window.confirm("Tienes cambios sin guardar. ¿Deseas guardarlos antes de salir?");
                            if (confirmSave) {
                                const currentRef = tabRefs[activeTab];
                                if (currentRef?.current?.save) {
                                    setAutoSaveStatus("saving");
                                    await currentRef.current.save();
                                    setAutoSaveStatus("saved");
                                }
                            }
                            router.push("/proyectos");
                        }
                    }}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-full transition-colors text-slate-500"
                >
                    <ChevronLeft size={24} />
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        {projectName || "Cargando..."}
                        {numAct && (
                            <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-primary text-sm font-bold rounded border border-blue-100 dark:border-blue-800">
                                ACT-{numAct}
                            </span>
                        )}
                    </h1>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Detalle del Proyecto</p>
                </div>

                {/* Botón Eliminar Proyecto */}
                <button
                    onClick={handleDeleteProject}
                    className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium transition-colors border border-red-200 dark:border-red-800/30"
                    title="Eliminar Proyecto"
                >
                    <Trash2 size={16} />
                    <span className="hidden sm:inline">Eliminar Proyecto</span>
                </button>

                {/* Indicador de autoguardado */}
                <div className="flex items-center gap-2 text-xs font-bold transition-all duration-300">
                    {autoSaveStatus === "saving" && (
                        <span className="flex items-center gap-1.5 text-amber-500">
                            <Loader2 size={14} className="animate-spin" />
                            Guardando...
                        </span>
                    )}
                    {autoSaveStatus === "saved" && (
                        <span className="flex items-center gap-1.5 text-emerald-600">
                            <CheckCircle2 size={14} />
                            Guardado automáticamente
                        </span>
                    )}
                    {autoSaveStatus === "idle" && hasUnsavedChanges && (
                        <span className="flex items-center gap-1.5 text-slate-400">
                            <Cloud size={14} />
                            Sin guardar
                        </span>
                    )}
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="sticky top-20 z-30 bg-slate-50 dark:bg-[#020617] flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar pb-1">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => handleTabChange(tab.id)}
                        className={`flex items-center gap-2 px-5 py-4 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${activeTab === tab.id
                            ? "border-primary text-primary"
                            : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                            }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="">
                <div className={activeTab === "summary" ? "block" : "hidden"}><SummaryDashboard projectId={id} numAct={numAct} /></div>
                <div className={activeTab === "project" ? "block" : "hidden"}><ProjectForm ref={projectRef} projectId={id} onDirty={() => setHasUnsavedChanges(true)} onSaved={() => setHasUnsavedChanges(false)} /></div>
                <div className={activeTab === "contractor" ? "block" : "hidden"}><ContractorForm ref={contractorRef} projectId={id} numAct={numAct} onDirty={() => setHasUnsavedChanges(true)} onSaved={() => setHasUnsavedChanges(false)} /></div>
                <div className={activeTab === "personnel" ? "block" : "hidden"}><PersonnelForm ref={personnelRef} projectId={id} numAct={numAct} onDirty={() => setHasUnsavedChanges(true)} onSaved={() => setHasUnsavedChanges(false)} /></div>
                <div className={activeTab === "items" ? "block" : "hidden"}><ItemsForm ref={itemsRef} projectId={id} numAct={numAct} onDirty={() => setHasUnsavedChanges(true)} onSaved={() => setHasUnsavedChanges(false)} /></div>
                <div className={activeTab === "cho" ? "block" : "hidden"}><CHOForm ref={choRef} projectId={id} numAct={numAct} onDirty={() => setHasUnsavedChanges(true)} onSaved={() => setHasUnsavedChanges(false)} /></div>
                <div className={activeTab === "certs" ? "block" : "hidden"}><PaymentCertForm ref={certsRef} projectId={id} numAct={numAct} onDirty={() => setHasUnsavedChanges(true)} onSaved={() => setHasUnsavedChanges(false)} /></div>
                <div className={activeTab === "mfg" ? "block" : "hidden"}><MfgCertForm ref={mfgRef} projectId={id} numAct={numAct} onDirty={() => setHasUnsavedChanges(true)} onSaved={() => setHasUnsavedChanges(false)} /></div>
                <div className={activeTab === "materials" ? "block" : "hidden"}><MaterialsForm ref={materialsRef} projectId={id} numAct={numAct} onDirty={() => setHasUnsavedChanges(true)} onSaved={() => setHasUnsavedChanges(false)} /></div>
                <div className={activeTab === "compliance" ? "block" : "hidden"}><ComplianceForm ref={complianceRef} projectId={id} numAct={numAct} onDirty={() => setHasUnsavedChanges(true)} onSaved={() => setHasUnsavedChanges(false)} /></div>
                <div className={activeTab === "liquidation" ? "block" : "hidden"}><LiquidationForm ref={liquidationRef} projectId={id} numAct={numAct} onDirty={() => setHasUnsavedChanges(true)} onSaved={() => setHasUnsavedChanges(false)} /></div>
                <div className={activeTab === "forceAccount" ? "block" : "hidden"}><ForceAccountForm ref={forceAccountRef} projectId={id} numAct={numAct} onDirty={() => setHasUnsavedChanges(true)} onSaved={() => setHasUnsavedChanges(false)} /></div>
                <div className={activeTab === "dailyLog" ? "block" : "hidden"}><DailyLogForm ref={dailyLogRef} projectId={id} numAct={numAct} onDirty={() => setHasUnsavedChanges(true)} onSaved={() => setHasUnsavedChanges(false)} /></div>
                <div className={activeTab === "minutes" ? "block" : "hidden"}><MinutesForm ref={minutesRef} projectId={id} onDirty={() => setHasUnsavedChanges(true)} onSaved={() => setHasUnsavedChanges(false)} /></div>
            </div>
        </div>
    );
}

export default function ProjectDetailPage() {
    return (
        <Suspense fallback={<div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>}>
            <ProjectDetailContent />
        </Suspense>
    );
}
