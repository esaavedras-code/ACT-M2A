const fs = require('fs');
const PDFParser = require('pdf2json');
const path = require('path');

const pdfParser = new PDFParser(this, 1);

pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError));
pdfParser.on("pdfParser_dataReady", pdfData => {
    const rawText = pdfParser.getRawTextContent();
    const lines = rawText.split(/\r?\n/);
    const results = {};

    // Regex to match: ###-### (code) followed by 1-3 letters (unit) then text (description)
    // Actually, looking at the dump:
    // 203-001CuM Unclassified Excavation
    // 203-001 is the code
    // CuM is unit
    // Unclassified Excavation is description

    const itemRegex = /^(\d{3}-\d{3})([A-Za-z]+)\s+(.+)$/;

    lines.forEach(line => {
        const trimmed = line.trim();
        const match = trimmed.match(itemRegex);
        if (match) {
            const [_, code, unit, desc] = match;
            results[code] = {
                unit: unit,
                description: desc.trim()
            };
        }
    });

    const dataDir = path.join(__dirname, '../src/data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

    fs.writeFileSync(
        path.join(dataDir, 'specifications.json'),
        JSON.stringify(results, null, 2)
    );
    console.log(`Extracted ${Object.keys(results).length} items.`);
});

const pdfPath = path.join(__dirname, '../Documentos/item_sin_duplicados.pdf');
pdfParser.loadPDF(pdfPath);
