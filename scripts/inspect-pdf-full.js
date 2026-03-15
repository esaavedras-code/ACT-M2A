const fs = require('fs');
const PDFParser = require('pdf2json');
const path = require('path');

const pdfParser = new PDFParser();

pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError));
pdfParser.on("pdfParser_dataReady", pdfData => {
    pdfData.Pages.forEach((page, pIdx) => {
        console.log(`Page ${pIdx + 1}`);
        page.Texts.forEach(text => {
            const str = decodeURIComponent(text.R[0].T);
            console.log(`P${pIdx + 1} - X:${text.x.toFixed(2)} Y:${text.y.toFixed(2)}: "${str}"`);
        });
    });
});

const pdfPath = path.join(__dirname, '../Documentos/9. Final Estimate.pdf');
pdfParser.loadPDF(pdfPath);
