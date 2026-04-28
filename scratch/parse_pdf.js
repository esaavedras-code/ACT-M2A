const fs = require('fs');
const PDFParser = require("pdf2json");

const pdfParser = new PDFParser();

pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError));
pdfParser.on("pdfParser_dataReady", pdfData => {
    fs.writeFileSync("./scratch/dofaei_structure.json", JSON.stringify(pdfData));
    console.log("PDF parsed successfully. Structure saved to ./scratch/dofaei_structure.json");
    
    // Also log some text to see the content
    const text = pdfData.Pages.map(page => {
        return page.Texts.map(t => decodeURIComponent(t.R[0].T)).join(' ');
    }).join('\n--- Page Break ---\n');
    console.log("--- TEXT CONTENT ---");
    console.log(text);
});

pdfParser.loadPDF("C:/Users/Enrique Saavedra/Documents/PROGRAMAS AI/Programa ACT/Documentos/DOFAEI.pdf");
