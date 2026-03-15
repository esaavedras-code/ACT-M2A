const fs = require('fs');
const PDFParser = require('pdf2json');
const path = require('path');

const pdfParser = new PDFParser();

pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError));
pdfParser.on("pdfParser_dataReady", pdfData => {
    const page = pdfData.Pages[0];
    console.log(`Page Size in pdf2json units: W=${page.Width} H=${page.Height}`);
    console.log(`(Actual point size: W=${page.Width * 16} H=${page.Height * 16})`);
    console.log('\n--- ALL TEXTS ---');
    page.Texts.forEach(text => {
        const str = decodeURIComponent(text.R[0].T);
        if (str.trim()) {
            console.log(`X: ${text.x.toFixed(3)}, Y: ${text.y.toFixed(3)}, Text: "${str.trim()}"`);
        }
    });

    console.log('\n--- PAGE 2 ---');
    if (pdfData.Pages[1]) {
        const page2 = pdfData.Pages[1];
        page2.Texts.forEach(text => {
            const str = decodeURIComponent(text.R[0].T);
            if (str.trim()) {
                console.log(`X: ${text.x.toFixed(3)}, Y: ${text.y.toFixed(3)}, Text: "${str.trim()}"`);
            }
        });
    }
});

const pdfPath = path.join(__dirname, '../Documentos/Forma de hoja de liquidacion.pdf');
pdfParser.loadPDF(pdfPath);
