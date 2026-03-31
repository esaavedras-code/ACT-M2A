import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { supabase } from './supabase';
import { formatDate } from './utils';

export async function generateAct117C(projectId: string, certId: string, certNum: number, certDate: string) {
    try {
        // 1. Fetch Data
        const { data: projData } = await supabase.from('projects').select('*').eq('id', projectId).single();
        if (!projData) throw new Error("Proyecto no encontrado");

        const { data: contrData } = await supabase.from('contractors').select('*').eq('project_id', projectId).single();
        const { data: currentCert } = await supabase.from('payment_certifications').select('*').eq('id', certId).single();
        const { data: allCerts } = await supabase.from('payment_certifications')
            .select('*')
            .eq('project_id', projectId)
            .lte('cert_num', certNum)
            .order('cert_num', { ascending: true });

        const { data: items } = await supabase.from('contract_items')
            .select('*')
            .eq('project_id', projectId)
            .order('item_num', { ascending: true });

        const { data: personnel } = await supabase.from('act_personnel').select('*').eq('project_id', projectId);
        const { data: agreementFunds } = await supabase.from('project_agreement_funds').select('*').eq('project_id', projectId);

        const currentCertItemsRaw = Array.isArray(currentCert?.items) ? currentCert.items : (currentCert?.items?.list || []);
        const currentCertItems = [...currentCertItemsRaw].sort((a, b) => (parseInt(a.item_num) || 0) - (parseInt(b.item_num) || 0));

        const { data: chos } = await supabase.from("chos")
            .select("proposed_change, cho_date")
            .eq("project_id", projectId)
            .eq("doc_status", "Aprobado")
            .lte("cho_date", certDate);
        const totalCho = (chos || []).reduce((sum, c) => sum + (parseFloat(c.proposed_change as any) || 0), 0);

        // 2. Calculations
        // El costo original se toma de projData.cost_original si existe, de lo contrario se calcula de los fondos del acuerdo, y como último recurso de los items.
        const calcOriginalAmount = projData.cost_original || (agreementFunds || []).reduce((acc: number, f: any) => acc + (parseFloat(f.amount) || 0), 0) || (items || []).reduce((acc: number, it: any) => acc + ((it.quantity || 0) * (it.unit_price || 0)), 0);
        const totalProjectAmount = calcOriginalAmount + totalCho;

        const fmt = (val: number, dec = 2, isCur = false) => {
            const s = Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
            const out = isCur ? `$${s}` : s;
            return val < 0 ? `(${out})` : out;
        };

        const V_LINES = [40, 75, 100, 135, 180, 345, 385, 445, 515, 612 - 40];

        let wpPrevious = 0;
        let wpCurrent = 0;
        let materialBalance = 0;
        let sumNetPayments = 0;
        
        let runningWP = 0;
        let runningMOS = 0;
        allCerts?.forEach(c => {
            const itemsList = Array.isArray(c.items) ? c.items : (c.items?.list || []);
            let certGross = 0;
            let certMOS = 0;
            itemsList.forEach((it: any) => {
                const q = parseFloat(it.quantity) || 0;
                const p = parseFloat(it.unit_price) || 0;
                certGross += q * p;
                certMOS += (it.has_material_on_site ? (parseFloat(it.mos_invoice_total) || 0) : 0) - ((parseFloat(it.qty_from_mos) || 0) * (parseFloat(it.mos_unit_price) || p));
            });
            runningWP += certGross;
            runningMOS += certMOS;
            const certRetention = c.skip_retention ? 0 : (runningWP * 0.05);

            if (c.cert_num < certNum) {
                wpPrevious += certGross;
            } else if (c.cert_num === certNum) {
                wpCurrent = certGross;
            }
            // Net payment to date = runningWP - certRetention + runningMOS
            if (c.cert_num === certNum) {
                sumNetPayments = runningWP - certRetention + runningMOS;
                materialBalance = runningMOS;
            }
        });
        
        const wpTotalToDate = wpPrevious + wpCurrent;
        const totalToDatePaid = sumNetPayments;
        const percentWPValue = totalProjectAmount > 0 ? (wpTotalToDate / totalProjectAmount) * 100 : 0;
        
        const totalRetentionToDate = currentCert?.skip_retention ? 0 : (wpTotalToDate * 0.05);
        
        let previousRetention = 0;
        allCerts?.filter(c => c.cert_num < certNum).forEach(c => {
            if (!c.skip_retention) {
                const cItems = Array.isArray(c.items) ? c.items : (c.items?.list || []);
                let cWP = 0;
                let rWP = 0;
                allCerts?.filter(prev => prev.cert_num <= c.cert_num).forEach(prev => {
                     const pItems = Array.isArray(prev.items) ? prev.items : (prev.items?.list || []);
                     pItems.forEach((it: any) => rWP += (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0));
                });
                previousRetention = (allCerts?.filter(pc => pc.cert_num < certNum && !pc.skip_retention).length > 0) ? 
                    (allCerts?.filter(pc => pc.cert_num < certNum).reduce((acc, pc) => {
                        let pcWP = 0;
                        allCerts?.filter(p => p.cert_num <= pc.cert_num).forEach(p => (Array.isArray(p.items) ? p.items : (p.items?.list || [])).forEach((it: any) => pcWP += (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0)));
                        return pc.skip_retention ? acc : (pcWP * 0.05);
                    }, 0)) : 0;
            }
        });
        
        // Re-calculate previous retention correctly
        previousRetention = 0;
        let prevRunningWP = 0;
        const prevCerts = allCerts?.filter(c => c.cert_num < certNum) || [];
        prevCerts.forEach(c => {
            const itemsList = Array.isArray(c.items) ? c.items : (c.items?.list || []);
            itemsList.forEach((it: any) => { prevRunningWP += (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0); });
            if (!c.skip_retention) {
                // Retention is always calculated on the TOTAL to date at that cert
                previousRetention = prevRunningWP * 0.05;
            }
        });

        const currentRetention = totalRetentionToDate - previousRetention;
        const subTotalValue = wpCurrent - currentRetention;

        const prevMOSBalance = (prevCerts || []).reduce((acc, c) => {
             let cMOS = 0;
             const cItems = Array.isArray(c.items) ? c.items : (c.items?.list || []);
             cItems.forEach((it: any) => {
                 cMOS += (it.has_material_on_site ? (parseFloat(it.mos_invoice_total) || 0) : 0) - ((parseFloat(it.qty_from_mos) || 0) * (parseFloat(it.mos_unit_price) || (parseFloat(it.unit_price) || 0)));
             });
             return acc + cMOS;
        }, 0);

        const currentMOSChange = materialBalance - prevMOSBalance;
        const netPaymentValue = subTotalValue + currentMOSChange;

        // 3. Document Setup
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const ITEMS_PER_PAGE = 10; // Reduced to ensure legal box and footer fit perfectly
        const numSheets = Math.ceil(Math.max(1, currentCertItems.length) / ITEMS_PER_PAGE);
        const personnelMap: Record<string, string> = {};
        personnel?.forEach(p => { 
            const start = p.active_from ? new Date(p.active_from) : new Date(0);
            const end = p.active_to ? new Date(p.active_to) : new Date(8640000000000000);
            const cDate = new Date(certDate);
            
            if (cDate >= start && cDate <= end) {
                personnelMap[p.role] = p.name; 
            }
        });

        // Load Logo
        let logoImage: any = null;
        try {
            const logoUrl = `${window.location.origin}/act_logo.png`;
            const logoBytes = await fetch(logoUrl).then(res => res.arrayBuffer());
            logoImage = await pdfDoc.embedPng(logoBytes);
        } catch (e) {
            console.error("No se pudo cargar el logo:", e);
        }

        const drawSecondPage = (page: any, sheetNum: number, totalSheets: number) => {
            const { width, height } = page.getSize();
            const drawText = (txt: any, x: number, y: number, size = 8, isBold = false, center = false) => {
                if (txt === undefined || txt === null) return;
                const s = txt.toString();
                const usedFont = isBold ? fontBold : font;
                const textWidth = usedFont.widthOfTextAtSize(s, size);
                const finalX = center ? x - (textWidth / 2) : x;
                page.drawText(s, { x: finalX, y: height - y, size, font: usedFont, color: rgb(0, 0, 0) });
            };

            const drawLine = (x1: number, y1: number, x2: number, y2: number, thickness = 0.5) => {
                page.drawLine({ start: { x: x1, y: height - y1 }, end: { x: x2, y: height - y2 }, thickness, color: rgb(0, 0, 0) });
            };

            // Identificación del reporte en la esquina superior derecha
            drawText("ACT-117C", width - 85, 25, 8.5, true);
            drawText("(Rev 03/2020)", width - 85, 34, 7);

            // SECCIÓN: LIQUIDATED DAMAGES
            drawLine(40, 65, width - 40, 65, 1.5); // Línea gruesa superior
            drawText("LIQUIDATED DAMAGES - N/A", width / 2, 75, 10.5, true, true);
            drawLine(40, 81, width - 40, 81, 1.5); // Línea gruesa inferior de título

            let dy2 = 110;
            drawText("For not completing project on contract time from:", 45, dy2, 9);
            drawLine(260, dy2 + 2, 345, dy2 + 2, 0.8);
            drawText("47", 302, dy2 + 10, 6.5, false, true);
            drawText("to", 355, dy2, 9);
            drawLine(370, dy2 + 2, 455, dy2 + 2, 0.8);
            drawText("48", 412, dy2 + 10, 6.5, false, true);
            drawText("both dates included", 465, dy2, 9);

            dy2 += 38;
            drawText("a total of", 45, dy2, 9);
            drawLine(105, dy2 + 2, 185, dy2 + 2, 0.8);
            drawText("49", 145, dy2 + 10, 6.5, false, true);
            drawText("days at", 195, dy2, 9);
            drawLine(245, dy2 + 2, 335, dy2 + 2, 0.8);
            drawText("50", 290, dy2 + 10, 6.5, false, true);
            drawText("per day.", 345, dy2, 9);

            drawText("3", 500, dy2, 9, true); // El "3" misterioso de la foto
            drawText("Total to Date:", 460, dy2, 9, true);
            drawLine(520, dy2 + 2, 575, dy2 + 2, 0.8);
            drawText("51", 547, dy2 + 10, 6.5, false, true);

            dy2 += 38;
            drawText("Previous Date:", 45, dy2, 9);
            drawLine(120, dy2 + 2, 230, dy2 + 2, 0.8);
            drawText("52", 175, dy2 + 10, 6.5, false, true);

            drawLine(520, dy2 + 2, 575, dy2 + 2, 0.8);
            drawText("53", 547, dy2 + 10, 6.5, false, true);

            // SECCIÓN: REIMBURSEMENT
            dy2 = 230;
            drawLine(40, dy2 - 12, width - 40, dy2 - 12, 1.5);
            drawText("REIMBURSEMENT - N/A", width / 2, dy2, 10.5, true, true);
            drawLine(40, dy2 + 4, width - 40, dy2 + 4, 1.5);

            dy2 += 40;
            drawText("For extension of Contract Time this period:", 45, dy2, 9);
            drawLine(235, dy2 + 2, 325, dy2 + 2, 0.8);
            drawText("54", 280, dy2 + 10, 6.5, false, true);
            drawText("days at", 335, dy2, 9);
            drawLine(385, dy2 + 2, 475, dy2 + 2, 0.8);
            drawText("55", 430, dy2 + 10, 6.5, false, true);
            drawText("per day", 485, dy2, 9);

            dy2 += 40;
            drawText("This Period:", 45, dy2, 9);
            drawLine(115, dy2 + 2, 225, dy2 + 2, 0.8);
            drawText("56", 170, dy2 + 10, 6.5, false, true);

            dy2 += 40;
            drawText("Previous Date:", 45, dy2, 9);
            drawLine(125, dy2 + 2, 235, dy2 + 2, 0.8);
            drawText("Total to Date:", 455, dy2, 9);
            drawLine(520, dy2 + 2, 575, dy2 + 2, 0.8);

            drawText("LS", width / 2, dy2 + 25, 10, true, true);

            // SECCIÓN: 59. Remarks
            dy2 = 380;
            drawText("59. Remarks", 45, dy2, 9.5, true);
            const rBoxTop = dy2 + 10;
            const rBoxBottom = 700;
            drawLine(40, rBoxTop, width - 40, rBoxTop, 1); // Top
            drawLine(40, rBoxBottom, width - 40, rBoxBottom, 1); // Bottom
            drawLine(40, rBoxTop, 40, rBoxBottom, 1); // Left
            drawLine(width - 40, rBoxTop, width - 40, rBoxBottom, 1); // Right

            // SECCIÓN: 60. Distribution (Tabla inferior)
            dy2 = 720;
            drawText("60. Distribution", 45, dy2, 9.5, true);
            const dStartX = 140;
            const dValX = 225;
            const dCol2X = 380;
            const dVal2X = 465;

            let distY = 745;
            drawText("ORIGINAL", dStartX, distY, 7.5, true);
            drawText("Treasury Office", dValX, distY, 7.5);
            drawText("COPY 3", dCol2X, distY, 7.5, true);
            drawText("Project", dVal2X, distY, 7.5);

            distY += 15;
            drawText("COPY 1", dStartX, distY, 7.5, true);
            drawText("Preaudit Office", dValX, distY, 7.5);
            drawText("COPY 4", dCol2X, distY, 7.5, true);
            drawText("Construction Area", dVal2X, distY, 7.5);

            distY += 15;
            drawText("COPY 2", dStartX, distY, 7.5, true);
            drawText("Contractor", dValX, distY, 7.5);

            // Eliminada numeración redundante para evitar encimamiento con el footer global
        };

        for (let sIdx = 0; sIdx < numSheets; sIdx++) {
            const page = pdfDoc.addPage([612, 792]);
            const { width, height } = page.getSize();

            const drawText = (txt: any, x: number, y: number, size = 8, isBold = false, center = false, forceColor?: any, isRetention?: boolean) => {
                if (txt === undefined || txt === null) return;
                const s = txt.toString();
                const usedFont = isBold ? fontBold : font;
                const textWidth = usedFont.widthOfTextAtSize(s, size);
                const finalX = center ? x - (textWidth / 2) : x;

                // Color logic: Purely negative numbers OR 5% retained in red, rest in black
                let textColor = rgb(0, 0, 0);
                if (forceColor) {
                    textColor = forceColor;
                } else {
                    const isNumLike = /^[(-]?[0-9,.]+[)]?%?$/.test(s.trim());
                    const isNegative = isNumLike && (s.includes('(') || s.startsWith('-'));
                    if (isNegative || isRetention) textColor = rgb(0.8, 0, 0);
                }

                page.drawText(s, { x: finalX, y: height - y, size, font: usedFont, color: textColor });
            };

            const drawLine = (x1: number, y1: number, x2: number, y2: number, thickness = 0.5) => {
                page.drawLine({ start: { x: x1, y: height - y1 }, end: { x: x2, y: height - y2 }, thickness, color: rgb(0, 0, 0) });
            };

            // --- HEADER (Matches Photo perfectly now) ---
            if (logoImage) {
                const dims = logoImage.scale(1);
                const targetHeight = 45;
                const targetWidth = (dims.width / dims.height) * targetHeight;
                page.drawImage(logoImage, {
                    x: 40,
                    y: height - 15 - targetHeight,
                    width: targetWidth,
                    height: targetHeight
                });
            }

            drawText("Government of Puerto Rico", width / 2, 25, 7, false, true);
            drawText("Department of Transportation and Public Works", width / 2, 35, 7, false, true);
            drawText("HIGHWAY AND TRANSPORTATION AUTHORITY", width / 2, 48, 9, true, true);
            drawText("ACT-117C", width - 85, 25, 8, true);
            drawText("(Rev. 03/2020)", width - 85, 34, 6.5);
            drawText("MONTHLY PROGRESS PAYMENT REPORT", width / 2, 72, 11, true, true);
            drawLine(40, 78, width - 40, 78, 1.2);

            // --- FIELDS 1-16 ---
            const ly = 100; const ry = 100; const lh = 17;
            const field = (n: string, lbl: string, x: number, y: number, endX: number, v: any) => {
                const fullLbl = `${n}. ${lbl}`;
                drawText(fullLbl, x, y, 7.5, true);
                const w = fontBold.widthOfTextAtSize(fullLbl, 7.5);
                drawLine(x + w + 5, y + 2, endX, y + 2);
                drawText(v, x + w + 8, y, 8);
            };

            field("1", "To:", 40, ly, 286, "Director Regional");
            field("2", "Project Name:", 40, ly + lh, 286, projData.name);
            field("3", "Contractor:", 40, ly + lh * 2, 286, contrData?.name);
            field("4", "Project Num.:", 40, ly + lh * 3, 286, projData.num_act);
            field("5", "Federal Num.:", 40, ly + lh * 4, 286, projData.num_federal || 'N/A');
            field("6", "Oracle Num.:", 40, ly + lh * 5, 286, projData.num_oracle);
            field("7", "Contract Num.:", 40, ly + lh * 6, 286, projData.num_contrato);
            field("8", "Municipality:", 40, ly + lh * 7, 286, projData.municipios?.join(", "));

            const rx = 330;
            const rEnd = V_LINES[8]; // Aligned with start of Column 25 (Amount)
            field("9", "Date:", rx, ry, rEnd, certDate ? formatDate(certDate) : formatDate(new Date()));
            field("10", "Cert. Num.:", rx, ry + lh, rEnd, certNum.toString());
            field("11", "Work Performed up to:", rx, ry + lh * 2, rEnd, formatDate(currentCert?.wp_up_to || certDate));
            field("12", "Contract Beginning Date:", rx, ry + lh * 3, rEnd, formatDate(projData.date_project_start));
            field("13", "Contract Completion Date:", rx, ry + lh * 4, rEnd, formatDate(projData.date_orig_completion));
            field("14", "Revised Completion Date:", rx, ry + lh * 5, rEnd, certDate ? formatDate(certDate) : formatDate(new Date()));
            field("15", "Project Original Amount:", rx, ry + lh * 6, rEnd, fmt(calcOriginalAmount, 2, true));
            field("16", "Project Revised Amount:", rx, ry + lh * 7, rEnd, fmt(totalProjectAmount, 2, true));

            // --- GRID 17-25 (Table Structure) ---
            const ty = 255; const th = 38;
            const tableHeight = 200; // Reduced from 242 to shorten the empty space
            drawLine(40, ty, width - 40, ty, 0.8); // Top line
            drawLine(40, ty + th, width - 40, ty + th, 0.8); // Header Separator

            const vLines = V_LINES;
            vLines.forEach(x => drawLine(x, ty, x, ty + tableHeight, 0.6)); // Grid columns

            const hdr = (n: string, l1: string, l2: string, x: number) => {
                if (n) drawText(n, x, ty + 10, 8, true, true);
                drawText(l1, x, ty + 22, 7, false, true);
                if (l2) drawText(l2, x, ty + 31, 6.5, false, true);
            };

            hdr("17", "Item No.", "", 57.5);
            hdr("", "Alt", "", 87.5);
            hdr("19", "Spec. Code", "", 117.5);
            hdr("20", "% Federal", "participation", 157.5);
            hdr("21", "Description", "", 262.5);
            hdr("22", "Unit", "", 365);
            hdr("23", "Quantity", "", 415);
            hdr("24", "Unit Price", "", 480);
            hdr("25", "Amount", "", 553.5);

            const pageItems = currentCertItems.slice(sIdx * ITEMS_PER_PAGE, (sIdx + 1) * ITEMS_PER_PAGE);
            pageItems.forEach((it, i) => {
                const rowY = ty + th + 14 + (i * 15.5);
                drawLine(40, rowY + 2, width - 40, rowY + 2, 0.1);
                
                // If it's certification 1, and item is #6 (006), let's ensure spec is loaded if missing
                let specCode = it.specification;
                if (!specCode && it.item_num === "006") {
                    specCode = items?.find((ci: any) => ci.item_num === "006")?.specification || '';
                }

                drawText(it.item_num, 57.5, rowY, 7, false, true);
                drawText(specCode, 117.5, rowY, 7, false, true);
                
                // Column 20: % Federal participation
                const fedP = it.fund_source?.includes('80.25') ? '80.25%' : (it.fund_source?.includes('FHWA') ? '100.00%' : '0%');
                drawText(fedP, 157.5, rowY, 7, false, true);
                
                const matchCi = items?.find((i: any) => i.item_num === it.item_num);
                const fullDesc = [it.description || matchCi?.description, matchCi?.additional_description].filter(Boolean).join(' - ');
                drawText(fullDesc.substring(0, 48), 185, rowY, 6.5);
                
                drawText(it.unit, 365, rowY, 7, false, true);
                drawText(fmt(parseFloat(it.quantity) || 0, 4), 415, rowY, 7, false, true);
                drawText(fmt(parseFloat(it.unit_price) || 0, 2, true), 480, rowY, 7, false, true);
                drawText(fmt((parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 2, true), 553.5, rowY, 7, false, true);
            });
            // --- LEGAL BOX (Continuation of the table) ---
            const byTop = ty + tableHeight;
            const byBottom = byTop + 72;

            // Full width box lines (Continues the table borders)
            drawLine(40, byTop, width - 40, byTop, 1); // Close table/Box top
            drawLine(40, byBottom, width - 40, byBottom, 1); // Box bottom
            drawLine(40, byTop, 40, byBottom, 1); // Left border
            drawLine(width - 40, byTop, width - 40, byBottom, 1); // Right border

            // Justified Legal Text
            const ly2 = byTop + 12;
            const certLines = [
                "Under penalty of absolute nullity, I hereby certify that no public servant of the Puerto Rico Highways and Transportation Authority is a party to or has an interest of any",
                "kind in the profits or benefits to be obtained under the contract which is the basis of this invoice, and should he be a party to, or have an interest in, the profits or",
                "benefits to be obtained under the contract, a waiver has been previously issued. The only consideration to provide the contracted goods or services under the",
                "contract is the payment agreed upon with the authorized representative of the government entity. The amount that appears in the invoice is fair and correct. The work",
                "has been performed, the goods have been delivered, and the services have been rendered, and no payment has been received therefor."
            ];

            const maxWidth = width - 90; // Box width minus inner margins
            certLines.forEach((line, idx) => {
                const yPos = ly2 + (idx * 9);
                const words = line.split(' ');

                // Justify all lines except the last one
                if (idx < certLines.length - 1) {
                    const totalWordsWidth = words.reduce((acc, w) => acc + font.widthOfTextAtSize(w, 6.5), 0);
                    const spaceWidth = (maxWidth - totalWordsWidth) / (words.length - 1);
                    let curX = 45;
                    words.forEach(w => {
                        page.drawText(w, { x: curX, y: height - yPos, size: 6.5, font, color: rgb(0, 0, 0) });
                        curX += font.widthOfTextAtSize(w, 6.5) + spaceWidth;
                    });
                } else {
                    drawText(line, 45, yPos, 6.5);
                }
            });

            drawText("Contractor:", 45, byBottom - 8, 8, true);
            drawLine(100, byBottom - 6, 350, byBottom - 6);

            // --- SUMMARY & SIGNATURES AREA ---
            const ay = byBottom + 12; // Start after legal box

            // Signature Sections (39-44)
            const sigDefs = [
                { id: "39", lbl: "Prepared by:", name: contrData?.representative || '', sub: "Contractor" },
                { id: "40", lbl: "Concurred by:", name: personnelMap["Administrador del Proyecto"] || '', sub: "Project Administrator or Resident Engineer or Inspector" },
                { id: "41", lbl: "Received for Review:", name: '', sub: "Regional Director's Designated Representative" },
                { id: "42", lbl: "Submitted for Review:", name: personnelMap["Supervisor de Área"] || '', sub: "Area Supervisor (Program Manager)" },
                { id: "43", lbl: "Approved by:", name: personnelMap["Director Regional"] || '', sub: "Regional Director" },
                { id: "44", lbl: "Approved for Payment by:", name: personnelMap["Director Finanzas"] || '', sub: "Finance Area Director" }
            ];

            sigDefs.forEach((s, i) => {
                const y = ay + (i * 30);
                drawText(`${s.id}. ${s.lbl}`, 40, y, 7, true);
                drawLine(135, y + 2, 290, y + 1.5, 0.5);
                drawLine(295, y + 2, 355, y + 1.5, 0.5);
                drawText(s.name, 140, y, 7.5);
                drawText(s.sub, 135, y + 10, 5.5);
                drawText("Date", 300, y + 10, 5.5);
            });

            // Financial Summary (26-38)
            const sx = 415; // Moved 1.5cm left from 455 as requested
            const sumDefs = [
                ["26", "Work Performed (WP):", fmt(wpCurrent, 2, true)],
                ["27", "5% Retained (WP):", fmt(-currentRetention, 2, true)],
                ["28", "Reimbursement (WP)(+/-):", fmt(0, 2, true)],
                ["29", "Sub Total:", fmt(subTotalValue, 2, true)],
                ["30", "Material on Site (+/-):", fmt(currentMOSChange, 2, true)],
                ["31", "Liquidated Damages (LQD)(-):", fmt(0, 2, true)],
                ["32", "Reimbursement (LqD)(+):", fmt(0, 2, true)],
                ["33", "Extra Retainage (+/-):", fmt(0, 2, true)],
                ["34", "Price Adjustment Clause (+/-):", fmt(0, 2, true)],
                ["35", "Safety Penalties - Spec 638(-):", fmt(0, 2, true)],
                ["36", "Other (+/-):", fmt(0, 2, true)],
                ["37", "Net Payment:", fmt(netPaymentValue, 2, true)],
                ["38", "Total to Date (WP):", fmt(totalToDatePaid, 2, true)]
            ];

            sumDefs.forEach((sd, i) => {
                const y = ay + (i * 15); // Consistent spacing
                const isRetentionLine = sd[0] === "27";
                drawText(`${sd[0]}. ${sd[1]}`, sx, y, 6.8);
                drawLine(width - 80, y + 2, width - 40, y + 2);
                drawText(sd[2], width - 60, y, 7.5, false, true, null, isRetentionLine);
            });

            // Percent Progress (45-46) - Aligned with signatures (x=40)
            const py = ay + (6 * 30);
            drawText("45. Percent Work Performed:", 40, py, 7, true); // Aligned at 40
            drawLine(155, py + 2, 230, py + 2);
            drawText(`${percentWPValue.toFixed(2)} %`, 192.5, py, 7.5, false, true);

            const py2 = ay + (7 * 30);
            drawText("46. Percent Time:", 40, py2, 7, true); // Aligned at 40
            drawLine(120, py2 + 2, 230, py2 + 2);
            if (projData.date_project_start) {
                const sDt = new Date(projData.date_project_start);
                const eDt = new Date(projData.date_rev_completion || projData.date_orig_completion);
                const wpDate = new Date(currentCert?.wp_up_to || certDate);
                const usedMs = wpDate.getTime() - sDt.getTime();
                const totalMs = eDt.getTime() - sDt.getTime();
                const pctTime = Math.min(100, Math.max(0, (usedMs / totalMs) * 100));
                drawText(`${pctTime.toFixed(2)} %`, 175, py2, 7.5, false, true);
            }

            // --- SEGUNDA PÁGINA (Añadida inmediatamente después de cada página de items) ---
            const page2 = pdfDoc.addPage([612, 792]);
            drawSecondPage(page2, sIdx + 1, numSheets);
        }

        // --- PAGE NUMBERING ---
        const pages = pdfDoc.getPages();
        pages.forEach((p, i) => {
            const { width } = p.getSize();
            p.drawText(`Page ${i + 1} of ${pages.length}`, {
                x: width - 80,
                y: 10, // Move down to avoid overlap
                size: 8,
                font: font,
                color: rgb(0, 0, 0)
            });
        });

        const pdfBytes = await pdfDoc.save();
        return new Blob([pdfBytes as any], { type: 'application/pdf' });
    } catch (err: any) {
        console.error("Error generating ACT-117C:", err);
        throw err;
    }
}
