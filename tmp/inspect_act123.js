const fs = require('fs');
const PDFParser = require('pdf2json');
const path = require('path');

const pdfParser = new PDFParser();

pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError));
pdfParser.on("pdfParser_dataReady", pdfData => {
    // pdf2json use its own coordinate system (8.5x11 inches * 40 units/inch usually)
    // pdf-lib use points (72 points/inch)
    const ratio = 72 / 4; // Approx conversion if using standard pdf2json units
    
    pdfData.Pages.forEach((page, pIdx) => {
        console.log(`--- Page ${pIdx + 1} ---`);
        page.Texts.forEach(text => {
            const str = decodeURIComponent(text.R[0].T);
            // x, y are in units usually around 40 units/inch
            // Let's print raw values first to verify
            console.log(`X:${text.x.toFixed(2)} Y:${text.y.toFixed(2)} | Text: "${str}"`);
        });
    });
});

pdfParser.loadPDF("C:/Users/Enrique Saavedra/Documents/ACT-123 CHO.pdf");
