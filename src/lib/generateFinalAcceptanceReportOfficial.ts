import { supabase } from './supabase';
import { formatDate as utilsFormatDate } from './utils';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Genera el reporte "FINAL ACCEPTANCE REPORT"
 * Réplica exacta de la imagen provista.
 */
export async function generateFinalAcceptanceReportOfficial(projectId: string) {
    try {
        // 1. Fetch Data
        const { data: proj } = await supabase.from('projects').select('*').eq('id', projectId).single();
        if (!proj) throw new Error("Proyecto no encontrado");

        // 2. Document Setup (Portrait Letter)
        const pdfDoc = await PDFDocument.create();
        const fR = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const PW = 612, PH = 792;
        const ML = 30, MR = 30;
        const pg = pdfDoc.addPage([PW, PH]);

        const BK = rgb(0, 0, 0);
        const RED = rgb(0.8, 0, 0);

        // Helper functions
        const TXT = (txt: string | number | null | undefined, x: number, y: number, sz: number, bold = false, align: 'left' | 'center' | 'right' = 'left', color = BK, maxW?: number) => {
            if (txt === undefined || txt === null) return;
            let s = txt.toString();
            const font = bold ? fB : fR;
            if (maxW) {
                while (s.length > 1 && font.widthOfTextAtSize(s, sz) > maxW - 2) {
                    s = s.slice(0, -1);
                }
            }
            let px = x;
            if (align === 'center') px = x - font.widthOfTextAtSize(s, sz) / 2;
            if (align === 'right') px = x - font.widthOfTextAtSize(s, sz);
            pg.drawText(s, { x: px, y: PH - y, size: sz, font, color });
        };

        const LINE = (x1: number, y1: number, x2: number, y2: number, thick = 0.5) => {
            pg.drawLine({ start: { x: x1, y: PH - y1 }, end: { x: x2, y: PH - y2 }, thickness: thick, color: BK });
        };

        const RECT = (x: number, y: number, w: number, h: number, thick = 0.5) => {
            pg.drawRectangle({ x, y: PH - y - h, width: w, height: h, borderWidth: thick, borderColor: BK });
        };

        // Logo FHWA (Left)
        try {
            const logoResp = await fetch(`${window.location.origin}/dot_logo.png`);
            if (logoResp.ok) {
                const logoBytes = await logoResp.arrayBuffer();
                const logoImg = await pdfDoc.embedPng(logoBytes);
                const dims = logoImg.scale(1);
                const targetHeight = 40;
                const targetWidth = (dims.width / dims.height) * targetHeight;
                pg.drawImage(logoImg, {
                    x: ML,
                    y: PH - 25 - targetHeight,
                    width: targetWidth,
                    height: targetHeight
                });
            } else {
                TXT("U.S. Department of", ML + 35, 60, 7.5, false);
                TXT("Transportation", ML + 35, 68, 7.5, false);
                TXT("Federal Highway", ML, 82, 9, true);
                TXT("Administration", ML, 92, 9, true);
            }
        } catch (e) {
            console.warn("Logo FHWA no cargado");
            TXT("U.S. Department of", ML + 35, 60, 7.5, false);
            TXT("Transportation", ML + 35, 68, 7.5, false);
            TXT("Federal Highway", ML, 82, 9, true);
            TXT("Administration", ML, 92, 9, true);
        }

        // Center Title
        TXT("FINAL ACCEPTANCE REPORT", PW / 2, 60, 16, true, 'center');
        TXT("(BORRADOR)", PW / 2, 80, 15, true, 'center');

        // Right Logo (ACT)
        try {
            const logoResp = await fetch(`${window.location.origin}/act_logo.png`);
            if (logoResp.ok) {
                const logoBytes = await logoResp.arrayBuffer();
                const logoImg = await pdfDoc.embedPng(logoBytes);
                const dims = logoImg.scaleToFit(100, 50);
                pg.drawImage(logoImg, {
                    x: PW - MR - dims.width,
                    y: PH - 25 - dims.height,
                    width: dims.width,
                    height: dims.height
                });
            }
        } catch (e) { console.warn("Logo PRHTA no cargado"); }

        // 4. Grid Section 1
        let Y = 110;
        const CW = PW - ML - MR;
        const COLW = CW / 4;

        RECT(ML, Y, CW, 65); // Division / Report No / Date / Project No boxes
        LINE(ML + COLW, Y, ML + COLW, Y + 65);
        LINE(ML + 2 * COLW, Y, ML + 2 * COLW, Y + 65);
        LINE(ML + 3 * COLW, Y, ML + 3 * COLW, Y + 65);
        LINE(ML, Y + 32, ML + CW, Y + 32); // Horizontal line separating rows

        // Row 1
        TXT("DIVISION", ML + 5, Y + 12, 8, true);
        TXT(proj.division || "FEDERAL-AID", ML + 5, Y + 25, 9);

        TXT("REPORT NO.", ML + COLW + 5, Y + 12, 8, true);
        TXT("---", ML + COLW + 5, Y + 25, 9);

        TXT("DATE OF FINAL", ML + 2 * COLW + 5, Y + 10, 8, true);
        TXT("INSPECTION", ML + 2 * COLW + 5, Y + 18, 8, true);
        TXT("REPORT", ML + 2 * COLW + 5, Y + 26, 8, true);
        TXT(utilsFormatDate(proj.date_substantial || proj.date_acceptance), ML + 2 * COLW + 55, Y + 25, 9);

        TXT("PROJECT NO.", ML + 3 * COLW + 5, Y + 12, 8, true);
        TXT(proj.num_federal || proj.num_act, ML + 3 * COLW + 5, Y + 25, 9);

        // Row 2
        Y += 32;
        TXT("DATE CONTRACT STARTED", ML + 5, Y + 12, 8, true);
        TXT(utilsFormatDate(proj.date_project_start), ML + 5, Y + 25, 9);

        TXT("DATE WORK COMPLETED", ML + COLW + 5, Y + 12, 8, true);
        TXT(utilsFormatDate(proj.date_rev_completion || proj.date_orig_completion), ML + COLW + 5, Y + 25, 9);

        TXT("ACCEPTANCE BY", ML + 2 * COLW + 5, Y + 12, 8, true);
        TXT("DTOP", ML + 2 * COLW + 5, Y + 22, 8, true);
        TXT(utilsFormatDate(proj.date_substantial || proj.date_acceptance), ML + 2 * COLW + 45, Y + 25, 9);

        TXT("TIME ELAPSED", ML + 3 * COLW + 5, Y + 12, 8, true);
        TXT(proj.final_working_days?.toString() || "---", ML + 3 * COLW + 5, Y + 25, 9);

        // 5. Location & Scope (translated if needed)
        const translateText = async (txt: string) => {
            if (!txt || !txt.trim()) return txt;
            try {
                const encoded = encodeURIComponent(txt);
                const transRes = await fetch(`https://api.mymemory.translated.net/get?q=${encoded}&langpair=es|en`);
                if (transRes.ok) {
                    const transData = await transRes.json();
                    if (transData?.responseData?.translatedText) return transData.responseData.translatedText;
                }
                return txt;
            } catch (e) { return txt; }
        };

        Y += 33;
        RECT(ML, Y, CW, 30);
        TXT("LOCATION:", ML + 5, Y + 15, 9, true);
        TXT(proj.location || "PUERTO RICO", ML + 60, Y + 15, 9);

        Y += 30;
        RECT(ML, Y, CW, 160);
        TXT("SCOPE OF PROJECT:", ML + 5, Y + 15, 9, true);
        
        let scope = proj.description || proj.name || "";
        scope = await translateText(scope);

        const wrappedScope = scope.match(/.{1,110}/g) || [];
        wrappedScope.slice(0, 10).forEach((line: string, i: number) => {
            TXT(line, ML + 5, Y + 35 + (i * 12), 9);
        });

        // 6. Note Section (Red)
        Y += 160;
        RECT(ML, Y, CW, 140);
        TXT("NOTE:", ML + 5, Y + 20, 9, true, 'left', RED);

        // Checkboxes
        let noteY = Y + 45;
        TXT("FHWA-47", ML + 5, noteY, 8.5, false, 'left', RED);
        RECT(ML + 55, noteY - 10, 10, 10); // Checkbox
        TXT("Submitted", ML + 75, noteY, 8.5, false, 'left', RED);

        noteY += 30;
        TXT("Materials Certification", ML + 5, noteY, 8.5, false, 'left', RED);
        RECT(ML + 105, noteY - 10, 10, 10); // Checkbox
        TXT(`Submitted ${utilsFormatDate(proj.date_acceptance)}`, ML + 125, noteY, 8.5, false, 'left', RED);

        noteY += 35;
        TXT("There is compliance with section 1.23 of the Regulations pertaining to encroachments on the right-of-way.", ML + 5, noteY, 8.5, false, 'left', RED);

        // 7. Remarks Section
        Y += 140;
        RECT(ML, Y, CW, 100);
        TXT("REMARKS:", ML + 5, Y + 25, 8, false);
        RECT(ML + 60, Y + 13, 12, 12); // Checkbox

        const remarksText = "SHA procedures and controls were sufficient to assure that this project completed in reasonably close conformance with the approved plans and specifications including authorized changes and extra work.";
        const wrappedRemarks = remarksText.match(/.{1,100}/g) || [];
        wrappedRemarks.forEach((line: string, i: number) => {
            TXT(line, ML + 80, Y + 25 + (i * 12), 8.5);
        });

        // 8. Signatures Section
        Y += 100;
        RECT(ML, Y, CW, 110);
        LINE(ML + CW / 2, Y, ML + CW / 2, Y + 110);

        // Left Signature Column
        TXT("ACCEPTANCE OF PROJECT IS RECOMMENDED", ML + (CW / 4), Y + 20, 8, true, 'center');
        LINE(ML + 5, Y + 40, ML + (CW / 2) - 5, Y + 40); // Top line
        TXT("Signature", ML + 5, Y + 50, 8);

        LINE(ML, Y + 75, ML + CW / 2, Y + 75); // Divider
        LINE(ML + (CW / 3), Y + 75, ML + (CW / 3), Y + 110); // Date divider
        TXT("Title Regional Director", ML + 5, Y + 85, 8);
        TXT("Date", ML + (CW / 3) + 5, Y + 85, 8);
        TXT(utilsFormatDate(new Date()), ML + (CW / 3) + 5, Y + 98, 9);

        // Right Signature Column
        const RX = ML + CW / 2;
        TXT("ACCEPTED BY FEDERAL HIGHWAY", RX + (CW / 4), Y + 15, 8, true, 'center');
        TXT("ADMINISTRATION", RX + (CW / 4), Y + 25, 8, true, 'center');
        TXT("Signature", RX + 5, Y + 50, 8);

        LINE(RX, Y + 75, RX + CW / 2, Y + 75); // Divider
        LINE(RX + (CW / 3), Y + 75, RX + (CW / 3), Y + 110); // Date divider
        TXT("Title", RX + (CW / 3) + 5, Y + 85, 8);

        // 9. Page numbering
        const pages = pdfDoc.getPages();
        pages.forEach((p, i) => {
            p.drawText(`Page ${i + 1} of ${pages.length}`, {
                x: PW - MR - 60,
                y: 25,
                size: 8,
                font: fR,
                color: BK
            });
        });

        // 10. Save and Return
        const pdfBytes = await pdfDoc.save();
        return new Blob([pdfBytes as any], { type: 'application/pdf' });
    } catch (err: any) {
        console.error("Error generating Official Final Acceptance Report:", err);
        throw err;
    }
}
