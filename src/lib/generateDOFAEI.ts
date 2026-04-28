import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { supabase } from './supabase';
import { formatDate, formatCurrency } from './utils';

const PW = 612; // 8.5"
const PH = 792; // 11"

/**
 * Helpers de dibujo para PDF-lib
 */
const drawText = (p: any, txt: any, x: number, y: number, font: any, size = 8, center = false, right = false) => {
    if (txt === undefined || txt === null) return;
    const s = txt.toString().replace(/\t/g, ' ');
    const textWidth = font.widthOfTextAtSize(s, size);
    let finalX = x;
    if (center) finalX = x - (textWidth / 2);
    else if (right) finalX = x - textWidth;

    let textColor = rgb(0, 0, 0);
    const isNegativeCurrency = s.trim().startsWith('(') && s.trim().endsWith(')') && !/[a-zA-Z]/.test(s);
    if (isNegativeCurrency) textColor = rgb(0.8, 0, 0);

    p.drawText(s, { x: finalX, y: PH - y, size, font, color: textColor });
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

        const fmt = (v: any) => {
            if (v === 0 || v === "0") return "0.00";
            if (!v || v === "-") return "-";
            const num = parseFloat(v);
            if (isNaN(num)) return "-";
            const formatted = Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            return num < 0 ? `(${formatted})` : formatted;
        };

        const drawHeader = (p: any, pageNum: number, totalPages: number) => {
            drawText(p, `Página ${pageNum} de ${totalPages}`, PW - 45, 30, font, 8, false, true);
            drawText(p, "Determination of Federal Aid Eligibility Form", PW / 2, 60, fontBold, 14, true);
            
            // Sección I
            drawText(p, "I.   Project Information", 40, 90, fontBold, 10);
            
            // Labels
            drawText(p, "Project Name:", 40, 110, fontBold, 8);
            drawText(p, "Project Number:", 240, 110, fontBold, 8);
            drawText(p, "Federal Number:", 380, 110, fontBold, 8);
            drawText(p, "Road Classif.", 510, 110, fontBold, 8);

            // Data Lines
            drawLine(p, 40, 125, 230, 125, 0.5);
            drawLine(p, 240, 125, 370, 125, 0.5);
            drawLine(p, 380, 125, 500, 125, 0.5);
            
            drawText(p, projData.name || "", 40, 123, font, 8);
            drawText(p, projData.num_act || "", 240, 123, font, 8);
            drawText(p, projData.num_federal || "", 380, 123, font, 8);

            // Road Classif Checks
            drawText(p, "Interstate", 510, 123, font, 7);
            drawText(p, "NHS", 510, 138, font, 7);
            drawCheck(p, 545, 138, true, fontBold); // Default NHS to true for safety in PR HTA usually
            drawText(p, "Non NHS", 565, 138, font, 7);
            drawCheck(p, 595, 138, false, fontBold);
        };

        const drawSections = (p: any) => {
            let y = 160;
            
            // Sección II & III side by side
            drawText(p, "II.  Contract Modification Type", 40, y, fontBold, 10);
            drawText(p, "III. Modification Type", 300, y, fontBold, 10);
            y += 20;

            const isCO = choData.is_change_of_contract || true; // Usually CO
            drawCheck(p, 45, y, isCO, fontBold);
            drawText(p, "Change Order", 60, y + 8, font, 8);

            drawCheck(p, 305, y, choData.is_new_item || false, fontBold);
            drawText(p, "Aditional Scope of Work", 320, y + 8, font, 8);
            y += 15;

            drawCheck(p, 45, y, !isCO, fontBold);
            drawText(p, "Extra Work Order", 60, y + 8, font, 8);

            drawCheck(p, 305, y, choData.is_time_extension || false, fontBold);
            drawText(p, "Time Extension", 320, y + 8, font, 8);
            y += 15;

            drawCheck(p, 305, y, false, fontBold);
            drawText(p, "Emergency", 320, y + 8, font, 8);
            y += 20;

            // Sección IV
            drawText(p, "IV.  Determination Conditions", 40, y, fontBold, 10);
            y += 20;

            const totalAmt = parseFloat(choData.proposed_change) || 0;
            const isMajor = totalAmt > 100000;

            drawCheck(p, 45, y, totalAmt < 0, fontBold);
            drawText(p, "Deductive Items", 60, y + 8, font, 8);

            drawCheck(p, 200, y, !isMajor, fontBold);
            drawText(p, "Minor Change", 215, y + 8, font, 8);

            drawCheck(p, 350, y, isMajor, fontBold);
            drawText(p, "Major Change and/or NHS", 365, y + 8, font, 8);
            y += 15;

            drawCheck(p, 45, y, false, fontBold);
            drawText(p, "Safety Items", 60, y + 8, font, 8);

            drawCheck(p, 200, y, isMajor && totalAmt < 100000, fontBold);
            drawText(p, "Sub-estimated Items < 100K", 215, y + 8, font, 8);

            drawCheck(p, 350, y, false, fontBold);
            drawText(p, "Known Non-Participating Items", 365, y + 8, font, 8);
            y += 30;

            return y;
        };

        const allItems = Array.isArray(choData.items) ? choData.items : [];
        const itemsPerPage = 15;
        const totalPages = Math.max(1, Math.ceil(allItems.length / itemsPerPage));

        for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
            const page = pdfDoc.addPage([PW, PH]);
            drawHeader(page, pageIdx + 1, totalPages);
            let y = pageIdx === 0 ? drawSections(page) : 150;

            // Sección V
            drawText(page, "V.  Items Evaluated", 40, y, fontBold, 10);
            y += 15;

            // Table Header
            const cols = [40, 70, 130, 280, 330, 370, 430, 490, 540, PW - 40];
            drawLine(page, cols[0], y, cols[9], y, 1);
            
            const headerY = y + 12;
            drawText(page, "Item", cols[0] + 2, headerY, fontBold, 7);
            drawText(page, "Spec Code", cols[1] + 2, headerY, fontBold, 7);
            drawText(page, "Description", cols[2] + 2, headerY, fontBold, 7);
            drawText(page, "Qty", cols[3] + 2, headerY, fontBold, 7);
            drawText(page, "Unit", cols[4] + 2, headerY, fontBold, 7);
            drawText(page, "Price", cols[5] + 2, headerY, fontBold, 7);
            drawText(page, "Total", cols[6] + 2, headerY, fontBold, 7);
            drawText(page, "Eligib.", cols[7] + 2, headerY, fontBold, 7);
            drawText(page, "Ratio", cols[8] + 2, headerY, fontBold, 7);

            y += 18;
            drawLine(page, cols[0], y, cols[9], y, 0.5);

            const pageItems = allItems.slice(pageIdx * itemsPerPage, (pageIdx + 1) * itemsPerPage);
            
            pageItems.forEach((it: any) => {
                const rowY = y + 12;
                const qty = parseFloat(it.proposed_change || it.quantity) || 0;
                const price = parseFloat(it.unit_price) || 0;
                const total = qty * price;
                const isFed = (it.fund_source || "").includes("FHWA");
                const ratio = isFed ? ((it.fund_source || "").includes("80.25") ? "0.8025" : "1.0000") : "0.0000";

                drawText(page, it.item_num || "", cols[0] + 2, rowY, font, 7);
                drawText(page, it.specification || "", cols[1] + 2, rowY, font, 7);
                drawText(page, (it.description || "").substring(0, 35), cols[2] + 2, rowY, font, 6.5);
                drawText(page, fmt(qty), cols[4] - 2, rowY, font, 7, false, true);
                drawText(page, it.unit || "", cols[4] + 2, rowY, font, 7);
                drawText(page, fmt(price), cols[6] - 2, rowY, font, 7, false, true);
                drawText(page, fmt(total), cols[7] - 2, rowY, font, 7, false, true);
                drawText(page, isFed ? "Yes" : "No", cols[7] + 2, rowY, font, 7);
                drawText(page, ratio, cols[8] + 2, rowY, font, 7);

                y += 18;
                drawLine(page, cols[0], y, cols[9], y, 0.3);
            });

            // Fill empty rows to maintain layout if desired, or just end
            
            // Signatures on last page
            if (pageIdx === totalPages - 1) {
                y += 40;
                drawLine(page, 40, y, 200, y, 0.5);
                drawLine(page, 220, y, 280, y, 0.5);
                drawText(page, "Project Administrator / Resident Engineer", 40, y + 12, font, 7);
                drawText(page, "Date", 220, y + 12, font, 7);

                drawLine(page, 340, y, 500, y, 0.5);
                drawLine(page, 520, y, 580, y, 0.5);
                drawText(page, "Area Supervisor / Project Manager", 340, y + 12, font, 7);
                drawText(page, "Date", 520, y + 12, font, 7);
                
                y += 50;
                drawLine(page, 40, y, 200, y, 0.5);
                drawLine(page, 220, y, 280, y, 0.5);
                drawText(page, "District Director / Program Manager", 40, y + 12, font, 7);
                drawText(page, "Date", 220, y + 12, font, 7);
            }
        }

        const pdfBytes = await pdfDoc.save();
        return new Blob([pdfBytes as any], { type: 'application/pdf' });
    } catch (err: any) {
        console.error("Error generating DOFAEI:", err);
        throw err;
    }
}
