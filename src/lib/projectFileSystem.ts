import { supabase } from "./supabase";

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
