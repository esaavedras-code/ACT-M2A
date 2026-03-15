const fs = require('fs');
let file = fs.readFileSync('src/lib/generateCCMLReport.ts', 'utf8');

const startTag = `        // --- HEADER ---`;
const endTag = `        // --- PROJECT DESCRIPTION SECTION ---`;

const startIndex = file.indexOf(startTag);
const endIndex = file.indexOf(endTag);

const headerCode = file.substring(startIndex, endIndex);

const newHeaderCode = `        // --- HEADER ---
        const drawMainHeader = (p: any, cornerLabel: string) => {
${headerCode.split('\\n').map(l => l.startsWith('        ') ? l.substring(4) : l).join('\\n').replace(/page,/g, 'p,').replace(/drawText\\(page/g, 'drawText(p').replace(/drawLine\\(page/g, 'drawLine(p').replace(/drawRect\\(page/g, 'drawRect(p')}
            // Override corner label
            drawRect(p, 20, 5, 50, 20, true, colWhite);
            drawText(p, cornerLabel, 20, 15, fontBold, 8);
        };
        drawMainHeader(page, "1A");\n\n`;

const modified = file.substring(0, startIndex) + newHeaderCode + file.substring(endIndex);

// Add page 2 logic at the end instead of the return
const footerReplacementStr = `        // Footer
        drawText(page, \`Page \${pageNum} of 2\`, PW/2, PH - 15, font, 8, true);

        // --- PAGE 2 ---
        pageNum++;
        let page2 = pdfDoc.addPage([PW, PH]);
        drawMainHeader(page2, "3A");
        
        let p2y = 195; // Starting Y coordinate for the remaining modification rows
        // We will render remaining CHOs or just empty rows to total 6 or 7 rows
        // Re-declare modCols and subColsRemain if needed or rely on variable scope since we are in the same function
        // Mod table headers for page 2? Wait! The picture for Page 2 does NOT have headers for the leftover rows!
        // It's just rows directly! Wait, look at the picture:
        // Below the header, there's NO "Project Modification Documents" title and NO column headers. Just 7 rows of data starting immediately!
        // So we just render rows directly.
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

        // Section 3B
        p2y += 15;
        drawText(page2, "3B", 20, p2y, fontBold, 8);
        p2y += 15;

        // the 3B summary table headers
        // ... (remaining page 2 implementation logic that I will add manually after refactor) ...

        drawText(page2, \`Page \${pageNum} of 2\`, PW/2, PH - 15, font, 8, true);

        const pdfBytes = await pdfDoc.save();`;

const finalFile1 = modified.replace(
    /        \/\/ Footer[\s\S]*?const pdfBytes = await pdfDoc\.save\(\);/,
    footerReplacementStr
);

fs.writeFileSync('src/lib/generateCCMLReport.ts', finalFile1);
console.log("File refactored");
