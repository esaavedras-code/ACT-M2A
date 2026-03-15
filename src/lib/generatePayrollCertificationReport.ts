import { supabase } from './supabase';
import { formatDate as utilsFormatDate } from './utils';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Genera el reporte "PAYROLL CERTIFICATION"
 * Réplica exacta de la imagen provista.
 */
export async function generatePayrollCertificationReport(projectId: string) {
    try {
        // 1. Fetch Data
        const { data: proj } = await supabase.from('projects').select('*').eq('id', projectId).single();
        if (!proj) throw new Error("Proyecto no encontrado");

        const { data: contr } = await supabase.from('contractors').select('name').eq('project_id', projectId).single();
        const contractorName = contr?.name || proj.contractor_name || '---';

        // 2. Document Setup (Portrait Letter)
        const pdfDoc = await PDFDocument.create();
        const fR = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const PW = 612, PH = 792;
        const ML = 55, MR = 55;
        const pg = pdfDoc.addPage([PW, PH]);

        const BK = rgb(0, 0, 0);

        // Helper functions
        const TXT = (txt: string | number | null | undefined, x: number, y: number, sz: number, bold = false, align: 'left' | 'center' | 'right' = 'left', color = BK, maxW?: number) => {
            if (txt === undefined || txt === null) return;
            let s = txt.toString();
            const font = bold ? fB : fR;
            if (maxW) {
                // simple wrap logic if needed, but for now just truncate
                if (font.widthOfTextAtSize(s, sz) > maxW) {
                    // logic for multi-line could go here if description is long
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

        // 3. Header Section (Logos & Title)
        // Logo ACT (Left Top)
        try {
            const logoResp = await fetch(`${window.location.origin}/act_logo.png`);
            if (logoResp.ok) {
                const logoBytes = await logoResp.arrayBuffer();
                const logoImg = await pdfDoc.embedPng(logoBytes);
                const dims = logoImg.scaleToFit(140, 65);
                pg.drawImage(logoImg, {
                    x: ML,
                    y: PH - 25 - dims.height,
                    width: dims.width,
                    height: dims.height
                });
            }
        } catch (e) { console.warn("Logo PRHTA no cargado"); }

        // Header Text
        let curY = 105;
        TXT("Commonwealth of Puerto Rico", PW / 2, curY, 14, false, 'center');
        curY += 20;
        TXT("Department of Transportation and Public Works", PW / 2, curY, 14, false, 'center');
        curY += 20;
        TXT("HIGHWAY AND TRANSPORTATION AUTHORITY", PW / 2, curY, 14, true, 'center');

        curY += 35;
        TXT("PAYROLL CERTIFICATION", PW / 2, curY, 14, true, 'center');

        curY += 10;
        LINE(ML, curY, PW - MR, curY, 1);
        LINE(ML, curY + 2, PW - MR, curY + 2, 0.5);

        // 4. Project Information Block
        curY += 50;
        const labelX = ML;
        const valueX = ML + 110;
        const szLabel = 11;
        const szValue = 11;

        TXT("Project Number:", labelX, curY, szLabel, true);
        TXT(proj.num_act, valueX, curY, szValue);
        curY += 18;

        TXT("Federal Number:", labelX, curY, szLabel, true);
        TXT(proj.num_federal || '---', valueX, curY, szValue);
        curY += 18;

        TXT("Description:", labelX, curY, szLabel, true);
        // Wrap description if long
        const desc = proj.description || proj.name || '---';
        const wrappedDesc = desc.match(/.{1,70}/g) || [];
        wrappedDesc.forEach((line: string, i: number) => {
            TXT(line, valueX, curY + (i * 15), szValue);
        });
        curY += (wrappedDesc.length * 15) + 3;

        TXT("Contractor:", labelX, curY, szLabel, true);
        TXT(contractorName, valueX, curY, szValue);
        curY += 18;

        TXT("Date Accepted:", labelX, curY, szLabel, true);
        TXT(utilsFormatDate(proj.date_acceptance) || '---', valueX, curY, szValue);

        // 5. Certification Text
        curY += 60;
        TXT("This is to certify that:", ML, curY, 12);

        curY += 35;
        const bodyText = "            The Contractor complies with all the applicable Federal and Commonwealth laws, rules and regulations concerning fair labor practices including minimum wages, work hours, equal employment opportunities, nondiscrimination, civil rights, employment of minors, and other labor relation matters.";

        // Justified text drawing logic
        const CW = PW - ML - MR;
        const words = bodyText.split(' ');
        const lines: string[][] = [];
        let currentLine: string[] = [];
        let currentW = 0;
        const spaceW = fR.widthOfTextAtSize(' ', 12);

        words.forEach(word => {
            const wordW = fR.widthOfTextAtSize(word, 12);
            if (currentW + wordW + (currentLine.length > 0 ? spaceW : 0) <= CW) {
                currentLine.push(word);
                currentW += wordW + (currentLine.length > 0 ? spaceW : 0);
            } else {
                lines.push(currentLine);
                currentLine = [word];
                currentW = wordW;
            }
        });
        lines.push(currentLine);

        lines.forEach((lineWords, i) => {
            const isLastLine = i === lines.length - 1;
            const lineY = curY + (i * 18);

            if (isLastLine || lineWords.length === 1) {
                // Left align last line
                pg.drawText(lineWords.join(' '), { x: ML, y: PH - lineY, size: 12, font: fR, color: BK });
            } else {
                // Justify line
                const totalWordsW = lineWords.reduce((acc, w) => acc + fR.widthOfTextAtSize(w, 12), 0);
                const gapW = (CW - totalWordsW) / (lineWords.length - 1);
                let startX = ML;
                lineWords.forEach((word, wordIdx) => {
                    pg.drawText(word, { x: startX, y: PH - lineY, size: 12, font: fR, color: BK });
                    startX += fR.widthOfTextAtSize(word, 12) + gapW;
                });
            }
        });

        const bodyTotalH = lines.length * 18;

        // 6. Signature Block
        curY += (lines.length * 18) + 120;
        TXT("By:", ML, curY, 12, false);
        LINE(ML + 35, curY + 2, ML + 220, curY + 2, 0.8);

        curY += 25;
        if (proj.admin_name) {
            TXT(proj.admin_name, ML + 127.5, curY, 11, false, 'center');
        }
        curY += 15;
        TXT("Resident Engineer", ML + 127.5, curY, 11, false, 'center');

        // 7. Footer
        const footerY = PH - 40;
        const szFooter = 7.5;
        TXT("ROBERTO SÁNCHEZ VILELLA GOVERNMENT CENTER 300 JOSÉ DE DIEGO AVENUE SOUTH TOWER, 10TH FLOOR, SAN JUAN, PR 00911", PW / 2, footerY - 12, szFooter, false, 'center');
        TXT("PO BOX 42007, SAN JUAN, PR 00940-2007- 787-721-8787 - WWW.ACT.PR.GOV", PW / 2, footerY, szFooter, false, 'center');

        // 8. Page numbering
        const pages = pdfDoc.getPages();
        pages.forEach((p, i) => {
            p.drawText(`Page ${i + 1} of ${pages.length}`, {
                x: PW - MR - 60,
                y: 20,
                size: 8,
                font: fR,
                color: BK
            });
        });

        // 9. Save and Return
        const pdfBytes = await pdfDoc.save();
        return new Blob([pdfBytes as any], { type: 'application/pdf' });
    } catch (err: any) {
        console.error("Error generating Payroll Certification:", err);
        throw err;
    }
}
