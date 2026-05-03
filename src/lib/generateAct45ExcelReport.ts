import { supabase } from './supabase';
import { formatDate as utilsFormatDate } from './utils';
import { downloadBlob } from './reportLogic';
import { ACT45_TEMPLATE_BASE64 } from './act45Template';

export const generateAct45ExcelReport = async (projectId: string, logId: string) => {
    try {
        const { data: log } = await supabase.from('daily_logs').select('*').eq('id', logId).single();
        if (!log) throw new Error('Log no encontrado');

        const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single();
        if (!project) throw new Error('Proyecto no encontrado');

        const { data: contractor } = await supabase.from('contractors').select('*').eq('project_id', projectId).single();

        // Convertir la base64 embebida a un ArrayBuffer
        const binaryString = window.atob(ACT45_TEMPLATE_BASE64);
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

        // Mapeo según ACT-45 Instrucciones (rev 12-2024 con celdas)
        sheet.getCell("H6").value = project.num_act || ''; 
        sheet.getCell("H8").value = project.name || ''; 
        sheet.getCell("H12").value = Array.isArray(project.municipios) ? project.municipios.join(', ') : project.municipio || '';
        sheet.getCell("H14").value = contractor?.name || '';
        sheet.getCell("Y5").value = utilsFormatDate(log.log_date) || '';
        
        // Día semana
        const dateObj = new Date(log.log_date + "T12:00:00Z");
        const dayIdx = dateObj.getDay(); 
        // 0=Sun(AF), 1=Mon(Z), 2=Tue(AA), 3=Wed(AB), 4=Thu(AC), 5=Fri(AD), 6=Sat(AE)
        const dayCols = ["AF7", "Z7", "AA7", "AB7", "AC7", "AD7", "AE7"]; 
        sheet.getCell(dayCols[dayIdx]).value = "X";
        
        sheet.getCell("Z9").value = log.inspector_name || '';
        // sheet.getCell("Z11").value = 1; // Pagina no especificada dinámicamente
        // sheet.getCell("AC11").value = 1;

        const w = log.weather_data || {};
        sheet.getCell("X14").value = w.condition || '';
        sheet.getCell("AB14").value = `${w.temp_max || ''}°F / ${w.temp_min || ''}°F`;

        // Personal (A48 a A57)
        const personnel = log.personnel_v2_data || [];
        let rP = 48;
        for (const p of personnel) {
            if (rP > 57) break;
            sheet.getCell(`A${rP}`).value = p.nombres || '';
            sheet.getCell(`M${rP}`).value = p.clasificacion || '';
            sheet.getCell(`R${rP}`).value = p.horas || '';
            sheet.getCell(`V${rP}`).value = p.compañia || '';
            rP++;
        }

        // Equipo (A67 a A76)
        const equipment = log.equipment_v2_data || [];
        let rE = 67;
        for (const e of equipment) {
            if (rE > 76) break;
            sheet.getCell(`A${rE}`).value = e.tipo || '';
            sheet.getCell(`J${rE}`).value = e.descripcion || '';
            sheet.getCell(`AA${rE}`).value = e.horas_op || '';
            sheet.getCell(`AD${rE}`).value = "X"; // Activo por default
            rE++;
        }

        // Trabajo ejecutado (Partidas, A24 a A27)
        const partidas = log.partidas_data || [];
        let rT = 24;
        for (const pt of partidas) {
            if (rT > 27) break;
            sheet.getCell(`A${rT}`).value = pt.item_num || '';
            sheet.getCell(`H${rT}`).value = pt.description || '';
            sheet.getCell(`R${rT}`).value = pt.qty_worked || '';
            sheet.getCell(`U${rT}`).value = pt.unit || '';
            sheet.getCell(`W${rT}`).value = pt.notes || ''; 
            rT++;
        }

        // Notas (A30)
        const notes = log.notes_data?.comments || '';
        sheet.getCell("A30").value = notes;

        // Firmas y Fechas
        sheet.getCell("A112").value = log.inspector_name || '';
        sheet.getCell("Y112").value = utilsFormatDate(log.log_date);

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        downloadBlob(blob, `ACT-45_Informe_Diario_${utilsFormatDate(log.log_date)}.xlsx`);
        
    } catch (err: any) {
        console.error("Error generating ACT 45 Excel:", err);
        throw err;
    }
}
