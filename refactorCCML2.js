const fs = require('fs');
let code = fs.readFileSync('src/lib/generateCCMLReport.ts', 'utf8');

const sIdx = code.indexOf('\n        // --- HEADER ---');
const eIdx = code.indexOf('\n        // --- PROJECT DESCRIPTION SECTION ---');

const headerBlock = code.substring(sIdx, eIdx);

const newHeader = '\n        // --- HEADER ---\n' +
    '        const drawMainHeader = (p: any, cornerStr: string) => {\n' +
    headerBlock
        .split('\n')
        .slice(2)
        .join('\n')
        .replace(/drawText\(page,/g, "drawText(p,")
        .replace(/drawLine\(page,/g, "drawLine(p,")
        .replace(/drawRect\(page,/g, "drawRect(p,")
        .replace(/drawText\(p, "1A", 20, 15, fontBold, 8\);/, 'drawRect(p, 10, 5, 50, 20, true, rgb(1,1,1)); drawText(p, cornerStr, 20, 15, fontBold, 8);') +
    '\n        };\n' +
    '        drawMainHeader(page, "1A");\n';

code = code.substring(0, sIdx) + newHeader + code.substring(eIdx);

const footerIdx = code.indexOf('\n        // Footer');

const page2Logic = `
        // Footer
        drawText(page, \`Page \${pageNum} of 2\`, PW/2, PH - 15, font, 8, true);

        // --- PAGE 2 ---
        pageNum++;
        let page2 = pdfDoc.addPage([PW, PH]);
        drawMainHeader(page2, "3A");

        let p2y = 195; // Starting immediately under Contract time
        for (let j = 0; j < 7; j++) {
            let cx = startX;
            drawRect(page2, cx, p2y, modCols[0]/2, 10, true, colWhite); drawRect(page2, cx, p2y, modCols[0]/2, 10); cx += modCols[0]/2;
            drawRect(page2, cx, p2y, modCols[0]/2, 10, true, colWhite); drawRect(page2, cx, p2y, modCols[0]/2, 10); cx += modCols[0]/2;
            subColsRemain.forEach((w: number, i: number) => {
                let emptyColor = colWhite;
                if (i >= 2 && i <= 5) emptyColor = colLightBlueFill;
                if (i === 7 || i === 8) emptyColor = colLightBlueFill;
                drawRect(page2, cx, p2y, w, 10, true, emptyColor);
                drawRect(page2, cx, p2y, w, 10); 
                drawText(page2, "$0.00", cx + w - 2, p2y + 7, font, 5, false, true, rgb(0,0,0));
                cx += w; 
            });
            p2y += 10;
        }

        p2y += 15;
        drawText(page2, "3B", 20, p2y, fontBold, 8);
        p2y += 15;

        // SECTION 3B TABLE
        // The table is indented to align with Proposed Amount on page 1
        // Proposed amount is after modCols[0], which is 40.
        // So indent = startX + 40 + 50 (wait, proposed amount is second column)
        // Let's just use startX + 130 and stretch to totalW (so width = 572 - 130 = 442)
        const th3BCols = [70, 70, 80, 50, 85, 87]; // sum = 442
        let cx3B = startX + 130;
        
        // Let's define it properly after I test layout
        drawRect(page2, cx3B, p2y, th3BCols[0], 25, true, colPeachHead); drawRect(page2, cx3B, p2y, th3BCols[0], 25);
        drawText(page2, "Federal Share", cx3B + th3BCols[0]/2, p2y + 14, fontBold, 5.5, true);
        cx3B += th3BCols[0];
        
        const colLightGreen = rgb(0.85, 0.95, 0.85);
        drawRect(page2, cx3B, p2y, th3BCols[1], 25, true, colLightGreen); drawRect(page2, cx3B, p2y, th3BCols[1], 25);
        drawText(page2, "Toll Credits", cx3B + th3BCols[1]/2, p2y + 14, fontBold, 5.5, true);
        cx3B += th3BCols[1];

        // State Funds spans 2 columns
        drawRect(page2, cx3B, p2y, th3BCols[2], 25, true, colLightYellow); drawRect(page2, cx3B, p2y, th3BCols[2], 25);
        drawText(page2, "State Funds", cx3B + th3BCols[2]/2, p2y + 14, fontBold, 5.5, true);
        cx3B += th3BCols[2];

        drawRect(page2, cx3B, p2y, th3BCols[3], 25, true, colWhite); drawRect(page2, cx3B, p2y, th3BCols[3], 25);
        drawText(page2, "Time Extension", cx3B + th3BCols[3]/2, p2y + 14, fontBold, 5.5, true);
        cx3B += th3BCols[3];

        drawRect(page2, cx3B, p2y, th3BCols[4], 25, true, colWhite); drawRect(page2, cx3B, p2y, th3BCols[4], 25);
        drawText(page2, "Federal Share for\\nProject Modification\\nLetter", cx3B + th3BCols[4]/2, p2y + 7, fontBold, 4.5, true);
        cx3B += th3BCols[4];

        drawRect(page2, cx3B, p2y, th3BCols[5], 25, true, colWhite); drawRect(page2, cx3B, p2y, th3BCols[5], 25);
        drawText(page2, "Toll Credits for\\nProject\\nModification Letter", cx3B + th3BCols[5]/2, p2y + 7, fontBold, 4.5, true);
        
        p2y += 25;
        // The values row
        cx3B = startX + 130;
        
        const sumFedShareMod = selectedChos.reduce((s, c) => s + (c.proposed_change * (c.federal_share_pct || 0) / 100), 0);
        drawRect(page2, cx3B, p2y, th3BCols[0], 12, true, colWhite); drawRect(page2, cx3B, p2y, th3BCols[0], 12);
        drawText(page2, formatCurrency(sumFedShareMod), cx3B + th3BCols[0]/2, p2y + 8, fontBold, 6, true);
        cx3B += th3BCols[0];

        const sumTollCredAmt = selectedChos.reduce((s, c) => s + (c.toll_credits_amt || 0), 0);
        drawRect(page2, cx3B, p2y, th3BCols[1], 12, true, colWhite); drawRect(page2, cx3B, p2y, th3BCols[1], 12);
        drawText(page2, formatCurrency(sumTollCredAmt), cx3B + th3BCols[1]/2, p2y + 8, fontBold, 6, true);
        cx3B += th3BCols[1];

        const sumStateAmt = selectedChos.reduce((s, c) => s + (c.non_participating_state_amt || 0), 0);
        const sumStateShare = selectedChos.reduce((s, c) => s + (c.state_share_federal_funds || 0), 0);
        drawRect(page2, cx3B, p2y, th3BCols[2]/2, 12, true, colWhite); drawRect(page2, cx3B, p2y, th3BCols[2]/2, 12);
        drawText(page2, formatCurrency(sumStateAmt), cx3B + th3BCols[2]/4, p2y + 8, fontBold, 6, true);
        cx3B += th3BCols[2]/2;
        drawRect(page2, cx3B, p2y, th3BCols[2]/2, 12, true, colWhite); drawRect(page2, cx3B, p2y, th3BCols[2]/2, 12);
        drawText(page2, formatCurrency(sumStateShare), cx3B + th3BCols[2]/4, p2y + 8, fontBold, 6, true);
        cx3B += th3BCols[2]/2;

        drawRect(page2, cx3B, p2y, th3BCols[3], 12, true, colWhite); drawRect(page2, cx3B, p2y, th3BCols[3], 12);
        drawText(page2, totalExtensions.toString() + " Days", cx3B + th3BCols[3]/2, p2y + 8, fontBold, 6, true);
        cx3B += th3BCols[3];

        drawRect(page2, cx3B, p2y, th3BCols[4], 12, true, colWhite); drawRect(page2, cx3B, p2y, th3BCols[4], 12);
        const sumFedModLet = selectedChos.reduce((s, c) => s + (c.fed_share_mod_letter || 0), 0);
        drawText(page2, formatCurrency(sumFedModLet), cx3B + th3BCols[4]/2, p2y + 8, fontBold, 6, true);
        cx3B += th3BCols[4];

        drawRect(page2, cx3B, p2y, th3BCols[5], 12, true, colWhite); drawRect(page2, cx3B, p2y, th3BCols[5], 12);
        const sumTollModLet = selectedChos.reduce((s, c) => s + (c.toll_credits_mod || 0), 0);
        drawText(page2, formatCurrency(sumTollModLet), cx3B + th3BCols[5]/2, p2y + 8, fontBold, 6, true);

        // -- Lower Info Blocks
        p2y += 25;
        const leftBoxW = 160;
        
        // Modification Total Amount
        drawRect(page2, startX, p2y, leftBoxW/2, 18, true, colLightGray); drawRect(page2, startX, p2y, leftBoxW/2, 18);
        drawText(page2, "Modification Total\\nAmount:", startX + leftBoxW/4, p2y + 6, fontBold, 5.5, true);
        drawRect(page2, startX + leftBoxW/2, p2y, leftBoxW/2, 18, true, colWhite); drawRect(page2, startX + leftBoxW/2, p2y, leftBoxW/2, 18);
        drawText(page2, formatCurrency(totalChoAmt), startX + leftBoxW*0.75, p2y + 11, fontBold, 6, true);

        p2y += 18;
        drawRect(page2, startX, p2y, leftBoxW/2, 18, true, colLightGray); drawRect(page2, startX, p2y, leftBoxW/2, 18);
        drawText(page2, "Revised Contract\\nAmount (all Funds):", startX + leftBoxW/4, p2y + 6, fontBold, 5.5, true);
        drawRect(page2, startX + leftBoxW/2, p2y, leftBoxW/2, 18, true, colRed); drawRect(page2, startX + leftBoxW/2, p2y, leftBoxW/2, 18);
        const revisedTotal = (parseFloat(project.cost_original) || 0) + totalChoAmt;
        drawText(page2, formatCurrency(revisedTotal), startX + leftBoxW*0.75, p2y + 11, fontBold, 6, true, false, colWhite);

        p2y += 18;
        drawRect(page2, startX, p2y, leftBoxW/2, 18, true, colLightGray); drawRect(page2, startX, p2y, leftBoxW/2, 18);
        drawText(page2, "Amount of Federal\\nFunds Needed (FMIS):", startX + leftBoxW/4, p2y + 6, fontBold, 5.5, true);
        drawRect(page2, startX + leftBoxW/2, p2y, leftBoxW/2, 18, true, colRed); drawRect(page2, startX + leftBoxW/2, p2y, leftBoxW/2, 18);
        drawText(page2, formatCurrency(sumFedModLet), startX + leftBoxW*0.75, p2y + 11, fontBold, 6, true, false, colWhite);

        p2y += 18;
        drawRect(page2, startX, p2y, leftBoxW/2, 18, true, colLightGray); drawRect(page2, startX, p2y, leftBoxW/2, 18);
        drawText(page2, "Amount of State\\nFunds Needed (FMIS):", startX + leftBoxW/4, p2y + 6, fontBold, 5.5, true);
        drawRect(page2, startX + leftBoxW/2, p2y, leftBoxW/2, 18, true, colWhite); drawRect(page2, startX + leftBoxW/2, p2y, leftBoxW/2, 18);
        drawText(page2, formatCurrency(sumStateAmt), startX + leftBoxW*0.75, p2y + 11, fontBold, 6, true);

        // Center Box (Contingencies)
        let contY = p2y - 18 * 3; 
        const contX = startX + leftBoxW + 10;
        const contW = totalW - leftBoxW - 10;
        let cwx = contX;

        drawRect(page2, cwx, contY, 160, 10, true, colWhite); drawRect(page2, cwx, contY, 160, 10);
        drawText(page2, "Comparison of Modifications with\\nProject Contingencies:", cwx + 80, contY + 2, fontBold, 5.5, true);
        cwx += 160;

        const wRem1 = (contW - 160)/3;
        drawRect(page2, cwx, contY, wRem1, 10, true, colPeachHead); drawRect(page2, cwx, contY, wRem1, 10);
        drawText(page2, "Federal", cwx + wRem1/2, contY + 7, fontBold, 5.5, true);
        cwx += wRem1;

        drawRect(page2, cwx, contY, wRem1, 10, true, colLightGreen); drawRect(page2, cwx, contY, wRem1, 10);
        drawText(page2, "Toll Credits", cwx + wRem1/2, contY + 7, fontBold, 5.5, true);
        cwx += wRem1;

        drawRect(page2, cwx, contY, wRem1, 10, true, colLightYellow); drawRect(page2, cwx, contY, wRem1, 10);
        drawText(page2, "State", cwx + wRem1/2, contY + 7, fontBold, 5.5, true);

        // Row 2 values
        contY += 10;
        cwx = contX;
        drawRect(page2, cwx, contY, 160, 15, true, colWhite); drawRect(page2, cwx, contY, 160, 15);
        drawText(page2, "Does Contract Modification Exceed\\nContingencies?", cwx + 80, contY + 5, fontBold, 5.5, true);
        cwx += 160;

        drawRect(page2, cwx, contY, wRem1, 15, true, colRed); drawRect(page2, cwx, contY, wRem1, 15);
        drawText(page2, formatCurrency(sumFedModLet), cwx + wRem1/2, contY + 10, fontBold, 6, true, false, colWhite);
        cwx += wRem1;

        drawRect(page2, cwx, contY, wRem1, 15, true, colWhite); drawRect(page2, cwx, contY, wRem1, 15);
        drawText(page2, formatCurrency(sumTollModLet), cwx + wRem1/2, contY + 10, fontBold, 6, true);
        cwx += wRem1;

        drawRect(page2, cwx, contY, wRem1, 15, true, colLightYellow); drawRect(page2, cwx, contY, wRem1, 15);
        drawText(page2, formatCurrency(sumStateAmt), cwx + wRem1/2, contY + 10, fontBold, 6, true);

        // Row 3 (Status)
        contY += 15;
        cwx = contX + 160;
        
        drawRect(page2, cwx, contY, wRem1, 15, true, colRed); drawRect(page2, cwx, contY, wRem1, 15);
        const msgFed = sumFedModLet > 0 ? "YES. PRHTA needs to identify additional federal funds." : "NO additional federal funds needed.";
        drawText(page2, msgFed, cwx + wRem1/2, contY + 10, fontBold, 4.5, true, false, colWhite);
        cwx += wRem1;

        drawRect(page2, cwx, contY, wRem1, 15, true, colWhite); drawRect(page2, cwx, contY, wRem1, 15);
        drawText(page2, sumTollModLet > 0 ? "YES..." : "NO additional toll credits needed.", cwx + wRem1/2, contY + 10, fontBold, 4.5, true);
        cwx += wRem1;

        drawRect(page2, cwx, contY, wRem1, 15, true, colLightYellow); drawRect(page2, cwx, contY, wRem1, 15);
        drawText(page2, sumStateAmt > 0 ? "YES..." : "NO additional state funds needed.", cwx + wRem1/2, contY + 10, fontBold, 4.5, true);

        // Row 4 NOTE
        contY += 15;
        drawRect(page2, contX, contY, contW, 32, true, colLightGray); drawRect(page2, contX, contY, contW, 32);
        drawText(page2, "NOTE: PRHTA FEDERAL LIAISON OFFICE AND BUDGET OFFICE WILL VERIFY THE VALUES IN THE CELLS OF FEDERAL, TOLL CREDITS", contX + contW/2, contY + 12, fontBold, 5.5, true);
        drawText(page2, "AND STATE FUNDS TO IDENTIFY THE NEED FOR ADDITIONAL FUNDS IN THE PROJECT.", contX + contW/2, contY + 22, fontBold, 5.5, true);

        // Bottom section
        p2y += 35; // moving past the left box
        drawRect(page2, startX, p2y, totalW, 20, true, colLightGray); drawRect(page2, startX, p2y, totalW, 20);
        drawText(page2, "AS INDICATED IN THE PROJECT MODIFICATION REQUEST LETTERS (THE LETTERS ARE DEVELOPED BY THE PRHTA FEDERAL LIAISON OFFICE AND EVALUATED/APPROVED BY THE FHWA PR/USVI DIVISION.", startX + totalW/2, p2y + 7, fontBold, 5, true);
        drawText(page2, "FUNDS INFORMATION IN THE LETTERS WILL BE ACCESSED THROUGH A FOLDER IN A CLOUD PLATFORM):", startX + totalW/2, p2y + 16, fontBold, 5, true);

        p2y += 20;
        const bCols = [120, 90, 90, 90, 91, 91];
        let bx = startX;

        drawRect(page2, bx, p2y, bCols[0], 25, true, colWhite); drawRect(page2, bx, p2y, bCols[0], 25);
        drawText(page2, "Obligations Amount (excludes\\nPayroll, Mileage and Diets)", bx + bCols[0]/2, p2y + 10, fontBold, 5.5, true);
        bx += bCols[0];

        drawRect(page2, bx, p2y, bCols[1], 25, true, colLightGray); drawRect(page2, bx, p2y, bCols[1], 25);
        drawText(page2, "Total Cost", bx + bCols[1]/2, p2y + 14, fontBold, 5.5, true);
        bx += bCols[1];

        drawRect(page2, bx, p2y, bCols[2], 25, true, colWhite); drawRect(page2, bx, p2y, bCols[2], 25);
        drawText(page2, "Federal Funds", bx + bCols[2]/2, p2y + 14, fontBold, 5.5, true);
        bx += bCols[2];

        drawRect(page2, bx, p2y, bCols[3], 25, true, colPeachHead); drawRect(page2, bx, p2y, bCols[3], 25);
        drawText(page2, "Federal Share", bx + bCols[3]/2, p2y + 14, fontBold, 5.5, true);
        bx += bCols[3];

        drawRect(page2, bx, p2y, bCols[4], 25, true, colLightGreen); drawRect(page2, bx, p2y, bCols[4], 25);
        drawText(page2, "Toll Credits", bx + bCols[4]/2, p2y + 14, fontBold, 5.5, true);
        bx += bCols[4];

        drawRect(page2, bx, p2y, bCols[5], 25, true, colLightYellow); drawRect(page2, bx, p2y, bCols[5], 25);
        drawText(page2, "State Funds", bx + bCols[5]/2, p2y + 14, fontBold, 5.5, true);

        p2y += 25;

        // Original Project Funds Row
        bx = startX;
        drawRect(page2, bx, p2y, bCols[0], 12, true, colWhite); drawRect(page2, bx, p2y, bCols[0], 12);
        drawText(page2, "Original Project Funds", bx + bCols[0]/2, p2y + 8, font, 5.5, true);
        bx += bCols[0];

        // Total Cost (excluding payroll?) 
        // Based on original project agreement funds: participating + FA requested + state share fed + not part state
        // Let's sum based on project
        const origTot = (parseFloat(project.cost_original) || 0); // Simplified approximation 
        const grandFedFA = (agreementFunds || []).reduce((s, f) => s + (f.fa_funds_requested || 0), 0);
        const grandFedNoContingency = grandFedFA; // Just requested
        const grandStateNoCont = (agreementFunds || []).reduce((s, f) => s + (f.state_share_federal || 0) + (f.not_participating_state || 0), 0);
        
        drawRect(page2, bx, p2y, bCols[1], 12, true, colWhite); drawRect(page2, bx, p2y, bCols[1], 12);
        drawText(page2, formatCurrency(origTot), bx + bCols[1]/2, p2y + 8, font, 5.5, true);
        bx += bCols[1];

        drawRect(page2, bx, p2y, bCols[2], 12, true, colWhite); drawRect(page2, bx, p2y, bCols[2], 12);
        drawText(page2, formatCurrency(grandFedNoContingency), bx + bCols[2]/2, p2y + 8, font, 5.5, true);
        bx += bCols[2];

        drawRect(page2, bx, p2y, bCols[3], 12, true, colWhite); drawRect(page2, bx, p2y, bCols[3], 12);
        drawText(page2, formatCurrency(grandFedNoContingency), bx + bCols[3]/2, p2y + 8, font, 5.5, true);
        bx += bCols[3];

        drawRect(page2, bx, p2y, bCols[4], 12, true, colWhite); drawRect(page2, bx, p2y, bCols[4], 12);
        drawText(page2, "$0.00", bx + bCols[4]/2, p2y + 8, font, 5.5, true);
        bx += bCols[4];

        drawRect(page2, bx, p2y, bCols[5], 12, true, colWhite); drawRect(page2, bx, p2y, bCols[5], 12);
        drawText(page2, formatCurrency(grandStateNoCont), bx + bCols[5]/2, p2y + 8, font, 5.5, true);

        p2y += 12;

        let rtTot = origTot;
        let rtFed = grandFedNoContingency;
        let rtToll = 0;
        let rtState = grandStateNoCont;

        for (let j = 1; j <= 10; j++) {
            bx = startX;
            drawRect(page2, bx, p2y, bCols[0], 12, true, colWhite); drawRect(page2, bx, p2y, bCols[0], 12);
            drawText(page2, \`Modification #\${j}\`, bx + bCols[0]/2, p2y + 8, font, 5.5, true);
            bx += bCols[0];
            
            let cCho = selectedChos[j-1];
            
            const rTC = cCho ? (cCho.proposed_change || 0) : 0;
            const rFF = cCho ? (cCho.proposed_change * (cCho.federal_share_pct || 0) / 100) : 0;
            const rToll = cCho ? (cCho.toll_credits_amt || 0) : 0;
            const rState = cCho ? (cCho.non_participating_state_amt || 0) + (cCho.state_share_federal_funds || 0) : 0;

            rtTot += rTC;
            rtFed += rFF;
            rtToll += rToll;
            rtState += rState;

            [rTC, rFF, rFF, rToll, rState].forEach((vx, vi) => {
                drawRect(page2, bx, p2y, bCols[vi+1], 12, true, colWhite); drawRect(page2, bx, p2y, bCols[vi+1], 12);
                drawText(page2, vx === 0 && !cCho ? "$0.00" : formatCurrency(vx), bx + bCols[vi+1]/2, p2y + 8, font, 5.5, true);
                bx += bCols[vi+1];
            });

            p2y += 12;
        }

        // Revised Amount
        bx = startX;
        drawRect(page2, bx, p2y, bCols[0], 12, true, colLightGray); drawRect(page2, bx, p2y, bCols[0], 12);
        drawText(page2, "Revised Amount", bx + bCols[0]/2, p2y + 8, fontBold, 5.5, true, false, colRed);
        bx += bCols[0];

        drawRect(page2, bx, p2y, bCols[1], 12, true, colLightGray); drawRect(page2, bx, p2y, bCols[1], 12);
        drawText(page2, formatCurrency(rtTot), bx + bCols[1]/2, p2y + 8, fontBold, 5.5, true);
        bx += bCols[1];

        drawRect(page2, bx, p2y, bCols[2], 12, true, colLightGray); drawRect(page2, bx, p2y, bCols[2], 12);
        drawText(page2, formatCurrency(rtFed), bx + bCols[2]/2, p2y + 8, fontBold, 5.5, true);
        bx += bCols[2];

        drawRect(page2, bx, p2y, bCols[3], 12, true, colPeachHead); drawRect(page2, bx, p2y, bCols[3], 12);
        drawText(page2, formatCurrency(rtFed), bx + bCols[3]/2, p2y + 8, fontBold, 5.5, true);
        bx += bCols[3];

        drawRect(page2, bx, p2y, bCols[4], 12, true, colLightGreen); drawRect(page2, bx, p2y, bCols[4], 12);
        drawText(page2, formatCurrency(rtToll), bx + bCols[4]/2, p2y + 8, fontBold, 5.5, true);
        bx += bCols[4];

        drawRect(page2, bx, p2y, bCols[5], 12, true, colLightYellow); drawRect(page2, bx, p2y, bCols[5], 12);
        drawText(page2, formatCurrency(rtState), bx + bCols[5]/2, p2y + 8, fontBold, 5.5, true);

        // Footer Handled at start of block
        drawText(page2, \`Page \${pageNum} of 2\`, PW/2, PH - 15, font, 8, true);

        const pdfBytes = await pdfDoc.save();`;

const ext = code.substring(0, footerIdx) + page2Logic + code.substring(code.indexOf('const pdfBytes = await pdfDoc.save();'));

fs.writeFileSync('src/lib/generateCCMLReport.ts', ext);
console.log('Done replacement');
