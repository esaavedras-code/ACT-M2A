import { supabase } from './supabase';
import { formatDate as utilsFormatDate, formatCurrency } from './utils';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Genera el reporte "FINAL ESTIMATE"
 * Basado en el documento oficial de ACT (PRHTA) proporcionado.
 */
export async function generateFinalEstimateReportLogic(projectId: string) {
    try {
        // 1. Fetch data
        const { data: proj } = await supabase.from('projects').select('*').eq('id', projectId).single();
        if (!proj) throw new Error("Proyecto no encontrado");

        const { data: contractor } = await supabase.from('contractors').select('*').eq('project_id', projectId).single();
        const { data: items } = await supabase.from('contract_items').select('*').eq('project_id', projectId).order('item_num');
        const { data: chos } = await supabase.from('chos').select('*').eq('project_id', projectId).eq('doc_status', 'Aprobado');
        const { data: certs } = await supabase.from('payment_certifications').select('*').eq('project_id', projectId).order('cert_num');

        // 2. Setup Document (Landscape)
        const pdfDoc = await PDFDocument.create();
        const fR = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fRIt = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
        const fB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const PW = 792; // Landscape Letter
        const PH = 612;
        const ML = 30;
        const MR = 30;
        const MT = 25;
        const MB = 30;

        const BK = rgb(0, 0, 0);
        const GR = rgb(0.9, 0.9, 0.9);

        let page = pdfDoc.addPage([PW, PH]);
        let Y = MT;

        // Constants for columns
        const cols = [
            { label: "LINE NO.", w: 35 },
            { label: "ITEM NO.", w: 55 },
            { label: "SPEC. NO.", w: 55 },
            { label: "DESCRIPTION", w: 180 },
            { label: "UNIT", w: 40 },
            { label: "PROJECT QUANTITY", w: 75 },
            { label: "ESTIMATE QTY.", w: 75 },
            { label: "UNIT PRICE", w: 70 },
            { label: "PROJECT AMOUNT", w: 75 },
            { label: "ESTIMATE AMOUNT", w: 75 }
        ];

        // Shared drawing functions
        const TXT = (txt: string | number | null | undefined, x: number, y: number, sz: number, font = fR, align: 'left' | 'center' | 'right' = 'left') => {
            if (txt === undefined || txt === null) return;
            const s = txt.toString();
            let px = x;
            if (align === 'center') px = x - font.widthOfTextAtSize(s, sz) / 2;
            if (align === 'right') px = x - font.widthOfTextAtSize(s, sz);
            page.drawText(s, { x: px, y: PH - y, size: sz, font, color: BK });
        };

        const LINE = (x1: number, y1: number, x2: number, y2: number, thick = 0.5) => {
            page.drawLine({ start: { x: x1, y: PH - y1 }, end: { x: x2, y: PH - y2 }, thickness: thick, color: BK });
        };

        const drawHeader = () => {
            TXT("COMMONWEALTH OF PUERTO RICO", PW / 2, 35, 9, fB, 'center');
            TXT("DEPARTMENT OF TRANSPORTATION AND PUBLIC WORKS", PW / 2, 47, 9, fB, 'center');
            TXT("PUERTO RICO HIGHWAY AND TRANSPORTATION AUTHORITY", PW / 2, 59, 10, fB, 'center');
            TXT("FINAL ESTIMATE", PW / 2, 80, 14, fB, 'center');

            const projName = (proj.name || '').substring(0, 80);
            TXT(`PROJECT: ${projName}`, ML, 100, 9, fB);
            TXT(`ACT NO: ${proj.num_act}`, ML, 112, 9, fB);
            TXT(`CONTRACT NO: ${proj.num_contrato || 'N/A'}`, PW / 2, 100, 9, fB);
            TXT(`DATE: ${utilsFormatDate(new Date())}`, PW - MR, 112, 9, fB, 'right');
            return 130;
        };

        const drawTableHeader = (startY: number) => {
            let cx = ML;
            // Draw baseline
            LINE(ML, startY, PW - MR, startY, 0.5);

            cols.forEach(c => {
                // Vertical lines for header
                LINE(cx, startY, cx, startY + 25, 0.5);

                const labels = c.label.split(' ');
                if (labels.length > 1) {
                    TXT(labels[0], cx + c.w / 2, startY + 9, 7, fB, 'center');
                    TXT(labels[1], cx + c.w / 2, startY + 19, 7, fB, 'center');
                } else {
                    TXT(c.label, cx + c.w / 2, startY + 15, 7, fB, 'center');
                }
                cx += c.w;
            });
            // Closing line of header
            LINE(cx, startY, cx, startY + 25, 0.5);
            LINE(ML, startY + 25, PW - MR, startY + 25, 0.5);
            return startY + 25;
        };

        Y = drawHeader();
        Y = drawTableHeader(Y);
        let tableStartY = Y - 25;

        // Table Content
        let totalProjectAmount = 0;
        let totalEstimateAmount = 0;

        items?.forEach((item, idx) => {
            // New page logic
            if (Y > PH - 80) {
                // Close current table vertical borders before moving to next page
                let cx = ML;
                cols.forEach(c => {
                    LINE(cx, tableStartY, cx, Y);
                    cx += c.w;
                });
                LINE(cx, tableStartY, cx, Y);

                page = pdfDoc.addPage([PW, PH]);
                Y = drawHeader();
                Y = drawTableHeader(Y);
                tableStartY = Y - 25;
            }

            // Calculations
            const itemChos = chos?.filter(c => {
                const cItems = Array.isArray(c.items) ? c.items : [];
                return cItems.some((ci: any) => ci.item_num === item.item_num || ci.item_id === item.id);
            }) || [];

            const extraQty = itemChos.reduce((acc, c) => {
                const cItems = Array.isArray(c.items) ? c.items : [];
                const match = cItems.find((ci: any) => ci.item_num === item.item_num || ci.item_id === item.id);
                return acc + (parseFloat(match?.proposed_change) || 0);
            }, 0);

            const projQty = (parseFloat(item.quantity) || 0) + extraQty;
            const certQty = certs?.reduce((acc, c) => {
                const cItems = Array.isArray(c.items) ? c.items : (c.items?.list || []);
                const match = cItems.find((ci: any) => ci.item_num === item.item_num || ci.item_id === item.id);
                return acc + (parseFloat(match?.quantity) || 0);
            }, 0) || 0;

            const unitPrice = parseFloat(item.unit_price) || 0;
            const projAmt = projQty * unitPrice;
            const estimAmt = certQty * unitPrice;

            totalProjectAmount += projAmt;
            totalEstimateAmount += estimAmt;

            // Draw Row
            let cx = ML;
            const rowH = 15;

            TXT(idx + 1, cx + cols[0].w / 2, Y + 10, 8, fR, 'center'); cx += cols[0].w;
            TXT(item.item_num, cx + cols[1].w / 2, Y + 10, 8, fR, 'center'); cx += cols[1].w;
            TXT(item.specification || '', cx + cols[2].w / 2, Y + 10, 8, fR, 'center'); cx += cols[2].w;

            const desc = (item.description || '').substring(0, 40);
            TXT(desc, cx + 5, Y + 10, 7, fR); cx += cols[3].w;

            TXT(item.unit, cx + cols[4].w / 2, Y + 10, 8, fR, 'center'); cx += cols[4].w;
            TXT(projQty.toFixed(2), cx + cols[5].w - 5, Y + 10, 8, fR, 'right'); cx += cols[5].w;
            TXT(certQty.toFixed(2), cx + cols[6].w - 5, Y + 10, 8, fR, 'right'); cx += cols[6].w;
            TXT(unitPrice.toFixed(2), cx + cols[7].w - 5, Y + 10, 8, fR, 'right'); cx += cols[7].w;
            TXT(formatCurrency(projAmt).replace('$', ''), cx + cols[8].w - 5, Y + 10, 8, fR, 'right'); cx += cols[8].w;
            TXT(formatCurrency(estimAmt).replace('$', ''), cx + cols[9].w - 5, Y + 10, 8, fR, 'right');

            Y += rowH;
            LINE(ML, Y, PW - MR, Y, 0.3); // Row underline
        });

        // Close vertical borders for the final data rows
        let finalCX = ML;
        cols.forEach(c => {
            LINE(finalCX, tableStartY, finalCX, Y);
            finalCX += c.w;
        });
        LINE(finalCX, tableStartY, finalCX, Y);

        // Totals Row
        const totalW = cols[0].w + cols[1].w + cols[2].w + cols[3].w + cols[4].w + cols[5].w + cols[6].w + cols[7].w;
        LINE(ML, Y + 20, PW - MR, Y + 20, 0.5);
        LINE(ML, Y, ML, Y + 20);
        LINE(ML + totalW, Y, ML + totalW, Y + 20);
        LINE(ML + totalW + cols[8].w, Y, ML + totalW + cols[8].w, Y + 20);
        LINE(ML + totalW + cols[8].w + cols[9].w, Y, ML + totalW + cols[8].w + cols[9].w, Y + 20);

        TXT("TOTALS", ML + totalW - 10, Y + 13, 9, fB, 'right');
        TXT(formatCurrency(totalProjectAmount).replace('$', ''), ML + totalW + cols[8].w - 5, Y + 13, 9, fB, 'right');
        TXT(formatCurrency(totalEstimateAmount).replace('$', ''), ML + totalW + cols[8].w + cols[9].w - 5, Y + 13, 9, fB, 'right');
        Y += 40;

        // Summary Section (Totals and Deductions)
        if (Y > PH - 220) {
            page = pdfDoc.addPage([PW, PH]);
            Y = drawHeader() + 20;
        }

        const sumX = PW - MR - 250;
        const rowS = 14;
        const lastCert = certs?.[certs.length - 1];
        const certifiedToDate = totalEstimateAmount;
        const lessPrevious = certs && certs.length > 1 ? totalEstimateAmount - (parseFloat(lastCert?.total_payment) || 0) : 0;
        const amountThisEstimate = lastCert?.total_payment || (totalEstimateAmount - lessPrevious);
        const retention = lastCert?.retainage_amount || (amountThisEstimate * 0.05);

        TXT("CERTIFIED TO DATE:", sumX, Y, 9, fB); TXT(formatCurrency(certifiedToDate), PW - MR, Y, 9, fR, 'right'); Y += rowS;
        TXT("LESS PREVIOUS ESTIMATE:", sumX, Y, 9, fB); TXT(formatCurrency(lessPrevious), PW - MR, Y, 9, fR, 'right'); Y += rowS;
        LINE(sumX, Y - 2, PW - MR, Y - 2);
        TXT("AMOUNT OF THIS ESTIMATE:", sumX, Y, 9, fB); TXT(formatCurrency(amountThisEstimate), PW - MR, Y, 9, fR, 'right'); Y += rowS;
        TXT("LESS 5% RETENTION:", sumX, Y, 9, fB); TXT(`(${formatCurrency(retention)})`, PW - MR, Y, 9, fR, 'right'); Y += rowS;
        LINE(sumX, Y - 2, PW - MR, Y - 2, 1);
        TXT("TOTAL DUE THIS ESTIMATE:", sumX, Y, 10, fB); TXT(formatCurrency(amountThisEstimate - retention), PW - MR, Y, 10, fB, 'right'); Y += 40;

        // Signatures
        const sigW = 180;
        const sigY = Y + 40;

        LINE(ML, sigY, ML + sigW, sigY);
        TXT("LIQUIDATOR", ML + sigW / 2, sigY + 12, 8, fB, 'center');

        LINE(PW / 2 - sigW / 2, sigY, PW / 2 + sigW / 2, sigY);
        TXT("PROJECT ADMINISTRATOR", PW / 2, sigY + 12, 8, fB, 'center');

        LINE(PW - MR - sigW, sigY, PW - MR, sigY);
        TXT("CONTRACTOR REPRESENTATIVE", PW - MR - sigW / 2, sigY + 12, 8, fB, 'center');

        // Page numbering
        const pages = pdfDoc.getPages();
        pages.forEach((p, i) => {
            p.drawText(`Page ${i + 1} of ${pages.length}`, {
                x: PW / 2 - 20,
                y: 20,
                size: 8,
                font: fR,
                color: BK
            });
        });

        // Finalize
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
        return blob;
    } catch (err: any) {
        console.error("Error generating Final Estimate:", err);
        throw err;
    }
}
