const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

async function main() {
  const templateFilePath = path.join(__dirname, '..', 'src', 'lib', 'act117cTemplate.ts');
  const content = fs.readFileSync(templateFilePath, 'utf8');
  
  const base64Match = content.match(/export const ACT117C_TEMPLATE_BASE64 = `([^`]+)`/);
  if (!base64Match) {
    console.error("Could not find base64 string in act117cTemplate.ts");
    return;
  }
  
  const base64Str = base64Match[1].replace(/\s/g, '');
  const buffer = Buffer.from(base64Str, 'base64');
  
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  
  const sheet = workbook.getWorksheet(2);
  console.log("Sheet loaded. Starting merge logic...");

  // Let's print existing merges in rows 23-35 first
  const initialMerges = [];
  const merges = sheet._merges || {};
  for (const key of Object.keys(merges)) {
    const m = merges[key];
    const model = m.model || m;
    if (model && model.top >= 23 && model.bottom <= 35) {
      initialMerges.push(model);
    }
  }
  console.log("Initial merges in range 23-35:", JSON.stringify(initialMerges));

  // Robust logic to unmerge intersecting cells and merge B23:R35
  const targetTop = 23;
  const targetBottom = 35;
  const targetLeft = 2; // B
  const targetRight = 18; // R

  const mergesToUnmerge = [];
  const activeMerges = sheet._merges || {};
  for (const key of Object.keys(activeMerges)) {
    const m = activeMerges[key];
    const model = m.model || m;
    if (model) {
      const { top, bottom, left, right } = model;
      const intersectRow = (top <= targetBottom && bottom >= targetTop);
      const intersectCol = (left <= targetRight && right >= targetLeft);
      if (intersectRow && intersectCol) {
        mergesToUnmerge.push(model);
      }
    }
  }

  console.log(`\nFound ${mergesToUnmerge.length} intersecting merges to remove.`);
  mergesToUnmerge.forEach((m) => {
    try {
      sheet.unMergeCells(m.top, m.left, m.bottom, m.right);
      console.log(`Successfully unmerged: ${m.top}:${m.left} to ${m.bottom}:${m.right}`);
    } catch (e) {
      console.log(`Failed to unmerge ${m.top}:${m.left} to ${m.bottom}:${m.right}:`, e.message);
    }
  });

  console.log("\nMerging B23:R35...");
  try {
    sheet.mergeCells(targetTop, targetLeft, targetBottom, targetRight);
    console.log("Successfully merged B23:R35 using robust logic!");
  } catch (e) {
    console.warn("Failed to merge B23:R35:", e);
  }

  // Let's inspect final merges in 23-35
  const finalMerges = [];
  const postMerges = sheet._merges || {};
  for (const key of Object.keys(postMerges)) {
    const m = postMerges[key];
    const model = m.model || m;
    if (model && model.top >= 23 && model.bottom <= 35) {
      finalMerges.push(model);
    }
  }
  console.log("\nFinal merges in range 23-35:", JSON.stringify(finalMerges));
}

main().catch(console.error);
