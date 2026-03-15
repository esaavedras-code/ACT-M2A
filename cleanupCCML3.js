const fs = require('fs');
let code = fs.readFileSync('src/lib/generateCCMLReport.ts', 'utf8');

const varsToLet = [
    'colPeach', 'colGrayHeader', 'colLightGray', 'colYellow', 'colBlueHead', 'colWhite', 'colRed',
    'gInfoW', 'legW', 'tInfoW', 'timeLabels', 'originalTime', 'totalExtensions', 'changeTimePct',
    'totalChoAmt', 'changeAmtPct', 'totalRevisedTime', 'today', 'todayStr', 'elapsedDays',
    'timeCompletedPct', 'totalConstructionCost', 'workPerformedPct', 'totalCertifiedAmount',
    'contractorName', 'projectManagerName', 'labels', 'vals', 'timeVals', 'lx', 'ly', 'py', 'gy'
];

varsToLet.forEach(v => {
    // Replace const/let with let in the first occurrence
    code = code.replace(new RegExp('(const|let) ' + v + ' ='), 'let ' + v + ' =');
});

// For all subsequent occurrences of declarations, remove the keyword
const lines = code.split('\n');
const seen = new Set();
const out = [];

for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    let matched = false;
    for (const v of varsToLet) {
        const regex = new RegExp('^\\s+(const|let) ' + v + ' =');
        if (regex.test(line)) {
            if (seen.has(v)) {
                line = line.replace(/(const|let) /, '');
            } else {
                seen.add(v);
            }
        }
    }
    out.push(line);
}

fs.writeFileSync('src/lib/generateCCMLReport.ts', out.join('\n'));
console.log('Cleanup 3 done');
