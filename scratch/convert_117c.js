const fs = require('fs');
const path = require('path');

try {
  const xlsxPath = 'C:\\Users\\Enrique Saavedra\\Documents\\PROGRAMAS AI\\Programa ACT\\Documentos\\ACT-117C.xlsx';
  const outputPath = 'C:\\Users\\Enrique Saavedra\\Documents\\PROGRAMAS AI\\Programa ACT\\src\\lib\\act117cTemplate.ts';

  console.log(`Leyendo archivo: ${xlsxPath}...`);
  if (!fs.existsSync(xlsxPath)) {
    throw new Error(`El archivo de origen no existe en la ruta: ${xlsxPath}`);
  }

  const fileBuffer = fs.readFileSync(xlsxPath);
  const base64String = fileBuffer.toString('base64');
  console.log(`Convertido a Base64 con éxito. Tamaño de la cadena: ${base64String.length} caracteres.`);

  const content = `// Auto-generated base64 template for ACT-117C.xlsx
// DO NOT EDIT MANUALLY
export const ACT117C_TEMPLATE_BASE64 = "${base64String}";
`;

  fs.writeFileSync(outputPath, content, 'utf8');
  console.log(`Plantilla actualizada con éxito en: ${outputPath}`);
} catch (error) {
  console.error("Error al convertir la plantilla:", error);
  process.exit(1);
}
