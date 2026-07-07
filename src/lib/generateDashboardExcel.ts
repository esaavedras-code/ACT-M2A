import ExcelJS from 'exceljs';
import { supabase } from './supabase';
import { formatDate, formatCurrency, roundedAmt, getFederalSharePct } from './utils';

// @UNIFICATION_RESUMEN_PACT
import { fetchProjectSummary } from './projectSummary';
// @UNIFICATION_RESUMEN_PACT_END

export async function generateDashboardExcel(projectId: string): Promise<Blob> {
    const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single();
    const { data: items } = await supabase.from('contract_items').select('*').eq('project_id', projectId);
    const { data: chos } = await supabase.from('chos').select('*').eq('project_id', projectId);
    const { data: certs } = await supabase.from('payment_certifications').select('*').eq('project_id', projectId).order('cert_num', { ascending: true });
    const { data: contractor } = await supabase.from('contractors').select('*').eq('project_id', projectId).maybeSingle();
    const { data: personnel } = await supabase.from('act_personnel').select('*').eq('project_id', projectId);

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
    // @UNIFICATION_RESUMEN_PACT
    const { metrics } = await fetchProjectSummary(projectId);

    const originalCost = metrics.cost.original;
    const approvedCHOAmount = metrics.chos.approvedTotal;
    const totalRevisedCost = metrics.cost.revisedTotal;

    const actProjected = metrics.cost.actProjected;
    const fhwaProjected = metrics.cost.fhwaProjected;

    const actTotal = metrics.cost.actTotal;
    const fhwaTotal = metrics.cost.fhwaTotal;

    const mosTotal = metrics.cost.materialOnSite;
    const totalCertified = metrics.cost.certTotal;
    const percentObra = metrics.cost.percentObra;

    const totalDays = metrics.time.total;
    const approvedDays = metrics.chos.approvedDays;
    const revisedDays = metrics.time.revised;

    const usedDays = metrics.time.used;
    const percentTime = metrics.time.percent;
    const adminDateStr = metrics.dates.administrative;

    const liqDamages = metrics.penalties.liquidated;
    const totalRetentionNet = metrics.retention.total;

    const totalRetentionDeducted = metrics.retention.fivePercent;
    const totalRetentionReturned = metrics.retention.returned;

    const pendingAmount = metrics.chos.pendingTotal;
    const pendingDays = metrics.chos.pendingDays;
    const totalCHOsDays = metrics.chos.totalDays;
    const totalCHOsAmount = metrics.chos.total;

    const totalItemsCount = metrics.liquidation.totalItems;
    const adminCount = metrics.liquidation.adminSignedCount;
    const contractorCount = metrics.liquidation.contractorSignedCount;
    const liquidatorCount = metrics.liquidation.liquidatorSignedCount;
    const liqPercent = metrics.liquidation.percent;
    const federalDocs = metrics.liquidation.federalDocs;
    // @UNIFICATION_RESUMEN_PACT_END

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
    // Tiempos (Izquierda)
    worksheet.mergeCells(`B${currentRow}:C${currentRow}`);
    const sec1 = worksheet.getCell(`B${currentRow}`);
    sec1.value = ' FECHAS CLAVE Y TIEMPOS';
    sec1.style = sectionHeaderStyle;
    sec1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.accent } };

    currentRow++;
    addMetricRow(worksheet, currentRow++, 'Fecha de Comienzo', formatDate(project.date_project_start), labelStyle, valueStyle);
    addMetricRow(worksheet, currentRow++, 'Terminación Original', formatDate(project.date_orig_completion), labelStyle, valueStyle);
    addMetricRow(worksheet, currentRow++, 'Terminación Revisada', formatDate(project.date_rev_completion), labelStyle, { ...boldValueStyle, font: { ...boldValueStyle.font, color: { argb: colors.accent } } });
    addMetricRow(worksheet, currentRow++, 'Terminación Sustancial', formatDate(project.date_substantial_completion), labelStyle, valueStyle);
    addMetricRow(worksheet, currentRow++, 'Terminación Administrativa', formatDate(adminDateStr), labelStyle, { ...boldValueStyle, font: { ...boldValueStyle.font, color: { argb: 'FF92400E' } } });
    addMetricRow(worksheet, currentRow++, 'FMIS End Date', formatDate(project.fmis_end_date), labelStyle, { ...boldValueStyle, font: { ...boldValueStyle.font, color: { argb: 'FF065F46' } } });
    addMetricRow(worksheet, currentRow++, 'Días de Contrato Original', `${totalDays} días`, labelStyle, valueStyle);
    addMetricRow(worksheet, currentRow++, 'Extensiones Aprobadas (CHO)', `${approvedDays} días`, labelStyle, valueStyle);
    addMetricRow(worksheet, currentRow++, 'Días Totales Revisados', `${revisedDays} días`, labelStyle, boldValueStyle);
    addMetricRow(worksheet, currentRow++, 'Tiempo Transcurrido', `${usedDays} días`, labelStyle, valueStyle);
    addMetricRow(worksheet, currentRow++, 'Balance de Días', `${revisedDays - usedDays} días`, labelStyle, { ...boldValueStyle, font: { ...boldValueStyle.font, color: { argb: (revisedDays - usedDays < 0 ? colors.danger : colors.success) } } });

    // Costos (Derecha)
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
    addMetricRowRight(worksheet, sideRow++, '% Obra Ejecutada', `${percentObra}%`, labelStyle, { ...boldValueStyle, font: { ...boldValueStyle.font, size: 12, color: { argb: colors.success } } });
    addMetricRowRight(worksheet, sideRow++, '% Tiempo Transcurrido', `${percentTime}%`, labelStyle, { ...boldValueStyle, font: { ...boldValueStyle.font, size: 12, color: { argb: colors.accent } } });
    addMetricRowRight(worksheet, sideRow++, 'Fondo FHWA (Cert. / Proy.)', `${formatCurrency(fhwaTotal)} / ${formatCurrency(fhwaProjected)}`, labelStyle, valueStyle);
    addMetricRowRight(worksheet, sideRow++, 'Fondo ACT (Cert. / Proy.)', `${formatCurrency(actTotal)} / ${formatCurrency(actProjected)}`, labelStyle, valueStyle);
    addMetricRowRight(worksheet, sideRow++, 'Material en Sitio (MOS)', formatCurrency(mosTotal), labelStyle, { ...boldValueStyle, font: { ...boldValueStyle.font, color: { argb: 'FFB45309' } } });

    currentRow = Math.max(currentRow, sideRow) + 2;
    // CHOs (Izquierda)
    worksheet.mergeCells(`B${currentRow}:C${currentRow}`);
    const sec3 = worksheet.getCell(`B${currentRow}`);
    sec3.value = ' ÓRDENES DE CAMBIO (CHO)';
    sec3.style = sectionHeaderStyle;
    sec3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.warning } };

    const choStartRow = currentRow;
    currentRow++;
    addMetricRow(worksheet, currentRow++, 'CHOs Aprobadas (#)', approvedCHOs.length, labelStyle, valueStyle);
    addMetricRow(worksheet, currentRow++, 'CHOs En Trámite (#)', pendingCHOs.length, labelStyle, valueStyle);
    addMetricRow(worksheet, currentRow++, 'Días Otorgados Aprobados', `${approvedDays} días`, labelStyle, valueStyle);
    addMetricRow(worksheet, currentRow++, 'Días Otorgados En Trámite', `${pendingDays} días`, labelStyle, valueStyle);
    addMetricRow(worksheet, currentRow++, 'Días Otorgados Totales', `${totalCHOsDays} días`, labelStyle, boldValueStyle);
    addMetricRow(worksheet, currentRow++, 'Monto Aprobado ($)', formatCurrency(approvedCHOAmount), labelStyle, valueStyle);
    addMetricRow(worksheet, currentRow++, 'Monto En Trámite ($)', formatCurrency(pendingAmount), labelStyle, valueStyle);
    addMetricRow(worksheet, currentRow++, 'Monto Total CHOs ($)', formatCurrency(totalCHOsAmount), labelStyle, boldValueStyle);
    addMetricRow(worksheet, currentRow++, '% de Cambio (Costo)', `${originalCost > 0 ? roundedAmt((approvedCHOAmount / originalCost) * 100, 2) : 0}%`, labelStyle, boldValueStyle);
    addMetricRow(worksheet, currentRow++, '% de Cambio (Días)', `${totalDays > 0 ? roundedAmt((approvedDays / totalDays) * 100, 2) : 0}%`, labelStyle, boldValueStyle);

    // Retenciones (Derecha)
    sideRow = choStartRow;
    worksheet.mergeCells(`E${sideRow}:F${sideRow}`);
    const sec4 = worksheet.getCell(`E${sideRow}`);
    sec4.value = ' RETENCIONES Y PENALIDADES';
    sec4.style = sectionHeaderStyle;
    sec4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.violet } };

    sideRow++;
    addMetricRowRight(worksheet, sideRow++, 'Retención 5% Bruta', formatCurrency(totalRetentionDeducted), labelStyle, valueStyle);
    addMetricRowRight(worksheet, sideRow++, 'Ajuste de Precio', formatCurrency(totalPriceAdjustment), labelStyle, valueStyle);
    addMetricRowRight(worksheet, sideRow++, 'Multas Seguro', formatCurrency(totalInsuranceFines), labelStyle, valueStyle);
    addMetricRowRight(worksheet, sideRow++, 'Otras Penalidades', formatCurrency(totalOtherPenalties), labelStyle, valueStyle);
    addMetricRowRight(worksheet, sideRow++, 'Reembolso de Retención', formatCurrency(totalRetentionReturned), labelStyle, valueStyle);
    addMetricRowRight(worksheet, sideRow++, 'Daños Líquidos (Dlq) Acum.', formatCurrency(liqDamages), labelStyle, valueStyle);
    addMetricRowRight(worksheet, sideRow++, 'Total Retenido/Deducido (Neto)', formatCurrency(totalRetentionNet), labelStyle, { ...boldValueStyle, font: { ...boldValueStyle.font, color: { argb: colors.violet } } });

    currentRow = Math.max(currentRow, sideRow) + 2;
    // Liquidación (Izquierda)
    worksheet.mergeCells(`B${currentRow}:C${currentRow}`);
    const sec5 = worksheet.getCell(`B${currentRow}`);
    sec5.value = ' LIQUIDACIÓN (FINAL ACCEPTANCE)';
    sec5.style = sectionHeaderStyle;
    sec5.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.success } };

    const liqStartRow = currentRow;
    currentRow++;
    addMetricRow(worksheet, currentRow++, 'Partidas del Proyecto (#)', totalItemsCount, labelStyle, valueStyle);
    addMetricRow(worksheet, currentRow++, 'Cierres de Administrador', adminCount, labelStyle, valueStyle);
    addMetricRow(worksheet, currentRow++, 'Cierres de Contratista', contractorCount, labelStyle, valueStyle);
    addMetricRow(worksheet, currentRow++, 'Cierres de Liquidador', liquidatorCount, labelStyle, valueStyle);
    addMetricRow(worksheet, currentRow++, '% Firmas Recolectadas', `${liqPercent}%`, labelStyle, { ...boldValueStyle, font: { ...boldValueStyle.font, color: { argb: colors.success } } });
    if (federalDocs.length > 0) {
        addMetricRow(worksheet, currentRow++, 'Docs de Cierre Recibidos', federalDocs.join(', '), labelStyle, { ...valueStyle, alignment: { horizontal: 'right', wrapText: true } });
    }

    // Contratista (Derecha)
    sideRow = liqStartRow;
    worksheet.mergeCells(`E${sideRow}:F${sideRow}`);
    const sec6 = worksheet.getCell(`E${sideRow}`);
    sec6.value = ' CONTRATISTA';
    sec6.style = sectionHeaderStyle;
    sec6.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.secondary } };

    sideRow++;
    addMetricRowRight(worksheet, sideRow++, 'Nombre Empresa', contractor?.name || 'N/A', labelStyle, valueStyle);
    addMetricRowRight(worksheet, sideRow++, 'Seguro Social Patronal', (function(ss){
        if(!ss) return 'N/A';
        const digits = ss.replace(/\D/g, '');
        if(digits.length >= 9) return `${digits.slice(0,3)}-${digits.slice(3,5)}-${digits.slice(5,7)}-${digits.slice(7)}`;
        return ss;
    })(contractor?.ss_patronal), labelStyle, valueStyle);
    addMetricRowRight(worksheet, sideRow++, 'Representante Autorizado', contractor?.representative || 'N/A', labelStyle, valueStyle);
    addMetricRowRight(worksheet, sideRow++, 'Email de Contacto', contractor?.email || 'N/A', labelStyle, valueStyle);
    addMetricRowRight(worksheet, sideRow++, 'Teléfono Oficina', contractor?.phone_office || 'N/A', labelStyle, valueStyle);
    addMetricRowRight(worksheet, sideRow++, 'Teléfono Celular', contractor?.phone_mobile || 'N/A', labelStyle, valueStyle);

    currentRow = Math.max(currentRow, sideRow) + 2;

    // Personal ACT Asignado (Ancho Completo)
    if (personnel && personnel.length > 0) {
        worksheet.mergeCells(`B${currentRow}:F${currentRow}`);
        const sec7 = worksheet.getCell(`B${currentRow}`);
        sec7.value = ' PERSONAL ACT RESPONSABLE';
        sec7.style = {
            ...sectionHeaderStyle,
            alignment: { horizontal: 'center', vertical: 'middle' }
        };
        sec7.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.primary } };

        currentRow++;
        // Cabeceras de tabla
        const headerStyle: Partial<ExcelJS.Style> = {
            font: { name: 'Arial', size: 10, bold: true, color: { argb: colors.white } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.secondary } },
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: {
                bottom: { style: 'thin', color: { argb: colors.primary } },
                top: { style: 'thin', color: { argb: colors.primary } },
                left: { style: 'thin', color: { argb: colors.primary } },
                right: { style: 'thin', color: { argb: colors.primary } }
            }
        };

        const h1 = worksheet.getCell(`B${currentRow}`); h1.value = 'Rol / Puesto'; h1.style = headerStyle;
        const h2 = worksheet.getCell(`C${currentRow}`); h2.value = 'Nombre'; h2.style = headerStyle;
        worksheet.mergeCells(`D${currentRow}:E${currentRow}`);
        const h3 = worksheet.getCell(`D${currentRow}`); h3.value = 'Contacto'; h3.style = headerStyle;
        const h4 = worksheet.getCell(`F${currentRow}`); h4.style = headerStyle;

        currentRow++;

        const pRowStyle: Partial<ExcelJS.Style> = {
            font: { name: 'Arial', size: 10 },
            alignment: { horizontal: 'left', vertical: 'middle' },
            border: {
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            }
        };

        personnel.forEach(p => {
            const cell1 = worksheet.getCell(`B${currentRow}`); cell1.value = p.role; cell1.style = pRowStyle;
            const cell2 = worksheet.getCell(`C${currentRow}`); cell2.value = p.name || 'N/A'; cell2.style = { ...pRowStyle, alignment: { horizontal: 'center' } };
            worksheet.mergeCells(`D${currentRow}:E${currentRow}`);
            const cell3 = worksheet.getCell(`D${currentRow}`); cell3.value = p.phone_mobile || p.email || 'N/A'; cell3.style = pRowStyle;
            const cell4 = worksheet.getCell(`F${currentRow}`); cell4.style = pRowStyle;
            currentRow++;
        });
        currentRow++;
    }

    currentRow += 2;
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
