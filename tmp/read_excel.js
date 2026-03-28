const ExcelJS = require('exceljs');
const path = require('path');

async function readExcel() {
  const filePath = 'C:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\Documentos\\CML (New Contract Moficaction Log) - sin restriccion.xlsx';
  const workbook = new ExcelJS.Workbook();
  
  try {
    await workbook.xlsx.readFile(filePath);
    console.log(`Workbook loaded. Number of worksheets: ${workbook.worksheets.length}`);
    
    workbook.worksheets.forEach(worksheet => {
      console.log(`\nWorksheet: ${worksheet.name} (ID: ${worksheet.id})`);
      console.log(`Actual row count: ${worksheet.actualRowCount}`);
      console.log(`Actual column count: ${worksheet.actualColumnCount}`);
      
      // Read header row (assuming row 1 or 2 is header)
      let headerRow = worksheet.getRow(1).values;
      if (!headerRow || headerRow.length <= 1) {
          headerRow = worksheet.getRow(2).values;
      }
      console.log(`Headers: ${JSON.stringify(headerRow)}`);
      
      // Read first data row
      const dataRow = worksheet.getRow(3).values;
      console.log(`Sample Data Row: ${JSON.stringify(dataRow)}`);
    });
  } catch (error) {
    console.error('Error reading excel file:', error);
  }
}

readExcel();
