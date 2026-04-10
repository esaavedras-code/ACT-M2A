import { supabase } from './supabase';
import { formatDate as utilsFormatDate } from './utils';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Genera el reporte "MATERIAL CERTIFICATION"
 * Réplica exacta de la imagen provista.
 */
export async function generateMaterialCertificationReport(projectId: string) {
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
        const TXT = (txt: string | number | null | undefined, x: number, y: number, sz: number, bold = false, align: 'left' | 'center' | 'right' = 'left', color = BK) => {
            if (txt === undefined || txt === null) return;
            let s = txt.toString();
            const font = bold ? fB : fR;
            let px = x;
            if (align === 'center') px = x - font.widthOfTextAtSize(s, sz) / 2;
            if (align === 'right') px = x - font.widthOfTextAtSize(s, sz);
            pg.drawText(s, { x: px, y: PH - y, size: sz, font, color });
        };

        const LINE = (x1: number, y1: number, x2: number, y2: number, thick = 0.5) => {
            pg.drawLine({ start: { x: x1, y: PH - y1 }, end: { x: x2, y: PH - y2 }, thickness: thick, color: BK });
        };

        // 3. Header Section (Logos & Title)
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

        let curY = 105;
        TXT("Commonwealth of Puerto Rico", PW / 2, curY, 14, false, 'center');
        curY += 20;
        TXT("Department of Transportation and Public Works", PW / 2, curY, 14, false, 'center');
        curY += 20;
        TXT("HIGHWAY AND TRANSPORTATION AUTHORITY", PW / 2, curY, 14, true, 'center');

        curY += 35;
        TXT("MATERIAL CERTIFICATION", PW / 2, curY, 14, true, 'center');
        curY += 15;
        TXT("(BORRADOR)", PW / 2, curY, 13, true, 'center');

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

        // 5. Certification Body
        curY += 60;
        TXT("This is to certify that:", ML, curY, 12);

        const CW = PW - ML - MR;
        const bodyParagraphs = [
            "The results of the tests on acceptance indicate that the material incorporated in the construction work, and the construction operations controlled by sampling and testing, were in close conformity with the approved plans and specifications of the contract.",
            "All the samples and test are within tolerance limits of these samples and test that are used in the acceptance program, except as documented in the project records.",
            "Exceptions to the plans and specifications (if any) are in close conformity with the approved plans and specifications as documented in the project records."
        ];

        curY += 35;
        bodyParagraphs.forEach((para, paraIdx) => {
            const words = para.split(' ');
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
                    pg.drawText(lineWords.join(' '), { x: ML, y: PH - lineY, size: 12, font: fR, color: BK });
                } else {
                    const totalWordsW = lineWords.reduce((acc, w) => acc + fR.widthOfTextAtSize(w, 12), 0);
                    const gapW = (CW - totalWordsW) / (lineWords.length - 1);
                    let startX = ML;
                    lineWords.forEach((word) => {
                        pg.drawText(word, { x: startX, y: PH - lineY, size: 12, font: fR, color: BK });
                        startX += fR.widthOfTextAtSize(word, 12) + gapW;
                    });
                }
            });
            curY += (lines.length * 18) + 15;
        });

        // 6. Signature Grid
        curY += 40;
        const col1X = ML;
        const col2X = ML + 260;

        // Line 1 Row
        TXT("By:", col1X, curY, 12);
        LINE(col1X + 25, curY + 2, col1X + 200, curY + 2, 0.8);

        TXT("And:", col2X, curY, 12);
        LINE(col2X + 35, curY + 2, col2X + 225, curY + 2, 0.8);

        // Names/Titles Row
        curY += 20;
        if (proj.admin_name) {
            TXT(proj.admin_name, col1X + 112.5, curY, 11, false, 'center');
        }
        curY += 15;
        TXT("Resident Engineer", col1X + 112.5, curY, 11, false, 'center');
        TXT("Material Testing Office", col2X + 130, curY, 11, false, 'center');

        curY += 15;
        TXT("(Name and sign)", col1X + 112.5, curY, 11, true, 'center');
        TXT("(Name and sign)", col2X + 130, curY, 11, true, 'center');

        // Dates Row
        curY += 35;
        TXT("Date:", col1X, curY, 12);
        LINE(col1X + 35, curY + 2, col1X + 220, curY + 2, 0.8);

        TXT("Date:", col2X, curY, 12);
        LINE(col2X + 35, curY + 2, col2X + 210, curY + 2, 0.8);

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

        // 9. Finalize
        const pdfBytes = await pdfDoc.save();
        return new Blob([pdfBytes as any], { type: 'application/pdf' });
    } catch (err: any) {
        console.error("Error generating Material Certification:", err);
        throw err;
    }
}
