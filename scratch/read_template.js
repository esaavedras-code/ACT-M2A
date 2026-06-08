const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');

const templatePath = "C:\\Users\\Enrique Saavedra\\Documents\\PROGRAMAS AI\\Programa ACT\\Documentos\\Solicitud del material Certification.docx";
const outputPath = path.join(__dirname, "template_content.txt");

async function extractText() {
    try {
        const result = await mammoth.extractRawText({ path: templatePath });
        const text = result.value;
        fs.writeFileSync(outputPath, text, 'utf8');
        console.log("Texto extraído con éxito en:", outputPath);
        
        const htmlResult = await mammoth.convertToHtml({ path: templatePath });
        fs.writeFileSync(outputPath.replace('.txt', '.html'), htmlResult.value, 'utf8');
        console.log("HTML extraído con éxito en:", outputPath.replace('.txt', '.html'));
    } catch (error) {
        console.error("Error al extraer texto:", error);
    }
}

extractText();
