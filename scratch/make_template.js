const fs = require('fs');
const b64 = fs.readFileSync('public/templates/Desglose_de_Subcontratos.xlsx').toString('base64');
fs.writeFileSync('src/lib/subcontratosTemplate.ts', `export const subcontratosTemplateB64 = "${b64}";\n`);
console.log('Template created');
