import { supabase } from "@/lib/supabase";

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
