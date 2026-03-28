
"use client";

import React, { useState, useEffect } from "react";
import { Gantt, Task, ViewMode } from "gantt-task-react";
import "gantt-task-react/dist/index.css";
import { supabase } from "@/lib/supabase";
import { formatDate } from "@/lib/utils";
import { Loader2, AlertCircle, Calendar } from "lucide-react";

interface ProfessionalGanttProps {
  projectId: string;
  choId: string;
}

export function ProfessionalGantt({ projectId, choId }: ProfessionalGanttProps) {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const addDays = (dateStr: string, days: number) => {
        if (!dateStr) return new Date();
        const date = new Date(dateStr);
        // Add days and adjust for UTC to avoid off-by-one errors in some timezones
        date.setDate(date.getDate() + (days || 0) + 1);
        return date;
    };

    const parseJustification = (text: string) => {
        const findDays = (keywords: string[]) => {
            for (const kw of keywords) {
                const regex = new RegExp(`(\\d+)\\s*(?:días|dias).*?${kw}|${kw}.*?(\\d+)\\s*(?:días|dias)`, 'i');
                const match = text.match(regex);
                if (match) return parseInt(match[1] || match[2]);
            }
            return 0;
        };
        return {
            aprobacion: findDays(["aprobación", "aprobacion", "documento"]),
            fabricacion: findDays(["pedido", "fabricación", "fabricacion", "entrega"]),
            instalacion: findDays(["instalación", "instalacion", "programación", "programacion"]),
        };
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single();
                const { data: currentCho } = await supabase.from('chos').select('*').eq('id', choId).single();
                const { data: allChos } = await supabase.from('chos').select('*').eq('project_id', projectId).order('cho_num', { ascending: true });

                if (!project || !currentCho) throw new Error("Datos insuficientes.");

                const beginDateStr = project.date_project_start || "2023-01-01";
                const origEndDateStr = project.date_orig_completion || "2023-12-31";
                
                let priorExt = 0;
                (allChos || []).forEach(c => {
                    const cNum = parseInt(c.cho_num);
                    const currNum = parseInt(currentCho.cho_num);
                    if (cNum < currNum) priorExt += (parseInt(c.time_extension_days) || 0);
                });
                
                const thisExtTotal = parseInt(currentCho.time_extension_days) || 0;
                
                const revisedEndDatePrior = addDays(origEndDateStr, priorExt);
                
                const phases = parseJustification(currentCho.justification || "");
                const sumSpecified = phases.aprobacion + phases.fabricacion + phases.instalacion;
                let ratio = sumSpecified > thisExtTotal && thisExtTotal > 0 ? thisExtTotal / sumSpecified : 1;

                const scaledAprob = Math.round(phases.aprobacion * ratio);
                const scaledFab = Math.round(phases.fabricacion * ratio);
                const scaledInst = Math.max(0, thisExtTotal - scaledAprob - scaledFab);

                const newTasks: Task[] = [];

                // 1. Tiempo Original + Extensiones Previas
                newTasks.push({
                    start: new Date(beginDateStr),
                    end: revisedEndDatePrior,
                    name: "CONTRATO VIGENTE",
                    id: "Original",
                    type: "project",
                    progress: 100,
                    styles: { backgroundColor: "#4a86e8", progressColor: "#3a76d8", progressSelectedColor: "#3a76d8" },
                });

                // 2. Fases de la Extensión Actual
                let currentOffsetDate = new Date(revisedEndDatePrior);

                if (scaledAprob > 0) {
                    const start = new Date(currentOffsetDate);
                    const end = new Date(start);
                    end.setDate(end.getDate() + scaledAprob);
                    newTasks.push({
                        start,
                        end,
                        name: "APROBACIÓN",
                        id: "Phase_Aprob",
                        type: "task",
                        progress: 0,
                        dependencies: ["Original"],
                        styles: { backgroundColor: "#7e7041", progressColor: "#6c6038", progressSelectedColor: "#6c6038" },
                    });
                    currentOffsetDate = end;
                }

                if (scaledFab > 0) {
                    const start = new Date(currentOffsetDate);
                    const end = new Date(start);
                    end.setDate(end.getDate() + scaledFab);
                    newTasks.push({
                        start,
                        end,
                        name: "FABRICACIÓN",
                        id: "Phase_Fab",
                        type: "task",
                        progress: 0,
                        dependencies: scaledAprob > 0 ? ["Phase_Aprob"] : ["Original"],
                        styles: { backgroundColor: "#ef4444", progressColor: "#b91c1c", progressSelectedColor: "#b91c1c" },
                    });
                    currentOffsetDate = end;
                }

                if (scaledInst > 0) {
                    const start = new Date(currentOffsetDate);
                    const end = new Date(start);
                    end.setDate(end.getDate() + scaledInst);
                    newTasks.push({
                        start,
                        end,
                        name: "INSTALACIÓN",
                        id: "Phase_Inst",
                        type: "task",
                        progress: 0,
                        dependencies: scaledFab > 0 ? ["Phase_Fab"] : (scaledAprob > 0 ? ["Phase_Aprob"] : ["Original"]),
                        styles: { backgroundColor: "#22c55e", progressColor: "#15803d", progressSelectedColor: "#15803d" },
                    });
                    currentOffsetDate = end;
                }

                // Si no hay fases parseadas pero hay días de extensión, mostramos una barra genérica amarilla
                if (newTasks.length === 1 && thisExtTotal > 0) {
                    const start = new Date(revisedEndDatePrior);
                    const end = new Date(start);
                    end.setDate(end.getDate() + thisExtTotal);
                    newTasks.push({
                        start,
                        end,
                        name: "EXTENSIÓN RECOMENDADA",
                        id: "Phase_Total",
                        type: "task",
                        progress: 0,
                        dependencies: ["Original"],
                        styles: { backgroundColor: "#fbbf24", progressColor: "#b45309", progressSelectedColor: "#b45309" },
                    });
                }

                setTasks(newTasks);
            } catch (e: any) {
                console.error(e);
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };

        if (projectId && choId) fetchData();
    }, [projectId, choId]);

    if (loading) return (
        <div className="flex flex-col justify-center items-center py-20 p-8 rounded-3xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800">
            <Loader2 className="animate-spin text-primary" size={48} />
            <span className="mt-6 text-sm font-black uppercase tracking-[0.3em] text-slate-400 animate-pulse">Analizando Impacto de Tiempo...</span>
        </div>
    );

    if (error) return (
        <div className="p-8 rounded-3xl bg-red-50 dark:bg-red-900/10 text-red-600 border border-red-100 dark:border-red-900/50 flex items-center gap-4 animate-in shake duration-500">
            <AlertCircle size={40} />
            <div>
                <p className="font-black uppercase tracking-widest text-[10px] mb-1">Error de Datos</p>
                <p className="font-bold text-sm">{error}</p>
            </div>
        </div>
    );

    const stats = tasks.reduce((acc: any, t) => {
        const diff = Math.ceil((t.end.getTime() - t.start.getTime()) / (1000 * 3600 * 24));
        acc[t.id] = diff;
        return acc;
    }, {});

    return (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[48px] shadow-2xl border border-slate-100 dark:border-slate-800 transition-all duration-700 animate-in fade-in zoom-in-95 group">
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
                <div className="space-y-2">
                     <div className="flex items-center gap-3 mb-1">
                        <div className="p-2 bg-primary/10 rounded-xl">
                            <Calendar className="text-primary" size={24} />
                        </div>
                        <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none">Cronograma GANTT</h2>
                     </div>
                     <p className="text-xs font-black text-primary tracking-[0.4em] uppercase opacity-80">Análisis Visual de Extensión de Tiempo</p>
                </div>
                
                <div className="hidden md:flex flex-col items-end">
                    <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 px-6 py-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <div className="flex flex-col items-end">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Visualización</span>
                            <span className="text-[11px] font-black text-primary uppercase tracking-[0.2em]">Escala Mensual</span>
                        </div>
                        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
                        <span className="text-lg">📊</span>
                    </div>
                </div>
            </div>

            <div className="relative rounded-[32px] border border-slate-100 dark:border-slate-800 overflow-hidden bg-slate-50/5 dark:bg-slate-950/20 shadow-inner p-1 group-hover:border-primary/20 transition-all duration-500">
                {tasks.length > 0 ? (
                    <div className="max-w-full overflow-x-auto custom-scrollbar">
                        <Gantt 
                            tasks={tasks}
                            viewMode={ViewMode.Month}
                            listCellWidth="300px"
                            columnWidth={70}
                            barCornerRadius={14}
                            barFill={90}
                            rowHeight={65}
                            fontSize="11"
                            projectBackgroundColor="#f1f5f9"
                            projectProgressColor="#3b82f6"
                            projectProgressSelectedColor="#2563eb"
                            locale="es"
                            todayColor="rgba(59, 130, 246, 0.1)"
                        />
                    </div>
                ) : (
                    <div className="py-24 text-center">
                        <Calendar size={48} className="mx-auto text-slate-200 mb-4" />
                        <p className="text-slate-400 font-black uppercase tracking-[0.3em] text-sm">No se encontraron datos para graficar</p>
                    </div>
                )}
            </div>

            <div className="mt-12 pt-8 border-t border-slate-100 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-6">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest w-full md:w-auto mb-2 md:mb-0">Leyenda del Gráfico:</span>
                    <LegendItem color="#3b82f6" text="Contrato Vigente" />
                    <LegendItem color="#7e7041" text={`Documentación (${stats['Phase_Aprob'] || 0} d)`} />
                    <LegendItem color="#ef4444" text={`Fabricación (${stats['Phase_Fab'] || 0} d)`} />
                    <LegendItem color="#22c55e" text={`Instalación (${stats['Phase_Inst'] || 0} d)`} />
                    <LegendItem color="#fbbf24" text={`Total CHO (${stats['Phase_Aprob'] + stats['Phase_Fab'] + stats['Phase_Inst'] || stats['Phase_Total'] || 0} d)`} />
                </div>
            </div>
        </div>
    );
}

function LegendItem({ color, text }: { color: string, text: string }) {
    return (
        <div className="flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-md hover:border-primary/20 transition-all cursor-default">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }}></div>
            <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">{text}</span>
        </div>
    );
}
