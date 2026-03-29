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
    if (s.includes('(') && s.includes(')')) textColor = rgb(0.8, 0, 0);

    p.drawText(s, { x: finalX, y: PH - y, size, font, color: textColor });
};

const drawLine = (p: any, x1: number, y1: number, x2: number, y2: number, thickness = 0.5) => {
    p.drawLine({ start: { x: x1, y: PH - y1 }, end: { x: x2, y: PH - y2 }, thickness, color: rgb(0, 0, 0) });
};

const drawRect = (p: any, x: number, y: number, w: number, h: number, fill = false, color = rgb(0.9, 0.9, 0.9)) => {
    if (fill) { p.drawRectangle({ x, y: PH - y - h, width: w, height: h, color }); }
    else { p.drawRectangle({ x, y: PH - y - h, width: w, height: h, borderColor: rgb(0, 0, 0), borderWidth: 0.5 }); }
};

/**
 * Genera el reporte ACT-123 (Supplementary Contract Form) - Rev 12/2024
 */
export async function generateAct123(projectId: string, choId: string) {
    try {
        const { data: projData } = await supabase.from('projects').select('*').eq('id', projectId).single();
        if (!projData) throw new Error("Proyecto no encontrado");
        const { data: contrData } = await supabase.from('contractors').select('*').eq('project_id', projectId).single();
        const { data: choData } = await supabase.from('chos').select('*').eq('id', choId).single();
        const { data: personnel } = await supabase.from('act_personnel').select('*').eq('project_id', projectId);
        const { data: contractItems } = await supabase.from('contract_items').select('item_num').eq('project_id', projectId);

        const personnelMap: Record<string, string> = {};
        personnel?.forEach(p => { personnelMap[p.role] = p.name; });

        const contractItemNums = new Set(contractItems?.map(ci => ci.item_num) || []);
        const allChoItems = Array.isArray(choData.items) ? choData.items : [];
        const contractChoItems = allChoItems.filter((it: any) => contractItemNums.has(it.item_num));
        const newChoItems = allChoItems.filter((it: any) => !contractItemNums.has(it.item_num));

        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const fmt = (v: any) => {
            if (v === 0 || v === "0") return "0.00";
            if (!v || v === "-") return "-";
            return Math.abs(parseFloat(v)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        };

        const vc = [40, 65, 95, 250, 290, 330, 360, 405, 455, 525, PW - 45];

        const drawHeader = (p: any) => {
            drawText(p, "Government of Puerto Rico", PW / 2, 22, font, 8.5, true);
            drawText(p, "Department of Transportation and Public Works", PW / 2, 32, font, 8.5, true);
            drawText(p, "HIGHWAY AND TRANSPORTATION AUTHORITY", PW / 2, 45, fontBold, 10.5, true);
            drawText(p, "ACT-123", PW - 45, 22, fontBold, 9, false, true);
            drawText(p, "Rev 12/2024", PW - 45, 32, font, 7.5, false, true);
            drawText(p, "SUPPLEMENTARY CONTRACT FORM", PW / 2, 68, fontBold, 13, true);
            drawLine(p, 40, 75, PW - 45, 75, 2.5);

            const ly = 95, ry = 95, lh = 15.5;
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
            drawF("3", "Project Num.:", c1, ly+lh*2, 205, projData.num_act);
            drawF("6", "Contract Num.:", c1, ly+lh*3, 205, projData.num_contrato);
            drawF("8", "CHO Number:", c1, ly+lh*4, 150, choData.cho_num);

            drawF("9", "Contract Beginning Date:", c2, ry, PW-45, formatDate(projData.date_project_start));
            drawF("10", "Revised Completion Date:", c2, ry+lh, PW-45, formatDate(projData.date_orig_completion)); 
            drawF("11", "Add Contract Time (Days):", c2, ry+lh*2, PW-45, choData.time_extension_days || "0");
            drawF("12", "New Completion Date:", c2, ry+lh*3, PW-45, formatDate(projData.date_orig_completion));

            return 180;
        };

        const drawTable = (p: any, y: number, items: any[], title: string) => {
            drawRect(p, 40, y, PW-85, 14, true, rgb(0.9, 0.9, 0.9));
            drawText(p, title, 45, y+10, fontBold, 8);
            y += 14;

            vc.forEach((x, i) => { if (i > 0 && i < vc.length - 1) drawLine(p, x, y-14, x, y+items.length*14, 0.4); });

            items.forEach((it, i) => {
                const q = parseFloat(it.proposed_change || it.quantity) || 0;
                const up = parseFloat(it.unit_price) || 0;
                const amt = q * up;
                drawText(p, it.item_num || "", vc[0]+(vc[1]-vc[0])/2, y+10, font, 7, true);
                drawText(p, it.specification || "", vc[1]+(vc[2]-vc[1])/2, y+10, font, 7, true);
                drawText(p, it.description || "", vc[2]+5, y+10, font, 6.5);
                drawText(p, it.unit || "", vc[5]+(vc[6]-vc[5])/2, y+10, font, 7, true);
                drawText(p, fmt(q), vc[7]-4, y+10, font, 7, false, true);
                drawText(p, fmt(up), vc[8]-4, y+10, font, 7, false, true);
                drawText(p, fmt(amt), vc[9]-5, y+10, font, 7, false, true);
                drawLine(p, 40, y+14, PW-45, y+14, 0.2);
                y += 14;
            });
            return y;
        };

        const drawSignatures = (p: any, y: number, totalAmt: number) => {
            const financeX = 380;
            const drawFinancial = (n: string, lbl: string, v: number, yy: number) => {
                drawText(p, `${n}. ${lbl}:`, financeX, yy, fontBold, 8.5);
                drawText(p, "$", financeX + 110, yy, fontBold, 8.5);
                drawText(p, fmt(v), PW - 50, yy, fontBold, 8.5, false, true);
                drawLine(p, financeX + 120, yy + 2, PW - 45, yy + 2, 0.5);
            };

            const origCost = parseFloat(projData.cost_original) || 0;
            drawFinancial("28", "Change Order Amount", totalAmt, y);
            drawFinancial("29", "Actual Contract Amount", origCost, y+15);
            drawFinancial("30", "New Contract Amount", origCost + totalAmt, y+30);

            // Distribution
            const dy = y + 60;
            drawText(p, "37. Distribution:", 40, dy, fontBold, 8.5);
            const dist = ["Regional Office", "Preaudit Office", "Contractor", "Project", "Construction Area", "FHWA", "Treasury Office"];
            dist.forEach((d, i) => {
                drawText(p, `• ${d}`, 40 + (i % 2 === 0 ? 0 : 150), dy + 15 + Math.floor(i/2)*12, font, 7.5);
            });
        };

        const page = pdfDoc.addPage([PW, PH]);
        let nextY = drawHeader(page);
        nextY = drawTable(page, nextY, contractChoItems, "Contract Items");
        nextY = drawTable(page, nextY + 10, newChoItems, "New Items (Extra Work)");
        
        let totalAmt = 0;
        allChoItems.forEach((it: any) => totalAmt += (parseFloat(it.proposed_change || it.quantity) || 0) * (parseFloat(it.unit_price) || 0));
        
        drawSignatures(page, nextY + 30, totalAmt);

        const pdfBytes = await pdfDoc.save();
        return new Blob([pdfBytes as any], { type: 'application/pdf' });
    } catch (err: any) { console.error("Error generating ACT-123:", err); throw err; }
}
