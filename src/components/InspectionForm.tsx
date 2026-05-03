"use client";

import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/lib/supabase";
import { 
    FileDigit, Camera, Files, ClipboardList, Package, Printer,
    ClipboardCheck, Save, Plus, Trash2, AlertCircle, Loader2,
    ChevronRight, ChevronLeft, Calendar, X
} from "lucide-react";
import FloatingFormActions from "./FloatingFormActions";
import type { FormRef } from "./ProjectForm";
import ACT96Form from "./ACT96Form";

const INSPECTION_ENTITIES = ["EPA", "ACT", "DNER", "OSHA", "Federal Hwy", "Otros"];

export default forwardRef<FormRef, { projectId?: string, onDirty?: () => void, onSaved?: () => void }>(
function InspectionForm({ projectId, onDirty, onSaved }, ref) {
    const [activeSubTab, setActiveSubTab] = useState("list");
    const [dailyLogs, setDailyLogs] = useState<any[]>([]);

    useEffect(() => {
        if (projectId) {
            fetchDailyLog();
            fetchDailyLogs();
        }
    }, [projectId, selectedDate]);

    const fetchDailyLogs = async () => {
        if (!projectId) return;
        const { data } = await supabase
            .from("daily_logs")
            .select("*")
            .eq("project_id", projectId)
            .order("log_date", { ascending: false });
        if (data) setDailyLogs(data);
    };

    const handleDeleteLog = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!window.confirm("¿Está seguro de que desea eliminar este informe? Esta acción no se puede deshacer.")) return;
        
        const { error } = await supabase.from("daily_logs").delete().eq("id", id);
        if (error) {
            alert("Error al eliminar el informe: " + error.message);
        } else {
            fetchDailyLogs();
        }
    };

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

    if (activeSubTab === "list") {
        const groupedLogs = dailyLogs.reduce((acc: any, log) => {
            const [y, m] = log.log_date.split('-');
            const monthName = new Date(parseInt(y), parseInt(m) - 1).toLocaleString('es-ES', { month: 'long', year: 'numeric' });
            const monthKey = monthName.charAt(0).toUpperCase() + monthName.slice(1);
            if (!acc[monthKey]) acc[monthKey] = [];
            acc[monthKey].push(log);
            return acc;
        }, {});

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
                        <button
                            onClick={() => setShowACT96Form(true)}
                            className="flex items-center justify-center gap-3 px-6 py-2.5 bg-blue-600 text-white hover:bg-blue-700 rounded-2xl font-black text-[10px] transition-all shadow-lg shadow-blue-200 uppercase tracking-widest"
                        >
                            <Plus size={16} />
                            Crear Nuevo Informe de Inspección ACT-96
                        </button>
                    </div>
                </div>

                <div className="space-y-10">
                    {Object.keys(groupedLogs).length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
                            <Files size={48} className="opacity-20" />
                            <p className="font-bold uppercase tracking-widest text-[10px]">No hay informes de inspección aún</p>
                        </div>
                    ) : (
                        Object.keys(groupedLogs).map(month => (
                            <div key={month} className="space-y-4">
                                <div className="flex items-center gap-3 px-2">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                        <ClipboardList size={16} className="text-emerald-600" />
                                    </div>
                                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{month}</h3>
                                    <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800 ml-2" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {groupedLogs[month].map((log: any) => (
                                        <div 
                                            key={log.id} 
                                            className="group card p-6 cursor-pointer border-l-8 border-emerald-500 hover:shadow-xl hover:scale-[1.02] transition-all relative overflow-hidden" 
                                            onClick={() => {
                                                setSelectedDate(log.log_date);
                                                setActiveSubTab("edit");
                                            }}
                                        >
                                            <div className="flex justify-between items-start relative z-10">
                                                <div>
                                                    <span className="text-[10px] font-black bg-emerald-500/10 text-emerald-600 px-3 py-1 rounded-full uppercase tracking-tighter">
                                                        {log.log_date.split('-').reverse().join('/')}
                                                    </span>
                                                    <h3 className="font-black text-slate-800 dark:text-white text-lg mt-3 line-clamp-1">
                                                        {log.inspector_name || "Informe de Inspección"}
                                                    </h3>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 line-clamp-1">{log.location || "Ubicación no especificada"}</p>
                                                    <div className="flex items-center gap-4 mt-4">
                                                        {log.inspections_data?.length > 0 && (
                                                            <div className="flex items-center gap-1.5">
                                                                <FileDigit size={12} className="text-blue-500" />
                                                                <span className="text-[10px] font-black text-blue-600 uppercase">
                                                                    {log.inspections_data.length} inspecciones
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-4">
                                                    <ChevronRight size={20} className="text-slate-300 group-hover:text-emerald-500 transition-colors" />
                                                    <button 
                                                        onClick={(e) => handleDeleteLog(log.id, e)}
                                                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                                        title="Eliminar Informe"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Modal ACT-96 */}
                {showACT96Form && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto">
                        <div className="bg-[#F8FAFC] dark:bg-[#020617] rounded-[48px] shadow-2xl w-full max-w-6xl my-8 relative animate-in zoom-in-95 duration-300 border border-white/20">
                            <button 
                                onClick={() => setShowACT96Form(false)}
                                className="absolute top-8 right-8 p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 z-[110]"
                            >
                                <X size={24} />
                            </button>
                            <div className="p-8 md:p-12 overflow-y-auto max-h-[80vh] custom-scrollbar">
                                <ACT96Form 
                                    projectId={projectId} 
                                    onSaved={() => {
                                        setShowACT96Form(false);
                                        fetchDailyLogs();
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="sticky top-0 z-40 bg-[#F8FAFC]/95 dark:bg-[#020617]/95 backdrop-blur-md pt-6 pb-4 -mx-4 px-4 md:-mx-8 md:px-8 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <button onClick={() => setActiveSubTab("list")} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                        <ChevronLeft size={20} />
                    </button>
                    <div>
                        <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Editar Inspección</h2>
                        <span className="text-[10px] font-black text-emerald-600 uppercase">{selectedDate.split('-').reverse().join('/')}</span>
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
                {/* Las secciones de Inspecciones, Seguridad y Accidentes han sido removidas por petición del usuario */}
                <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-4">
                    <ClipboardCheck size={64} className="opacity-10" />
                    <p className="text-center max-w-md text-sm font-medium">
                        Esta sección permite gestionar la información de inspección diaria. 
                        Para generar el reporte oficial, utilice el botón de <b>ACT-96</b>.
                    </p>
                    <button
                        onClick={() => setShowACT96Form(true)}
                        className="mt-4 flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                    >
                        ABRIR FORMULARIO ACT-96
                    </button>
                </div>
            </div>

            <FloatingFormActions 
                actions={[
                    {
                        label: "Imprimir",
                        icon: <Printer />,
                        onClick: () => window.print(),
                        description: `Imprimir informes de inspección del día ${selectedDate}`,
                        variant: 'secondary' as const,
                        size: 'small' as const
                    },
                    {
                        label: isSaving ? "Guardando..." : "Guardar Día",
                        icon: <Save />,
                        onClick: handleSave,
                        description: `Guardar cambios de inspección para el día ${selectedDate}`,
                        variant: 'primary',
                        disabled: isSaving || loading
                    },
                ]}
            />

            {/* --- Modal ACT-96 --- */}
            {showACT96Form && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-[#F8FAFC] dark:bg-[#020617] rounded-[48px] shadow-2xl w-full max-w-6xl my-8 relative animate-in zoom-in-95 duration-300 border border-white/20">
                        <button 
                            onClick={() => setShowACT96Form(false)}
                            className="absolute top-8 right-8 p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 z-[110]"
                        >
                            <X size={24} />
                        </button>
                        <div className="p-8 md:p-12 overflow-y-auto max-h-[80vh] custom-scrollbar">
                            <ACT96Form 
                                projectId={projectId} 
                                onSaved={() => {
                                    setShowACT96Form(false);
                                    fetchDailyLog();
                                    fetchDailyLogs();
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}
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
