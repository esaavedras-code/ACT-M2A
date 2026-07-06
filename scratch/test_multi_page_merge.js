const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

async function cloneSheetPerfectly(source, target) {
    source.columns.forEach((col, i) => {
        target.getColumn(i + 1).width = col.width;
    });

    source.eachRow({ includeEmpty: true }, (row, rowNum) => {
        const newRow = target.getRow(rowNum);
        newRow.height = row.height;
        row.eachCell({ includeEmpty: true }, (cell, colNum) => {
            const newCell = newRow.getCell(colNum);
            newCell.value = cell.value;
            newCell.style = JSON.parse(JSON.stringify(cell.style || {}));
        });
    });

    const merges = source._merges || {};
    Object.values(merges).forEach((m) => {
        try {
            target.mergeCells(m.tl, m.br);
        } catch (e) { /* ignore */ }
    });
}

async function main() {
  const templateFilePath = path.join(__dirname, '..', 'src', 'lib', 'act117cTemplate.ts');
  const content = fs.readFileSync(templateFilePath, 'utf8');
  
  const base64Match = content.match(/export const ACT117C_TEMPLATE_BASE64 = `([^`]+)`/);
  const base64Str = base64Match[1].replace(/\s/g, '');
  const buffer = Buffer.from(base64Str, 'base64');
  
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  
  const backSheet = workbook.getWorksheet(2);

  const fillBackSheet = (sheet) => {
    // Desfusionar
    for (let r = 23; r <= 35; r++) {
        try {
            sheet.unMergeCells(`B${r}:R${r}`);
        } catch (e) {
            console.log(`Failed to unmerge B${r}:R${r}:`, e.message);
        }
    }

    // Combinar B23:R35
    try {
        sheet.mergeCells('B23:R35');
        console.log("Successfully merged B23:R35 in sheet:", sheet.name);
    } catch (e) {
        console.warn("Failed to merge B23:R35 in sheet:", sheet.name, e.message);
    }
  };

  // Página 1
  backSheet.name = "Atras Pag 1";
  fillBackSheet(backSheet);

  // Página 2 (clonada de la 1 ya modificada)
  const newBack = workbook.addWorksheet("Atras Pag 2");
  await cloneSheetPerfectly(backSheet, newBack);
  
  // Rellenar página 2
  fillBackSheet(newBack);
}

main().catch(console.error);
