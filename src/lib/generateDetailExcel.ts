import ExcelJS from 'exceljs';
import { supabase } from './supabase';
import { formatDate, formatCurrency, roundedAmt } from './utils';

export async function generateDetailExcel(projectId: string): Promise<Blob> {
    const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single();
    const { data: items } = await supabase.from('contract_items').select('*').eq('project_id', projectId);
    const { data: chos } = await supabase.from('chos').select('*').eq('project_id', projectId);
    const { data: certs } = await supabase.from('payment_certifications').select('*').eq('project_id', projectId).order('cert_num', { ascending: true });
    
    if (!project) throw new Error("Proyecto no encontrado");

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Detalle de Partidas');

    worksheet.columns = [
        { width: 15 }, // A: Ref #
        { width: 45 }, // B: Descripción/Actividad
        { width: 10 }, // C: Unidad
        { width: 15 }, // D: Cantidad
        { width: 15 }, // E: Precio Unit.
        { width: 15 }, // F: Monto
        { width: 15 }, // G: Balance Qty
        { width: 18 }  // H: Balance Monto
    ];

    const colors = {
        itemHeader: 'FFF1F5F9',
        contract: 'FFE0F2FE', // Light blue
        cho: 'FFFEF3C7',      // Light amber
        cert: 'FFDCFCE7',     // Light emerald
        primary: 'FF1E293B',
        white: 'FFFFFFFF'
    };

    const mainHeaderStyle: Partial<ExcelJS.Style> = {
        font: { name: 'Arial', size: 10, bold: true, color: { argb: colors.white } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.primary } },
        alignment: { horizontal: 'center' }
    };

    // --- CONSTRUCCIÓN ---
    worksheet.addRow(['HISTORIAL DETALLADO POR PARTIDA (AUDIT TRAIL)']).getCell(1).style = { font: { size: 16, bold: true }, alignment: { horizontal: 'center' } };
    worksheet.mergeCells('A1:H1');
    worksheet.addRow([`${project.name} | ACT: ${project.num_act}`]).getCell(1).style = { font: { italic: true }, alignment: { horizontal: 'center' } };
    worksheet.mergeCells('A2:H2');
    worksheet.addRow([]);

    const header = worksheet.addRow(['Referencia', 'Descripción de Actividad', 'Unidad', 'Cantidad', 'Precio Unit.', 'Importe', 'Saldo Qty', 'Saldo Monto']);
    header.eachCell(c => c.style = mainHeaderStyle);

    // Obtener todos los item nums
    const allItemNums = new Set(items?.map(i => i.item_num) || []);
    chos?.forEach(c => (Array.isArray(c.items) ? c.items : []).forEach((ci: any) => { if (ci.item_num) allItemNums.add(ci.item_num); }));
    const sortedItemNums = Array.from(allItemNums).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    sortedItemNums.forEach(itemNum => {
        const baseItem = items?.find(i => i.item_num === itemNum);
        let uPrice = baseItem ? (parseFloat(baseItem.unit_price) || 0) : 0;
        let unit = baseItem?.unit || "";
        let currentBalance = 0;

        // Fila Encabezado de Partida
        const itemRow = worksheet.addRow([`PARTIDA ${itemNum}`, baseItem?.description || "Ítem de Orden de Cambio", unit]);
        itemRow.eachCell(c => {
            c.font = { bold: true, size: 11 };
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.itemHeader } };
            c.border = { top: { style: 'medium' } };
        });

        // 1. Contrato Original
        if (baseItem) {
            const qty = parseFloat(baseItem.quantity) || 0;
            currentBalance += qty;
            const r = worksheet.addRow(['CONTRATO', '  - Cantidad Original de Contrato', unit, qty, uPrice, qty * uPrice, currentBalance, currentBalance * uPrice]);
            r.eachCell(c => {
                c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.contract } };
                if (r.getCell(1) === c) c.font = { bold: true };
            });
            formatMoneyCells(r);
        }

        // 2. Órdenes de Cambio
        chos?.forEach(c => {
            const match = (Array.isArray(c.items) ? c.items : []).find((it: any) => it.item_num === itemNum);
            if (match) {
                if (!baseItem && uPrice === 0) uPrice = parseFloat(match.unit_price) || 0;
                if (!baseItem && unit === "") unit = match.unit || "UN";
                
                const qty = parseFloat(match.proposed_change !== undefined ? match.proposed_change : match.quantity) || 0;
                currentBalance += qty;
                const r = worksheet.addRow([`CHO #${c.cho_num}${c.amendment_letter || ''}`, `  - Orden de Cambio (${formatDate(c.cho_date)})`, unit, qty, uPrice, qty * uPrice, currentBalance, currentBalance * uPrice]);
                r.eachCell(c => {
                    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.cho } };
                });
                formatMoneyCells(r);
            }
        });

        // 3. Certificaciones de Pago
        certs?.forEach(cert => {
            const match = (Array.isArray(cert.items) ? cert.items : (cert.items?.list || [])).find((it: any) => it.item_num === itemNum);
            if (match) {
                const qty = parseFloat(match.quantity) || 0;
                currentBalance -= qty;
                const r = worksheet.addRow([`CERT #${cert.cert_num}`, `  - Pago Certificación (${formatDate(cert.cert_date)})`, unit, -qty, uPrice, -(qty * uPrice), currentBalance, currentBalance * uPrice]);
                r.eachCell(c => {
                    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.cert } };
                });
                formatMoneyCells(r);
            }
        });

        worksheet.addRow([]); // Espacio entre partidas
    });

    // About
    const lastRow = worksheet.lastRow!.number + 2;
    worksheet.mergeCells(`A${lastRow}:H${lastRow}`);
    const designer = worksheet.getCell(`A${lastRow}`);
    designer.value = `Diseñador: Ing. Enrique Saavedra Sada, PE | Reporte de Detalle y Auditoría PACT`;
    designer.style = { font: { size: 10, bold: true, color: { argb: colors.primary } }, alignment: { horizontal: 'center' } };

    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function formatMoneyCells(row: ExcelJS.Row) {
    [4, 6, 7].forEach(i => row.getCell(i).numFmt = '#,##0.00');
    [5, 8].forEach(i => row.getCell(i).numFmt = '"$"#,##0.00');
    row.getCell(1).alignment = { horizontal: 'center' };
}
