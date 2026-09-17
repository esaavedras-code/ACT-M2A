"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

type Reminder = {
    id: string;
    title: string;
    urgency: number;
    status: string;
    type: string;
    due_date?: string;
    project_id?: string;
    project_name?: string;
};

const COLUMNS = ["Pendiente", "En Proceso", "Esperando Respuesta", "Completado"] as const;
type Column = typeof COLUMNS[number];

const COLUMN_STYLES: Record<Column, { header: string; card: string; badge: string }> = {
    "Pendiente":             { header: "bg-amber-500 text-white", card: "border-amber-200 dark:border-amber-800", badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200" },
    "En Proceso":            { header: "bg-blue-500 text-white",  card: "border-blue-200 dark:border-blue-800",  badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200"  },
    "Esperando Respuesta":   { header: "bg-purple-500 text-white",card: "border-purple-200 dark:border-purple-800",badge: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200"},
    "Completado":            { header: "bg-green-500 text-white", card: "border-green-200 dark:border-green-800", badge: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200" },
};

type Props = { onEdit: (id: string) => void };

export default function TaskKanban({ onEdit }: Props) {
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [loading, setLoading] = useState(true);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [draggingOver, setDraggingOver] = useState<Column | null>(null);

    const fetchReminders = useCallback(async () => {
        setLoading(true);
        const [rRes, pRes] = await Promise.all([
            supabase.from("reminders").select("*").in("status", COLUMNS as unknown as string[]).order("urgency"),
            supabase.from("projects").select("id, num_act"),
        ]);
        const projects = pRes.data || [];
        if (rRes.data) {
            setReminders(rRes.data.map((r: any) => ({
                ...r,
                project_name: projects.find(p => p.id === r.project_id)?.num_act || "General",
            })));
        }
        setLoading(false);
    }, []);

    useEffect(() => { fetchReminders(); }, [fetchReminders]);

    const handleDragStart = (id: string) => setDraggingId(id);
    const handleDragOver = (e: React.DragEvent, col: Column) => {
        e.preventDefault();
        setDraggingOver(col);
    };
    const handleDrop = async (col: Column) => {
        if (!draggingId) return;
        setReminders(prev => prev.map(r => r.id === draggingId ? { ...r, status: col } : r));
        await supabase.from("reminders").update({ status: col, updated_at: new Date().toISOString() }).eq("id", draggingId);
        setDraggingId(null);
        setDraggingOver(null);
    };

    const byStatus = (col: Column) => reminders.filter(r => r.status === col);

    if (loading) return <div className="flex justify-center py-16 text-slate-400"><Loader2 className="animate-spin" size={28} /></div>;

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 h-full min-h-[500px]">
            {COLUMNS.map(col => {
                const items = byStatus(col);
                const style = COLUMN_STYLES[col];
                const isOver = draggingOver === col;
                return (
                    <div
                        key={col}
                        onDragOver={e => handleDragOver(e, col)}
                        onDrop={() => handleDrop(col)}
                        onDragLeave={() => setDraggingOver(null)}
                        className={`rounded-xl border-2 flex flex-col transition-all ${isOver ? "border-blue-400 bg-blue-50 dark:bg-blue-900/10" : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"}`}
                    >
                        {/* Header de columna */}
                        <div className={`${style.header} rounded-t-xl px-3 py-2.5 flex items-center justify-between`}>
                            <span className="text-xs font-black uppercase tracking-wide">{col}</span>
                            <span className="text-xs font-bold opacity-80 bg-white/20 rounded-full px-2 py-0.5">{items.length}</span>
                        </div>

                        {/* Tarjetas */}
                        <div className="flex-1 p-2 space-y-2 overflow-y-auto custom-scrollbar">
                            {items.length === 0 && (
                                <div className="text-center text-slate-400 text-xs mt-8 opacity-60">Sin pendientes</div>
                            )}
                            {items.map(r => {
                                const isOverdue = r.due_date && new Date(r.due_date) < new Date() && r.status !== "Completado";
                                return (
                                    <div
                                        key={r.id}
                                        draggable
                                        onDragStart={() => handleDragStart(r.id)}
                                        onDragEnd={() => { setDraggingId(null); setDraggingOver(null); }}
                                        onClick={() => onEdit(r.id)}
                                        className={`rounded-xl border-2 bg-white dark:bg-slate-800 p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-all select-none ${style.card} ${draggingId === r.id ? "opacity-40 scale-95" : ""}`}
                                    >
                                        {/* Barra de urgencia */}
                                        <div className={`w-full h-1 rounded-full mb-2 ${r.urgency === 1 ? "bg-red-500" : r.urgency === 2 ? "bg-amber-400" : "bg-green-500"}`} />
                                        
                                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-snug line-clamp-2">{r.title}</p>

                                        {r.project_name && (
                                            <p className="text-[10px] text-slate-400 mt-1">{r.project_name}</p>
                                        )}

                                        <div className="flex items-center justify-between mt-2">
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${style.badge}`}>{r.type}</span>
                                            {r.due_date && (
                                                <span className={`text-[9px] font-semibold ${isOverdue ? "text-red-500" : "text-slate-400"}`}>
                                                    {isOverdue ? "⚠️ " : ""}{new Date(r.due_date).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
