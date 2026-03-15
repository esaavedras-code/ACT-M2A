const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('c:', 'Users', 'Enrique Saavedra', 'Documents', 'Programa ACT', 'Documentos', '03AC200024 EWO 05 (G) (Contract Modification log).xlsm');

try {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets['CML Report'];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    // Helper to get value at row/col
    const val = (r, c) => data[r] ? data[r][c] : null;

    console.log("--- PROJECT INFO ---");
    console.log("Project Number:", val(7, 4));
    console.log("Federal Number:", val(8, 4));
    console.log("Oracle Number:", val(9, 4));
    console.log("Project Title:", val(10, 4));
    console.log("Contractor:", val(11, 4));
    console.log("Project Manager:", val(12, 4));
    console.log("Date:", val(13, 4));

    console.log("\n--- TIME INFO ---");
    console.log("Beginning Date:", val(7, 13));
    console.log("Original Time:", val(8, 13));
    console.log("Original Termination:", val(9, 13));
    console.log("Extensions:", val(10, 13));
    console.log("Revised Termination:", val(11, 13));

    console.log("\n--- PROJECT AGREEMENT DATA (Rows 39-48) ---");
    for(let i=39; i<=48; i++) {
        console.log(`Unit ${i-38}:`, JSON.stringify(data[i].slice(1, 15)));
    }

    console.log("\n--- MODIFICATION DOCUMENTS (Rows 69-80) ---");
    for(let i=69; i<=80; i++) {
        if(data[i] && (data[i][1] || data[i][2])) {
            console.log(`Mod R${i}:`, JSON.stringify(data[i].slice(1, 10)));
        }
    }

} catch (e) {
    console.error(e);
}
