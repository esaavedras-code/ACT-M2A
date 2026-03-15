import { supabase } from "./supabase";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatCurrency as formatC, roundedAmt, formatDate as utilsFormatDate } from "./utils";


import { generateCCMLReport } from "./generateCCMLReport";

export const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);
};

export const formatDate = (dateStr: string) => {
    return utilsFormatDate(dateStr);
};

export const fetchAllReportData = async (projectId: string) => {
    const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single();
    const { data: items } = await supabase.from('contract_items').select('*').eq('project_id', projectId).order('item_num');
    const { data: chos } = await supabase.from('chos').select('*').eq('project_id', projectId).order('cho_num');
    const { data: certs } = await supabase.from('payment_certifications').select('*').eq('project_id', projectId).order('cert_num');
    const { data: mfgCerts } = await supabase.from('manufacturing_certificates').select('*').eq('project_id', projectId);
    const { data: agreementFunds } = await supabase.from('project_agreement_funds').select('*').eq('project_id', projectId).order('created_at');

    return { project, items, chos, certs, mfgCerts, agreementFunds };
};

export const createPdfBlob = async (
    title: string,
    data: any[][],
    projectInfo?: { name: string, num_act: string } | null,
    customColWidths?: number[],
    orientation: 'portrait' | 'landscape' = 'portrait'
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
        const dims = actLogoImg.scaleToFit(80, 40);
        page.drawImage(actLogoImg, { x: marginX, y: height - 60, width: dims.width, height: dims.height });
    }

    if (m2aLogoImg) {
        const dims = m2aLogoImg.scaleToFit(55, 20);
        // La parte superior del logo ACT está en height - 20 (y: height - 60 + height 40)
        // Para que el de M2A esté alineado por arriba: height - 20 - dims.height
        page.drawImage(m2aLogoImg, {
            x: width - marginX - dims.width,
            y: height - 20 - dims.height,
            width: dims.width,
            height: dims.height
        });
    }

    // Centered Headers
    centerText('M2A Group - Sistema de Control de Proyectos', timesRomanFont, 10, y);
    y -= 15;
    if (projectInfo) {
        centerText(`Proyecto: ${projectInfo.name || 'N/A'} - AC: ${projectInfo.num_act || 'N/A'}`, timesRomanBoldFont, 10, y);
        y -= 22;
    }
    centerText(title, timesRomanBoldFont, 14, y);
    y -= 18;
    centerText(`Fecha de impresión del reporte: ${utilsFormatDate(new Date())}`, timesRomanFont, 9, y);
    y -= 30;

    const colCount = data[0]?.length || 1;
    const colWidths = customColWidths || Array(colCount).fill(contentWidth / colCount);
    const totalTableWidth = colWidths.reduce((acc, w) => acc + w, 0);

    data.forEach((row, rowIndex) => {
        const isHeader = rowIndex === 0;
        const isEmpty = row.every(cell => !cell || cell.toString().trim() === '');
        const isPartida = row[0]?.toString().startsWith('PARTIDA:');

        if (isEmpty) {
            y -= 10;
            return;
        }

        // Prepare text lines for each cell to calculate row height
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
                    text = trimmed.substring(1).trim(); // Remueve el signo menos si es cero
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

        // Check for new page
        if (y - rowHeight < 50) {
            page = pdfDoc.addPage(pageSize);
            y = height - 50;
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
                page.drawText(line, {
                    x: currX + 5,
                    y: y - (lineIdx + 1) * lineHeight - 5,
                    size: fontSize,
                    font: cellData.font,
                    color: textColor,
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

export const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Un pequeño delay ayuda en Electron y algunos navegadores para asegurar que el proceso de descarga inicie antes de revocar el URL
    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 500);
};

export const generateBalanceReportLogic = async (projectId: string) => {
    const { project, items, chos, certs } = await fetchAllReportData(projectId);
    if (!items) return;

    const balances = items.map((item: any) => {
        const itemChos = chos?.filter((c: any) => {
            const choppedItems = Array.isArray(c.items) ? c.items : [];
            return choppedItems.some((i: any) => i.item_id === item.id);
        }) || [];

        const choQty = itemChos.reduce((acc: number, c: any) => {
            const i = c.items.find((it: any) => it.item_id === item.id);
            return acc + (parseFloat(i.proposed_change) || 0);
        }, 0);

        const certQty = certs?.reduce((acc: number, c: any) => {
            const certItems = Array.isArray(c.items) ? c.items : (c.items?.list || []);
            const i = certItems.find((it: any) => it.item_id === item.id);
            return acc + (parseFloat(i?.quantity || 0));
        }, 0) || 0;

        const totalQty = (parseFloat(item.quantity) || 0) + choQty;
        const balance = totalQty - certQty;

        return { ...item, choQty, totalQty, certQty, balance };
    });

    const blob = await createPdfBlob('REPORTE DE BALANCES DE PARTIDAS', [
        ['Item', 'Descripción', 'Unidad', 'C. Orig', 'CHO', 'Total', 'Certific.', 'Balance'],
        ...balances.map((b: any) => [
            b.item_num,
            b.description,
            b.unit,
            b.quantity.toString(),
            b.choQty.toString(),
            b.totalQty.toString(),
            b.certQty.toString(),
            b.balance.toString()
        ])
    ], project, [40, 220, 60, 80, 80, 80, 80, 80], 'landscape');
    downloadBlob(blob, 'Reporte_Balances_Partidas.pdf');
};

export const generateDetailReportLogic = async (projectId: string) => {
    const { project, items, chos, certs } = await fetchAllReportData(projectId);
    if (!items) return;

    const reportData: any[][] = [['PARTIDA / ACTIVIDAD', 'CANTIDAD', 'UNIDAD', 'FECHA / INFO', 'VALOR UNIT.']];

    items.forEach((b: any) => {
        // Main Item Header
        reportData.push([`PARTIDA: ${b.item_num} - ${b.description}`, '', '', '', '']);

        // Original Quantity
        reportData.push(['  - Cantidad Original de Contrato', b.quantity.toString(), b.unit || '', '', formatCurrency(b.unit_price)]);

        // CHOs Breakdown
        const itemChos = chos?.filter((c: any) => {
            const choppedItems = Array.isArray(c.items) ? c.items : [];
            return choppedItems.some((i: any) => i.item_num === b.item_num);
        }) || [];

        itemChos.forEach((c: any) => {
            const choppedItems = Array.isArray(c.items) ? c.items : [];
            const i = choppedItems.find((it: any) => it.item_num === b.item_num);
            if (i) {
                reportData.push([
                    `  - CHO #${c.cho_num}${c.amendment_letter || ''} ${c.doc_status || ''}`,
                    i.quantity.toString(),
                    b.unit || '',
                    formatDate(c.cho_date),
                    ''
                ]);
            }
        });

        // Certifications Breakdown
        const itemCerts = certs?.filter((c: any) => {
            const certItems = Array.isArray(c.items) ? c.items : (c.items?.list || []);
            return certItems.some((it: any) => it.item_num === b.item_num);
        }) || [];

        itemCerts.forEach((c: any) => {
            const certItems = Array.isArray(c.items) ? c.items : (c.items?.list || []);
            const i = certItems.find((it: any) => it.item_num === b.item_num);
            if (i) {
                reportData.push([
                    `  - Certificación de Pago #${c.cert_num}`,
                    (parseFloat(i.quantity) || 0).toString(),
                    b.unit || '',
                    formatDate(c.cert_date),
                    ''
                ]);
            }
        });

        // Spacer between items
        reportData.push(['', '', '', '', '']);
    });

    const blob = await createPdfBlob('REPORTE DETALLADO DE PARTIDAS (CHO Y CERTIFICACIONES)', reportData, project, [220, 70, 50, 110, 100]);
    downloadBlob(blob, 'Reporte_Detalle_Partidas.pdf');
};

export const generateMfgReportLogic = async (projectId: string) => {
    const { project, items, mfgCerts } = await fetchAllReportData(projectId);
    if (!mfgCerts) return;

    const blob = await createPdfBlob('REPORTE DE CERTIFICADOS DE MANUFACTURA', [
        ['Item', 'Especificación', 'Cantidad del certificado', 'Fecha del certificado'],
        ...mfgCerts.map((c: any) => {
            const it = items?.find(i => i.id === c.item_id || i.item_num === c.item_num);
            const unit = it?.unit || '';
            return [
                c.item_num,
                c.specification,
                `${c.quantity.toString()} ${unit}`,
                formatDate(c.cert_date)
            ];
        })
    ], project, [60, 240, 120, 120]);
    downloadBlob(blob, 'Reporte_Certificados_Manufactura.pdf');
};

export const generateMissingMfgReportLogic = async (projectId: string) => {
    const { project, items, certs, mfgCerts } = await fetchAllReportData(projectId);
    if (!items) return;

    const missingCerts = items.filter((b: any) => b.requires_mfg_cert).map((b: any) => {
        const itemMfgCerts = mfgCerts?.filter((c: any) => c.item_id === b.id) || [];
        const mfgQty = itemMfgCerts.reduce((acc: number, c: any) => acc + (parseFloat(c.quantity) || 0), 0);

        const certQty = certs?.reduce((acc: number, c: any) => {
            const certItems = Array.isArray(c.items) ? c.items : (c.items?.list || []);
            const i = certItems.find((it: any) => it.item_num === b.item_num);
            return acc + (parseFloat(i?.quantity || 0));
        }, 0) || 0;

        const missing = certQty - mfgQty;

        let dateMissing = 'N/A';
        let runningCertQty = 0;
        if (missing > 0 && certs) {
            for (const cert of certs) {
                const certItems = Array.isArray(cert.items) ? cert.items : (cert.items?.list || []);
                const i = certItems.find((it: any) => it.item_num === b.item_num);
                if (i) {
                    runningCertQty += parseFloat(i.quantity) || 0;
                    if (runningCertQty > mfgQty) {
                        dateMissing = formatDate(cert.cert_date);
                        break;
                    }
                }
            }
        }

        return { item_num: b.item_num, unit: b.unit || '', certQty, mfgQty, missing, dateMissing };
    }).filter((m: any) => m.missing > 0);

    const blob = await createPdfBlob('REPORTE DE CERTIFICADOS DE MANUFACTURA QUE FALTAN', [
        ['Item', 'Cant. Certificada', 'Cant. en Cert. MFG', 'Cantidad faltante', 'Fecha de comienzo'],
        ...missingCerts.map((m: any) => [
            m.item_num,
            `${m.certQty.toString()} ${m.unit}`,
            `${m.mfgQty.toString()} ${m.unit}`,
            `${m.missing.toString()} ${m.unit}`,
            m.dateMissing
        ])
    ], project, [60, 115, 115, 115, 147]);
    downloadBlob(blob, 'Certificados_Manufactura_Faltantes.pdf');
};

export const generateMosReportLogic = async (projectId: string) => {
    const { project, items, certs } = await fetchAllReportData(projectId);
    if (!certs) return;

    // Helper para obtener el precio de factura (igual que en MaterialsForm.tsx)
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
                    groupedItems.set(it.item_num, {
                        item_num: it.item_num,
                        specification: it.specification || '',
                        description: it.description || '',
                        activities: []
                    });
                }
                const group = groupedItems.get(it.item_num);

                if (hasAddition) {
                    group.activities.push({
                        certNum: c.cert_num,
                        type: 'Adición (Factura)',
                        qty: parseFloat(it.mos_quantity) || 0,
                        cost: parseFloat(it.mos_invoice_total) || 0
                    });
                }

                if (hasDeduction) {
                    const mosPU = getInvoicePU(certs, it.item_num, cIdx);
                    const p = mosPU > 0 ? mosPU : (parseFloat(it.unit_price) || 0);
                    const qty = parseFloat(it.qty_from_mos) || 0;
                    group.activities.push({
                        certNum: c.cert_num,
                        type: 'Deducción (WP)',
                        qty: -qty,
                        cost: -(qty * p)
                    });
                }
            }
        });
    });

    const reportData: any[][] = [['# Item / Espec.', 'Descripción', 'Cert #', 'Tipo', 'Cant.', 'Monto ($)', 'Balance ($)']];
    let totalFinalBalance = 0;

    Array.from(groupedItems.values()).forEach(group => {
        const it = (items || []).find((i: any) => i.item_num === group.item_num);
        const unit = it?.unit || '';
        let itemBalance = 0;
        group.activities.forEach((act: any, idx: number) => {
            itemBalance += act.cost;
            reportData.push([
                idx === 0 ? `${group.item_num}\n${group.specification}` : '',
                idx === 0 ? group.description : '',
                `#${act.certNum}`,
                act.type,
                `${act.qty.toFixed(2)} ${unit}`,
                formatCurrency(act.cost),
                formatCurrency(itemBalance)
            ]);
        });
        totalFinalBalance += itemBalance;
        reportData.push(['', '', '', '', '', '', '']); // Spacer
    });

    // Add Final Total Row
    reportData.push([
        'BALANCE TOTAL EN INVENTARIO (MOS):',
        '',
        '',
        '',
        '',
        '',
        formatCurrency(totalFinalBalance)
    ]);

    const blob = await createPdfBlob('REPORTE DE MATERIAL ON SITE (MOS)', reportData, project, [120, 220, 70, 100, 70, 70, 80], 'landscape');
    downloadBlob(blob, 'Reporte_Material_On_Site.pdf');
};

export const generateInfoReportLogic = async (projectId: string) => {
    const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single();
    const { data: contractor } = await supabase.from('contractors').select('*').eq('project_id', projectId).single();
    const { data: personnel } = await supabase.from('act_personnel').select('*').eq('project_id', projectId);

    if (!project) return;

    const reportData: any[][] = [
        ['SECCIÓN / CAMPO', 'INFORMACIÓN', '', '', ''],
        ['1. PROYECTO', '', '', '', ''],
        ['Nombre:', project.name || 'N/A', '', '', ''],
        ['ACT #:', project.num_act || 'N/A', 'Federal:', project.num_federal || 'N/A', ''],
        ['Contrato #:', project.num_contrato || 'N/A', 'Oracle:', project.num_oracle || 'N/A', ''],
        ['Costo:', formatCurrency(project.cost_original), 'Región:', project.region || 'N/A', ''],
        ['Municipios:', Array.isArray(project.municipios) ? project.municipios.join(', ') : 'N/A', '', '', ''],
        ['Diseñador:', project.designer || 'N/A', '', '', ''],
        ['Alcance:', project.scope || 'N/A', '', '', ''],
        ['', '', '', '', ''],
        ['FECHAS', '', '', '', ''],
        ['Firma:', formatDate(project.date_contract_sign), 'Comienzo:', formatDate(project.date_project_start), ''],
        ['Term. Orig:', formatDate(project.date_orig_completion), 'Term. Rev:', formatDate(project.date_rev_completion), ''],
        ['Term. Est:', formatDate(project.date_est_completion), 'Term. Real:', formatDate(project.date_real_completion), ''],
        ['', '', '', '', ''],
        ['2. CONTRATISTA', '', '', '', ''],
        ['Nombre:', contractor?.name || 'N/A', '', '', ''],
        ['Representante:', contractor?.representative || 'N/A', '', '', ''],
        ['Oficina:', contractor?.phone_office || 'N/A', 'Celular:', contractor?.phone_mobile || 'N/A', ''],
        ['Email:', contractor?.email || 'N/A', '', '', ''],
        ['', '', '', '', ''],
        ['3. FIRMAS ACT', 'Nombre', 'Oficina', 'Celular', 'Email'],
    ];

    personnel?.forEach(p => {
        reportData.push([p.role, p.name || 'N/A', p.phone_office || '', p.phone_mobile || '', p.email || '']);
    });

    const blob = await createPdfBlob('INFORMACIÓN GENERAL DEL PROYECTO', reportData, project, [100, 120, 80, 80, 172]);
    downloadBlob(blob, 'Informacion_General_Proyecto.pdf');
};

export const generateChoReportLogic = async (projectId: string, choIds: string[]) => {
    const { project, chos } = await fetchAllReportData(projectId);
    if (!chos) return;

    const selectedChos = chos.filter(c => choIds.includes(c.id));
    if (selectedChos.length === 0) return;

    const reportData: any[][] = [['Ítem', 'Descripción', 'Cambio Propuesto', 'Unidad', 'Costo Unitario', 'Monto Total']];

    selectedChos.forEach(cho => {
        reportData.push([`ORDEN DE CAMBIO (CHO) #${cho.cho_num}`, `Fecha: ${formatDate(cho.cho_date)}`, '', '', '', '']);
        const items = Array.isArray(cho.items) ? cho.items : [];

        let choTotal = 0;
        items.forEach((it: any) => {
            const qty = parseFloat(it.proposed_change) || 0;
            const pu = parseFloat(it.unit_price) || 0;
            const total = qty * pu;
            choTotal += total;

            reportData.push([
                it.item_num || '',
                it.description || '',
                qty.toString(),
                it.unit || '',
                formatCurrency(pu),
                formatCurrency(total)
            ]);
        });
        reportData.push(['TOTAL CHO:', '', '', '', '', formatCurrency(choTotal)]);
        reportData.push(['', '', '', '', '', '']); // Spacer
    });

    const blob = await createPdfBlob('REPORTE DE ÓRDENES DE CAMBIO (CHO)', reportData, project, [80, 250, 100, 80, 110, 110], 'landscape');
    downloadBlob(blob, 'Reporte_CHOs.pdf');
};

export const generateCertReportLogic = async (projectId: string, certIds: string[]) => {
    const { project, certs } = await fetchAllReportData(projectId);
    if (!certs) return;

    const selectedCerts = certs.filter(c => certIds.includes(c.id));
    if (selectedCerts.length === 0) return;

    const reportData: any[][] = [['Ítem', 'Descripción', 'Cantidad', 'Unidad', 'Precio Unit.', 'Subtotal']];

    selectedCerts.forEach(cert => {
        reportData.push([`CERTIFICACIÓN DE PAGO #${cert.cert_num}`, `Fecha: ${formatDate(cert.cert_date)}`, '', '', '', '']);
        const items = Array.isArray(cert.items) ? cert.items : (cert.items?.list || []);

        let subtotal = 0;
        items.forEach((it: any) => {
            const qty = parseFloat(it.quantity) || 0;
            const pu = parseFloat(it.unit_price) || 0;
            const total = qty * pu;
            subtotal += total;

            reportData.push([
                it.item_num || '',
                it.description || '',
                qty.toFixed(2),
                it.unit || '',
                formatCurrency(pu),
                formatCurrency(total)
            ]);
        });

        const grossRetention = cert.skip_retention ? 0 : (subtotal * 0.05);
        const returnedAmount = parseFloat(cert.retention_return_amount) || 0;
        const netRetention = grossRetention - returnedAmount;
        const totalNeto = subtotal - (cert.skip_retention ? 0 : netRetention);

        reportData.push(['SUBTOTAL:', '', '', '', '', formatCurrency(subtotal)]);
        if (!cert.skip_retention || returnedAmount > 0) {
            reportData.push(['RETENCIÓN (5% Net):', '', '', '', '', netRetention > 0 ? `-${formatCurrency(netRetention)}` : formatCurrency(Math.abs(netRetention))]);
            if (returnedAmount > 0) {
                reportData.push(['  (Ret. Devuelta):', '', '', '', '', formatCurrency(returnedAmount)]);
            }
        }
        reportData.push(['TOTAL NETO:', '', '', '', '', formatCurrency(totalNeto)]);
        reportData.push(['', '', '', '', '', '']); // Spacer
    });

    const blob = await createPdfBlob('REPORTE DE CERTIFICACIONES DE PAGO', reportData, project, [80, 250, 100, 80, 110, 110], 'landscape');
    downloadBlob(blob, 'Reporte_Certificaciones.pdf');
};

export const generateDashboardReportLogic = async (projectId: string) => {
    const { data: proj } = await supabase.from("projects").select("*").eq("id", projectId).single();
    if (!proj) return;

    const { data: contractor } = await supabase.from("contractors").select("*").eq("project_id", projectId).single();
    const { data: personnel } = await supabase.from("act_personnel").select("*").eq("project_id", projectId);
    const { data: items } = await supabase.from("contract_items").select("quantity, unit_price").eq("project_id", projectId);
    const { data: chos } = await supabase.from("chos").select("proposed_change, doc_status, time_extension_days").eq("project_id", projectId);
    const { data: certs } = await supabase.from("payment_certifications").select("items, skip_retention").eq("project_id", projectId);

    const originalCost = proj.cost_original || items?.reduce((acc, item) => roundedAmt(acc + roundedAmt(item.quantity * item.unit_price, 2), 2), 0) || 0;
    const approvedCHO = chos?.filter(c => c.doc_status === 'Aprobado').reduce((acc, c) => roundedAmt(acc + (parseFloat(c.proposed_change) || 0), 2), 0) || 0;
    const pendingCHO = chos?.filter(c => c.doc_status === 'En trámite').reduce((acc, c) => roundedAmt(acc + (parseFloat(c.proposed_change) || 0), 2), 0) || 0;
    const timeExt = chos?.filter(c => c.doc_status === 'Aprobado').reduce((acc, c) => acc + (c.time_extension_days || 0), 0) || 0;

    let totalCertified = 0;
    let actTotal = 0;
    let fhwaTotal = 0;

    certs?.forEach((cert) => {
        const certItems = Array.isArray(cert.items) ? cert.items : (cert.items?.list || []);
        certItems.forEach((item: any) => {
            const amount = roundedAmt((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0), 2);
            const source = item.fund_source || "";

            if (source === "FHWA:80.25") {
                fhwaTotal = roundedAmt(fhwaTotal + roundedAmt(amount * 0.8025, 2), 2);
                actTotal = roundedAmt(actTotal + roundedAmt(amount * (1 - 0.8025), 2), 2);
            } else if (source === "FHWA:100%") {
                fhwaTotal = roundedAmt(fhwaTotal + amount, 2);
            } else {
                actTotal = roundedAmt(actTotal + amount, 2);
            }
            totalCertified = roundedAmt(totalCertified + amount, 2);
        });
    });

    const adjustedCost = roundedAmt(originalCost + approvedCHO, 2);
    const budgetBalance = roundedAmt(adjustedCost - totalCertified, 2);
    const percentObra = adjustedCost > 0 ? Math.round((totalCertified / adjustedCost) * 100) : 0;

    // Time calculations
    // Añadimos hora explícita a las fechas para que sean interpretadas en Zona Local consistentemente.
    const startDate = proj.date_project_start ? new Date(`${proj.date_project_start}T00:00:00`) : null;
    const origEndDate = proj.date_orig_completion ? new Date(`${proj.date_orig_completion}T23:59:59`) : null;

    let totalDays = 0;
    if (startDate && origEndDate) {
        totalDays = Math.ceil((origEndDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)) + 1;
    }
    const revisedDaysTotal = totalDays + timeExt;
    let usedDays = 0;
    if (startDate) {
        usedDays = Math.ceil((new Date().getTime() - startDate.getTime()) / (1000 * 3600 * 24)) + 1;
        if (usedDays < 0) usedDays = 0;
    }
    const timeBalance = revisedDaysTotal - usedDays;
    const percentTime = revisedDaysTotal > 0 ? Math.round((usedDays / revisedDaysTotal) * 100) : 0;

    const reportData: any[][] = [
        ['SECCIÓN / CAMPO', 'INFORMACIÓN', '', ''],
        ['1. RESUMEN DE TIEMPO', '', '', ''],
        ['Fecha de Comienzo:', formatDate(proj.date_project_start), 'Term. Original:', formatDate(proj.date_orig_completion)],
        ['Term. Revisada:', formatDate(proj.date_rev_completion), 'FMIS End Date:', formatDate(proj.fmis_end_date)],
        ['Tiempo Contrato:', `${totalDays} días`, 'Prórrogas (CHOs):', `${timeExt} días`],
        ['Tiempo Revisado:', `${revisedDaysTotal} días`, 'Tiempo Usado:', `${usedDays} días`],
        ['Balance de Tiempo:', `${timeBalance} días`, 'Progreso Tiempo:', `${percentTime}%`],
        ['', '', '', ''],
        ['2. RESUMEN DE COSTOS ($)', '', '', ''],
        ['Costo Original:', formatCurrency(originalCost), 'Total CHOs:', formatCurrency(approvedCHO)],
        ['Presupuesto Ajustado:', formatCurrency(adjustedCost), 'Total Certificado:', formatCurrency(totalCertified)],
        ['Balance Actual:', formatCurrency(budgetBalance), '% de Obra Ejecutada:', `${percentObra}%`],
        ['Fondo ACT:', formatCurrency(actTotal), 'Fondo FHWA:', formatCurrency(fhwaTotal)],
        ['', '', '', ''],
        ['3. ÓRDENES DE CAMBIO (CHOs)', '', '', ''],
        ['Aprobados:', formatCurrency(approvedCHO), 'En Trámite:', formatCurrency(pendingCHO)],
        ['Partida CHOs:', formatCurrency(roundedAmt(approvedCHO + pendingCHO, 2)), '% de Cambio (Precio):', `${originalCost > 0 ? Math.round((approvedCHO / originalCost) * 100) : 0}%`],
        ['', '', '', ''],
        ['4. CONTRATISTA', '', '', ''],
        ['Nombre:', contractor?.name || 'N/A', 'Empresa SS:', contractor?.ss_patronal || 'N/A'],
        ['Representante:', contractor?.representative || 'N/A', 'Email:', contractor?.email || 'N/A'],
        ['Oficina:', contractor?.phone_office || 'N/A', 'Celular:', contractor?.phone_mobile || 'N/A'],
        ['', '', '', ''],
        ['5. PERSONAL ACT RESPONSABLE', 'Rol / Puesto', 'Nombre', 'Contacto'],
    ];

    personnel?.forEach(p => {
        reportData.push(['', p.role, p.name || 'N/A', p.phone_mobile || p.email || 'N/A']);
    });

    const projectInfo = { name: proj.name, num_act: proj.num_act };
    const blob = await createPdfBlob('REPORTE DE INFORMACIÓN PRINCIPAL (DASHBOARD)', reportData, projectInfo, [138, 138, 138, 138]);
    downloadBlob(blob, `Dashboard_Reporte_${proj.num_act}.pdf`);
};

// ════════════════════════════════════════════════════════════════════════════════════════════════════
// REPORTE DE DISTRIBUCIÓN DE FONDOS (ACT vs FHWA)
// ════════════════════════════════════════════════════════════════════════════════════════════════════
export const generateFundSourceReportLogic = async (projectId: string) => {
    const { project, certs } = await fetchAllReportData(projectId);
    if (!project) return;

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

    certs?.forEach((cert: any) => {
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

    const blob = await createPdfBlob('Distribución de Fondos por Origen (ACT vs FHWA)', reportData, project, COL_WIDTHS, 'landscape');
    downloadBlob(blob, `Distribucion_Fondos_${project.num_act}.pdf`);
};

// ════════════════════════════════════════════════════════════════════════════════════════════════════
// REPORTE DE PRESUPUESTO PROYECTADO POR ORIGEN DE FONDOS (ACT vs FHWA)
// ════════════════════════════════════════════════════════════════════════════════════════════════════
export const generateProjectedFundDistributionReportLogic = async (projectId: string) => {
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

    const blob = await createPdfBlob('Presupuesto Proyectado por Origen de Fondos', reportData, project, COL_WIDTHS, 'portrait');
    downloadBlob(blob, `Presupuesto_Proyectado_${project.num_act}.pdf`);
};

import { generateAct117C } from "./generateAct117C";
import { generateAct117B } from "./generateAct117B";
import { generateAct122 } from "./generateAct122";
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

export const generateAct117CReportLogic = async (projectId: string, certId?: string) => {
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

export const generateAct117BReportLogic = async (projectId: string, certId: string, itemNum: string) => {
    const blob = await generateAct117B(projectId, certId, itemNum);
    downloadBlob(blob, `ACT-117B_Item_${itemNum}_Balance_Sheet.pdf`);
};

export const generateFinalAcceptanceChecklistReportLogic = async (projectId: string) => {
    const { project } = await fetchAllReportData(projectId);
    if (!project) return;
    const blob = await generateFinalAcceptanceReport(projectId);
    if (blob) downloadBlob(blob, `Final_Acceptance_Checklist_${project.num_act}.pdf`);
};

export const generateFinalAcceptanceReportOfficialLogic = async (projectId: string) => {
    const { project } = await fetchAllReportData(projectId);
    if (!project) return;
    const blob = await generateFinalAcceptanceReportOfficial(projectId);
    if (blob) downloadBlob(blob, `Final_Acceptance_Report_Official_${project.num_act}.pdf`);
};

export const generatePayrollCertificationReportLogic = async (projectId: string) => {
    const { project } = await fetchAllReportData(projectId);
    if (!project) return;
    const blob = await generatePayrollCertificationReport(projectId);
    if (blob) downloadBlob(blob, `Payroll_Certification_${project.num_act}.pdf`);
};

export const generateMaterialCertificationReportLogic = async (projectId: string) => {
    const { project } = await fetchAllReportData(projectId);
    if (!project) return;
    const blob = await generateMaterialCertificationReport(projectId);
    if (blob) downloadBlob(blob, `Material_Certification_${project.num_act}.pdf`);
};

export const generateDbeCertificationReportLogic = async (projectId: string) => {
    const { project } = await fetchAllReportData(projectId);
    if (!project) return;
    const blob = await generateDbeCertificationReport(projectId);
    if (blob) downloadBlob(blob, `DBE_Certification_${project.num_act}.pdf`);
};

export const generateFinalConstructionReportLogic = async (projectId: string) => {
    const { project } = await fetchAllReportData(projectId);
    if (!project) return;
    const blob = await generateFinalConstructionReport(projectId);
    if (blob) downloadBlob(blob, `Final_Construction_Report_${project.num_act}.pdf`);
};

export const generateAct122ReportLogic = async (projectId: string, choId: string) => {
    const { project, chos } = await fetchAllReportData(projectId);
    const cho = chos?.find(c => c.id === choId);
    if (!project || !cho) return;
    const blob = await generateAct122(projectId, choId);
    if (blob) downloadBlob(blob, `ACT-122_CHO_${cho.cho_num}_${project.num_act}.pdf`);
};

export const generateAct124ReportLogic = async (projectId: string, choId: string, selectedItems: string[]) => {
    const { project, chos } = await fetchAllReportData(projectId);
    const cho = chos?.find(c => c.id === choId);
    if (!project || !cho) return;
    const blob = await generateAct124(projectId, choId, selectedItems);
    if (blob) downloadBlob(blob, `ACT-124_CHO_Checklist_${cho.cho_num}_${project.num_act}.pdf`);
};

export const generateRoaReportLogic = async (projectId: string, choId: string) => {
    const { project, chos } = await fetchAllReportData(projectId);
    const cho = chos?.find(c => c.id === choId);
    if (!project || !cho) return;
    const blob = await generateRoa(projectId, choId);
    if (blob) downloadBlob(blob, `ROA_CHO_${cho.cho_num}_${project.num_act}.pdf`);
};

export const generateCCMLReportLogic = async (projectId: string, upToChoId?: string) => {
    const { project } = await fetchAllReportData(projectId);
    const blob = await generateCCMLReport(projectId, upToChoId);
    if (blob) downloadBlob(blob, `CCML_Report_${project?.num_act || projectId}.pdf`);
};

export const generateEnvironmentalReviewReportLogic = async (projectId: string) => {
    const { project } = await fetchAllReportData(projectId);
    if (!project) return;
    const blob = await generateEnvironmentalReview(projectId);
    if (blob) downloadBlob(blob, `Environmental_Review_${project.num_act || 'PROJ'}.pdf`);
};

export const generateTimeAnalysisReportLogic = async (projectId: string) => {
    const { project } = await fetchAllReportData(projectId);
    if (!project) return;
    const blob = await generateTimeAnalysis(projectId);
    if (blob) downloadBlob(blob, `Analisis_de_Tiempo_${project.num_act || 'PROJ'}.pdf`);
};

export const generateFinalEstimateReportLogic = async (projectId: string) => {
    const { project } = await fetchAllReportData(projectId);
    if (!project) return;
    const blob = await generateFinalEstimate(projectId);
    if (blob) downloadBlob(blob, `Final_Estimate_${project.num_act || 'PROJ'}.pdf`);
};

export const generateContractFinalReportLogic = async (projectId: string) => {
    const { project } = await fetchAllReportData(projectId);
    if (!project) return;
    const blob = await generateContractFinal(projectId);
    if (blob) downloadBlob(blob, `Contract_Final_Report_${project.num_act || 'PROJ'}.pdf`);
};

export const generateLiquidacionItemsReportLogic = async (projectId: string) => {
    const { project } = await fetchAllReportData(projectId);
    if (!project) return;
    const blob = await generateLiquidacionGenerator(projectId);
    if (blob) {
        downloadBlob(blob, `Hojas_Liquidacion_${project.num_act || project.id}.pdf`);
    }
};
