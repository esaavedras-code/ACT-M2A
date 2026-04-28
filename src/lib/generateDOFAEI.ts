import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { supabase } from './supabase';
import { formatDate, formatCurrency } from './utils';

const PW = 612; // 8.5"
const PH = 792; // 11"

/**
 * Helpers de dibujo para PDF-lib
 */
const drawText = (p: any, txt: any, x: number, y: number, font: any, size = 8, center = false, right = false, color = rgb(0, 0, 0)) => {
    if (txt === undefined || txt === null) return;
    const s = txt.toString().replace(/\t/g, ' ');
    const textWidth = font.widthOfTextAtSize(s, size);
    let finalX = x;
    if (center) finalX = x - (textWidth / 2);
    else if (right) finalX = x - textWidth;

    p.drawText(s, { x: finalX, y: PH - y, size, font, color });
};

const drawLine = (p: any, x1: number, y1: number, x2: number, y2: number, thickness = 0.5) => {
    p.drawLine({ start: { x: x1, y: PH - y1 }, end: { x: x2, y: PH - y2 }, thickness, color: rgb(0, 0, 0) });
};

const drawRect = (p: any, x: number, y: number, w: number, h: number, fill = false, color = rgb(0.9, 0.9, 0.9)) => {
    if (fill) { p.drawRectangle({ x, y: PH - y - h, width: w, height: h, color }); }
    else { p.drawRectangle({ x, y: PH - y - h, width: w, height: h, borderColor: rgb(0, 0, 0), borderWidth: 0.5 }); }
};

const drawCheck = (p: any, x: number, y: number, checked: boolean, fontBold: any) => {
    drawRect(p, x, y, 9, 9);
    if (checked) drawText(p, "X", x + 1.5, y + 7.5, fontBold, 8);
};

/**
 * Genera el reporte DOFAEI (Determination of Federal Aid Eligibility Form)
 */
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
        } catch (e) { console.warn("Logos not found for PDF", e); }

        const allItems = Array.isArray(choData.items) ? choData.items : [];
        const itemsPerPage = 5; // Section VI limits to about 5-6 items per page column-wise
        const totalPages = Math.max(1, Math.ceil(allItems.length / itemsPerPage));

        for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
            const page = pdfDoc.addPage([PW, PH]);
            const pageItems = allItems.slice(pageIdx * itemsPerPage, (pageIdx + 1) * itemsPerPage);
            
            // --- HEADER ---
            if (actLogoImg) page.drawImage(actLogoImg, { x: 40, y: PH - 60, width: 100, height: 40 });
            if (dotLogoImg) page.drawImage(dotLogoImg, { x: PW - 140, y: PH - 60, width: 100, height: 40 });

            drawText(page, `Página ${pageIdx + 1} de ${totalPages}`, PW - 40, 30, font, 8, false, true);
            drawText(page, "DETERMINATION OF FEDERAL-AID ELIGIBILITY FORM", PW / 2, 70, fontBold, 14, true);

            // --- SECTION I: PROJECT INFORMATION ---
            let y = 100;
            drawRect(page, 40, y, PW - 80, 15, true, rgb(0.9, 0.9, 0.9));
            drawText(page, "I.   PROJECT INFORMATION", 45, y + 11, fontBold, 9);
            y += 20;

            drawText(page, "Project Name:", 40, y + 8, fontBold, 8);
            drawText(page, projData.name || "", 110, y + 8, font, 8);
            drawLine(page, 110, y + 10, 350, y + 10);

            drawText(page, "Road Classif.", 380, y + 8, fontBold, 8);
            drawCheck(page, 445, y, (projData.road_classification || "").toLowerCase().includes("interstate"), fontBold);
            drawText(page, "Interstate", 460, y + 8, font, 7);
            
            drawCheck(page, 510, y, (projData.road_classification || "").toLowerCase().includes("nhs") && !(projData.road_classification || "").toLowerCase().includes("non"), fontBold);
            drawText(page, "NHS", 525, y + 8, font, 7);

            drawCheck(page, 555, y, (projData.road_classification || "").toLowerCase().includes("non"), fontBold);
            drawText(page, "Non NHS", 570, y + 8, font, 7);

            y += 20;
            drawText(page, "Project Number:", 40, y + 8, fontBold, 8);
            drawText(page, projData.num_act || "", 110, y + 8, font, 8);
            drawLine(page, 110, y + 10, 230, y + 10);

            drawText(page, "Federal Number:", 250, y + 8, fontBold, 8);
            drawText(page, projData.num_federal || "", 325, y + 8, font, 8);
            drawLine(page, 325, y + 10, 450, y + 10);

            y += 30;

            // --- SECTION II & III SIDE BY SIDE ---
            const mid = PW / 2;
            drawRect(page, 40, y, mid - 50, 15, true, rgb(0.9, 0.9, 0.9));
            drawText(page, "II.  CONTRACT MODIFICATION TYPE", 45, y + 11, fontBold, 8);
            
            drawRect(page, mid - 5, y, mid - 35, 15, true, rgb(0.9, 0.9, 0.9));
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
            drawLine(page, mid + 45, y + 10, PW - 50, y + 10);

            y += 25;

            // --- SECTION IV: DETERMINATION CONDITIONS ---
            drawRect(page, 40, y, PW - 80, 15, true, rgb(0.9, 0.9, 0.9));
            drawText(page, "IV.  DETERMINATION CONDITIONS", 45, y + 11, fontBold, 8);
            y += 20;

            const amt = parseFloat(choData.proposed_change) || 0;
            drawCheck(page, 45, y, amt < 0, fontBold);
            drawText(page, "Deductive Items", 60, y + 8, font, 8);

            drawCheck(page, 160, y, amt > 0 && amt <= 100000, fontBold);
            drawText(page, "Minor Change", 175, y + 8, font, 8);

            drawCheck(page, 280, y, amt > 100000, fontBold);
            drawText(page, "Major Change and/or NHS", 295, y + 8, font, 8);

            drawCheck(page, 420, y, false, fontBold);
            drawText(page, "Rideability Bonus", 435, y + 8, font, 8);

            y += 15;
            drawCheck(page, 45, y, false, fontBold);
            drawText(page, "Safety Items", 60, y + 8, font, 8);

            drawCheck(page, 160, y, false, fontBold);
            drawText(page, "Sub-estimated Items < 100K", 175, y + 8, font, 8);

            drawCheck(page, 280, y, false, fontBold);
            drawText(page, "Known Non-Participating Items", 295, y + 8, font, 8);

            y += 25;

            // --- SECTION V: ITEMS EVALUATED ---
            drawRect(page, 40, y, PW - 80, 15, true, rgb(0.9, 0.9, 0.9));
            drawText(page, "V.   ITEMS EVALUATED", 45, y + 11, fontBold, 8);
            y += 15;

            const vCols = [40, 70, 110, 240, 290, 330, 390, 450, 510, PW - 40];
            drawLine(page, vCols[0], y, vCols[9], y, 1);
            const vHeaderY = y + 12;
            drawText(page, "Item", vCols[0] + 2, vHeaderY, fontBold, 7);
            drawText(page, "Spec Code", vCols[1] + 2, vHeaderY, fontBold, 7);
            drawText(page, "Description", vCols[2] + 2, vHeaderY, fontBold, 7);
            drawText(page, "Qty", vCols[3] + 2, vHeaderY, fontBold, 7);
            drawText(page, "Unit", vCols[4] + 2, vHeaderY, fontBold, 7);
            drawText(page, "Price", vCols[5] + 2, vHeaderY, fontBold, 7);
            drawText(page, "Total", vCols[6] + 2, vHeaderY, fontBold, 7);
            drawText(page, "Eligib.", vCols[7] + 2, vHeaderY, fontBold, 7);
            drawText(page, "Fed %", vCols[8] + 2, vHeaderY, fontBold, 7);
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
                drawText(page, (it.description || "").substring(0, 38), vCols[2] + 2, rowY, font, 6.5);
                drawText(page, qty.toLocaleString(), vCols[4] - 2, rowY, font, 7, false, true);
                drawText(page, it.unit || "", vCols[4] + 2, rowY, font, 7);
                drawText(page, formatCurrency(price), vCols[6] - 2, rowY, font, 7, false, true);
                drawText(page, formatCurrency(total), vCols[7] - 2, rowY, font, 7, false, true);
                drawText(page, isFed ? "Yes" : "No", vCols[7] + 2, rowY, font, 7);
                drawText(page, ratio, vCols[8] + 2, rowY, font, 7);

                y += 12;
                drawLine(page, vCols[0], y, vCols[9], y, 0.3);
            });

            y += 15;

            // --- SECTION VI: EVALUATION MATRIX ---
            drawRect(page, 40, y, PW - 80, 15, true, rgb(0.9, 0.9, 0.9));
            drawText(page, "VI.  EVALUATION OF FEDERAL AID ELIGIBLE ITEMS", 45, y + 11, fontBold, 8);
            y += 15;

            const viCols = [40, 240, 290, 340, 390, 440, 490, PW - 40];
            drawLine(page, viCols[0], y, viCols[7], y, 1);
            drawText(page, "Elegible Criteria", viCols[0] + 5, y + 25, fontBold, 8);
            
            // Item headers in VI
            pageItems.forEach((it: any, idx: number) => {
                drawText(page, `Item #${it.item_num}`, viCols[2 + idx], y + 12, fontBold, 7, true);
                drawText(page, "Y/T", viCols[2 + idx] - 12, y + 25, fontBold, 6);
                drawText(page, "N/F", viCols[2 + idx] + 12, y + 25, fontBold, 6);
            });
            drawText(page, "Comments", viCols[7] - 40, y + 25, fontBold, 8, true);
            
            y += 30;
            drawLine(page, viCols[0], y, viCols[7], y, 0.5);

            const criteria = [
                "1.1 Proposed work includes subsidiary obligations...",
                "1.2 Proposed work is out of authorized scope...",
                "1.3 Proposed work extends beyond project boundaries...",
                "1.4 Proposed work adversely impacts work underway...",
                "1.5 Cost exceeds available funds (contingencies)...",
                "1.6 Proposed change is related to re-do/faulty work...",
                "2.1 Independent evaluation discovered discrepancies...",
                "2.2 Cost analysis has not been documented...",
                "3.1 Time extension has not been fully justified...",
                "4.1 Proposed work involves routine maintenance...",
                "4.2 Proposed change involves maintenance items..."
            ];

            criteria.forEach((crit) => {
                const rowY = y + 10;
                drawText(page, crit.substring(0, 55), viCols[0] + 2, rowY, font, 6.5);
                
                pageItems.forEach((it: any, idx: number) => {
                    const isFed = (it.fund_source || "").includes("FHWA");
                    // Most criteria should be "No" for eligibility if they are negative conditions, 
                    // or "Yes" if they are positive. For this demo, we mark consistently based on FHWA.
                    const isYes = isFed; 
                    drawText(page, "X", viCols[2 + idx] + (isYes ? -10 : 10), rowY, fontBold, 7, true);
                });

                y += 12;
                drawLine(page, viCols[0], y, viCols[7], y, 0.3);
            });

            y += 10;

            // --- SECTION VII: IMPACT ---
            drawRect(page, 40, y, PW - 80, 15, true, rgb(0.9, 0.9, 0.9));
            drawText(page, "VII. CONTRACT MODIFICATION IMPACT", 45, y + 11, fontBold, 8);
            y += 20;

            drawText(page, `Time: ${choData.is_time_extension ? choData.time_extension_days : 0} Calendar Days`, 45, y + 8, font, 8);
            drawText(page, `Change Amount: ${formatCurrency(amt)}`, 250, y + 8, fontBold, 8);

            y += 40;
            // --- SIGNATURES ---
            const sigY = y;
            drawLine(page, 40, sigY, 220, sigY);
            drawText(page, "Project Administrator / Resident Engineer", 40, sigY + 12, font, 7);
            drawLine(page, 230, sigY, 290, sigY);
            drawText(page, "Date", 230, sigY + 12, font, 7);

            drawLine(page, 340, sigY, 500, sigY);
            drawText(page, "Area Supervisor / Project Manager", 340, sigY + 12, font, 7);
            drawLine(page, 510, sigY, 570, sigY);
            drawText(page, "Date", 510, sigY + 12, font, 7);

            y += 40;
            drawLine(page, 40, y, 220, y);
            drawText(page, "District Director / Program Manager", 40, y + 12, font, 7);
            drawLine(page, 230, y, 290, y);
            drawText(page, "Date", 230, y + 12, font, 7);
            
            drawText(page, "Designed by Ing. Enrique Saavedra Sada, PE", PW / 2, PH - 20, fontItalic, 6, true);
        }

        const pdfBytes = await pdfDoc.save();
        return new Blob([pdfBytes as any], { type: 'application/pdf' });
    } catch (err: any) {
        console.error("Error generating DOFAEI:", err);
        throw err;
    }
}
