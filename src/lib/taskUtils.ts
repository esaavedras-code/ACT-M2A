import { supabase } from "@/lib/supabase";

export type RecurrenceType = "none" | "daily" | "weekly" | "monthly" | "yearly" | "custom";
export type RecurrenceUnit = "days" | "weeks" | "months" | "years";

export type CustomRecurrenceMode =
    | "interval"
    | "month_day"
    | "month_weekday"
    | "month_relative_weekday"
    | "year_weekday";

export interface RecurrenceConfig {
    mode?: CustomRecurrenceMode;
    weekdays?: number[];       // 0 (Dom) .. 6 (Sáb)
    dayOfMonth?: number;       // 1..31 o -1 (último día del mes)
    ordinal?: number;          // 1, 2, 3, 4, o -1 (último)
    weekday?: number;          // 0 (Dom) .. 6 (Sáb)
    anchorWeekday?: number;    // 0 (Dom) .. 6 (Sáb)
    month?: number;            // 0 (Ene) .. 11 (Dic)
}

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

export const CUSTOM_RECURRENCE_MODES: { label: string; value: CustomRecurrenceMode; hint: string }[] = [
    { label: "Cada intervalo fijo", value: "interval", hint: "Ej. cada 3 días, o cada semana los Lun, Mié y Vie" },
    { label: "Día específico del mes", value: "month_day", hint: "Ej. el día 15 de cada mes, o el último día del mes" },
    { label: "Día ordinal del mes", value: "month_weekday", hint: "Ej. el primer martes o el último viernes de cada mes" },
    { label: "Día de la semana relativo a otro", value: "month_relative_weekday", hint: "Ej. el lunes de la semana del tercer jueves de cada mes" },
    { label: "Día ordinal de un mes (Anual)", value: "year_weekday", hint: "Ej. el último lunes de mayo o cuarto jueves de noviembre" },
];

export const WEEKDAY_OPTIONS: { value: number; short: string; label: string }[] = [
    { value: 0, short: "Dom", label: "Domingo" },
    { value: 1, short: "Lun", label: "Lunes" },
    { value: 2, short: "Mar", label: "Martes" },
    { value: 3, short: "Mié", label: "Miércoles" },
    { value: 4, short: "Jue", label: "Jueves" },
    { value: 5, short: "Vie", label: "Viernes" },
    { value: 6, short: "Sáb", label: "Sábado" },
];

export const ORDINAL_OPTIONS: { value: number; label: string; shortLabel: string }[] = [
    { value: 1, label: "Primer", shortLabel: "1.º" },
    { value: 2, label: "Segundo", shortLabel: "2.º" },
    { value: 3, label: "Tercer", shortLabel: "3.º" },
    { value: 4, label: "Cuarto", shortLabel: "4.º" },
    { value: -1, label: "Último", shortLabel: "Último" },
];

export const MONTH_OPTIONS: { value: number; label: string }[] = [
    { value: 0, label: "Enero" },
    { value: 1, label: "Febrero" },
    { value: 2, label: "Marzo" },
    { value: 3, label: "Abril" },
    { value: 4, label: "Mayo" },
    { value: 5, label: "Junio" },
    { value: 6, label: "Julio" },
    { value: 7, label: "Agosto" },
    { value: 8, label: "Septiembre" },
    { value: 9, label: "Octubre" },
    { value: 10, label: "Noviembre" },
    { value: 11, label: "Diciembre" },
];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
}

function withPreservedTime(year: number, month: number, day: number, template: Date): Date {
    return new Date(
        year,
        month,
        day,
        template.getHours(),
        template.getMinutes(),
        template.getSeconds(),
        template.getMilliseconds()
    );
}

function getCalendarDayKey(d: Date): number {
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function getMonthDayCandidate(year: number, month: number, dayOfMonth: number, template: Date): Date {
    const maxDays = getDaysInMonth(year, month);
    const day = dayOfMonth === -1 ? maxDays : Math.min(Math.max(1, dayOfMonth), maxDays);
    return withPreservedTime(year, month, day, template);
}

function getNthWeekdayOfMonth(year: number, month: number, ordinal: number, weekday: number, template: Date): Date {
    const safeWeekday = ((weekday % 7) + 7) % 7;
    if (ordinal === -1) {
        const lastDate = getDaysInMonth(year, month);
        const lastDow = new Date(year, month, lastDate).getDay();
        const back = (lastDow - safeWeekday + 7) % 7;
        return withPreservedTime(year, month, lastDate - back, template);
    }
    const firstDow = new Date(year, month, 1).getDay();
    const offset = (safeWeekday - firstDow + 7) % 7;
    const clampedOrd = Math.min(4, Math.max(1, ordinal));
    const day = 1 + offset + (clampedOrd - 1) * 7;
    return withPreservedTime(year, month, day, template);
}

function getRelativeWeekdayCandidate(
    year: number,
    month: number,
    ordinal: number,
    anchorWeekday: number,
    targetWeekday: number,
    template: Date
): Date {
    const anchor = getNthWeekdayOfMonth(year, month, ordinal, anchorWeekday, template);
    const safeAnchor = ((anchorWeekday % 7) + 7) % 7;
    const safeTarget = ((targetWeekday % 7) + 7) % 7;
    // Semana calendario Dom (0) a Sáb (6): desplazamiento exacto en días de 24h
    const diffDays = safeTarget - safeAnchor;
    return new Date(anchor.getTime() + diffDays * MS_PER_DAY);
}

function advanceMonthlyRule(
    base: Date,
    interval: number,
    computeForYearMonth: (year: number, month: number) => Date
): Date {
    const baseKey = getCalendarDayKey(base);
    const baseYear = base.getFullYear();
    const baseMonth = base.getMonth();

    // Buscamos entre k=0,1,2 por si una regla relativa (ej. lunes de la semana del 1er jueves)
    // cayó en los últimos días del mes anterior.
    for (let k = 0; k <= 2; k++) {
        const probeDate = new Date(baseYear, baseMonth + k, 1);
        const cand = computeForYearMonth(probeDate.getFullYear(), probeDate.getMonth());
        const candKey = getCalendarDayKey(cand);

        if (candKey === baseKey) {
            const targetMonth = new Date(probeDate.getFullYear(), probeDate.getMonth() + interval, 1);
            return computeForYearMonth(targetMonth.getFullYear(), targetMonth.getMonth());
        }
        if (candKey > baseKey) {
            if (interval === 1) {
                return cand;
            }
            // Si k > 0 y aún no coincide, igual tomamos la primera ocurrencia futura encontrada
            // o avanzamos interval meses desde el mes actual si k === 0
            if (k === 0) {
                return cand;
            }
            const targetMonth = new Date(baseYear, baseMonth + interval, 1);
            return computeForYearMonth(targetMonth.getFullYear(), targetMonth.getMonth());
        }
    }

    const fallbackMonth = new Date(baseYear, baseMonth + interval, 1);
    return computeForYearMonth(fallbackMonth.getFullYear(), fallbackMonth.getMonth());
}

export function calculateNextDueDate(
    currentDueDate: string | Date | null | undefined,
    recurrenceType: string | null | undefined,
    recurrenceInterval: number | null | undefined,
    recurrenceUnit: string | null | undefined,
    recurrenceEndDate?: string | null,
    recurrenceConfig?: RecurrenceConfig | null
): Date | null {
    if (!recurrenceType || recurrenceType === "none") return null;

    const base = currentDueDate
        ? (currentDueDate instanceof Date ? new Date(currentDueDate.getTime()) : new Date(currentDueDate))
        : new Date();
    const interval = Math.max(1, Number(recurrenceInterval) || 1);
    let next = new Date(base.getTime());

    if (recurrenceType === "daily") {
        next.setTime(next.getTime() + MS_PER_DAY);
    } else if (recurrenceType === "weekly") {
        next.setTime(next.getTime() + 7 * MS_PER_DAY);
    } else if (recurrenceType === "monthly") {
        next.setMonth(next.getMonth() + 1);
    } else if (recurrenceType === "yearly") {
        next.setFullYear(next.getFullYear() + 1);
    } else if (recurrenceType === "custom") {
        const cfg = recurrenceConfig || {};
        const mode: CustomRecurrenceMode = cfg.mode || "interval";

        if (mode === "month_day") {
            const dayOfMonth = cfg.dayOfMonth ?? base.getDate();
            next = advanceMonthlyRule(base, interval, (y, m) => getMonthDayCandidate(y, m, dayOfMonth, base));
        } else if (mode === "month_weekday") {
            const ordinal = cfg.ordinal ?? 1;
            const weekday = cfg.weekday ?? base.getDay();
            next = advanceMonthlyRule(base, interval, (y, m) => getNthWeekdayOfMonth(y, m, ordinal, weekday, base));
        } else if (mode === "month_relative_weekday") {
            const ordinal = cfg.ordinal ?? 1;
            const anchorWeekday = cfg.anchorWeekday ?? 4; // Jueves por defecto
            const targetWeekday = cfg.weekday ?? 1;       // Lunes por defecto
            next = advanceMonthlyRule(base, interval, (y, m) =>
                getRelativeWeekdayCandidate(y, m, ordinal, anchorWeekday, targetWeekday, base)
            );
        } else if (mode === "year_weekday") {
            const ordinal = cfg.ordinal ?? 1;
            const weekday = cfg.weekday ?? base.getDay();
            const targetMonth = cfg.month ?? base.getMonth();
            const baseKey = getCalendarDayKey(base);
            const candThisYear = getNthWeekdayOfMonth(base.getFullYear(), targetMonth, ordinal, weekday, base);
            const candKey = getCalendarDayKey(candThisYear);

            if (candKey > baseKey) {
                next = candThisYear;
            } else {
                next = getNthWeekdayOfMonth(base.getFullYear() + interval, targetMonth, ordinal, weekday, base);
            }
        } else {
            const unit = recurrenceUnit || "days";
            if (unit === "days") {
                next.setTime(next.getTime() + interval * MS_PER_DAY);
            } else if (unit === "weeks") {
                const weekdays = Array.isArray(cfg.weekdays) && cfg.weekdays.length > 0
                    ? [...new Set(cfg.weekdays.map(d => ((d % 7) + 7) % 7))].sort((a, b) => a - b)
                    : null;

                if (weekdays) {
                    const currentDow = base.getDay();
                    const nextSameWeek = weekdays.find(d => d > currentDow);
                    if (nextSameWeek !== undefined) {
                        next.setTime(base.getTime() + (nextSameWeek - currentDow) * MS_PER_DAY);
                    } else {
                        const daysToAdd = (7 - currentDow) + (interval - 1) * 7 + weekdays[0];
                        next.setTime(base.getTime() + daysToAdd * MS_PER_DAY);
                    }
                } else {
                    next.setTime(next.getTime() + interval * 7 * MS_PER_DAY);
                }
            } else if (unit === "months") {
                next.setMonth(next.getMonth() + interval);
            } else if (unit === "years") {
                next.setFullYear(next.getFullYear() + interval);
            }
        }
    } else {
        return null;
    }

    if (recurrenceEndDate) {
        const nextDateStr = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
        const endDateStr = String(recurrenceEndDate).split("T")[0];
        if (nextDateStr > endDateStr) {
            return null;
        }
    }

    return next;
}

export function previewNextDueDates(
    startDate: string | Date | null | undefined,
    recurrenceType: string | null | undefined,
    recurrenceInterval: number | null | undefined,
    recurrenceUnit: string | null | undefined,
    recurrenceEndDate?: string | null,
    recurrenceConfig?: RecurrenceConfig | null,
    count = 3
): Date[] {
    const results: Date[] = [];
    let cursor = startDate;
    for (let i = 0; i < count; i++) {
        const next = calculateNextDueDate(
            cursor,
            recurrenceType,
            recurrenceInterval,
            recurrenceUnit,
            recurrenceEndDate,
            recurrenceConfig
        );
        if (!next) break;
        results.push(next);
        cursor = next;
    }
    return results;
}

function getWeekdayName(dow: number | undefined, short = false): string {
    const found = WEEKDAY_OPTIONS.find(w => w.value === dow);
    if (!found) return short ? "Lun" : "Lunes";
    return short ? found.short : found.label.toLowerCase();
}

function getOrdinalName(ord: number | undefined, short = false): string {
    const found = ORDINAL_OPTIONS.find(o => o.value === ord);
    if (!found) return short ? "1.º" : "primer";
    return short ? found.shortLabel.toLowerCase() : found.label.toLowerCase();
}

export function formatRecurrenceLabel(r: {
    recurrence_type?: string | null;
    recurrence_interval?: number | null;
    recurrence_unit?: string | null;
    recurrence_config?: RecurrenceConfig | null;
}): string | null {
    const type = r?.recurrence_type;
    if (!type || type === "none") return null;
    if (type === "daily") return "Diario";
    if (type === "weekly") return "Semanal";
    if (type === "monthly") return "Mensual";
    if (type === "yearly") return "Anual";
    if (type === "custom") {
        const interval = Math.max(1, Number(r.recurrence_interval) || 1);
        const cfg = r.recurrence_config || {};
        const mode: CustomRecurrenceMode = cfg.mode || "interval";

        if (mode === "month_day") {
            const dayText = cfg.dayOfMonth === -1 ? "Último día" : `Día ${cfg.dayOfMonth ?? 1}`;
            return interval === 1 ? `${dayText} de cada mes` : `${dayText} cada ${interval} meses`;
        }
        if (mode === "month_weekday") {
            const ordText = getOrdinalName(cfg.ordinal, false);
            const dayText = getWeekdayName(cfg.weekday, false);
            const capOrd = ordText.charAt(0).toUpperCase() + ordText.slice(1);
            return interval === 1
                ? `${capOrd} ${dayText} de cada mes`
                : `${capOrd} ${dayText} cada ${interval} meses`;
        }
        if (mode === "month_relative_weekday") {
            const targetText = getWeekdayName(cfg.weekday, false);
            const capTarget = targetText.charAt(0).toUpperCase() + targetText.slice(1);
            const ordText = getOrdinalName(cfg.ordinal, true);
            const anchorText = getWeekdayName(cfg.anchorWeekday, false);
            const freqText = interval === 1 ? "cada mes" : `cada ${interval} meses`;
            return `${capTarget} (sem. ${ordText} ${anchorText}, ${freqText})`;
        }
        if (mode === "year_weekday") {
            const ordText = getOrdinalName(cfg.ordinal, false);
            const capOrd = ordText.charAt(0).toUpperCase() + ordText.slice(1);
            const dayText = getWeekdayName(cfg.weekday, false);
            const monthName = (MONTH_OPTIONS.find(m => m.value === (cfg.month ?? 0))?.label || "Enero").toLowerCase();
            return interval === 1
                ? `${capOrd} ${dayText} de ${monthName} (anual)`
                : `${capOrd} ${dayText} de ${monthName} cada ${interval} años`;
        }

        const unit = r.recurrence_unit || "days";
        if (unit === "weeks" && Array.isArray(cfg.weekdays) && cfg.weekdays.length > 0) {
            const daysList = [...new Set(cfg.weekdays)]
                .sort((a, b) => a - b)
                .map(d => getWeekdayName(d, true))
                .join(", ");
            return interval === 1
                ? `Cada semana (${daysList})`
                : `Cada ${interval} semanas (${daysList})`;
        }

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
            rem.recurrence_end_date,
            rem.recurrence_config || null
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
            recurrence_config: rem.recurrence_config || null,
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
