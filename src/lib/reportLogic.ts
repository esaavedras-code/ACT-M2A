// @UNIFICATION_RESUMEN_PACT
import { fetchProjectSummary } from "./projectSummary";
// @UNIFICATION_RESUMEN_PACT_END

import { supabase } from "./supabase";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatCurrency as formatC, roundedAmt, formatDate as utilsFormatDate, getLocalStorageItem, formatProjectNumber, getFederalSharePct, getReportFileName, sortItemsNaturally, uniqueSortItems, normalizeFundSource } from "./utils";
import * as XLSX from "xlsx";
import { generateCCMLReport } from "./generateCCMLReport";
import { generateProjectStatusExcel } from "./generateProjectStatusExcel";
import { subcontratosTemplateB64 } from "./subcontratosTemplate";
import ExcelJS from "exceljs";

export const formatCurrency = (val: number, label?: string) => {
    if (val === null || val === undefined || isNaN(val)) return "$0.00";
    let finalVal = val;
    if (label && (label.toLowerCase().includes('retenido') || label.toLowerCase().includes('retencion') || label.toLowerCase().includes('retainage'))) {
        finalVal = -Math.abs(val);
    }
    const formatted = new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(Math.abs(finalVal));
    return finalVal < 0 ? `(${formatted})` : formatted;
};

export const formatNum = (val: number, decimals: number = 2) => {
    if (val === null || val === undefined || isNaN(val)) return "0.00";
    const formatted = Math.abs(val).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    return val < 0 ? `(${formatted})` : formatted;
};

export const formatDate = (dateStr: string) => {
    return utilsFormatDate(dateStr);
};

export const generateSubcontractsReportLogic = async (projectId: string) => {
    try {
        const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single();
        if (!project) throw new Error("Proyecto no encontrado");
        
        const { data: items } = await supabase.from('contract_items').select('*').eq('project_id', projectId);
        
        let montoProyecto = 0;
        if (items) {
            montoProyecto = items.reduce((acc, it) => acc + (parseFloat(it.quantity || 0) * parseFloat(it.unit_price || 0)), 0);
        }
        
        const { data: compliance } = await supabase.from('labor_compliance').select('*').eq('project_id', projectId);
        
        const subcontractors = new Set<string>();
        if (compliance) {
            compliance.forEach(c => {
                if (c.subcontractor_name && c.subcontractor_name.trim() !== "") {
                    subcontractors.add(c.subcontractor_name.trim());
                }
            });
        }
        
        const subList = Array.from(subcontractors).sort();
        
        let arrayBuffer: ArrayBuffer;
        try {
            const binaryString = typeof window !== 'undefined' ? window.atob(subcontratosTemplateB64) : atob(subcontratosTemplateB64);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            arrayBuffer = bytes.buffer;
        } catch (err) {
            throw new Error("No se pudo cargar el template de subcontratos desde Base64.");
        }
        
        // @ts-ignore
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);
        
        const worksheet = workbook.worksheets[0];
        if (!worksheet) throw new Error("El template no tiene hojas");
        
        let rowIdx = 4; // Fila donde inician los datos (0-indexed 3, Excel 4)
        
        if (subList.length === 0) {
            // Si no hay subcontratos, poner uno vacio para no dejar la plantilla rota
            const row = worksheet.getRow(rowIdx);
            row.getCell(2).value = project.region || ""; 
            row.getCell(3).value = project.num_act ? formatProjectNumber(project.num_act) : ""; 
            row.getCell(4).value = project.name || ""; 
            row.getCell(5).value = montoProyecto; 
            row.getCell(6).value = project.admin_name || ""; 
            row.getCell(7).value = ""; 
            row.getCell(8).value = "NO HAY SUBCONTRATOS"; 
            row.getCell(9).value = ""; 
            row.getCell(10).value = ""; 
            row.commit();
        } else {
            for (let i = 0; i < subList.length; i++) {
                const subName = subList[i];
                const row = worksheet.getRow(rowIdx);
                
                let totalSubcontract = 0;
                const subRecord = compliance?.find(c => 
                    c.subcontractor_name && 
                    c.subcontractor_name.trim() === subName && 
                    c.doc_type === "Subcontratos"
                );
                
                if (subRecord && Array.isArray(subRecord.assigned_items)) {
                    subRecord.assigned_items.forEach((ai: any) => {
                        const item = items?.find(it => it.item_num === ai.item_num);
                        const unitPrice = item ? parseFloat(item.unit_price || 0) : 0;
                        const quantity = parseFloat(ai.quantity || 0);
                        totalSubcontract += quantity * unitPrice;
                    });
                }
                
                row.getCell(2).value = project.region || ""; 
                row.getCell(3).value = project.num_act ? formatProjectNumber(project.num_act) : ""; 
                row.getCell(4).value = project.name || ""; 
                row.getCell(5).value = montoProyecto; 
                row.getCell(6).value = project.admin_name || ""; 
                row.getCell(7).value = i + 1; 
                row.getCell(8).value = subName; 
                row.getCell(9).value = totalSubcontract; 
                row.getCell(10).value = ""; 
                
                // Aplicar estilo de la fila 4 a las demas
                if (rowIdx > 4) {
                    const templateRow = worksheet.getRow(4);
                    for (let col = 2; col <= 10; col++) {
                        row.getCell(col).style = templateRow.getCell(col).style;
                    }
                }
                row.commit();
                rowIdx++;
            }
        }
        
        const buf = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        await downloadBlob(blob, `Desglose_Subcontratos_${project.num_act || projectId}.xlsx`, project.num_act);
    } catch (e: any) {
        console.error(e);
        throw e;
    }
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

        const validCerts = certs?.filter((c: any) => !c.excluded) || [];

        return { project, items, chos, certs: validCerts, mfgCerts, agreementFunds };
    } catch (e) {
        console.error("Exception in fetchAllReportData:", e);
        alert("Excepción al cargar datos: " + (e as Error).message);
        return { project: null, items: null, chos: null, certs: null, mfgCerts: null, agreementFunds: null };
    }
};

export const createPdfBlob = async (
    title: string,
    data: any[][],
    projectInfo?: any | null,
    customColWidths?: number[],
    orientation: 'portrait' | 'landscape' = 'portrait',
    cutOffDate?: string | Date,
    subtitle?: string
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

    // Logos eliminados
    const headerY = height - 50;
    // Se eliminó el logo de M2A y ACT por requerimiento del usuario.

    // Centered Headers
    centerText('Sistema de Control de Proyectos', timesRomanFont, 10, y);
    y -= 15;
    if (projectInfo) {
        const cleanAct = formatProjectNumber(projectInfo.num_act);
        centerText(`PROYECTO: ${projectInfo.name || 'N/A'} - ${cleanAct}`, timesRomanBoldFont, 12, y);
        y -= 15;

        // Project Details Header Block
        const mun = Array.isArray(projectInfo.municipios) ? projectInfo.municipios.join(', ') : (projectInfo.municipios || 'N/A');
        const detailRows = [
            `Num. Federal: ${projectInfo.num_federal || 'N/A'}  |  Contrato: ${projectInfo.num_contrato || 'N/A'}  |  Región: ${projectInfo.region || 'N/A'}`,
            `Municipios: ${mun}  |  Contratista: ${projectInfo.contractor_name || 'N/A'}`,
            `${projectInfo.admin_title || 'Admin'}: ${projectInfo.admin_name || 'N/A'}  |  PM: ${projectInfo.project_manager_name || 'N/A'}`
        ];

        detailRows.forEach(line => {
            centerText(line, timesRomanFont, 8.5, y);
            y -= 10;
        });
        y -= 8;
    }
    centerText(title, timesRomanBoldFont, 14, y);
    y -= 15;
    if (subtitle) {
        centerText(subtitle, timesRomanBoldFont, 13, y);
        y -= 15;
    }
    y -= 3;
    const nowForPrint = new Date();
    const timeStr = nowForPrint.toLocaleTimeString('es-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    centerText(`Fecha de impresión del reporte: ${utilsFormatDate(nowForPrint)} ${timeStr}`, timesRomanFont, 9, y);
    y -= 12;
    if (cutOffDate) {
        const cutDate = new Date(cutOffDate);
        const today = new Date();
        const isToday = cutDate.getFullYear() === today.getFullYear() && 
                        cutDate.getMonth() === today.getMonth() && 
                        cutDate.getDate() === today.getDate();
        
        if (cutOffDate) {
            centerText(`Fecha de Corte de Información: ${utilsFormatDate(cutDate)}`, timesRomanFont, 9, y);
            y -= 12;
        }
    }
    y -= 18;

    const colCount = data[0]?.length || 1;
    const colWidths = customColWidths || Array(colCount).fill(contentWidth / colCount);
    const totalTableWidth = colWidths.reduce((acc, w) => acc + w, 0);
    const tableMarginX = marginX + Math.max(0, (contentWidth - totalTableWidth) / 2);

    let savedHeader: { height: number, lines: any[] } | null = null;
    const headerRowIndex = data.findIndex(r => !r.slice(1).every(c => !c || c.toString().trim() === ''));
    const actualHeaderIndex = headerRowIndex !== -1 ? headerRowIndex : 0;

    data.forEach((row, rowIndex) => {
        const isHeader = rowIndex === actualHeaderIndex;
        const isEmpty = row.every(cell => !cell || cell.toString().trim() === '');
        const isPartida = row[0]?.toString().startsWith('PARTIDA') || row[0]?.toString().startsWith('BALANCE TOTAL PARA FUENTE');
        // isSubtitleRow: first cell has content and the rest are empty OR the first cell is all-caps section title
        const restEmpty = row.slice(1).every(cell => !cell || cell.toString().trim() === '');
        const firstCellText = (row[0]?.toString() || '').trim();
        const isAllCapsTitle = restEmpty && firstCellText.length > 4 && firstCellText === firstCellText.toUpperCase() && /[A-Z]/.test(firstCellText);
        const isSubtitleRow = !isHeader && row[0] && (restEmpty);

        if (isEmpty) {
            y -= 10;
            return;
        }

        const fontSize = isHeader ? 9 : 8;
        const lineHeight = fontSize + 4;

        const rowHasSubtitle = row.some(cell => /^\s*\d+\.\s+[A-ZÁÉÍÓÚÑ]/.test(cell?.toString() || ''));
        const rowHasItemNum = !isHeader && /^\d+([-(A-Z]|$)/.test(row[0]?.toString() || '');
        const rowIsSpecial = rowHasSubtitle || rowHasItemNum;

        const cellLines = row.map((text, idx) => {
            const textStr = (text?.toString() || '').trim();
            let width = colWidths[idx] || 50;
            if (isSubtitleRow && idx === 0) {
                width = totalTableWidth;
            }
            
            const isSubtitle = /^\s*\d+\.\s+[A-ZÁÉÍÓÚÑ]/.test(textStr);
            const isItemNum = !isHeader && idx === 0 && row[0] && /^\d+([-(A-Z]|$)/.test(textStr);
            
            const excludeAutoBold = title.includes('CERTIFICADOS DE MANUFACTURA');
            const useBold = isHeader || isPartida || isSubtitleRow || ((isSubtitle || isItemNum || rowIsSpecial) && !excludeAutoBold) || textStr.endsWith(':') ||
                textStr.toLowerCase() === 'sí' || textStr.toLowerCase() === 'si' ||
                textStr === 'Rol / Puesto' || textStr === 'Nombre' || textStr === 'Contacto' || textStr === 'Oficina' || textStr === 'Celular' || textStr === 'Email';
            const cellFont = useBold ? timesRomanBoldFont : timesRomanFont;
            const displayFontSize = (isSubtitle || isSubtitleRow) ? fontSize + 3.5 : (isItemNum || rowIsSpecial) ? fontSize + 2.5 : fontSize;
            return {
                lines: splitTextIntoLines(textStr === '' ? '' : text, width, cellFont, displayFontSize),
                font: cellFont,
                useBold,
                isRed: !isHeader && (
                    (/^\(?[$-]?[0-9,.]+\)?$/.test(textStr)) && 
                    (textStr.startsWith('-') || textStr.startsWith('(') || parseFloat(textStr.replace(/[^0-9.-]/g, '')) < 0)
                ),
                displayFontSize
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
                    x: tableMarginX, y: y - headerHeight,
                    width: totalTableWidth, height: headerHeight,
                    color: rgb(0.05, 0.2, 0.45),
                });
                
                let cx = tableMarginX;
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
                    start: { x: tableMarginX + totalTableWidth, y },
                    end: { x: tableMarginX + totalTableWidth, y: y - headerHeight },
                    thickness: 0.5,
                    color: rgb(0.8, 0.8, 0.8),
                });
                // Top/Bottom Borders
                page.drawLine({
                    start: { x: tableMarginX, y },
                    end: { x: tableMarginX + totalTableWidth, y },
                    thickness: 0.5,
                    color: rgb(0.8, 0.8, 0.8),
                });
                page.drawLine({
                    start: { x: tableMarginX, y: y - headerHeight },
                    end: { x: tableMarginX + totalTableWidth, y: y - headerHeight },
                    thickness: 0.5,
                    color: rgb(0.8, 0.8, 0.8),
                });
                
                y -= headerHeight;
            }
        }

        // Row background
        if (isHeader) {
            page.drawRectangle({
                x: tableMarginX, y: y - rowHeight,
                width: totalTableWidth, height: rowHeight,
                color: rgb(0.05, 0.2, 0.45),
            });
        } else if (isSubtitleRow) {
            page.drawRectangle({
                x: tableMarginX, y: y - rowHeight,
                width: totalTableWidth, height: rowHeight,
                color: rgb(0.18, 0.32, 0.55),
            });
        } else if (isPartida) {
            page.drawRectangle({
                x: tableMarginX, y: y - rowHeight,
                width: totalTableWidth, height: rowHeight,
                color: rgb(0.95, 0.96, 0.98),
            });
        }

        let currX = tableMarginX;
        cellLines.forEach((cellData, cellIdx) => {
            if (isSubtitleRow && cellIdx > 0) return;

            let textColor = (isHeader || isSubtitleRow) ? rgb(1, 1, 1) : rgb(0, 0, 0);
            if (!isHeader && !isSubtitleRow && cellData.isRed) {
                textColor = rgb(0.8, 0, 0); // Rojo
            }
            const currentColWidth = (isSubtitleRow && cellIdx === 0) ? totalTableWidth : (colWidths[cellIdx] || 50);

            cellData.lines.forEach((line, lineIdx) => {
                const rgx = /(\d{3}-[A-Z0-9a-z]+)/g;
                const parts = line.split(rgx);
                let currentTextX = currX + 5;
                
                parts.forEach(part => {
                    if (!part) return;
                    const isMatch = rgx.test(part);
                    rgx.lastIndex = 0; // reset
                    const currentFont = isMatch && !isHeader ? timesRomanBoldFont : cellData.font;
                    const finalFontSize = (cellData as any).displayFontSize || fontSize;
                    
                    page.drawText(part, {
                        x: currentTextX,
                        y: y - (lineIdx + 1) * lineHeight - 5,
                        size: finalFontSize,
                        font: currentFont,
                        color: textColor,
                    });
                    currentTextX += currentFont.widthOfTextAtSize(part, finalFontSize);
                });
            });

            // Vertical Border
            if (!isSubtitleRow) {
                page.drawLine({
                    start: { x: currX, y },
                    end: { x: currX, y: y - rowHeight },
                    thickness: 0.5,
                    color: rgb(0.8, 0.8, 0.8),
                });
            }

            currX += currentColWidth;
        });

        // Final Vertical Border
        page.drawLine({
            start: { x: tableMarginX + totalTableWidth, y },
            end: { x: tableMarginX + totalTableWidth, y: y - rowHeight },
            thickness: 0.5,
            color: rgb(0.8, 0.8, 0.8),
        });

        // Top/Bottom Borders
        if (isHeader) {
            page.drawLine({
                start: { x: tableMarginX, y },
                end: { x: tableMarginX + totalTableWidth, y },
                thickness: 0.5,
                color: rgb(0.8, 0.8, 0.8),
            });
        }
        page.drawLine({
            start: { x: tableMarginX, y: y - rowHeight },
            end: { x: tableMarginX + totalTableWidth, y: y - rowHeight },
            thickness: 0.5,
            color: rgb(0.8, 0.8, 0.8),
        });

        y -= rowHeight;
    });

    // Add Page Numbers only if more than one page
    const pages = pdfDoc.getPages();
    if (pages.length > 1) {
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
    }

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
    projectInfo?: any | null,
    cutOffDate?: string | Date
) => {
    // @ts-ignore
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Reporte');

    const cutStr = cutOffDate ? utilsFormatDate(new Date(cutOffDate)) : "";
    const todayStr = utilsFormatDate(new Date());

    // --- ESTILOS ---
    // @ts-ignore
    const titleStyle: Partial<ExcelJS.Style> = {
        font: { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }, // Slate-800
        alignment: { horizontal: 'center', vertical: 'middle' }
    };

    // @ts-ignore
    const headerStyle: Partial<ExcelJS.Style> = {
        font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } }, // Slate-700
        border: {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        },
        alignment: { horizontal: 'center', vertical: 'middle' }
    };

    // @ts-ignore
    const infoStyle: Partial<ExcelJS.Style> = {
        font: { name: 'Arial', size: 10, bold: true },
        alignment: { horizontal: 'left' }
    };

    // --- ENCABEZADO DEL PROYECTO ---
    worksheet.addRow([title]).getCell(1).style = titleStyle;
    worksheet.mergeCells(1, 1, 1, 8);
    worksheet.getRow(1).height = 30;

    if (projectInfo) {
        const p1 = worksheet.addRow([`PROYECTO: ${projectInfo.name} - ${formatProjectNumber(projectInfo.num_act)}`]);
        p1.getCell(1).style = infoStyle;
        worksheet.mergeCells(p1.number, 1, p1.number, 8);

        const p2 = worksheet.addRow([`Fed: ${projectInfo.num_federal || 'N/A'} | Contrato: ${projectInfo.num_contrato || 'N/A'} | Region: ${projectInfo.region || 'N/A'}`]);
        p2.getCell(1).font = { italic: true, size: 9 };
        worksheet.mergeCells(p2.number, 1, p2.number, 8);

        const p3 = worksheet.addRow([`Municipios: ${Array.isArray(projectInfo.municipios) ? projectInfo.municipios.join(', ') : (projectInfo.municipios || 'N/A')}`]);
        p3.getCell(1).font = { size: 9 };
        worksheet.mergeCells(p3.number, 1, p3.number, 8);

        const p4 = worksheet.addRow([`Contratista: ${projectInfo.contractor_name || 'N/A'} | PM: ${projectInfo.project_manager_name || 'N/A'} | Admin: ${projectInfo.admin_name || 'N/A'}`]);
        p4.getCell(1).font = { size: 9 };
        worksheet.mergeCells(p4.number, 1, p4.number, 8);
    }

    const d1 = worksheet.addRow([`Fecha de Impresión: ${todayStr}${cutStr ? ` | Fecha de Corte: ${cutStr}` : ""}`]);
    d1.getCell(1).font = { size: 9, color: { argb: 'FF64748B' } };
    worksheet.mergeCells(d1.number, 1, d1.number, 8);

    worksheet.addRow([]); // Espacio

    // --- DATOS ---
    if (data.length > 0) {
        // La primera fila de data suele ser el encabezado de la tabla
        const headerRow = worksheet.addRow(data[0]);
        headerRow.eachCell((cell) => {
            cell.style = headerStyle;
        });

        // El resto de las filas
        for (let i = 1; i < data.length; i++) {
            const row = worksheet.addRow(data[i]);
            row.eachCell((cell, colNumber) => {
                // Estilo básico para celdas de datos
                cell.font = { name: 'Arial', size: 9 };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                };

                // Si la celda es un número, intentar formatearla
                const val = cell.value?.toString() || "";
                if (val.includes('$') || (typeof cell.value === 'number' && colNumber >= 5)) {
                    cell.alignment = { horizontal: 'right' };
                }
                
                // Si la fila parece un subtotal (contiene "TOTAL" o "BALANCE")
                const rowText = data[i].join(" ").toUpperCase();
                if (rowText.includes("TOTAL") || rowText.includes("BALANCE") || rowText.includes("GRAN TOTAL")) {
                    cell.font = { bold: true, name: 'Arial', size: 9 };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                }
                
                // Si la fila es un separador o título de sección
                if (data[i][0] && data[i][0].toString().includes("PARTIDA") && !data[i][1]) {
                    cell.font = { bold: true, size: 10, color: { argb: 'FF1E293B' } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
                    worksheet.mergeCells(row.number, 1, row.number, 8);
                }
            });
        }
    }

    // Auto-ajustar anchos de columna (aproximado)
    worksheet.columns.forEach((column: any, i: any) => {
        let maxLen = 10;
        column.eachCell!({ includeEmpty: true }, (cell: any) => {
            const len = cell.value ? cell.value.toString().length : 0;
            if (len > maxLen) maxLen = len;
        });
        column.width = Math.min(maxLen < 12 ? 12 : maxLen + 2, 50);
    });

    const buf = await workbook.xlsx.writeBuffer();
    return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

export const downloadBlob = async (blob: Blob, filename: string, projectNum?: string) => {
    try {
        let finalFilename = filename;
        if (projectNum) {
            // Extraer el nombre base del reporte (quitar extensiones y prefijos comunes)
            let reportBase = filename.replace(/\.(pdf|xlsx|xls)$/i, '');
            // Si el nombre base no sigue el formato ACXXXXXX, lo formateamos
            if (!reportBase.startsWith('AC')) {
                finalFilename = getReportFileName(projectNum, reportBase);
                // Restaurar extensión
                const ext = filename.split('.').pop();
                finalFilename = `${finalFilename}.${ext}`;
            }
        }

        console.log("Intentando descargar:", finalFilename, "size:", blob.size);
        if (!blob || blob.size === 0) {
            alert("Error: El documento está vacío o no se generó correctamente.");
            return;
        }

        // --- Soporte para Electron con carpeta personalizada ---
        // @ts-ignore
        if (window.electronAPI) {
            let defaultFolder = getLocalStorageItem("pact_reports_folder");
            
            if (!defaultFolder) {
                // @ts-ignore
                const selected = await window.electronAPI.selectFolder();
                if (selected) {
                    // @ts-ignore
                    window.localStorage.setItem("pact_reports_folder", selected);
                    defaultFolder = selected;
                }
            }

            if (defaultFolder) {
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                return new Promise((resolve) => {
                    reader.onloadend = async () => {
                        const base64data = reader.result as string;
                        const cleanBase64 = base64data.split(',')[1];
                        const fullPath = `${defaultFolder}\\${finalFilename}`.replace(/\//g, '\\').replace(/\\\\/g, '\\');
                        
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
                            link.download = finalFilename;
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
        link.download = finalFilename;
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
        downloadBlob(blob, filename.replace('.pdf', '.xlsx'), project?.num_act);
    } else {
        const blob = await createPdfBlob(title, data, project, widths, orient, cutOffDate);
        downloadBlob(blob, filename, project?.num_act);
    }
};

export const generateBalanceReportLogic = async (projectId: string, format: 'pdf' | 'excel' = 'pdf', endDate?: string) => {
    const { project, items, chos, certs } = await fetchAllReportData(projectId);
    if (!items) return;

    const cutOff = endDate ? new Date(`${endDate}T23:59:59`) : new Date();

    // Filtramos CHOs y certs por fecha de corte
    const filteredChos = chos?.filter(c => new Date(c.cho_date) <= cutOff) || [];
    const filteredCerts = certs?.filter(c => new Date(c.cert_date) <= cutOff) || [];

    // Coleccionamos todos los números de ítems únicos
    const allItemNums = new Set(items.map(i => i.item_num));
    filteredChos.forEach(c => {
        const choItems = Array.isArray(c.items) ? c.items : [];
        choItems.forEach((ci: any) => {
            if (ci.item_num) allItemNums.add(ci.item_num);
        });
    });

    const sortedItemNums = Array.from(allItemNums).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const balances = sortedItemNums.map(itemNum => {
        const baseItem = items.find(i => i.item_num === itemNum);
        const origQty = baseItem ? (parseFloat(baseItem.quantity) || 0) : 0;
        const description = baseItem ? [baseItem.description, baseItem.additional_description].filter(Boolean).join(' - ') : "";
        const unit = baseItem ? baseItem.unit : "";
        const fundSource = normalizeFundSource(baseItem?.fund_source);
        const unitPrice = baseItem ? (parseFloat(baseItem.unit_price) || 0) : 0;

        let totalChoQty = 0;
        let choDescription = "";
        let choUnitPrice = 0;
        let choFundSource = "";

        filteredChos.forEach(c => {
            const choItems = Array.isArray(c.items) ? c.items : [];
            const match = choItems.find((ci: any) => ci.item_num === itemNum);
            if (match) {
                totalChoQty += (parseFloat(match.proposed_change !== undefined ? match.proposed_change : match.quantity) || 0);
                if (!description && match.description) choDescription = match.description;
                if (match.unit_price) choUnitPrice = parseFloat(match.unit_price);
                if (match.fund_source) choFundSource = normalizeFundSource(match.fund_source);
            }
        });

        const certQty = filteredCerts.reduce((acc, c) => {
            const certItems = Array.isArray(c.items) ? c.items : (c.items?.list || []);
            const match = certItems.find((it: any) => it.item_num === itemNum);
            return acc + (parseFloat(match?.quantity || 0));
        }, 0);

        const totalQty = origQty + totalChoQty;
        const balance = totalQty - certQty;
        const price = unitPrice || choUnitPrice || 0;
        const balanceAmount = balance * price;

        return { 
            item_num: itemNum, 
            description: description || choDescription || "Ítem nuevo por CHO", 
            unit: unit || "UN", 
            origQty, 
            choQty: totalChoQty, 
            totalQty, 
            certQty, 
            balance,
            fundSource: fundSource !== "N/A" ? fundSource : (choFundSource || "N/A"),
            balanceAmount
        };
    });

    // Agrupar por fundSource
    const grouped = new Map<string, any[]>();
    balances.forEach(b => {
        const key = b.fundSource;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(b);
    });

    const reportData: any[][] = [['Item', 'Descripción', 'Unidad', 'C. Orig', 'CHO', 'Total', 'Certific.', 'Balance']];
    
    grouped.forEach((groupItems, source) => {
        const cleanSource = source.startsWith('AC:') ? source.replace(/^AC:/, ':') : source;
        reportData.push([`PARTIDA / FUENTE DE FONDOS: ${cleanSource}`, '', '', '', '', '', '', '']);
        
        let subtotalQty = 0;
        let subtotalAmount = 0;

        groupItems.forEach((b: any) => {
            reportData.push([
                b.item_num,
                b.description,
                b.unit,
                formatNum(b.origQty),
                formatNum(b.choQty),
                formatNum(b.totalQty),
                formatNum(b.certQty * -1),
                formatNum(b.balance)
            ]);
            
            // Línea de balance total por partida (item)
            reportData.push([
                '',
                '   TOTAL BALANCE DE ESTA PARTIDA:',
                '',
                '',
                '',
                '',
                'QTY:',
                formatNum(b.balance)
            ]);
            reportData.push([
                '',
                '',
                '',
                '',
                '',
                '',
                'AMOUNT:',
                formatCurrency(b.balanceAmount)
            ]);
            
            subtotalQty += b.balance;
            subtotalAmount += b.balanceAmount;
        });

        reportData.push([
            '-------------------------------------------', 
            '', '', '', '', '', '', ''
        ]);
        reportData.push([
            `BALANCE TOTAL PARA FUENTE: ${cleanSource}`, 
            '', '', '', '', '', '', ''
        ]);
        reportData.push([
            '', 
            '', 
            '', 
            '', 
            '', 
            '', 
            'TOTAL QTY:', 
            formatNum(subtotalQty)
        ]);
        reportData.push([
            '', 
            '', 
            '', 
            '', 
            '', 
            '', 
            'TOTAL AMT:', 
            formatCurrency(subtotalAmount)
        ]);
        reportData.push(['', '', '', '', '', '', '', '']); // Espacio entre partidas
    });

    if (format === 'excel') {
        const blob = await generateBalancesExcel(projectId);
        downloadBlob(blob, `Balances_Actuales_${project.num_act}.xlsx`, project.num_act);
        return;
    }

    await generateReport('REPORTE DE BALANCES DE PARTIDAS', reportData, project, [40, 220, 60, 80, 80, 80, 80, 80], 'landscape', format, 'Reporte_Balances_Partidas.pdf', endDate);
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

    const reportData: any[][] = [['ITEM', 'SPEC.', 'DESCRIPTION / ACTIVITY', 'QUANTITY', 'UNIT', 'UNIT PRICE', 'AMOUNT', 'BALANCE QUANTITY', 'BALANCE AMOUNT']];

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
                const desc = match.description || "Ítem nuevo por CHO";
                const addDesc = match.additional_description || "";
                fullDescription = [desc, addDesc].filter(Boolean).join(' - ');
                spec = match.specification || "";
            }
        }

        reportData.push([itemNum, spec || '', fullDescription || '', '', '', '', '', '', '']);
        
        if (baseItem) {
            const origQty = parseFloat(baseItem.quantity) || 0;
            currentBalance += origQty;
            reportData.push(['', '', '  - Cantidad Original de Contrato', origQty.toFixed(2), unit || '', formatCurrency(uPrice), formatCurrency(roundedAmt(origQty * uPrice, 2)), currentBalance.toFixed(2), formatCurrency(roundedAmt(currentBalance * uPrice, 2))]);
        }

        const itemChos = filteredChos.filter(c => (Array.isArray(c.items) ? c.items : []).some((i: any) => i.item_num === itemNum));
        itemChos.forEach(c => {
            const i = (c.items as any[]).find(it => it.item_num === itemNum);
            if (i) {
                const choQty = parseFloat(i.proposed_change !== undefined ? i.proposed_change : i.quantity) || 0;
                currentBalance += choQty;
                const statusStr = c.doc_status === "Borrador" ? "" : ` ${c.doc_status}`;
                reportData.push(['', '', `  - CHO #${c.cho_num}${c.amendment_letter || ''}${statusStr} (${formatDate(c.cho_date)})`, choQty.toFixed(2), unit || '', formatCurrency(uPrice), formatCurrency(roundedAmt(choQty * uPrice, 2)), currentBalance.toFixed(2), formatCurrency(roundedAmt(currentBalance * uPrice, 2))]);
            }
        });

        const itemCerts = filteredCerts.filter(c => (Array.isArray(c.items) ? c.items : (c.items?.list || [])).some((it: any) => it.item_num === itemNum));
        itemCerts.forEach(c => {
            const i = (Array.isArray(c.items) ? c.items : (c.items?.list || [])).find((it: any) => it.item_num === itemNum);
            if (i) {
                const certQty = parseFloat(i.quantity) || 0;
                currentBalance -= certQty;
                const amt = roundedAmt(certQty * uPrice, 2);
                reportData.push(['', '', `  - Certificación de Pago #${c.cert_num} (${formatDate(c.cert_date)})`, (-certQty).toFixed(2), unit || '', formatCurrency(uPrice), `-${formatCurrency(amt)}`, currentBalance.toFixed(2), formatCurrency(roundedAmt(currentBalance * uPrice, 2))]);
            }
        });
        reportData.push(['', '', '', '', '', '', '', '', '']);
    });

    if (format === 'excel') {
        const blob = await generateDetailExcel(projectId);
        downloadBlob(blob, `Detalle_de_Partidas_${project?.num_act}.xlsx`, project?.num_act);
        return;
    }

    await generateReport('REPORTE DETALLADO DE PARTIDAS (CHO Y CERTIFICACIONES)', reportData, project, [45, 55, 230, 70, 50, 70, 70, 70, 70], 'landscape', format, `Reporte_Detalle_Partidas_${project?.num_act || projectId}.pdf`, endDate);
};

export const generateMfgReportLogic = async (projectId: string, format: 'pdf' | 'excel' = 'pdf') => {
    const { project, items, mfgCerts } = await fetchAllReportData(projectId);
    if (!mfgCerts) return;

    const sortedMfgCerts = [...mfgCerts].sort((a: any, b: any) => {
        const itemA = items?.find(i => i.id === a.item_id);
        const itemB = items?.find(i => i.id === b.item_id);
        const numA = itemA?.item_num || a.item_num || "";
        const numB = itemB?.item_num || b.item_num || "";
        return numA.toString().localeCompare(numB.toString(), undefined, { numeric: true });
    });

    const data = [
        ['Item', 'Especificación', 'Descripción', 'Cantidad del certificado (CM)', 'Unidades', 'Fecha del certificado'],
        ...sortedMfgCerts.map((c: any) => {
            const it = items?.find(i => i.id === c.item_id || i.item_num === c.item_num);
            const unit = it?.unit || '';
            const fullDescription = [it?.description, it?.additional_description].filter(Boolean).join(' - ');
            return [
                it?.item_num || c.item_num || '',
                it?.specification || c.specification || '',
                fullDescription || c.material_description || '',
                formatNum(c.quantity),
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
        let baseCertQty = certs?.reduce((acc: number, c: any) => {
            const itemsList = Array.isArray(c.items) ? c.items : (c.items?.list || []);
            const foundItem = itemsList.find((it: any) => it.item_num === b.item_num);
            return acc + (foundItem ? (parseFloat(foundItem.quantity) || 0) : 0);
        }, 0) || 0;

        let certQty = baseCertQty;

        if (b.unit?.toUpperCase() === 'LS') {
            if (baseCertQty > 0) {
                const mfgQtyNeeded = parseFloat(b.mfg_cert_qty);
                if (!isNaN(mfgQtyNeeded) && mfgQtyNeeded > 0) {
                    certQty = mfgQtyNeeded;
                } else {
                    certQty = 1; // Default fallback for LS if no quantity is specified
                }
            } else {
                certQty = 0; // Si no ha sido pagada, no se considera ejecutada
            }
        }

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
    }).filter((m: any) => m.missing >= 0.0001);

    missingCerts.sort((a: any, b: any) => a.item_num.toString().localeCompare(b.item_num.toString(), undefined, { numeric: true }));

    if (missingCerts.length === 0) throw new Error("NO_FALTA_NINGUNO");

    const data = [
        ['Item', 'Especificación', 'Descripción', 'Cantidad ejecutada', 'Unidad', 'Cantidad en CM', 'Cantidad sin CM', 'Fecha del CM'],
        ...missingCerts.map((m: any) => [
            m.item_num, 
            m.spec, 
            m.desc, 
            formatNum(m.certQty),
            m.unit,
            formatNum(m.mfgQty), 
            formatNum(m.missing), 
            m.date
        ])
    ];

    await generateReport('REPORTE DE CERTIFICADOS DE MANUFACTURA (CM) QUE FALTAN', data, project, [40, 70, 180, 80, 50, 80, 80, 90], 'landscape', format, 'Certificados_CM_Faltantes.pdf');
};

const getInvoicePU = (certsList: any[], itemNum: string, currentCertIdx: number) => {
    for (let i = currentCertIdx; i >= 0; i--) {
        if (!certsList[i]) continue;
        const its = Array.isArray(certsList[i].items) ? certsList[i].items : (certsList[i].items?.list || []);
        const match = its.find((itx: any) => itx.item_num === itemNum && itx.has_material_on_site && parseFloat(itx.mos_unit_price) > 0);
        if (match) return parseFloat(match.mos_unit_price);
    }
    return 0;
};

export const generateMosReportLogic = async (projectId: string, format: 'pdf' | 'excel' = 'pdf', endDate?: string) => {
    const { project, items: itemsRepo, certs } = await fetchAllReportData(projectId);
    if (!certs) return;

    const cutOff = endDate ? new Date(`${endDate}T23:59:59`) : new Date();
    const filteredCerts = certs?.filter(c => new Date(c.cert_date) <= cutOff) || [];

    const groupedItems = new Map<string, any>();
    const balances = new Map<string, number>();

    filteredCerts.forEach((c: any, cIdx: number) => {
        const items = Array.isArray(c.items) ? c.items : (c.items?.list || []);
        items.forEach((it: any) => {
            const itemNum = it.item_num;
            if (!itemNum) return;

            const workQty = parseFloat(it.quantity) || 0;
            const manualDeductionQty = parseFloat(it.qty_from_mos) || 0;
            const hasAddition = !!it.has_material_on_site || (it.mos_invoice_total && parseFloat(it.mos_invoice_total) > 0);

            const currentBalance = balances.get(itemNum) || 0;
            const mosPU = getInvoicePU(filteredCerts, itemNum, cIdx);
            const price = mosPU > 0 ? mosPU : (parseFloat(it.unit_price) || 0);

            // Incluir la adición de esta misma cert al balance disponible para deducción
            const additionCostThisCert = hasAddition ? (parseFloat(it.mos_invoice_total) || 0) : 0;
            const balanceForDeduction = currentBalance + additionCostThisCert;

            let deductionQty = 0;
            if (balanceForDeduction > 0.01) {
                const availableQty = balanceForDeduction / (price || 1);
                if (manualDeductionQty > 0) {
                    deductionQty = Math.min(manualDeductionQty, availableQty);
                } else if (workQty > 0) {
                    deductionQty = Math.min(workQty, availableQty);
                }
            }

            const hasDeduction = deductionQty > 0;

            if (hasAddition || hasDeduction) {
                if (!groupedItems.has(itemNum)) {
                    const matchCi = itemsRepo?.find((i: any) => i.item_num === itemNum);
                    const fullDesc = [it.description || matchCi?.description, matchCi?.additional_description].filter(Boolean).join(' - ');
                    groupedItems.set(itemNum, { item_num: itemNum, spec: it.specification || '', desc: fullDesc || '', activities: [] });
                }
                const group = groupedItems.get(itemNum);

                if (hasAddition) {
                    const cost = parseFloat(it.mos_invoice_total) || 0;
                    group.activities.push({ 
                        certNum: c.cert_num, 
                        type: 'Adición (Factura)', 
                        qty: parseFloat(it.mos_quantity) || 0, 
                        cost: cost 
                    });
                    balances.set(itemNum, roundedAmt(currentBalance + cost, 2));
                }

                if (hasDeduction) {
                    const cost = roundedAmt(deductionQty * price, 2);
                    group.activities.push({ 
                        certNum: c.cert_num, 
                        type: 'Deducción (WP)', 
                        qty: -deductionQty, 
                        cost: -cost 
                    });
                    const newBal = roundedAmt((balances.get(itemNum) || 0) - cost, 2);
                    balances.set(itemNum, Math.max(0, newBal));
                }
            }
        });
    });


    const reportData: any[][] = [['# Item', 'Especificación', 'Descripción', 'Cert #', 'Tipo', 'Cantidad', 'Unidad', 'Monto ($)', 'Balance ($)']];
    let totalFinalBalance = 0;
    Array.from(groupedItems.values())
        .sort((a, b) => a.item_num.localeCompare(b.item_num, undefined, { numeric: true }))
        .forEach(group => {
        const it = (itemsRepo || []).find((i: any) => i.item_num === group.item_num);
        const unit = it?.unit || '';
        let itemBalance = 0;
        group.activities.forEach((act: any, idx: number) => {
            itemBalance = roundedAmt(itemBalance + act.cost, 2);
            reportData.push([
                idx === 0 ? group.item_num : '', 
                idx === 0 ? group.spec : '', 
                idx === 0 ? group.desc : '', 
                `#${act.certNum}`, 
                act.type, 
                formatNum(act.qty), 
                unit, 
                formatCurrency(act.cost), 
                formatCurrency(itemBalance)
            ]);
        });
        totalFinalBalance = roundedAmt(totalFinalBalance + itemBalance, 2);
        reportData.push(['', '', '', '', '', '', '', '', '']);
    });
    // Last row: spread title across columns so it's not compressed in one cell
    reportData.push(['BALANCE', 'TOTAL EN', 'INVENTARIO (MOS):', '', '', '', '', '', formatCurrency(totalFinalBalance)]);

    await generateReport('REPORTE DE MATERIAL ON SITE (MOS)', reportData, project, [50, 70, 160, 45, 85, 60, 35, 75, 120], 'landscape', format, 'Reporte_Material_On_Site.pdf', endDate);
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

    await downloadBlob(blob, `CCML_${suffix}.xlsx`, project.num_act);
};




export const generateChoReportLogic = async (projectId: string, choIds: string[], format: 'pdf' | 'excel' = 'pdf') => {
    const { project, chos, items: itemsRepo } = await fetchAllReportData(projectId);
    if (!chos) return;
    const selectedChos = chos.filter(c => choIds.includes(c.id));
    if (selectedChos.length === 0) return;

    const reportData: any[][] = [['Ítem', 'Descripción', 'Cambio Propuesto', 'Unidad', 'Costo Unitario', 'Monto Total']];
    selectedChos.forEach(cho => {
        reportData.push([`ORDEN DE CAMBIO (CHO) #${cho.cho_num}`, `Fecha: ${formatDate(cho.cho_date)}`, '', '', '', '']);
        const items = sortItemsNaturally(Array.isArray(cho.items) ? cho.items : []);
        let choTotal = 0;
        items.forEach((it: any) => {
            const matchCi = itemsRepo?.find((i: any) => i.item_num === it.item_num);
            const desc = it.description || matchCi?.description || "";
            const addDesc = it.additional_description || matchCi?.additional_description || "";
            const fullDesc = [desc, addDesc].filter(Boolean).join(' - ');
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
        const currentCertItemsRaw = Array.isArray(cert.items) ? cert.items : (cert.items?.list || []);
        const sortedItems = uniqueSortItems([...currentCertItemsRaw]);
        let subtotal = 0;
        let mosDelta = 0;
        sortedItems.forEach((it: any) => {
            const matchCi = itemsRepo?.find((i: any) => i.item_num === it.item_num);
            const desc = it.description || matchCi?.description || "";
            const addDesc = it.additional_description || matchCi?.additional_description || "";
            const fullDesc = [desc, addDesc].filter(Boolean).join(' - ');
            const qty = parseFloat(it.quantity) || 0;
            const pu = parseFloat(it.unit_price) || 0;
            const total = qty * pu;
            subtotal += total;
            reportData.push([it.item_num || '', fullDesc || '', formatNum(qty), it.unit || '', formatCurrency(pu), formatCurrency(total)]);
            // MOS
            if (it.has_material_on_site) mosDelta += parseFloat(it.mos_invoice_total) || 0;
            if (parseFloat(it.qty_from_mos) > 0) {
                const mosPU = parseFloat(it.mos_unit_price) || pu;
                mosDelta -= (parseFloat(it.qty_from_mos) || 0) * mosPU;
            }
        });
        let grossRetention = 0;
        if (!cert.skip_retention) {
            (cert.items || []).forEach((it: any) => {
                if (it.skip_retention === true || it.skip_retention === 'true') return;
                const qty = parseFloat(it.quantity) || 0;
                const pu = parseFloat(it.unit_price) || 0;
                const itemWork = roundedAmt(qty * pu, 2);
                grossRetention = roundedAmt(grossRetention + roundedAmt(itemWork * 0.05, 2), 2);
            });
        }
        const returnedAmount = parseFloat(cert.retention_return_amount) || 0;
        const netRetention = grossRetention - returnedAmount;
        const refund = parseFloat(cert.refund) || 0;
        const extraRetention = parseFloat(cert.extra_retention) || 0;
        const priceAdj = parseFloat(cert.price_adjustment) || 0;
        const insuranceFines = parseFloat(cert.insurance_fines) || 0;
        const otherPenalties = parseFloat(cert.other_penalties) || 0;
        const liqDamages = parseFloat(cert.liquidated_damages) || 0;
        const totalNeto = subtotal - (cert.skip_retention ? 0 : netRetention) + mosDelta
            + refund - extraRetention + priceAdj - insuranceFines - otherPenalties - liqDamages;

        reportData.push(['', '', '', '', '', '']);
        reportData.push(['DESGLOSE DE MONTOS', '', '', '', '', '']);
        reportData.push(['+', 'Trabajo', 'Ejecutado', '(WP):', '', formatCurrency(subtotal)]);
        if (mosDelta !== 0) reportData.push([mosDelta >= 0 ? '+' : '', 'Ajuste MOS', '(Neto):', '', '', formatCurrency(mosDelta)]);
        if (!cert.skip_retention) reportData.push(['-', '5% Retenido:', '', '', '', formatCurrency(-Math.abs(grossRetention), "Retenido")]);
        if (returnedAmount > 0) reportData.push(['+', 'Devolución', 'Retención:', '', '', formatCurrency(returnedAmount)]);
        if (liqDamages > 0) reportData.push(['-', 'Daños', 'Líquidos:', '', '', formatCurrency(-Math.abs(liqDamages), "Deduccion")]);
        if (refund !== 0) reportData.push([refund >= 0 ? '+' : '', 'Reembolso:', '', '', '', formatCurrency(refund)]);
        if (extraRetention !== 0) reportData.push(['-', 'Extra', 'Retenido:', '', '', formatCurrency(-Math.abs(extraRetention), "Retenido")]);
        if (priceAdj !== 0) reportData.push([priceAdj >= 0 ? '+' : '', 'Ajuste', 'de', 'Precio:', '', formatCurrency(priceAdj)]);
        if (insuranceFines !== 0) reportData.push(['-', 'Multas', 'Seguro:', '', '', formatCurrency(-Math.abs(insuranceFines), "Deduccion")]);
        if (otherPenalties !== 0) reportData.push(['-', 'Otras', 'Penalidades:', '', '', formatCurrency(-Math.abs(otherPenalties), "Deduccion")]);
        reportData.push(['TOTAL NETO', 'DE ESTA', 'CERTIFICACIÓN:', '', '', formatCurrency(totalNeto)]);
        reportData.push(['', '', '', '', '', '']);
    });
    const certNums = selectedCerts.map(c => c.cert_num).join('-');
    await generateReport(`REPORTE DE CERTIFICACIONES DE PAGO - CERTIFICACIÓN #${certNums}`, reportData, project, [80, 250, 100, 80, 110, 110], 'landscape', format, `Reporte_Cert_${certNums}_${project?.num_act || projectId}.pdf`);
};


export const generateDashboardReportLogic = async (projectId: string, format: 'pdf' | 'excel' = 'pdf', endDate?: string) => {
    const { data: proj } = await supabase.from("projects").select("*").eq("id", projectId).single();
    if (format === 'excel') {
        const blob = await generateDashboardExcel(projectId);
        downloadBlob(blob, `Dashboard_Ejecutivo_${proj.num_act}.xlsx`, proj.num_act);
        return;
    }

    const cutOff = endDate ? new Date(`${endDate}T23:59:59`) : new Date();

    const { data: contractor } = await supabase.from("contractors").select("*").eq("project_id", projectId).single();
    const { data: personnel } = await supabase.from("act_personnel").select("*").eq("project_id", projectId);
    const { data: items } = await supabase.from("contract_items").select("*").eq("project_id", projectId);
    const { data: chos } = await supabase.from("chos").select("*").eq("project_id", projectId);
    const { data: certs } = await supabase.from("payment_certifications").select("*").eq("project_id", projectId).order("cert_num", { ascending: true });

    // @UNIFICATION_RESUMEN_PACT
    const { metrics } = await fetchProjectSummary(projectId);

    const originalCost = metrics.cost.original;
    const approvedCHO = metrics.chos.approvedTotal;
    const pendingCHO = metrics.chos.pendingTotal;
    const approvedDays = metrics.chos.approvedDays;

    const actTotal = metrics.cost.actTotal;
    const fhwaTotal = metrics.cost.fhwaTotal;
    const totalCertified = metrics.cost.certTotal;
    const actProjected = metrics.cost.actProjected;
    const fhwaProjected = metrics.cost.fhwaProjected;
    const mosBalance = metrics.cost.materialOnSite;

    const totalRetentionDeducted = metrics.retention.fivePercent;
    const totalRetentionReturned = metrics.retention.returned;

    const adjustedCost = metrics.cost.revisedTotal;
    const budgetBalance = metrics.cost.balance;
    const percentObra = metrics.cost.percentObra;

    const totalDays = metrics.time.total;
    const revisedDaysTotal = metrics.time.revised;
    const usedDays = metrics.time.used;
    const timeBalance = metrics.time.balance;
    const percentTime = metrics.time.percent;
    const liqDamages = metrics.penalties.liquidated;

    const totalRefund = metrics.penalties.dlqReimbursement;
    const totalExtraRetention = metrics.retention.extra;
    const totalPriceAdj = metrics.retention.priceAdjustment;
    const totalInsuranceFines = metrics.retention.insuranceFines;
    const totalOtherPenalties = metrics.retention.otherPenalties;
    const totalRetainedWithPenalties = metrics.retention.total;
    // @UNIFICATION_RESUMEN_PACT_END

    const reportData: any[][] = [
        ['SECCIÓN / CAMPO', 'INFORMACIÓN', '', ''],
        ['1. RESUMEN DE TIEMPO', '', '', ''],
        ['Fecha de Comienzo:', formatDate(proj.date_project_start), 'Term. Original:', formatDate(proj.date_orig_completion)],
        ['Term. Revisada:', formatDate(proj.date_rev_completion), 'Term. Sustancial:', formatDate(proj.date_substantial_completion)],
        ['FMIS End Date:', formatDate(proj.fmis_end_date), '', ''],
        ['Tiempo Contrato:', `${totalDays} días`, 'Extensiones de Tiempo (CHOs):', `${approvedDays} días`],
        ['Tiempo Revisado (original+CHO):', `${revisedDaysTotal} días`, 'Tiempo Usado:', `${usedDays} días`],
        ['Balance de Tiempo:', `${timeBalance} días`, 'Progreso Tiempo:', `${percentTime.toFixed(2)}%`],
        ['', '', '', ''],
        ['2. RESUMEN DE COSTOS ($)', '', '', ''],
        ['Costo Original:', formatCurrency(originalCost), 'Total CHOs (Aprob.):', formatCurrency(approvedCHO)],
        ['Presupuesto Ajustado:', formatCurrency(adjustedCost), 'Total Certificado:', formatCurrency(totalCertified)],
        ['Balance Actual (WP):', formatCurrency(budgetBalance), '% de Obra Ejecutada:', `${percentObra.toFixed(2)}%`],
        ['Material en Sitio (MOS):', formatCurrency(Math.max(0, mosBalance)), 'Fondo ACT:', formatCurrency(actTotal)],
        ['Fondo FHWA:', formatCurrency(fhwaTotal), '', ''],
        ['', '', '', ''],
        ['3. PRESUPUESTO PROYECTADO POR FONDOS ($)', '', '', ''],
        ['Provision ACT:', formatCurrency(actProjected), 'Provision FHWA:', formatCurrency(fhwaProjected)],
        ['', '', '', ''],
        ['4. RETENCIÓN Y PENALIDADES ($)', '', '', ''],
        ['5% Retenido (Bruto):', `(${formatCurrency(totalRetentionDeducted)})`, 'Retención Devuelta:', formatCurrency(totalRetentionReturned)],
        ['Daños Líquidos (Dlq):', formatCurrency(liqDamages), 'Reembolso:', formatCurrency(totalRefund)],
        ['Extra Retenido:', formatCurrency(totalExtraRetention), 'Ajuste de Precio:', formatCurrency(totalPriceAdj)],
        ['Multas Seguro:', formatCurrency(totalInsuranceFines), 'Otras Penalidades:', formatCurrency(totalOtherPenalties)],
        ['Total Retenido (Neto):', `(${formatCurrency(totalRetainedWithPenalties)})`, '', ''],
        ['', '', '', ''],
        ['5. ÓRDENES DE CAMBIO (CHOs)', '', '', ''],
        ['Aprobados:', formatCurrency(approvedCHO), 'En Trámite:', formatCurrency(pendingCHO)],
        ['Balance Total CHOs:', formatCurrency(roundedAmt(approvedCHO + pendingCHO, 2)), '% de Cambio (Precio):', `${originalCost > 0 ? Math.round((approvedCHO / originalCost) * 100) : 0}%`],
        ['', '', '', ''],
        ['6. CONTRATISTA', '', '', ''],
        ['Nombre:', contractor?.name || 'N/A', 'Empresa SS:', (function(ss){
            if(!ss) return 'N/A';
            const digits = ss.replace(/\D/g, '');
            if(digits.length >= 9) return `${digits.slice(0,3)}-${digits.slice(3,5)}-${digits.slice(5,7)}-${digits.slice(7)}`;
            return ss;
        })(contractor?.ss_patronal)],
        ['Representante:', contractor?.representative || 'N/A', 'Email:', contractor?.email || 'N/A'],
        ['Oficina:', contractor?.phone_office || 'N/A', 'Celular:', contractor?.phone_mobile || 'N/A'],
        ['', '', '', ''],
        ['7. PERSONAL ACT RESPONSABLE', '', '', ''],
        ['', '', '', ''],
        ['Rol / Puesto', 'Nombre', 'Contacto', ''],
    ];

    personnel?.forEach(p => {
        reportData.push([p.role, p.name || 'N/A', (p.phone_mobile || p.email || 'N/A'), '']);
    });

    await generateReport('REPORTE DE INFORMACIÓN PRINCIPAL', reportData, proj, [138, 138, 138, 138], 'portrait', format, `Dashboard_Reporte_${proj.num_act}.pdf`, endDate);
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

            const fedPct = getFederalSharePct(project, item);
            const statePct = 100 - fedPct;

            if (fedPct > 0) {
                const fhwaAmt = roundedAmt(total * (fedPct / 100), 2);
                const fhwaQty = roundedAmt(qty * (fedPct / 100), 4);
                const label = fedPct === 100 ? "" : ` [${fedPct}%]`;
                addToMap(fhwaMap, { ...item, description: `${item.description || ''}${label}` }, fhwaAmt, fhwaQty);
            }

            if (statePct > 0) {
                const actAmt = roundedAmt(total * (statePct / 100), 2);
                const actQty = roundedAmt(qty * (statePct / 100), 4);
                const label = statePct === 100 ? "" : ` [${statePct}%]`;
                addToMap(actMap, { ...item, description: `${item.description || ''}${label}` }, actAmt, actQty);
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


import { generateAct117CExcel } from "./generateAct117CExcel";
import { generateAct117AExcel } from "./generateAct117AExcel";
import { generateAct123Excel } from "./generateAct123Excel";
import { generateAct117B } from "./generateAct117B";
import { generateAct117BExcel } from "./generateAct117BExcel";
import { generateAct122 } from "./generateAct122";
import { generateAct122Excel } from "./generateAct122Excel";
import { generateAct122B } from "./generateAct122B";
import { generateAct32ExcelReport } from "./generateAct32ExcelReport";
import { generateDOFAEI } from "./generateDOFAEI";

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
import { generateDashboardExcel } from "./generateDashboardExcel";
import { generateBalancesExcel } from "./generateBalancesExcel";
import { generateDetailExcel } from "./generateDetailExcel";
import { generateMobilizationReport } from "./generateMobilizationReport";
import { generateSolicitudMaterialCertDocx } from "./generateSolicitudMaterialCertDocx";

export const generateAct117CReportLogic = async (projectId: string, certId?: string, format: 'excel' = 'excel', isFinal?: boolean) => {
    const { project, certs } = await fetchAllReportData(projectId);
    if (!project) return;
    let cert = certId ? certs?.find(c => c.id === certId) : (certs && certs.length > 0 ? certs[certs.length - 1] : null);
    if (!cert) {
        alert("No se encontró la certificación de pago.");
        return;
    }
    const blob = await generateAct117CExcel(projectId, cert.id, cert.cert_num, cert.cert_date, isFinal);
    downloadBlob(blob, `ACT-117C_Cert_${cert.cert_num}_${project.num_act}${isFinal ? '_FINAL' : ''}.xlsx`);
};

export const generateAct117AReportLogic = async (projectId: string, certId?: string, format: 'pdf' | 'excel' = 'excel') => {
    const { project, certs } = await fetchAllReportData(projectId);
    if (!project) return;
    let cert = certId ? certs?.find(c => c.id === certId) : (certs && certs.length > 0 ? certs[certs.length - 1] : null);
    if (!cert) {
        alert("No se encontró la certificación de pago.");
        return;
    }
    const blob = await generateAct117AExcel(projectId, cert.id, cert.cert_num, cert.cert_date);
    downloadBlob(blob, `ACT-117A_Cert_${cert.cert_num}_${project.num_act}.xlsx`);
};

export const generateAct123ReportLogic = async (projectId: string, choId: string, format: 'pdf' | 'excel' = 'excel') => {
    const { project, chos } = await fetchAllReportData(projectId);
    if (!project) return;
    const cho = chos?.find(c => c.id === choId);
    if (!cho) { alert("No se encontró el CHO."); return; }
    
    const choLabel = `${cho.cho_num}${cho.amendment_letter || ''}`;
    
    if (format === 'excel') {
        const blob = await generateAct123Excel(projectId, choId);
        downloadBlob(blob, `ACT-123_CHO_${choLabel}_${project.num_act}.xlsx`);
    } else {
        const { generateAct123B } = await import("./generateAct123B");
        const blob = await generateAct123B(projectId, choId);
        if (blob) downloadBlob(blob, `ACT-123_CHO_${choLabel}_${project.num_act}.pdf`);
    }
};

export const generateAct32ReportLogic = async (projectId: string, choId: string, format: 'pdf' | 'excel' = 'excel') => {
    const { project, chos } = await fetchAllReportData(projectId);
    if (!project) return;
    const cho = chos?.find(c => c.id === choId);
    if (!cho) { alert("No se encontró el CHO."); return; }
    
    if (format === 'excel') {
        const blob = await generateAct32ExcelReport(projectId, choId);
        // El nombre del archivo se maneja dentro de generateAct32ExcelReport o podemos delegarlo aquí
    } else {
        alert("Reporte ACT-32 solo disponible en formato Excel actualmente.");
    }
};

export const generateAct117BReportLogic = async (projectId: string, certId: string, itemNum: string, format: 'pdf' | 'excel' = 'pdf') => {
    if (format === 'excel') {
        const blob = await generateAct117BExcel(projectId, certId, itemNum);
        downloadBlob(blob, `ACT-117B_Item_${itemNum}_Balance_Sheet.xlsx`);
    } else {
        const blob = await generateAct117B(projectId, certId, itemNum);
        downloadBlob(blob, `ACT-117B_Item_${itemNum}_Balance_Sheet.pdf`);
    }
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

export const generateAct122BReportLogic = async (projectId: string, choId: string) => {
    // Redirigimos al flujo unificado de ACT-122
    return generateAct122ReportLogic(projectId, choId, 'excel');
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

export const generateAct122ReportLogic = async (projectId: string, choId: string, format: 'pdf' | 'excel' = 'pdf', isFinal?: boolean) => {
    const { project, chos } = await fetchAllReportData(projectId);
    const cho = chos?.find(c => c.id === choId);
    if (!project || !cho) return;

    const finalChoNum = parseFloat(cho.cho_num) + 1;
    const choLabel = isFinal 
        ? `${finalChoNum}F` 
        : (cho.cho_num ? `${cho.cho_num}${cho.amendment_letter || ''}` : choId);

    if (format === 'excel') {
        // Unificación: Usamos el motor de ACT-122B (que es el formato Excel oficial más reciente)
        // pero lo guardamos con el nombre ACT-122 por requerimiento de Enrique.
        const blob = await generateAct122B(projectId, choId, isFinal);
        downloadBlob(blob, `ACT-122_CHO_${choLabel}_${project.num_act}.xlsx`);
    } else {
        const blob = await generateAct122(projectId, choId, isFinal);
        if (blob) downloadBlob(blob, `ACT-122_CHO_${choLabel}_${project.num_act}.pdf`);
    }
};

export const generateDOFAEIReportLogic = async (projectId: string, choId: string, format: 'pdf' | 'excel' = 'pdf') => {
    const { project, chos } = await fetchAllReportData(projectId);
    const cho = chos?.find(c => c.id === choId);
    if (!project || !cho) return;

    const blob = await generateDOFAEI(projectId, choId);
    if (blob) {
        downloadBlob(blob, `DOFAEI_CHO_${cho.cho_num}${cho.amendment_letter || ""}_${project.num_act}.xlsx`);
    }
};

export const generateAct123BReportLogic = async (projectId: string, choId: string, format: 'pdf' | 'excel' = 'pdf') => {
    const { project } = await fetchAllReportData(projectId);
    if (!project) return;
    if (format === 'excel') throw new Error("ACT-123B no disponible en Excel.");
    
    // dynamically import to avoid top-level import issues
    const { generateAct123B } = await import("./generateAct123B");
    const blob = await generateAct123B(projectId, choId);
    if (blob) await downloadBlob(blob, `ACT-123B_CHO_${choId}_${project.num_act}.pdf`);
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

    let adminCount = 0;
    let contractorCount = 0;
    let liquidatorCount = 0;

    items.forEach(it => {
        const liqItem = liquidatedItems.find((l: any) => l.item_num === it.item_num);
        const isAdmin = (liqItem && liqItem.signed_by_admin);
        const isContractor = (liqItem && liqItem.signed_by_contractor);
        const isLiquidator = (liqItem && liqItem.signed_by_liquidator);

        if (isAdmin) adminCount++;
        if (isContractor) contractorCount++;
        if (isLiquidator) liquidatorCount++;

        reportData.push([
            it.item_num,
            it.description || '',
            isAdmin ? 'Sí' : 'No',
            isContractor ? 'Sí' : 'No',
            isLiquidator ? 'Sí' : 'No'
        ]);
    });

    // Añadir balance al final
    reportData.push(['', '', '', '', '']);
    reportData.push(['RESUMEN DE PARTIDAS FIRMADAS:', '', adminCount.toString(), contractorCount.toString(), liquidatorCount.toString()]);

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

export const generateMissingSignaturesReportLogic = async (
    projectId: string, 
    format: 'pdf' | 'excel' = 'pdf',
    filters: { admin: boolean; contractor: boolean; liquidator: boolean } = { admin: true, contractor: true, liquidator: true }
) => {
    const { project, items } = await fetchAllReportData(projectId);
    if (!project || !items) return;

    const { data: projData } = await supabase.from('projects').select('liquidation_data').eq('id', projectId).single();
    const liquidatedItems: any[] = projData?.liquidation_data?.liquidated_items || [];

    // Encontrar partidas a las que les falta al menos UNA de las firmas seleccionadas
    const missingItems = items.filter((item: any) => {
        const liqInfo = liquidatedItems.find((li: any) => li.item_num === item.item_num) || {};
        const missingAdmin = filters.admin && !liqInfo.signed_by_admin;
        const missingContractor = filters.contractor && !liqInfo.signed_by_contractor;
        const missingLiquidator = filters.liquidator && !liqInfo.signed_by_liquidator;
        return missingAdmin || missingContractor || missingLiquidator;
    });

    if (missingItems.length === 0) {
        alert('¡No se encontraron partidas con las firmas pendientes seleccionadas!');
        return;
    }

    const reportData: any[][] = [
        ['Item #', 'Especificación', 'Descripción', 'Admin', 'Contratista', 'Liquidador'],
        ...missingItems.map((item: any) => {
            const liqInfo = liquidatedItems.find((li: any) => li.item_num === item.item_num) || {};
            return [
                item.item_num,
                item.specification || '',
                [item.description, item.additional_description].filter(Boolean).join(' - '),
                liqInfo.signed_by_admin ? 'SÍ' : 'FALTA',
                liqInfo.signed_by_contractor ? 'SÍ' : 'FALTA',
                liqInfo.signed_by_liquidator ? 'SÍ' : 'FALTA',
            ];
        })
    ];

    let filterDesc = [];
    if (filters.admin) filterDesc.push("Administrador");
    if (filters.contractor) filterDesc.push("Contratista");
    if (filters.liquidator) filterDesc.push("Liquidador");

    await generateReport(
        `PARTIDAS CON FIRMAS PENDIENTES (${filterDesc.join(', ')})`,
        reportData,
        project,
        [50, 70, 230, 60, 70, 72],
        'landscape',
        format,
        `Firmas_Pendientes_${project.num_act || projectId}.pdf`
    );
};

export const generateMinuteReportLogic = async (projectId: string, minuteId: string, format: 'pdf' | 'excel' | 'word' = 'pdf') => {
    if (format === 'excel') {
        alert("El reporte de minutas no está disponible en formato Excel por requerimiento.");
        return;
    }
    const { data: proj } = await supabase.from("projects").select("*").eq("id", projectId).single();
    const { data: minute } = await supabase.from("meeting_minutes").select("*").eq("id", minuteId).single();
    if (!minute) throw new Error("No se encontró la minuta.");

    const parsedParticipants = minute.participants && typeof minute.participants === 'object' && !Array.isArray(minute.participants)
        ? minute.participants
        : {};

    const enrichedMinute = {
        id: minute.id,
        meeting_number: minute.meeting_number,
        meeting_num: minute.meeting_number,
        meeting_date: minute.meeting_date,
        meeting_time: parsedParticipants.meeting_time || 'N/A',
        attendees: parsedParticipants.attendees || (Array.isArray(minute.participants) ? minute.participants.join(', ') : 'No se registró lista de asistentes.'),
        summary: parsedParticipants.summary || 'No hay resumen disponible.',
        minutes: minute.content || '',
        content: minute.content || '',
        participants: minute.participants,
        audio_url: minute.audio_url
    };
    
    if (format === 'word') {
        const { generateMinutesReportDocx } = await import("./generateMinutesReportDocx");
        const blob = await generateMinutesReportDocx(projectId, enrichedMinute);
        downloadBlob(blob, `Minuta_${minute.meeting_date || 'N/A'}.docx`);
        return;
    }

    const { generateMinutesReport } = await import("./generateMinutesReport");
    const blob = await generateMinutesReport(projectId, enrichedMinute);
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

export const generateFaResumenAnualLogic = async (projectId: string, format: string) => { 
    const { generateFaResumenAnual } = await import("./generateFaReports");
    const blob = await generateFaResumenAnual(projectId);
    downloadBlob(blob, `AC51_Resumen_Anual_FA_${projectId}.pdf`);
}; 

export const generateFaResumenMensualLogic = async (projectId: string, format: string) => { 
    const { generateFaResumenMensual } = await import("./generateFaReports");
    const blob = await generateFaResumenMensual(projectId);
    downloadBlob(blob, `Resumen_Mensual_FA_${projectId}.pdf`);
}; 

export const generateFaInformeDiarioLogic = async(projectId: string, format: string, date: string) => { 
    const { generateFaInformeDiario } = await import("./generateFaReports");
    const blob = await generateFaInformeDiario(projectId, date);
    downloadBlob(blob, `AC49_Informe_Diario_FA_${date}.pdf`);
}; 

export const generateFaRelacionEquipoLogic = async(projectId: string, format: string, month: string) => { 
    const { generateFaRelacionEquipo } = await import("./generateFaReports");
    const blob = await generateFaRelacionEquipo(projectId, month);
    downloadBlob(blob, `AC50_Relacion_Equipo_FA_Mes_${parseInt(month)+1}.pdf`);
};

export const generateIccReportLogic = async (projectId: string, format: 'pdf' | 'excel' = 'pdf') => {
    const { project, certs: paymentCerts, items } = await fetchAllReportData(projectId);
    const { data: iccs } = await supabase
        .from("initial_certifications")
        .select(`*, initial_certification_items(*)`)
        .eq("project_id", projectId)
        .order("cert_date", { ascending: true });

    if (!iccs || iccs.length === 0) {
        alert("No hay registros de Initial Contract Certification (ICC) para este proyecto.");
        return;
    }

    const reportData: any[][] = [
        ['Partida', 'Descripción Material', 'Cant.', 'Fabricante', 'Not.', 'Cert. Pago', 'Fecha Firma', 'Vence', 'Estatus']
    ];

    iccs.forEach(icc => {
        const pc = paymentCerts?.find(p => p.id === icc.payment_cert_id || p.cert_num === icc.payment_cert_id);
        const residentDate = pc?.resident_engineer_date;
        let expiration = "PENDIENTE";
        let status = "PENDIENTE";
        
        // Use resident_engineer_date if available, otherwise fall back to icc.cert_date
        const signingDate = residentDate || icc.cert_date || null;
        
        if (signingDate) {
            const validDays = icc.valid_days || 60;
            const baseDate = new Date(`${signingDate}T00:00:00`);
            baseDate.setDate(baseDate.getDate() + validDays);
            
            const day = baseDate.getDate().toString().padStart(2, '0');
            const month = (baseDate.getMonth() + 1).toString().padStart(2, '0');
            const year = baseDate.getFullYear();
            expiration = `${month}/${day}/${year}`;

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const diff = (baseDate.getTime() - today.getTime()) / (1000 * 3600 * 24);
            if (baseDate < today) status = "EXPIRADO";
            else if (diff <= 10) status = "PRÓXIMO A VENCER (<= 10 DÍAS)";
            else status = "VÁLIDO";
        }

        if (icc.multiple_items && icc.initial_certification_items && icc.initial_certification_items.length > 0) {
            icc.initial_certification_items.forEach((child: any, idx: number) => {
                // Match child item by item_id or by item_num stored on child record
                const childItem = items?.find((it: any) =>
                    (child.item_id && it.id === child.item_id) ||
                    (child.item_num && it.item_num === child.item_num)
                );
                const childDisplayNum = childItem?.item_num || child.item_num || null;
                reportData.push([
                    childDisplayNum ? `Pt. ${childDisplayNum}` : 'N/A',
                    idx === 0 ? (icc.material_description || "N/A") : '',
                    child.quantity || 0,
                    idx === 0 ? (icc.manufacturer_name || "N/A") : '',
                    idx === 0 ? (icc.notarized ? 'SÍ' : 'NO') : '',
                    idx === 0 ? (pc ? `#${pc.cert_num}` : "N/A") : '',
                    idx === 0 ? (residentDate ? formatDate(residentDate) : "SIN FIRMA") : '',
                    idx === 0 ? expiration : '',
                    idx === 0 ? status : ''
                ]);
            });
        } else {
            // Try to match by item_id first, then by item_num stored on the ICC itself
            const item = items?.find((it: any) =>
                (icc.item_id && it.id === icc.item_id) ||
                (icc.item_num && it.item_num === icc.item_num)
            );
            const displayItemNum = item?.item_num || icc.item_num || null;
            reportData.push([
                displayItemNum ? `Pt. ${displayItemNum}` : 'N/A',
                icc.material_description || "N/A",
                icc.quantity || 0,
                icc.manufacturer_name || "N/A",
                icc.notarized ? 'SÍ' : 'NO',
                pc ? `#${pc.cert_num}` : "N/A",
                residentDate ? formatDate(residentDate) : "SIN FIRMA",
                expiration,
                status
            ]);
        }
    });

    // Usamos el import dinámico para evitar problemas de dependencias circulares si los hubiera
    const { generateReport } = await import("./reportLogic"); // En este archivo ya existe internamente pero para estar seguros si se moviera
    
    // Como generateReport no está exportada pero se usa en el archivo, la llamamos directamente si es visible
    // Si no es visible, usaré la lógica de createPdfBlob directamente.
    
    if (format === 'excel') {
        const { generateIccExcelBlob } = await import("./generateIccExcel");
        const blob = await generateIccExcelBlob(reportData, project);
        downloadBlob(blob, `ICC_Resumen_${project?.num_act || projectId}.xlsx`);
        return;
    }

    const blob = await createPdfBlob(
        'RESUMEN DE INITIAL CONTRACT CERTIFICATIONS (ICC)',
        reportData,
        project,
        [60, 140, 50, 100, 30, 60, 70, 70, 100],
        'landscape'
    );
    
    downloadBlob(blob, `ICC_Resumen_${project?.num_act || projectId}.pdf`);
};

export const generateMobilizationReportLogic = async (projectId: string) => {
    const blob = await generateMobilizationReport(projectId);
    const { data: project } = await supabase.from('projects').select('num_act').eq('id', projectId).single();
    await downloadBlob(blob, `Liquidacion_Mobilizacion_${project?.num_act || projectId}.xlsx`);
};

export const generateSolicitudMaterialCertDocxLogic = async (projectId: string) => {
    const blob = await generateSolicitudMaterialCertDocx(projectId);
    const { data: project } = await supabase.from('projects').select('num_act').eq('id', projectId).single();
    if (blob) {
        await downloadBlob(blob, `Solicitud_Material_Certification_${project?.num_act || projectId}.docx`);
    }
};

export const generateProjectStatusReportLogic = async (projectId: string) => {
    const { data: project } = await supabase
        .from('projects').select('num_act').eq('id', projectId).single();
    const blob = await generateProjectStatusExcel(projectId);
    await downloadBlob(blob, `ProjectStatus_${project?.num_act || projectId}.xlsx`, project?.num_act);
};

