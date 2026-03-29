import { supabase } from "./supabase";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatCurrency as formatC, roundedAmt, formatDate as utilsFormatDate, getLocalStorageItem } from "./utils";
import * as XLSX from "xlsx";
import { generateCCMLReport } from "./generateCCMLReport";

export const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);
};

export const formatDate = (dateStr: string) => {
    return utilsFormatDate(dateStr);
};

export const fetchAllReportData = async (projectId: string) => {
    try {
        const { data: project, error: pErr } = await supabase.from('projects').select('*').eq('id', projectId).single();
        if (pErr) console.error("Error fetching project:", pErr);
        
        const { data: items, error: iErr } = await supabase.from('contract_items').select('*').eq('project_id', projectId).order('item_num');
        if (iErr) console.error("Error fetching items:", iErr);
        
        const { data: chos, error: cErr } = await supabase.from('chos').select('*').eq('project_id', projectId).order('cho_num');
        if (cErr) console.error("Error fetching chos:", cErr);
        
        const { data: certs, error: certErr } = await supabase.from('payment_certifications').select('*').eq('project_id', projectId).order('cert_num');
        if (certErr) console.error("Error fetching certs:", certErr);
        
        const { data: mfgCerts, error: mErr } = await supabase.from('manufacturing_certificates').select('*').eq('project_id', projectId);
        if (mErr) console.error("Error fetching mfgCerts:", mErr);
        
        const { data: agreementFunds, error: aErr } = await supabase.from('project_agreement_funds').select('*').eq('project_id', projectId).order('created_at');
        if (aErr) console.error("Error fetching agreementFunds:", aErr);

        if (!project) {
            alert("Error: No se encontró el proyecto. Verifique sus permisos o la conexión.");
        }

        return { project, items, chos, certs, mfgCerts, agreementFunds };
    } catch (e) {
        console.error("Exception in fetchAllReportData:", e);
        alert("Excepción al cargar datos: " + (e as Error).message);
        return { project: null, items: null, chos: null, certs: null, mfgCerts: null, agreementFunds: null };
    }
};

export const createPdfBlob = async (
    title: string,
    data: any[][],
    projectInfo?: { name: string, num_act: string } | null,
    customColWidths?: number[],
    orientation: 'portrait' | 'landscape' = 'portrait',
    cutOffDate?: string | Date
) => {
    const pdfDoc = await PDFDocument.create();
    const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const timesRomanBoldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

    // Letter size: Portrait [612, 792], Landscape [792, 612]
    const pageSize: [number, number] = orientation === 'landscape' ? [792, 612] : [612, 792];
    let page = pdfDoc.addPage(pageSize);
    let { width, height } = page.getSize();
    let y = height - 50;

    const marginX = 30;
    const contentWidth = width - (marginX * 2);

    // Helper to wrap text
    const splitTextIntoLines = (text: string, maxWidth: number, font: any, size: number) => {
        const lines: string[] = [];

        // Handle explicit newlines first
        const cleanText = (text?.toString() || '').replace(/\t/g, '    ');
        const explicitLines = cleanText.split(/\r?\n/);

        explicitLines.forEach(explicitLine => {
            const words = explicitLine.split(' ');
            let currentLine = '';

            for (let i = 0; i < words.length; i++) {
                let word = words[i];

                // Strip unsupported control characters that fail WinAnsi encoding
                word = word.replace(/[\x00-\x09\x0B-\x1F]/g, '');

                // If the word itself is wider than the column, we must break it down
                if (word.length > 0 && font.widthOfTextAtSize(word, size) > maxWidth - 10) {
                    if (currentLine) {
                        lines.push(currentLine);
                        currentLine = '';
                    }

                    while (word.length > 0) {
                        let j = 1;
                        while (j <= word.length && font.widthOfTextAtSize(word.substring(0, j), size) <= maxWidth - 10) {
                            j++;
                        }
                        // j-1 is the last index that fits. Ensure we advance at least 1 char.
                        const splitPos = Math.max(1, j - 1);
                        lines.push(word.substring(0, splitPos));
                        word = word.substring(splitPos);

                        if (word.length > 0 && font.widthOfTextAtSize(word, size) <= maxWidth - 10) {
                            currentLine = word;
                            break;
                        }
                    }
                    continue;
                }

                const testLine = currentLine ? currentLine + ' ' + word : word;
                const testWidth = font.widthOfTextAtSize(testLine, size);

                if (testWidth <= maxWidth - 10) {
                    currentLine = testLine;
                } else {
                    if (currentLine) lines.push(currentLine);
                    currentLine = word;
                }
            }
            if (currentLine) lines.push(currentLine);
            // Optionally could push empty strings here to preserve blank lines, but sticking to existing logic.
        });

        return lines.length > 0 ? lines : [''];
    };

    const centerText = (txt: string, font: any, sz: number, yPos: number) => {
        if (!txt) return;
        const textWidth = font.widthOfTextAtSize(txt, sz);
        page.drawText(txt, { x: marginX + (contentWidth - textWidth) / 2, y: yPos, size: sz, font });
    };

    // Logos
    let actLogoImg: any = null;
    let m2aLogoImg: any = null;
    try {
        const actResp = await fetch('/act_logo.png');
        if (actResp.ok) {
            const bytes = await actResp.arrayBuffer();
            actLogoImg = await pdfDoc.embedPng(bytes).catch(() => pdfDoc.embedJpg(bytes));
        }
    } catch (_) { }

    try {
        const m2aResp = await fetch('/m2a_logo.png');
        if (m2aResp.ok) {
            const bytes = await m2aResp.arrayBuffer();
            m2aLogoImg = await pdfDoc.embedPng(bytes).catch(() => pdfDoc.embedJpg(bytes));
        }
    } catch (_) { }

    const headerY = height - 50;
    if (actLogoImg) {
        // Obtenemos las dimensiones originales para mantener el aspect ratio
        const dims = actLogoImg.scale(1);
        const targetHeight = 40;
        const targetWidth = (dims.width / dims.height) * targetHeight;
        
        page.drawImage(actLogoImg, { 
            x: marginX, 
            y: height - 60, 
            width: targetWidth, 
            height: targetHeight 
        });
    }

    // Se eliminó el logo de M2A por requerimiento del usuario.

    // Centered Headers
    centerText('Sistema de Control de Proyectos', timesRomanFont, 10, y);
    y -= 15;
    if (projectInfo) {
        centerText(`Proyecto: ${projectInfo.name || 'N/A'} - AC: ${projectInfo.num_act || 'N/A'}`, timesRomanBoldFont, 10, y);
        y -= 22;
    }
    centerText(title, timesRomanBoldFont, 14, y);
    y -= 18;
    centerText(`Fecha de impresión del reporte: ${utilsFormatDate(new Date())}`, timesRomanFont, 9, y);
    y -= 12;
    if (cutOffDate) {
        const cutDate = new Date(cutOffDate);
        const today = new Date();
        const isToday = cutDate.getFullYear() === today.getFullYear() && 
                        cutDate.getMonth() === today.getMonth() && 
                        cutDate.getDate() === today.getDate();
        
        if (!isToday) {
            centerText(`Fecha de Corte de Información: ${utilsFormatDate(cutDate)}`, timesRomanFont, 9, y);
            y -= 12;
        }
    }
    y -= 18;

    const colCount = data[0]?.length || 1;
    const colWidths = customColWidths || Array(colCount).fill(contentWidth / colCount);
    const totalTableWidth = colWidths.reduce((acc, w) => acc + w, 0);

    let savedHeader: { height: number, lines: any[] } | null = null;

    data.forEach((row, rowIndex) => {
        const isHeader = rowIndex === 0;
        const isEmpty = row.every(cell => !cell || cell.toString().trim() === '');
        const isPartida = row[0]?.toString().startsWith('PARTIDA:');

        if (isEmpty) {
            y -= 10;
            return;
        }

        const fontSize = isHeader ? 9 : 8;
        const lineHeight = fontSize + 3;

        const cellLines = row.map((cell, idx) => {
            let text = cell?.toString() || '';
            let isRed = false;
            const trimmed = text.trim();

            if (trimmed.startsWith('-')) {
                const val = parseFloat(trimmed.replace(/[^\d.-]/g, '')) || 0;
                if (val < 0) {
                    isRed = true;
                    text = `(${trimmed.substring(1).trim()})`;
                } else {
                    text = trimmed.substring(1).trim();
                }
            }

            const width = colWidths[idx] || 50;
            const useBold = isHeader || isPartida || text.trim().endsWith(':') ||
                text === 'Rol / Puesto' || text === 'Nombre' || text === 'Contacto' || text === 'Oficina' || text === 'Celular' || text === 'Email';
            const cellFont = useBold ? timesRomanBoldFont : timesRomanFont;
            return {
                lines: splitTextIntoLines(text.trim() === '' ? '' : text, width, cellFont, fontSize),
                font: cellFont,
                useBold,
                isRed
            };
        });

        const maxLines = Math.max(...cellLines.map(c => c.lines.length));
        const rowHeight = (maxLines * lineHeight) + 10;

        if (isHeader) {
            savedHeader = { height: rowHeight, lines: cellLines };
        }

        // Check for new page
        if (y - rowHeight < 50) {
            page = pdfDoc.addPage(pageSize);
            y = height - 50;
            
            // Draw header again on new page
            if (!isHeader && savedHeader) {
                const headerHeight = savedHeader.height;
                page.drawRectangle({
                    x: marginX, y: y - headerHeight,
                    width: totalTableWidth, height: headerHeight,
                    color: rgb(0.05, 0.2, 0.45),
                });
                
                let cx = marginX;
                savedHeader.lines.forEach((cellData, cellIdx) => {
                    const cw = colWidths[cellIdx] || 50;
                    cellData.lines.forEach((line: string, lineIdx: number) => {
                        page.drawText(line, {
                            x: cx + 5,
                            y: y - (lineIdx + 1) * (9 + 3) - 5,
                            size: 9,
                            font: cellData.font,
                            color: rgb(1, 1, 1)
                        });
                    });
                    // Vertical Border for header
                    page.drawLine({
                        start: { x: cx, y },
                        end: { x: cx, y: y - headerHeight },
                        thickness: 0.5,
                        color: rgb(0.8, 0.8, 0.8),
                    });
                    cx += cw;
                });
                 // Final Vertical Border
                page.drawLine({
                    start: { x: marginX + totalTableWidth, y },
                    end: { x: marginX + totalTableWidth, y: y - headerHeight },
                    thickness: 0.5,
                    color: rgb(0.8, 0.8, 0.8),
                });
                // Top/Bottom Borders
                page.drawLine({
                    start: { x: marginX, y },
                    end: { x: marginX + totalTableWidth, y },
                    thickness: 0.5,
                    color: rgb(0.8, 0.8, 0.8),
                });
                page.drawLine({
                    start: { x: marginX, y: y - headerHeight },
                    end: { x: marginX + totalTableWidth, y: y - headerHeight },
                    thickness: 0.5,
                    color: rgb(0.8, 0.8, 0.8),
                });
                
                y -= headerHeight;
            }
        }

        // Row background
        if (isHeader) {
            page.drawRectangle({
                x: marginX, y: y - rowHeight,
                width: totalTableWidth, height: rowHeight,
                color: rgb(0.05, 0.2, 0.45),
            });
        } else if (isPartida) {
            page.drawRectangle({
                x: marginX, y: y - rowHeight,
                width: totalTableWidth, height: rowHeight,
                color: rgb(0.95, 0.96, 0.98),
            });
        }

        let currX = marginX;
        cellLines.forEach((cellData, cellIdx) => {
            let textColor = isHeader ? rgb(1, 1, 1) : rgb(0, 0, 0);
            if (!isHeader && cellData.isRed) {
                textColor = rgb(0.8, 0, 0); // Rojo
            }
            const currentColWidth = colWidths[cellIdx] || 50;

            cellData.lines.forEach((line, lineIdx) => {
                const rgx = /(\d{3}-[A-Z0-9a-z]+)/g;
                const parts = line.split(rgx);
                let currentTextX = currX + 5;
                
                parts.forEach(part => {
                    if (!part) return;
                    const isMatch = rgx.test(part);
                    rgx.lastIndex = 0; // reset
                    const currentFont = isMatch && !isHeader ? timesRomanBoldFont : cellData.font;
                    
                    page.drawText(part, {
                        x: currentTextX,
                        y: y - (lineIdx + 1) * lineHeight - 5,
                        size: fontSize,
                        font: currentFont,
                        color: textColor,
                    });
                    currentTextX += currentFont.widthOfTextAtSize(part, fontSize);
                });
            });

            // Vertical Border
            page.drawLine({
                start: { x: currX, y },
                end: { x: currX, y: y - rowHeight },
                thickness: 0.5,
                color: rgb(0.8, 0.8, 0.8),
            });

            currX += currentColWidth;
        });

        // Final Vertical Border
        page.drawLine({
            start: { x: marginX + totalTableWidth, y },
            end: { x: marginX + totalTableWidth, y: y - rowHeight },
            thickness: 0.5,
            color: rgb(0.8, 0.8, 0.8),
        });

        // Top/Bottom Borders
        if (isHeader) {
            page.drawLine({
                start: { x: marginX, y },
                end: { x: marginX + totalTableWidth, y },
                thickness: 0.5,
                color: rgb(0.8, 0.8, 0.8),
            });
        }
        page.drawLine({
            start: { x: marginX, y: y - rowHeight },
            end: { x: marginX + totalTableWidth, y: y - rowHeight },
            thickness: 0.5,
            color: rgb(0.8, 0.8, 0.8),
        });

        y -= rowHeight;
    });

    // Add Page Numbers
    const pages = pdfDoc.getPages();
    pages.forEach((p, idx) => {
        const { width: pW } = p.getSize();
        const pageNumText = `Página ${idx + 1} de ${pages.length}`;
        const pNumWidth = timesRomanFont.widthOfTextAtSize(pageNumText, 8);
        p.drawText(pageNumText, {
            x: (pW - pNumWidth) / 2,
            y: 20,
            size: 8,
            font: timesRomanFont,
            color: rgb(0.4, 0.4, 0.4)
        });
    });

    let pdfBytes;
    try {
        pdfBytes = await pdfDoc.save();
    } catch (saveError: any) {
        console.error("Error al guardar el PDF:", saveError);
        throw new Error(`No se pudo generar el archivo PDF: ${saveError.message}`);
    }
    
    return new Blob([pdfBytes as any], { type: "application/pdf" });
};

export const createExcelBlob = async (
    title: string,
    data: any[][],
    projectInfo?: { name: string, num_act: string } | null,
    cutOffDate?: string | Date
) => {
    const cutStr = cutOffDate ? utilsFormatDate(new Date(cutOffDate)) : "";
    const todayStr = utilsFormatDate(new Date());

    const dateHeader = [
        [`Fecha de Impresión: ${todayStr}`]
    ];

    if (cutStr && cutStr !== todayStr) {
        dateHeader.push([`Fecha de Corte: ${cutStr}`]);
    }

    // Combine title and data for better excel layout
    const excelData = [
        [title],
        [projectInfo ? `Proyecto: ${projectInfo.name} - ACT: ${projectInfo.num_act}` : ""],
        ...dateHeader,
        [],
        ...data
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

export const downloadBlob = async (blob: Blob, filename: string) => {
    try {
        console.log("Intentando descargar:", filename, "size:", blob.size);
        if (!blob || blob.size === 0) {
            alert("Error: El documento PDF está vacío o no se generó correctamente.");
            return;
        }

        // --- Soporte para Electron con carpeta personalizada ---
        // @ts-ignore
        if (window.electronAPI) {
            const defaultFolder = getLocalStorageItem("pact_reports_folder");
            if (defaultFolder) {
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                return new Promise((resolve) => {
                    reader.onloadend = async () => {
                        const base64data = reader.result as string;
                        const cleanBase64 = base64data.split(',')[1];
                        const fullPath = `${defaultFolder}\\${filename}`.replace(/\//g, '\\').replace(/\\\\/g, '\\');
                        
                        // @ts-ignore
                        const result = await window.electronAPI.saveFileBinary({
                            filePath: fullPath,
                            base64Data: cleanBase64
                        });

                        if (result.success) {
                            console.log(`Reporte guardado exitosamente en: ${fullPath}`);
                            alert(`Reporte guardado exitosamente en:\n${fullPath}`);
                        } else {
                            console.error("Error al guardar reporte en carpeta:", result.error);
                            // Fallback a descarga normal si falla el guardado directo
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = filename;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            setTimeout(() => URL.revokeObjectURL(url), 1000);
                        }
                        resolve(null);
                    };
                });
            }
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e: any) {
        console.error("Error en downloadBlob:", e);
        alert("Error al descargar el archivo: " + e.message);
    }
};

export const generateReport = async (
    title: string,
    data: any[][],
    project: any,
    widths: number[],
    orient: 'portrait' | 'landscape',
    format: 'pdf' | 'excel',
    filename: string,
    cutOffDate?: string | Date
) => {
    if (format === 'excel') {
        const blob = await createExcelBlob(title, data, project, cutOffDate);
        downloadBlob(blob, filename.replace('.pdf', '.xlsx'));
    } else {
        const blob = await createPdfBlob(title, data, project, widths, orient, cutOffDate);
        downloadBlob(blob, filename);
    }
};

export const generateBalanceReportLogic = async (projectId: string, format: 'pdf' | 'excel' = 'pdf', endDate?: string) => {
    const { project, items, chos, certs } = await fetchAllReportData(projectId);
    if (!items) return;

    const cutOff = endDate ? new Date(`${endDate}T23:59:59`) : new Date();

    // Filtramos CHOs y certs por fecha de corte
    const filteredChos = chos?.filter(c => new Date(c.cho_date) <= cutOff) || [];
    const filteredCerts = certs?.filter(c => new Date(c.cert_date) <= cutOff) || [];

    // Coleccionamos todos los números de ítems únicos (originales + añadidos por CHO)
    const allItemNums = new Set(items.map(i => i.item_num));
    filteredChos.forEach(c => {
        const choItems = Array.isArray(c.items) ? c.items : [];
        choItems.forEach((ci: any) => {
            if (ci.item_num) allItemNums.add(ci.item_num);
        });
    });

    const sortedItemNums = Array.from(allItemNums).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const balances = sortedItemNums.map(itemNum => {
        // Buscamos el ítem base en el contrato
        const baseItem = items.find(i => i.item_num === itemNum);
        const origQty = baseItem ? (parseFloat(baseItem.quantity) || 0) : 0;
        const description = baseItem ? [baseItem.description, baseItem.additional_description].filter(Boolean).join(' - ') : "";
        const unit = baseItem ? baseItem.unit : "";

        // Sumamos cambios de CHOs (solo los que apliquen a este ítem)
        let totalChoQty = 0;
        let choDescription = "";

        filteredChos.forEach(c => {
            const choItems = Array.isArray(c.items) ? c.items : [];
            const match = choItems.find((ci: any) => ci.item_num === itemNum);
            if (match) {
                totalChoQty += (parseFloat(match.proposed_change) || 0);
                if (!description && match.description) choDescription = match.description;
                if (!unit && match.unit) choDescription = match.unit; // fallback unit
            }
        });

        // Sumamos certificaciones
        const certQty = filteredCerts.reduce((acc, c) => {
            const certItems = Array.isArray(c.items) ? c.items : (c.items?.list || []);
            const match = certItems.find((it: any) => it.item_num === itemNum);
            return acc + (parseFloat(match?.quantity || 0));
        }, 0);

        const totalQty = origQty + totalChoQty;
        const balance = totalQty - certQty;

        return { 
            item_num: itemNum, 
            description: description || choDescription || "Ítem nuevo por CHO", 
            unit: unit || "UN", 
            origQty, 
            choQty: totalChoQty, 
            totalQty, 
            certQty, 
            balance 
        };
    });

    const data = [
        ['Item', 'Descripción', 'Unidad', 'C. Orig', 'CHO', 'Total', 'Certific.', 'Balance'],
        ...balances.map((b: any) => [
            b.item_num,
            b.description,
            b.unit,
            b.origQty.toFixed(4),
            b.choQty.toFixed(4),
            b.totalQty.toFixed(4),
            b.certQty.toFixed(4),
            b.balance.toFixed(4)
        ])
    ];

    if (format === 'excel') {
        alert("Este reporte no está disponible en formato Excel por requerimiento.");
        return;
    }

    await generateReport('REPORTE DE BALANCES DE PARTIDAS', data, project, [40, 220, 60, 80, 80, 80, 80, 80], 'landscape', format, 'Reporte_Balances_Partidas.pdf', endDate);
};

export const generateDetailReportLogic = async (projectId: string, format: 'pdf' | 'excel' = 'pdf', endDate?: string) => {
    const { project, items, chos, certs } = await fetchAllReportData(projectId);
    if (!items) return;

    const cutOff = endDate ? new Date(`${endDate}T23:59:59`) : new Date();
    const filteredChos = chos?.filter(c => new Date(c.cho_date) <= cutOff) || [];
    const filteredCerts = certs?.filter(c => new Date(c.cert_date) <= cutOff) || [];

    // Coleccionamos todos los números de ítems únicos (originales + añadidos por CHO)
    const allItemNums = new Set(items.map(i => i.item_num));
    filteredChos.forEach(c => {
        const choItems = Array.isArray(c.items) ? c.items : [];
        choItems.forEach((ci: any) => {
            if (ci.item_num) allItemNums.add(ci.item_num);
        });
    });

    const sortedItemNums = Array.from(allItemNums).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const reportData: any[][] = [['ITEM', 'SPEC.', 'DESCRIPTION / ACTIVITY', 'QUANTITY', 'UNIT', 'BALANCE', 'UNIT PRICE', 'AMOUNT']];

    sortedItemNums.forEach(itemNum => {
        const baseItem = items.find(i => i.item_num === itemNum);
        let uPrice = baseItem ? (parseFloat(baseItem.unit_price) || 0) : 0;
        let unit = baseItem ? baseItem.unit : "";
        let spec = baseItem ? baseItem.specification : "";
        let fullDescription = baseItem ? [baseItem.description, baseItem.additional_description].filter(Boolean).join(' - ') : "";
        let currentBalance = 0;

        // Si es ítem nuevo, buscar precio y descripción en el primer CHO que lo mencione
        if (!baseItem) {
            const firstCho = filteredChos.find(c => (Array.isArray(c.items) ? c.items : []).some((i: any) => i.item_num === itemNum));
            if (firstCho) {
                const match = (firstCho.items as any[]).find(i => i.item_num === itemNum);
                uPrice = parseFloat(match.unit_price) || 0;
                unit = match.unit || "UN";
                fullDescription = match.description || "Ítem nuevo por CHO";
                spec = match.specification || "";
            }
        }

        reportData.push([itemNum, spec || '', fullDescription || '', '', '', '', '', '']);
        
        if (baseItem) {
            const origQty = parseFloat(baseItem.quantity) || 0;
            currentBalance += origQty;
            reportData.push(['', '', '  - Cantidad Original de Contrato', origQty.toFixed(4), unit || '', currentBalance.toFixed(4), formatCurrency(uPrice), formatCurrency(roundedAmt(origQty * uPrice, 2))]);
        }

        const itemChos = filteredChos.filter(c => (Array.isArray(c.items) ? c.items : []).some((i: any) => i.item_num === itemNum));
        itemChos.forEach(c => {
            const i = (Array.isArray(c.items) ? c.items : []).find((it: any) => it.item_num === itemNum);
            if (i) {
                const choQty = parseFloat(i.proposed_change !== undefined ? i.proposed_change : i.quantity) || 0;
                currentBalance += choQty;
                reportData.push(['', '', `  - CHO #${c.cho_num}${c.amendment_letter || ''} ${c.doc_status || ''} (${formatDate(c.cho_date)})`, choQty.toFixed(4), unit || '', currentBalance.toFixed(4), formatCurrency(uPrice), formatCurrency(roundedAmt(choQty * uPrice, 2))]);
            }
        });

        const itemCerts = filteredCerts.filter(c => (Array.isArray(c.items) ? c.items : (c.items?.list || [])).some((it: any) => it.item_num === itemNum));
        itemCerts.forEach(c => {
            const i = (Array.isArray(c.items) ? c.items : (c.items?.list || [])).find((it: any) => it.item_num === itemNum);
            if (i) {
                const certQty = parseFloat(i.quantity) || 0;
                currentBalance -= certQty;
                reportData.push(['', '', `  - Certificación de Pago #${c.cert_num} (${formatDate(c.cert_date)})`, certQty.toFixed(4), unit || '', currentBalance.toFixed(4), formatCurrency(uPrice), formatCurrency(roundedAmt(certQty * uPrice, 2))]);
            }
        });
        reportData.push(['', '', '', '', '', '', '', '']);
    });

    await generateReport('REPORTE DETALLADO DE PARTIDAS (CHO Y CERTIFICACIONES)', reportData, project, [38, 50, 160, 60, 35, 60, 75, 75], 'landscape', format, `Reporte_Detalle_Partidas_${project?.num_act || projectId}.pdf`, endDate);
};

export const generateMfgReportLogic = async (projectId: string, format: 'pdf' | 'excel' = 'pdf') => {
    const { project, items, mfgCerts } = await fetchAllReportData(projectId);
    if (!mfgCerts) return;

    const data = [
        ['Item', 'Especificación', 'Descripción', 'Cantidad del certificado (CM)', 'Unidades', 'Fecha del certificado'],
        ...mfgCerts.map((c: any) => {
            const it = items?.find(i => i.id === c.item_id || i.item_num === c.item_num);
            const unit = it?.unit || '';
            const fullDescription = [it?.description, it?.additional_description].filter(Boolean).join(' - ');
            return [
                c.item_num,
                c.specification,
                fullDescription || c.material_description || '',
                c.quantity.toFixed(4),
                unit,
                formatDate(c.cert_date)
            ];
        })
    ];
    await generateReport('REPORTE DE CERTIFICADOS DE MANUFACTURA (CM)', data, project, [40, 70, 200, 100, 60, 100], 'landscape', format, 'Reporte_Certificados_CM.pdf');
};

export const generateMissingMfgReportLogic = async (projectId: string, format: 'pdf' | 'excel' = 'pdf') => {
    const { project, items, certs, mfgCerts } = await fetchAllReportData(projectId);
    if (!items) return;

    const missingCerts = items.filter((b: any) => b.requires_mfg_cert).map((b: any) => {
        const itemMfgCerts = mfgCerts?.filter((c: any) => c.item_id === b.id) || [];
        const mfgQty = itemMfgCerts.reduce((acc: number, c: any) => acc + (parseFloat(c.quantity) || 0), 0);
        const certQty = certs?.reduce((acc: number, c: any) => (Array.isArray(c.items) ? c.items : (c.items?.list || [])).find((it: any) => it.item_num === b.item_num) ? acc + (parseFloat((Array.isArray(c.items) ? c.items : (c.items?.list || [])).find((it: any) => it.item_num === b.item_num)?.quantity || 0)) : acc, 0) || 0;
        const missing = certQty - mfgQty;
        let dateMissing = 'N/A';
        if (missing > 0 && certs) {
            let running = 0;
            for (const cert of certs) {
                const i = (Array.isArray(cert.items) ? cert.items : (cert.items?.list || [])).find((it: any) => it.item_num === b.item_num);
                if (i) {
                    running += parseFloat(i.quantity) || 0;
                    if (running > mfgQty) { dateMissing = formatDate(cert.cert_date); break; }
                }
            }
        }
        const fullDescription = [b.description, b.additional_description].filter(Boolean).join(' - ');
        return { item_num: b.item_num, spec: b.specification || '', desc: fullDescription || '', unit: b.unit || '', certQty, mfgQty, missing, date: dateMissing };
    }).filter((m: any) => m.missing > 0);

    if (missingCerts.length === 0) throw new Error("NO_FALTA_NINGUNO");

    const data = [
        ['Item', 'Especificación', 'Descripción', 'Cant. Certificada', 'Cant. en CM', 'Cantidad faltante', 'Fecha del certificado'],
        ...missingCerts.map((m: any) => [m.item_num, m.spec, m.desc, `${m.certQty.toFixed(4)} ${m.unit}`, `${m.mfgQty.toFixed(4)} ${m.unit}`, `${m.missing.toFixed(4)} ${m.unit}`, m.date])
    ];

    await generateReport('REPORTE DE CERTIFICADOS DE MANUFACTURA (CM) QUE FALTAN', data, project, [40, 70, 200, 80, 80, 80, 90], 'landscape', format, 'Certificados_CM_Faltantes.pdf');
};

export const generateMosReportLogic = async (projectId: string, format: 'pdf' | 'excel' = 'pdf') => {
    const { project, items: itemsRepo, certs } = await fetchAllReportData(projectId);
    if (!certs) return;

    const getInvoicePU = (certsList: any[], itemNum: string, currentCertIdx: number) => {
        for (let i = currentCertIdx; i >= 0; i--) {
            if (!certsList[i]) continue;
            const its = Array.isArray(certsList[i].items) ? certsList[i].items : (certsList[i].items?.list || []);
            const match = its.find((itx: any) => itx.item_num === itemNum && itx.has_material_on_site && parseFloat(itx.mos_unit_price) > 0);
            if (match) return parseFloat(match.mos_unit_price);
        }
        return 0;
    };

    const groupedItems = new Map<string, any>();
    certs.forEach((c: any, cIdx: number) => {
        const items = Array.isArray(c.items) ? c.items : (c.items?.list || []);
        items.forEach((it: any) => {
            const hasAddition = it.has_material_on_site;
            const hasDeduction = parseFloat(it.qty_from_mos) > 0;
            if (hasAddition || hasDeduction) {
                if (!groupedItems.has(it.item_num)) {
                    const matchCi = itemsRepo?.find((i: any) => i.item_num === it.item_num);
                    const fullDesc = [it.description || matchCi?.description, matchCi?.additional_description].filter(Boolean).join(' - ');
                    groupedItems.set(it.item_num, { item_num: it.item_num, spec: it.specification || '', desc: fullDesc || '', activities: [] });
                }
                const group = groupedItems.get(it.item_num);
                if (hasAddition) group.activities.push({ certNum: c.cert_num, type: 'Adición (Factura)', qty: parseFloat(it.mos_quantity) || 0, cost: parseFloat(it.mos_invoice_total) || 0 });
                if (hasDeduction) {
                    const mp = getInvoicePU(certs, it.item_num, cIdx);
                    const p = mp > 0 ? mp : (parseFloat(it.unit_price) || 0);
                    const qty = parseFloat(it.qty_from_mos) || 0;
                    group.activities.push({ certNum: c.cert_num, type: 'Deducción (WP)', qty: -qty, cost: -(qty * p) });
                }
            }
        });
    });

    const reportData: any[][] = [['# Item', 'Especificación', 'Descripción', 'Cert #', 'Tipo', 'Cantidad', 'Unidad', 'Monto ($)', 'Balance ($)']];
    let totalFinalBalance = 0;
    Array.from(groupedItems.values()).forEach(group => {
        const it = (itemsRepo || []).find((i: any) => i.item_num === group.item_num);
        const unit = it?.unit || '';
        let itemBalance = 0;
        group.activities.forEach((act: any, idx: number) => {
            itemBalance += act.cost;
            reportData.push([
                idx === 0 ? group.item_num : '', 
                idx === 0 ? group.spec : '', 
                idx === 0 ? group.desc : '', 
                `#${act.certNum}`, 
                act.type, 
                act.qty.toFixed(2), 
                unit, 
                formatCurrency(act.cost), 
                formatCurrency(itemBalance)
            ]);
        });
        totalFinalBalance += itemBalance;
        reportData.push(['', '', '', '', '', '', '', '', '']);
    });
    reportData.push(['BALANCE TOTAL EN INVENTARIO (MOS):', '', '', '', '', '', '', '', formatCurrency(totalFinalBalance)]);

    await generateReport('REPORTE DE MATERIAL ON SITE (MOS)', reportData, project, [60, 80, 180, 50, 90, 60, 40, 70, 70], 'landscape', format, 'Reporte_Material_On_Site.pdf');
};

export const generateCCMLReportLogic = async (projectId: string, choId?: string) => {
    // CCML es solo Excel por requerimiento
    const { project, chos, agreementFunds, certs } = await fetchAllReportData(projectId);
    if (!project) return;

    const { data: personnel } = await supabase.from('act_personnel').select('*').eq('project_id', projectId);
    const { data: contractor } = await supabase.from('contractors').select('*').eq('project_id', projectId).single();
    const { data: ccmlMods } = await supabase.from('project_ccml_modifications').select('*').eq('project_id', projectId).order('modification_num', { ascending: true });
    
    const blob = await generateCCMLReport(
        project,
        chos || [],
        agreementFunds || [],
        personnel || [],
        contractor,
        certs || [],
        ccmlMods || [],
        choId
    );

    let suffix = "Full";
    if (choId) {
        const targetCho = (chos || []).find(c => c.id === choId);
        if (targetCho) {
            suffix = `CHO_${targetCho.cho_num}${targetCho.amendment_letter || ''}`;
        }
    }

    await downloadBlob(blob, `CCML_${project.num_act || projectId}_${suffix}.xlsx`);
};




export const generateChoReportLogic = async (projectId: string, choIds: string[], format: 'pdf' | 'excel' = 'pdf') => {
    const { project, chos, items: itemsRepo } = await fetchAllReportData(projectId);
    if (!chos) return;
    const selectedChos = chos.filter(c => choIds.includes(c.id));
    if (selectedChos.length === 0) return;

    const reportData: any[][] = [['Ítem', 'Descripción', 'Cambio Propuesto', 'Unidad', 'Costo Unitario', 'Monto Total']];
    selectedChos.forEach(cho => {
        reportData.push([`ORDEN DE CAMBIO (CHO) #${cho.cho_num}`, `Fecha: ${formatDate(cho.cho_date)}`, '', '', '', '']);
        const items = Array.isArray(cho.items) ? cho.items : [];
        let choTotal = 0;
        items.forEach((it: any) => {
            const matchCi = itemsRepo?.find((i: any) => i.item_num === it.item_num);
            const fullDesc = [it.description || matchCi?.description, matchCi?.additional_description].filter(Boolean).join(' - ');
            const qty = parseFloat(it.proposed_change) || 0;
            const pu = parseFloat(it.unit_price) || 0;
            const total = qty * pu;
            choTotal += total;
            reportData.push([it.item_num || '', fullDesc || '', qty.toString(), it.unit || '', formatCurrency(pu), formatCurrency(total)]);
        });
        reportData.push(['TOTAL CHO:', '', '', '', '', formatCurrency(choTotal)]);
        reportData.push(['', '', '', '', '', '']);
    });
    const choNums = selectedChos.map(c => `${c.cho_num}${c.amendment_letter || ''}`).join('-');
    await generateReport('REPORTE DE ÓRDENES DE CAMBIO (CHO)', reportData, project, [80, 250, 100, 80, 110, 110], 'landscape', format, `Reporte_CHO_${choNums}_${project?.num_act || projectId}.pdf`);
};


export const generateCertReportLogic = async (projectId: string, certIds: string[], format: 'pdf' | 'excel' = 'pdf') => {
    const { project, certs, items: itemsRepo } = await fetchAllReportData(projectId);
    if (!certs) return;
    const selectedCerts = certs.filter(c => certIds.includes(c.id));
    if (selectedCerts.length === 0) return;

    const reportData: any[][] = [['Ítem', 'Descripción', 'Cantidad', 'Unidad', 'Precio Unit.', 'Subtotal']];
    selectedCerts.forEach(cert => {
        reportData.push([`CERTIFICACIÓN DE PAGO #${cert.cert_num}`, `Fecha: ${formatDate(cert.cert_date)}`, '', '', '', '']);
        const items = Array.isArray(cert.items) ? cert.items : (cert.items?.list || []);
        let subtotal = 0;
        items.forEach((it: any) => {
            const matchCi = itemsRepo?.find((i: any) => i.item_num === it.item_num);
            const fullDesc = [it.description || matchCi?.description, matchCi?.additional_description].filter(Boolean).join(' - ');
            const qty = parseFloat(it.quantity) || 0;
            const pu = parseFloat(it.unit_price) || 0;
            const total = qty * pu;
            subtotal += total;
            reportData.push([it.item_num || '', fullDesc || '', qty.toFixed(4), it.unit || '', formatCurrency(pu), formatCurrency(total)]);
        });
        const grossRetention = cert.skip_retention ? 0 : (subtotal * 0.05);
        const returnedAmount = parseFloat(cert.retention_return_amount) || 0;
        const netRetention = grossRetention - returnedAmount;
        const totalNeto = subtotal - (cert.skip_retention ? 0 : netRetention);
        reportData.push(['SUBTOTAL:', '', '', '', '', formatCurrency(subtotal)]);
        if (!cert.skip_retention || returnedAmount > 0) reportData.push(['RETENCIÓN (5% Net):', '', '', '', '', netRetention > 0 ? `-${formatCurrency(netRetention)}` : formatCurrency(Math.abs(netRetention))]);
        reportData.push(['TOTAL NETO:', '', '', '', '', formatCurrency(totalNeto)]);
        reportData.push(['', '', '', '', '', '']);
    });
    const certNums = selectedCerts.map(c => c.cert_num).join('-');
    await generateReport('REPORTE DE CERTIFICACIONES DE PAGO', reportData, project, [80, 250, 100, 80, 110, 110], 'landscape', format, `Reporte_Cert_${certNums}_${project?.num_act || projectId}.pdf`);
};


export const generateDashboardReportLogic = async (projectId: string, format: 'pdf' | 'excel' = 'pdf', endDate?: string) => {
    const { data: proj } = await supabase.from("projects").select("*").eq("id", projectId).single();
    if (!proj) return;

    if (format === 'excel') {
        alert("El reporte de información principal no está disponible en formato Excel por requerimiento.");
        return;
    }

    const cutOff = endDate ? new Date(`${endDate}T23:59:59`) : new Date();

    const { data: contractor } = await supabase.from("contractors").select("*").eq("project_id", projectId).single();
    const { data: personnel } = await supabase.from("act_personnel").select("*").eq("project_id", projectId);
    const { data: items } = await supabase.from("contract_items").select("*").eq("project_id", projectId);
    const { data: chos } = await supabase.from("chos").select("*").eq("project_id", projectId);
    const { data: certs } = await supabase.from("payment_certifications").select("*").eq("project_id", projectId).order("cert_num", { ascending: true });

    // Filtrar CHOs y Certs por fecha de corte
    const filteredChos = chos?.filter(c => new Date(c.cho_date) <= cutOff) || [];
    const filteredCerts = certs?.filter(c => new Date(c.cert_date) <= cutOff) || [];

    const originalCost = proj.cost_original || items?.reduce((acc, item) => roundedAmt(acc + roundedAmt(item.quantity * item.unit_price, 2), 2), 0) || 0;

    const approvedCHOs = filteredChos.filter(c => c.doc_status === 'Aprobado');
    const pendingCHOs = filteredChos.filter(c => c.doc_status === 'En trámite');
    const approvedCHO = approvedCHOs.reduce((acc, c) => roundedAmt(acc + parseFloat(c.proposed_change || '0'), 2), 0);
    const pendingCHO = pendingCHOs.reduce((acc, c) => roundedAmt(acc + parseFloat(c.proposed_change || '0'), 2), 0);
    const approvedDays = approvedCHOs.reduce((acc, c) => acc + (c.time_extension_days || 0), 0);
    // const pendingDays = pendingCHOs.reduce((acc, c) => acc + (c.time_extension_days || 0), 0);

    let actTotal = 0;
    let fhwaTotal = 0;
    let totalCertified = 0;
    let actProjected = 0;
    let fhwaProjected = 0;

    items?.forEach((item: any) => {
        const amount = roundedAmt((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0), 2);
        if (item.fund_source?.includes('ACT')) actProjected = roundedAmt(actProjected + amount, 2);
        else if (item.fund_source?.includes('FHWA')) fhwaProjected = roundedAmt(fhwaProjected + amount, 2);
    });

    filteredChos.forEach((cho: any) => {
        if (cho.items && Array.isArray(cho.items)) {
            cho.items.forEach((item: any) => {
                const amount = roundedAmt((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0), 2);
                if (item.fund_source?.includes('ACT')) actProjected = roundedAmt(actProjected + amount, 2);
                else if (item.fund_source?.includes('FHWA')) fhwaProjected = roundedAmt(fhwaProjected + amount, 2);
            });
        }
    });

    let totalRetentionDeducted = 0;
    let totalRetentionReturned = 0;
    let mosBalance = 0;

    filteredCerts.forEach((cert) => {
        const certItems = Array.isArray(cert.items) ? cert.items : (cert.items?.list || []);
        certItems.forEach((item: any) => {
            const qty = parseFloat(item.quantity) || 0;
            const up = parseFloat(item.unit_price) || 0;
            const amount = roundedAmt(qty * up, 2);
            const source = (item.fund_source || "").trim();

            if (source === "FHWA:100%") fhwaTotal = roundedAmt(fhwaTotal + amount, 2);
            else if (source === "FHWA:80.25") {
                const fhwaShare = roundedAmt(amount * 0.8025, 2);
                const actShare = roundedAmt(amount - fhwaShare, 2);
                fhwaTotal = roundedAmt(fhwaTotal + fhwaShare, 2);
                actTotal = roundedAmt(actTotal + actShare, 2);
            } else actTotal = roundedAmt(actTotal + amount, 2);

            totalCertified = roundedAmt(totalCertified + amount, 2);
            const mosInvoice = parseFloat(item.mos_invoice_total) || 0;
            if (mosInvoice > 0) mosBalance = roundedAmt(mosBalance + mosInvoice, 2);
            const qtyFromMos = parseFloat(item.qty_from_mos) || 0;
            const mosPU = parseFloat(item.mos_unit_price) || up;
            if (qtyFromMos > 0) mosBalance = roundedAmt(mosBalance - roundedAmt(qtyFromMos * mosPU, 2), 2);
            if (!cert.skip_retention && !item.skip_retention) totalRetentionDeducted = roundedAmt(totalRetentionDeducted + roundedAmt(amount * 0.05, 2), 2);
        });
        if (cert.show_retention_return && cert.retention_return_amount) totalRetentionReturned = roundedAmt(totalRetentionReturned + (parseFloat(cert.retention_return_amount) || 0), 2);
    });

    const adjustedCost = roundedAmt(originalCost + approvedCHO, 2);
    const budgetBalance = roundedAmt(adjustedCost - totalCertified, 2);
    const percentObra = adjustedCost > 0 ? (totalCertified / adjustedCost) * 100 : 0;

    const startDate = proj.date_project_start ? new Date(`${proj.date_project_start}T00:00:00`) : null;
    const origEndDate = proj.date_orig_completion ? new Date(`${proj.date_orig_completion}T23:59:59`) : null;
    let totalDays = 0;
    if (startDate && origEndDate) totalDays = Math.ceil((origEndDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
    const revisedDaysTotal = totalDays + approvedDays;

    let timeEndDate = cutOff; // Usamos la fecha de corte como referencia de tiempo actual del reporte
    if (proj.date_substantial_completion && new Date(proj.date_substantial_completion) <= cutOff) timeEndDate = new Date(`${proj.date_substantial_completion}T23:59:59`);
    else if (proj.date_real_completion && new Date(proj.date_real_completion) <= cutOff) timeEndDate = new Date(`${proj.date_real_completion}T23:59:59`);

    let usedDays = 0;
    if (startDate) {
        usedDays = Math.ceil((timeEndDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
        if (usedDays < 0) usedDays = 0;
    }
    const timeBalance = revisedDaysTotal - usedDays;
    const percentTime = revisedDaysTotal > 0 ? (usedDays / revisedDaysTotal) * 100 : 0;
    const damageAmt = parseFloat(proj.liquidated_damages_amount) || 500.00;
    const liqDamages = Math.max(0, (usedDays - revisedDaysTotal) * damageAmt);
    const retNet = roundedAmt(totalRetentionDeducted - totalRetentionReturned, 2);

    const reportData: any[][] = [
        ['SECCIÓN / CAMPO', 'INFORMACIÓN', '', ''],
        ['1. RESUMEN DE TIEMPO', `(Reporte al: ${endDate || 'Hoy'})`, '', ''],
        ['Fecha de Comienzo:', formatDate(proj.date_project_start), 'Term. Original:', formatDate(proj.date_orig_completion)],
        ['Term. Revisada:', formatDate(proj.date_rev_completion), 'Term. Sustancial:', formatDate(proj.date_substantial_completion)],
        ['FMIS End Date:', formatDate(proj.fmis_end_date), '', ''],
        ['Tiempo Contrato:', `${totalDays} días`, 'Prórrogas (CHOs):', `${approvedDays} días`],
        ['Tiempo Revisado:', `${revisedDaysTotal} días`, 'Tiempo Usado:', `${usedDays} días`],
        ['Balance de Tiempo:', `${timeBalance} días`, 'Progreso Tiempo:', `${percentTime.toFixed(2)}%`],
        ['', '', '', ''],
        ['2. RESUMEN DE COSTOS ($)', '', '', ''],
        ['Costo Original:', formatCurrency(originalCost), 'Total CHOs (Aprob.):', formatCurrency(approvedCHO)],
        ['Presupuesto Ajustado:', formatCurrency(adjustedCost), 'Total Certificado:', formatCurrency(totalCertified)],
        ['Balance Actual:', formatCurrency(budgetBalance), '% de Obra Ejecutada:', `${percentObra.toFixed(2)}%`],
        ['Material en Sitio (MOS):', formatCurrency(Math.max(0, mosBalance)), 'Daños Líquidos (Dlq):', formatCurrency(liqDamages)],
        ['Fondo ACT:', formatCurrency(actTotal), 'Fondo FHWA:', formatCurrency(fhwaTotal)],
        ['', '', '', ''],
        ['3. PRESUPUESTO PROYECTADO POR FONDOS ($)', '', '', ''],
        ['Provision ACT:', formatCurrency(actProjected), 'Provision FHWA:', formatCurrency(fhwaProjected)],
        ['', '', '', ''],
        ['4. RETENCIÓN ($)', '', '', ''],
        ['5% Retenido (Bruto):', formatCurrency(totalRetentionDeducted), 'Retención Devuelta:', formatCurrency(totalRetentionReturned)],
        ['Retención Neta Actual:', formatCurrency(retNet), '', ''],
        ['', '', '', ''],
        ['5. ÓRDENES DE CAMBIO (CHOs)', '', '', ''],
        ['Aprobados:', formatCurrency(approvedCHO), 'En Trámite:', formatCurrency(pendingCHO)],
        ['Balance Total CHOs:', formatCurrency(roundedAmt(approvedCHO + pendingCHO, 2)), '% de Cambio (Precio):', `${originalCost > 0 ? Math.round((approvedCHO / originalCost) * 100) : 0}%`],
        ['', '', '', ''],
        ['6. CONTRATISTA', '', '', ''],
        ['Nombre:', contractor?.name || 'N/A', 'Empresa SS:', contractor?.ss_patronal || 'N/A'],
        ['Representante:', contractor?.representative || 'N/A', 'Email:', contractor?.email || 'N/A'],
        ['Oficina:', contractor?.phone_office || 'N/A', 'Celular:', contractor?.phone_mobile || 'N/A'],
        ['', '', '', ''],
        ['7. PERSONAL ACT RESPONSABLE', 'Rol / Puesto', 'Nombre', 'Contacto'],
    ];

    personnel?.forEach(p => {
        reportData.push(['', p.role, p.name || 'N/A', (p.phone_mobile || p.email || 'N/A')]);
    });

    const projectInfo = { name: proj.name, num_act: proj.num_act };
    await generateReport('REPORTE DE INFORMACIÓN PRINCIPAL (DASHBOARD)', reportData, projectInfo, [138, 138, 138, 138], 'portrait', format, `Dashboard_Reporte_${proj.num_act}.pdf`, endDate);
};


// ════════════════════════════════════════════════════════════════════════════════════════════════════
// REPORTE DE DISTRIBUCIÓN DE FONDOS (ACT vs FHWA)

// ════════════════════════════════════════════════════════════════════════════════════════════════════
export const generateFundSourceReportLogic = async (projectId: string, format: 'pdf' | 'excel' = 'pdf', endDate?: string) => {
    const { project, certs } = await fetchAllReportData(projectId);
    if (!project) return;
    
    const cutOff = endDate ? new Date(`${endDate}T23:59:59`) : new Date();
    const filteredCerts = certs?.filter(c => new Date(c.cert_date) <= cutOff) || [];

    type ItemEntry = { item_num: string; description: string; unit: string; qty: number; unit_price: number; amount: number };
    const actMap = new Map<string, ItemEntry>();
    const fhwaMap = new Map<string, ItemEntry>();

    const addToMap = (map: Map<string, ItemEntry>, item: any, amount: number, qty: number) => {
        const key = `${item.item_num || ''}__${item.unit_price}`;
        const existing = map.get(key);
        if (existing) {
            existing.qty = roundedAmt(existing.qty + qty, 4);
            existing.amount = roundedAmt(existing.amount + amount, 2);
        } else {
            map.set(key, {
                item_num: item.item_num || '—',
                description: item.description || '(sin descripción)',
                unit: item.unit || '',
                qty,
                unit_price: parseFloat(item.unit_price) || 0,
                amount,
            });
        }
    };

    filteredCerts.forEach((cert: any) => {
        const certItems = Array.isArray(cert.items) ? cert.items : (cert.items?.list || []);
        certItems.forEach((item: any) => {
            const qty = parseFloat(item.quantity) || 0;
            const up = parseFloat(item.unit_price) || 0;
            const total = roundedAmt(qty * up, 2);
            const source = (item.fund_source || '').trim();

            if (source === 'FHWA:100%') {
                addToMap(fhwaMap, item, total, qty);
            } else if (source === 'FHWA:80.25') {
                const fhwaAmt = roundedAmt(total * 0.8025, 2);
                const actAmt = roundedAmt(total - fhwaAmt, 2);
                const fhwaQty = roundedAmt(qty * 0.8025, 4);
                const actQty = roundedAmt(qty - fhwaQty, 4);
                addToMap(fhwaMap, { ...item, description: `${item.description || ''} [80.25%]` }, fhwaAmt, fhwaQty);
                addToMap(actMap, { ...item, description: `${item.description || ''} [19.75%]` }, actAmt, actQty);
            } else {
                addToMap(actMap, item, total, qty);
            }
        });
    });

    const sortFn = (a: ItemEntry, b: ItemEntry) => a.item_num.localeCompare(b.item_num, undefined, { numeric: true });
    const actArr = Array.from(actMap.values()).sort(sortFn);
    const fhwaArr = Array.from(fhwaMap.values()).sort(sortFn);

    const actGrand = roundedAmt(actArr.reduce((s, r) => s + r.amount, 0), 2);
    const fhwaGrand = roundedAmt(fhwaArr.reduce((s, r) => s + r.amount, 0), 2);
    const grandTotal = roundedAmt(actGrand + fhwaGrand, 2);

    const COL_WIDTHS = [50, 312, 60, 90, 110, 110];
    const HEADER_ROW = ['Item', 'Descripción', 'Unit', 'Qty', 'Precio Unit.', 'Importe'];

    const rowOf = (e: ItemEntry) => [
        e.item_num,
        e.description,
        e.unit,
        e.qty.toFixed(4).replace(/\.?0+$/, ''),
        formatCurrency(e.unit_price),
        formatCurrency(e.amount),
    ];

    const reportData: any[][] = [
        [`PARTIDA: Fondos ACT (PRHTA) — Partidas a cargo de la Autoridad de Carreteras y Transportación`, '', '', '', '', ''],
        HEADER_ROW,
        ...actArr.map(rowOf),
        ['', '', '', '', 'TOTAL ACT:', formatCurrency(actGrand)],
        ['', '', '', '', '', ''],
        [`PARTIDA: Fondos FHWA (Federal) — Partidas a cargo de la Federal Highway Administration`, '', '', '', '', ''],
        HEADER_ROW,
        ...fhwaArr.map(rowOf),
        ['', '', '', '', 'TOTAL FHWA:', formatCurrency(fhwaGrand)],
        ['', '', '', '', '', ''],
        ['', '', '', '', 'GRAN TOTAL:', formatCurrency(grandTotal)],
    ];

    const blob = await generateReport('Distribución de Fondos por Origen (ACT vs FHWA)', reportData, project, COL_WIDTHS, 'landscape', format, `Distribucion_Fondos_${project.num_act}.pdf`, endDate);
};

// ════════════════════════════════════════════════════════════════════════════════════════════════════
// REPORTE DE PRESUPUESTO PROYECTADO POR ORIGEN DE FONDOS (ACT vs FHWA)
// ════════════════════════════════════════════════════════════════════════════════════════════════════
export const generateProjectedFundDistributionReportLogic = async (projectId: string, format: 'pdf' | 'excel' = 'pdf') => {
    const { project, items: originalItems, chos } = await fetchAllReportData(projectId);
    if (!project) return;

    let actOriginal = 0;
    let actCHO = 0;
    let fhwaOriginal = 0;
    let fhwaCHO = 0;

    for (const item of originalItems || []) {
        const amount = roundedAmt((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0), 2);
        if (item.fund_source?.includes('ACT')) {
            actOriginal += amount;
        } else if (item.fund_source?.includes('FHWA')) {
            fhwaOriginal += amount;
        }
    }

    for (const cho of chos || []) {
        for (const item of cho.items || []) {
            const amount = roundedAmt((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0), 2);
            if (item.fund_source?.includes('ACT')) {
                actCHO += amount;
            } else if (item.fund_source?.includes('FHWA')) {
                fhwaCHO += amount;
            }
        }
    }

    actOriginal = roundedAmt(actOriginal, 2);
    actCHO = roundedAmt(actCHO, 2);
    fhwaOriginal = roundedAmt(fhwaOriginal, 2);
    fhwaCHO = roundedAmt(fhwaCHO, 2);

    const actTotal = roundedAmt(actOriginal + actCHO, 2);
    const fhwaTotal = roundedAmt(fhwaOriginal + fhwaCHO, 2);

    const grandOriginal = roundedAmt(actOriginal + fhwaOriginal, 2);
    const grandCHO = roundedAmt(actCHO + fhwaCHO, 2);
    const grandTotal = roundedAmt(actTotal + fhwaTotal, 2);

    const COL_WIDTHS = [160, 130, 130, 132];
    const reportData: any[][] = [
        ['Resumen de Distribución Proyectada', '', '', ''],
        ['Origen de Fondos', 'Contrato Base ($)', 'Órdenes de Cambio ($)', 'Total Presupuestado ($)'],
        ['Fondo ACT', formatCurrency(actOriginal), formatCurrency(actCHO), formatCurrency(actTotal)],
        ['Fondo FHWA', formatCurrency(fhwaOriginal), formatCurrency(fhwaCHO), formatCurrency(fhwaTotal)],
        ['', '', '', ''],
        ['GRAN TOTAL GENERAL:', formatCurrency(grandOriginal), formatCurrency(grandCHO), formatCurrency(grandTotal)]
    ];

    await generateReport('Presupuesto Proyectado por Origen de Fondos', reportData, project, COL_WIDTHS, 'portrait', format, `Presupuesto_Proyectado_${project.num_act}.pdf`);
};

import { generateAct117C } from "./generateAct117C";
import { generateAct117B } from "./generateAct117B";
import { generateAct122 } from "./generateAct122";
import { generateAct123 } from "./generateAct123";
import { generateAct124 } from "./generateAct124";
import { generateRoa } from "./generateRoa";
import { generateTimeAnalysisReportLogic as generateTimeAnalysis } from "@/lib/generateTimeAnalysisReport";
import { generateEnvironmentalReviewReportLogic as generateEnvironmentalReview } from "@/lib/generateEnvironmentalReviewReport";
import { generateFinalEstimateReportLogic as generateFinalEstimate } from "@/lib/generateFinalEstimateReport";
import { generateContractFinalReportLogic as generateContractFinal } from "@/lib/generateContractFinalReport";
import { generateFinalAcceptanceReport } from "./generateFinalChecklistReport";
import { generateFinalAcceptanceReportOfficial } from "./generateFinalAcceptanceReportOfficial";
import { generatePayrollCertificationReport } from "./generatePayrollCertificationReport";
import { generateMaterialCertificationReport } from "./generateMaterialCertificationReport";
import { generateDbeCertificationReport } from "./generateDbeCertificationReport";
import { generateFinalConstructionReport } from "./generateFinalConstructionReport";
import { generateLiquidacionItemsReportLogic as generateLiquidacionGenerator } from "./generateLiquidacionReport";

export const generateAct117CReportLogic = async (projectId: string, certId?: string, format: 'pdf' | 'excel' = 'pdf') => {
    if (format === 'excel') {
        alert("El reporte ACT-117C no está disponible en formato Excel por requerimiento.");
        return;
    }
    const { project, certs } = await fetchAllReportData(projectId);
    if (!project) return;
    let cert = certId ? certs?.find(c => c.id === certId) : (certs && certs.length > 0 ? certs[certs.length - 1] : null);
    if (!cert) {
        alert("No se encontró la certificación de pago.");
        return;
    }
    const blob = await generateAct117C(projectId, cert.id, cert.cert_num, cert.cert_date);
    downloadBlob(blob, `ACT-117C_Cert_${cert.cert_num}_${project.num_act}.pdf`);
};

export const generateAct117BReportLogic = async (projectId: string, certId: string, itemNum: string, format: 'pdf' | 'excel' = 'pdf') => {
    if (format === 'excel') {
        alert("El reporte ACT-117B no está disponible en formato Excel por requerimiento.");
        return;
    }
    const blob = await generateAct117B(projectId, certId, itemNum);
    downloadBlob(blob, `ACT-117B_Item_${itemNum}_Balance_Sheet.pdf`);
};

export const generateFinalAcceptanceChecklistReportLogic = async (projectId: string, format: 'pdf' | 'excel' = 'pdf') => {
    const { project } = await fetchAllReportData(projectId);
    if (!project) return;
    const blob = await generateFinalAcceptanceReport(projectId);
    if (blob) downloadBlob(blob, `Final_Acceptance_Checklist_${project.num_act}.pdf`);
};

export const generateFinalAcceptanceReportOfficialLogic = async (projectId: string, format: 'pdf' | 'excel' = 'pdf') => {
    const { project } = await fetchAllReportData(projectId);
    if (!project) return;
    const blob = await generateFinalAcceptanceReportOfficial(projectId);
    if (blob) downloadBlob(blob, `Final_Acceptance_Report_Official_${project.num_act}.pdf`);
};

export const generatePayrollCertificationReportLogic = async (projectId: string, format: 'pdf' | 'excel' = 'pdf') => {
    const { project } = await fetchAllReportData(projectId);
    if (!project) return;
    const blob = await generatePayrollCertificationReport(projectId);
    if (blob) downloadBlob(blob, `Payroll_Certification_${project.num_act}.pdf`);
};

export const generateMaterialCertificationReportLogic = async (projectId: string, format: 'pdf' | 'excel' = 'pdf') => {
    const { project } = await fetchAllReportData(projectId);
    if (!project) return;
    const blob = await generateMaterialCertificationReport(projectId);
    if (blob) downloadBlob(blob, `Material_Certification_${project.num_act}.pdf`);
};

export const generateDbeCertificationReportLogic = async (projectId: string, format: 'pdf' | 'excel' = 'pdf') => {
    const { project } = await fetchAllReportData(projectId);
    if (!project) return;
    const blob = await generateDbeCertificationReport(projectId);
    if (blob) downloadBlob(blob, `DBE_Certification_${project.num_act}.pdf`);
};

export const generateFinalConstructionReportLogic = async (projectId: string, format: 'pdf' | 'excel' = 'pdf') => {
    const { project } = await fetchAllReportData(projectId);
    if (!project) return;
    const blob = await generateFinalConstructionReport(projectId);
    if (blob) downloadBlob(blob, `Final_Construction_Report_${project.num_act}.pdf`);
};

export const generateAct122ReportLogic = async (projectId: string, choId: string, format: 'pdf' | 'excel' = 'pdf') => {
    const { project, chos } = await fetchAllReportData(projectId);
    const cho = chos?.find(c => c.id === choId);
    if (!project || !cho) return;
    const blob = await generateAct122(projectId, choId);
    if (blob)    downloadBlob(blob, `ACT-122_CHO_${choId}.pdf`);
};

export const generateAct123ReportLogic = async (projectId: string, choId: string, format: 'pdf' | 'excel' = 'pdf') => {
    if (format === 'excel') {
        alert("Este reporte oficial solo está disponible en formato PDF.");
        return;
    }
    const blob = await generateAct123(projectId, choId);
    downloadBlob(blob, `ACT-123_Supplementary_Form_${choId}.pdf`);
};

export const generateAct124ReportLogic = async (projectId: string, choId: string, selectedItems: string[] = [], format: 'pdf' | 'excel' = 'pdf') => {
    if (format === 'excel') {
        alert("El reporte ACT-124 no está disponible en formato Excel por requerimiento.");
        return;
    }
    const { project, chos } = await fetchAllReportData(projectId);
    const cho = chos?.find(c => c.id === choId);
    if (!project || !cho) return;
    const blob = await generateAct124(projectId, choId, selectedItems);
    if (blob) downloadBlob(blob, `ACT-124_CHO_Checklist_${cho.cho_num}_${project.num_act}.pdf`);
};

export const generateRoaReportLogic = async (projectId: string, choId: string, format: 'pdf' | 'excel' = 'pdf') => {
    if (format === 'excel') {
        alert("El reporte ROA no está disponible en formato Excel por requerimiento.");
        return;
    }
    const { project, chos } = await fetchAllReportData(projectId);
    const cho = chos?.find(c => c.id === choId);
    if (!project || !cho) return;
    const blob = await generateRoa(projectId, choId);
    if (blob) downloadBlob(blob, `ROA_CHO_${cho.cho_num}_${project.num_act}.pdf`);
};



export const generateEnvironmentalReviewReportLogic = async (projectId: string, format: 'pdf' | 'excel' = 'pdf') => {
    const { project } = await fetchAllReportData(projectId);
    if (!project) return;
    const blob = await generateEnvironmentalReview(projectId);
    if (blob) downloadBlob(blob, `Environmental_Review_${project.num_act || 'PROJ'}.pdf`);
};

export const generateTimeAnalysisReportLogic = async (projectId: string, format: 'pdf' | 'excel' = 'pdf') => {
    const { project } = await fetchAllReportData(projectId);
    if (!project) return;
    const blob = await generateTimeAnalysis(projectId);
    if (blob) downloadBlob(blob, `Analisis_de_Tiempo_${project.num_act || 'PROJ'}.pdf`);
};

export const generateFinalEstimateReportLogic = async (projectId: string, format: 'pdf' | 'excel' = 'pdf') => {
    const { project } = await fetchAllReportData(projectId);
    if (!project) return;
    const blob = await generateFinalEstimate(projectId);
    if (blob) downloadBlob(blob, `Final_Estimate_${project.num_act || 'PROJ'}.pdf`);
};

export const generateContractFinalReportLogic = async (projectId: string, format: 'pdf' | 'excel' = 'pdf') => {
    const { project } = await fetchAllReportData(projectId);
    if (!project) return;
    const blob = await generateContractFinal(projectId);
    if (blob) downloadBlob(blob, `Contract_Final_Report_${project.num_act || 'PROJ'}.pdf`);
};

export const generateLiquidacionItemsReportLogic = async (projectId: string, format: 'pdf' | 'excel' = 'pdf') => {
    const { project } = await fetchAllReportData(projectId);
    if (!project) return;
    const blob = await generateLiquidacionGenerator(projectId);
    if (blob) {
        downloadBlob(blob, `Hojas_Liquidacion_${project.num_act || project.id}.pdf`);
    }
};



export const generateSignedItemsReportLogic = async (projectId: string, format: 'pdf' | 'excel' = 'pdf') => {
    const { project } = await fetchAllReportData(projectId);
    if (!project) return;

    const { data: items } = await supabase.from('contract_items').select('*').eq('project_id', projectId).order('item_num');
    if (!items) return;

    const liqData = project.liquidation_data || {};
    const liquidatedItems = liqData.liquidated_items || [];

    const reportData: any[][] = [
        ['Item', 'Descripción', 'Por Admin', 'Por Contratista', 'Por Liquidador']
    ];

    items.forEach(it => {
        const liqItem = liquidatedItems.find((l: any) => l.item_num === it.item_num);
        reportData.push([
            it.item_num,
            it.description || '',
            (liqItem && liqItem.signed_by_admin) ? 'Sí' : 'No',
            (liqItem && liqItem.signed_by_contractor) ? 'Sí' : 'No',
            (liqItem && liqItem.signed_by_liquidator) ? 'Sí' : 'No'
        ]);
    });

    // ContentWidth is 552 for portrait. Let's do widths that fit inside 552:
    // 60 + 252 + 80 + 80 + 80 = 552
    const blob = await createPdfBlob('REPORTE DE FIRMAS POR PARTIDAS (LIQUIDACIÓN)', reportData, project, [60, 252, 80, 80, 80], 'portrait');
    if (format === 'excel') {
        const { createExcelBlob } = await import("./reportLogic"); // ya está, pero por si acaso
        const excelBlob = await createExcelBlob('REPORTE DE FIRMAS POR PARTIDAS (LIQUIDACIÓN)', reportData, project);
        downloadBlob(excelBlob, 'Reporte_Firmas_Partidas.xlsx');
    } else {
        downloadBlob(blob, 'Reporte_Firmas_Partidas.pdf');
    }
};

export const generateMinuteReportLogic = async (projectId: string, minuteId: string, format: 'pdf' | 'excel' = 'pdf') => {
    if (format === 'excel') {
        alert("El reporte de minutas no está disponible en formato Excel por requerimiento.");
        return;
    }
    const { data: proj } = await supabase.from("projects").select("*").eq("id", projectId).single();
    const { data: minute } = await supabase.from("meeting_minutes").select("*").eq("id", minuteId).single();
    if (!minute) throw new Error("No se encontró la minuta.");
    const { generateMinutesReport } = await import("./generateMinutesReport");
    const blob = await generateMinutesReport(projectId, {
        summary: "Puntos clave discutidos en la reunión.",
        minutes: minute.content,
        meeting_number: minute.meeting_number,
        meeting_date: minute.meeting_date
    });
    downloadBlob(blob, `Minuta_${minute.meeting_date || 'N/A'}.pdf`);
};

export const generateTimeExtensionChartLogic = async (projectId: string, choId: string, format: 'pdf' | 'excel' = 'pdf') => {
    if (format === 'excel') {
        alert("La gráfica de extensión de tiempo no está disponible en formato Excel.");
        return;
    }
    const { generateTimeExtensionChart } = await import("./generateTimeExtensionChart");
    const blob = await generateTimeExtensionChart(projectId, choId);
    downloadBlob(blob, `Grafica_Ext_Tiempo_CHO_${choId}.pdf`);
};
