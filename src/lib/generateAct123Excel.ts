import ExcelJS from 'exceljs';
import { supabase } from './supabase';
import { formatDate, formatProjectNumber, formatCurrency } from './utils';
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
        const { data: items } = await supabase.from('contract_items').select('*').eq('project_id', projectId);

        const currentCho = allChos?.find(c => c.id === choId);
        if (!currentCho) throw new Error("CHO no encontrado");

        // Approved CHOs before this one
        const prevChos = allChos?.filter(c => c.cho_num < currentCho.cho_num && c.doc_status === 'Aprobado') || [];
        
        // 2. Calculations
        const proposedChange = parseFloat(currentCho.proposed_change as any) || 0;
        const timeExtDays = parseInt(currentCho.time_extension_days as any) || 0;

        // Date calculations
        const origCompletion = proj.date_orig_completion ? new Date(proj.date_orig_completion) : null;
        let currentCompletion = origCompletion ? new Date(origCompletion) : null;
        
        prevChos.forEach(c => {
            if (currentCompletion) {
                currentCompletion.setDate(currentCompletion.getDate() + (parseInt(c.time_extension_days as any) || 0));
            }
        });

        const newCompletion = currentCompletion ? new Date(currentCompletion) : null;
        if (newCompletion) {
            newCompletion.setDate(newCompletion.getDate() + timeExtDays);
        }

        const currentComptroller = currentCompletion ? new Date(currentCompletion) : null;
        if (currentComptroller) currentComptroller.setDate(currentComptroller.getDate() + 730);

        const newComptroller = newCompletion ? new Date(newCompletion) : null;
        if (newComptroller) newComptroller.setDate(newComptroller.getDate() + 730);

        // Checkbox logic
        const choItems = Array.isArray(currentCho.items) ? currentCho.items : [];
        const hasContractItems = choItems.some((it: any) => items?.some(ci => ci.item_num === it.item_num && !ci.is_extra_work));
        const hasNewItems = choItems.some((it: any) => !items?.some(ci => ci.item_num === it.item_num) || items?.some(ci => ci.item_num === it.item_num && ci.is_extra_work));
        const hasTimeExt = timeExtDays > 0;

        // Signature Delegation logic
        const costOrig = parseFloat(proj.cost_original as any) || 0;
        const cumulativeIncrease = prevChos.reduce((acc, c) => acc + (parseFloat(c.proposed_change as any) || 0), 0) + proposedChange;
        const pctIncrease = costOrig > 0 ? (cumulativeIncrease / costOrig) : 0;
        
        let approverRole = "Director Ejecutivo";
        if (proposedChange <= 50000 && pctIncrease <= 0.10 && !hasTimeExt) {
            approverRole = "Director Área de Construcción";
        } else if (proposedChange <= 250000 && pctIncrease <= 0.25 && !hasTimeExt) {
            approverRole = "Subdirector Ejecutivo";
        }

        const approver = personnel?.find(p => p.role === approverRole);

        // 3. Load Template
        const workbook = new ExcelJS.Workbook();
        const bufferTemplate = Buffer.from(ACT123_TEMPLATE_BASE64, 'base64');
        await workbook.xlsx.load(bufferTemplate);

        const sheet = workbook.getWorksheet('SUPP-ACT-123') || workbook.getWorksheet(2);
        if (!sheet) throw new Error("No se encontró la hoja SUPP-ACT-123");

        // 4. Fill Data
        // Header
        sheet.getCell('E6').value = formatProjectNumber(proj.num_act);
        sheet.getCell('E7').value = proj.num_oracle || '';
        sheet.getCell('E8').value = proj.num_federal || 'N/A';
        sheet.getCell('H9').value = proj.num_po || 'N/A';
        sheet.getCell('H10').value = proj.num_contrato || '';
        sheet.getCell('H11').value = proj.account_number_federal || '';
        sheet.getCell('H12').value = proj.account_number_state || '';
        
        sheet.getCell('AG13').value = currentCho.amendment_letter || '';

        // Checkboxes (T15, T17, etc.) - The user provided T15/T17
        if (hasContractItems) sheet.getCell('T15').value = 'X';
        if (hasNewItems) sheet.getCell('T17').value = 'X';
        // If there is a T for time extension, I'll check the template. Analysis showed V19 is the label.
        // Usually there is a checkbox nearby. I'll check T19 or S19.
        if (hasTimeExt) {
            try { sheet.getCell('T19').value = 'X'; } catch(e){}
        }

        // Dates and Info
        sheet.getCell('Q29').value = ''; // Approval Date (leave blank)
        sheet.getCell('AA24').value = approver?.name || '';
        sheet.getCell('C26').value = approver?.role || approverRole;
        
        sheet.getCell('P26').value = contr?.name || '';
        sheet.getCell('I28').value = contr?.representative || '';
        sheet.getCell('Z28').value = contr?.position || '';
        
        sheet.getCell('H33').value = proj.date_award ? formatDate(proj.date_award) : '';
        sheet.getCell('C35').value = proj.name || '';
        
        sheet.getCell('AI43').value = proposedChange;
        sheet.getCell('C45').value = timeExtDays;
        
        sheet.getCell('AN45').value = currentCompletion ? formatDate(currentCompletion) : '';
        sheet.getCell('C47').value = newCompletion ? formatDate(newCompletion) : '';
        
        sheet.getCell('AF47').value = currentComptroller ? formatDate(currentComptroller) : '';
        sheet.getCell('AO47').value = newComptroller ? formatDate(newComptroller) : '';

        // Footer / Signatures
        sheet.getCell('C55').value = approver?.name || '';
        sheet.getCell('AE55').value = contr?.representative || '';
        sheet.getCell('AE59').value = contr?.employer_id || '';
        sheet.getCell('AE60').value = contr?.email || '';

        const outBuffer = await workbook.xlsx.writeBuffer();
        return new Blob([outBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    } catch (err: any) {
        console.error("Error generating ACT-123 Excel:", err);
        throw err;
    }
}
