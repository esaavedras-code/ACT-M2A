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
        const response = await fetch(`data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${ACT123_TEMPLATE_BASE64}`);
        const bufferTemplate = await response.arrayBuffer();
        await workbook.xlsx.load(bufferTemplate);

        const sheet = workbook.getWorksheet('SUPP-ACT-123') || workbook.worksheets[0];
        if (!sheet) throw new Error("No se encontró la hoja de trabajo en el template");

        // 3. Prepare Items Data
        const choItemsRaw = Array.isArray(cho.items) ? cho.items : [];
        const contractItems = choItemsRaw.filter((it: any) => items?.some(ci => ci.item_num === it.item_num && !ci.is_extra_work));
        const extraItems = choItemsRaw.filter((it: any) => !items?.some(ci => ci.item_num === it.item_num) || items?.some(ci => ci.item_num === it.item_num && ci.is_extra_work));
        const choTotal = choItemsRaw.reduce((sum: number, it: any) => sum + (parseFloat(it.quantity) * parseFloat(it.unit_price)), 0);

        // 4. Fill Header (Based on Image Grid: Label at B5, Value at J5/J6)
        // 4. Fill Header (Based on Instructions Excel)
        sheet.getCell('E6').value = proj.num_act || '';
        sheet.getCell('E7').value = proj.num_oracle || '';
        sheet.getCell('E8').value = proj.num_federal || 'N/A';
        sheet.getCell('H9').value = proj.num_contrato || '';
        sheet.getCell('H10').value = ''; // OCPR Contract no mapeado en base de datos
        sheet.getCell('H11').value = proj.num_cuenta_federal || '';
        sheet.getCell('H12').value = proj.num_cuenta_estatal || '';
        sheet.getCell('AG13').value = cho.amendment_letter || '';

        // Checkboxes (Field 8)
        if (contractItems.length > 0) sheet.getCell('T15').value = 'X';
        if (extraItems.length > 0) sheet.getCell('T17').value = 'X';
        if (cho.time_extension_days && parseInt(cho.time_extension_days) > 0) sheet.getCell('T19').value = 'X';

        // 6. Contract Text Fields
        const absCho = Math.abs(parseFloat(cho.proposed_change) || 0);
        let signRole = "Director de Área de Construcción";
        if (absCho > 250000 || (parseInt(cho.time_extension_days) || 0) > 0) {
            signRole = "Director Ejecutivo";
        } else if (absCho > 50000) {
            signRole = "Subdirector Ejecutivo";
        }
        let signPerson = personnel?.find(p => p.role === signRole);
        if (!signPerson) {
            signRole = "Director Ejecutivo"; // Default fallback
            signPerson = personnel?.find(p => p.role === signRole);
        }

        sheet.getCell('AA24').value = signPerson?.name || '';
        sheet.getCell('C26').value = signPerson?.role || signRole;
        
        sheet.getCell('P26').value = proj.contractor_name || '';
        sheet.getCell('I28').value = proj.contractor_representative || '';
        sheet.getCell('Z28').value = 'President';
        
        sheet.getCell('H33').value = proj.date_contract_signed || '';
        sheet.getCell('C35').value = proj.name || '';
        sheet.getCell('AI43').value = parseFloat(cho.proposed_change) || 0;
        sheet.getCell('C45').value = parseInt(cho.time_extension_days) || 0;

        // Calcular fecha terminacion
        let prevExtDays = 0;
        const currentChoNum = parseFloat(cho.cho_num);
        if (allChos) {
            for (const c of allChos) {
                if (parseFloat(c.cho_num) <= currentChoNum) {
                    prevExtDays += (parseInt(c.time_extension_days) || 0);
                }
            }
        }
        const origEnd = proj.date_orig_completion ? new Date(proj.date_orig_completion + "T00:00:00") : null;
        if (origEnd) {
            const finalDate = new Date(origEnd.getTime() + prevExtDays * 86400000);
            sheet.getCell('AN45').value = formatDate(finalDate);
            
            // Nueva fecha de terminación (C47)
            const newCompletionDate = new Date(finalDate.getTime() + (parseInt(cho.time_extension_days) || 0) * 86400000);
            sheet.getCell('C47').value = formatDate(newCompletionDate);
            
            // Fecha Vigencia en Contralor (AF47) -> Original + 730 días (estimado estándar)
            const vigenciaOriginal = new Date(origEnd.getTime() + 730 * 86400000);
            sheet.getCell('AF47').value = formatDate(vigenciaOriginal);

            // Fecha Vigencia Revisada (AO47) -> Nueva terminación + 730 días
            const vigenciaRevisada = new Date(newCompletionDate.getTime() + 730 * 86400000);
            sheet.getCell('AO47').value = formatDate(vigenciaRevisada);
        } else {
            sheet.getCell('AN45').value = '';
            sheet.getCell('C47').value = '';
            sheet.getCell('AF47').value = '';
            sheet.getCell('AO47').value = '';
        }

        // Datos del contratista
        sheet.getCell('AE59').value = contr?.employer_id || '';
        sheet.getCell('AE60').value = contr?.email || '';
        
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

        // Las firmas y totales ya fueron calculados en el bloque superior según el nuevo template.
        
        // 10. Finalize
        const buffer = await workbook.xlsx.writeBuffer();
        return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    } catch (error: any) {
        console.error("Error generating ACT-123 Excel:", error);
        throw error;
    }
}
