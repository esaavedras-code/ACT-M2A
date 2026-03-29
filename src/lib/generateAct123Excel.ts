import ExcelJS from 'exceljs';
import { formatDate } from './utils';
import { supabase } from './supabase';

export async function generateAct123Excel(
    projectId: string,
    choId: string
): Promise<Blob> {
    try {
        const { data: projData } = await supabase.from('projects').select('*').eq('id', projectId).single();
        if (!projData) throw new Error("Proyecto no encontrado");
        const { data: contrData } = await supabase.from('contractors').select('*').eq('project_id', projectId).single();
        const { data: choData } = await supabase.from('chos').select('*').eq('id', choId).single();
        const { data: allChos } = await supabase.from('chos').select('cho_num, proposed_change').eq('project_id', projectId).order('cho_num', { ascending: true });
        
        if (!choId || !choData) throw new Error("CHO no encontrado");

        const response = await fetch('/ACT-123_Official_Template.xlsx');
        if (!response.ok) throw new Error(`Plantilla ACT-123 no encontrada.`);
        const templateBuf = await response.arrayBuffer();

        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(templateBuf);
        const ws = wb.getWorksheet('SUPP-ACT-123');
        if (!ws) throw new Error('No se encontró la hoja "SUPP-ACT-123" en la plantilla.');

        // Preparar Datos Acumulados
        const currentChoNum = parseFloat(choData.cho_num);
        let prevCostMods = 0;
        if (allChos) {
            for (const c of allChos) {
                if (parseFloat(c.cho_num) < currentChoNum) {
                    prevCostMods += (parseFloat(c.proposed_change) || 0);
                }
            }
        }

        const originalCost = parseFloat(projData.cost_original) || 0;
        const actualContractAmount = originalCost + prevCostMods;
        const currentChoAmount = parseFloat(choData.proposed_change) || 0;
        const newContractAmount = actualContractAmount + currentChoAmount;

        const setVal = (addr: string, val: any) => {
            const cell = ws.getCell(addr);
            cell.value = val;
            return cell;
        };

        // Header Boxes
        setVal('M6', projData.num_act || '');
        setVal('M7', projData.num_oracle || '');
        setVal('M8', projData.num_federal || '');
        setVal('M9', projData.num_contrato || '');
        setVal('M10', projData.num_contrato_ocpr || '');
        setVal('M11', projData.no_cuenta || '');
        setVal('AK13', choData.cho_num || '');

        // Description / Scope
        setVal('A44', choData.description || ''); // Best guess for Box 35 or similar text area

        // Financial Summary
        setVal('AZ57', currentChoAmount); // Box 28
        setVal('AZ58', actualContractAmount); // Box 29
        setVal('AZ59', newContractAmount); // Box 30

        const buffer = await wb.xlsx.writeBuffer();
        return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    } catch (err: any) {
        console.error("ACT-123 Excel Export error:", err);
        throw err;
    }
}
