"use client";

import React, { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/lib/supabase";
import { 
    Save, Plus, Trash2, Calendar, Users, Truck, 
    FileText, ChevronRight, ChevronLeft, 
    CloudSun, MessageSquare,
    Clock, MapPin, Shield, AlertTriangle, Trash,
    Camera, Image as ImageIcon, Search, Upload
} from "lucide-react";
import type { FormRef } from "./ProjectForm";

const DELAY_TYPES = ["Condiciones existentes", "Material", "Falla en la especificación", "Decisión de ACT", "Calidad", "Evento de seguridad", "Clima"];
const EQUIPMENT_TYPES = ["Bob Cat", "Pickup F-150", "Pickup Ram 2500", "Pickup F-450", "Truck Tumba 320", "Grúa de canasto", "Miniexcavadora"];

const TAB_LIST = [
    { id: "clima", num: 1, label: "Clima", icon: <CloudSun size={18} /> },
    { id: "retrasos", num: 2, label: "Retrasos", icon: <Clock size={18} /> },
    { id: "notas", num: 3, label: "Notas", icon: <MessageSquare size={18} /> },
    { id: "inspecciones", num: 4, label: "Inspecciones", icon: <Search size={18} /> },
    { id: "seguridad", num: 5, label: "Seguridad", icon: <Shield size={18} /> },
    { id: "accidentes", num: 6, label: "Accidentes", icon: <AlertTriangle size={18} /> },
    { id: "desperdicios", num: 7, label: "Desperdicios", icon: <Trash size={18} /> },
    { id: "personal", num: 8, label: "Personal", icon: <Users size={18} /> },
    { id: "equipo", num: 9, label: "Equipo", icon: <Truck size={18} /> },
    { id: "visitantes", num: 10, label: "Visitantes", icon: <Users size={18} /> },
    { id: "fotos", num: 11, label: "Fotos", icon: <ImageIcon size={18} /> },
];

const DailyLogForm = forwardRef<FormRef, { projectId?: string, numAct?: string, onDirty?: () => void, onSaved?: () => void }>(function DailyLogForm({ projectId, numAct, onDirty, onSaved }, ref) {
    const [activeSubTab, setActiveSubTab] = useState("list");
    const [dailyLogs, setDailyLogs] = useState<any[]>([]);
    const [currentLog, setCurrentLog] = useState<any>(null);
    const [projectAddress, setProjectAddress] = useState("");
    const [loading, setLoading] = useState(false);
    const [editTab, setEditTab] = useState("clima");

    useEffect(() => {
        if (projectId) {
            fetchDailyLogs();
            fetchProjectInfo();
        }
    }, [projectId]);

    const fetchProjectInfo = async () => {
        if (!projectId) return;
        const { data } = await supabase.from("projects").select("municipios, carreteras").eq("id", projectId).single();
        if (data) setProjectAddress(`${data.carreteras || ""} ${data.municipios || ""}`.trim());
    };

    const fetchDailyLogs = async () => {
        setLoading(true);
        const { data } = await supabase.from("daily_logs").select("*").eq("project_id", projectId).order("log_date", { ascending: false });
        if (data) setDailyLogs(data);
        setLoading(false);
    };

    const handleCreateNew = () => {
        const newLog = {
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
            personnel_v2_data: [],
            equipment_v2_data: [],
            visitors_v2_data: [],
            photos_v2_data: [],
        };
        setCurrentLog(newLog);
        setActiveSubTab("edit");
        setEditTab("clima");
    };

    const handleEdit = (log: any) => {
        setCurrentLog({
            ...log,
            weather_data: log.weather_data || { temp_max: 85, temp_min: 75, condition: "Soleado", source: "Registro previo" },
            delays_data: log.delays_data || [],
            notes_data: log.notes_data || { comments: "", media: [] },
            inspections_data: log.inspections_data || [],
            safety_violations_data: log.safety_violations_data || [],
            accidents_data: log.accidents_data || [],
            waste_data: log.waste_data || [],
            personnel_v2_data: log.personnel_v2_data || [],
            equipment_v2_data: log.equipment_v2_data || [],
            visitors_v2_data: log.visitors_v2_data || [],
            photos_v2_data: log.photos_v2_data || [],
        });
        setActiveSubTab("edit");
        setEditTab("clima");
    };

    const saveData = async (silent = false) => {
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
            if (!silent) alert("Daily Log guardado");
            fetchDailyLogs();
            if (onSaved) onSaved();
            setActiveSubTab("list");
        } catch (err: any) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useImperativeHandle(ref, () => ({ save: () => saveData(true) }));

    const handleInputChange = (field: string, value: any) => {
        setCurrentLog((prev: any) => ({ ...prev, [field]: value }));
        if (onDirty) onDirty();
    };

    if (activeSubTab === "list") {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-black text-slate-800">Bitácora Diaria</h2>
                    <button onClick={handleCreateNew} className="btn-primary flex items-center gap-2"><Plus size={18} /> Nuevo Registro</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {dailyLogs.map(log => (
                        <div key={log.id} className="card p-6 cursor-pointer border-l-8 border-primary hover:shadow-lg transition-all" onClick={() => handleEdit(log)}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="text-xs font-black bg-primary text-white px-2 py-1 rounded-full">{log.log_date}</span>
                                    <h3 className="font-bold text-lg mt-2">{log.inspector_name || "Sin inspector"}</h3>
                                    <p className="text-xs text-slate-400 mt-1">{log.location}</p>
                                </div>
                                <ChevronRight size={20} className="text-primary" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 bg-white/80 backdrop-blur-md z-10 py-4 border-b">
                <div className="flex items-center gap-4">
                    <button onClick={() => setActiveSubTab("list")} className="p-2 rounded-xl bg-slate-100"><ChevronLeft size={20} /></button>
                    <div>
                        <h2 className="text-lg font-black text-slate-800">{currentLog.log_date}</h2>
                        <p className="text-xs text-slate-400">{currentLog.inspector_name || "Nuevo Reporte"}</p>
                    </div>
                </div>
                <button onClick={() => saveData(false)} disabled={loading} className="btn-primary flex items-center gap-2">
                    <Save size={18} /> {loading ? "Guardando..." : "Guardar"}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-3xl border">
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400">Fecha</label>
                    <input type="date" className="input-field" value={currentLog.log_date} onChange={e => handleInputChange("log_date", e.target.value)} />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400">Inspector</label>
                    <input type="text" className="input-field" value={currentLog.inspector_name} onChange={e => handleInputChange("inspector_name", e.target.value)} />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400">Localización</label>
                    <input type="text" className="input-field" value={currentLog.location} onChange={e => handleInputChange("location", e.target.value)} />
                </div>
            </div>

            <div className="flex flex-col-reverse lg:flex-row gap-8">
                <div className="flex-grow card p-8 rounded-3xl min-h-[500px]">
                    <TabContent 
                        id={editTab} 
                        data={currentLog} 
                        update={(field: string, val: any) => handleInputChange(field, val)}
                    />
                </div>
                <div className="w-full lg:w-72 shrink-0 space-y-2">
                    {TAB_LIST.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setEditTab(tab.id)}
                            className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${
                                editTab === tab.id ? 'bg-primary text-white shadow-lg' : 'bg-white text-slate-500 hover:bg-slate-50'
                            }`}
                        >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black ${editTab === tab.id ? 'bg-white/20' : 'bg-slate-100 text-slate-300'}`}>{tab.num}</div>
                            <span className="text-sm font-bold">{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
});

export default DailyLogForm;

function TabContent({ id, data, update }: any) {
    if (!data) return null;
    switch (id) {
        case "clima":
            return (
                <div className="space-y-6">
                    <h4 className="font-bold">Clima</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input className="input-field" value={data.weather_data?.condition || ""} onChange={e => update("weather_data", { ...data.weather_data, condition: e.target.value })} placeholder="Condición" />
                        <div className="flex gap-2">
                            <input type="number" className="input-field" value={data.weather_data?.temp_max || ""} onChange={e => update("weather_data", { ...data.weather_data, temp_max: parseFloat(e.target.value) })} placeholder="Max" />
                            <input type="number" className="input-field" value={data.weather_data?.temp_min || ""} onChange={e => update("weather_data", { ...data.weather_data, temp_min: parseFloat(e.target.value) })} placeholder="Min" />
                        </div>
                    </div>
                </div>
            );
        case "retrasos":
            return <SectionEditor items={data.delays_data} setItems={(items: any) => update("delays_data", items)} emptyItem={{ tipo: DELAY_TYPES[0], inicio: "", fin: "" }} renderItem={(item: any, idx: number, updateItem: any) => (
                <div className="grid grid-cols-3 gap-2">
                    <select className="input-field" value={item.tipo} onChange={e => updateItem(idx, "tipo", e.target.value)}>
                        {DELAY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input type="time" className="input-field" value={item.inicio} onChange={e => updateItem(idx, "inicio", e.target.value)} />
                    <input type="time" className="input-field" value={item.fin} onChange={e => updateItem(idx, "fin", e.target.value)} />
                </div>
            )} />;
        case "notas":
            return (
                <div className="space-y-4">
                    <textarea rows={8} className="input-field" placeholder="Comentarios..." value={data.notes_data?.comments} onChange={e => update("notes_data", { ...data.notes_data, comments: e.target.value })} />
                    <MediaSection items={data.notes_data?.media || []} setItems={(media: any) => update("notes_data", { ...data.notes_data, media })} />
                </div>
            );
        case "inspecciones":
            return <SectionEditor items={data.inspections_data} setItems={(items: any) => update("inspections_data", items)} emptyItem={{ tipo: "", entidad: "", inicio: "", fin: "", comentarios: "", media: [] }} renderItem={(item: any, idx: number, updateItem: any) => (
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        <input className="input-field" placeholder="Entidad" value={item.entidad} onChange={e => updateItem(idx, "entidad", e.target.value)} />
                        <input className="input-field" placeholder="Tipo" value={item.tipo} onChange={e => updateItem(idx, "tipo", e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <input type="time" className="input-field" value={item.inicio} onChange={e => updateItem(idx, "inicio", e.target.value)} />
                        <input type="time" className="input-field" value={item.fin} onChange={e => updateItem(idx, "fin", e.target.value)} />
                    </div>
                    <textarea className="input-field" placeholder="Comentarios" value={item.comentarios} onChange={e => updateItem(idx, "comentarios", e.target.value)} />
                    <MediaSection items={item.media || []} setItems={(media: any) => updateItem(idx, "media", media)} />
                </div>
            )} />;
        case "seguridad":
            return <SectionEditor items={data.safety_violations_data} setItems={(items: any) => update("safety_violations_data", items)} emptyItem={{ infracción: "", comentarios: "", media: [] }} renderItem={(item: any, idx: number, updateItem: any) => (
                <div className="space-y-3">
                    <input className="input-field" placeholder="Infracción" value={item.infracción} onChange={e => updateItem(idx, "infracción", e.target.value)} />
                    <textarea className="input-field" placeholder="Comentarios" value={item.comentarios} onChange={e => updateItem(idx, "comentarios", e.target.value)} />
                    <MediaSection items={item.media || []} setItems={(media: any) => updateItem(idx, "media", media)} />
                </div>
            )} />;
        case "accidentes":
            return <SectionEditor items={data.accidents_data} setItems={(items: any) => update("accidents_data", items)} emptyItem={{ partes: "", comentarios: "", media: [] }} renderItem={(item: any, idx: number, updateItem: any) => (
                <div className="space-y-3">
                    <input className="input-field" placeholder="Partes involucradas" value={item.partes} onChange={e => updateItem(idx, "partes", e.target.value)} />
                    <textarea className="input-field" placeholder="Descripción" value={item.comentarios} onChange={e => updateItem(idx, "comentarios", e.target.value)} />
                    <MediaSection items={item.media || []} setItems={(media: any) => updateItem(idx, "media", media)} />
                </div>
            )} />;
        case "desperdicios":
            return <SectionEditor items={data.waste_data} setItems={(items: any) => update("waste_data", items)} emptyItem={{ material: "", cantidad: "" }} renderItem={(item: any, idx: number, updateItem: any) => (
                <div className="grid grid-cols-2 gap-2">
                    <input className="input-field" placeholder="Material" value={item.material} onChange={e => updateItem(idx, "material", e.target.value)} />
                    <input className="input-field" placeholder="Cantidad" value={item.cantidad} onChange={e => updateItem(idx, "cantidad", e.target.value)} />
                </div>
            )} />;
        case "personal":
            return <SectionEditor items={data.personnel_v2_data} setItems={(items: any) => update("personnel_v2_data", items)} emptyItem={{ compañia: "", horas: 0, nombres: "" }} renderItem={(item: any, idx: number, updateItem: any) => (
                <div className="grid grid-cols-3 gap-2">
                    <input className="input-field" placeholder="Compañía" value={item.compañia} onChange={e => updateItem(idx, "compañia", e.target.value)} />
                    <input className="input-field" placeholder="Nombres" value={item.nombres} onChange={e => updateItem(idx, "nombres", e.target.value)} />
                    <input type="number" className="input-field" value={item.horas} onChange={e => updateItem(idx, "horas", parseFloat(e.target.value))} />
                </div>
            )} />;
        case "equipo":
            return <SectionEditor items={data.equipment_v2_data} setItems={(items: any) => update("equipment_v2_data", items)} emptyItem={{ tipo: EQUIPMENT_TYPES[0], horas_op: 0 }} renderItem={(item: any, idx: number, updateItem: any) => (
                <div className="grid grid-cols-2 gap-2">
                    <select className="input-field" value={item.tipo} onChange={e => updateItem(idx, "tipo", e.target.value)}>
                        {EQUIPMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input type="number" className="input-field" value={item.horas_op} onChange={e => updateItem(idx, "horas_op", parseFloat(e.target.value))} />
                </div>
            )} />;
        case "visitantes":
            return <SectionEditor items={data.visitors_v2_data} setItems={(items: any) => update("visitors_v2_data", items)} emptyItem={{ visitante: "", horario: "" }} renderItem={(item: any, idx: number, updateItem: any) => (
                <div className="grid grid-cols-2 gap-2">
                    <input className="input-field" placeholder="Nombre" value={item.visitante} onChange={e => updateItem(idx, "visitante", e.target.value)} />
                    <input className="input-field" placeholder="Horario" value={item.horario} onChange={e => updateItem(idx, "horario", e.target.value)} />
                </div>
            )} />;
        case "fotos":
            return <MediaSection items={data.photos_v2_data || []} setItems={(media: any) => update("photos_v2_data", media)} fullGallery />;
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

function MediaSection({ items, setItems, fullGallery }: any) {
    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            setItems([...items, { id: Date.now().toString(), src: reader.result, type: file.type.startsWith('image/') ? 'image' : 'doc' }]);
        };
        reader.readAsDataURL(file);
    };
    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <label className="flex-1 p-3 border rounded-xl flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-50">
                    <Camera size={18} /> <span className="text-xs font-bold">Foto</span>
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
                </label>
                <label className="flex-1 p-3 border rounded-xl flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-50">
                    <Upload size={18} /> <span className="text-xs font-bold">Archivo</span>
                    <input type="file" className="hidden" onChange={handleFile} />
                </label>
            </div>
            <div className={`grid gap-2 ${fullGallery ? 'grid-cols-4' : 'grid-cols-3'}`}>
                {items.map((m: any) => (
                    <div key={m.id} className="aspect-square bg-slate-100 rounded-lg relative overflow-hidden">
                        {m.type === 'image' ? <img src={m.src} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><FileText size={20} /></div>}
                        <button onClick={() => setItems(items.filter((i: any) => i.id !== m.id))} className="absolute top-1 right-1 bg-white/80 rounded-full p-1 text-red-500 hover:bg-red-500 hover:text-white transition-all">
                            <Trash2 size={12} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
