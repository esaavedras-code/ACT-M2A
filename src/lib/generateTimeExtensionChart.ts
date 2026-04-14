import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import { supabase } from './supabase';
import { formatDate } from './utils';

const PW = 792; // Landscape 11"
const PH = 612; // Landscape 8.5"

const drawText = (p: any, txt: any, x: number, y: number, font: any, size = 8, center = false, right = false, color = rgb(0, 0, 0), maxWidth?: number) => {
    if (txt === undefined || txt === null) return;
    
    const str = txt.toString().replace(/\t/g, ' ').replace(/\r/g, '');
    let finalLines: string[] = [];

    if (maxWidth) {
        const words = str.split(' ');
        let currentLine = "";
        for (const word of words) {
            const testLine = currentLine ? currentLine + " " + word : word;
            const testWidth = font.widthOfTextAtSize(testLine, size);
            if (testWidth > maxWidth) {
                finalLines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        finalLines.push(currentLine);
    } else {
        finalLines = str.split('\n');
    }

    let currY = y;
    for (const s of finalLines) {
        const textWidth = font.widthOfTextAtSize(s, size);
        let finalX = x;
        if (center) finalX = x - (textWidth / 2);
        else if (right) finalX = x - textWidth;
        
        p.drawText(s, { x: finalX, y: PH - currY, size, font, color });
        currY += size * 1.2;
    }
};

const drawRect = (p: any, x: number, y: number, w: number, h: number, fill = false, color = rgb(1, 1, 1), borderColor = rgb(0,0,0), borderWidth = 1, opacity = 1) => {
    if (fill) { p.drawRectangle({ x, y: PH - y - h, width: w, height: h, color, opacity }); }
    if (borderWidth > 0) {
        p.drawRectangle({ x, y: PH - y - h, width: w, height: h, borderColor, borderWidth, opacity });
    }
};

const getMonthName = (m: number) => {
    const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
    return months[m % 12];
};

const addDays = (dateStr: string, days: number) => {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + (days || 0));
    return date.toISOString().split('T')[0];
};

export async function generateTimeExtensionChart(projectId: string, choId: string) {
    try {
        const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single();
        const { data: currentCho } = await supabase.from('chos').select('*').eq('id', choId).single();
        const { data: allChos } = await supabase.from('chos').select('*').eq('project_id', projectId).order('cho_num', { ascending: true });

        if (!project || !currentCho) throw new Error("Datos insuficientes.");

        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([PW, PH]); 
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const fontBoldItalic = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);

        // --- COLORS (Matching Professional UI) ---
        const colorBlue = rgb(59/255, 130/255, 246/255); // #3b82f6 (Primary)
        const colorOlive = rgb(126/255, 112/255, 65/255); // #7e7041
        const colorRed = rgb(239/255, 68/255, 68/255); // #ef4444
        const colorGreen = rgb(34/255, 197/255, 94/255); // #22c55e
        const colorYellow = rgb(251/255, 191/255, 36/255); // #fbbf24

        // --- HEADER ---
        let py = 45;
        const leftIndent = 40;
        const valueIndent = 135;

        drawText(page, "Project Name:", leftIndent, py, fontBold, 11);
        drawText(page, project.name, valueIndent, py, font, 11, false, false, rgb(0,0,0), 600);
        py += 18;
        if (project.name.length > 80) py += 15;

        drawText(page, "Oracle No:", leftIndent, py, fontBold, 11);
        drawText(page, project.num_oracle || '--', valueIndent, py, font, 11);
        py += 18;

        drawText(page, "Project No:", leftIndent, py, fontBold, 11);
        drawText(page, `${project.num_act || '--'} // ${project.num_federal || ''}`, valueIndent, py, font, 11);

        py += 45;
        drawText(page, `CHANGE ORDER ${currentCho.cho_num}${currentCho.amendment_letter || ''}`, PW/2, py, fontBoldItalic, 16, true);

        // --- TIME CALCS ---
        const beginDateStr = project.date_project_start || "2023-01-01";
        const origEndDateStr = project.date_orig_completion || "2023-12-31";
        
        let priorExt = 0;
        (allChos || []).forEach(c => {
            if (parseInt(c.cho_num) < parseInt(currentCho.cho_num)) priorExt += (parseInt(c.time_extension_days) || 0);
        });
        const thisExtTotal = parseInt(currentCho.time_extension_days) || 0;
        const totalExt = priorExt + thisExtTotal;
        
        const revisedEndDatePrior = addDays(origEndDateStr, priorExt);
        const revisedEndDateFinal = addDays(origEndDateStr, totalExt);

        // PARSE JUSTIFICATION (Professional Logic matches UI)
        const findDays = (keywords: string[]) => {
            const justifText = currentCho.justification || "";
            for (const kw of keywords) {
                const regex = new RegExp(`(\\d+)\\s*(?:días|dias).*?${kw}|${kw}.*?(\\d+)\\s*(?:días|dias)`, 'i');
                const match = justifText.match(regex);
                if (match) return parseInt(match[1] || match[2]);
            }
            return 0;
        };

        const phasesCount = {
            aprobacion: findDays(["aprobación", "aprobacion", "documento"]),
            fabricacion: findDays(["pedido", "fabricación", "fabricacion", "entrega"]),
            instalacion: findDays(["instalación", "instalacion", "programación", "programacion"]),
        };

        const sumSpecified = phasesCount.aprobacion + phasesCount.fabricacion + phasesCount.instalacion;
        let ratio = sumSpecified > thisExtTotal && thisExtTotal > 0 ? thisExtTotal / sumSpecified : 1;

        const scaledAprob = Math.round(phasesCount.aprobacion * ratio);
        const scaledFab = Math.round(phasesCount.fabricacion * ratio);
        // Ensure last phase exactly matches the total balance
        const scaledInst = Math.max(0, thisExtTotal - scaledAprob - scaledFab);

        // --- CHART GRID ---
        py += 35;
        const chartW = PW - 80;
        const chartH = 240; // Increased height
        const marginX = 40;
        
        // Main outer box
        drawRect(page, marginX, py, chartW, chartH, false, rgb(1,1,1), rgb(0.8, 0.8, 0.8), 1);
        
        // Header "TIME ANALYSIS CHART"
        drawRect(page, marginX, py, chartW, 25, true, rgb(0.96, 0.96, 0.96), rgb(0.8, 0.8, 0.8), 0.5);
        drawText(page, "TIME ANALYSIS CHART (GANTT VIEW)", marginX + chartW/2, py + 18, fontBoldItalic, 13, true);
        py += 25;

        // Grid split
        const monthCols = 24;
        const monthW = chartW / monthCols;
        const finishDateObj = new Date(revisedEndDateFinal + 'T12:00:00'); // Midday to avoid TZ issues
        const focusYear = finishDateObj.getFullYear();
        const startYear = focusYear - 1;

        // Years
        drawRect(page, marginX, py, monthW * 12, 20, true, rgb(0.98, 0.98, 0.98), rgb(0.8, 0.8, 0.8), 0.5);
        drawText(page, `${startYear}`, marginX + (monthW * 12)/2, py + 15, fontBold, 11, true);
        drawRect(page, marginX + monthW * 12, py, chartW - (monthW * 12), 20, true, rgb(0.98, 0.98, 0.98), rgb(0.8, 0.8, 0.8), 0.5);
        drawText(page, `${focusYear}`, marginX + monthW * 12 + (chartW - monthW * 12)/2, py + 15, fontBold, 11, true);
        py += 20;

        // Months
        for (let i = 0; i < monthCols; i++) {
            const mx = marginX + i * monthW;
            drawRect(page, mx, py, monthW, 15, false, rgb(1,1,1), rgb(0.9, 0.9, 0.9), 0.5);
            drawText(page, getMonthName(i), mx + monthW/2, py + 11, font, 8, true, false, rgb(0.5, 0.5, 0.5));
        }
        py += 15;

        // GANTT BARS SCALING
        const chartEndDate = new Date(focusYear + 1, 0, 1);
        const chartStartDate = new Date(startYear, 0, 1);
        const totalDaysDiff = (chartEndDate.getTime() - chartStartDate.getTime()) / (1000 * 60 * 60 * 24);
        const pixelPerDay = chartW / totalDaysDiff;

        const getX = (dateStr: string | Date) => {
            const d = typeof dateStr === 'string' ? new Date(dateStr + 'T12:00:00') : dateStr;
            if (d < chartStartDate) return marginX;
            if (d > chartEndDate) return marginX + chartW;
            const diff = (d.getTime() - chartStartDate.getTime()) / (1000 * 60 * 60 * 24);
            return marginX + diff * pixelPerDay;
        };

        const barYBase = py + 10;
        const bh = 34; // Slightly more spacing

        // 1. Blue Bar (Active Contract Time)
        const bX1 = getX(beginDateStr);
        const bX2 = getX(revisedEndDatePrior);
        const bW = Math.max(0, bX2 - bX1);
        if (bW > 2) {
            drawRect(page, bX1, barYBase, bW, bh, true, colorBlue, colorBlue, 1);
            if (bW > 100) {
                drawText(page, `CONTRATO VIGENTE`, bX1 + bW/2, barYBase + 13, fontBold, 8, true, false, rgb(1,1,1));
                drawText(page, `Desde: ${formatDate(beginDateStr)}`, bX1 + bW/2, barYBase + 24, font, 7, true, false, rgb(1,1,1));
            }
        }

        // 2. Extension Phases (Dynamic)
        let currentOffsetDateStr = revisedEndDatePrior;
        let activePhasesCount = 0;

        const drawPhase = (days: number, name: string, color: any, showText = true) => {
            if (days <= 0) return;
            const x1 = getX(currentOffsetDateStr);
            const endStr = addDays(currentOffsetDateStr, days);
            const x2 = getX(endStr);
            const w = x2 - x1;
            if (w > 1) {
                drawRect(page, x1, barYBase + (activePhasesCount + 1) * bh + 5, w, bh - 5, true, color, color, 0);
                if (showText) {
                    drawText(page, name, x1 + w/2, barYBase + (activePhasesCount + 1) * bh + 17, fontBold, 7, true);
                }
                activePhasesCount++;
            }
            currentOffsetDateStr = endStr;
        };

        drawPhase(scaledAprob, "APROBACIÓN", colorOlive, true);
        drawPhase(scaledFab, "FABRICACIÓN", colorRed, false); // Removed text as requested
        drawPhase(scaledInst, "INSTALACIÓN", colorGreen, false); // Removed text as requested

        // 3. Yellow Bar (Total Recommend Extension)
        // Ensure it is INSIDE the chart box (using bh rows)
        const yellowY = barYBase + 3.8 * bh + 10; 
        const totalExtensionEndX = getX(currentOffsetDateStr); 
        const extensionStartX = getX(revisedEndDatePrior);
        if (totalExtensionEndX > extensionStartX) {
            drawRect(page, extensionStartX, yellowY, totalExtensionEndX - extensionStartX, bh - 5, true, colorYellow, colorYellow, 0);
            const boxWith = totalExtensionEndX - extensionStartX;
            if (boxWith < 80 && boxWith > 30) {
                drawText(page, `${thisExtTotal} días\n(tiempo\nde ext.)`, extensionStartX + boxWith/2, yellowY + 4, fontBold, 7, true);
            } else if (boxWith <= 30) {
                drawText(page, `${thisExtTotal} d.\n(ext)`, extensionStartX + boxWith/2, yellowY + 6, fontBold, 6, true);
            } else {
                drawText(page, `${thisExtTotal} días\n(tiempo de extensión)`, extensionStartX + boxWith/2, yellowY + 12, fontBold, 8, true);
            }
        }

        // 4. Vertical Finish Box
        // Aligned EXACTLY at the end of the bars
        const vBoxW = 45;
        const yellowFullBottom = yellowY + bh - 5;
        const vBoxH = yellowFullBottom - (barYBase + bh);
        const vX = Math.min(marginX + chartW - vBoxW, totalExtensionEndX);
        drawRect(page, vX, barYBase + bh, vBoxW, vBoxH, true, rgb(1,1,1), rgb(0.3, 0.3, 0.3), 1);
        
        const line1 = "Revised finish date:";
        const line2 = formatDate(revisedEndDateFinal);
        const l1w = fontBold.widthOfTextAtSize(line1, 11);
        const l2w = fontBold.widthOfTextAtSize(line2, 11);

        // First line
        page.drawText(line1, {
            x: vX + 32,
            y: PH - (barYBase + bh + (vBoxH / 2) - (l1w / 2)),
            size: 11,
            font: fontBold,
            rotate: degrees(270)
        });
        // Second line
        page.drawText(line2, {
            x: vX + 18,
            y: PH - (barYBase + bh + (vBoxH / 2) - (l2w / 2)),
            size: 11,
            font: fontBold,
            rotate: degrees(270)
        });

        // --- BOTTOM SUMMARY ---
        py = 410;

        // Left Table
        drawRect(page, marginX, py, 260, 160, true, rgb(0.99, 0.99, 0.99), rgb(0.8, 0.8, 0.8));
        let bpy = py + 25;
        const drawSummary = (title: string, val: string) => {
            drawText(page, title, marginX + 15, bpy, fontBold, 11);
            bpy += 14;
            drawText(page, val, marginX + 35, bpy, font, 11, false, false, rgb(0.2, 0.2, 0.2));
            bpy += 25;
        }
        drawSummary("Contract beginning date:", formatDate(beginDateStr));
        drawSummary("Original termination date:", formatDate(origEndDateStr));
        drawSummary("Recommended Time Extension:", `${thisExtTotal} días`);
        drawSummary("Revised Finish Date:", formatDate(revisedEndDateFinal));

        // Right Impact Box
        const rx = marginX + 300;
        const rw = chartW - 300;
        drawRect(page, rx, py, rw, 70, true, rgb(0.97, 0.98, 1), rgb(0.15, 0.15, 0.6));
        drawText(page, "DETAILED PROJECT TIME IMPACT :", rx + rw/2, py + 18, fontBold, 12, true, false, rgb(0.1, 0.2, 0.6));
        const impactTxt = (currentCho.justification || "Impacto de tiempo justificado en los documentos adjuntos.").replace(/\n/g, ' ');
        drawText(page, `${thisExtTotal} days due to: ${impactTxt.substring(0, 240)}...`, rx + rw/2, py + 32, font, 9, true, false, rgb(0,0,0), rw - 30);

        // Right Legend Box
        const ly = py + 95;
        drawRect(page, rx, ly, rw, 65, true, rgb(1,1,1), rgb(0.8, 0.8, 0.8));
        drawText(page, "CHART LEGEND:", rx + 20, ly + 18, fontBold, 10);
        
        const legends = [
            { c: colorBlue, t: `Actual Contract Time.`, active: true },
            { c: colorOlive, t: `Aprobación y Documentación (${scaledAprob} días).`, active: scaledAprob > 0 },
            { c: colorRed, t: `Pedido, fabricación y entrega (${scaledFab} días).`, active: scaledFab > 0 },
            { c: colorGreen, t: `Instalación y programación (${scaledInst} días).`, active: scaledInst > 0 },
            { c: colorYellow, t: `Recommended Time Extension (${thisExtTotal} días).`, active: true }
        ];
        
        let lidx = 0;
        legends.filter(l => l.active).forEach((l) => {
            const lx = rx + (lidx % 2 === 0 ? 20 : rw/2);
            const lcurrY = ly + 36 + Math.floor(lidx / 2) * 18;
            drawRect(page, lx, lcurrY - 8, 10, 10, true, l.c, l.c, 0);
            drawText(page, l.t, lx + 15, lcurrY, font, 8);
            lidx++;
        });

        const pdfBytes = await pdfDoc.save();
        return new Blob([pdfBytes as any], { type: 'application/pdf' });
    } catch (e: any) {
        console.error("Error generating Time Extension Chart:", e);
        throw e;
    }
}
