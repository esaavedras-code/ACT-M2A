const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

async function main() {
  // Load template base64 from act117cTemplate.ts
  const templateFilePath = path.join(__dirname, '..', 'src', 'lib', 'act117cTemplate.ts');
  const content = fs.readFileSync(templateFilePath, 'utf8');
  
  // Extract base64 string
  const base64Match = content.match(/export const ACT117C_TEMPLATE_BASE64 = `([^`]+)`/);
  if (!base64Match) {
    console.error("Could not find base64 string in act117cTemplate.ts");
    return;
  }
  
  const base64Str = base64Match[1].replace(/\s/g, '');
  const buffer = Buffer.from(base64Str, 'base64');
  
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  
  const backSheet = workbook.getWorksheet(2);
  console.log("Sheet 2 Name:", backSheet.name);
  
  console.log("--- All merged cells in Sheet 2 ---");
  // In ExcelJS, merges can be accessed via backSheet._merges (internal) or iterating through cells
  const merges = backSheet._merges || {};
  for (const key of Object.keys(merges)) {
    const merge = merges[key];
    console.log(`Merge: tl=${merge.tl}, br=${merge.br}, model=${JSON.stringify(merge.model || merge)}`);
  }
}

main().catch(console.error);
