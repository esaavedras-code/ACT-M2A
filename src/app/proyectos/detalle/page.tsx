"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
import SummaryDashboard from "@/components/SummaryDashboard";
import type { FormRef } from "@/components/ProjectForm";
import {
    ListChecks, User, Building2, FileText, FileEdit,
    LayoutDashboard, FileCheck, Factory, PackageSearch, ShieldCheck,
    FileCheck2, ChevronLeft, Cloud, CheckCircle2, Loader2
} from "lucide-react";
import Link from "next/link";

function ProjectDetailContent() {
    const searchParams = useSearchParams();
    const id = searchParams.get("id") as string;
    const [activeTab, setActiveTab] = useState("summary");
    const [projectName, setProjectName] = useState("");
    const [numAct, setNumAct] = useState("");
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
    }, [id, hasUnsavedChanges]);

    const fetchProjectData = async () => {
        // Verificar autorización
        const registrationStr = localStorage.getItem("pact_registration");
        const registration = registrationStr ? JSON.parse(registrationStr) : null;
        const allowedIds = registration?.allowedProjectIds || [];

        if (!allowedIds.includes(id)) {
            alert("Acceso denegado: No tiene autorización para este proyecto.");
            window.location.href = "/proyectos";
            return;
        }

        const { data } = await supabase.from("projects").select("name, num_act").eq("id", id).single();
        if (data) {
            setProjectName(data.name);
            setNumAct(data.num_act);
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
                            window.location.href = "/proyectos";
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
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                {activeTab === "summary" && <SummaryDashboard projectId={id} />}
                {activeTab === "project" && <ProjectForm ref={projectRef} projectId={id} onDirty={() => setHasUnsavedChanges(true)} onSaved={() => setHasUnsavedChanges(false)} />}
                {activeTab === "contractor" && <ContractorForm ref={contractorRef} projectId={id} onDirty={() => setHasUnsavedChanges(true)} onSaved={() => setHasUnsavedChanges(false)} />}
                {activeTab === "personnel" && <PersonnelForm ref={personnelRef} projectId={id} onDirty={() => setHasUnsavedChanges(true)} onSaved={() => setHasUnsavedChanges(false)} />}
                {activeTab === "items" && <ItemsForm ref={itemsRef} projectId={id} onDirty={() => setHasUnsavedChanges(true)} onSaved={() => setHasUnsavedChanges(false)} />}
                {activeTab === "cho" && <CHOForm ref={choRef} projectId={id} onDirty={() => setHasUnsavedChanges(true)} onSaved={() => setHasUnsavedChanges(false)} />}
                {activeTab === "certs" && <PaymentCertForm ref={certsRef} projectId={id} onDirty={() => setHasUnsavedChanges(true)} onSaved={() => setHasUnsavedChanges(false)} />}
                {activeTab === "mfg" && <MfgCertForm ref={mfgRef} projectId={id} onDirty={() => setHasUnsavedChanges(true)} onSaved={() => setHasUnsavedChanges(false)} />}
                {activeTab === "materials" && <MaterialsForm ref={materialsRef} projectId={id} onDirty={() => setHasUnsavedChanges(true)} onSaved={() => setHasUnsavedChanges(false)} />}
                {activeTab === "compliance" && <ComplianceForm ref={complianceRef} projectId={id} onDirty={() => setHasUnsavedChanges(true)} onSaved={() => setHasUnsavedChanges(false)} />}
                {activeTab === "liquidation" && <LiquidationForm ref={liquidationRef} projectId={id} onDirty={() => setHasUnsavedChanges(true)} onSaved={() => setHasUnsavedChanges(false)} />}
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
