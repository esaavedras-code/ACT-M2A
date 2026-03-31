import { supabase } from './supabase';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Genera el reporte "ENVIRONMENTAL REVIEW CERTIFICATION"
 * Réplica exacta del formato oficial provisto en la imagen.
 */
export async function generateEnvironmentalReviewReportLogic(projectId: string) {
    try {
        // 1. Fetch Data
        const { data: proj } = await supabase.from('projects').select('*').eq('id', projectId).single();
        if (!proj) throw new Error("Proyecto no encontrado");

        // 2. Document Setup (Portrait Letter)
        const pdfDoc = await PDFDocument.create();
        const fR = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const PW = 612, PH = 792;
        const pg = pdfDoc.addPage([PW, PH]);
        const BK = rgb(0, 0, 0);

        const TXT = (txt: string | number | null | undefined, x: number, y: number, sz: number, bold = false, align: 'left' | 'center' | 'right' = 'left', maxW?: number) => {
            if (txt === undefined || txt === null) return;
            let s = txt.toString();
            const font = bold ? fB : fR;
            if (maxW && font.widthOfTextAtSize(s, sz) > maxW) {
                while (s.length > 0 && font.widthOfTextAtSize(s + "...", sz) > maxW) {
                    s = s.slice(0, -1);
                }
                s += "...";
            }
            let px = x;
            if (align === 'center') px = x - font.widthOfTextAtSize(s, sz) / 2;
            if (align === 'right') px = x - font.widthOfTextAtSize(s, sz);
            pg.drawText(s, { x: px, y: PH - y, size: sz, font, color: BK });
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
                    currentY += sz + 5;
                } else {
                    line = testLine;
                }
            }
            pg.drawText(line, { x, y: PH - currentY, size: sz, font, color: BK });
            return currentY;
        };

        // Header
        try {
            const logoUrl = '/act_logo.png';
            const logoBytes = await fetch(logoUrl).then(res => res.arrayBuffer());
            const logoImage = await pdfDoc.embedPng(logoBytes);
            const logoDims = logoImage.scale(0.18);
            pg.drawImage(logoImage, {
                x: 50,
                y: PH - 80,
                width: logoDims.width,
                height: logoDims.height,
            });
        } catch (e) {
            console.warn("No se pudo cargar el logo de ACT:", e);
        }

        TXT("Commonwealth of Puerto Rico", PW / 2, 50, 10, false, 'center');
        TXT("Department of Transportation and Public Works", PW / 2, 65, 11, false, 'center');
        TXT("HIGHWAY AND TRANSPORTATION AUTHORITY", PW / 2, 80, 12, true, 'center');
        TXT("ENVIRONMENTAL REVIEW CERTIFICATION", PW / 2, 95, 12, true, 'center');

        LINE(50, 105, PW - 50, 105, 1.5);
        LINE(50, 108, PW - 50, 108, 0.5);

        // Description
        let Y = 120;
        const ML = 50;
        TXT("Description", ML, Y, 11);
        WRAP_TXT(proj.name || '---', ML + 85, Y, 11, PW - ML - 90);

        Y += 45;
        // Se quitaron las líneas de Project Number, Federal Number y Contractor por requerimiento.

        // Certification Text
        Y += 60;
        TXT("This is to certify that:", ML, Y, 11);

        Y += 40;
        const certParagraph1 = "An Environmental Review was conducted for this project. A Summary Environmental Construction Commitments/Requirements Table is included with this certification.";
        Y = WRAP_TXT(certParagraph1, ML, Y, 11, PW - 2 * ML);

        Y += 30;
        const certParagraph2 = "Exceptions or modifications of the environmental permits or endorsement conditions (if any) are explained on the back hereof (or on an attached sheet).";
        Y = WRAP_TXT(certParagraph2, ML, Y, 11, PW - 2 * ML);

        // Signature
        Y += 80;
        // Placeholder for signature image if exists, or just line
        LINE(ML + 20, Y, ML + 200, Y);
        Y += 15;
        TXT("By", ML, Y, 11);
        TXT(proj.admin_name || '__________________________', ML + 20, Y, 11, true);
        Y += 15;
        TXT("Project Administrator", ML + 25, Y, 11);

        // --- FOOTER (Actualizado con el formato de DBE Participation) ---
        const footerY = PH - 40;
        const szFooter = 7.5;
        TXT("ROBERTO SÁNCHEZ VILELLA GOVERNMENT CENTER 300 JOSÉ DE DIEGO AVENUE SOUTH TOWER, 10TH FLOOR, SAN JUAN, PR 00911", PW / 2, footerY - 12, szFooter, false, 'center');
        TXT("PO BOX 42007, SAN JUAN, PR 00940-2007- 787-721-8787 - WWW.ACT.PR.GOV", PW / 2, footerY, szFooter, false, 'center');

        // Finalize
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
        return blob;

    } catch (err: any) {
        console.error("Error generating Environmental Review Report:", err);
        throw err;
    }
}
