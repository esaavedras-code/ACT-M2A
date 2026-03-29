"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
    Save, Plus, Trash2, Users, Search,
    Clock, Shield, AlertTriangle, Trash, Info, ChevronLeft, ChevronRight, Printer, Mic, Loader2
} from "lucide-react";
import FloatingFormActions from "./FloatingFormActions";
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
    const [contractItems, setContractItems] = useState<any[]>([]);

    useEffect(() => {
        if (projectId) {
            fetchContractItems();
        }
    }, [projectId]);

    const fetchContractItems = async () => {
        if (!projectId) return;
        const { data } = await supabase
            .from("contract_items")
            .select("id, item_num, description, unit")
            .eq("project_id", projectId)
            .order("item_num");
        if (data) setContractItems(data);
    };

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

    const handleGlobalAIResult = (aiResult: any) => {
        if (!currentLog) return;
        
        let newLog = { ...currentLog };
        let updated = false;

        // 1. Inspecciones
        if (aiResult.inspecciones && Array.isArray(aiResult.inspecciones)) {
            newLog.inspections_data = [...(newLog.inspections_data || []), ...aiResult.inspecciones];
            updated = true;
        }

        // 2. Retrasos
        if (aiResult.retrasos && Array.isArray(aiResult.retrasos)) {
            newLog.delays_data = [...(newLog.delays_data || []), ...aiResult.retrasos];
            updated = true;
        }

        // 3. Seguridad e Incidentes
        if (aiResult.seguridad?.texto) {
            newLog.safety_violations_data = [
                ...(newLog.safety_violations_data || []), 
                { infracción: aiResult.seguridad.texto, comentarios: "Reportado por IA" }
            ];
            updated = true;
        }

        // 4. Accidentes
        if (aiResult.accidentes && Array.isArray(aiResult.accidentes)) {
            newLog.accidents_data = [...(newLog.accidents_data || []), ...aiResult.accidentes];
            updated = true;
        }

        // 5. Desperdicios
        if (aiResult.desperdicios && Array.isArray(aiResult.desperdicios)) {
            newLog.waste_data = [...(newLog.waste_data || []), ...aiResult.desperdicios];
            updated = true;
        }

        // 6. Visitantes
        if (aiResult.visitantes && Array.isArray(aiResult.visitantes)) {
            newLog.visitors_v2_data = [...(newLog.visitors_v2_data || []), ...aiResult.visitantes];
            updated = true;
        }

        // 7. Partidas y Notas (Si el usuario los dicta aquí, también los guardamos si el log los soporta)
        if (aiResult.partidas_trabajadas && Array.isArray(aiResult.partidas_trabajadas)) {
             const newEntries = aiResult.partidas_trabajadas.map((p: any) => {
                const match = contractItems.find((ci: any) => String(ci.id) === String(p.item_id));
                return {
                    item_id: match?.id || "",
                    item_num: match?.item_num || "",
                    description: match?.description || p.notes || "Buscado por IA",
                    qty_worked: p.qty_worked || "",
                    notes: p.notes || ""
                };
            });
            newLog.partidas_data = [...(newLog.partidas_data || []), ...newEntries];
            updated = true;
        }

        if (aiResult.notas?.texto) {
            const prev = newLog.remarks || "";
            newLog.remarks = prev + (prev ? "\n\n" : "") + aiResult.notas.texto;
            updated = true;
        }

        if (updated) {
            setCurrentLog(newLog);
            if (onDirty) onDirty();
            alert("El Asistente de Inspección ha procesado y categorizado su dictado correctamente.");
        }
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
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">11. Informes de Inspección</h2>
                        <div className="flex items-baseline gap-2">
                            <span className="text-[10px] font-black text-emerald-600 uppercase">Gestión de Campo</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {/* Los botones ahora son flotantes para mayor accesibilidad */}
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                        <input 
                            type="date" 
                            className="bg-transparent border-none text-xs font-bold focus:ring-0 p-1"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <FloatingFormActions
                actions={[
                    ...(currentLog?.id ? [{
                        label: "Imprimir (ACT-96)",
                        icon: <Printer />,
                        onClick: handlePrint,
                        description: "Generar el reporte oficial de inspección ACT-96 en PDF",
                        variant: 'secondary' as const,
                        disabled: loading
                    }] : []),
                    {
                        label: loading ? "Guardando..." : "Guardar cambios",
                        icon: <Save />,
                        onClick: () => handleSave(),
                        description: "Sincronizar todos los datos de inspección, seguridad y visitantes",
                        variant: 'primary' as const,
                        disabled: loading
                    }
                ]}
            />

            <div className="flex items-center gap-6 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 p-5 rounded-[2.5rem] shadow-xl border border-emerald-400/20 mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
                <SmartDictationButton 
                    context="global"
                    contractItems={contractItems}
                    onResult={handleGlobalAIResult}
                />
                <div className="text-white">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse shadow-[0_0_8px_#6ee7b7]"></div>
                        <h3 className="font-black text-sm uppercase tracking-wider text-emerald-50">Inteligencia Artificial de Inspección</h3>
                    </div>
                    <p className="text-xs text-emerald-100/90 font-medium leading-relaxed max-w-2xl">
                        Dicta inspecciones, motivos de retraso, visitantes o desperdicios de material. <br className="hidden md:block"/>
                        Ej: <span className="italic opacity-80 text-[11px]">"Llegó el inspector de EPA a las 10:00 para revisión ambiental. Hubo un retraso por clima de 2 horas."</span>
                    </p>
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
// ─────────────────────────────────────────────────────────────
// IA Voice Processing Helper (Same as DailyLogForm but tailored visually for Inspection if needed)
function SmartDictationButton({ context, contractItems, onResult }: any) {
    const [isListening, setIsListening] = useState(false);
    const [processing, setProcessing] = useState(false);

    const toggleListening = () => {
        if (isListening) return;
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('El dictado nativo no es soportado en este navegador. Utilice Google Chrome, Safari, etc.');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'es';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => setIsListening(true);
        recognition.onresult = async (event: any) => {
            const transcript = event.results[0][0].transcript;
            setIsListening(false);
            setProcessing(true);

            try {
                const res = await fetch('/api/process-dictation', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: transcript, context, contractItems })
                });

                if (!res.ok) throw new Error("Error con servidor de IA");
                const data = await res.json();
                onResult(data);
            } catch (err: any) {
                console.error(err);
                alert("Error procesando dictado con IA: " + err.message);
            } finally {
                setProcessing(false);
            }
        };

        recognition.onerror = (event: any) => {
             console.error(event.error);
             setIsListening(false);
        };
        recognition.onspeechend = () => recognition.stop();
        recognition.start();
    };

    return (
        <button 
           type="button"
           onClick={toggleListening} 
           disabled={processing || isListening}
           className={`p-3.5 rounded-[20px] transition-all flex items-center justify-center shrink-0 w-14 h-14 ${isListening ? 'bg-red-500 text-white animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.5)] border border-red-400' : 'bg-white border border-slate-200 hover:border-emerald-500/50 text-emerald-600 shadow-sm'} ${processing ? 'opacity-50' : 'hover:scale-105 active:scale-95'}`}
           title="Dictar a Inteligencia Artificial"
        >
            {processing ? <Loader2 size={24} className="animate-spin text-emerald-600" /> : <Mic size={24} strokeWidth={isListening ? 3 : 2} />}
        </button>
    );
}
