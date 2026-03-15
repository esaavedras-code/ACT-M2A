const fs = require('fs');
let code = fs.readFileSync('src/lib/generateCCMLReport.ts', 'utf8');

// Reverse the wrapper function
const oldDecl = `        const drawMainHeader = (p: any, cornerStr: string) => {\n        drawRect(p, 10, 5, 50, 20, true, rgb(1,1,1)); drawText(p, cornerStr, 20, 15, fontBold, 8);`;
code = code.replace(oldDecl, `        drawText(page, "1A", 20, 15, fontBold, 8);`);

const endDecl = `        };\n        drawMainHeader(page, "1A");`;
code = code.replace(endDecl, ``);

code = code.replace(/drawText\(p,/g, "drawText(page,");
code = code.replace(/drawLine\(p,/g, "drawLine(page,");
code = code.replace(/drawRect\(p,/g, "drawRect(page,");

// Remove the `drawMainHeader(page2, "3A");` call from page 2 script since it doesn't exist anymore
// Let's replace it with the actual header code!
const headerStartToken = `        // --- HEADER ---`;
const headerEndToken = `        // --- PROJECT DESCRIPTION SECTION ---`;
const originalHeaderCode = code.substring(code.indexOf(headerStartToken), code.indexOf(headerEndToken));

let page2HeaderCode = originalHeaderCode.replace(/page/g, 'page2').replace(/1A/g, '3A');

code = code.replace(`        drawMainHeader(page2, "3A");`, page2HeaderCode);

fs.writeFileSync('src/lib/generateCCMLReport.ts', code);
