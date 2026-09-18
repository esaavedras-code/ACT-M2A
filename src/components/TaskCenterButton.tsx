"use client";

import { Bell } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getLocalStorageItem } from "@/lib/utils";
import { getUserReminders } from "@/lib/taskUtils";

export default function TaskCenterButton() {
    const [pendingCount, setPendingCount] = useState(0);

    const checkAndSendEmails = async (userEmail: string, userName: string) => {
        try {
            const now = new Date().toISOString();
            
            // Buscar pendientes activos cuya fecha de recordatorio o vencimiento ya pasó y no se ha enviado email
            const { data: dueReminders } = await supabase
                .from("reminders")
                .select("*")
                .in("status", ["Pendiente", "En Proceso", "Esperando Respuesta"])
                .or(`email_sent.is.null,email_sent.eq.false`)
                .lte("reminder_date", now);

            if (!dueReminders || dueReminders.length === 0) return;

            for (const rem of dueReminders) {
                // Obtener responsables asignados a este pendiente
                const { data: assigneesData } = await supabase
                    .from("reminder_assignees")
                    .select("*")
                    .eq("reminder_id", rem.id);

                const recipientEmails: string[] = [];
                if (rem.user_email) recipientEmails.push(rem.user_email);

                if (assigneesData && assigneesData.length > 0) {
                    assigneesData.forEach((a: any) => {
                        if (a.assignee_email) {
                            recipientEmails.push(a.assignee_email);
                        } else if (a.assignee_name) {
                            const match = a.assignee_name.match(/<([^>]+)>/);
                            if (match && match[1]) {
                                recipientEmails.push(match[1]);
                            }
                        }
                    });
                }

                // También buscar correos respaldados en etiquetas
                if (rem.tags && Array.isArray(rem.tags)) {
                    rem.tags.forEach((t: string) => {
                        if (t.startsWith("Resp: ")) {
                            const match = t.match(/<([^>]+)>/);
                            if (match && match[1]) {
                                recipientEmails.push(match[1]);
                            }
                        }
                    });
                }

                // Filtrar duplicados y correos vacíos
                const uniqueRecipients = Array.from(new Set(recipientEmails.filter(Boolean)));

                // Si no hay destinatarios o si el usuario actual no es ni el creador ni un asignado, ignorar por este cliente
                if (uniqueRecipients.length === 0) continue;
                if (!uniqueRecipients.includes(userEmail)) continue;

                const dueFormatted = rem.due_date ? new Date(rem.due_date).toLocaleDateString() : "Sin fecha";
                const appOrigin = typeof window !== "undefined" && window.location.origin ? window.location.origin : "https://act-m2-a.vercel.app";
                const directTaskUrl = `${appOrigin}/?openTask=${rem.id}`;

                for (const recipient of uniqueRecipients) {
                    const emailData = {
                        to: recipient,
                        subject: `🚨 RECORDATORIO DE PENDIENTE: ${rem.title}`,
                        text: `Hola,\n\nTienes un pendiente en el Programa ACT:\n\n- Pendiente: ${rem.title}\n- Urgencia: ${rem.urgency === 1 ? 'Alta' : rem.urgency === 2 ? 'Media' : 'Baja'}\n- Fecha de Vencimiento: ${dueFormatted}\n- Estado: ${rem.status}\n\nPara revisar o responder este pendiente en PACT, ingresa al siguiente enlace:\n${directTaskUrl}`,
                        html: `
                            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                                <div style="background-color: #2563eb; padding: 20px; text-align: center;">
                                    <h2 style="color: white; margin: 0;">📌 Aviso de Pendiente / Recordatorio</h2>
                                </div>
                                <div style="padding: 30px;">
                                    <p>Hola,</p>
                                    <p>Este es un recordatorio automático de tu sistema <strong>Programa ACT</strong>.</p>
                                    <div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0;">
                                        <p style="margin: 0 0 5px 0;"><strong>Pendiente:</strong> ${rem.title}</p>
                                        <p style="margin: 0 0 5px 0;"><strong>Urgencia:</strong> ${rem.urgency === 1 ? '🔴 Alta' : rem.urgency === 2 ? '🟡 Media' : '🟢 Baja'}</p>
                                        <p style="margin: 0 0 5px 0;"><strong>Fecha de Vencimiento:</strong> ${dueFormatted}</p>
                                        <p style="margin: 0; color: #475569;"><strong>Estado:</strong> ${rem.status}</p>
                                    </div>
                                    <div style="text-align: center; margin: 25px 0;">
                                        <a href="${directTaskUrl}" target="_blank" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">
                                            🔗 Ver Pendiente en PACT
                                        </a>
                                    </div>
                                    <p style="font-size: 12px; color: #64748b; text-align: center;">Si el botón no funciona, copia y pega esta dirección en tu navegador:<br><a href="${directTaskUrl}">${directTaskUrl}</a></p>
                                </div>
                            </div>
                        `,
                    };

                    try {
                        const api = typeof window !== "undefined" ? (window as any).electronAPI : null;
                        if (api?.sendEmail) {
                            await api.sendEmail(emailData);
                        } else {
                            await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-email`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(emailData)
                            });
                        }
                    } catch (err) {
                        console.error(`Fallo al enviar correo a ${recipient}:`, err);
                    }
                }

                // Marcar como enviado
                await supabase.from("reminders").update({ email_sent: true }).eq("id", rem.id);
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

                // Obtenemos los pendientes que sean para hoy o vencidos (creados o asignados)
                const today = new Date();
                today.setHours(23, 59, 59, 999);
                const activeStatuses = ["Pendiente", "En Proceso", "Esperando Respuesta"];

                const allUserTasks = await getUserReminders(userEmail, userName);
                const count = allUserTasks.filter((r: any) => {
                    if (!activeStatuses.includes(r.status)) return false;
                    if (!r.due_date) return true;
                    return new Date(r.due_date) <= today;
                }).length;

                setPendingCount(count);

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
