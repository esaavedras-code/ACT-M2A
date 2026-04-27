"use client";

import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/lib/supabase";
import { 
    Save, FileText, Plus, Trash2, Download, 
    Upload, AlertCircle, Loader2, Printer,
    Cloud, Sun, Thermometer, MapPin, 
    Users, Truck, Package, Shield, 
    HardHat, Hammer, MessageSquare, 
    CheckCircle2, ChevronRight, ChevronLeft,
    Calendar, UserCheck, Search, Activity
} from "lucide-react";
import FloatingFormActions from "./FloatingFormActions";
import type { FormRef } from "./ProjectForm";

interface PersonalRow {
    nombre: string;
    clasificacion: string;
    horasReg: string;
    horasOT: string;
}

interface EquipoRow {
    descripcion: string;
    cantidad: string;
    horasOp: string;
    horasSB: string;
}

interface MaterialRow {
    descripcion: string;
    cantidad: string;
    unidad: string;
}

interface ACT45Data {
    fecha: string;
    informeNum: string;
    contratoNum: string;
    municipio: string;
    climaAM: string;
    climaPM: string;
    tempMax: string;
    tempMin: string;
    sueloCond: string;
    personal: PersonalRow[];
    equipo: EquipoRow[];
    materiales: MaterialRow[];
    seguridad: string;
    ingenieria: string;
    observaciones: string;
    firmaInspector: string;
    firmaRevisor: string;
}

const ACT45Form = forwardRef<FormRef, { projectId?: string, numAct?: string, onDirty?: () => void, onSaved?: () => void }>(function ACT45Form({ projectId, numAct, onDirty, onSaved }, ref) {
    const [activeTab, setActiveTab] = useState(0);
    const [loading, setLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    
    const [formData, setFormData] = useState<ACT45Data>({
        fecha: new Date().toISOString().split('T')[0],
        informeNum: "",
        contratoNum: "",
        municipio: "",
        climaAM: "Soleado",
        climaPM: "Soleado",
        tempMax: "",
        tempMin: "",
        sueloCond: "Seco",
        personal: [],
        equipo: [],
        materiales: [],
        seguridad: "",
        ingenieria: "",
        observaciones: "",
        firmaInspector: "",
        firmaRevisor: ""
    });

    useEffect(() => {
        if (projectId) fetchProjectDetails();
    }, [projectId]);

    const fetchProjectDetails = async () => {
        if (!projectId) return;
        const { data: proj } = await supabase.from("projects").select("name, contract_number, municipality, act45_last_report").eq("id", projectId).single();
        if (proj) {
            setFormData(prev => ({
                ...prev,
                ...(proj.act45_last_report || {}),
                contratoNum: proj.contract_number || prev.contratoNum,
                municipio: proj.municipality || prev.municipio,
                fecha: new Date().toISOString().split('T')[0]
            }));
        }
    };

    const saveData = async (silent = false) => {
        if (!projectId) return;
        setLoading(true);
        const { error } = await supabase.from("projects").update({
            act45_last_report: formData
        }).eq('id', projectId);
        setLoading(false);
        if (error && !silent) alert("Error al guardar: " + error.message);
        else if (!error) {
            if (!silent) alert("Informe ACT-45 guardado correctamente.");
            if (onSaved) onSaved();
        }
    };

    useImperativeHandle(ref, () => ({ save: () => saveData(true) }));

    const addItem = (type: 'personal' | 'equipo' | 'materiales') => {
        const newData = { ...formData };
        if (type === 'personal') newData.personal.push({ nombre: "", clasificacion: "", horasReg: "", horasOT: "" });
        if (type === 'equipo') newData.equipo.push({ descripcion: "", cantidad: "1", horasOp: "", horasSB: "" });
        if (type === 'materiales') newData.materiales.push({ descripcion: "", cantidad: "", unidad: "" });
        setFormData(newData);
        onDirty?.();
    };

    const removeItem = (type: 'personal' | 'equipo' | 'materiales', index: number) => {
        const newData = { ...formData };
        newData[type].splice(index, 1);
        setFormData(newData);
        onDirty?.();
    };

    const tabs = [
        { id: 'general', label: 'General & Clima', icon: <Sun size={18} /> },
        { id: 'recursos', label: 'Personal & Equipo', icon: <Truck size={18} /> },
        { id: 'notas', label: 'Notas & Firmas', icon: <MessageSquare size={18} /> }
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
                        <h2 className="text-2xl font-black tracking-tight flex items-center gap-2 uppercase">
                            ACT-45 Informe Diario
                        </h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Registro de Actividades de Campo</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => saveData(false)}
                        disabled={loading}
                        className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 rounded-2xl font-black text-xs transition-all shadow-lg"
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        GUARDAR DATOS
                    </button>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                {tabs.map((tab, idx) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(idx)}
                        className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl font-black text-[10px] transition-all border shrink-0 uppercase tracking-widest ${activeTab === idx 
                            ? 'bg-primary text-white border-primary shadow-xl shadow-primary/20' 
                            : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200 dark:bg-slate-900 dark:border-slate-800'}`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="min-h-[500px] animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
                
                {/* --- TAB 0: GENERAL --- */}
                {activeTab === 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="card-premium space-y-6">
                            <h3 className="section-title"><Activity size={18} className="text-blue-500" />Información del Reporte</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="input-label">Fecha</label>
                                    <input type="date" className="input-field font-bold" value={formData.fecha} onChange={e => setFormData({...formData, fecha: e.target.value})} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="input-label">Informe #</label>
                                    <input type="text" className="input-field font-bold" value={formData.informeNum} onChange={e => setFormData({...formData, informeNum: e.target.value})} placeholder="Ej. 001" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="input-label">Contrato #</label>
                                    <input type="text" className="input-field font-bold bg-slate-50" value={formData.contratoNum} readOnly />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="input-label">Municipio</label>
                                    <input type="text" className="input-field font-bold bg-slate-50" value={formData.municipio} readOnly />
                                </div>
                            </div>
                        </div>

                        <div className="card-premium space-y-6">
                            <h3 className="section-title"><Cloud size={18} className="text-emerald-500" />Condiciones Atmosféricas</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="input-label">Clima AM</label>
                                    <select className="input-field font-bold" value={formData.climaAM} onChange={e => setFormData({...formData, climaAM: e.target.value})}>
                                        <option>Soleado</option><option>Nublado</option><option>Lluvia Ligera</option><option>Lluvia Fuerte</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="input-label">Clima PM</label>
                                    <select className="input-field font-bold" value={formData.climaPM} onChange={e => setFormData({...formData, climaPM: e.target.value})}>
                                        <option>Soleado</option><option>Nublado</option><option>Lluvia Ligera</option><option>Lluvia Fuerte</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-1.5">
                                    <label className="input-label text-[8px]">Temp Max (°F)</label>
                                    <input type="number" className="input-field font-bold" value={formData.tempMax} onChange={e => setFormData({...formData, tempMax: e.target.value})} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="input-label text-[8px]">Temp Min (°F)</label>
                                    <input type="number" className="input-field font-bold" value={formData.tempMin} onChange={e => setFormData({...formData, tempMin: e.target.value})} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="input-label text-[8px]">Cond. Suelo</label>
                                    <select className="input-field font-bold text-[10px]" value={formData.sueloCond} onChange={e => setFormData({...formData, sueloCond: e.target.value})}>
                                        <option>Seco</option><option>Húmedo</option><option>Saturado</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- TAB 1: RECURSOS --- */}
                {activeTab === 1 && (
                    <div className="space-y-8">
                        {/* Personal */}
                        <div className="card-premium">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="section-title mb-0"><Users size={18} className="text-primary" />Personal en Obra</h3>
                                <button onClick={() => addItem('personal')} className="btn-add">AÑADIR EMPLEADO</button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-separate border-spacing-y-2">
                                    <thead>
                                        <tr className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                                            <th className="px-4">Nombre del Empleado</th>
                                            <th className="px-4">Clasificación</th>
                                            <th className="px-4 w-24">Horas Reg.</th>
                                            <th className="px-4 w-24">Horas OT</th>
                                            <th className="px-4 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {formData.personal.map((p, idx) => (
                                            <tr key={idx} className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl overflow-hidden group">
                                                <td className="p-2"><input type="text" className="bg-transparent w-full border-none focus:ring-0 font-bold text-xs" value={p.nombre} onChange={e => { const n = [...formData.personal]; n[idx].nombre = e.target.value; setFormData({...formData, personal: n})}} placeholder="Ej. Juan Pérez" /></td>
                                                <td className="p-2"><input type="text" className="bg-transparent w-full border-none focus:ring-0 font-bold text-xs" value={p.clasificacion} onChange={e => { const n = [...formData.personal]; n[idx].clasificacion = e.target.value; setFormData({...formData, personal: n})}} placeholder="Ej. Operador" /></td>
                                                <td className="p-2"><input type="number" className="bg-transparent w-full border-none focus:ring-0 font-bold text-xs text-center" value={p.horasReg} onChange={e => { const n = [...formData.personal]; n[idx].horasReg = e.target.value; setFormData({...formData, personal: n})}} /></td>
                                                <td className="p-2"><input type="number" className="bg-transparent w-full border-none focus:ring-0 font-bold text-xs text-center" value={p.horasOT} onChange={e => { const n = [...formData.personal]; n[idx].horasOT = e.target.value; setFormData({...formData, personal: n})}} /></td>
                                                <td className="p-2 pr-4 text-right"><button onClick={() => removeItem('personal', idx)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Equipo */}
                        <div className="card-premium">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="section-title mb-0"><Truck size={18} className="text-orange-500" />Equipo en Obra</h3>
                                <button onClick={() => addItem('equipo')} className="btn-add">AÑADIR EQUIPO</button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-separate border-spacing-y-2">
                                    <thead>
                                        <tr className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                                            <th className="px-4">Descripción del Equipo</th>
                                            <th className="px-4 w-24 text-center">Cant.</th>
                                            <th className="px-4 w-28 text-center">Horas Op.</th>
                                            <th className="px-4 w-28 text-center">Horas S.B.</th>
                                            <th className="px-4 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {formData.equipo.map((e, idx) => (
                                            <tr key={idx} className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl overflow-hidden">
                                                <td className="p-2"><input type="text" className="bg-transparent w-full border-none focus:ring-0 font-bold text-xs" value={e.descripcion} onChange={v => { const n = [...formData.equipo]; n[idx].descripcion = v.target.value; setFormData({...formData, equipo: n})}} placeholder="Ej. Retroexcavadora" /></td>
                                                <td className="p-2"><input type="number" className="bg-transparent w-full border-none focus:ring-0 font-bold text-xs text-center" value={e.cantidad} onChange={v => { const n = [...formData.equipo]; n[idx].cantidad = v.target.value; setFormData({...formData, equipo: n})}} /></td>
                                                <td className="p-2"><input type="number" className="bg-transparent w-full border-none focus:ring-0 font-bold text-xs text-center" value={e.horasOp} onChange={v => { const n = [...formData.equipo]; n[idx].horasOp = v.target.value; setFormData({...formData, equipo: n})}} /></td>
                                                <td className="p-2"><input type="number" className="bg-transparent w-full border-none focus:ring-0 font-bold text-xs text-center" value={e.horasSB} onChange={v => { const n = [...formData.equipo]; n[idx].horasSB = v.target.value; setFormData({...formData, equipo: n})}} /></td>
                                                <td className="p-2 pr-4 text-right"><button onClick={() => removeItem('equipo', idx)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- TAB 2: NOTAS --- */}
                {activeTab === 2 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="card-premium space-y-6">
                            <h3 className="section-title"><Shield size={18} className="text-red-500" />Notas de Campo</h3>
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="input-label">Seguridad en Obra</label>
                                    <textarea className="input-field min-h-[100px] text-xs font-medium py-3" value={formData.seguridad} onChange={e => setFormData({...formData, seguridad: e.target.value})} placeholder="Reporte de seguridad, accidentes, etc." />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="input-label">Ingeniería / Cambios</label>
                                    <textarea className="input-field min-h-[100px] text-xs font-medium py-3" value={formData.ingenieria} onChange={e => setFormData({...formData, ingenieria: e.target.value})} placeholder="Instrucciones del ingeniero, cambios de diseño..." />
                                </div>
                            </div>
                        </div>

                        <div className="card-premium space-y-6">
                            <h3 className="section-title"><UserCheck size={18} className="text-primary" />Validaciones</h3>
                            <div className="space-y-6">
                                <div className="space-y-1.5 text-center p-6 border-2 border-dashed border-slate-100 rounded-3xl">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Firma del Inspector</p>
                                    <input type="text" className="input-field text-center font-black italic border-none bg-slate-50 text-slate-400" value={formData.firmaInspector} onChange={e => setFormData({...formData, firmaInspector: e.target.value})} placeholder="NOMBRE DEL INSPECTOR" />
                                    <div className="h-[1px] w-full bg-slate-200 mt-2"></div>
                                </div>
                                <div className="space-y-1.5 text-center p-6 border-2 border-dashed border-slate-100 rounded-3xl">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Revisado Por</p>
                                    <input type="text" className="input-field text-center font-black italic border-none bg-slate-50 text-slate-400" value={formData.firmaRevisor} onChange={e => setFormData({...formData, firmaRevisor: e.target.value})} placeholder="NOMBRE DEL REVISOR" />
                                    <div className="h-[1px] w-full bg-slate-200 mt-2"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style jsx>{`
                .card-premium {
                    @apply bg-white dark:bg-slate-900/50 p-8 rounded-[40px] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-100 dark:border-slate-800 transition-all;
                }
                .section-title {
                    @apply font-black text-slate-900 dark:text-white text-xs uppercase tracking-[0.2em] flex items-center gap-3 mb-6;
                }
                .input-label {
                    @apply text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1;
                }
                .input-field {
                    @apply w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-primary/20 transition-all;
                }
                .btn-add {
                    @apply px-4 py-2 bg-primary/10 text-primary hover:bg-primary text-[9px] hover:text-white font-black rounded-xl transition-all uppercase tracking-widest border border-primary/20;
                }
            `}</style>

            {/* About */}
            <div className="pt-12 pb-8 border-t border-slate-100 dark:border-slate-800 text-center">
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.4em] mb-1">Software Design</p>
                <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">Ing. Enrique Saavedra Sada, PE</p>
            </div>
        </div>
    );
});

export default ACT45Form;
