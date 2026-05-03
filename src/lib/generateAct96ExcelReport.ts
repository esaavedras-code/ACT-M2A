import { supabase } from './supabase';
import { formatDate as utilsFormatDate } from './utils';
import { downloadBlob } from './reportLogic';
import { ACT96_TEMPLATE_BASE64 } from './act96Template';

export const generateAct96ExcelReport = async (projectId: string, logId: string) => {
    try {
        const { data: log } = await supabase.from('daily_logs').select('*').eq('id', logId).single();
        if (!log) throw new Error('Log de inspección no encontrado');

        const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single();
        if (!project) throw new Error('Proyecto no encontrado');

        const { data: contractor } = await supabase.from('contractors').select('*').eq('project_id', projectId).single();

        // Convertir la base64 embebida a un ArrayBuffer
        const binaryString = window.atob(ACT96_TEMPLATE_BASE64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const arrayBuffer = bytes.buffer;

        const ExcelJS = await import('exceljs');
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);

        const sheet = workbook.worksheets[0];

        // Mapeo ACT-96 (rev 12-2024 con celdas)
        sheet.getCell("H5").value = project.num_act || ''; 
        sheet.getCell("H7").value = project.name || ''; 
        sheet.getCell("H11").value = Array.isArray(project.municipios) ? project.municipios.join(', ') : project.municipio || '';
        sheet.getCell("H13").value = contractor?.name || '';
        
        sheet.getCell("Y4").value = utilsFormatDate(log.log_date) || '';
        
        // Día semana
        const dateObj = new Date(log.log_date + "T12:00:00Z");
        const dayIdx = dateObj.getDay(); 
        // 0=Sun(AF6), 1=Mon(Z6), 2=Tue(AA6), 3=Wed(AB6), 4=Thu(AC6), 5=Fri(AD6), 6=Sat(AE6)
        const dayCols = ["AF6", "Z6", "AA6", "AB6", "AC6", "AD6", "AE6"]; 
        sheet.getCell(dayCols[dayIdx]).value = "X";
        
        // Clima
        const w = log.weather_data || {};
        const weatherCond = (w.condition || '').replace(/\(automático\)/gi, '').trim();
        sheet.getCell("Y12").value = weatherCond;
        
        // Inspections (N23 a N30)
        const ins = log.inspections_data || [];
        let r = 23;
        for (const item of ins) {
            if (r > 30) break;
            sheet.getCell(`N${r}`).value = item.description || '';
            r++;
        }
        
        // Notas (Actividades adicionales A54 a A72)
        const notes = log.notes_data?.comments || '';
        sheet.getCell("A54").value = notes;
        
        // Nombre Administrador
        sheet.getCell("I90").value = log.inspector_name || '';
        
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        downloadBlob(blob, `ACT-96_Inspeccion_${utilsFormatDate(log.log_date)}.xlsx`);
        
    } catch (err: any) {
        console.error("Error generating ACT 96 Excel:", err);
        throw err;
    }
}
