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

/**
 * Genera el reporte ACT-123 (Supplementary Contract Form) - Rev 12/2024
 */
export async function generateAct123(projectId: string, choId: string) {
    try {
        const { data: projData } = await supabase.from('projects').select('*').eq('id', projectId).single();
        if (!projData) throw new Error("Proyecto no encontrado");
        const { data: contrData } = await supabase.from('contractors').select('*').eq('project_id', projectId).single();
        const { data: choData } = await supabase.from('chos').select('*').eq('id', choId).single();
        const { data: allChos } = await supabase.from('chos').select('cho_num, time_extension_days, proposed_change').eq('project_id', projectId).order('cho_num', { ascending: true });
        const { data: contractItems } = await supabase.from('contract_items').select('item_num').eq('project_id', projectId);

        const currentChoNum = parseFloat(choData.cho_num);
        let prevCostMods = 0;
        if (allChos) {
            for (const c of allChos) {
                if (parseFloat(c.cho_num) < currentChoNum) {
                    prevCostMods += (parseFloat(c.proposed_change) || 0);
                }
            }
        }

        const originalCost = parseFloat(projData.cost_original) || 0;
        const actualContractAmount = originalCost + prevCostMods;
        const currentChoAmount = parseFloat(choData.proposed_change) || 0;
        const newContractAmount = actualContractAmount + currentChoAmount;

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

        const drawHeader = (p: any) => {
            drawText(p, "Government of Puerto Rico", PW / 2, 22, font, 8.5, true);
            drawText(p, "Department of Transportation and Public Works", PW / 2, 32, font, 8.5, true);
            drawText(p, "HIGHWAY AND TRANSPORTATION AUTHORITY", PW / 2, 45, fontBold, 10.5, true);
            drawText(p, "ACT-123", PW - 45, 22, fontBold, 9, false, true);
            drawText(p, "Rev 12/2024", PW - 45, 32, font, 7.5, false, true);
            drawText(p, "SUPPLEMENTARY CONTRACT FORM", PW / 2, 68, fontBold, 13, true);
            drawLine(p, 40, 75, PW - 45, 75, 2.5);

            const ly = 95, lh = 15.5;
            const c1 = 40, le1 = 300; 
            const drawF = (n: string, lbl: string, x: number, lineIdx: number, lineEnd: number, v: any) => {
                const label = `${n}. ${lbl}`;
                const yy = ly + (lineIdx * lh);
                drawText(p, label, x, yy, fontBold, 7.2);
                const w = fontBold.widthOfTextAtSize(label, 7.2);
                drawLine(p, x + w + 5, yy + 2, lineEnd, yy + 2, 0.4);
                drawText(p, v || "", x + w + 8, yy, font, 7.8);
            };

            // ACT-123 Specific Boxes (1-7)
            drawF("1", "Project No.:", c1, 0, le1, projData.num_act);
            drawF("2", "Oracle No.:", c1, 1, le1, projData.num_oracle);
            drawF("3", "Federal No.:", c1, 2, le1, projData.num_federal);
            drawF("4", "Contract No.:", c1, 3, le1, projData.num_contrato);
            drawF("5", "OCPR Contract No.:", c1, 4, le1, projData.num_contrato_ocpr || "-");
            drawF("6", "Account No.:", c1, 5, le1, projData.no_cuenta || "-");
            
            drawF("7", "SUPPLEMENTARY CONTRACT NO.:", PW - 260, 0, PW - 45, choData.cho_num);

            return 200;
        };

        const vc = [40, 65, 95, 250, 290, 330, 360, 405, 455, 525, PW - 45];
        const drawTable = (p: any, y: number, items: any[], title: string, boxNum: string) => {
            drawText(p, `${boxNum}. ${title}`, 45, y - 5, fontBold, 8.5);
            drawLine(p, 40, y + 2, PW - 45, y + 2, 0.5);
            y += 10;

            items.forEach((it, i) => {
                const q = parseFloat(it.proposed_change || it.quantity) || 0;
                const up = parseFloat(it.unit_price) || 0;
                const amt = q * up;
                drawText(p, it.item_num || "", vc[0]+(vc[1]-vc[0])/2, y, font, 7, true);
                drawText(p, it.description || "", vc[2]+5, y, font, 6.5);
                drawText(p, it.unit || "", vc[5]+(vc[6]-vc[5])/2, y, font, 7, true);
                drawText(p, fmt(q), vc[7]-4, y, font, 7, false, true);
                drawText(p, fmt(up), vc[8]-4, y, font, 7, false, true);
                drawText(p, fmt(amt), vc[9]-5, y, font, 7, false, true);
                y += 12;
            });
            return y;
        };

        const page = pdfDoc.addPage([PW, PH]);
        let nextY = drawHeader(page);
        nextY = drawTable(page, nextY, contractChoItems, "Change of Contract Items", "8");
        nextY = drawTable(page, nextY + 20, newChoItems, "New Items (Extra Work)", "9");
        
        // Totals (Box 28-30)
        const ty = nextY + 30;
        const drawFin = (p: any, n: string, lbl: string, v: number, yy: number) => {
            drawText(p, `${n}. ${lbl}:`, 320, yy, fontBold, 8.5);
            drawText(p, "$", 460, yy, fontBold, 8.5);
            drawText(p, fmt(v), PW - 50, yy, fontBold, 8.5, false, true);
        };
        drawFin(page, "28", "Change Order Amount", currentChoAmount, ty);
        drawFin(page, "29", "Actual Contract Amount", actualContractAmount, ty + 15);
        drawFin(page, "30", "New Contract Amount", newContractAmount, ty + 30);

        const pdfBytes = await pdfDoc.save();
        return new Blob([pdfBytes as any], { type: 'application/pdf' });
    } catch (err: any) { console.error("Error generating ACT-123:", err); throw err; }
}
