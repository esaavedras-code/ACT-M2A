import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { supabase } from './supabase';
import { formatDate, formatCurrency } from './utils';

const PW = 612; // 8.5"
const PH = 792; // 11"

const drawText = (p: any, txt: any, x: number, y: number, font: any, size = 8, center = false, right = false) => {
    if (txt === undefined || txt === null) return;
    const s = txt.toString().replace(/\t/g, ' ');
    const textWidth = font.widthOfTextAtSize(s, size);
    let finalX = x;
    if (center) finalX = x - (textWidth / 2);
    else if (right) finalX = x - textWidth;

    let textColor = rgb(0, 0, 0);
    p.drawText(s, { x: finalX, y: PH - y, size, font, color: textColor });
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
        const { data: allChos } = await supabase.from('chos').select('cho_num, time_extension_days').eq('project_id', projectId).order('cho_num', { ascending: true });
        const { data: contractItems } = await supabase.from('contract_items').select('item_num').eq('project_id', projectId);
        const { data: personnel } = await supabase.from('act_personnel').select('*').eq('project_id', projectId);

        const personnelMap: Record<string, string> = {};
        personnel?.forEach(p => { personnelMap[p.role] = p.name; });

        // Identificar Items de Contrato vs Items Nuevos
        const contractItemNums = new Set(contractItems?.map(ci => ci.item_num) || []);
        const allChoItems = Array.isArray(choData.items) ? choData.items : [];
        const contractChoItems = allChoItems.filter((it: any) => contractItemNums.has(it.item_num));
        const newChoItems = allChoItems.filter((it: any) => !contractItemNums.has(it.item_num));

        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        // Lógica de fechas
        let prevExtDays = 0;
        const currentChoNum = parseFloat(choData.cho_num);
        if (allChos) {
            for (const c of allChos) {
                const loopNum = parseFloat(c.cho_num);
                if (loopNum < currentChoNum) {
                    prevExtDays += (parseInt(c.time_extension_days) || 0);
                }
            }
        }

        const origEndRaw = projData.date_orig_completion ? new Date(projData.date_orig_completion + "T00:00:00") : null;
        
        // Old Completion Date (Box 19)
        const dateRevisedBox10 = origEndRaw ? new Date(origEndRaw.getTime() + prevExtDays * 86400000) : null;
        
        // New Completion Date (Box 20)
        const timeExt = parseInt(choData.time_extension_days) || 0;
        const dateNewBox12 = dateRevisedBox10 ? new Date(dateRevisedBox10.getTime() + timeExt * 86400000) : null;

        // Old Administrative Date (Box 21) => Old Completion + 2 years
        let oldAdminStr = "";
        if (dateRevisedBox10) {
            const d = new Date(dateRevisedBox10);
            d.setFullYear(d.getFullYear() + 2);
            oldAdminStr = formatDate(d.toISOString().split('T')[0]);
        }

        // New Administrative Date (Box 22) => New Completion + 2 years
        let adminDateStr = "";
        if (dateNewBox12) {
            const d = new Date(dateNewBox12);
            d.setFullYear(d.getFullYear() + 2);
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
        drawText(p, "SUPPLEMENTARY CONTRACT NO.", 260, 165, fontBold, 10);
        drawLine(p, 435, 167, 510, 167);
        drawText(p, String(choData.cho_num) || "", 445, 165, fontBold, 11);
        drawText(p, "7", 500, 155, fontBold, 6);

        // 8. Checkboxes
        let cbX = 320;
        let cbY = 190;
        const boxSize = 12;

        const hasContractChange = contractChoItems.length > 0;
        const hasNewItems = newChoItems.length > 0;
        const hasTimeExt = choData.time_extension_days > 0;

        const drawCheck = (lbl: string, checked: boolean, isFirst: boolean) => {
            if (isFirst) drawText(p, "8", cbX - 10, cbY - 3, fontBold, 6);
            p.drawRectangle({ x: cbX, y: PH - cbY - boxSize, width: boxSize, height: boxSize, borderColor: rgb(0,0,0), borderWidth: 0.5 });
            if (checked) {
                drawLine(p, cbX, cbY, cbX + boxSize, cbY + boxSize, 1);
                drawLine(p, cbX, cbY + boxSize, cbX + boxSize, cbY, 1);
            }
            drawText(p, lbl, cbX + 25, cbY + boxSize - 2, font, 10);
            cbY += 20;
        };
        drawCheck("Change of Contract Items", hasContractChange, true);
        drawCheck("Include New Items (Extra Work)", hasNewItems, false);
        drawCheck("Time Extension", hasTimeExt, false);

        // Body Text
        let by = 280;
        const lh = 20;

        drawText(p, "This agreement entered into this", 60, by, font, 10);
        drawLine(p, 215, by + 2, 380, by + 2);
        drawText(p, "9", 350, by - 5, fontBold, 6);
        drawText(p, formatDate(choData.cho_date) || "", 230, by, font, 10);
        drawText(p, "by and between the Puerto Rico Highway and Transportation", 385, by, font, 10);

        by += lh;
        drawText(p, "Authority, hereinafter referred to as the \"Authority\", represented by", 40, by, font, 10);
        drawLine(p, 335, by + 2, 540, by + 2);
        drawText(p, personnelMap["Director Ejecutivo"] || "", 340, by, font, 10);
        drawText(p, "10", 520, by - 5, fontBold, 6);
        drawText(p, ",", 545, by, font, 10);

        by += lh;
        drawLine(p, 40, by + 2, 180, by + 2);
        drawText(p, "Director Ejecutivo", 45, by - 1, font, 10);
        drawText(p, "11", 160, by - 5, fontBold, 6);
        drawText(p, "; and", 185, by, font, 10);
        drawLine(p, 220, by + 2, 470, by + 2);
        drawText(p, contrData?.name || "", 225, by, font, 10);
        drawText(p, "12", 450, by - 5, fontBold, 6);
        drawText(p, ", hereinafter referred to as the \"Contractor\",", 475, by, font, 9);

        by += lh;
        drawText(p, "represented by", 40, by, font, 10);
        drawLine(p, 120, by + 2, 310, by + 2);
        drawText(p, contrData?.representative || "", 125, by, font, 10);
        drawText(p, "13", 290, by - 5, fontBold, 6);
        drawText(p, ",", 315, by, font, 10);
        drawLine(p, 330, by + 2, 490, by + 2);
        drawText(p, "President", 335, by - 1, font, 10); // Standard fallback
        drawText(p, "14", 470, by - 5, fontBold, 6);

        by += lh * 1.5;
        drawText(p, "WITNESSETH THAT:", PW / 2, by, fontBold, 11, true);

        by += lh * 1.5;
        drawText(p, "Whereas, on", 40, by, font, 10);
        drawLine(p, 105, by + 2, 230, by + 2);
        drawText(p, "15", 215, by - 5, fontBold, 6);
        drawText(p, formatDate(projData.date_project_start) || "", 110, by, font, 10);
        drawText(p, ", the Parties entered into a contract for the construction of project", 235, by, font, 10);

        by += lh;
        drawLine(p, 40, by + 2, 550, by + 2);
        drawText(p, "16", 535, by - 5, fontBold, 6);
        drawText(p, projData.name || "", 45, by, font, 9);
        drawText(p, ".", 555, by, font, 10);

        by += lh;
        drawText(p, "Whereas, said Parties have agreed on the performance of certain change order at the above mentioned project.", 40, by, font, 10);

        by += lh * 1.5;
        drawText(p, "Now, therefore, the Parties hereto in consideration of the terms, covenants, agreements hereinafter contained and the", 40, by, font, 10);
        by += lh;
        drawText(p, "faithful performance thereof hereby mutually agree as follows:", 40, by, font, 10);

        by += lh * 1.5;
        drawText(p, "First: That the Contractor agrees to perform the change order at the amount of", 40, by, font, 10);
        drawLine(p, 390, by + 2, 530, by + 2);
        drawText(p, "17", 515, by - 5, fontBold, 6);
        const amtText = choData.proposed_change && parseFloat(choData.proposed_change) !== 0 ? "$" + formatCurrency(choData.proposed_change) : "";
        drawText(p, amtText, 395, by, font, 10);
        drawText(p, "and", 540, by, font, 10);

        by += lh;
        drawLine(p, 40, by + 2, 120, by + 2);
        drawText(p, "18", 100, by - 5, fontBold, 6);
        drawText(p, choData.time_extension_days > 0 ? choData.time_extension_days.toString() : "0", 60, by, font, 10);
        drawText(p, "additional calendar day(s). The Substantial Completion date is herein moved from", 125, by, font, 10);
        drawLine(p, 475, by + 2, 550, by + 2);
        drawText(p, "19", 540, by - 5, fontBold, 6);
        drawText(p, formatDate(dateRevisedBox10) || "", 480, by, font, 10);
        drawText(p, "to", 555, by, font, 10);

        by += lh;
        drawLine(p, 40, by + 2, 150, by + 2);
        drawText(p, "20", 135, by - 5, fontBold, 6);
        drawText(p, formatDate(dateNewBox12) || "", 50, by, font, 10);
        drawText(p, "and the Administrative Term date is herein moved from", 160, by, font, 10);
        drawLine(p, 390, by + 2, 470, by + 2);
        drawText(p, "21", 455, by - 5, fontBold, 6);
        drawText(p, oldAdminStr || "", 395, by, font, 10);
        drawText(p, "to", 480, by, font, 10);
        drawLine(p, 495, by + 2, 560, by + 2);
        drawText(p, "22", 550, by - 5, fontBold, 6);
        drawText(p, adminDateStr || "", 500, by, font, 10);
        drawText(p, "for", 565, by, font, 10);

        by += lh;
        drawText(p, "the contract.", 40, by, font, 10);

        by += lh * 1.5;
        drawText(p, "Second: That all documents forming part of the original contract are also a part of this supplementary contract.", 40, by, font, 10);

        by += lh * 2.5;
        
        // Signatures
        drawText(p, "The Authority", 110, by, fontBold, 11);
        drawText(p, "23", 220, by - 5, fontBold, 6);
        drawText(p, "The Contractor", 420, by, fontBold, 11);
        drawText(p, "24", 550, by - 5, fontBold, 6);

        by += lh * 2.5;
        drawLine(p, 40, by + 2, 260, by + 2);
        drawText(p, "10", 245, by - 5, fontBold, 6);
        drawLine(p, 380, by + 2, 560, by + 2);
        drawText(p, "13", 550, by - 5, fontBold, 6);

        by += lh;
        drawLine(p, 60, by + 2, 240, by + 2);
        drawText(p, "11", 225, by - 5, fontBold, 6);
        drawLine(p, 380, by + 2, 560, by + 2);
        drawText(p, "14", 550, by - 5, fontBold, 6);

        by += lh;
        drawLine(p, 60, by + 2, 240, by + 2);
        drawText(p, "Highway and Transportation Authority", 65, by + 12, fontBold, 10);
        drawLine(p, 380, by + 2, 560, by + 2);
        drawText(p, "12", 550, by - 5, fontBold, 6);

        by += lh;
        drawText(p, "660-43-3808", 110, by + 12, fontBold, 10);
        drawLine(p, 380, by + 2, 560, by + 2);
        drawText(p, "25", 550, by - 5, fontBold, 6);

        by += lh;
        drawLine(p, 380, by + 2, 560, by + 2);
        drawText(p, "26", 550, by - 5, fontBold, 6);

        // Distribution area
        const distY = PH - 65; 
        drawLine(p, 10, distY, PW - 10, distY);
        drawText(p, "Distribution", 15, distY + 15, font, 9);
        drawText(p, "27", 65, distY + 5, fontBold, 6);

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
