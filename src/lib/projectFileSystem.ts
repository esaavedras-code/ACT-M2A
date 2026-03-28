import { supabase } from "./supabase";
import { getLocalStorageItem, setLocalStorageItem } from "./utils";

/**
 * Recolecta toda la información de un proyecto desde Supabase 
 * y la guarda en un archivo JSON local a través de la API de Electron.
 */
export const exportProjectToFile = async (projectId: string, folderPath: string, projectName: string) => {
    try {
        console.log(`Iniciando respaldo local para proyecto: ${projectName} (${projectId})`);

        // 1. Recolectar toda la info de todas las tablas relacionadas
        const [
            { data: project },
            { data: items },
            { data: certs },
            { data: chos },
            { data: contractors },
            { data: personnel },
            { data: labor },
            { data: mfgCerts },
            { data: materials }
        ] = await Promise.all([
            supabase.from('projects').select('*').eq('id', projectId).single(),
            supabase.from('contract_items').select('*').eq('project_id', projectId),
            supabase.from('payment_certifications').select('*').eq('project_id', projectId),
            supabase.from('chos').select('*').eq('project_id', projectId),
            supabase.from('contractors').select('*').eq('project_id', projectId),
            supabase.from('act_personnel').select('*').eq('project_id', projectId),
            supabase.from('labor_compliance').select('*').eq('project_id', projectId),
            supabase.from('manufacturing_certificates').select('*').eq('project_id', projectId),
            supabase.from('materials_on_site').select('*').eq('project_id', projectId)
        ]);

        const fullData = {
            metadata: {
                appName: "Sistema Programa ACT",
                version: "1.0.0",
                exportedAt: new Date().toISOString()
            },
            project,
            items: items || [],
            certifications: certs || [],
            changeOrders: chos || [],
            contractors: contractors || [],
            personnel: personnel || [],
            laborCompliance: labor || [],
            manufacturingCertificates: mfgCerts || [],
            materialsOnSite: materials || []
        };

        // 2. Limpiar caracteres inválidos para el nombre del archivo
        const safeProjectName = (projectName || "PROYECTO_SIN_NOMBRE").replace(/[/\\?%*:|"<>]/g, '-');
        const fileName = `${safeProjectName}_DATOS.json`;
        const fullPath = `${folderPath}\\${fileName}`.replace(/\//g, '\\').replace(/\\\\/g, '\\');

        console.log(`Guardando archivo en: ${fullPath}`);

        // 3. Llamar a la API de Electron
        // @ts-ignore
        if (window.electronAPI) {
            // @ts-ignore
            const result = await window.electronAPI.saveProjectFile({
                filePath: fullPath,
                content: fullData
            });
            console.log("Resultado de API Electron:", result);
            return result;
        } else {
            console.warn("Electron API no disponible. Saltando respaldo local.");
            return { success: false, error: "API no disponible" };
        }
    } catch (error: any) {
        console.error("Error en exportProjectToFile:", error);
        return { success: false, error: error.message };
    }
};

/**
 * Recibe los datos de un proyecto y los guarda en Supabase.
 */
export const importProjectData = async (fullData: any) => {
    try {
        const { project, items, certifications, changeOrders, contractors, personnel, laborCompliance, manufacturingCertificates, materialsOnSite } = fullData;

        if (!project || !project.id) {
            throw new Error("El archivo no contiene datos válidos de un proyecto.");
        }

        console.log(`Iniciando importación para proyecto: ${project.name} (${project.id})`);

        // 1. Upsert del Proyecto
        const { error: pErr } = await supabase.from('projects').upsert(project);
        if (pErr) throw new Error("Error al importar proyecto: " + pErr.message);

        // 2. Limpiar e Insertar datos relacionados (para evitar duplicidad o conflictos, 
        // podrías borrar lo actual de ese ID primero o usar upsert si tienen IDs únicos coherentes)
        // Usaremos upsert para todo ya que los datos exportados traen sus IDs originales de Supabase.

        const tasks = [
            items.length > 0 ? supabase.from('contract_items').upsert(items) : Promise.resolve({ error: null }),
            certifications.length > 0 ? supabase.from('payment_certifications').upsert(certifications) : Promise.resolve({ error: null }),
            changeOrders.length > 0 ? supabase.from('chos').upsert(changeOrders) : Promise.resolve({ error: null }),
            contractors.length > 0 ? supabase.from('contractors').upsert(contractors) : Promise.resolve({ error: null }),
            personnel.length > 0 ? supabase.from('act_personnel').upsert(personnel) : Promise.resolve({ error: null }),
            laborCompliance.length > 0 ? supabase.from('labor_compliance').upsert(laborCompliance) : Promise.resolve({ error: null }),
            manufacturingCertificates.length > 0 ? supabase.from('manufacturing_certificates').upsert(manufacturingCertificates) : Promise.resolve({ error: null }),
            materialsOnSite.length > 0 ? supabase.from('materials_on_site').upsert(materialsOnSite) : Promise.resolve({ error: null }),
        ];

        const results = await Promise.all(tasks);
        const firstError = results.find(r => r.error);
        if (firstError) throw new Error("Error en datos relacionados: " + firstError.error?.message);

        // 3. Asegurar que el ID esté en allowedProjectIds de este usuario localmente
        const registrationStr = getLocalStorageItem("pact_registration");
        if (registrationStr) {
            const reg = JSON.parse(registrationStr);
            if (!reg.allowedProjectIds.includes(project.id)) {
                reg.allowedProjectIds.push(project.id);
                setLocalStorageItem("pact_registration", JSON.stringify(reg));
            }
        }

        return { success: true };
    } catch (error: any) {
        console.error("Error en importProjectData:", error);
        return { success: false, error: error.message };
    }
};
