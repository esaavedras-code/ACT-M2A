import { supabase } from './supabase';
import { formatDate as utilsFormatDate, formatCurrency } from './utils';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Genera el "CONSTRUCTION FINAL REPORT" (8. Final Construction Report)
 * Replicando la estructura de múltiples páginas: Partidas, Pagos y Totales.
 */
export async function generateFinalConstructionReport(projectId: string) {
    try {
        // 1. Fetch data
        const { data: proj } = await supabase.from('projects').select('*').eq('id', projectId).single();
        if (!proj) throw new Error("Proyecto no encontrado");

        const { data: items } = await supabase.from('contract_items').select('*').eq('project_id', projectId).order('item_num');
        const { data: certs } = await supabase.from('payment_certifications').select('*').eq('project_id', projectId).order('cert_num');
        const { data: contr } = await supabase.from('contractors').select('name').eq('project_id', projectId).single();
        const contractorName = contr?.name || proj.contractor_name || '---';

        const { data: personnel } = await supabase.from('act_personnel').select('*').eq('project_id', projectId);
        const personnelMap: Record<string, string> = {};
        personnel?.forEach(p => { personnelMap[p.role] = p.name; });

        // 2. Document Setup
        const pdfDoc = await PDFDocument.create();
        const fR = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const BK = rgb(0, 0, 0);
        const LG = rgb(0.97, 0.97, 0.97);
        const PW = 792, PH = 612; // Landscape
        const ML = 30, MR = 30;

        const TXT = (pg: any, txt: string | number | null | undefined, x: number, y: number, sz: number, bold = false, align: 'left' | 'center' | 'right' = 'left', color = BK) => {
            if (txt === undefined || txt === null) return;
            const s = txt.toString();
            const font = bold ? fB : fR;
            let px = x;
            if (align === 'center') px = x - font.widthOfTextAtSize(s, sz) / 2;
            if (align === 'right') px = x - font.widthOfTextAtSize(s, sz);
            pg.drawText(s, { x: px, y: PH - y, size: sz, font, color });
        };

        const LINE = (pg: any, x1: number, y1: number, x2: number, y2: number, thick = 0.5) => {
            pg.drawLine({ start: { x: x1, y: PH - y1 }, end: { x: x2, y: PH - y2 }, thickness: thick, color: BK });
        };

        const RECT = (pg: any, x: number, y: number, w: number, h: number, fill = false) => {
            if (fill) pg.drawRectangle({ x, y: PH - y - h, width: w, height: h, color: LG });
            pg.drawRectangle({ x, y: PH - y - h, width: w, height: h, borderWidth: 0.5, borderColor: BK });
        };

        const drawHeader = (pg: any) => {
            try {
                // Logo placeholder or attempt
                // (Assumes act_logo.png is in public)
            } catch (e) { }

            TXT(pg, "(Rev. 9/80)", ML, 35, 7);
            TXT(pg, "Commonwealth of Puerto Rico", PW / 2, 40, 9, false, 'center');
            TXT(pg, "Highway Authority", PW / 2, 50, 9, false, 'center');
            TXT(pg, "Construction Area", PW / 2, 60, 9, false, 'center');
            TXT(pg, "CONSTRUCTION FINAL REPORT", PW / 2, 85, 13, true, 'center');

            let curY = 110;
            // First Row
            TXT(pg, "Project Name:", ML, curY, 8, true);
            TXT(pg, proj.name, ML + 60, curY, 8);
            LINE(pg, ML + 58, curY + 2, ML + 280, curY + 2);

            TXT(pg, "Municipality:", ML + 300, curY, 8, true);
            TXT(pg, proj.location || "Varios", ML + 360, curY, 8);
            LINE(pg, ML + 358, curY + 2, ML + 550, curY + 2);

            TXT(pg, "Contract Time:", ML + 570, curY, 8, true);
            TXT(pg, proj.orig_working_days, ML + 665, curY, 8, false, 'center');
            LINE(pg, ML + 630, curY + 2, ML + 700, curY + 2);
            TXT(pg, "Days", ML + 710, curY, 8, true);

            curY += 18;
            // Second Row
            TXT(pg, "Project Number:", ML, curY, 8, true);
            TXT(pg, `${proj.num_act}${proj.num_federal ? ', F#: ' + proj.num_federal : ''}`, ML + 70, curY, 8);
            LINE(pg, ML + 68, curY + 2, ML + 280, curY + 2);

            TXT(pg, "Contractor:", ML + 300, curY, 8, true);
            TXT(pg, contractorName, ML + 350, curY, 8);
            LINE(pg, ML + 348, curY + 2, ML + 550, curY + 2);

            TXT(pg, "Contract Time Began:", ML + 570, curY, 8, true);
            TXT(pg, utilsFormatDate(proj.date_project_start), ML + 665, curY, 8, false, 'center');
            LINE(pg, ML + 650, curY + 2, PW - MR, curY + 2);

            curY += 18;
            // Third Row
            TXT(pg, "Administrator:", ML, curY, 8, true);
            TXT(pg, proj.admin_name, ML + 60, curY, 8);
            LINE(pg, ML + 58, curY + 2, ML + 280, curY + 2);

            TXT(pg, "Work Completed on:", ML + 570, curY, 8, true);
            TXT(pg, utilsFormatDate(proj.date_rev_completion || proj.date_orig_completion), ML + 665, curY, 8, false, 'center');
            LINE(pg, ML + 650, curY + 2, PW - MR, curY + 2);
        };

        // --- ITEMS TABLE CONFIG ---
        const colW = [25, 172, 45, 30, 50, 60, 45, 60, 45, 60, 45, 60, 35];
        const colX = [ML];
        for (let i = 1; i < colW.length; i++) colX.push(colX[i - 1] + colW[i - 1]);

        const drawTableHead = (pg: any, y: number) => {
            // Grouped Headers Row
            const GH_Y = y - 10;
            TXT(pg, "Original and new ítems", colX[2] + (colX[6] - colX[2]) / 2, GH_Y, 7, true, 'center');
            TXT(pg, "Overruns", colX[6] + (colX[8] - colX[6]) / 2, GH_Y, 7, true, 'center');
            TXT(pg, "Underruns", colX[8] + (colX[10] - colX[8]) / 2, GH_Y, 7, true, 'center');
            TXT(pg, "Work performed", colX[10] + (colX[12] - colX[10]) / 2, GH_Y, 7, true, 'center');

            RECT(pg, ML, y, PW - ML - MR, 25, true);
            const heads = [
                "Item\nNum.", "Description of Item", "Approx.\nQuantity", "Unit", "Unit\nPrice", "Amount\nBid",
                "Qty", "Amount", "Qty", "Amount", "Qty", "Amount", "REM."
            ];
            heads.forEach((h, i) => {
                const lines = h.split('\n');
                lines.forEach((ln, j) => {
                    TXT(pg, ln, colX[i] + colW[i] / 2, y + 8 + (j * 8), 6, true, 'center');
                });
                if (i > 0) LINE(pg, colX[i], y, colX[i], y + 25);
            });
        };

        // --- DRAW ITEMS ---
        let page = pdfDoc.addPage([PW, PH]);
        drawHeader(page);
        let curY = 175;
        drawTableHead(page, curY);
        curY += 25;
        let tableStartY = curY - 25;

        (items || []).forEach((item) => {
            if (curY > PH - 40) {
                // Draw bottom border and vertical lines of current page
                LINE(page, ML, curY, PW - MR, curY);
                colX.forEach(x => LINE(page, x, tableStartY, x, curY));
                LINE(page, PW - MR, tableStartY, PW - MR, curY);

                page = pdfDoc.addPage([PW, PH]);
                drawHeader(page);
                curY = 175;
                drawTableHead(page, curY);
                curY += 25;
                tableStartY = curY - 25;
            }

            const origQty = item.quantity || 0;
            const execQty = item.executed_quantity || 0;
            const diff = execQty - origQty;
            const price = item.unit_price || 0;

            TXT(page, item.item_num, colX[0] + colW[0] / 2, curY + 8, 7, false, 'center');
            TXT(page, item.description?.substring(0, 45), colX[1] + 3, curY + 8, 6.5);
            TXT(page, origQty.toFixed(2), colX[2] + colW[2] - 3, curY + 8, 7, false, 'right');
            TXT(page, item.unit, colX[3] + colW[3] / 2, curY + 8, 7, false, 'center');
            TXT(page, formatCurrency(price).replace('$', ''), colX[4] + colW[4] - 3, curY + 8, 7, false, 'right');
            TXT(page, formatCurrency(origQty * price).replace('$', ''), colX[5] + colW[5] - 3, curY + 8, 7, false, 'right');

            if (diff > 0) {
                TXT(page, diff.toFixed(2), colX[6] + colW[6] - 3, curY + 8, 7, false, 'right');
                TXT(page, formatCurrency(diff * price).replace('$', ''), colX[7] + colW[7] - 3, curY + 8, 7, false, 'right');
            } else {
                TXT(page, "0.00", colX[6] + colW[6] - 3, curY + 8, 7, false, 'right');
                TXT(page, "0.00", colX[7] + colW[7] - 3, curY + 8, 7, false, 'right');
            }
            
            if (diff < 0) {
                TXT(page, Math.abs(diff).toFixed(2), colX[8] + colW[8] - 3, curY + 8, 7, false, 'right');
                TXT(page, formatCurrency(Math.abs(diff) * price).replace('$', ''), colX[9] + colW[9] - 3, curY + 8, 7, false, 'right');
            } else {
                TXT(page, "0.00", colX[8] + colW[8] - 3, curY + 8, 7, false, 'right');
                TXT(page, "0.00", colX[9] + colW[9] - 3, curY + 8, 7, false, 'right');
            }

            TXT(page, execQty.toFixed(2), colX[10] + colW[10] - 3, curY + 8, 7, false, 'right');
            TXT(page, formatCurrency(execQty * price).replace('$', ''), colX[11] + colW[11] - 3, curY + 8, 7, true, 'right');

            LINE(page, ML, curY + 12, PW - MR, curY + 12, 0.2);
            curY += 12;
        });
        // Final vertical lines for items
        LINE(page, ML, curY, PW - MR, curY);
        colX.forEach(x => LINE(page, x, tableStartY, x, curY));
        LINE(page, PW - MR, tableStartY, PW - MR, curY);

        // --- PAYMENTS PAGE ---
        page = pdfDoc.addPage([PW, PH]);
        drawHeader(page);
        curY = 160;
        TXT(page, "Monthly payments summary from the Construction Area:", ML, curY, 9, true);
        curY += 15;

        const pColW = [40, 60, 75, 65, 65, 65, 65, 65, 65, 65, 95];
        const pColX = [ML];
        for (let i = 1; i < pColW.length; i++) pColX.push(pColX[i - 1] + pColW[i - 1]);

        const drawPHead = (pg: any, y: number) => {
            RECT(pg, ML, y, PW - ML - MR, 25, true);
            const phs = ["Rep.\nNum.", "Date", "Work\nPerformed", "Safety\nPen.", "Liq.\nDam.", "Extra\nRet.", "Price\nAdj.", "Mat.\nOn Site", "5%\nRet.", "Other\nPen.", "Amount\nPaid"];
            phs.forEach((h, i) => {
                const lns = h.split('\n');
                lns.forEach((ln, j) => TXT(pg, ln, pColX[i] + pColW[i] / 2, y + 8 + (j * 8), 6.5, true, 'center'));
                if (i > 0) LINE(pg, pColX[i], y, pColX[i], y + 25);
            });
        };

        drawPHead(page, curY);
        curY += 25;
        const pTableStartY = curY - 25;

        (certs || []).forEach(c => {
            TXT(page, c.cert_num, pColX[0] + pColW[0] / 2, curY + 8, 7, false, 'center');
            TXT(page, utilsFormatDate(c.cert_date), pColX[1] + pColW[1] / 2, curY + 8, 7, false, 'center');
            
            // Monthly payments summary cells - Fill with $0.00 if missing
            TXT(page, formatCurrency(c.work_performed_period || 0), pColX[2] + pColW[2] - 3, curY + 8, 7, false, 'right');
            TXT(page, formatCurrency(c.safety_penalty || 0), pColX[3] + pColW[3] - 2, curY + 8, 6.5, false, 'right');
            TXT(page, formatCurrency(c.liquidated_damages || 0), pColX[4] + pColW[4] - 2, curY + 8, 6.5, false, 'right');
            TXT(page, formatCurrency(c.extra_retainage || 0), pColX[5] + pColW[5] - 2, curY + 8, 6.5, false, 'right');
            TXT(page, formatCurrency(c.price_adjustments || 0), pColX[6] + pColW[6] - 2, curY + 8, 6.5, false, 'right');
            TXT(page, formatCurrency(c.material_on_site || 0), pColX[7] + pColW[7] - 2, curY + 8, 6.5, false, 'right');
            TXT(page, formatCurrency(c.retainage_period || 0), pColX[8] + pColW[8] - 2, curY + 8, 6.5, false, 'right');
            TXT(page, formatCurrency(c.other_penalties || 0), pColX[9] + pColW[9] - 2, curY + 8, 6.5, false, 'right');

            const paid = (c.work_performed_period || 0) - (c.retainage_period || 0);
            TXT(page, formatCurrency(paid), pColX[10] + pColW[10] - 3, curY + 8, 7, true, 'right');
            LINE(page, ML, curY + 12, PW - MR, curY + 12, 0.2);
            curY += 12;
        });
        LINE(page, ML, curY, PW - MR, curY);
        pColX.forEach(x => LINE(page, x, pTableStartY, x, curY));
        LINE(page, PW - MR, pTableStartY, PW - MR, curY);

        // --- TOTALS & SIGNATURES ---
        page = pdfDoc.addPage([PW, PH]);
        drawHeader(page);
        curY = 170;

        const sumX = ML + 480;
        const boxW = 200;
        RECT(page, sumX, curY, boxW, 55);
        TXT(page, "Original Contract Amount", sumX + 5, curY + 13, 8, false);
        TXT(page, formatCurrency(proj.amount_orig), sumX + boxW - 5, curY + 13, 8, false, 'right');
        LINE(page, sumX, curY + 18, sumX + boxW, curY + 18, 0.3);

        TXT(page, "Total Contract Cost", sumX + 5, curY + 31, 8, true);
        TXT(page, formatCurrency(proj.amount_final), sumX + boxW - 5, curY + 31, 8, true, 'right');
        LINE(page, sumX, curY + 36, sumX + boxW, curY + 36, 0.3);

        const diff = (proj.amount_final || 0) - (proj.amount_orig || 0);
        TXT(page, diff >= 0 ? "Net Overruns" : "Net Underruns", sumX + 5, curY + 49, 8);
        TXT(page, formatCurrency(Math.abs(diff)), sumX + boxW - 5, curY + 49, 8, false, 'right');

        // Signatures
        curY += 100;
        const sigW = 180;
        const sigGap = 65;
        const sigRows = [
            [{ label: "Prepared by:", title: "Project Administrator" }, { label: "Revised by:", title: "Final Settlement Official" }, { label: "Accepted by:", title: "Chief Project Control Office" }],
            [{ label: "Accepted:", title: "Contractor or Representative" }, { label: "Revised by:", title: "Regional Director" }, { label: "Approved by:", title: "Director Construction Area" }]
        ];

        sigRows.forEach(row => {
            row.forEach((s, idx) => {
                const x = ML + (idx * (sigW + sigGap));
                TXT(page, s.label, x, curY, 8);
                
                let nameStr = '_________________________';
                if (s.title.includes("Administrator")) nameStr = proj.admin_name || personnelMap["Administrador del Proyecto"] || nameStr;
                if (s.title.includes("Contractor")) nameStr = contractorName || personnelMap["Contratista"] || nameStr;
                if (s.title.includes("Regional Director")) nameStr = proj.regional_director || personnelMap["Director Regional"] || nameStr;
                if (s.title.includes("Chief Project Control")) nameStr = proj.chief_project_control || personnelMap["Chief Project Control"] || nameStr;
                if (s.title.includes("Director Construction")) nameStr = proj.dir_construction || personnelMap["Director de Construcción"] || nameStr;
                if (s.title.includes("Final Settlement Official")) nameStr = proj.liquidador_name || personnelMap["Liquidador"] || nameStr;

                TXT(page, nameStr, x + 50, curY, 8.5);
                LINE(page, x + 50, curY + 2, x + sigW, curY + 2);
                TXT(page, "Date", x + sigW + 5, curY, 8);
                LINE(page, x + sigW + 30, curY + 2, x + sigW + 60, curY + 2);
                TXT(page, s.title, x + sigW / 2 + 25, curY + 12, 7.5, true, 'center');
            });
            curY += 55;
        });

        // --- PAGE NUMBERING ---
        const pages = pdfDoc.getPages();
        pages.forEach((p, i) => {
            TXT(p, `Page ${i + 1} of ${pages.length}`, PW - MR, PH - 25, 8, false, 'right');
        });

        const pdfBytes = await pdfDoc.save();
        return new Blob([pdfBytes as any], { type: 'application/pdf' });
    } catch (err: any) {
        console.error("Error generating Final Construction Report:", err);
        throw err;
    }
}
