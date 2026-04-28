const ExcelJS = require('exceljs');
const path = require('path');

async function analyze() {
    const workbook = new ExcelJS.Workbook();
    const filePath = 'C:\\Users\\Enrique Saavedra\\Documents\\PROGRAMAS AI\\Programa ACT\\Documentos\\DOFAEI.xlsx';
    
    try {
        await workbook.xlsx.readFile(filePath);
        const sheet = workbook.getWorksheet(1);
        
        console.log(`Sheet Name: ${sheet.name}`);
        
        // Leer las primeras 100 filas y 20 columnas para mapear
        for(let i = 1; i <= 100; i++) {
            const row = sheet.getRow(i);
            let rowText = "";
            for(let j = 1; j <= 20; j++) {
                const cell = row.getCell(j);
                if (cell.value) {
                    rowText += `[${i},${j}]: ${JSON.stringify(cell.value)} | `;
                }
            }
            if (rowText) console.log(rowText);
        }
    } catch (err) {
        console.error("Error reading excel:", err);
    }
}

analyze();
