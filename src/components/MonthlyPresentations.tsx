"use client";

import React, { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/lib/supabase";
import { 
    Presentation, Save, Plus, Trash2, Calendar, 
    FileText, AlertTriangle, ImageIcon, Camera, 
    Loader2, Download, ChevronLeft, ChevronRight, X
} from "lucide-react";
// import pptxgen from "pptxgenjs"; // Removed for dynamic import
import FloatingFormActions from "./FloatingFormActions";
import type { FormRef } from "./ProjectForm";

interface MonthlyPresentation {
    id?: string;
    project_id: string;
    presentation_date: string;
    activities: string;
    critical_points: string;
    photo1_path: string | null;
    photo2_path: string | null;
}

const PhotoPickerModal = ({ projectId, onSelect, onClose }: { projectId: string, onSelect: (url: string) => void, onClose: () => void }) => {
    const [photos, setPhotos] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchPhotos = async () => {
            setLoading(true);
            const { data } = await supabase
                .from("project_documents")
                .select("*")
                .eq("project_id", projectId)
                .eq("section", "photos");
            if (data) setPhotos(data);
            setLoading(false);
        };
        fetchPhotos();
    }, [projectId]);

    return (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 bg-primary text-white flex justify-between items-center">
                    <h3 className="font-black text-xs uppercase tracking-widest flex items-center gap-2">
                        <ImageIcon size={18} /> Galería de Fotos del Proyecto
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full"><X size={20} /></button>
                </div>
                <div className="flex-grow overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>
                    ) : photos.length === 0 ? (
                        <div className="text-center py-20 text-slate-400 font-bold uppercase text-[10px]">No hay fotos en la galería del proyecto</div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {photos.map(p => (
                                <button 
                                    key={p.id}
                                    onClick={() => {
                                        const { data: { publicUrl } } = supabase.storage.from("project-documents").getPublicUrl(p.storage_path);
                                        onSelect(publicUrl);
                                    }}
                                    className="group aspect-video relative rounded-xl overflow-hidden border border-slate-200 hover:border-primary transition-all hover:scale-105"
                                >
                                    <img src={supabase.storage.from("project-documents").getPublicUrl(p.storage_path).data.publicUrl} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Plus className="text-white" size={32} />
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/50 text-white text-[8px] font-bold truncate">
                                        {p.file_name}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <div className="p-4 border-t bg-slate-50 flex justify-end">
                    <button onClick={onClose} className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold text-[10px] uppercase">Cancelar</button>
                </div>
            </div>
        </div>
    );
};

const MonthlyPresentations = forwardRef<FormRef, { projectId?: string, numAct?: string, onDirty?: () => void, onSaved?: () => void }>(function MonthlyPresentations({ projectId, numAct, onDirty, onSaved }, ref) {
    const [presentations, setPresentations] = useState<MonthlyPresentation[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [formData, setFormData] = useState<MonthlyPresentation>({
        project_id: projectId || "",
        presentation_date: new Date().toISOString().split('T')[0],
        activities: "",
        critical_points: "",
        photo1_path: null,
        photo2_path: null
    });
    const [loading, setLoading] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [uploading, setUploading] = useState<string | null>(null);
    const [projectName, setProjectName] = useState("");
    const [showPicker, setShowPicker] = useState<'photo1_path' | 'photo2_path' | null>(null);

    useEffect(() => {
        if (projectId) {
            fetchPresentations();
            fetchProjectInfo();
        }
    }, [projectId]);

    const fetchProjectInfo = async () => {
        if (!projectId) return;
        const { data } = await supabase.from("projects").select("name").eq("id", projectId).single();
        if (data) setProjectName(data.name);
    };

    const fetchPresentations = async () => {
        if (!projectId) return;
        setLoading(true);
        const { data, error } = await supabase
            .from("monthly_presentations")
            .select("*")
            .eq("project_id", projectId)
            .order("presentation_date", { ascending: false });
        
        if (data) {
            setPresentations(data);
            if (data.length > 0 && !selectedId) {
                // Do not auto-select, let user choose or create new
            }
        }
        setLoading(false);
    };

    const handleSelect = (pres: MonthlyPresentation) => {
        setSelectedId(pres.id || null);
        setFormData(pres);
        setIsDirty(false);
    };

    const handleCreateNew = () => {
        setSelectedId(null);
        setFormData({
            project_id: projectId || "",
            presentation_date: new Date().toISOString().split('T')[0],
            activities: "",
            critical_points: "",
            photo1_path: null,
            photo2_path: null
        });
        setIsDirty(false);
    };

    const handleChange = (field: keyof MonthlyPresentation, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setIsDirty(true);
        if (onDirty) onDirty();
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'photo1_path' | 'photo2_path') => {
        const file = e.target.files?.[0];
        if (!file || !projectId) return;

        setUploading(field);
        try {
            const dateStr = new Date().toISOString().split('T')[0];
            const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_');
            const storagePath = `${projectId}/Presentaciones/${dateStr}/${Date.now()}_${safeName}`;
            
            const { error: uploadError } = await supabase.storage
                .from("project-documents")
                .upload(storagePath, file);

            if (uploadError) throw uploadError;

            // Register in project_documents so it shows in explorer
            await supabase.from("project_documents").insert([{
                project_id: projectId,
                file_name: file.name,
                doc_type: file.type,
                section: "presentations",
                storage_path: storagePath
            }]);

            const { data: { publicUrl } } = supabase.storage.from("project-documents").getPublicUrl(storagePath);

            setFormData(prev => ({ ...prev, [field]: publicUrl }));
            setIsDirty(true);
            if (onDirty) onDirty();
        } catch (err: any) {
            alert("Error al subir foto: " + err.message);
        } finally {
            setUploading(null);
        }
    };

    const saveData = async (silent = false) => {
        if (!projectId) return;
        setLoading(true);
        try {
            const payload = { ...formData, project_id: projectId };
            let error;

            if (selectedId) {
                const { error: err } = await supabase
                    .from("monthly_presentations")
                    .update(payload)
                    .eq("id", selectedId);
                error = err;
            } else {
                const { data, error: err } = await supabase
                    .from("monthly_presentations")
                    .insert([payload])
                    .select();
                if (data && data[0]) setSelectedId(data[0].id);
                error = err;
            }

            if (error) throw error;
            if (!silent) alert("Presentación mensual guardada");
            setIsDirty(false);
            fetchPresentations();
            if (onSaved) onSaved();
        } catch (err: any) {
            alert("Error al guardar: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    useImperativeHandle(ref, () => ({ save: () => saveData(true) }));

    const generatePPT = async () => {
        if (!formData.activities && !formData.critical_points) {
            alert("Por favor rellene la información antes de generar el reporte.");
            return;
        }

        const PptxGenJS = (await import("pptxgenjs")).default;
        const pres = new PptxGenJS();
        pres.layout = "LAYOUT_16x9";

        // Slide 1: Title
        const slide1 = pres.addSlide();
        slide1.background = { color: "F1F5F9" };
        slide1.addText("PRESENTACIÓN MENSUAL", { 
            x: 0, y: 1.5, w: "100%", h: 1, 
            align: "center", fontFace: "Arial", fontSize: 44, color: "0F172A", bold: true 
        });
        slide1.addText(projectName || "PROYECTO ACT", { 
            x: 0, y: 2.5, w: "100%", h: 0.5, 
            align: "center", fontSize: 28, color: "2563EB" 
        });
        slide1.addText(`Expediente: ${numAct || "---"}`, { 
            x: 0, y: 3.2, w: "100%", h: 0.4, 
            align: "center", fontSize: 18, color: "64748B" 
        });
        slide1.addText(`Fecha: ${new Date(formData.presentation_date).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()}`, { 
            x: 0, y: 4.5, w: "100%", h: 0.4, 
            align: "center", fontSize: 20, color: "334155", bold: true 
        });

        // Slide 2: Actividades
        const slide2 = pres.addSlide();
        slide2.addText("ACTIVIDADES REALIZÁNDOSE", { x: 0.5, y: 0.5, w: 9, h: 0.5, fontSize: 24, color: "2563EB", bold: true });
        slide2.addShape(pres.ShapeType.rect, { x: 0.5, y: 1.1, w: 9, h: 0.05, fill: { color: "2563EB" } });
        slide2.addText(formData.activities || "N/A", { x: 0.5, y: 1.5, w: 9, h: 3.5, fontSize: 14, color: "334155", valign: "top", bullet: true });

        // Slide 3: Puntos Críticos
        const slide3 = pres.addSlide();
        slide3.addText("PUNTOS CRÍTICOS A ATENDER", { x: 0.5, y: 0.5, w: 9, h: 0.5, fontSize: 24, color: "E11D48", bold: true });
        slide3.addShape(pres.ShapeType.rect, { x: 0.5, y: 1.1, w: 9, h: 0.05, fill: { color: "E11D48" } });
        slide3.addText(formData.critical_points || "N/A", { x: 0.5, y: 1.5, w: 9, h: 3.5, fontSize: 14, color: "334155", valign: "top", bullet: true });

        // Slide 4: Fotografías
        const slide4 = pres.addSlide();
        slide4.addText("REPORTE FOTOGRÁFICO", { x: 0.5, y: 0.3, w: 9, h: 0.4, fontSize: 20, color: "2563EB", bold: true });
        
        if (formData.photo1_path) {
            slide4.addImage({ path: formData.photo1_path, x: 0.5, y: 1, w: 4.3, h: 3.5 });
        } else {
            slide4.addText("Foto 1 no disponible", { x: 0.5, y: 1, w: 4.3, h: 3.5, align: "center", fontSize: 12, color: "CBD5E1" });
        }

        if (formData.photo2_path) {
            slide4.addImage({ path: formData.photo2_path, x: 5.2, y: 1, w: 4.3, h: 3.5 });
        } else {
            slide4.addText("Foto 2 no disponible", { x: 5.2, y: 1, w: 4.3, h: 3.5, align: "center", fontSize: 12, color: "CBD5E1" });
        }

        const fileName = `Presentacion_${numAct || "Proyecto"}_${formData.presentation_date}.pptx`;
        
        // Export to Blob for uploading
        const blob = await pres.write({ outputType: "blob" }) as Blob;
        
        // Download for user
        pres.writeFile({ fileName });

        // Upload to Supabase
        if (projectId) {
            const dateStr = formData.presentation_date;
            const storagePath = `${projectId}/Presentaciones/${dateStr}/${fileName}`;
            
            await supabase.storage
                .from("project-documents")
                .upload(storagePath, blob, { upsert: true });

            await supabase.from("project_documents").insert([{
                project_id: projectId,
                file_name: fileName,
                doc_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                section: "presentations",
                storage_path: storagePath
            }]);
        }
    };

    return (
        <div className="w-full space-y-6 pb-20">
            <div className="sticky top-0 z-40 bg-[#F8FAFC]/95 dark:bg-[#020617]/95 backdrop-blur-md pt-6 pb-4 -mx-4 px-4 md:-mx-8 md:px-8 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <Presentation className="text-primary" />
                    Presentaciones Mensuales
                </h2>
                <div className="flex gap-2">
                    <button 
                        onClick={handleCreateNew}
                        className="btn-secondary px-4 py-2 text-xs flex items-center gap-2"
                    >
                        <Plus size={14} /> Nueva Presentación
                    </button>
                    <button 
                        onClick={generatePPT}
                        disabled={loading}
                        className="btn-primary bg-orange-600 hover:bg-orange-700 px-4 py-2 text-xs flex items-center gap-2 shadow-orange-200"
                    >
                        <Download size={14} /> Generar PowerPoint
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Sidebar: Historico */}
                <div className="lg:col-span-1 space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">Histórico</label>
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
                        {presentations.length === 0 ? (
                            <div className="p-4 text-center border-2 border-dashed border-slate-100 rounded-2xl text-[10px] text-slate-400 font-bold uppercase">
                                No hay presentaciones
                            </div>
                        ) : (
                            presentations.map(p => (
                                <button 
                                    key={p.id}
                                    onClick={() => handleSelect(p)}
                                    className={`w-full text-left p-3 rounded-2xl border transition-all ${selectedId === p.id ? 'bg-primary/5 border-primary shadow-sm' : 'bg-white border-slate-100 hover:border-slate-300'}`}
                                >
                                    <p className="text-xs font-black text-slate-700">
                                        {new Date(p.presentation_date).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()}
                                    </p>
                                    <p className="text-[10px] text-slate-400 font-medium">{p.presentation_date}</p>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Formulario Principal */}
                <div className="lg:col-span-3 card bg-white dark:bg-slate-900 border-slate-200 p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Calendar size={12} className="text-primary" /> Fecha de Presentación
                            </label>
                            <input 
                                type="date" 
                                className="input-field text-sm"
                                value={formData.presentation_date}
                                onChange={e => handleChange('presentation_date', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <FileText size={12} className="text-primary" /> Actividades Realizándose
                            </label>
                            <textarea 
                                rows={6}
                                placeholder="Describa las actividades realizadas durante este mes..."
                                className="input-field text-sm resize-none"
                                value={formData.activities}
                                onChange={e => handleChange('activities', e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 text-rose-500">
                                <AlertTriangle size={12} /> Puntos Críticos a Atender
                            </label>
                            <textarea 
                                rows={4}
                                placeholder="Mencione los problemas o limitaciones críticas que requieren atención..."
                                className="input-field border-rose-100 focus:border-rose-400 focus:ring-rose-400/20 text-sm resize-none"
                                value={formData.critical_points}
                                onChange={e => handleChange('critical_points', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-slate-100">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <ImageIcon size={12} className="text-primary" /> Fotografías de Progreso
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Photo 1 */}
                            <div className="space-y-3">
                                <div className="aspect-video bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 overflow-hidden flex items-center justify-center relative group">
                                    {formData.photo1_path ? (
                                        <>
                                            <img src={formData.photo1_path} alt="Foto 1" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                 <label className="p-2 bg-white rounded-full text-primary cursor-pointer hover:scale-110 transition-transform">
                                                    <Camera size={20} />
                                                    <input type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'photo1_path')} />
                                                </label>
                                                <button onClick={() => setFormData(p => ({...p, photo1_path: null}))} className="p-2 bg-white rounded-full text-rose-500 hover:scale-110 transition-transform">
                                                    <Trash2 size={20} />
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center gap-3">
                                            {uploading === 'photo1_path' ? <Loader2 className="animate-spin text-primary" /> : <Plus size={32} className="text-slate-300" />}
                                            <div className="flex flex-col gap-2 w-full px-6">
                                                <label className="cursor-pointer bg-primary text-white py-2 rounded-xl text-[9px] font-black uppercase text-center hover:bg-blue-700 transition-colors">
                                                    Subir Foto 1
                                                    <input type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'photo1_path')} />
                                                </label>
                                                <button 
                                                    onClick={() => setShowPicker('photo1_path')}
                                                    className="bg-emerald-500 text-white py-2 rounded-xl text-[9px] font-black uppercase hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
                                                >
                                                    <ImageIcon size={12} /> Galería PACT
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Photo 2 */}
                            <div className="space-y-3">
                                <div className="aspect-video bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 overflow-hidden flex items-center justify-center relative group">
                                    {formData.photo2_path ? (
                                        <>
                                            <img src={formData.photo2_path} alt="Foto 2" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                 <label className="p-2 bg-white rounded-full text-primary cursor-pointer hover:scale-110 transition-transform">
                                                    <Camera size={20} />
                                                    <input type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'photo2_path')} />
                                                </label>
                                                <button onClick={() => setShowPicker('photo2_path')} className="p-2 bg-white rounded-full text-emerald-500 hover:scale-110 transition-transform">
                                                    <ImageIcon size={20} />
                                                </button>
                                                <button onClick={() => setFormData(p => ({...p, photo2_path: null}))} className="p-2 bg-white rounded-full text-rose-500 hover:scale-110 transition-transform">
                                                    <Trash2 size={20} />
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center gap-3">
                                            {uploading === 'photo2_path' ? <Loader2 className="animate-spin text-primary" /> : <Plus size={32} className="text-slate-300" />}
                                            <div className="flex flex-col gap-2 w-full px-6">
                                                <label className="cursor-pointer bg-primary text-white py-2 rounded-xl text-[9px] font-black uppercase text-center hover:bg-blue-700 transition-colors">
                                                    Subir Foto 2
                                                    <input type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'photo2_path')} />
                                                </label>
                                                <button 
                                                    onClick={() => setShowPicker('photo2_path')}
                                                    className="bg-emerald-500 text-white py-2 rounded-xl text-[9px] font-black uppercase hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
                                                >
                                                    <ImageIcon size={12} /> Galería PACT
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <FloatingFormActions 
                actions={[
                    {
                        label: loading ? "Guardando..." : "Guardar",
                        icon: <Save />,
                        onClick: () => saveData(false),
                        description: "Guardar esta presentación mensual",
                        variant: 'primary',
                        disabled: loading
                    }
                ]} 
            />

            {showPicker && (
                <PhotoPickerModal 
                    projectId={projectId || ""} 
                    onSelect={(url) => {
                        setFormData(p => ({ ...p, [showPicker]: url }));
                        setIsDirty(true);
                        setShowPicker(null);
                        if (onDirty) onDirty();
                    }}
                    onClose={() => setShowPicker(null)}
                />
            )}
        </div>
    );
});

export default MonthlyPresentations;
