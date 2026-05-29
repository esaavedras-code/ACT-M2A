const fs = require('fs');
const b64 = fs.readFileSync('public/New Contract Modification Log amarillo.xlsx').toString('base64');
fs.writeFileSync('src/lib/ccmlTemplate.ts', `export const ccmlTemplateB64 = "${b64}";\n`);
console.log('CCML Template created');
