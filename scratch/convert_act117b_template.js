const fs = require('fs');
const path = require('path');

const templatePath = 'C:\\Users\\Enrique Saavedra\\Documents\\PROGRAMAS AI\\Programa ACT\\Documentos\\ACT-117B Material On Site Balance Shee.xlsx';
const outputPath = 'c:\\Users\\Enrique Saavedra\\Documents\\PROGRAMAS AI\\Programa ACT\\src\\lib\\act117bTemplate.ts';

try {
    const fileBuffer = fs.readFileSync(templatePath);
    const base64Str = fileBuffer.toString('base64');
    
    const fileContent = `// PACT-Administradores - ACT-117B Template Base64
export const ACT117B_TEMPLATE_BASE64 = "${base64Str}";
`;
    
    fs.writeFileSync(outputPath, fileContent, 'utf8');
    console.log("Successfully wrote ACT-117B template Base64 to:", outputPath);
} catch (err) {
    console.error("Error converting template:", err.message);
}
