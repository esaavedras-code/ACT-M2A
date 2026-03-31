import { supabase } from './supabase';
import { formatDate as utilsFormatDate, formatCurrency as utilsFormatCurrency } from './utils';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Genera el reporte "CONTRACT FINAL REPORT"
 * Réplica exacta del formato oficial provisto en la imagen.
 */
export async function generateContractFinalReportLogic(projectId: string) {
    try {
        // 1. Fetch Data
        const { data: proj } = await supabase.from('projects').select('*').eq('id', projectId).single();
        if (!proj) throw new Error("Proyecto no encontrado");

        const { data: certs } = await supabase.from('payment_certifications')
            .select('*')
            .eq('project_id', projectId)
            .order('cert_num', { ascending: false });

        const { data: chos } = await supabase.from('chos')
            .select('*')
            .eq('project_id', projectId)
            .eq('doc_status', 'Aprobado')
            .order('cho_num', { ascending: true });

        // 2. Document Setup (Portrait Letter - Based on standard official look)
        const pdfDoc = await PDFDocument.create();
        const fR = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const fI = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

        // Official reports are usually Portrait or Landscape. 
        // Based on the "9. Contract Final Report" image, it looks like a standard vertical form but can be landscape if wide.
        // Let's use Portrait for this specific narrative report.
        const PW = 612, PH = 792;
        const ML = 50, MR = 50, MT = 40, MB = 40;
        const pg = pdfDoc.addPage([PW, PH]);

        const BK = rgb(0, 0, 0);

        // Helper functions
        const TXT = (txt: string | number | null | undefined, x: number, y: number, sz: number, bold = false, align: 'left' | 'center' | 'right' = 'left', maxW?: number) => {
            if (txt === undefined || txt === null) return;
            let s = txt.toString();
            const font = bold ? fB : fR;
            if (maxW) {
                if (font.widthOfTextAtSize(s, sz) > maxW - 2) {
                    // Simple truncation for now, could be improved with wrap
                    while (s.length > 1 && font.widthOfTextAtSize(s, sz) > maxW - 2) {
                        s = s.slice(0, -1);
                    }
                }
            }
            let px = x;
            if (align === 'center') px = x - font.widthOfTextAtSize(s, sz) / 2;
            if (align === 'right') px = x - font.widthOfTextAtSize(s, sz);
            pg.drawText(s, { x: px, y: PH - y, size: sz, font, color: BK });
            return font.widthOfTextAtSize(s, sz);
        };

        const LINE = (x1: number, y1: number, x2: number, y2: number, thick = 0.5) => {
            pg.drawLine({ start: { x: x1, y: PH - y1 }, end: { x: x2, y: PH - y2 }, thickness: thick, color: BK });
        };

        const WRAP_TXT = (text: string, x: number, y: number, sz: number, maxW: number, bold = false) => {
            const font = bold ? fB : fR;
            const words = text.split(' ');
            let line = '';
            let currentY = y;
            for (let n = 0; n < words.length; n++) {
                const testLine = line + words[n] + ' ';
                const testWidth = font.widthOfTextAtSize(testLine, sz);
                if (testWidth > maxW && n > 0) {
                    pg.drawText(line, { x, y: PH - currentY, size: sz, font, color: BK });
                    line = words[n] + ' ';
                    currentY += sz + 2;
                } else {
                    line = testLine;
                }
            }
            pg.drawText(line, { x, y: PH - currentY, size: sz, font, color: BK });
            return currentY;
        };

        // 3. Header
        TXT("COMMONWEALTH OF PUERTO RICO", PW / 2, 45, 10, true, 'center');
        TXT("PUERTO RICO HIGHWAY AND TRANSPORTATION AUTHORITY", PW / 2, 60, 11, true, 'center');
        TXT("SAN JUAN, PUERTO RICO", PW / 2, 75, 9, false, 'center');

        TXT("CONTRACT FINAL REPORT", PW / 2, 105, 14, true, 'center');
        LINE(PW / 2 - 85, 108, PW / 2 + 85, 108, 1);

        // 4. Narrative Paragraph
        let Y = 140;
        const narrative = `Contract entered into by the Executive Director, in behalf of the Puerto Rico Highway and Transportation Authority and ${proj.contractor_name || '[Contractor Name]'}, Contractor for the Construction of project ${proj.name || '[Project Name]'}, ACT No. ${proj.num_act || '---'}, Federal-Aid No. ${proj.num_federal || '---'} of Puerto Rico.`;
        Y = WRAP_TXT(narrative, ML, Y, 10, PW - ML - MR);

        // 5. Dates Section
        Y += 30;
        TXT("DATES", PW / 2, Y, 10, true, 'center');
        Y += 15;

        const dateFields = [
            { label: "Contract beginning date", val: utilsFormatDate(proj.date_project_start) },
            { label: "Original contract completion date", val: utilsFormatDate(proj.date_orig_completion) },
            { label: "Completion date extended to", val: utilsFormatDate(proj.date_rev_completion || proj.date_orig_completion) },
            { label: "Project completed on", val: utilsFormatDate(proj.date_real_completion) },
            { label: "Final inspection and acceptance date", val: utilsFormatDate(proj.date_substantial || proj.date_acceptance) }
        ];

        dateFields.forEach(f => {
            TXT(f.label, ML + 20, Y, 9);
            // Se mueven los valores 72 unidades (1 pulgada) a la derecha
            TXT(f.val || '---', PW - MR - 100 + 72, Y, 9, true, 'right');
            LINE(PW - MR - 100, Y + 2, PW - MR, Y + 2);
            Y += 15;
        });

        // 6. Financials Section
        Y += 20;
        TXT("FINANCIALS", PW / 2, Y, 10, true, 'center');
        Y += 15;

        TXT("Original Contract Price", ML + 20, Y, 9);
        TXT(utilsFormatCurrency(proj.cost_original), PW - MR, Y, 10, true, 'right');
        Y += 20;

        // Change Orders Table
        TXT("CHANGE ORDERS", ML + 20, Y, 9, true);
        Y += 12;
        LINE(ML + 20, Y, PW - MR, Y);
        Y += 15;

        // Distinguish between CHO and EWO if possible (using description or number)
        const regularCHOs = chos?.filter(c => !c.description?.toUpperCase().includes('EXTRA WORK') && !c.description?.toUpperCase().includes('EWO')) || [];
        const extraWorkOrders = chos?.filter(c => c.description?.toUpperCase().includes('EXTRA WORK') || c.description?.toUpperCase().includes('EWO')) || [];

        let chosTotal = 0;
        if (regularCHOs.length === 0) {
            TXT("None", ML + 40, Y, 9, false, 'left');
            Y += 15;
        } else {
            regularCHOs.forEach(c => {
                const choAmt = (c.items || []).reduce((acc: number, it: any) => acc + (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 0);
                TXT(`CHO No. ${c.cho_num}${c.amendment_letter || ''}`, ML + 40, Y, 9);
                TXT(utilsFormatCurrency(choAmt), PW - MR, Y, 9, false, 'right');
                chosTotal += choAmt;
                Y += 12;
            });
        }

        Y += 10;
        TXT("EXTRA WORK ORDERS", ML + 20, Y, 9, true);
        Y += 12;
        LINE(ML + 20, Y, PW - MR, Y);
        Y += 15;

        let ewoTotal = 0;
        if (extraWorkOrders.length === 0) {
            TXT("None", ML + 40, Y, 9, false, 'left');
            Y += 15;
        } else {
            extraWorkOrders.forEach(c => {
                const ewoAmt = (c.items || []).reduce((acc: number, it: any) => acc + (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 0);
                TXT(`EWO No. ${c.cho_num}${c.amendment_letter || ''}`, ML + 40, Y, 9);
                TXT(utilsFormatCurrency(ewoAmt), PW - MR, Y, 9, false, 'right');
                ewoTotal += ewoAmt;
                Y += 12;
            });
        }

        Y += 15;
        const totalAdjustments = chosTotal + ewoTotal;
        TXT("Total Contract Adjustments", ML + 20, Y, 9, true);
        TXT(utilsFormatCurrency(totalAdjustments), PW - MR, Y, 10, true, 'right');
        Y += 20;

        const finalContractPrice = (proj.cost_original || 0) + totalAdjustments;
        TXT("FINAL CONTRACT PRICE", ML + 20, Y, 10, true);
        TXT(utilsFormatCurrency(finalContractPrice), PW - MR, Y, 11, true, 'right');
        LINE(PW - MR - 120, Y + 3, PW - MR, Y + 3, 1);
        Y += 30;

        // 7. Deductions
        TXT("DEDUCTIONS / ADJUSTMENTS", PW / 2, Y, 10, true, 'center');
        Y += 15;

        // Fetch liquidated damages from last cert or project
        const lastCert = certs && certs.length > 0 ? certs[0] : null;
        const dedLiquidated = lastCert?.liquidated_damages || 0;
        const dedAdjustments = lastCert?.price_adjustments || 0;
        const dedRetainage = lastCert?.extra_retainage || 0;

        const deductionItems = [
            { label: "Liquidated Damages", val: dedLiquidated },
            { label: "Price Adjustments", val: dedAdjustments },
            { label: "Extra Retainage / Claims", val: dedRetainage }
        ];

        let totalDeductions = 0;
        deductionItems.forEach(d => {
            TXT(d.label, ML + 20, Y, 9);
            TXT(utilsFormatCurrency(d.val), PW - MR, Y, 9, false, 'right');
            totalDeductions += d.val;
            Y += 12;
        });

        Y += 5;
        TXT("Total Deductions", ML + 20, Y, 9, true);
        TXT(`(${utilsFormatCurrency(totalDeductions)})`, PW - MR, Y, 10, true, 'right');
        Y += 20;

        const finalProjectCost = finalContractPrice - totalDeductions;
        TXT("FINAL PROJECT COST", ML + 20, Y, 12, true);
        TXT(utilsFormatCurrency(finalProjectCost), PW - MR, Y, 13, true, 'right');
        LINE(PW - MR - 140, Y + 3, PW - MR, Y + 3, 1.5);
        Y += 50;

        // 8. Signatures
        const sigY = Y + 40;
        const sigW = 150;

        // Left Column
        TXT("Prepared by:", ML, Y, 8, true);
        LINE(ML, sigY, ML + sigW, sigY);
        TXT("Date:", ML + sigW + 10, sigY, 8);
        LINE(ML + sigW + 35, sigY, ML + sigW + 100, sigY);
        TXT("LIQUIDATOR", ML + sigW / 2, sigY + 12, 8, true, 'center');
        TXT(proj.liquidador_name || '_________________________', ML + sigW / 2, sigY - 5, 9, false, 'center');

        // Center Column
        const CX_MID = PW / 2 - sigW / 2;
        TXT("Reviewed by:", CX_MID, Y, 8, true);
        LINE(CX_MID, sigY, CX_MID + sigW, sigY);
        TXT("Date:", CX_MID + sigW + 5, sigY, 8);
        LINE(CX_MID + sigW + 28, sigY, CX_MID + sigW + 80, sigY);
        TXT("PROJECT ADMINISTRATOR", PW / 2, sigY + 12, 8, true, 'center');
        TXT(proj.admin_name || '_________________________', PW / 2, sigY - 5, 9, false, 'center');

        // Right Column
        const RX_START = PW - MR - sigW;
        TXT("Approved by:", RX_START, Y, 8, true);
        LINE(RX_START, sigY, PW - MR, sigY);
        TXT("Date:", RX_START + sigW - 30, sigY + 15, 8); // Moved date slightly for space
        LINE(RX_START + sigW - 10, sigY + 15, PW - MR, sigY + 15);
        TXT("CONTRACTOR REPRESENTATIVE", RX_START + sigW / 2, sigY + 12, 8, true, 'center');
        TXT(proj.contractor_name || '_________________________', RX_START + sigW / 2, sigY - 5, 9, false, 'center');

        Y = sigY + 60;
        TXT("Executive Director", PW / 2, Y + 40, 9, true, 'center');
        LINE(PW / 2 - 100, Y + 40, PW / 2 + 100, Y + 40);
        TXT("Edwin Gonzalez Montalvo, P.E.", PW / 2, Y + 35, 10, false, 'center');

        // 9. Footer
        TXT("Form ACT-CFR Revised 2024", ML, PH - 25, 7, false);

        // 10. Save and Return
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
        return blob;

    } catch (err: any) {
        console.error("Error generating Contract Final Report:", err);
        throw err;
    }
}
