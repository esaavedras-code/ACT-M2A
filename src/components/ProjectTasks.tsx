"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { 
    Plus, Trash2, Edit, Calendar, User, 
    AlertCircle, Filter, CheckCircle2, List, 
    KanbanSquare, Loader2, Save, X, ArrowRight,
    CheckSquare, AlertTriangle, Clock
} from "lucide-react";

interface Task {
    id: string;
    project_id: string;
    title: string;
    description: string | null;
    priority: "Alta" | "Media" | "Baja";
    status: "Pendiente" | "En Proceso" | "Completado";
    due_date: string | null;
    assigned_to: string | null;
    created_by: string | null;
    created_at: string;
    completed_at: string | null;
    assigned_user?: { name: string; email: string } | null;
}

interface Member {
    id: string;
    name: string;
    email: string;
    role: string;
}

interface ProjectTasksProps {
    projectId: string;
    userRole: string;
}

export default function ProjectTasks({ projectId, userRole }: ProjectTasksProps) {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
    const [filterPriority, setFilterPriority] = useState<string>("Todos");
    const [filterStatus, setFilterStatus] = useState<string>("Todos");
    const [searchQuery, setSearchQuery] = useState("");
    
    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [modalTitle, setModalTitle] = useState("");
    const [modalDesc, setModalDesc] = useState("");
    const [modalPriority, setModalPriority] = useState<"Alta" | "Media" | "Baja">("Media");
    const [modalStatus, setModalStatus] = useState<"Pendiente" | "En Proceso" | "Completado">("Pendiente");
    const [modalDueDate, setModalDueDate] = useState("");
    const [modalAssignedTo, setModalAssignedTo] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // Permisos
    const canManage = ["A", "B", "C"].includes(userRole);
    const isContractor = userRole === "F";
    const isReadOnly = userRole === "D";

    // Tema dinámico
    const themeColor = isContractor ? "bg-[#670010]" : "bg-blue-600";
    const themeTextColor = isContractor ? "text-[#670010]" : "text-blue-600";
    const themeBorderColor = isContractor ? "border-[#670010]" : "border-blue-600";
    const themeHoverBg = isContractor ? "hover:bg-[#4a000b]" : "hover:bg-blue-700";
    const themeFocusRing = isContractor ? "focus:ring-[#670010]/20" : "focus:ring-blue-100";

    useEffect(() => {
        if (!projectId) return;

        fetchTasks();
        fetchProjectMembers();

        // Suscripción en Tiempo Real con Supabase
        const tasksChannel = supabase
            .channel(`project-tasks-changes-${projectId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "project_tasks",
                    filter: `project_id=eq.${projectId}`
                },
                () => {
                    fetchTasks();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(tasksChannel);
        };
    }, [projectId]);

    const fetchTasks = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("project_tasks")
                .select("*, assigned_user:users(name, email)")
                .eq("project_id", projectId)
                .order("created_at", { ascending: false });

            if (error) throw error;

            // Mapeamos los datos para estructurar correctamente assigned_user
            const mappedTasks = (data || []).map((t: any) => ({
                ...t,
                assigned_user: t.assigned_user ? {
                    name: Array.isArray(t.assigned_user) ? t.assigned_user[0]?.name : t.assigned_user.name,
                    email: Array.isArray(t.assigned_user) ? t.assigned_user[0]?.email : t.assigned_user.email,
                } : null
            }));

            setTasks(mappedTasks);
        } catch (err) {
            console.error("Error al obtener pendientes:", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchProjectMembers = async () => {
        try {
            // Obtenemos los miembros activos vinculados a este proyecto
            const { data, error } = await supabase
                .from("memberships")
                .select("role, user:users(id, name, email)")
                .eq("project_id", projectId)
                .is("revoked_at", null)
                .eq("is_active", true);

            if (error) throw error;

            const mappedMembers = (data || [])
                .filter((m: any) => m.user)
                .map((m: any) => {
                    const u = Array.isArray(m.user) ? m.user[0] : m.user;
                    return {
                        id: u.id,
                        name: u.name,
                        email: u.email,
                        role: m.role
                    };
                });

            setMembers(mappedMembers);
        } catch (err) {
            console.error("Error al cargar miembros del proyecto:", err);
        }
    };

    const handleOpenCreateModal = () => {
        setEditingTask(null);
        setModalTitle("");
        setModalDesc("");
        setModalPriority("Media");
        setModalStatus("Pendiente");
        setModalDueDate("");
        setModalAssignedTo("");
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (task: Task) => {
        setEditingTask(task);
        setModalTitle(task.title);
        setModalDesc(task.description || "");
        setModalPriority(task.priority);
        setModalStatus(task.status);
        setModalDueDate(task.due_date || "");
        setModalAssignedTo(task.assigned_to || "");
        setIsModalOpen(true);
    };

    const handleSaveTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!modalTitle.trim()) return;

        setIsSaving(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const currentUserId = session?.user?.id || null;

            const taskData: any = {
                project_id: projectId,
                title: modalTitle,
                description: modalDesc || null,
                priority: modalPriority,
                status: modalStatus,
                due_date: modalDueDate || null,
                assigned_to: modalAssignedTo || null,
                completed_at: modalStatus === "Completado" ? new Date().toISOString() : null
            };

            if (editingTask) {
                const { error } = await supabase
                    .from("project_tasks")
                    .update(taskData)
                    .eq("id", editingTask.id);

                if (error) throw error;
            } else {
                taskData.created_by = currentUserId;
                const { error } = await supabase
                    .from("project_tasks")
                    .insert([taskData]);

                if (error) throw error;
            }

            setIsModalOpen(false);
            fetchTasks();
        } catch (err) {
            console.error("Error al guardar tarea:", err);
            alert("No se pudo guardar la tarea. Inténtelo nuevamente.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteTask = async (id: string) => {
        if (!confirm("¿Está seguro de que desea eliminar este pendiente permanentemente?")) return;

        try {
            const { error } = await supabase
                .from("project_tasks")
                .delete()
                .eq("id", id);

            if (error) throw error;
            fetchTasks();
        } catch (err) {
            console.error("Error al eliminar la tarea:", err);
            alert("No se pudo eliminar el pendiente.");
        }
    };

    const handleQuickStatusChange = async (task: Task, newStatus: "Pendiente" | "En Proceso" | "Completado") => {
        try {
            const { error } = await supabase
                .from("project_tasks")
                .update({ 
                    status: newStatus,
                    completed_at: newStatus === "Completado" ? new Date().toISOString() : null
                })
                .eq("id", task.id);

            if (error) throw error;
            fetchTasks();
        } catch (err) {
            console.error("Error al cambiar de estado:", err);
        }
    };

    // Filtrar tareas locales
    const filteredTasks = tasks.filter(t => {
        const matchesPriority = filterPriority === "Todos" || t.priority === filterPriority;
        const matchesStatus = filterStatus === "Todos" || t.status === filterStatus;
        const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
            (t.description || "").toLowerCase().includes(searchQuery.toLowerCase());
        
        return matchesPriority && matchesStatus && matchesSearch;
    });

    const getPriorityBadgeClass = (priority: string) => {
        switch (priority) {
            case "Alta":
                return "bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-200 dark:border-rose-900";
            case "Media":
                return "bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-200 dark:border-amber-900";
            default:
                return "bg-sky-50 text-sky-600 dark:bg-sky-950/20 dark:text-sky-400 border border-sky-200 dark:border-sky-900";
        }
    };

    const getInitials = (name: string) => {
        if (!name) return "?";
        return name
            .split(" ")
            .map(n => n[0])
            .slice(0, 2)
            .join("")
            .toUpperCase();
    };

    return (
        <div className="space-y-6 p-1 md:p-4">
            {/* Header del Módulo de Pendientes */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-50 dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                <div>
                    <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-2">
                        <CheckSquare className={themeTextColor} size={22} />
                        Pendientes de Proyecto
                    </h2>
                    <p className="text-xs font-semibold text-slate-400 mt-1">
                        Organice, asigne y monitoree las tareas del proyecto en tiempo real.
                    </p>
                </div>

                {!isReadOnly && canManage && (
                    <button
                        onClick={handleOpenCreateModal}
                        className={`flex items-center justify-center gap-2 px-5 py-3 rounded-2xl ${themeColor} text-white font-black text-[10px] uppercase tracking-wider ${themeHoverBg} active:scale-95 transition-all shadow-md`}
                    >
                        <Plus size={14} />
                        Nuevo Pendiente
                    </button>
                )}
            </div>

            {/* Barra de Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-900 shadow-sm">
                {/* Buscador */}
                <div className="relative md:col-span-2">
                    <input
                        type="text"
                        placeholder="Buscar por título o descripción..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                </div>

                {/* Filtro de Prioridad */}
                <div className="flex items-center gap-2">
                    <Filter size={12} className="text-slate-400 shrink-0" />
                    <select
                        value={filterPriority}
                        onChange={e => setFilterPriority(e.target.value)}
                        className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-white rounded-xl px-3 py-2.5 focus:outline-none"
                    >
                        <option value="Todos">Todas las Prioridades</option>
                        <option value="Alta">Prioridad Alta</option>
                        <option value="Media">Prioridad Media</option>
                        <option value="Baja">Prioridad Baja</option>
                    </select>
                </div>

                {/* Botones de Cambio de Vista */}
                <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl w-full justify-between items-center self-stretch">
                    <button
                        onClick={() => setViewMode("kanban")}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[9px] uppercase tracking-wider font-black transition-all ${
                            viewMode === "kanban" 
                                ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm' 
                                : 'text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        <KanbanSquare size={13} />
                        Kanban
                    </button>
                    <button
                        onClick={() => setViewMode("list")}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[9px] uppercase tracking-wider font-black transition-all ${
                            viewMode === "list" 
                                ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm' 
                                : 'text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        <List size={13} />
                        Lista
                    </button>
                </div>
            </div>

            {/* Contenido Principal según el Modo de Vista */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-900 rounded-3xl">
                    <Loader2 className={`w-8 h-8 animate-spin ${themeTextColor} mb-2`} />
                    <p className="text-[9px] uppercase font-black tracking-widest text-slate-400">Cargando tareas...</p>
                </div>
            ) : filteredTasks.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-900 rounded-3xl">
                    <AlertCircle className="mx-auto text-slate-300 dark:text-slate-700 mb-3" size={32} />
                    <h3 className="text-sm font-black text-slate-600 dark:text-slate-300 uppercase">Sin pendientes encontrados</h3>
                    <p className="text-[10px] text-slate-400 mt-1 font-semibold">
                        {searchQuery || filterPriority !== "Todos" 
                            ? "Pruebe ajustando los filtros de búsqueda." 
                            : "¡Enhorabuena! No hay tareas pendientes registradas en este momento."}
                    </p>
                </div>
            ) : viewMode === "kanban" ? (
                /* --- VISTA KANBAN --- */
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                    {/* Columna: PENDIENTE */}
                    <div className="bg-slate-50/50 dark:bg-slate-900/40 p-4 rounded-3xl border border-slate-100 dark:border-slate-800/80">
                        <div className="flex items-center justify-between mb-4 px-2">
                            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-slate-400 animate-pulse"></span>
                                Por Hacer
                            </span>
                            <span className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-black text-[9px] px-2 py-0.5 rounded-full">
                                {filteredTasks.filter(t => t.status === "Pendiente").length}
                            </span>
                        </div>
                        <div className="space-y-4">
                            {filteredTasks
                                .filter(t => t.status === "Pendiente")
                                .map(task => renderKanbanCard(task))}
                        </div>
                    </div>

                    {/* Columna: EN PROCESO */}
                    <div className="bg-slate-50/50 dark:bg-slate-900/40 p-4 rounded-3xl border border-slate-100 dark:border-slate-800/80">
                        <div className="flex items-center justify-between mb-4 px-2">
                            <span className="text-[10px] font-black uppercase text-amber-500 tracking-wider flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                                En Proceso
                            </span>
                            <span className="bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-black text-[9px] px-2 py-0.5 rounded-full">
                                {filteredTasks.filter(t => t.status === "En Proceso").length}
                            </span>
                        </div>
                        <div className="space-y-4">
                            {filteredTasks
                                .filter(t => t.status === "En Proceso")
                                .map(task => renderKanbanCard(task))}
                        </div>
                    </div>

                    {/* Columna: COMPLETADO */}
                    <div className="bg-slate-50/50 dark:bg-slate-900/40 p-4 rounded-3xl border border-slate-100 dark:border-slate-800/80">
                        <div className="flex items-center justify-between mb-4 px-2">
                            <span className="text-[10px] font-black uppercase text-emerald-500 tracking-wider flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                Completado
                            </span>
                            <span className="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-black text-[9px] px-2 py-0.5 rounded-full">
                                {filteredTasks.filter(t => t.status === "Completado").length}
                            </span>
                        </div>
                        <div className="space-y-4">
                            {filteredTasks
                                .filter(t => t.status === "Completado")
                                .map(task => renderKanbanCard(task))}
                        </div>
                    </div>
                </div>
            ) : (
                /* --- VISTA DE LISTA (TABLA) --- */
                <div className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-900 rounded-3xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100 dark:border-slate-800 text-[9px] font-black uppercase tracking-wider text-slate-400 bg-slate-50/50 dark:bg-slate-900/30">
                                    <th className="py-3 px-6">Tarea</th>
                                    <th className="py-3 px-4">Prioridad</th>
                                    <th className="py-3 px-4">Estado</th>
                                    <th className="py-3 px-4">Responsable</th>
                                    <th className="py-3 px-4">Vencimiento</th>
                                    {!isReadOnly && <th className="py-3 px-6 text-right">Acciones</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
                                {filteredTasks.map(task => (
                                    <tr key={task.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                                        <td className="py-4 px-6">
                                            <div className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                                                {task.title}
                                            </div>
                                            {task.description && (
                                                <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5 font-semibold">
                                                    {task.description}
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-4 px-4">
                                            <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${getPriorityBadgeClass(task.priority)}`}>
                                                {task.priority}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4">
                                            <select
                                                disabled={isReadOnly}
                                                value={task.status}
                                                onChange={(e) => handleQuickStatusChange(task, e.target.value as any)}
                                                className={`text-[9px] font-bold uppercase rounded-lg px-2.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none ${
                                                    task.status === "Completado" ? "text-emerald-500" : task.status === "En Proceso" ? "text-amber-500" : "text-slate-500"
                                                }`}
                                            >
                                                <option value="Pendiente">Pendiente</option>
                                                <option value="En Proceso">En Proceso</option>
                                                <option value="Completado">Completado</option>
                                            </select>
                                        </td>
                                        <td className="py-4 px-4">
                                            {task.assigned_user ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 flex items-center justify-center font-black text-[9px] shrink-0 border border-blue-200 dark:border-blue-800">
                                                        {getInitials(task.assigned_user.name)}
                                                    </div>
                                                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                        {task.assigned_user.name}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-slate-400 font-semibold italic">Sin asignar</span>
                                            )}
                                        </td>
                                        <td className="py-4 px-4">
                                            {task.due_date ? (
                                                <span className={`text-[10px] font-bold flex items-center gap-1.5 ${
                                                    new Date(task.due_date) < new Date() && task.status !== "Completado" 
                                                        ? "text-red-500" 
                                                        : "text-slate-500"
                                                }`}>
                                                    <Clock size={11} />
                                                    {new Date(task.due_date).toLocaleDateString()}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] text-slate-400 font-semibold italic">Ilimitado</span>
                                            )}
                                        </td>
                                        {!isReadOnly && (
                                            <td className="py-4 px-6 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {canManage && (
                                                        <>
                                                            <button
                                                                onClick={() => handleOpenEditModal(task)}
                                                                className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                                                            >
                                                                <Edit size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteTask(task.id)}
                                                                className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* --- MODAL DE CREACIÓN / EDICIÓN --- */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        {/* Header del Modal */}
                        <div className={`px-6 py-5 text-white ${themeColor} flex items-center justify-between`}>
                            <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                <CheckSquare size={16} />
                                {editingTask ? "Editar Pendiente" : "Crear Pendiente"}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-white/80 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Formulario */}
                        <form onSubmit={handleSaveTask} className="p-6 space-y-4">
                            {/* Título */}
                            <div className="space-y-1">
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                    Título del pendiente <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={modalTitle}
                                    onChange={e => setModalTitle(e.target.value)}
                                    placeholder="Ej. Entregar planos modificados del tramo A..."
                                    className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                />
                            </div>

                            {/* Descripción */}
                            <div className="space-y-1">
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                    Descripción detallada
                                </label>
                                <textarea
                                    value={modalDesc}
                                    onChange={e => setModalDesc(e.target.value)}
                                    placeholder="Proporcione indicaciones adicionales si es necesario..."
                                    rows={3}
                                    className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Prioridad */}
                                <div className="space-y-1">
                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                        Prioridad
                                    </label>
                                    <select
                                        value={modalPriority}
                                        onChange={e => setModalPriority(e.target.value as any)}
                                        className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    >
                                        <option value="Alta">Alta</option>
                                        <option value="Media">Media</option>
                                        <option value="Baja">Baja</option>
                                    </select>
                                </div>

                                {/* Estado */}
                                <div className="space-y-1">
                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                        Estado de progreso
                                    </label>
                                    <select
                                        value={modalStatus}
                                        onChange={e => setModalStatus(e.target.value as any)}
                                        className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    >
                                        <option value="Pendiente">Pendiente</option>
                                        <option value="En Proceso">En Proceso</option>
                                        <option value="Completado">Completado</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Fecha de Vencimiento */}
                                <div className="space-y-1">
                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                        Fecha límite
                                    </label>
                                    <input
                                        type="date"
                                        value={modalDueDate}
                                        onChange={e => setModalDueDate(e.target.value)}
                                        className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    />
                                </div>

                                {/* Asignado a */}
                                <div className="space-y-1">
                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                        Responsable (Asignar)
                                    </label>
                                    <select
                                        value={modalAssignedTo}
                                        onChange={e => setModalAssignedTo(e.target.value)}
                                        className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-xl px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    >
                                        <option value="">Sin Asignar (Ninguno)</option>
                                        {members.map(member => (
                                            <option key={member.id} value={member.id}>
                                                {member.name} ({member.role === 'F' ? 'Contratista' : `Rol ${member.role}`})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Botones de Acción */}
                            <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl ${themeColor} ${themeHoverBg} text-white font-black text-xs uppercase tracking-wider disabled:opacity-50 transition-colors shadow-md`}
                                >
                                    {isSaving ? (
                                        <>
                                            <Loader2 size={14} className="animate-spin" />
                                            Grabando...
                                        </>
                                    ) : (
                                        <>
                                            <Save size={14} />
                                            Guardar Pendiente
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );

    /* --- RENDER CARD KANBAN --- */
    function renderKanbanCard(task: Task) {
        const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "Completado";

        return (
            <div 
                key={task.id} 
                className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-100 dark:border-slate-850 hover:border-slate-200 dark:hover:border-slate-850 transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.03)] group"
            >
                {/* Categoría y Acciones */}
                <div className="flex items-center justify-between mb-3">
                    <span className={`text-[8px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full ${getPriorityBadgeClass(task.priority)}`}>
                        {task.priority}
                    </span>

                    {/* Acciones Rápidas */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!isReadOnly && (
                            <>
                                {task.status !== "Completado" && (
                                    <button
                                        onClick={() => {
                                            const nextStatus = task.status === "Pendiente" ? "En Proceso" : "Completado";
                                            handleQuickStatusChange(task, nextStatus);
                                        }}
                                        title={task.status === "Pendiente" ? "Iniciar Tarea" : "Completar Tarea"}
                                        className="p-1 text-slate-400 hover:text-emerald-500 rounded hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                                    >
                                        <ArrowRight size={12} />
                                    </button>
                                )}
                                {canManage && (
                                    <>
                                        <button
                                            onClick={() => handleOpenEditModal(task)}
                                            title="Editar pendiente"
                                            className="p-1 text-slate-400 hover:text-blue-500 rounded hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                                        >
                                            <Edit size={12} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteTask(task.id)}
                                            title="Eliminar pendiente"
                                            className="p-1 text-slate-400 hover:text-red-500 rounded hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Título de la Tarea */}
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 line-clamp-2 leading-relaxed">
                    {task.title}
                </h4>

                {/* Descripción */}
                {task.description && (
                    <p className="text-[10px] text-slate-400 font-semibold mt-1.5 line-clamp-3 leading-relaxed">
                        {task.description}
                    </p>
                )}

                {/* Línea Divisoria */}
                <div className="h-px bg-slate-50 dark:bg-slate-900 my-4"></div>

                {/* Footer de Tarjeta (Usuario e Info) */}
                <div className="flex items-center justify-between">
                    {/* Responsable */}
                    {task.assigned_user ? (
                        <div className="flex items-center gap-1.5" title={`Responsable: ${task.assigned_user.name}`}>
                            <div className="w-5 h-5 rounded-full bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center font-black text-[8px] border border-blue-100 dark:border-blue-900">
                                {getInitials(task.assigned_user.name)}
                            </div>
                            <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 line-clamp-1 max-w-[70px]">
                                {task.assigned_user.name.split(" ")[0]}
                            </span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 text-slate-400">
                            <User size={12} />
                            <span className="text-[9px] font-bold italic">Sin asignar</span>
                        </div>
                    )}

                    {/* Vencimiento */}
                    {task.due_date ? (
                        <span className={`text-[9px] font-black flex items-center gap-1 px-2 py-0.5 rounded-md ${
                            isOverdue 
                                ? "bg-red-50 text-red-500 dark:bg-red-950/20" 
                                : "bg-slate-100 text-slate-500 dark:bg-slate-900"
                        }`}>
                            {isOverdue && <AlertTriangle size={9} />}
                            {new Date(task.due_date).toLocaleDateString("es-ES", { month: "short", day: "numeric" })}
                        </span>
                    ) : (
                        <span className="text-[8px] font-bold text-slate-400 italic">Ilimitado</span>
                    )}
                </div>
            </div>
        );
    }
}
