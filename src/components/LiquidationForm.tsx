"use client";

import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/lib/supabase";
import { Save, FileCheck2, UserCheck, Upload, FileText, Activity, CheckSquare, X, Printer, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { FormRef } from "./ProjectForm";
import { generateSignedItemsReportLogic } from "@/lib/reportLogic";

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
        federal_attachments: {},
        liquidated_items: []
    });
    const [isFocused, setIsFocused] = useState(false);
    const [showPartidas, setShowPartidas] = useState(false);
    const [contractItems, setContractItems] = useState<any[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        if (projectId) fetchLiquidation();
    }, [projectId]);

    const fetchLiquidation = async () => {
        if (!projectId) return;
        
        // Cargar datos de liquidación del proyecto
        const { data: projData } = await supabase.from("projects").select("liquidation_data").eq("id", projectId).single();
        
        // Cargar todas las partidas del proyecto para la lista
        const { data: itemsData } = await supabase.from("contract_items").select("*").eq("project_id", projectId).order("item_num", { ascending: true });
        
        if (itemsData) setContractItems(itemsData);

        if (projData && projData.liquidation_data) {
            setFormData({
                ...formData,
                ...projData.liquidation_data,
                federal_docs: projData.liquidation_data.federal_docs || [],
                federal_attachments: projData.liquidation_data.federal_attachments || {},
                liquidated_items: projData.liquidation_data.liquidated_items || []
            });
        }
    };

    const handleGenerateReport = async () => {
        if (!projectId) return;
        setIsGenerating(true);
        try {
            await generateSignedItemsReportLogic(projectId);
        } catch (err) {
            console.error("Error al generar reporte de partidas firmadas:", err);
            alert("Error al generar el reporte.");
        } finally {
            setIsGenerating(false);
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

    const toggleItemSignature = (itemNum: string, role: string) => {
        const liquidatedItems = [...(formData.liquidated_items || [])];
        const itemIdx = liquidatedItems.findIndex((it: any) => it.item_num === itemNum);
        
        if (itemIdx > -1) {
            const item = { ...liquidatedItems[itemIdx] };
            item[role] = !item[role];
            liquidatedItems[itemIdx] = item;
        } else {
            const newItem: any = { item_num: itemNum };
            newItem[role] = true;
            liquidatedItems.push(newItem);
        }
        
        // Recalcular conteos para el dashboard
        const adminCount = liquidatedItems.filter((it: any) => it.signed_by_admin).length;
        const contractorCount = liquidatedItems.filter((it: any) => it.signed_by_contractor).length;
        const liquidatorCount = liquidatedItems.filter((it: any) => it.signed_by_liquidator).length;

        setFormData({ 
            ...formData, 
            liquidated_items: liquidatedItems,
            admin_signed_count: adminCount,
            contractor_signed_count: contractorCount,
            liquidator_signed_count: liquidatorCount
        });
        if (onDirty) onDirty();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!projectId) return;
        await saveData(false);
    };

    return (
        <div className="w-full space-y-6">
            <div className="sticky top-0 z-40 bg-[#F8FAFC]/95 dark:bg-[#020617]/95 backdrop-blur-md pt-6 pb-4 -mx-4 px-4 md:-mx-8 md:px-8 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <FileCheck2 className="text-primary" />
                        13. Liquidación de Proyecto
                    </h2>
                    <button
                        onClick={() => setShowPartidas(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl border border-emerald-200 font-bold text-sm transition-all"
                    >
                        <CheckSquare size={18} />
                        Partidas Liquidadas
                    </button>
                    <button
                        onClick={handleGenerateReport}
                        disabled={isGenerating}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl border border-blue-200 font-bold text-sm transition-all disabled:opacity-50"
                    >
                        {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Printer size={18} />}
                        Reporte de Firmas
                    </button>
                </div>
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
                    <h3 className="font-bold text-slate-700 dark:text-slate-300 border-b pb-2 text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
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

                <div className="card space-y-2 border-none shadow-sm h-fit">
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
            
            {showPartidas && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                            <div>
                                <h3 className="text-xl font-black text-slate-800 dark:text-white">Partidas Liquidadas</h3>
                                <p className="text-xs text-slate-500 font-medium">Marque las firmas correspondientes para cada partida del contrato</p>
                            </div>
                            <button onClick={() => setShowPartidas(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400">
                                <X size={24} />
                            </button>
                        </div>
                        
                        <div className="flex-grow overflow-auto p-6 scrollbar-thin">
                            <table className="w-full border-separate border-spacing-y-2">
                                <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10">
                                    <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        <th className="px-4 py-3">Item #</th>
                                        <th className="px-4 py-3">Especificación</th>
                                        <th className="px-4 py-3">Descripción</th>
                                        <th className="px-4 py-3 text-center bg-blue-50/50 dark:bg-blue-900/20 rounded-t-xl">Admin</th>
                                        <th className="px-4 py-3 text-center bg-emerald-50/50 dark:bg-emerald-900/20 rounded-t-xl">Contratista</th>
                                        <th className="px-4 py-3 text-center bg-amber-50/50 dark:bg-amber-900/20 rounded-t-xl">Liquidador</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {contractItems.map((item) => {
                                        const liqInfo = formData.liquidated_items?.find((li: any) => li.item_num === item.item_num) || {};
                                        return (
                                            <tr key={item.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="px-4 py-3 text-sm font-black text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/30 rounded-l-xl border-y border-l border-slate-100 dark:border-slate-800">{item.item_num}</td>
                                                <td className="px-4 py-3 text-xs font-bold text-slate-500 border-y border-slate-100 dark:border-slate-800">{item.specification}</td>
                                                <td className="px-4 py-3 text-xs font-medium text-slate-600 dark:text-slate-400 max-w-xs truncate border-y border-slate-100 dark:border-slate-800" title={item.description}>{item.description}</td>
                                                
                                                <td className="px-4 py-3 text-center bg-blue-50/30 dark:bg-blue-900/10 border-y border-slate-100 dark:border-slate-800">
                                                    <input 
                                                        type="checkbox" 
                                                        className="w-4 h-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                                                        checked={liqInfo.signed_by_admin || false}
                                                        onChange={() => toggleItemSignature(item.item_num, 'signed_by_admin')}
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-center bg-emerald-50/30 dark:bg-emerald-900/10 border-y border-slate-100 dark:border-slate-800">
                                                    <input 
                                                        type="checkbox" 
                                                        className="w-4 h-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                                                        checked={liqInfo.signed_by_contractor || false}
                                                        onChange={() => toggleItemSignature(item.item_num, 'signed_by_contractor')}
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-center bg-amber-50/30 dark:bg-amber-900/10 border-y border-r border-slate-100 dark:border-slate-800 rounded-r-xl">
                                                    <input 
                                                        type="checkbox" 
                                                        className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                                                        checked={liqInfo.signed_by_liquidator || false}
                                                        onChange={() => toggleItemSignature(item.item_num, 'signed_by_liquidator')}
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        
                        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
                            <div className="flex gap-6">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Admin: {formData.admin_signed_count} / {contractItems.length}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Contratista: {formData.contractor_signed_count} / {contractItems.length}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Liquidador: {formData.liquidator_signed_count} / {contractItems.length}</span>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowPartidas(false)} 
                                className="btn-primary"
                            >
                                Listo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

export default LiquidationForm;
