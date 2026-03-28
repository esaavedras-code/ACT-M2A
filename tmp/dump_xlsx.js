const XLSX = require('xlsx');
const fs = require('fs');

const filePath = 'C:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\Documentos\\CML%20%28New%20Contract%20Moficaction%20Log%29%20-%20sin%20restriccion.xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = 'CML Report'; // From previous run
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const rows = data.map(row => {
        return row.map(cell => cell === null || cell === undefined ? '' : cell);
    });

    fs.writeFileSync('tmp/xlsx_data.json', JSON.stringify(rows, null, 2));
    console.log('Data saved to tmp/xlsx_data.json');
} catch (err) {
    console.error('Error:', err.message);
}
