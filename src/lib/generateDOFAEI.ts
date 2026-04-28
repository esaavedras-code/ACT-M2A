import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { supabase } from './supabase';
import { formatDate, formatCurrency } from './utils';

const PW = 612; // 8.5"
const PH = 792; // 11"

const hexToRgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return rgb(r, g, b);
};

// COLORES IDENTICOS A LA FOTO
const COLORS = {
    BLACK_BG: rgb(0.15, 0.15, 0.15), // Para los headers de seccion
    WHITE: rgb(1, 1, 1),
    BLACK: rgb(0, 0, 0),
    RED_MARKER: rgb(1, 0, 0),
    TEXT_RED: rgb(1, 0, 0),
    EVAL_ORANGE: hexToRgb('#f7caac'),
    CAT_YELLOW: hexToRgb('#fff2ca'),
    ITEM_GREEN: hexToRgb('#91cf50'),
    GREY_LINE: rgb(0.6, 0.6, 0.6),
    LIGHT_GREY: rgb(0.9, 0.9, 0.9)
};

const drawText = (p: any, txt: any, x: number, y: number, font: any, size = 8, center = false, right = false, color = COLORS.BLACK) => {
    if (txt === undefined || txt === null) return;
    const s = txt.toString();
    const textWidth = font.widthOfTextAtSize(s, size);
    let finalX = x;
    if (center) finalX = x - (textWidth / 2);
    else if (right) finalX = x - textWidth;
    p.drawText(s, { x: finalX, y: PH - y, size, font, color });
};

const drawLine = (p: any, x1: number, y1: number, x2: number, y2: number, thickness = 0.5, color = COLORS.BLACK) => {
    p.drawLine({ start: { x: x1, y: PH - y1 }, end: { x: x2, y: PH - y2 }, thickness, color });
};

const drawRect = (p: any, x: number, y: number, w: number, h: number, fill = false, color = COLORS.BLACK_BG) => {
    if (fill) { p.drawRectangle({ x, y: PH - y - h, width: w, height: h, color }); }
    else { p.drawRectangle({ x, y: PH - y - h, width: w, height: h, borderColor: COLORS.BLACK, borderWidth: 0.5 }); }
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

        const dofaei = choData.dofaei_data || {};
        const determinations = dofaei.determination_conditions || {};
        const evaluations = dofaei.evaluations || {};

        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        let actLogoImg: any = null;
        try {
            const logoRes = await fetch('/act_logo.png');
            if (logoRes.ok) actLogoImg = await pdfDoc.embedPng(await logoRes.arrayBuffer());
        } catch (e) { console.warn("Logo not found", e); }

        const allItems = Array.isArray(choData.items) ? choData.items : [];
        // Ordenar items de menor a mayor por item_num
        allItems.sort((a: any, b: any) => {
            const numA = (a.item_num || "").toString().replace(/[^0-9]/g, '');
            const numB = (b.item_num || "").toString().replace(/[^0-9]/g, '');
            return parseInt(numA || '0') - parseInt(numB || '0');
        });

        const itemsPerPage = 5;
        const totalPages = Math.max(1, Math.ceil(allItems.length / itemsPerPage));

        for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
            const page = pdfDoc.addPage([PW, PH]);
            const pageItems = allItems.slice(pageIdx * itemsPerPage, (pageIdx + 1) * itemsPerPage);
            
            // --- HEADER ---
            if (actLogoImg) page.drawImage(actLogoImg, { x: 40, y: PH - 65, width: 100, height: 40 });
            drawText(page, `Página ${pageIdx + 1} de ${totalPages}`, PW - 40, 30, fontBold, 10, false, true);
            drawText(page, "Determination of Federal Aid Eligibility Form", PW / 2, 85, fontBold, 13, true);

            // --- SECTION I ---
            let y = 105;
            drawRect(page, 40, y, PW - 80, 15, true, COLORS.BLACK_BG);
            drawText(page, "I.  Project Information", 45, y + 11, fontBold, 9, false, false, COLORS.WHITE);
            y += 20;

            drawText(page, "Project Name:", 40, y + 8, fontBold, 8);
            drawText(page, "Project Number:", 240, y + 8, fontBold, 8);
            drawText(page, "Federal Number:", 380, y + 8, fontBold, 8);
            drawText(page, "Road Classif.", 510, y, fontBold, 8);

            y += 18;
            drawText(page, projData.name || "", 40, y + 8, font, 8);
            drawText(page, projData.num_act || "", 240, y + 8, font, 8);
            drawText(page, projData.num_federal || "", 380, y + 8, font, 8);
            
            // Road Classif Checks
            const roadClassif = dofaei.road_classif || "NHS";
            drawCheck(page, 510, y - 5, roadClassif === "Interstate", fontBold);
            drawText(page, "Interstate", 525, y + 3, font, 8);
            
            if (roadClassif === "NHS") {
                drawRect(page, 510, y + 10, 15, 8, true, COLORS.RED_MARKER);
                drawText(page, "NHS", 530, y + 17, fontBold, 8, false, false, COLORS.TEXT_RED);
            } else {
                drawText(page, "NHS", 530, y + 17, font, 8);
            }
            
            drawCheck(page, 570, y - 5, roadClassif === "Non NHS", fontBold);
            drawText(page, "Non NHS", 585, y + 3, font, 8);

            y += 15;
            drawLine(page, 40, y, 230, y, 0.5);
            drawLine(page, 240, y, 370, y, 0.5);
            drawLine(page, 380, y, 500, y, 0.5);

            y += 25;

            // --- SECTION II & III ---
            const mid = PW / 2;
            drawRect(page, 40, y, mid - 50, 15, true, COLORS.BLACK_BG);
            drawText(page, "II. Contract Modification Type", 45, y + 11, fontBold, 8, false, false, COLORS.WHITE);
            drawRect(page, mid - 5, y, mid - 35, 15, true, COLORS.BLACK_BG);
            drawText(page, "III. Modification Type", mid, y + 11, fontBold, 8, false, false, COLORS.WHITE);
            
            y += 20;
            const isCO = choData.is_change_of_contract !== false;
            if (isCO) {
                drawRect(page, 45, y, 15, 8, true, COLORS.RED_MARKER);
                drawText(page, "Change Order", 65, y + 8, fontBold, 8, false, false, COLORS.TEXT_RED);
            } else {
                drawText(page, "Change Order", 65, y + 8, font, 8);
            }
            
            drawCheck(page, 45, y + 15, !isCO, fontBold);
            drawText(page, "Extra Work Order", 65, y + 23, font, 8);

            // Column III contents
            drawCheck(page, mid, y, choData.is_new_item, fontBold);
            drawText(page, "Additional Scope of Work", mid + 15, y + 8, font, 8);
            
            if (choData.is_time_extension) {
                drawRect(page, mid, y + 15, 15, 8, true, COLORS.RED_MARKER);
                drawText(page, "Time Extension", mid + 20, y + 23, fontBold, 8, false, false, COLORS.TEXT_RED);
            } else {
                drawCheck(page, mid, y + 15, false, fontBold);
                drawText(page, "Time Extension", mid + 20, y + 23, font, 8);
            }

            drawCheck(page, mid + 125, y, false, fontBold);
            drawText(page, "Specification Change", mid + 140, y + 8, font, 8);
            drawCheck(page, mid + 125, y + 15, false, fontBold);
            drawText(page, "Emergency", mid + 140, y + 23, font, 8);

            drawCheck(page, mid + 235, y, false, fontBold);
            drawText(page, "Differing Site Conditions", mid + 250, y + 8, font, 8);
            
            const isOverrun = (choData.proposed_change || 0) > 0 && !choData.is_new_item;
            if (isOverrun) {
                drawRect(page, mid + 235, y + 15, 15, 8, true, COLORS.RED_MARKER);
                drawText(page, "Overruns or Underruns Items", mid + 255, y + 23, fontBold, 8, false, false, COLORS.TEXT_RED);
            } else {
                drawCheck(page, mid + 235, y + 15, false, fontBold);
                drawText(page, "Overruns or Underruns Items", mid + 255, y + 23, font, 8);
            }

            y += 40;

            // --- SECTION IV ---
            drawRect(page, 40, y, PW - 80, 15, true, COLORS.BLACK_BG);
            drawText(page, "IV. Determination Conditions", 45, y + 11, fontBold, 8, false, false, COLORS.WHITE);
            y += 20;
            
            drawCheck(page, 45, y, determinations.deductive_items, fontBold);
            drawText(page, "Deductive Items", 60, y + 8, font, 8);
            drawCheck(page, 45, y + 15, determinations.safety_items, fontBold);
            drawText(page, "Safety Items", 60, y + 23, font, 8);

            drawCheck(page, 160, y, determinations.rideability_bonus, fontBold);
            drawText(page, "Rideability Bonus or Contract Incentives", 175, y + 8, font, 7);
            drawCheck(page, 160, y + 15, determinations.sub_estimated_items, fontBold);
            drawText(page, "Sub-estimated Contract Items <100K", 175, y + 23, font, 7);

            drawCheck(page, 310, y, determinations.minor_change, fontBold);
            drawText(page, "Minor Change", 325, y + 8, font, 8);
            drawCheck(page, 310, y + 15, determinations.known_non_participating, fontBold);
            drawText(page, "Known Non-Participating Items", 325, y + 23, font, 8);

            drawCheck(page, 430, y, !!determinations.other, fontBold);
            drawText(page, "Other:", 445, y + 8, font, 8);
            drawText(page, determinations.other || "", 475, y + 8, font, 8);
            drawLine(page, 475, y + 10, 560, y + 10);

            const isMajor = Math.abs(parseFloat(choData.proposed_change) || 0) > 100000;
            if (isMajor || roadClassif !== "Non NHS") {
                drawRect(page, 530, y + 15, 15, 8, true, COLORS.RED_MARKER);
                drawText(page, "Major Change and/or NHS", PW - 45, y + 23, fontBold, 8, false, true, COLORS.TEXT_RED);
            }

            y += 40;

            // --- SECTION V ---
            drawRect(page, 40, y, PW - 80, 15, true, COLORS.BLACK_BG);
            drawText(page, "V.  Items Evaluated", 45, y + 11, fontBold, 8, false, false, COLORS.WHITE);
            y += 18;
            const vCols = [40, 70, 110, 310, 340, 380, 440, 490, 540, PW - 40];
            drawRect(page, vCols[0], y, PW - 80, 12, true, COLORS.LIGHT_GREY);
            drawText(page, "Item", vCols[0] + 2, y + 9, fontBold, 7);
            drawText(page, "Spec. Code", vCols[1] + 2, y + 9, fontBold, 7);
            drawText(page, "Description", vCols[2] + 2, y + 9, fontBold, 7);
            drawText(page, "Qty", vCols[3] + 2, y + 9, fontBold, 7);
            drawText(page, "Unit", vCols[4] + 2, y + 9, fontBold, 7);
            drawText(page, "Unit Price", vCols[5] + 2, y + 9, fontBold, 7);
            drawText(page, "Total", vCols[6] + 2, y + 9, fontBold, 7);
            drawText(page, "Elegibility", vCols[7] + 2, y + 9, fontBold, 7);
            drawText(page, "% of Federal Participation", vCols[8] + 2, y + 9, fontBold, 6);
            y += 12;

            pageItems.forEach(it => {
                const rowY = y + 10;
                const qty = parseFloat(it.proposed_change || it.quantity) || 0;
                const price = parseFloat(it.unit_price) || 0;
                const total = qty * price;
                const isFed = (it.fund_source || "").includes("FHWA");
                const ratio = isFed ? ((it.fund_source || "").includes("80.25") ? "80.25%" : "100%") : "0%";

                drawText(page, it.item_num || "", vCols[0] + 2, rowY, font, 7);
                drawText(page, it.specification || "", vCols[1] + 2, rowY, font, 7);
                drawText(page, (it.description || "").substring(0, 50), vCols[2] + 2, rowY, font, 6.5);
                drawText(page, qty.toLocaleString(), vCols[4] - 2, rowY, font, 7, false, true, qty < 0 ? COLORS.TEXT_RED : COLORS.BLACK);
                drawText(page, it.unit || "", vCols[4] + 2, rowY, font, 7);
                drawText(page, formatCurrency(price), vCols[6] - 2, rowY, font, 7, false, true);
                drawText(page, formatCurrency(total), vCols[7] - 2, rowY, font, 7, false, true, total < 0 ? COLORS.TEXT_RED : COLORS.BLACK);
                drawText(page, isFed ? "Yes" : "No", vCols[7] + 2, rowY, font, 7);
                drawText(page, ratio, vCols[8] + 2, rowY, font, 7);
                y += 12;
                drawLine(page, 40, y, PW - 40, y, 0.3, COLORS.GREY_LINE);
            });

            y += 20;

            // --- SECTION VI ---
            drawRect(page, 40, y, PW - 80, 15, true, COLORS.BLACK_BG);
            drawText(page, "VI. Evaluation of Federal Aid Eligible Items", 45, y + 11, fontBold, 8, false, false, COLORS.WHITE);
            y += 15;
            const viCols = [40, 275, 315, 355, 395, 435, 475, PW - 40];
            
            // Header Matrix
            drawRect(page, viCols[0], y, viCols[1]-viCols[0], 35, true, COLORS.EVAL_ORANGE);
            drawText(page, "Elegible Criteria", viCols[0] + 40, y + 20, fontBold, 9, true);

            pageItems.forEach((it, idx) => {
                const colX = viCols[2 + idx];
                drawRect(page, colX - 20, y, 40, 35, true, COLORS.EVAL_ORANGE);
                drawText(page, "Item", colX, y + 10, fontBold, 7, true);
                drawText(page, `#${it.item_num}`, colX, y + 18, fontBold, 7, true);
                
                // Subheader N/F Y/T (Intercambiados como pidió Enrique)
                drawRect(page, colX - 20, y + 23, 20, 12, true, hexToRgb('#91cf50')); // Verde para N/F ahora?
                drawRect(page, colX, y + 23, 20, 12, true, COLORS.TEXT_RED); // Rojo para Y/T ahora?
                
                // Enrique dijo: "intercambia donde dice N/F que diga Y/T y alreves"
                // En el original: Y/T (Rojo) - N/F (Verde)
                // Resultante: N/F (Rojo) - Y/T (Verde)
                drawRect(page, colX - 20, y + 23, 20, 12, true, COLORS.TEXT_RED);
                drawRect(page, colX, y + 23, 20, 12, true, hexToRgb('#91cf50'));
                drawText(page, "N/F", colX - 10, y + 31, fontBold, 6, true, false, COLORS.WHITE);
                drawText(page, "Y/T", colX + 10, y + 31, fontBold, 6, true, false, COLORS.BLACK);
            });
            drawRect(page, viCols[7]-100, y, 100, 35, true, COLORS.EVAL_ORANGE);
            drawText(page, "Comments", viCols[7] - 50, y + 20, fontBold, 9, true);
            y += 35;

            const matrix = [
                { cat: "1. Impact on the original scope of work", rows: [
                    { id: "1.1", text: "1.1. Proposed work includes subsidiary obligations..." },
                    { id: "1.2", text: "1.2. Proposed work is out of the previously authorized scope..." },
                    { id: "1.3", text: "1.3. Proposed work extends beyond the project boundaries" },
                    { id: "1.4", text: "1.4. Proposed work adversely impacts work already underway" },
                    { id: "1.5", text: "1.5. The cost of the proposed work exceeds available funds" },
                    { id: "1.6", text: "1.6. Proposed change is related to re-do or faulty work." }
                ]},
                { cat: "2. Basis of payment", rows: [
                    { id: "2.1", text: "2.1. PRHTA's independent evaluation discovered discrepancies..." },
                    { id: "2.2", text: "2.2. Cost analysis has not been documented." }
                ]},
                { cat: "3. Time Adjustments", rows: [
                    { id: "3.1", text: "3.1. Contract time extension has not been fully justified..." }
                ]},
                { cat: "4. Other Considerations", rows: [
                    { id: "4.1", text: "4.1. Proposed work involves routine maintenance." },
                    { id: "4.2", text: "4.2. Proposed change involves maintenance items..." }
                ]}
            ];

            matrix.forEach(m => {
                drawRect(page, 40, y, PW - 80, 12, true, COLORS.CAT_YELLOW);
                drawText(page, m.cat, 45, y + 9, fontBold, 7.5);
                y += 12;
                m.rows.forEach(r => {
                    drawText(page, r.text.substring(0, 80), 45, y + 9, font, 6.5);
                    pageItems.forEach((it, idx) => {
                        const itemId = it.item_num;
                        const evalVal = evaluations[itemId]?.[r.id]; // "YT" o "NF"
                        
                        drawRect(page, viCols[2+idx]-20, y, 40, 12, true, COLORS.ITEM_GREEN);
                        if (evalVal === "NF") {
                            drawText(page, "X", viCols[2+idx] - 10, y + 9, fontBold, 8, true);
                        } else if (evalVal === "YT") {
                            drawText(page, "X", viCols[2+idx] + 10, y + 9, fontBold, 8, true);
                        }
                    });
                    y += 12;
                    drawLine(page, 40, y, PW - 40, y, 0.3, COLORS.GREY_LINE);
                });
            });

            y += 30;

            // --- SECTION VII ---
            drawRect(page, 40, y, PW - 80, 15, true, COLORS.BLACK_BG);
            drawText(page, "VII. Contract Modification Impact", 45, y + 11, fontBold, 8, false, false, COLORS.WHITE);
            y += 20;
            drawText(page, "Time:", 40, y + 8, font, 8);
            drawText(page, (choData.time_extension_days || 0).toString(), 85, y + 8, font, 8, true);
            drawLine(page, 70, y + 10, 100, y + 10);
            drawText(page, "Calendar Days", 110, y + 8, font, 8);

            drawText(page, "Change Amount: $", 250, y + 8, font, 8);
            const amtStr = formatCurrency(Math.abs(parseFloat(choData.proposed_change) || 0));
            drawText(page, `(${amtStr})`, 370, y + 8, fontBold, 9, false, false, (parseFloat(choData.proposed_change) || 0) < 0 ? COLORS.TEXT_RED : COLORS.BLACK);
            drawLine(page, 325, y + 10, 450, y + 10);

            y += 40;
            const preparer = dofaei.prepared_by_name || "Eng. Luis R. Pastor Reyes";
            const prepPos = dofaei.prepared_by_position || "Ingeniero Residente";
            const prepDate = dofaei.prepared_by_date || new Date().toISOString().split('T')[0];

            drawText(page, `Prepared by: ${preparer}`, 40, y, fontBold, 9);
            drawText(page, prepDate, PW - 100, y, font, 9, false, true);
            
            y += 15;
            drawLine(page, 100, y, 350, y);
            drawLine(page, PW - 150, y, PW - 50, y);
            drawText(page, "Print Name", 225, y + 10, font, 7, true);
            drawText(page, prepPos, 225, y + 20, font, 8, true);
            drawText(page, "Position", 225, y + 30, font, 7, true);
            drawText(page, "Date", PW - 100, y + 10, font, 7, true);
            drawText(page, "Date", PW - 100, y + 30, font, 7, true);
            drawLine(page, 100, y + 20, 350, y + 20);
            drawLine(page, PW - 150, y + 20, PW - 50, y + 20);
        }

        const pdfBytes = await pdfDoc.save();
        return new Blob([pdfBytes as any], { type: 'application/pdf' });
    } catch (err: any) {
        console.error("Error generating DOFAEI:", err);
        throw err;
    }
}
