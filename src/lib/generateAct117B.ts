import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { supabase } from './supabase';
import { formatDate, roundedAmt, formatCurrency } from './utils';

export async function generateAct117B(projectId: string, certId: string, itemNum: string) {
    try {
        // 1. Fetch Data
        const { data: projData } = await supabase.from('projects').select('*').eq('id', projectId).single();
        if (!projData) throw new Error("Proyecto no encontrado");

        const { data: currentCert } = await supabase.from('payment_certifications').select('*').eq('id', certId).single();
        if (!currentCert) throw new Error("Certificación no encontrada");

        const { data: allCerts } = await supabase.from('payment_certifications')
            .select('*')
            .eq('project_id', projectId)
            .lte('cert_num', currentCert.cert_num)
            .order('cert_num', { ascending: true });

        const { data: itemData } = await supabase.from('contract_items')
            .select('*')
            .eq('project_id', projectId)
            .eq('item_num', itemNum)
            .single();

        // Find Header Info (Fields 3, 9, 10, 12, 13) from the FIRST certification that has MOS ADDITION
        let firstAdditionItem: any = null;
        if (allCerts && allCerts.length > 0) {
            for (const cert of allCerts) {
                const items = Array.isArray(cert.items) ? cert.items : (cert.items?.list || []);
                const it = items.find((i: any) => i.item_num === itemNum && (i.has_material_on_site === true || i.mos_invoice_num));
                if (it) {
                    firstAdditionItem = it;
                    break;
                }
            }
        }

        const currentItems = Array.isArray(currentCert.items) ? currentCert.items : (currentCert.items?.list || []);
        const currentItem = currentItems.find((it: any) => it.item_num === itemNum);

        // Prioritize the info from the addition cert, fallback to current
        const headerInfo = firstAdditionItem || currentItem;

        const invoiceNum = headerInfo?.mos_invoice_num || "";
        const provider = headerInfo?.mos_provider || "";
        const lotNum = headerInfo?.mos_lot_num || (headerInfo?.has_material_on_site ? "1" : "");
        const invoiceQty = parseFloat(headerInfo?.mos_quantity) || 0;
        const invoiceAmount = parseFloat(headerInfo?.mos_invoice_total) || 0;

        // Logical Calculations according to Instructions (Fields 14 & 15)
        const field14_InvoiceUP = invoiceQty > 0 ? invoiceAmount / invoiceQty : 0;
        const field8_75PercentUP = (itemData?.unit_price || 0) * 0.75;
        const field15_LotUP = Math.min(field8_75PercentUP, field14_InvoiceUP);

        // 2. Document Setup
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const fmt = (v: number) => {
            if (v === null || v === undefined || isNaN(v)) return "";
            if (Math.abs(v) < 0.0001) return "0.00";
            const s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            return v < 0 ? `(${s})` : s;
        };

        const fmtDate = (str: string) => {
            try {
                const [y, m, d] = str.split('T')[0].split('-');
                return `${m}/${d}/${y}`;
            } catch { return str; }
        };

        const createNewPage = () => {
            const page = pdfDoc.addPage([612, 792]);
            const { width, height } = page.getSize();

            const drawText = (txt: any, x: number, y: number, size = 8, isBold = false, center = false, right = false) => {
                if (txt === undefined || txt === null) return;
                const s = txt.toString();
                const usedFont = isBold ? fontBold : font;
                const textWidth = usedFont.widthOfTextAtSize(s, size);
                let finalX = x;
                if (center) finalX = x - (textWidth / 2);
                else if (right) finalX = x - textWidth;

                // Determine color: Red for pure negative numbers/amounts, black otherwise
                let color = rgb(0, 0, 0);
                const cleanS = s.trim();

                // Only red if it looks like a negative currency/number:
                // Starts with ( or - AND contains digits AND NO letters
                const hasDigits = /[0-9]/.test(cleanS);
                const hasLetters = /[a-zA-Z]/.test(cleanS);
                const isNegativePattern = cleanS.startsWith('-') || cleanS.startsWith('($') || (cleanS.startsWith('(') && cleanS.endsWith(')'));

                if (hasDigits && !hasLetters && isNegativePattern) {
                    color = rgb(1, 0, 0); // Red
                }

                page.drawText(s, { x: finalX, y: height - y, size, font: usedFont, color });
            };

            const drawLine = (x1: number, y1: number, x2: number, y2: number, thickness = 0.5) => {
                page.drawLine({ start: { x: x1, y: height - y1 }, end: { x: x2, y: height - y2 }, thickness, color: rgb(0, 0, 0) });
            };

            const drawRect = (x: number, y: number, w: number, h: number, color = rgb(0.9, 0.9, 0.9)) => {
                page.drawRectangle({
                    x,
                    y: height - y - h,
                    width: w,
                    height: h,
                    color
                });
            };

            return { page, width, height, drawText, drawLine, drawRect };
        };

        let { page, width, height, drawText, drawLine, drawRect } = createNewPage();

        // Function to draw the header and fields
        const drawHeader = async (pageNum: number, totalPages: number) => {
            if (pageNum === 1) {
                try {
                    const logoUrl = `${window.location.origin}/act_logo.png`;
                    const logoBytes = await fetch(logoUrl).then(res => res.arrayBuffer());
                    const logoImage = await pdfDoc.embedPng(logoBytes);
                    const dims = logoImage.scale(1);
                    const targetHeight = 55;
                    const targetWidth = (dims.width / dims.height) * targetHeight;
                    page.drawImage(logoImage, {
                        x: 45,
                        y: height - 15 - targetHeight,
                        width: targetWidth,
                        height: targetHeight
                    });
                } catch (e) {
                    console.error("Logo error:", e);
                }
            }

            // Header Text
            drawText("Government of Puerto Rico", width / 2, 28, 9, false, true);
            drawText("Department of Transportation and Public Works", width / 2, 38, 9, false, true);
            drawText("HIGHWAY AND TRANSPORTATION AUTHORITY", width / 2, 53, 11, true, true);

            drawText("ACT-117B", width - 85, 30, 9.5, true);
            drawText("(Rev. 2/10)", width - 85, 40, 7.5);

            drawText("MATERIAL ON SITE BALANCE SHEET", width / 2, 85, 13, true, true);

            const ly = 115;
            const fieldH = 18;
            const drawField = (num: string, label: string, x: number, y: number, lineLen: number, value: any, shaded = false, forceComplete = false) => {
                const fullLbl = `${num}. ${label}`;
                drawText(fullLbl, x, y, 9, true);
                const lblW = fontBold.widthOfTextAtSize(fullLbl, 9);
                const lineX = x + lblW + 5;
                const lineW = lineLen - lineX;
                if (shaded) drawRect(lineX, y - 10, lineW, 14);
                else drawLine(lineX, y + 2, lineLen, y + 2);
                
                // Truncate if too long (unless forced complete)
                let sVal = value?.toString() || "";
                if (!forceComplete && font.widthOfTextAtSize(sVal, 9) > lineW - 10) {
                    while (sVal.length > 0 && font.widthOfTextAtSize(sVal + "...", 9) > lineW - 10) {
                        sVal = sVal.slice(0, -1);
                    }
                    sVal += "...";
                }
                drawText(sVal, lineX + 5, y, 9);
            };

            const midX = 310; 
            const midXReduced = midX - 56.7; // Reducido por 2 cm (56.7 pts)
            drawField("1", "Project Name", 40, ly, midX, projData.name);
            drawField("2", "Project Number", 40, ly + fieldH, midX, projData.num_act);
            drawField("3", "Provider", 40, ly + fieldH * 2, midXReduced, provider);
            drawField("4", "Item Num.", 40, ly + fieldH * 3, 145, itemNum);
            drawField("5", "Description", 40, ly + fieldH * 4, midXReduced, itemData?.description);
            drawField("6", "Contract Quantity", 40, ly + fieldH * 5, 220, fmt(parseFloat(itemData?.quantity || 0)));
            drawField("7", "Contract Unit Price", 40, ly + fieldH * 6, 220, fmt(itemData?.unit_price), true);
            drawField("8", "75% Cont. Unit Price", 40, ly + fieldH * 7, 220, fmt(field8_75PercentUP), true);

            const rx = 330; 
            drawField("9", "Invoice Num.", rx, ly + fieldH * 2, 575, invoiceNum, false, true);
            drawField("10", "Lot Num.", rx, ly + fieldH * 3, 575, lotNum);
            drawField("11", "Unit", rx, ly + fieldH * 4, 575, itemData?.unit);

            const rx2 = 330;
            drawField("12", "Invoice Amount", rx2, ly + fieldH * 5, 575, fmt(invoiceAmount));
            drawField("13", "Invoice Quantity", rx2, ly + fieldH * 6, 575, fmt(invoiceQty));
            drawField("14", "Invoice Unit Price", rx2, ly + fieldH * 7, 575, fmt(field14_InvoiceUP), true);
            drawField("15", "Lot Unit Price", 250, ly + fieldH * 8, 385, fmt(field15_LotUP), true);

            if (totalPages > 1) {
                drawText(`Page ${pageNum} of ${totalPages}`, width - 50, 750, 8, false, false, true);
            }
        };

        const drawTableOutline = (rowStart: number, numRows: number) => {
            const ty = 300;
            const rowH = 18;
            const th = rowH * 2;
            drawLine(40, ty, width - 40, ty, 1);
            drawLine(40, ty + th, width - 40, ty + th, 1);
            drawLine(40, ty + th + (numRows * rowH), width - 40, ty + th + (numRows * rowH), 1);
            const cols = [40, 105, 145, 235, 335, 435, 520, width - 40];
            cols.forEach(x => drawLine(x, ty, x, ty + th + (numRows * rowH), 0.8));
            drawRect(40, ty, width - 80, th, rgb(0.95, 0.95, 0.95));
            cols.forEach(x => drawLine(x, ty, x, ty + th + (numRows * rowH), 0.8));

            drawText("16", (cols[0] + cols[1]) / 2, ty + 10, 8, true, true);
            drawText("Date", (cols[0] + cols[1]) / 2, ty + 25, 9, true, true);
            drawLine(cols[1], ty + rowH, cols[4], ty + rowH, 0.8);
            drawText("Certifications Payments/Deductions", (cols[1] + cols[4]) / 2, ty + 12, 9, true, true);
            drawText("17", (cols[1] + cols[2]) / 2, ty + 22, 7, true, true);
            drawText("Num.", (cols[1] + cols[2]) / 2, ty + 32, 8.5, true, true);
            drawText("18", (cols[2] + cols[3]) / 2, ty + 22, 7, true, true);
            drawText("Quantity", (cols[2] + cols[3]) / 2, ty + 32, 8.5, true, true);
            drawText("19", (cols[3] + cols[4]) / 2, ty + 22, 7, true, true);
            drawText("Amount", (cols[3] + cols[4]) / 2, ty + 32, 8.5, true, true);
            drawLine(cols[4], ty + rowH, cols[6], ty + rowH, 0.8);
            drawText("Balance total en inventario (MOS)", (cols[4] + cols[6]) / 2, ty + 12, 9, true, true);
            drawText("20", (cols[4] + cols[5]) / 2, ty + 22, 7, true, true);
            drawText("Quantity", (cols[4] + cols[5]) / 2, ty + 32, 8.5, true, true);
            drawText("21", (cols[5] + cols[6]) / 2, ty + 22, 7, true, true);
            drawText("Amount", (cols[5] + cols[6]) / 2, ty + 32, 8.5, true, true);
            drawText("22", (cols[6] + cols[7]) / 2, ty + 10, 8, true, true);
            drawText("Remarks", (cols[6] + cols[7]) / 2, ty + 25, 9, true, true);

            for (let i = 1; i <= numRows; i++) {
                drawLine(40, ty + th + (i * rowH), width - 40, ty + th + (i * rowH), 0.3);
            }
        };

        const rowsPerPage = 20;
        const allTransactions: any[] = [];

        (allCerts || []).forEach(cert => {
            const docItems = Array.isArray(cert.items) ? cert.items : (cert.items?.list || []);
            const it = docItems.find((i: any) => i.item_num === itemNum);

            if (it) {
                if (it.has_material_on_site) {
                    const q = parseFloat(it.mos_quantity) || 0;
                    if (q !== 0) {
                        allTransactions.push({
                            cert,
                            qty: q,
                            amt: roundedAmt(q * field15_LotUP, 2),
                            remark: "Add"
                        });
                    }
                }
                const deductQty = parseFloat(it.qty_from_mos) || 0;
                if (deductQty > 0) {
                    allTransactions.push({
                        cert,
                        qty: -deductQty,
                        amt: roundedAmt(-deductQty * field15_LotUP, 2),
                        remark: "Deduct"
                    });
                }
            }
        });

        const totalPages = Math.max(1, Math.ceil(allTransactions.length / rowsPerPage));

        await drawHeader(1, totalPages);
        drawTableOutline(0, rowsPerPage);

        const cols = [40, 105, 145, 235, 335, 435, 520, width - 40];
        const ty = 300;
        const rowH = 18;
        const th = rowH * 2;

        let cumulativeQty = 0;
        let cumulativeAmount = 0;
        let lastItemAmount = 0;
        let filledInPage = 0;
        let currentPageNum = 1;

        for (const tx of allTransactions) {
            if (filledInPage >= rowsPerPage) {
                const newStuff = createNewPage();
                page = newStuff.page;
                drawText = newStuff.drawText;
                drawLine = newStuff.drawLine;
                drawRect = newStuff.drawRect;
                filledInPage = 0;
                currentPageNum++;
                await drawHeader(currentPageNum, totalPages);
                drawTableOutline(0, rowsPerPage);
            }

            cumulativeQty = roundedAmt(cumulativeQty + tx.qty, 2);
            cumulativeAmount = roundedAmt(cumulativeQty * field15_LotUP, 2);

            const rowY = ty + th + (filledInPage * rowH) + rowH / 2;
            drawText(fmtDate(tx.cert.cert_date), (cols[0] + cols[1]) / 2, rowY + 3.5, 8, false, true);
            drawText(tx.cert.cert_num, (cols[1] + cols[2]) / 2, rowY + 3.5, 8, false, true);
            drawText(tx.qty === 0 ? "0.00" : fmt(tx.qty), cols[3] - 5, rowY + 3.5, 8, false, false, true);
            drawText(fmt(tx.amt), cols[4] - 5, rowY + 3.5, 8, false, false, true);
            
            // Col 20 & 21: Balance
            const isZeroQty = Math.abs(cumulativeQty) < 0.0001;
            const balanceSize = isZeroQty ? 9 : 8;
            const balanceBold = isZeroQty;
            drawText(fmt(cumulativeQty), cols[5] - 5, rowY + 3.5, balanceSize, balanceBold, false, true);
            drawText(fmt(cumulativeAmount), cols[6] - 5, rowY + 3.5, balanceSize, balanceBold, false, true);
            drawText(tx.remark, cols[6] + 5, rowY + 3.5, 8, false);

            if (tx.cert.id === certId) {
                lastItemAmount = roundedAmt(lastItemAmount + tx.amt, 2);
            }
            filledInPage++;
        }

        // Add the "BALANCE TOTAL EN INVENTARIO (MOS):" row
        if (allTransactions.length > 0) {
            if (filledInPage >= rowsPerPage) {
                const newStuff = createNewPage();
                page = newStuff.page;
                drawText = newStuff.drawText;
                drawLine = newStuff.drawLine;
                drawRect = newStuff.drawRect;
                filledInPage = 0;
                currentPageNum++;
                await drawHeader(currentPageNum, totalPages);
                drawTableOutline(0, rowsPerPage);
            }

            const rowY = ty + th + (filledInPage * rowH) + rowH / 2;
            
            // Labels spread across the first 4 columns
            drawText("BALANCE", (cols[0] + cols[1]) / 2, rowY + 3.5, 8, true, true);
            drawText("TOTAL EN", (cols[1] + cols[2]) / 2, rowY + 3.5, 7.5, true, true);
            drawText("INVENTARIO", (cols[2] + cols[3]) / 2, rowY + 3.5, 8, true, true);
            drawText("(MOS):", cols[4] - 5, rowY + 3.5, 8, true, false, true);

            // Final Balances in Cols 5 and 6
            const isZeroQty = Math.abs(cumulativeQty) < 0.0001;
            drawText(fmt(cumulativeQty), cols[5] - 5, rowY + 3.5, isZeroQty ? 9 : 8, true, false, true);
            drawText(fmt(cumulativeAmount), cols[6] - 5, rowY + 3.5, isZeroQty ? 9 : 8, true, false, true);
            
            filledInPage++;
        }

        // Bottom Summary on the LAST page
        const by = ty + th + (rowsPerPage * rowH) + 25;
        drawText(`23. Amount to Pay/Deduct for Item#`, 40, by, 10, true);
        drawLine(215, by + 2, 260, by + 2);
        drawText(itemNum, 237.5, by, 9.5, false, true);
        drawText("on Certification #", 265, by, 10, true);
        drawLine(358, by + 2, 395, by + 2);
        drawText(currentCert.cert_num, 376.5, by, 9.5, false, true);
        drawLine(415, by + 2, 550, by + 2);
        drawText(formatCurrency(lastItemAmount), 482.5, by, 10, true, true);

        const by2 = by + 25;
        // El texto del “Balance total en inventario (MOS), que se ponga entre las columnas
        drawText(`24. Balance total en inventario (MOS) para Certificación #`, 40, by2, 10, true);
        drawLine(305, by2 + 2, 360, by2 + 2);
        drawText(currentCert.cert_num, 332.5, by2, 9.5, false, true);
        drawLine(415, by2 + 2, 550, by2 + 2);
        
        const isSumZero = Math.abs(cumulativeAmount) < 0.0001;
        drawText(fmt(cumulativeAmount), 482.5, by2, isSumZero ? 12 : 11, true, true);

        // --- PAGE NUMBERING ---
        const pages = pdfDoc.getPages();
        if (pages.length > 1) {
            pages.forEach((p, i) => {
                const { width } = p.getSize();
                p.drawText(`Page ${i + 1} of ${pages.length}`, {
                    x: width - 80,
                    y: 20,
                    size: 8,
                    font: font,
                    color: rgb(0, 0, 0)
                });
            });
        }

        const pdfBytes = await pdfDoc.save();
        return new Blob([pdfBytes as any], { type: 'application/pdf' });
    } catch (err) {
        console.error(err);
        throw err;
    }
}
