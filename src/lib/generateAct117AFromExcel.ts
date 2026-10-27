import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { supabase } from './supabase';
import { ACT117A_TEMPLATE_BASE64 } from './act117aTemplate';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface CertExcelRow {
    itemNum: string;
    location: string;
    calculations: string;
    quantity: number | null;
    inspector: string;
    inspDate: string; // ISO string o fecha reconocible
    page?: number;
    raw: Record<string, any>;
}

export interface GenerateAct117AFromExcelResult {
    blob: Blob;
    certNum: string | number;
    itemsProcessed: number;
    errors: string[];
}

// ─── Constantes de mapeo de celdas de la plantilla ───────────────────────────
// Plantilla oficial: ACT-117A Item Certification Sheets.xlsx
const TEMPLATE_CELLS = {
    // Encabezado del proyecto y contratista
    PROJECT_NAME: 'K6',  // merged K6:AE6
    PROJECT_NUM:  'K7',  // merged K7:AG7
    CONTRACTOR:   'K8',  // merged K8:AG8
    // Encabezado de la partida
    ITEM_NO:      'AO6', // merged AO6:AV6
    UNIT_PRICE:   'AO7', // merged AO7:AV7
    ITEM_DESC:    'AR8', // merged AR8:BN8
    ITEM_UNIT:    'BG6', // merged BG6:BN6
    // Datos de la certificación
    CERT_NUM:     'BW6', // merged BW6:CB6
    CERT_DATE:    'BW7', // merged BW7:CB7
    // Paginación
    PAGE_OF_NUM:  'AV39', // número de página actual
    TOTAL_PAGES:  'AZ39', // total de páginas del ítem
} as const;

// Filas de datos (13 a 27 = 15 filas por página)
const DATA_ROW_START = 13;
const DATA_ROW_END   = 27;
const ROWS_PER_PAGE  = DATA_ROW_END - DATA_ROW_START + 1; // 15

// Filas para la leyenda de inspectores (L29..L38 = a..j, nombres en N29..N38)
const INSPECTOR_ROW_START = 29;
const INSPECTOR_ROW_END   = 38;
const MAX_INSPECTORS_LEGEND = INSPECTOR_ROW_END - INSPECTOR_ROW_START + 1; // 10

// ─── Función principal ───────────────────────────────────────────────────────

/**
 * Genera el reporte ACT-117A (Item Certification Worksheet) a partir de:
 *  - Un archivo Excel de certificación cargado por el usuario
 *  - Información del proyecto activo en la base de datos
 */
export async function generateAct117AFromExcel(
    certExcelFile: File | ArrayBuffer,
    projectId: string,
): Promise<GenerateAct117AFromExcelResult> {
    const errors: string[] = [];

    // 1. Leer y parsear el Excel de certificación cargado
    let rawBuffer: ArrayBuffer;
    if (certExcelFile instanceof File) {
        rawBuffer = await certExcelFile.arrayBuffer();
    } else {
        rawBuffer = certExcelFile;
    }

    const certWb = XLSX.read(rawBuffer, { type: 'array', cellDates: true });
    if (!certWb.SheetNames || certWb.SheetNames.length === 0) {
        throw new Error('El archivo Excel no contiene hojas de trabajo.');
    }

    const firstSheet = certWb.Sheets[certWb.SheetNames[0]];
    const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(firstSheet, {
        defval: '',
        raw: false,
        dateNF: 'YYYY-MM-DD'
    });

    if (!rawRows || rawRows.length === 0) {
        throw new Error('El archivo Excel está vacío o no contiene filas con datos válidos.');
    }

    // 2. Validar estructura del Excel y detectar nombres de columnas
    const colMap = detectColumns(rawRows[0]);
    if (!colMap.itemNum) {
        throw new Error(
            'No se encontró la columna de número de ítem en el Excel. Verifique que el archivo incluya una columna como "Item", "Partida" o "Item No".'
        );
    }

    // 3. Parsear y normalizar registros
    const allRows: CertExcelRow[] = [];
    for (let i = 0; i < rawRows.length; i++) {
        const raw = rawRows[i];
        try {
            const row = parseRow(raw, colMap, i + 2);
            if (row) {
                allRows.push(row);
            }
        } catch (e: any) {
            errors.push(`Fila ${i + 2}: ${e.message}`);
        }
    }

    if (allRows.length === 0) {
        throw new Error('No se encontraron registros válidos de inspección/certificación en el archivo Excel.');
    }

    // Detectar número y fecha de certificación desde el Excel
    const certNumDetected = detectCertNum(rawRows, colMap);
    const certDateDetected = detectCertDate(rawRows, colMap);

    // 4. Obtener datos del proyecto activo en la base de datos
    const { data: projData, error: projErr } = await supabase
        .from('projects')
        .select('name, num_act')
        .eq('id', projectId)
        .single();

    if (projErr || !projData) {
        throw new Error('No se pudo encontrar el proyecto activo en la base de datos.');
    }

    const { data: contrData } = await supabase
        .from('contractors')
        .select('name')
        .eq('project_id', projectId)
        .maybeSingle();

    // 5. Obtener datos de partidas del contrato en la base de datos
    const uniqueItemNums = [...new Set(allRows.map(r => r.itemNum))];
    const { data: contractItems } = await supabase
        .from('contract_items')
        .select('item_num, description, unit, unit_price')
        .eq('project_id', projectId);

    const itemDataMap: Record<string, any> = {};
    if (contractItems) {
        for (const ci of contractItems) {
            const normKey = normalizeItemKey(ci.item_num);
            itemDataMap[normKey] = ci;
        }
    }

    // 6. Agrupar registros por número de ítem y ordenar por fecha ascendente
    const itemGroups = groupByItem(allRows);
    const sortedItemNums = Object.keys(itemGroups).sort((a, b) => {
        const na = parseFloat(a) || 0;
        const nb = parseFloat(b) || 0;
        return na - nb || a.localeCompare(b);
    });

    // 7. Cargar plantilla oficial ACT-117A
    const workbook = new ExcelJS.Workbook();
    const bufferTemplate = Buffer.from(ACT117A_TEMPLATE_BASE64, 'base64');
    await workbook.xlsx.load(bufferTemplate as any);

    const templateSheet = workbook.getWorksheet(1);
    if (!templateSheet) {
        throw new Error('La plantilla ACT-117A no contiene hojas válidas.');
    }

    // 8. Crear hojas independientes para cada ítem
    let firstSheetUsed = false;
    let totalSheetsCreated = 0;

    for (const itemNum of sortedItemNums) {
        const rows = itemGroups[itemNum]; // ya ordenados por fecha ascendente
        const normKey = normalizeItemKey(itemNum);
        const itemDbData = itemDataMap[normKey] || null;

        // Calcular cuántas páginas requiere este ítem (15 filas por página)
        const numPages = Math.ceil(rows.length / ROWS_PER_PAGE) || 1;

        // Mapear inspectores únicos para este ítem
        const inspectorLegend = buildInspectorLegend(rows);

        for (let pageIdx = 0; pageIdx < numPages; pageIdx++) {
            const pageRows = rows.slice(
                pageIdx * ROWS_PER_PAGE,
                (pageIdx + 1) * ROWS_PER_PAGE
            );

            const sheetName = buildSheetName(itemNum, pageIdx + 1, numPages);
            let ws: ExcelJS.Worksheet;

            if (!firstSheetUsed) {
                // Usar la primera hoja del template
                ws = templateSheet;
                ws.name = sheetName;
                firstSheetUsed = true;
            } else {
                // Clonar hoja manteniendo formato original completo
                ws = workbook.addWorksheet(sheetName);
                await cloneSheet(templateSheet, ws);
            }

            // Completar campos del encabezado
            fillHeader(ws, {
                projectName: projData.name || '',
                projectNum:  formatProjectNumber(projData.num_act || ''),
                contractor:   contrData?.name || '',
                itemNum:      itemNum,
                unitPrice:    itemDbData ? (parseFloat(itemDbData.unit_price) || 0) : 0,
                itemDesc:     itemDbData?.description || '',
                itemUnit:     itemDbData?.unit || '',
                certNum:      certNumDetected,
                certDate:     certDateDetected,
                pageNum:      pageIdx + 1,
                totalPages:   numPages,
            });

            // Llenar filas de datos
            fillDataRows(ws, pageRows, pageIdx * ROWS_PER_PAGE, inspectorLegend);

            // Llenar leyenda de inspectores al pie
            fillInspectorLegend(ws, inspectorLegend);

            totalSheetsCreated++;
        }
    }

    // 9. Generar el buffer del archivo final Excel
    const outBuffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob(
        [outBuffer],
        { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
    );

    return {
        blob,
        certNum: certNumDetected,
        itemsProcessed: sortedItemNums.length,
        errors,
    };
}

// ─── Helpers de Detección y Parseo ───────────────────────────────────────────

function normalizeItemKey(val: any): string {
    return String(val ?? '').trim().replace(/^0+/, '');
}

/** Detecta las columnas del Excel de certificación */
function detectColumns(firstRow: Record<string, any>) {
    const keys = Object.keys(firstRow);
    const norm = (s: string) => String(s || '').toLowerCase().replace(/[\s_\-\.]/g, '');

    const find = (...terms: string[]) =>
        keys.find(k => terms.some(t => norm(k).includes(norm(t))));

    return {
        itemNum:      find('itemno', 'itemnum', 'item_num', 'item no', 'item number', 'item', 'partida', 'no partida'),
        location:     find('location', 'ubicacion', 'lugar', 'estacion', 'station', 'tramo', 'localizacion'),
        calculations: find('calculation', 'calculo', 'formula', 'notes', 'notas', 'remarks', 'detalle', 'descripcion'),
        quantity:     find('quantity', 'cantidad', 'qty', 'medido', 'measured', 'cant'),
        inspector:    find('inspector', 'insp', 'inspeccionado por', 'inspeccion', 'inspector name'),
        inspDate:     find('date', 'fecha', 'inspection date', 'fecha inspeccion', 'inspdate', 'fecha de inspeccion'),
        certNum:      find('cert', 'cert num', 'certification', 'certificacion', 'certnum', 'cert_num', 'cert no', 'no cert'),
        certDate:     find('cert date', 'fecha cert', 'fecha de cert', 'fecha certificacion'),
        page:         find('page', 'pagina', 'pag', 'ref page'),
    };
}

/** Parsea una fila individual del Excel */
function parseRow(
    raw: Record<string, any>,
    colMap: ReturnType<typeof detectColumns>,
    rowNum: number
): CertExcelRow | null {
    const get = (key: string | undefined) => key ? (raw[key] ?? '') : '';

    const itemNumRaw = String(get(colMap.itemNum)).trim();
    if (!itemNumRaw || itemNumRaw === '' || itemNumRaw === '0') return null;

    // Cantidad
    const qtyStr = String(get(colMap.quantity)).replace(/,/g, '').trim();
    const qty = parseFloat(qtyStr);

    // Fecha de inspección
    const inspDateRaw = String(get(colMap.inspDate)).trim();

    // Inspector
    const inspectorRaw = String(get(colMap.inspector)).trim();

    // Página de referencia
    const pageVal = parseInt(String(get(colMap.page))) || undefined;

    return {
        itemNum:      itemNumRaw,
        location:     String(get(colMap.location)).trim(),
        calculations: String(get(colMap.calculations)).trim(),
        quantity:     isNaN(qty) ? null : qty,
        inspector:    inspectorRaw,
        inspDate:     inspDateRaw,
        page:         pageVal,
        raw,
    };
}

/** Detecta el número de certificación */
function detectCertNum(rows: Record<string, any>[], colMap: ReturnType<typeof detectColumns>): string | number {
    if (!colMap.certNum) return '';
    for (const row of rows) {
        const v = row[colMap.certNum!];
        if (v !== undefined && v !== '' && v !== null) {
            // Limpiar si tiene texto como "Cert 15" -> "15"
            const strVal = String(v).trim();
            const match = strVal.match(/\d+/);
            return match ? match[0] : strVal;
        }
    }
    return '';
}

/** Detecta la fecha de certificación */
function detectCertDate(rows: Record<string, any>[], colMap: ReturnType<typeof detectColumns>): string {
    if (colMap.certDate) {
        for (const row of rows) {
            const v = row[colMap.certDate!];
            if (v !== undefined && v !== '' && v !== null) return String(v);
        }
    }
    // Si no viene en columna específica, usar la fecha más reciente de inspección
    if (colMap.inspDate) {
        const dates = rows
            .map(r => String(r[colMap.inspDate!] || '').trim())
            .filter(d => d !== '')
            .sort()
            .reverse();
        if (dates.length > 0) return dates[0];
    }
    return new Date().toISOString().split('T')[0];
}

/** Agrupa filas por número de ítem y ordena cada grupo por fecha ascendente */
function groupByItem(rows: CertExcelRow[]): Record<string, CertExcelRow[]> {
    const groups: Record<string, CertExcelRow[]> = {};
    for (const row of rows) {
        const key = row.itemNum;
        if (!groups[key]) groups[key] = [];
        groups[key].push(row);
    }

    // Ordenar cada grupo por fecha de inspección en orden ascendente (más antigua a más reciente)
    for (const key of Object.keys(groups)) {
        groups[key].sort((a, b) => {
            const da = parseDateForSort(a.inspDate);
            const db = parseDateForSort(b.inspDate);
            return da - db;
        });
    }

    return groups;
}

/** Convierte fecha a timestamp para ordenación correcta */
function parseDateForSort(dateStr: string): number {
    if (!dateStr) return 0;
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.getTime();

    // Formato MM/DD/YYYY
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        const d2 = new Date(`${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`);
        if (!isNaN(d2.getTime())) return d2.getTime();
    }
    // Formato DD-MM-YYYY
    const partsHyphen = dateStr.split('-');
    if (partsHyphen.length === 3 && partsHyphen[0].length === 2) {
        const d3 = new Date(`${partsHyphen[2]}-${partsHyphen[1]}-${partsHyphen[0]}`);
        if (!isNaN(d3.getTime())) return d3.getTime();
    }
    return 0;
}

/** Construye la leyenda de inspectores para el pie del formulario (a..j) */
function buildInspectorLegend(rows: CertExcelRow[]): Map<string, string> {
    const inspectorMap = new Map<string, string>(); // inspectorName -> letter ('a', 'b', ...)
    const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
    let letterIdx = 0;

    for (const r of rows) {
        const name = r.inspector.trim();
        if (!name) continue;

        // Si ya es una letra como 'a' o 'b', mapearla a sí misma
        if (letters.includes(name.toLowerCase())) {
            if (!inspectorMap.has(name)) {
                inspectorMap.set(name, name.toLowerCase());
            }
            continue;
        }

        if (!inspectorMap.has(name)) {
            if (letterIdx < letters.length) {
                inspectorMap.set(name, letters[letterIdx]);
                letterIdx++;
            } else {
                // Si hay más de 10 inspectores, usar iniciales
                inspectorMap.set(name, name.substring(0, 3).toUpperCase());
            }
        }
    }

    return inspectorMap;
}

/** Construye el nombre de la pestaña respetando el límite de 31 caracteres de Excel */
function buildSheetName(itemNum: string, page: number, totalPages: number): string {
    if (totalPages <= 1) {
        return `Item ${itemNum}`.substring(0, 31);
    }
    return `Item ${itemNum} (${page})`.substring(0, 31);
}

/** Llena los datos del encabezado en la hoja */
function fillHeader(ws: ExcelJS.Worksheet, data: {
    projectName: string;
    projectNum: string;
    contractor: string;
    itemNum: string;
    unitPrice: number;
    itemDesc: string;
    itemUnit: string;
    certNum: string | number;
    certDate: string;
    pageNum: number;
    totalPages: number;
}) {
    const set = (coord: string, value: any) => {
        const cell = ws.getCell(coord);
        if (value !== '' && value !== null && value !== undefined) {
            cell.value = value;
        }
    };

    set(TEMPLATE_CELLS.PROJECT_NAME, data.projectName);
    set(TEMPLATE_CELLS.PROJECT_NUM,  data.projectNum);
    set(TEMPLATE_CELLS.CONTRACTOR,   data.contractor);
    set(TEMPLATE_CELLS.ITEM_NO,      data.itemNum);
    set(TEMPLATE_CELLS.UNIT_PRICE,   data.unitPrice);
    set(TEMPLATE_CELLS.ITEM_DESC,    data.itemDesc);
    set(TEMPLATE_CELLS.ITEM_UNIT,    data.itemUnit);
    set(TEMPLATE_CELLS.CERT_NUM,     data.certNum);
    set(TEMPLATE_CELLS.CERT_DATE,    formatDisplayDate(data.certDate));
    set(TEMPLATE_CELLS.PAGE_OF_NUM,  data.pageNum);
    set(TEMPLATE_CELLS.TOTAL_PAGES,  data.totalPages);
}

/** Llena las filas de datos (13 a 27) */
function fillDataRows(
    ws: ExcelJS.Worksheet,
    pageRows: CertExcelRow[],
    globalOffset: number,
    inspectorLegend: Map<string, string>
) {
    for (let i = 0; i < ROWS_PER_PAGE; i++) {
        const excelRow = DATA_ROW_START + i;
        const dataRow = pageRows[i];

        if (!dataRow) {
            clearDataRow(ws, excelRow);
            continue;
        }

        // Location: C (col 3)
        ws.getCell(excelRow, 3).value = dataRow.location || '';

        // Calculations: AB (col 28)
        ws.getCell(excelRow, 28).value = dataRow.calculations || '';

        // Quantity: BD (col 56)
        // IMPORTANTE: Si es null no poner '', sino null para no romper fórmulas
        ws.getCell(excelRow, 56).value = dataRow.quantity !== null ? dataRow.quantity : null;

        // Amount: BJ (col 62) ya tiene la fórmula =AO7*BD{row} de la plantilla. Se conserva intacta.

        // References - Inspector: BQ (col 69)
        const inspKey = dataRow.inspector.trim();
        const inspCode = inspectorLegend.get(inspKey) || inspKey;
        ws.getCell(excelRow, 69).value = inspCode;

        // References - Date: BT (col 72)
        ws.getCell(excelRow, 72).value = formatDisplayDate(dataRow.inspDate);

        // References - Page: BX (col 76)
        ws.getCell(excelRow, 76).value = dataRow.page !== undefined ? dataRow.page : (globalOffset + i + 1);
    }
}

/** Limpia una fila sin borrar fórmulas de Amount */
function clearDataRow(ws: ExcelJS.Worksheet, rowNum: number) {
    ws.getCell(rowNum, 3).value  = '';   // Location (C)
    ws.getCell(rowNum, 28).value = '';   // Calculations (AB)
    ws.getCell(rowNum, 56).value = null; // Quantity (BD) - null para preservar fórmulas
    ws.getCell(rowNum, 69).value = '';   // Inspector (BQ)
    ws.getCell(rowNum, 72).value = '';   // Date (BT)
    ws.getCell(rowNum, 76).value = null; // Page (BX)
}

/** Llena la leyenda de inspectores al pie (filas 29 a 38, col N) */
function fillInspectorLegend(ws: ExcelJS.Worksheet, inspectorLegend: Map<string, string>) {
    const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

    // Invertir mapa: letter -> inspectorName
    const letterToName = new Map<string, string>();
    inspectorLegend.forEach((letter, name) => {
        if (!letterToName.has(letter)) {
            letterToName.set(letter, name);
        }
    });

    for (let i = 0; i < MAX_INSPECTORS_LEGEND; i++) {
        const rowNum = INSPECTOR_ROW_START + i;
        const letter = letters[i];
        const name = letterToName.get(letter) || '';
        // Columna N (col 14) es donde comienza la celda combinada para el nombre
        ws.getCell(rowNum, 14).value = name;
    }
}

/** Formatea una fecha para mostrar (MM/DD/YYYY) */
function formatDisplayDate(dateStr: string): string {
    if (!dateStr) return '';
    try {
        let d: Date;
        if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                d = new Date(`${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`);
            } else {
                d = new Date(dateStr);
            }
        } else {
            d = new Date(dateStr);
        }
        if (isNaN(d.getTime())) return dateStr;
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${mm}/${dd}/${yyyy}`;
    } catch {
        return dateStr;
    }
}

/** Formatea el número de proyecto con prefijo AC- */
function formatProjectNumber(numAct: string): string {
    if (!numAct) return '';
    if (numAct.match(/^AC-/i)) return numAct.toUpperCase();
    const digits = numAct.replace(/\D/g, '');
    return `AC-${digits}`;
}

/** Clona una hoja manteniendo estilos, dimensiones, fórmulas y celdas combinadas */
async function cloneSheet(source: ExcelJS.Worksheet, target: ExcelJS.Worksheet) {
    // Clonar dimensiones de columnas
    source.columns.forEach((col: any, i: number) => {
        if (col && col.width) {
            target.getColumn(i + 1).width = col.width;
        }
    });

    // Clonar filas y celdas
    source.eachRow({ includeEmpty: true }, (row: any, rowNum: number) => {
        const newRow = target.getRow(rowNum);
        if (row.height) newRow.height = row.height;

        row.eachCell({ includeEmpty: true }, (cell: any, colNum: number) => {
            const newCell = newRow.getCell(colNum);
            // Copiar fórmulas o valores
            if (cell.value && typeof cell.value === 'object' && cell.value.formula) {
                newCell.value = { ...cell.value };
            } else {
                newCell.value = cell.value;
            }

            // Clonar estilo
            if (cell.style) {
                try {
                    newCell.style = JSON.parse(JSON.stringify(cell.style));
                } catch {
                    // Ignorar errores de copia
                }
            }
        });
        newRow.commit();
    });

    // Clonar celdas combinadas
    // @ts-ignore
    const merges = source._merges || {};
    Object.values(merges).forEach((m: any) => {
        try {
            if (m && m.tl && m.br) {
                target.mergeCells(m.tl, m.br);
            }
        } catch {
            // Ignorar conflictos de combinación
        }
    });

    // Clonar configuración de impresión y página
    if (source.pageSetup) {
        target.pageSetup = { ...source.pageSetup };
    }
}
