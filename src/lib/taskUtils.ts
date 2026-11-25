import { supabase } from "@/lib/supabase";

export type RecurrenceType = "none" | "daily" | "weekly" | "monthly" | "yearly" | "custom";
export type RecurrenceUnit = "days" | "weeks" | "months" | "years";

export const RECURRENCE_OPTIONS: { label: string; value: RecurrenceType }[] = [
    { label: "No repetir", value: "none" },
    { label: "Diario", value: "daily" },
    { label: "Semanal", value: "weekly" },
    { label: "Mensual", value: "monthly" },
    { label: "Anual", value: "yearly" },
    { label: "Custom (Personalizado)", value: "custom" },
];

export const RECURRENCE_UNITS: { label: string; value: RecurrenceUnit }[] = [
    { label: "Día(s)", value: "days" },
    { label: "Semana(s)", value: "weeks" },
    { label: "Mes(es)", value: "months" },
    { label: "Año(s)", value: "years" },
];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function calculateNextDueDate(
    currentDueDate: string | null | undefined,
    recurrenceType: string | null | undefined,
    recurrenceInterval: number | null | undefined,
    recurrenceUnit: string | null | undefined,
    recurrenceEndDate?: string | null
): Date | null {
    if (!recurrenceType || recurrenceType === "none") return null;

    const base = currentDueDate ? new Date(currentDueDate) : new Date();
    const interval = Math.max(1, Number(recurrenceInterval) || 1);
    const next = new Date(base.getTime());

    if (recurrenceType === "daily") {
        next.setTime(next.getTime() + MS_PER_DAY);
    } else if (recurrenceType === "weekly") {
        next.setTime(next.getTime() + 7 * MS_PER_DAY);
    } else if (recurrenceType === "monthly") {
        next.setMonth(next.getMonth() + 1);
    } else if (recurrenceType === "yearly") {
        next.setFullYear(next.getFullYear() + 1);
    } else if (recurrenceType === "custom") {
        const unit = recurrenceUnit || "days";
        if (unit === "days") {
            next.setTime(next.getTime() + interval * MS_PER_DAY);
        } else if (unit === "weeks") {
            next.setTime(next.getTime() + interval * 7 * MS_PER_DAY);
        } else if (unit === "months") {
            next.setMonth(next.getMonth() + interval);
        } else if (unit === "years") {
            next.setFullYear(next.getFullYear() + interval);
        }
    } else {
        return null;
    }

    if (recurrenceEndDate) {
        const nextDateStr = next.toISOString().split("T")[0];
        const endDateStr = String(recurrenceEndDate).split("T")[0];
        if (nextDateStr > endDateStr) {
            return null;
        }
    }

    return next;
}

export function formatRecurrenceLabel(r: {
    recurrence_type?: string | null;
    recurrence_interval?: number | null;
    recurrence_unit?: string | null;
}): string | null {
    const type = r?.recurrence_type;
    if (!type || type === "none") return null;
    if (type === "daily") return "Diario";
    if (type === "weekly") return "Semanal";
    if (type === "monthly") return "Mensual";
    if (type === "yearly") return "Anual";
    if (type === "custom") {
        const interval = Math.max(1, Number(r.recurrence_interval) || 1);
        const unit = r.recurrence_unit || "days";
        const unitLabel =
            unit === "days" ? (interval === 1 ? "día" : "días")
            : unit === "weeks" ? (interval === 1 ? "semana" : "semanas")
            : unit === "months" ? (interval === 1 ? "mes" : "meses")
            : (interval === 1 ? "año" : "años");
        return `Cada ${interval} ${unitLabel}`;
    }
    return null;
}

/**
 * Crea la siguiente ocurrencia de un pendiente repetitivo si fue marcado como "Completado"
 * y aún no se ha generado la siguiente repetición.
 */
export async function createNextRecurrenceIfNeeded(reminderId: string): Promise<{ created: boolean; nextReminder?: any }> {
    try {
        const { data: rem, error } = await supabase
            .from("reminders")
            .select("*")
            .eq("id", reminderId)
            .single();

        if (error || !rem) return { created: false };
        if (rem.status !== "Completado") return { created: false };
        if (!rem.recurrence_type || rem.recurrence_type === "none") return { created: false };
        if (rem.recurrence_next_created) return { created: false };

        const nextDue = calculateNextDueDate(
            rem.due_date,
            rem.recurrence_type,
            rem.recurrence_interval,
            rem.recurrence_unit,
            rem.recurrence_end_date
        );

        if (!nextDue) {
            await supabase
                .from("reminders")
                .update({ recurrence_next_created: true })
                .eq("id", reminderId);
            return { created: false };
        }

        let nextReminderDate: string | null = null;
        if (rem.due_date && rem.reminder_date) {
            const offsetMs = new Date(rem.due_date).getTime() - new Date(rem.reminder_date).getTime();
            if (offsetMs >= 0) {
                nextReminderDate = new Date(nextDue.getTime() - offsetMs).toISOString();
            }
        }

        const newPayload: any = {
            title: rem.title,
            description: rem.description || "",
            project_id: rem.project_id || null,
            project_ids: rem.project_ids || (rem.project_id ? [rem.project_id] : []),
            subproject: rem.subproject || null,
            urgency: rem.urgency ?? 2,
            type: rem.type || "Seguimiento",
            status: "Pendiente",
            due_date: nextDue.toISOString(),
            reminder_date: nextReminderDate,
            tags: rem.tags || [],
            created_by: rem.created_by || "Sistema",
            user_email: rem.user_email || null,
            email_sent: false,
            recurrence_type: rem.recurrence_type,
            recurrence_interval: rem.recurrence_interval ?? 1,
            recurrence_unit: rem.recurrence_unit || "days",
            recurrence_end_date: rem.recurrence_end_date || null,
            recurrence_next_created: false,
            updated_at: new Date().toISOString(),
        };

        const { data: createdRem, error: insertErr } = await supabase
            .from("reminders")
            .insert(newPayload)
            .select()
            .single();

        if (insertErr || !createdRem) {
            console.error("Error creando siguiente ocurrencia del pendiente:", insertErr);
            return { created: false };
        }

        const [assigneesRes, linksRes] = await Promise.all([
            supabase.from("reminder_assignees").select("*").eq("reminder_id", reminderId),
            supabase.from("reminder_links").select("*").eq("reminder_id", reminderId),
        ]);

        const copyOps: PromiseLike<any>[] = [];
        if (assigneesRes.data && assigneesRes.data.length > 0) {
            copyOps.push(
                supabase.from("reminder_assignees").insert(
                    assigneesRes.data.map((a: any) => ({
                        reminder_id: createdRem.id,
                        assignee_name: a.assignee_name,
                        assignee_email: a.assignee_email || null,
                    }))
                )
            );
        }
        if (linksRes.data && linksRes.data.length > 0) {
            copyOps.push(
                supabase.from("reminder_links").insert(
                    linksRes.data.map((l: any) => ({
                        reminder_id: createdRem.id,
                        label: l.label,
                        url: l.url,
                    }))
                )
            );
        }
        if (copyOps.length > 0) await Promise.all(copyOps);

        await supabase
            .from("reminders")
            .update({ recurrence_next_created: true })
            .eq("id", reminderId);

        return { created: true, nextReminder: createdRem };
    } catch (err) {
        console.error("Error en createNextRecurrenceIfNeeded:", err);
        return { created: false };
    }
}

export async function getUserReminders(userEmail: string, userName?: string): Promise<any[]> {
    if (!userEmail) return [];

    try {
        const cleanEmail = userEmail.trim().toLowerCase();
        const cleanName = userName ? userName.trim().toLowerCase() : "";

        // 1. Obtener IDs de pendientes asignados en reminder_assignees
        const { data: assData } = await supabase
            .from("reminder_assignees")
            .select("reminder_id, assignee_name, assignee_email");

        const assignedIds = new Set<string>();
        if (assData) {
            assData.forEach((a: any) => {
                const aName = (a.assignee_name || "").toLowerCase();
                const aEmail = (a.assignee_email || "").toLowerCase();
                if (
                    (aEmail && aEmail === cleanEmail) ||
                    aName.includes(cleanEmail) ||
                    (cleanName && cleanName.length > 2 && aName.includes(cleanName))
                ) {
                    if (a.reminder_id) assignedIds.add(a.reminder_id);
                }
            });
        }

        // 2. Traer todos los pendientes de la base de datos
        const { data: allReminders, error } = await supabase
            .from("reminders")
            .select("*")
            .order("updated_at", { ascending: false });

        if (error || !allReminders) return [];

        // 3. Filtrar aquellos donde el usuario sea CREADOR o RESPONSABLE ASIGNADO
        const userReminders = allReminders.filter((r: any) => {
            // ¿Es el creador del pendiente?
            if (r.user_email && r.user_email.toLowerCase() === cleanEmail) return true;
            if (cleanName && cleanName.length > 2 && r.created_by && r.created_by.toLowerCase() === cleanName) return true;

            // ¿Está en las asignaciones de reminder_assignees?
            if (assignedIds.has(r.id)) return true;

            // ¿Está en las etiquetas Resp: del pendiente?
            if (r.tags && Array.isArray(r.tags)) {
                const isRespInTag = r.tags.some((t: string) => {
                    if (!t.startsWith("Resp: ")) return false;
                    const tagLower = t.toLowerCase();
                    return tagLower.includes(cleanEmail) || (cleanName && cleanName.length > 2 && tagLower.includes(cleanName));
                });
                if (isRespInTag) return true;
            }

            return false;
        });

        return userReminders;
    } catch (err) {
        console.error("Error al obtener los pendientes del usuario:", err);
        return [];
    }
}
