const XLSX = require('xlsx');
try {
    const workbook = XLSX.readFile('C:\\Users\\Enrique Saavedra\\Documents\\PROGRAMAS AI\\Programa ACT\\Documentos\\ACT-123 Supplementary Contract Form rev 12-2024.xlsx');
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    // Revisamos celdas específicas donde esperamos valores
    const targets = ['I9', 'I10', 'I11', 'I12', 'I13', 'I14', 'I15', 'I16', 'AV9', 'AV10', 'AV11', 'AV12', 'AV13', 'AV14', 'AV15'];
    targets.forEach(ref => {
        const cell = sheet[ref];
        console.log(`${ref}: ${cell ? cell.v : 'EMPTY'}`);
    });
} catch (err) {
    console.error("Error:", err.message);
}
