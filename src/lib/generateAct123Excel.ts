import ExcelJS from 'exceljs';
import { supabase } from './supabase';
import { formatDate, formatProjectNumber, sortItemsNaturally, uniqueSortItems } from './utils';
import { ACT123_TEMPLATE_BASE64 } from './act123Template';

/**
 * Genera el reporte ACT-123 (Supplementary Contract Form) en Excel.
 */
export async function generateAct123Excel(projectId: string, choId: string) {
    try {
        // 1. Fetch Data
        const { data: proj } = await supabase.from('projects').select('*').eq('id', projectId).single();
        if (!proj) throw new Error("Proyecto no encontrado");

        const { data: contr } = await supabase.from('contractors').select('*').eq('project_id', projectId).single();
        const { data: allChos } = await supabase.from('chos').select('*').eq('project_id', projectId).order('cho_num', { ascending: true });
        const { data: personnel } = await supabase.from('act_personnel').select('*').eq('project_id', projectId);
        const { data: items = [] } = await supabase.from('contract_items').select('*').eq('project_id', projectId);

        const cho = allChos?.find(c => c.id === choId);
        if (!cho) throw new Error("CHO no encontrado");

        // 2. Load Template
        const workbook = new ExcelJS.Workbook();
        const bufferTemplate = Buffer.from(ACT123_TEMPLATE_BASE64, 'base64');
        await workbook.xlsx.load(bufferTemplate);

        const sheet = workbook.getWorksheet('SUPP-ACT-123') || workbook.worksheets[0];
        if (!sheet) throw new Error("No se encontró la hoja de trabajo en el template");

        // 3. Prepare Items Data
        const choItemsRaw = Array.isArray(cho.items) ? cho.items : [];
        const contractItems = choItemsRaw.filter((it: any) => items?.some(ci => ci.item_num === it.item_num && !ci.is_extra_work));
        const extraItems = choItemsRaw.filter((it: any) => !items?.some(ci => ci.item_num === it.item_num) || items?.some(ci => ci.item_num === it.item_num && ci.is_extra_work));
        const choTotal = choItemsRaw.reduce((sum: number, it: any) => sum + (parseFloat(it.quantity) * parseFloat(it.unit_price)), 0);

        // 4. Fill Header (Based on Image Grid: Label at B5, Value at J5/J6)
        // Adjusting based on A6 label scan: J6 seems to be the first value row.
        sheet.getCell('J6').value = proj.contractor_name || '';
        sheet.getCell('J7').value = proj.num_act || '';
        sheet.getCell('J8').value = proj.num_federal || '';
        sheet.getCell('J9').value = proj.num_contrato || '';
        sheet.getCell('J10').value = cho.amendment_letter || '';
        sheet.getCell('J11').value = proj.num_cuenta_federal || '';
        sheet.getCell('J12').value = proj.num_cuenta_estatal || '';

        // 5. Supplementary Contract Info
        const choLabel = `${cho.cho_num}${cho.amendment_letter || ''}`;
        sheet.getCell('AK13').value = choLabel;
        
        // Checkboxes (Field 8)
        if (contractItems.length > 0) sheet.getCell('V15').value = 'X';
        if (extraItems.length > 0) sheet.getCell('V17').value = 'X';
        if (cho.time_extension_days && parseInt(cho.time_extension_days) > 0) sheet.getCell('V19').value = 'X';

        // 6. Contract Text Fields
        sheet.getCell('Y22').value = new Date().toLocaleDateString();
        
        const findPerson = (role: string) => personnel?.find(p => p.role === role);
        const execDir = findPerson("Director Ejecutivo");
        
        sheet.getCell('AQ24').value = execDir?.name || '';
        sheet.getCell('M26').value = execDir?.role || '';
        sheet.getCell('AH26').value = proj.contractor_name || '';
        sheet.getCell('Y28').value = proj.contractor_representative || '';
        sheet.getCell('AK28').value = "Representative";

        // 7. Items Table (Mover a la hoja Table for ROA, no en la principal)
        const roaSheet = workbook.getWorksheet('Table for ROA') || workbook.worksheets[3];
        if (roaSheet) {
            let contractRow = 6;
            for (const item of contractItems) {
                roaSheet.getCell(`B${contractRow}`).value = item.spec_code || item.item_num || '';
                roaSheet.getCell(`C${contractRow}`).value = item.description || '';
                roaSheet.getCell(`D${contractRow}`).value = '';
                roaSheet.getCell(`E${contractRow}`).value = item.unit || '';
                roaSheet.getCell(`F${contractRow}`).value = parseFloat(item.quantity) || 0;
                roaSheet.getCell(`G${contractRow}`).value = parseFloat(item.unit_price) || 0;
                roaSheet.getCell(`H${contractRow}`).value = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
                roaSheet.getCell(`I${contractRow}`).value = item.fed_pct || 0;
                contractRow++;
            }

            // Buscar la fila de "New Items"
            let extraRow = 11;
            roaSheet.eachRow((row, rowNumber) => {
                if (row.getCell(2).value && row.getCell(2).value.toString().includes('New Items')) {
                    extraRow = rowNumber + 1;
                }
            });

            for (const item of extraItems) {
                roaSheet.getCell(`B${extraRow}`).value = item.spec_code || item.item_num || '';
                roaSheet.getCell(`C${extraRow}`).value = item.description || '';
                roaSheet.getCell(`D${extraRow}`).value = '';
                roaSheet.getCell(`E${extraRow}`).value = item.unit || '';
                roaSheet.getCell(`F${extraRow}`).value = parseFloat(item.quantity) || 0;
                roaSheet.getCell(`G${extraRow}`).value = parseFloat(item.unit_price) || 0;
                roaSheet.getCell(`H${extraRow}`).value = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
                roaSheet.getCell(`I${extraRow}`).value = item.fed_pct || 0;
                extraRow++;
            }
        }

        // 8. Totals and Agreement (Row 43-47)
        sheet.getCell('AS43').value = choTotal;
        sheet.getCell('G45').value = cho.time_extension_days || 0;
        sheet.getCell('AV45').value = proj.date_completion ? formatDate(proj.date_completion) : '';
        
        // Dates logic
        const completionDate = proj.date_completion ? new Date(proj.date_completion) : new Date();
        const newCompletionDate = new Date(completionDate);
        newCompletionDate.setDate(newCompletionDate.getDate() + (parseInt(cho.time_extension_days) || 0));
        
        sheet.getCell('J47').value = formatDate(newCompletionDate);
        
        // Admin Term (example: +2 years)
        const adminTermDate = new Date(newCompletionDate);
        adminTermDate.setFullYear(adminTermDate.getFullYear() + 2);
        sheet.getCell('AV47').value = formatDate(adminTermDate);

        // 9. Signatures
        sheet.getCell('U54').value = execDir?.name || '';
        sheet.getCell('AW54').value = proj.contractor_representative || '';
        sheet.getCell('AW59').value = contr?.employer_id || '';

        // 10. Finalize
        const buffer = await workbook.xlsx.writeBuffer();
        return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    } catch (error: any) {
        console.error("Error generating ACT-123 Excel:", error);
        throw error;
    }
}
