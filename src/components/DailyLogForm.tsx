"use client";

import React, { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/lib/supabase";
import {
    Save, Plus, Trash2, Users, Truck,
    FileText, ChevronRight, ChevronLeft,
    CloudSun, MessageSquare, ListChecks,
    Clock, Shield, AlertTriangle, Trash, Check,
    Camera, Image as ImageIcon, Search, Upload, Printer, FileSpreadsheet, Info, Mic, Loader2, Download
} from "lucide-react";
import FloatingFormActions from "./FloatingFormActions";
import type { FormRef } from "./ProjectForm";
import { generateDailyLogReport } from "@/lib/generateDailyLogReport";
import { downloadBlob } from "@/lib/reportLogic";
import { exportSectionToJSON, importSectionFromJSON } from "@/lib/sectionIO";

const DELAY_TYPES = ["Condiciones existentes", "Material", "Falla en la especificación", "Decisión de ACT", "Calidad", "Evento de seguridad", "Clima"];
const EQUIPMENT_TYPES = ["Bob Cat", "Pickup F-150", "Pickup Ram 2500", "Pickup F-450", "Truck Tumba 320", "Grúa de canasto", "Miniexcavadora"];

const TodayButton = ({ onSelect }: { onSelect: (date: string) => void }) => (
    <button 
        type="button" 
        onClick={() => onSelect(new Date().toISOString().split('T')[0])}
        className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-white/50 hover:bg-white text-[10px] font-bold text-primary rounded border border-primary/20 transition-all z-10"
    >
        HOY
    </button>
);

const TAB_LIST = [
    { id: "partidas",      num: 1,  label: "Partidas",      icon: <ListChecks size={18} /> },
    { id: "clima",         num: 2,  label: "Clima",         icon: <CloudSun size={18} /> },
    { id: "notas",         num: 3,  label: "Notas",         icon: <MessageSquare size={18} /> },
    { id: "personal",      num: 4,  label: "Personal",      icon: <Users size={18} /> },
    { id: "equipo",        num: 5,  label: "Equipo",        icon: <Truck size={18} /> },
    { id: "seguridad",     num: 6,  label: "Seguridad",     icon: <Shield size={18} /> },
    { id: "fotos",         num: 7,  label: "Fotos",         icon: <ImageIcon size={18} /> },
];

const UNIT_INSTRUCTIONS: Record<string, string> = {
    "CY":  "Anota las yardas cúbicas instaladas hoy. Usa el ticket del camión como comprobante.",
    "SY":  "Mide el área colocada en yardas cuadradas. Anota observaciones si hubo irregularidades.",
    "LF":  "Mide la longitud instalada en pies lineales. Toma fotos del inicio y fin del tramo.",
    "SF":  "Anota los pies cuadrados completados. Indica si había subbases preparadas.",
    "EA":  "Indica cuántas unidades fueron instaladas. Menciona número de serie si aplica.",
    "LS":  "Tarea única (suma alzada). Anota qué porcentaje se considera completado hoy.",
    "TON": "Anota las toneladas colocadas usando tickets de pesaje del camión.",
    "LB":  "Anota las libras instaladas. Adjunta ticket de entrega del material.",
    "GAL": "Registra los galones aplicados. Indica área cubierta y condición de la superficie.",
};

function getInstruction(unit: string): string {
    return UNIT_INSTRUCTIONS[(unit || "").toUpperCase()] ||
        "Anota la cantidad trabajada hoy en la unidad indicada. Toma fotos del progreso y guarda los tickets del material.";
}

const DailyLogForm = forwardRef<FormRef, { projectId?: string, numAct?: string, onDirty?: () => void, onSaved?: () => void }>(function DailyLogForm({ projectId, numAct, onDirty, onSaved }, ref) {
    const [activeSubTab, setActiveSubTab] = useState("list");
    const [dailyLogs, setDailyLogs] = useState<any[]>([]);
    const [currentLog, setCurrentLog] = useState<any>(null);
    const [projectAddress, setProjectAddress] = useState("");
    const [loading, setLoading] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [editTab, setEditTab] = useState("partidas");
    const [contractItems, setContractItems] = useState<any[]>([]);
    const [projectDefaults, setProjectDefaults] = useState({
        personnel: [],
        equipment: [],
        repeat_personnel: false,
        repeat_equipment: false
    });

    useEffect(() => {
        if (projectId) {
            fetchDailyLogs();
            fetchProjectInfo();
            fetchContractItems();
        }
    }, [projectId]);

    const fetchContractItems = async () => {
        if (!projectId) return;
        const { data, error } = await supabase
            .from("contract_items")
            .select("id, item_num, description, specification, unit")
            .eq("project_id", projectId)
            .order("item_num");
        
        if (error) {
            console.error("Error fetching contract items:", error);
            return;
        }
        if (data) setContractItems(data);
    };

    const fetchProjectInfo = async () => {
        if (!projectId) return;
        const { data, error } = await supabase
            .from("projects")
            .select("municipios, carreteras, daily_log_default_personnel, daily_log_default_equipment, daily_log_repeat_personnel, daily_log_repeat_equipment")
            .eq("id", projectId)
            .single();
            
        if (error) {
            console.error("Error fetching project info:", error);
            return;
        }

        if (data) {
            setProjectAddress(`${data.carreteras || ""} ${data.municipios || ""}`.trim());
            setProjectDefaults({
                personnel: data.daily_log_default_personnel || [],
                equipment: (data.daily_log_default_equipment || []).map((e: any) => {
                    if (typeof e === 'object' && !e.tipo) {
                        return { ...e, tipo: e.descripcion || "Equipo" };
                    }
                    return e;
                }),
                repeat_personnel: data.daily_log_repeat_personnel || false,
                repeat_equipment: data.daily_log_repeat_equipment || false
            });
        }
    };

    // El autoguardado ha sido deshabilitado a petición del usuario
    useEffect(() => {
        // La validación o limpieza de timers viejos se omite temporalmente
    }, []);

    const fetchDailyLogs = async () => {
        if (!projectId) return;
        setLoading(true);
        const { data, error } = await supabase
            .from("daily_logs")
            .select("*")
            .eq("project_id", projectId)
            .order("log_date", { ascending: false });
            
        if (error) {
            console.error("Error fetching daily logs:", error);
            alert("Error al cargar los informes: " + error.message);
        } else if (data) {
            setDailyLogs(data);
        }
        setLoading(false);
    };

    const makeNewLog = () => ({
        project_id: projectId,
        log_date: new Date().toISOString().split("T")[0],
        inspector_name: "",
        location: projectAddress,
        weather_data: { temp_max: 85, temp_min: 75, condition: "Soleado", source: "Anotado manualmente" },
        delays_data: [],
        notes_data: { comments: "", media: [] },
        inspections_data: [],
        safety_violations_data: [],
        accidents_data: [],
        waste_data: [],
        personnel_v2_data: projectDefaults.personnel ? [...projectDefaults.personnel] : [],
        equipment_v2_data: projectDefaults.equipment ? [...projectDefaults.equipment] : [],
        visitors_v2_data: [],
        photos_v2_data: [],
        partidas_data: [],
        na_settings: {},
    });

    const handleCreateNew = () => {
        setCurrentLog(makeNewLog());
        setActiveSubTab("edit");
        setEditTab("partidas");
    };

    const handleEdit = (log: any) => {
        // Fallback robusto para partidas: si partidas_data está vacío pero activities tiene datos, migrar
        let partidas = log.partidas_data;
        if ((!partidas || partidas.length === 0) && log.activities && log.activities.length > 0) {
            // Intentar mapear de 'activities' [ {partidas, ubicacion, descripcion} ] a 'partidas_data'
            partidas = log.activities.map((a: any) => {
                // Intentar encontrar un ID que coincida con el item_num o la descripción
                const match = contractItems.find((ci: any) => ci.item_num === a.partidas || ci.description === a.descripcion);
                return {
                    item_id: match ? match.id : "",
                    item_num: a.partidas || "",
                    description: a.descripcion || "",
                    location: a.ubicacion || "",
                    qty_worked: "",
                    notes: ""
                };
            }).filter((p: any) => p.item_num || p.description);
        }

        const initializedLog = {
            ...makeNewLog(),
            ...log,
            weather_data: (log.weather_data && Object.keys(log.weather_data).length > 0) ? log.weather_data : {
                condition: log.weather_am || "Soleado",
                temp_max: log.temp_max || 85,
                temp_min: log.temp_min || 75,
                source: "Recuperado de histórico"
            },
            notes_data: (log.notes_data && Object.keys(log.notes_data).length > 0) ? log.notes_data : {
                comments: log.remarks || ""
            },
            personnel_v2_data: (log.personnel_v2_data && log.personnel_v2_data.length > 0) ? log.personnel_v2_data : (log.personnel || []),
            equipment_v2_data: ((log.equipment_v2_data && log.equipment_v2_data.length > 0) ? log.equipment_v2_data : (log.equipment || [])).map((e: any) => {
                if (typeof e === 'object' && !e.tipo) {
                    return { ...e, tipo: e.descripcion || "Equipo" };
                }
                return e;
            }),
            partidas_data: partidas || [],
            photos_v2_data: log.photos_v2_data || [],
            na_settings: log.na_settings || {},
        };
        setCurrentLog(initializedLog);
        setActiveSubTab("edit");
        setEditTab("partidas");
    };


    const saveData = async (silent = false, background = false) => {
        if (!currentLog || !projectId) return;

        // Validation: Solo requerimos partidas por defecto, el resto es opcional/recomendado
        const hasPartidas = currentLog.partidas_data?.length > 0;
        
        if (!hasPartidas && !silent && !background) {
            const proceed = confirm("No ha registrado ninguna partida trabajada hoy. ¿Desea guardar el informe de todos modos?");
            if (!proceed) return;
        }

        if (!background) setLoading(true);
        try {
            const { id, created_at, updated_at, ...logData } = currentLog;
            
            // Sincronizar campos legados para reportes antiguos
            const logDataToSave = {
                ...logData,
                weather_am: currentLog.weather_data?.condition || "",
                temp_max: currentLog.weather_data?.temp_max || null,
                temp_min: currentLog.weather_data?.temp_min || null,
                remarks: currentLog.notes_data?.comments || "",
                activities: currentLog.partidas_data || [] // Sincronizar actividades para sección 10
            };

            if (id) {
                const { error } = await supabase.from("daily_logs").update(logDataToSave).eq("id", id);
                if (error) throw error;
            } else {
                const { data, error } = await supabase.from("daily_logs").insert([logDataToSave]).select().single();
                if (error) throw error;
                if (data) setCurrentLog(data);
            }

            setIsDirty(false);
            setLastSaved(new Date());

            if (!background) {
                // Sync repetition preferences to project
                const personnelToRepeat = (currentLog.personnel_v2_data || []).filter((p: any) => p.repetir);
                const equipmentToRepeat = (currentLog.equipment_v2_data || []).filter((e: any) => e.repetir);
                await supabase.from("projects").update({
                    daily_log_default_personnel: personnelToRepeat,
                    daily_log_default_equipment: equipmentToRepeat
                }).eq("id", projectId);

                if (!silent) alert("Informe Diario guardado correctamente");
                await fetchDailyLogs();
                if (onSaved) onSaved();
                setActiveSubTab("list");
            }
        } catch (err: any) {
            console.error("Error saving daily log:", err);
            if (!background) alert("Error al guardar el informe: " + (err.message || "Error desconocido"));
        } finally {
            if (!background) setLoading(false);
        }
    };

    const handlePrint = async () => {
        if (!currentLog?.id || !projectId) return;
        setLoading(true);
        try {
            const blob = await generateDailyLogReport(projectId, currentLog.id);
            downloadBlob(blob, `Informe_Diario_${currentLog.log_date}.pdf`);
        } catch (err) {
            console.error(err);
            alert("Error al generar el PDF");
        } finally {
            setLoading(false);
        }
    };

    useImperativeHandle(ref, () => ({ save: () => saveData(true) }));

    const handleInputChange = (field: string, value: any) => {
        setCurrentLog((prev: any) => ({ ...prev, [field]: value }));
        setIsDirty(true);
        if (onDirty) onDirty();
    };

    const handleGlobalAIResult = (aiResult: any) => {
        if (!currentLog) return;
        
        let newLog = { ...currentLog };
        let updated = false;

        // 1. Personal
        if (aiResult.personal && Array.isArray(aiResult.personal)) {
            newLog.personnel_v2_data = [
                ...(newLog.personnel_v2_data || []),
                ...aiResult.personal.map((p: any) => ({ ...p, repetir: false }))
            ];
            updated = true;
        }

        // 2. Equipo
        if (aiResult.equipo && Array.isArray(aiResult.equipo)) {
            newLog.equipment_v2_data = [
                ...(newLog.equipment_v2_data || []),
                ...aiResult.equipo.map((e: any) => ({ ...e, repetir: false }))
            ];
            updated = true;
        }

        // 3. Partidas
        if (aiResult.partidas_trabajadas && Array.isArray(aiResult.partidas_trabajadas)) {
            const newEntries = aiResult.partidas_trabajadas.map((p: any) => {
                const match = contractItems.find((ci: any) => String(ci.id) === String(p.item_id));
                return {
                    item_id: match?.id || "",
                    item_num: match?.item_num || "",
                    description: match?.description || p.notes || "Buscado por IA",
                    unit: match?.unit || "",
                    qty_worked: p.qty_worked || "",
                    notes: p.notes || ""
                };
            });
            newLog.partidas_data = [
                ...(newLog.partidas_data || []),
                ...newEntries
            ];
            updated = true;
        }

        // 4. Notas
        if (aiResult.notas?.texto) {
            const prev = newLog.notes_data?.comments || "";
            newLog.notes_data = {
                ...newLog.notes_data,
                comments: prev + (prev ? "\n\n" : "") + aiResult.notas.texto
            };
            updated = true;
        }

        // 5. Seguridad
        if (aiResult.seguridad?.texto) {
            const prev = newLog.safety_violations_data?.comments || "";
            newLog.safety_violations_data = {
                ...newLog.safety_violations_data,
                comments: prev + (prev ? "\n\n" : "") + aiResult.seguridad.texto
            };
            
            if (aiResult.seguridad.es_incidente_grave) {
                newLog.accidents_data = [
                    ...(newLog.accidents_data || []),
                    { descripcion: aiResult.seguridad.texto, hora: new Date().toLocaleTimeString(), medida_tomada: "Reportado por IA" }
                ];
            }
            updated = true;
        }

        if (updated) {
            setCurrentLog(newLog);
            setIsDirty(true);
            if (onDirty) onDirty();
            alert("El Asistente de IA ha identificado y categorizado correctamente su dictado.");
        } else {
            alert("La IA no pudo identificar información específica para las secciones del informe.");
        }
    };

    if (activeSubTab === "list") {
        return (
            <div className="space-y-6">
                <div className="sticky top-16 z-40 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md pt-6 pb-4 -mx-4 px-4 md:-mx-8 md:px-8 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
                    <h2 className="text-xl md:text-2xl font-black text-slate-800 dark:text-white">10. Informe de Actividades (Daily Log)</h2>
                    <button onClick={handleCreateNew} className="btn-primary w-full sm:w-auto flex items-center gap-2"><Plus size={18} /> Nuevo Registro</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {dailyLogs.map(log => (
                        <div key={log.id} className="card p-6 cursor-pointer border-l-8 border-primary hover:shadow-lg transition-all" onClick={() => handleEdit(log)}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="text-xs font-black bg-primary text-white px-2 py-1 rounded-full">{log.log_date}</span>
                                    <h3 className="font-bold text-lg mt-2">{log.inspector_name || "Sin inspector"}</h3>
                                    <p className="text-xs text-slate-400 mt-1">{log.location}</p>
                                    {log.partidas_data?.length > 0 && (
                                        <p className="text-[10px] font-bold text-blue-500 mt-2">{log.partidas_data.length} partida(s) trabajada(s)</p>
                                    )}
                                </div>
                                <ChevronRight size={20} className="text-primary" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (!currentLog) return null;

    return (
        <div className="space-y-6">
            <div className="sticky top-16 z-40 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md pt-6 pb-4 -mx-4 px-4 md:-mx-8 md:px-8 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => setActiveSubTab("list")} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"><ChevronLeft size={20} /></button>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-base md:text-lg font-black text-slate-800 dark:text-white">{currentLog.log_date}</h2>
                            {isDirty ? (
                                <span className="flex items-center gap-1.5 text-[9px] md:text-[10px] font-black text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-md border border-amber-100 dark:border-amber-800 animate-pulse">
                                    <Clock size={10} /> Diferencia
                                </span>
                            ) : (
                                <span className="flex items-center gap-1.5 text-[9px] md:text-[10px] font-black text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-md border border-green-100 dark:border-green-800">
                                    <Check size={10} /> Guardado
                                </span>
                            )}
                        </div>
                        <p className="text-[10px] md:text-xs text-slate-400 truncate max-w-[150px] md:max-w-none">{currentLog.inspector_name || "Nuevo Reporte"}</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 lg:flex gap-2">
                    {/* Los botones ahora son flotantes para mayor accesibilidad */}
                </div>
            </div>

            <input id="import-dailylog-json" type="file" accept=".json" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const result = await importSectionFromJSON(file);
                if (result.success && result.data && typeof result.data === 'object') {
                    const { id: _id, created_at, updated_at, project_id, ...rest } = result.data;
                    setCurrentLog((prev: any) => ({ ...prev, ...rest }));
                    setIsDirty(true);
                    if (onDirty) onDirty();
                    alert("Datos del informe importados. Guarde para confirmar.");
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
                        onClick: () => exportSectionToJSON(`informe_diario_${currentLog.log_date}`, currentLog),
                        description: "Exportar el informe diario completo a un archivo JSON (para copiar a otro proyecto o fecha)",
                        variant: 'info' as const,
                        disabled: loading
                    },
                    {
                        label: "Importar JSON", position: "middle-right" as const, size: "small" as const,
                        icon: <FileText />,
                        onClick: () => document.getElementById('import-dailylog-json')?.click(),
                        description: "Cargar datos de un informe diario desde un archivo JSON",
                        variant: 'secondary' as const,
                        disabled: loading
                    },
                    ...(currentLog.id ? [{
                        label: "Imprimir (ACT-45)",
                        icon: <Printer />,
                        onClick: handlePrint,
                        description: "Generar el reporte oficial ACT-45 en PDF con toda la información del reporte diario.",
                        variant: 'secondary' as const,
                        disabled: loading
                    }] : []),
                    {
                        label: isDirty ? "Guardar Cambios" : "Guardado",
                        position: "bottom-right" as const,
                        icon: loading ? <Loader2 className="animate-spin" /> : (isDirty ? <Save /> : <Check />),
                        onClick: () => saveData(),
                        description: isDirty ? "Sincronizar y guardar permanentemente todos los datos ingresados en la base de datos." : "Todos los cambios han sido guardados correctamente.",
                        variant: isDirty ? 'primary' : 'success',
                        disabled: loading || !isDirty
                    }
                ]}
            />

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-1">
                    <nav className="flex flex-col gap-2 sticky top-52">
                        {TAB_LIST.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setEditTab(tab.id)}
                                className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-bold text-sm transition-all duration-300 ${
                                    editTab === tab.id
                                        ? "bg-primary text-white shadow-lg shadow-primary/25 translate-x-2"
                                        : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:translate-x-1"
                                }`}
                            >
                                <span className={`${editTab === tab.id ? "text-white" : "text-primary opacity-60"}`}>{tab.icon}</span>
                                {tab.label}
                                {tab.id === "partidas" && currentLog.partidas_data?.length > 0 && (
                                    <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full ${editTab === tab.id ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-700'}`}>
                                        {currentLog.partidas_data.length}
                                    </span>
                                )}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="lg:col-span-3">
                    <div className="card p-8 min-h-[600px] shadow-xl shadow-slate-200/50 dark:shadow-none border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-right-4 duration-500">
                        <TabContent 
                            id={editTab} 
                            data={currentLog} 
                            update={handleInputChange} 
                            projectId={projectId} 
                            contractItems={contractItems} 
                            projectDefaults={projectDefaults} 
                            setProjectDefaults={setProjectDefaults}
                            onDirty={onDirty}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
});
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
           className={`p-3.5 rounded-[20px] transition-all flex items-center justify-center shrink-0 w-14 h-14 ${isListening ? 'bg-red-500 text-white animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.5)] border border-red-400' : 'bg-white border border-slate-200 hover:border-primary/50 text-primary shadow-sm'} ${processing ? 'opacity-50' : 'hover:scale-105 active:scale-95'}`}
           title="Dictar a Inteligencia Artificial"
        >
            {processing ? <Loader2 size={24} className="animate-spin text-primary" /> : <Mic size={24} strokeWidth={isListening ? 3 : 2} />}
        </button>
    );
}

// ─────────────────────────────────────────────────────────────
// Helpers de instrucciones por unidad

function PartidasTab({ items, setItems, contractItems }: { items: any[], setItems: (v: any) => void, contractItems: any[] }) {
    const addPartida = () => {
        setItems([...items, { item_id: "", item_num: "", description: "", unit: "", qty_worked: "", notes: "" }]);
    };

    const removeItem = (idx: number) => {
        setItems(items.filter((_: any, i: number) => i !== idx));
    };

    const handleSelectPartida = (idx: number, itemId: string) => {
        const match = contractItems.find((ci: any) => ci.id === itemId);
        const newItems = [...items];
        if (match) {
            newItems[idx] = { ...newItems[idx], item_id: match.id, item_num: match.item_num, description: match.description, unit: match.unit || "" };
        } else {
            newItems[idx] = { ...newItems[idx], item_id: "", item_num: "", description: "", unit: "" };
        }
        setItems(newItems);
    };

    const updateField = (idx: number, field: string, value: any) => {
        const newItems = [...items];
        newItems[idx] = { ...newItems[idx], [field]: value };
        setItems(newItems);
    };

    return (
        <div className="space-y-5">
            <div className="flex flex-col sm:flex-row items-center gap-4 bg-blue-50/50 p-5 rounded-3xl border border-blue-100 mb-2">
               <SmartDictationButton 
                    context="partidas"
                    contractItems={contractItems}
                    onResult={(aiResult: any) => {
                        if (aiResult.partidas_trabajadas && Array.isArray(aiResult.partidas_trabajadas)) {
                            const newEntries = aiResult.partidas_trabajadas.map((p: any) => {
                                const match = contractItems.find((ci: any) => ci.id === p.item_id);
                                return {
                                    item_id: match?.id || "",
                                    item_num: match?.item_num || "",
                                    description: match?.description || p.notes || "Buscado por IA",
                                    unit: match?.unit || "",
                                    qty_worked: p.qty_worked || "",
                                    notes: p.notes || ""
                                };
                            });
                            // Evitar agregar lineas en blanco extra además de AI results:
                            const currentFiltered = items.filter((it: any) => it.item_id || it.description);
                            setItems([...currentFiltered, ...newEntries]);
                        }
                    }}
               />
               <div>
                   <h4 className="font-black uppercase text-[11px] tracking-widest text-slate-800 flex items-center gap-2">
                        <Mic size={14} className="text-primary"/> ASISTENTE DE PARTIDAS
                   </h4>
                   <p className="text-xs text-slate-500 mt-1 font-medium">
                       Presiona el micrófono y dícale a la IA qué partidas del contrato ejecutaste hoy y sus cantidades (Ej: "Instalé cuarenta yardas cúbicas de base y también asfalto").
                   </p>
               </div>
            </div>

            {items.length === 0 && (
                <p className="text-center text-slate-400 text-sm italic py-8">
                    Haga clic en &quot;Añadir Partida&quot; para registrar el trabajo del día.
                </p>
            )}

            <div className="space-y-4">
                {items.map((item: any, idx: number) => (
                    <div key={idx} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-3 relative">
                        <button onClick={() => removeItem(idx)} className="absolute top-3 right-3 text-slate-300 hover:text-red-500 transition-colors">
                            <Trash2 size={15} />
                        </button>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="md:col-span-2 space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase">Partida de Contrato</label>
                                <select
                                    className="input-field text-xs bg-blue-50 font-bold text-blue-900"
                                    value={item.item_id || ""}
                                    onChange={e => handleSelectPartida(idx, e.target.value)}
                                >
                                    <option value="">Seleccionar partida...</option>
                                    {contractItems.map((ci: any) => (
                                        <option key={ci.id} value={ci.id}>{ci.item_num}: {ci.description}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase">Unidad de Medida</label>
                                <div className="input-field text-sm font-black text-slate-700 bg-slate-50">
                                    {item.unit || <span className="text-slate-400 italic font-normal">—</span>}
                                </div>
                            </div>
                        </div>

                        {(item.item_id || item.item_num) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase">Cant. trabajada hoy ({item.unit || 'uds'})</label>
                                    <input
                                        type="number"
                                        className="input-field px-2 text-xs font-bold bg-green-50"
                                        placeholder="0.00"
                                        value={item.qty_worked || ""}
                                        onChange={e => updateField(idx, "qty_worked", e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase">Comentarios / Observaciones</label>
                                    <input
                                        type="text"
                                        className="input-field text-xs"
                                        placeholder="Ej: Se completó tramo norte"
                                        value={item.notes || ""}
                                        onChange={e => updateField(idx, "notes", e.target.value)}
                                    />
                                </div>
                            </div>
                        )}

                        {(item.item_id || item.item_num) && item.unit && (
                            <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
                                <Info size={14} className="text-amber-500 mt-0.5 shrink-0" />
                                <p className="text-[11px] text-amber-700 font-medium">{getInstruction(item.unit)}</p>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <button
                onClick={addPartida}
                className="w-full py-3 border-2 border-dashed border-blue-200 rounded-xl text-blue-500 font-bold text-sm hover:border-blue-400 hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
            >
                <Plus size={16} /> Añadir Partida
            </button>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// TabContent dispatcher
function TabContent({ id, data, update, projectId, contractItems = [], projectDefaults, setProjectDefaults, onDirty }: any) {
    if (!data) return null;

    const isNA = data.na_settings?.[id] || false;
    const handleToggleNA = (e: React.ChangeEvent<HTMLInputElement>) => {
        update("na_settings", { ...(data.na_settings || {}), [id]: e.target.checked });
        if (onDirty) onDirty();
    };

    const NA_Checkbox = () => (
        <div className="flex items-center gap-2 mb-4 bg-slate-100 dark:bg-slate-800 p-3 rounded-xl w-fit border border-slate-200 dark:border-slate-700">
            <input 
                type="checkbox" 
                id={`na-${id}`} 
                checked={isNA} 
                onChange={handleToggleNA} 
                className="w-5 h-5 text-primary rounded border-slate-300 focus:ring-primary cursor-pointer" 
            />
            <label htmlFor={`na-${id}`} className="text-sm font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                N/A (No aplica)
            </label>
        </div>
    );

    const renderWrapper = (content: React.ReactNode) => (
        <div className="flex flex-col h-full">
            <NA_Checkbox />
            {isNA ? (
                <div className="flex-grow flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50/50 dark:bg-slate-800/20 p-8">
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Sección marcada como No Aplica</p>
                </div>
            ) : content}
        </div>
    );

    switch (id) {
        case "partidas":
            return renderWrapper(<PartidasTab items={data.partidas_data || []} setItems={(v: any) => update("partidas_data", v)} contractItems={contractItems} />);
        case "clima":
            const fetchWeather = async () => {
                try {
                    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=18.4655&longitude=-66.1057&current_weather=true&temperature_unit=fahrenheit`);
                    const data_w = await res.json();
                    if (data_w.current_weather) {
                        update("weather_data", { 
                            ...data.weather_data, 
                            condition: "Despejado",
                            source: "Open-Meteo"
                        });
                        alert("Clima actualizado automáticamente.");
                    }
                } catch (err) {
                    console.error("Error fetching weather:", err);
                    alert("No se pudo obtener el clima de internet.");
                }
            };
            return (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h4 className="font-bold uppercase text-[10px] tracking-widest text-slate-400 font-black">Condiciones Climáticas</h4>
                        <button type="button" onClick={fetchWeather} className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg text-[10px] py-1.5 px-4 flex items-center gap-2 transition-all">
                             Obtener de Internet
                        </button>
                    </div>
                    <div className="grid grid-cols-1 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-400">Clima</label>
                            <input className="input-field" value={data.weather_data?.condition || ""} onChange={e => update("weather_data", { ...data.weather_data, condition: e.target.value })} placeholder="Ej: Soleado, Nublado" />
                        </div>
                    </div>
                </div>
            );
        case "notas":
            return renderWrapper(
                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row items-center gap-4 bg-blue-50/50 p-5 rounded-3xl border border-blue-100 mb-2">
                       <SmartDictationButton 
                            context="notas" 
                            onResult={(aiResult: any) => {
                                const prev = data.notes_data?.comments || "";
                                update("notes_data", { ...data.notes_data, comments: prev + (prev ? "\n\n" : "") + aiResult.texto });
                            }} 
                       />
                       <div>
                           <h4 className="font-black uppercase text-[11px] tracking-widest text-slate-800 flex items-center gap-2">
                                <Mic size={14} className="text-primary"/> ASISTENTE DE NOTAS
                           </h4>
                           <p className="text-xs text-slate-500 mt-1 font-medium">
                               Dicta tu observación con voz natural. La inteligencia artificial corregirá gramática, sintaxis y lo añadirá profesionalmente al cuadro de abajo.
                           </p>
                       </div>
                    </div>
                    <textarea rows={8} className="input-field" placeholder="Comentarios y notas sobre la obra de hoy (Indispensable)..." value={data.notes_data?.comments || ""} onChange={e => update("notes_data", { ...data.notes_data, comments: e.target.value })} />
                    <MediaSection projectId={projectId} items={data.notes_data?.media || []} setItems={(media: any) => update("notes_data", { ...data.notes_data, media })} />
                </div>
            );
        case "personal":
            return renderWrapper(
                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row items-center gap-4 bg-blue-50/50 p-5 rounded-3xl border border-blue-100 mb-2">
                       <SmartDictationButton 
                            context="personal" 
                            onResult={(aiResult: any) => {
                                if (aiResult.personal && Array.isArray(aiResult.personal)) {
                                    const combined = [...(data.personnel_v2_data || []), ...aiResult.personal.map((p:any) => ({...p, repetir: false}))];
                                    update("personnel_v2_data", combined);
                                }
                            }}
                       />
                       <div>
                           <h4 className="font-black uppercase text-[11px] tracking-widest text-slate-800 flex items-center gap-2">
                                <Mic size={14} className="text-primary"/> ASISTENTE DE PERSONAL
                           </h4>
                           <p className="text-xs text-slate-500 mt-1 font-medium">
                               Evita escribir nombres. Dicta, por ejemplo: "Hoy vino Juan Pérez 8 horas, y el operador Roberto Sanchez 6 horas con la compañía ACT".
                           </p>
                       </div>
                    </div>
                    <SectionEditor items={data.personnel_v2_data} setItems={(items: any) => update("personnel_v2_data", items)} emptyItem={{ compañia: "", horas: 0, nombres: "", clasificacion: "", repetir: false }} renderItem={(item: any, idx: number, updateItem: any) => (
                        <div>
                            <div className="grid grid-cols-4 gap-2">
                                <div className="space-y-1">
                                    <label className="text-[8px] font-black uppercase text-slate-400">Compañía</label>
                                    <input className="input-field text-xs" placeholder="Ej: ACT" value={item.compañia || ""} onChange={e => updateItem(idx, "compañia", e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[8px] font-black uppercase text-slate-400">Nombre y Apellido</label>
                                    <input className="input-field text-xs" placeholder="Juan Pérez" value={item.nombres || ""} onChange={e => updateItem(idx, "nombres", e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[8px] font-black uppercase text-slate-400">Clasificación</label>
                                    <input className="input-field text-xs" placeholder="Ej: Inspector" value={item.clasificacion || ""} onChange={e => updateItem(idx, "clasificacion", e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[8px] font-black uppercase text-slate-400">Horas</label>
                                    <input type="number" className="input-field text-xs" value={item.horas ?? ""} onChange={e => updateItem(idx, "horas", e.target.value === '' ? '' : parseFloat(e.target.value))} />
                                </div>
                            </div>
                            <div className="mt-3 flex items-center gap-2">
                                <input type="checkbox" id={`repetir-personal-${idx}`} checked={!!item.repetir} onChange={e => updateItem(idx, "repetir", e.target.checked)} className="w-3 h-3 text-primary border-slate-300 rounded focus:ring-primary" />
                                <label htmlFor={`repetir-personal-${idx}`} className="text-[10px] text-slate-500 font-bold uppercase cursor-pointer">Repetir mañana</label>
                            </div>
                        </div>
                    )} />
                </div>
            );
        case "equipo":
            const handleToggleEquip = (type: string, checked: boolean) => {
                const currentEquip = data.equipment_v2_data || [];
                if (checked) {
                    update("equipment_v2_data", [...currentEquip, { tipo: type, horas_op: 1, descripcion: "", repetir: false }]);
                } else {
                    update("equipment_v2_data", currentEquip.filter((e: any) => (typeof e === 'string' ? e : e.tipo) !== type));
                }
            };

            const selectedEquipList = data.equipment_v2_data || [];

            return renderWrapper(
                <div className="space-y-6">
                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
                            <div className="flex items-center gap-2">
                                <Truck size={18} className="text-primary" />
                                <div className="flex-grow">
                                    <h4 className="text-xs font-black uppercase text-slate-500 tracking-widest">Selección Rápida de Equipo</h4>
                                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">Marque el checkbox para habilitar el campo de Cant.</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-blue-100 shadow-sm shrink-0">
                                <SmartDictationButton 
                                    context="equipo" 
                                    onResult={(aiResult: any) => {
                                        if (aiResult.equipo && Array.isArray(aiResult.equipo)) {
                                            const extras = aiResult.equipo.map((e: any) => ({ ...e, repetir: false }));
                                            update("equipment_v2_data", [...selectedEquipList, ...extras]);
                                            update("_showOther", true);
                                        }
                                    }} 
                                />
                                <div>
                                    <h5 className="font-black text-[10px] uppercase tracking-widest text-blue-800">Carga por IA</h5>
                                    <p className="text-[10px] font-medium text-slate-500 max-w-[12rem]">Dicta: "Dos excavadoras CAT por 4 horas..."</p>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {EQUIPMENT_TYPES.map(type => {
                                const item = selectedEquipList.find((e: any) => (typeof e === 'string' ? e : e.tipo) === type);
                                const isSelected = !!item;
                                return (
                                    <div key={type} className={`flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all ${isSelected ? 'bg-primary/5 border-primary shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                                        <label className="flex items-center gap-2.5 cursor-pointer flex-grow min-w-0">
                                            <input 
                                                type="checkbox" 
                                                checked={isSelected} 
                                                onChange={(e) => handleToggleEquip(type, e.target.checked)}
                                                className="w-5 h-5 text-primary rounded-lg border-slate-300 focus:ring-primary cursor-pointer"
                                            />
                                            <span className={`text-[11px] font-bold truncate tracking-tight ${isSelected ? 'text-primary' : 'text-slate-600'}`}>{type}</span>
                                        </label>
                                        
                                        {isSelected && (
                                            <div className="flex items-center gap-2 shrink-0 animate-in fade-in zoom-in-95 duration-200">
                                                <div className="flex flex-col items-center gap-0.5 bg-white p-1 px-1.5 rounded-xl border border-primary/20 shadow-sm">
                                                    <span className="text-[7px] font-black text-primary/60 uppercase leading-none">Horas</span>
                                                    <input 
                                                        type="number" 
                                                        step="0.5"
                                                        min="0"
                                                        className="w-14 px-1 text-center text-xs font-black bg-transparent outline-none focus:text-primary" 
                                                        value={item.horas_op ?? ""} 
                                                        onChange={e => {
                                                            const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                                                            const newEquip = selectedEquipList.map((eq: any) => (typeof eq === 'string' ? eq : eq.tipo) === type ? { ...(typeof eq === 'string' ? {tipo: eq} : eq), horas_op: val } : eq);
                                                            update("equipment_v2_data", newEquip);
                                                        }} 
                                                        placeholder="0"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            
                            <label className={`flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${data._showOther ? 'bg-amber-50 border-amber-400 shadow-md' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                                <div className="flex items-center gap-3">
                                    <input 
                                        type="checkbox" 
                                        checked={data._showOther || false} 
                                        onChange={(e) => update("_showOther", e.target.checked)}
                                        className="w-5 h-5 text-amber-500 rounded-lg border-slate-300 focus:ring-amber-500"
                                    />
                                    <span className={`text-xs font-bold ${data._showOther ? 'text-amber-700' : 'text-slate-600'}`}>Otros Equipos</span>
                                </div>
                                {data._showOther && <span className="text-[10px] font-black text-amber-600 animate-bounce">Añadir abajo ↓</span>}
                            </label>
                        </div>

                        {data._showOther && (
                            <div className="mt-4 p-4 bg-white/50 border border-dashed border-amber-200 rounded-3xl space-y-4 animate-in fade-in slide-in-from-top-2">
                                <div className="flex items-center gap-2">
                                    <Plus size={14} className="text-amber-500" />
                                    <h5 className="text-[10px] font-black uppercase text-amber-600">Listado de Equipos Adicionales</h5>
                                </div>
                                
                                <SectionEditor 
                                    items={selectedEquipList.filter((e: any) => !EQUIPMENT_TYPES.includes(typeof e === 'string' ? e : e.tipo))} 
                                    setItems={(extras: any) => {
                                        const standard = selectedEquipList.filter((e: any) => EQUIPMENT_TYPES.includes(typeof e === 'string' ? e : e.tipo));
                                        update("equipment_v2_data", [...standard, ...extras]);
                                    }} 
                                    emptyItem={{ tipo: "", horas_op: 1, descripcion: "", repetir: false }} 
                                    renderItem={(item: any, idx: number, updateItem: any) => (
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                            <div className="md:col-span-2 space-y-1">
                                                <label className="text-[8px] font-black uppercase text-slate-400">Tipo / Descripción</label>
                                                <input className="input-field text-xs px-2 py-2" placeholder="Ej: Generador, Mezcladora..." value={item.tipo || ""} onChange={e => updateItem(idx, "tipo", e.target.value)} />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[8px] font-black uppercase text-slate-400">ID / Placa</label>
                                                <input className="input-field text-xs px-2 py-2" placeholder="Opcional" value={item.descripcion || ""} onChange={e => updateItem(idx, "descripcion", e.target.value)} />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[8px] font-black uppercase text-slate-400">Cant. (Hrs)</label>
                                                <input type="number" step="0.5" className="input-field text-xs px-2 py-2 font-black" value={item.horas_op ?? ""} onChange={e => updateItem(idx, "horas_op", e.target.value === '' ? '' : parseFloat(e.target.value))} />
                                            </div>
                                        </div>
                                    )} 
                                />
                                <p className="text-[9px] text-slate-400 italic">Nota: Use esta sección para equipos específicos que no estén en la lista rápida.</p>
                            </div>
                        )}
                    </div>

                    {/* Resumen Detallado (Solo si hay algo seleccionado) */}
                    {selectedEquipList.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 px-2">
                                <ListChecks size={14} className="text-primary" />
                                <h4 className="text-[10px] font-black uppercase text-slate-400">Resumen y Opciones Adicionales</h4>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                {selectedEquipList.map((eq: any, idx: number) => {
                                    const name = typeof eq === 'string' ? eq : (eq.tipo || eq.descripcion || "Equipo sin nombre");
                                    return (
                                        <div key={idx} className="flex items-center gap-4 p-3 bg-white border border-slate-100 rounded-2xl hover:border-primary/20 transition-all shadow-sm">
                                            <div className="flex-grow min-w-0">
                                                <p className="text-xs font-black text-slate-700 truncate">{name}</p>
                                                {eq.descripcion && <p className="text-[9px] text-slate-400 font-bold uppercase truncate">{eq.descripcion}</p>}
                                            </div>
                                            <div className="flex items-center gap-4 shrink-0">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[8px] font-black text-slate-300 uppercase leading-none mb-1">Repetir</span>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={!!eq.repetir} 
                                                        onChange={(e) => {
                                                            const next = [...selectedEquipList];
                                                            next[idx] = { ...(typeof eq === 'string' ? {tipo: eq} : eq), repetir: e.target.checked };
                                                            update("equipment_v2_data", next);
                                                        }}
                                                        className="w-4 h-4 text-primary rounded border-slate-300" 
                                                    />
                                                </div>
                                                <div className="w-px h-8 bg-slate-100" />
                                                <div className="flex flex-col items-center">
                                                    <span className="text-[8px] font-black text-primary/60 uppercase leading-none mb-1">Horas</span>
                                                    <input 
                                                        type="number" 
                                                        step="0.5" 
                                                        className="w-16 px-1 text-center font-black text-xs bg-slate-50 border-none rounded-lg" 
                                                        value={eq.horas_op ?? ""} 
                                                        onChange={e => {
                                                            const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                                                            const next = [...selectedEquipList];
                                                            next[idx] = { ...(typeof eq === 'string' ? {tipo: eq} : eq), horas_op: val };
                                                            update("equipment_v2_data", next);
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            );
        case "seguridad":
            return renderWrapper(
                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row items-center gap-4 bg-orange-50/50 p-5 rounded-3xl border border-orange-100 mb-2">
                       <SmartDictationButton 
                            context="seguridad" 
                            onResult={(aiResult: any) => {
                                const prev = data.safety_violations_data?.comments || "";
                                update("safety_violations_data", { ...data.safety_violations_data, comments: prev + (prev ? "\n\n" : "") + aiResult.texto });
                            }} 
                       />
                       <div>
                           <h4 className="font-black uppercase text-[11px] tracking-widest text-slate-800 flex items-center gap-2">
                                <Mic size={14} className="text-orange-600"/> DICTADO DE SEGURIDAD Y SALUD
                           </h4>
                           <p className="text-xs text-slate-500 mt-1 font-medium">
                               Dicta cualquier incidencia, accidente, uso de EPP (Equipos de Protección), o simplemente si todo estuvo en orden hoy. La IA estructurará tu respuesta.
                           </p>
                       </div>
                    </div>
                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase text-slate-400">Observaciones Generales de Seguridad y/o Violaciones (Incidentes)</label>
                        <textarea rows={8} className="input-field border-orange-200 focus:border-orange-500 focus:ring-orange-500" placeholder="Escriba o dicte aquí cualquier reporte relacionado a OSHA, EPP o accidentes..." value={data.safety_violations_data?.comments || ""} onChange={e => update("safety_violations_data", { ...data.safety_violations_data, comments: e.target.value })} />
                    </div>
                </div>
            );
        case "fotos":
            return renderWrapper(<MediaSection projectId={projectId} items={data.photos_v2_data || []} setItems={(media: any) => update("photos_v2_data", media)} fullGallery />);
        default:
            return <div className="text-slate-400">Seleccione una sección</div>;
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
        <div className="space-y-4">
            {(items || []).map((item: any, idx: number) => (
                <div key={idx} className="p-4 border rounded-xl relative bg-slate-50/50">
                    <button onClick={() => handleRemove(idx)} className="absolute top-2 right-2 text-red-500">
                        <Trash2 size={16} />
                    </button>
                    {renderItem(item, idx, handleUpdate)}
                </div>
            ))}
            <button onClick={handleAdd} className="w-full py-3 border-2 border-dashed rounded-xl text-slate-400 font-bold text-sm hover:border-primary/50 hover:text-primary transition-all">
                + Añadir Elemento
            </button>
        </div>
    );
}

function MediaSection({ items, setItems, fullGallery, projectId }: any) {
    const [uploading, setUploading] = useState(false);

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !projectId) return;

        setUploading(true);
        try {
            const dateFolder = new Date().toISOString().split('T')[0];
            const safeName = file.name
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-zA-Z0-9._-]/g, '_');
            const storagePath = `${projectId}/logs/${dateFolder}/${Date.now()}_${safeName}`;
            
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from("project-documents")
                .upload(storagePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from("project-documents").getPublicUrl(storagePath);

            // Register in project_documents so it shows up in explorer
            await supabase.from("project_documents").insert({
                project_id: projectId,
                doc_type: "Foto / Multimedia (Bitácora)",
                section: "logs",
                file_name: file.name,
                storage_path: storagePath
            });

            setItems([...items, { 
                id: Date.now().toString(), 
                src: publicUrl, 
                type: file.type.startsWith("image/") ? "image" : "doc",
                storage_path: storagePath 
            }]);
        } catch (err: any) {
            console.error("Error upload:", err);
            alert("Error al subir archivo: " + err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleCameraClick = async () => {
        try {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                await navigator.mediaDevices.getUserMedia({ video: true });
            }
        } catch (err) {
            console.error("No se pudo acceder a la cámara:", err);
            alert("Se requiere permiso para utilizar la cámara.");
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <label onClick={handleCameraClick} className="flex-1 p-3 border rounded-xl flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-50 relative">
                    {uploading ? <Loader2 size={18} className="animate-spin text-primary" /> : <Camera size={18} />}
                    <span className="text-xs font-bold">{uploading ? "Subiendo..." : "Foto"}</span>
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} disabled={uploading} />
                </label>
                <label className="flex-1 p-3 border rounded-xl flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-50 relative">
                    {uploading ? <Loader2 size={18} className="animate-spin text-primary" /> : <Upload size={18} />}
                    <span className="text-xs font-bold">{uploading ? "Subiendo..." : "Archivo"}</span>
                    <input type="file" className="hidden" onChange={handleFile} disabled={uploading} />
                </label>
            </div>
            <div className={`grid gap-2 ${fullGallery ? "grid-cols-4" : "grid-cols-3"}`}>
                {items.map((m: any) => (
                    <div key={m.id} className="aspect-square bg-slate-100 rounded-lg relative overflow-hidden group">
                        {m.type === "image" ? (
                            <img src={m.src} className="w-full h-full object-cover" alt="" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-blue-50">
                                <FileText size={24} className="text-blue-500" />
                            </div>
                        )}
                        <button 
                            onClick={() => setItems(items.filter((i: any) => i.id !== m.id))} 
                            className="absolute top-1 right-1 bg-white/80 rounded-full p-1 text-red-500 hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default DailyLogForm;
