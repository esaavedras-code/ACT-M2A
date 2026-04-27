"use client";

import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/lib/supabase";
import { 
    Save, FileText, Plus, Trash2, Download, 
    Upload, AlertCircle, Loader2, Printer,
    Search, ClipboardCheck, AlertTriangle,
    MapPin, User, Users, CheckCircle2,
    XCircle, MinusCircle, Info, ShieldAlert,
    ChevronRight, ChevronLeft, Calendar,
    UserCheck, FileSearch, MessageSquare
} from "lucide-react";
import FloatingFormActions from "./FloatingFormActions";
import type { FormRef } from "./ProjectForm";

interface InspeccionItem {
    partida: string;
    descripcion: string;
    ubicacion: string;
    estatus: "Cumple" | "No Cumple" | "N/A" | "";
    comentarios: string;
}

interface ACT96Data {
    fecha: string;
    proyectoNum: string;
    contratoNum: string;
    municipio: string;
    inspectorNombre: string;
    contratistaNombre: string;
    items: InspeccionItem[];
    observaciones: string;
    accionesCorrectivas: string;
    fechaLimite: string;
    firmaInspector: string;
    firmaContratista: string;
}

const ACT96Form = forwardRef<FormRef, { projectId?: string, numAct?: string, onDirty?: () => void, onSaved?: () => void }>(function ACT96Form({ projectId, numAct, onDirty, onSaved }, ref) {
    const [activeTab, setActiveTab] = useState(0);
    const [loading, setLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    
    const [formData, setFormData] = useState<ACT96Data>({
        fecha: new Date().toISOString().split('T')[0],
        proyectoNum: numAct || "",
        contratoNum: "",
        municipio: "",
        inspectorNombre: "",
        contratistaNombre: "",
        items: [],
        observaciones: "",
        accionesCorrectivas: "",
        fechaLimite: "",
        firmaInspector: "",
        firmaContratista: ""
    });

    useEffect(() => {
        if (projectId) fetchProjectDetails();
    }, [projectId]);

    const fetchProjectDetails = async () => {
        if (!projectId) return;
        const { data: proj } = await supabase.from("projects").select("name, contract_number, municipality, act96_last_report").eq("id", projectId).single();
        if (proj) {
            setFormData(prev => ({
                ...prev,
                ...(proj.act96_last_report || {}),
                contratoNum: proj.contract_number || prev.contratoNum,
                municipio: proj.municipality || prev.municipio,
                proyectoNum: numAct || prev.proyectoNum,
                fecha: new Date().toISOString().split('T')[0]
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
        if (error && !silent) alert("Error al guardar: " + error.message);
        else if (!error) {
            if (!silent) alert("Informe de Inspección ACT-96 guardado correctamente.");
            if (onSaved) onSaved();
        }
    };

    useImperativeHandle(ref, () => ({ save: () => saveData(true) }));

    const addItem = () => {
        setFormData({
            ...formData,
            items: [...formData.items, { partida: "", descripcion: "", ubicacion: "", estatus: "", comentarios: "" }]
        });
        onDirty?.();
    };

    const removeItem = (index: number) => {
        const newItems = [...formData.items];
        newItems.splice(index, 1);
        setFormData({ ...formData, items: newItems });
        onDirty?.();
    };

    const tabs = [
        { id: 'encabezado', label: 'Info General', icon: <Info size={18} /> },
        { id: 'inspeccion', label: 'Ítems Inspeccionados', icon: <ClipboardCheck size={18} /> },
        { id: 'conclusiones', label: 'Conclusiones & Firmas', icon: <ShieldAlert size={18} /> }
    ];

    return (
        <div className="w-full space-y-6">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-[#F8FAFC]/95 dark:bg-[#020617]/95 backdrop-blur-md pt-6 pb-4 -mx-4 px-4 md:-mx-8 md:px-8 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                        <FileSearch className="text-blue-600" size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black tracking-tight flex items-center gap-2 uppercase">
                            ACT-96 Informe de Inspección
                        </h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Registro de Cumplimiento y Calidad</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => saveData(false)}
                        disabled={loading}
                        className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 rounded-2xl font-black text-xs transition-all shadow-lg"
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        GUARDAR INFORME
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
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xl shadow-blue-200' 
                            : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200 dark:bg-slate-900 dark:border-slate-800'}`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="min-h-[500px] animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
                
                {/* --- TAB 0: ENCABEZADO --- */}
                {activeTab === 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="card-premium space-y-6">
                            <h3 className="section-title"><Info size={18} className="text-blue-500" />Datos del Proyecto</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="input-label">Fecha de Inspección</label>
                                    <input type="date" className="input-field font-bold" value={formData.fecha} onChange={e => setFormData({...formData, fecha: e.target.value})} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="input-label">Proyecto No.</label>
                                    <input type="text" className="input-field font-bold bg-slate-50" value={formData.proyectoNum} readOnly />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="input-label">Contrato No.</label>
                                    <input type="text" className="input-field font-bold bg-slate-50" value={formData.contratoNum} readOnly />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="input-label">Municipio</label>
                                    <input type="text" className="input-field font-bold bg-slate-50" value={formData.municipio} readOnly />
                                </div>
                            </div>
                        </div>

                        <div className="card-premium space-y-6">
                            <h3 className="section-title"><Users size={18} className="text-emerald-500" />Responsables</h3>
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="input-label">Inspector de Obra</label>
                                    <input type="text" className="input-field font-bold" value={formData.inspectorNombre} onChange={e => setFormData({...formData, inspectorNombre: e.target.value})} placeholder="Nombre completo del inspector" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="input-label">Representante Contratista</label>
                                    <input type="text" className="input-field font-bold" value={formData.contratistaNombre} onChange={e => setFormData({...formData, contratistaNombre: e.target.value})} placeholder="Nombre del representante" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- TAB 1: INSPECCION --- */}
                {activeTab === 1 && (
                    <div className="card-premium">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="section-title mb-0"><ClipboardCheck size={18} className="text-blue-600" />Evaluación de Partidas</h3>
                            <button onClick={addItem} className="btn-add-blue">AÑADIR PARTIDA</button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-separate border-spacing-y-2">
                                <thead>
                                    <tr className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                                        <th className="px-4 w-24">Partida #</th>
                                        <th className="px-4">Descripción de Actividad</th>
                                        <th className="px-4 w-32">Ubicación (Est.)</th>
                                        <th className="px-4 w-48 text-center">Status</th>
                                        <th className="px-4">Comentarios</th>
                                        <th className="px-4 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {formData.items.map((item, idx) => (
                                        <tr key={idx} className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl overflow-hidden animate-in slide-in-from-left duration-300">
                                            <td className="p-2"><input type="text" className="bg-transparent w-full border-none focus:ring-0 font-bold text-xs" value={item.partida} onChange={e => { const n = [...formData.items]; n[idx].partida = e.target.value; setFormData({...formData, items: n})}} placeholder="Ej. 601" /></td>
                                            <td className="p-2"><input type="text" className="bg-transparent w-full border-none focus:ring-0 font-bold text-xs" value={item.descripcion} onChange={e => { const n = [...formData.items]; n[idx].descripcion = e.target.value; setFormData({...formData, items: n})}} placeholder="Ej. Aceras de Hormigón" /></td>
                                            <td className="p-2"><input type="text" className="bg-transparent w-full border-none focus:ring-0 font-bold text-xs" value={item.ubicacion} onChange={e => { const n = [...formData.items]; n[idx].ubicacion = e.target.value; setFormData({...formData, items: n})}} placeholder="Ej. 10+50" /></td>
                                            <td className="p-2">
                                                <div className="flex gap-1 justify-center">
                                                    {[
                                                        { val: "Cumple", icon: <CheckCircle2 size={12} />, color: "emerald" },
                                                        { val: "No Cumple", icon: <XCircle size={12} />, color: "red" },
                                                        { val: "N/A", icon: <MinusCircle size={12} />, color: "slate" }
                                                    ].map((opt) => (
                                                        <button
                                                            key={opt.val}
                                                            onClick={() => {
                                                                const n = [...formData.items];
                                                                n[idx].estatus = opt.val as any;
                                                                setFormData({ ...formData, items: n });
                                                                onDirty?.();
                                                            }}
                                                            className={`p-1.5 rounded-lg border transition-all flex items-center gap-1 text-[8px] font-black uppercase ${item.estatus === opt.val 
                                                                ? `bg-${opt.color}-600 text-white border-${opt.color}-600 shadow-md` 
                                                                : 'bg-white dark:bg-slate-800 text-slate-400 border-slate-100'}`}
                                                            title={opt.val}
                                                        >
                                                            {opt.icon}
                                                        </button>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="p-2"><input type="text" className="bg-transparent w-full border-none focus:ring-0 font-bold text-xs" value={item.comentarios} onChange={e => { const n = [...formData.items]; n[idx].comentarios = e.target.value; setFormData({...formData, items: n})}} placeholder="Nota de campo" /></td>
                                            <td className="p-2 pr-4 text-right"><button onClick={() => removeItem(idx)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button></td>
                                        </tr>
                                    ))}
                                    {formData.items.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="py-20 text-center opacity-20">
                                                <ClipboardCheck size={48} className="mx-auto mb-4" />
                                                <p className="font-black uppercase tracking-widest text-[10px]">No hay ítems registrados</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* --- TAB 2: CONCLUSIONES --- */}
                {activeTab === 2 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <div className="card-premium space-y-6">
                                <h3 className="section-title"><AlertTriangle size={18} className="text-red-500" />Acciones Correctivas</h3>
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="input-label">Descripción del Defecto</label>
                                        <textarea className="input-field min-h-[120px] text-xs font-medium py-3 border-red-50 dark:border-red-900/20" value={formData.accionesCorrectivas} onChange={e => setFormData({...formData, accionesCorrectivas: e.target.value})} placeholder="Detalle los hallazgos que no cumplen con las especificaciones..." />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="input-label">Fecha Límite para Corrección</label>
                                        <input type="date" className="input-field font-bold border-red-50" value={formData.fechaLimite} onChange={e => setFormData({...formData, fechaLimite: e.target.value})} />
                                    </div>
                                </div>
                            </div>

                            <div className="card-premium space-y-6">
                                <h3 className="section-title"><MessageSquare size={18} className="text-blue-500" />Observaciones Generales</h3>
                                <textarea className="input-field min-h-[120px] text-xs font-medium py-3" value={formData.observaciones} onChange={e => setFormData({...formData, observaciones: e.target.value})} placeholder="Resumen general de la inspección de hoy..." />
                            </div>
                        </div>

                        <div className="card-premium space-y-6">
                            <h3 className="section-title"><UserCheck size={18} className="text-primary" />Firmas de Validación</h3>
                            <div className="space-y-8">
                                <div className="space-y-2 text-center p-8 border-2 border-dashed border-slate-100 rounded-[32px] bg-slate-50/50">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Inspector de Obra (ACT)</p>
                                    <input type="text" className="input-field text-center font-black italic border-none bg-white shadow-sm" value={formData.firmaInspector} onChange={e => setFormData({...formData, firmaInspector: e.target.value})} placeholder="ESCRIBA SU NOMBRE" />
                                    <p className="text-[8px] font-bold text-slate-300 mt-2 italic uppercase tracking-widest">Firma Digital Registrada</p>
                                </div>

                                <div className="space-y-2 text-center p-8 border-2 border-dashed border-slate-100 rounded-[32px] bg-slate-50/50">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Representante del Contratista</p>
                                    <input type="text" className="input-field text-center font-black italic border-none bg-white shadow-sm" value={formData.firmaContratista} onChange={e => setFormData({...formData, firmaContratista: e.target.value})} placeholder="ESCRIBA SU NOMBRE" />
                                    <p className="text-[8px] font-bold text-slate-300 mt-2 italic uppercase tracking-widest">Firma Digital Registrada</p>
                                </div>

                                <div className="p-6 bg-blue-50 dark:bg-blue-900/10 rounded-3xl border border-blue-100">
                                    <p className="text-[9px] font-bold text-blue-600 leading-relaxed italic">
                                        Nota: Este documento constituye un registro oficial de inspección. El cumplimiento de las acciones correctivas será verificado en la próxima visita de campo.
                                    </p>
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
                    @apply w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-blue-500/20 transition-all;
                }
                .btn-add-blue {
                    @apply px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 text-[9px] font-black rounded-xl transition-all uppercase tracking-widest shadow-lg shadow-blue-200;
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

export default ACT96Form;
