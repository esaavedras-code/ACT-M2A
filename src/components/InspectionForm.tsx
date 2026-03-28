"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
    Save, Plus, Trash2, Users, Search,
    Clock, Shield, AlertTriangle, Trash, Info, ChevronLeft, ChevronRight, Printer
} from "lucide-react";
import { generateInspectionReport } from "@/lib/generateInspectionReport";
import { downloadBlob } from "@/lib/reportLogic";

const DELAY_TYPES = ["Condiciones existentes", "Material", "Falla en la especificación", "Decisión de ACT", "Calidad", "Evento de seguridad", "Clima"];

const INSPECTION_TABS = [
    { id: "inspecciones", label: "Inspecciones", icon: <Search size={18} /> },
    { id: "retrasos",      label: "Retrasos/Demoras",  icon: <Clock size={18} /> },
    { id: "seguridad",     label: "Seguridad",     icon: <Shield size={18} /> },
    { id: "accidentes",    label: "Accidentes",    icon: <AlertTriangle size={18} /> },
    { id: "desperdicios",  label: "Desperdicios",  icon: <Trash size={18} /> },
    { id: "visitantes",    label: "Visitantes",    icon: <Users size={18} /> },
];

export default function InspectionForm({ projectId, onSaved, onDirty }: { projectId?: string, onSaved?: () => void, onDirty?: () => void }) {
    const [selectedDate, setSelectedDate] = useState("");
    const [currentLog, setCurrentLog] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("inspecciones");

    useEffect(() => {
        if (!selectedDate) {
            setSelectedDate(new Date().toISOString().split("T")[0]);
        }
    }, []);

    useEffect(() => {
        if (projectId && selectedDate) {
            fetchLogByDate();
        }
    }, [projectId, selectedDate]);

    const fetchLogByDate = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("daily_logs")
            .select("*")
            .eq("project_id", projectId)
            .eq("log_date", selectedDate)
            .maybeSingle();
        
        if (data) {
            setCurrentLog(data);
        } else {
            // No log exists for this date, we'll create a skeleton
            setCurrentLog({
                project_id: projectId,
                log_date: selectedDate,
                inspections_data: [],
                delays_data: [],
                safety_violations_data: [],
                accidents_data: [],
                waste_data: [],
                visitors_v2_data: [],
            });
        }
        setLoading(false);
    };

    const handleUpdate = (field: string, value: any) => {
        setCurrentLog((prev: any) => ({ ...prev, [field]: value }));
        if (onDirty) onDirty();
    };

    const handleSave = async () => {
        if (!currentLog || !projectId) return;
        setLoading(true);
        try {
            const { id, created_at, updated_at, ...logData } = currentLog;
            if (id) {
                await supabase.from("daily_logs").update(logData).eq("id", id);
            } else {
                const { data } = await supabase.from("daily_logs").insert([logData]).select().single();
                setCurrentLog(data);
            }
            alert("Datos de inspección guardados");
            if (onSaved) onSaved();
        } catch (err) {
            console.error(err);
            alert("Error al guardar");
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = async () => {
        if (!currentLog?.id || !projectId) return;
        setLoading(true);
        try {
            const blob = await generateInspectionReport(projectId, currentLog.id);
            downloadBlob(blob, `Informe_Inspeccion_ACT96_${currentLog.log_date}.pdf`);
        } catch (err) {
            console.error(err);
            alert("Error al generar el PDF");
        } finally {
            setLoading(false);
        }
    };

    if (!currentLog && !loading) return <div className="p-8 text-center text-slate-400">Seleccione un proyecto y fecha.</div>;

    return (
        <div className="space-y-6">
            <div className="sticky top-0 z-40 bg-[#F8FAFC]/95 dark:bg-[#020617]/95 backdrop-blur-md pt-6 pb-4 -mx-4 px-4 md:-mx-8 md:px-8 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-emerald-100 text-emerald-600 rounded-2xl">
                        <Search size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Informe de Inspección</h2>
                        <div className="flex items-baseline gap-2">
                            <span className="text-[10px] font-black text-emerald-600 uppercase">Gestión de Campo</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {currentLog?.id && (
                        <button onClick={handlePrint} disabled={loading} className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 transition-all flex items-center gap-2 font-bold text-xs uppercase tracking-widest shadow-sm">
                            <Printer size={18} className="text-emerald-500" /> Imprimir (ACT-96)
                        </button>
                    )}
                    <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                        <input 
                            type="date" 
                            className="bg-transparent border-none text-xs font-bold focus:ring-0 p-1"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                        />
                    </div>
                    <button onClick={handleSave} disabled={loading} className="btn-primary flex items-center gap-2 text-xs py-2 px-4 shadow-emerald-200">
                        <Save size={16} /> {loading ? "..." : "Guardar Inspección"}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-1 space-y-2">
                    {INSPECTION_TABS.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${activeTab === tab.id ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-100'}`}
                        >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black ${activeTab === tab.id ? 'bg-white/20' : 'bg-slate-100 text-slate-300'}`}>{tab.icon}</div>
                            <span className="text-sm font-bold">{tab.label}</span>
                        </button>
                    ))}

                    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 mt-6">
                         <div className="flex items-start gap-3">
                            <Info size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                            <p className="text-[10px] text-emerald-700 font-medium leading-relaxed">
                                Esta sección complementa el Informe Diario (ACT-45). Los datos registrados aquí se vinculan a la misma fecha del proyecto.
                            </p>
                         </div>
                    </div>
                </div>

                <div className="lg:col-span-3 card p-8 rounded-[2rem] min-h-[500px] border-emerald-50 shadow-emerald-900/5">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full space-y-4">
                            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Cargando datos...</p>
                        </div>
                    ) : (
                        <InspectionTabContent 
                            id={activeTab} 
                            data={currentLog} 
                            update={handleUpdate} 
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

function InspectionTabContent({ id, data, update }: any) {
    if (!data) return null;
    switch (id) {
        case "inspecciones":
            return <SectionEditor items={data.inspections_data} setItems={(v: any) => update("inspections_data", v)} emptyItem={{ tipo: "", entidad: "", inicio: "", fin: "", comentarios: "" }} renderItem={(item: any, idx: number, updateItem: any) => (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-slate-400">Entidad de Inspección</label>
                            <input className="input-field" placeholder="Ej: EPA, ACT..." value={item.entidad} onChange={e => updateItem(idx, "entidad", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-slate-400">Tipo/Motivo</label>
                            <input className="input-field" placeholder="Ej: Ambiental, Calidad..." value={item.tipo} onChange={e => updateItem(idx, "tipo", e.target.value)} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-slate-400">Hora Inicio</label>
                            <input type="time" className="input-field" value={item.inicio} onChange={e => updateItem(idx, "inicio", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-slate-400">Hora Fin</label>
                            <input type="time" className="input-field" value={item.fin} onChange={e => updateItem(idx, "fin", e.target.value)} />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400">Comentarios de Inspección</label>
                        <textarea className="input-field" placeholder="Resultados, hallazgos..." value={item.comentarios} onChange={e => updateItem(idx, "comentarios", e.target.value)} />
                    </div>
                </div>
            )} />;
        case "retrasos":
            return <SectionEditor items={data.delays_data} setItems={(v: any) => update("delays_data", v)} emptyItem={{ tipo: DELAY_TYPES[0], inicio: "", fin: "", comentarios: "" }} renderItem={(item: any, idx: number, updateItem: any) => (
                <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1 col-span-1">
                            <label className="text-[9px] font-black uppercase text-slate-400">Causa del Retraso</label>
                            <select className="input-field" value={item.tipo} onChange={e => updateItem(idx, "tipo", e.target.value)}>
                                {DELAY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-slate-400">Inicio</label>
                            <input type="time" className="input-field" value={item.inicio} onChange={e => updateItem(idx, "inicio", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-slate-400">Fin</label>
                            <input type="time" className="input-field" value={item.fin} onChange={e => updateItem(idx, "fin", e.target.value)} />
                        </div>
                    </div>
                    <input className="input-field" placeholder="Breve explicación..." value={item.comentarios} onChange={e => updateItem(idx, "comentarios", e.target.value)} />
                </div>
            )} />;
        case "seguridad":
            return <SectionEditor items={data.safety_violations_data} setItems={(v: any) => update("safety_violations_data", v)} emptyItem={{ infracción: "", comentarios: "" }} renderItem={(item: any, idx: number, updateItem: any) => (
                <div className="space-y-3">
                    <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400">Tipo de Infracción / Hallazgo de Seguridad</label>
                        <input className="input-field" placeholder="Ej: Falta de EPP..." value={item.infracción} onChange={e => updateItem(idx, "infracción", e.target.value)} />
                    </div>
                    <textarea className="input-field" placeholder="Acciones correctivas tomadas..." value={item.comentarios} onChange={e => updateItem(idx, "comentarios", e.target.value)} />
                </div>
            )} />;
        case "accidentes":
            return <SectionEditor items={data.accidents_data} setItems={(v: any) => update("accidents_data", v)} emptyItem={{ partes: "", comentarios: "" }} renderItem={(item: any, idx: number, updateItem: any) => (
                <div className="space-y-3">
                    <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400">Partes Involucradas</label>
                        <input className="input-field" placeholder="..." value={item.partes} onChange={e => updateItem(idx, "partes", e.target.value)} />
                    </div>
                    <textarea className="input-field" placeholder="Descripción sucinta del evento..." value={item.comentarios} onChange={e => updateItem(idx, "comentarios", e.target.value)} />
                </div>
            )} />;
        case "desperdicios":
            return <SectionEditor items={data.waste_data} setItems={(v: any) => update("waste_data", v)} emptyItem={{ material: "", cantidad: "" }} renderItem={(item: any, idx: number, updateItem: any) => (
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400">Material Desperdiciado / Dañado</label>
                        <input className="input-field" placeholder="Ej: Tubería 12\" value={item.material} onChange={e => updateItem(idx, "material", e.target.value)} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400">Cantidad / Unidad</label>
                        <input className="input-field" placeholder="Ej: 2 tubos" value={item.cantidad} onChange={e => updateItem(idx, "cantidad", e.target.value)} />
                    </div>
                </div>
            )} />;
        case "visitantes":
            return <SectionEditor items={data.visitors_v2_data} setItems={(v: any) => update("visitors_v2_data", v)} emptyItem={{ visitante: "", horario: "" }} renderItem={(item: any, idx: number, updateItem: any) => (
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400">Nombre del Visitante / Representante</label>
                        <input className="input-field" placeholder="..." value={item.visitante} onChange={e => updateItem(idx, "visitante", e.target.value)} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400">Horario / Tiempo en Obra</label>
                        <input className="input-field" placeholder="Ej: 10:00 AM - 11:30 AM" value={item.horario} onChange={e => updateItem(idx, "horario", e.target.value)} />
                    </div>
                </div>
            )} />;
        default: return null;
    }
}

function SectionEditor({ items, setItems, emptyItem, renderItem }: any) {
    const handleAdd = () => setItems([...(items || []), { ...emptyItem }]);
    const handleUpdate = (idx: number, key: string, val: any) => {
        const newItems = [...(items || [])];
        newItems[idx] = { ...newItems[idx], [key]: val };
        setItems(newItems);
    };
    const handleRemove = (idx: number) => setItems((items || []).filter((_: any, i: number) => i !== idx));

    return (
        <div className="space-y-6">
            {(items || []).map((item: any, idx: number) => (
                <div key={idx} className="p-6 border border-slate-100 rounded-[1.5rem] relative bg-slate-50/30 hover:bg-slate-50 transition-colors shadow-sm">
                    <button onClick={() => handleRemove(idx)} className="absolute top-4 right-4 text-red-300 hover:text-red-500 transition-colors">
                        <Trash2 size={18} />
                    </button>
                    {renderItem(item, idx, handleUpdate)}
                </div>
            ))}
            <button onClick={handleAdd} className="w-full py-4 border-2 border-dashed border-emerald-100 rounded-2xl text-emerald-500 font-black text-xs uppercase tracking-widest hover:border-emerald-300 hover:bg-emerald-50 transition-all flex items-center justify-center gap-2">
                <Plus size={16} /> Añadir Registro
            </button>
        </div>
    );
}
