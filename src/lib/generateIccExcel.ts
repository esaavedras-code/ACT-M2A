import ExcelJS from 'exceljs';

export async function generateIccExcelBlob(reportData: any[][], project: any): Promise<Blob> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Resumen ICC');

    worksheet.columns = [
        { width: 15 },  // Partida
        { width: 40 },  // Descripción
        { width: 12 },  // Cant.
        { width: 30 },  // Fabricante
        { width: 10 },  // Not.
        { width: 15 },  // Cert Pago
        { width: 15 },  // Fecha
        { width: 15 },  // Vence
        { width: 25 },  // Estatus
    ];

    // Título
    worksheet.addRow([`RESUMEN DE INITIAL CONTRACT CERTIFICATIONS (ICC)`]);
    worksheet.mergeCells('A1:I1');
    const titleCell = worksheet.getCell('A1');
    titleCell.font = { name: 'Arial', size: 14, bold: true };
    titleCell.alignment = { horizontal: 'center' };

    worksheet.addRow([`PROYECTO: ${project?.num_act || ''}`]);
    worksheet.mergeCells('A2:I2');
    const projectCell = worksheet.getCell('A2');
    projectCell.font = { name: 'Arial', size: 12, bold: true };
    projectCell.alignment = { horizontal: 'center' };

    worksheet.addRow([]);

    // Datos
    reportData.forEach((row, index) => {
        const excelRow = worksheet.addRow(row);
        if (index === 0) {
            // Header
            excelRow.eachCell(cell => {
                cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        } else {
            // Filas
            excelRow.eachCell((cell, colNumber) => {
                cell.font = { name: 'Arial', size: 10 };
                cell.alignment = { vertical: 'middle', horizontal: colNumber === 2 || colNumber === 4 ? 'left' : 'center' };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                };
            });
        }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
