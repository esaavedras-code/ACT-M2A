const fs = require('fs');
let code = fs.readFileSync('src/lib/generateCCMLReport.ts', 'utf8');

// The variables we want to ensure are NOT redeclared with const/let
const vars = [
    'colPeach', 'colGrayHeader', 'colLightGray', 'colYellow', 'colBlueHead', 'colWhite', 'colRed',
    'gInfoW', 'legW', 'tInfoW', 'startX', 'gy', 'tx', 'ty', 'py', 'lx', 'ly', 'txInfo', 'totalW', 'bCols', 'subColW', 
    'cx3B', 'th3BCols', 'contY', 'contX', 'contW', 'cwx', 'msgFed', 'bx', 'rtTot', 'rtFed', 'rtToll', 'rtState', 'origTot',
    'timeLabels', 'originalTime', 'totalExtensions', 'changeTimePct', 'totalChoAmt', 'changeAmtPct', 
    'totalRevisedTime', 'today', 'todayStr', 'elapsedDays', 'timeCompletedPct', 'totalConstructionCost', 
    'workPerformedPct', 'totalCertifiedAmount', 'contractorName', 'projectManagerName', 'labels', 'vals', 'timeVals'
];

// Helper to remove declaration keywords after the initial declaration block
// We find where the "Declare shared variables" block ends and start filtering from there
const splitMarker = '// Declare shared variables for multi-page rendering';
const parts = code.split(splitMarker);

if (parts.length === 2) {
    let header = parts[0] + splitMarker;
    let body = parts[1];

    // In the body, look for "const var =" or "let var =" and remove the "const "/"let "
    vars.forEach(v => {
        // Regex to match " const name =" or " let name =" at start of line or after spaces
        // We use a global replace but careful not to match when it's part of a larger name
        const regex = new RegExp('(\\s+)(const|let)(\\s+' + v + '\\s*=)', 'g');
        body = body.replace(regex, '$1$3');
    });

    code = header + body;
}

fs.writeFileSync('src/lib/generateCCMLReport.ts', code);
console.log('Cleanup 5 done');
