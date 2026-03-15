const fs = require('fs');
const PDFParser = require('pdf2json');
const path = require('path');

const pdfParser = new PDFParser();

pdfParser.on("pdfParser_dataReady", pdfData => {
    const out = [];
    pdfData.Pages.forEach((page, pi) => {
        out.push(`\n========== PAGE ${pi} (W=${page.Width}, H=${page.Height}) ==========`);
        // All texts sorted by Y then X
        const texts = page.Texts.map(t => ({
            x: Math.round(t.x * 100) / 100,
            y: Math.round(t.y * 100) / 100,
            str: decodeURIComponent(t.R.map(r => r.T).join(''))
        })).sort((a, b) => a.y - b.y || a.x - b.x);

        texts.forEach(t => {
            if (t.str.trim()) out.push(`  Y=${t.y.toFixed(2)}, X=${t.x.toFixed(2)}: "${t.str}"`);
        });

        out.push(`\n  --- HLINES (${(page.HLines || []).length}) ---`);
        (page.HLines || []).forEach(l => out.push(`  y=${l.y.toFixed(2)}, x=${l.x.toFixed(2)}, w=${l.w.toFixed(2)}`));
        out.push(`\n  --- VLINES (${(page.VLines || []).length}) ---`);
        (page.VLines || []).forEach(l => out.push(`  x=${l.x.toFixed(2)}, y=${l.y.toFixed(2)}, l=${l.l.toFixed(2)}`));
    });

    fs.writeFileSync('./liq_full.txt', out.join('\n'));
    console.log('Written to liq_full.txt');
    out.slice(0, 100).forEach(l => console.log(l));
});

pdfParser.loadPDF(path.join(__dirname, '../Documentos/Forma de hoja de liquidacion.pdf'));
