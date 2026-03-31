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

    // Color logic for negative currency: starts/ends with () and contains no letters
    let textColor = rgb(0, 0, 0);
    const isNegativeCurrency = s.trim().startsWith('(') && s.trim().endsWith(')') && !/[a-zA-Z]/.test(s);
    if (isNegativeCurrency) textColor = rgb(0.8, 0, 0);

    p.drawText(s, { x: finalX, y: PH - y, size, font, color: textColor });
};

/**
 * Dibuja texto justificado dentro de un ancho máximo.
 */
const drawJustifiedText = (p: any, text: string, x: number, y: number, maxWidth: number, font: any, size: number, isLastLine: boolean = false) => {
    const words = text.trim().split(/\s+/);
    if (words.length === 0) return;

    if (isLastLine || words.length === 1) {
        // Color logic for negative currency: starts/ends with () and contains no letters
        let textColor = rgb(0, 0, 0);
        const isNegativeCurrency = text.trim().startsWith('(') && text.trim().endsWith(')') && !/[a-zA-Z]/.test(text);
        if (isNegativeCurrency) textColor = rgb(0.8, 0, 0);
        
        p.drawText(text, { x, y: PH - y, size, font, color: textColor });
        return;
    }

    const totalWordsWidth = words.reduce((acc, word) => acc + font.widthOfTextAtSize(word, size), 0);
    const totalGaps = words.length - 1;
    const gapWidth = (maxWidth - totalWordsWidth) / totalGaps;

    let currentX = x;
    words.forEach((word) => {
        p.drawText(word, { x: currentX, y: PH - y, size, font, color: rgb(0, 0, 0) });
        currentX += font.widthOfTextAtSize(word, size) + gapWidth;
    });
};

const drawLine = (p: any, x1: number, y1: number, x2: number, y2: number, thickness = 0.5) => {
    p.drawLine({ start: { x: x1, y: PH - y1 }, end: { x: x2, y: PH - y2 }, thickness, color: rgb(0, 0, 0) });
};

const drawRect = (p: any, x: number, y: number, w: number, h: number, fill = false, color = rgb(0.9, 0.9, 0.9)) => {
    if (fill) { p.drawRectangle({ x, y: PH - y - h, width: w, height: h, color }); }
    else { p.drawRectangle({ x, y: PH - y - h, width: w, height: h, borderColor: rgb(0, 0, 0), borderWidth: 0.5 }); }
};

/**
 * Genera el reporte ACT-122 (Revision 12/2024)
 */
export async function generateAct122(projectId: string, choId: string) {
    try {
        const { data: projData } = await supabase.from('projects').select('*').eq('id', projectId).single();
        if (!projData) throw new Error("Proyecto no encontrado");
        const { data: contrData } = await supabase.from('contractors').select('*').eq('project_id', projectId).single();
        const { data: choData } = await supabase.from('chos').select('*').eq('id', choId).single();
        const { data: allChos } = await supabase.from('chos').select('cho_num, time_extension_days, proposed_change').eq('project_id', projectId).order('cho_num', { ascending: true });
        const { data: personnel } = await supabase.from('act_personnel').select('*').eq('project_id', projectId);
        const { data: contractItems } = await supabase.from('contract_items').select('item_num').eq('project_id', projectId);

        const personnelMap: Record<string, string> = {};
        personnel?.forEach(p => { personnelMap[p.role] = p.name; });

        // Identificar Items de Contrato vs Items Nuevos basándose en el checkbox is_new de cada item
        const allChoItems = Array.isArray(choData.items) ? choData.items : [];
        const contractChoItems = allChoItems.filter((it: any) => !it.is_new && !choData.is_new_item);
        const newChoItems = allChoItems.filter((it: any) => it.is_new || choData.is_new_item);

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

        const vc = [40, 65, 95, 250, 290, 330, 360, 405, 455, 525, PW - 45];

        // Lógica de fechas y montos acumulados
        let prevExtDays = 0;
        let prevCostMods = 0;
        const currentChoNum = parseFloat(choData.cho_num);
        if (allChos) {
            for (const c of allChos) {
                const loopNum = parseFloat(c.cho_num);
                if (loopNum < currentChoNum) {
                    prevExtDays += (parseInt(c.time_extension_days) || 0);
                    prevCostMods += (parseFloat(c.proposed_change) || 0);
                }
            }
        }

        const origStart = projData.date_project_start ? new Date(projData.date_project_start + "T00:00:00") : null;
        const origEndRaw = projData.date_orig_completion ? new Date(projData.date_orig_completion + "T00:00:00") : null;
        
        // El Revised Completion Date antes de este CHO (Box 10) es el Original + Extensiones Previas
        const dateRevisedBox10 = origEndRaw ? new Date(origEndRaw.getTime() + prevExtDays * 86400000) : null;
        
        // New Completion Date (Box 12) = Box 10 + Extensión de esta CHO
        const timeExt = parseInt(choData.time_extension_days) || 0;
        const dateNewBox12 = dateRevisedBox10 ? new Date(dateRevisedBox10.getTime() + timeExt * 86400000) : null;

        // Montos para Box 28, 29, 30
        const originalCost = parseFloat(projData.cost_original) || 0;
        const actualContractAmount = originalCost + prevCostMods;
        const currentChoAmount = parseFloat(choData.proposed_change) || 0;
        const newContractAmount = actualContractAmount + currentChoAmount;
        
        // Fecha Administrativa: Nueva fecha de completar + 2 años
        let adminDateStr = "N/A";
        if (dateNewBox12) {
            const d = new Date(dateNewBox12);
            d.setFullYear(d.getFullYear() + 2);
            adminDateStr = formatDate(d.toISOString().split('T')[0]);
        }

        const drawFrontHeader = (p: any) => {
            drawText(p, "Government of Puerto Rico", PW / 2, 22, font, 8.5, true);
            drawText(p, "Department of Transportation and Public Works", PW / 2, 32, font, 8.5, true);
            drawText(p, "HIGHWAY AND TRANSPORTATION AUTHORITY", PW / 2, 45, fontBold, 10.5, true);
            drawText(p, "ACT-122", PW - 45, 22, fontBold, 9, false, true);
            drawText(p, "Rev 12/2024", PW - 45, 32, font, 7.5, false, true);
            drawText(p, "CHANGE ORDER", PW / 2, 68, fontBold, 13, true);
            drawLine(p, 40, 75, PW - 45, 75, 2.5);
            drawLine(p, 40, 78, PW - 45, 78, 0.5);

            const ly = 95, ry = 95, lh = 15.5, sy = 95;
            const c1 = 40, c2 = 330, le1 = 315; 
            const drawF = (n: string, lbl: string, x: number, y: number, lineEnd: number, v: any) => {
                const label = `${n}. ${lbl}`;
                drawText(p, label, x, y, fontBold, 7.2);
                const w = fontBold.widthOfTextAtSize(label, 7.2);
                drawLine(p, x + w + 5, y + 2, lineEnd, y + 2, 0.4);
                drawText(p, v || "", x + w + 8, y, font, 7.8);
            };

            drawF("1", "Project Name:", c1, ly, le1, projData.name);
            drawF("2", "Contractor:", c1, ly+lh, le1, contrData?.name);
            // #28, 29, 30 removed from header — they go only in signature section
            drawF("3", "Project Num.:", c1, ly+lh*2, 205, projData.num_act);
            drawF("4", "Federal Num.:", c1, ly+lh*3, 205, projData.num_federal);
            drawF("5", "Oracle Num.:", c1, ly+lh*4, 230, projData.num_oracle);
            drawF("6", "Contract Num.:", c1, ly+lh*5, 205, projData.num_contrato);
            drawF("7", "Amendment:", c1, ly+lh*6, 150, choData.amendment_letter || "0");
            drawF("8", "CHO Number:", c1, ly+lh*7, 150, choData.cho_num);

            // Right column: 9. Date (CHO date), 9a. Contract Beginning Date, 10-14
            drawF("9", "Date:", c2, ry, PW-45, formatDate(choData.cho_date));
            drawF("9a", "Contract Beginning Date:", c2, ry+lh, PW-45, formatDate(origStart ? origStart.toISOString().split('T')[0] : ""));
            drawF("10", "Revised Completion Date:", c2, ry+lh*2, PW-45, formatDate(dateRevisedBox10 ? dateRevisedBox10.toISOString().split('T')[0] : ""));
            drawF("11", "Add Contract Time (Days):", c2, ry+lh*3, PW-45, choData.time_extension_days || "0");
            drawF("11a", "Compensable Days:", c2, ry+lh*4, PW-45, "0");
            drawF("12", "New Completion Date:", c2, ry+lh*5, PW-45, formatDate(dateNewBox12));
            drawF("13", "New Administrative Term Date (Contralor):", c2, ry+lh*6, PW-45, adminDateStr);
            drawF("14", "FMIS End Date:", c2, ry+lh*7, PW-45, formatDate(projData.fmis_end_date));

            const cby = 222;
            drawText(p, "15. Favor de marcar todas las opciones que apliquen", 40, cby, fontBold, 7);
            const sqCb = (x: number, lbl: string, chk: boolean) => {
                drawRect(p, x, cby + 8, 9, 9);
                if (chk) drawText(p, "X", x + 1, cby + 16, fontBold, 8);
                drawText(p, lbl, x + 15, cby + 16, fontBold, 7.2);
            };
            sqCb(50, "Change of Contract Items", choData.is_change_of_contract || contractChoItems.length > 0);
            sqCb(200, "New Items (Extra Work)", choData.is_new_item || newChoItems.length > 0);
            sqCb(365, "Time Extension", choData.is_time_extension || (parseInt(choData.time_extension_days) || 0) > 0);

            const s16y = 252;
            drawText(p, "16. Description of Work/Scope of Work:", 40, s16y, fontBold, 8);
            drawRect(p, 40, s16y+4, PW-85, 90);
            for(let i=0; i<6; i++) drawLine(p, 45, s16y+22+(i*12), PW-50, s16y+22+(i*12), 0.1);
            const desc = (projData.scope || "").replace(/\s+/g, ' ').trim();
            const words = desc.split(' ');
            let currentLine: string[] = [], dy = s16y + 22, lineIdx = 0;
            const targetWidth = PW - 105;

            words.forEach((w: string) => {
                const testLine = [...currentLine, w].join(' ');
                if (font.widthOfTextAtSize(testLine, 7.5) < targetWidth) {
                    currentLine.push(w);
                } else {
                    if (lineIdx < 6) {
                        drawJustifiedText(p, currentLine.join(' '), 48, dy, targetWidth, font, 7.5, false);
                    }
                    dy += 12;
                    currentLine = [w];
                    lineIdx++;
                }
            });
            if (currentLine.length > 0 && lineIdx < 6) {
                drawJustifiedText(p, currentLine.join(' '), 48, dy, targetWidth, font, 7.5, true);
            }

            const reqY = 352;
            const rt = ["Request is hereby made for approval of the following work to be performed in the above mentioned project. The contractor hereby agrees to perform the necessary work and furnish the necessary labor, materials", "and equipment that may be required by the Highway Authority and not to exceed the unit prices quoted below. The work to be performed and materials furnished shall be in accordance with the Standard", "Specifications of the P.R. Highway Authority and the Special Provisions applicable to the above project."];
            rt.forEach((l, i) => drawText(p, l, 40, reqY + (i*7.2), font, 5.8));

            return 375;
        };

        const drawTableLayout = (p: any, y: number, currentContractItems: any[], currentNewItems: any[], totalContract: number, totalNew: number) => {
            drawLine(p, 40, y, PW-45, y, 1.2);
            drawLine(p, 40, y+35, PW-45, y+35, 1.2);
            vc.forEach((x, i) => { if (i > 0 && i < vc.length - 1) drawLine(p, x, y, x, y+35, 0.4); });

            const hdr = (n: string, l1: string, l2: string, xS: number, xE: number, fontSize = 6.8) => {
                const cX = xS + (xE - xS) / 2;
                if (n) drawText(p, n, cX, y + 8, fontBold, fontSize, true);
                drawText(p, l1, cX, y + 17, fontBold, fontSize, true);
                if (l2) drawText(p, l2, cX, y + 26, fontBold, fontSize, true);
            };

            hdr("17", "Item", "Num", vc[0], vc[1]);
            hdr("18", "Item", "Spec.", vc[1], vc[2]);
            hdr("19", "Item Name (Description)", "", vc[2], vc[3]);
            hdr("20", "Additional", "Information", vc[3], vc[4], 6);
            hdr("", "Additional", "Code", vc[4], vc[5], 6);
            hdr("21", "Unit", "", vc[5], vc[6]);
            hdr("22", "Quantity", "", vc[6], vc[7]);
            hdr("23", "Unit Price", "", vc[7], vc[8]);
            hdr("24", "Amount", "", vc[8], vc[9]);
            hdr("25", "% Federal", "", vc[9], vc[10]);

            let cy = y + 35;
            // 26. Contract Items
            drawRect(p, 40, cy, PW-85, 14, true, rgb(0.9, 0.9, 0.9));
            drawText(p, "Contract Items", 45, cy+10, fontBold, 8);
            cy += 14;

            for (let i = 0; i < 5; i++) {
                const it = currentContractItems[i];
                if (it) {
                    const q = parseFloat(it.proposed_change || it.quantity) || 0;
                    const up = parseFloat(it.unit_price) || 0;
                    const amt = q * up;
                    const fedP = (it.fund_source || "").includes('80.25') ? "80.25%" : ((it.fund_source || "").includes('FHWA:100%') ? "100%" : "0%");

                    drawText(p, it.item_num || "", vc[0]+(vc[1]-vc[0])/2, cy+10, font, 7, true);
                    drawText(p, it.specification || "", vc[1]+(vc[2]-vc[1])/2, cy+10, font, 7, true);
                    drawText(p, (it.description || "").substring(0, 50), vc[2]+5, cy+10, font, 6.5);
                    drawText(p, "-", vc[3]+(vc[4]-vc[3])/2, cy+10, font, 7, true);
                    drawText(p, "-", vc[4]+(vc[5]-vc[4])/2, cy+10, font, 7, true);
                    drawText(p, it.unit || "", vc[5]+(vc[6]-vc[5])/2, cy+10, font, 7, true);
                    drawText(p, fmt(q), vc[7]-4, cy+10, font, 7, false, true);
                    drawText(p, fmt(up), vc[8]-4, cy+10, font, 7, false, true);
                    drawText(p, "$", vc[8]+5, cy+10, font, 7);
                    drawText(p, fmt(amt), vc[9]-5, cy+10, font, 7, false, true);
                    drawText(p, fedP, vc[9]+(vc[10]-vc[9])/2, cy+10, font, 7, true);
                } else {
                    drawText(p, "$", vc[8]+5, cy+10, font, 7);
                    drawText(p, "-", vc[9]-5, cy+10, font, 7, false, true);
                }
                drawLine(p, 40, cy+14, PW-45, cy+14, 0.2);
                vc.forEach(x => drawLine(p, x, cy, x, cy+14, 0.4));
                cy += 14;
            }

            const subX = vc[8] - 5;
            drawText(p, "26. Subtotal Contract Items", subX, cy+10, fontBold, 7.2, false, true);
            drawText(p, "$", vc[8]+5, cy+10, fontBold, 7.2);
            drawText(p, fmt(totalContract), vc[9]-5, cy+10, fontBold, 7.2, false, true);
            drawLine(p, 40, cy+14, PW-45, cy+14, 0.8);
            cy += 14;

            // 27. New Items
            drawRect(p, 40, cy, PW-85, 14, true, rgb(0.9, 0.9, 0.9));
            drawText(p, "New Items (Extra Work)", 45, cy+10, fontBold, 8);
            cy += 14;
            for (let i = 0; i < 3; i++) {
                const it = currentNewItems[i];
                if (it) {
                    const q = parseFloat(it.proposed_change || it.quantity) || 0;
                    const up = parseFloat(it.unit_price) || 0;
                    const amt = q * up;
                    const fedP = (it.fund_source || "").includes('80.25') ? "80.25%" : ((it.fund_source || "").includes('FHWA:100%') ? "100%" : "0%");

                    drawText(p, it.item_num || "", vc[0]+(vc[1]-vc[0])/2, cy+10, font, 7, true);
                    drawText(p, it.specification || "", vc[1]+(vc[2]-vc[1])/2, cy+10, font, 7, true);
                    drawText(p, (it.description || "").substring(0, 50), vc[2]+5, cy+10, font, 6.5);
                    drawText(p, "-", vc[3]+(vc[4]-vc[3])/2, cy+10, font, 7, true);
                    drawText(p, "-", vc[4]+(vc[5]-vc[4])/2, cy+10, font, 7, true);
                    drawText(p, it.unit || "", vc[5]+(vc[6]-vc[5])/2, cy+10, font, 7, true);
                    drawText(p, fmt(q), vc[7]-4, cy+10, font, 7, false, true);
                    drawText(p, fmt(up), vc[8]-4, cy+10, font, 7, false, true);
                    drawText(p, "$", vc[8]+5, cy+10, font, 7);
                    drawText(p, fmt(amt), vc[9]-5, cy+10, font, 7, false, true);
                    drawText(p, fedP, vc[9]+(vc[10]-vc[9])/2, cy+10, font, 7, true);
                } else {
                    drawText(p, "$", vc[8]+5, cy+10, font, 7);
                    drawText(p, "-", vc[9]-5, cy+10, font, 7, false, true);
                }
                drawLine(p, 40, cy+14, PW-45, cy+14, 0.2);
                vc.forEach(x => drawLine(p, x, cy, x, cy+14, 0.4));
                cy += 14;
            }

            drawText(p, "27. Subtotal New Items", subX, cy+10, fontBold, 7.2, false, true);
            drawText(p, "$", vc[8]+5, cy+10, fontBold, 7.2);
            drawText(p, fmt(totalNew), vc[9]-5, cy+10, fontBold, 7.2, false, true);
            drawLine(p, 40, cy+14, PW-45, cy+14, 0.8);
            cy += 14;

            return cy + 15;
        };

        const drawSignatureLayout = (p: any, y: number, totalAmt: number, isLastPage: boolean) => {
            const lX = 40;
            const financeX = 390;

            const drawSigGroup = (label: string, name: string, subtitle: string, yy: number, xOff = 0) => {
                if (label) drawText(p, label, lX + xOff, yy, fontBold, 8.2);
                const lineY = yy + 2, fieldX = lX + 80 + xOff, fieldW = 190;
                drawLine(p, fieldX, lineY, fieldX + fieldW, lineY, 0.5);
                drawLine(p, fieldX + fieldW + 5, lineY, fieldX + fieldW + 10, lineY, 0.4); 
                drawText(p, "-", fieldX + fieldW + 5, lineY, font, 7);
                drawLine(p, fieldX + fieldW + 15, lineY, fieldX + fieldW + 65, lineY, 0.5);
                drawText(p, "Date", fieldX + fieldW + 40, yy + 10, font, 6.2, true);
                drawText(p, subtitle, fieldX + (fieldW / 2), yy + 10, font, 6.2, true);
                drawText(p, name || "", fieldX + (fieldW / 2), yy - 1, font, 8.5, true);
            };

            const drawFinancial = (n: string, lbl: string, v: number, yy: number, isBold = false) => {
                if (!isLastPage) return; // Requisito: Solo en la última página
                const f = isBold ? fontBold : font;
                drawText(p, `${n}. ${lbl}:`, financeX, yy, f, 8.5);
                drawText(p, "$", financeX + 110, yy, f, 8.5);
                drawLine(p, financeX + 120, yy + 2, PW - 45, yy + 2, isBold ? 1.2 : 0.5);
                drawText(p, fmt(v), PW - 50, yy, f, 8.5, false, true);
            };

            drawSigGroup("31. Submitted by:", personnelMap["Administrador del Proyecto"], "Project Administrator / Resident Engineer or Inspector", y);
            drawFinancial("28", "Change Order Amount", totalAmt, y, true);

            drawSigGroup("32. Accepted by:", contrData?.representative, "Contractor", y + 38);
            // #29: Actual Contract Amount = Costo Original + TODOS los CHOs anteriores al actual
            drawFinancial("29", "Actual Contract Amount", actualContractAmount, y + 38);

            drawText(p, "33. Recommended by:", lX, y + 76, fontBold, 8.2);
            drawSigGroup("", personnelMap["Supervisor de Área"], "Area Supervisor or Project Manager", y + 76);
            // #30: New Contract Amount = Actual + este CHO
            drawFinancial("30", "New Contract Amount", newContractAmount, y + 76);

            drawSigGroup("", personnelMap["Director Regional"], "Distric Director or Program Manager", y + 114);
            const drawSigRight = (subtitle: string, yy: number) => {
                const fieldX = financeX, fieldW = 145, lineY = yy + 2;
                drawLine(p, fieldX, lineY, fieldX + fieldW, lineY, 0.5);
                drawLine(p, fieldX + fieldW + 5, lineY, fieldX + fieldW + 10, lineY, 0.4); 
                drawText(p, "-", fieldX + fieldW + 5, lineY, font, 7);
                drawLine(p, fieldX + fieldW + 15, lineY, PW - 45, lineY, 0.5);
                drawText(p, "Date", fieldX + fieldW + 30, yy + 10, font, 6.2, true);
                drawText(p, subtitle, fieldX + (fieldW / 2), yy + 10, font, 6.2, true);
            };
            drawSigRight("Construction Office Director", y + 114);

            drawText(p, "34. Approved by:", lX, y + 152, fontBold, 8.2);
            drawSigGroup("", "Edwin Gonzalez Montalvo, P.E.", "Executive Director", y + 152);
            drawSigRight("Federal Highway Administration", y + 152);
        };

        const drawBackPage = (p: any, showReasons: boolean, lines: string[]) => {
             const py = 45;
             drawText(p, "1. Project Name:", 40, py, fontBold, 8); drawLine(p, 110, py+2, 450, py+2, 0.5); drawText(p, projData.name, 115, py, font, 8.5);
             drawText(p, "3. Project Num.:", 40, py+20, fontBold, 8); drawLine(p, 110, py+22, 350, py+22, 0.5); drawText(p, projData.num_act, 115, py+20, font, 8.5);
             drawText(p, "8. CHO Number:", 390, py+20, fontBold, 8); drawLine(p, 470, py+22, PW-40, py+22, 0.5); drawText(p, choData.cho_num, 475, py+20, font, 8.5);
             drawLine(p, 40, py+40, PW-45, py+40, 0.8);
             
             let currentY = py + 65;

             if (showReasons) {
                 drawText(p, "35. Reasons that justify this Change Order:", 40, currentY, fontBold, 9);
                 drawText(p, "Due to:", 40, currentY+18, font, 8);
                 ["Design", "Construction", "Contract", "Utilities", "Other"].forEach((t, i) => {
                     const x = 100 + (i*95); drawRect(p, x, currentY+10, 11, 11);
                     if (choData.reason === t) drawText(p, "X", x+2, currentY+19, fontBold, 9);
                     drawText(p, t, x+15, currentY+19, font, 7.5);
                 });
                 drawLine(p, 40, currentY + 35, PW-45, currentY + 35, 1);
                 currentY += 55;
             }
             
             drawText(p, "36. Change Order Justification", 40, currentY, fontBold, 9);
             const boxHeight = PH - currentY - 110;
             drawRect(p, 40, currentY+5, PW-85, boxHeight);
             
             let jy = currentY + 18;
             const targetWidth = PW - 105;
             lines.forEach((line, idx) => {
                 if (jy < PH - 60) {
                     drawJustifiedText(p, line, 48, jy, targetWidth, font, 8.5, idx === lines.length - 1);
                 }
                 jy += 12;
             });
        };

        let totalSubContract = 0;
        contractChoItems.forEach((it: any) => totalSubContract += (parseFloat(it.proposed_change || it.quantity) || 0) * (parseFloat(it.unit_price) || 0));
        let totalSubNew = 0;
        newChoItems.forEach((it: any) => totalSubNew += (parseFloat(it.quantity || it.proposed_change) || 0) * (parseFloat(it.unit_price) || 0));
        const totalAmt = totalSubContract + totalSubNew;

        const numSets = Math.max(Math.ceil(contractChoItems.length / 5), Math.ceil(newChoItems.length / 3), 1);

        // Pre-generar líneas de justificación
        const allJustifyLines: string[] = [];
        const justifyDesc = (choData.justification || "").replace(/\s+/g, ' ').trim();
        const jWords = justifyDesc.split(' ');
        let currentJLine: string[] = [];
        const jTargetWidth = PW - 105;

        jWords.forEach((w: string) => {
            const testLine = [...currentJLine, w].join(' ');
            if (font.widthOfTextAtSize(testLine, 8.5) < jTargetWidth) {
                currentJLine.push(w);
            } else {
                allJustifyLines.push(currentJLine.join(' '));
                currentJLine = [w];
            }
        });
        if (currentJLine.length > 0) allJustifyLines.push(currentJLine.join(' '));

        let remainingJLines = [...allJustifyLines];

        for (let sIdx = 0; (sIdx < numSets) || remainingJLines.length > 0; sIdx++) {
            // Página Frontal
            if (sIdx < numSets) {
                const frontPage = pdfDoc.addPage([PW, PH]);
                const startTableY = drawFrontHeader(frontPage);

                const pageContractItems = contractChoItems.slice(sIdx * 5, (sIdx + 1) * 5);
                const pageNewItems = newChoItems.slice(sIdx * 3, (sIdx + 1) * 3);

                const pageSubContract = pageContractItems.reduce((acc: number, it: any) => acc + (parseFloat(it.proposed_change || it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 0);
                const pageSubNew = pageNewItems.reduce((acc: number, it: any) => acc + (parseFloat(it.proposed_change || it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 0);

                const sigY = drawTableLayout(frontPage, startTableY, pageContractItems, pageNewItems, pageSubContract, pageSubNew);
                drawSignatureLayout(frontPage, sigY, totalAmt, sIdx === numSets - 1);
            }

            // Página Trasera (siempre para mantener el par Front-Back, o si queda justificación)
            const backPage = pdfDoc.addPage([PW, PH]);
            const isFirstBack = sIdx === 0;
            const maxLines = isFirstBack ? 43 : 47;
            const pageLines = remainingJLines.splice(0, maxLines);
            drawBackPage(backPage, isFirstBack, pageLines);
        }

        // Numeración de páginas global
        const pages = pdfDoc.getPages();
        pages.forEach((p, idx) => {
            drawText(p, `Page      ${idx + 1}      of      ${pages.length}`, PW / 2, PH - 25, font, 9.5, true);
        });

        const pdfBytes = await pdfDoc.save();
        return new Blob([pdfBytes as any], { type: 'application/pdf' });
    } catch (err: any) { console.error("Error generating ACT-122:", err); throw err; }
}
