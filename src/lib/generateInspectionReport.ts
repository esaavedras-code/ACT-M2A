
import { supabase } from './supabase';
import { formatDate as utilsFormatDate } from './utils';

export const generateInspectionReport = async (projectId: string, logId: string) => {
    // 1. Fetch Data
    const { data: log } = await supabase.from('daily_logs').select('*').eq('id', logId).single();
    if (!log) throw new Error('Log no encontrado');

    const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single();
    if (!project) throw new Error('Proyecto no encontrado');

    const { data: contractor } = await supabase.from('contractors').select('*').eq('project_id', projectId).single();

    // 2. Setup PDF
    const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const BK = rgb(0, 0, 0);
    const LIGHT_GRAY = rgb(0.9, 0.9, 0.9);

    // Letter size: 612 x 792
    const PW = 612, PH = 792;
    const margin = 30;
    const contentWidth = PW - (margin * 2);

    let page = pdfDoc.addPage([PW, PH]);
    let y = PH - margin;

    // Helpers
    const drawCenteredText = (txt: string, yPos: number, size = 10, bld = false) => {
        const f = bld ? fontBold : font;
        const width = f.widthOfTextAtSize(txt, size);
        page.drawText(txt, { x: (PW - width) / 2, y: yPos, size, font: f, color: BK });
    };

    const drawBox = (x: number, yPos: number, width: number, height: number, label?: string, value?: string, fontSizeLabel = 6, fontSizeValue = 8, boldValue = false) => {
        // Draw opaque white background to prevent grid lines from showing through
        page.drawRectangle({ 
            x, 
            y: yPos - height, 
            width, 
            height, 
            borderWidth: 0.5, 
            borderColor: BK,
            color: rgb(1, 1, 1) // Opaque white
        });
        if (label) {
            page.drawText(label, { x: x + 3, y: yPos - 8, size: fontSizeLabel, font: fontBold });
        }
        if (value) {
            const f = boldValue ? fontBold : font;
            const lines = value.toString().split('\n');
            lines.forEach((line, idx) => {
                const textY = yPos - height + 4 + (lines.length - 1 - idx) * (fontSizeValue + 2);
                // Ensure text doesn't overlap the label at the top
                if (textY < yPos - 10) {
                    // Truncate if too long for the box width (approximate)
                    const maxChars = Math.floor((width - 6) / (fontSizeValue * 0.5));
                    const truncated = line.length > maxChars ? line.substring(0, maxChars - 3) + "..." : line;
                    page.drawText(truncated, { x: x + 3, y: textY, size: fontSizeValue, font: f });
                }
            });
        }
    };

    const drawHeader = (pageNum: number, totalPages: number) => {
        let currentY = PH - margin;
        
        // ACT-96 Label top right (based on new reference photo)
        const act96Txt = 'ACT-96';
        const revTxt = '(Rev. 2/10)';
        const act96Width = fontBold.widthOfTextAtSize(act96Txt, 11);
        const revWidth = fontBold.widthOfTextAtSize(revTxt, 11);
        page.drawText(act96Txt, { x: PW - margin - act96Width, y: PH - 15, size: 11, font: fontBold });
        page.drawText(revTxt, { x: PW - margin - revWidth, y: PH - 28, size: 11, font: fontBold });

        drawCenteredText('Gobierno de Puerto Rico', currentY, 8);
        currentY -= 10;
        drawCenteredText('Departamento de Transportación y Obras Públicas', currentY, 8);
        currentY -= 10;
        drawCenteredText('Autoridad de Carreteras y Transportación', currentY, 8, true);
        currentY -= 20;
        drawCenteredText('INFORME DIARIO DE INSPECCIÓN', currentY, 11, true);
        
        page.drawText(`Página ${pageNum} DE ${totalPages}`, { x: PW - margin - 70, y: currentY, size: 7, font });

        currentY -= 20;
        return currentY;
    };

    // --- PHOTO PAGES (4 photos per page) ---
    const photos = log.photos_v2_data || [];
    const photosPerPage = 4;
    const totalPhotoPages = photos.length > 0 ? Math.ceil(photos.length / photosPerPage) : 0;
    const totalPagesCount = 2 + totalPhotoPages;

    // --- Page 1 Rendering ---
    y = drawHeader(1, totalPagesCount);
    
    // ... rest of page 1 code below ...
    const colLeftW = contentWidth * 0.65;
    const colRightW = contentWidth * 0.35;
    const startY = y;

    // Left Column
    drawBox(margin, y, colLeftW, 25, "1. NÚM. DE PROYECTO:", project.num_act || 'N/A');
    y -= 25;
    drawBox(margin, y, colLeftW, 35, "2. NOMBRE DE PROYECTO:", project.name || 'N/A');
    y -= 35;
    drawBox(margin, y, colLeftW, 25, "3. MUNICIPIO:", Array.isArray(project.municipios) ? project.municipios.join(', ') : (project.municipios || 'N/A'));
    y -= 25;
    drawBox(margin, y, colLeftW, 35, "4. CONTRATISTA Y/O SUBCONTRATISTA:", contractor?.name || 'N/A');
    y -= 35;
    drawBox(margin, y, colLeftW, 20, "12. HORARIO DE TRABAJO:", "         A         "); 
    
    // Right Column
    let ry = startY;
    drawBox(margin + colLeftW, ry, colRightW, 20, "5. FECHA:", utilsFormatDate(log.log_date));
    ry -= 20;
    
    const dayLabels = ['L', 'M', 'W', 'J', 'V', 'S', 'D'];
    const logDate = new Date(log.log_date);
    const dayOfWeek = logDate.getUTCDay(); 
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

    drawBox(margin + colLeftW, ry, colRightW, 20, "7. PÁGINA NO.", " 1 "); 
    ry -= 20;
    
    drawBox(margin + colLeftW, ry, colRightW, 20, "8. NÚMERO DE CONTROL:", ""); 
    ry -= 20;

    const weather = log.weather_data || {};
    const weatherCond = (weather.condition || '').replace(/\(automático\)/gi, '').trim();
    drawBox(margin + colLeftW, ry, colRightW * 0.5, 20, "9. CLIMA", `AM: ${weatherCond}`);
    drawBox(margin + colLeftW + (colRightW * 0.5), ry, colRightW * 0.5, 20, "", `PM: N/A`);
    ry -= 20;

    drawBox(margin + colLeftW, ry, colRightW * 0.5, 20, "10. TIEMPO PERDIDO", "");
    drawBox(margin + colLeftW + (colRightW * 0.5), ry, colRightW * 0.5, 20, "11. RAZONES", "");
    ry -= 20; // account for the height of fields 10/11
    
    // Use the lowest point (smallest Y) of both columns to avoid overlap
    const leftColBottom = y - 20; // y is at top of field 12, which has height 20
    const rightColBottom = ry;
    y = Math.min(leftColBottom, rightColBottom) - 10;

    // --- Section 13-16: TRABAJO EJECUTADO ---
    drawBox(margin, y, contentWidth, 12, "TRABAJO EJECUTADO", "", 7);
    y -= 12;
    
    const tableHeaderH = 15;
    const colW = [60, 100, 220, 172];
    const colLabels = ["13", "14", "15", "16"];
    const colHeaders = ["NÚMERO IDA", "INSPECTOR", "ACTIVIDAD", "CONTRATISTA / SUB / AGENCIAS"];
    
    let curX = margin;
    colHeaders.forEach((h, idx) => {
        page.drawRectangle({ x: curX, y: y - tableHeaderH, width: colW[idx], height: tableHeaderH, borderWidth: 0.5, borderColor: BK });
        page.drawText(colLabels[idx], { x: curX + 2, y: y - 6, size: 5, font });
        page.drawText(h, { x: curX + 2, y: y - 13, size: 6, font: fontBold });
        curX += colW[idx];
    });
    y -= tableHeaderH;

    const rowH = 15;
    const inspections = log.inspections_data || [];
    for (let i = 0; i < 10; i++) { 
        const insp = inspections[i] || {};
        curX = margin;
        colW.forEach((w, idx) => {
            page.drawRectangle({ x: curX, y: y - rowH, width: w, height: rowH, borderWidth: 0.3, borderColor: BK });
            let val = '';
            if (idx === 0) val = "-";
            if (idx === 1) val = log.inspector_name || '';
            if (idx === 2) val = (insp.comentarios || insp.description || 'N/A');
            if (idx === 3) val = insp.entidad || contractor?.name || 'N/A';
            
            if (val) page.drawText(val, { x: curX + 2, y: y - rowH + 4, size: 7, font });
            curX += w;
        });
        y -= rowH;
    }
    y -= 10;

    // --- Section 17-19 ---
    drawBox(margin, y, contentWidth, 40, "17. VISITAS:", (log.visitors_v2_data || []).map((v:any) => `${v.visitante} (${v.horario})`).join(', '));
    y -= 40;
    drawBox(margin, y, contentWidth, 40, "18. REUNIONES:", "");
    y -= 40;
    drawBox(margin, y, contentWidth, 60, "19. LABOR REALIZADA (LLAMADAS, CORREOS, ESCRITOS, VISITAS, ETC):", "");
    y -= 65;

    // --- Page 2 Rendering ---
    page = pdfDoc.addPage([PW, PH]);
    y = drawHeader(2, totalPagesCount);

    drawBox(margin, y, contentWidth, 100, "20. ASUNTOS DISCUTIDOS CON EL CONTRATISTA, DISEÑADOR, ACT, COLINDANTES, OTRAS AGENCIAS, ETC.:", log.notes_data?.comments || 'N/A');
    y -= 110;

    // --- Equipo & Empleados ---
    const halfWidth = contentWidth / 2 - 5;
    let tableY = y;
    
    // Equipo
    page.drawText("EQUIPO:", { x: margin, y: tableY, size: 8, font: fontBold });
    tableY -= 10;
    const equip = log.equipment_v2_data || [];
    for (let i = 0; i < 15; i++) {
        const e = equip[i] || {};
        page.drawRectangle({ x: margin, y: tableY - 12, width: halfWidth, height: 12, borderWidth: 0.3, borderColor: BK });
        if (e.tipo) page.drawText(`${e.tipo} - ${e.descripcion || ''}`, { x: margin + 2, y: tableY - 9, size: 7, font });
        tableY -= 12;
    }

    // Empleados
    tableY = y;
    page.drawText("EMPLEADOS:", { x: margin + halfWidth + 10, y: tableY, size: 8, font: fontBold });
    tableY -= 10;
    const pers = log.personnel_v2_data || [];
    for (let i = 0; i < 15; i++) {
        const p = pers[i] || {};
        page.drawRectangle({ x: margin + halfWidth + 10, y: tableY - 12, width: halfWidth, height: 12, borderWidth: 0.3, borderColor: BK });
        if (p.nombres) page.drawText(`${p.nombres} (${p.clasificacion || ''})`, { x: margin + halfWidth + 12, y: tableY - 9, size: 7, font });
        tableY -= 12;
    }
    
    y = tableY - 10;

    drawBox(margin, y, contentWidth, 30, "21. OTRAS POSIBLES ACTIVIDADES:", "");
    y -= 35;
    drawBox(margin, y, contentWidth, 40, "22. ASPECTOS DE SEGURIDAD:", (log.safety_violations_data || []).map((s:any) => s.infracción).join('. '));
    y -= 45;
    drawBox(margin, y, contentWidth, 50, "23. OBSERVACIONES:", "");
    y -= 60;

    // Signatures
    drawBox(margin, y, contentWidth * 0.4, 25, "24. NOMBRE DEL ADMINISTRADOR:", project.admin_name || log.inspector_name || '');
    drawBox(margin + contentWidth * 0.4, y, contentWidth * 0.3, 25, "25. PUESTO:", "INSPECTOR");
    drawBox(margin + contentWidth * 0.7, y, contentWidth * 0.3, 25, "26. FIRMA:", "");

    // --- PHOTO PAGES (6 photos per page) ---
    if (photos.length > 0) {
        const photosPerPage = 6;
        const totalPhotoPages = Math.ceil(photos.length / photosPerPage);
        const tpc = 2 + totalPhotoPages;

        for (let pageIdx = 0; pageIdx < totalPhotoPages; pageIdx++) {
            const photoPage = pdfDoc.addPage([PW, PH]);
            page = photoPage;
            
            let currentY = drawHeader(3 + pageIdx, tpc);
            
            const gridSpacing = 10;
            const cols = 2;
            const rows = 3;
            const itemW = (contentWidth - (cols - 1) * gridSpacing) / cols;
            const itemH = (currentY - margin - (rows - 1) * gridSpacing) / rows;

            for (let i = 0; i < photosPerPage; i++) {
                const photoIdx = pageIdx * photosPerPage + i;
                
                const colIdx = i % cols;
                const rowIdx = Math.floor(i / cols);
                const posX = margin + colIdx * (itemW + gridSpacing);
                const posY = currentY - (rowIdx + 1) * itemH - (rowIdx * gridSpacing);

                // Draw border for the space
                photoPage.drawRectangle({
                    x: posX,
                    y: posY,
                    width: itemW,
                    height: itemH,
                    borderWidth: 0.5,
                    borderColor: BK
                });

                if (photoIdx >= photos.length) continue;

                const photoData = photos[photoIdx];
                const photoUrl = photoData.src || photoData.url || (typeof photoData === 'string' ? photoData : null);
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

    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes as any], { type: 'application/pdf' });
};

