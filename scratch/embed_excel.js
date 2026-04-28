const fs = require('fs');
const path = require('path');

const excelPath = path.join(__dirname, '..', 'public', 'templates', 'DOFAEI.xlsx');
const outputPath = path.join(__dirname, '..', 'src', 'lib', 'dofaeiTemplate.ts');

if (fs.existsSync(excelPath)) {
    const buffer = fs.readFileSync(excelPath);
    const base64 = buffer.toString('base64');
    const content = `export const DOFAEI_TEMPLATE_BASE64 = "${base64}";\n`;
    fs.writeFileSync(outputPath, content);
    console.log("Template Base64 generado en src/lib/dofaeiTemplate.ts");
} else {
    console.error("No se encontró el archivo Excel en:", excelPath);
}
