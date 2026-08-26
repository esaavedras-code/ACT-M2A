import ExcelJS from 'exceljs';
import { supabase } from './supabase';
import { formatDate } from './utils';

export async function generateCertificationsSummaryExcel(projectId: string): Promise<Blob> {
    const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single();
    if (!project) throw new Error('Project not found');

    const { data: certs } = await supabase
        .from('payment_certifications')
        .select('*')
        .eq('project_id', projectId)
        .order('cert_num', { ascending: true });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Resumen de Certificaciones');

    // Headers — se agrega columna MOS (Material on Site)
    sheet.columns = [
        { header: 'Cert #', key: 'cert_num', width: 10 },
        { header: 'Proyecto', key: 'project', width: 25 },
        { header: 'Contratista', key: 'contractor', width: 30 },
        { header: 'Fecha', key: 'date', width: 15 },
        { header: 'Monto Certificado', key: 'amount', width: 20 },
        { header: 'Retención y Otros', key: 'retention', width: 20 },
        { header: 'MOS (Material on Site)', key: 'mos', width: 24 },
        { header: 'Monto Pagado', key: 'paid', width: 20 },
        { header: 'Estado', key: 'status', width: 15 },
        { header: 'Ya se pagó', key: 'is_paid', width: 15 },
        { header: 'Excluido', key: 'excluded', width: 15 }
    ];

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { horizontal: 'center' };

    let totalAmount = 0;
    let totalRetention = 0;
    let totalMOS = 0;
    let totalPaid = 0;

    // Colores para valores negativos
    const RED_COLOR: ExcelJS.Color = { argb: 'FFCC0000' };
    const BLACK_COLOR: ExcelJS.Color = { argb: 'FF000000' };

    // Helper: aplica formato y color a una celda según si el valor es negativo
    const applyNegativeFormatting = (cell: ExcelJS.Cell, value: number, bold = false) => {
        if (value < 0) {
            cell.numFmt = '"$"#,##0.00_);[Red]("$"#,##0.00)';
            cell.font = { color: RED_COLOR, bold };
        } else {
            cell.numFmt = '"$"#,##0.00';
            cell.font = { color: BLACK_COLOR, bold };
        }
    };

    const { data: contractItems } = await supabase
        .from('contract_items')
        .select('*')
        .eq('project_id', projectId);

    const getInvoicePU = (certsList: any[], itemNum: string, currentCertIdx: number) => {
        for (let i = currentCertIdx; i >= 0; i--) {
            if (!certsList[i]) continue;
            if (certsList[i].excluded) continue;
            const its = Array.isArray(certsList[i].items) ? certsList[i].items : (certsList[i].items?.list || []);
            const match = its.find((itx: any) => itx.item_num === itemNum && itx.has_material_on_site && parseFloat(itx.mos_unit_price) > 0);
            if (match) return parseFloat(match.mos_unit_price);
        }
        return 0;
    };
    const perItemMosBalance: Record<string, number> = {};

    const allCerts = certs || [];

    allCerts.forEach((cert, cIdx) => {
        const certItems = Array.isArray(cert.items) ? cert.items : (cert.items?.list || []);
        let certAmount = 0;
        certItems.forEach((it: any) => {
            let liveUP = parseFloat(it.unit_price) || 0;
            if (contractItems) {
                const normIt = (n: any) => {
                    const s = String(n || '').trim();
                    if (/^\d+$/.test(s)) return parseInt(s, 10).toString().padStart(3, '0').slice(0, 3);
                    return s;
                };
                const masterIt = contractItems.find(m => normIt(m.item_num) === normIt(it.item_num));
                if (masterIt) liveUP = parseFloat(masterIt.unit_price) || 0;
            }
            certAmount += (parseFloat(it.quantity) || 0) * liveUP;
        });

        let retention = 0;
        if (!cert.skip_retention) {
            certItems.forEach((it: any) => {
                if (it.skip_retention !== true && it.skip_retention !== 'true') {
                    let liveUP = parseFloat(it.unit_price) || 0;
                    if (contractItems) {
                        const normIt = (n: any) => {
                            const s = String(n || '').trim();
                            if (/^\d+$/.test(s)) return parseInt(s, 10).toString().padStart(3, '0').slice(0, 3);
                            return s;
                        };
                        const masterIt = contractItems.find(m => normIt(m.item_num) === normIt(it.item_num));
                        if (masterIt) liveUP = parseFloat(masterIt.unit_price) || 0;
                    }
                    retention += ((parseFloat(it.quantity) || 0) * liveUP) * 0.05;
                }
            });
        }

        const extraRet  = parseFloat(String(cert.extra_retention    || '0').replace(/,/g, '')) || 0;
        const insFines  = parseFloat(cert.insurance_fines            || '0') || 0;
        const penalties = parseFloat(cert.other_penalties            || '0') || 0;
        const dlq       = parseFloat(String(cert.liquidated_damages  || '0').replace(/,/g, '')) || 0;
        const priceAdj  = parseFloat(cert.price_adjustment           || '0') || 0;
        const refund    = parseFloat(String(cert.refund              || '0').replace(/,/g, '')) || 0;

        let retReturn = 0;
        if (cert.show_retention_return) {
            retReturn = parseFloat(cert.retention_return_amount || '0') || 0;
        }

        const totalRetAndPen = retention + extraRet + insFines + penalties + dlq - priceAdj - refund - retReturn;

        // --- Cálculo de MOS (Material on Site) ---
        let mosCertNet = 0;
        certItems.forEach((it: any) => {
            const itemNum = it.item_num;
            if (!itemNum) return;

            let liveUP = parseFloat(it.unit_price) || 0;
            if (contractItems) {
                const normIt = (n: any) => {
                    const s = String(n || '').trim();
                    if (/^\d+$/.test(s)) return parseInt(s, 10).toString().padStart(3, '0').slice(0, 3);
                    return s;
                };
                const masterIt = contractItems.find(m => normIt(m.item_num) === normIt(it.item_num));
                if (masterIt) liveUP = parseFloat(masterIt.unit_price) || 0;
            }

            const qty = parseFloat(it.quantity) || 0;
            const manualDeductionQty = parseFloat(it.qty_from_mos) || 0;
            const hasAddition = !!it.has_material_on_site || (it.mos_invoice_total && parseFloat(it.mos_invoice_total) > 0);
            
            const currentBalance = perItemMosBalance[itemNum] || 0;
            const mosPU = getInvoicePU(allCerts, itemNum, cIdx);
            const price = mosPU > 0 ? mosPU : liveUP;

            const additionCostThisCert = hasAddition ? (parseFloat(it.mos_invoice_total) || 0) : 0;
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
                const cost = parseFloat(it.mos_invoice_total) || 0;
                perItemMosBalance[itemNum] = currentBalance + cost;
            }

            let deductedCost = 0;
            if (deductionQty > 0) {
                deductedCost = deductionQty * price;
                const newBal = (perItemMosBalance[itemNum] || 0) - deductedCost;
                perItemMosBalance[itemNum] = Math.max(0, newBal);
            }

            mosCertNet += additionCostThisCert - deductedCost;
        });

        const netPaid = certAmount - totalRetAndPen + mosCertNet;

        if (!cert.excluded) {
            totalAmount    += certAmount;
            totalRetention += totalRetAndPen;
            totalMOS       += mosCertNet;
            totalPaid      += netPaid;
        }

        const dataRow = sheet.addRow({
            cert_num:   cert.cert_num,
            project:    project.name || project.num_act,
            contractor: project.contractor_name,
            date:       formatDate(cert.cert_date),
            amount:     certAmount,
            retention:  totalRetAndPen,
            mos:        mosCertNet,
            paid:       netPaid,
            status:     cert.excluded ? 'Excluido' : 'Vigente',
            is_paid:    cert.is_paid ? 'Sí' : 'No',
            excluded:   cert.excluded ? 'Sí' : 'No'
        });

        applyNegativeFormatting(dataRow.getCell('amount'),    certAmount);
        applyNegativeFormatting(dataRow.getCell('retention'), totalRetAndPen);
        applyNegativeFormatting(dataRow.getCell('mos'),       mosCertNet);
        applyNegativeFormatting(dataRow.getCell('paid'),      netPaid);
    });

    // --- Fila de totales ---
    const totalRow = sheet.addRow({
        date:      'TOTALES',
        amount:    totalAmount,
        retention: totalRetention,
        mos:       totalMOS,
        paid:      totalPaid,
    });

    applyNegativeFormatting(totalRow.getCell('amount'),    totalAmount,    true);
    applyNegativeFormatting(totalRow.getCell('retention'), totalRetention, true);
    applyNegativeFormatting(totalRow.getCell('mos'),       totalMOS,       true);
    applyNegativeFormatting(totalRow.getCell('paid'),      totalPaid,      true);

    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
