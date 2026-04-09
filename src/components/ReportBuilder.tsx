"use client";

import { useState, useEffect } from "react";
import { FileText, Download, Save, Activity } from "lucide-react";
import { formatProjectNumber } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

interface SubProject {
    id: string;
    name: string;
    num_act: string;
}

export default function ReportBuilder({ userId }: { userId: string }) {
    const [allowedProjects, setAllowedProjects] = useState<SubProject[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>("ALL");
    const [reportName, setReportName] = useState("");
    const [dateRange, setDateRange] = useState({ start: "", end: "" });
    const [format, setFormat] = useState("PDF");
    const [columns, setColumns] = useState({ financials: true, personnel: true, materials: false });
    const [reportsSaved, setReportsSaved] = useState<any[]>([]);

    useEffect(() => {
        fetchAllowedProjects();
        fetchSavedReports();
    }, []);

    const fetchAllowedProjects = async () => {
        // En una implementación real con RLS, el usuario solo verá los proyectos en los que tiene membresía (o es Admin A)
        // Simulamos una consulta genérica pidiendo los proyectos
        const { data, error } = await supabase.from("projects").select("id, name, num_act");
        if (data) setAllowedProjects(data);
    };

    const fetchSavedReports = async () => {
        const { data } = await supabase.from("report_definitions").select("*").eq("owner_user_id", userId).order("created_at", { ascending: false });
        if (data) setReportsSaved(data);
    };

    const handleSaveDefinition = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reportName) return alert("Ingrese un nombre para el informe");

        const config_json = { dateRange, format, columns };
        const payload = {
            name: reportName,
            description: `Informe de exportación en ${format}`,
            owner_user_id: userId,
            config_json,
            project_id_nullable: selectedProjectId === "ALL" ? null : selectedProjectId,
            shared_scope: "private"
        };

        const { error } = await supabase.from("report_definitions").insert([payload]);
        if (error) alert("Error guardando definición: " + error.message);
        else {
            alert("Informe guardado exitosamente");
            fetchSavedReports();
            setReportName("");
        }
    };

    const handleRunReport = async (defId?: string) => {
        // Ejecución simulada (Nivel D solo lee y extrae los datos permitidos)
        alert(`Ejecutando informe de solo lectura en formato ${format || 'elegido'}. Procesando millones de filas bajo sus límites permitidos (paginación de 10k máx).`);
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
                <FileText className="text-primary" />
                Constructor de Informes (Solo Lectura)
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Formulario de Definición */}
                <form onSubmit={handleSaveDefinition} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Nombre del Informe</label>
                        <input type="text" value={reportName} onChange={e => setReportName(e.target.value)} required placeholder="Ej. Gastos Q1" className="w-full rounded-md border-slate-200 p-2 text-sm" />
                    </div>

                    <div>
                        <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Alcance (Proyectos)</label>
                        <select value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)} className="w-full rounded-md border-slate-200 p-2 text-sm">
                            <option value="ALL">Todos mis proyectos permitidos</option>
                            {allowedProjects.map(p => (
                                <option key={p.id} value={p.id}>{formatProjectNumber(p.num_act)} - {p.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Fecha Inicio</label>
                            <input type="date" value={dateRange.start} onChange={e => setDateRange({ ...dateRange, start: e.target.value })} className="w-full rounded-md border-slate-200 p-2 text-sm" />
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Fecha Fin</label>
                            <input type="date" value={dateRange.end} onChange={e => setDateRange({ ...dateRange, end: e.target.value })} className="w-full rounded-md border-slate-200 p-2 text-sm" />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold uppercase text-slate-500 mb-2 block">Módulos a Incluir</label>
                        <div className="flex flex-wrap gap-4 text-sm">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={columns.financials} onChange={e => setColumns({ ...columns, financials: e.target.checked })} />
                                Financieros (Certificaciones, CHOs)
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={columns.personnel} onChange={e => setColumns({ ...columns, personnel: e.target.checked })} />
                                Personal Laboral
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={columns.materials} onChange={e => setColumns({ ...columns, materials: e.target.checked })} />
                                Materiales y Manufactura
                            </label>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Formato de Exportación</label>
                        <select value={format} onChange={e => setFormat(e.target.value)} className="w-full rounded-md border-slate-200 p-2 text-sm">
                            <option value="PDF">Documento PDF</option>
                            <option value="XLSX">Excel (XLSX)</option>
                            <option value="CSV">Datos Platos (CSV)</option>
                        </select>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button type="submit" className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors">
                            <Save size={18} /> Guardar Definición
                        </button>
                        <button type="button" onClick={() => handleRunReport()} className="flex-1 bg-primary hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-500/20">
                            <Activity size={18} /> Ejecutar Ahora
                        </button>
                    </div>
                </form>

                {/* Lista de reportes guardados */}
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800 flex flex-col h-full">
                    <h3 className="text-sm font-bold uppercase text-slate-500 mb-4 flex items-center gap-2">
                        <Save size={16} /> Mis Informes Guardados
                    </h3>
                    
                    <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                        {reportsSaved.length === 0 ? (
                            <div className="text-center text-slate-400 text-sm italic py-8">Ningún informe guardado.</div>
                        ) : (
                            reportsSaved.map(rep => (
                                <div key={rep.id} className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between group">
                                    <div>
                                        <div className="font-bold text-sm text-slate-800 dark:text-slate-200">{rep.name}</div>
                                        <div className="text-[10px] text-slate-400 uppercase">{rep.config_json?.format} • {rep.project_id_nullable ? '1 PROYECTO' : 'GLOBAL'}</div>
                                    </div>
                                    <button onClick={() => handleRunReport(rep.id)} className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Exportar este informe">
                                        <Download size={18} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
