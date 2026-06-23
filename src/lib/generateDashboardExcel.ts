import ExcelJS from 'exceljs';
import { supabase } from './supabase';
import { formatDate, formatCurrency, roundedAmt, getFederalSharePct } from './utils';

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
    const originalCost = project.cost_original || items?.reduce((acc, item) => roundedAmt(acc + roundedAmt(item.quantity * item.unit_price, 2), 2), 0) || 0;
    const approvedCHOs = chos?.filter(c => c.doc_status === 'Aprobado') || [];
    const approvedCHOAmount = approvedCHOs.reduce((acc, c) => roundedAmt(acc + parseFloat(c.proposed_change || '0'), 2), 0);
    const totalRevisedCost = originalCost + approvedCHOAmount;

    // Fondos Proyectados
    let actProjected = 0;
    let fhwaProjected = 0;

    items?.forEach((item: any) => {
        const amount = roundedAmt((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0), 2);
        if (item.fund_source?.includes('ACT')) {
            actProjected = roundedAmt(actProjected + amount, 2);
        } else if (item.fund_source?.includes('FHWA')) {
            fhwaProjected = roundedAmt(fhwaProjected + amount, 2);
        }
    });

    chos?.forEach((cho: any) => {
        if (cho.items && Array.isArray(cho.items)) {
            cho.items.forEach((item: any) => {
                const amount = roundedAmt((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0), 2);
                if (item.fund_source?.includes('ACT')) {
                    actProjected = roundedAmt(actProjected + amount, 2);
                } else if (item.fund_source?.includes('FHWA')) {
                    fhwaProjected = roundedAmt(fhwaProjected + amount, 2);
                }
            });
        }
    });

    // Fondos Certificados y Retenciones
    let actTotal = 0, fhwaTotal = 0;
    let totalRetentionDeducted = 0;
    let totalRetentionReturned = 0;
    let totalExtraRetention = 0;
    let totalPriceAdjustment = 0;
    let totalInsuranceFines = 0;
    let totalOtherPenalties = 0;
    let totalRefund = 0;

    const getInvoicePU = (certsList: any[], itemNum: string, currentCertIdx: number) => {
        for (let i = currentCertIdx; i >= 0; i--) {
            if (!certsList[i]) continue;
            const its = Array.isArray(certsList[i].items) ? certsList[i].items : (certsList[i].items?.list || []);
            const match = its.find((itx: any) => itx.item_num === itemNum && itx.has_material_on_site && parseFloat(itx.mos_unit_price) > 0);
            if (match) return parseFloat(match.mos_unit_price);
        }
        return 0;
    };

    const perItemMosBalance: Record<string, number> = {};

    certs?.forEach((cert, cIdx) => {
        const certItems = Array.isArray(cert.items) ? cert.items : (cert.items?.list || []);
        certItems.forEach((item: any) => {
            const itemNum = item.item_num;
            if (!itemNum) return;

            const qty = parseFloat(item.quantity) || 0;
            const up = parseFloat(item.unit_price) || 0;
            const amount = roundedAmt(qty * up, 2);
            
            const fedPct = getFederalSharePct(project, item);
            const fShare = roundedAmt(amount * (fedPct / 100), 2);
            fhwaTotal = roundedAmt(fhwaTotal + fShare, 2);
            actTotal = roundedAmt(actTotal + (amount - fShare), 2);

            const manualDeductionQty = parseFloat(item.qty_from_mos) || 0;
            const hasAddition = !!item.has_material_on_site || (item.mos_invoice_total && parseFloat(item.mos_invoice_total) > 0);
            
            const currentBalance = perItemMosBalance[itemNum] || 0;
            const mosPU = getInvoicePU(certs || [], itemNum, cIdx);
            const price = mosPU > 0 ? mosPU : up;

            // Incluir la adición de esta misma cert al balance disponible para deducción
            const additionCostThisCert = hasAddition ? (parseFloat(item.mos_invoice_total) || 0) : 0;
            const balanceForDeduction = currentBalance + additionCostThisCert;
            
            let deductionQty = 0;
            if (balanceForDeduction > 0.01) {
                const availableQty = balanceForDeduction / (price || 1);
                if (manualDeductionQty > 0) {
                    deductionQty = Math.min(manualDeductionQty, availableQty);
                } else if (qty > 0) {
                    deductionQty = Math.min(qty, availableQty);
                }
            }

            if (hasAddition) {
                const cost = parseFloat(item.mos_invoice_total) || 0;
                perItemMosBalance[itemNum] = roundedAmt(currentBalance + cost, 2);
            }

            if (deductionQty > 0) {
                const cost = roundedAmt(deductionQty * price, 2);
                const newBal = roundedAmt((perItemMosBalance[itemNum] || 0) - cost, 2);
                perItemMosBalance[itemNum] = Math.max(0, newBal);
            }
        });

        if (!cert.skip_retention) {
            certItems.forEach((item: any) => {
                if (!item.skip_retention) {
                    const itemAmt = roundedAmt((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0), 2);
                    totalRetentionDeducted = roundedAmt(totalRetentionDeducted + roundedAmt(itemAmt * 0.05, 2), 2);
                }
            });
        }
        if (cert.show_retention_return && cert.retention_return_amount) {
            totalRetentionReturned = roundedAmt(totalRetentionReturned + (parseFloat(cert.retention_return_amount) || 0), 2);
        }

        totalExtraRetention = roundedAmt(totalExtraRetention + (parseFloat(cert.extra_retention) || 0), 2);
        totalPriceAdjustment = roundedAmt(totalPriceAdjustment + (parseFloat(cert.price_adjustment) || 0), 2);
        totalInsuranceFines = roundedAmt(totalInsuranceFines + (parseFloat(cert.insurance_fines) || 0), 2);
        totalOtherPenalties = roundedAmt(totalOtherPenalties + (parseFloat(cert.other_penalties) || 0), 2);
        totalRefund = roundedAmt(totalRefund + (parseFloat(cert.refund) || 0), 2);
    });

    const mosTotal = roundedAmt(Object.values(perItemMosBalance).reduce((acc, balance) => roundedAmt(acc + balance, 2), 0), 2);
    const totalCertified = actTotal + fhwaTotal;
    const percentObra = totalRevisedCost > 0 ? roundedAmt((totalCertified / totalRevisedCost) * 100, 2) : 0;

    // Fechas y Tiempos
    const startDate = project.date_project_start ? new Date(project.date_project_start + "T00:00:00") : null;
    const origEndDate = project.date_orig_completion ? new Date(project.date_orig_completion + "T23:59:59") : null;
    const approvedDays = approvedCHOs.reduce((acc, c) => acc + (c.time_extension_days || 0), 0);
    
    let totalDays = 0;
    if (startDate && origEndDate) {
        totalDays = Math.ceil((origEndDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
    }
    const revisedDays = totalDays + approvedDays;

    let timeEndDate = new Date();
    if (project.date_substantial_completion) timeEndDate = new Date(project.date_substantial_completion + "T23:59:59");
    else if (project.date_real_completion) timeEndDate = new Date(project.date_real_completion + "T23:59:59");

    let usedDays = 0;
    if (startDate) {
        usedDays = Math.ceil((timeEndDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
    }
    if (usedDays < 0) usedDays = 0;
    const percentTime = revisedDays > 0 ? roundedAmt((usedDays / revisedDays) * 100, 2) : 0;

    let adminDateStr = "";
    const baseAdminDate = project.date_rev_completion || project.date_orig_completion;
    if (baseAdminDate) {
        const revDate = new Date(baseAdminDate + "T23:59:59");
        if (!isNaN(revDate.getTime())) {
            revDate.setFullYear(revDate.getFullYear() + 2);
            adminDateStr = revDate.toISOString().split("T")[0];
        }
    }

    const damAmt = parseFloat(project.liquidated_damages_amount || "500");
    const liqDamages = Math.max(0, (usedDays - revisedDays) * damAmt);
    const totalRetentionNet = roundedAmt(totalRetentionDeducted - totalRetentionReturned + totalExtraRetention + totalInsuranceFines + totalOtherPenalties - totalPriceAdjustment - totalRefund, 2);

    // CHOs en Trámite y totales
    const pendingCHOs = chos?.filter(c => c.doc_status === 'En trámite') || [];
    const pendingAmount = pendingCHOs.reduce((acc, c) => roundedAmt(acc + parseFloat(c.proposed_change || '0'), 2), 0);
    const pendingDays = pendingCHOs.reduce((acc, c) => acc + (c.time_extension_days || 0), 0);
    const totalCHOsDays = approvedDays + pendingDays;
    const totalCHOsAmount = approvedCHOAmount + pendingAmount;

    // Liquidación
    const totalItemsCount = items?.length || 0;
    const adminCount = project.liquidation_data?.admin_signed_count || 0;
    const contractorCount = project.liquidation_data?.contractor_signed_count || 0;
    const liquidatorCount = project.liquidation_data?.liquidator_signed_count || 0;
    const totalSigned = adminCount + contractorCount + liquidatorCount;
    const liqPercent = totalItemsCount > 0 ? Math.round((totalSigned / (totalItemsCount * 3)) * 100) : 0;
    const federalDocs = project.liquidation_data?.federal_docs || [];

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
