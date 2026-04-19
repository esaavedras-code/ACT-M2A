const { PDFParse } = require('pdf-parse');
const fs = require('fs');

const buf = fs.readFileSync('Documentos/AC200023 PROPOSAL.pdf');
const parser = new PDFParse();
parser.parse(buf).then(data => {
    const text = data.text || (data.pages ? data.pages.map(p => p.text).join('\n') : JSON.stringify(data));
    fs.writeFileSync('proposal_output.txt', text);
    console.log('Done!');
    console.log('Keys:', Object.keys(data));
    console.log('First 3000 chars:', text.substring(0, 3000));
}).catch(err => {
    console.error('Error:', err.message);
    console.log('Error details:', err);
});
