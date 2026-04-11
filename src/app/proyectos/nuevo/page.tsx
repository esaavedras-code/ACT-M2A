"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import {
    ListChecks, User, Building2, FileText, FileEdit,
    LayoutDashboard, FileCheck, Factory, Package, ShieldCheck,
    FileCheck2
} from "lucide-react";
import { getLocalStorageItem, setLocalStorageItem } from "@/lib/utils";

export default function NewProjectPage() {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [activeTab, setActiveTab] = useState("project");
    const [projectId, setProjectId] = useState<string | undefined>(undefined);

    useEffect(() => {
        setMounted(true);
    }, []);

    const tabs = [
        { id: "project", label: "1. Proyecto", icon: <FileText size={18} />, disabled: false },
        { id: "contractor", label: "2. Contratista", icon: <Building2 size={18} />, disabled: !projectId },
        { id: "personnel", label: "3. Personal", icon: <User size={18} />, disabled: !projectId },
        { id: "items", label: "4. Partidas", icon: <ListChecks size={18} />, disabled: !projectId },
        { id: "cho", label: "5. CHO", icon: <FileEdit size={18} />, disabled: !projectId },
        { id: "certs", label: "6. Pagos", icon: <FileCheck size={18} />, disabled: !projectId },
        { id: "mfg", label: "7. Manufactura", icon: <Factory size={18} />, disabled: !projectId },
        { id: "materials", label: "8. Materiales", icon: <Package size={18} />, disabled: !projectId },
        { id: "compliance", label: "9. Cumplimiento", icon: <ShieldCheck size={18} />, disabled: !projectId },
        { id: "liquidation", label: "10. Liquidación", icon: <FileCheck2 size={18} />, disabled: !projectId },
        { id: "summary", label: "13. Resumen", icon: <LayoutDashboard size={18} />, disabled: !projectId },
    ];

    const handleAuthorizeProject = (newId: string) => {
        const registrationStr = getLocalStorageItem("pact_registration");
        if (registrationStr) {
            try {
                const registration = JSON.parse(registrationStr);
                const allowedIds = registration?.allowedProjectIds || [];
                if (!allowedIds.includes(newId)) {
                    registration.allowedProjectIds = [...allowedIds, newId];
                    setLocalStorageItem("pact_registration", JSON.stringify(registration));
                    // Avisar al sistema que la autorización cambió
                    window.dispatchEvent(new Event("pact_registration_updated"));
                }
            } catch (e) {
                console.error("Error parsing registration", e);
            }
        }
        setProjectId(newId);
    };

    if (!mounted) return null;

    return (
        <div className="py-6 space-y-8">
            {!projectId && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 p-4 rounded-2xl flex items-center gap-4 animate-in slide-in-from-top-2">
                    <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/40 rounded-full flex items-center justify-center text-amber-600">
                        <FileText size={20} />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-amber-800 dark:text-amber-200">Proyecto Nuevo</h3>
                        <p className="text-xs text-amber-600 dark:text-amber-400">Complete y guarde la información de la <b>Sección 1</b> para habilitar las demás áreas del proyecto.</p>
                    </div>
                </div>
            )}

            <div className="flex flex-col lg:flex-row gap-8 items-start relative">
                {/* Botones de Navegación Lateral (Consistente con Detalle) */}
                <div className="w-full lg:w-[240px] shrink-0 sticky top-20">
                    <div className="flex flex-row lg:flex-col flex-wrap lg:flex-nowrap gap-2 bg-white/80 dark:bg-slate-900/90 backdrop-blur-2xl p-3 rounded-[2rem] border border-white dark:border-slate-800 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] dark:shadow-none overflow-x-auto lg:overflow-visible no-scrollbar">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                disabled={tab.disabled}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-[1.4rem] font-black text-[9px] uppercase tracking-[0.1em] transition-all whitespace-nowrap lg:whitespace-normal text-left active:scale-95 group relative overflow-hidden ${activeTab === tab.id
                                        ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/30'
                                        : tab.disabled
                                            ? 'opacity-40 grayscale cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400'
                                            : 'bg-white/60 dark:bg-slate-800/60 text-slate-500 border border-slate-100 dark:border-slate-800 hover:border-blue-500 hover:text-blue-600 hover:bg-white'
                                    }`}
                            >
                                <span className={`shrink-0 ${activeTab === tab.id ? 'text-white' : 'text-blue-500'}`}>{tab.icon}</span>
                                <span className="flex-1">{tab.label}</span>
                                {tab.disabled && <div className="absolute inset-0 bg-slate-500/5 backdrop-blur-[1px] pointer-events-none" title="Guarde la sección 1 para habilitar" />}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tab Content */}
                <div className="flex-1 w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {activeTab === "project" && <ProjectForm projectId={projectId} onSaved={(newId?: string) => {
                        if (newId) {
                            handleAuthorizeProject(newId);
                            router.push(`/proyectos/detalle?id=${newId}`);
                        } else {
                            setActiveTab("contractor");
                        }
                    }} />}
                    {activeTab === "contractor" && <ContractorForm projectId={projectId} />}
                    {activeTab === "personnel" && <PersonnelForm projectId={projectId} />}
                    {activeTab === "items" && <ItemsForm projectId={projectId} />}
                    {activeTab === "cho" && <CHOForm projectId={projectId} />}
                    {activeTab === "certs" && <PaymentCertForm projectId={projectId} />}
                    {activeTab === "mfg" && <MfgCertForm projectId={projectId} />}
                    {activeTab === "materials" && <MaterialsForm projectId={projectId} />}
                    {activeTab === "compliance" && <ComplianceForm projectId={projectId} />}
                    {activeTab === "liquidation" && <LiquidationForm projectId={projectId} />}
                    {activeTab === "summary" && <SummaryDashboard projectId={projectId} />}
                </div>
            </div>
        </div>
    );
}
