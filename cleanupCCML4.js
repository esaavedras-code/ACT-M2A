const fs = require('fs');
let code = fs.readFileSync('src/lib/generateCCMLReport.ts', 'utf8');

const moreVars = ['totalW', 'bCols', 'subColW', 'cx3B', 'th3BCols', 'contY', 'contX', 'contW', 'cwx', 'msgFed', 'bx', 'rtTot', 'rtFed', 'rtToll', 'rtState', 'origTot'];

moreVars.forEach(v => {
    code = code.replace(new RegExp('(const|let) ' + v + ' ='), 'let ' + v + ' =');
});

const lines = code.split('\n');
const seen = new Set(['colPeach', 'colGrayHeader', 'colLightGray', 'colYellow', 'colBlueHead', 'colWhite', 'colRed', 'gInfoW', 'legW', 'tInfoW', 'timeLabels', 'originalTime', 'totalExtensions', 'changeTimePct', 'totalChoAmt', 'changeAmtPct', 'totalRevisedTime', 'today', 'todayStr', 'elapsedDays', 'timeCompletedPct', 'totalConstructionCost', 'workPerformedPct', 'totalCertifiedAmount', 'contractorName', 'projectManagerName', 'labels', 'vals', 'timeVals', 'lx', 'ly', 'py', 'gy']);

const out = [];
for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    for (const v of [...moreVars, ...Array.from(seen)]) {
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

// Fix messages in Section 3B
let final = out.join('\n');
final = final.replace('sumTollModLet > 0 ? "YES..." : "NO additional toll credits needed."', 'sumTollModLet > 0 ? "YES. Additional toll credits needed." : "NO additional toll credits needed."');
final = final.replace('sumStateAmt > 0 ? "YES..." : "NO additional state funds needed."', 'sumStateAmt > 0 ? "YES. PRHTA needs to identify additional state funds." : "NO additional state funds needed."');

fs.writeFileSync('src/lib/generateCCMLReport.ts', final);
console.log('Cleanup 4 done');
