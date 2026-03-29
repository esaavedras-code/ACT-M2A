const fs = require('fs');
const { PDFDocument } = require('pdf-lib');

async function checkFields() {
    const pdfBytes = fs.readFileSync('C:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\Documentos\\ACT-123 CHO.pdf');
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    
    console.log("PDF FIELDS START");
    fields.forEach(field => {
        const type = field.constructor.name;
        const name = field.getName();
        console.log(`${name} (${type})`);
    });
    console.log("PDF FIELDS END");
}

checkFields().catch(console.error);
