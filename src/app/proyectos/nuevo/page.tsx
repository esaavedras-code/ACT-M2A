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
    LayoutDashboard, FileCheck, Factory, PackageSearch, ShieldCheck,
    FileCheck2
} from "lucide-react";

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
        { id: "materials", label: "8. Materiales", icon: <PackageSearch size={18} />, disabled: !projectId },
        { id: "compliance", label: "9. Cumplimiento", icon: <ShieldCheck size={18} />, disabled: !projectId },
        { id: "liquidation", label: "10. Liquidación", icon: <FileCheck2 size={18} />, disabled: !projectId },
        { id: "summary", label: "13. Resumen", icon: <LayoutDashboard size={18} />, disabled: !projectId },
    ];

    const handleAuthorizeProject = (newId: string) => {
        const registrationStr = localStorage.getItem("pact_registration");
        if (registrationStr) {
            try {
                const registration = JSON.parse(registrationStr);
                const allowedIds = registration?.allowedProjectIds || [];
                if (!allowedIds.includes(newId)) {
                    registration.allowedProjectIds = [...allowedIds, newId];
                    localStorage.setItem("pact_registration", JSON.stringify(registration));
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

            {/* Tab Navigation */}
            <div className="sticky top-20 z-30 bg-slate-50 dark:bg-[#020617] flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar pb-1">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        disabled={tab.disabled}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-5 py-4 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${activeTab === tab.id
                            ? "border-primary text-primary"
                            : tab.disabled
                                ? "border-transparent text-slate-300 cursor-not-allowed grayscale opacity-50"
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
                {activeTab === "project" && <ProjectForm projectId={projectId} onSaved={(newId?: string) => {
                    if (newId) {
                        handleAuthorizeProject(newId);
                        // Usar el router de Next.js es más seguro para la navegación SPA
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
    );
}
