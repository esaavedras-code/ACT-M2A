"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { getLocalStorageItem } from "@/lib/utils";
import { getUserReminders } from "@/lib/taskUtils";
import { Search, ChevronDown, ChevronUp, AlertTriangle, Clock, CheckCircle, RefreshCw, Loader2, Pencil, Trash2, Tag, CalendarDays, User } from "lucide-react";

type Reminder = {
    id: string;
    title: string;
    description?: string;
    project_id?: string;
    project_ids?: string[];
    project_name?: string;
    project_names?: string[];
    urgency: number;
    type: string;
    status: string;
    due_date?: string;
    tags?: string[];
    created_by?: string;
    updated_at?: string;
    is_auto_generated?: boolean;
    subproject?: string;
};

const STATUS_COLORS: Record<string, string> = {
    "Pendiente": "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
    "En Proceso": "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
    "Esperando Respuesta": "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200",
    "Completado": "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
    "Cancelado": "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

const URGENCY_BADGE: Record<number, string> = {
    1: "🔴 Alta",
    2: "🟡 Media",
    3: "🔵 Baja",
};

type Props = {
    initialFilter?: string;
    onEdit: (id: string) => void;
};

export default function TaskList({ initialFilter = "all", onEdit }: Props) {
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [loading, setLoading] = useState(true);
    const [projects, setProjects] = useState<{ id: string; name: string; num_act: string }[]>([]);

    // Filtros
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    const [filterUrgency, setFilterUrgency] = useState("all");
    const [filterProject, setFilterProject] = useState("all");
    const [filterType, setFilterType] = useState("all");
    const [sortBy, setSortBy] = useState<"due_date" | "urgency" | "status" | "updated_at">("urgency");
    const [sortAsc, setSortAsc] = useState(true);

    useEffect(() => {
        // Aplicar filtro inicial del dashboard
        if (initialFilter === "critical") setFilterUrgency("1");
        else if (initialFilter === "overdue") { setFilterStatus("overdue"); }
        else if (initialFilter === "today") { setFilterStatus("today"); }
        else if (initialFilter === "next7") { setFilterStatus("next7"); }
        else if (initialFilter === "waiting") setFilterStatus("Esperando Respuesta");
        else if (initialFilter === "completedWeek") setFilterStatus("completedWeek");
        else if (initialFilter === "completedMonth") setFilterStatus("completedMonth");
    }, [initialFilter]);

    const fetchReminders = useCallback(async () => {
        setLoading(true);
        try {
            let userEmail: string | null = null;
            let userName: string = "Usuario";
            try {
                const reg = JSON.parse(getLocalStorageItem("pact_registration") || "{}");
                userEmail = reg.email || null;
                userName = reg.name || "Usuario";
            } catch {}
            if (!userEmail) {
                const { data: { session } } = await supabase.auth.getSession();
                userEmail = session?.user?.email || null;
                if (session?.user?.user_metadata?.name) userName = session.user.user_metadata.name;
            }

            const { data: proj } = await supabase.from("projects").select("id, name, num_act").order("name");
            if (proj) setProjects(proj);

            if (userEmail) {
                const data = await getUserReminders(userEmail, userName);
                const withProjects = data.map((r: any) => {
                    const pIds: string[] = Array.isArray(r.project_ids) && r.project_ids.length > 0
                        ? r.project_ids
                        : (r.project_id ? [r.project_id] : []);
                    const pNames = pIds.map(id => proj?.find(p => p.id === id)?.num_act).filter(Boolean) as string[];
                    const mainProjectName = pNames.length > 0 ? pNames.join(", ") : (proj?.find(p => p.id === r.project_id)?.num_act || "General");
                    return {
                        ...r,
                        project_ids: pIds,
                        project_name: mainProjectName,
                        project_names: pNames,
                    };
                });
                setReminders(withProjects);
            }
        } catch (err) {
            console.error("Error fetching reminders:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchReminders(); }, [fetchReminders]);

    const handleDelete = async (id: string) => {
        if (!confirm("¿Seguro que desea eliminar este pendiente?")) return;
        await supabase.from("reminders").delete().eq("id", id);
        setReminders(prev => prev.filter(r => r.id !== id));
    };

    const handleStatusChange = async (id: string, newStatus: string) => {
        await supabase.from("reminders").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", id);
        setReminders(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
    };

    // Filtrado y ordenamiento en cliente
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
    const next7End = new Date(todayEnd); next7End.setDate(next7End.getDate() + 7);
    const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(now); monthAgo.setDate(monthAgo.getDate() - 30);

    const filtered = reminders.filter(r => {
        if (search && !r.title.toLowerCase().includes(search.toLowerCase()) &&
            !r.description?.toLowerCase().includes(search.toLowerCase()) &&
            !r.project_name?.toLowerCase().includes(search.toLowerCase())) return false;
        if (filterUrgency !== "all" && r.urgency !== parseInt(filterUrgency)) return false;
        if (filterProject !== "all") {
            const pIds = r.project_ids || (r.project_id ? [r.project_id] : []);
            if (!pIds.includes(filterProject) && r.project_id !== filterProject) return false;
        }
        if (filterType !== "all" && r.type !== filterType) return false;
        const dd = r.due_date ? new Date(r.due_date) : null;
        const ua = r.updated_at ? new Date(r.updated_at) : null;
        if (filterStatus === "overdue") return dd && dd < todayStart && ["Pendiente", "En Proceso", "Esperando Respuesta"].includes(r.status);
        if (filterStatus === "today") return dd && dd >= todayStart && dd <= todayEnd && ["Pendiente", "En Proceso", "Esperando Respuesta"].includes(r.status);
        if (filterStatus === "next7") return dd && dd >= todayStart && dd <= next7End && ["Pendiente", "En Proceso", "Esperando Respuesta"].includes(r.status);
        if (filterStatus === "completedWeek") return r.status === "Completado" && ua && ua >= weekAgo;
        if (filterStatus === "completedMonth") return r.status === "Completado" && ua && ua >= monthAgo;
        if (filterStatus !== "all") return r.status === filterStatus;
        // Por defecto, ocultar Completados y Cancelados
        return r.status !== "Completado" && r.status !== "Cancelado";
    }).sort((a, b) => {
        let cmp = 0;
        if (sortBy === "urgency") cmp = a.urgency - b.urgency;
        else if (sortBy === "due_date") cmp = (a.due_date || "").localeCompare(b.due_date || "");
        else if (sortBy === "status") cmp = a.status.localeCompare(b.status);
        else cmp = (b.updated_at || "").localeCompare(a.updated_at || "");
        return sortAsc ? cmp : -cmp;
    });

    const toggleSort = (col: typeof sortBy) => {
        if (sortBy === col) setSortAsc(!sortAsc);
        else { setSortBy(col); setSortAsc(true); }
    };

    const SortIcon = ({ col }: { col: typeof sortBy }) => (
        sortBy === col ? (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ChevronDown size={12} className="opacity-30" />
    );

    if (loading) return <div className="flex justify-center py-16 text-slate-400"><Loader2 className="animate-spin" size={28} /></div>;

    return (
        <div className="space-y-4">
            {/* Barra de filtros */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="relative md:col-span-2">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por título, descripción o proyecto..."
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none text-sm focus:border-blue-500 transition-colors"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <select
                    className="px-3 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none text-sm focus:border-blue-500"
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                >
                    <option value="all">Todos los estados</option>
                    <option value="overdue">⚠️ Vencidos</option>
                    <option value="today">📅 Para Hoy</option>
                    <option value="next7">📆 Próximos 7 días</option>
                    <option value="Pendiente">Pendiente</option>
                    <option value="En Proceso">En Proceso</option>
                    <option value="Esperando Respuesta">Esperando Respuesta</option>
                    <option value="Completado">Completado</option>
                    <option value="Cancelado">Cancelado</option>
                    <option value="completedWeek">✅ Completados esta semana</option>
                    <option value="completedMonth">✅ Completados este mes</option>
                </select>
                <select
                    className="px-3 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none text-sm focus:border-blue-500"
                    value={filterUrgency}
                    onChange={e => setFilterUrgency(e.target.value)}
                >
                    <option value="all">Toda urgencia</option>
                    <option value="1">🔴 Alta</option>
                    <option value="2">🟡 Media</option>
                    <option value="3">🟢 Baja</option>
                </select>
                <select
                    className="px-3 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none text-sm focus:border-blue-500"
                    value={filterProject}
                    onChange={e => setFilterProject(e.target.value)}
                >
                    <option value="all">Todos los proyectos</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.num_act} – {p.name}</option>)}
                </select>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-semibold whitespace-nowrap">Ordenar por:</span>
                    {(["urgency", "due_date", "status", "updated_at"] as const).map(col => (
                        <button key={col} onClick={() => toggleSort(col)} className={`flex items-center gap-0.5 text-xs px-2 py-1 rounded-lg border transition-colors ${sortBy === col ? "bg-blue-100 border-blue-400 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" : "border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}`}>
                            {{ urgency: "Urgencia", due_date: "Fecha", status: "Estado", updated_at: "Actualizado" }[col]}
                            <SortIcon col={col} />
                        </button>
                    ))}
                </div>
            </div>

            {/* Contador */}
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold px-1">
                <span>{filtered.length} pendiente{filtered.length !== 1 ? "s" : ""}</span>
                <button onClick={fetchReminders} className="hover:text-blue-500 flex items-center gap-1 transition-colors">
                    <RefreshCw size={12} /> Actualizar
                </button>
            </div>

            {/* Lista */}
            {filtered.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                    <CheckCircle size={48} className="mx-auto mb-3 opacity-30" />
                    <p className="font-semibold">No hay pendientes con estos filtros</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(r => {
                        const isOverdue = r.due_date && new Date(r.due_date) < todayStart && ["Pendiente", "En Proceso", "Esperando Respuesta"].includes(r.status);
                        const isToday = r.due_date && new Date(r.due_date) >= todayStart && new Date(r.due_date) <= todayEnd;
                        return (
                            <div key={r.id} className={`rounded-xl border-2 p-4 transition-all hover:shadow-md ${isOverdue ? "border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-800" : isToday ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"}`}>
                                <div className="flex items-start gap-3">
                                    {/* Indicador de urgencia */}
                                    <div className={`mt-0.5 w-2.5 h-2.5 rounded-full shrink-0 ${r.urgency === 1 ? "bg-red-500" : r.urgency === 2 ? "bg-amber-400" : "bg-green-500"}`} />

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2 flex-wrap">
                                            <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-snug">{r.title}</h4>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <button onClick={() => onEdit(r.id)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title="Editar">
                                                    <Pencil size={14} />
                                                </button>
                                                <button onClick={() => handleDelete(r.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Eliminar">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        {r.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{r.description}</p>}

                                        <div className="flex flex-wrap items-center gap-2 mt-2">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status] || STATUS_COLORS["Pendiente"]}`}>{r.status}</span>
                                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{r.type}</span>
                                            <span className="text-[10px] font-semibold text-slate-400">{URGENCY_BADGE[r.urgency]}</span>
                                            {r.project_name && <span className="text-[10px] text-slate-400 flex items-center gap-0.5"><CalendarDays size={10} /> {r.project_name}</span>}
                                            {r.due_date && (
                                                <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${isOverdue ? "text-red-600" : isToday ? "text-amber-600" : "text-slate-400"}`}>
                                                    <Clock size={10} />
                                                    {isOverdue ? "⚠️ Vencido: " : ""}
                                                    {new Date(r.due_date).toLocaleDateString()}
                                                </span>
                                            )}
                                            {r.is_auto_generated && (
                                                <span className="text-[9px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-500 px-2 py-0.5 rounded-full uppercase tracking-wide">Auto • Sistema</span>
                                            )}
                                        </div>

                                        {/* Tags */}
                                        {r.tags && r.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1.5">
                                                {r.tags.map(t => (
                                                    <span key={t} className="text-[9px] px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 rounded-full border border-blue-200 dark:border-blue-700 font-semibold">#{t}</span>
                                                ))}
                                            </div>
                                        )}

                                        {/* Cambio rápido de estado */}
                                        <div className="mt-2">
                                            <select
                                                value={r.status}
                                                onChange={e => handleStatusChange(r.id, e.target.value)}
                                                className="text-[10px] font-bold px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none cursor-pointer hover:border-blue-400 transition-colors"
                                            >
                                                <option value="Pendiente">Pendiente</option>
                                                <option value="En Proceso">En Proceso</option>
                                                <option value="Esperando Respuesta">Esperando Respuesta</option>
                                                <option value="Completado">✅ Completado</option>
                                                <option value="Cancelado">Cancelado</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
