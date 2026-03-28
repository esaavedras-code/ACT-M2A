import { supabase } from './supabase';
import { formatDate as utilsFormatDate } from './utils';
import { downloadBlob } from './reportLogic';

export const generateAct45ExcelReport = async (projectId: string, logId: string) => {
    try {
        const { data: log } = await supabase.from('daily_logs').select('*').eq('id', logId).single();
        if (!log) throw new Error('Log no encontrado');

        const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single();
        if (!project) throw new Error('Proyecto no encontrado');

        const { data: contractor } = await supabase.from('contractors').select('*').eq('project_id', projectId).single();

        // Leer la plantilla desde la carpeta /public
        const response = await fetch('/ACT-45 Actividades.xlsx');
        if (!response.ok) {
            throw new Error(`No se pudo leer la plantilla desde public/ACT-45 Actividades.xlsx. Error HTTP: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();

        const ExcelJS = await import('exceljs');
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);

        const sheet = workbook.worksheets[0];

        // Mapeo según ACT-45 Instrucciones
        sheet.getCell("P6").value = project.num_act || ''; 
        sheet.getCell("T8").value = project.name || ''; 
        sheet.getCell("L12").value = Array.isArray(project.municipios) ? project.municipios.join(', ') : project.municipio || '';
        sheet.getCell("J14").value = contractor?.name || '';
        sheet.getCell("Y5").value = utilsFormatDate(log.log_date) || '';
        
        // Día semana
        const dateObj = new Date(log.log_date + "T12:00:00Z");
        const dayIdx = dateObj.getDay(); 
        const dayCols = ["AF7", "Z7", "AA7", "AB7", "AC7", "AD7", "AE7"]; 
        sheet.getCell(dayCols[dayIdx]).value = "X";
        
        sheet.getCell("Y9").value = log.inspector_name || '';
        sheet.getCell("Z11").value = 1;
        sheet.getCell("AC11").value = 1;

        const w = log.weather_data || {};
        sheet.getCell("W14").value = w.condition || '';
        sheet.getCell("AL14").value = `${w.temp_max || ''}°F / ${w.temp_min || ''}°F`;
        sheet.getCell("AC14").value = " "; // AM 
        sheet.getCell("AH14").value = " "; // PM

        // Personal
        const personnel = log.personnel_v2_data || [];
        let rP = 47;
        for (const p of personnel) {
            if (rP > 56) break;
            sheet.getCell(`A${rP}`).value = p.nombres || '';
            sheet.getCell(`M${rP}`).value = p.clasificacion || '';
            sheet.getCell(`R${rP}`).value = p.horas || '';
            sheet.getCell(`V${rP}`).value = p.compañia || '';
            rP++;
        }

        // Equipo
        const equipment = log.equipment_v2_data || [];
        let rE = 67;
        for (const e of equipment) {
            if (rE > 71) break;
            sheet.getCell(`A${rE}`).value = e.tipo || '';
            sheet.getCell(`J${rE}`).value = e.descripcion || '';
            sheet.getCell(`AA${rE}`).value = e.horas_op || '';
            sheet.getCell(`AA${rE + 1}`).value = "X"; // Activo por default
            rE += 2;
        }

        // Trabajo ejecutado (Partidas)
        const partidas = log.partidas_data || [];
        let rT = 23;
        for (const pt of partidas) {
            if (rT > 28) break; // Excel template space limits
            sheet.getCell(`A${rT}`).value = pt.item_num || '';
            sheet.getCell(`H${rT}`).value = pt.description || '';
            sheet.getCell(`R${rT}`).value = pt.qty_worked || '';
            sheet.getCell(`U${rT}`).value = pt.unit || '';
            sheet.getCell(`W${rT}`).value = pt.notes || ''; 
            rT++;
        }

        // Notas 
        const notes = log.notes_data?.comments || '';
        sheet.getCell("A30").value = notes;

        sheet.getCell("A114").value = log.inspector_name || '';
        sheet.getCell("Z114").value = utilsFormatDate(log.log_date);

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        downloadBlob(blob, `ACT-45_Informe_Diario_${utilsFormatDate(log.log_date)}.xlsx`);
        
    } catch (err: any) {
        console.error("Error generating ACT 45 Excel:", err);
        throw err;
    }
}
