const XLSX = require('xlsx');

try {
  const filePath = 'C:\\Users\\Enrique Saavedra\\Documents\\PROGRAMAS AI\\Programa ACT\\Documentos\\Liquidacion Item No. 001 MOBILIZACION.xls';
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  console.log(`Hoja de cálculo: ${sheetName}`);
  
  const cells = Object.keys(worksheet).filter(k => k[0] !== '!');
  console.log(`Total de celdas con datos: ${cells.length}`);

  // Mostrar el valor de algunas celdas clave o todas las que tengan texto no vacío
  cells.sort((a, b) => {
    const aRow = parseInt(a.replace(/^[A-Z]+/, ''));
    const bRow = parseInt(b.replace(/^[A-Z]+/, ''));
    if (aRow !== bRow) return aRow - bRow;
    return a.localeCompare(b);
  }).forEach(cell => {
    const val = worksheet[cell];
    if (val && val.v !== undefined && val.v !== '') {
        console.log(`${cell}: ${val.v} (tipo: ${val.t})`);
    }
  });

} catch (error) {
  console.error("Error al leer la plantilla de movilización:", error);
}
