const fs = require('fs');
const PDFParser = require('pdf2json');
const path = require('path');

const pdfParser = new PDFParser();

pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError));
pdfParser.on("pdfParser_dataReady", pdfData => {
    // Print entire raw JSON so we see everything
    const simplified = {
        numPages: pdfData.Pages.length,
        pages: pdfData.Pages.map((p, i) => ({
            pageNum: i,
            width: p.Width,
            height: p.Height,
            texts: p.Texts.map(t => ({
                x: t.x,
                y: t.y,
                str: decodeURIComponent(t.R[0].T)
            })),
            lines: (p.HLines || []).slice(0, 20).map(l => ({ x: l.x, y: l.y, w: l.w })),
            vlines: (p.VLines || []).slice(0, 20).map(l => ({ x: l.x, y: l.y, l: l.l }))
        }))
    };
    fs.writeFileSync('./liquidation_pdf_data.json', JSON.stringify(simplified, null, 2));
    console.log('Written to liquidation_pdf_data.json');
    console.log('Pages:', simplified.numPages);
    simplified.pages.forEach(p => {
        console.log(`\n=== Page ${p.pageNum} (${p.width} x ${p.height}) ===`);
        p.texts.forEach(t => {
            if (t.str.trim()) console.log(`  [${t.x.toFixed(2)}, ${t.y.toFixed(2)}] "${t.str.trim()}"`);
        });
    });
});

const pdfPath = path.join(__dirname, '../Documentos/Forma de hoja de liquidacion.pdf');
pdfParser.loadPDF(pdfPath);
