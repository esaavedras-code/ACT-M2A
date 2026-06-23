import ExcelJS from 'exceljs';
import { supabase } from './supabase';
import { formatDate } from './utils';
import { ACT117B_TEMPLATE_BASE64 } from './act117bTemplate';

/**
 * Generates the ACT-117B Material On Site Balance Sheet Excel report.
 */
export async function generateAct117BExcel(projectId: string, certId: string, itemNum: string) {
    try {
        // 1. Fetch Data
        const { data: projData } = await supabase.from('projects').select('*').eq('id', projectId).single();
        if (!projData) throw new Error("Proyecto no encontrado");

        const { data: currentCert } = await supabase.from('payment_certifications').select('*').eq('id', certId).single();
        if (!currentCert) throw new Error("Certificación no encontrada");

        const { data: allCerts } = await supabase.from('payment_certifications')
            .select('*')
            .eq('project_id', projectId)
            .lte('cert_num', currentCert.cert_num)
            .order('cert_num', { ascending: true });

        const { data: itemData } = await supabase.from('contract_items')
            .select('*')
            .eq('project_id', projectId)
            .eq('item_num', itemNum)
            .single();

        // Find Header Info (Fields 3, 9, 10, 12, 13) from the FIRST certification that has MOS ADDITION
        let firstAdditionItem: any = null;
        if (allCerts && allCerts.length > 0) {
            for (const cert of allCerts) {
                const items = Array.isArray(cert.items) ? cert.items : (cert.items?.list || []);
                const it = items.find((i: any) => i.item_num === itemNum && (i.has_material_on_site === true || i.mos_invoice_num));
                if (it) {
                    firstAdditionItem = it;
                    break;
                }
            }
        }

        const currentItems = Array.isArray(currentCert.items) ? currentCert.items : (currentCert.items?.list || []);
        const currentItem = currentItems.find((it: any) => it.item_num === itemNum);

        // Prioritize the info from the addition cert, fallback to current
        const headerInfo = firstAdditionItem || currentItem;

        const invoiceNum = headerInfo?.mos_invoice_num || "";
        const provider = headerInfo?.mos_provider || "";
        const lotNum = headerInfo?.mos_lot_num || (headerInfo?.has_material_on_site ? "1" : "");
        const invoiceQty = parseFloat(headerInfo?.mos_quantity) || 0;
        const invoiceAmount = parseFloat(headerInfo?.mos_invoice_total) || 0;

        // Logical Calculations according to Instructions (Fields 14 & 15)
        const field14_InvoiceUP = invoiceQty > 0 ? invoiceAmount / invoiceQty : 0;
        const field8_75PercentUP = (itemData?.unit_price || 0) * 0.75;
        const field15_LotUP = Math.min(field8_75PercentUP, field14_InvoiceUP);

        // 2. Build Transaction List
        const allTransactions: any[] = [];
        (allCerts || []).forEach(cert => {
            const docItems = Array.isArray(cert.items) ? cert.items : (cert.items?.list || []);
            const it = docItems.find((i: any) => i.item_num === itemNum);

            if (it) {
                if (it.has_material_on_site) {
                    const q = parseFloat(it.mos_quantity) || 0;
                    if (q !== 0) {
                        allTransactions.push({
                            cert,
                            qty: q,
                            amt: Math.round(q * field15_LotUP * 100) / 100,
                            remark: "Add"
                        });
                    }
                }
                const deductQty = parseFloat(it.qty_from_mos) || 0;
                if (deductQty > 0) {
                    allTransactions.push({
                        cert,
                        qty: -deductQty,
                        amt: Math.round(-deductQty * field15_LotUP * 100) / 100,
                        remark: "Deduct"
                    });
                }
            }
        });

        // 3. Load Template
        const workbook = new ExcelJS.Workbook();
        const bufferTemplate = Buffer.from(ACT117B_TEMPLATE_BASE64, 'base64');
        await workbook.xlsx.load(bufferTemplate);

        const sheet = workbook.getWorksheet(1);
        if (!sheet) throw new Error("Template ACT-117B no tiene hojas");

        sheet.name = `Item ${itemNum}`.substring(0, 31);

        // 4. Fill Header Info
        sheet.getCell('G6').value = projData.name || '';
        sheet.getCell('G7').value = projData.num_act || '';
        sheet.getCell('F8').value = provider;
        sheet.getCell('F9').value = parseFloat(itemNum) || itemNum;
        
        const desc = itemData?.description || "";
        const addDesc = itemData?.additional_description || "";
        const fullDesc = [desc, addDesc].filter(Boolean).join(' - ');
        sheet.getCell('F10').value = fullDesc;

        const cellH11 = sheet.getCell('H11');
        cellH11.value = parseFloat(itemData?.quantity || 0);
        cellH11.numFmt = '#,##0.00####';
        sheet.getCell('H12').value = parseFloat(itemData?.unit_price || 0);
        sheet.getCell('H13').value = field8_75PercentUP;

        sheet.getCell('AJ7').value = invoiceNum;
        sheet.getCell('AJ9').value = parseFloat(lotNum) || lotNum;
        sheet.getCell('AJ10').value = itemData?.unit || '';

        sheet.getCell('AG11').value = invoiceAmount;
        const cellAG12 = sheet.getCell('AG12');
        cellAG12.value = invoiceQty;
        cellAG12.numFmt = '#,##0.00####';
        sheet.getCell('AG13').value = field14_InvoiceUP;
        sheet.getCell('T14').value = field15_LotUP;

        // 5. Clear Default Values from Template Table Rows (19 to 40)
        for (let r = 19; r <= 40; r++) {
            sheet.getCell(`A${r}`).value = null;
            sheet.getCell(`E${r}`).value = null;
            sheet.getCell(`G${r}`).value = null;
            sheet.getCell(`L${r}`).value = null;
            sheet.getCell(`R${r}`).value = null;
            sheet.getCell(`W${r}`).value = null;
            sheet.getCell(`AC${r}`).value = null;
        }

        // 6. Write Transactions
        let cumulativeQty = 0;
        let cumulativeAmount = 0;
        let lastItemAmount = 0;
        let currentRow = 19;

        for (const tx of allTransactions) {
            if (currentRow > 40) break; // Keep within template table range

            cumulativeQty = parseFloat((cumulativeQty + tx.qty).toFixed(6));
            cumulativeAmount = Math.round(cumulativeQty * field15_LotUP * 100) / 100;

            sheet.getCell(`A${currentRow}`).value = formatDate(tx.cert.cert_date);
            sheet.getCell(`E${currentRow}`).value = parseFloat(tx.cert.cert_num) || tx.cert.cert_num;
            const cellG = sheet.getCell(`G${currentRow}`);
            cellG.value = tx.qty;
            cellG.numFmt = '#,##0.00####';
            sheet.getCell(`L${currentRow}`).value = tx.amt;
            const cellR = sheet.getCell(`R${currentRow}`);
            cellR.value = cumulativeQty;
            cellR.numFmt = '#,##0.00####';
            sheet.getCell(`W${currentRow}`).value = cumulativeAmount;
            sheet.getCell(`AC${currentRow}`).value = tx.remark;

            if (tx.cert.id === certId) {
                lastItemAmount = Math.round((lastItemAmount + tx.amt) * 100) / 100;
            }

            currentRow++;
        }

        // 7. Write Bottom Summary Info
        sheet.getCell('M42').value = parseFloat(itemNum) || itemNum;
        sheet.getCell('U42').value = parseFloat(currentCert.cert_num) || currentCert.cert_num;
        sheet.getCell('X42').value = lastItemAmount;

        sheet.getCell('R44').value = parseFloat(currentCert.cert_num) || currentCert.cert_num;
        sheet.getCell('X44').value = cumulativeAmount;

        // Ensure page numbers are updated
        sheet.getCell('Q46').value = 1;
        sheet.getCell('T46').value = 1;

        // 8. Generate Buffer
        const outBuffer = await workbook.xlsx.writeBuffer();
        return new Blob([outBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    } catch (err: any) {
        console.error("Error generating ACT-117B Excel:", err);
        throw err;
    }
}
