import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { supabase } from './supabase';
import { formatDate, formatCurrency, roundedAmt } from './utils';

const PW = 612; // 8.5"
const PH = 792; // 11"

const drawText = (p: any, txt: any, x: number, y: number, font: any, size = 8, center = false, right = false, color = rgb(0, 0, 0)) => {
    if (txt === undefined || txt === null) return;
    
    // Convert and strip control chars EXCEPT newline
    const str = txt.toString()
        .replace(/[\r\t]/g, ' ')
        .replace(/[\x00-\x09\x0B-\x1F\x7F-\x9F]/g, "");
        
    const lines = str.split('\n');
    let currY = y;
    
    for (let i = 0; i < lines.length; i++) {
        const s = lines[i];
        const textWidth = font.widthOfTextAtSize(s, size);
        let finalX = x;
        if (center) finalX = x - (textWidth / 2);
        else if (right) finalX = x - textWidth;
        
        p.drawText(s, { x: finalX, y: PH - currY, size, font, color });
        currY += size * 1.1; // Move down for next line
    }
};

const getDaysDiff = (d1Str: string | null | undefined, d2Str: string | null | undefined) => {
    if (!d1Str || !d2Str) return 0;
    const [y1, m1, d1] = d1Str.split('-').map(Number);
    const [y2, m2, d2] = d2Str.split('-').map(Number);
    if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return 0;
    const d1Obj = new Date(y1, m1 - 1, d1);
    const d2Obj = new Date(y2, m2 - 1, d2);
    // Standard DOT contract time is end - start (exclusive of first day, so it matches raw subtraction)
    // If it requires inclusive (+1), add +1. Most math in this system is just subtraction.
    return Math.abs(Math.round((d2Obj.getTime() - d1Obj.getTime()) / (1000 * 60 * 60 * 24))) + 1;
};

const getDaysDiffExclusive = (d1Str: string | null | undefined, d2Str: string | null | undefined) => {
    if (!d1Str || !d2Str) return 0;
    const [y1, m1, d1] = d1Str.split('-').map(Number);
    const [y2, m2, d2] = d2Str.split('-').map(Number);
    if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return 0;
    const d1Obj = new Date(y1, m1 - 1, d1);
    const d2Obj = new Date(y2, m2 - 1, d2);
    return Math.abs(Math.round((d2Obj.getTime() - d1Obj.getTime()) / (1000 * 60 * 60 * 24)));
};


const drawLine = (p: any, x1: number, y1: number, x2: number, y2: number, thickness = 0.5) => {
    p.drawLine({ start: { x: x1, y: PH - y1 }, end: { x: x2, y: PH - y2 }, thickness, color: rgb(0, 0, 0) });
};

const drawRect = (p: any, x: number, y: number, w: number, h: number, fill = false, color = rgb(0.9, 0.9, 0.9)) => {
    if (fill) { p.drawRectangle({ x, y: PH - y - h, width: w, height: h, color }); }
    else { p.drawRectangle({ x, y: PH - y - h, width: w, height: h, borderColor: rgb(0, 0, 0), borderWidth: 1 }); }
};

export async function generateCCMLReport(projectId: string, upToChoId?: string) {
    try {
        const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single();
        const { data: allChos } = await supabase.from('chos').select('*').eq('project_id', projectId).order('cho_num', { ascending: true });
        const { data: agreementFunds } = await supabase.from('project_agreement_funds').select('*').eq('project_id', projectId).order('created_at', { ascending: true });
        const { data: certs } = await supabase.from('payment_certifications').select('*').eq('project_id', projectId).order('cert_num', { ascending: true });
        const { data: contrData } = await supabase.from('contractors').select('*').eq('project_id', projectId).single();
        const { data: personnel } = await supabase.from('act_personnel').select('*').eq('project_id', projectId);

        if (!project) throw new Error("Proyecto no encontrado");

        // Filtrar CHOs si se especificó upToChoId
        let selectedChos = allChos || [];
        if (upToChoId) {
            const targetCho = allChos?.find(c => c.id === upToChoId);
            if (targetCho) {
                selectedChos = allChos?.filter(c => c.cho_num <= targetCho.cho_num) || [];
            }
        }

        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        
        // Declare shared variables for multi-page rendering
        let colPeach: any, colGrayHeader: any, colLightGray: any, colYellow: any, colBlueHead: any, colWhite: any, colRed: any,
            colPeachHead: any, colDarkPeach: any, colOrangeHead: any, colLightYellow: any, colGreenHead: any, colLightBlueFill: any, colTotalConstBg: any, colLightGreen: any,
            gInfoW: any, legW: any, tInfoW: any, startX: any, gy: any, tx: any, ty: any, py: any, lx: any, ly: any, txInfo: any, totalW: any, bCols: any, subColW: any, cx3B: any, th3BCols: any, contY: any, contX: any, contW: any, cwx: any, msgFed: any, bx: any, rtTot: any, rtFed: any, rtToll: any, rtState: any, origTot: any,
            timeLabels: any, originalTime: any, totalExtensions: any, changeTimePct: any, totalChoAmt: any, changeAmtPct: any, totalRevisedTime: any, today: any, todayStr: any, elapsedDays: any, timeCompletedPct: any, totalConstructionCost: any, workPerformedPct: any, totalCertifiedAmount: any, contractorName: any, projectManagerName: any, labels: any, vals: any, timeVals: any;
        
        let pageNum = 1;
        let page = pdfDoc.addPage([PW, PH]);

        // Colors matching exactly
        colPeach = rgb(1, 0.85, 0.72); // Peach color
        colGrayHeader = rgb(0.88, 0.88, 0.88);
        colLightGray = rgb(0.94, 0.94, 0.94);
        colYellow = rgb(1, 0.9, 0.6);
        colBlueHead = rgb(0.65, 0.8, 0.95);
        colWhite = rgb(1, 1, 1);
        colRed = rgb(1, 0, 0);
        colPeachHead = rgb(0.98, 0.83, 0.72);
        colDarkPeach = rgb(0.96, 0.76, 0.60);
        colOrangeHead = rgb(1.0, 0.80, 0.40);
        colLightYellow = rgb(1.0, 0.95, 0.75);
        colGreenHead = rgb(0.83, 0.95, 0.83);
        colLightBlueFill = rgb(0.85, 0.96, 1.0);
        colTotalConstBg = rgb(0.7, 0.85, 1);
        colLightGreen = rgb(0.85, 0.95, 0.85);

        // --- HEADER ---
        drawText(page, "1A", 20, 15, fontBold, 8);
        drawText(page, "Ver: 11.29.2021", PW - 20, 15, font, 8, false, true);
        
        drawRect(page, PW / 2 - 135, 27, 270, 18, true, colPeach);
        drawRect(page, PW / 2 - 135, 27, 270, 18);
        drawText(page, "Construction Contract Modification log", PW / 2, 38, fontBold, 14, true);

        // Initialized colors again (redundant but safe given the existing structure)
        colPeach = rgb(1, 0.85, 0.72);

        // --- ROW 1: HEADER BOXES ---
        gInfoW = 190;
        legW = 160;
        tInfoW = 222;
         startX = 20;

        // General Info header
        drawRect(page, startX, 55, gInfoW, 12, true, colPeach);
        drawRect(page, startX, 55, gInfoW, 12);
        drawText(page, "General Information:", startX + gInfoW/2, 63, fontBold, 8, true);

        // Legend header
        drawRect(page, startX + gInfoW, 55, legW, 12, true, colPeach);
        drawRect(page, startX + gInfoW, 55, legW, 12);
        drawText(page, "Legend:", startX + gInfoW + legW/2, 63, fontBold, 8, true);

        // Time Info header
        drawRect(page, startX + gInfoW + legW, 55, tInfoW, 12, true, colPeach);
        drawRect(page, startX + gInfoW + legW, 55, tInfoW, 12);
        drawText(page, "Contract Time Information:", startX + gInfoW + legW + tInfoW/2, 63, fontBold, 8, true);

        // --- GENERAL INFORMATION SECTION ---
        contractorName = contrData?.name || project.contractor_name || "";
        projectManagerName = personnel?.find(p => p.role === 'Project Manager' || p.role === 'Administrador del Proyecto')?.name || project.project_manager_name || "";

        labels = ["Project Number:", "Federal Number:", "Oracle Number:", "Project Title:", "Contractor:", "Date:"];
        vals = [project.num_act, project.num_federal, project.num_oracle, project.name, contractorName, formatDate(new Date().toISOString())];
        
        gy = 67;
        labels.forEach((l: any, i: number) => {
            let val = vals[i] || "";
            // Divide en dos líneas si es muy largo
            let line1 = val;
            let line2 = "";
            if (font.widthOfTextAtSize(val, 6) > 115) {
                const words = val.split(" ");
                line1 = "";
                words.forEach((w: string) => {
                    if (font.widthOfTextAtSize(line1 + " " + w, 6) <= 115) line1 += (line1 === "" ? "" : " ") + w;
                    else line2 += (line2 === "" ? "" : " ") + w;
                });
            }

            drawRect(page, startX, gy, 70, 11, true, colLightGray);
            drawRect(page, startX, gy, 70, 11);
            drawText(page, l, startX + 5, gy + 8, fontBold, 6);
            drawRect(page, startX + 70, gy, 120, 11, true, colWhite);
            drawRect(page, startX + 70, gy, 120, 11);
            if (line2 !== "") {
                drawText(page, line1, startX + 75, gy + 5, font, 4.5);
                drawText(page, line2, startX + 75, gy + 9.5, font, 4.5);
            } else {
                drawText(page, line1, startX + 75, gy + 8, font, 6);
            }
            gy += 11;
        });

        // Substantial completion
        drawRect(page, startX, gy, 120, 15, true, colLightGray);
        drawRect(page, startX, gy, 120, 15);
        drawText(page, "Has the project reached substantial completion?", startX + 5, gy + 10, fontBold, 5.5);
        drawRect(page, startX + 120, gy, 20, 15, true, colWhite);
        drawRect(page, startX + 120, gy, 20, 15);
        drawText(page, "Y/N?", startX + 130, gy + 10, fontBold, 6, true);
        drawRect(page, startX + 140, gy, 50, 15, true, colWhite);
        drawRect(page, startX + 140, gy, 50, 15);
        drawText(page, project.reached_substantial_completion ? "YES" : "NO", startX + 165, gy + 10, fontBold, 6, true);
        gy += 15;

        drawRect(page, startX, gy, 60, 11, true, colLightGray);
        drawRect(page, startX, gy, 60, 11);
        drawText(page, "No. of CHO documents:", startX + 5, gy + 8, fontBold, 5.5);
        drawRect(page, startX + 60, gy, 130, 11, true, colWhite);
        drawRect(page, startX + 60, gy, 130, 11);
        drawText(page, selectedChos.length.toString(), startX + 125, gy + 8, font, 6, true);
        gy += 11;

        drawRect(page, startX, gy, 60, 11, true, colLightGray);
        drawRect(page, startX, gy, 60, 11);
        drawText(page, "No. of EWO documents:", startX + 5, gy + 8, fontBold, 5.5);
        drawRect(page, startX + 60, gy, 130, 11, true, colWhite);
        drawRect(page, startX + 60, gy, 130, 11);
        drawText(page, "0", startX + 125, gy + 8, font, 6, true);

        // Fill remaining empty space in left column
        drawRect(page, startX, gy + 11, 190, 15, true, colWhite);
        drawRect(page, startX, gy + 11, 190, 15);


        // --- LEGEND SECTION ---
        lx = startX + gInfoW;
        ly = 67;
        drawRect(page, lx, ly, legW, 23.4, true, colWhite); drawRect(page, lx, ly, legW, 23.4);
        drawText(page, "White cells, project administrator will provide project", lx + legW/2, ly + 10, fontBold, 5.5, true);
        drawText(page, "information (input cells).", lx + legW/2, ly + 18, fontBold, 5.5, true);
        ly += 23.4;
        drawRect(page, lx, ly, legW, 23.4, true, rgb(1,1,0)); drawRect(page, lx, ly, legW, 23.4);
        drawText(page, "Color cells, the excel file will make calculations", lx + legW/2, ly + 10, fontBold, 5.5, true);
        drawText(page, "(formula cells).", lx + legW/2, ly + 18, fontBold, 5.5, true);
        ly += 23.4;
        drawRect(page, lx, ly, legW, 23.4, true, rgb(0.85,0.85,0.95)); drawRect(page, lx, ly, legW, 23.4);
        drawText(page, "Gray cells & Blue Font Color, attention is required", lx + legW/2, ly + 10, fontBold, 5.5, true, false, rgb(0,0,0.8));
        drawText(page, "(see comment in the cells).", lx + legW/2, ly + 18, fontBold, 5.5, true, false, rgb(0,0,0.8));
        ly += 23.4;
        drawRect(page, lx, ly, legW, 23.4, true, rgb(1,0,0)); drawRect(page, lx, ly, legW, 23.4);
        drawText(page, "Red Cells, possible action by PRHTA (red flag).", lx + legW/2, ly + 14, fontBold, 5.5, true, false, rgb(1,1,1));
        ly += 23.4;
        drawRect(page, lx, ly, legW, 23.4, true, colWhite); drawRect(page, lx, ly, legW, 23.4);
        drawText(page, "Red Font Color are for negative numbers or", lx + legW/2, ly + 10, fontBold, 5.5, true, false, rgb(1,0,0));
        drawText(page, "quantities.", lx + legW/2, ly + 18, fontBold, 5.5, true, false, rgb(1,0,0));


        // --- CONTRACT TIME INFORMATION SECTION ---
        timeLabels = ["Contract Beginning Date:", "Original Contract Time:", "Original Termination Date:", "Total Time Extensions (Days):", "Revised Termination Date:", "Change in Contract Time (%):", "% Time Completed to Date (%):", "Change in Contract Amount (%):", "% Work Performed to Date:", "Estimated Completion Date:", "Administrative Date of Comptroller Office (Contralor):", "Project End Date (FMIS):"];
        originalTime = getDaysDiff(project.date_project_start, project.date_orig_completion);
        totalExtensions = selectedChos.reduce((sum: number, c: any) => sum + (c.time_extension_days || 0), 0);
        changeTimePct = originalTime > 0 ? (totalExtensions / originalTime) * 100 : 0;
        totalChoAmt = selectedChos.reduce((sum: number, c: any) => sum + (parseFloat(c.proposed_change) || 0), 0);
        changeAmtPct = parseFloat(project.cost_original) > 0 ? (totalChoAmt / parseFloat(project.cost_original)) * 100 : 0;

        // Calculate % Time Completed to Date
        // Total revised contract duration = original time + total extensions
        totalRevisedTime = originalTime + totalExtensions;
        today = new Date();
        todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
        elapsedDays = getDaysDiff(project.date_project_start, todayStr);
        timeCompletedPct = totalRevisedTime > 0 ? Math.min((elapsedDays / totalRevisedTime) * 100, 100) : 0;

        // Calculate % Work Performed to Date from payment certifications
        totalConstructionCost = (parseFloat(project.cost_original) || 0) + totalChoAmt;
        totalCertifiedAmount = 0;
        if (certs && certs.length > 0) {
            certs.forEach((cert: any) => {
                if (cert.items && Array.isArray(cert.items)) {
                    cert.items.forEach((item: any) => {
                        totalCertifiedAmount += (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
                    });
                }
            });
        }
        workPerformedPct = totalConstructionCost > 0 ? Math.min((totalCertifiedAmount / totalConstructionCost) * 100, 100) : 0;

        timeVals = [
            formatDate(project.date_project_start), `${originalTime} Days`, formatDate(project.date_orig_completion),
            totalExtensions.toString() + " Days", formatDate(project.date_rev_completion),
            `${changeTimePct.toFixed(2)}%`, `${timeCompletedPct.toFixed(2)}%`, `${changeAmtPct.toFixed(2)}%`, `${workPerformedPct.toFixed(2)}%`,
            formatDate(project.date_est_completion), formatDate(project.date_comptroller || project.administrative_date), formatDate(project.fmis_end_date)
        ];

        txInfo = startX + gInfoW + legW;
        ty = 67;
        timeLabels.forEach((l: any, i: number) => {
            drawRect(page, txInfo, ty, 160, 9.75, true, colWhite);
            drawRect(page, txInfo, ty, 160, 9.75);
            drawText(page, l, txInfo + 5, ty + 7, fontBold, 5.5);
            
            let valBg = colGrayHeader;
            let valColor = rgb(0,0,0);
            if (i === 1 || i === 3) valBg = colWhite;
            else if (i === 5 || i === 7) { 
                // Color Rojo si excede el 10% (Cambio Mayor SOP)
                const pctVal = parseFloat(timeVals[i]) || 0;
                if (Math.abs(pctVal) >= 10) {
                    valBg = colRed;
                    valColor = colWhite; 
                } else {
                    valBg = colLightGreen;
                }
            }
            else if (i === 10 || i === 11) {
                valBg = colWhite;
                const dateStr = timeVals[i];
                if (dateStr && dateStr !== "N/A" && dateStr.trim() !== "") {
                    const todayDate = new Date();
                    todayDate.setHours(0,0,0,0);
                    const parts = dateStr.split("/");
                    if (parts.length === 3) {
                        const cellDate = new Date(Number(parts[2]), Number(parts[0])-1, Number(parts[1]));
                        if (cellDate < todayDate) {
                            valBg = colRed;
                            valColor = colWhite;
                        }
                    }
                }
            }

            drawRect(page, txInfo + 160, ty, 62, 9.75, true, valBg);
            drawRect(page, txInfo + 160, ty, 62, 9.75);
            drawText(page, timeVals[i] || "N/A", txInfo + 160 + 31, ty + 7, fontBold, 6, true, false, valColor);
            ty += 9.75;
        });



        // --- PROJECT DESCRIPTION SECTION ---
        py = 195;
        drawRect(page, startX, py, 110, 45, true, colWhite); drawRect(page, startX, py, 110, 45);
        drawText(page, "Project Description:", startX + 5, py + 10, fontBold, 6);
        drawRect(page, startX + 110, py, PW - startX - 130, 45, true, colWhite); drawRect(page, startX + 110, py, PW - startX - 130, 45);

        // Wrap description
        const descWords = (project.scope || project.name || "").split(" ");
        let descLine = "";
        let descY = py + 10;
        descWords.forEach((w: string) => {
            if (font.widthOfTextAtSize(descLine + w, 6) < (PW-startX-140)) {
                descLine += w + " ";
            } else {
                drawText(page, descLine, startX + 115, descY, font, 6);
                descLine = w + " ";
                descY += 8;
            }
        });
        drawText(page, descLine, startX + 115, descY, font, 6);

        // --- TOLL CREDITS & ER FUNDS SECTION ---
        py += 55;
        
        // Toll credits
        drawText(page, "Is this project eligible for toll credits?", startX + 60, py + 10, fontBold, 6);
        drawRect(page, startX + 185, py, 30, 14, true, colLightGray); drawRect(page, startX + 185, py, 30, 14);
        drawText(page, "Y/N?", startX + 200, py + 9, fontBold, 6, true);
        drawRect(page, startX + 215, py, 35, 14, true, colWhite); drawRect(page, startX + 215, py, 35, 14);
        drawText(page, project.eligible_toll_credits ? "YES" : "NO", startX + 232.5, py + 9, fontBold, 6, true);

        // ER funds
        drawText(page, "Does the project have pay items with ER funds?", startX + 50, py + 25, fontBold, 6);
        drawRect(page, startX + 185, py + 15, 30, 14, true, colLightGray); drawRect(page, startX + 185, py + 15, 30, 14);
        drawText(page, "Y/N?", startX + 200, py + 24, fontBold, 6, true);
        drawRect(page, startX + 215, py + 15, 35, 14, true, colWhite); drawRect(page, startX + 215, py + 15, 35, 14);
        drawText(page, project.pay_items_er_funds ? "YES" : "NO", startX + 232.5, py + 24, fontBold, 6, true);

        // NOTES BOX
        drawRect(page, startX + 270, py - 5, PW - startX - 290, 12, true, colGrayHeader); drawRect(page, startX + 270, py - 5, PW - startX - 290, 12);
        drawText(page, "NOTES:", startX + 275, py + 4, fontBold, 5.5);
        drawRect(page, startX + 270, py + 7, PW - startX - 290, 22, true, colGrayHeader); drawRect(page, startX + 270, py + 7, PW - startX - 290, 22);
        drawText(page, "1- Examples of projects that are not eligible for toll credits (answer to", startX + 273, py + 14, font, 4.5);
        drawText(page, "the question is NO): ER Projects and Old Projects without Toll Credits.", startX + 273, py + 21, font, 4.5);

        // --- ORGINAL PROJECT FUNDS INFORMATION TABLE ---
        py += 35; // Adjusted spacing
        totalW = PW - startX * 2;
        subColW = [35, 30, 48, 48, 40, 48, 48, 38, 38, 38, 48, 40, 38, 35]; 

        drawRect(page, startX, py, totalW, 12, true, colPeachHead); drawRect(page, startX, py, totalW, 12);
        drawText(page, "Original Project Funds Information", PW / 2, py + 8, fontBold, 7, true);

        py += 12;
        tx = startX;
        
        // Headers
        drawRect(page, tx, py, subColW[0], 25, true, colLightGray); drawRect(page, tx, py, subColW[0], 25);
        drawText(page, "Units", tx + subColW[0]/2, py+14, fontBold, 5.5, true);
        tx += subColW[0];
        
        drawRect(page, tx, py, subColW[1], 25, true, colPeachHead); drawRect(page, tx, py, subColW[1], 25);
        drawText(page, "Federal\nShare\n%", tx + subColW[1]/2, py+5, fontBold, 5.5, true);
        tx += subColW[1];

        // INPUT PROJECT AGREEMENT Group (Inputs)
        const groupW3 = subColW[2] + subColW[3] + subColW[4];
        drawRect(page, tx, py, groupW3, 10, true, colLightGray); drawRect(page, tx, py, groupW3, 10);
        drawText(page, "INPUT PROJECT AGREEMENT", tx + groupW3/2, py + 7, fontBold, 6, true);
        drawRect(page, tx, py+10, subColW[2], 15, true, colWhite); drawRect(page, tx, py+10, subColW[2], 15);
        drawText(page, "Participating", tx + subColW[2]/2, py+19, fontBold, 4.5, true);
        tx += subColW[2];
        drawRect(page, tx, py+10, subColW[3], 15, true, colWhite); drawRect(page, tx, py+10, subColW[3], 15);
        drawText(page, "Contingencies\n(Participating)", tx + subColW[3]/2, py+16, fontBold, 4.5, true);
        tx += subColW[3];
        drawRect(page, tx, py+10, subColW[4], 15, true, colWhite); drawRect(page, tx, py+10, subColW[4], 15);
        drawText(page, "Payroll,\nMileage &\nDiets", tx + subColW[4]/2, py+13, fontBold, 4.5, true);
        tx += subColW[4];

        // FEDERAL FUNDS Group (Calculated Automatically)
        const groupW4 = subColW[5] + subColW[6] + subColW[7] + subColW[8];
        drawRect(page, tx, py, groupW4, 10, true, colDarkPeach); drawRect(page, tx, py, groupW4, 10);
        drawText(page, "FEDERAL FUNDS", tx + groupW4/2, py + 7, fontBold, 6, true);
        drawRect(page, tx, py+10, subColW[5], 15, true, colPeachHead); drawRect(page, tx, py+10, subColW[5], 15);
        drawText(page, "F.A. Funds\nRequested", tx + subColW[5]/2, py+14, fontBold, 4, true);
        tx += subColW[5];
        drawRect(page, tx, py+10, subColW[6], 15, true, colPeachHead); drawRect(page, tx, py+10, subColW[6], 15);
        drawText(page, "Contingencies\n(Federal Funds)", tx + subColW[6]/2, py+14, fontBold, 4, true);
        tx += subColW[6];
        drawRect(page, tx, py+10, subColW[7], 15, true, colPeachHead); drawRect(page, tx, py+10, subColW[7], 15);
        drawText(page, "Calculation\nof\nToll Credits", tx + subColW[7]/2, py+12, fontBold, 3.8, true);
        tx += subColW[7];
        drawRect(page, tx, py+10, subColW[8], 15, true, colPeachHead); drawRect(page, tx, py+10, subColW[8], 15);
        drawText(page, "Contingencies\n(Toll Credits)", tx + subColW[8]/2, py+14, fontBold, 3.8, true);
        tx += subColW[8];

        // STATE FUNDS Group (Mixed)
        const groupW5 = subColW[9] + subColW[10] + subColW[11] + subColW[12] + subColW[13];
        drawRect(page, tx, py, groupW5, 10, true, colOrangeHead); drawRect(page, tx, py, groupW5, 10);
        drawText(page, "STATE FUNDS", tx + groupW5/2, py + 7, fontBold, 6, true);
        drawRect(page, tx, py+10, subColW[9], 15, true, colLightYellow); drawRect(page, tx, py+10, subColW[9], 15);
        drawText(page, "State Share\nof\nFederal Funds", tx + subColW[9]/2, py+12, fontBold, 3.8, true);
        tx += subColW[9];
        drawRect(page, tx, py+10, subColW[10], 15, true, colLightYellow); drawRect(page, tx, py+10, subColW[10], 15);
        drawText(page, "Contingencies\n(State Share)", tx + subColW[10]/2, py+14, fontBold, 3.8, true);
        tx += subColW[10];
        drawRect(page, tx, py+10, subColW[11], 15, true, colWhite); drawRect(page, tx, py+10, subColW[11], 15);
        drawText(page, "non participating\n(State Funds)", tx + subColW[11]/2, py+14, fontBold, 3.8, true);
        tx += subColW[11];
        drawRect(page, tx, py+10, subColW[12], 15, true, colWhite); drawRect(page, tx, py+10, subColW[12], 15);
        drawText(page, "Contingencies\n(Not Partic.)", tx + subColW[12]/2, py+14, fontBold, 3.8, true);
        tx += subColW[12];
        drawRect(page, tx, py+10, subColW[13], 15, true, colWhite); drawRect(page, tx, py+10, subColW[13], 15);
        drawText(page, "Payroll,\nMileage &\nDiets", tx + subColW[13]/2, py+12, fontBold, 3.8, true);
        
        py += 25;
        
        // Modified Row Processor
        const processedFunds = (agreementFunds || []).map(f => {
            const fedShare = (f.federal_share_pct || 0) / 100;
            const fedMatch = 1 - fedShare;
            const isToll = project.eligible_toll_credits;

            return {
                ...f,
                fa_funds_requested: f.participating * fedShare,
                contingencies_federal: f.contingencies_participating * fedShare,
                calc_toll_credits: isToll ? f.participating * fedMatch : 0,
                contingencies_toll: isToll ? f.contingencies_participating * fedMatch : 0,
                state_share_federal: !isToll ? f.participating * fedMatch : 0,
                contingencies_state_share: !isToll ? f.contingencies_participating * fedMatch : 0
            };
        });

        const renderFundsRow = (f: any, currY: number, iRow: number) => {
            let cx = startX;
            subColW.forEach((w: number, i: number) => {
                let bgColor = colWhite;
                if (i === 0) bgColor = colLightGray;
                else if (i === 1) bgColor = colPeachHead;
                else if (i >= 5 && i <= 8) bgColor = colPeachHead; // Federal Calculated
                else if (i >= 9 && i <= 10) bgColor = colLightYellow; // State Calculated
                
                drawRect(page, cx, currY, w, 10, true, bgColor); 
                drawRect(page, cx, currY, w, 10);
                
                let val = "";
                if (i === 0) val = f.unit_name || `Unit ${iRow+1}`;
                else if (i === 1) val = f.federal_share_pct ? `${f.federal_share_pct.toFixed(2)}%` : "N/A";
                else {
                    const keys = [
                        null, null, 'participating', 'contingencies_participating', 'payroll_mileage_diets',
                        'fa_funds_requested', 'contingencies_federal', 'calc_toll_credits', 'contingencies_toll',
                        'state_share_federal', 'contingencies_state_share', 'not_participating_state', 'contingencies_not_participating', 'payroll_mileage_diets_state'
                    ];
                    const numVal = (f as any)[keys[i] as string] || 0;
                    if (numVal !== 0) val = formatCurrency(numVal);
                }

                if (i === 0 || i === 1) drawText(page, val, cx + w/2, currY + 7, font, 5.5, true);
                else drawText(page, val, cx + w - 2, currY + 7, font, 5.5, false, true);
                cx += w;
            });
        };

        const fundsToDraw = [...processedFunds];
        while (fundsToDraw.length < 10) {
            fundsToDraw.push({ unit_name: `Unit ${fundsToDraw.length + 1}` } as any);
        }

        fundsToDraw.slice(0, 10).forEach((f, i) => {
            renderFundsRow(f, py, i);
            py += 10;
        });

        // Subtotals Row
        drawRect(page, startX, py, subColW[0] + subColW[1], 10, true, colWhite); drawRect(page, startX, py, subColW[0] + subColW[1], 10);
        drawText(page, "Sub Totals", startX + (subColW[0] + subColW[1])/2, py+7, fontBold, 5.5, true);
        
        let subtx = startX + subColW[0] + subColW[1];
        const subTotals: number[] = new Array(14).fill(0);
        for (let j=2; j<14; j++) {
            const sum = processedFunds.reduce((s, f) => {
                const keys = [null, null, 'participating', 'contingencies_participating', 'payroll_mileage_diets', 'fa_funds_requested', 'contingencies_federal', 'calc_toll_credits', 'contingencies_toll', 'state_share_federal', 'contingencies_state_share', 'not_participating_state', 'contingencies_not_participating', 'payroll_mileage_diets_state'];
                return s + ((f as any)[keys[j] as string] || 0);
            }, 0);
            subTotals[j] = sum;
            
            let subBgColor = colWhite;
            if (j >= 5 && j <= 8) subBgColor = colPeachHead;
            else if (j >= 9 && j <= 10) subBgColor = colLightYellow;
            
            drawRect(page, subtx, py, subColW[j], 10, true, subBgColor);
            drawRect(page, subtx, py, subColW[j], 10);
            drawText(page, sum === 0 ? "" : formatCurrency(sum), subtx + subColW[j] - 2, py + 7, fontBold, 5.5, false, true);
            subtx += subColW[j];
        }

        py += 10;
        // Totals row (drawn manually by parts per user requests)
        drawRect(page, startX, py, subColW[0] + subColW[1], 10, true, colWhite); drawRect(page, startX, py, subColW[0] + subColW[1], 10);
        drawText(page, "Totals", startX + (subColW[0] + subColW[1])/2, py + 7, fontBold, 5.5, true);
        
        let tottx = startX + subColW[0] + subColW[1];
        // 3rd to 5th columns in light gray
        for (let j=2; j<=4; j++) {
            drawRect(page, tottx, py, subColW[j], 10, true, colLightGray);
            drawRect(page, tottx, py, subColW[j], 10);
            tottx += subColW[j];
        }
        
        const grandFed = subTotals[5] + subTotals[6] + subTotals[7] + subTotals[8];
        const grandState = subTotals[9] + subTotals[10] + subTotals[11] + subTotals[12] + subTotals[13];
        
        drawRect(page, tottx, py, groupW4, 10, true, colPeachHead); drawRect(page, tottx, py, groupW4, 10);
        drawText(page, grandFed === 0 ? "" : formatCurrency(grandFed), tottx + groupW4/2, py + 7, fontBold, 6, true);
        tottx += groupW4;

        drawRect(page, tottx, py, groupW5, 10, true, colOrangeHead); drawRect(page, tottx, py, groupW5, 10);
        drawText(page, grandState === 0 ? "" : formatCurrency(grandState), tottx + groupW5/2, py + 7, fontBold, 6, true);

        py += 11;
        // Eng. Contract Estimate entirely this color
        drawRect(page, startX, py, totalW, 10, true, colLightBlueFill); drawRect(page, startX, py, totalW, 10);
        drawText(page, "Eng. Contract Estimate:", startX + 2, py + 7, fontBold, 5.5);
        drawText(page, formatCurrency(project.cost_original), startX + 208, py + 7, fontBold, 5.5, false, true);
        drawText(page, "This is the original cost of the project (bid process).", startX + 215, py + 7, fontBold, 5.5);

        py += 10;
        // Total Construction Cost entirely the previous blue color
        drawRect(page, startX, py, totalW, 10, true, colTotalConstBg); drawRect(page, startX, py, totalW, 10);
        drawText(page, "Total Construction Cost:", startX + 2, py + 7, fontBold, 5.5);
        const totalConst = (parseFloat(project.cost_original) || 0) + totalChoAmt;
        drawText(page, formatCurrency(totalConst), startX + 208, py + 7, fontBold, 5.5, false, true);
        drawText(page, "This is the total budget for the project. Includes federal and state funds, contingencies, and payroll or expenses when applicable.", startX + 215, py + 7, fontBold, 5.5);

        py += 13;
        drawRect(page, startX, py, totalW, 20, true, colLightGray); drawRect(page, startX, py, totalW, 20);
        drawText(page, "NOTE:", startX + 2, py + 7, fontBold, 5.5);
        drawText(page, "1- IF THE FEDERAL SHARE % COLUMN HAS VALUES DIFFERENT THAN 80.25%, 90% AND 100%, VERIFY THE INFORMATION INCLUDED IN THE TABLE BEFORE CONTINUING WITH THE PROCESS.", startX + 2, py + 15, font, 5);

        // --- PROJECT MODIFICATION DOCUMENTS TABLE ---
        py += 25;
        drawRect(page, startX, py, totalW, 12, true, colPeachHead); drawRect(page, startX, py, totalW, 12);
        drawText(page, "Project Modification Documents", PW/2, py + 9, fontBold, 7, true);
        
        py += 12;
        const modCols = [40, 50, 35, 50, 45, 45, 45, 35, 45, 45, 137]; 
        
        // Headers
        drawRect(page, startX, py, modCols[0], 25, true, colLightGray); drawRect(page, startX, py, modCols[0], 25);
        drawText(page, "Document #", startX + modCols[0]/2, py + 7, fontBold, 5, true);
        drawLine(page, startX, py + 9, startX + modCols[0], py + 9);
        drawText(page, "CHO", startX + modCols[0]/4, py + 19, fontBold, 5, true);
        drawLine(page, startX + modCols[0]/2, py + 9, startX + modCols[0]/2, py + 25);
        drawText(page, "EWO", startX + 3*modCols[0]/4, py + 19, fontBold, 5, true);
        
        let modDrawX = startX + modCols[0];
        const subColsRemain = modCols.slice(1);
        const subColLabels = ["Proposed Amount", "Federal Share\n(%)", "Federal Share\nAmount", "Toll Credits\nAmount", "Non Participating\nAmount\n(State Funds)", "State Share of\nFederal Funds", "Time\nExtension\n(Days)", "Federal Share for\nProject Mod.\nLetter", "Toll Credits for\nProject Mod.", "Comments"];
        
        subColsRemain.forEach((w, i) => {
            drawRect(page, modDrawX, py, w, 25, true, rgb(0.85, 0.85, 0.85)); drawRect(page, modDrawX, py, w, 25);
            const lines = subColLabels[i].split("\n");
            let thOffsets = lines.length === 1 ? [14] : (lines.length === 2 ? [10, 18] : [7, 14, 21]);
            lines.forEach((line, li) => {
                drawText(page, line, modDrawX + w/2, py + thOffsets[li], fontBold, 5, true);
            });
            modDrawX += w;
        });

        py += 25;
        // Render CHO Rows
        const renderModRow = (c: any, currY: number) => {
            let cx = startX;
            drawRect(page, cx, currY, modCols[0]/2, 10, true, colWhite); drawRect(page, cx, currY, modCols[0]/2, 10);
            drawText(page, c.cho_num.toString(), cx + modCols[0]/4, currY + 7, font, 5.5, true);
            cx += modCols[0]/2;
            drawRect(page, cx, currY, modCols[0]/2, 10, true, colWhite); drawRect(page, cx, currY, modCols[0]/2, 10); 
            cx += modCols[0]/2;
            
            const isToll = project.eligible_toll_credits;
            const fedSharePct = c.federal_share_pct || 0;
            const fedShareAmt = (c.proposed_change * fedSharePct) / 100;
            const matchAmt = c.proposed_change - fedShareAmt;

            const rowVals = [
                formatCurrency(c.proposed_change),
                `${fedSharePct.toFixed(2)}%`,
                formatCurrency(fedShareAmt),
                formatCurrency(isToll ? matchAmt : 0),
                formatCurrency(c.non_participating_state_amt),
                formatCurrency(!isToll ? matchAmt : 0),
                c.time_extension_days?.toString() ? `${c.time_extension_days} Days` : "", 
                formatCurrency(c.fed_share_mod_letter),
                formatCurrency(c.toll_credits_mod),
                (c.justification || "").substring(0, 60)
            ];

            subColsRemain.forEach((w: number, i: number) => {
                let cellColor = colWhite;
                if (i >= 2 && i <= 5) cellColor = colLightBlueFill;
                if (i === 7 || i === 8) cellColor = colLightBlueFill;

                drawRect(page, cx, currY, w, 10, true, cellColor); drawRect(page, cx, currY, w, 10);
                let color = rgb(0,0,0);
                if ((c.proposed_change < 0 && (i === 0 || i === 2 || i === 3 || i === 5 || i === 7 || i === 8)) || (c.non_participating_state_amt < 0 && i === 4)) {
                    color = colRed;
                }
                
                let valToRender = rowVals[i];
                if (valToRender === "$0.00") valToRender = ""; 
                
                let centerVal = i === 1 || i === 6; 
                if (centerVal) {
                    drawText(page, valToRender, cx + w/2, currY + 7, font, 4.5, true, false, color);
                } else if (i === 9) { 
                    drawText(page, valToRender, cx + 2, currY + 7, font, 4.5, false, false, color);
                } else {
                    drawText(page, valToRender, cx + w - 2, currY + 7, font, 5, false, true, color);
                }
                cx += w;
            });
        };

        const rowsOnFirstPage = 13;
        selectedChos.slice(0, rowsOnFirstPage).forEach(c => {
            renderModRow(c, py);
            py += 10;
        });

        // Fill empty rows to make it look like the template
        for (let j = selectedChos.length; j < rowsOnFirstPage + 5; j++) {
            if (py > PH - 40) break;
            let cx = startX;
            drawRect(page, cx, py, modCols[0]/2, 10, true, colWhite); drawRect(page, cx, py, modCols[0]/2, 10); cx += modCols[0]/2;
            drawRect(page, cx, py, modCols[0]/2, 10, true, colWhite); drawRect(page, cx, py, modCols[0]/2, 10); cx += modCols[0]/2;
            subColsRemain.forEach((w: number, i: number) => {
                let emptyColor = colWhite;
                if (i >= 2 && i <= 5) emptyColor = colLightBlueFill;
                if (i === 7 || i === 8) emptyColor = colLightBlueFill;

                drawRect(page, cx, py, w, 10, true, emptyColor);
                drawRect(page, cx, py, w, 10); 
                
                // Print explicit $0.00 only if template has it for empty fields
                drawText(page, "", cx + w - 2, py + 7, font, 5, false, true, rgb(0,0,0));
                
                cx += w; 
            });
            py += 10;
        }

        // Footer
        drawText(page, `Page ${pageNum} of 2`, PW/2, PH - 15, font, 8, true);

        // --- PAGE 2 ---
        pageNum++;
        let page2 = pdfDoc.addPage([PW, PH]);
        // --- HEADER ---
        drawText(page2, "3A", 20, 15, fontBold, 8);
        drawText(page2, "Ver: 11.29.2021", PW - 20, 15, font, 8, false, true);
        
        drawRect(page2, PW / 2 - 135, 27, 270, 18, true, colPeach);
        drawRect(page2, PW / 2 - 135, 27, 270, 18);
        drawText(page2, "Construction Contract Modification log", PW / 2, 38, fontBold, 14, true);

        // Colors matching exactly
        colPeach = rgb(0.98, 0.83, 0.72);
        colGrayHeader = rgb(0.88, 0.88, 0.88);
        colLightGray = rgb(0.94, 0.94, 0.94);
        colYellow = rgb(1, 0.9, 0.6);
        colBlueHead = rgb(0.65, 0.8, 0.95);
        colWhite = rgb(1, 1, 1);
        colRed = rgb(1, 0, 0);

        // --- ROW 1: HEADER BOXES ---
        gInfoW = 190;
        legW = 160;
        tInfoW = 222;
        startX = 20;

        // General Info header
        drawRect(page2, startX, 55, gInfoW, 12, true, colPeach);
        drawRect(page2, startX, 55, gInfoW, 12);
        drawText(page2, "General Information:", startX + gInfoW/2, 63, fontBold, 8, true);

        // Legend header
        drawRect(page2, startX + gInfoW, 55, legW, 12, true, colPeach);
        drawRect(page2, startX + gInfoW, 55, legW, 12);
        drawText(page2, "Legend:", startX + gInfoW + legW/2, 63, fontBold, 8, true);

        // Time Info header
        drawRect(page2, startX + gInfoW + legW, 55, tInfoW, 12, true, colPeach);
        drawRect(page2, startX + gInfoW + legW, 55, tInfoW, 12);
        drawText(page2, "Contract Time Information:", startX + gInfoW + legW + tInfoW/2, 63, fontBold, 8, true);

        // --- GENERAL INFORMATION SECTION ---
        contractorName = contrData?.name || project.contractor_name || "";
        projectManagerName = personnel?.find(p => p.role === 'Project Manager' || p.role === 'Administrador del Proyecto')?.name || project.project_manager_name || "";

        labels = ["Project Number:", "Federal Number:", "Oracle Number:", "Project Title:", "Contractor:", "Date:"];
        vals = [project.num_act, project.num_federal, project.num_oracle, project.name, contractorName, formatDate(new Date().toISOString())];
        
        gy = 67;
        labels.forEach((l: any, i: number) => {
            let val = vals[i] || "";
            // Divide en dos líneas si es muy largo
            let line1 = val;
            let line2 = "";
            if (font.widthOfTextAtSize(val, 6) > 115) {
                const words = val.split(" ");
                line1 = "";
                words.forEach((w: string) => {
                    if (font.widthOfTextAtSize(line1 + " " + w, 6) <= 115) line1 += (line1 === "" ? "" : " ") + w;
                    else line2 += (line2 === "" ? "" : " ") + w;
                });
            }

            drawRect(page2, startX, gy, 70, 11, true, colLightGray);
            drawRect(page2, startX, gy, 70, 11);
            drawText(page2, l, startX + 5, gy + 8, fontBold, 6);
            drawRect(page2, startX + 70, gy, 120, 11, true, colWhite);
            drawRect(page2, startX + 70, gy, 120, 11);
            if (line2 !== "") {
                drawText(page2, line1, startX + 75, gy + 5, font, 4.5);
                drawText(page2, line2, startX + 75, gy + 9.5, font, 4.5);
            } else {
                drawText(page2, line1, startX + 75, gy + 8, font, 6);
            }
            gy += 11;
        });

        // Substantial completion
        drawRect(page2, startX, gy, 120, 15, true, colLightGray);
        drawRect(page2, startX, gy, 120, 15);
        drawText(page2, "Has the project reached substantial completion?", startX + 5, gy + 10, fontBold, 5.5);
        drawRect(page2, startX + 120, gy, 20, 15, true, colWhite);
        drawRect(page2, startX + 120, gy, 20, 15);
        drawText(page2, "Y/N?", startX + 130, gy + 10, fontBold, 6, true);
        drawRect(page2, startX + 140, gy, 50, 15, true, colWhite);
        drawRect(page2, startX + 140, gy, 50, 15);
        drawText(page2, project.reached_substantial_completion ? "YES" : "NO", startX + 165, gy + 10, fontBold, 6, true);
        gy += 15;

        drawRect(page2, startX, gy, 60, 11, true, colLightGray);
        drawRect(page2, startX, gy, 60, 11);
        drawText(page2, "No. of CHO documents:", startX + 5, gy + 8, fontBold, 5.5);
        drawRect(page2, startX + 60, gy, 130, 11, true, colWhite);
        drawRect(page2, startX + 60, gy, 130, 11);
        drawText(page2, selectedChos.length.toString(), startX + 125, gy + 8, font, 6, true);
        gy += 11;

        drawRect(page2, startX, gy, 60, 11, true, colLightGray);
        drawRect(page2, startX, gy, 60, 11);
        drawText(page2, "No. of EWO documents:", startX + 5, gy + 8, fontBold, 5.5);
        drawRect(page2, startX + 60, gy, 130, 11, true, colWhite);
        drawRect(page2, startX + 60, gy, 130, 11);
        drawText(page2, "0", startX + 125, gy + 8, font, 6, true);

        // Fill remaining empty space in left column
        drawRect(page2, startX, gy + 11, 190, 15, true, colWhite);
        drawRect(page2, startX, gy + 11, 190, 15);


        // --- LEGEND SECTION ---
        lx = startX + gInfoW;
        ly = 67;
        drawRect(page2, lx, ly, legW, 23.4, true, colWhite); drawRect(page2, lx, ly, legW, 23.4);
        drawText(page2, "White cells, project administrator will provide project", lx + legW/2, ly + 10, fontBold, 5.5, true);
        drawText(page2, "information (input cells).", lx + legW/2, ly + 18, fontBold, 5.5, true);
        ly += 23.4;
        drawRect(page2, lx, ly, legW, 23.4, true, rgb(1,1,0)); drawRect(page2, lx, ly, legW, 23.4);
        drawText(page2, "Color cells, the excel file will make calculations", lx + legW/2, ly + 10, fontBold, 5.5, true);
        drawText(page2, "(formula cells).", lx + legW/2, ly + 18, fontBold, 5.5, true);
        ly += 23.4;
        drawRect(page2, lx, ly, legW, 23.4, true, rgb(0.85,0.85,0.95)); drawRect(page2, lx, ly, legW, 23.4);
        drawText(page2, "Gray cells & Blue Font Color, attention is required", lx + legW/2, ly + 10, fontBold, 5.5, true, false, rgb(0,0,0.8));
        drawText(page2, "(see comment in the cells).", lx + legW/2, ly + 18, fontBold, 5.5, true, false, rgb(0,0,0.8));
        ly += 23.4;
        drawRect(page2, lx, ly, legW, 23.4, true, rgb(1,0,0)); drawRect(page2, lx, ly, legW, 23.4);
        drawText(page2, "Red Cells, possible action by PRHTA (red flag).", lx + legW/2, ly + 14, fontBold, 5.5, true, false, rgb(1,1,1));
        ly += 23.4;
        drawRect(page2, lx, ly, legW, 23.4, true, colWhite); drawRect(page2, lx, ly, legW, 23.4);
        drawText(page2, "Red Font Color are for negative numbers or", lx + legW/2, ly + 10, fontBold, 5.5, true, false, rgb(1,0,0));
        drawText(page2, "quantities.", lx + legW/2, ly + 18, fontBold, 5.5, true, false, rgb(1,0,0));


        // --- CONTRACT TIME INFORMATION SECTION ---
        timeLabels = ["Contract Beginning Date:", "Original Contract Time:", "Original Termination Date:", "Total Time Extensions (Days):", "Revised Termination Date:", "Change in Contract Time (%):", "% Time Completed to Date (%):", "Change in Contract Amount (%):", "% Work Performed to Date:", "Estimated Completion Date:", "Administrative Date of Comptroller Office (Contralor):", "Project End Date (FMIS):"];
        originalTime = getDaysDiff(project.date_project_start, project.date_orig_completion);
        totalExtensions = selectedChos.reduce((sum: number, c: any) => sum + (c.time_extension_days || 0), 0);
        changeTimePct = originalTime > 0 ? (totalExtensions / originalTime) * 100 : 0;
        totalChoAmt = selectedChos.reduce((sum: number, c: any) => sum + (parseFloat(c.proposed_change) || 0), 0);
        changeAmtPct = parseFloat(project.cost_original) > 0 ? (totalChoAmt / parseFloat(project.cost_original)) * 100 : 0;

        // Calculate % Time Completed to Date
        // Total revised contract duration = original time + total extensions
        totalRevisedTime = originalTime + totalExtensions;
        today = new Date();
        todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
        elapsedDays = getDaysDiff(project.date_project_start, todayStr);
        timeCompletedPct = totalRevisedTime > 0 ? Math.min((elapsedDays / totalRevisedTime) * 100, 100) : 0;

        // Calculate % Work Performed to Date from payment certifications
        totalConstructionCost = (parseFloat(project.cost_original) || 0) + totalChoAmt;
        totalCertifiedAmount = 0;
        if (certs && certs.length > 0) {
            certs.forEach((cert: any) => {
                if (cert.items && Array.isArray(cert.items)) {
                    cert.items.forEach((item: any) => {
                        totalCertifiedAmount += (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
                    });
                }
            });
        }
        workPerformedPct = totalConstructionCost > 0 ? Math.min((totalCertifiedAmount / totalConstructionCost) * 100, 100) : 0;

        timeVals = [
            formatDate(project.date_project_start), `${originalTime} Days`, formatDate(project.date_orig_completion),
            totalExtensions.toString() + " Days", formatDate(project.date_rev_completion),
            `${changeTimePct.toFixed(2)}%`, `${timeCompletedPct.toFixed(2)}%`, `${changeAmtPct.toFixed(2)}%`, `${workPerformedPct.toFixed(2)}%`,
            formatDate(project.date_est_completion), formatDate(project.date_comptroller || project.administrative_date), formatDate(project.fmis_end_date)
        ];

        txInfo = startX + gInfoW + legW;
        ty = 67;
        timeLabels.forEach((l: any, i: number) => {
            drawRect(page2, txInfo, ty, 160, 9.75, true, colWhite);
            drawRect(page2, txInfo, ty, 160, 9.75);
            drawText(page2, l, txInfo + 5, ty + 7, fontBold, 5.5);
            
            let valBg = colGrayHeader;
            let valColor = rgb(0,0,0);
            if (i === 1 || i === 3) valBg = colWhite;
            else if (i === 5 || i === 7) { valBg = colRed; valColor = colWhite; }
            else if (i === 10 || i === 11) {
                valBg = colWhite;
                const dateStr = timeVals[i];
                if (dateStr && dateStr !== "N/A" && dateStr.trim() !== "") {
                    const todayDate = new Date();
                    todayDate.setHours(0,0,0,0);
                    // formatDate returns MM/DD/YYYY
                    const parts = dateStr.split("/");
                    if (parts.length === 3) {
                        const cellDate = new Date(Number(parts[2]), Number(parts[0])-1, Number(parts[1]));
                        if (cellDate < todayDate) {
                            valBg = colRed;
                            valColor = colWhite;
                        }
                    }
                }
            }

            drawRect(page2, txInfo + 160, ty, 62, 9.75, true, valBg);
            drawRect(page2, txInfo + 160, ty, 62, 9.75);
            drawText(page2, timeVals[i] || "N/A", txInfo + 160 + 31, ty + 7, fontBold, 6, true, false, valColor);
            ty += 9.75;
        });





        let p2y = 195; // Starting immediately under Contract time
        for (let j = 0; j < 7; j++) {
            let cx = startX;
            drawRect(page2, cx, p2y, modCols[0]/2, 10, true, colWhite); drawRect(page2, cx, p2y, modCols[0]/2, 10); cx += modCols[0]/2;
            drawRect(page2, cx, p2y, modCols[0]/2, 10, true, colWhite); drawRect(page2, cx, p2y, modCols[0]/2, 10); cx += modCols[0]/2;
            subColsRemain.forEach((w: number, i: number) => {
                let emptyColor = colWhite;
                if (i >= 2 && i <= 5) emptyColor = colLightBlueFill;
                if (i === 7 || i === 8) emptyColor = colLightBlueFill;
                drawRect(page2, cx, p2y, w, 10, true, emptyColor);
                drawRect(page2, cx, p2y, w, 10); 
                // Remove $0.00 as per request
                drawText(page2, "", cx + w - 2, p2y + 7, font, 5, false, true, rgb(0,0,0));
                cx += w; 
            });
            p2y += 10;
        }

        p2y += 15;
        drawText(page2, "3B", 20, p2y, fontBold, 8);
        p2y += 15;

        // SECTION 3B TABLE
        // The table is indented to align with Proposed Amount on page 1
        // Proposed amount is after modCols[0], which is 40.
        // So indent = startX + 40 + 50 (wait, proposed amount is second column)
        // Let's just use startX + 130 and stretch to totalW (so width = 572 - 130 = 442)
         th3BCols = [70, 70, 80, 50, 85, 87]; // sum = 442
         cx3B = startX + 130;
        
        // Darker headers
        const colPeachDark = rgb(0.9, 0.7, 0.5);
        const colGreenDark = rgb(0.6, 0.8, 0.6);
        const colYellowDark = rgb(0.9, 0.8, 0.5);

        drawRect(page2, cx3B, p2y, th3BCols[0], 25, true, colPeachDark); drawRect(page2, cx3B, p2y, th3BCols[0], 25);
        drawText(page2, "Federal Share", cx3B + th3BCols[0]/2, p2y + 14, fontBold, 5.5, true);
        cx3B += th3BCols[0];
        
        drawRect(page2, cx3B, p2y, th3BCols[1], 25, true, colGreenDark); drawRect(page2, cx3B, p2y, th3BCols[1], 25);
        drawText(page2, "Toll Credits", cx3B + th3BCols[1]/2, p2y + 14, fontBold, 5.5, true);
        cx3B += th3BCols[1];

        // State Funds spans 2 columns
        drawRect(page2, cx3B, p2y, th3BCols[2], 25, true, colYellowDark); drawRect(page2, cx3B, p2y, th3BCols[2], 25);
        drawText(page2, "State Funds", cx3B + th3BCols[2]/2, p2y + 14, fontBold, 5.5, true);
        cx3B += th3BCols[2];

        drawRect(page2, cx3B, p2y, th3BCols[3], 25, true, colGrayHeader); drawRect(page2, cx3B, p2y, th3BCols[3], 25);
        drawText(page2, "Time Extension", cx3B + th3BCols[3]/2, p2y + 14, fontBold, 5.5, true);
        cx3B += th3BCols[3];

        drawRect(page2, cx3B, p2y, th3BCols[4], 25, true, colGrayHeader); drawRect(page2, cx3B, p2y, th3BCols[4], 25);
        drawText(page2, "Federal Share for\nProject Modification\nLetter", cx3B + th3BCols[4]/2, p2y + 7, fontBold, 4.5, true);
        cx3B += th3BCols[4];

        drawRect(page2, cx3B, p2y, th3BCols[5], 25, true, colGrayHeader); drawRect(page2, cx3B, p2y, th3BCols[5], 25);
        drawText(page2, "Toll Credits for\nProject\nModification Letter", cx3B + th3BCols[5]/2, p2y + 7, fontBold, 4.5, true);
        
        p2y += 25;
        // The values row
        cx3B = startX + 130;
        
        const sumFedShareMod = selectedChos.reduce((s, c) => s + (c.proposed_change * (c.federal_share_pct || 0) / 100), 0);
        drawRect(page2, cx3B, p2y, th3BCols[0], 12, true, colPeachHead); drawRect(page2, cx3B, p2y, th3BCols[0], 12);
        drawText(page2, formatCurrency(sumFedShareMod), cx3B + th3BCols[0]/2, p2y + 8, fontBold, 6, true);
        cx3B += th3BCols[0];

        const sumTollCredAmt = selectedChos.reduce((s, c) => s + (c.toll_credits_amt || 0), 0);
        drawRect(page2, cx3B, p2y, th3BCols[1], 12, true, colLightGreen); drawRect(page2, cx3B, p2y, th3BCols[1], 12);
        drawText(page2, formatCurrency(sumTollCredAmt), cx3B + th3BCols[1]/2, p2y + 8, fontBold, 6, true);
        cx3B += th3BCols[1];

        const sumStateAmt = selectedChos.reduce((s, c) => s + (c.non_participating_state_amt || 0), 0);
        const sumStateShare = selectedChos.reduce((s, c) => s + (c.state_share_federal_funds || 0), 0);
        drawRect(page2, cx3B, p2y, th3BCols[2]/2, 12, true, colLightYellow); drawRect(page2, cx3B, p2y, th3BCols[2]/2, 12);
        drawText(page2, formatCurrency(sumStateAmt), cx3B + th3BCols[2]/4, p2y + 8, fontBold, 6, true);
        cx3B += th3BCols[2]/2;
        drawRect(page2, cx3B, p2y, th3BCols[2]/2, 12, true, colLightYellow); drawRect(page2, cx3B, p2y, th3BCols[2]/2, 12);
        drawText(page2, formatCurrency(sumStateShare), cx3B + th3BCols[2]/4, p2y + 8, fontBold, 6, true);
        cx3B += th3BCols[2]/2;

        drawRect(page2, cx3B, p2y, th3BCols[3], 12, true, colWhite); drawRect(page2, cx3B, p2y, th3BCols[3], 12);
        drawText(page2, totalExtensions.toString() + " Days", cx3B + th3BCols[3]/2, p2y + 8, fontBold, 6, true);
        cx3B += th3BCols[3];

        drawRect(page2, cx3B, p2y, th3BCols[4], 12, true, colWhite); drawRect(page2, cx3B, p2y, th3BCols[4], 12);
        const sumFedModLet = selectedChos.reduce((s, c) => s + (c.fed_share_mod_letter || 0), 0);
        drawText(page2, formatCurrency(sumFedModLet), cx3B + th3BCols[4]/2, p2y + 8, fontBold, 6, true);
        cx3B += th3BCols[4];

        drawRect(page2, cx3B, p2y, th3BCols[5], 12, true, colWhite); drawRect(page2, cx3B, p2y, th3BCols[5], 12);
        const sumTollModLet = selectedChos.reduce((s, c) => s + (c.toll_credits_mod || 0), 0);
        drawText(page2, formatCurrency(sumTollModLet), cx3B + th3BCols[5]/2, p2y + 8, fontBold, 6, true);

        // Calculate Agreement Contingencies for comparison
        const totalFedContingency = processedFunds.reduce((s, f) => s + (f.contingencies_federal || 0), 0);
        const totalTollContingency = processedFunds.reduce((s, f) => s + (f.contingencies_toll || 0), 0);
        const totalStateContingency = processedFunds.reduce((s, f) => s + (f.contingencies_state_share || 0) + (f.contingencies_not_participating || 0), 0);

        // Calculate Mod Totals (based on what we obligated in the CHO mods)
        const sumModFedTotal = selectedChos.reduce((s, c) => s + (c.proposed_change * (c.federal_share_pct || 0) / 100), 0);
        const sumModTollTotal = selectedChos.reduce((s, c) => s + (c.toll_credits_amt || 0), 0);
        const sumModStateTotal = selectedChos.reduce((s, c) => s + (c.non_participating_state_amt || 0) + (c.state_share_federal_funds || 0), 0);

        // -- Lower Info Blocks
        p2y += 25;
        const leftBoxW = 160;
        
        // Modification Total Amount
        drawRect(page2, startX, p2y, leftBoxW/2, 18, true, colLightGray); drawRect(page2, startX, p2y, leftBoxW/2, 18);
        drawText(page2, "Modification Total\nAmount:", startX + leftBoxW/4, p2y + 6, fontBold, 5.5, true);
        drawRect(page2, startX + leftBoxW/2, p2y, leftBoxW/2, 18, true, colWhite); drawRect(page2, startX + leftBoxW/2, p2y, leftBoxW/2, 18);
        drawText(page2, formatCurrency(totalChoAmt), startX + leftBoxW*0.75, p2y + 11, fontBold, 6, true);

        p2y += 18;
        drawRect(page2, startX, p2y, leftBoxW/2, 18, true, colLightGray); drawRect(page2, startX, p2y, leftBoxW/2, 18);
        drawText(page2, "Revised Contract\nAmount (all Funds):", startX + leftBoxW/4, p2y + 6, fontBold, 5.5, true);
        
        const revisedTotal = (parseFloat(project.cost_original) || 0) + totalChoAmt;
        const isAmtMajor = (Math.abs(totalChoAmt) / (parseFloat(project.cost_original) || 1)) >= 0.1;
        drawRect(page2, startX + leftBoxW/2, p2y, leftBoxW/2, 18, true, isAmtMajor ? colRed : colWhite); drawRect(page2, startX + leftBoxW/2, p2y, leftBoxW/2, 18);
        drawText(page2, formatCurrency(revisedTotal), startX + leftBoxW*0.75, p2y + 11, fontBold, 6, true, false, isAmtMajor ? colWhite : colRed);

        p2y += 18;
        drawRect(page2, startX, p2y, leftBoxW/2, 18, true, colLightGray); drawRect(page2, startX, p2y, leftBoxW/2, 18);
        drawText(page2, "Amount of Federal\nFunds Needed (FMIS):", startX + leftBoxW/4, p2y + 6, fontBold, 5.5, true);
        drawRect(page2, startX + leftBoxW/2, p2y, leftBoxW/2, 18, true, sumModFedTotal > totalFedContingency ? colRed : colWhite); drawRect(page2, startX + leftBoxW/2, p2y, leftBoxW/2, 18);
        drawText(page2, formatCurrency(sumFedModLet), startX + leftBoxW*0.75, p2y + 11, fontBold, 6, true, false, sumModFedTotal > totalFedContingency ? colWhite : colRed);

        p2y += 18;
        drawRect(page2, startX, p2y, leftBoxW/2, 18, true, colLightGray); drawRect(page2, startX, p2y, leftBoxW/2, 18);
        drawText(page2, "Amount of State\nFunds Needed (FMIS):", startX + leftBoxW/4, p2y + 6, fontBold, 5.5, true);
        drawRect(page2, startX + leftBoxW/2, p2y, leftBoxW/2, 18, true, sumModStateTotal > totalStateContingency ? colRed : colWhite); drawRect(page2, startX + leftBoxW/2, p2y, leftBoxW/2, 18);
        drawText(page2, formatCurrency(sumStateAmt), startX + leftBoxW*0.75, p2y + 11, fontBold, 6, true, false, sumModStateTotal > totalStateContingency ? colWhite : (sumStateAmt < 0 ? colRed : rgb(0,0,0)));

        // Center Box (Contingencies Comparison)
        contY = p2y - 18 * 3; 
        contX = startX + leftBoxW + 10;
        contW = totalW - leftBoxW - 10;
        cwx = contX;

        drawRect(page2, cwx, contY, 160, 10, true, colWhite); drawRect(page2, cwx, contY, 160, 10);
        drawText(page2, "Comparison of Modifications with Project Contingencies:", cwx + 5, contY + 7, fontBold, 5);
        cwx += 160;

        const wRem1 = (contW - 160)/3;
        drawRect(page2, cwx, contY, wRem1, 10, true, colPeachHead); drawRect(page2, cwx, contY, wRem1, 10);
        drawText(page2, "Federal", cwx + wRem1/2, contY + 7, fontBold, 5.5, true);
        cwx += wRem1;

        drawRect(page2, cwx, contY, wRem1, 10, true, colLightGreen); drawRect(page2, cwx, contY, wRem1, 10);
        drawText(page2, "Toll Credits", cwx + wRem1/2, contY + 7, fontBold, 5.5, true);
        cwx += wRem1;

        drawRect(page2, cwx, contY, wRem1, 10, true, colLightYellow); drawRect(page2, cwx, contY, wRem1, 10);
        drawText(page2, "State", cwx + wRem1/2, contY + 7, fontBold, 5.5, true);

        // Row 2: Exceed values
        contY += 10;
        cwx = contX;
        drawRect(page2, cwx, contY, 160, 15, true, colWhite); drawRect(page2, cwx, contY, 160, 15);
        drawText(page2, "Does Contract Modification Exceed\nContingencies?", cwx + 80, contY + 5, fontBold, 5.5, true);
        cwx += 160;

        const fedExcess = Math.max(0, sumModFedTotal - totalFedContingency);
        const tollExcess = Math.max(0, sumModTollTotal - totalTollContingency);
        const stateExcess = Math.max(0, sumModStateTotal - totalStateContingency);

        drawRect(page2, cwx, contY, wRem1, 15, true, fedExcess > 0 ? colRed : colWhite); drawRect(page2, cwx, contY, wRem1, 15);
        drawText(page2, formatCurrency(fedExcess), cwx + wRem1/2, contY + 10, fontBold, 6, true, false, fedExcess > 0 ? colWhite : rgb(0,0,0));
        cwx += wRem1;

        drawRect(page2, cwx, contY, wRem1, 15, true, tollExcess > 0 ? colRed : colWhite); drawRect(page2, cwx, contY, wRem1, 15);
        drawText(page2, formatCurrency(tollExcess), cwx + wRem1/2, contY + 10, fontBold, 6, true, false, tollExcess > 0 ? colWhite : rgb(0,0,0));
        cwx += wRem1;

        drawRect(page2, cwx, contY, wRem1, 15, true, stateExcess > 0 ? colRed : colWhite); drawRect(page2, cwx, contY, wRem1, 15);
        drawText(page2, formatCurrency(stateExcess), cwx + wRem1/2, contY + 10, fontBold, 6, true, false, stateExcess > 0 ? colWhite : rgb(0,0,0));

        // Row 3 (Status Messages)
        contY += 15;
        cwx = contX + 160;
        
        drawRect(page2, cwx, contY, wRem1, 15, true, fedExcess > 0 ? colRed : colWhite); drawRect(page2, cwx, contY, wRem1, 15);
        drawText(page2, fedExcess > 0 ? "YES. PRHTA needs to identify additional federal funds." : "NO additional federal funds needed.", cwx + wRem1/2, contY + 5, fontBold, 4.5, true, false, fedExcess > 0 ? colWhite : rgb(0,0,0));
        cwx += wRem1;

        drawRect(page2, cwx, contY, wRem1, 15, true, tollExcess > 0 ? colRed : colWhite); drawRect(page2, cwx, contY, wRem1, 15);
        drawText(page2, tollExcess > 0 ? "YES. Additional toll credits needed." : "NO additional toll credits needed.", cwx + wRem1/2, contY + 5, fontBold, 4.5, true, false, tollExcess > 0 ? colWhite : rgb(0,0,0));
        cwx += wRem1;

        drawRect(page2, cwx, contY, wRem1, 15, true, stateExcess > 0 ? colRed : colWhite); drawRect(page2, cwx, contY, wRem1, 15);
        drawText(page2, stateExcess > 0 ? "YES. PRHTA needs to identify additional state funds." : "NO additional state funds needed.", cwx + wRem1/2, contY + 5, fontBold, 4.5, true, false, stateExcess > 0 ? colWhite : rgb(0,0,0));

        // Row 4 NOTE
        contY += 15;
        drawRect(page2, contX, contY, contW, 32, true, colLightGray); drawRect(page2, contX, contY, contW, 32);
        drawText(page2, "NOTE: PRHTA FEDERAL LIAISON OFFICE AND BUDGET OFFICE WILL VERIFY THE VALUES IN THE CELLS OF FEDERAL, TOLL CREDITS", contX + contW/2, contY + 12, fontBold, 5.5, true);
        drawText(page2, "AND STATE FUNDS TO IDENTIFY THE NEED FOR ADDITIONAL FUNDS IN THE PROJECT.", contX + contW/2, contY + 22, fontBold, 5.5, true);

        // Bottom section
        p2y += 35; // moving past the left box
        drawRect(page2, startX, p2y, totalW, 20, true, colLightGray); drawRect(page2, startX, p2y, totalW, 20);
        drawText(page2, "AS INDICATED IN THE PROJECT MODIFICATION REQUEST LETTERS (THE LETTERS ARE DEVELOPED BY THE PRHTA FEDERAL LIAISON OFFICE AND EVALUATED/APPROVED BY THE FHWA PR/USVI DIVISION.", startX + totalW/2, p2y + 7, fontBold, 5, true);
        drawText(page2, "FUNDS INFORMATION IN THE LETTERS WILL BE ACCESSED THROUGH A FOLDER IN A CLOUD PLATFORM):", startX + totalW/2, p2y + 16, fontBold, 5, true);

        p2y += 20;
         bCols = [120, 90, 90, 90, 91, 91];
         bx = startX;

        drawRect(page2, bx, p2y, bCols[0], 25, true, colWhite); drawRect(page2, bx, p2y, bCols[0], 25);
        drawText(page2, "Obligations Amount (excludes\nPayroll, Mileage and Diets)", bx + bCols[0]/2, p2y + 10, fontBold, 5.5, true);
        bx += bCols[0];

        drawRect(page2, bx, p2y, bCols[1], 25, true, colLightGray); drawRect(page2, bx, p2y, bCols[1], 25);
        drawText(page2, "Total Cost", bx + bCols[1]/2, p2y + 14, fontBold, 5.5, true);
        bx += bCols[1];

        drawRect(page2, bx, p2y, bCols[2], 25, true, colWhite); drawRect(page2, bx, p2y, bCols[2], 25);
        drawText(page2, "Federal Funds", bx + bCols[2]/2, p2y + 14, fontBold, 5.5, true);
        bx += bCols[2];

        drawRect(page2, bx, p2y, bCols[3], 25, true, colPeachHead); drawRect(page2, bx, p2y, bCols[3], 25);
        drawText(page2, "Federal Share", bx + bCols[3]/2, p2y + 14, fontBold, 5.5, true);
        bx += bCols[3];

        drawRect(page2, bx, p2y, bCols[4], 25, true, colLightGreen); drawRect(page2, bx, p2y, bCols[4], 25);
        drawText(page2, "Toll Credits", bx + bCols[4]/2, p2y + 14, fontBold, 5.5, true);
        bx += bCols[4];

        drawRect(page2, bx, p2y, bCols[5], 25, true, colLightYellow); drawRect(page2, bx, p2y, bCols[5], 25);
        drawText(page2, "State Funds", bx + bCols[5]/2, p2y + 14, fontBold, 5.5, true);

        p2y += 25;

        // Original Project Funds Row
        bx = startX;
        drawRect(page2, bx, p2y, bCols[0], 12, true, colWhite); drawRect(page2, bx, p2y, bCols[0], 12);
        drawText(page2, "Original Project Funds", bx + bCols[0]/2, p2y + 8, font, 5.5, true);
        bx += bCols[0];

        // Total Cost (excluding payroll?) 
        // Based on original project agreement funds: participating + FA requested + state share fed + not part state
        // Let's sum based on project
         origTot = (parseFloat(project.cost_original) || 0); // Simplified approximation 
        const grandFedFA = (agreementFunds || []).reduce((s, f) => s + (f.fa_funds_requested || 0), 0);
        const grandFedNoContingency = grandFedFA; // Just requested
        const grandStateNoCont = (agreementFunds || []).reduce((s, f) => s + (f.state_share_federal || 0) + (f.not_participating_state || 0), 0);
        
        drawRect(page2, bx, p2y, bCols[1], 12, true, colWhite); drawRect(page2, bx, p2y, bCols[1], 12);
        drawText(page2, formatCurrency(origTot), bx + bCols[1]/2, p2y + 8, font, 5.5, true);
        bx += bCols[1];

        drawRect(page2, bx, p2y, bCols[2], 12, true, colWhite); drawRect(page2, bx, p2y, bCols[2], 12);
        drawText(page2, formatCurrency(grandFedNoContingency), bx + bCols[2]/2, p2y + 8, font, 5.5, true);
        bx += bCols[2];

        drawRect(page2, bx, p2y, bCols[3], 12, true, colWhite); drawRect(page2, bx, p2y, bCols[3], 12);
        drawText(page2, formatCurrency(grandFedNoContingency), bx + bCols[3]/2, p2y + 8, font, 5.5, true);
        bx += bCols[3];

        drawRect(page2, bx, p2y, bCols[4], 12, true, colWhite); drawRect(page2, bx, p2y, bCols[4], 12);
        drawText(page2, "$0.00", bx + bCols[4]/2, p2y + 8, font, 5.5, true);
        bx += bCols[4];

        drawRect(page2, bx, p2y, bCols[5], 12, true, colWhite); drawRect(page2, bx, p2y, bCols[5], 12);
        drawText(page2, formatCurrency(grandStateNoCont), bx + bCols[5]/2, p2y + 8, font, 5.5, true);

        p2y += 12;

         rtTot = origTot;
         rtFed = grandFedNoContingency;
         rtToll = 0;
         rtState = grandStateNoCont;

        for (let j = 1; j <= 10; j++) {
            bx = startX;
            drawRect(page2, bx, p2y, bCols[0], 12, true, colWhite); drawRect(page2, bx, p2y, bCols[0], 12);
            drawText(page2, `Modification #${j}`, bx + bCols[0]/2, p2y + 8, font, 5.5, true);
            bx += bCols[0];
            
            let cCho = selectedChos[j-1];
            
            const isToll = project.eligible_toll_credits;
            const rTC = cCho ? (cCho.proposed_change || 0) : 0;
            const rFF = cCho ? (cCho.proposed_change * (cCho.federal_share_pct || 0) / 100) : 0;
            const matchAmt = rTC - rFF;
            const rToll = isToll ? matchAmt : 0;
            const rState = (cCho ? (cCho.non_participating_state_amt || 0) : 0) + (!isToll ? matchAmt : 0);

            rtTot += rTC;
            rtFed += rFF;
            rtToll += rToll;
            rtState += rState;

            [rTC, rFF, rFF, rToll, rState].forEach((vx, vi) => {
                drawRect(page2, bx, p2y, bCols[vi+1], 12, true, colWhite); drawRect(page2, bx, p2y, bCols[vi+1], 12);
                let color = (vx < 0 && cCho) ? colRed : rgb(0,0,0);
                drawText(page2, vx === 0 && !cCho ? "$0.00" : formatCurrency(vx), bx + bCols[vi+1]/2, p2y + 8, font, 5.5, true, false, color);
                bx += bCols[vi+1];
            });

            p2y += 12;
        }

        // Revised Amount
        bx = startX;
        drawRect(page2, bx, p2y, bCols[0], 12, true, colLightGray); drawRect(page2, bx, p2y, bCols[0], 12);
        drawText(page2, "Revised Amount", bx + bCols[0]/2, p2y + 8, fontBold, 7, true, false, rgb(0,0,0));
        bx += bCols[0];

        drawRect(page2, bx, p2y, bCols[1], 12, true, colLightGray); drawRect(page2, bx, p2y, bCols[1], 12);
        drawText(page2, formatCurrency(rtTot), bx + bCols[1]/2, p2y + 8, fontBold, 5.5, true);
        bx += bCols[1];

        drawRect(page2, bx, p2y, bCols[2], 12, true, colLightGray); drawRect(page2, bx, p2y, bCols[2], 12);
        drawText(page2, formatCurrency(rtFed), bx + bCols[2]/2, p2y + 8, fontBold, 5.5, true);
        bx += bCols[2];

        drawRect(page2, bx, p2y, bCols[3], 12, true, colPeachHead); drawRect(page2, bx, p2y, bCols[3], 12);
        drawText(page2, formatCurrency(rtFed), bx + bCols[3]/2, p2y + 8, fontBold, 5.5, true);
        bx += bCols[3];

        drawRect(page2, bx, p2y, bCols[4], 12, true, colLightGreen); drawRect(page2, bx, p2y, bCols[4], 12);
        drawText(page2, formatCurrency(rtToll), bx + bCols[4]/2, p2y + 8, fontBold, 5.5, true);
        bx += bCols[4];

        drawRect(page2, bx, p2y, bCols[5], 12, true, colLightYellow); drawRect(page2, bx, p2y, bCols[5], 12);
        drawText(page2, formatCurrency(rtState), bx + bCols[5]/2, p2y + 8, fontBold, 5.5, true);

        // Footer Handled at start of block
        drawText(page2, `Page ${pageNum} of 2`, PW/2, PH - 15, font, 8, true);

        const pdfBytes = await pdfDoc.save();
        return new Blob([pdfBytes as any], { type: 'application/pdf' });
    } catch (err: any) {
        console.error("Error generating CCML:", err);
        throw err;
    }
}
