const fs = require('fs');
const path = 'C:\\\\Users\\\\Enrique Saavedra\\\\Documents\\\\PROGRAMAS AI\\\\Programa ACT\\\\Documentos\\\\ACT-123 Supplementary Contract Form rev 12-2024.xlsx';
const base64 = fs.readFileSync(path, 'base64');
const outPath = 'C:\\\\Users\\\\Enrique Saavedra\\\\Documents\\\\PROGRAMAS AI\\\\Programa ACT\\\\src\\\\lib\\\\act123Template.ts';
const content = `export const ACT123_TEMPLATE_BASE64 = "${base64}";\n`;
fs.writeFileSync(outPath, content, 'utf8');
console.log('done');
