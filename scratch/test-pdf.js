const pdf = require('pdf-parse');
const fs = require('fs');

// Polyfill for DOMMatrix if needed
if (typeof global.DOMMatrix === 'undefined') {
    console.log('Polyfilling DOMMatrix...');
    global.DOMMatrix = class DOMMatrix {
        constructor() {
            this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
        }
    };
}

const dataBuffer = fs.readFileSync('Documentos/ACT-45 Actividades.pdf');

pdf(dataBuffer).then(function(data) {
    console.log('PDF parsed successfully');
    console.log('Text length:', data.text.length);
}).catch(err => {
    console.error('Error parsing PDF:', err);
});
