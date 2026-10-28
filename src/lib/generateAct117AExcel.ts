import ExcelJS from 'exceljs';
import { supabase } from './supabase';
import { formatDate, formatProjectNumber, formatItemNum } from './utils';
import { ACT117A_TEMPLATE_BASE64 } from './act117aTemplate';

/**
 * Genera el reporte ACT-117A (Hojas de certificación por ítem) en Excel.
 * Crea una pestaña por cada ítem incluido en la certificación.
 */
export async function generateAct117AExcel(
    projectId: string,
    certId: string,
    certNum: number,
    certDate: string
) {
    try {
        // 1. Fetch Data
        const { data: projData } = await supabase.from('projects').select('*').eq('id', projectId).single();
        if (!projData) throw new Error("Proyecto no encontrado");

        const { data: contrData } = await supabase.from('contractors').select('*').eq('project_id', projectId).single();
        const { data: currentCert } = await supabase.from('payment_certifications').select('*').eq('id', certId).single();
        
        const certItemsRaw = Array.isArray(currentCert?.items) ? currentCert.items : (currentCert?.items?.list || []);
        const certItems = [...certItemsRaw].sort((a: any, b: any) => (parseInt(a.item_num) || 0) - (parseInt(b.item_num) || 0));

        // 2. Load template
        const workbook = new ExcelJS.Workbook();
        const bufferTemplate = Buffer.from(ACT117A_TEMPLATE_BASE64, 'base64');
        await workbook.xlsx.load(bufferTemplate as any);

        const templateSheet = workbook.getWorksheet(1);
        if (!templateSheet) throw new Error("Template ACT-117A no tiene hojas");

        // 3. For each item in the certification, create a sheet
        for (let i = 0; i < certItems.length; i++) {
            const item = certItems[i];
            const sheetName = `Item ${item.item_num}`.substring(0, 31); // Excel sheet name limit
            
            let currentSheet;
            if (i === 0) {
                currentSheet = templateSheet;
                currentSheet.name = sheetName;
            } else {
                currentSheet = workbook.addWorksheet(sheetName);
                await cloneSheetPerfectly(templateSheet, currentSheet);
            }

            // Encabezado institucional idéntico a la Foto 2
            setupInstitutionalHeader(currentSheet);

            // Fill header (User defined mappings)
            currentSheet.getCell('K6').value = projData.name || '';
            currentSheet.getCell('K7').value = formatProjectNumber(projData.num_act);
            currentSheet.getCell('K8').value = contrData?.name || '';
            
            currentSheet.getCell('AO6').value = formatItemNum(item.item_num) || '';
            currentSheet.getCell('AO7').value = parseFloat(item.unit_price) || 0;
            currentSheet.getCell('AO8').value = item.description || '';
            currentSheet.getCell('BG6').value = item.unit || '';

            // Cert Info (Inferred from template)
            currentSheet.getCell('BW6').value = certNum;
            currentSheet.getCell('BW7').value = formatDate(certDate);

            // Amount field (BJ11 in the template seems to be a total/amount area)
            // But usually 117A has a list of locations and calculations.
            // For now we just fill the header as requested.
        }

        const outBuffer = await workbook.xlsx.writeBuffer();
        return new Blob([outBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    } catch (err: any) {
        console.error("Error generating ACT-117A Excel:", err);
        throw err;
    }
}

/**
 * Clona una hoja de Excel a otra manteniendo formato, estilos y merges.
 */
async function cloneSheetPerfectly(source: ExcelJS.Worksheet, target: ExcelJS.Worksheet) {
    // Clonar columnas
    source.columns.forEach((col: any, i: number) => {
        target.getColumn(i + 1).width = col.width;
    });

    // Clonar filas y celdas
    source.eachRow({ includeEmpty: true }, (row: any, rowNum: number) => {
        const newRow = target.getRow(rowNum);
        newRow.height = row.height;
        row.eachCell({ includeEmpty: true }, (cell: any, colNum: number) => {
            const newCell = newRow.getCell(colNum);
            newCell.value = cell.value;
            newCell.style = JSON.parse(JSON.stringify(cell.style || {}));
        });
    });

    // Clonar celdas combinadas
    // @ts-ignore
    const merges = source._merges || {};
    Object.values(merges).forEach((m: any) => {
        try {
            target.mergeCells(m.tl, m.br);
        } catch (e) { /* ignore merge conflicts */ }
    });
}

function setupInstitutionalHeader(ws: ExcelJS.Worksheet) {
    ['A1:CB1', 'A1:BT1', 'A1:BU1', 'BV1:CB1', 'A2:CB2', 'A2:BT2', 'A2:BU2', 'BV2:CB2'].forEach(r => {
        try { ws.unMergeCells(r); } catch {}
    });

    for (let c = 1; c <= 80; c++) {
        ws.getCell(1, c).value = '';
        ws.getCell(2, c).value = '';
    }

    try {
        ws.mergeCells('A1:BU1');
        ws.mergeCells('BV1:CB1');
    } catch {}

    ws.getCell('A1').value = 'Government of Puerto Rico';
    ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell('A1').font = { name: 'Arial', size: 9, bold: false };

    ws.getCell('BV1').value = 'ACT-117A';
    ws.getCell('BV1').alignment = { horizontal: 'right', vertical: 'middle' };
    ws.getCell('BV1').font = { name: 'Arial', size: 9, bold: true };

    try {
        ws.mergeCells('A2:BU2');
        ws.mergeCells('BV2:CB2');
    } catch {}

    ws.getCell('A2').value = 'Department of Transportation and Public Works';
    ws.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell('A2').font = { name: 'Arial', size: 9, bold: false };

    ws.getCell('BV2').value = '(6/09)';
    ws.getCell('BV2').alignment = { horizontal: 'right', vertical: 'middle' };
    ws.getCell('BV2').font = { name: 'Arial', size: 9, bold: false };

    try { ws.mergeCells('A3:CB3'); } catch {}
    ws.getCell('A3').value = 'HIGHWAY AND TRANSPORTATION AUTHORITY';
    ws.getCell('A3').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell('A3').font = { name: 'Arial', size: 9, bold: false };

    for (let c = 1; c <= 80; c++) {
        ws.getCell(4, c).value = '';
    }

    try { ws.mergeCells('A5:CB5'); } catch {}
    ws.getCell('A5').value = 'ITEM CERTIFICATION WORKSHEET';
    ws.getCell('A5').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell('A5').font = { name: 'Arial', size: 10, bold: true };

    ws.getRow(1).height = 15;
    ws.getRow(2).height = 15;
    ws.getRow(3).height = 16;
    ws.getRow(4).height = 8;
    ws.getRow(5).height = 18;
}
