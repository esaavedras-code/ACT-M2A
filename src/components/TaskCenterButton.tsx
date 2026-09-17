"use client";

import { Bell } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getLocalStorageItem } from "@/lib/utils";

export default function TaskCenterButton() {
    const [pendingCount, setPendingCount] = useState(0);

    const checkAndSendEmails = async (userEmail: string, userName: string) => {
        try {
            const now = new Date().toISOString();
            
            // Buscar pendientes activos del usuario cuya fecha de recordatorio o vencimiento ya pasó y no se ha enviado email
            const { data: dueReminders } = await supabase
                .from("reminders")
                .select("*")
                .eq("user_email", userEmail)
                .in("status", ["Pendiente", "En Proceso", "Esperando Respuesta"])
                .or(`email_sent.is.null,email_sent.eq.false`)
                .lte("reminder_date", now);

            if (!dueReminders || dueReminders.length === 0) return;

            for (const rem of dueReminders) {
                const dueFormatted = rem.due_date ? new Date(rem.due_date).toLocaleDateString() : "Sin fecha";
                const emailData = {
                    to: userEmail,
                    subject: `🚨 RECORDATORIO DE PENDIENTE: ${rem.title}`,
                    text: `Hola ${userName},\n\nTienes un pendiente en el Programa ACT:\n\n- Pendiente: ${rem.title}\n- Urgencia: ${rem.urgency === 1 ? 'Alta' : rem.urgency === 2 ? 'Media' : 'Baja'}\n- Fecha de Vencimiento: ${dueFormatted}\n- Estado: ${rem.status}\n\nPor favor ingresa al sistema para darle seguimiento.`,
                    html: `
                        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                            <div style="background-color: #2563eb; padding: 20px; text-align: center;">
                                <h2 style="color: white; margin: 0;">📌 Aviso de Pendiente / Recordatorio</h2>
                            </div>
                            <div style="padding: 30px;">
                                <p>Hola <strong>${userName}</strong>,</p>
                                <p>Este es un recordatorio automático de tu sistema <strong>Programa ACT</strong>.</p>
                                <div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0;">
                                    <p style="margin: 0 0 5px 0;"><strong>Pendiente:</strong> ${rem.title}</p>
                                    <p style="margin: 0 0 5px 0;"><strong>Urgencia:</strong> ${rem.urgency === 1 ? '🔴 Alta' : rem.urgency === 2 ? '🟡 Media' : '🟢 Baja'}</p>
                                    <p style="margin: 0 0 5px 0;"><strong>Fecha de Vencimiento:</strong> ${dueFormatted}</p>
                                    <p style="margin: 0; color: #475569;"><strong>Estado:</strong> ${rem.status}</p>
                                </div>
                                <p>Ingresa al sistema para revisar o actualizar el estatus de este pendiente.</p>
                            </div>
                        </div>
                    `,
                };

                try {
                    const api = typeof window !== "undefined" ? (window as any).electronAPI : null;
                    let response;

                    if (api?.sendEmail) {
                        response = await api.sendEmail(emailData);
                    } else {
                        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-email`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(emailData)
                        });
                        response = await res.json();
                    }

                    if (response && (response.success || response.messageId)) {
                        await supabase.from("reminders").update({ email_sent: true }).eq("id", rem.id);
                    }
                } catch (err) {
                    console.error("Fallo al enviar correo de aviso:", err);
                }
            }
        } catch (e) {
            console.error("Error al procesar emails de recordatorios:", e);
        }
    };

    useEffect(() => {
        const fetchPending = async () => {
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

                if (!userEmail) return;

                // Obtenemos los pendientes que sean para hoy o vencidos
                const today = new Date();
                today.setHours(23, 59, 59, 999);
                
                const { count, error } = await supabase
                    .from("reminders")
                    .select("*", { count: "exact", head: true })
                    .eq("user_email", userEmail)
                    .in("status", ["Pendiente", "En Proceso", "Esperando Respuesta"])
                    .lte("due_date", today.toISOString());

                if (!error && count !== null) {
                    setPendingCount(count);
                }

                // Verificar y enviar correos de avisos
                await checkAndSendEmails(userEmail, userName);
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
