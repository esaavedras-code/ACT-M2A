"use client";

import React, { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { 
    Upload, FileText, Loader2, CheckCircle2, AlertCircle, 
    Table, RefreshCcw, Save, Trash2, Calendar
} from "lucide-react";

interface Props {
    projectId: string;
    numAct?: string;
}

export default function UpdateTablesForm({ projectId, numAct }: Props) {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError(null);
            setSuccess(false);
            setResult(null);
        }
    };

    const processFile = async () => {
        if (!file || !projectId) return;
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            // 1. Upload to storage section 'tables'
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            const datePrefix = `${year}-${month}-${day}`;
            
            const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_');
            const fileName = `${datePrefix} - ${safeName}`;
            const storagePath = `${projectId}/Tablas/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from("project-documents")
                .upload(storagePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            // 2. Register in project_documents
            const { error: dbError } = await supabase
                .from("project_documents")
                .insert([{
                    project_id: projectId,
                    file_name: fileName,
                    doc_type: file.type,
                    section: "tables",
                    storage_path: storagePath
                }]);

            if (dbError) throw dbError;

            // 3. Extract text and analyze (API call)
            const formData = new FormData();
            formData.append('file', file);
            formData.append('projectId', projectId);

            const response = await fetch('/api/update-tables', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            setResult(data.changes);
            setSuccess(true);
        } catch (err: any) {
            console.error("Error processing table:", err);
            setError(err.message || "Error al procesar el archivo");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full space-y-8 pb-20 animate-in fade-in duration-500">
            <div className="card bg-white dark:bg-slate-900 p-8 border-slate-200">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600">
                        <RefreshCcw size={28} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Actualizar Tablas</h2>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest italic">Sincronización Inteligente de Datos</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div className="space-y-6">
                        <div 
                            className={`relative border-4 border-dashed rounded-[2.5rem] p-12 transition-all group flex flex-col items-center justify-center gap-4 text-center ${
                                file ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-100 hover:border-blue-200 hover:bg-blue-50/10'
                            }`}
                        >
                            <input 
                                type="file" 
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept=".xlsx,.xls,.docx,.doc,.pdf"
                                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                            />
                            
                            <div className={`w-20 h-20 rounded-3xl flex items-center justify-center transition-transform group-hover:scale-110 ${file ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                                {file ? <CheckCircle2 size={40} /> : <Upload size={40} />}
                            </div>

                            <div className="space-y-2">
                                <p className="font-black text-sm uppercase tracking-wider text-slate-700 dark:text-slate-200">
                                    {file ? file.name : "Seleccionar Archivo"}
                                </p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    Formatos soportados: Excel, Word, PDF
                                </p>
                            </div>

                            {file && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                                    className="p-2 bg-rose-50 text-rose-500 rounded-full hover:bg-rose-100 transition-colors relative z-20"
                                >
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>

                        <button 
                            onClick={processFile}
                            disabled={!file || loading}
                            className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 transition-all shadow-xl ${
                                !file || loading 
                                ? 'bg-slate-100 text-slate-400 grayscale cursor-not-allowed' 
                                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20 hover:-translate-y-1'
                            }`}
                        >
                            {loading ? (
                                <><Loader2 size={18} className="animate-spin" /> Procesando y analizando...</>
                            ) : (
                                <><RefreshCcw size={18} /> Actualizar Información de Proyecto</>
                            )}
                        </button>

                        {error && (
                            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 text-rose-600">
                                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <p className="text-xs font-black uppercase tracking-tight">Error en el proceso</p>
                                    <p className="text-[10px] font-bold leading-relaxed">{error}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-6">
                        <div className="bg-slate-50 dark:bg-slate-800/40 rounded-[2rem] p-8 min-h-[300px] flex flex-col relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-6 opacity-10">
                                <Table size={120} />
                            </div>
                            
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                <Loader2 size={12} className={loading ? 'animate-spin' : ''} /> 
                                Resultado del Análisis
                            </h3>

                            {loading ? (
                                <div className="flex-grow flex flex-col items-center justify-center gap-4 py-20 text-center">
                                    <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-600 animate-progress" />
                                    </div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                        Escaneando tablas y mapeando campos...
                                    </p>
                                </div>
                            ) : success && result ? (
                                <div className="space-y-6 flex-grow animate-in slide-in-from-bottom-4 duration-500">
                                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl border-l-4 border-l-emerald-500">
                                        <p className="text-[10px] font-black text-emerald-800 uppercase mb-2">Resumen de Cambios:</p>
                                        <p className="text-xs font-medium text-emerald-700 leading-relaxed italic">
                                            "{result.summary || "Se han identificado actualizaciones de datos en el documento."}"
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 transition-all hover:border-blue-200">
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Partidas Actualizadas</p>
                                            <p className="text-xl font-black text-blue-600">{result.itemsCount || 0}</p>
                                        </div>
                                        <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 transition-all hover:border-blue-200">
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Fechas Modificadas</p>
                                            <p className="text-xl font-black text-blue-600">{result.datesChanged ? 'Sí' : 'No'}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 p-3 bg-blue-50 text-blue-600 rounded-xl">
                                        <FileText size={14} />
                                        <span className="text-[9px] font-bold uppercase">Copia guardada en sección 'Tablas'</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-grow flex flex-col items-center justify-center text-center p-10 opacity-30 gap-4">
                                    <Table size={48} />
                                    <p className="text-[10px] font-black uppercase tracking-widest">Sin datos analizados</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-8 bg-blue-600 rounded-[2.5rem] shadow-2xl shadow-blue-500/20 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="space-y-2 text-center md:text-left">
                        <h4 className="text-lg font-black uppercase tracking-tight">Sincronización Inteligente</h4>
                        <p className="text-xs text-blue-100 font-medium">El asistente procesará automáticamente los montos y balances de las partidas basándose en el documento provisto.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
