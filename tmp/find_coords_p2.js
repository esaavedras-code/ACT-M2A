const fs = require('fs');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

async function run() {
    const bytes = fs.readFileSync('public/ACT-117C_v2.pdf');
    const pdfDoc = await PDFDocument.load(bytes);
    const pages = pdfDoc.getPages();
    const pageBack = pages[1];
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const factor = 16.0;
    const pageHeight = pageBack.getSize().height;

    const drawGrid = () => {
        for (let x = 0; x < 50; x++) {
            pageBack.drawText(x.toString(), { x: x * factor, y: pageHeight - 10, size: 6, font });
        }
        for (let y = 0; y < 50; y++) {
            pageBack.drawText(y.toString(), { x: 5, y: pageHeight - (y * factor), size: 6, font });
        }
    };

    drawGrid();

    // Mark some potential spots on Page 2
    // Section Delay
    pageBack.drawText('47', { x: 26 * factor, y: pageHeight - (8.5 * factor) - 15, size: 10, font, color: rgb(1, 0, 0) });
    pageBack.drawText('48', { x: 34 * factor, y: pageHeight - (8.5 * factor) - 15, size: 10, font, color: rgb(1, 0, 0) });
    pageBack.drawText('49', { x: 6 * factor, y: pageHeight - (10.3 * factor) - 15, size: 10, font, color: rgb(1, 0, 0) });
    pageBack.drawText('50', { x: 16 * factor, y: pageHeight - (10.3 * factor) - 15, size: 10, font, color: rgb(1, 0, 0) });
    pageBack.drawText('51', { x: 44 * factor, y: pageHeight - (10.3 * factor) - 15, size: 10, font, color: rgb(1, 0, 0) });

    const newBytes = await pdfDoc.save();
    fs.writeFileSync('tmp/test_coords_p2.pdf', newBytes);
    console.log('Test PDF created at tmp/test_coords_p2.pdf');
}
run();
