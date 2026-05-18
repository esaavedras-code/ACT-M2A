const fs = require('fs');
const path = require('path');

try {
  const xlsPath = 'C:\\Users\\Enrique Saavedra\\Documents\\PROGRAMAS AI\\Programa ACT\\Documentos\\Liquidacion Item No. 001 MOBILIZACION.xls';
  const outputPath = 'C:\\Users\\Enrique Saavedra\\Documents\\PROGRAMAS AI\\Programa ACT\\src\\lib\\mobilizationTemplate.ts';

  console.log(`Leyendo archivo de plantilla de movilización: ${xlsPath}...`);
  if (!fs.existsSync(xlsPath)) {
    throw new Error(`El archivo de origen no existe en la ruta: ${xlsPath}`);
  }

  const fileBuffer = fs.readFileSync(xlsPath);
  const base64String = fileBuffer.toString('base64');
  console.log(`Convertido a Base64 con éxito. Tamaño de la cadena: ${base64String.length} caracteres.`);

  const content = `// Auto-generated base64 template for Liquidacion Item No. 001 MOBILIZACION.xls
// DO NOT EDIT MANUALLY
export const MOBILIZATION_TEMPLATE_BASE64 = "${base64String}";
`;

  fs.writeFileSync(outputPath, content, 'utf8');
  console.log(`Plantilla de movilización creada con éxito en: ${outputPath}`);
} catch (error) {
  console.error("Error al convertir la plantilla de movilización:", error);
  process.exit(1);
}
