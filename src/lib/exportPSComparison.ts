import { downloadBlob } from './reportLogic';

export interface ComparisonResult {
    metric: string;
    psValue: number;
    pactValue: number;
    diff: number;
    isEqual: boolean;
    category?: string;
}

export const generatePSComparisonExcel = async (results: ComparisonResult[], projectName: string) => {
    try {
        const ExcelJS = await import('exceljs');
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Comparación PS');

        // Styles
        const headerStyle = {
            font: { bold: true, color: { argb: 'FFFFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF004E8A' } } as any,
            alignment: { horizontal: 'center' as any }
        };

        const redFont = { color: { argb: 'FFFF0000' }, bold: true };
        const greenFont = { color: { argb: 'FF008000' } };
        const currencyFmt = '"$"#,##0.00';

        // Headers
        sheet.columns = [
            { header: 'Categoría', key: 'category', width: 20 },
            { header: 'Métrica / Partida', key: 'metric', width: 45 },
            { header: 'Project Status (PS)', key: 'psValue', width: 25, style: { numFmt: currencyFmt } },
            { header: 'PACT', key: 'pactValue', width: 25, style: { numFmt: currencyFmt } },
            { header: 'Diferencia', key: 'diff', width: 20, style: { numFmt: currencyFmt } },
            { header: 'Resultado', key: 'result', width: 15 }
        ];

        sheet.getRow(1).eachCell((cell) => {
            cell.font = headerStyle.font;
            cell.fill = headerStyle.fill;
            cell.alignment = headerStyle.alignment;
        });

        // Add Data
        results.forEach(res => {
            const row = sheet.addRow({
                category: res.category || 'Métrica Global',
                metric: res.metric,
                psValue: res.psValue,
                pactValue: res.pactValue,
                diff: res.diff,
                result: res.isEqual ? 'Igual' : 'Diferente'
            });

            // Styling for diff
            if (!res.isEqual) {
                row.getCell('result').font = redFont;
                row.getCell('diff').font = redFont;
                // row.getCell('psValue').font = redFont;
                // row.getCell('pactValue').font = redFont;
            } else {
                row.getCell('result').font = greenFont;
            }
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        downloadBlob(blob, `Comparacion_PS_${projectName}.xlsx`);

    } catch (err) {
        console.error("Error generando Excel de Comparación PS:", err);
        throw err;
    }
};
