"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { getLocalStorageItem } from "@/lib/utils";
import { getUserReminders } from "@/lib/taskUtils";
import {
    ClipboardList, AlertTriangle, Clock3, CalendarCheck, Calendar, Users, CheckCircle, TrendingUp,
    Loader2
} from "lucide-react";

type DashboardStats = {
    total: number;
    critical: number;
    overdue: number;
    today: number;
    next7days: number;
    waitingResponse: number;
    completedWeek: number;
    completedMonth: number;
};

type Props = {
    onFilteredView: (filter: string) => void;
};

export default function TaskDashboard({ onFilteredView }: Props) {
    const [stats, setStats] = useState<DashboardStats>({
        total: 0, critical: 0, overdue: 0, today: 0,
        next7days: 0, waitingResponse: 0, completedWeek: 0, completedMonth: 0,
    });
    const [loading, setLoading] = useState(true);

    const getUserEmail = async (): Promise<string | null> => {
        try {
            const reg = JSON.parse(getLocalStorageItem("pact_registration") || "{}");
            if (reg.email) return reg.email;
        } catch {}
        const { data: { session } } = await supabase.auth.getSession();
        return session?.user?.email || null;
    };

    const fetchStats = useCallback(async () => {
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

            if (!userEmail) { setLoading(false); return; }

            const userReminders = await getUserReminders(userEmail, userName);

            const now = new Date();
            const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
            const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
            const next7 = new Date(todayEnd); next7.setDate(next7.getDate() + 7);
            const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
            const monthAgo = new Date(now); monthAgo.setDate(monthAgo.getDate() - 30);

            const activeStatuses = ["Pendiente", "En Proceso", "Esperando Respuesta"];

            let total = 0, critical = 0, overdue = 0, today = 0, next7days = 0, waitingResponse = 0, completedWeek = 0, completedMonth = 0;

            userReminders.forEach((r: any) => {
                const isActive = activeStatuses.includes(r.status);
                const dueDate = r.due_date ? new Date(r.due_date) : null;
                const updatedAt = r.updated_at ? new Date(r.updated_at) : null;

                if (isActive) {
                    total++;
                    if (r.urgency === 1) critical++;
                    if (dueDate && dueDate < todayStart) overdue++;
                    if (dueDate && dueDate >= todayStart && dueDate <= todayEnd) today++;
                    if (dueDate && dueDate >= todayStart && dueDate <= next7) next7days++;
                }

                if (r.status === "Esperando Respuesta") waitingResponse++;

                if (r.status === "Completado" && updatedAt) {
                    if (updatedAt >= weekAgo) completedWeek++;
                    if (updatedAt >= monthAgo) completedMonth++;
                }
            });

            setStats({
                total, critical, overdue, today, next7days, waitingResponse, completedWeek, completedMonth
            });
        } catch (err) {
            console.error("Error al obtener estadísticas del dashboard:", err);
        } finally {
            setLoading(false);
        }
    }, []);
        } catch (err) {
            console.error("Error fetching dashboard stats:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchStats(); }, [fetchStats]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-48 text-slate-400">
                <Loader2 className="animate-spin mr-2" size={20} />
                Cargando indicadores...
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Título sección activos */}
            <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Pendientes Activos</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard
                        label="Total Pendientes"
                        value={stats.total}
                        color="blue"
                        icon={<ClipboardList size={20} />}
                        onClick={() => onFilteredView("all")}
                    />
                    <StatCard
                        label="Críticos 🔴"
                        value={stats.critical}
                        color="red"
                        icon={<AlertTriangle size={20} />}
                        onClick={() => onFilteredView("critical")}
                    />
                    <StatCard
                        label="Vencidos"
                        value={stats.overdue}
                        color="rose"
                        icon={<Clock3 size={20} />}
                        onClick={() => onFilteredView("overdue")}
                        pulse={stats.overdue > 0}
                    />
                    <StatCard
                        label="Para Hoy"
                        value={stats.today}
                        color="amber"
                        icon={<CalendarCheck size={20} />}
                        onClick={() => onFilteredView("today")}
                    />
                </div>
            </div>

            <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Próximos & Seguimiento</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard
                        label="Próx. 7 Días"
                        value={stats.next7days}
                        color="orange"
                        icon={<Calendar size={20} />}
                        onClick={() => onFilteredView("next7")}
                    />
                    <StatCard
                        label="Esperando Respuesta"
                        value={stats.waitingResponse}
                        color="purple"
                        icon={<Users size={20} />}
                        onClick={() => onFilteredView("waiting")}
                    />
                    <StatCard
                        label="Completados Esta Semana"
                        value={stats.completedWeek}
                        color="green"
                        icon={<CheckCircle size={20} />}
                        onClick={() => onFilteredView("completedWeek")}
                    />
                    <StatCard
                        label="Completados Este Mes"
                        value={stats.completedMonth}
                        color="teal"
                        icon={<TrendingUp size={20} />}
                        onClick={() => onFilteredView("completedMonth")}
                    />
                </div>
            </div>
        </div>
    );
}

type StatCardProps = {
    label: string;
    value: number;
    color: "blue" | "red" | "rose" | "amber" | "orange" | "purple" | "green" | "teal";
    icon: React.ReactNode;
    onClick: () => void;
    pulse?: boolean;
};

const colorMap: Record<string, string> = {
    blue:   "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300",
    red:    "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300",
    rose:   "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300",
    amber:  "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300",
    orange: "bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300",
    purple: "bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300",
    green:  "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300",
    teal:   "bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300",
};

function StatCard({ label, value, color, icon, onClick, pulse }: StatCardProps) {
    return (
        <button
            onClick={onClick}
            className={`relative flex flex-col items-start gap-2 p-4 rounded-xl border cursor-pointer hover:shadow-md transition-all text-left ${colorMap[color]}`}
        >
            {pulse && (
                <span className="absolute top-2 right-2 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
            )}
            <span className="opacity-70">{icon}</span>
            <div>
                <p className="text-3xl font-black">{value}</p>
                <p className="text-[11px] font-semibold opacity-75 leading-tight mt-0.5">{label}</p>
            </div>
        </button>
    );
}
