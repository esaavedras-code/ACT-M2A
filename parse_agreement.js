const fs = require('fs');
const pdfParse = require('pdf-parse');

(async () => {
    try {
        const buffer = fs.readFileSync('c:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\Documentos\\AC200023 PROJECT AGREEMENT.pdf');
        const pdfData = await pdfParse(buffer);
        console.log(pdfData.text);
    } catch (e) {
        console.error('Error:', e);
    }
})();
