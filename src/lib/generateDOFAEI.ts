import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { supabase } from './supabase';
import { formatDate, formatCurrency } from './utils';

const PW = 612; // 8.5"
const PH = 792; // 11"

/**
 * Convierte Hex a RGB para pdf-lib
 */
const hexToRgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return rgb(r, g, b);
};

// Paleta de colores oficial del PDF
const COLORS = {
    SECTION_HEADER: hexToRgb('#e6e6e6'),
    EVAL_HEADER: hexToRgb('#f7caac'),
    CATEGORY_HEADER: hexToRgb('#fff2ca'),
    EVAL_COLS: hexToRgb('#91cf50'),
    TEXT_BLACK: rgb(0, 0, 0),
    TEXT_RED: rgb(0.8, 0, 0),
    LINE_GREY: rgb(0.7, 0.7, 0.7)
};

/**
 * Helpers de dibujo
 */
const drawText = (p: any, txt: any, x: number, y: number, font: any, size = 8, center = false, right = false, color = COLORS.TEXT_BLACK) => {
    if (txt === undefined || txt === null) return;
    const s = txt.toString().replace(/\t/g, ' ');
    const textWidth = font.widthOfTextAtSize(s, size);
    let finalX = x;
    if (center) finalX = x - (textWidth / 2);
    else if (right) finalX = x - textWidth;
    p.drawText(s, { x: finalX, y: PH - y, size, font, color });
};

const drawLine = (p: any, x1: number, y1: number, x2: number, y2: number, thickness = 0.5, color = COLORS.TEXT_BLACK) => {
    p.drawLine({ start: { x: x1, y: PH - y1 }, end: { x: x2, y: PH - y2 }, thickness, color });
};

const drawRect = (p: any, x: number, y: number, w: number, h: number, fill = false, color = COLORS.SECTION_HEADER) => {
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
        if (!projData) throw new Error("Proyecto no encontrado");
        const { data: choData } = await supabase.from('chos').select('*').eq('id', choId).single();
        if (!choData) throw new Error("CHO no encontrada");

        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

        // Logos
        let actLogoImg: any = null;
        let dotLogoImg: any = null;
        try {
            const actLogoRes = await fetch('/act_logo.png');
            const dotLogoRes = await fetch('/dot_logo.png');
            if (actLogoRes.ok) actLogoImg = await pdfDoc.embedPng(await actLogoRes.arrayBuffer());
            if (dotLogoRes.ok) dotLogoImg = await pdfDoc.embedPng(await dotLogoRes.arrayBuffer());
        } catch (e) { console.warn("Logos not found", e); }

        const allItems = Array.isArray(choData.items) ? choData.items : [];
        const itemsPerPage = 5;
        const totalPages = Math.max(1, Math.ceil(allItems.length / itemsPerPage));

        for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
            const page = pdfDoc.addPage([PW, PH]);
            const pageItems = allItems.slice(pageIdx * itemsPerPage, (pageIdx + 1) * itemsPerPage);
            
            // Logo y Encabezado
            if (actLogoImg) page.drawImage(actLogoImg, { x: 40, y: PH - 65, width: 110, height: 45 });
            if (dotLogoImg) page.drawImage(dotLogoImg, { x: PW - 140, y: PH - 65, width: 100, height: 40 });

            drawText(page, `Página ${pageIdx + 1} de ${totalPages}`, PW - 40, 25, font, 7, false, true);
            drawText(page, "DETERMINATION OF FEDERAL-AID ELIGIBILITY FORM", PW / 2, 75, fontBold, 14, true);

            // Seccion I
            let y = 105;
            drawRect(page, 40, y, PW - 80, 16, true, COLORS.SECTION_HEADER);
            drawText(page, "I.   PROJECT INFORMATION", 45, y + 11, fontBold, 9);
            y += 20;

            drawText(page, "Project Name:", 40, y + 8, fontBold, 8);
            drawText(page, projData.name || "", 115, y + 8, font, 8);
            drawLine(page, 115, y + 10, 370, y + 10, 0.5, COLORS.LINE_GREY);

            drawText(page, "Road Classif.", 390, y + 8, fontBold, 8);
            drawCheck(page, 455, y, (projData.road_classification || "").toLowerCase().includes("interstate"), fontBold);
            drawText(page, "Interstate", 470, y + 8, font, 7);
            drawCheck(page, 515, y, (projData.road_classification || "").toLowerCase().includes("nhs") && !(projData.road_classification || "").toLowerCase().includes("non"), fontBold);
            drawText(page, "NHS", 530, y + 8, font, 7);
            drawCheck(page, 560, y, (projData.road_classification || "").toLowerCase().includes("non"), fontBold);
            drawText(page, "Non NHS", 575, y + 8, font, 7);

            y += 20;
            drawText(page, "Project Number:", 40, y + 8, fontBold, 8);
            drawText(page, projData.num_act || "", 115, y + 8, font, 8);
            drawLine(page, 115, y + 10, 250, y + 10, 0.5, COLORS.LINE_GREY);

            drawText(page, "Federal Number:", 270, y + 8, fontBold, 8);
            drawText(page, projData.num_federal || "", 350, y + 8, font, 8);
            drawLine(page, 350, y + 10, 480, y + 10, 0.5, COLORS.LINE_GREY);

            y += 35;

            // Secciones II & III
            const mid = PW / 2;
            drawRect(page, 40, y, mid - 50, 16, true, COLORS.SECTION_HEADER);
            drawText(page, "II.  CONTRACT MODIFICATION TYPE", 45, y + 11, fontBold, 8);
            drawRect(page, mid - 5, y, mid - 35, 16, true, COLORS.SECTION_HEADER);
            drawText(page, "III. MODIFICATION TYPE", mid, y + 11, fontBold, 8);
            
            y += 20;
            const isCO = choData.is_change_of_contract !== false;
            drawCheck(page, 45, y, isCO, fontBold);
            drawText(page, "Change Order", 60, y + 8, font, 8);
            drawCheck(page, mid, y, choData.modification_type?.includes("Additional"), fontBold);
            drawText(page, "Additional Scope of Work", mid + 15, y + 8, font, 8);
            
            y += 15;
            drawCheck(page, 45, y, !isCO, fontBold);
            drawText(page, "Extra Work Order", 60, y + 8, font, 8);
            drawCheck(page, mid, y, choData.modification_type?.includes("Specification"), fontBold);
            drawText(page, "Specification Change", mid + 15, y + 8, font, 8);

            y += 15;
            drawCheck(page, mid, y, choData.modification_type?.includes("Differing"), fontBold);
            drawText(page, "Differing Site Conditions", mid + 15, y + 8, font, 8);

            y += 15;
            drawCheck(page, mid, y, choData.modification_type?.includes("Other"), fontBold);
            drawText(page, "Other:", mid + 15, y + 8, font, 8);
            drawLine(page, mid + 45, y + 10, PW - 50, y + 10, 0.5, COLORS.LINE_GREY);

            y += 30;

            // Seccion IV
            drawRect(page, 40, y, PW - 80, 16, true, COLORS.SECTION_HEADER);
            drawText(page, "IV.  DETERMINATION CONDITIONS", 45, y + 11, fontBold, 8);
            y += 20;
            const amt = parseFloat(choData.proposed_change) || 0;
            drawCheck(page, 45, y, amt < 0, fontBold);
            drawText(page, "Deductive Items", 60, y + 8, font, 8);
            drawCheck(page, 170, y, amt > 0 && amt <= 100000, fontBold);
            drawText(page, "Minor Change", 185, y + 8, font, 8);
            drawCheck(page, 300, y, amt > 100000, fontBold);
            drawText(page, "Major Change and/or NHS", 315, y + 8, font, 8);
            drawCheck(page, 460, y, false, fontBold);
            drawText(page, "Rideability Bonus", 475, y + 8, font, 8);

            y += 15;
            drawCheck(page, 45, y, false, fontBold);
            drawText(page, "Safety Items", 60, y + 8, font, 8);
            drawCheck(page, 170, y, false, fontBold);
            drawText(page, "Sub-estimated Items < 100K", 185, y + 8, font, 8);
            drawCheck(page, 300, y, false, fontBold);
            drawText(page, "Known Non-Participating Items", 315, y + 8, font, 8);

            y += 30;

            // Seccion V
            drawRect(page, 40, y, PW - 80, 16, true, COLORS.SECTION_HEADER);
            drawText(page, "V.   ITEMS EVALUATED", 45, y + 11, fontBold, 8);
            y += 15;
            const vCols = [40, 75, 115, 260, 310, 350, 420, 480, 540, PW - 40];
            drawLine(page, vCols[0], y, vCols[9], y, 1);
            drawText(page, "Item", vCols[0] + 2, y + 12, fontBold, 7);
            drawText(page, "Spec Code", vCols[1] + 2, y + 12, fontBold, 7);
            drawText(page, "Description", vCols[2] + 2, y + 12, fontBold, 7);
            drawText(page, "Qty", vCols[3] + 2, y + 12, fontBold, 7);
            drawText(page, "Unit", vCols[4] + 2, y + 12, fontBold, 7);
            drawText(page, "Price", vCols[5] + 2, y + 12, fontBold, 7);
            drawText(page, "Total", vCols[6] + 2, y + 12, fontBold, 7);
            drawText(page, "Eligib.", vCols[7] + 2, y + 12, fontBold, 7);
            drawText(page, "Fed %", vCols[8] + 2, y + 12, fontBold, 7);
            y += 15;
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
                drawText(page, (it.description || "").substring(0, 45), vCols[2] + 2, rowY, font, 6.5);
                drawText(page, qty.toLocaleString(), vCols[4] - 2, rowY, font, 7, false, true);
                drawText(page, it.unit || "", vCols[4] + 2, rowY, font, 7);
                drawText(page, formatCurrency(price), vCols[6] - 2, rowY, font, 7, false, true);
                drawText(page, formatCurrency(total), vCols[7] - 2, rowY, font, 7, false, true, total < 0 ? COLORS.TEXT_RED : COLORS.TEXT_BLACK);
                drawText(page, isFed ? "Yes" : "No", vCols[7] + 2, rowY, font, 7);
                drawText(page, ratio, vCols[8] + 2, rowY, font, 7);
                y += 12;
                drawLine(page, vCols[0], y, vCols[9], y, 0.3, COLORS.LINE_GREY);
            });

            y += 20;

            // Seccion VI: Matrix con Colores
            drawRect(page, 40, y, PW - 80, 16, true, COLORS.EVAL_HEADER);
            drawText(page, "VI.  EVALUATION OF FEDERAL AID ELIGIBLE ITEMS", 45, y + 11, fontBold, 8);
            y += 16;
            const viCols = [40, 260, 310, 360, 410, 460, 510, PW - 40];
            drawLine(page, viCols[0], y, viCols[7], y, 1);
            
            // Cabeceras de la matriz
            drawText(page, "Eligible Criteria", viCols[0] + 5, y + 12, fontBold, 8);
            pageItems.forEach((it: any, idx: number) => {
                const colX = viCols[2 + idx];
                drawRect(page, colX - 25, y, 50, 30, true, COLORS.EVAL_COLS);
                drawText(page, `Item`, colX, y + 10, fontBold, 7, true);
                drawText(page, `#${it.item_num}`, colX, y + 18, fontBold, 7, true);
                drawText(page, "Y/T", colX - 12, y + 26, fontBold, 6, true);
                drawText(page, "N/F", colX + 12, y + 26, fontBold, 6, true);
            });
            drawText(page, "Comments", viCols[7] - 30, y + 12, fontBold, 8, true);
            y += 30;
            drawLine(page, viCols[0], y, viCols[7], y, 0.5);

            const categories = [
                { title: "1. Impact on the original scope of work", items: [
                    "1.1 Proposed work includes subsidiary obligations...",
                    "1.2 Proposed work is out of authorized scope...",
                    "1.3 Proposed work extends beyond boundaries...",
                    "1.4 Proposed work adversely impacts work underway...",
                    "1.5 Cost exceeds available funds...",
                    "1.6 Proposed change is related to re-do/faulty work..."
                ]},
                { title: "2. Basis of payment", items: [
                    "2.1 Independent evaluation discovered discrepancies...",
                    "2.2 Cost analysis has not been documented..."
                ]},
                { title: "3. Time Adjustments", items: [
                    "3.1 Time extension not fully justified..."
                ]},
                { title: "4. Other Considerations", items: [
                    "4.1 Proposed work involves routine maintenance...",
                    "4.2 Proposed change involves maintenance items..."
                ]}
            ];

            categories.forEach(cat => {
                drawRect(page, 40, y, PW - 80, 12, true, COLORS.CATEGORY_HEADER);
                drawText(page, cat.title, 45, y + 9, fontBold, 7);
                y += 12;
                drawLine(page, 40, y, viCols[7], y, 0.5);

                cat.items.forEach(crit => {
                    drawText(page, crit.substring(0, 65), 45, y + 9, font, 6.5);
                    pageItems.forEach((it: any, idx: number) => {
                        const isFed = (it.fund_source || "").includes("FHWA");
                        const markX = viCols[2 + idx] + (isFed ? -12 : 12);
                        drawText(page, "X", markX, y + 9, fontBold, 7, true);
                    });
                    y += 12;
                    drawLine(page, 40, y, viCols[7], y, 0.3, COLORS.LINE_GREY);
                });
            });

            y += 20;

            // Seccion VII
            drawRect(page, 40, y, PW - 80, 16, true, COLORS.SECTION_HEADER);
            drawText(page, "VII. CONTRACT MODIFICATION IMPACT", 45, y + 11, fontBold, 8);
            y += 20;
            drawText(page, `Time: ${choData.is_time_extension ? choData.time_extension_days : 0} Calendar Days`, 45, y + 8, font, 8);
            drawText(page, `Change Amount: ${formatCurrency(amt)}`, 250, y + 8, fontBold, 9, false, false, amt < 0 ? COLORS.TEXT_RED : COLORS.TEXT_BLACK);

            y += 45;
            // Firmas
            const sigY = y;
            drawLine(page, 40, sigY, 210, sigY);
            drawText(page, "Project Administrator / Resident Engineer", 40, sigY + 10, font, 7);
            drawLine(page, 220, sigY, 280, sigY);
            drawText(page, "Date", 220, sigY + 10, font, 7);

            drawLine(page, 340, sigY, 500, sigY);
            drawText(page, "Area Supervisor / Project Manager", 340, sigY + 10, font, 7);
            drawLine(page, 510, sigY, 570, sigY);
            drawText(page, "Date", 510, sigY + 10, font, 7);

            y += 40;
            drawLine(page, 40, y, 210, y);
            drawText(page, "District Director / Program Manager", 40, y + 10, font, 7);
            drawLine(page, 220, y, 280, y);
            drawText(page, "Date", 220, y + 10, font, 7);
            
            drawText(page, "Designed by Ing. Enrique Saavedra Sada, PE", PW / 2, PH - 15, fontItalic, 6, true, false, rgb(0.5, 0.5, 0.5));
        }

        const pdfBytes = await pdfDoc.save();
        return new Blob([pdfBytes as any], { type: 'application/pdf' });
    } catch (err: any) {
        console.error("Error generating DOFAEI:", err);
        throw err;
    }
}
