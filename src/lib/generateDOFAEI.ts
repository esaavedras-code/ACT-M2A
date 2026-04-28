import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { supabase } from './supabase';
import { formatDate, formatCurrency } from './utils';

const PW = 612; // 8.5"
const PH = 792; // 11"

/**
 * Convierte Hex a RGB
 */
const hexToRgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return rgb(r, g, b);
};

// Paleta de colores basada en la foto proporcionada
const COLORS = {
    HEADER_GREY: hexToRgb('#e6e6e6'),
    EVAL_ORANGE: hexToRgb('#f7caac'),
    CAT_YELLOW: hexToRgb('#fff2ca'),
    ITEM_GREEN: hexToRgb('#91cf50'),
    TEXT_BLACK: rgb(0, 0, 0),
    TEXT_RED: rgb(0.85, 0, 0), // Rojo vibrante de la foto
    LINE_BLACK: rgb(0, 0, 0),
    LINE_GREY: rgb(0.5, 0.5, 0.5)
};

const drawText = (p: any, txt: any, x: number, y: number, font: any, size = 8, center = false, right = false, color = COLORS.TEXT_BLACK) => {
    if (txt === undefined || txt === null) return;
    const s = txt.toString();
    const textWidth = font.widthOfTextAtSize(s, size);
    let finalX = x;
    if (center) finalX = x - (textWidth / 2);
    else if (right) finalX = x - textWidth;
    p.drawText(s, { x: finalX, y: PH - y, size, font, color });
};

const drawLine = (p: any, x1: number, y1: number, x2: number, y2: number, thickness = 0.5, color = COLORS.LINE_BLACK) => {
    p.drawLine({ start: { x: x1, y: PH - y1 }, end: { x: x2, y: PH - y2 }, thickness, color });
};

const drawRect = (p: any, x: number, y: number, w: number, h: number, fill = false, color = COLORS.HEADER_GREY) => {
    if (fill) { p.drawRectangle({ x, y: PH - y - h, width: w, height: h, color }); }
    else { p.drawRectangle({ x, y: PH - y - h, width: w, height: h, borderColor: rgb(0, 0, 0), borderWidth: 0.5 }); }
};

const drawCheck = (p: any, x: number, y: number, checked: boolean, fontBold: any) => {
    drawRect(p, x, y, 9, 9);
    if (checked) drawText(p, "X", x + 1.5, y + 7.5, fontBold, 8);
};

export async function generateDOFAEI(projectId: string, choId: string) {
    try {
        const { data: projData } = await supabase.from('projects').select('*').eq('id', projectId).single();
        const { data: choData } = await supabase.from('chos').select('*').eq('id', choId).single();
        if (!projData || !choData) throw new Error("Datos insuficientes");

        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

        // Logos
        let actLogoImg: any = null;
        try {
            const logoRes = await fetch('/act_logo.png');
            if (logoRes.ok) actLogoImg = await pdfDoc.embedPng(await logoRes.arrayBuffer());
        } catch (e) { console.warn("Logo not found", e); }

        const allItems = Array.isArray(choData.items) ? choData.items : [];
        const itemsPerPage = 5;
        const totalPages = Math.max(1, Math.ceil(allItems.length / itemsPerPage));

        for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
            const page = pdfDoc.addPage([PW, PH]);
            const pageItems = allItems.slice(pageIdx * itemsPerPage, (pageIdx + 1) * itemsPerPage);
            
            // --- ENCABEZADO ---
            if (actLogoImg) page.drawImage(actLogoImg, { x: 40, y: PH - 70, width: 110, height: 45 });
            drawText(page, `Página ${pageIdx + 1} de ${totalPages}`, PW - 40, 30, fontBold, 10, false, true);
            drawText(page, "Determination of Federal Aid Eligibility Form", PW / 2, 85, fontBold, 13, true);

            // --- SECCION I ---
            let y = 105;
            drawRect(page, 40, y, PW - 80, 16, true, COLORS.HEADER_GREY);
            drawText(page, "I.   Project Information", 42, y + 11, fontBold, 9);
            y += 22;

            drawText(page, "Project Name:", 40, y + 8, font, 8);
            drawText(page, projData.name || "", 115, y + 8, font, 8);
            drawLine(page, 115, y + 10, 240, y + 10);

            drawText(page, "Project Number:", 245, y + 8, font, 8);
            drawText(page, projData.num_act || "", 315, y + 8, font, 8);
            drawLine(page, 315, y + 10, 395, y + 10);

            drawText(page, "Federal Number:", 400, y + 8, font, 8);
            drawText(page, projData.num_federal || "", 475, y + 8, font, 8);
            drawLine(page, 475, y + 10, 560, y + 10);

            y += 18;
            drawText(page, projData.description || "", 40, y + 8, font, 8);
            drawLine(page, 40, y + 10, 500, y + 10);
            
            drawText(page, "Road Classif.", 510, y, font, 8);
            drawCheck(page, 510, y + 8, true, fontBold);
            drawText(page, "NHS", 525, y + 16, fontBold, 8, false, false, COLORS.TEXT_RED); // NHS en Rojo
            drawCheck(page, 570, y + 8, false, fontBold);
            drawText(page, "Non NHS", 545, y, font, 8);

            y += 30;

            // --- SECCIONES II & III SIDE BY SIDE ---
            const mid = PW / 2;
            drawRect(page, 40, y, mid - 50, 16, true, COLORS.HEADER_GREY);
            drawText(page, "II.  Contract Modification Type", 42, y + 11, fontBold, 8);
            drawRect(page, mid - 5, y, mid - 35, 16, true, COLORS.HEADER_GREY);
            drawText(page, "III. Modification Type", mid, y + 11, fontBold, 8);
            
            y += 20;
            const isCO = choData.is_change_of_contract !== false;
            drawCheck(page, 45, y, isCO, fontBold);
            drawText(page, "Change Order", 60, y + 8, fontBold, 8, false, false, COLORS.TEXT_RED); // ROJO

            drawCheck(page, mid, y, choData.is_new_item, fontBold);
            drawText(page, "Aditional Scope of Work", mid + 15, y + 8, font, 8);
            
            drawCheck(page, mid + 120, y, false, fontBold);
            drawText(page, "Specification Change", mid + 135, y + 8, font, 8);

            drawCheck(page, mid + 220, y, false, fontBold);
            drawText(page, "Differing Site Conditions", mid + 235, y + 8, font, 8);

            y += 15;
            drawCheck(page, 45, y, !isCO, fontBold);
            drawText(page, "Extra Work Order", 60, y + 8, font, 8);

            drawCheck(page, mid, y, choData.is_time_extension, fontBold);
            drawText(page, "Time Extension", mid + 15, y + 8, fontBold, 8, false, false, COLORS.TEXT_RED); // ROJO

            drawCheck(page, mid + 120, y, false, fontBold);
            drawText(page, "Emergency", mid + 135, y + 8, font, 8);

            drawCheck(page, mid + 220, y, true, fontBold);
            drawText(page, "Overruns or Underruns Items", mid + 235, y + 8, fontBold, 8, false, false, COLORS.TEXT_RED); // ROJO

            y += 15;
            drawText(page, "Other:", PW - 180, y + 8, font, 8);
            drawLine(page, PW - 150, y + 10, PW - 50, y + 10);
            drawText(page, "(Specify)", PW - 100, y + 18, fontItalic, 6, true);

            y += 30;

            // --- SECCION IV ---
            drawRect(page, 40, y, PW - 80, 16, true, COLORS.HEADER_GREY);
            drawText(page, "IV.  Determination Conditions", 42, y + 11, fontBold, 8);
            y += 20;
            const amt = parseFloat(choData.proposed_change) || 0;
            const isMajor = Math.abs(amt) > 100000;

            drawCheck(page, 45, y, amt < 0, fontBold);
            drawText(page, "Deductive Items", 60, y + 8, font, 8);

            drawCheck(page, 170, y, false, fontBold);
            drawText(page, "Rideability Bonus or", 185, y + 4, font, 7);
            drawText(page, "Contract Incentives", 185, y + 11, font, 7);

            drawCheck(page, 290, y, !isMajor && amt > 0, fontBold);
            drawText(page, "Minor Change", 305, y + 8, font, 8);

            drawText(page, "Other:", 380, y + 8, font, 8);
            drawLine(page, 410, y + 10, 480, y + 10);

            drawCheck(page, 500, y, isMajor, fontBold);
            drawText(page, "Major Change and/or NHS", 515, y + 8, fontBold, 8, false, false, COLORS.TEXT_RED); // ROJO

            y += 20;
            drawCheck(page, 45, y, false, fontBold);
            drawText(page, "Safety Items", 60, y + 8, font, 8);

            drawCheck(page, 170, y, false, fontBold);
            drawText(page, "Sub-estimated", 185, y + 4, font, 7);
            drawText(page, "Contract Items <100K", 185, y + 11, font, 7);

            drawCheck(page, 290, y, false, fontBold);
            drawText(page, "Known Non-Participating Items", 305, y + 8, font, 8);

            y += 30;

            // --- SECCION V ---
            drawRect(page, 40, y, PW - 80, 16, true, COLORS.HEADER_GREY);
            drawText(page, "V.   Items Evaluated", 42, y + 11, fontBold, 8);
            y += 18;
            const vCols = [40, 70, 110, 310, 345, 385, 450, 510, 550, PW - 40];
            drawLine(page, vCols[0], y, vCols[9], y, 1);
            drawText(page, "Item", vCols[0] + 2, y + 10, fontBold, 7);
            drawText(page, "Spec. Code", vCols[1] + 2, y + 10, fontBold, 7);
            drawText(page, "Description", vCols[2] + 2, y + 10, fontBold, 7);
            drawText(page, "Qty", vCols[3] + 2, y + 10, fontBold, 7);
            drawText(page, "Unit", vCols[4] + 2, y + 10, fontBold, 7);
            drawText(page, "Unit Price", vCols[5] + 2, y + 10, fontBold, 7);
            drawText(page, "Total", vCols[6] + 2, y + 10, fontBold, 7);
            drawText(page, "Elegibility", vCols[7] + 2, y + 10, fontBold, 7);
            drawText(page, "% of Federal Participation", vCols[8] + 2, y + 10, fontBold, 6);
            y += 12;
            drawLine(page, vCols[0], y, vCols[9], y, 0.5);

            pageItems.forEach((it: any) => {
                const rowY = y + 10;
                const qty = parseFloat(it.proposed_change || it.quantity) || 0;
                const price = parseFloat(it.unit_price) || 0;
                const total = qty * price;
                const isFed = (it.fund_source || "").includes("FHWA");
                const ratio = isFed ? ((it.fund_source || "").includes("80.25") ? "80.25%" : "100%") : "0%";

                drawText(page, it.item_num || "", vCols[0] + 2, rowY, font, 7);
                drawText(page, it.specification || "", vCols[1] + 2, rowY, font, 7);
                drawText(page, (it.description || "").substring(0, 55), vCols[2] + 2, rowY, font, 6.5);
                drawText(page, qty.toLocaleString(), vCols[4] - 2, rowY, font, 7, false, true, qty < 0 ? COLORS.TEXT_RED : COLORS.TEXT_BLACK);
                drawText(page, it.unit || "", vCols[4] + 2, rowY, font, 7);
                drawText(page, formatCurrency(price), vCols[6] - 2, rowY, font, 7, false, true);
                drawText(page, formatCurrency(total), vCols[7] - 2, rowY, font, 7, false, true, total < 0 ? COLORS.TEXT_RED : COLORS.TEXT_BLACK);
                drawText(page, isFed ? "Yes" : "No", vCols[7] + 2, rowY, font, 7);
                drawText(page, ratio, vCols[8] + 2, rowY, font, 7);
                y += 12;
                drawLine(page, vCols[0], y, vCols[9], y, 0.3, COLORS.LINE_GREY);
            });

            y += 20;

            // --- SECCION VI: MATRIX ---
            drawRect(page, 40, y, PW - 80, 16, true, COLORS.EVAL_ORANGE);
            drawText(page, "VI.  Evaluation of Federal Aid Eligible Items", 42, y + 11, fontBold, 8);
            y += 16;
            const viCols = [40, 275, 315, 355, 395, 435, 475, PW - 40];
            drawLine(page, viCols[0], y, viCols[7], y, 1);
            
            drawText(page, "Elegible Criteria", viCols[0] + 5, y + 15, fontBold, 9);
            pageItems.forEach((it: any, idx: number) => {
                const colX = viCols[2 + idx];
                drawRect(page, colX - 20, y, 40, 35, true, COLORS.EVAL_ORANGE);
                drawText(page, "Item", colX, y + 10, fontBold, 7, true);
                drawText(page, `#${it.item_num}`, colX, y + 18, fontBold, 7, true);
                drawText(page, "Y/T", colX - 10, y + 30, fontBold, 6, true);
                drawText(page, "N/F", colX + 10, y + 30, fontBold, 6, true);
            });
            drawText(page, "Comments", viCols[7] - 30, y + 15, fontBold, 9, true);
            y += 35;
            drawLine(page, viCols[0], y, viCols[7], y, 0.5);

            const criteria = [
                { cat: "1. Impact on the original scope of work", items: [
                    "1.1. Proposed work includes subsidiary obligations...",
                    "1.2. Proposed work is out of the previously authorized scope...",
                    "1.3. Proposed work extends beyond the project boundaries",
                    "1.4. Proposed work adversely impacts work already underway",
                    "1.5. The cost of the proposed work exceeds available funds",
                    "1.6. Proposed change is related to re-do or faulty work."
                ]},
                { cat: "2. Basis of payment", items: [
                    "2.1. PRHTA's independent evaluation discovered discrepancies...",
                    "2.2. Cost analysis of each change has not been documented."
                ]},
                { cat: "3. Time Adjustments", items: [
                    "3.1. Contract time extension has not been fully justified..."
                ]},
                { cat: "4. Other Considerations", items: [
                    "4.1. Proposed work involves routine maintenance.",
                    "4.2. Proposed change involves maintenance items..."
                ]}
            ];

            criteria.forEach(cat => {
                drawRect(page, 40, y, PW - 80, 14, true, COLORS.CAT_YELLOW);
                drawText(page, cat.cat, 42, y + 10, fontBold, 7.5);
                y += 14;
                drawLine(page, 40, y, viCols[7], y, 0.5);

                cat.items.forEach(itText => {
                    drawText(page, itText.substring(0, 85), 45, y + 10, font, 6.5);
                    pageItems.forEach((it: any, idx: number) => {
                        const isFed = (it.fund_source || "").includes("FHWA");
                        drawRect(page, viCols[2+idx]-20, y, 40, 12, true, COLORS.ITEM_GREEN);
                        drawText(page, "X", viCols[2+idx] + (isFed ? -10 : 10), y + 10, fontBold, 8, true);
                    });
                    y += 12;
                    drawLine(page, 40, y, viCols[7], y, 0.3, COLORS.LINE_GREY);
                });
            });

            y += 20;

            // --- SECCION VII ---
            drawRect(page, 40, y, PW - 80, 16, true, COLORS.HEADER_GREY);
            drawText(page, "VII. Contract Modification Impact", 42, y + 11, fontBold, 9);
            y += 22;
            drawText(page, "Time:", 40, y + 8, font, 8);
            drawText(page, choData.is_time_extension ? choData.time_extension_days : "0", 80, y + 8, font, 8, true);
            drawLine(page, 60, y + 10, 100, y + 10);
            drawText(page, "Calendar Days", 110, y + 8, font, 8);

            drawText(page, "Change Amount: $", 250, y + 8, font, 8);
            drawText(page, formatCurrency(amt), 380, y + 8, fontBold, 9, false, false, amt < 0 ? COLORS.TEXT_RED : COLORS.TEXT_BLACK);
            drawLine(page, 325, y + 10, 480, y + 10);

            y += 35;
            // Firmas
            drawText(page, "Prepared by:", 40, y, fontBold, 9);
            drawText(page, "Eng. Luis R. Pastor Reyes", 105, y, font, 9);
            drawText(page, formatDate(new Date()), PW - 120, y, font, 9);
            
            y += 15;
            drawLine(page, 100, y, 350, y);
            drawLine(page, PW - 150, y, PW - 50, y);
            drawText(page, "Print Name", 225, y + 10, font, 7, true);
            drawText(page, "Date", PW - 100, y + 10, font, 7, true);

            y += 25;
            drawLine(page, 100, y, 350, y);
            drawLine(page, PW - 150, y, PW - 50, y);
            drawText(page, "Position", 225, y + 10, font, 7, true);
            drawText(page, "Date", PW - 100, y + 10, font, 7, true);

            drawText(page, "Designed by Ing. Enrique Saavedra Sada, PE", PW / 2, PH - 20, fontItalic, 6, true, false, rgb(0.5, 0.5, 0.5));
        }

        const pdfBytes = await pdfDoc.save();
        return new Blob([pdfBytes as any], { type: 'application/pdf' });
    } catch (err: any) {
        console.error("Error generating DOFAEI:", err);
        throw err;
    }
}
