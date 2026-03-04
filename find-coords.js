const fs = require('fs');
const PDFParser = require("pdf2json");

let pdfParser = new PDFParser();

pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError));
pdfParser.on("pdfParser_dataReady", pdfData => {
    let t = pdfData.Pages[0].Texts;
    let out = [];
    t.forEach(text => {
        let textVal = '';
        try {
            textVal = decodeURIComponent(text.R[0].T);
        } catch (e) {
            textVal = text.R[0].T;
        }
        if (textVal) {
            out.push(`${textVal}: x=${text.x.toFixed(2)}, y=${text.y.toFixed(2)}`);
        }
    });
    fs.writeFileSync('coords.txt', out.join('\n'));
});

pdfParser.loadPDF("Documentos/ACT-117C_Reporte.pdf");
