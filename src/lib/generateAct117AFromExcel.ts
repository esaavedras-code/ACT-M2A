import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { supabase } from './supabase';
import { ACT117A_TEMPLATE_BASE64 } from './act117aTemplate';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface CertExcelRow {
    itemNum: string;      // Número de ítem o código de especificación
    specCode?: string;    // Código de especificación original si difiere
    itemName?: string;    // Nombre descriptivo del ítem
    location: string;
    calculations: string;
    quantity: number | null;
    inspector: string;
    inspDate: string;     // ISO string o fecha reconocible
    page?: number;
    raw?: Record<string, any>;
}

export interface GenerateAct117AFromExcelResult {
    blob: Blob;
    certNum: string | number;
    itemsProcessed: number;
    errors: string[];
}

// ─── Constantes de mapeo de celdas de la plantilla oficial ───────────────────
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
 *  - Un archivo Excel de certificación cargado por el usuario (soporta formato
 *    por bloques con "Item Number:" como código de especificación y formato tabular)
 *  - Información del proyecto activo en la base de datos de PACT
 */
export async function generateAct117AFromExcel(
    certExcelFile: File | ArrayBuffer,
    projectId: string,
): Promise<GenerateAct117AFromExcelResult> {
    const errors: string[] = [];

    // 1. Leer y parsear el Excel cargado
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

    // 2. Extraer los datos del archivo Excel (detección inteligente: bloques "Item Number:" o tabular)
    const { allRows, certNumDetected, certDateDetected } = extractDataFromExcel(firstSheet, errors);

    if (allRows.length === 0) {
        throw new Error('No se encontraron registros de inspección o certificación en el archivo Excel.');
    }

    // 3. Obtener datos del proyecto activo en la base de datos
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

    // 4. Obtener catálogo de partidas del contrato en la BD para vincular por specification o item_num
    const { data: contractItems } = await supabase
        .from('contract_items')
        .select('item_num, specification, description, unit, unit_price')
        .eq('project_id', projectId);

    const itemsDbList = contractItems || [];

    // 5. Agrupar registros por ítem y ordenar por fecha ascendente
    const itemGroups = groupByItem(allRows);
    const sortedItemKeys = Object.keys(itemGroups).sort((a, b) => {
        const na = parseFloat(a) || 0;
        const nb = parseFloat(b) || 0;
        return na - nb || a.localeCompare(b);
    });

    // 6. Cargar plantilla oficial ACT-117A
    const workbook = new ExcelJS.Workbook();
    const bufferTemplate = Buffer.from(ACT117A_TEMPLATE_BASE64, 'base64');
    await workbook.xlsx.load(bufferTemplate as any);

    const templateSheet = workbook.getWorksheet(1);
    if (!templateSheet) {
        throw new Error('La plantilla ACT-117A no contiene hojas válidas.');
    }

    // 7. Crear hojas independientes para cada ítem
    let firstSheetUsed = false;
    let totalSheetsCreated = 0;

    for (const itemKey of sortedItemKeys) {
        const rows = itemGroups[itemKey]; // ya ordenados cronológicamente (asc)
        const firstRow = rows[0];

        // Vincular con la base de datos: buscar por specification o por item_num
        const matchedDbItem = findContractItemInDb(itemKey, firstRow?.specCode, itemsDbList);

        // Determinar número de ítem oficial a mostrar en la forma ACT-117A
        const displayItemNo = matchedDbItem?.item_num || itemKey;
        const unitPrice = matchedDbItem ? (parseFloat(matchedDbItem.unit_price) || 0) : 0;
        const itemDesc = matchedDbItem?.description || firstRow?.itemName || '';
        const itemUnit = matchedDbItem?.unit || '';

        // Calcular cuántas páginas requiere este ítem (15 filas de detalle por página)
        const numPages = Math.ceil(rows.length / ROWS_PER_PAGE) || 1;

        // Construir leyenda de inspectores para este ítem
        const inspectorLegend = buildInspectorLegend(rows);

        for (let pageIdx = 0; pageIdx < numPages; pageIdx++) {
            const pageRows = rows.slice(
                pageIdx * ROWS_PER_PAGE,
                (pageIdx + 1) * ROWS_PER_PAGE
            );

            const sheetName = buildSheetName(displayItemNo, pageIdx + 1, numPages);
            let ws: ExcelJS.Worksheet;

            if (!firstSheetUsed) {
                ws = templateSheet;
                ws.name = sheetName;
                firstSheetUsed = true;
            } else {
                ws = workbook.addWorksheet(sheetName);
                await cloneSheet(templateSheet, ws);
            }

            // Completar campos del encabezado
            fillHeader(ws, {
                projectName: projData.name || '',
                projectNum:  formatProjectNumber(projData.num_act || ''),
                contractor:   contrData?.name || '',
                itemNum:      displayItemNo,
                unitPrice:    unitPrice,
                itemDesc:     itemDesc,
                itemUnit:     itemUnit,
                certNum:      certNumDetected,
                certDate:     certDateDetected,
                pageNum:      pageIdx + 1,
                totalPages:   numPages,
            });

            // Llenar filas de inspección
            fillDataRows(ws, pageRows, pageIdx * ROWS_PER_PAGE, inspectorLegend);

            // Llenar leyenda de inspectores en el pie
            fillInspectorLegend(ws, inspectorLegend);

            totalSheetsCreated++;
        }
    }

    // 8. Generar buffer final del archivo Excel
    const outBuffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob(
        [outBuffer],
        { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
    );

    return {
        blob,
        certNum: certNumDetected,
        itemsProcessed: sortedItemKeys.length,
        errors,
    };
}

// ─── Extractor Dual Inteligente ──────────────────────────────────────────────

/**
 * Extrae los registros de inspección del Excel soportando:
 * 1. Formato oficial por bloques/secciones con "Item Number:" (código de especificación)
 *    y tablas hijas con "Record No", "Inspector", "Quantity", "Inspection Date".
 * 2. Formato tabular plano estándar donde cada fila tiene columna de Item / Partida.
 */
function extractDataFromExcel(sheet: XLSX.WorkSheet, errors: string[]) {
    const rawMatrix: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    // Verificar si el archivo contiene bloques con "Item Number:"
    let hasItemNumberBlocks = false;
    for (const row of rawMatrix) {
        if (!row) continue;
        for (const cell of row) {
            if (cell && String(cell).toLowerCase().includes('item number:')) {
                hasItemNumberBlocks = true;
                break;
            }
        }
        if (hasItemNumberBlocks) break;
    }

    if (hasItemNumberBlocks) {
        return extractFromBlockFormat(rawMatrix, errors);
    } else {
        return extractFromTabularFormat(sheet, errors);
    }
}

/** Formato 1: Reporte por Secciones con "Item Number:" */
function extractFromBlockFormat(rawMatrix: any[][], errors: string[]) {
    const allRows: CertExcelRow[] = [];
    let currentSpec = '';
    let currentItemName = '';
    let headerIndices: any = null;
    let certNumDetected = '';
    let certDateDetected = '';

    for (let r = 0; r < rawMatrix.length; r++) {
        const row = rawMatrix[r];
        if (!row || row.length === 0) continue;

        // Detectar si la fila contiene "Item Number:"
        let foundSpecInRow = '';
        let foundNameInRow = '';

        for (let c = 0; c < row.length; c++) {
            const cellVal = String(row[c] || '').trim();
            const lower = cellVal.toLowerCase();

            // Detectar cert num si aparece arriba
            if (lower.includes('cert') && (lower.includes('no') || lower.includes('num'))) {
                const match = cellVal.match(/\d+/);
                if (match && !certNumDetected) certNumDetected = match[0];
            }

            if (lower.includes('item number:')) {
                let specVal = cellVal.replace(/item\s*number\s*:\s*/i, '').trim();
                if (!specVal) {
                    for (let nextC = c + 1; nextC < row.length; nextC++) {
                        const nextV = String(row[nextC] || '').trim();
                        if (nextV) {
                            specVal = nextV;
                            break;
                        }
                    }
                }
                if (specVal) foundSpecInRow = specVal;
            }

            if (lower.includes('item name:')) {
                let nameVal = cellVal.replace(/item\s*name\s*:\s*/i, '').trim();
                if (!nameVal) {
                    for (let nextC = c + 1; nextC < row.length; nextC++) {
                        const nextV = String(row[nextC] || '').trim();
                        if (nextV) {
                            nameVal = nextV;
                            break;
                        }
                    }
                }
                if (nameVal) foundNameInRow = nameVal;
            }
        }

        if (foundSpecInRow) {
            currentSpec = foundSpecInRow;
            currentItemName = foundNameInRow || currentItemName;
            headerIndices = null; // Reiniciar headers para la nueva tabla
            continue;
        }

        if (currentSpec) {
            const rowStr = row.map(c => String(c).toLowerCase()).join(' ');

            // Detectar fila de cabeceras de tabla
            if (rowStr.includes('record no') || (rowStr.includes('inspector') && (rowStr.includes('quantity') || rowStr.includes('date')))) {
                headerIndices = {};
                row.forEach((colVal, colIdx) => {
                    const norm = String(colVal || '').toLowerCase().trim();
                    if (norm.includes('record no')) headerIndices.recordNo = colIdx;
                    else if (norm.includes('inspector')) headerIndices.inspector = colIdx;
                    else if (norm.includes('verified and approved')) headerIndices.qtyApproved = colIdx;
                    else if (norm.includes('quantity measured')) headerIndices.qtyMeasured = colIdx;
                    else if (norm.includes('inspection date')) headerIndices.inspDate = colIdx;
                    else if (norm.includes('location') || norm.includes('station')) headerIndices.location = colIdx;
                    else if (norm.includes('page')) headerIndices.page = colIdx;
                });
                continue;
            }

            // Si ya tenemos headers, leer fila de inspección
            if (headerIndices && (headerIndices.recordNo !== undefined || headerIndices.qtyApproved !== undefined || headerIndices.qtyMeasured !== undefined)) {
                const firstCell = String(row[0] || '').toLowerCase().trim();
                // Omitir filas de totales
                if (firstCell.includes('total') || firstCell.includes('summary')) continue;

                const recordNo = headerIndices.recordNo !== undefined ? String(row[headerIndices.recordNo] || '').trim() : '';
                const inspector = headerIndices.inspector !== undefined ? String(row[headerIndices.inspector] || '').trim() : '';

                let qtyStr = '';
                if (headerIndices.qtyApproved !== undefined && row[headerIndices.qtyApproved] !== '') {
                    qtyStr = String(row[headerIndices.qtyApproved]);
                } else if (headerIndices.qtyMeasured !== undefined) {
                    qtyStr = String(row[headerIndices.qtyMeasured]);
                }

                const qty = parseFloat(qtyStr.replace(/,/g, ''));
                const inspDateRaw = headerIndices.inspDate !== undefined ? row[headerIndices.inspDate] : '';
                const location = headerIndices.location !== undefined && row[headerIndices.location]
                    ? String(row[headerIndices.location]).trim()
                    : (recordNo || '');

                const pageVal = headerIndices.page !== undefined ? parseInt(String(row[headerIndices.page])) || undefined : undefined;

                if (recordNo || inspector || !isNaN(qty) || inspDateRaw) {
                    allRows.push({
                        itemNum: currentSpec,
                        specCode: currentSpec,
                        itemName: currentItemName,
                        location,
                        calculations: recordNo ? `Record ${recordNo}` : '',
                        quantity: isNaN(qty) ? null : qty,
                        inspector,
                        inspDate: formatRawDate(inspDateRaw),
                        page: pageVal,
                    });
                }
            }
        }
    }

    if (!certDateDetected && allRows.length > 0) {
        const dates = allRows.map(r => r.inspDate).filter(Boolean).sort().reverse();
        if (dates.length > 0) certDateDetected = dates[0];
    }

    return { allRows, certNumDetected, certDateDetected };
}

/** Formato 2: Reporte Tabular Plano estándar */
function extractFromTabularFormat(sheet: XLSX.WorkSheet, errors: string[]) {
    const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, {
        defval: '',
        raw: false,
        dateNF: 'YYYY-MM-DD'
    });

    if (rawRows.length === 0) {
        return { allRows: [], certNumDetected: '', certDateDetected: '' };
    }

    const colMap = detectColumns(rawRows[0]);
    if (!colMap.itemNum) {
        throw new Error(
            'No se encontró la columna de número de ítem o especificación en el Excel. Verifique que incluya "Item Number:", "Item", o "Partida".'
        );
    }

    const allRows: CertExcelRow[] = [];
    for (let i = 0; i < rawRows.length; i++) {
        const raw = rawRows[i];
        try {
            const get = (key: string | undefined) => key ? (raw[key] ?? '') : '';
            const itemNumRaw = String(get(colMap.itemNum)).trim();
            if (!itemNumRaw || itemNumRaw === '' || itemNumRaw === '0') continue;

            const qtyStr = String(get(colMap.quantity)).replace(/,/g, '').trim();
            const qty = parseFloat(qtyStr);

            allRows.push({
                itemNum: itemNumRaw,
                specCode: itemNumRaw,
                location: String(get(colMap.location)).trim(),
                calculations: String(get(colMap.calculations)).trim(),
                quantity: isNaN(qty) ? null : qty,
                inspector: String(get(colMap.inspector)).trim(),
                inspDate: formatRawDate(get(colMap.inspDate)),
                page: parseInt(String(get(colMap.page))) || undefined,
                raw,
            });
        } catch (e: any) {
            errors.push(`Fila ${i + 2}: ${e.message}`);
        }
    }

    const certNumDetected = detectCertNum(rawRows, colMap);
    const certDateDetected = detectCertDate(rawRows, colMap);

    return { allRows, certNumDetected, certDateDetected };
}

// ─── Helpers de Base de Datos y Formateo ─────────────────────────────────────

/** Busca la partida en el catálogo de contract_items comparando specification o item_num */
function findContractItemInDb(
    itemKey: string,
    specCode: string | undefined,
    dbItems: any[]
): any | null {
    const clean = (s: string) => String(s || '').toLowerCase().replace(/[\s_\-\.]/g, '').replace(/^0+/, '');

    const targetSpec = clean(specCode || itemKey);
    const targetKey  = clean(itemKey);

    // 1. Coincidencia exacta o normalizada por specification
    let found = dbItems.find(it => clean(it.specification) === targetSpec || clean(it.specification) === targetKey);
    if (found) return found;

    // 2. Coincidencia por item_num
    found = dbItems.find(it => clean(it.item_num) === targetKey || clean(it.item_num) === targetSpec);
    if (found) return found;

    // 3. Coincidencia parcial (por ejemplo 152 en 152-001)
    found = dbItems.find(it => {
        const itSpec = clean(it.specification);
        const itNum  = clean(it.item_num);
        return itSpec && targetSpec && (itSpec.includes(targetSpec) || targetSpec.includes(itSpec));
    });

    return found || null;
}

/** Formatea una fecha cruda a string ISO o legible */
function formatRawDate(val: any): string {
    if (!val) return '';
    if (val instanceof Date && !isNaN(val.getTime())) {
        return val.toISOString().split('T')[0];
    }
    const str = String(val).trim();
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
    }
    return str;
}

/** Detecta columnas tabulares */
function detectColumns(firstRow: Record<string, any>) {
    const keys = Object.keys(firstRow);
    const norm = (s: string) => String(s || '').toLowerCase().replace(/[\s_\-\.:]/g, '');

    const find = (...terms: string[]) =>
        keys.find(k => terms.some(t => norm(k).includes(norm(t))));

    return {
        itemNum:      find('itemnumber', 'itemno', 'itemnum', 'item_num', 'item', 'partida', 'especificacion', 'specification'),
        location:     find('location', 'ubicacion', 'lugar', 'estacion', 'station', 'tramo'),
        calculations: find('calculation', 'calculo', 'formula', 'notes', 'notas', 'remarks', 'detalle'),
        quantity:     find('quantity', 'cantidad', 'qty', 'medido', 'measured'),
        inspector:    find('inspector', 'insp', 'inspeccionado por'),
        inspDate:     find('inspectiondate', 'fecha', 'date', 'inspdate', 'fechainspeccion'),
        certNum:      find('certnum', 'certification', 'certificacion', 'certno', 'cert'),
        certDate:     find('certdate', 'fechacert'),
        page:         find('page', 'pagina', 'pag'),
    };
}

function detectCertNum(rows: Record<string, any>[], colMap: any): string | number {
    if (!colMap.certNum) return '';
    for (const row of rows) {
        const v = row[colMap.certNum];
        if (v !== undefined && v !== '' && v !== null) {
            const match = String(v).trim().match(/\d+/);
            return match ? match[0] : String(v).trim();
        }
    }
    return '';
}

function detectCertDate(rows: Record<string, any>[], colMap: any): string {
    if (colMap.certDate) {
        for (const row of rows) {
            const v = row[colMap.certDate];
            if (v !== undefined && v !== '' && v !== null) return String(v);
        }
    }
    return new Date().toISOString().split('T')[0];
}

/** Agrupa filas por ítem y ordena cada grupo por fecha ascendente */
function groupByItem(rows: CertExcelRow[]): Record<string, CertExcelRow[]> {
    const groups: Record<string, CertExcelRow[]> = {};
    for (const row of rows) {
        const key = row.itemNum;
        if (!groups[key]) groups[key] = [];
        groups[key].push(row);
    }

    // Ordenar cronológicamente (ascendente)
    for (const key of Object.keys(groups)) {
        groups[key].sort((a, b) => {
            const da = parseDateForSort(a.inspDate);
            const db = parseDateForSort(b.inspDate);
            return da - db;
        });
    }

    return groups;
}

function parseDateForSort(dateStr: string): number {
    if (!dateStr) return 0;
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.getTime();

    const parts = dateStr.split('/');
    if (parts.length === 3) {
        const d2 = new Date(`${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`);
        if (!isNaN(d2.getTime())) return d2.getTime();
    }
    return 0;
}

function buildInspectorLegend(rows: CertExcelRow[]): Map<string, string> {
    const inspectorMap = new Map<string, string>();
    const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
    let letterIdx = 0;

    for (const r of rows) {
        const name = r.inspector.trim();
        if (!name) continue;

        if (letters.includes(name.toLowerCase())) {
            if (!inspectorMap.has(name)) inspectorMap.set(name, name.toLowerCase());
            continue;
        }

        if (!inspectorMap.has(name)) {
            if (letterIdx < letters.length) {
                inspectorMap.set(name, letters[letterIdx]);
                letterIdx++;
            } else {
                inspectorMap.set(name, name.substring(0, 3).toUpperCase());
            }
        }
    }

    return inspectorMap;
}

function buildSheetName(itemNum: string, page: number, totalPages: number): string {
    const cleanItem = String(itemNum).replace(/[:\\\/\?\*\[\]]/g, '-').trim();
    if (totalPages <= 1) {
        return `Item ${cleanItem}`.substring(0, 31);
    }
    return `Item ${cleanItem} (${page})`.substring(0, 31);
}

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
        ws.getCell(excelRow, 56).value = dataRow.quantity !== null ? dataRow.quantity : null;

        // Amount: BJ (col 62) ya tiene la fórmula =AO7*BD{row}

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

function clearDataRow(ws: ExcelJS.Worksheet, rowNum: number) {
    ws.getCell(rowNum, 3).value  = '';
    ws.getCell(rowNum, 28).value = '';
    ws.getCell(rowNum, 56).value = null; // null preserva fórmulas sin #VALUE!
    ws.getCell(rowNum, 69).value = '';
    ws.getCell(rowNum, 72).value = '';
    ws.getCell(rowNum, 76).value = null;
}

function fillInspectorLegend(ws: ExcelJS.Worksheet, inspectorLegend: Map<string, string>) {
    const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
    const letterToName = new Map<string, string>();
    inspectorLegend.forEach((letter, name) => {
        if (!letterToName.has(letter)) {
            letterToName.set(letter, name);
        }
    });

    for (let i = 0; i < MAX_INSPECTORS_LEGEND; i++) {
        const rowNum = INSPECTOR_ROW_START + i;
        const letter = letters[i];
        ws.getCell(rowNum, 14).value = letterToName.get(letter) || '';
    }
}

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

function formatProjectNumber(numAct: string): string {
    if (!numAct) return '';
    if (numAct.match(/^AC-/i)) return numAct.toUpperCase();
    const digits = numAct.replace(/\D/g, '');
    return `AC-${digits}`;
}

async function cloneSheet(source: ExcelJS.Worksheet, target: ExcelJS.Worksheet) {
    source.columns.forEach((col: any, i: number) => {
        if (col && col.width) target.getColumn(i + 1).width = col.width;
    });

    source.eachRow({ includeEmpty: true }, (row: any, rowNum: number) => {
        const newRow = target.getRow(rowNum);
        if (row.height) newRow.height = row.height;

        row.eachCell({ includeEmpty: true }, (cell: any, colNum: number) => {
            const newCell = newRow.getCell(colNum);
            if (cell.value && typeof cell.value === 'object' && cell.value.formula) {
                newCell.value = { ...cell.value };
            } else {
                newCell.value = cell.value;
            }

            if (cell.style) {
                try {
                    newCell.style = JSON.parse(JSON.stringify(cell.style));
                } catch {}
            }
        });
        newRow.commit();
    });

    // @ts-ignore
    const merges = source._merges || {};
    Object.values(merges).forEach((m: any) => {
        try {
            if (m && m.tl && m.br) target.mergeCells(m.tl, m.br);
        } catch {}
    });

    if (source.pageSetup) {
        target.pageSetup = { ...source.pageSetup };
    }
}
