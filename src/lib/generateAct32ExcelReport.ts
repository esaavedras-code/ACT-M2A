import { supabase } from './supabase';
import { formatDate } from './utils';
import { downloadBlob } from './reportLogic';
import { ACT32_TEMPLATE_BASE64 } from './act32Template';

/**
 * Genera el reporte ACT-32 (Evaluación de Órdenes de Cambio) en Excel.
 */
export async function generateAct32ExcelReport(projectId: string, choId: string) {
    try {
        const { data: proj } = await supabase.from('projects').select('*').eq('id', projectId).single();
        if (!proj) throw new Error("Proyecto no encontrado");

        const { data: contr } = await supabase.from('contractors').select('*').eq('project_id', projectId).single();
        const { data: allChos } = await supabase.from('chos').select('*').eq('project_id', projectId).order('cho_num', { ascending: true });
        const { data: personnel } = await supabase.from('act_personnel').select('*').eq('project_id', projectId);
        
        const cho = allChos?.find(c => c.id === choId);
        if (!cho) throw new Error("CHO no encontrado");

        // Convertir la base64 embebida a un ArrayBuffer
        const binaryString = window.atob(ACT32_TEMPLATE_BASE64);
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

        // Roles de personal
        const findPerson = (role: string) => personnel?.find(p => p.role === role)?.name || '';

        // Mapeo ACT-32 (rev 12-2024 con celdas)
        sheet.getCell('B9').value = proj.name || '';
        sheet.getCell('B10').value = proj.num_act || '';
        
        const dirReg = findPerson("Director Regional");
        const supervisor = findPerson("Supervisor del Proyecto") || findPerson("Supervisor");
        const admin = findPerson("Administrador de Proyecto") || proj.inspector_name || '';

        sheet.getCell('B13').value = dirReg;
        sheet.getCell('B14').value = supervisor;
        sheet.getCell('B15').value = admin;
        
        sheet.getCell('B17').value = proj.date_award ? formatDate(proj.date_award) : ''; 
        sheet.getCell('B18').value = proj.date_completion ? formatDate(proj.date_completion) : ''; 

        // Fecha de terminacion revisada
        let revDays = 0;
        allChos?.forEach(c => {
            if (c.cho_num <= cho.cho_num) revDays += (parseInt(c.time_extension_days) || 0);
        });
        let revDate = proj.date_completion ? new Date(proj.date_completion) : new Date();
        revDate.setDate(revDate.getDate() + revDays);
        sheet.getCell('B19').value = formatDate(revDate);

        sheet.getCell('H11').value = proj.num_federal || '';
        sheet.getCell('G13').value = proj.designer_name || 'N/A'; 
        sheet.getCell('G14').value = proj.contractor_name || contr?.name || '';
        
        // Costos
        sheet.getCell('G17').value = parseFloat(proj.initial_budget) || 0; 
        
        const previousChosTotal = allChos?.filter(c => c.cho_num < cho.cho_num).reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0) || 0;
        sheet.getCell('G18').value = (parseFloat(proj.initial_budget) || 0) + previousChosTotal; 
        
        // Checkboxes items (B21, E21)
        const choItemsRaw = Array.isArray(cho.items) ? cho.items : [];
        const hasExisting = choItemsRaw.some((it: any) => !it.is_extra_work); 
        const hasNew = choItemsRaw.some((it: any) => it.is_extra_work);
        
        sheet.getCell('B21').value = hasExisting ? 'X' : ''; 
        sheet.getCell('E21').value = hasNew ? 'X' : ''; 
        
        // Justificacion
        sheet.getCell('A25').value = cho.description || '';
        
        // Partidas A39:A46
        let currentRow = 39;
        let runningTotal = 0;
        for (const item of choItemsRaw) {
            if (currentRow > 46) break;
            
            const fullDesc = `${item.item_num || ''} ${item.spec_code || ''} ${item.description || ''}`;
            sheet.getCell(`A${currentRow}`).value = fullDesc.trim();
            sheet.getCell(`E${currentRow}`).value = item.unit || '';
            sheet.getCell(`F${currentRow}`).value = parseFloat(item.quantity) || 0;
            sheet.getCell(`G${currentRow}`).value = parseFloat(item.unit_price) || 0;
            
            const total = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
            sheet.getCell(`H${currentRow}`).value = total;
            runningTotal += total;
            
            currentRow++;
        }
        
        // Totales y días
        sheet.getCell('A47').value = "Total:";
        sheet.getCell('B47').value = runningTotal;
        sheet.getCell('G47').value = parseInt(cho.time_extension_days) || 0;
        
        // Comentarios
        sheet.getCell('A50').value = cho.comments || '';

        // Firmas (Nombre)
        sheet.getCell('B57').value = admin;
        sheet.getCell('G57').value = supervisor;
        sheet.getCell('B59').value = dirReg;
        
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        downloadBlob(blob, `ACT-32_CHO_${cho.cho_num}_${proj.num_act}.xlsx`);
        
    } catch (err: any) {
        console.error("Error generating ACT 32 Excel:", err);
        throw err;
    }
}

