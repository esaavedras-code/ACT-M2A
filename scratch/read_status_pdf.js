const fs = require('fs');
const path = require('path');
const PDFParser = require('pdf2json');

const pdfPath = path.join(__dirname, '..', 'Documentos', 'AC-200024 PROJECT STATUS 06052026.pdf');
console.log('Reading:', pdfPath);

if (!fs.existsSync(pdfPath)) {
    console.error('File does not exist');
    process.exit(1);
}

const buffer = fs.readFileSync(pdfPath);
const pdfParser = new PDFParser(null, 1);
pdfParser.on('pdfParser_dataError', errData => {
    console.error(errData.parserError);
});
pdfParser.on('pdfParser_dataReady', () => {
    const rawText = pdfParser.getRawTextContent();
    fs.writeFileSync(path.join(__dirname, 'status_pdf_text.txt'), rawText, 'utf8');
    console.log('Successfully saved to scratch/status_pdf_text.txt');
});

pdfParser.parseBuffer(buffer);
