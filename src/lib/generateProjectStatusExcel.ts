import ExcelJS from 'exceljs';
import { supabase } from './supabase';
import { roundedAmt, formatDate, getFederalSharePct, formatProjectNumber } from './utils';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtCur(val: number): string {
    if (val === null || val === undefined || isNaN(val)) return '$0.00';
    const abs = Math.abs(val);
    const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(abs);
    return val < 0 ? `(${formatted})` : formatted;
}

function fmtNum(val: number, dec = 3): string {
    if (val === null || val === undefined || isNaN(val)) return '0.000';
    return val.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr + (dateStr.length === 10 ? 'T12:00:00' : ''));
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    } catch {
        return dateStr;
    }
}

// ─── Colores PACT ────────────────────────────────────────────────────────────

const C = {
    pactBlue:    'FF0056B3',   // #0056b3 — Azul principal PACT
    pactDark:    'FF004494',   // #004494 — Azul oscuro PACT
    pactLight:   'FFD6E4F7',   // Azul claro (fondo secciones)
    pactMid:     'FF2970C7',   // Azul medio (subtotales)
    white:       'FFFFFFFF',
    offWhite:    'FFF0F7FF',   // Fondo alternado filas
    headerText:  'FF1A2B45',   // Texto encabezado
    borderGray:  'FFB8D0EA',   // Borde
    total:       'FFE8F0FB',   // Fondo fila total
    red:         'FFDC2626',   // Rojo para valores negativos
    green:       'FF15803D',   // Verde para balances positivos
    gray:        'FF64748B',
};

const FONT_BASE = 'Arial';

// ─── Función principal ────────────────────────────────────────────────────────

export async function generateProjectStatusExcel(projectId: string): Promise<Blob> {
    // ── Carga de datos ─────────────────────────────────────────────────────
    const { data: project } = await supabase
        .from('projects').select('*').eq('id', projectId).single();
    if (!project) throw new Error('Proyecto no encontrado');

    const { data: items } = await supabase
        .from('contract_items').select('*').eq('project_id', projectId);

    const { data: chos } = await supabase
        .from('chos').select('*').eq('project_id', projectId).order('cho_num');

    const { data: certs } = await supabase
        .from('payment_certifications').select('*').eq('project_id', projectId)
        .order('cert_num', { ascending: true });

    const allItems = (items || []).sort((a, b) => {
        return (a.item_num || '').localeCompare(b.item_num || '', undefined, { numeric: true, sensitivity: 'base' });
    });
    const allChos  = chos  || [];
    const allCerts = certs || [];

    // ── Cálculos financieros ──────────────────────────────────────────────
    const originalCost = project.cost_original ||
        allItems.reduce((a, it) => roundedAmt(a + roundedAmt((it.quantity || 0) * (it.unit_price || 0), 2), 2), 0);

    const approvedCHOs = allChos.filter(c => c.doc_status === 'Aprobado');
    const approvedCHOAmt = approvedCHOs.reduce((a, c) => roundedAmt(a + parseFloat(c.proposed_change || '0'), 2), 0);
    const revisedCost = roundedAmt(originalCost + approvedCHOAmt, 2);

    // Lo certificado por partida (para mostrar en tabla)
    const certByItem: Record<string, { qty: number; amt: number }> = {};
    allCerts.forEach(cert => {
        if (cert.excluded) return;
        const certItems = Array.isArray(cert.items) ? cert.items : (cert.items?.list || []);
        certItems.forEach((ci: any) => {
            if (!ci.item_num) return;
            const qty = parseFloat(ci.quantity) || 0;
            const up  = parseFloat(ci.unit_price) || 0;
            if (!certByItem[ci.item_num]) certByItem[ci.item_num] = { qty: 0, amt: 0 };
            certByItem[ci.item_num].qty = roundedAmt(certByItem[ci.item_num].qty + qty, 3);
            certByItem[ci.item_num].amt = roundedAmt(certByItem[ci.item_num].amt + roundedAmt(qty * up, 2), 2);
        });
    });

    // Totales generales
    let totalQty = 0, totalAmt = 0, totalCertQty = 0, totalCertAmt = 0, totalRemQty = 0, totalRemAmt = 0;
    allItems.forEach(it => {
        const qty  = parseFloat(it.quantity)   || 0;
        const up   = parseFloat(it.unit_price) || 0;
        const amt  = roundedAmt(qty * up, 2);
        const c    = certByItem[it.item_num] || { qty: 0, amt: 0 };
        const rQty = roundedAmt(qty - c.qty, 3);
        const rAmt = roundedAmt(amt - c.amt, 2);
        totalQty     += qty;
        totalAmt     = roundedAmt(totalAmt + amt, 2);
        totalCertQty = roundedAmt(totalCertQty + c.qty, 3);
        totalCertAmt = roundedAmt(totalCertAmt + c.amt, 2);
        totalRemQty  = roundedAmt(totalRemQty + rQty, 3);
        totalRemAmt  = roundedAmt(totalRemAmt + rAmt, 2);
    });

    // Retenciones, Ajustes, Multas, etc. acumulados (Lógica de PACT del SummaryDashboard de la UI)
    let totalRetDeducted = 0;
    let totalRetReturned = 0;
    let totalExtraRetention = 0;
    let totalPriceAdjustment = 0;
    let totalInsuranceFines = 0;
    let totalOtherPenalties = 0;
    let totalRefund = 0;

    // Lógica para Material On Site (MOS) acumulado
    let matPaidTD = 0;
    let matPaidLast = 0;
    let matNetPaid = 0;

    const perItemMosBalance: Record<string, number> = {};
    const allReferenceItems = [...allItems];
    approvedCHOs.forEach(cho => {
        const choItems = Array.isArray(cho.items) ? cho.items : (cho.items?.list || []);
        choItems.forEach((it: any) => {
            const exists = allReferenceItems.find(r => r.item_num === it.item_num);
            if (!exists) allReferenceItems.push(it);
        });
    });

    const getInvoicePU = (certsList: any[], itemNum: string, currentCertIdx: number) => {
        for (let i = currentCertIdx; i >= 0; i--) {
            if (!certsList[i] || certsList[i].excluded) continue;
            const its = Array.isArray(certsList[i].items) ? certsList[i].items : (certsList[i].items?.list || []);
            const match = its.find((itx: any) => itx.item_num === itemNum && itx.has_material_on_site && parseFloat(itx.mos_unit_price) > 0);
            if (match) return parseFloat(match.mos_unit_price);
        }
        return 0;
    };

    const sortedCertsAsc = [...allCerts].sort((a, b) => (a.cert_num || 0) - (b.cert_num || 0));
    let lastCertNumVal = 0;
    let lastCertMatAdded = 0;

    sortedCertsAsc.forEach((cert, cIdx) => {
        if (cert.excluded) return;

        const certItems = Array.isArray(cert.items) ? cert.items : (cert.items?.list || []);
        let certMatAddedThisCert = 0;

        certItems.forEach((item: any) => {
            const itemNum = item.item_num;
            if (!itemNum) return;

            const qty = parseFloat(item.quantity) || 0;
            const up = parseFloat(item.unit_price) || 0;
            const manualDeductionQty = parseFloat(item.qty_from_mos) || 0;
            const hasAddition = !!item.has_material_on_site || (item.mos_invoice_total && parseFloat(item.mos_invoice_total) > 0);
            
            const currentBalance = perItemMosBalance[itemNum] || 0;
            const mosPU = getInvoicePU(sortedCertsAsc, itemNum, cIdx);
            const price = mosPU > 0 ? mosPU : up;

            const additionCostThisCert = hasAddition ? (parseFloat(item.mos_invoice_total) || 0) : 0;
            if (hasAddition) {
                certMatAddedThisCert = roundedAmt(certMatAddedThisCert + additionCostThisCert, 2);
            }
            
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
                perItemMosBalance[itemNum] = roundedAmt(currentBalance + additionCostThisCert, 2);
            }

            if (deductionQty > 0) {
                const cost = roundedAmt(deductionQty * price, 2);
                const newBal = roundedAmt((perItemMosBalance[itemNum] || 0) - cost, 2);
                perItemMosBalance[itemNum] = Math.max(0, newBal);
            }

            // Retención del 5%
            if (!cert.skip_retention && !item.skip_retention) {
                const itemAmt = roundedAmt(qty * up, 2);
                totalRetDeducted = roundedAmt(totalRetDeducted + roundedAmt(itemAmt * 0.05, 2), 2);
            }
        });

        matPaidTD = roundedAmt(matPaidTD + certMatAddedThisCert, 2);

        if ((cert.cert_num || 0) > lastCertNumVal) {
            lastCertNumVal = cert.cert_num;
            lastCertMatAdded = certMatAddedThisCert;
        }

        if (cert.show_retention_return && cert.retention_return_amount) {
            totalRetReturned = roundedAmt(totalRetReturned + parseFloat(cert.retention_return_amount || '0'), 2);
        }

        totalExtraRetention = roundedAmt(totalExtraRetention + (parseFloat(cert.extra_retention) || 0), 2);
        totalPriceAdjustment = roundedAmt(totalPriceAdjustment + (parseFloat(cert.price_adjustment) || 0), 2);
        totalInsuranceFines = roundedAmt(totalInsuranceFines + (parseFloat(cert.insurance_fines) || 0), 2);
        totalOtherPenalties = roundedAmt(totalOtherPenalties + (parseFloat(cert.other_penalties) || 0), 2);
        totalRefund = roundedAmt(totalRefund + (parseFloat(cert.refund) || 0), 2);
    });

    matNetPaid = roundedAmt(Object.values(perItemMosBalance).reduce((acc, bal) => acc + bal, 0), 2);
    matPaidLast = lastCertMatAdded;

    const retentionNet = roundedAmt(totalRetDeducted - totalRetReturned, 2);
    const retentionTD = roundedAmt(totalRetDeducted - totalRetReturned + totalExtraRetention + totalInsuranceFines + totalOtherPenalties - totalPriceAdjustment - totalRefund, 2);

    // Última certificación
    const sortedCerts = [...allCerts].filter(c => !c.excluded).sort((a, b) => (b.cert_num || 0) - (a.cert_num || 0));
    const lastCert    = sortedCerts[0];
    const lastCertAmt = lastCert
        ? (() => {
               const items2 = Array.isArray(lastCert.items) ? lastCert.items : (lastCert.items?.list || []);
               return items2.reduce((a: number, ci: any) =>
                   roundedAmt(a + roundedAmt((parseFloat(ci.quantity) || 0) * (parseFloat(ci.unit_price) || 0), 2), 2), 0);
           })()
        : 0;

    // Retención y penalidades de la última certificación
    let lastCertRetentionDeducted = 0;
    if (lastCert && !lastCert.skip_retention) {
        const lastCertItems = Array.isArray(lastCert.items) ? lastCert.items : (lastCert.items?.list || []);
        lastCertItems.forEach((ci: any) => {
            if (!ci.skip_retention) {
                lastCertRetentionDeducted = roundedAmt(lastCertRetentionDeducted + roundedAmt((parseFloat(ci.quantity) || 0) * (parseFloat(ci.unit_price) || 0) * 0.05, 2), 2);
            }
        });
    }
    const lastCertRetentionReturned = lastCert && lastCert.show_retention_return ? (parseFloat(lastCert.retention_return_amount) || 0) : 0;
    const lastCertRetentionTotal = roundedAmt(
        lastCertRetentionDeducted - lastCertRetentionReturned +
        (parseFloat(lastCert?.extra_retention) || 0) +
        (parseFloat(lastCert?.insurance_fines) || 0) +
        (parseFloat(lastCert?.other_penalties) || 0) -
        (parseFloat(lastCert?.price_adjustment) || 0) -
        (parseFloat(lastCert?.refund) || 0),
        2
    );

    // Daños líquidos
    const startDate   = project.date_project_start   ? new Date(project.date_project_start   + 'T00:00:00') : null;
    const origEndDate = project.date_orig_completion  ? new Date(project.date_orig_completion + 'T23:59:59') : null;
    const approvedDays = approvedCHOs.reduce((a, c) => a + (c.time_extension_days || 0), 0);
    let totalDays = 0;
    if (startDate && origEndDate) {
        totalDays = Math.floor((origEndDate.getTime() - startDate.getTime()) / 86400000);
    }
    const revisedDays = totalDays + approvedDays;
    let timeEndDate = new Date();
    if (project.date_substantial_completion) timeEndDate = new Date(project.date_substantial_completion + 'T23:59:59');
    else if (project.date_real_completion)   timeEndDate = new Date(project.date_real_completion   + 'T23:59:59');
    let usedDays = startDate ? Math.max(0, Math.floor((timeEndDate.getTime() - startDate.getTime()) / 86400000)) : 0;
    const damAmt = parseFloat(project.liquidated_damages_amount || '500');
    const liqDamages = Math.max(0, (usedDays - revisedDays) * damAmt);

    // Fecha del reporte
    const now = new Date();
    const reportDate = `${now.toLocaleDateString('en-US')} ${now.toLocaleTimeString('en-US')}`;

    // ── Workbook ───────────────────────────────────────────────────────────
    const workbook  = new ExcelJS.Workbook();
    const ws        = workbook.addWorksheet('Project Status (PACT)', { properties: { tabColor: { argb: C.pactBlue } } });

    // Columnas: A(margen) B(item) C(contract) D(description) E(uom) F(unit price) G(qty) H(amount) I(certQty) J(certAmt) K(remQty) L(remAmt) M(margen)
    ws.columns = [
        { width: 2  },   // A
        { width: 12 },   // B  Item
        { width: 18 },   // C  Contract
        { width: 30 },   // D  Description
        { width: 7  },   // E  UOM
        { width: 14 },   // F  U.Price
        { width: 12 },   // G  Qty
        { width: 16 },   // H  Amount
        { width: 12 },   // I  Cert Qty
        { width: 16 },   // J  Cert Amt
        { width: 12 },   // K  Rem Qty
        { width: 16 },   // L  Rem Amt
        { width: 2  },   // M
    ];

    let row = 1;

    // ── Estilos base ──────────────────────────────────────────────────────
    const stylePageHeader = (cell: ExcelJS.Cell, text: string, sz = 11, bold = false, align: ExcelJS.Alignment['horizontal'] = 'left') => {
        cell.value = text;
        cell.font  = { name: FONT_BASE, size: sz, bold, color: { argb: C.white } };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.pactBlue } };
        cell.alignment = { horizontal: align, vertical: 'middle' };
    };

    const styleSectionTitle = (cell: ExcelJS.Cell, text: string) => {
        cell.value = text;
        cell.font  = { name: FONT_BASE, size: 10, bold: true, color: { argb: C.pactBlue } };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.pactLight } };
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
        cell.border = {
            top:    { style: 'medium', color: { argb: C.pactBlue } },
            bottom: { style: 'thin',   color: { argb: C.pactBlue } },
            left:   { style: 'medium', color: { argb: C.pactBlue } },
        };
    };

    const styleLabel = (cell: ExcelJS.Cell, text: string) => {
        cell.value = text;
        cell.font  = { name: FONT_BASE, size: 9, bold: true, color: { argb: C.headerText } };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.offWhite } };
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
        cell.border = { bottom: { style: 'hair', color: { argb: C.borderGray } } };
    };

    const styleValue = (cell: ExcelJS.Cell, text: string | number, bold = false, color = C.headerText, align: ExcelJS.Alignment['horizontal'] = 'left') => {
        cell.value = text;
        cell.font  = { name: FONT_BASE, size: 9, bold, color: { argb: color } };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.white } };
        cell.alignment = { horizontal: align, vertical: 'middle' };
        cell.border = { bottom: { style: 'hair', color: { argb: C.borderGray } } };
    };

    // ── Función: agregar par label/valor en 2 columnas ────────────────────
    const addLV = (r: number, colL: number, colV: number, label: string, value: string | number, bold = false, valColor = C.headerText) => {
        const cellL = ws.getCell(r, colL);
        const cellV = ws.getCell(r, colV);
        styleLabel(cellL, label);
        styleValue(cellV, value, bold, valColor, 'left');
    };

    // ─────────────────────────────────────────────────────────────────────
    // ENCABEZADO DE PÁGINA  (filas 1-4)
    // ─────────────────────────────────────────────────────────────────────
    ws.getRow(row).height = 18;
    ws.mergeCells(row, 1, row, 9);
    stylePageHeader(ws.getCell(row, 1), 'Commonwealth of Puerto Rico', 11, true, 'left');
    ws.mergeCells(row, 10, row, 13);
    const dateCell = ws.getCell(row, 10);
    dateCell.value = `Project as of: ${reportDate}`;
    dateCell.font  = { name: FONT_BASE, size: 9, color: { argb: C.white } };
    dateCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.pactBlue } };
    dateCell.alignment = { horizontal: 'right', vertical: 'middle' };
    row++;

    ws.getRow(row).height = 14;
    ws.mergeCells(row, 1, row, 13);
    stylePageHeader(ws.getCell(row, 1), 'Highway and Transportation Authority', 10, false, 'left');
    row++;

    ws.getRow(row).height = 14;
    ws.mergeCells(row, 1, row, 13);
    stylePageHeader(ws.getCell(row, 1), 'Internal Contract Management', 10, false, 'left');
    row++;

    ws.getRow(row).height = 20;
    ws.mergeCells(row, 1, row, 13);
    const titleCell = ws.getCell(row, 1);
    titleCell.value = 'PROJECT STATUS (PACT)';
    titleCell.font  = { name: FONT_BASE, size: 14, bold: true, color: { argb: C.white } };
    titleCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.pactDark } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    row++;

    // Separador
    row++;

    // ─────────────────────────────────────────────────────────────────────
    // DATOS DEL PROYECTO  (2 columnas: izquierda B-D | derecha F-L aprox)
    // ─────────────────────────────────────────────────────────────────────
    ws.mergeCells(row, 2, row, 4);
    styleSectionTitle(ws.getCell(row, 2), 'CONTRACT INFORMATION');
    ws.mergeCells(row, 6, row, 12);
    styleSectionTitle(ws.getCell(row, 6), 'PROJECT DESCRIPTION');
    row++;

    const contractNum = project.contract_number || project.num_federal || '';
    addLV(row, 2, 3, 'Number:', contractNum || '—'); row++;
    addLV(row, 2, 3, 'Name:',   `${formatProjectNumber(project.num_act || '')} - ${project.name || ''}`.trim()); row++;
    addLV(row, 2, 3, 'PMIS ID:', project.pmis_id || project.oracle_id || '—'); row++;
    addLV(row, 2, 3, 'Federal No:', project.num_federal || '—'); row++;
    addLV(row, 2, 3, 'AC Code:', project.num_act ? `${formatProjectNumber(project.num_act)}` : '—'); row++;
    addLV(row, 2, 3, 'Oracle Id:', project.oracle_id || '—'); row++;

    // Descripción (derecha)
    const descStartRow = row - 5;
    ws.mergeCells(descStartRow, 6, descStartRow + 4, 12);
    const descCell = ws.getCell(descStartRow, 6);
    descCell.value     = project.scope || project.description || '—';
    descCell.font      = { name: FONT_BASE, size: 9 };
    descCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.white } };
    descCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
    descCell.border    = { bottom: { style: 'hair', color: { argb: C.borderGray } } };

    row++;
    // ─────────────────────────────────────────────────────────────────────
    // SECCIÓN DATES / AMOUNTS / MATERIALS / OTHER
    // ─────────────────────────────────────────────────────────────────────
    const headStyle: Partial<ExcelJS.Style> = {
        font:      { name: FONT_BASE, size: 9, bold: true, color: { argb: C.white } },
        fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: C.pactMid } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: {
            top:    { style: 'thin', color: { argb: C.white } },
            bottom: { style: 'thin', color: { argb: C.white } },
            left:   { style: 'thin', color: { argb: C.white } },
            right:  { style: 'thin', color: { argb: C.white } },
        }
    };

    ws.getRow(row).height = 16;
    // Encabezados de las 4 secciones
    ws.mergeCells(row, 2, row, 4);   const h1 = ws.getCell(row, 2);  Object.assign(h1, { value: 'Dates' });           h1.style = headStyle;
    ws.mergeCells(row, 5, row, 7);   const h2 = ws.getCell(row, 5);  Object.assign(h2, { value: 'Amounts' });         h2.style = headStyle;
    ws.mergeCells(row, 8, row, 10);  const h3 = ws.getCell(row, 8);  Object.assign(h3, { value: 'Materials' });       h3.style = headStyle;
    ws.mergeCells(row, 11, row, 12); const h4 = ws.getCell(row, 11); Object.assign(h4, { value: 'Other' });           h4.style = headStyle;
    row++;

    // Construimos las 4 columnas como arrays de pares [label, value]
    const colDates: [string, string][] = [
        ['Last Certification:', lastCert ? `${lastCert.cert_num || ''}` : '—'],
        ['Certification:',      fmtDate(lastCert?.cert_date)],
        ['Last Payment:',       fmtDate(lastCert?.cert_date)],
        ['Awarded:',            fmtDate(project.date_awarded)],
        ['Starting:',           fmtDate(project.date_project_start)],
        ['Completion Orig:',    fmtDate(project.date_orig_completion)],
        ['Completion Rev:',     fmtDate(project.date_rev_completion)],
        ['Last Revision:',      reportDate],
    ];
    const colAmounts: [string, string][] = [
        ['Original:',           fmtCur(originalCost)],
        ['Revised:',            fmtCur(revisedCost)],
        ['Certified:',          fmtCur(totalCertAmt)],
        ['Last Certified:',     fmtCur(lastCertAmt)],
        ['Remaining:',          fmtCur(revisedCost - totalCertAmt)],
        ['Liq.Damage:',         fmtCur(liqDamages)],
        ['Reimbursement:',      fmtCur(totalRefund)],
        ['', ''],
    ];
    const colMaterials: [string, string][] = [
        ['Mat. Net Paid:',      fmtCur(matNetPaid)],
        ['Mat. Paid Last:',     fmtCur(matPaidLast)],
        ['Mat. Paid TD:',       fmtCur(matPaidTD)],
        ['', ''],
        ['', ''],
        ['', ''],
        ['Retention 5%:',       ''],
        ['Extra Ret. TD:',      fmtCur(totalExtraRetention)],
    ];
    const colOther: [string, string][] = [
        ['Net Paid:',           fmtCur(totalCertAmt + matNetPaid - retentionTD)],
        ['Paid Last:',          fmtCur(lastCertAmt + matPaidLast - lastCertRetentionTotal)],
        ['Liq.Dam. Or Rem:',    fmtCur(totalRefund)],
        ['', ''],
        ['', ''],
        ['', ''],
        ['Last Retention:',     fmtCur(-lastCertRetentionTotal)],
        ['Retention TD:',       fmtCur(-retentionTD)],
    ];

    const numInfoRows = Math.max(colDates.length, colAmounts.length, colMaterials.length, colOther.length);

    for (let i = 0; i < numInfoRows; i++) {
        ws.getRow(row).height = 14;

        const fillEven: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? C.offWhite : C.white } };
        const borderCell: Partial<ExcelJS.Borders> = { bottom: { style: 'hair', color: { argb: C.borderGray } } };

        const setCols = (colL: number, colV: number, pair: [string, string] | undefined) => {
            const lbl = pair?.[0] || '';
            const val = pair?.[1] || '';
            const cL  = ws.getCell(row, colL);
            const cV  = ws.getCell(row, colV);
            cL.value = lbl; cL.font = { name: FONT_BASE, size: 8, bold: true, color: { argb: C.headerText } }; cL.fill = fillEven; cL.alignment = { horizontal: 'left' }; cL.border = borderCell;
            cV.value = val; cV.font = { name: FONT_BASE, size: 8, color: { argb: C.headerText } };             cV.fill = fillEven; cV.alignment = { horizontal: 'right' }; cV.border = borderCell;
        };

        ws.mergeCells(row, 2, row, 2); ws.mergeCells(row, 3, row, 4);
        setCols(2, 3, colDates[i]);

        ws.mergeCells(row, 5, row, 5); ws.mergeCells(row, 6, row, 7);
        setCols(5, 6, colAmounts[i]);

        ws.mergeCells(row, 8, row, 8); ws.mergeCells(row, 9, row, 10);
        setCols(8, 9, colMaterials[i]);

        ws.mergeCells(row, 11, row, 11); ws.mergeCells(row, 12, row, 12);
        setCols(11, 12, colOther[i]);

        row++;
    }

    row++;

    // ─────────────────────────────────────────────────────────────────────
    // TABLA DE PARTIDAS
    // ─────────────────────────────────────────────────────────────────────
    ws.getRow(row).height = 30;
    const tableHeaderStyle: Partial<ExcelJS.Style> = {
        font:      { name: FONT_BASE, size: 9, bold: true, color: { argb: C.white } },
        fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: C.pactBlue } },
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
        border: {
            top:    { style: 'medium', color: { argb: C.pactDark } },
            bottom: { style: 'medium', color: { argb: C.pactDark } },
            left:   { style: 'thin',   color: { argb: C.pactDark } },
            right:  { style: 'thin',   color: { argb: C.pactDark } },
        }
    };

    const headers = [
        [2, 'Item'],
        [3, 'Contract'],
        [4, 'Description'],
        [5, 'UOM'],
        [6, 'U.Price'],
        [7, 'Qty.'],
        [8, 'Amount'],
        [9, 'Certified\nQTY.'],
        [10, 'Certified\nAmnt.'],
        [11, 'Rem.Qty'],
        [12, 'Rem. Amnt'],
    ];
    headers.forEach(([col, label]) => {
        const c = ws.getCell(row, col as number);
        c.value = label;
        c.style = tableHeaderStyle;
    });
    row++;

    // Filas de datos por partida
    const dataBorder: Partial<ExcelJS.Borders> = {
        bottom: { style: 'hair', color: { argb: C.borderGray } },
        left:   { style: 'hair', color: { argb: C.borderGray } },
        right:  { style: 'hair', color: { argb: C.borderGray } },
    };

    allItems.forEach((item: any, idx: number) => {
        const qty   = parseFloat(item.quantity)   || 0;
        const up    = parseFloat(item.unit_price) || 0;
        const amt   = roundedAmt(qty * up, 2);
        const c     = certByItem[item.item_num] || { qty: 0, amt: 0 };
        const rQty  = roundedAmt(qty - c.qty, 3);
        const rAmt  = roundedAmt(amt - c.amt, 2);

        const isEven = idx % 2 === 0;
        const fgRow: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? C.offWhite : C.white } };

        const setCell = (col: number, value: string | number, align: ExcelJS.Alignment['horizontal'] = 'left', bold = false) => {
            const cell = ws.getCell(row, col);
            cell.value     = value;
            cell.font      = { name: FONT_BASE, size: 8, bold };
            cell.fill      = fgRow;
            cell.alignment = { horizontal: align, vertical: 'middle' };
            cell.border    = dataBorder;
        };

        const fullDesc = [item.description, item.additional_description].filter(Boolean).join(' - ');

        ws.getRow(row).height = 13;
        setCell(2,  item.item_num   || '—');
        setCell(3,  item.contract_num || project.contract_number || '—');
        setCell(4,  fullDesc || '—', 'left');
        setCell(5,  item.unit_of_measure || item.uom || '—', 'center');
        setCell(6,  fmtCur(up),  'right');
        setCell(7,  fmtNum(qty), 'right');
        setCell(8,  fmtCur(amt), 'right', true);
        setCell(9,  fmtNum(c.qty), 'right');
        setCell(10, fmtCur(c.amt), 'right', true);
        setCell(11, fmtNum(rQty, 2), 'right');
        setCell(12, fmtCur(rAmt), 'right', c.amt < amt ? false : false);
        row++;
    });

    // Fila de Totales
    ws.getRow(row).height = 16;
    const totalStyle: Partial<ExcelJS.Style> = {
        font:      { name: FONT_BASE, size: 9, bold: true, color: { argb: C.pactDark } },
        fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: C.total } },
        alignment: { horizontal: 'right', vertical: 'middle' },
        border: {
            top:    { style: 'medium', color: { argb: C.pactBlue } },
            bottom: { style: 'medium', color: { argb: C.pactBlue } },
            left:   { style: 'thin',   color: { argb: C.pactBlue } },
            right:  { style: 'thin',   color: { argb: C.pactBlue } },
        }
    };

    const setTotal = (col: number, value: string | number, align: ExcelJS.Alignment['horizontal'] = 'right') => {
        const cell = ws.getCell(row, col);
        cell.value     = value;
        cell.style     = { ...totalStyle, alignment: { ...totalStyle.alignment!, horizontal: align } };
    };

    ws.mergeCells(row, 2, row, 5);
    setTotal(2, 'TOTAL', 'left');
    setTotal(6, '');
    setTotal(7, fmtNum(totalQty));
    setTotal(8, fmtCur(totalAmt));
    setTotal(9, fmtNum(totalCertQty));
    setTotal(10, fmtCur(totalCertAmt));
    setTotal(11, fmtNum(totalRemQty, 2));
    setTotal(12, fmtCur(totalRemAmt));
    row++;

    // ─────────────────────────────────────────────────────────────────────
    // PIE DE PÁGINA
    // ─────────────────────────────────────────────────────────────────────
    row += 2;
    ws.mergeCells(row, 2, row, 12);
    const footerCell = ws.getCell(row, 2);
    footerCell.value     = 'Diseñador: Ing. Enrique Saavedra Sada, PE  ·  Reporte generado automáticamente por PACT';
    footerCell.font      = { name: FONT_BASE, size: 8, italic: true, bold: true, color: { argb: C.pactBlue } };
    footerCell.alignment = { horizontal: 'center' };
    row++;

    ws.mergeCells(row, 2, row, 12);
    const genCell = ws.getCell(row, 2);
    genCell.value     = `Generado el ${reportDate}`;
    genCell.font      = { name: FONT_BASE, size: 7, italic: true, color: { argb: C.gray } };
    genCell.alignment = { horizontal: 'center' };

    // ── Buffer → Blob ──────────────────────────────────────────────────
    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
