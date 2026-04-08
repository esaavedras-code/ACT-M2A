"use client";

import React, { useState, useRef, forwardRef, useImperativeHandle } from "react";
import { 
    Mic, Upload, FileAudio, Settings, FileJson, 
    FileText, CheckCircle2, AlertCircle, Loader2,
    Languages, Speaker, Clock, Activity, ShieldCheck,
    Save, Trash2, Download, Copy
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import FloatingFormActions from "./FloatingFormActions";
import type { FormRef } from "./ProjectForm";
import { generateMinutesReport } from "@/lib/generateMinutesReport";
import { downloadBlob } from "@/lib/reportLogic";

const MinutesForm = forwardRef<FormRef, { projectId?: string, projectName?: string, numAct?: string, onDirty?: () => void, onSaved?: () => void }>(function MinutesForm({ projectId, projectName, numAct, onDirty, onSaved }, ref) {
    const [loading, setLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [recording, setRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const [recordTime, setRecordTime] = useState(0);
    const timerRef = useRef<any>(null);

    // Config
    const [language, setLanguage] = useState("Español");
    const [config, setConfig] = useState({
        diarization: true,
        timestamps: true,
        extractActions: true,
        detectItems: true
    });

    // Results
    const [activeTab, setActiveTab] = useState<"upload" | "result">("upload");
    const [result, setResult] = useState<{
        id?: string;
        summary: string;
        minutes: string;
        json: string;
        audio_url?: string;
        meeting_num?: string;
        meeting_time?: string;
        meeting_date?: string;
        attendees?: string;
    } | null>(null);

    useImperativeHandle(ref, () => ({
        save: async () => {
            if (result) await handleSaveToDB();
        },
        isDirty: () => !!selectedFile || !!result
    }));

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const validFormats = ["audio/mpeg", "audio/wav", "audio/m4a", "audio/x-m4a", "audio/mp3", "audio/webm"];
        if (!validFormats.includes(file.type) && !file.name.endsWith(".m4a")) {
            alert("Formato no válido. Use MP3, WAV o M4A.");
            return;
        }
        setSelectedFile(file);
        setAudioUrl(URL.createObjectURL(file));
        if (onDirty) onDirty();
        // Auto-save registro de archivo en BD
        autoSaveFileRecord(file);
    };

    const autoSaveFileRecord = async (file: File) => {
        if (!projectId) return;
        try {
            const dateFolder = new Date().toISOString().split('T')[0];
            const safeName = file.name
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-zA-Z0-9._-]/g, '_');
            const fileName = `${projectId}/minutes/${dateFolder}/${Date.now()}_${safeName}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from("project-documents")
                .upload(fileName, file);
            if (!uploadError && uploadData) {
                const { data: urlData } = supabase.storage.from("project-documents").getPublicUrl(fileName);
                const uploadedUrl = urlData.publicUrl;
                await supabase.from("project_documents").insert({
                    project_id: projectId,
                    doc_type: "Minuta (Audio / Grabación)",
                    section: "minutes",
                    file_name: file.name,
                    storage_path: fileName
                });
                // Guardar minuta base en BD
                await supabase.from("meeting_minutes").insert({
                    project_id: projectId,
                    meeting_date: new Date().toISOString().split('T')[0],
                    content: `Audio subido: ${file.name}`,
                    participants: { summary: "", json: "" },
                    audio_url: uploadedUrl
                });
                if (onSaved) onSaved();
            }
        } catch (err) {
            console.error("Auto-save error:", err);
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            const chunks: Blob[] = [];
            recorder.ondataavailable = (e) => chunks.push(e.data);
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                const file = new File([blob], `Grabacion_${new Date().getTime()}.webm`, { type: 'audio/webm' });
                setSelectedFile(file);
                setAudioUrl(URL.createObjectURL(file));
                stream.getTracks().forEach(track => track.stop());
            };
            recorder.start();
            mediaRecorderRef.current = recorder;
            setRecording(true);
            setRecordTime(0);
            timerRef.current = setInterval(() => setRecordTime(t => t + 1), 1000);
        } catch (err) {
            console.error("Error al grabar:", err);
            alert("No se pudo acceder al micrófono.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            setRecording(false);
            clearInterval(timerRef.current);
            if (onDirty) onDirty();
        }
    };

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    const handleSaveToDB = async (finalResult?: any) => {
        const dataToSave = finalResult || result;
        if (!dataToSave || !projectId) return;

        try {
            const { error } = await supabase.from("meeting_minutes").upsert({
                id: dataToSave.id,
                project_id: projectId,
                meeting_date: new Date().toISOString().split('T')[0],
                content: dataToSave.minutes,
                participants: { summary: dataToSave.summary, json: dataToSave.json },
                audio_url: dataToSave.audio_url
            });
            if (error) throw error;
        } catch (err) {
            console.error("Error saving to DB:", err);
        }
    };

    const handleProcessAudio = async () => {
        if (!selectedFile || !projectId) return;
        setLoading(true);
        setUploadProgress(10);

        try {
            // Upload to Supabase Storage
            const dateFolder = new Date().toISOString().split('T')[0];
            const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
            const fileName = `${projectId}/minutes/${dateFolder}/${Date.now()}_${safeName}`;
            
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from("project-documents")
                .upload(fileName, selectedFile);

            if (uploadError) {
                console.error("Storage upload failed:", uploadError);
                throw uploadError;
            }

            let uploadedUrl = "";
            if (uploadData) {
                const { data: urlData } = supabase.storage.from("project-documents").getPublicUrl(fileName);
                uploadedUrl = urlData.publicUrl;

                // Also register in project_documents so it shows up in the explorer
                await supabase.from("project_documents").insert({
                    project_id: projectId,
                    doc_type: "Minuta (Audio / Grabación)",
                    section: "minutes",
                    file_name: selectedFile.name,
                    storage_path: fileName
                });
            }

            setUploadProgress(50);

            // Simulation of AI processing
            setTimeout(async () => {
                setUploadProgress(100);
                const mockResult = {
                    summary: `### RESUMEN EJECUTIVO\n- **Proyecto:** ${projectName || 'Proyecto ACT'}\n- **Estado:** ${numAct || 'ACT-XXXXXX'}\n- **Avance:** 45% aproximado\n- **Hitos:** Revisión de drenajes y pavimentación completada.`,
                    minutes: `### 1. Actas anteriores: Aprobadas.\n### 2. Construction permit: El permiso está vigente hasta el 2026.\n### 3. Owner Controlled Insurance Program (OCIP) Claims: No hay reclamos pendientes.\n### 4. Construction Progress Tracking: Según el Earned Value, el proyecto está en un 45%.\n### 5. Main Critical Activities: Vaciado de asfalto en el km 5.\n### 11. Administration (AD): Pendiente aprobación de CHO #3.\n### 13. Substantial Completion: Proyectada para julio 2026.`,
                    json: JSON.stringify({ sections: 13, status: "complete" }, null, 2),
                    audio_url: uploadedUrl
                };
                
                setResult(mockResult);
                await handleSaveToDB(mockResult);
                
                setActiveTab("result");
                setLoading(false);
                if (onSaved) onSaved();
            }, 2000);

        } catch (error) {
            console.error("Error processing audio:", error);
            alert("Error al procesar el audio.");
            setLoading(false);
        }
    };

    const handleDownloadPdf = async () => {
        if (!result || !projectId) return;
        setLoading(true);
        try {
            const blob = await generateMinutesReport(projectId, result);
            downloadBlob(blob, `Minuta_Semanal_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (err) {
            console.error(err);
            alert("Error al generar PDF");
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        alert("Copiado al portapapeles");
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Sticky Header */}
            <div className="sticky top-0 z-40 bg-[#F8FAFC]/95 dark:bg-[#020617]/95 backdrop-blur-md pt-6 pb-4 -mx-4 px-4 md:-mx-8 md:px-8 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Mic className="text-primary" />
                    9. Minutas de Reunión
                </h2>
                {/* Las acciones principales ahora son flotantes */}
            </div>
            {/* Header Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card p-6 border-l-4 border-l-primary flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                        <Mic size={24} />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-500 uppercase">Estado</h3>
                        <p className="text-lg font-black text-slate-900 dark:text-white">
                            {result ? "Procesado" : (selectedFile ? "Listo para procesar" : (recording ? "Grabando..." : "Sin audio"))}
                        </p>
                    </div>
                </div>
                {recording && (
                    <div className="card p-6 border-l-4 border-l-red-500 flex items-center gap-4 animate-pulse">
                        <div className="p-3 bg-red-100 rounded-2xl text-red-600">
                            <Clock size={24} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-500 uppercase">Tiempo</h3>
                            <p className="text-lg font-black text-red-600">{formatTime(recordTime)}</p>
                        </div>
                    </div>
                )}
            </div>

            {activeTab === "upload" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Upload/Record Section */}
                    <div className="lg:col-span-2 space-y-6">
                        {!recording ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="card p-10 border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-primary/50 transition-all flex flex-col items-center justify-center text-center group cursor-pointer relative">
                                    <input 
                                        type="file" 
                                        className="absolute inset-0 opacity-0 cursor-pointer" 
                                        accept=".mp3,.wav,.m4a,.webm"
                                        onChange={handleFileChange}
                                    />
                                    <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-primary transition-all mb-4">
                                        {selectedFile ? <FileAudio size={32} /> : <Upload size={32} />}
                                    </div>
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                        {selectedFile ? selectedFile.name : "Subir archivo"}
                                    </h3>
                                </div>
                                
                                <button 
                                    onClick={startRecording}
                                    className="card p-10 border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-red-500/50 transition-all flex flex-col items-center justify-center text-center group"
                                >
                                    <div className="w-16 h-16 bg-red-50 dark:bg-red-900/10 rounded-2xl flex items-center justify-center text-red-400 group-hover:text-red-600 transition-all mb-4">
                                        <Mic size={32} />
                                    </div>
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Grabar reunión</h3>
                                </button>
                            </div>
                        ) : (
                            <div className="card p-12 flex flex-col items-center justify-center text-center space-y-6 bg-red-50/50 border-red-200 border-2 border-dashed">
                                <div className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center text-white scale-110 animate-pulse shadow-xl shadow-red-200">
                                    <Mic size={40} />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-2xl font-black text-red-600">Grabando...</h3>
                                    <p className="text-slate-500 font-bold">{formatTime(recordTime)}</p>
                                </div>
                                <button 
                                    onClick={stopRecording}
                                    className="px-8 py-3 bg-red-600 text-white rounded-2xl font-black shadow-lg hover:bg-red-700 transition-all"
                                >
                                    Detener y Usar
                                </button>
                            </div>
                        )}

                        {loading && (
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm font-bold">
                                    <span>Procesando audio...</span>
                                    <span>{uploadProgress}%</span>
                                </div>
                                <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
                                    <div 
                                        className="bg-primary h-full transition-all duration-300" 
                                        style={{ width: `${uploadProgress}%` }}
                                    ></div>
                                </div>
                            </div>
                        )}

                        {selectedFile && !loading && (
                            <button 
                                onClick={handleProcessAudio}
                                className="w-full btn-primary py-4 text-lg shadow-xl shadow-primary/20 flex items-center justify-center gap-3"
                            >
                                <Activity size={20} />
                                Generar Minuta con IA
                            </button>
                        )}
                    </div>

                    {/* Settings Section */}
                    <div className="space-y-6">
                        <div className="card p-6 space-y-6">
                            <div className="flex items-center gap-2 text-primary">
                                <Settings size={20} />
                                <h3 className="font-bold uppercase text-xs tracking-widest">Configuración</h3>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-2">Idioma</label>
                                    <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                                        <Languages size={18} className="text-slate-400" />
                                        <select 
                                            className="bg-transparent border-none w-full text-sm font-bold focus:ring-0"
                                            value={language}
                                            onChange={e => setLanguage(e.target.value)}
                                        >
                                            <option>Español</option>
                                            <option>English</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-3 pt-2">
                                    <ConfigSwitch label="Hablantes" icon={<Speaker size={14} />} active={config.diarization} toggle={() => setConfig({...config, diarization: !config.diarization})} desc="Identificar participantes" />
                                    <ConfigSwitch label="Acciones" icon={<CheckCircle2 size={14} />} active={config.extractActions} toggle={() => setConfig({...config, extractActions: !config.extractActions})} desc="Extraer compromisos" />
                                </div>
                            </div>
                        </div>

                        {/* Meeting Metadata */}
                        <div className="card p-6 space-y-4">
                            <h3 className="font-bold uppercase text-[10px] tracking-widest text-slate-400">Detalles de la Reunión</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase">Reunión #</label>
                                    <input type="text" className="input-field text-xs py-1.5" placeholder="Ej: 15" value={result?.meeting_num || ""} onChange={e => setResult(r => r ? {...r, meeting_num: e.target.value} : null)} />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase">Fecha</label>
                                    <input type="date" className="input-field text-xs py-1.5" value={result?.meeting_date || ""} onChange={e => setResult(r => r ? {...r, meeting_date: e.target.value} : null)} />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase">Hora</label>
                                    <input type="time" className="input-field text-xs py-1.5" value={result?.meeting_time || ""} onChange={e => setResult(r => r ? {...r, meeting_time: e.target.value} : null)} />
                                </div>
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase">Lista de Asistentes</label>
                                <textarea className="input-field text-xs py-1.5 min-h-[80px]" placeholder="Ej: Ing. Juan Pérez, Arq. María..." value={result?.attendees || ""} onChange={e => setResult(r => r ? {...r, attendees: e.target.value} : null)} />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === "result" && result && (
                <div className="space-y-6">
                    <div className="sticky top-0 z-40 bg-[#F8FAFC]/95 dark:bg-[#020617]/95 backdrop-blur-md pt-4 pb-4 -mx-4 px-4 md:-mx-8 md:px-8 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between mb-4">
                        <button onClick={() => setActiveTab("upload")} className="text-primary font-bold text-sm flex items-center gap-2 hover:underline">
                            <Upload size={16} /> Subir/Grabar otro
                        </button>
                        <div className="flex gap-2">
                            {result.audio_url && (
                                <div className="flex items-center gap-4 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                    <audio src={result.audio_url} controls className="h-8 w-[200px]" />
                                    <a href={result.audio_url} download className="text-primary hover:text-primary/80 transition-colors" title="Descargar Audio">
                                        <Download size={18} />
                                    </a>
                                </div>
                            )}
                            <button onClick={handleDownloadPdf} disabled={loading} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 transition-colors">
                                {loading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="card p-8 border-t-4 border-t-blue-500 bg-blue-50/30 dark:bg-blue-900/10">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-lg font-black text-blue-700 dark:text-blue-400">1. Resumen Ejecutivo</h3>
                                <button onClick={() => handleCopy(result.summary)} className="text-slate-400 hover:text-blue-500"><Copy size={16} /></button>
                            </div>
                            <textarea className="w-full bg-transparent border-none focus:ring-0 text-sm font-medium text-slate-700 dark:text-slate-300 h-[200px]" value={result.summary} onChange={(e) => setResult({...result, summary: e.target.value})}/>
                        </div>

                        <div className="lg:col-span-2 card p-10 border-t-4 border-t-emerald-500">
                            <div className="flex justify-between items-start mb-8">
                                <div className="space-y-1">
                                    <h3 className="text-2xl font-black text-slate-900 dark:text-white">2. Minuta de Reunión</h3>
                                    <p className="text-sm text-slate-500 font-medium">Documento generado por IA</p>
                                </div>
                                <button onClick={() => handleCopy(result.minutes)} className="p-2 hover:bg-emerald-50 text-slate-400 hover:text-emerald-500 rounded-full transition-colors"><Copy size={20} /></button>
                            </div>
                            <textarea className="w-full bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 focus:ring-primary text-sm min-h-[500px]" value={result.minutes} onChange={(e) => setResult({...result, minutes: e.target.value})}/>
                        </div>
                    </div>
                </div>
            )}
            {result && (
                <FloatingFormActions
                    actions={[
                        {
                            label: loading ? "Guardando..." : "Guardar cambios",
                            icon: <Save />,
                            onClick: () => handleSaveToDB(),
                            description: "Sincronizar los cambios manuales hechos en el resumen o las minutas",
                            variant: 'primary' as const,
                            disabled: loading
                        },
                        {
                            label: "Descargar PDF",
                            icon: <Download />,
                            onClick: handleDownloadPdf,
                            description: "Generar y descargar el reporte oficial de la minuta en formato PDF",
                            variant: 'secondary' as const,
                            disabled: loading
                        }
                    ]}
                />
            )}
        </div>
    );
});

function ConfigSwitch({ label, icon, active, toggle, desc }: any) {
    return (
        <div className="flex items-start justify-between gap-4 p-2">
            <div className="flex gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${active ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-400'} transition-colors mt-1 shrink-0`}>
                    {icon}
                </div>
                <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">{label}</h4>
                    <p className="text-[10px] text-slate-500 leading-tight">{desc}</p>
                </div>
            </div>
            <button onClick={toggle} className={`w-10 h-5 rounded-full relative transition-colors ${active ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-800'}`}>
                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${active ? 'right-1' : 'left-1'}`}></div>
            </button>
        </div>
    );
}

export default MinutesForm;
