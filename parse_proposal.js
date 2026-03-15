const fs = require('fs');
const pdfParse = require('pdf-parse');

(async () => {
    try {
        const buffer = fs.readFileSync('AC200023 PROPOSAL.pdf');
        const pdfData = await pdfParse(buffer);
        console.log(pdfData.text);
    } catch (e) {
        console.error('Error:', e);
    }
})();
