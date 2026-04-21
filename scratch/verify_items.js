
const fs = require('fs');
const path = require('path');

const rawText = fs.readFileSync('test_raw.txt', 'utf8').toUpperCase();
const specs = JSON.parse(fs.readFileSync('src/data/specifications.json', 'utf8'));

const found = [];

Object.keys(specs).forEach(sCode => {
    const [prefix, suffix] = sCode.split('-');
    const pPattern = prefix.split('').join('\\s*');
    const sPattern = suffix.split('').join('\\s*');
    const regex = new RegExp(`(?:1\\s*)?${pPattern}\\s*[-__.\\s]*\\s*${sPattern}`, 'g');
    
    let match;
    while ((match = regex.exec(rawText)) !== null) {
        let lookahead = rawText.substring(match.index + match[0].length, match.index + match[0].length + 650);
        
        // Elastic Units
        const unitPatterns = [
            /L\s*S/i, /E\s*A/i, /S\s*Q\s*M/i, /L\s*F/i, /L\s*M/i, 
            /H\s*O\s*U\s*R\s*S?/i, /H\s*R\s*S?/i, /D\s*A\s*Y/i, 
            /M\s*2/i, /M\s*3/i, /T\s*O\s*N/i, /K\s*G/i
        ];

        let foundUnit = false;
        let uIdx = -1;
        for (const up of unitPatterns) {
            let um = lookahead.match(up);
            if (um) { foundUnit = true; uIdx = um.index; break; }
        }

        if (!foundUnit) continue;

        let beforeUnit = lookahead.substring(0, uIdx);
        let qtyM = beforeUnit.match(/(\d+)(?!.*\d)/); 
        let qty = qtyM ? parseInt(qtyM[1], 10) : 0;

        if (qty > 0) {
            found.push(sCode);
            break; // Move to next code
        }
    }
});

console.log(JSON.stringify(found.sort(), null, 2));
