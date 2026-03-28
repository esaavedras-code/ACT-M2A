
import { supabase } from './supabase';
import { formatDate as utilsFormatDate, formatCurrency, roundedAmt } from './utils';
import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib';
const RED = rgb(1, 0, 0);

export const generateMinutesReport = async (projectId: string, minuteData: any) => {
    // 1. Fetch All Necessary Project Data for Snapshot
    const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single();
    if (!project) throw new Error('Proyecto no encontrado');

    const { data: chos } = await supabase.from('chos').select('*').eq('project_id', projectId);
    const { data: certs } = await supabase.from('payment_certifications').select('*').eq('project_id', projectId).order('cert_num');
    const { data: items } = await supabase.from('contract_items').select('*').eq('project_id', projectId);
    const { data: compliance } = await supabase.from('labor_compliance').select('*').eq('project_id', projectId);
    
    // --- Consecutive Meeting Numbering & Previous Summary ---
    const currentMeetingDate = minuteData.meeting_date || project.last_meeting_date || new Date().toISOString().split('T')[0];
    const { count: minutesCountBefore } = await supabase
        .from('meeting_minutes')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .lte('meeting_date', currentMeetingDate);
    
    const { data: prevMinute } = await supabase
        .from('meeting_minutes')
        .select('participants')
        .eq('project_id', projectId)
        .lt('meeting_date', currentMeetingDate)
        .order('meeting_date', { ascending: false })
        .limit(1)
        .single();

    const previousSummary = prevMinute?.participants?.summary || 'No hay resumen de la reunión anterior disponible.';
    
    // Use the stored number if it exists, otherwise use the calculated count
    const meetingNum = minuteData.meeting_num || (minutesCountBefore || 1);

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
    let latestCertRetention = 0;
    let latestPaidRetention = 0;

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
        latestCertRetention = retention;

        // Simulate paid if it's not the latest (or logic depends on DB)
        if (c.cert_num < Math.max(0, (certs.length))) {
            totalPaidGross = roundedAmt(totalPaidGross + certGross, 2);
            totalPaidNet = roundedAmt(totalPaidNet + net, 2);
            latestPaidCertNum = c.cert_num;
            latestPaidCertDate = c.cert_date;
            latestPaidRetention = retention;
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
    
    // New: Calculate date_rev_completion if not present in DB
    const revEndDate = project.date_rev_completion 
        ? new Date(`${project.date_rev_completion}T23:59:59`) 
        : (startDate ? new Date(startDate.getTime() + (currentDays * 24 * 60 * 60 * 1000)) : null);

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
        
        // Auto-red if negative (contains parentheses)
        let finalColor = color;
        if (text.includes('(') && text.includes('$')) finalColor = rgb(0.8, 0, 0);

        page.drawText(text, { x: px, y: yPos, size, font: f, color: finalColor });
    };

    const drawWrappedText = (txt: string, x: number, yPos: number, size = 9, bold = false, align: 'left'|'center'|'right' = 'left', color = BK, w: number) => {
        const text = (txt || '').toString();
        const f = bold ? fontBold : font;
        const words = text.split(' ');
        let currentLine = '';
        let currentY = yPos;
        
        words.forEach(word => {
            const testLine = currentLine + word + ' ';
            if (f.widthOfTextAtSize(testLine, size) > w - 4) {
                drawText(currentLine.trim(), x, currentY, size, bold, align, color, w);
                currentLine = word + ' ';
                currentY -= size + 1;
            } else {
                currentLine = testLine;
            }
        });
        drawText(currentLine.trim(), x, currentY, size, bold, align, color, w);
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
    y -= 25;

    // Meeting Details Section
    const headerTitle = project.project_name || 'Nombre del Proyecto';
    drawText('ACTA DE REUNIÓN DE PROGRESO', margin, y, 14, true, 'center', PROGRAM_BLUE);
    y -= 18;
    drawWrappedText(headerTitle.toUpperCase(), margin, y, 12, true, 'center', BK, contentWidth);
    y -= 25;

    const metadataX = margin + 10;
    const metadataCol2X = margin + (contentWidth / 2);
    
    drawText(`REUNIÓN NÚMERO:`, metadataX, y, 8, true, 'left', PROGRAM_BLUE);
    drawText(`${meetingNum}`, metadataX + 110, y, 9, true, 'left', BK);
    
    drawText(`FECHA:`, metadataCol2X, y, 8, true, 'left', PROGRAM_BLUE);
    drawText(`${utilsFormatDate(minuteData.meeting_date || project.last_meeting_date || new Date().toISOString())}`, metadataCol2X + 65, y, 9, true, 'left', BK);
    y -= 15;

    drawText(`HORA:`, metadataX, y, 8, true, 'left', PROGRAM_BLUE);
    drawText(`${minuteData.meeting_time || 'N/A'}`, metadataX + 110, y, 9, true, 'left', BK);
    
    drawText(`PROYECTO:`, metadataCol2X, y, 8, true, 'left', PROGRAM_BLUE);
    drawText(`${project.project_name || project.num_act || 'N/A'}`, metadataCol2X + 65, y, 9, true, 'left', BK);
    y -= 20;

    // Attendees
    drawText(`ASISTENTES:`, metadataX, y, 8, true, 'left', PROGRAM_BLUE);
    const attendeesText = minuteData.attendees || 'No se registró lista de asistentes.';
    drawWrappedText(attendeesText, metadataX + 90, y, 8, false, 'left', BK, contentWidth - 120);
    y -= 45;

    // --- SNAPSHOT TITLE ---
    drawRect(margin, y - 18, contentWidth, 18, true, LT_GRAY, true);
    drawText('Resumen del Control del Proyecto:', margin + 5, y - 13, 11, true, 'left', PROGRAM_BLUE);
    y -= 18;

    // --- Grid 1: Progress & Time ---
    const colW = contentWidth / 4;
    const rowH = 30;
    
    const labels = ["Progreso Físico:", "Tiempo Transcurrido (días):", "% Certificado (Bruto):", "Días Adelantados/Atrasados:"];
    const values = [`${physicalProgress.toFixed(2)}%`, `${elapsedDays}`, `N/A`, `N/A` ];
    
    labels.forEach((l, i) => {
        drawRect(margin + (i * colW), y - rowH, colW, rowH);
        drawWrappedText(l, margin + (i * colW) + 2, y - 8, 7, true, 'left', PROGRAM_BLUE, colW - 4);
        drawText(values[i], margin + (i * colW), y - 24, 9, true, 'center', BK, colW);
    });
    y -= rowH;
    
    const row2Labels = ["% Tiempo Transcurrido:", "Fecha de comienzo:", "Fecha original de terminación:", "Fecha de terminación revisada:"];
    const row2Values = [
        `${timeElapsedPct.toFixed(2)}%`, 
        utilsFormatDate(project.date_project_start), 
        utilsFormatDate(project.date_orig_completion), 
        utilsFormatDate(revEndDate)
    ];
    row2Labels.forEach((l, i) => {
        drawRect(margin + (i * colW), y - rowH, colW, rowH);
        drawWrappedText(l, margin + (i * colW) + 2, y - 8, 7, true, 'left', PROGRAM_BLUE, colW - 4);
        drawText(row2Values[i], margin + (i * colW), y - 24, 9, true, 'center', BK, colW);
    });
    y -= rowH + 25; // Aumento el espacio a 25 para dejar doble espacio solicitado

    // --- Schedule & Cost Side-by-Side ---
    drawText('Cronograma del Proyecto:', margin, y, 10, true, 'left', PROGRAM_BLUE);
    drawText('Costo del Proyecto:', margin + contentWidth/2 + 5, y, 10, true, 'left', PROGRAM_BLUE);
    y -= 2;
    
    const halfW = contentWidth / 2 - 5;
    const subColW = halfW / 4;
    
    drawRect(margin, y - 25, subColW * 2, 25);
    drawWrappedText('Duración Original (días):', margin + 2, y - 10, 7, false, 'left', PROGRAM_BLUE, subColW * 2 - 4);
    drawRect(margin + subColW * 2, y - 25, subColW * 2, 25);
    drawText(`${origDays}`, margin + subColW * 2, y - 18, 9, true, 'center', BK, subColW * 2);
    
    drawRect(margin + contentWidth/2 + 5, y - 25, halfW / 2, 25);
    drawWrappedText('Monto Original del Contrato:', margin + contentWidth/2 + 7, y - 10, 7, false, 'left', PROGRAM_BLUE, halfW / 2 - 4);
    drawRect(margin + contentWidth/2 + 5 + halfW/2, y - 25, halfW / 2, 25);
    drawText(formatCurrency(originalCost), margin + contentWidth/2 + 5 + halfW/2, y - 18, 9, true, 'center', BK, halfW / 2);
    
    y -= 25;
    
    drawRect(margin, y - 25, subColW * 2, 25);
    drawWrappedText('Duración Actual:', margin + 2, y - 10, 7, false, 'left', PROGRAM_BLUE, subColW * 2 - 4);
    drawRect(margin + subColW * 2, y - 25, subColW * 2, 25);
    drawText(`${currentDays}`, margin + subColW * 2, y - 18, 9, true, 'center', BK, subColW * 2);

    drawRect(margin + contentWidth/2 + 5, y - 25, halfW / 2, 25);
    drawWrappedText('+ Órdenes de Cambio Autorizadas (Costo):', margin + contentWidth/2 + 7, y - 10, 7, false, 'left', PROGRAM_BLUE, halfW / 2 - 4);
    drawRect(margin + contentWidth/2 + 5 + halfW/2, y - 25, halfW / 2, 25);
    drawText(formatCurrency(approvedCHOAmt), margin + contentWidth/2 + 5 + halfW/2, y - 18, 9, true, 'center', BK, halfW / 2);

    y -= 25;
    
    drawRect(margin + contentWidth/2 + 5, y - 25, halfW / 2, 25);
    drawWrappedText('Monto Actual del Contrato:', margin + contentWidth/2 + 7, y - 10, 7, false, 'left', PROGRAM_BLUE, halfW / 2 - 4);
    drawRect(margin + contentWidth/2 + 5 + halfW/2, y - 25, halfW / 2, 25);
    drawText(formatCurrency(currentContractAmt), margin + contentWidth/2 + 5 + halfW/2, y - 18, 9, true, 'center', BK, halfW / 2);
    
    y -= 35;

    // --- Certifications Summary ---
    drawRect(margin, y - 15, contentWidth, 15, true, LT_GRAY);
    drawText('Resumen de Certificaciones:', margin + 5, y - 11, 10, true, 'left', PROGRAM_BLUE);
    y -= 15;
    
    const certColW = contentWidth / 3;
    const certSubW = certColW / 2;
    
    ["A la fecha:", "Sometido:", "Pagado:"].forEach((h, i) => {
        drawRect(margin + (i * certColW), y - 15, certColW, 15);
        drawText(h, margin + (i * certColW) + 2, y - 11, 8, true, 'left', PROGRAM_BLUE);
    });
    y -= 15;
    
    const drawCertRow = (labelL: string, valL: string, labelC: string, valC: string, labelR: string, valR: string) => {
        const h = 20;
        const getValueColor = (val: string, label: string) => {
            if (val.includes("(") || val.includes("-") || label.toLowerCase().includes("retenido") || label.toLowerCase().includes("deducido")) {
                return RED;
            }
            return BK;
        };

        drawRect(margin, y - h, certSubW, h); drawWrappedText(labelL, margin + 2, y - 8, 6, false, 'left', PROGRAM_BLUE, certSubW - 4);
        drawRect(margin + certSubW, y - h, certSubW, h); drawText(valL, margin + certSubW, y - 12, 8, true, 'center', getValueColor(valL, labelL), certSubW);
        
        drawRect(margin + certColW, y - h, certSubW, h); drawWrappedText(labelC, margin + certColW + 2, y - 8, 6, false, 'left', PROGRAM_BLUE, certSubW - 4);
        drawRect(margin + certColW + certSubW, y - h, certSubW, h); drawText(valC, margin + certColW + certSubW, y - 12, 8, true, 'center', getValueColor(valC, labelC), certSubW);
        
        drawRect(margin + certColW * 2, y - h, certSubW, h); drawWrappedText(labelR, margin + certColW * 2 + 2, y - 8, 6, false, 'left', PROGRAM_BLUE, certSubW - 4);
        drawRect(margin + certColW * 2 + certSubW, y - h, certSubW, h); drawText(valR, margin + certColW * 2 + certSubW, y - 12, 8, true, 'center', getValueColor(valR, labelR), certSubW);
        y -= h;
    };
    
    drawCertRow("Total Certificado a la fecha", `${certs?.length || 0}`, "Última Certificación Sometida", `${latestCertNum}`, "Última Certificación Pagada", `${latestPaidCertNum}`);
    drawCertRow("Fecha de Cert.:", utilsFormatDate(latestCertDate), "Fecha de Sometido:", utilsFormatDate(latestCertDate), "Fecha de Pagado:", utilsFormatDate(latestPaidCertDate));
    drawCertRow("Total Bruto Certificado:", formatCurrency(totalGrossCertified), "Monto Bruto:", "N/A", "Monto Bruto:", formatCurrency(totalPaidGross));
    
    const totalRetenido = totalGrossCertified - totalNetCertified;
    drawCertRow("5% Retenido Total", formatCurrency(roundedAmt(totalRetenido, 2)), "5% Retenido última cert. sometida", formatCurrency(latestCertRetention), "5% Retenido última cert. pagada", formatCurrency(latestPaidRetention));
    
    drawCertRow("Total MOS (Material on Site)", formatCurrency(0), "MOS (deducido)", formatCurrency(0), "MOS (deducido)", formatCurrency(0));
    
    drawCertRow("Total Neto Certificado:", formatCurrency(totalNetCertified), "Total Neto Sometido:", "N/A", "Total Neto Pagado:", formatCurrency(totalPaidNet));

    // --- Change Orders Section NEW ---
    drawRect(margin, y - 15, contentWidth, 15, true, LT_GRAY);
    drawText('Cambios de Orden:', margin + 5, y - 11, 10, true, 'left', PROGRAM_BLUE);
    y -= 15;

    const coColW = contentWidth / 4;
    const coRowH = 30;

    // Data for COs
    const submittedCHOs = chos?.filter(c => c.doc_status !== 'Draft') || [];
    const submittedList = submittedCHOs.map(c => c.cho_number || c.cho_name).join(', ') || 'N/A';
    
    const coLabels = [
        "Total of COs Submitted to Client:",
        `(${submittedCHOs.length}) ${submittedList}`,
        "COs negotiated to be presented to PRASA:",
        "N/A"
    ];
    
    const drawCORow = (l1: string, v1: string, l2: string, v2: string) => {
        drawRect(margin, y - coRowH, coColW, coRowH);
        drawWrappedText(l1, margin + 2, y - 10, 7, false, 'left', PROGRAM_BLUE, coColW - 4);
        drawRect(margin + coColW, y - coRowH, coColW, coRowH);
        drawWrappedText(v1, margin + coColW + 2, y - 10, 7, true, 'left', BK, coColW - 4);
        
        drawRect(margin + coColW * 2, y - coRowH, coColW, coRowH);
        drawWrappedText(l2, margin + coColW * 2 + 2, y - 10, 7, false, 'left', PROGRAM_BLUE, coColW - 4);
        drawRect(margin + coColW * 3, y - coRowH, coColW, coRowH);
        drawWrappedText(v2, margin + coColW * 3 + 2, y - 10, 7, true, 'left', BK, coColW - 4);
        y -= coRowH;
    };

    drawCORow("Total de COs sometidas al Cliente:", `(${submittedCHOs.length}) ${submittedList}`, "COs negociadas a ser presentadas a la ACT:", "N/A");
    drawCORow("Costo de la última CO:", formatCurrency(approvedCHOAmt), "Costo negociado de CO:", "N/A");
    drawCORow("Extensión de tiempo de la última CO:", `${approvedCHODays} días`, "Extensión de tiempo negociado de CO:", "N/A");

    y -= 25;

    // --- Contract Admin ---
    drawRect(margin, y - 15, contentWidth, 15, true, LT_GRAY);
    drawText('Administración del Contrato:', margin + 5, y - 11, 10, true, 'left', PROGRAM_BLUE);
    y -= 15;
    
    const adminColW = contentWidth / 2;
    drawRect(margin, y - 20, adminColW / 2, 20); drawText("Número de RFI:", margin + 2, y - 10, 7, false, 'left', PROGRAM_BLUE);
    drawRect(margin + adminColW / 2, y - 20, adminColW / 2, 20); drawText("N/A", margin + adminColW / 2, y - 12, 8, true, 'center', BK, adminColW / 2);
    drawRect(margin + adminColW, y - 20, adminColW / 2, 20); drawText("Número de Sumisiones (Submittals):", margin + adminColW + 2, y - 10, 7, false, 'left', PROGRAM_BLUE);
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

    const sectionPairs = [
        ["2. Construction permit", "2. Permiso de construcción"],
        ["3. Owner Controlled Insurance Program (OCIP) Claims", "3. Reclamaciones OCIP (Owner Controlled Insurance Program)"],
        ["4. Construction Progress Tracking", "4. Seguimiento del progreso de construcción"],
        ["5. Main Critical Activities (Four Weeks Look Ahead)", "5. Actividades críticas principales (Four Weeks Look Ahead)"],
        ["6. Marked-up red lined drawings", "6. Planos marcados (Red-lined drawings)"],
        ["7. Safety (SA)", "7. Seguridad (SA)"],
        ["8. Schedule (SC)", "8. Cronograma (SC)"],
        ["9. Procurement (PR)", "9. Adquisiciones (PR)"],
        ["10. Construction (CO)", "10. Construcción (CO)"],
        ["11. Administration (AD)", "11. Administración (AD)"],
        ["12. Other (OT)", "12. Otros (OT)"],
        ["13. Substantial Completion", "13. Terminación Substancial"]
    ];

    // Section 1: Executive Summary
    drawSectionHeader("1. Resumen Ejecutivo");
    drawText("A. PUNTOS PRINCIPALES DE LA REUNIÓN PASADA:", margin + 5, y, 8, true, 'left', PROGRAM_BLUE);
    y -= 12;
    drawSectionText(previousSummary);
    y -= 10;
    drawText("B. PUNTOS PRINCIPALES DE LA REUNIÓN ACTUAL:", margin + 5, y, 8, true, 'left', PROGRAM_BLUE);
    y -= 12;
    drawSectionText(minuteData.summary);
    
    const fullMinutes = minuteData.minutes || '';

    // --- Special Tables for Section 2 & 3 ---
    
    // 2. Permisos de Construcción
    drawSectionHeader("2. Permisos de construcción");
    const permitRecords = compliance?.filter(c => c.doc_type.toLowerCase().includes('permiso') || c.doc_type === 'PUI') || [];
    
    if (permitRecords.length > 0) {
        const pCol1 = contentWidth * 0.6;
        const pCol2 = contentWidth * 0.2;
        const pCol3 = contentWidth * 0.2;
        
        drawRect(margin, y - 15, pCol1, 15); drawText("Nombre del Permiso/Agencia/Número:", margin + 2, y - 11, 7, true, 'left', PROGRAM_BLUE);
        drawRect(margin + pCol1, y - 15, pCol2, 15); drawText("Fecha Efectiva:", margin + pCol1, y - 11, 7, true, 'center', PROGRAM_BLUE, pCol2);
        drawRect(margin + pCol1 + pCol2, y - 15, pCol3, 15); drawText("Fecha Expiración:", margin + pCol1 + pCol2, y - 11, 7, true, 'center', PROGRAM_BLUE, pCol3);
        y -= 15;
        
        permitRecords.forEach(p => {
            const h = 25;
            checkNewPage(h);
            drawRect(margin, y - h, pCol1, h); drawWrappedText(p.doc_type + (p.subcontractor_name ? ` (${p.subcontractor_name})` : ''), margin + 2, y - 10, 7, false, 'left', BK, pCol1 - 4);
            drawRect(margin + pCol1, y - h, pCol2, h); drawText(utilsFormatDate(p.date_received), margin + pCol1, y - 15, 8, false, 'center', BK, pCol2);
            drawRect(margin + pCol1 + pCol2, y - h, pCol3, h); drawText(utilsFormatDate(p.date_expiry), margin + pCol1 + pCol2, y - 15, 8, false, 'center', BK, pCol3);
            y -= h;
        });
    } else {
        drawSectionText("No se encontraron permisos registrados.");
    }

    // 3. Seguros
    drawSectionHeader("3. Seguros");
    const insuranceRecords = compliance?.filter(c => c.doc_type.toLowerCase().includes('póliza')) || [];
    
    if (insuranceRecords.length > 0) {
        const iCol1 = contentWidth * 0.5;
        const iCol2 = contentWidth * 0.25;
        const iCol3 = contentWidth * 0.25;
        
        drawRect(margin, y - 15, iCol1, 15); drawText("Tipo de Seguro/Entidad:", margin + 2, y - 11, 7, true, 'left', PROGRAM_BLUE);
        drawRect(margin + iCol1, y - 15, iCol2, 15); drawText("Fecha Efectiva:", margin + iCol1, y - 11, 7, true, 'center', PROGRAM_BLUE, iCol2);
        drawRect(margin + iCol1 + iCol2, y - 15, iCol3, 15); drawText("Fecha Expiración:", margin + iCol1 + iCol2, y - 11, 7, true, 'center', PROGRAM_BLUE, iCol3);
        y -= 15;
        
        insuranceRecords.forEach(p => {
            const h = 25;
            checkNewPage(h);
            drawRect(margin, y - h, iCol1, h); drawWrappedText(p.doc_type + (p.subcontractor_name ? ` (${p.subcontractor_name})` : ''), margin + 2, y - 10, 7, false, 'left', BK, iCol1 - 4);
            drawRect(margin + iCol1, y - h, iCol2, h); drawText(utilsFormatDate(p.date_received), margin + iCol1, y - 15, 8, false, 'center', BK, iCol2);
            drawRect(margin + iCol1 + iCol2, y - h, iCol3, h); drawText(utilsFormatDate(p.date_expiry), margin + iCol1 + iCol2, y - 15, 8, false, 'center', BK, iCol3);
            y -= h;
        });
    } else {
        drawSectionText("No se encontraron seguros registrados.");
    }

    sectionPairs.forEach(([enName, esName]) => {
        // Skip 2 and 3 as they were already drawn
        if (esName.startsWith("2.") || esName.startsWith("3.")) return;

        drawSectionHeader(esName);
        
        // Try finding either English or Spanish header
        let startIdx = fullMinutes.indexOf(esName);
        let currentHeaderUsed = esName;
        
        if (startIdx === -1) {
            startIdx = fullMinutes.indexOf(enName);
            currentHeaderUsed = enName;
        }

        if (startIdx !== -1) {
            let nextSecIdx = fullMinutes.length;
            
            sectionPairs.forEach(([enOther, esOther]) => {
                [enOther, esOther].forEach(header => {
                    const idx = fullMinutes.indexOf(header);
                    if (idx > startIdx && idx < nextSecIdx) nextSecIdx = idx;
                });
            });

            const content = fullMinutes.substring(startIdx + currentHeaderUsed.length, nextSecIdx).replace(/^[:\s-]+/, '').trim();
            drawSectionText(content || 'No se discutieron puntos específicos.');
        } else {
            drawSectionText('No se discutieron puntos específicos.');
        }
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
