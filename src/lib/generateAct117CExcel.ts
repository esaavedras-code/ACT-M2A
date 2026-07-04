import ExcelJS from 'exceljs';
import { supabase } from './supabase';
import { formatDate, formatProjectNumber, getFederalSharePct, sortItemsNaturally, uniqueSortItems, formatItemNum, roundedAmt } from './utils';
import { ACT117C_TEMPLATE_BASE64 } from './act117cTemplate';

/**
 * Genera el reporte ACT-117C en Excel usando la plantilla oficial.
 * La plantilla tiene 2 hojas: frente (MPPR- ACT-117C) y reverso (ACT-117C PAG atrás).
 * Cada certificación produce pares de hojas (frente + reverso).
 * Si una certificación tiene muchos items, se crean hojas adicionales.
 */
export async function generateAct117CExcel(
    projectId: string,
    certId: string,
    certNum: number,
    certDate: string,
    isFinal?: boolean
) {
    try {
        // 1. Fetch Data
        const { data: projData } = await supabase.from('projects').select('*').eq('id', projectId).single();
        if (!projData) throw new Error("Proyecto no encontrado");

        const { data: contrData } = await supabase.from('contractors').select('*').eq('project_id', projectId).single();
        const { data: currentCert } = await supabase.from('payment_certifications').select('*').eq('id', certId).single();
        const { data: allCerts } = await supabase.from('payment_certifications')
            .select('*')
            .eq('project_id', projectId)
            .lte('cert_num', certNum)
            .order('cert_num', { ascending: true });

        const { data: items } = await supabase.from('contract_items')
            .select('*')
            .eq('project_id', projectId);

        const { data: personnel } = await supabase.from('act_personnel').select('*').eq('project_id', projectId);
        const { data: agreementFunds } = await supabase.from('project_agreement_funds').select('*').eq('project_id', projectId);

        const currentCertItemsRaw = Array.isArray(currentCert?.items) ? currentCert.items : (currentCert?.items?.list || []);
        const currentCertItems = uniqueSortItems([...currentCertItemsRaw]);

        const { data: chos } = await supabase.from("chos")
            .select("proposed_change, cho_date")
            .eq("project_id", projectId)
            .eq("doc_status", "Aprobado")
            .lte("cho_date", certDate);
        const totalCho = (chos || []).reduce((sum: number, c: any) => sum + (parseFloat(c.proposed_change as any) || 0), 0);

        // 2. Calculations
        const calcOriginalAmount = projData.cost_original || (agreementFunds || []).reduce((acc: number, f: any) => acc + (parseFloat(f.amount) || 0), 0) || (items || []).reduce((acc: number, it: any) => acc + ((it.quantity || 0) * (it.unit_price || 0)), 0);
        const totalProjectAmount = calcOriginalAmount + totalCho;

        let wpPrevious = 0;
        let wpCurrent = 0;
        let materialBalance = 0;
        let runningWP = 0;
        let runningMOS = 0;

        allCerts?.forEach((c: any) => {
            const itemsList = Array.isArray(c.items) ? c.items : (c.items?.list || []);
            let certGross = 0;
            let certMOS = 0;
            itemsList.forEach((it: any) => {
                const q = parseFloat(it.quantity) || 0;
                const p = parseFloat(it.unit_price) || 0;
                certGross += q * p;
                certMOS += (it.has_material_on_site ? (parseFloat(it.mos_invoice_total) || 0) : 0) - ((parseFloat(it.qty_from_mos) || 0) * (parseFloat(it.mos_unit_price) || p));
            });
            runningWP += certGross;
            runningMOS += certMOS;

            if (c.cert_num < certNum) {
                wpPrevious += certGross;
            } else if (c.cert_num === certNum) {
                wpCurrent = certGross;
            }
            if (c.cert_num === certNum) {
                materialBalance = runningMOS;
            }
        });

        const wpTotalToDate = wpPrevious + wpCurrent;
        const percentWPValue = totalProjectAmount > 0 ? (wpTotalToDate / totalProjectAmount) * 100 : 0;

        let previousRetention = 0;
        let currentRetention = 0;
        let reimbursementThisPeriod = 0;

        const sortedCerts = allCerts?.sort((a: any, b: any) => a.cert_num - b.cert_num) || [];

        sortedCerts.forEach((c: any) => {
            if (c.cert_num <= certNum) {
                const itemsList = Array.isArray(c.items) ? c.items : (c.items?.list || []);
                const cRet = itemsList.reduce((acc: number, it: any) => {
                    if (it.skip_retention === true || it.skip_retention === 'true') return acc;
                    const itemWork = roundedAmt((parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 2);
                    return roundedAmt(acc + roundedAmt(itemWork * 0.05, 2), 2);
                }, 0);
                const returnAmount = parseFloat(c.retention_return_amount as any) || 0;

                let actualCertRet = 0;
                let actualReturn = 0;

                if (!c.skip_retention) {
                    actualCertRet = cRet;
                    if (c.show_retention_return) actualReturn = returnAmount;
                } else {
                    if (c.show_retention_return) actualReturn = returnAmount;
                }

                if (c.cert_num < certNum) {
                    previousRetention += actualCertRet;
                } else if (c.cert_num === certNum) {
                    currentRetention = actualCertRet;
                    reimbursementThisPeriod = actualReturn;
                }
            }
        });

        const subTotalValue = wpCurrent - currentRetention + reimbursementThisPeriod;

        const prevCerts = allCerts?.filter((c: any) => c.cert_num < certNum) || [];
        const prevMOSBalance = prevCerts.reduce((acc: number, c: any) => {
            let cMOS = 0;
            const cItems = Array.isArray(c.items) ? c.items : (c.items?.list || []);
            cItems.forEach((it: any) => {
                cMOS += (it.has_material_on_site ? (parseFloat(it.mos_invoice_total) || 0) : 0) - ((parseFloat(it.qty_from_mos) || 0) * (parseFloat(it.mos_unit_price) || (parseFloat(it.unit_price) || 0)));
            });
            return acc + cMOS;
        }, 0);

        const currentMOSChange = materialBalance - prevMOSBalance;
        const netPaymentValue = subTotalValue + currentMOSChange;

        // Personnel mapping
        const personnelMap: Record<string, string> = {};
        personnel?.forEach((p: any) => {
            const start = p.active_from ? new Date(p.active_from) : new Date(0);
            const end = p.active_to ? new Date(p.active_to) : new Date(8640000000000000);
            const cDate = new Date(certDate);
            if (cDate >= start && cDate <= end) {
                personnelMap[p.role] = p.name;
            }
        });

        // Percent time calculation
        let percentTimeValue = 0;
        if (projData.date_project_start) {
            const sDt = new Date(projData.date_project_start);
            const eDt = new Date(projData.date_rev_completion || projData.date_orig_completion);
            const wpDate = new Date(currentCert?.wp_up_to || certDate);
            const usedMs = wpDate.getTime() - sDt.getTime();
            const totalMs = eDt.getTime() - sDt.getTime();
            percentTimeValue = Math.min(100, Math.max(0, (usedMs / totalMs) * 100));
        }

        // Duration and time calculations
        const startDate = projData.date_project_start ? new Date(projData.date_project_start) : null;
        const endDate = projData.date_orig_completion ? new Date(projData.date_orig_completion) : null;
        let duration = 0;
        if (startDate && endDate) {
            duration = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
        }

        const revEndDate = projData.date_rev_completion ? new Date(projData.date_rev_completion) : endDate;
        let timeElapsed = 0;
        if (startDate) {
            const wpDate = new Date(currentCert?.wp_up_to || certDate);
            timeElapsed = Math.floor((wpDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
        }

        // Liquidated damages calculations
        const ldFromDate = revEndDate || endDate;
        const ldToDate = currentCert?.wp_up_to ? new Date(currentCert.wp_up_to) : new Date(certDate);
        let ldDays = 0;
        if (ldFromDate && ldToDate > ldFromDate) {
            ldDays = Math.floor((ldToDate.getTime() - ldFromDate.getTime()) / (1000 * 3600 * 24));
        }
        const ldRatePerDay = parseFloat(projData.liquidated_damages_amount) || 2000;
        const ldTotal = currentCert?.liquidated_damages || 0;
        const ldPrevious = 0; // We'll leave this for manual entry
        const ldThisPeriod = ldTotal;

        // 3. Load template and Logo
        const workbook = new ExcelJS.Workbook();
        const bufferTemplate = Buffer.from(ACT117C_TEMPLATE_BASE64, 'base64');
        await workbook.xlsx.load(bufferTemplate);

        let logoId: number | null = null;
        try {
            const logoRes = await fetch('/act_logo.png');
            if (logoRes.ok) {
                const logoBuf = await logoRes.arrayBuffer();
                logoId = workbook.addImage({
                    buffer: logoBuf,
                    extension: 'png',
                });
            }
        } catch (e) {
            console.warn("Could not load logo image:", e);
        }

        const ITEMS_PER_PAGE = 10; // rows 19-28 (10 item rows available in the template)
        const totalPages = Math.max(1, Math.ceil(currentCertItems.length / ITEMS_PER_PAGE));

        // Get original sheets
        const frontSheet = workbook.getWorksheet(1);
        const backSheet = workbook.getWorksheet(2);
        if (!frontSheet || !backSheet) throw new Error("Template ACT-117C no tiene las hojas esperadas");

        // Helper to convert Excel serial date number to a JS Date
        const excelDateToStr = (d: string | Date | number) => {
            if (!d) return '';
            return formatDate(d);
        };

        // Fill FRONT sheet with data
        const fillFrontSheet = (sheet: ExcelJS.Worksheet, pageItems: any[], pageNum: number) => {
            // El logo ya viene en la plantilla base64, no lo inyectamos de nuevo para evitar duplicados.

            // Header fields 1-8 (left column)
            sheet.getCell('C7').value = 'Director Regional';
            sheet.getCell('C8').value = projData.name || '';
            sheet.getCell('C9').value = contrData?.name || '';
            sheet.getCell('C10').value = formatProjectNumber(projData.num_act);
            sheet.getCell('C11').value = projData.num_federal || 'N/A';
            sheet.getCell('C12').value = projData.num_oracle || '';
            sheet.getCell('C13').value = projData.num_contrato || '';
            sheet.getCell('C14').value = (projData.municipios || []).join(', ');

            // Header fields 9-16 (right column)
            sheet.getCell('J7').value = certDate ? formatDate(certDate) : formatDate(new Date());
            sheet.getCell('J8').value = isFinal ? `${certNum} FINAL` : certNum;
            sheet.getCell('J9').value = formatDate(currentCert?.wp_up_to || certDate);
            sheet.getCell('J10').value = formatDate(projData.date_project_start);
            sheet.getCell('J11').value = formatDate(projData.date_orig_completion);
            sheet.getCell('J12').value = formatDate(projData.date_rev_completion || projData.date_orig_completion);
            sheet.getCell('J13').value = calcOriginalAmount;
            sheet.getCell('J14').value = totalProjectAmount;

            // Duration and time elapsed (columns O,P if they exist)
            try {
                sheet.getCell('P11').value = duration;
                sheet.getCell('P12').value = timeElapsed;
            } catch (e) { /* optional columns */ }

            // Items table (rows 19-28)
            for (let i = 0; i < ITEMS_PER_PAGE; i++) {
                const row = 19 + i;
                if (i < pageItems.length) {
                    const it = pageItems[i];
                    const matchCi = items?.find((ci: any) => ci.item_num === it.item_num);
                    const desc = it.description || matchCi?.description || '';
                    const addDesc = it.additional_description || matchCi?.additional_description || '';
                    const fullDesc = [desc, addDesc].filter(Boolean).join(' - ');

                    const fedPct = getFederalSharePct(projData, it);
                    const fedP = (it.fund_source || "").toUpperCase() === "ACT:100%" ? 0 : fedPct;

                    sheet.getCell(`A${row}`).value = formatItemNum(it.item_num);
                    // Column B = Alt (leave empty unless specified)
                    sheet.getCell(`C${row}`).value = it.specification || matchCi?.specification || '';
                    sheet.getCell(`D${row}`).value = '';
                    sheet.getCell(`E${row}`).value = fullDesc;
                    sheet.getCell(`H${row}`).value = it.unit || matchCi?.unit || '';
                    
                    const qtyCell = sheet.getCell(`I${row}`);
                    qtyCell.value = parseFloat(it.quantity) || 0;
                    qtyCell.numFmt = '#,##0.00####';
                    
                    sheet.getCell(`J${row}`).value = parseFloat(it.unit_price) || 0;
                    sheet.getCell(`K${row}`).value = (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0);
                } else {
                    // Clear cells for empty item rows
                    sheet.getCell(`A${row}`).value = '';
                    sheet.getCell(`C${row}`).value = '';
                    sheet.getCell(`D${row}`).value = '';
                    sheet.getCell(`E${row}`).value = '';
                    sheet.getCell(`H${row}`).value = '';
                    sheet.getCell(`I${row}`).value = '';
                    sheet.getCell(`J${row}`).value = '';
                    sheet.getCell(`K${row}`).value = '';
                }
            }

            // Page number removed by user request
            sheet.getCell('E32').value = '';

            // Financial Summary (26-38)
            sheet.getCell('K33').value = wpCurrent;                                     // 26. Work Performed
            sheet.getCell('K34').value = currentRetention === 0 ? 0 : -Math.abs(currentRetention);  // 27. 5% Retained
            sheet.getCell('K35').value = reimbursementThisPeriod;                       // 28. Reimbursement
            sheet.getCell('K36').value = subTotalValue;                                 // 29. Sub Total
            sheet.getCell('K37').value = currentMOSChange;                              // 30. Material on Site
            sheet.getCell('K38').value = -(Math.abs(currentCert?.liquidated_damages || 0)); // 31. Liquidated Damages
            sheet.getCell('K39').value = 0;                                             // 32. Reimbursement LqD
            sheet.getCell('K40').value = -(Math.abs(currentCert?.extra_retention || 0));    // 33. Extra Retainage
            sheet.getCell('K41').value = currentCert?.price_adjustment || 0;            // 34. Price Adjustment
            sheet.getCell('K42').value = -(Math.abs(currentCert?.insurance_fines || 0));    // 35. Safety Penalties
            sheet.getCell('K43').value = currentCert ? -(Math.abs(parseFloat(currentCert.other_penalties) || 0)) : 0; // 36. Other
            sheet.getCell('K45').value = netPaymentValue;                               // 37. Net Payment
            sheet.getCell('K46').value = wpTotalToDate;                                 // 38. Total to Date

            // Signatures (39-44)
            sheet.getCell('D34').value = contrData?.representative || '';                 // 39. Prepared by
            sheet.getCell('D36').value = personnelMap["Administrador del Proyecto"] || personnelMap["Ingeniero Residente"] || ''; // 40. Concurred by
            // 41. Received for Review - leave blank
            sheet.getCell('D40').value = personnelMap["Supervisor de Área"] || '';        // 42. Submitted for Review
            sheet.getCell('D42').value = personnelMap["Director Regional"] || '';         // 43. Approved by
            sheet.getCell('D45').value = personnelMap["Director Finanzas"] || '';         // 44. Approved for Payment

            // Percentages (45-46)
            sheet.getCell('C48').value = `${percentWPValue.toFixed(2)}%`;                // 45. % Work Performed
            sheet.getCell('C50').value = `${percentTimeValue.toFixed(2)}%`;              // 46. % Time
        };

        // Fill BACK sheet with data
        const fillBackSheet = (sheet: ExcelJS.Worksheet) => {
            // Liquidated Damages section
            if (ldFromDate) {
                sheet.getCell('H6').value = formatDate(ldFromDate);     // from date
                sheet.getCell('K6').value = formatDate(ldToDate);       // to date
            }
            sheet.getCell('C8').value = ldDays;                         // total days
            sheet.getCell('F8').value = ldRatePerDay;                   // per day rate
            sheet.getCell('N8').value = ldTotal;                        // 51. Total to Date
            sheet.getCell('D10').value = ldPrevious;                    // 52. Previous
            sheet.getCell('N10').value = ldThisPeriod;                  // 53. This Period

            // Reimbursement section - values from cert if present
            // 54-56 are typically left blank or manual

            // 59. Remarks - leave as template
            const remarksArr: string[] = [];
            if (currentCert?.liquidated_damages_notes) remarksArr.push(`Daños Líquidos: ${currentCert.liquidated_damages_notes}`);
            if (currentCert?.extra_retention_notes) remarksArr.push(`Retención Extra: ${currentCert.extra_retention_notes}`);
            if (currentCert?.price_adjustment_notes) remarksArr.push(`Ajuste Precio: ${currentCert.price_adjustment_notes}`);
            if (currentCert?.insurance_fines_notes) remarksArr.push(`Seguros/Multas: ${currentCert.insurance_fines_notes}`);
            if (currentCert?.other_penalties_notes) remarksArr.push(`Otras Penalidades: ${currentCert.other_penalties_notes}`);

            let remarkRow = 23; // Assuming remarks box starts around row 22-23
            remarksArr.forEach(r => {
                const cell = sheet.getCell(`B${remarkRow}`);
                cell.value = r;
                cell.font = { size: 9, bold: false };
                remarkRow++;
            });

            // 60. Distribution - leave as template
        };

        // For the first page, fill the existing sheets
        const firstPageItems = currentCertItems.slice(0, ITEMS_PER_PAGE);
        fillFrontSheet(frontSheet, firstPageItems, 1);
        fillBackSheet(backSheet);

        // Rename sheets
        frontSheet.name = `ACT-117C Pag 1 Frente`;
        backSheet.name = `ACT-117C Pag 1 Atras`;

        // If there are more pages, create additional sheet pairs
        if (totalPages > 1) {
            for (let p = 1; p < totalPages; p++) {
                const pageItems = currentCertItems.slice(p * ITEMS_PER_PAGE, (p + 1) * ITEMS_PER_PAGE);

                // Create new front sheet by cloning
                const newFrontName = `ACT-117C Pag ${p + 1} Frente`;
                const newFront = workbook.addWorksheet(newFrontName);
                await cloneSheetPerfectly(frontSheet, newFront);
                fillFrontSheet(newFront, pageItems, p + 1);

                // Create new back sheet by cloning
                const newBackName = `ACT-117C Pag ${p + 1} Atras`;
                const newBack = workbook.addWorksheet(newBackName);
                await cloneSheetPerfectly(backSheet, newBack);
                fillBackSheet(newBack);
            }
        }

        // Apply red formatting to negative numbers across all sheets in the workbook
        workbook.worksheets.forEach((sheet) => {
            applyNegativeRedFormatting(sheet);
        });

        const outBuffer = await workbook.xlsx.writeBuffer();
        return new Blob([outBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    } catch (err: any) {
        console.error("Error generating ACT-117C Excel:", err);
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

/**
 * Busca todos los números negativos en la hoja y les aplica el color rojo a la fuente.
 */
function applyNegativeRedFormatting(sheet: ExcelJS.Worksheet) {
    sheet.eachRow({ includeEmpty: false }, (row) => {
        row.eachCell({ includeEmpty: false }, (cell) => {
            const val = cell.value;
            // Caso de valor numérico negativo directo
            if (typeof val === 'number' && val < 0) {
                const existingFont = cell.font || {};
                cell.font = {
                    ...existingFont,
                    color: { argb: 'FFFF0000' } // Rojo ARGB
                };
            }
            // Caso de que sea una fórmula cuyo resultado sea negativo
            if (val && typeof val === 'object' && 'result' in val) {
                const res = (val as any).result;
                if (typeof res === 'number' && res < 0) {
                    const existingFont = cell.font || {};
                    cell.font = {
                        ...existingFont,
                        color: { argb: 'FFFF0000' }
                    };
                }
            }
        });
    });
}

