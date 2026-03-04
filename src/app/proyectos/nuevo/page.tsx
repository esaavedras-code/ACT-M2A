"use client";

import { useState } from "react";
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
    const [activeTab, setActiveTab] = useState("project");
    const [projectId, setProjectId] = useState<string | undefined>(undefined);

    const tabs = [
        { id: "project", label: "1. Proyecto", icon: <FileText size={18} /> },
        { id: "contractor", label: "2. Contratista", icon: <Building2 size={18} /> },
        { id: "personnel", label: "3. Personal", icon: <User size={18} /> },
        { id: "items", label: "4. Partidas", icon: <ListChecks size={18} /> },
        { id: "cho", label: "5. CHO", icon: <FileEdit size={18} /> },
        { id: "certs", label: "6. Pagos", icon: <FileCheck size={18} /> },
        { id: "mfg", label: "7. Manufactura", icon: <Factory size={18} /> },
        { id: "materials", label: "8. Materiales", icon: <PackageSearch size={18} /> },
        { id: "compliance", label: "9. Cumplimiento", icon: <ShieldCheck size={18} /> },
        { id: "liquidation", label: "10. Liquidación", icon: <FileCheck2 size={18} /> },
        { id: "summary", label: "13. Resumen", icon: <LayoutDashboard size={18} /> },
    ];

    return (
        <div className="py-6 space-y-8">
            {/* Tab Navigation */}
            <div className="sticky top-20 z-30 bg-slate-50 dark:bg-[#020617] flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar pb-1">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
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
                {activeTab === "project" && <ProjectForm onSaved={(newId?: string) => {
                    if (newId) setProjectId(newId);
                    setActiveTab("contractor");
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
