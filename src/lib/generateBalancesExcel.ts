import ExcelJS from 'exceljs';
import { supabase } from './supabase';
import { formatDate, formatCurrency, formatNum, roundedAmt, sortItemsNaturally, formatItemNum } from './utils';

export async function generateBalancesExcel(projectId: string): Promise<Blob> {
    const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single();
    const { data: items } = await supabase.from('contract_items').select('*').eq('project_id', projectId);
    const { data: chos } = await supabase.from('chos').select('*').eq('project_id', projectId);
    const { data: certs } = await supabase.from('payment_certifications').select('*').eq('project_id', projectId).order('cert_num', { ascending: true });
    
    if (!project) throw new Error("Proyecto no encontrado");

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Balances Actuales');

    // --- CONFIGURACIÓN DE COLUMNAS ---
    worksheet.columns = [
        { width: 12 },  // A: Item Num
        { width: 45 },  // B: Descripción
        { width: 10 },  // C: Unidad
        { width: 15 },  // D: Cant. Orig
        { width: 15 },  // E: Cant. CHO
        { width: 15 },  // F: Cant. Total
        { width: 15 },  // G: Certificado
        { width: 15 },  // H: Balance Qty
        { width: 18 }   // I: Balance Monto
    ];

    // --- ESTILOS ---
    const colors = {
        primary: 'FF1E293B',
        header: 'FF334155',
        source: 'FF3B82F6',
        subtotal: 'FFF1F5F9',
        border: 'FFE2E8F0',
        white: 'FFFFFFFF'
    };

    const headerStyle: Partial<ExcelJS.Style> = {
        font: { name: 'Arial', size: 10, bold: true, color: { argb: colors.white } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.header } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: { bottom: { style: 'medium', color: { argb: colors.source } } }
    };

    const sourceStyle: Partial<ExcelJS.Style> = {
        font: { name: 'Arial', size: 11, bold: true, color: { argb: colors.white } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.source } },
        alignment: { horizontal: 'left' }
    };

    // --- PROCESAMIENTO DE DATOS (Agrupar por Fuente de Fondos) ---
    const allItemNums = new Set(items?.map(i => i.item_num) || []);
    chos?.forEach(c => {
        const choItems = Array.isArray(c.items) ? c.items : [];
        choItems.forEach((ci: any) => { if (ci.item_num) allItemNums.add(ci.item_num); });
    });

    const sortedItemNums = Array.from(allItemNums).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const balances = sortedItemNums.map(itemNum => {
        const baseItem = items?.find(i => i.item_num === itemNum);
        const origQty = baseItem ? (parseFloat(baseItem.quantity) || 0) : 0;
        const unitPrice = baseItem ? (parseFloat(baseItem.unit_price) || 0) : 0;
        let choQty = 0, choUP = 0, choSource = "";
        
        chos?.forEach(c => {
            const match = (Array.isArray(c.items) ? c.items : []).find((ci: any) => ci.item_num === itemNum);
            if (match) {
                choQty += (parseFloat(match.proposed_change !== undefined ? match.proposed_change : match.quantity) || 0);
                if (match.unit_price) choUP = parseFloat(match.unit_price);
                if (match.fund_source) choSource = match.fund_source;
            }
        });

        const certQty = certs?.reduce((acc, c) => {
            const match = (Array.isArray(c.items) ? c.items : (c.items?.list || [])).find((it: any) => it.item_num === itemNum);
            return acc + (parseFloat(match?.quantity || 0));
        }, 0) || 0;

        const totalQty = origQty + choQty;
        const price = unitPrice || choUP || 0;
        return {
            item_num: itemNum,
            description: baseItem ? [baseItem.description, baseItem.additional_description].filter(Boolean).join(' - ') : "Ítem nuevo por CHO",
            unit: baseItem?.unit || "UN",
            source: choSource || baseItem?.fund_source || "N/A",
            origQty, choQty, totalQty, certQty,
            balanceQty: totalQty - certQty,
            balanceAmt: (totalQty - certQty) * price
        };
    });

    const grouped = new Map<string, any[]>();
    balances.forEach(b => {
        if (!grouped.has(b.source)) grouped.set(b.source, []);
        grouped.get(b.source)!.push(b);
    });

    // --- CONSTRUCCIÓN ---
    worksheet.addRow(['BALANCES ACTUALES POR PARTIDA']).getCell(1).style = { font: { size: 16, bold: true }, alignment: { horizontal: 'center' } };
    worksheet.mergeCells('A1:I1');
    worksheet.addRow([`${project.name} | ACT: ${project.num_act}`]).getCell(1).style = { font: { italic: true }, alignment: { horizontal: 'center' } };
    worksheet.mergeCells('A2:I2');
    worksheet.addRow([]);

    const header = worksheet.addRow(['Ítem', 'Descripción', 'Unidad', 'Cant. Orig', 'Cant. CHO', 'Cant. Total', 'Certificado', 'Balance Qty', 'Balance Monto']);
    header.eachCell(c => c.style = headerStyle);

    grouped.forEach((groupItems, source) => {
        const sRow = worksheet.addRow([`FUENTE: ${source}`]);
        sRow.eachCell(c => c.style = sourceStyle);
        worksheet.mergeCells(sRow.number, 1, sRow.number, 9);

        let sQty = 0, sAmt = 0;
        groupItems.forEach((b: any) => {
            const r = worksheet.addRow([
                formatItemNum(b.item_num), b.description, b.unit, 
                b.origQty, b.choQty, b.totalQty, -b.certQty, 
                b.balanceQty, b.balanceAmt
            ]);
            r.getCell(1).alignment = { horizontal: 'center' };
            [4,5,6,7,8].forEach(i => r.getCell(i).numFmt = '#,##0.00####');
            r.getCell(9).numFmt = '"$"#,##0.00';
            
            sQty += b.balanceQty;
            sAmt += b.balanceAmt;
        });

        const totalRow = worksheet.addRow(['', `TOTAL BALANCE PARA ${source}`, '', '', '', '', '', sQty, sAmt]);
        totalRow.eachCell(c => {
            c.font = { bold: true };
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.subtotal } };
            c.border = { top: { style: 'thin' }, bottom: { style: 'double' } };
        });
        totalRow.getCell(8).numFmt = '#,##0.00';
        totalRow.getCell(9).numFmt = '"$"#,##0.00';
        worksheet.addRow([]);
    });

    // About
    const lastRow = worksheet.lastRow!.number + 2;
    worksheet.mergeCells(`A${lastRow}:I${lastRow}`);
    const designer = worksheet.getCell(`A${lastRow}`);
    designer.value = `Diseñador: Ing. Enrique Saavedra Sada, PE | Generado por PACT`;
    designer.style = { font: { size: 10, bold: true, color: { argb: colors.primary } }, alignment: { horizontal: 'center' } };

    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
