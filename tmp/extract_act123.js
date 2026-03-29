const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync('C:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\Documentos\\ACT-123 CHO.pdf');

pdf(dataBuffer).then(function(data) {
    console.log("TEXT START");
    console.log(data.text);
    console.log("TEXT END");
}).catch(err => {
    console.error(err);
});
