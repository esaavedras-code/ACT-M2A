const fs = require('fs');

const path = require('path');

const docsDir = path.join(__dirname, 'Documentos');
const files = [
  'ACT-45 Actividades.pdf',
  'ACT-45 Instrucciones.pdf',
  'ACT-96 Inspeccion.pdf',
  'ACT-96 Instrucciones.pdf'
];

const PDFParser = require("pdf2json");

async function parsePdfs() {
  for (const file of files) {
    try {
      const filePath = path.join(docsDir, file);
      if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        continue;
      }
      
      const pdfParser = new PDFParser(null, 1);
      
      const text = await new Promise((resolve, reject) => {
        pdfParser.on("pdfParser_dataError", errData => reject(errData.parserError));
        pdfParser.on("pdfParser_dataReady", pdfData => {
          resolve(pdfParser.getRawTextContent());
        });
        pdfParser.loadPDF(filePath);
      });

      const outPath = path.join(docsDir, file.replace('.pdf', '.txt'));
      fs.writeFileSync(outPath, text);
      console.log(`Successfully parsed ${file} to ${outPath}`);
    } catch (err) {
      console.error(`Error parsing ${file}:`, err);
    }
  }
}


parsePdfs();
