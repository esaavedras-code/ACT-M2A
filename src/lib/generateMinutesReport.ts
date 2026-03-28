
import { supabase } from './supabase';
import { formatDate as utilsFormatDate, formatCurrency, roundedAmt } from './utils';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export const generateMinutesReport = async (projectId: string, minuteData: any) => {
    // 1. Fetch All Necessary Project Data for Snapshot
    const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single();
    if (!project) throw new Error('Proyecto no encontrado');

    const { data: chos } = await supabase.from('chos').select('*').eq('project_id', projectId);
    const { data: certs } = await supabase.from('payment_certifications').select('*').eq('project_id', projectId).order('cert_num');
    const { data: items } = await supabase.from('contract_items').select('*').eq('project_id', projectId);

    // --- Calculations for Snapshot ---
    const originalCost = project.cost_original || items?.reduce((acc, item) => roundedAmt(acc + roundedAmt(item.quantity * item.unit_price, 2), 2), 0) || 0;
    
    const approvedCHOs = chos?.filter(c => c.doc_status === 'Aprobado') || [];
    const approvedCHOAmt = approvedCHOs.reduce((acc, c) => roundedAmt(acc + parseFloat(c.proposed_change || '0'), 2), 0);
    const approvedCHODays = approvedCHOs.reduce((acc, c) => acc + (c.time_extension_days || 0), 0);
    
    const currentContractAmt = roundedAmt(originalCost + approvedCHOAmt, 2);
    
    let totalGrossCertified = 0;
    let totalNetCertified = 0;
    let totalPaidGross = 0;
    let totalPaidNet = 0;
    let latestCertNum = 0;
    let latestCertDate = '';
    let latestPaidCertNum = 0;
    let latestPaidCertDate = '';

    certs?.forEach(c => {
        const certItems = Array.isArray(c.items) ? c.items : (c.items?.list || []);
        let certGross = 0;
        certItems.forEach((it: any) => {
            certGross = roundedAmt(certGross + (parseFloat(it.quantity) * parseFloat(it.unit_price)), 2);
        });
        
        totalGrossCertified = roundedAmt(totalGrossCertified + certGross, 2);
        const retention = c.skip_retention ? 0 : roundedAmt(certGross * 0.05, 2);
        const net = roundedAmt(certGross - retention, 2);
        totalNetCertified = roundedAmt(totalNetCertified + net, 2);

        latestCertNum = c.cert_num;
        latestCertDate = c.cert_date;

        // Simulate paid if it's not the latest (or logic depends on DB)
        if (c.cert_num < Math.max(0, (certs.length))) {
            totalPaidGross = roundedAmt(totalPaidGross + certGross, 2);
            totalPaidNet = roundedAmt(totalPaidNet + net, 2);
            latestPaidCertNum = c.cert_num;
            latestPaidCertDate = c.cert_date;
        }
    });

    const physicalProgress = currentContractAmt > 0 ? (totalGrossCertified / currentContractAmt) * 100 : 0;
    
    const startDate = project.date_project_start ? new Date(`${project.date_project_start}T00:00:00`) : null;
    const origEndDate = project.date_orig_completion ? new Date(`${project.date_orig_completion}T23:59:59`) : null;
    let origDays = 0;
    if (startDate && origEndDate) origDays = Math.ceil((origEndDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
    const currentDays = origDays + approvedCHODays;
    
    const today = new Date();
    let elapsedDays = 0;
    if (startDate) elapsedDays = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
    const timeElapsedPct = currentDays > 0 ? (elapsedDays / currentDays) * 100 : 0;
    const remainingDays = Math.max(0, currentDays - elapsedDays);

    // 2. Setup PDF
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    const BK = rgb(0, 0, 0);
    const PROGRAM_BLUE = rgb(0, 86/255, 179/255);
    const LT_GRAY = rgb(0.95, 0.95, 0.95);

    const PW = 612, PH = 792;
    const margin = 40;
    const contentWidth = PW - (margin * 2);

    let page = pdfDoc.addPage([PW, PH]);
    let y = PH - margin;

    // Helpers
    const drawText = (txt: string, x: number, yPos: number, size = 9, bold = false, align: 'left'|'center'|'right' = 'left', color = BK, w?: number) => {
        const text = (txt || '').toString();
        const f = bold ? fontBold : font;
        let px = x;
        const width = w ?? (align === 'left' ? 0 : contentWidth);
        if (align === 'center') px = x + (width - f.widthOfTextAtSize(text, size)) / 2;
        if (align === 'right') px = x + width - f.widthOfTextAtSize(text, size);
        page.drawText(text, { x: px, y: yPos, size, font: f, color });
    };

    const drawRect = (x: number, yPos: number, w: number, h: number, fill = false, color = BK, border = true) => {
        if (fill) page.drawRectangle({ x, y: yPos, width: w, height: h, color });
        if (border) page.drawRectangle({ x, y: yPos, width: w, height: h, borderColor: BK, borderWidth: 0.5 });
    };

    const checkNewPage = (needed: number) => {
        if (y - needed < margin) {
            page = pdfDoc.addPage([PW, PH]);
            y = PH - margin;
            return true;
        }
        return false;
    };

    // --- Header ---
    drawText('M2A Group - Engineers, LLP - WSP Puerto Rico PC', margin, y, 9, false, 'center');
    y -= 20;

    // --- SNAPSHOT TITLE ---
    drawRect(margin, y - 18, contentWidth, 18, true, LT_GRAY, true);
    drawText('Project Control Snapshot:', margin + 5, y - 13, 11, true, 'left', PROGRAM_BLUE);
    y -= 18;

    // --- Grid 1: Progress & Time ---
    const colW = contentWidth / 5;
    const rowH = 30;
    
    const labels = ["Physical Progress:", "Time Elapsed (days):", "% Certified (Gross):", "Days Ahead/Behind:", "Remaining D. to SC:"];
    const values = [`${physicalProgress.toFixed(2)}%`, `${elapsedDays}`, `N/A`, `N/A`, `${remainingDays}`];
    
    labels.forEach((l, i) => {
        drawRect(margin + (i * colW), y - rowH, colW, rowH);
        drawText(l, margin + (i * colW) + 2, y - 12, 7, true, 'left', PROGRAM_BLUE);
        drawText(values[i], margin + (i * colW), y - 24, 9, true, 'center', BK, colW);
    });
    y -= rowH;
    
    drawRect(margin, y - rowH, colW, rowH);
    drawText("Time Elapsed %:", margin + 2, y - 12, 7, true, 'left', PROGRAM_BLUE);
    drawText(`${timeElapsedPct.toFixed(2)}%`, margin, y - 24, 9, true, 'center', BK, colW);
    y -= rowH + 10;

    // --- Schedule & Cost Side-by-Side ---
    drawText('Project Schedule:', margin, y, 10, true, 'left', PROGRAM_BLUE);
    drawText('Project Cost:', margin + contentWidth/2 + 5, y, 10, true, 'left', PROGRAM_BLUE);
    y -= 2;
    
    const halfW = contentWidth / 2 - 5;
    const subColW = halfW / 4;
    
    drawRect(margin, y - 25, subColW * 2, 25);
    drawText('Original Duration (days):', margin + 2, y - 10, 7, false, 'left', PROGRAM_BLUE);
    drawRect(margin + subColW * 2, y - 25, subColW * 2, 25);
    drawText(`${origDays}`, margin + subColW * 2, y - 18, 9, true, 'center', BK, subColW * 2);
    
    drawRect(margin + contentWidth/2 + 5, y - 25, halfW / 2, 25);
    drawText('Original Contract Amt:', margin + contentWidth/2 + 7, y - 10, 7, false, 'left', PROGRAM_BLUE);
    drawRect(margin + contentWidth/2 + 5 + halfW/2, y - 25, halfW / 2, 25);
    drawText(formatCurrency(originalCost), margin + contentWidth/2 + 5 + halfW/2, y - 18, 9, true, 'center', BK, halfW / 2);
    
    y -= 25;
    
    drawRect(margin, y - 25, subColW * 2, 25);
    drawText('Current Duration:', margin + 2, y - 10, 7, false, 'left', PROGRAM_BLUE);
    drawRect(margin + subColW * 2, y - 25, subColW * 2, 25);
    drawText(`${currentDays}`, margin + subColW * 2, y - 18, 9, true, 'center', BK, subColW * 2);

    drawRect(margin + contentWidth/2 + 5, y - 25, halfW / 2, 25);
    drawText('+ Authorized COs (Cost):', margin + contentWidth/2 + 7, y - 10, 7, false, 'left', PROGRAM_BLUE);
    drawRect(margin + contentWidth/2 + 5 + halfW/2, y - 25, halfW / 2, 25);
    drawText(formatCurrency(approvedCHOAmt), margin + contentWidth/2 + 5 + halfW/2, y - 18, 9, true, 'center', BK, halfW / 2);

    y -= 25;
    
    drawRect(margin + contentWidth/2 + 5, y - 25, halfW / 2, 25);
    drawText('Current Contract Amt:', margin + contentWidth/2 + 7, y - 10, 7, false, 'left', PROGRAM_BLUE);
    drawRect(margin + contentWidth/2 + 5 + halfW/2, y - 25, halfW / 2, 25);
    drawText(formatCurrency(currentContractAmt), margin + contentWidth/2 + 5 + halfW/2, y - 18, 9, true, 'center', BK, halfW / 2);
    
    y -= 35;

    // --- Certifications Summary ---
    drawRect(margin, y - 15, contentWidth, 15, true, LT_GRAY);
    drawText('Certifications Summary:', margin + 5, y - 11, 10, true, 'left', PROGRAM_BLUE);
    y -= 15;
    
    const certColW = contentWidth / 3;
    const certSubW = certColW / 2;
    
    ["To Date:", "Submitted:", "Paid:"].forEach((h, i) => {
        drawRect(margin + (i * certColW), y - 15, certColW, 15);
        drawText(h, margin + (i * certColW) + 2, y - 11, 8, true, 'left', PROGRAM_BLUE);
    });
    y -= 15;
    
    const drawCertRow = (labelL: string, valL: string, labelC: string, valC: string, labelR: string, valR: string) => {
        const h = 20;
        drawRect(margin, y - h, certSubW, h); drawText(labelL, margin + 2, y - 10, 6, false, 'left', PROGRAM_BLUE);
        drawRect(margin + certSubW, y - h, certSubW, h); drawText(valL, margin + certSubW, y - 12, 8, true, 'center', BK, certSubW);
        
        drawRect(margin + certColW, y - h, certSubW, h); drawText(labelC, margin + certColW + 2, y - 10, 6, false, 'left', PROGRAM_BLUE);
        drawRect(margin + certColW + certSubW, y - h, certSubW, h); drawText(valC, margin + certColW + certSubW, y - 12, 8, true, 'center', BK, certSubW);
        
        drawRect(margin + certColW * 2, y - h, certSubW, h); drawText(labelR, margin + certColW * 2 + 2, y - 10, 6, false, 'left', PROGRAM_BLUE);
        drawRect(margin + certColW * 2 + certSubW, y - h, certSubW, h); drawText(valR, margin + certColW * 2 + certSubW, y - 12, 8, true, 'center', BK, certSubW);
        y -= h;
    };
    
    drawCertRow("Total Certify to Date", `${certs?.length || 0}`, "Latest Certificated", `${latestCertNum}`, "Latest Certificated Paid", `${latestPaidCertNum}`);
    drawCertRow("Certified Date:", utilsFormatDate(latestCertDate), "Submitted Date:", utilsFormatDate(latestCertDate), "Paid Date:", utilsFormatDate(latestPaidCertDate));
    drawCertRow("Total Gross Certified:", formatCurrency(totalGrossCertified), "Gross Amount:", "N/A", "Gross Amount:", formatCurrency(totalPaidGross));
    drawCertRow("Total Net Certified:", formatCurrency(totalNetCertified), "Total Net Submitted:", "N/A", "Total Net Paid:", formatCurrency(totalPaidNet));

    y -= 25;

    // --- Contract Admin ---
    drawRect(margin, y - 15, contentWidth, 15, true, LT_GRAY);
    drawText('Contract Administration:', margin + 5, y - 11, 10, true, 'left', PROGRAM_BLUE);
    y -= 15;
    
    const adminColW = contentWidth / 2;
    drawRect(margin, y - 20, adminColW / 2, 20); drawText("Number of RFIs:", margin + 2, y - 10, 7, false, 'left', PROGRAM_BLUE);
    drawRect(margin + adminColW / 2, y - 20, adminColW / 2, 20); drawText("N/A", margin + adminColW / 2, y - 12, 8, true, 'center', BK, adminColW / 2);
    drawRect(margin + adminColW, y - 20, adminColW / 2, 20); drawText("Number of Submittals:", margin + adminColW + 2, y - 10, 7, false, 'left', PROGRAM_BLUE);
    drawRect(margin + adminColW + adminColW / 2, y - 20, adminColW / 2, 20); drawText("N/A", margin + adminColW + adminColW / 2, y - 12, 8, true, 'center', BK, adminColW / 2);
    y -= 20;

    // --- Content Parsing (Rest of sections) ---
    const drawSectionHeader = (title: string) => {
        checkNewPage(40);
        y -= 10;
        drawRect(margin, y - 15, contentWidth, 15, true, rgb(0.9, 0.9, 1), false);
        drawText(title.toUpperCase(), margin + 5, y - 11, 9, true, 'left', PROGRAM_BLUE);
        y -= 20;
    };

    const drawSectionText = (text: string) => {
        const lines = (text || '').split('\n');
        lines.forEach(line => {
            const clean = line.trim();
            if (!clean) { y -= 5; return; }
            
            const words = clean.split(' ');
            let currentLine = '';
            words.forEach(word => {
                const w = font.widthOfTextAtSize(currentLine + word, 8);
                if (w > contentWidth - 10) {
                    checkNewPage(12); drawText(currentLine, margin + 5, y, 8);
                    y -= 10; currentLine = word + ' ';
                } else currentLine += word + ' ';
            });
            checkNewPage(12); drawText(currentLine, margin + 5, y, 8);
            y -= 10;
        });
    };

    const sectionNames = [
        "2. Construction permit",
        "3. Owner Controlled Insurance Program (OCIP) Claims",
        "4. Construction Progress Tracking",
        "5. Main Critical Activities (Four Weeks Look Ahead)",
        "6. Marked-up red lined drawings",
        "7. Safety (SA)", "8. Schedule (SC)", "9. Procurement (PR)", "10. Construction (CO)", "11. Administration (AD)", "12. Other (OT)", "13. Substantial Completion"
    ];

    drawSectionHeader("1. Resumen Ejecutivo");
    drawSectionText(minuteData.summary);
    
    const fullMinutes = minuteData.minutes || '';
    sectionNames.forEach(secName => {
        drawSectionHeader(secName);
        const startIdx = fullMinutes.indexOf(secName);
        if (startIdx !== -1) {
            let nextSec = fullMinutes.length;
            sectionNames.forEach(other => {
                const idx = fullMinutes.indexOf(other);
                if (idx > startIdx && idx < nextSec) nextSec = idx;
            });
            const content = fullMinutes.substring(startIdx + secName.length, nextSec).replace(/^[:\s-]+/, '').trim();
            drawSectionText(content || 'No se discutieron puntos específicos.');
        } else drawSectionText('No se discutieron puntos específicos.');
    });

    // --- Signatures ---
    checkNewPage(120);
    y = Math.min(y, 150);
    drawText('CERTIFICACIÓN:', margin, y, 9, true); y -= 15;
    drawText('Damos fe de que estos puntos fueron discutidos y acordados en la reunión citada.', margin, y, 8, false); y -= 35;
    page.drawLine({ start: { x: margin, y }, end: { x: margin + 200, y }, thickness: 0.5 });
    page.drawLine({ start: { x: PW - margin - 200, y }, end: { x: PW - margin, y }, thickness: 0.5 });
    y -= 12; drawText('Administrador del Proyecto', margin, y, 7, true); drawText('Representante del Contratista', PW - margin - 200, y, 7, true);
    y -= 10; drawText(`ACT - Área de Construcción`, margin, y, 6); drawText(`${project.contractor_name || 'Empresa Contratista'}`, PW - margin - 200, y, 6);

    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes as any], { type: 'application/pdf' });
};
