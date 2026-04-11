"use client";

import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/lib/supabase";
import { 
    ClipboardCheck, Save, FileCheck2, Trash2, 
    Plus, Loader2, Download, Upload, AlertCircle,
    FileDigit, Camera, Files, ClipboardList, Package
} from "lucide-react";
import FloatingFormActions from "./FloatingFormActions";
import { exportSectionToJSON, importSectionFromJSON } from "@/lib/sectionIO";
import type { FormRef } from "./ProjectForm";

const INSPECTION_ENTITIES = ["EPA", "ACT", "DNER", "OSHA", "Federal Hwy", "Otros"];

export default forwardRef<FormRef, { projectId?: string, onDirty?: () => void, onSaved?: () => void }>(
function InspectionForm({ projectId, onDirty, onSaved }, ref) {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [currentLog, setCurrentLog] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (projectId) fetchDailyLog();
    }, [projectId, selectedDate]);

    const fetchDailyLog = async () => {
        setLoading(true);
        const { data } = await supabase
            .from("daily_logs")
            .select("*")
            .eq("project_id", projectId)
            .eq("log_date", selectedDate)
            .single();
        
        if (data) {
            setCurrentLog({
                ...data,
                inspections_data: data.inspections_data || [],
                safety_violations_data: data.safety_violations_data || [],
                accidents_data: data.accidents_data || []
            });
        } else {
            setCurrentLog({
                project_id: projectId,
                log_date: selectedDate,
                inspections_data: [],
                safety_violations_data: [],
                accidents_data: []
            });
        }
        setLoading(false);
    };

    const handleSave = async () => {
        if (!projectId) return;
        setIsSaving(true);
        const { error } = await supabase
            .from("daily_logs")
            .upsert({
                project_id: projectId,
                log_date: selectedDate,
                inspections_data: currentLog.inspections_data,
                safety_violations_data: currentLog.safety_violations_data,
                accidents_data: currentLog.accidents_data,
                updated_at: new Date().toISOString()
            }, { onConflict: 'project_id,log_date' });

        if (error) {
            alert("Error al guardar inspecciones: " + error.message);
        } else {
            if (onSaved) onSaved();
            alert("Información de inspección guardada correctamente.");
        }
        setIsSaving(false);
    };

    const updateSection = (field: string, value: any) => {
        setCurrentLog((prev: any) => ({ ...prev, [field]: value }));
        if (onDirty) onDirty();
    };

    if (!currentLog && loading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 gap-4">
                <Loader2 className="animate-spin text-primary" size={40} />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cargando registros...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="sticky top-0 z-40 bg-[#F8FAFC]/95 dark:bg-[#020617]/95 backdrop-blur-md pt-6 pb-4 -mx-4 px-4 md:-mx-8 md:px-8 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-emerald-100 text-emerald-600 rounded-2xl">
                        <ClipboardCheck size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Informes de Inspección</h2>
                        <div className="flex items-baseline gap-2">
                            <span className="text-[10px] font-black text-emerald-600 uppercase">Gestión de Campo</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <Calendar className="text-slate-400" size={16} />
                        <input 
                            type="date" 
                            className="bg-transparent border-none text-xs font-bold focus:ring-0 p-0 text-slate-700 dark:text-slate-200"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
                {/* Inspecciones Recibidas */}
                <SectionEditor 
                    title="Inspecciones Recibidas (Externas/Internas)"
                    icon={<ClipboardList className="text-emerald-500" size={18} />}
                    items={currentLog?.inspections_data || []}
                    setItems={(val) => updateSection('inspections_data', val)}
                    emptyItem={{ entidad: "", tipo: "", inicio: "", fin: "", comentarios: "" }}
                    renderItem={(item, idx, updateItem) => (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase text-slate-400">Entidad de Inspección</label>
                                    <select 
                                        className="input-field" 
                                        value={item.entidad} 
                                        onChange={e => updateItem(idx, "entidad", e.target.value)}
                                    >
                                        <option value="">Seleccione...</option>
                                        {INSPECTION_ENTITIES.map(e => <option key={e} value={e}>{e}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase text-slate-400">Tipo/Motivo</label>
                                    <input 
                                        className="input-field" 
                                        placeholder="Ej: Ambiental, Calidad..." 
                                        value={item.tipo} 
                                        onChange={e => updateItem(idx, "tipo", e.target.value)} 
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black uppercase text-slate-400">Hora Inicio</label>
                                        <input type="time" className="input-field" value={item.inicio} onChange={e => updateItem(idx, "inicio", e.target.value)} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black uppercase text-slate-400">Hora Fin</label>
                                        <input type="time" className="input-field" value={item.fin} onChange={e => updateItem(idx, "fin", e.target.value)} />
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-1 flex flex-col h-full">
                                <label className="text-[9px] font-black uppercase text-slate-400">Hallazgos / Comentarios</label>
                                <textarea 
                                    className="input-field flex-grow resize-none" 
                                    placeholder="Resultados de la inspección..." 
                                    value={item.comentarios} 
                                    onChange={e => updateItem(idx, "comentarios", e.target.value)} 
                                />
                            </div>
                        </div>
                    )}
                />

                {/* Violaciones de Seguridad */}
                <SectionEditor 
                    title="Seguridad: Violaciones Detectadas"
                    icon={<AlertCircle className="text-rose-500" size={18} />}
                    items={currentLog?.safety_violations_data || []}
                    setItems={(val) => updateSection('safety_violations_data', val)}
                    emptyItem={{ descripcion: "", gravedad: "Leve", acciones: "" }}
                    renderItem={(item, idx, updateItem) => (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase text-slate-400">Gravedad</label>
                                    <select className="input-field" value={item.gravedad} onChange={e => updateItem(idx, "gravedad", e.target.value)}>
                                        <option value="Leve">Leve</option>
                                        <option value="Moderada">Moderada</option>
                                        <option value="Crítica">Crítica</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase text-slate-400">Descripción de la Violación</label>
                                    <textarea className="input-field h-24 resize-none" value={item.descripcion} onChange={e => updateItem(idx, "descripcion", e.target.value)} />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase text-slate-400">Acciones Tomadas / Requeridas</label>
                                <textarea className="input-field h-40 resize-none" value={item.acciones} onChange={e => updateItem(idx, "acciones", e.target.value)} />
                            </div>
                        </div>
                    )}
                />

                {/* Accidentes */}
                <SectionEditor 
                    title="Reporte de Accidentes / Incidentes"
                    icon={<AlertCircle className="text-red-600" size={18} />}
                    items={currentLog?.accidents_data || []}
                    setItems={(val) => updateSection('accidents_data', val)}
                    emptyItem={{ tipo: "Personal", lesionados: "0", daños: "", resumen: "" }}
                    renderItem={(item, idx, updateItem) => (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black uppercase text-slate-400">Tipo</label>
                                        <select className="input-field" value={item.tipo} onChange={e => updateItem(idx, "tipo", e.target.value)}>
                                            <option value="Personal">Personal</option>
                                            <option value="Equipo/Vehículo">Equipo/Vehículo</option>
                                            <option value="Ambiental">Ambiental</option>
                                            <option value="Otro">Otro</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black uppercase text-slate-400">Lesionados</label>
                                        <input type="number" className="input-field" value={item.lesionados} onChange={e => updateItem(idx, "lesionados", e.target.value)} />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase text-slate-400">Daños Materiales Estimados</label>
                                    <input className="input-field" value={item.daños} onChange={e => updateItem(idx, "daños", e.target.value)} />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase text-slate-400">Resumen del Evento</label>
                                <textarea className="input-field h-32 resize-none" value={item.resumen} onChange={e => updateItem(idx, "resumen", e.target.value)} />
                            </div>
                        </div>
                    )}
                />
            </div>

            <FloatingFormActions 
                actions={[
                    {
                        label: isSaving ? "Guardando..." : "Guardar Día",
                        icon: <Save />,
                        onClick: handleSave,
                        description: `Guardar cambios de inspección para el día ${selectedDate}`,
                        variant: 'primary',
                        disabled: isSaving || loading
                    },
                    {
                        label: "Refrescar",
                        icon: <Loader2 className={loading ? "animate-spin" : ""} />,
                        onClick: fetchDailyLog,
                        description: "Recargar datos desde la base de datos",
                        variant: 'secondary',
                        disabled: loading
                    }
                ]}
            />
        </div>
    );
});

function SectionEditor({ title, icon, items, setItems, emptyItem, renderItem }: { 
    title: string, 
    icon: React.ReactNode, 
    items: any[], 
    setItems: (val: any[]) => void, 
    emptyItem: any, 
    renderItem: (item: any, idx: number, update: any) => React.ReactNode 
}) {
    const addItem = () => setItems([...items, { ...emptyItem }]);
    const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
    const updateItem = (idx: number, field: string, value: any) => {
        const newItems = [...items];
        newItems[idx] = { ...newItems[idx], [field]: value };
        setItems(newItems);
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-8 py-5 border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {icon}
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">{title}</h3>
                </div>
                <button 
                    onClick={addItem}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-[10px] font-black uppercase hover:bg-blue-700 transition-all shadow-md shadow-primary/20 active:scale-95"
                >
                    <Plus size={14} /> Añadir Entrada
                </button>
            </div>
            <div className="p-8">
                {items.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl gap-4">
                        <Package className="text-slate-200 dark:text-slate-800" size={48} />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">No hay registros para esta sección</span>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {items.map((item, idx) => (
                            <div key={idx} className="relative group p-6 bg-slate-50/50 dark:bg-slate-800/20 rounded-3xl border border-slate-100 dark:border-slate-800 hover:border-primary/20 transition-all">
                                <button 
                                    onClick={() => removeItem(idx)}
                                    className="absolute -top-3 -right-3 w-8 h-8 bg-white dark:bg-slate-900 text-rose-500 rounded-full shadow-lg border border-slate-100 dark:border-slate-800 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-90"
                                >
                                    <Trash2 size={16} />
                                </button>
                                {renderItem(item, idx, updateItem)}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function Calendar({ className, size }: { className?: string, size?: number }) {
    return (
        <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width={size || 24} 
            height={size || 24} 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className={className}
        >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
    );
}
