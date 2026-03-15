const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('c:', 'Users', 'Enrique Saavedra', 'Documents', 'Programa ACT', 'Documentos', '03AC200024 EWO 05 (G) (Contract Modification log).xlsm');

try {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets['CML Report'];
    
    const getV = (r, c) => {
        const addr = XLSX.utils.encode_cell({r, c});
        const cell = sheet[addr];
        return cell ? (cell.t === 'n' ? cell.v : cell.w || cell.v) : null;
    };

    console.log("--- UNIT HEADERS (Row 38) ---");
    const headers = [];
    for(let c=0; c<=20; c++) headers.push(getV(37, c));
    console.log(JSON.stringify(headers));

    console.log("\n--- UNIT DATA (Rows 40-49) ---");
    for(let r=39; r<=48; r++) {
        const row = [];
        for(let c=1; c<=17; c++) row.push(getV(r, c));
        console.log(`Unit ${r-38}:`, JSON.stringify(row));
    }

    console.log("\n--- MODIFICATION HEADERS (Row 68) ---");
    const modHeaders = [];
    for(let c=1; c<=15; c++) modHeaders.push(getV(67, c));
    console.log(JSON.stringify(modHeaders));

} catch (e) {
    console.error(e);
}
