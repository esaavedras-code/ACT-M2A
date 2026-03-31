import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { supabase } from './supabase';
import { formatDate, formatCurrency } from './utils';

const PW = 612; // 8.5"
const PH = 792; // 11"

const drawText = (p: any, txt: any, x: number, y: number, font: any, size = 8, center = false, right = false) => {
    if (txt === undefined || txt === null) return;
    // Fix WinAnsi encoding error (0x2011 is non-breaking hyphen)
    const s = txt.toString()
        .replace(/[\u2010-\u2015]/g, '-') // Replace special hyphens/dashes with standard minus
        .replace(/\t/g, ' ');

    const textWidth = font.widthOfTextAtSize(s, size);
    let finalX = x;
    if (center) finalX = x - (textWidth / 2);
    else if (right) finalX = x - textWidth;

    let textColor = rgb(0, 0, 0);
    p.drawText(s, { x: finalX, y: PH - y, size, font, color: textColor });
};

const drawWrappedText = (p: any, txt: string, x: number, y: number, maxWidth: number, font: any, size = 8, lineHeight = 10) => {
    if (!txt) return y;
    const cleanTxt = txt.toString().replace(/[\u2010-\u2015]/g, '-').replace(/\t/g, ' ');
    const words = cleanTxt.split(' ');
    let line = '';
    let currentY = y;

    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const testWidth = font.widthOfTextAtSize(testLine, size);
        if (testWidth > maxWidth && n > 0) {
            drawText(p, line, x, currentY, font, size);
            line = words[n] + ' ';
            currentY += lineHeight;
        } else {
            line = testLine;
        }
    }
    drawText(p, line, x, currentY, font, size);
    return currentY;
};

const drawLine = (p: any, x1: number, y1: number, x2: number, y2: number, thickness = 0.5) => {
    p.drawLine({ start: { x: x1, y: PH - y1 }, end: { x: x2, y: PH - y2 }, thickness, color: rgb(0, 0, 0) });
};

export async function generateAct123(projectId: string, choId: string) {
    try {
        const { data: projData } = await supabase.from('projects').select('*').eq('id', projectId).single();
        if (!projData) throw new Error("Proyecto no encontrado");
        const { data: contrData } = await supabase.from('contractors').select('*').eq('project_id', projectId).single();
        const { data: choData } = await supabase.from('chos').select('*').eq('id', choId).single();
        const { data: allChos } = await supabase.from('chos').select('cho_num, time_extension_days, proposed_change').eq('project_id', projectId).order('cho_num', { ascending: true });
        const { data: contractItems } = await supabase.from('contract_items').select('item_num, fund_source').eq('project_id', projectId);
        const { data: personnel } = await supabase.from('act_personnel').select('*').eq('project_id', projectId);

        const personnelMap: Record<string, string> = {};
        personnel?.forEach(p => { personnelMap[p.role] = p.name; });

        // Identificar Items de Contrato vs Items Nuevos
        const allChoItems = Array.isArray(choData.items) ? choData.items : [];
        const contractChoItems = allChoItems.filter((it: any) => !it.is_new && !choData.is_new_item);
        const newChoItems = allChoItems.filter((it: any) => it.is_new || choData.is_new_item);

        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        // Lógica de fechas
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

        const originalCost = parseFloat(projData.cost_original) || 0;
        const totalChangeNum = parseFloat(choData.proposed_change) || 0;
        const accIncPct = originalCost > 0 ? ((prevCostMods + totalChangeNum) / originalCost) * 100 : 0;
        const is100Fed = contractItems && contractItems.length > 0 && contractItems.every((ci: any) => ci.fund_source && (ci.fund_source === 'FHWA:80.25' || ci.fund_source === 'FHWA:100%'));

        const origEndRaw = projData.date_orig_completion ? new Date(projData.date_orig_completion + "T00:00:00") : null;
        
        // Old Completion Date (Box 19)
        const dateRevisedBox19 = origEndRaw ? new Date(origEndRaw.getTime() + prevExtDays * 86400000) : null;
        
        // New Completion Date (Box 20)
        const timeExt = parseInt(choData.time_extension_days) || 0;
        const dateNewBox20 = dateRevisedBox19 ? new Date(dateRevisedBox19.getTime() + timeExt * 86400000) : null;

        // Old Administrative Date (Box 21) => Old Completion + 730 days
        let oldAdminStr = "";
        if (dateRevisedBox19) {
            const d = new Date(dateRevisedBox19.getTime() + 730 * 86400000);
            oldAdminStr = formatDate(d.toISOString().split('T')[0]);
        }

        // New Administrative Date (Box 22) => New Completion + 730 days
        let adminDateStr = "";
        if (dateNewBox20) {
            const d = new Date(dateNewBox20.getTime() + 730 * 86400000);
            adminDateStr = formatDate(d.toISOString().split('T')[0]);
        }

        const p = pdfDoc.addPage([PW, PH]);

        // Header
        drawText(p, "Government of Puerto Rico", PW / 2, 22, font, 8.5, true);
        drawText(p, "Department of Transportation and Public Works", PW / 2, 32, font, 8.5, true);
        drawText(p, "HIGHWAY AND TRANSPORTATION AUTHORITY", PW / 2, 45, fontBold, 10.5, true);
        drawText(p, "Construction Area", PW / 2, 58, fontBold, 10, true);
        drawText(p, "ACT-123", PW - 45, 22, fontBold, 9, false, true);
        drawText(p, "Rev. 12/2024", PW - 45, 32, font, 7.5, false, true);

        // Box 1 - 6
        const lineStart = 120;
        const fillEnd = 280;

        drawText(p, "1. Project No.", 40, 80, font, 9);
        drawLine(p, lineStart, 82, fillEnd, 82);
        drawText(p, projData.num_act, lineStart + 5, 80, font, 9);

        drawText(p, "2. Oracle No.", 40, 95, font, 9);
        drawLine(p, lineStart, 97, fillEnd, 97);
        drawText(p, projData.num_oracle, lineStart + 5, 95, font, 9);

        drawText(p, "3. Federal No.", 40, 110, font, 9);
        drawLine(p, lineStart, 112, fillEnd, 112);
        drawText(p, projData.num_federal, lineStart + 5, 110, font, 9);

        drawText(p, "4. Contract No.", 40, 125, font, 9);
        drawLine(p, lineStart, 127, fillEnd, 127);
        drawText(p, projData.num_contrato, lineStart + 5, 125, font, 9);

        drawText(p, "5. OCPR Contract No.", 40, 140, font, 9);
        drawLine(p, lineStart, 142, fillEnd, 142);
        drawText(p, projData.num_ocpr || "-", lineStart + 5, 140, font, 9);

        drawText(p, "6. Account No.   (federal)", 40, 155, font, 9);
        drawLine(p, lineStart, 157, fillEnd, 157);
        drawText(p, projData.no_cuenta, lineStart + 5, 155, font, 9);

        drawText(p, "                         (state)", 40, 170, font, 9);
        drawLine(p, lineStart, 172, fillEnd, 172);

        // 7. SUPPLEMENTARY CONTRACT NO.
        drawText(p, "SUPPLEMENTARY CONTRACT NO.", 220, 160, fontBold, 9);
        drawLine(p, 385, 162, 470, 162);
        drawText(p, String(choData.cho_num) || "", 395, 160, fontBold, 10);
        drawText(p, "7", 475, 153, fontBold, 5.5);

        // 8. Checkboxes
        let cbX = 300;
        let cbY = 175;
        const boxSize = 9;

        const hasContractChange = choData.is_change_of_contract || contractChoItems.length > 0;
        const hasNewItems = choData.is_new_item || newChoItems.length > 0;
        const hasTimeExt = choData.is_time_extension || (parseInt(choData.time_extension_days) || 0) > 0;

        const drawCheck = (lbl: string, checked: boolean, isFirst: boolean) => {
            if (isFirst) drawText(p, "8", cbX - 10, cbY - 3, fontBold, 5.5);
            p.drawRectangle({ x: cbX, y: PH - cbY - boxSize, width: boxSize, height: boxSize, borderColor: rgb(0,0,0), borderWidth: 0.5 });
            if (checked) {
                drawLine(p, cbX, cbY, cbX + boxSize, cbY + boxSize, 1);
                drawLine(p, cbX, cbY + boxSize, cbX + boxSize, cbY, 1);
            }
            drawText(p, lbl, cbX + 18, cbY + boxSize - 2, font, 8.5);
            cbY += 14;
        };
        drawCheck("Change of Contract Items", hasContractChange, true);
        drawCheck("Include New Items (Extra Work)", hasNewItems, false);
        drawCheck("Time Extension", hasTimeExt, false);

        // Logic for Delegate (#10)
        let mainRole = "Director Área de Construcción";
        let mainName = personnelMap["Director Construcción"] || personnelMap["Director de Construcción"] || personnelMap["Director Area Construcción"] || "Enrique Saavedra (Director Const.)";

        const isDeductive = totalChangeNum <= 0;

        if (hasTimeExt || totalChangeNum > 250000.01 || accIncPct > 25) {
            mainRole = "Director Ejecutivo";
            mainName = "Edwin Gonzalez Montalvo, P.E.";
        } else if (is100Fed || (totalChangeNum > 50000.01 && totalChangeNum <= 250000.00 && accIncPct <= 25)) {
            mainRole = "Subdirector Ejecutivo";
            mainName = personnelMap["Subdirector Ejecutivo"] || "Ing. Rosemarie Visnauskas";
        } else {
            // Director Area: Hasta 50k and <= 10% inc, OR 100% Deductive
            mainRole = "Director Área de Construcción";
            // Name remains default (Director Area)
        }

        // Body Text
        const fs = 8.8;
        let by = 265;
        const lh = 17;

        // Line 1
        by += lh;
        drawText(p, "This agreement entered into this", 40, by, font, fs);
        drawLine(p, 175, by + 2, 320, by + 2);
        drawText(p, "9", 325, by - 3, fontBold, 5.5);
        drawText(p, "by and between the Puerto Rico Highway and Transportation", 345, by, font, fs);

        // Line 2
        by += lh + 6;
        const l2Prefix = "Authority, hereinafter referred to as the \"Authority\", represented by";
        drawText(p, l2Prefix, 40, by, font, fs);
        const l2W = font.widthOfTextAtSize(l2Prefix + " ", fs);
        drawLine(p, 40 + l2W, by + 2, PW - 55, by + 2);
        drawText(p, mainName, 40 + l2W + 5, by, font, fs);
        drawText(p, "10", PW - 50, by - 3, fontBold, 5.5);
        drawText(p, ",", PW - 45, by, font, fs);

        // Line 3
        by += lh + 6;
        drawLine(p, 40, by + 2, 230, by + 2);
        drawText(p, mainRole, 45, by - 1, font, fs - 0.5);
        drawText(p, "11", 235, by - 3, fontBold, 5.5);
        drawText(p, "; and", 245, by, font, fs);
        drawLine(p, 270, by + 2, 530, by + 2);
        const contractorNameEnd = drawWrappedText(p, contrData?.name || "", 275, by, 255, font, fs, 9);
        drawText(p, "12", 535, by - 3, fontBold, 5.5);
        drawText(p, ", hereinafter referred to as the", 540, by, font, fs - 1.5);
        by = Math.max(by, contractorNameEnd);

        // Line 4
        by += lh + 2;
        drawText(p, "\"Contractor\", represented by", 40, by, font, fs);
        drawLine(p, 160, by + 2, 380, by + 2);
        drawText(p, contrData?.representative || "", 165, by, font, fs);
        drawText(p, "13", 385, by - 3, fontBold, 5.5);
        drawText(p, ",", 395, by, font, fs);
        drawLine(p, 405, by + 2, 535, by + 2);
        drawText(p, "President", 415, by - 1, font, fs);
        drawText(p, "14", 540, by - 3, fontBold, 5.5);

        // WITNESSETH
        by += lh * 1.3;
        drawText(p, "WITNESSETH THAT:", PW / 2, by, fontBold, 10.5, true);

        // Line 5
        by += lh * 1.3;
        drawText(p, "Whereas, on", 40, by, font, fs);
        drawLine(p, 95, by + 2, 210, by + 2);
        drawText(p, formatDate(projData.date_contract_sign) || "", 105, by, font, fs);
        drawText(p, "15", 215, by - 3, fontBold, 5.5);
        drawText(p, ", the Parties entered into a contract for the construction of project", 225, by, font, fs);

        // Line 6 (NAME WRAP)
        by += lh + 1;
        drawLine(p, 40, by + 2, 540, by + 2);
        const nameEnd = drawWrappedText(p, projData.name || "", 45, by, 490, font, fs, 9);
        drawText(p, "16", 545, by - 3, fontBold, 5.5);
        drawText(p, ".", 542, by, font, fs);
        by = Math.max(by, nameEnd); // Adjust 'by' in case of wrap

        // Line 7
        by += lh + 1;
        drawText(p, "Whereas, said Parties have agreed on the performance of certain change order at the above mentioned project.", 40, by, font, fs);

        // Line 8
        by += lh * 1.2;
        drawText(p, "Now, therefore, the Parties hereto in consideration of the terms, covenants, agreements hereinafter contained and the", 40, by, font, fs);
        by += lh - 3;
        drawText(p, "faithful performance thereof hereby mutually agree as follows:", 40, by, font, fs);

        // Line 9
        by += lh * 1.3;
        drawText(p, "First: That the Contractor agrees to perform the change order at the amount of", 40, by, font, fs);
        drawLine(p, 360, by + 2, 510, by + 2);
        const amtText = choData.proposed_change && parseFloat(choData.proposed_change) !== 0 ? "$" + formatCurrency(choData.proposed_change) : "$0.00";
        drawText(p, amtText, 370, by, font, fs);
        drawText(p, "17", 515, by - 3, fontBold, 5.5);
        drawText(p, "and", 522, by, font, fs);

        // Line 10
        by += lh + 1;
        drawLine(p, 40, by + 2, 110, by + 2);
        drawText(p, (choData.time_extension_days || 0).toString(), 50, by, font, fs);
        drawText(p, "18", 120, by - 3, fontBold, 5.5);
        drawText(p, "additional calendar day(s). The Substantial Completion date is herein moved from", 135, by, font, fs);
        drawLine(p, 460, by + 2, 565, by + 2);
        drawText(p, formatDate(dateRevisedBox19) || "", 470, by, font, fs);
        drawText(p, "19", 570, by - 3, fontBold, 5.5);
        drawText(p, "to", 545, by, font, fs);

        // Line 11
        by += lh + 1;
        drawLine(p, 40, by + 2, 140, by + 2);
        drawText(p, formatDate(dateNewBox20) || "", 45, by, font, fs);
        drawText(p, "20", 145, by - 3, fontBold, 5.5);
        drawText(p, "and the Administrative Term date is herein moved from", 160, by, font, fs);
        drawLine(p, 380, by + 2, 470, by + 2);
        drawText(p, oldAdminStr || "", 390, by, font, fs);
        drawText(p, "21", 475, by - 3, fontBold, 5.5);
        drawText(p, "to", 495, by, font, fs);
        drawLine(p, 510, by + 2, 585, by + 2);
        drawText(p, adminDateStr || "", 515, by, font, fs);
        drawText(p, "22", 590, by - 3, fontBold, 5.5);
        drawText(p, "for", 555, by, font, fs);

        // Line 12
        by += lh + 1;
        drawText(p, "the contract.", 40, by, font, fs);

        // Second
        by += lh * 1.3;
        drawText(p, "Second: That all documents forming part of the original contract are also a part of this supplementary contract.", 40, by, font, fs);

        by += 40;
        
        // Signatures Section
        drawText(p, "The Authority", 160, by, fontBold, 10.5, true);
        drawText(p, "23", 160, by - 12, fontBold, 5.5, true);

        drawText(p, "The Contractor", PW - 160, by, fontBold, 10.5, true);
        drawText(p, "24", PW - 160, by - 12, fontBold, 5.5, true);

        by += lh * 1.8;
        drawLine(p, 40, by + 2, 280, by + 2);
        drawText(p, "10", 285, by - 3, fontBold, 5.5);
        drawText(p, mainName, 45, by, font, 9); 

        drawLine(p, PW - 280, by + 2, PW - 40, by + 2);
        drawText(p, "13", PW - 35, by - 3, fontBold, 5.5);
        drawText(p, contrData?.representative || "", PW - 275, by, font, 9);

        by += lh + 14;
        drawLine(p, 60, by + 2, 260, by + 2);
        drawText(p, "11", 265, by - 3, fontBold, 5.5);
        drawText(p, mainRole, 65, by, font, 8.5); 

        drawLine(p, PW - 280, by + 2, PW - 40, by + 2);
        drawText(p, "14", PW - 35, by - 3, fontBold, 5.5);
        drawText(p, "President", PW - 275, by, font, 8.5);

        by += lh + 12;
        drawText(p, "Highway and Transportation Authority", 80, by + 12, fontBold, 8.5);
        drawLine(p, 60, by + 2, 260, by + 2);

        drawLine(p, PW - 280, by + 2, PW - 40, by + 2);
        drawText(p, "12", PW - 35, by - 3, fontBold, 5.5);
        drawText(p, contrData?.name || "", PW - 275, by, font, 9);

        by += 28;
        drawText(p, "Seguro Social Patronal del Contratista:", PW - 280, by - 10, font, 8);
        drawLine(p, PW - 280, by + 2, PW - 40, by + 2);
        drawText(p, contrData?.ss_patronal || "", PW - 275, by, font, 9);
        drawText(p, "25", PW - 35, by - 3, fontBold, 5.5);

        by += 28;
        drawText(p, "Correo electrónico:", PW - 280, by - 10, font, 8);
        drawLine(p, PW - 280, by + 2, PW - 40, by + 2);
        drawText(p, contrData?.email || "", PW - 275, by, font, 8.5);
        drawText(p, "26", PW - 35, by - 3, fontBold, 5.5);

        // Distribution area
        const distY = PH - 65; 
        drawLine(p, 10, distY, PW - 10, distY);
        drawText(p, "Distribution", 15, distY + 15, font, 9);
        drawText(p, "27", 85, distY + 5, fontBold, 6);

        const dx1 = 150, dx2 = 195, dx3 = 310, dx4 = 360;
        const dby = distY + 15;
        drawText(p, "ORIGINAL", dx1, dby, fontBold, 7);
        drawText(p, "Treasury Section", dx2, dby, font, 7);
        drawText(p, "COPY 3", dx3, dby, fontBold, 7);
        drawText(p, "District Office", dx4, dby, font, 7);

        drawText(p, "COPY 1", dx1, dby + 10, fontBold, 7);
        drawText(p, "Preintervention Section", dx2, dby + 10, font, 7);
        drawText(p, "COPY 4", dx3, dby + 10, fontBold, 7);
        drawText(p, "Project", dx4, dby + 10, font, 7);

        drawText(p, "COPY 2", dx1, dby + 20, fontBold, 7);
        drawText(p, "Contractor", dx2, dby + 20, font, 7);
        drawText(p, "COPY 5", dx3, dby + 20, fontBold, 7);
        drawText(p, "Construction Office", dx4, dby + 20, font, 7);

        drawText(p, "COPY 6", dx3, dby + 30, fontBold, 7);
        drawText(p, "FHWA", dx4, dby + 30, font, 7);

        const pdfBytes = await pdfDoc.save();
        return new Blob([pdfBytes as any], { type: 'application/pdf' });
    } catch (err: any) { 
        console.error("Error generating ACT-123:", err); 
        throw err; 
    }
}
