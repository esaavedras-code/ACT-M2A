const fs = require('fs');
const path = require('path');
try {
    const b64Path = path.join(__dirname, '..', 'scratch', 'template_b64.txt');
    // Leemos el archivo, manejando posible codificación UTF-16 de PowerShell
    let b64 = fs.readFileSync(b64Path, 'utf16le').trim();
    if (!b64.startsWith('UEs')) { // Si no empieza con el header de ZIP/XLSX, probamos utf8
        b64 = fs.readFileSync(b64Path, 'utf8').trim();
    }
    const content = `export const ACT123_TEMPLATE_BASE64 = "${b64}";\n`;
    fs.writeFileSync(path.join(__dirname, '..', 'src', 'lib', 'act123Template.ts'), content);
    console.log("Plantilla ACT-123 actualizada con éxito.");
} catch (err) {
    console.error("Error:", err.message);
}
