import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { supabase } from './supabase';
import { ACT117A_TEMPLATE_BASE64 } from './act117aTemplate';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface CertExcelRow {
    itemNum: string;      // Número de ítem o código de especificación
    specCode?: string;    // Código de especificación original
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

// ─── Constantes de celdas de la plantilla oficial ACT-117A ───────────────────
const TEMPLATE_CELLS = {
    PROJECT_NAME: 'K6',  // merged K6:AE6
    PROJECT_NUM:  'K7',  // merged K7:AG7
    CONTRACTOR:   'K8',  // merged K8:AG8
    ITEM_NO:      'AO6', // merged AO6:AV6
    UNIT_PRICE:   'AO7', // merged AO7:AV7
    ITEM_DESC:    'AR8', // merged AR8:BN8
    ITEM_UNIT:    'BG6', // merged BG6:BN6
    CERT_NUM:     'BW6', // merged BW6:CB6
    CERT_DATE:    'BW7', // merged BW7:CB7
    PAGE_OF_NUM:  'AV39', // número de página actual
    TOTAL_PAGES:  'AZ39', // total de páginas del ítem
} as const;

// Filas de detalle (13 a 27 = 15 filas por página)
const DATA_ROW_START = 13;
const DATA_ROW_END   = 27;
const ROWS_PER_PAGE  = DATA_ROW_END - DATA_ROW_START + 1; // 15

// Filas de la leyenda inferior de inspectores (29 a 38)
const INSPECTOR_ROW_START = 29;
const INSPECTOR_ROW_END   = 38;

// ─── Función Principal ───────────────────────────────────────────────────────

/**
 * Genera el reporte ACT-117A (Item Certification Worksheet) a partir de:
 *  - Un archivo Excel de certificación cargado por el usuario
 *  - El número de certificación ingresado por el usuario
 *  - Información del proyecto activo en la base de datos de PACT
 */
export async function generateAct117AFromExcel(
    certExcelFile: File | ArrayBuffer,
    projectId: string,
    customCertNum?: string | number,
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

    // 2. Extraer datos del Excel (soporta bloques con "Item Number:" y formato tabular)
    const { allRows, certNumDetected, certDateDetected } = extractDataFromExcel(firstSheet, errors);

    if (allRows.length === 0) {
        throw new Error('No se encontraron registros de inspección o certificación válidos en el archivo Excel.');
    }

    // Número de certificación final: el ingresado por el usuario tiene prioridad absoluta
    const finalCertNum = customCertNum !== undefined && customCertNum !== null && String(customCertNum).trim() !== ''
        ? String(customCertNum).trim()
        : (certNumDetected || '1');

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

    // 4. Obtener catálogo de partidas del contrato en la base de datos
    const { data: contractItems } = await supabase
        .from('contract_items')
        .select('item_num, specification, description, unit, unit_price')
        .eq('project_id', projectId);

    const itemsDbList = contractItems || [];

    // 5. Agrupar registros por ítem y ordenar cronológicamente
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

    // 7. Crear hojas independientes para cada ítem que tenga registros válidos (> 0)
    let firstSheetUsed = false;
    let itemsProcessedCount = 0;

    for (const itemKey of sortedItemKeys) {
        const rawRows = itemGroups[itemKey];
        const firstRow = rawRows[0];

        // Vincular con la base de datos: buscar por specification o por item_num
        const matchedDbItem = findContractItemInDb(itemKey, firstRow?.specCode, itemsDbList);

        const displayItemNo = matchedDbItem?.item_num || itemKey;
        const unitPrice = matchedDbItem ? (parseFloat(matchedDbItem.unit_price) || 0) : 0;
        const itemDesc = matchedDbItem?.description || firstRow?.itemName || '';
        const itemUnit = matchedDbItem?.unit || '';

        // REGLA 6: Filtrar líneas donde la cantidad sea cero o amount sea cero
        const validRows = rawRows.filter(r => {
            const q = r.quantity;
            if (q === null || q === undefined || isNaN(q) || q <= 0) return false;
            // Si el precio unitario existe y es > 0, verificar que el amount sea > 0
            if (unitPrice > 0) {
                const amt = q * unitPrice;
                if (amt <= 0) return false;
            }
            return true;
        });

        // Si este ítem no tiene ninguna línea válida, no generar hoja
        if (validRows.length === 0) {
            continue;
        }

        itemsProcessedCount++;

        // Calcular cuántas páginas requiere este ítem (15 filas de detalle por página)
        const numPages = Math.ceil(validRows.length / ROWS_PER_PAGE) || 1;

        for (let pageIdx = 0; pageIdx < numPages; pageIdx++) {
            const pageRows = validRows.slice(
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

            // Llenar encabezado
            fillHeader(ws, {
                projectName: projData.name || '',
                projectNum:  formatProjectNumber(projData.num_act || ''),
                contractor:   contrData?.name || '',
                itemNum:      displayItemNo,
                unitPrice:    unitPrice,
                itemDesc:     itemDesc,
                itemUnit:     itemUnit,
                certNum:      finalCertNum,
                certDate:     certDateDetected,
                pageNum:      pageIdx + 1,
                totalPages:   numPages,
            });

            // Llenar filas de detalle (Reglas 1, 2, 3, 4, 6 y 7)
            fillDataRows(ws, pageRows, pageIdx * ROWS_PER_PAGE);

            // REGLA 4: En las líneas donde dice Inspector, no escribir nada (dejar vacías)
            clearInspectorLegend(ws);
        }
    }

    if (itemsProcessedCount === 0) {
        throw new Error('Ninguno de los ítems del archivo tiene cantidades o montos mayores a cero.');
    }

    // 8. Generar buffer final del archivo Excel
    const outBuffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob(
        [outBuffer],
        { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
    );

    return {
        blob,
        certNum: finalCertNum,
        itemsProcessed: itemsProcessedCount,
        errors,
    };
}

// ─── Extractor del Excel (Dual: Bloques e Hilera Tabular) ────────────────────

function extractDataFromExcel(sheet: XLSX.WorkSheet, errors: string[]) {
    const rawMatrix: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

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

/** Extrae de reportes por bloques/secciones con "Item Number:" */
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

        let foundSpecInRow = '';
        let foundNameInRow = '';

        for (let c = 0; c < row.length; c++) {
            const cellVal = String(row[c] || '').trim();
            const lower = cellVal.toLowerCase();

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
            headerIndices = null;
            continue;
        }

        if (currentSpec) {
            const rowStr = row.map(c => String(c).toLowerCase()).join(' ');

            // Detectar cabecera de la tabla
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

            // Leer fila de datos
            if (headerIndices && (headerIndices.recordNo !== undefined || headerIndices.qtyApproved !== undefined || headerIndices.qtyMeasured !== undefined)) {
                const firstCell = String(row[0] || '').toLowerCase().trim();
                
                // REGLA 7: Omitir cualquier fila de total/resumen del Excel de entrada para no escribir totales arriba
                if (firstCell.includes('total') || firstCell.includes('summary')) continue;

                const recordNo = headerIndices.recordNo !== undefined ? String(row[headerIndices.recordNo] || '').trim() : '';
                const inspector = headerIndices.inspector !== undefined ? String(row[headerIndices.inspector] || '').trim() : '';
                const inspDateRaw = headerIndices.inspDate !== undefined ? row[headerIndices.inspDate] : '';

                // Una fila de total en este formato suele tener cantidad pero no tiene Record No ni Inspector ni Fecha de inspección
                if (!recordNo && !inspector && !inspDateRaw) {
                    continue; // Es una fila de total/acumulado del ítem, no una línea de inspección
                }

                let qtyStr = '';
                if (headerIndices.qtyApproved !== undefined && row[headerIndices.qtyApproved] !== '') {
                    qtyStr = String(row[headerIndices.qtyApproved]);
                } else if (headerIndices.qtyMeasured !== undefined) {
                    qtyStr = String(row[headerIndices.qtyMeasured]);
                }

                const qty = parseFloat(qtyStr.replace(/,/g, ''));

                // REGLA 6: Si la cantidad es cero o inválida, no escribir esa línea
                if (isNaN(qty) || qty <= 0) {
                    continue;
                }

                const locationVal = headerIndices.location !== undefined && row[headerIndices.location]
                    ? String(row[headerIndices.location]).trim()
                    : '';

                const pageVal = headerIndices.page !== undefined ? parseInt(String(row[headerIndices.page])) || undefined : undefined;

                allRows.push({
                    itemNum: currentSpec,
                    specCode: currentSpec,
                    itemName: currentItemName,
                    location: locationVal,
                    calculations: '',
                    quantity: qty,
                    inspector,
                    inspDate: formatRawDate(inspDateRaw),
                    page: pageVal,
                });
            }
        }
    }

    if (!certDateDetected && allRows.length > 0) {
        const dates = allRows.map(r => r.inspDate).filter(Boolean).sort().reverse();
        if (dates.length > 0) certDateDetected = dates[0];
    }

    return { allRows, certNumDetected, certDateDetected };
}

/** Extrae de formato tabular plano estándar */
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

            const firstVal = String(Object.values(raw)[0] || '').toLowerCase().trim();
            if (firstVal.includes('total') || itemNumRaw.toLowerCase().includes('total')) {
                continue; // Omitir fila de total
            }

            const qtyStr = String(get(colMap.quantity)).replace(/,/g, '').trim();
            const qty = parseFloat(qtyStr);

            // REGLA 6: Si la cantidad es cero o inválida, no escribir esa línea
            if (isNaN(qty) || qty <= 0) {
                continue;
            }

            allRows.push({
                itemNum: itemNumRaw,
                specCode: itemNumRaw,
                location: String(get(colMap.location)).trim(),
                calculations: '',
                quantity: qty,
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

function findContractItemInDb(
    itemKey: string,
    specCode: string | undefined,
    dbItems: any[]
): any | null {
    const clean = (s: string) => String(s || '').toLowerCase().replace(/[\s_\-\.]/g, '').replace(/^0+/, '');

    const targetSpec = clean(specCode || itemKey);
    const targetKey  = clean(itemKey);

    let found = dbItems.find(it => clean(it.specification) === targetSpec || clean(it.specification) === targetKey);
    if (found) return found;

    found = dbItems.find(it => clean(it.item_num) === targetKey || clean(it.item_num) === targetSpec);
    if (found) return found;

    found = dbItems.find(it => {
        const itSpec = clean(it.specification);
        return itSpec && targetSpec && (itSpec.includes(targetSpec) || targetSpec.includes(itSpec));
    });

    return found || null;
}

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

function detectColumns(firstRow: Record<string, any>) {
    const keys = Object.keys(firstRow);
    const norm = (s: string) => String(s || '').toLowerCase().replace(/[\s_\-\.:]/g, '');
    const find = (...terms: string[]) => keys.find(k => terms.some(t => norm(k).includes(norm(t))));

    return {
        itemNum:      find('itemnumber', 'itemno', 'itemnum', 'item_num', 'item', 'partida', 'especificacion', 'specification'),
        location:     find('location', 'ubicacion', 'lugar', 'estacion', 'station', 'tramo'),
        calculations: find('calculation', 'calculo', 'formula', 'notes', 'notas'),
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

function groupByItem(rows: CertExcelRow[]): Record<string, CertExcelRow[]> {
    const groups: Record<string, CertExcelRow[]> = {};
    for (const row of rows) {
        const key = row.itemNum;
        if (!groups[key]) groups[key] = [];
        groups[key].push(row);
    }

    // Ordenar cronológicamente ascendente (de más antigua a más reciente)
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

    // Activar wrapText en la descripción si es extensa
    const descCell = ws.getCell(TEMPLATE_CELLS.ITEM_DESC);
    if (descCell.style) {
        descCell.style.alignment = { ...(descCell.style.alignment || {}), wrapText: true };
    }
}

/**
 * Llena las filas de detalle (13 a 27) aplicando las reglas de Enrique:
 * 1. Location = Fecha de inspección (Date va vacía)
 * 2. Calculations = Vacía / en blanco
 * 3. Ensanchar altura de fila cuando no quepa la información
 * 4. Inspector en blanco
 * 6. Cantidades o amounts en cero ya fueron excluidos
 * 7. Ningún total se escribe aquí arriba; el total queda abajo en la fila de Total
 */
function fillDataRows(
    ws: ExcelJS.Worksheet,
    pageRows: CertExcelRow[],
    globalOffset: number
) {
    for (let i = 0; i < ROWS_PER_PAGE; i++) {
        const excelRow = DATA_ROW_START + i;
        const dataRow = pageRows[i];

        if (!dataRow) {
            clearDataRow(ws, excelRow);
            continue;
        }

        const dateStr = formatDisplayDate(dataRow.inspDate);

        // REGLA 1: En la columna de Location (C, col 3), escribe la fecha
        const locCell = ws.getCell(excelRow, 3);
        locCell.value = dateStr;
        locCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

        // REGLA 2: En la columna de Calculations (AB, col 28), dejarla en blanco
        ws.getCell(excelRow, 28).value = '';

        // Quantity: BD (col 56)
        ws.getCell(excelRow, 56).value = dataRow.quantity;

        // Amount: BJ (col 62) conserva la fórmula =AO7*BD{row}

        // REGLA 4: En la columna Inspector (BQ, col 69), no escribir nada
        ws.getCell(excelRow, 69).value = '';

        // REGLA 1: Columna Date (BT, col 72), dejarla vacía
        ws.getCell(excelRow, 72).value = '';

        // References - Page: BX (col 76)
        ws.getCell(excelRow, 76).value = dataRow.page !== undefined ? dataRow.page : (globalOffset + i + 1);

        // REGLA 3: Cuando no quepa toda la información, ensanchar la altura de la fila
        // Altura mínima cómoda de lectura: 20 pt (la plantilla original tiene 12 pt, muy pequeña)
        const currentRowHeight = ws.getRow(excelRow).height || 12;
        const requiredHeight = Math.max(currentRowHeight, 20);
        ws.getRow(excelRow).height = requiredHeight;
    }
}

/** Limpia una fila sin borrar fórmulas de Amount */
function clearDataRow(ws: ExcelJS.Worksheet, rowNum: number) {
    ws.getCell(rowNum, 3).value  = '';
    ws.getCell(rowNum, 28).value = '';
    ws.getCell(rowNum, 56).value = null; // null preserva fórmulas sin #VALUE!
    ws.getCell(rowNum, 69).value = '';
    ws.getCell(rowNum, 72).value = '';
    ws.getCell(rowNum, 76).value = null;
    ws.getRow(rowNum).height = 16;
}

/**
 * REGLA 4: En las líneas inferiores donde dice "Inspector (Insp.)", no escribir nada
 */
function clearInspectorLegend(ws: ExcelJS.Worksheet) {
    for (let r = INSPECTOR_ROW_START; r <= INSPECTOR_ROW_END; r++) {
        ws.getCell(r, 14).value = ''; // col N (col 14) en blanco
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
