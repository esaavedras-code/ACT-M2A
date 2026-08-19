import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { fetchAllReportData } from './reportLogic';
import { formatDate, formatCurrency, sortItemsNaturally } from './utils';

export const generateSolicitudMaterialCertPdf = async (projectId: string): Promise<Blob | null> => {
    const { project, items, certs, chos, mfgCerts } = await fetchAllReportData(projectId);
    if (!project || !items) return null;

    // 1. Gather Data

    // Section 1: Partidas no ejecutadas
    const certQtyMap = new Map<string, number>();
    (certs || []).forEach((c: any) => {
        const certItems = Array.isArray(c.items) ? c.items : (c.items?.list || []);
        certItems.forEach((it: any) => {
            if (it.item_num) {
                const prev = certQtyMap.get(it.item_num) || 0;
                certQtyMap.set(it.item_num, prev + (parseFloat(it.quantity) || 0));
            }
        });
    });

    const unexecutedData: any[] = [];
    items.forEach((i: any) => {
        const qty = certQtyMap.get(i.item_num) || 0;
        if (qty <= 0) {
            unexecutedData.push({
                item_num: i.item_num,
                description: i.description || i.specification || ''
            });
        }
    });
    // Add CHO items too if they are unexecuted? The old logic did it. Let's do it for all items.
    (chos || []).forEach((c: any) => {
        const choItems = Array.isArray(c.items) ? c.items : [];
        choItems.forEach((ci: any) => {
            if (ci.item_num && !unexecutedData.find(u => u.item_num === ci.item_num)) {
                const qty = certQtyMap.get(ci.item_num) || 0;
                if (qty <= 0) {
                    unexecutedData.push({
                        item_num: ci.item_num,
                        description: ci.description || ci.specification || ''
                    });
                }
            }
        });
    });
    sortItemsNaturally(unexecutedData);

    // Section 2: Partidas con CM
    const cmData: any[] = [];
    const allKnownItems = [...items];
    (chos || []).forEach((c: any) => {
        const choItems = Array.isArray(c.items) ? c.items : [];
        choItems.forEach((ci: any) => {
            if (!allKnownItems.find(x => x.item_num === ci.item_num)) {
                allKnownItems.push(ci);
            }
        });
    });
    
    allKnownItems.forEach((i: any) => {
        if (i.requires_mfg_cert) {
            cmData.push({
                item_num: i.item_num,
                description: i.description || i.specification || ''
            });
        }
    });
    sortItemsNaturally(cmData);

    // Section 3: Materiales con descuento
    const discountData: any[] = [];
    (certs || []).forEach((c: any) => {
        if (c.extra_retention_breakdown && Array.isArray(c.extra_retention_breakdown)) {
            c.extra_retention_breakdown.forEach((b: any) => {
                discountData.push({
                    item_num: b.item_num,
                    description: b.description || '',
                    cert_num: String(c.cert_num),
                    amount: b.amount
                });
            });
        }
    });
    sortItemsNaturally(discountData);

    // Section 4: Materiales rechazados (None for now as per ACT schema, display N/A)
    const rejectedData: any[] = [];

    // Section 5: Partidas con trabajos adicionales (888)
    const extraWorkData: any[] = [];
    (chos || []).forEach((c: any) => {
        const choItems = Array.isArray(c.items) ? c.items : [];
        choItems.forEach((ci: any) => {
            if (ci.specification && ci.specification.toString().includes('888')) {
                extraWorkData.push({
                    item_num: ci.item_num,
                    description: ci.description || '',
                    justification: c.justification || 'Sin justificación provista.'
                });
            }
        });
    });
    sortItemsNaturally(extraWorkData);

    // 2. PDF Setup
    const pdfDoc = await PDFDocument.create();
    const fR = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    const PW = 612, PH = 792;
    const ML = 40, MR = 40, MT = 40, MB = 40;
    const CW = PW - ML - MR;
    
    let pg = pdfDoc.addPage([PW, PH]);
    let curY = MT;
    const BK = rgb(0,0,0);

    const checkPage = (heightNeeded: number) => {
        if (curY + heightNeeded > PH - MB) {
            pg = pdfDoc.addPage([PW, PH]);
            curY = MT;
        }
    };

    const TXT = (txt: string, x: number, y: number, sz: number, bold = false, align: 'left'|'center'|'right' = 'left', maxW?: number) => {
        if (!txt) return;
        const font = bold ? fB : fR;
        let s = txt.toString().replace(/[\x00-\x09\x0B-\x1F]/g, '');
        if (maxW) {
            while (s.length > 1 && font.widthOfTextAtSize(s, sz) > maxW - 2) s = s.slice(0, -1);
        }
        let px = x;
        if (align === 'center') px = x - font.widthOfTextAtSize(s, sz) / 2;
        if (align === 'right') px = x - font.widthOfTextAtSize(s, sz);
        pg.drawText(s, { x: px, y: PH - y, size: sz, font, color: BK });
    };

    // --- Header ---
    TXT("SOLICITUD DEL MATERIAL CERTIFICATION", PW/2, curY, 14, true, 'center');
    curY += 30;

    const lblX = ML;
    const valX = ML + 100;
    TXT("Proyecto:", lblX, curY, 10, true); TXT(`${project.num_act || ''} - ${project.name || ''}`, valX, curY, 10, false, 'left', CW - 100); curY += 15;
    TXT("# Federal:", lblX, curY, 10, true); TXT(project.fed_num || 'N/A', valX, curY, 10); curY += 15;
    TXT("Contrato:", lblX, curY, 10, true); TXT(project.contract_number || 'N/A', valX, curY, 10); curY += 15;
    TXT("Fecha comienzo:", lblX, curY, 10, true); TXT(formatDate(project.date_project_start), valX, curY, 10); curY += 15;
    TXT("Fecha terminación:", lblX, curY, 10, true); TXT(formatDate(project.date_real_completion), valX, curY, 10); curY += 25;

    // --- Helpers para Tablas ---
    const drawTable = (title: string, headers: string[], cols: number[], data: string[][]) => {
        checkPage(40);
        TXT(title, ML, curY, 11, true);
        curY += 15;

        if (data.length === 0) {
            TXT("N/A", ML + 10, curY, 10, false);
            curY += 20;
            return;
        }

        // Header
        checkPage(20);
        pg.drawRectangle({ x: ML, y: PH - curY - 12, width: CW, height: 16, color: rgb(0.9, 0.9, 0.9) });
        let cx = ML;
        headers.forEach((h, i) => {
            TXT(h, cx + 5, curY, 9, true);
            cx += cols[i];
        });
        curY += 16;

        // Rows
        data.forEach(row => {
            // Find max lines needed for this row
            let maxLines = 1;
            const wrappedRow = row.map((cell, i) => {
                const words = cell.toString().split(' ');
                const lines: string[] = [];
                let currentLine = '';
                words.forEach(w => {
                    const test = currentLine ? currentLine + ' ' + w : w;
                    if (fR.widthOfTextAtSize(test, 9) > cols[i] - 10) {
                        lines.push(currentLine);
                        currentLine = w;
                    } else {
                        currentLine = test;
                    }
                });
                if (currentLine) lines.push(currentLine);
                if (lines.length > maxLines) maxLines = lines.length;
                return lines;
            });

            checkPage(maxLines * 12 + 6);
            
            // Draw cells
            wrappedRow.forEach((lines, i) => {
                let cellX = ML;
                for(let j=0; j<i; j++) cellX += cols[j];
                
                lines.forEach((ln, lIdx) => {
                    TXT(ln, cellX + 5, curY + (lIdx * 12), 9);
                });
            });
            
            curY += (maxLines * 12) + 4;
            pg.drawLine({ start: { x: ML, y: PH - curY + 2 }, end: { x: PW - MR, y: PH - curY + 2 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
        });
        curY += 10;
    };

    // --- Sections ---

    // 1
    const t1Title = `1. Partidas no ejecutadas (${unexecutedData.length})`;
    const t1Cols = [80, CW - 80];
    const t1Data = unexecutedData.map(d => [d.item_num, d.description]);
    drawTable(t1Title, ['Item No.', 'Descripción del ítem'], t1Cols, t1Data);

    // 2
    const t2Title = `2. Partidas con certificados de manufactura (CM) (${cmData.length})`;
    const t2Cols = [80, CW - 80];
    const t2Data = cmData.map(d => [d.item_num, d.description]);
    drawTable(t2Title, ['Item No.', 'Descripción del ítem'], t2Cols, t2Data);

    // 3
    const t3Title = `3. Materiales con descuento (${discountData.length})`;
    const t3Cols = [60, CW - 190, 60, 70];
    const t3Data = discountData.map(d => [d.item_num, d.description, `Cert #${d.cert_num}`, formatCurrency(parseFloat(d.amount)||0)]);
    drawTable(t3Title, ['Item No.', 'Descripción', 'Certificación', 'Descuento'], t3Cols, t3Data);

    // 4
    const t4Title = `4. Materiales rechazados (0)`;
    drawTable(t4Title, [], [], []); // Will just output N/A

    // 5
    const t5Title = `5. Partidas con trabajos adicionales (${extraWorkData.length})`;
    const t5Cols = [60, 160, CW - 220];
    const t5Data = extraWorkData.map(d => [d.item_num, d.description, d.justification]);
    drawTable(t5Title, ['Item No.', 'Descripción del ítem', 'Justificación (CHO)'], t5Cols, t5Data);

    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes as any], { type: 'application/pdf' });
};
