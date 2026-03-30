const XLSX = require('xlsx');

const formPath = 'c:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\Documentos\\ACT-123 Supplementary Contract Form rev 12-2024.xlsx';
const instPath = 'c:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\Documentos\\ACT-123 Instructions.xlsx';
const outputPath = 'c:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\public\\ACT-123_Official_Template.xlsx';

async function merge() {
    console.log('Reading ACT-123 files...');
    const wbForm = XLSX.readFile(formPath);
    const wbInst = XLSX.readFile(instPath);

    console.log('Copying instructions from sheet "Instructions"...');
    const sourceInst = wbInst.Sheets['Instructions'];
    if (!sourceInst) throw new Error("No 'Instructions' sheet found in instructions file.");

    // Create 'Instructions' sheet in the form workbook
    wbForm.SheetNames.push('Instructions');
    wbForm.Sheets['Instructions'] = sourceInst;

    console.log('Saving merged ACT-123 template to public...');
    XLSX.writeFile(wbForm, outputPath);
    console.log('Done.');
}

merge().catch(console.error);
