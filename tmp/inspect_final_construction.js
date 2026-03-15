const fs = require('fs');
const PDFParser = require('pdf2json');
const path = require('path');

const pdfParser = new PDFParser();

pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError));
pdfParser.on("pdfParser_dataReady", pdfData => {
    pdfData.Pages.forEach((page, pi) => {
        console.log(`--- Page ${pi} ---`);
        page.Texts.forEach(text => {
            const str = decodeURIComponent(text.R[0].T);
            console.log(`X: ${text.x}, Y: ${text.y}, Text: "${str}"`);
        });
    });
});

const pdfPath = path.join(__dirname, '../Documentos/8. Final Construction report.pdf');
pdfParser.loadPDF(pdfPath);
