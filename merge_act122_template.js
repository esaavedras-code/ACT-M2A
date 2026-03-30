const XLSX = require('xlsx');

const formPath = 'c:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\Documentos\\ACT-122 CHO Form rev 12-2024.xlsx';
const instPath = 'c:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\Documentos\\ACT-122 CHO Instrucciones.xlsx';
const outputPath = 'c:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\public\\ACT-122_Official_Template.xlsx';

async function merge() {
    console.log('Reading files...');
    const wbForm = XLSX.readFile(formPath);
    const wbInst = XLSX.readFile(instPath);

    console.log('Copying instructions...');
    const sourceInst = wbInst.Sheets[wbInst.SheetNames[0]];
    
    // Replace the empty 'Instructions' sheet in the form workbook
    wbForm.Sheets['Instructions'] = sourceInst;

    console.log('Saving merged template to public...');
    XLSX.writeFile(wbForm, outputPath);
    console.log('Done.');
}

merge().catch(console.error);
