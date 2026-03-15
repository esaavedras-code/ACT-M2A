const fs = require('fs');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

async function run() {
    const bytes = fs.readFileSync('public/ACT-117C_v2.pdf');
    const pdfDoc = await PDFDocument.load(bytes);
    const pages = pdfDoc.getPages();
    const page = pages[0];
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const factor = 16.0;
    const { width, height } = page.getSize();

    // Dibujar rejilla de diagnóstico
    for (let x = 0; x <= 38; x++) {
        page.drawLine({
            start: { x: x * factor, y: 0 },
            end: { x: x * factor, y: height },
            thickness: 0.2,
            color: rgb(0.8, 0.8, 1),
        });
        page.drawText(x.toString(), { x: x * factor + 2, y: height - 10, size: 6, font, color: rgb(0, 0, 1) });
    }

    for (let y = 0; y <= 50; y++) {
        page.drawLine({
            start: { x: 0, y: height - (y * factor) },
            end: { x: width, y: height - (y * factor) },
            thickness: 0.2,
            color: rgb(0.8, 0.8, 1),
        });
        page.drawText(y.toString(), { x: 5, y: height - (y * factor) - 8, size: 6, font, color: rgb(0, 0, 1) });
    }

    // Marcar puntos actuales del código para ver dónde caen
    const puntos = [
        { n: "1", x: 5.5, y: 4.8 },
        { n: "2", x: 8.0, y: 5.8 },
        { n: "17", x: 3.8, y: 14.65 }
    ];

    puntos.forEach(p => {
        page.drawText(`[${p.n}]`, {
            x: p.x * factor,
            y: height - (p.y * factor),
            size: 8,
            font,
            color: rgb(1, 0, 0)
        });
    });

    const newBytes = await pdfDoc.save();
    if (!fs.existsSync('tmp')) fs.mkdirSync('tmp');
    fs.writeFileSync('tmp/MAPA_COORDENADAS_ACT117C.pdf', newBytes);
    console.log('Mapa de coordenadas creado en tmp/MAPA_COORDENADAS_ACT117C.pdf');
}
run().catch(console.error);
