
import { supabase } from './supabase';
import { formatDate as utilsFormatDate } from './utils';

export const generateDailyLogReport = async (projectId: string, logId: string) => {
    // 1. Fetch Data
    const { data: log } = await supabase.from('daily_logs').select('*').eq('id', logId).single();
    if (!log) throw new Error('Log no encontrado');

    const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single();
    if (!project) throw new Error('Proyecto no encontrado');

    const { data: contractor } = await supabase.from('contractors').select('*').eq('project_id', projectId).single();
    
    // Fetch contract items for specifications
    const { data: contractItems } = await supabase.from('contract_items').select('*').eq('project_id', projectId);

    // 2. Setup PDF
    const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const BK = rgb(0, 0, 0);
    const WH = rgb(1, 1, 1);
    const LIGHT_GRAY = rgb(0.9, 0.9, 0.9);

    // Letter size: 612 x 792
    const PW = 612, PH = 792;
    const margin = 30;
    const contentWidth = PW - (margin * 2);

    let page = pdfDoc.addPage([PW, PH]);
    let y = PH - margin;

    // --- Logos ---
    let actLogoImg: any = null;
    try {
        const actResp = await fetch('/act_logo.png');
        if (actResp.ok) {
            const bytes = await actResp.arrayBuffer();
            actLogoImg = await pdfDoc.embedPng(bytes).catch(() => pdfDoc.embedJpg(bytes));
        }
    } catch (_) { }

    // Helpers
    const drawCenteredText = (txt: string, yPos: number, size = 10, bld = false) => {
        const f = bld ? fontBold : font;
        const width = f.widthOfTextAtSize(txt, size);
        
        // Color logic for negatives
        let textColor = BK;
        if (txt.includes('(') && txt.includes(')')) textColor = rgb(0.8, 0, 0);
        
        page.drawText(txt, { x: (PW - width) / 2, y: yPos, size, font: f, color: textColor });
    };

    const drawBox = (x: number, yPos: number, width: number, height: number, label?: string, value?: string, fontSizeLabel = 6, fontSizeValue = 8, boldValue = false) => {
        // White background to prevent grid lines or other elements from showing through
        page.drawRectangle({ 
            x, 
            y: yPos - height, 
            width, 
            height, 
            borderWidth: 0.5, 
            borderColor: BK,
            color: rgb(1, 1, 1)
        });
        if (label) {
            page.drawText(label, { x: x + 3, y: yPos - 8, size: fontSizeLabel, font: fontBold });
        }
        if (value) {
            const f = boldValue ? fontBold : font;
            const lines = value.split('\n');
            lines.forEach((line, idx) => {
                const textY = yPos - height + 4 + (lines.length - 1 - idx) * (fontSizeValue + 2);
                // Ensure text doesn't overlap the label at top
                if (textY < yPos - 10) {
                    // Truncate text that would overflow the box width
                    const maxChars = Math.floor((width - 6) / (fontSizeValue * 0.5));
                    const truncated = line.length > maxChars ? line.substring(0, maxChars - 3) + '...' : line;
                    
                    // Color logic for negatives
                    let textColor = BK;
                    if (truncated.includes('(') && truncated.includes(')')) textColor = rgb(0.8, 0, 0);
                    
                    page.drawText(truncated, { x: x + 3, y: textY, size: fontSizeValue, font: f, color: textColor });
                }
            });
        }
    };

    const drawHeader = (pageNum: number, totalPages: number) => {
        let currentY = PH - margin;
        
        // ACT-45 Label top right (larger, matching reference photo)
        const act45Txt = 'ACT-45';
        const revTxt = '(Rev. 6/09)';
        const act45Width = fontBold.widthOfTextAtSize(act45Txt, 11);
        const revWidth = fontBold.widthOfTextAtSize(revTxt, 11);
        page.drawText(act45Txt, { x: PW - margin - act45Width, y: PH - 15, size: 11, font: fontBold });
        page.drawText(revTxt, { x: PW - margin - revWidth, y: PH - 28, size: 11, font: fontBold });

        if (actLogoImg) {
            const dims = actLogoImg.scaleToFit(50, 50);
            page.drawImage(actLogoImg, { x: margin + 10, y: currentY - 50, width: dims.width, height: dims.height });
        }

        drawCenteredText('Gobierno de Puerto Rico', currentY, 8);
        currentY -= 10;
        drawCenteredText('Departamento de Transportación y Obras Públicas', currentY, 8);
        currentY -= 10;
        drawCenteredText('Autoridad de Carreteras y Transportación', currentY, 8, true);
        currentY -= 20;
        drawCenteredText('INFORME DIARIO DE ACTIVIDADES', currentY, 11, true);
        
        // Page Info - Top Right
        page.drawText(`Página ${pageNum}`, { x: PW - margin - 50, y: currentY, size: 7, font });

        currentY -= 20;
        return currentY;
    };

    // --- Page 1 Rendering ---
    y = drawHeader(1, 2);

    // Grid 1-4 and 5-11
    const colLeftW = contentWidth * 0.65;
    const colRightW = contentWidth * 0.35;
    const startY = y;

    // Left Column (1-4)
    drawBox(margin, y, colLeftW, 25, "1. NÚM. DE PROYECTO:", project.num_act || 'N/A');
    y -= 25;
    drawBox(margin, y, colLeftW, 35, "2. NOMBRE DE PROYECTO:", project.name || 'N/A');
    y -= 35;
    drawBox(margin, y, colLeftW, 25, "3. MUNICIPIO:", Array.isArray(project.municipios) ? project.municipios.join(', ') : (project.municipios || 'N/A'));
    y -= 25;
    drawBox(margin, y, colLeftW, 35, "4. CONTRATISTA Y/O SUBCONTRATISTA:", contractor?.name || 'N/A');
    y -= 35;
    drawBox(margin, y, colLeftW, 20, "12. HORARIO DE TRABAJO:", "         A         "); 
    
    // Right Column (5-11)
    let ry = startY;
    drawBox(margin + colLeftW, ry, colRightW, 20, "5. FECHA:", utilsFormatDate(log.log_date));
    ry -= 20;
    
    // Day of week boxes
    const dayLabels = ['L', 'M', 'W', 'J', 'V', 'S', 'D'];
    const logDate = new Date(log.log_date);
    const dayOfWeek = logDate.getUTCDay(); // 0 (Sun) to 6 (Sat)
    const adjustedDayIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1; 

    page.drawRectangle({ x: margin + colLeftW, y: ry - 20, width: colRightW, height: 20, borderWidth: 0.5, borderColor: BK });
    page.drawText("6. DIA DE SEMANA:", { x: margin + colLeftW + 3, y: ry - 14, size: 6, font: fontBold });
    dayLabels.forEach((label, idx) => {
        const boxX = margin + colLeftW + 65 + (idx * 15);
        page.drawRectangle({ x: boxX, y: ry - 16, width: 12, height: 12, borderWidth: 0.5, borderColor: BK });
        page.drawText(label, { x: boxX + 3, y: ry - 14, size: 7, font });
        if (idx === adjustedDayIdx) {
            page.drawText("X", { x: boxX + 3, y: ry - 14, size: 7, font: fontBold });
        }
    });
    ry -= 20;

    drawBox(margin + colLeftW, ry, colRightW, 20, "7. INSPECTOR:", log.inspector_name || 'N/A');
    ry -= 20;
    
    drawBox(margin + colLeftW, ry, colRightW, 20, "8. PÁGINA NO.", " 1   DE   2 "); 
    ry -= 20;
    
    drawBox(margin + colLeftW, ry, colRightW, 20, "9. IDA NO.", " 1 "); 
    ry -= 20;

    // --- Weather Fix ---
    const weather = log.weather_data || {};
    const weatherCond = (weather.condition || '').replace(/\(automático\)/gi, '').trim();
    drawBox(margin + colLeftW, ry, colRightW * 0.4, 20, "10. CLIMA", `AM: ${weatherCond}`);
    drawBox(margin + colLeftW + (colRightW * 0.4), ry, colRightW * 0.2, 20); 
    drawBox(margin + colLeftW + (colRightW * 0.6), ry, colRightW * 0.2, 20, "", `PM: N/A`);
    drawBox(margin + colLeftW + (colRightW * 0.8), ry, colRightW * 0.2, 20); 
    ry -= 20;

    drawBox(margin + colLeftW, ry, colRightW, 20, "11. HORA LLUVIA", "");
    
    y = ry - 10;

    // --- Section 13-19: TRABAJO EJECUTADO ---
    drawBox(margin, y, contentWidth, 12, "TRABAJO EJECUTADO", "", 7);
    y -= 12;
    
    const tableHeaderH = 15;
    const colW = [40, 60, 160, 60, 50, 122, 60];
    const colLabels = ["13", "14", "15", "16", "17", "18", "19"];
    const colHeaders = ["PARTIDA", "ESPECIF.", "DESCRIPCIÓN", "CANT.", "UNIDAD", "LOCALIZACIÓN", "VERIFICADA"];
    
    let curX = margin;
    colHeaders.forEach((h, idx) => {
        page.drawRectangle({ x: curX, y: y - tableHeaderH, width: colW[idx], height: tableHeaderH, borderWidth: 0.5, borderColor: BK });
        page.drawText(colLabels[idx], { x: curX + 2, y: y - 6, size: 5, font });
        page.drawText(h, { x: curX + 2, y: y - 13, size: 6, font: fontBold });
        curX += colW[idx];
    });
    y -= tableHeaderH;

    const rowH = 12;
    const partidas = log.partidas_data || [];
    for (let i = 0; i < 8; i++) { 
        const p = partidas[i] || {};
        const spec = contractItems?.find(ci => ci.item_num === p.item_num)?.specification || '';
        
        curX = margin;
        colW.forEach((w, idx) => {
            page.drawRectangle({ x: curX, y: y - rowH, width: w, height: rowH, borderWidth: 0.3, borderColor: BK });
            let val = '';
            if (idx === 0) val = p.item_num || '';
            if (idx === 1) val = spec;
            if (idx === 2) val = (p.description || '').substring(0, 45);
            if (idx === 3) val = p.qty_worked?.toString() || '0.00';
            if (idx === 4) val = p.unit || '';
            if (idx === 5) val = p.location || 'N/A'; 
            if (idx === 2) {
                // Agregar notas de la partida si existen
                if (p.notes) val += ` (${p.notes})`;
            }            
            if (val) page.drawText(val, { x: curX + 2, y: y - rowH + 3, size: 7, font });
            curX += w;
        });
        y -= rowH;
    }
    y -= 5;

    // --- Item 20 & 21 ---
    let combinedNotes = log.notes_data?.comments || 'N/A';
    if (log.safety_violations_data?.comments) {
        combinedNotes += `\n[SEGURIDAD]: ${log.safety_violations_data.comments}`;
    }
    
    drawBox(margin, y, contentWidth, 50, "20. DESCRIPCIÓN DEL TRABAJO Y MATERIAL USADO, INCLUYENDO NÚMERO DE PARTIDA Y LOCALIZACIÓN:", combinedNotes);
    y -= 50;
    drawBox(margin, y, contentWidth, 35, "21. MUESTRAS TOMADAS:", "");
    y -= 40;

    // --- Section 22-25: PERSONAL ---
    drawBox(margin, y, contentWidth, 12, "PERSONAL", "", 7);
    y -= 12;
    
    const persCols = [180, 100, 80, 192];
    const persLabels = ["22", "23", "24", "25"];
    const persHeaders = ["NOMBRE", "CLASIFICACIÓN", "HORAS", "OBSERVACIONES"];
    
    curX = margin;
    persHeaders.forEach((h, idx) => {
        page.drawRectangle({ x: curX, y: y - tableHeaderH, width: persCols[idx], height: tableHeaderH, borderWidth: 0.5, borderColor: BK });
        page.drawText(persLabels[idx], { x: curX + 2, y: y - 6, size: 5, font });
        page.drawText(h, { x: curX + 2, y: y - 13, size: 6, font: fontBold });
        curX += persCols[idx];
    });
    y -= tableHeaderH;

    const personnel = log.personnel_v2_data || [];
    for (let i = 0; i < 10; i++) {
        const p = personnel[i] || {};
        curX = margin;
        persCols.forEach((w, idx) => {
            page.drawRectangle({ x: curX, y: y - rowH, width: w, height: rowH, borderWidth: 0.3, borderColor: BK });
            let val = '';
            if (idx === 0) val = p.nombres || '';
            if (idx === 1) val = p.clasificacion || '';
            if (idx === 2) val = p.horas?.toString() || '';
            if (idx === 3) val = p.observaciones || '';
            
            if (val) page.drawText(val, { x: curX + 2, y: y - rowH + 3, size: 7, font });
            curX += w;
        });
        y -= rowH;
    }

    // --- Page 2 Rendering ---
    page = pdfDoc.addPage([PW, PH]);
    y = drawHeader(2, 2);

    // Header date duplicate
    drawBox(PW - margin - 150, y, 150, 15, "5. FECHA:", utilsFormatDate(log.log_date));
    y -= 25;

    // --- Section 26-28: EQUIPO ---
    drawBox(margin, y, contentWidth, 12, "EQUIPO", "", 7);
    y -= 12;
    
    // Fix: Explicitly set borderColor and NO fill color to avoid "black boxes"
    page.drawRectangle({ x: margin, y: y - 15, width: 100, height: 15, borderWidth: 0.5, borderColor: BK });
    page.drawText("26", { x: margin + 2, y: y - 6, size: 5, font });
    page.drawText("TIPO", { x: margin + 2, y: y - 13, size: 6, font: fontBold });

    page.drawRectangle({ x: margin + 100, y: y - 15, width: 250, height: 15, borderWidth: 0.5, borderColor: BK });
    page.drawText("27", { x: margin + 100 + 2, y: y - 6, size: 5, font });
    page.drawText("DESCRIPCIÓN (MARCA, MODELO, CAPACIDAD, ETC.)", { x: margin + 100 + 2, y: y - 13, size: 6, font: fontBold });

    page.drawRectangle({ x: margin + 350, y: y - 8, width: 202, height: 8, borderWidth: 0.5, borderColor: BK });
    page.drawText("28", { x: margin + 350 + 2, y: y - 6, size: 5, font });
    
    // Fix: Center "HORAS" within its specific box instead of the whole page
    const horasText = "HORAS";
    const horasWidth = fontBold.widthOfTextAtSize(horasText, 6);
    page.drawText(horasText, { x: margin + 350 + (202 - horasWidth) / 2, y: y - 7, size: 6, font: fontBold });

    page.drawRectangle({ x: margin + 350, y: y - 15, width: 101, height: 7, borderWidth: 0.5, borderColor: BK });
    page.drawText("ACTIVO", { x: margin + 350 + 2, y: y - 14, size: 5, font: fontBold });

    page.drawRectangle({ x: margin + 451, y: y - 15, width: 101, height: 7, borderWidth: 0.5, borderColor: BK });
    page.drawText("INACTIVO", { x: margin + 451 + 2, y: y - 14, size: 5, font: fontBold });
    
    y -= 15;

    const selectedEquip = log.equipment_v2_data || [];
    const otherEquipStr = log.other_equipment_text || "";
    const manualEquip = otherEquipStr.split('\n').filter((l: string) => l.trim()).map((l: string) => ({ tipo: l.trim(), horas_op: 1 }));
    
    const equipment = [...selectedEquip, ...manualEquip];
    for (let i = 0; i < 15; i++) {
        const e = equipment[i] || {};
        curX = margin;
        
        // TIPO
        page.drawRectangle({ x: curX, y: y - rowH, width: 100, height: rowH, borderWidth: 0.3, borderColor: BK });
        const typeName = e.tipo || e.descripcion || "";
        if (typeName) page.drawText(typeName.toString(), { x: curX + 2, y: y - rowH + 3, size: 7, font });
        curX += 100;

        // DESCRIPCIÓN
        page.drawRectangle({ x: curX, y: y - rowH, width: 250, height: rowH, borderWidth: 0.3, borderColor: BK });
        if (e.descripcion) page.drawText(e.descripcion.toString(), { x: curX + 2, y: y - rowH + 3, size: 7, font });
        curX += 250;

        // ACTIVO
        page.drawRectangle({ x: curX, y: y - rowH, width: 101, height: rowH, borderWidth: 0.3, borderColor: BK });
        if (e.horas_op) page.drawText(e.horas_op.toString(), { x: curX + 2, y: y - rowH + 3, size: 7, font });
        curX += 101;

        // INACTIVO
        page.drawRectangle({ x: curX, y: y - rowH, width: 101, height: rowH, borderWidth: 0.3, borderColor: BK });
        if (e.horas_inop) page.drawText(e.horas_inop.toString(), { x: curX + 2, y: y - rowH + 3, size: 7, font });
        
        y -= rowH;
    }
    y -= 5;

    // --- Section 29: MATERIALES ---
    drawBox(margin, y, contentWidth, 30, "29. MATERIALES Y/O EQUIPOS INCORPORADOS O REMOVIDOS DEL PROYECTO:", "N/A");
    y -= 35;

    // --- Section 30: DIBUJOS, CÓMPUTOS ---
    drawBox(margin, y, contentWidth, 12, "30. DIBUJOS, CÓMPUTOS Y/O REFERENCIAS DE LAS PARTIDAS EJECUTADAS:", "", 7);
    y -= 12;
    
    // Grid area
    const gridH = 150;
    page.drawRectangle({ x: margin, y: y - gridH, width: contentWidth, height: gridH, borderWidth: 0.5, borderColor: BK });
    
    // Draw subtle grid lines
    for (let gx = margin + 10; gx < margin + contentWidth; gx += 10) {
        page.drawLine({ start: { x: gx, y }, end: { x: gx, y: y - gridH }, thickness: 0.2, color: rgb(0.8, 0.8, 0.8) });
    }
    for (let gy = y - 10; gy > y - gridH; gy -= 10) {
        page.drawLine({ start: { x: margin, y: gy }, end: { x: margin + contentWidth, y: gy }, thickness: 0.2, color: rgb(0.8, 0.8, 0.8) });
    }
    y -= gridH;
    y -= 10;

    // --- Signatures ---
    const sigW = contentWidth / 2;
    
    // Inspector
    drawBox(margin, y, sigW, 40, "32. NOMBRE DEL INSPECTOR:", project.admin_name || log.inspector_name || 'N/A');
    drawBox(margin + sigW, y, sigW, 40, "35. REVISADO POR:", "");
    y -= 40;
    
    drawBox(margin, y, sigW, 30, "33. FIRMA DEL INSPECTOR:", "");
    drawBox(margin + sigW, y, sigW, 30, "36. FIRMA DEL REVISADOR:", "");
    y -= 30;

    drawBox(margin, y, sigW, 20, "34. FECHA:", utilsFormatDate(log.log_date));
    drawBox(margin + sigW, y, sigW, 20, "37. FECHA DE REVISIÓN:", "");

    // --- PHOTO PAGES (4 photos per page) ---
    const photos = log.photos_v2_data || [];
    if (photos.length > 0) {
        const photosPerPage = 6;
        const totalPhotoPages = Math.ceil(photos.length / photosPerPage);

        for (let pageIdx = 0; pageIdx < totalPhotoPages; pageIdx++) {
            const photoPage = pdfDoc.addPage([PW, PH]);
            page = photoPage; 
            
            let currentY = drawHeader(3 + pageIdx, 2 + totalPhotoPages);
            
            const gridSpacing = 10;
            const cols = 2;
            const rows = 3;
            const itemW = (contentWidth - (cols - 1) * gridSpacing) / cols;
            const itemH = (currentY - margin - (rows - 1) * gridSpacing) / rows;

            for (let i = 0; i < photosPerPage; i++) {
                const photoIdx = pageIdx * photosPerPage + i;
                if (photoIdx >= photos.length) {
                    // Draw empty boxes for empty spaces if needed, or just break
                    // User said "divide la hoja en 6 partes con marquitos", likely wants all 6 boxes drawn
                    const col = i % cols;
                    const row = Math.floor(i / cols);
                    const posX = margin + col * (itemW + gridSpacing);
                    const posY = currentY - (row + 1) * itemH - (row * gridSpacing);
                    
                    photoPage.drawRectangle({
                        x: posX,
                        y: posY,
                        width: itemW,
                        height: itemH,
                        borderWidth: 0.5,
                        borderColor: BK
                    });
                    continue;
                }

                const photoData = photos[photoIdx];
                const photoUrl = photoData.src || photoData.url || (typeof photoData === 'string' ? photoData : null);
                
                const col = i % cols;
                const row = Math.floor(i / cols);
                const posX = margin + col * (itemW + gridSpacing);
                const posY = currentY - (row + 1) * itemH - (row * gridSpacing);

                // Draw border for the space
                photoPage.drawRectangle({
                    x: posX,
                    y: posY,
                    width: itemW,
                    height: itemH,
                    borderWidth: 0.5,
                    borderColor: BK
                });

                if (!photoUrl) continue;

                try {
                    let imgBytes: ArrayBuffer;
                    if (photoUrl.startsWith('data:image')) {
                        const base64Data = photoUrl.split(',')[1];
                        const binaryString = window.atob(base64Data);
                        const bytes = new Uint8Array(binaryString.length);
                        for (let k = 0; k < binaryString.length; k++) {
                            bytes[k] = binaryString.charCodeAt(k);
                        }
                        imgBytes = bytes.buffer;
                    } else {
                        const imgResp = await fetch(photoUrl);
                        if (!imgResp.ok) continue;
                        imgBytes = await imgResp.arrayBuffer();
                    }

                    let img;
                    try {
                        img = await pdfDoc.embedJpg(imgBytes);
                    } catch (_) {
                        try {
                            img = await pdfDoc.embedPng(imgBytes);
                        } catch (__) {
                            continue;
                        }
                    }

                    const labelH = 15;
                    const descH = photoData.description ? 20 : 0;
                    const maxImgH = itemH - labelH - descH - 10;
                    const dims = img.scaleToFit(itemW - 10, maxImgH);
                    
                    photoPage.drawText(`FOTO ${photoIdx + 1}`, { 
                        x: posX + 5, 
                        y: posY + itemH - 12, 
                        size: 8, 
                        font: fontBold 
                    });

                    photoPage.drawImage(img, {
                        x: posX + (itemW - dims.width) / 2,
                        y: posY + descH + 5 + (maxImgH - dims.height) / 2,
                        width: dims.width,
                        height: dims.height
                    });

                    if (photoData.description) {
                        const desc = photoData.description.substring(0, 60);
                        photoPage.drawText(desc, { x: posX + 5, y: posY + 5, size: 6, font });
                    }
                } catch (pErr) {
                    console.error("Error embedding photo:", pErr);
                }
            }
        }
    }

    // Finalize
    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes as any], { type: 'application/pdf' });
};
