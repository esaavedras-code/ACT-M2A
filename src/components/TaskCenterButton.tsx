"use client";

import { Bell } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function TaskCenterButton() {
    const [pendingCount, setPendingCount] = useState(0);

    useEffect(() => {
        const fetchPending = async () => {
            try {
                // Obtenemos los pendientes que sean para hoy o vencidos
                const today = new Date();
                today.setHours(23, 59, 59, 999);
                
                const { count, error } = await supabase
                    .from("reminders")
                    .select("*", { count: "exact", head: true })
                    .in("status", ["Pendiente", "En Proceso", "Esperando Respuesta"])
                    .lte("due_date", today.toISOString());

                if (!error && count !== null) {
                    setPendingCount(count);
                }
            } catch (err) {
                console.error("Error fetching pending tasks count", err);
            }
        };

        fetchPending();

        const channel = supabase
            .channel('reminders_count_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'reminders' }, () => {
                fetchPending();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const openTaskCenter = () => {
        const event = new CustomEvent("open-task-center");
        window.dispatchEvent(event);
    };

    return (
        <button
            onClick={openTaskCenter}
            className="relative p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors flex items-center justify-center group"
            title="Centro de Pendientes y Recordatorios"
        >
            <Bell size={20} className="group-hover:scale-110 transition-transform" />
            {pendingCount > 0 && (
                <span className="absolute top-0 right-0 inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold text-white bg-red-500 border-2 border-[#1e3a8a] rounded-full -translate-y-1/4 translate-x-1/4">
                    {pendingCount > 99 ? '99+' : pendingCount}
                </span>
            )}
        </button>
    );
}
