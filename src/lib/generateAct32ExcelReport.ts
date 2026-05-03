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

        // Director Regional, Supervisor, Administrador (asumiendo roles por defecto o buscando de personnel)
        const findPerson = (role: string) => personnel?.find(p => p.role === role)?.name || '';

        // Mapeo según instrucciones
        sheet.getCell('B9').value = proj.name || '';
        sheet.getCell('B10').value = proj.num_act || '';
        sheet.getCell('B13').value = findPerson("Director Regional");
        sheet.getCell('B14').value = findPerson("Supervisor del Proyecto") || findPerson("Supervisor");
        sheet.getCell('B15').value = findPerson("Administrador de Proyecto") || proj.inspector_name || ''; // Administrador
        
        sheet.getCell('B17').value = proj.date_award ? formatDate(proj.date_award) : ''; // Fecha Comienzo
        sheet.getCell('B18').value = proj.date_completion ? formatDate(proj.date_completion) : ''; // Fecha Terminacion

        // Fecha de terminacion revisada: original + suma de días de todos los CHOs aprobados hasta ahora
        // Simplificación: sumamos los dias del CHO actual a la fecha original, o usamos una funcion de utils si existe
        let revDays = parseInt(cho.time_extension_days) || 0;
        let revDate = proj.date_completion ? new Date(proj.date_completion) : new Date();
        revDate.setDate(revDate.getDate() + revDays);
        sheet.getCell('B19').value = formatDate(revDate);

        sheet.getCell('H11').value = proj.num_federal || '';
        sheet.getCell('G13').value = proj.designer_name || 'N/A'; // Diseñador
        sheet.getCell('G14').value = proj.contractor_name || contr?.name || '';
        
        // Costos
        sheet.getCell('G17').value = parseFloat(proj.initial_budget) || 0; 
        
        const previousChosTotal = allChos?.filter(c => c.cho_num < cho.cho_num).reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0) || 0;
        sheet.getCell('G18').value = (parseFloat(proj.initial_budget) || 0) + previousChosTotal; // Costo Revisado antes de esta orden
        
        // Items del contrato / items nuevos (checkboxes)
        const choItemsRaw = Array.isArray(cho.items) ? cho.items : [];
        const hasExisting = choItemsRaw.some((it: any) => !it.is_extra_work); // asumimos is_extra_work
        const hasNew = choItemsRaw.some((it: any) => it.is_extra_work);
        
        sheet.getCell('B21').value = hasExisting ? 'X' : ''; // Aumentan items
        sheet.getCell('E21').value = hasNew ? 'X' : ''; // Items nuevos
        
        // Justificacion
        sheet.getCell('A25').value = cho.description || '';
        
        // Partidas A39:A46
        let currentRow = 39;
        for (const item of choItemsRaw) {
            if (currentRow > 46) break;
            
            // "Item Especificacion descripcion de partida" -> A39
            const fullDesc = `${item.item_num || ''} ${item.spec_code || ''} ${item.description || ''}`;
            sheet.getCell(`A${currentRow}`).value = fullDesc.trim();
            sheet.getCell(`E${currentRow}`).value = item.unit || '';
            sheet.getCell(`F${currentRow}`).value = parseFloat(item.quantity) || 0;
            sheet.getCell(`G${currentRow}`).value = parseFloat(item.unit_price) || 0;
            sheet.getCell(`H${currentRow}`).value = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
            
            currentRow++;
        }
        
        // Totales y días
        sheet.getCell('G47').value = cho.time_extension_days || 0;
        
        const choTotal = choItemsRaw.reduce((sum: number, it: any) => sum + (parseFloat(it.quantity) * parseFloat(it.unit_price)), 0);
        // El Sub-Total o Total va en la misma columna de totales (H47 por lo general) 
        // pero las instrucciones decian B47 para el label.
        sheet.getCell('B47').value = "Total:";
        sheet.getCell('H47').value = choTotal;
        
        // Comentarios
        sheet.getCell('A50').value = cho.comments || '';
        
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        downloadBlob(blob, `ACT-32_CHO_${cho.cho_num}_${proj.num_act}.xlsx`);
        
    } catch (err: any) {
        console.error("Error generating ACT 32 Excel:", err);
        throw err;
    }
}
