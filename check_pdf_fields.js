const fs = require('fs');
const { PDFDocument } = require('pdf-lib');
const path = require('path');

const docsDir = 'C:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\Documentos';
const files = [
  'ACT-45 Actividades.pdf',
  'ACT-96 Inspeccion.pdf'
];

async function checkPdfFields() {
  for (const file of files) {
    try {
      const filePath = path.join(docsDir, file);
      const pdfBytes = fs.readFileSync(filePath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const form = pdfDoc.getForm();
      const fields = form.getFields();
      console.log(`\n--- Fields in ${file} ---`);
      fields.forEach(field => {
        const type = field.constructor.name;
        const name = field.getName();
        console.log(`${type}: ${name}`);
      });
      if (fields.length === 0) {
        console.log("No form fields found in this PDF.");
      }
    } catch (err) {
      console.error(`Error processing ${file}:`, err);
    }
  }
}

checkPdfFields();
