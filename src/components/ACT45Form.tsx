"use client";

import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/lib/supabase";
import { 
    Save, FileText, Plus, Trash2, Download, 
    Upload, AlertCircle, Loader2, Printer,
    Cloud, Sun, CloudRain, Thermometer, 
    Users, Truck, ShieldCheck, ClipboardList,
    ChevronRight, ChevronLeft, Calendar,
    Wind, Droplets, X, Activity, Info
} from "lucide-react";
import FloatingFormActions from "./FloatingFormActions";
import type { FormRef } from "./ProjectForm";

interface PersonalRow {
    nombre: string;
    clasificacion: string;
    horas: number;
    observaciones: string;
}

interface EquipoRow {
    tipo: string;
    descripcion: string;
    horasActivas: number;
    horasInactivas: number;
}

interface ACT45Data {
    fecha: string;
    informeNum: string;
    climaAM: "Despejado" | "Nublado" | "Lluvia Menor" | "Lluvia Fuerte" | "";
    climaPM: "Despejado" | "Nublado" | "Lluvia Menor" | "Lluvia Fuerte" | "";
    tempMax: string;
    tempMin: string;
    suelo: "Seco" | "Húmedo" | "Fangoso" | "";
    diaLaborable: boolean;
    personal: PersonalRow[];
    equipo: EquipoRow[];
    materiales: string;
    notasIngenieria: string;
    comentariosSeguridad: string;
    inspectorNombre: string;
    revisorNombre: string;
    revisadoFecha: string;
}

const ACT45Form = forwardRef<FormRef, { projectId?: string, numAct?: string, onDirty?: () => void, onSaved?: () => void }>(function ACT45Form({ projectId, numAct, onDirty, onSaved }, ref) {
    const [activeTab, setActiveTab] = useState(0);
    const [loading, setLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    
    const [formData, setFormData] = useState<ACT45Data>({
        fecha: new Date().toISOString().split('T')[0],
        informeNum: "1",
        climaAM: "",
        climaPM: "",
        tempMax: "",
        tempMin: "",
        suelo: "",
        diaLaborable: true,
        personal: [],
        equipo: [],
        materiales: "",
        notasIngenieria: "",
        comentariosSeguridad: "",
        inspectorNombre: "",
        revisorNombre: "",
        revisadoFecha: ""
    });

    useEffect(() => {
        if (projectId) fetchACT45();
    }, [projectId]);

    const fetchACT45 = async () => {
        if (!projectId) return;
        
        const { data: projData } = await supabase.from("projects").select("act45_last_report").eq("id", projectId).single();
        
        if (projData && projData.act45_last_report) {
            setFormData({
                ...formData,
                ...projData.act45_last_report,
                fecha: new Date().toISOString().split('T')[0]
            });
        }
    };

    const saveData = async (silent = false) => {
        if (!projectId) return;
        setLoading(true);
        const { error } = await supabase.from("projects").update({
            act45_last_report: formData
        }).eq('id', projectId);
        setLoading(false);
        if (error && !silent) alert("Error: " + error.message);
        else if (!error) {
            if (!silent) alert("Datos del ACT-45 guardados correctamente.");
            if (onSaved) onSaved();
        }
    };

    useImperativeHandle(ref, () => ({ save: () => saveData(true) }));

    const addPersonalRow = () => {
        setFormData({
            ...formData,
            personal: [...formData.personal, { nombre: "", clasificacion: "", horas: 8, observaciones: "" }]
        });
        if (onDirty) onDirty();
    };

    const removePersonalRow = (index: number) => {
        const newPersonal = [...formData.personal];
        newPersonal.splice(index, 1);
        setFormData({ ...formData, personal: newPersonal });
        if (onDirty) onDirty();
    };

    const addEquipoRow = () => {
        setFormData({
            ...formData,
            equipo: [...formData.equipo, { tipo: "", descripcion: "", horasActivas: 8, horasInactivas: 0 }]
        });
        if (onDirty) onDirty();
    };

    const removeEquipoRow = (index: number) => {
        const newEquipo = [...formData.equipo];
        newEquipo.splice(index, 1);
        setFormData({ ...formData, equipo: newEquipo });
        if (onDirty) onDirty();
    };

    const handleGenerateReport = async () => {
        if (!projectId) return;
        setIsGenerating(true);
        try {
            // Placeholder for PDF generation logic
            alert("Lógica de generación en desarrollo. Los datos han sido guardados.");
            await saveData(true);
        } catch (err) {
            console.error("Error al generar reporte ACT-45:", err);
            alert("Error al generar el reporte.");
        } finally {
            setIsGenerating(false);
        }
    };

    const tabs = [
        { id: 'general', label: 'General & Clima', icon: <Calendar size={18} /> },
        { id: 'personal', label: 'Personal', icon: <Users size={18} /> },
        { id: 'equipo', label: 'Equipo', icon: <Truck size={18} /> },
        { id: 'notas', label: 'Notas & Firmas', icon: <ClipboardList size={18} /> }
    ];

    return (
        <div className="w-full space-y-6">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-[#F8FAFC]/95 dark:bg-[#020617]/95 backdrop-blur-md pt-6 pb-4 -mx-4 px-4 md:-mx-8 md:px-8 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-primary/10 rounded-2xl border border-primary/20">
                        <FileText className="text-primary" size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
                            ACT-45 Informe Diario
                        </h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Registro de actividades diarias de construcción</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleGenerateReport}
                        disabled={isGenerating}
                        className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white hover:bg-primary/90 rounded-2xl font-black text-xs transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
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
                
                {/* --- GENERAL & CLIMA --- */}
                {activeTab === 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="card space-y-5 border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:bg-slate-900/50 p-6 rounded-[32px] bg-white border border-slate-100">
                            <h3 className="font-black text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3 text-sm uppercase tracking-widest flex items-center gap-2">
                                <Calendar size={18} className="text-blue-600" />
                                Información del Informe
                            </h3>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha</label>
                                    <input
                                        type="date"
                                        className="input-field font-bold text-xs"
                                        value={formData.fecha}
                                        onChange={(e) => { setFormData({ ...formData, fecha: e.target.value }); onDirty?.(); }}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Informe No.</label>
                                    <input
                                        type="text"
                                        className="input-field font-bold text-xs"
                                        value={formData.informeNum}
                                        onChange={(e) => { setFormData({ ...formData, informeNum: e.target.value }); onDirty?.(); }}
                                        placeholder="Ej. 001"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800">
                                <div className="flex-1">
                                    <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">Día Laborable</p>
                                    <p className="text-[10px] font-medium text-slate-400">¿Se realizaron trabajos este día?</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only peer"
                                        checked={formData.diaLaborable}
                                        onChange={(e) => { setFormData({ ...formData, diaLaborable: e.target.checked }); onDirty?.(); }}
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                </label>
                            </div>
                        </div>

                        <div className="card space-y-5 border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:bg-slate-900/50 p-6 rounded-[32px] bg-white border border-slate-100">
                            <h3 className="font-black text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3 text-sm uppercase tracking-widest flex items-center gap-2">
                                <Cloud size={18} className="text-amber-500" />
                                Clima y Condiciones
                            </h3>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Mañana (A.M.)</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {["Despejado", "Nublado", "Lluvia Menor", "Lluvia Fuerte"].map((option) => (
                                            <button
                                                key={option}
                                                onClick={() => { setFormData({ ...formData, climaAM: option as any }); onDirty?.(); }}
                                                className={`px-2 py-2 rounded-xl text-[9px] font-black uppercase tracking-tighter border transition-all ${formData.climaAM === option 
                                                    ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                                                    : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-100 dark:border-slate-800'}`}
                                            >
                                                {option}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Tarde (P.M.)</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {["Despejado", "Nublado", "Lluvia Menor", "Lluvia Fuerte"].map((option) => (
                                            <button
                                                key={option}
                                                onClick={() => { setFormData({ ...formData, climaPM: option as any }); onDirty?.(); }}
                                                className={`px-2 py-2 rounded-xl text-[9px] font-black uppercase tracking-tighter border transition-all ${formData.climaPM === option 
                                                    ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                                                    : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-100 dark:border-slate-800'}`}
                                            >
                                                {option}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-2">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Temp. Máxima (°F)</label>
                                    <div className="relative">
                                        <Thermometer className="absolute left-3 top-2.5 text-red-500" size={14} />
                                        <input
                                            type="text"
                                            className="input-field pl-9 font-bold text-xs"
                                            value={formData.tempMax}
                                            onChange={(e) => { setFormData({ ...formData, tempMax: e.target.value }); onDirty?.(); }}
                                            placeholder="90"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Temp. Mínima (°F)</label>
                                    <div className="relative">
                                        <Thermometer className="absolute left-3 top-2.5 text-blue-500" size={14} />
                                        <input
                                            type="text"
                                            className="input-field pl-9 font-bold text-xs"
                                            value={formData.tempMin}
                                            onChange={(e) => { setFormData({ ...formData, tempMin: e.target.value }); onDirty?.(); }}
                                            placeholder="75"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3 pt-2">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Condiciones del Suelo</p>
                                <div className="flex gap-2">
                                    {["Seco", "Húmedo", "Fangoso"].map((s) => (
                                        <button
                                            key={s}
                                            onClick={() => { setFormData({ ...formData, suelo: s as any }); onDirty?.(); }}
                                            className={`flex-1 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${formData.suelo === s 
                                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-200' 
                                                : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-100 dark:border-slate-800'}`}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- PERSONAL --- */}
                {activeTab === 1 && (
                    <div className="card space-y-5 border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:bg-slate-900/50 p-6 rounded-[32px] bg-white border border-slate-100">
                        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                            <h3 className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-widest flex items-center gap-2">
                                <Users size={18} className="text-primary" />
                                Registro de Personal
                            </h3>
                            <button
                                onClick={addPersonalRow}
                                className="flex items-center gap-1.5 px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
                            >
                                <Plus size={14} />
                                AÑADIR PERSONAL
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full border-separate border-spacing-y-2">
                                <thead>
                                    <tr className="text-left text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 px-4">
                                        <th className="pb-2 pl-4">Nombre del Empleado</th>
                                        <th className="pb-2">Clasificación</th>
                                        <th className="pb-2 text-center">Horas</th>
                                        <th className="pb-2">Observaciones</th>
                                        <th className="pb-2 text-right pr-4"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {formData.personal.map((p, idx) => (
                                        <tr key={idx} className="group animate-in fade-in slide-in-from-left-2 duration-300">
                                            <td className="pl-4 py-2">
                                                <input
                                                    type="text"
                                                    className="input-field py-2 text-xs font-bold"
                                                    value={p.nombre}
                                                    onChange={(e) => {
                                                        const newP = [...formData.personal];
                                                        newP[idx].nombre = e.target.value;
                                                        setFormData({ ...formData, personal: newP });
                                                        onDirty?.();
                                                    }}
                                                    placeholder="Nombre completo"
                                                />
                                            </td>
                                            <td className="py-2">
                                                <input
                                                    type="text"
                                                    className="input-field py-2 text-xs font-bold"
                                                    value={p.clasificacion}
                                                    onChange={(e) => {
                                                        const newP = [...formData.personal];
                                                        newP[idx].clasificacion = e.target.value;
                                                        setFormData({ ...formData, personal: newP });
                                                        onDirty?.();
                                                    }}
                                                    placeholder="Ej. Operador A"
                                                />
                                            </td>
                                            <td className="py-2 w-24">
                                                <input
                                                    type="number"
                                                    className="input-field py-2 text-center font-bold text-xs"
                                                    value={p.horas}
                                                    onChange={(e) => {
                                                        const newP = [...formData.personal];
                                                        newP[idx].horas = parseFloat(e.target.value) || 0;
                                                        setFormData({ ...formData, personal: newP });
                                                        onDirty?.();
                                                    }}
                                                />
                                            </td>
                                            <td className="py-2">
                                                <input
                                                    type="text"
                                                    className="input-field py-2 text-xs font-bold"
                                                    value={p.observaciones}
                                                    onChange={(e) => {
                                                        const newP = [...formData.personal];
                                                        newP[idx].observaciones = e.target.value;
                                                        setFormData({ ...formData, personal: newP });
                                                        onDirty?.();
                                                    }}
                                                    placeholder="Opcional"
                                                />
                                            </td>
                                            <td className="pr-4 py-2 text-right">
                                                <button
                                                    onClick={() => removePersonalRow(idx)}
                                                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {formData.personal.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="py-12 text-center">
                                                <div className="flex flex-col items-center gap-3 opacity-20">
                                                    <Users size={48} />
                                                    <p className="text-xs font-black uppercase tracking-widest">No hay personal registrado</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* --- EQUIPO --- */}
                {activeTab === 2 && (
                    <div className="card space-y-5 border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:bg-slate-900/50 p-6 rounded-[32px] bg-white border border-slate-100">
                        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                            <h3 className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-widest flex items-center gap-2">
                                <Truck size={18} className="text-amber-600" />
                                Registro de Equipo & Maquinaria
                            </h3>
                            <button
                                onClick={addEquipoRow}
                                className="flex items-center gap-1.5 px-4 py-2 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border border-amber-100"
                            >
                                <Plus size={14} />
                                AÑADIR EQUIPO
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full border-separate border-spacing-y-2">
                                <thead>
                                    <tr className="text-left text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 px-4">
                                        <th className="pb-2 pl-4">Tipo de Equipo</th>
                                        <th className="pb-2">Descripción / ID</th>
                                        <th className="pb-2 text-center">H. Activas</th>
                                        <th className="pb-2 text-center">H. Inactivas</th>
                                        <th className="pb-2 text-right pr-4"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {formData.equipo.map((e, idx) => (
                                        <tr key={idx} className="group animate-in fade-in slide-in-from-left-2 duration-300">
                                            <td className="pl-4 py-2">
                                                <input
                                                    type="text"
                                                    className="input-field py-2 text-xs font-bold"
                                                    value={e.tipo}
                                                    onChange={(val) => {
                                                        const newE = [...formData.equipo];
                                                        newE[idx].tipo = val.target.value;
                                                        setFormData({ ...formData, equipo: newE });
                                                        onDirty?.();
                                                    }}
                                                    placeholder="Ej. Excavadora"
                                                />
                                            </td>
                                            <td className="py-2">
                                                <input
                                                    type="text"
                                                    className="input-field py-2 text-xs font-bold"
                                                    value={e.descripcion}
                                                    onChange={(val) => {
                                                        const newE = [...formData.equipo];
                                                        newE[idx].descripcion = val.target.value;
                                                        setFormData({ ...formData, equipo: newE });
                                                        onDirty?.();
                                                    }}
                                                    placeholder="Ej. CAT 320 GC"
                                                />
                                            </td>
                                            <td className="py-2 w-24">
                                                <input
                                                    type="number"
                                                    className="input-field py-2 text-center font-bold text-xs"
                                                    value={e.horasActivas}
                                                    onChange={(val) => {
                                                        const newE = [...formData.equipo];
                                                        newE[idx].horasActivas = parseFloat(val.target.value) || 0;
                                                        setFormData({ ...formData, equipo: newE });
                                                        onDirty?.();
                                                    }}
                                                />
                                            </td>
                                            <td className="py-2 w-24">
                                                <input
                                                    type="number"
                                                    className="input-field py-2 text-center font-bold text-xs"
                                                    value={e.horasInactivas}
                                                    onChange={(val) => {
                                                        const newE = [...formData.equipo];
                                                        newE[idx].horasInactivas = parseFloat(val.target.value) || 0;
                                                        setFormData({ ...formData, equipo: newE });
                                                        onDirty?.();
                                                    }}
                                                />
                                            </td>
                                            <td className="pr-4 py-2 text-right">
                                                <button
                                                    onClick={() => removeEquipoRow(idx)}
                                                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {formData.equipo.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="py-12 text-center">
                                                <div className="flex flex-col items-center gap-3 opacity-20">
                                                    <Truck size={48} />
                                                    <p className="text-xs font-black uppercase tracking-widest">No hay equipo registrado</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* --- NOTAS & FIRMAS --- */}
                {activeTab === 3 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <div className="card space-y-5 border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:bg-slate-900/50 p-6 rounded-[32px] bg-white border border-slate-100">
                                <h3 className="font-black text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3 text-sm uppercase tracking-widest flex items-center gap-2">
                                    <ShieldCheck size={18} className="text-emerald-500" />
                                    Materiales y Seguridad
                                </h3>
                                
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Materiales Incorporados / Removidos</label>
                                    <textarea
                                        className="input-field font-medium text-xs min-h-[100px] resize-none py-3"
                                        value={formData.materiales}
                                        onChange={(e) => { setFormData({ ...formData, materiales: e.target.value }); onDirty?.(); }}
                                        placeholder="Liste materiales, piezas o equipos..."
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Comentarios de Seguridad</label>
                                    <textarea
                                        className="input-field font-medium text-xs min-h-[100px] resize-none py-3"
                                        value={formData.comentariosSeguridad}
                                        onChange={(e) => { setFormData({ ...formData, comentariosSeguridad: e.target.value }); onDirty?.(); }}
                                        placeholder="Anote cualquier observación sobre seguridad..."
                                    />
                                </div>
                            </div>

                            <div className="card space-y-5 border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:bg-slate-900/50 p-6 rounded-[32px] bg-white border border-slate-100">
                                <h3 className="font-black text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3 text-sm uppercase tracking-widest flex items-center gap-2">
                                    <ClipboardList size={18} className="text-blue-500" />
                                    Ingeniería & Cómputos
                                </h3>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Dibujos, Cómputos y Referencias</label>
                                    <textarea
                                        className="input-field font-medium text-xs min-h-[150px] resize-none py-3"
                                        value={formData.notasIngenieria}
                                        onChange={(e) => { setFormData({ ...formData, notasIngenieria: e.target.value }); onDirty?.(); }}
                                        placeholder="Descripción detallada de partidas ejecutadas..."
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="card space-y-5 border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:bg-slate-900/50 p-6 rounded-[32px] bg-white border border-slate-100 h-fit">
                                <h3 className="font-black text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3 text-sm uppercase tracking-widest flex items-center gap-2">
                                    <FileText size={18} className="text-primary" />
                                    Firmas y Validación
                                </h3>
                                
                                <div className="space-y-4">
                                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-700">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Inspector</label>
                                        <input
                                            type="text"
                                            className="input-field font-black text-xs border-none bg-white/50 dark:bg-slate-900/50"
                                            value={formData.inspectorNombre}
                                            onChange={(e) => { setFormData({ ...formData, inspectorNombre: e.target.value }); onDirty?.(); }}
                                            placeholder="Nombre del Inspector"
                                        />
                                    </div>

                                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-700">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Revisor</label>
                                        <div className="space-y-3">
                                            <input
                                                type="text"
                                                className="input-field font-black text-xs border-none bg-white/50 dark:bg-slate-900/50"
                                                value={formData.revisorNombre}
                                                onChange={(e) => { setFormData({ ...formData, revisorNombre: e.target.value }); onDirty?.(); }}
                                                placeholder="Nombre del Revisor"
                                            />
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha de Revisión</label>
                                                <input
                                                    type="date"
                                                    className="input-field font-bold text-[10px] border-none bg-white/50 dark:bg-slate-900/50"
                                                    value={formData.revisadoFecha}
                                                    onChange={(e) => { setFormData({ ...formData, revisadoFecha: e.target.value }); onDirty?.(); }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 p-6 bg-primary/5 rounded-[32px] border border-primary/10">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-primary/20 rounded-xl">
                                            <Info size={16} className="text-primary" />
                                        </div>
                                        <p className="text-[11px] font-black text-primary uppercase tracking-widest">Información</p>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-500 leading-relaxed italic">
                                        Al generar el reporte, se incluirán automáticamente los datos del proyecto (Nombre, Número de Contrato, Municipio, etc.) recuperados de la base de datos de PACT.
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
                        label: activeTab < 3 ? "Siguiente" : "Guardar",
                        icon: activeTab < 3 ? <ChevronRight /> : <Save />,
                        onClick: () => activeTab < 3 ? setActiveTab(activeTab + 1) : saveData(false),
                        variant: activeTab < 3 ? 'secondary' : 'primary',
                        description: activeTab < 3 ? "Ir a la siguiente sección" : "Guardar todos los cambios del informe"
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

export default ACT45Form;
