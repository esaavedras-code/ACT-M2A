"use client";

import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/lib/supabase";
import { 
    Save, FileText, Plus, Trash2, Download, 
    Upload, AlertCircle, Loader2, Printer,
    ClipboardCheck, Search, ShieldAlert,
    ChevronRight, ChevronLeft, Calendar,
    CheckCircle2, XCircle, MinusCircle,
    Info, UserCheck
} from "lucide-react";
import FloatingFormActions from "./FloatingFormActions";
import type { FormRef } from "./ProjectForm";

interface InspeccionRow {
    partida: string;
    descripcion: string;
    ubicacion: string;
    estatus: "Cumple" | "No Cumple" | "N/A" | "";
    comentarios: string;
}

interface ACT96Data {
    fecha: string;
    proyectoNum: string;
    municipio: string;
    inspectorNombre: string;
    contratistaNombre: string;
    observacionesGenerales: string;
    accionesCorrectivas: string;
    fechaLimiteCorreccion: string;
    inspeccionItems: InspeccionRow[];
    firmaInspector: boolean;
    firmaContratista: boolean;
}

const ACT96Form = forwardRef<FormRef, { projectId?: string, numAct?: string, onDirty?: () => void, onSaved?: () => void }>(function ACT96Form({ projectId, numAct, onDirty, onSaved }, ref) {
    const [activeTab, setActiveTab] = useState(0);
    const [loading, setLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    
    const [formData, setFormData] = useState<ACT96Data>({
        fecha: new Date().toISOString().split('T')[0],
        proyectoNum: numAct || "",
        municipio: "",
        inspectorNombre: "",
        contratistaNombre: "",
        observacionesGenerales: "",
        accionesCorrectivas: "",
        fechaLimiteCorreccion: "",
        inspeccionItems: [],
        firmaInspector: false,
        firmaContratista: false
    });

    useEffect(() => {
        if (projectId) fetchACT96();
    }, [projectId]);

    const fetchACT96 = async () => {
        if (!projectId) return;
        const { data: projData } = await supabase.from("projects").select("act96_last_report, name, municipality").eq("id", projectId).single();
        
        if (projData) {
            setFormData(prev => ({
                ...prev,
                ...(projData.act96_last_report || {}),
                fecha: new Date().toISOString().split('T')[0],
                municipio: projData.municipality || prev.municipio
            }));
        }
    };

    const saveData = async (silent = false) => {
        if (!projectId) return;
        setLoading(true);
        const { error } = await supabase.from("projects").update({
            act96_last_report: formData
        }).eq('id', projectId);
        setLoading(false);
        if (error && !silent) alert("Error: " + error.message);
        else if (!error) {
            if (!silent) alert("Informe de Inspección ACT-96 guardado correctamente.");
            if (onSaved) onSaved();
        }
    };

    useImperativeHandle(ref, () => ({ save: () => saveData(true) }));

    const addItemRow = () => {
        setFormData({
            ...formData,
            inspeccionItems: [...formData.inspeccionItems, { partida: "", descripcion: "", ubicacion: "", estatus: "", comentarios: "" }]
        });
        if (onDirty) onDirty();
    };

    const removeItemRow = (index: number) => {
        const newItems = [...formData.inspeccionItems];
        newItems.splice(index, 1);
        setFormData({ ...formData, inspeccionItems: newItems });
        if (onDirty) onDirty();
    };

    const handleGenerateReport = async () => {
        if (!projectId) return;
        setIsGenerating(true);
        try {
            alert("Lógica de generación de PDF para ACT-96 en desarrollo. Los datos han sido guardados.");
            await saveData(true);
        } catch (err) {
            console.error("Error al generar reporte ACT-96:", err);
            alert("Error al generar el reporte.");
        } finally {
            setIsGenerating(false);
        }
    };

    const tabs = [
        { id: 'general', label: 'Info General', icon: <Calendar size={18} /> },
        { id: 'inspeccion', label: 'Items Inspeccionados', icon: <ClipboardCheck size={18} /> },
        { id: 'conclusiones', label: 'Conclusiones & Firmas', icon: <ShieldAlert size={18} /> }
    ];

    return (
        <div className="w-full space-y-6">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-[#F8FAFC]/95 dark:bg-[#020617]/95 backdrop-blur-md pt-6 pb-4 -mx-4 px-4 md:-mx-8 md:px-8 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                        <ClipboardCheck className="text-emerald-600" size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
                            ACT-96 Informe de Inspección
                        </h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Registro de cumplimiento y calidad de obra</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleGenerateReport}
                        disabled={isGenerating}
                        className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-2xl font-black text-xs transition-all shadow-lg shadow-emerald-200 disabled:opacity-50"
                    >
                        {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                        GENERAR REPORTE
                    </button>
                </div>
            </div>

            {/* Tabs Navigation */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                {tabs.map((tab, idx) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(idx)}
                        className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-xs transition-all border shrink-0 ${activeTab === idx 
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xl dark:bg-white dark:text-slate-950 dark:border-white' 
                            : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200 dark:bg-slate-900 dark:border-slate-800'}`}
                    >
                        {tab.icon}
                        <span className="uppercase tracking-widest">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="min-h-[500px] animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
                
                {/* --- GENERAL --- */}
                {activeTab === 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="card space-y-5 border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:bg-slate-900/50 p-6 rounded-[32px] bg-white border border-slate-100">
                            <h3 className="font-black text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3 text-sm uppercase tracking-widest flex items-center gap-2">
                                <Calendar size={18} className="text-blue-600" />
                                Datos del Proyecto
                            </h3>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha de Inspección</label>
                                    <input
                                        type="date"
                                        className="input-field font-bold text-xs"
                                        value={formData.fecha}
                                        onChange={(e) => { setFormData({ ...formData, fecha: e.target.value }); onDirty?.(); }}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Proyecto No.</label>
                                    <input
                                        type="text"
                                        className="input-field font-bold text-xs bg-slate-50"
                                        value={formData.proyectoNum}
                                        readOnly
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Municipio / Ubicación</label>
                                <input
                                    type="text"
                                    className="input-field font-bold text-xs"
                                    value={formData.municipio}
                                    onChange={(e) => { setFormData({ ...formData, municipio: e.target.value }); onDirty?.(); }}
                                    placeholder="Ej. San Juan, PR"
                                />
                            </div>
                        </div>

                        <div className="card space-y-5 border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:bg-slate-900/50 p-6 rounded-[32px] bg-white border border-slate-100">
                            <h3 className="font-black text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3 text-sm uppercase tracking-widest flex items-center gap-2">
                                <UserCheck size={18} className="text-emerald-500" />
                                Responsables
                            </h3>

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Inspector Autorizado</label>
                                    <input
                                        type="text"
                                        className="input-field font-bold text-xs"
                                        value={formData.inspectorNombre}
                                        onChange={(e) => { setFormData({ ...formData, inspectorNombre: e.target.value }); onDirty?.(); }}
                                        placeholder="Nombre del Inspector"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Representante Contratista</label>
                                    <input
                                        type="text"
                                        className="input-field font-bold text-xs"
                                        value={formData.contratistaNombre}
                                        onChange={(e) => { setFormData({ ...formData, contratistaNombre: e.target.value }); onDirty?.(); }}
                                        placeholder="Nombre del Representante"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- INSPECCION --- */}
                {activeTab === 1 && (
                    <div className="card space-y-5 border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:bg-slate-900/50 p-6 rounded-[32px] bg-white border border-slate-100">
                        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                            <h3 className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-widest flex items-center gap-2">
                                <Search size={18} className="text-primary" />
                                Partidas Inspeccionadas
                            </h3>
                            <button
                                onClick={addItemRow}
                                className="flex items-center gap-1.5 px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
                            >
                                <Plus size={14} />
                                AÑADIR PARTIDA
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full border-separate border-spacing-y-2">
                                <thead>
                                    <tr className="text-left text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 px-4">
                                        <th className="pb-2 pl-4">Partida #</th>
                                        <th className="pb-2">Descripción / Actividad</th>
                                        <th className="pb-2">Ubicación Estación</th>
                                        <th className="pb-2 text-center">Cumplimiento</th>
                                        <th className="pb-2">Comentarios</th>
                                        <th className="pb-2 text-right pr-4"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {formData.inspeccionItems.map((item, idx) => (
                                        <tr key={idx} className="group animate-in fade-in slide-in-from-left-2 duration-300">
                                            <td className="pl-4 py-2 w-24">
                                                <input
                                                    type="text"
                                                    className="input-field py-2 text-xs font-bold"
                                                    value={item.partida}
                                                    onChange={(e) => {
                                                        const newI = [...formData.inspeccionItems];
                                                        newI[idx].partida = e.target.value;
                                                        setFormData({ ...formData, inspeccionItems: newI });
                                                        onDirty?.();
                                                    }}
                                                    placeholder="Ej. 101"
                                                />
                                            </td>
                                            <td className="py-2">
                                                <input
                                                    type="text"
                                                    className="input-field py-2 text-xs font-bold"
                                                    value={item.descripcion}
                                                    onChange={(e) => {
                                                        const newI = [...formData.inspeccionItems];
                                                        newI[idx].descripcion = e.target.value;
                                                        setFormData({ ...formData, inspeccionItems: newI });
                                                        onDirty?.();
                                                    }}
                                                    placeholder="Descripción de la partida"
                                                />
                                            </td>
                                            <td className="py-2 w-32">
                                                <input
                                                    type="text"
                                                    className="input-field py-2 text-xs font-bold"
                                                    value={item.ubicacion}
                                                    onChange={(e) => {
                                                        const newI = [...formData.inspeccionItems];
                                                        newI[idx].ubicacion = e.target.value;
                                                        setFormData({ ...formData, inspeccionItems: newI });
                                                        onDirty?.();
                                                    }}
                                                    placeholder="Est. 0+00"
                                                />
                                            </td>
                                            <td className="py-2 w-48">
                                                <div className="flex gap-1 justify-center">
                                                    {[
                                                        { val: "Cumple", icon: <CheckCircle2 size={12} />, color: "emerald" },
                                                        { val: "No Cumple", icon: <XCircle size={12} />, color: "red" },
                                                        { val: "N/A", icon: <MinusCircle size={12} />, color: "slate" }
                                                    ].map((opt) => (
                                                        <button
                                                            key={opt.val}
                                                            onClick={() => {
                                                                const newI = [...formData.inspeccionItems];
                                                                newI[idx].estatus = opt.val as any;
                                                                setFormData({ ...formData, inspeccionItems: newI });
                                                                onDirty?.();
                                                            }}
                                                            className={`p-1.5 rounded-lg border transition-all flex items-center gap-1 text-[8px] font-black uppercase ${item.estatus === opt.val 
                                                                ? `bg-${opt.color}-600 text-white border-${opt.color}-600` 
                                                                : 'bg-white dark:bg-slate-800 text-slate-400 border-slate-100'}`}
                                                            title={opt.val}
                                                        >
                                                            {opt.icon}
                                                        </button>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="py-2">
                                                <input
                                                    type="text"
                                                    className="input-field py-2 text-xs font-bold"
                                                    value={item.comentarios}
                                                    onChange={(e) => {
                                                        const newI = [...formData.inspeccionItems];
                                                        newI[idx].comentarios = e.target.value;
                                                        setFormData({ ...formData, inspeccionItems: newI });
                                                        onDirty?.();
                                                    }}
                                                    placeholder="Observaciones de campo"
                                                />
                                            </td>
                                            <td className="pr-4 py-2 text-right">
                                                <button
                                                    onClick={() => removeItemRow(idx)}
                                                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {formData.inspeccionItems.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="py-12 text-center">
                                                <div className="flex flex-col items-center gap-3 opacity-20">
                                                    <ClipboardCheck size={48} />
                                                    <p className="text-xs font-black uppercase tracking-widest">No hay ítems registrados</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* --- CONCLUSIONES --- */}
                {activeTab === 2 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <div className="card space-y-5 border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:bg-slate-900/50 p-6 rounded-[32px] bg-white border border-slate-100">
                                <h3 className="font-black text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3 text-sm uppercase tracking-widest flex items-center gap-2">
                                    <Info size={18} className="text-blue-500" />
                                    Observaciones Generales
                                </h3>
                                
                                <div className="space-y-1.5">
                                    <textarea
                                        className="input-field font-medium text-xs min-h-[150px] resize-none py-3"
                                        value={formData.observacionesGenerales}
                                        onChange={(e) => { setFormData({ ...formData, observacionesGenerales: e.target.value }); onDirty?.(); }}
                                        placeholder="Escriba aquí un resumen general de la inspección..."
                                    />
                                </div>
                            </div>

                            <div className="card space-y-5 border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:bg-slate-900/50 p-6 rounded-[32px] bg-white border border-slate-100">
                                <h3 className="font-black text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3 text-sm uppercase tracking-widest flex items-center gap-2">
                                    <ShieldAlert size={18} className="text-red-500" />
                                    Acciones Correctivas
                                </h3>
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descripción de Correcciones</label>
                                        <textarea
                                            className="input-field font-medium text-xs min-h-[100px] resize-none py-3 border-red-100"
                                            value={formData.accionesCorrectivas}
                                            onChange={(e) => { setFormData({ ...formData, accionesCorrectivas: e.target.value }); onDirty?.(); }}
                                            placeholder="Detalle los trabajos que requieren corrección..."
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha Límite para Corregir</label>
                                        <input
                                            type="date"
                                            className="input-field font-bold text-xs"
                                            value={formData.fechaLimiteCorreccion}
                                            onChange={(e) => { setFormData({ ...formData, fechaLimiteCorreccion: e.target.value }); onDirty?.(); }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="card space-y-5 border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:bg-slate-900/50 p-6 rounded-[32px] bg-white border border-slate-100 h-fit">
                                <h3 className="font-black text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3 text-sm uppercase tracking-widest flex items-center gap-2">
                                    <FileText size={18} className="text-primary" />
                                    Validación de Firmas
                                </h3>
                                
                                <div className="space-y-4">
                                    <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100">
                                        <div className="flex-1">
                                            <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">Firma del Inspector</p>
                                            <p className="text-[10px] font-medium text-slate-400">¿Validado por el inspector?</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                className="sr-only peer"
                                                checked={formData.firmaInspector}
                                                onChange={(e) => { setFormData({ ...formData, firmaInspector: e.target.checked }); onDirty?.(); }}
                                            />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                        </label>
                                    </div>

                                    <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100">
                                        <div className="flex-1">
                                            <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">Firma del Contratista</p>
                                            <p className="text-[10px] font-medium text-slate-400">¿Validado por el contratista?</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                className="sr-only peer"
                                                checked={formData.firmaContratista}
                                                onChange={(e) => { setFormData({ ...formData, firmaContratista: e.target.checked }); onDirty?.(); }}
                                            />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                        </label>
                                    </div>
                                </div>

                                <div className="mt-8 p-6 bg-emerald-50 dark:bg-emerald-900/10 rounded-[32px] border border-emerald-100">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
                                            <Info size={16} className="text-emerald-600" />
                                        </div>
                                        <p className="text-[11px] font-black text-emerald-600 uppercase tracking-widest">Aviso Legal</p>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-500 leading-relaxed italic">
                                        Este informe constituye un registro oficial de la inspección de campo. El cumplimiento de las acciones correctivas será verificado en la próxima inspección.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <FloatingFormActions
                actions={[
                    {
                        label: activeTab > 0 ? "Anterior" : "Atrás",
                        icon: <ChevronLeft />,
                        onClick: () => activeTab > 0 ? setActiveTab(activeTab - 1) : null,
                        variant: 'secondary' as const,
                        size: 'small' as const,
                        disabled: activeTab === 0
                    },
                    {
                        label: activeTab < 2 ? "Siguiente" : "Guardar",
                        icon: activeTab < 2 ? <ChevronRight /> : <Save />,
                        onClick: () => activeTab < 2 ? setActiveTab(activeTab + 1) : saveData(false),
                        variant: activeTab < 2 ? 'secondary' : 'primary',
                        description: activeTab < 2 ? "Ir a la siguiente sección" : "Guardar todos los cambios del informe de inspección"
                    }
                ]}
            />

            {/* About Section */}
            <div className="mt-12 py-8 border-t border-slate-100 dark:border-slate-800 text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">Diseñador</p>
                <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">Ing. Enrique Saavedra Sada, PE</p>
            </div>
        </div>
    );
});

export default ACT96Form;
