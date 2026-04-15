/**
 * backupService.ts
 * Genera un backup en JSON de todos los datos de los proyectos a los que
 * el usuario actual tiene acceso, y lo descarga al equipo del usuario.
 */

import { supabase } from "@/lib/supabase";

export interface BackupResult {
    success: boolean;
    error?: string;
    filename?: string;
    projectsCount?: number;
}

/** Obtiene los project_id a los que el usuario tiene acceso */
async function getUserProjectIds(userId: string, roleGlobal: string | null): Promise<string[]> {
    // Global Admin ve todos los proyectos
    if (roleGlobal === 'A') {
        const { data, error } = await supabase
            .from("projects")
            .select("id")
            .not("name", "eq", "PACT_SYSTEM_CONFIG");
        if (error) throw new Error("Error obteniendo proyectos: " + error.message);
        return (data || []).map((p: any) => p.id);
    }

    // Contractor (F) o usuarios con membresía específica
    const { data, error } = await supabase
        .from("memberships")
        .select("project_id")
        .eq("user_id", userId)
        .is("revoked_at", null);
    if (error) throw new Error("Error obteniendo membresías: " + error.message);
    return (data || []).map((m: any) => m.project_id).filter(Boolean);
}

/** Consulta una tabla filtrando por project_id */
async function fetchTable(table: string, projectIds: string[], projectField = "project_id"): Promise<any[]> {
    if (projectIds.length === 0) return [];
    const { data, error } = await supabase
        .from(table)
        .select("*")
        .in(projectField, projectIds);
    if (error) {
        console.warn(`Advertencia al obtener tabla ${table}:`, error.message);
        return [];
    }
    return data || [];
}

/** Consulta tablas que usan act_id (Foreign Key de payment_certifications) */
async function fetchByActIds(table: string, parentIds: string[], parentField: string): Promise<any[]> {
    if (parentIds.length === 0) return [];
    const { data, error } = await supabase
        .from(table)
        .select("*")
        .in(parentField, parentIds);
    if (error) {
        console.warn(`Advertencia al obtener tabla ${table}:`, error.message);
        return [];
    }
    return data || [];
}

/**
 * Genera el backup y lo descarga como archivo JSON.
 * Retorna un BackupResult con el resultado de la operación.
 */
export async function generateAndDownloadBackup(): Promise<BackupResult> {
    try {
        // 1. Obtener sesión activa
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("No hay sesión activa.");

        const userId = session.user.id;

        // 2. Obtener rol global
        const { data: userData } = await supabase
            .from("users")
            .select("role_global, name")
            .eq("id", userId)
            .maybeSingle();
        const roleGlobal = userData?.role_global || null;
        const userName = userData?.name || session.user.email || "usuario";

        // 3. Obtener project IDs accesibles
        const projectIds = await getUserProjectIds(userId, roleGlobal);
        if (projectIds.length === 0) {
            return {
                success: false,
                error: "No se encontraron proyectos accesibles para este usuario.",
            };
        }

        // 4. Obtener proyectos
        const { data: projects, error: projError } = await supabase
            .from("projects")
            .select("*")
            .in("id", projectIds);
        if (projError) throw new Error("Error obteniendo proyectos: " + projError.message);

        // 5. Obtener tablas relacionadas por project_id
        const [
            contractors,
            personnel,
            contractItems,
            chos,
            paymentCerts,
            mfgCertificates,
            materialsOnSite,
            laborCompliance,
            forceAccounts,
            dailyLogs,
            meetingMinutes,
            ccmlModifications,
            monthlyPresentations,
            projectDocuments,
            projectAgreementFunds,
            initialCertifications,
            memberships,
        ] = await Promise.all([
            fetchTable("contractors", projectIds),
            fetchTable("act_personnel", projectIds),
            fetchTable("contract_items", projectIds),
            fetchTable("chos", projectIds),
            fetchTable("payment_certifications", projectIds),
            fetchTable("manufacturing_certificates", projectIds),
            fetchTable("materials_on_site", projectIds),
            fetchTable("labor_compliance", projectIds),
            fetchTable("force_accounts", projectIds),
            fetchTable("daily_logs", projectIds),
            fetchTable("meeting_minutes", projectIds),
            fetchTable("project_ccml_modifications", projectIds),
            fetchTable("monthly_presentations", projectIds),
            fetchTable("project_documents", projectIds),
            fetchTable("project_agreement_funds", projectIds),
            fetchTable("initial_certifications", projectIds),
            fetchTable("memberships", projectIds),
        ]);

        // 6. Obtener tablas dependientes de payment_certifications
        const certIds = paymentCerts.map((c: any) => c.id);
        const faIds = forceAccounts.map((fa: any) => fa.id);
        const initCertIds = initialCertifications.map((ic: any) => ic.id);

        const [faLabor, faEquipment, faMaterials, initialCertItems] = await Promise.all([
            fetchByActIds("fa_labor", faIds, "force_account_id"),
            fetchByActIds("fa_equipment", faIds, "force_account_id"),
            fetchByActIds("fa_materials", faIds, "force_account_id"),
            fetchByActIds("initial_certification_items", initCertIds, "initial_certification_id"),
        ]);

        // 7. Construir objeto de backup
        const backupData = {
            meta: {
                version: "1.0",
                generatedAt: new Date().toISOString(),
                generatedBy: userName,
                userId: userId,
                projectsCount: (projects || []).length,
                system: "PACT - Sistema de Control de Proyectos Carreteras",
                generator: "Ing. Enrique Saavedra Sada, PE",
            },
            data: {
                projects: projects || [],
                contractors,
                act_personnel: personnel,
                contract_items: contractItems,
                chos,
                payment_certifications: paymentCerts,
                manufacturing_certificates: mfgCertificates,
                materials_on_site: materialsOnSite,
                labor_compliance: laborCompliance,
                force_accounts: forceAccounts,
                fa_labor: faLabor,
                fa_equipment: faEquipment,
                fa_materials: faMaterials,
                daily_logs: dailyLogs,
                meeting_minutes: meetingMinutes,
                project_ccml_modifications: ccmlModifications,
                monthly_presentations: monthlyPresentations,
                project_documents: projectDocuments,
                project_agreement_funds: projectAgreementFunds,
                initial_certifications: initialCertifications,
                initial_certification_items: initialCertItems,
                memberships,
            },
        };

        // 8. Crear el archivo JSON y disparar descarga
        const jsonString = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });

        const dateStr = new Date()
            .toISOString()
            .replace(/[:.]/g, "-")
            .slice(0, 16);
        const filename = `PACT_backup_${dateStr}.json`;

        // Intentar usar la File System Access API para elegir carpeta
        let downloadMethod = "legacy";
        
        if ("showSaveFilePicker" in window) {
            try {
                const fileHandle = await (window as any).showSaveFilePicker({
                    suggestedName: filename,
                    types: [
                        {
                            description: "Archivo de backup PACT (JSON)",
                            accept: { "application/json": [".json"] },
                        },
                    ],
                });
                const writable = await fileHandle.createWritable();
                await writable.write(blob);
                await writable.close();
                downloadMethod = "picker";
            } catch (pickerError: any) {
                // Si el usuario cancela el picker, el backup no se realiza
                if (pickerError.name === "AbortError") {
                    return {
                        success: false,
                        error: "CANCELLED",
                    };
                }
                // Si showSaveFilePicker falla por otro motivo, caer a descarga legacy
                console.warn("File System API falló, usando descarga clásica:", pickerError);
                downloadMethod = "legacy";
            }
        }

        if (downloadMethod === "legacy") {
            // Descarga clásica (navegadores sin File System API)
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 10000);
        }

        return {
            success: true,
            filename,
            projectsCount: (projects || []).length,
        };
    } catch (err: any) {
        return {
            success: false,
            error: err.message || "Error desconocido durante el backup.",
        };
    }
}
