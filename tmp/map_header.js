const ExcelJS = require('exceljs');
const wb = new ExcelJS.Workbook();
wb.xlsx.readFile('public/New Contract Modification Log amarillo.xlsx').then(() => {
    const ws = wb.getWorksheet('CML Report');
    for (let rn = 6; rn <= 30; rn++) {
        const row = ws.getRow(rn);
        const cells = [];
        row.eachCell({ includeEmpty: false }, (cell) => {
            if (cell.col > 22) return;
            const fill = cell.fill;
            const isY = fill && fill.fgColor && (fill.fgColor.argb === 'FFFFFF00' || fill.fgColor.argb === 'FFFF00');
            let v;
            const raw = cell.value;
            if (!raw && !isY) return;
            if (raw === null || raw === undefined) v = 'null';
            else if (typeof raw === 'object' && raw.richText) v = raw.richText.map(r=>r.text).join('').substring(0,35);
            else if (typeof raw === 'object' && raw.formula) v = '[F]';
            else if (typeof raw === 'object') v = '[obj]';
            else v = String(raw).substring(0,35);
            cells.push(cell.address + (isY ? '[Y]' : '') + ':' + v);
        });
        if (cells.length > 0) console.log('R' + rn + ': ' + cells.join(' || '));
    }
}).catch(e => console.error(e.message));
