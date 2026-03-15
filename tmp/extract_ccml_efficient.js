const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('c:', 'Users', 'Enrique Saavedra', 'Documents', 'Programa ACT', 'Documentos', '03AC200024 EWO 05 (G) (Contract Modification log).xlsm');

try {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets['CML Report'];
    
    // Function to get value by address
    const getV = (addr) => (sheet[addr] ? sheet[addr].v : null);
    const getR = (row, colStart, colEnd) => {
        const res = [];
        for(let c = colStart; c <= colEnd; c++) {
            const addr = XLSX.utils.encode_cell({r: row, c: c});
            res.push(getV(addr));
        }
        return res;
    };

    console.log("--- PROJECT INFO ---");
    console.log("Project Number:", getV('E8'));
    console.log("Federal Number:", getV('E9'));
    console.log("Oracle Number:", getV('E10'));
    console.log("Project Title:", getV('E11'));
    console.log("Contractor:", getV('E12'));
    console.log("Project Manager:", getV('E13'));
    console.log("Date:", getV('E14'));

    console.log("\n--- TIME INFO ---");
    console.log("Beginning Date:", getV('N8'));
    console.log("Original Time:", getV('N9'));
    console.log("Original Termination:", getV('N10'));
    console.log("Extensions:", getV('N11'));
    console.log("Revised Termination:", getV('N12'));

    console.log("\n--- PROJECT AGREEMENT DATA (Rows 39-48) ---");
    // Column B is 1, so Unit 1 is at B40? (Rows are 0-indexed in code, so R39 is Row 40)
    for(let r=39; r<=48; r++) {
        console.log(`Unit ${r-38}:`, JSON.stringify(getR(r, 1, 14)));
    }

    console.log("\n--- MODIFICATION DOCUMENTS (Rows 69-80) ---");
    for(let r=69; r<=80; r++) {
        const mod = getR(r, 1, 10);
        if(mod[0] || mod[1]) {
            console.log(`Mod R${r}:`, JSON.stringify(mod));
        }
    }

} catch (e) {
    console.error(e);
}
