const fs = require('fs');
let code = fs.readFileSync('src/lib/generateCCMLReport.ts', 'utf8');

// Fix the pdfBytes duplicate
code = code.replace('const pdfBytes = await pdfDoc.save();const pdfBytes = await pdfDoc.save();', 'const pdfBytes = await pdfDoc.save();');

// Fix redeclarations in page 2 section
// Basically remove "const " or "let " prefix for variables that were already declared in page 1.

const p2Lines = code.split('\n');
const seenDecls = new Set();
const outLines = [];

// This is a bit risky to do blindly.
// Instead, I'll target the specific start of page 2 and remove the redundant declarations.

let inPage2 = false;
for (let i = 0; i < p2Lines.length; i++) {
    let line = p2Lines[i];
    
    if (line.includes('// --- PAGE 2 ---')) {
        inPage2 = true;
    }
    
    if (inPage2) {
        // Targeted removals for common redeclarations
        line = line.replace(/^\s+const colPeach =/, '        colPeach =');
        line = line.replace(/^\s+const colGrayHeader =/, '        colGrayHeader =');
        line = line.replace(/^\s+const colLightGray =/, '        colLightGray =');
        line = line.replace(/^\s+const colYellow =/, '        colYellow =');
        line = line.replace(/^\s+const colBlueHead =/, '        colBlueHead =');
        line = line.replace(/^\s+const colWhite =/, '        colWhite =');
        line = line.replace(/^\s+const colRed =/, '        colRed =');
        line = line.replace(/^\s+const gInfoW =/, '        gInfoW =');
        line = line.replace(/^\s+const legW =/, '        legW =');
        line = line.replace(/^\s+const tInfoW =/, '        tInfoW =');
        line = line.replace(/^\s+let startX =/, '        startX =');
        line = line.replace(/^\s+let gy =/, '        gy =');
        line = line.replace(/^\s+const timeLabels =/, '        timeLabels =');
        line = line.replace(/^\s+const originalTime =/, '        originalTime =');
        line = line.replace(/^\s+const totalExtensions =/, '        totalExtensions =');
        line = line.replace(/^\s+const changeTimePct =/, '        changeTimePct =');
        line = line.replace(/^\s+const totalChoAmt =/, '        totalChoAmt =');
        line = line.replace(/^\s+const changeAmtPct =/, '        changeAmtPct =');
        line = line.replace(/^\s+const totalRevisedTime =/, '        totalRevisedTime =');
        line = line.replace(/^\s+const today =/, '        today =');
        line = line.replace(/^\s+const todayStr =/, '        todayStr =');
        line = line.replace(/^\s+const elapsedDays =/, '        elapsedDays =');
        line = line.replace(/^\s+const timeCompletedPct =/, '        timeCompletedPct =');
        line = line.replace(/^\s+const totalConstructionCost =/, '        totalConstructionCost =');
        line = line.replace(/^\s+const workPerformedPct =/, '        workPerformedPct =');
        line = line.replace(/^\s+const timeVals =/, '        timeVals =');
        line = line.replace(/^\s+let txInfo =/, '        txInfo =');
        line = line.replace(/^\s+let ty =/, '        ty =');
    }
    outLines.push(line);
}

// Also need to change const to let in the first page so they can be reassigned
let finalCode = outLines.join('\n');
finalCode = finalCode.replace('const colPeach =', 'let colPeach =');
finalCode = finalCode.replace('const colGrayHeader =', 'let colGrayHeader =');
finalCode = finalCode.replace('const colLightGray =', 'let colLightGray =');
finalCode = finalCode.replace('const colYellow =', 'let colYellow =');
finalCode = finalCode.replace('const colBlueHead =', 'let colBlueHead =');
finalCode = finalCode.replace('const colWhite =', 'let colWhite =');
finalCode = finalCode.replace('const colRed =', 'let colRed =');
finalCode = finalCode.replace('const gInfoW =', 'let gInfoW =');
finalCode = finalCode.replace('const legW =', 'let legW =');
finalCode = finalCode.replace('const tInfoW =', 'let tInfoW =');
// startX is already let
// gy is already let
finalCode = finalCode.replace('const timeLabels =', 'let timeLabels =');
finalCode = finalCode.replace('const originalTime =', 'let originalTime =');
finalCode = finalCode.replace('const totalExtensions =', 'let totalExtensions =');
finalCode = finalCode.replace('const changeTimePct =', 'let changeTimePct =');
finalCode = finalCode.replace('const totalChoAmt =', 'let totalChoAmt =');
finalCode = finalCode.replace('const changeAmtPct =', 'let changeAmtPct =');
finalCode = finalCode.replace('const totalRevisedTime =', 'let totalRevisedTime =');
finalCode = finalCode.replace('const today =', 'let today =');
finalCode = finalCode.replace('const todayStr =', 'let todayStr =');
finalCode = finalCode.replace('const elapsedDays =', 'let elapsedDays =');
finalCode = finalCode.replace('const timeCompletedPct =', 'let timeCompletedPct =');
finalCode = finalCode.replace('const totalConstructionCost =', 'let totalConstructionCost =');
finalCode = finalCode.replace('const workPerformedPct =', 'let workPerformedPct =');
finalCode = finalCode.replace('const timeVals =', 'let timeVals =');
// txInfo and ty are already let

fs.writeFileSync('src/lib/generateCCMLReport.ts', finalCode);
console.log('Cleanup done');
