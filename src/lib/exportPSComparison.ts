import { downloadBlob } from './reportLogic';

export interface ComparisonResult {
    metric: string;
    psName?: string;
    pactName?: string;
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
            { header: 'Métrica / Partida', key: 'metric', width: 30 },
            { header: 'Project Status (PS)', key: 'psName', width: 25 },
            { header: 'PACT', key: 'pactName', width: 30 },
            { header: 'Valor PS', key: 'psValue', width: 25, style: { numFmt: currencyFmt } },
            { header: 'Valor PACT', key: 'pactValue', width: 25, style: { numFmt: currencyFmt } },
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
                psName: res.psName || '',
                pactName: res.pactName || '',
                psValue: res.psValue,
                pactValue: res.pactValue,
                diff: res.diff,
                result: res.isEqual ? 'Igual' : 'Diferente'
            });

            // Si es una cantidad, aplicar formato de 4 decimales
            const isQty = res.metric.toLowerCase().includes('quantity');
            if (isQty) {
                const qtyFmt = '#,##0.0000';
                row.getCell('psValue').numFmt = qtyFmt;
                row.getCell('pactValue').numFmt = qtyFmt;
                row.getCell('diff').numFmt = qtyFmt;
            }

            // Styling for diff
            if (!res.isEqual) {
                row.getCell('result').font = redFont;
                row.getCell('diff').font = redFont;
                row.getCell('diff').fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFFC7CE' } // Fondo rojo claro
                };
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
