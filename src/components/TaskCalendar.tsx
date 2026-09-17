"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { getLocalStorageItem } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

type Reminder = {
    id: string;
    title: string;
    urgency: number;
    status: string;
    type: string;
    due_date: string;
};

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DAYS = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

const URGENCY_DOT: Record<number, string> = { 1: "bg-red-500", 2: "bg-amber-400", 3: "bg-green-500" };

type Props = { onEdit: (id: string) => void };

export default function TaskCalendar({ onEdit }: Props) {
    const today = new Date();
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth());
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDay, setSelectedDay] = useState<number | null>(null);

    const fetchReminders = useCallback(async () => {
        setLoading(true);
        let userEmail: string | null = null;
        try {
            const reg = JSON.parse(getLocalStorageItem("pact_registration") || "{}");
            userEmail = reg.email || null;
        } catch {}
        if (!userEmail) {
            const { data: { session } } = await supabase.auth.getSession();
            userEmail = session?.user?.email || null;
        }

        const start = new Date(year, month, 1).toISOString();
        const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
        
        let query = supabase.from("reminders").select("id, title, urgency, status, type, due_date")
            .gte("due_date", start).lte("due_date", end).not("status", "eq", "Cancelado");
        if (userEmail) query = query.eq("user_email", userEmail);

        const { data } = await query;
        setReminders(data || []);
        setLoading(false);
    }, [year, month]);

    useEffect(() => { fetchReminders(); }, [fetchReminders]);

    const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); setSelectedDay(null); };
    const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); setSelectedDay(null); };

    // Días del mes
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = Array.from({ length: firstDow + daysInMonth }, (_, i) => i < firstDow ? null : i - firstDow + 1);

    const remindersForDay = (d: number) => reminders.filter(r => {
        const dd = new Date(r.due_date);
        return dd.getDate() === d && dd.getMonth() === month && dd.getFullYear() === year;
    });

    const selectedDayReminders = selectedDay ? remindersForDay(selectedDay) : [];

    // Próximos 7 días (timeline)
    const next7: { date: Date; items: Reminder[] }[] = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const items = reminders.filter(r => {
            const rd = new Date(r.due_date);
            return rd.getDate() === d.getDate() && rd.getMonth() === d.getMonth() && rd.getFullYear() === d.getFullYear();
        });
        next7.push({ date: d, items });
    }

    if (loading) return <div className="flex justify-center py-16 text-slate-400"><Loader2 className="animate-spin" size={28} /></div>;

    return (
        <div className="space-y-6">
            {/* Próximos 7 días */}
            <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Próximos 7 Días</h3>
                <div className="grid grid-cols-7 gap-1.5">
                    {next7.map(({ date, items }) => {
                        const isToday = date.toDateString() === today.toDateString();
                        return (
                            <div key={date.toISOString()} className={`rounded-xl p-2 text-center border-2 transition-all ${isToday ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : items.length > 0 ? "border-amber-300 bg-amber-50 dark:bg-amber-900/10" : "border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900"}`}>
                                <p className={`text-[9px] font-bold uppercase ${isToday ? "text-blue-600" : "text-slate-400"}`}>{DAYS[date.getDay()]}</p>
                                <p className={`text-lg font-black mt-0.5 ${isToday ? "text-blue-700 dark:text-blue-300" : "text-slate-700 dark:text-slate-300"}`}>{date.getDate()}</p>
                                <div className="flex flex-col gap-0.5 mt-1">
                                    {items.slice(0, 2).map(r => (
                                        <button key={r.id} onClick={() => onEdit(r.id)} className={`w-2 h-2 rounded-full mx-auto transition-transform hover:scale-150 ${URGENCY_DOT[r.urgency]}`} title={r.title} />
                                    ))}
                                    {items.length > 2 && <span className="text-[8px] text-slate-400">+{items.length - 2}</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Calendario mensual */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <button onClick={prevMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"><ChevronLeft size={18} /></button>
                    <h3 className="text-base font-black text-slate-800 dark:text-slate-200">{MONTHS[month]} {year}</h3>
                    <button onClick={nextMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"><ChevronRight size={18} /></button>
                </div>

                {/* Encabezados días */}
                <div className="grid grid-cols-7 mb-1">
                    {DAYS.map(d => (
                        <div key={d} className="text-center text-[10px] font-bold text-slate-400 py-1 uppercase">{d}</div>
                    ))}
                </div>

                {/* Celdas */}
                <div className="grid grid-cols-7 gap-1">
                    {cells.map((day, i) => {
                        if (!day) return <div key={i} />;
                        const items = remindersForDay(day);
                        const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                        const isSelected = selectedDay === day;
                        return (
                            <button
                                key={day}
                                onClick={() => setSelectedDay(isSelected ? null : day)}
                                className={`relative rounded-lg py-1 text-center transition-all hover:bg-slate-100 dark:hover:bg-slate-800 ${isToday ? "bg-blue-600 text-white font-black hover:bg-blue-700" : isSelected ? "bg-slate-200 dark:bg-slate-700" : "bg-transparent"}`}
                            >
                                <span className={`text-xs font-bold ${isToday ? "text-white" : "text-slate-700 dark:text-slate-300"}`}>{day}</span>
                                {items.length > 0 && (
                                    <div className="flex justify-center gap-0.5 mt-0.5">
                                        {items.slice(0, 3).map(r => (
                                            <span key={r.id} className={`w-1.5 h-1.5 rounded-full ${URGENCY_DOT[r.urgency]}`} />
                                        ))}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Panel del día seleccionado */}
            {selectedDay && selectedDayReminders.length > 0 && (
                <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">{selectedDay} de {MONTHS[month]}</h4>
                    <div className="space-y-2">
                        {selectedDayReminders.map(r => (
                            <button key={r.id} onClick={() => onEdit(r.id)} className="w-full text-left flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 hover:border-blue-400 transition-colors">
                                <span className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${URGENCY_DOT[r.urgency]}`} />
                                <div>
                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{r.title}</p>
                                    <div className="flex gap-2 mt-0.5">
                                        <span className="text-[10px] text-slate-400">{r.type}</span>
                                        <span className="text-[10px] font-semibold text-slate-500">{r.status}</span>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
            {selectedDay && selectedDayReminders.length === 0 && (
                <p className="text-center text-sm text-slate-400 py-4">Sin pendientes para el {selectedDay} de {MONTHS[month]}</p>
            )}
        </div>
    );
}
