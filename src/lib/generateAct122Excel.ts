import ExcelJS from 'exceljs';
import { formatDate } from './utils';
import { supabase } from './supabase';

export async function generateAct122Excel(
    projectId: string,
    choId: string
): Promise<Blob> {
    try {
        const { data: projData } = await supabase.from('projects').select('*').eq('id', projectId).single();
        if (!projData) throw new Error("Proyecto no encontrado");
        const { data: contrData } = await supabase.from('contractors').select('*').eq('project_id', projectId).single();
        const { data: choData } = await supabase.from('chos').select('*').eq('id', choId).single();
        const { data: allChos } = await supabase.from('chos').select('cho_num, time_extension_days, proposed_change').eq('project_id', projectId).order('cho_num', { ascending: true });
        
        if (!choId || !choData) throw new Error("CHO no encontrado");

        const response = await fetch('/ACT-122_Official_Template.xlsx');
        if (!response.ok) throw new Error(`Plantilla ACT-122 no encontrada.`);
        const templateBuf = await response.arrayBuffer();

        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(templateBuf);
        const ws = wb.getWorksheet('ACT-122');
        if (!ws) throw new Error('No se encontró la hoja "ACT-122" en la plantilla.');

        // Preparar Datos Acumulados
        let prevExtDays = 0;
        let prevCostMods = 0;
        if (allChos) {
            for (const c of allChos) {
                const currentNum = parseFloat(choData.cho_num);
                const loopNum = parseFloat(c.cho_num);
                if (loopNum < currentNum) {
                    prevExtDays += (parseInt(c.time_extension_days) || 0);
                    prevCostMods += (parseFloat(c.proposed_change) || 0);
                }
            }
        }

        const originalCost = parseFloat(projData.cost_original) || 0;
        const actualContractAmount = originalCost + prevCostMods;
        const currentChoAmount = parseFloat(choData.proposed_change) || 0;
        const newContractAmount = actualContractAmount + currentChoAmount;

        const origEnd = projData.date_orig_completion ? new Date(projData.date_orig_completion + "T00:00:00") : null;
        const dateRevisedBox10 = origEnd ? new Date(origEnd.getTime() + prevExtDays * 86400000) : null;
        const timeExt = parseInt(choData.time_extension_days) || 0;
        const dateNewBox12 = dateRevisedBox10 ? new Date(dateRevisedBox10.getTime() + timeExt * 86400000) : null;
        
        const adminDate = projData.date_rev_completion ? new Date(projData.date_rev_completion + "T00:00:00") : dateNewBox12;
        let adminEnd = adminDate ? new Date(adminDate) : null;
        if (adminEnd) adminEnd.setFullYear(adminEnd.getFullYear() + 2);

        // Helpers
        const setVal = (addr: string, val: any) => {
            const cell = ws.getCell(addr);
            cell.value = val;
            return cell;
        };

        // Header (Left)
        setVal('H7', projData.name || '');
        setVal('H8', contrData?.name || projData.contractor_name || '');
        setVal('H9', projData.num_act || '');
        setVal('H10', projData.num_federal || '');
        setVal('H11', projData.num_oracle || '');
        setVal('H12', projData.num_contrato || '');
        setVal('H13', choData.amendment_letter || '0');
        setVal('H14', choData.cho_num || '');

        // Header (Right)
        setVal('AZ7', projData.date_project_start ? new Date(projData.date_project_start + "T00:00:00") : null);
        setVal('AZ8', dateRevisedBox10);
        setVal('AZ9', timeExt);
        setVal('AZ10', 0); // 11a Compensables
        setVal('AZ11', dateNewBox12);
        setVal('AN12', '13. New Administrative Term Date (Contralor):');
        setVal('AZ12', adminEnd);
        setVal('AZ13', projData.fmis_end_date ? new Date(projData.fmis_end_date + "T00:00:00") : null);

        // Scope
        setVal('H16', choData.description || '');

        // Items
        const allItems = Array.isArray(choData.items) ? choData.items : [];
        const { data: contractItemsList } = await supabase.from('contract_items').select('item_num').eq('project_id', projectId);
        const contractItemNums = new Set(contractItemsList?.map(ci => ci.item_num) || []);

        const contractChoItems = allItems.filter((it: any) => contractItemNums.has(it.item_num));
        const extraWorkItems = allItems.filter((it: any) => !contractItemNums.has(it.item_num));

        // Rows 32+ for contract items
        let row = 32;
        contractChoItems.slice(0, 5).forEach((it: any) => {
            setVal(`B${row}`, it.item_num);
            setVal(`H${row}`, it.description);
            setVal(`AJ${row}`, it.unit);
            setVal(`AN${row}`, parseFloat(it.proposed_change) || 0);
            setVal(`AT${row}`, parseFloat(it.unit_price) || 0);
            setVal(`AZ${row}`, (parseFloat(it.proposed_change) || 0) * (parseFloat(it.unit_price) || 0));
            setVal(`BF${row}`, (parseFloat(choData.federal_share_pct) || 80.25) / 100);
            row++;
        });

        // Rows 39+ for extra work items
        row = 39;
        extraWorkItems.slice(0, 3).forEach((it: any) => {
            setVal(`B${row}`, it.item_num);
            setVal(`H${row}`, it.description);
            setVal(`AJ${row}`, it.unit);
            setVal(`AN${row}`, parseFloat(it.proposed_change) || 0);
            setVal(`AT${row}`, parseFloat(it.unit_price) || 0);
            setVal(`AZ${row}`, (parseFloat(it.proposed_change) || 0) * (parseFloat(it.unit_price) || 0));
            setVal(`BF${row}`, (parseFloat(choData.federal_share_pct) || 80.25) / 100);
            row++;
        });

        // Financial Summary
        setVal('AZ44', currentChoAmount);
        setVal('AZ45', actualContractAmount);
        setVal('AZ46', newContractAmount);

        // Footer Section (Personnel)
        setVal('B45', projData.resident_engineer_name || '');
        setVal('B47', projData.contractor_name || '');
        setVal('B49', projData.project_manager_name || '');

        const buffer = await wb.xlsx.writeBuffer();
        return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    } catch (err: any) {
        console.error("ACT-122 Excel Export error:", err);
        throw err;
    }
}
