"use client";

import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/lib/supabase";
import { Save, Building2, Download, Upload } from "lucide-react";
import FloatingFormActions from "./FloatingFormActions";
import { formatPhoneNumber } from "@/lib/utils";
import { exportSectionToJSON, importSectionFromJSON } from "@/lib/sectionIO";
import type { FormRef } from "./ProjectForm";

const ContractorForm = forwardRef<FormRef, { projectId?: string, numAct?: string, onDirty?: () => void, onSaved?: () => void }>(function ContractorForm({ projectId, numAct, onDirty, onSaved }, ref) {
    const [formData, setFormData] = useState({
        project_id: projectId || "",
        name: "",
        representative: "",
        ss_patronal: "",
        phone_office: "",
        phone_mobile: "",
        email: "",
    });
    const [mounted, setMounted] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (projectId) fetchContractor();
    }, [projectId]);

    const fetchContractor = async () => {
        const { data } = await supabase.from("contractors").select("*").eq("project_id", projectId).single();
        if (data) setFormData(data);
    };

    const saveData = async (silent = false) => {
        if (!projectId) return;
        const contractorData = { ...formData, project_id: projectId };
        const { data: existing } = await supabase.from("contractors").select("id").eq("project_id", projectId).single();
        let res;
        if (existing) {
            res = await supabase.from("contractors").update(contractorData).eq('project_id', projectId);
        } else {
            res = await supabase.from("contractors").insert([contractorData]);
        }
        if (res.error && !silent) alert("Error: " + res.error.message);
        else if (!res.error) {
            if (!silent) alert("Información de contratista sincronizada");
            if (onSaved) onSaved();
        }
    };

    useImperativeHandle(ref, () => ({ save: () => saveData(true) }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!projectId) return;
        setLoading(true);
        await saveData(false);
        setLoading(false);
    };

    if (!mounted) return null;

    return (
        <div suppressHydrationWarning className="w-full space-y-6 animate-in fade-in duration-300">
            <div className="sticky top-0 z-40 bg-[#F8FAFC]/95 dark:bg-[#020617]/95 backdrop-blur-md pt-6 pb-4 -mx-4 px-4 md:-mx-8 md:px-8 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Building2 className="text-primary" />
                    Información del Contratista
                </h2>
                {/* El botón de guardar ha sido removido por Enrique */}
            </div>

            {numAct && (
                <div className="flex items-center gap-2 -mt-4 mb-6">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Proyecto:</span>
                    <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-primary text-[10px] font-bold rounded border border-blue-100 dark:border-blue-800">
                        ACT-{numAct}
                    </span>
                </div>
            )}

            <form suppressHydrationWarning className="card grid grid-cols-1 md:grid-cols-2 gap-3 border-none shadow-sm">
                <div className="md:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nombre de la Empresa</label>
                    <input
                        type="text"
                        maxLength={50}
                        className="input-field"
                        style={{ backgroundColor: '#66FF99' }}
                        value={formData.name || ""}
                        onChange={(e) => {
                            setFormData({ ...formData, name: e.target.value });
                            if (onDirty) onDirty();
                        }}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Representante</label>
                    <input
                        type="text"
                        maxLength={50}
                        className="input-field"
                        style={{ backgroundColor: '#66FF99' }}
                        value={formData.representative || ""}
                        onChange={(e) => {
                            setFormData({ ...formData, representative: e.target.value });
                            if (onDirty) onDirty();
                        }}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">SS Patronal</label>
                    <input
                        type="text"
                        className="input-field"
                        style={{ backgroundColor: '#66FF99' }}
                        placeholder="000-000-000"
                        value={formData.ss_patronal || ""}
                        onChange={(e) => {
                            setFormData({ ...formData, ss_patronal: e.target.value });
                            if (onDirty) onDirty();
                        }}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Teléfono Oficina</label>
                    <input
                        type="tel"
                        className="input-field"
                        style={{ backgroundColor: '#66FF99' }}
                        placeholder="(000) 000-0000"
                        value={formData.phone_office || ""}
                        onChange={(e) => {
                            setFormData({ ...formData, phone_office: formatPhoneNumber(e.target.value) });
                            if (onDirty) onDirty();
                        }}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Teléfono Celular</label>
                    <input
                        type="tel"
                        className="input-field"
                        style={{ backgroundColor: '#66FF99' }}
                        placeholder="(000) 000-0000"
                        value={formData.phone_mobile || ""}
                        onChange={(e) => {
                            setFormData({ ...formData, phone_mobile: formatPhoneNumber(e.target.value) });
                            if (onDirty) onDirty();
                        }}
                    />
                </div>
                <div className="md:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email</label>
                    <input
                        type="email"
                        className="input-field"
                        style={{ backgroundColor: '#66FF99' }}
                        value={formData.email || ""}
                        onChange={(e) => {
                            setFormData({ ...formData, email: e.target.value });
                            if (onDirty) onDirty();
                        }}
                    />
                </div>
            </form>
            <input id="import-contractor-json" type="file" accept=".json" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const result = await importSectionFromJSON(file);
                if (result.success && result.data && typeof result.data === 'object') {
                    const { id, project_id, created_at, ...rest } = result.data;
                    setFormData({ ...formData, ...rest });
                    if (onDirty) onDirty();
                    alert("Datos importados. Guarde para confirmar.");
                } else {
                    alert("Error al importar: " + (result.error || "Formato inválido"));
                }
                e.target.value = "";
            }} />
            <FloatingFormActions
                actions={[
                    {
                        label: "Exportar JSON", position: "middle-right" as const, size: "small" as const,
                        icon: <Download />,
                        onClick: () => exportSectionToJSON("contractor", formData),
                        description: "Exportar información del contratista a un archivo JSON",
                        variant: 'info' as const,
                        disabled: loading
                    },
                    {
                        label: "Importar JSON", position: "middle-right" as const, size: "small" as const,
                        icon: <Upload />,
                        onClick: () => document.getElementById('import-contractor-json')?.click(),
                        description: "Cargar información del contratista desde un archivo JSON",
                        variant: 'secondary' as const,
                        disabled: loading
                    }
                ]}
            />
        </div>
    );
});

export default ContractorForm;
