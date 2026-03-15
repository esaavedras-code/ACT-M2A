const fs = require('fs');
let code = fs.readFileSync('src/lib/generateCCMLReport.ts', 'utf8');

// List of variables to convert to let in the first page if they were const
const varsToLet = [
    'colPeach', 'colGrayHeader', 'colLightGray', 'colYellow', 'colBlueHead', 'colWhite', 'colRed',
    'gInfoW', 'legW', 'tInfoW', 'timeLabels', 'originalTime', 'totalExtensions', 'changeTimePct',
    'totalChoAmt', 'changeAmtPct', 'totalRevisedTime', 'today', 'todayStr', 'elapsedDays',
    'timeCompletedPct', 'totalConstructionCost', 'workPerformedPct', 'totalCertifiedAmount',
    'contractorName', 'projectManagerName', 'labels', 'vals', 'timeVals'
];

varsToLet.forEach(v => {
    code = code.replace(new RegExp('const ' + v + ' =', 'g'), 'let ' + v + ' =');
});

// For page 2, we just remove const/let for these variables
const p2Start = code.indexOf('// --- PAGE 2 ---');
let p2Part = code.substring(p2Start);

varsToLet.forEach(v => {
    p2Part = p2Part.replace(new RegExp('const ' + v + ' =', 'g'), v + ' =');
    p2Part = p2Part.replace(new RegExp('let ' + v + ' =', 'g'), v + ' =');
});

// Also check for tx, txInfo, ty, gy in p2Part
p2Part = p2Part.replace(/let gy =/g, 'gy =');
p2Part = p2Part.replace(/let txInfo =/g, 'txInfo =');
p2Part = p2Part.replace(/let ty =/g, 'ty =');
p2Part = p2Part.replace(/let tx =/g, 'tx =');

code = code.substring(0, p2Start) + p2Part;

fs.writeFileSync('src/lib/generateCCMLReport.ts', code);
console.log('Cleanup 2 done');
