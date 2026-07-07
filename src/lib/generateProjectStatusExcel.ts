import ExcelJS from 'exceljs';
import { supabase } from './supabase';
import { roundedAmt, formatDate, getFederalSharePct, formatProjectNumber } from './utils';

// @UNIFICATION_RESUMEN_PACT
import { fetchProjectSummary } from './projectSummary';
// @UNIFICATION_RESUMEN_PACT_END

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseNum(val: any): number {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    const clean = String(val).replace(/[$,\s]/g, '');
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
}

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

    const allChos  = chos  || [];
    const allCerts = certs || [];

    const approvedCHOs = allChos.filter(c => c.doc_status === 'Aprobado');

    // 1. Consolidar partidas ordinarias del contrato original (mismo item_num y descripción)
    const consolidatedItemsMap: Record<string, any> = {};
    (items || []).forEach((it: any) => {
        const itemNum = (it.item_num || '').trim();
        const desc = (it.description || '').trim();
        const key = `${itemNum}_${desc.toLowerCase()}`;
        if (consolidatedItemsMap[key]) {
            consolidatedItemsMap[key].quantity = roundedAmt((parseNum(consolidatedItemsMap[key].quantity) || 0) + (parseNum(it.quantity) || 0), 3);
        } else {
            consolidatedItemsMap[key] = { ...it };
        }
    });
    const consolidatedItems = Object.values(consolidatedItemsMap);

    // Identificar qué números de partidas están en el contrato original
    const originalItemNums = new Set((items || []).map(it => (it.item_num || '').trim()));

    // 2. Extraer partidas de CHOs aprobadas
    const choItemsList: any[] = [];
    approvedCHOs.forEach(cho => {
        const cItems = Array.isArray(cho.items) ? cho.items : (cho.items?.list || []);
        cItems.forEach((it: any) => {
            choItemsList.push({
                ...it,
                isChoItem: !originalItemNums.has((it.item_num || '').trim()),
                originChoNum: cho.cho_num
            });
        });
    });

    // 3. Consolidar partidas de CHO repetidas
    const consolidatedChoItemsMap: Record<string, any> = {};
    choItemsList.forEach((it: any) => {
        const itemNum = (it.item_num || '').trim();
        const desc = (it.description || '').trim();
        const key = `${itemNum}_${desc.toLowerCase()}`;
        if (consolidatedChoItemsMap[key]) {
            consolidatedChoItemsMap[key].quantity = roundedAmt((parseNum(consolidatedChoItemsMap[key].quantity) || 0) + (parseNum(it.quantity) || 0), 3);
        } else {
            consolidatedChoItemsMap[key] = { ...it };
        }
    });
    const consolidatedChoItems = Object.values(consolidatedChoItemsMap);

    // Para las partidas que surgieron por EWO/CHO, anotamos la cantidad original en la descripción
    consolidatedChoItems.forEach((it: any) => {
        if (it.isChoItem) {
            const qtyOrig = parseNum(it.quantity) || 0;
            const note = `(Qty. Orig: ${qtyOrig.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
            it.description = `${it.description || ''} ${note}`.trim();
        }
    });

    // 4. Combinar partidas consolidadas ordinarias con las de CHO
    const finalItemsMap: Record<string, any> = {};
    consolidatedItems.forEach((it: any) => {
        const itemNum = (it.item_num || '').trim();
        const desc = (it.description || '').trim();
        const key = `${itemNum}_${desc.toLowerCase()}`;
        finalItemsMap[key] = { ...it };
    });

    consolidatedChoItems.forEach((it: any) => {
        const itemNum = (it.item_num || '').trim();
        const desc = (it.description || '').trim();
        const key = `${itemNum}_${desc.toLowerCase()}`;
        if (finalItemsMap[key]) {
            finalItemsMap[key].quantity = roundedAmt((parseNum(finalItemsMap[key].quantity) || 0) + (parseNum(it.quantity) || 0), 3);
        } else {
            finalItemsMap[key] = { ...it };
        }
    });

    const allItems = Object.values(finalItemsMap).sort((a: any, b: any) => {
        return (a.item_num || '').localeCompare(b.item_num || '', undefined, { numeric: true, sensitivity: 'base' });
    });

    // ── Cálculos financieros ──────────────────────────────────────────────
    // @UNIFICATION_RESUMEN_PACT
    const { metrics } = await fetchProjectSummary(projectId);

    const originalCost = metrics.cost.original;
    const approvedCHOAmt = metrics.chos.approvedTotal;
    const revisedCost = metrics.cost.revisedTotal;

    // Lo certificado por partida (para mostrar en tabla)
    const certByItem: Record<string, { qty: number; amt: number }> = {};
    allCerts.forEach(cert => {
        if (cert.excluded) return;
        const certItems = Array.isArray(cert.items) ? cert.items : (cert.items?.list || []);
        certItems.forEach((ci: any) => {
            if (!ci.item_num) return;
            const qty = parseNum(ci.quantity) || 0;
            const up  = parseNum(ci.unit_price) || 0;
            if (!certByItem[ci.item_num]) certByItem[ci.item_num] = { qty: 0, amt: 0 };
            certByItem[ci.item_num].qty = roundedAmt(certByItem[ci.item_num].qty + qty, 3);
            certByItem[ci.item_num].amt = roundedAmt(certByItem[ci.item_num].amt + roundedAmt(qty * up, 2), 2);
        });
    });

    // Totales generales
    let totalQty = 0, totalAmt = 0, totalCertQty = 0, totalCertAmt = 0, totalRemQty = 0, totalRemAmt = 0;
    allItems.forEach(it => {
        const qty  = parseNum(it.quantity)   || 0;
        const up   = parseNum(it.unit_price) || 0;
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

    // Estandarizar valores acumulados usando la sección Resumen
    const totalRetDeducted = metrics.retention.fivePercent;
    const totalRetReturned = metrics.retention.returned;
    const totalExtraRetention = metrics.retention.extra;
    const totalPriceAdjustment = metrics.retention.priceAdjustment;
    const totalInsuranceFines = metrics.retention.insuranceFines;
    const totalOtherPenalties = metrics.retention.otherPenalties;
    const totalRefund = metrics.penalties.dlqReimbursement;

    // MOS unificado
    const matNetPaid = metrics.cost.materialOnSite;
    // Para conservar el flujo del reporte, calculamos matPaidTD sumando las facturas en las certificaciones
    let matPaidTD = 0;
    allCerts.forEach(cert => {
        if (cert.excluded) return;
        const certItems = Array.isArray(cert.items) ? cert.items : (cert.items?.list || []);
        certItems.forEach((item: any) => {
            const hasAddition = !!item.has_material_on_site || (item.mos_invoice_total && parseNum(item.mos_invoice_total) > 0);
            if (hasAddition) {
                matPaidTD = roundedAmt(matPaidTD + (parseNum(item.mos_invoice_total) || 0), 2);
            }
        });
    });

    const lastCert = allCerts.filter(c => !c.excluded).sort((a, b) => (b.cert_num || 0) - (a.cert_num || 0))[0];
    let lastCertMatAdded = 0;
    if (lastCert) {
        const lastCertItems = Array.isArray(lastCert.items) ? lastCert.items : (lastCert.items?.list || []);
        lastCertItems.forEach((item: any) => {
            const hasAddition = !!item.has_material_on_site || (item.mos_invoice_total && parseNum(item.mos_invoice_total) > 0);
            if (hasAddition) {
                lastCertMatAdded = roundedAmt(lastCertMatAdded + (parseNum(item.mos_invoice_total) || 0), 2);
            }
        });
    }
    const matPaidLast = lastCertMatAdded;

    const retentionNet = roundedAmt(totalRetDeducted - totalRetReturned, 2);
    const retentionTD = metrics.retention.total;

    // Última certificación
    const lastCertAmt = metrics.cost.lastCertAmount;
    const lastCertRetentionDeducted = metrics.retention.lastRetentionAmount;
    const lastCertRetentionReturned = lastCert && lastCert.show_retention_return ? (parseNum(lastCert.retention_return_amount) || 0) : 0;
    const lastCertRetentionTotal = roundedAmt(
        lastCertRetentionDeducted - lastCertRetentionReturned +
        (parseNum(lastCert?.extra_retention) || 0) +
        (parseNum(lastCert?.insurance_fines) || 0) +
        (parseNum(lastCert?.other_penalties) || 0) -
        (parseNum(lastCert?.price_adjustment) || 0) -
        (parseNum(lastCert?.refund) || 0),
        2
    );

    // Días y penalidades
    const totalDays = metrics.time.total;
    const revisedDays = metrics.time.revised;
    const usedDays = metrics.time.used;
    const liqDamages = metrics.penalties.liquidated;

    // Fecha del reporte
    const now = new Date();
    const reportDate = `${now.toLocaleDateString('en-US')} ${now.toLocaleTimeString('en-US')}`;
    // @UNIFICATION_RESUMEN_PACT_END

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

    // ── Función para Name (con fusión de celdas) ──
    const addLVName = (r: number, colL: number, colVStart: number, colVEnd: number, label: string, value: string | number, bold = false, valColor = C.headerText) => {
        const cellL = ws.getCell(r, colL);
        styleLabel(cellL, label);
        
        ws.mergeCells(r, colVStart, r, colVEnd);
        const cellV = ws.getCell(r, colVStart);
        styleValue(cellV, value, bold, valColor, 'left');
        
        // Aplicar estilo de borde y fondo a las celdas fusionadas
        for (let c = colVStart + 1; c <= colVEnd; c++) {
            const cell = ws.getCell(r, c);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.white } };
            cell.border = { bottom: { style: 'hair', color: { argb: C.borderGray } } };
        }
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

    addLV(row, 2, 3, 'Number:', project.oracle_id || '—'); row++; // Punto 2: Número de Oracle en Number
    addLVName(row, 2, 3, 5, 'Name:', `${formatProjectNumber(project.num_act || '')} - ${project.name || ''}`.trim()); row++; // Punto 1: Fusión Name para evitar corte
    addLV(row, 2, 3, 'PMIS ID:', project.pmis_id || project.oracle_id || '—'); row++;
    addLV(row, 2, 3, 'Federal No:', project.num_federal || '—'); row++;
    addLV(row, 2, 3, 'AC Code:', project.num_act ? `${formatProjectNumber(project.num_act)}` : '—'); row++;
    addLV(row, 2, 3, 'Oracle Id:', project.oracle_id || '—'); row++;

    // Descripción (derecha)
    const descStartRow = row - 6;
    ws.mergeCells(descStartRow, 6, descStartRow + 5, 12);
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
        const qty   = parseNum(item.quantity)   || 0;
        const up    = parseNum(item.unit_price) || 0;
        const amt   = roundedAmt(qty * up, 2);
        const c     = certByItem[item.item_num] || { qty: 0, amt: 0 };
        const rQty  = roundedAmt(qty - c.qty, 3);
        const rAmt  = roundedAmt(amt - c.amt, 2);

        const isEven = idx % 2 === 0;
        const fgRow: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? C.offWhite : C.white } };

        const setCell = (col: number, value: string | number, align: ExcelJS.Alignment['horizontal'] = 'left', bold = false, wrap = false) => {
            const cell = ws.getCell(row, col);
            cell.value     = value;
            cell.font      = { name: FONT_BASE, size: 8, bold };
            cell.fill      = fgRow;
            cell.alignment = { horizontal: align, vertical: 'middle', wrapText: wrap };
            cell.border    = dataBorder;
        };

        const fullDesc = [item.description, item.additional_description].filter(Boolean).join(' - ');

        // Punto 1: Quitamos el ws.getRow(row).height = 13 fijo para permitir autoajuste de altura de fila de Excel
        setCell(2,  item.item_num   || '—');
        setCell(3,  item.contract_num || project.contract_number || '—');
        setCell(4,  fullDesc || '—', 'left', false, true); // Punto 1: Habilitar wrapText = true para descripción de partidas
        setCell(5,  item.unit || item.unit_of_measure || item.uom || '—', 'center'); // Punto 6: Soporte para item.unit en UOM
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
