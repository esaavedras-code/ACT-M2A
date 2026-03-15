const fs = require('fs');
const PDFParser = require('pdf2json');
const path = require('path');

const pdfParser = new PDFParser();

pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError));
pdfParser.on("pdfParser_dataReady", pdfData => {
    const pages = pdfData.Pages;
    pages.forEach((page, index) => {
        console.log(`--- Page ${index} ---`);
        page.Texts.forEach(text => {
            const str = decodeURIComponent(text.R[0].T);
            console.log(`x: ${text.x}, y: ${text.y}, text: "${str}"`);
        });
    });
});

const pdfPath = path.join(__dirname, '../Documentos/Forma de hoja de liquidacion.pdf');
pdfParser.loadPDF(pdfPath);
