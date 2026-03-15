"use client";

import React, { useState, useRef, forwardRef, useImperativeHandle } from "react";
import { 
    Mic, Upload, FileAudio, Settings, FileJson, 
    FileText, CheckCircle2, AlertCircle, Loader2,
    Languages, Speaker, Clock, Activity, ShieldCheck,
    Save, Trash2, Download, Copy
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { FormRef } from "./ProjectForm";

const MinutesForm = forwardRef<FormRef, { projectId?: string, onDirty?: () => void, onSaved?: () => void }>(function MinutesForm({ projectId, onDirty, onSaved }, ref) {
    const [loading, setLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    
    // Config
    const [language, setLanguage] = useState("Español");
    const [config, setConfig] = useState({
        diarization: true,
        timestamps: true,
        extractActions: true,
        detectItems: true,
        generateJson: true
    });

    // Results
    const [activeTab, setActiveTab] = useState<"upload" | "result">("upload");
    const [result, setResult] = useState<{
        summary: string;
        minutes: string;
        json: string;
    } | null>(null);

    useImperativeHandle(ref, () => ({
        save: async () => {
            // Logic to save the generated minutes to database if needed
        },
        isDirty: () => false
    }));

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validation
        const validFormats = ["audio/mpeg", "audio/wav", "audio/m4a", "audio/x-m4a", "audio/mp3"];
        if (!validFormats.includes(file.type) && !file.name.endsWith(".m4a")) {
            alert("Formato no válido. Use MP3, WAV o M4A.");
            return;
        }

        // 2 hours limit (approximate size check or just show message)
        // Max size for Supabase storage is usually 50MB-100MB, 2 hours of compressed audio could be more.
        
        setSelectedFile(file);
        setAudioUrl(URL.createObjectURL(file));
        if (onDirty) onDirty();
    };

    const handleProcessAudio = async () => {
        if (!selectedFile) return;
        setLoading(true);
        setUploadProgress(0);

        // Simulate upload and processing
        const interval = setInterval(() => {
            setUploadProgress(prev => {
                if (prev >= 95) {
                    clearInterval(interval);
                    return 95;
                }
                return prev + 5;
            });
        }, 300);

        try {
            // In a real implementation, we would upload to Supabase Storage and call an Edge Function or AI API
            // For now, we simulate the result based on the project data if available
            
            setTimeout(() => {
                clearInterval(interval);
                setUploadProgress(100);
                
                setResult({
                    summary: `### RESUMEN EJECUTIVO
- **Proyecto:** Rehabilitación de Carretera PR-123
- **Ubicación:** Ponce, Puerto Rico
- **Estado:** 45% de avance
- **Hitos:** Finalización de pavimentación Sector A (Próxima semana)
- **Riesgos:** Retraso en entrega de materiales de drenaje
- **Decisiones:** Se aprueba el cambio de subcontratista para señalización`,
                    minutes: `### MINUTA DE REUNIÓN DE PROGRESO
**Fecha:** ${new Date().toLocaleDateString()}
**Asistentes:** Ing. Juan Pérez (PM), Arq. María Ruiz (Inspección), Sr. Carlos Sosa (Contratista)

#### 1. Objetivos
Revisión de avance semanal y discusión de órdenes de cambio pendientes.

#### 2. Disciplinas
- **Estructuras (05:12):** Se completó el vaciado de las zapatas en el km 4.2.
- **Logística (12:45):** El equipo pesado se moverá al Sector B el lunes.

#### 3. Acciones y Compromisos
| Acción | Responsable | Fecha |
|--------|-------------|-------|
| Entrega de planos revisados | Arq. Ruiz | 20 Mar |
| Cotización de materiales extra | C. Sosa | 18 Mar |`,
                    json: JSON.stringify({
                        project: "REHAB PR-123",
                        progress: 0.45,
                        actions: [
                            { task: "Planos revisados", owner: "Ruiz", due: "2026-03-20" }
                        ],
                        items: { rfi: 2, co: 1 }
                    }, null, 2)
                });
                
                setActiveTab("result");
                setLoading(false);
                if (onSaved) onSaved();
            }, 5000);

        } catch (error) {
            console.error("Error processing audio:", error);
            alert("Error al procesar el audio.");
            setLoading(false);
        }
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        alert("Copiado al portapapeles");
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card p-6 border-l-4 border-l-primary flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                        <Mic size={24} />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-500 uppercase">Estado</h3>
                        <p className="text-lg font-black text-slate-900 dark:text-white">
                            {result ? "Procesado" : (selectedFile ? "Listo para procesar" : "Sin audio")}
                        </p>
                    </div>
                </div>
            </div>

            {activeTab === "upload" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Upload Section */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="card p-10 border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-primary/50 transition-all flex flex-col items-center justify-center text-center group cursor-pointer relative">
                            <input 
                                type="file" 
                                className="absolute inset-0 opacity-0 cursor-pointer" 
                                accept=".mp3,.wav,.m4a"
                                onChange={handleFileChange}
                            />
                            <div className="w-20 h-20 bg-slate-50 dark:bg-slate-900 rounded-3xl flex items-center justify-center text-slate-400 group-hover:text-primary group-hover:scale-110 transition-all mb-4">
                                {selectedFile ? <FileAudio size={40} /> : <Upload size={40} />}
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                                {selectedFile ? selectedFile.name : "Subir audio (MP3/WAV/M4A)"}
                            </h3>
                            <p className="text-slate-500 text-sm mt-2 max-w-sm">
                                {selectedFile 
                                    ? `Tamaño: ${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`
                                    : "Arrastra el archivo de la reunión o haz clic aquí. Soporta hasta 2 horas de duración."
                                }
                            </p>
                        </div>

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
                                <p className="text-[10px] text-slate-400 italic">Trascendiendo, identificando hablantes y extrayendo metadatos...</p>
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
                                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-2">Idioma de la reunión</label>
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
                                    <ConfigSwitch 
                                        label="Diarización" 
                                        icon={<Speaker size={14} />} 
                                        active={config.diarization} 
                                        toggle={() => setConfig({...config, diarization: !config.diarization})} 
                                        desc="Identificar participantes (Hablante 1, 2...)"
                                    />
                                    <ConfigSwitch 
                                        label="Marcas de tiempo" 
                                        icon={<Clock size={14} />} 
                                        active={config.timestamps} 
                                        toggle={() => setConfig({...config, timestamps: !config.timestamps})}
                                        desc="mm:ss por intervención relevante"
                                    />
                                    <ConfigSwitch 
                                        label="Acciones/Responsables" 
                                        icon={<CheckCircle2 size={14} />} 
                                        active={config.extractActions} 
                                        toggle={() => setConfig({...config, extractActions: !config.extractActions})}
                                        desc="Extraer compromisos y fechas"
                                    />
                                    <ConfigSwitch 
                                        label="Detección de Obra" 
                                        icon={<Activity size={14} />} 
                                        active={config.detectItems} 
                                        toggle={() => setConfig({...config, detectItems: !config.detectItems})}
                                        desc="RFIs, Submittals, CO, Seguridad"
                                    />
                                    <ConfigSwitch 
                                        label="JSON Estructurado" 
                                        icon={<FileJson size={14} />} 
                                        active={config.generateJson} 
                                        toggle={() => setConfig({...config, generateJson: !config.generateJson})}
                                        desc="Generar datos para integración"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === "result" && result && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <button 
                            onClick={() => setActiveTab("upload")}
                            className="text-primary font-bold text-sm flex items-center gap-2 hover:underline"
                        >
                            <Upload size={16} /> Subir otro audio
                        </button>
                        <div className="flex gap-2">
                            <button className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 transition-colors" title="Descargar PDF">
                                <Download size={18} />
                            </button>
                            <button className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 transition-colors" title="Exportar JSON">
                                <FileJson size={18} />
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Summary */}
                        <div className="card p-8 border-t-4 border-t-blue-500 bg-blue-50/30 dark:bg-blue-900/10">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-lg font-black text-blue-700 dark:text-blue-400">1. Resumen Ejecutivo</h3>
                                <button onClick={() => handleCopy(result.summary)} className="text-slate-400 hover:text-blue-500"><Copy size={16} /></button>
                            </div>
                            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-line font-medium text-slate-700 dark:text-slate-300">
                                {result.summary}
                            </div>
                        </div>

                        {/* JSON */}
                        <div className="card p-8 border-t-4 border-t-amber-500 bg-amber-50/30 dark:bg-amber-900/10 h-fit">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-lg font-black text-amber-700 dark:text-amber-400">3. JSON Estructurado</h3>
                                <button onClick={() => handleCopy(result.json)} className="text-slate-400 hover:text-amber-500"><Copy size={16} /></button>
                            </div>
                            <pre className="text-[10px] bg-slate-900 text-amber-200 p-4 rounded-2xl overflow-x-auto font-mono">
                                {result.json}
                            </pre>
                        </div>

                        {/* Full Minutes */}
                        <div className="lg:col-span-2 card p-10 border-t-4 border-t-emerald-500">
                            <div className="flex justify-between items-start mb-8">
                                <div className="space-y-1">
                                    <h3 className="text-2xl font-black text-slate-900 dark:text-white">2. Minuta de Reunión</h3>
                                    <p className="text-sm text-slate-500 font-medium">Documento generado automáticamente a partir de audio</p>
                                </div>
                                <button onClick={() => handleCopy(result.minutes)} className="p-2 hover:bg-emerald-50 text-slate-400 hover:text-emerald-500 rounded-full transition-colors"><Copy size={20} /></button>
                            </div>
                            <div className="prose prose-slate dark:prose-invert max-w-none whitespace-pre-line">
                                {result.minutes}
                            </div>
                        </div>
                    </div>
                </div>
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
            <button 
                onClick={toggle}
                className={`w-10 h-5 rounded-full relative transition-colors ${active ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-800'}`}
            >
                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${active ? 'right-1' : 'left-1'}`}></div>
            </button>
        </div>
    );
}

export default MinutesForm;
