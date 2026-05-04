import ExcelJS from 'exceljs';
import { supabase } from './supabase';
import { formatDate, formatCurrency, roundedAmt, getFederalSharePct } from './utils';

export async function generateDashboardExcel(projectId: string): Promise<Blob> {
    const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single();
    const { data: items } = await supabase.from('contract_items').select('*').eq('project_id', projectId);
    const { data: chos } = await supabase.from('chos').select('*').eq('project_id', projectId);
    const { data: certs } = await supabase.from('payment_certifications').select('*').eq('project_id', projectId).order('cert_num', { ascending: true });
    
    if (!project) throw new Error("Proyecto no encontrado");

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Dashboard Ejecutivo');

    // --- CONFIGURACIÓN DE COLUMNAS ---
    worksheet.columns = [
        { width: 4 },   // A: Margen
        { width: 40 },  // B: Etiqueta
        { width: 30 },  // C: Valor
        { width: 6 },   // D: Espacio
        { width: 40 },  // E: Etiqueta 2
        { width: 30 },  // F: Valor 2
        { width: 4 }    // G: Margen
    ];

    // --- ESTILOS ---
    const colors = {
        primary: 'FF1E293B',    // Slate 800
        secondary: 'FF334155',  // Slate 700
        accent: 'FF3B82F6',     // Blue 500
        success: 'FF10B981',    // Emerald 500
        warning: 'FFF59E0B',    // Amber 500
        danger: 'FFEF4444',     // Red 500
        violet: 'FF8B5CF6',     // Violet 500
        lightBg: 'FFF8FAFC',    // Slate 50
        white: 'FFFFFFFF'
    };

    const titleStyle: Partial<ExcelJS.Style> = {
        font: { name: 'Arial', size: 20, bold: true, color: { argb: colors.white } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.primary } },
        alignment: { horizontal: 'center', vertical: 'middle' }
    };

    const sectionHeaderStyle: Partial<ExcelJS.Style> = {
        font: { name: 'Arial', size: 12, bold: true, color: { argb: colors.white } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.secondary } },
        alignment: { horizontal: 'left', vertical: 'middle' },
        border: { bottom: { style: 'medium', color: { argb: colors.accent } } }
    };

    const labelStyle: Partial<ExcelJS.Style> = {
        font: { name: 'Arial', size: 11, bold: true, color: { argb: 'FF475569' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.lightBg } },
        alignment: { horizontal: 'left', vertical: 'middle' },
        border: { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } }
    };

    const valueStyle: Partial<ExcelJS.Style> = {
        font: { name: 'Arial', size: 11, bold: false },
        alignment: { horizontal: 'right', vertical: 'middle' },
        border: { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } }
    };

    const boldValueStyle: Partial<ExcelJS.Style> = {
        ...valueStyle,
        font: { ...valueStyle.font, bold: true, size: 11 }
    };

    // --- CÁLCULOS DE MÉTRICAS ---
    const originalCost = project.cost_original || items?.reduce((acc, item) => roundedAmt(acc + roundedAmt(item.quantity * item.unit_price, 2), 2), 0) || 0;
    const approvedCHOs = chos?.filter(c => c.doc_status === 'Aprobado') || [];
    const approvedCHOAmount = approvedCHOs.reduce((acc, c) => roundedAmt(acc + parseFloat(c.proposed_change || '0'), 2), 0);
    const totalRevisedCost = originalCost + approvedCHOAmount;
    
    let actTotal = 0, fhwaTotal = 0;
    certs?.forEach(cert => {
        const certItems = Array.isArray(cert.items) ? cert.items : (cert.items?.list || []);
        certItems.forEach((item: any) => {
            const amount = roundedAmt((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0), 2);
            const fedPct = getFederalSharePct(project, item);
            const fShare = roundedAmt(amount * (fedPct / 100), 2);
            fhwaTotal = roundedAmt(fhwaTotal + fShare, 2);
            actTotal = roundedAmt(actTotal + (amount - fShare), 2);
        });
    });
    const totalCertified = actTotal + fhwaTotal;
    const percentObra = totalRevisedCost > 0 ? roundedAmt((totalCertified / totalRevisedCost) * 100, 2) : 0;

    const startDate = project.date_project_start ? new Date(project.date_project_start + "T00:00:00") : null;
    const origEndDate = project.date_orig_completion ? new Date(project.date_orig_completion + "T23:59:59") : null;
    const approvedDays = approvedCHOs.reduce((acc, c) => acc + (c.time_extension_days || 0), 0);
    let totalDays = 0;
    if (startDate && origEndDate) {
        totalDays = Math.ceil((origEndDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
    }
    const revisedDays = totalDays + approvedDays;
    let usedDays = 0;
    if (startDate) {
        const end = project.date_substantial_completion ? new Date(project.date_substantial_completion + "T23:59:59") : new Date();
        usedDays = Math.ceil((end.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
    }
    if (usedDays < 0) usedDays = 0;
    const percentTime = revisedDays > 0 ? roundedAmt((usedDays / revisedDays) * 100, 2) : 0;

    // --- CONSTRUCCIÓN ---
    worksheet.mergeCells('B2:F4');
    const mainTitle = worksheet.getCell('B2');
    mainTitle.value = 'DASHBOARD EJECUTIVO DE PROYECTO';
    mainTitle.style = titleStyle;

    worksheet.mergeCells('B5:F5');
    const projInfo = worksheet.getCell('B5');
    projInfo.value = `${project.name} | ACT: ${project.num_act} | FED: ${project.num_federal || 'N/A'}`;
    projInfo.style = {
        font: { italic: true, size: 12, color: { argb: 'FF64748B' } },
        alignment: { horizontal: 'center' }
    };

    let currentRow = 7;
    // Tiempos
    worksheet.mergeCells(`B${currentRow}:C${currentRow}`);
    const sec1 = worksheet.getCell(`B${currentRow}`);
    sec1.value = ' FECHAS CLAVE Y TIEMPOS';
    sec1.style = sectionHeaderStyle;
    sec1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.accent } };

    currentRow++;
    addMetricRow(worksheet, currentRow++, 'Fecha de Comienzo', formatDate(project.date_project_start), labelStyle, valueStyle);
    addMetricRow(worksheet, currentRow++, 'Terminación Original', formatDate(project.date_orig_completion), labelStyle, valueStyle);
    addMetricRow(worksheet, currentRow++, 'Terminación Revisada', formatDate(project.date_rev_completion), labelStyle, { ...boldValueStyle, font: { ...boldValueStyle.font, color: { argb: colors.accent } } });
    addMetricRow(worksheet, currentRow++, 'Días de Contrato Original', `${totalDays} días`, labelStyle, valueStyle);
    addMetricRow(worksheet, currentRow++, 'Extensiones Aprobadas (CHO)', `${approvedDays} días`, labelStyle, valueStyle);
    addMetricRow(worksheet, currentRow++, 'Días Totales Revisados', `${revisedDays} días`, labelStyle, boldValueStyle);
    addMetricRow(worksheet, currentRow++, 'Tiempo Transcurrido', `${usedDays} días`, labelStyle, valueStyle);
    addMetricRow(worksheet, currentRow++, 'Balance de Días', `${revisedDays - usedDays} días`, labelStyle, { ...boldValueStyle, font: { ...boldValueStyle.font, color: { argb: (revisedDays - usedDays < 0 ? colors.danger : colors.success) } } });

    // Costos
    let sideRow = 7;
    worksheet.mergeCells(`E${sideRow}:F${sideRow}`);
    const sec2 = worksheet.getCell(`E${sideRow}`);
    sec2.value = ' RESUMEN FINANCIERO';
    sec2.style = sectionHeaderStyle;
    sec2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.success } };

    sideRow++;
    addMetricRowRight(worksheet, sideRow++, 'Costo Original', formatCurrency(originalCost), labelStyle, valueStyle);
    addMetricRowRight(worksheet, sideRow++, 'Órdenes de Cambio Aprobadas', formatCurrency(approvedCHOAmount), labelStyle, valueStyle);
    addMetricRowRight(worksheet, sideRow++, 'Costo Ajustado Total', formatCurrency(totalRevisedCost), labelStyle, { ...boldValueStyle, font: { ...boldValueStyle.font, color: { argb: colors.success } } });
    addMetricRowRight(worksheet, sideRow++, 'Total Certificado a la Fecha', formatCurrency(totalCertified), labelStyle, valueStyle);
    addMetricRowRight(worksheet, sideRow++, 'Balance por Certificar', formatCurrency(totalRevisedCost - totalCertified), labelStyle, boldValueStyle);
    addMetricRowRight(worksheet, sideRow++, '% Obra Ejecutada', `${percentObra}%`, labelStyle, { ...boldValueStyle, font: { ...boldValueStyle.font, size: 14, color: { argb: colors.success } } });
    addMetricRowRight(worksheet, sideRow++, '% Tiempo Transcurrido', `${percentTime}%`, labelStyle, { ...boldValueStyle, font: { ...boldValueStyle.font, size: 14, color: { argb: colors.accent } } });

    currentRow = Math.max(currentRow, sideRow) + 2;
    // CHOs
    worksheet.mergeCells(`B${currentRow}:C${currentRow}`);
    const sec3 = worksheet.getCell(`B${currentRow}`);
    sec3.value = ' ÓRDENES DE CAMBIO (CHO)';
    sec3.style = sectionHeaderStyle;
    sec3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.warning } };

    currentRow++;
    const pendingCHOs = chos?.filter(c => c.doc_status === 'En trámite') || [];
    const pendingAmount = pendingCHOs.reduce((acc, c) => roundedAmt(acc + parseFloat(c.proposed_change || '0'), 2), 0);
    addMetricRow(worksheet, currentRow++, 'CHOs Aprobadas (#)', approvedCHOs.length, labelStyle, valueStyle);
    addMetricRow(worksheet, currentRow++, 'CHOs En Trámite (#)', pendingCHOs.length, labelStyle, valueStyle);
    addMetricRow(worksheet, currentRow++, 'Monto Aprobado ($)', formatCurrency(approvedCHOAmount), labelStyle, valueStyle);
    addMetricRow(worksheet, currentRow++, 'Monto En Trámite ($)', formatCurrency(pendingAmount), labelStyle, valueStyle);
    addMetricRow(worksheet, currentRow++, '% de Cambio (Costo)', `${originalCost > 0 ? roundedAmt((approvedCHOAmount / originalCost) * 100, 2) : 0}%`, labelStyle, boldValueStyle);

    // Retenciones
    sideRow = currentRow - 5;
    worksheet.mergeCells(`E${sideRow}:F${sideRow}`);
    const sec4 = worksheet.getCell(`E${sideRow}`);
    sec4.value = ' RETENCIONES Y PENALIDADES';
    sec4.style = sectionHeaderStyle;
    sec4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.violet } };

    sideRow++;
    let totalRetention = 0, totalPenalty = 0;
    certs?.forEach(c => {
        totalRetention += (parseFloat(c.retention_amount) || 0) - (parseFloat(c.retention_return_amount) || 0);
        totalPenalty += (parseFloat(c.insurance_fines) || 0) + (parseFloat(c.other_penalties) || 0) + (parseFloat(c.liquidated_damages) || 0);
    });
    addMetricRowRight(worksheet, sideRow++, 'Retención 5% Neta', formatCurrency(totalRetention), labelStyle, valueStyle);
    addMetricRowRight(worksheet, sideRow++, 'Daños Líquidos Acum.', formatCurrency(totalPenalty), labelStyle, valueStyle);
    addMetricRowRight(worksheet, sideRow++, 'Total Retenido/Deducido', formatCurrency(totalRetention + totalPenalty), labelStyle, { ...boldValueStyle, font: { ...boldValueStyle.font, color: { argb: colors.violet } } });

    currentRow = Math.max(currentRow, sideRow) + 4;
    worksheet.mergeCells(`B${currentRow}:F${currentRow}`);
    const designerCell = worksheet.getCell(`B${currentRow}`);
    designerCell.value = `Diseñador: Ing. Enrique Saavedra Sada, PE`;
    designerCell.style = { font: { size: 11, bold: true, color: { argb: colors.primary } }, alignment: { horizontal: 'center' } };

    currentRow++;
    worksheet.mergeCells(`B${currentRow}:F${currentRow}`);
    const aboutCell = worksheet.getCell(`B${currentRow}`);
    aboutCell.value = `Reporte generado automáticamente por PACT el ${formatDate(new Date())}`;
    aboutCell.style = { font: { size: 10, italic: true }, alignment: { horizontal: 'center' } };

    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function addMetricRow(ws: ExcelJS.Worksheet, row: number, label: string, value: any, lStyle: any, vStyle: any) {
    const c1 = ws.getCell(`B${row}`); c1.value = label; c1.style = lStyle;
    const c2 = ws.getCell(`C${row}`); c2.value = value; c2.style = vStyle;
}
function addMetricRowRight(ws: ExcelJS.Worksheet, row: number, label: string, value: any, lStyle: any, vStyle: any) {
    const c1 = ws.getCell(`E${row}`); c1.value = label; c1.style = lStyle;
    const c2 = ws.getCell(`F${row}`); c2.value = value; c2.style = vStyle;
}
