"use client";

import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/lib/supabase";
import { Save, FileCheck2, UserCheck, Upload, FileText, Activity } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { FormRef } from "./ProjectForm";

const FEDERAL_DOCS = [
    "Final Acceptance Checklist for Federal -Aid Projects",
    "Final Acceptance Report (FHWA)",
    "Material Certification (Original)",
    "Payroll Certification",
    "DBE Goals Certification",
    "Carta de aceptación del proyecto",
    "Informe de inspección Final de Proyecto",
    "Final Construction Report",
    "Final Estimate",
    "Substantial Completion Letter",
    "CCO's Summary Report",
    "Análisis de Tiempo",
    "Enviromental Review Certification"
];

const LiquidationForm = forwardRef<FormRef, { projectId?: string, numAct?: string, onDirty?: () => void, onSaved?: () => void }>(function LiquidationForm({ projectId, numAct, onDirty, onSaved }, ref) {
    const [formData, setFormData] = useState<any>({
        total_items_value: 0,
        signed_by_admin: false,
        signed_by_contractor: false,
        signed_by_liquidator: false,
        admin_signed_count: 0,
        contractor_signed_count: 0,
        liquidator_signed_count: 0,
        notes: "",
        federal_docs: [],
        federal_attachments: {}
    });
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
        if (projectId) fetchLiquidation();
    }, [projectId]);

    const fetchLiquidation = async () => {
        const { data } = await supabase.from("projects").select("liquidation_data").eq("id", projectId).single();
        if (data && data.liquidation_data) {
            setFormData({
                ...formData,
                ...data.liquidation_data,
                federal_docs: data.liquidation_data.federal_docs || [],
                federal_attachments: data.liquidation_data.federal_attachments || {}
            });
        }
    };

    const saveData = async (silent = false) => {
        if (!projectId) return;
        const { error } = await supabase.from("projects").update({
            liquidation_data: formData
        }).eq('id', projectId);
        if (error && !silent) alert("Error: " + error.message);
        else if (!error) {
            if (!silent) alert("Liquidación sincronizada");
            if (onSaved) onSaved();
        }
    };

    useImperativeHandle(ref, () => ({ save: () => saveData(true) }));

    const toggleDoc = (doc: string) => {
        const docs = [...(formData.federal_docs || [])];
        const idx = docs.indexOf(doc);
        if (idx > -1) docs.splice(idx, 1);
        else docs.push(doc);
        setFormData({ ...formData, federal_docs: docs });
        if (onDirty) onDirty();
    };

    const handleFileUpload = (doc: string, files: FileList | null) => {
        if (!files || files.length === 0) return;

        const currentAttachments = { ...(formData.federal_attachments || {}) };
        const docAttachments = [...(currentAttachments[doc] || [])];

        Array.from(files).forEach(file => {
            docAttachments.push({
                name: file.name,
                size: file.size,
                type: file.type,
                uploadedAt: new Date().toISOString()
            });
        });

        currentAttachments[doc] = docAttachments;
        setFormData({ ...formData, federal_attachments: currentAttachments });
        if (onDirty) onDirty();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!projectId) return;
        await saveData(false);
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <FileCheck2 className="text-primary" />
                    10. Liquidación
                </h2>
                <button
                    onClick={handleSubmit}
                    className="btn-primary flex items-center gap-2"
                >
                    <Save size={18} />
                    Guardar Liquidación
                </button>
            </div>

            {numAct && (
                <div className="flex items-center gap-2 -mt-4 mb-4">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Proyecto:</span>
                    <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-primary text-[10px] font-bold rounded border border-blue-100 dark:border-blue-800">
                        ACT-{numAct}
                    </span>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="card space-y-4 border-none shadow-sm h-fit">
                    <h3 className="font-bold text-slate-700 dark:text-slate-300 border-b pb-2 text-sm uppercase tracking-wider">Información General</h3>
                    <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-tighter">Total Partidas ($)</label>
                        <input
                            type={isFocused ? "number" : "text"}
                            step="0.01"
                            className="input-field font-black text-primary text-lg"
                            style={{ backgroundColor: '#66FF99' }}
                            value={isFocused ? (formData.total_items_value ?? "") : formatCurrency(formData.total_items_value)}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                            onChange={(e) => {
                                setFormData({ ...formData, total_items_value: e.target.value === "" ? 0 : parseFloat(e.target.value) });
                                if (onDirty) onDirty();
                            }}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-tighter">Notas de Liquidación</label>
                        <textarea
                            rows={4}
                            className="input-field text-sm"
                            style={{ backgroundColor: '#66FF99' }}
                            value={formData.notes}
                            onChange={(e) => {
                                setFormData({ ...formData, notes: e.target.value });
                                if (onDirty) onDirty();
                            }}
                        ></textarea>
                    </div>

                    <div className="pt-4">
                        <h3 className="font-bold text-slate-700 dark:text-slate-300 border-b pb-2 flex items-center gap-2 text-sm uppercase tracking-wider mb-4">
                            <UserCheck size={18} className="text-emerald-600" />
                            Firmas Requeridas
                        </h3>
                        <div className="space-y-2">
                            {[
                                { id: 'signed_by_admin', label: 'Administrador' },
                                { id: 'signed_by_contractor', label: 'Contratista' },
                                { id: 'signed_by_liquidator', label: 'Liquidador' }
                            ].map(f => (
                                <label key={f.id} className="flex items-center gap-3 cursor-pointer p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-emerald-200 transition-all">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                                        checked={formData[f.id]}
                                        onChange={(e) => {
                                            setFormData({ ...formData, [f.id]: e.target.checked });
                                            if (onDirty) onDirty();
                                        }}
                                    />
                                    <span className="text-slate-700 dark:text-slate-300 font-bold uppercase tracking-widest text-[10px]">{f.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
                        <h3 className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 text-sm uppercase tracking-wider mb-4">
                            <Activity size={18} className="text-blue-600" />
                            Conteo de Partidas Firmadas
                        </h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-tighter">Admin</label>
                                <input
                                    type="number"
                                    className="input-field text-center font-bold"
                                    style={{ backgroundColor: '#66FF99' }}
                                    value={formData.admin_signed_count || 0}
                                    onChange={(e) => {
                                        setFormData({ ...formData, admin_signed_count: parseInt(e.target.value) || 0 });
                                        if (onDirty) onDirty();
                                    }}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-tighter">Contratista</label>
                                <input
                                    type="number"
                                    className="input-field text-center font-bold"
                                    style={{ backgroundColor: '#66FF99' }}
                                    value={formData.contractor_signed_count || 0}
                                    onChange={(e) => {
                                        setFormData({ ...formData, contractor_signed_count: parseInt(e.target.value) || 0 });
                                        if (onDirty) onDirty();
                                    }}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-tighter">Liquidador</label>
                                <input
                                    type="number"
                                    className="input-field text-center font-bold"
                                    style={{ backgroundColor: '#66FF99' }}
                                    value={formData.liquidator_signed_count || 0}
                                    onChange={(e) => {
                                        setFormData({ ...formData, liquidator_signed_count: parseInt(e.target.value) || 0 });
                                        if (onDirty) onDirty();
                                    }}
                                />
                            </div>
                        </div>
                        <p className="text-[9px] text-slate-400 mt-2 italic">* Estos números alimentan el resumen de Liquidación en el Dashboard.</p>
                    </div>
                </div>

                <div className="card space-y-2 border-none shadow-sm">
                    <h3 className="font-bold text-slate-700 dark:text-slate-300 border-b pb-2 text-sm uppercase tracking-wider flex items-center justify-between">
                        <span>Documentos Cierre Federal</span>
                        <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            {formData.federal_docs?.length || 0} / {FEDERAL_DOCS.length}
                        </span>
                    </h3>
                    <div className="space-y-0.5 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        {FEDERAL_DOCS.map((doc, i) => {
                            const attachments = formData.federal_attachments?.[doc] || [];
                            const isChecked = formData.federal_docs?.includes(doc);

                            // Reportes que el sistema genera y no requieren subida manual
                            const noUploadDocs = [
                                "Final Acceptance Checklist for Federal -Aid Projects",
                                "Final Acceptance Report (FHWA)",
                                "Material Certification (Original)",
                                "Payroll Certification",
                                "Final Construction Report",
                                "Final Estimate",
                                "CCO's Summary Report",
                                "Análisis de Tiempo"
                            ];

                            return (
                                <div key={i} className={`flex items-center gap-2 p-1.5 rounded-lg border transition-all ${isChecked
                                    ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800'
                                    : 'bg-white border-slate-100 hover:border-slate-200 dark:bg-slate-900 dark:border-slate-800'
                                    }`}>
                                    <label className="flex items-start gap-2 cursor-pointer group flex-1">
                                        <input
                                            type="checkbox"
                                            className="mt-0.5 w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                            checked={isChecked}
                                            onChange={() => toggleDoc(doc)}
                                        />
                                        <span className={`text-[11px] font-medium leading-tight ${isChecked
                                            ? 'text-emerald-900 dark:text-emerald-300'
                                            : 'text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200'
                                            }`}>
                                            {doc}
                                        </span>
                                    </label>

                                    <div className="flex items-center gap-2 shrink-0">
                                        {attachments.length > 0 && (
                                            <span className="flex items-center gap-1 text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md">
                                                <FileText size={10} />
                                                {attachments.length}
                                            </span>
                                        )}

                                        {!noUploadDocs.includes(doc) && (
                                            <label className="cursor-pointer p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-primary group/upload" title="Subir documento">
                                                <input
                                                    type="file"
                                                    multiple
                                                    className="hidden"
                                                    onChange={(e) => handleFileUpload(doc, e.target.files)}
                                                />
                                                <Upload size={13} />
                                            </label>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
});

export default LiquidationForm;
