const fs = require('fs');
const PDFParser = require('pdf2json');
const path = require('path');

const pdfParser = new PDFParser(this, 1); // Pass 1 for text only

pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError));
pdfParser.on("pdfParser_dataReady", pdfData => {
    const textLines = pdfParser.getRawTextContent().split('\r\n');
    console.log(textLines.slice(0, 100).join('\n')); // Show first 100 lines to see structure
});

const pdfPath = path.join(__dirname, '../Documentos/item_sin_duplicados.pdf');
pdfParser.loadPDF(pdfPath);
