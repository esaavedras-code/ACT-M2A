import { supabase } from './supabase';
import { formatDate as utilsFormatDate } from './utils';
import { downloadBlob } from './reportLogic';

export const generateAct96ExcelReport = async (projectId: string, logId: string) => {
    try {
        const { data: log } = await supabase.from('daily_logs').select('*').eq('id', logId).single();
        if (!log) throw new Error('Log de inspección no encontrado');

        const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single();
        if (!project) throw new Error('Proyecto no encontrado');

        const { data: contractor } = await supabase.from('contractors').select('*').eq('project_id', projectId).single();

        // Leer la plantilla desde la carpeta /public
        const response = await fetch('/ACT-96 Inspeccion.xlsx');
        if (!response.ok) {
            throw new Error(`No se pudo leer la plantilla desde public/ACT-96 Inspeccion.xlsx. Error HTTP: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();

        const ExcelJS = await import('exceljs');
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);

        const sheet = workbook.worksheets[0];

        // Mapeo ACT-96
        sheet.getCell("H5").value = project.num_act || ''; 
        sheet.getCell("G50").value = project.num_act || ''; 

        sheet.getCell("H7").value = project.name || ''; 
        sheet.getCell("G51").value = project.name || ''; 

        sheet.getCell("H11").value = Array.isArray(project.municipios) ? project.municipios.join(', ') : project.municipio || '';
        sheet.getCell("H13").value = contractor?.name || '';
        
        sheet.getCell("W4").value = utilsFormatDate(log.log_date) || '';
        sheet.getCell("W50").value = utilsFormatDate(log.log_date) || '';
        
        // Día semana
        const dateObj = new Date(log.log_date + "T12:00:00Z");
        const dayIdx = dateObj.getDay(); 
        const dayCols = ["AF6", "Z6", "AA6", "AB6", "AC6", "AD6", "AE6"]; 
        sheet.getCell(dayCols[dayIdx]).value = "X";
        
        // Clima
        const w = log.weather_data || {};
        const weatherCond = (w.condition || '').replace(/\(automático\)/gi, '').trim();
        sheet.getCell("X12").value = weatherCond;
        
        // Inspections
        const ins = log.inspections_data || [];
        let r = 23;
        for (const item of ins) {
            if (r > 34) break;
            sheet.getCell(`N${r}`).value = item.description || '';
            r++;
        }
        
        // Notas
        const notes = log.notes_data?.comments || '';
        sheet.getCell("A81").value = notes;
        
        sheet.getCell("D21").value = log.inspector_name || '';
        
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        downloadBlob(blob, `ACT-96_Inspeccion_${utilsFormatDate(log.log_date)}.xlsx`);
        
    } catch (err: any) {
        console.error("Error generating ACT 96 Excel:", err);
        throw err;
    }
}
