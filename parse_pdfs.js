const fs = require('fs');
const pdf = require('pdf-parse');
const path = require('path');

const docsDir = 'C:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\Documentos';
const files = [
  'ACT-45 Actividades.pdf',
  'ACT-45 Instrucciones.pdf',
  'ACT-96 Inspeccion.pdf',
  'ACT-96 Instrucciones.pdf'
];

async function parsePdfs() {
  for (const file of files) {
    try {
      const filePath = path.join(docsDir, file);
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdf(dataBuffer);
      const outPath = path.join(docsDir, file.replace('.pdf', '.txt'));
      fs.writeFileSync(outPath, data.text);
      console.log(`Successfully parsed ${file} to ${outPath}`);
    } catch (err) {
      console.error(`Error parsing ${file}:`, err);
    }
  }
}

parsePdfs();
