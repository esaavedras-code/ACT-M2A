"use client";

import { useState, useEffect } from "react";
import { X, LayoutDashboard, ListTodo, Plus, Trello, CalendarDays, ArrowLeft } from "lucide-react";
import TaskDashboard from "./TaskDashboard";
import TaskList from "./TaskList";
import TaskForm from "./TaskForm";
import TaskKanban from "./TaskKanban";
import TaskCalendar from "./TaskCalendar";

type Tab = "dashboard" | "list" | "kanban" | "calendar" | "form";

export default function TaskCenterSidebar() {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>("dashboard");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [dashboardFilter, setDashboardFilter] = useState("all");
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const handleOpen = () => { setIsOpen(true); setActiveTab("dashboard"); };
        window.addEventListener("open-task-center", handleOpen);
        return () => window.removeEventListener("open-task-center", handleOpen);
    }, []);

    if (!mounted || !isOpen) return null;

    const openNew = () => { setEditingId(null); setActiveTab("form"); };
    const openEdit = (id: string) => { setEditingId(id); setActiveTab("form"); };
    const afterSave = () => { setActiveTab("list"); setEditingId(null); setDashboardFilter("all"); };
    const handleFilteredView = (filter: string) => { setDashboardFilter(filter); setActiveTab("list"); };
    const goBack = () => { setActiveTab(editingId ? "list" : "dashboard"); setEditingId(null); };

    const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={15} /> },
        { id: "list",      label: "Lista",      icon: <ListTodo size={15} /> },
        { id: "kanban",    label: "Kanban",     icon: <Trello size={15} /> },
        { id: "calendar",  label: "Calendario", icon: <CalendarDays size={15} /> },
    ];

    const TAB_TITLES: Record<Tab, string> = {
        dashboard: "Resumen General",
        list:      "Lista de Pendientes",
        kanban:    "Vista Kanban",
        calendar:  "Calendario",
        form:      editingId ? "Editar Pendiente" : "Nuevo Pendiente",
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[999] bg-black/50 backdrop-blur-sm"
                onClick={() => setIsOpen(false)}
            />

            {/* Panel lateral */}
            <div
                className="fixed top-0 right-0 z-[1000] h-full w-full max-w-4xl bg-white dark:bg-slate-950 shadow-2xl flex flex-col"
                style={{ animation: "slideInFromRight 0.3s ease-out" }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-blue-700 to-blue-600 text-white shrink-0">
                    <div className="flex items-center gap-3">
                        {activeTab === "form" && (
                            <button onClick={goBack} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                                <ArrowLeft size={18} />
                            </button>
                        )}
                        <div>
                            <p className="text-[10px] font-bold opacity-70 uppercase tracking-widest">Centro de Pendientes y Recordatorios</p>
                            <h2 className="text-lg font-black leading-tight">{TAB_TITLES[activeTab]}</h2>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {activeTab !== "form" && (
                            <button
                                onClick={openNew}
                                className="flex items-center gap-1.5 px-3 py-2 bg-white text-blue-700 text-xs font-black rounded-xl hover:bg-blue-50 transition-colors shadow-md"
                            >
                                <Plus size={14} />
                                Nuevo
                            </button>
                        )}
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-2 hover:bg-white/20 rounded-full transition-colors"
                            title="Cerrar"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Tabs (no mostrar en formulario) */}
                {activeTab !== "form" && (
                    <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shrink-0 overflow-x-auto">
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap ${
                                    activeTab === tab.id
                                        ? "border-blue-600 text-blue-600 bg-white dark:bg-slate-950"
                                        : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                                }`}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* Contenido */}
                <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                    {activeTab === "dashboard" && (
                        <TaskDashboard onFilteredView={handleFilteredView} />
                    )}
                    {activeTab === "list" && (
                        <TaskList initialFilter={dashboardFilter} onEdit={openEdit} />
                    )}
                    {activeTab === "kanban" && (
                        <TaskKanban onEdit={openEdit} />
                    )}
                    {activeTab === "calendar" && (
                        <TaskCalendar onEdit={openEdit} />
                    )}
                    {activeTab === "form" && (
                        <TaskForm
                            reminderId={editingId}
                            onSaved={afterSave}
                            onCancel={goBack}
                        />
                    )}
                </div>
            </div>

            {/* Animación CSS */}
            <style jsx global>{`
                @keyframes slideInFromRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to   { transform: translateX(0);    opacity: 1; }
                }
            `}</style>
        </>
    );
}
