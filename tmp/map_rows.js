const fs = require('fs');
const json = require('./tmp/xlsx_data.json');
const out = [];
json.forEach((r, i) => {
    const vals = r.filter(x => x !== null && x !== undefined);
    if (vals.length > 0) out.push(`Row ${i+1}: ${JSON.stringify(vals).substring(0, 100)}`);
});
fs.writeFileSync('./tmp/row_mapping.txt', out.join('\n'));
