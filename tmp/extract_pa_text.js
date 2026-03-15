const fs = require('fs');
const pdf = require('pdf-parse');

const pdfPath = 'c:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\Documentos\\AC200023 PROJECT AGREEMENT.pdf';

let dataBuffer = fs.readFileSync(pdfPath);

pdf(dataBuffer).then(function(data) {
    console.log(data.text);
}).catch(err => {
    console.error(err);
});
