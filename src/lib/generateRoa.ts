import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { supabase } from './supabase';
import { formatDate, formatCurrency } from './utils';

const PW = 612; // 8.5"
const PH = 792; // 11"

const drawText = (p: any, txt: any, x: number, y: number, font: any, size = 8, center = false, right = false) => {
    if (txt === undefined || txt === null) return;
    const s = txt.toString()
        .replace(/[\r\n\t]/g, ' ')
        .replace(/[\x00-\x1F\x7F-\x9F]/g, "");
    
    const textWidth = font.widthOfTextAtSize(s, size);
    let finalX = x;
    if (center) finalX = x - (textWidth / 2);
    else if (right) finalX = x - textWidth;
    p.drawText(s, { x: finalX, y: PH - y, size, font, color: rgb(0, 0, 0) });
};

const drawLine = (p: any, x1: number, y1: number, x2: number, y2: number, thickness = 0.5) => {
    p.drawLine({ start: { x: x1, y: PH - y1 }, end: { x: x2, y: PH - y2 }, thickness, color: rgb(0, 0, 0) });
};

const drawRect = (p: any, x: number, y: number, w: number, h: number, fill = false, color = rgb(0.9, 0.9, 0.9)) => {
    if (fill) { p.drawRectangle({ x, y: PH - y - h, width: w, height: h, color }); }
    else { p.drawRectangle({ x, y: PH - y - h, width: w, height: h, borderColor: rgb(0, 0, 0), borderWidth: 0.5 }); }
};

export async function generateRoa(projectId: string, choId: string) {
    try {
        const { data: projData } = await supabase.from('projects').select('*').eq('id', projectId).single();
        if (!projData) throw new Error("Proyecto no encontrado");
        const { data: choData } = await supabase.from('chos').select('*').eq('id', choId).single();
        const { data: personnel } = await supabase.from('act_personnel').select('*').eq('project_id', projectId);
        const { data: contractItems } = await supabase.from('contract_items').select('item_num').eq('project_id', projectId);

        const personnelMap: Record<string, any> = {};
        personnel?.forEach(p => { personnelMap[p.role] = p; });

        const adminName = personnelMap["Administrador del Proyecto"]?.name || "";
        const adminPhone = personnelMap["Administrador del Proyecto"]?.phone_office || personnelMap["Administrador del Proyecto"]?.phone_mobile || "";
        const adminEmail = personnelMap["Administrador del Proyecto"]?.email || "";
        const supervisorName = personnelMap["Supervisor de Área"]?.name || personnelMap["Supervisor de Area"]?.name || personnelMap["Supervisor de Á rea"]?.name || personnelMap["Project Supervisor"]?.name || personnelMap["Project Manager"]?.name || projData.project_manager_name || "";

        const contractItemNums = new Set(contractItems?.map(ci => ci.item_num) || []);
        const allChoItems = Array.isArray(choData.items) ? choData.items : [];
        const contractChoItems = allChoItems.filter((it: any) => contractItemNums.has(it.item_num));
        const newChoItems = allChoItems.filter((it: any) => !contractItemNums.has(it.item_num));

        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        
        // Cargar logo del DOT
        let dotLogoImg: any = null;
        try {
            const logoBytes = await fetch('/dot_logo.png').then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.arrayBuffer();
            });
            dotLogoImg = await pdfDoc.embedPng(logoBytes);
        } catch (e) {
            console.warn("Logo DOT no disponible, usando logo alternativo:", e);
        }

        const form = pdfDoc.getForm();

        const ITEMS_PER_PAGE = 7; 
        const totalItemsCount = Math.max(contractChoItems.length, newChoItems.length, 1);
        const totalTablePages = Math.ceil(totalItemsCount / ITEMS_PER_PAGE);
        
        // Traducir justificación al inglés
        let justificationText = choData.justification || "";
        // Traducir justificación al inglés usando fragmentos (chunks) para textos largos
        const translateText = async (txt: string) => {
            if (!txt || !txt.trim()) return txt;
            
            // Dividir el texto en fragmentos de ~500 caracteres para evitar límites de la API
            const chunkSize = 500;
            const words = txt.split(/\s+/);
            const chunks: string[] = [];
            let currentChunk = "";

            for (const word of words) {
                if ((currentChunk + " " + word).length > chunkSize) {
                    chunks.push(currentChunk);
                    currentChunk = word;
                } else {
                    currentChunk += (currentChunk ? " " : "") + word;
                }
            }
            if (currentChunk) chunks.push(currentChunk);

            try {
                const translatedChunks = await Promise.all(chunks.map(async (chunk) => {
                    const encoded = encodeURIComponent(chunk);
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 10000);
                    const transRes = await fetch(`https://api.mymemory.translated.net/get?q=${encoded}&langpair=es|en`, {
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);
                    if (transRes.ok) {
                        const transData = await transRes.json();
                        if (transData?.responseStatus === 200 && transData?.responseData?.translatedText) {
                            return transData.responseData.translatedText;
                        }
                    }
                    return chunk; // Fallback al original si falla este chunk
                }));
                return translatedChunks.join(" ");
            } catch (e) {
                console.warn("Translation failed:", e);
                return txt;
            }
        };

        if (justificationText) {
            justificationText = await translateText(justificationText);
        }

        // Traducir descripciones de items
        const translatedContractItems = await Promise.all((contractChoItems || []).map(async (it: any) => ({
            ...it,
            description: await translateText(it.description)
        })));
        const translatedNewItems = await Promise.all((newChoItems || []).map(async (it: any) => ({
            ...it,
            description: await translateText(it.description)
        })));

        const justWords = justificationText.split(/\s+/).filter((w: string) => w.length > 0);
        const maxLineWidth = PW - 70;
        const lineHeight = 10;
        const boxMaxY = 145; 

        let testLine = "", testLineCount = 0;
        for (const w of justWords) {
            const testL = testLine + (testLine ? " " : "") + w;
            if (font.widthOfTextAtSize(testL, 8.5) > maxLineWidth) {
                testLineCount++;
                testLine = w;
            } else { testLine = testL; }
        }
        if (testLine) testLineCount++;
        const linesNeeded = testLineCount;
        const linesAvailable = Math.floor(boxMaxY / lineHeight);
        const needsExtraPage = linesNeeded > linesAvailable;

        // Total de páginas
        const totalPages = (needsExtraPage ? 2 : 1) + totalTablePages;

        // ─────────── drawHeader ───────────
        const drawHeader = (page: any, pageNum: number) => {
            // Logo DOT en la esquina superior izquierda
            if (dotLogoImg) {
                const logoDims = dotLogoImg.scaleToFit(50, 65);
                page.drawImage(dotLogoImg, {
                    x: 12,
                    y: PH - 72,
                    width: logoDims.width,
                    height: logoDims.height,
                });
                // No se dibuja texto adicional porque el logo ya incluye "U.S. Department of Transportation"
            } else {
                // Logo FHWA como fallback (círculos)
                const cx = 32, cy = PH - 42;
                const blue = rgb(0, 0.33, 0.65);
                const white = rgb(1, 1, 1);
                page.drawCircle({ x: cx, y: cy, radius: 14, color: blue });
                page.drawCircle({ x: cx, y: cy + 5, radius: 5, color: white });
                page.drawCircle({ x: cx - 4.5, y: cy - 3, radius: 5, color: white });
                page.drawCircle({ x: cx + 4.5, y: cy - 3, radius: 5, color: white });
                drawText(page, "U.S. Department", 15, 58, font, 5.5);
                drawText(page, "of Transportation", 15, 64, font, 5);
            }

            drawText(page, "RECORD OF AUTHORIZATION TO PROCEED WITH CONTRACT REVISION", PW / 2, 22, fontBold, 11, true);
            drawText(page, "FAX: 787-766-5924", PW / 2, 40, fontBold, 10, true);
            
            drawText(page, "Page", PW - 130, 60, fontBold, 9);
            drawLine(page, PW - 105, 62, PW - 70, 62, 0.8);
            drawText(page, pageNum.toString(), PW - 87, 60, font, 9, true);
            drawText(page, "of", PW - 60, 60, fontBold, 9);
            drawLine(page, PW - 50, 62, PW - 20, 62, 0.8);
            drawText(page, totalPages.toString(), PW - 35, 60, font, 9, true);

            const boxY = 75, boxH = 45;
            drawLine(page, 20, boxY, PW - 20, boxY, 1.2);
            drawLine(page, 20, boxY + boxH, PW - 20, boxY + boxH, 1.2);
            drawLine(page, 20, boxY, 20, boxY + boxH, 1.2);
            drawLine(page, PW - 20, boxY, PW - 20, boxY + boxH, 1.2);
            drawLine(page, 345, boxY, 345, boxY + boxH, 0.8);
            drawLine(page, 510, boxY, 510, boxY + boxH, 0.8);

            drawText(page, "Federal Project No. and Description:", 23, boxY + 12, font, 7.5);
            drawText(page, `${projData.num_federal || ""} - ${projData.name || ""}`, 23, boxY + 28, font, 8);
            drawText(page, "STATE NUMBER:", 348, boxY + 12, font, 7.5);
            drawText(page, projData.num_act || "", 348, boxY + 28, font, 9);
            drawText(page, "STATE", 515, boxY + 12, font, 7.5);
            drawText(page, "PR", 515, boxY + 28, font, 9);
            
            return boxY + boxH + 10;
        };

        // ─────────── drawSignatures ───────────
        const drawSignatures = (page: any, y: number, pNum: number) => {
            const halfW = (PW - 40) / 2;
            const sigBoxH = 140; 
            drawLine(page, 20, y, PW - 20, y, 1.2);
            drawLine(page, 20, y, 20, y + sigBoxH, 1.2);
            drawLine(page, PW - 20, y, PW - 20, y + sigBoxH, 1.2);
            drawLine(page, 20, y + sigBoxH, PW - 20, y + sigBoxH, 1.2);
            drawLine(page, 20, y + 60, PW - 20, y + 60, 0.8);
            drawLine(page, 20 + halfW, y, 20 + halfW, y + 60, 0.8);

            const ds = (l: string, s: string, n: string, x: number, yy: number, side: string) => {
                drawText(page, l, x + 5, yy + 10, fontBold, 7.5);
                drawText(page, s, x + 5, yy + 20, font, 6.5);
                drawText(page, "SIGNATURE", x + 5, yy + 33, font, 6);
                drawText(page, "DATE", x + halfW - 40, yy + 33, font, 6, true);
                drawLine(page, x + 5, yy + 45, x + halfW - 55, yy + 45, 0.4);
                drawLine(page, x + halfW - 50, yy + 45, x + halfW - 5, yy + 45, 0.4);
                // Editable text field for PRINT NAME
                drawText(page, "PRINT NAME", x + 5, yy + 57, font, 6);
                try {
                    const nameField = form.createTextField(`printname_${side}_p${pNum}`);
                    nameField.addToPage(page, {
                        x: x + 60,
                        y: PH - yy - 57,
                        width: halfW - 70,
                        height: 12,
                        borderWidth: 0,
                    });
                    if (n) nameField.setText(n);
                } catch(e) {}
            };

            ds("SUBMITTED BY", "RESIDENT ENGINEER / PROJECT ADMINISTRATOR", adminName, 20, y, "left");
            ds("RECOMMENDED BY", "PROJECT SUPERVISOR / PROJECT MANAGER", supervisorName, 20 + halfW, y, "right");

            const appY = y + 60;
            drawText(page, "APPROVAL", PW / 2, appY + 10, fontBold, 9, true);
            const createCb = (label: string, x: number, yy: number, nm: string) => {
                const cb = form.createCheckBox(`${nm}_p${pNum}`);
                cb.addToPage(page, { x, y: PH - yy - 10, width: 9, height: 9 });
                drawText(page, label, x + 12, yy + 8, fontBold, 7.5);
            };
            createCb("PROJECT SUPERVISOR", 150, appY + 20, "app_s");
            createCb("DISTRICT DIRECTOR", 280, appY + 20, "app_di");
            createCb("DIVISION OFFICE", 400, appY + 20, "app_dv");

            drawText(page, "SIGNATURE", 25, appY + 42, font, 6.5);
            drawLine(page, 25, appY + 55, PW - 180, appY + 55, 0.4);
            drawText(page, "DATE", PW - 170, appY + 42, font, 6.5);
            drawLine(page, PW - 170, appY + 55, PW - 25, appY + 55, 0.4);
            // Editable text field for PRINT NAME in approval section
            drawText(page, "PRINT NAME", 25, appY + 70, font, 6.5);
            try {
                const approvalNameField = form.createTextField(`printname_approval_p${pNum}`);
                approvalNameField.addToPage(page, {
                    x: 90,
                    y: PH - appY - 78,
                    width: PW - 280,
                    height: 12,
                    borderWidth: 0,
                });
            } catch(e) {}
            drawLine(page, 25, appY + 76, PW - 180, appY + 76, 0.4);
            drawText(page, "MM / DD / YYYY", PW - 100, appY + 70, font, 7);
        };

        // ─────────── Función para dibujar contenido de la página 1 ───────────
        const drawPage1Content = (page: any, pageNum: number, justWordsToDraw: string[], allWords: string[], isOverflow: boolean) => {
            let yPos = drawHeader(page, pageNum);

            // TYPE REVISION section
            drawLine(page, 20, yPos, PW - 20, yPos, 0.8);
            drawText(page, "TYPE REVISION", 23, yPos + 10, fontBold, 8);
            const drCb = (l: string, x: number, y: number, nm: string) => {
                try {
                    const cb = form.createCheckBox(`${nm}_p${pageNum}`);
                    cb.addToPage(page, { x, y: PH - y - 10, width: 9, height: 9 });
                } catch(e) {}
                drawText(page, l, x + 12, y + 8, font, 7.5);
            };
            drCb("CHANGE ORDER", 30, yPos + 18, "tr_cho");
            drCb("SUPPLEMENTAL AGREEMENT", 160, yPos + 18, "tr_sup");
            drCb("TIME EXTENSION", 380, yPos + 18, "tr_tim");
            // SPECIFICATION y CHANGE en dos líneas separadas
            drCb("SPECIFICATION", 510, yPos + 14, "tr_spe");
            drawText(page, "CHANGE", 523, yPos + 28, font, 7.5);
            drCb("OTHER:", 30, yPos + 32, "tr_oth");
            drawLine(page, 80, yPos + 40, 150, yPos + 40, 0.4);
            drCb("DESIGN CHANGE", 160, yPos + 32, "tr_des");
            drawLine(page, 20, yPos + 45, PW - 20, yPos + 45, 0.8);

            yPos += 45;
            // REQUESTED BY con nombre del administrador del proyecto
            drawText(page, "REQUESTED BY:", 23, yPos + 12, fontBold, 7.5);
            drawText(page, adminName, 97, yPos + 12, font, 8);
            drawLine(page, 95, yPos + 22, PW - 140, yPos + 22, 0.4);
            drawText(page, "DATE:", PW - 135, yPos + 12, fontBold, 7.5);
            // Fecha del ROA
            const roaDate = choData.cho_date ? formatDate(choData.cho_date) : "";
            drawText(page, roaDate, PW - 100, yPos + 12, font, 8);
            drawLine(page, PW - 100, yPos + 22, PW - 25, yPos + 22, 0.4);
            drawLine(page, 20, yPos + 27, PW - 20, yPos + 27, 1);

            yPos += 27;
            drawText(page, "NATURE AND REASON FOR PROPOSED REVISION (if additional space is required, use reverse side)", 23, yPos + 10, fontBold, 7.5);
            drawText(page, "Please, include the information related to the Project Administrator/Resident Engineer or the person requesting the change:", 35, yPos + 22, font, 9);
            yPos += 30;

            // Título con número de CHO
            const docLetter = choData.amendment_letter || choData.cho_num || "";
            drawText(page, `Contract Modification No. ${docLetter} - CHANGE CONCEPT DESCRIPTION`, 23, yPos + 10, fontBold, 10.5);
            drawLine(page, 23, yPos + 12, PW - 23, yPos + 12, 1.2);
            drawRect(page, 20, yPos + 15, PW - 40, 155);

            // Dibujar texto de justificación dentro del rect
            let currentLine = "", curLineY = yPos + 28;
            const boxBottom = yPos + 155;
            const remainingWords: string[] = [];

            for (const w of justWordsToDraw) {
                if (curLineY > boxBottom) {
                    remainingWords.push(w);
                    continue;
                }
                const testL = currentLine + (currentLine ? " " : "") + w;
                if (font.widthOfTextAtSize(testL, 8.5) > maxLineWidth) {
                    if (curLineY + lineHeight > boxBottom) {
                        remainingWords.push(w);
                    } else {
                        drawText(page, currentLine, 35, curLineY, font, 8.5);
                        currentLine = w;
                        curLineY += lineHeight;
                    }
                } else { currentLine = testL; }
            }
            if (currentLine && curLineY <= boxBottom) {
                drawText(page, currentLine, 35, curLineY, font, 8.5);
            } else if (currentLine) {
                remainingWords.unshift(currentLine);
            }

            yPos += 170;
            drawLine(page, 20, yPos, PW - 20, yPos, 1.2);
            drawLine(page, 300, yPos, 300, yPos + 50, 0.8);
            drawText(page, "ESTIMATED", 25, yPos + 10, fontBold, 7);
            const drCbEst = (l: string, x: number, y: number, nm: string) => {
                try {
                    const cb = form.createCheckBox(`${nm}_p${pageNum}`);
                    cb.addToPage(page, { x, y: PH - y - 10, width: 9, height: 9 });
                } catch(e) {}
                drawText(page, l, x + 12, y + 8, font, 7.5);
            };
            drCbEst("INC", 100, yPos + 6, "e1_i");
            drCbEst("DEC", 140, yPos + 6, "e1_d");
            drawText(page, "IN COST: $", 185, yPos + 13, fontBold, 7.5);
            drawLine(page, 240, yPos + 21, 285, yPos + 21, 0.4);
            drCbEst("INC", 100, yPos + 30, "e2_i");
            drCbEst("DEC", 140, yPos + 30, "e2_d");
            drawText(page, "IN TIME:", 185, yPos + 38, fontBold, 7.5);
            drawLine(page, 230, yPos + 46, 260, yPos + 46, 0.4);
            drawText(page, "days", 265, yPos + 38, font, 7);
            drawText(page, "METHOD OF PAYMENT:", 305, yPos + 10, fontBold, 7);
            drCbEst("FORCE ACCOUNT", 310, yPos + 15, "mpf");
            drCbEst("NEGOTIATED PRICE", 420, yPos + 15, "mpn");
            drCbEst("LUMP SUM", 530, yPos + 15, "mpl");
            drCbEst("UNIT BID PRICES", 310, yPos + 32, "mpu");
            drCbEst("OTHER:", 420, yPos + 32, "mpo");
            drawLine(page, 465, yPos + 40, 580, yPos + 40, 0.4);

            yPos += 55;
            drawText(page, "THE WORK COVERED BY THE PROPOSED REVISION AS DESCRIBED ABOVE IS HEREBY AUTHORIZED SUBJECT TO THE CONDITIONS MARKED BELOW:", 20, yPos + 10, fontBold, 6.8);
            const cy1 = yPos + 25;
            const drCbCond = (l: string, x: number, y: number, nm: string) => {
                try {
                    const cb = form.createCheckBox(`${nm}_p${pageNum}`);
                    cb.addToPage(page, { x, y: PH - y - 10, width: 9, height: 9 });
                } catch(e) {}
                drawText(page, l, x + 12, y + 8, font, 7.5);
            };
            drCbCond("EVALUATION OF COST DATA", 35, cy1, "cc1");
            drCbCond("LIMITATIONS EXTENT OF FEDERAL PARTICIPATION", 35, cy1 + 12, "cc2");
            drCbCond("DETERMINATION OF SATISFACTORY ADJUSTMENT IN TIME", 35, cy1 + 24, "cc3");
            drCbCond("ADEQUATE SUBMITTAL OF WRITTEN SUPPORTING DATA", 35, cy1 + 36, "cc4");
            drCbCond("AUTHORIZED WITHOUT FEDERAL PARTICIPATION", 330, cy1, "cc5");
            drCbCond("OTHER:", 330, cy1 + 12, "cc6");
            drawLine(page, 380, cy1 + 20, 500, cy1 + 20, 0.4);
            drCbCond("NONE", 330, cy1 + 24, "cc7");

            drawSignatures(page, 620, pageNum);

            return remainingWords;
        };

        // ─────────── PAGE 1 ───────────
        const page1 = pdfDoc.addPage([PW, PH]);
        const remainingWords = drawPage1Content(page1, 1, justWords, justWords, false);

        // ─────────── PAGE 2 (overflow de justificación) si es necesario ───────────
        let nextTablePageNum = 2;
        if (needsExtraPage && remainingWords.length > 0) {
            const page2 = pdfDoc.addPage([PW, PH]);
            drawPage1Content(page2, 2, remainingWords, justWords, true);
            nextTablePageNum = 3;
        }

        // ─────────── PÁGINAS DE TABLA ───────────
        for (let pIdx = 0; pIdx < totalTablePages; pIdx++) {
            const pageTable = pdfDoc.addPage([PW, PH]);
            const pNum = nextTablePageNum + pIdx;
            let tyPos = drawHeader(pageTable, pNum);

            drawText(pageTable, "NATURE AND REASON FOR PROPOSED REVISION (if additional space is required, use reverse side)", 23, tyPos + 10, fontBold, 7.5);
            drawText(pageTable, "Summary of Change Order Items:", 30, tyPos + 28, fontBold, 9.5);
            tyPos += 45; 
            drawLine(pageTable, 20, tyPos, PW - 20, tyPos, 1);

            const drawSection = (title: string, itemsList: any[], startY: number) => {
                const titleRowH = 20; // Extra height so lines don't overlap title text
                const headerRowH = 27;
                const cols = [20, 50, 90, 240, 330, 370, 410, 470, 545, PW - 20];
                const hdrs = ["Item", "Spec Code", "Description", "Additional Description", "Unit", "QTY", "Unit\nPrice", "Amount", "% Federal\nPartic."];

                // --- Title row (gray background) ---
                // Top border of the title
                drawLine(pageTable, 20, startY, PW - 20, startY, 0.8);
                drawRect(pageTable, 20, startY, PW - 40, titleRowH, true, rgb(0.9, 0.9, 0.9));
                // Left and right borders of the title
                drawLine(pageTable, 20, startY, 20, startY + titleRowH, 0.8);
                drawLine(pageTable, PW - 20, startY, PW - 20, startY + titleRowH, 0.8);
                // Bottom border of the title (separates title from headers)
                drawLine(pageTable, 20, startY + titleRowH, PW - 20, startY + titleRowH, 0.8);
                // Title text (centered vertically within the title row)
                drawText(pageTable, title, 25, startY + 14, fontBold, 9);

                // --- Header row ---
                const hdrTop = startY + titleRowH;
                const hdrBottom = hdrTop + headerRowH;
                // All vertical lines for header columns
                cols.forEach(x => drawLine(pageTable, x, hdrTop, x, hdrBottom, 0.5));
                // Header text
                hdrs.forEach((h, i) => {
                    const cx = (cols[i]+cols[i+1])/2;
                    const lines = h.split("\n");
                    lines.forEach((line, j) => drawText(pageTable, line, cx, hdrTop + 10 + (j*8), fontBold, 6.5, true));
                });
                // Bottom border of the header
                drawLine(pageTable, 20, hdrBottom, PW - 20, hdrBottom, 0.8);
                
                // --- Data rows ---
                let curRowY = hdrBottom;
                const pageItems = itemsList.slice(pIdx * ITEMS_PER_PAGE, (pIdx + 1) * ITEMS_PER_PAGE);
                for (let i = 0; i < ITEMS_PER_PAGE; i++) {
                    const it = pageItems[i];
                    // Vertical lines for each data row
                    cols.forEach(x => drawLine(pageTable, x, curRowY, x, curRowY + 16, 0.5));
                    if (it) {
                        const q = parseFloat(it.quantity || it.proposed_change) || 0;
                        const up = parseFloat(it.unit_price) || 0;
                        drawText(pageTable, it.item_num || "", (cols[0]+cols[1])/2, curRowY + 11, font, 7, true);
                        drawText(pageTable, it.specification || "", (cols[1]+cols[2])/2, curRowY + 11, font, 7, true);
                        drawText(pageTable, (it.description || "").substring(0, 35), cols[2] + 4, curRowY + 11, font, 6.5);
                        drawText(pageTable, it.unit || "", (cols[4]+cols[5])/2, curRowY + 11, font, 7, true);
                        drawText(pageTable, q.toString(), cols[6] - 4, curRowY + 11, font, 7, false, true);
                        drawText(pageTable, formatCurrency(up), cols[7] - 4, curRowY + 11, font, 7, false, true);
                        drawText(pageTable, formatCurrency(q*up), cols[8] - 4, curRowY + 11, font, 7, false, true);
                    }
                    // Bottom border of each row
                    drawLine(pageTable, 20, curRowY + 16, PW - 20, curRowY + 16, 0.5);
                    curRowY += 16;
                }
                // Sub-total row
                const sectionSub = pageItems.reduce((acc: number, it: any) => acc + (parseFloat(it.quantity || it.proposed_change) || 0) * (parseFloat(it.unit_price) || 0), 0);
                drawText(pageTable, `Sub-total ${title} (Page ${pNum})`, 410, curRowY + 13, fontBold, 8, false, true);
                drawText(pageTable, formatCurrency(sectionSub), 545, curRowY + 13, fontBold, 8, false, true);
                drawLine(pageTable, 20, curRowY + 18, PW - 20, curRowY + 18, 0.8);
                return curRowY + 25;
            };

            tyPos = drawSection("Contract Items", translatedContractItems, tyPos);
            tyPos = drawSection("New Items (Extra Work)", translatedNewItems, tyPos);
            
            if (pIdx === totalTablePages - 1) {
                const grand = allChoItems.reduce((acc: number, it: any) => acc + (parseFloat(it.quantity || it.proposed_change) || 0) * (parseFloat(it.unit_price) || 0), 0);
                drawText(pageTable, "Total - Change Order Amount", 470, tyPos + 5, fontBold, 10, false, true);
                drawText(pageTable, formatCurrency(grand), 545, tyPos + 5, fontBold, 10, false, true);
            }

            drawSignatures(pageTable, 620, pNum);
        }

        const pdfBytes = await pdfDoc.save();
        return new Blob([pdfBytes as any], { type: 'application/pdf' });
    } catch (err: any) { console.error("Error generating ROA:", err); throw err; }
}
