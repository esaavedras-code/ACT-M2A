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

        // Calcular el Gran Total acumulado de este ítem
        const totalItemQty = validRows.reduce((sum, r) => sum + (r.quantity || 0), 0);
        const totalItemAmt = unitPrice > 0 ? (totalItemQty * unitPrice) : validRows.reduce((sum, r) => {
            const q = r.quantity || 0;
            return sum + (q * unitPrice);
        }, 0);

        // Pre-calcular nombres de hojas para este ítem para referenciarlas en fórmulas si hay múltiples páginas
        const itemSheetNames: string[] = [];
        for (let p = 0; p < numPages; p++) {
            itemSheetNames.push(buildSheetName(displayItemNo, p + 1, numPages));
        }

        for (let pageIdx = 0; pageIdx < numPages; pageIdx++) {
            const pageRows = validRows.slice(
                pageIdx * ROWS_PER_PAGE,
                (pageIdx + 1) * ROWS_PER_PAGE
            );

            const sheetName = itemSheetNames[pageIdx];
            let ws: ExcelJS.Worksheet;

            if (!firstSheetUsed) {
                ws = templateSheet;
                ws.name = sheetName;
                firstSheetUsed = true;
            } else {
                ws = workbook.addWorksheet(sheetName);
                await cloneSheet(templateSheet, ws);
            }

            // Llenar encabezado (asegurando alturas para que las letras nunca salgan incompletas)
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

            // Llenar filas de detalle (Reglas 1, 2, 3, 4, 6 y 7, y columna Page vacía)
            fillDataRows(ws, pageRows, pageIdx * ROWS_PER_PAGE);

            // Manejo de Totales y Gran Total (Punto 3):
            // Cuando se usan varias hojas para un ítem, en la última sale el Gran Total de ese ítem
            applyTotals(ws, {
                pageIdx,
                numPages,
                pageRows,
                unitPrice,
                totalItemQty,
                totalItemAmt,
                itemSheetNames,
            });

            // Asegurar que todas las líneas de las tablas estén 100% completas y continuas (Punto 4)
            ensureTableBorders(ws);

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
                    else if (norm.includes('verified') && norm.includes('approved')) headerIndices.qtyApproved = colIdx;
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

                // REGLA ENRIQUE: Usar la columna de Quantity Verified and Approved del reporte de excel
                let qtyStr = '';
                if (headerIndices.qtyApproved !== undefined && row[headerIndices.qtyApproved] !== undefined && row[headerIndices.qtyApproved] !== '') {
                    qtyStr = String(row[headerIndices.qtyApproved]);
                } else if (headerIndices.qtyMeasured !== undefined && row[headerIndices.qtyMeasured] !== undefined && row[headerIndices.qtyMeasured] !== '') {
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
    if (typeof val === 'number') {
        // Serial de fecha de Excel (días desde 1899-12-30)
        const d = new Date(Math.round((val - 25569) * 86400 * 1000));
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
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
        // Prioridad absoluta a Quantity Verified and Approved según instrucción de Enrique
        quantity:     find('quantityverifiedandapproved', 'verifiedandapproved', 'verifiedapproved', 'quantityverified', 'qtyverified', 'qtyapproved', 'quantityapproved', 'quantitymeasured', 'quantity', 'cantidad', 'qty'),
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
    // REGLA FOTO 3: El encabezado institucional de todas las hojas debe contener la información exacta:
    // Centro: Government of Puerto Rico / Department of Transportation and Public Works / HIGHWAY AND TRANSPORTATION AUTHORITY
    // Derecha arriba: ACT-117A / (6/09)
    // Centro abajo: ITEM CERTIFICATION WORKSHEET
    setupInstitutionalHeader(ws);

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

    // Project Name (fila 6): si tiene varias líneas o es largo, ensanchar para que no corte la primera línea
    const pNameLen = (data.projectName || '').length;
    let r6Height = 26;
    if (pNameLen > 35) r6Height = 36;
    if (pNameLen > 70) r6Height = 48;
    ws.getRow(6).height = r6Height;

    const pNameCell = ws.getCell(TEMPLATE_CELLS.PROJECT_NAME);
    if (pNameCell.style) {
        pNameCell.style.alignment = {
            ...(pNameCell.style.alignment || {}),
            vertical: 'middle',
            horizontal: 'left',
            wrapText: true,
        };
    }

    // Fila 7 (Project Num, Unit Price, Cert Date)
    ws.getRow(7).height = 20;

    // Fila 8 (Contractor, Item Description): ensanchar si la descripción es extensa
    const descLen = (data.itemDesc || '').length;
    ws.getRow(8).height = Math.max(22, Math.ceil(descLen / 45) * 16);

    const descCell = ws.getCell(TEMPLATE_CELLS.ITEM_DESC);
    if (descCell.style) {
        descCell.style.alignment = {
            ...(descCell.style.alignment || {}),
            vertical: 'middle',
            horizontal: 'left',
            wrapText: true,
        };
    }
}

/**
 * Configura el encabezado institucional idéntico a la Foto 3 en todas las hojas:
 * - A1:BT1 -> Government of Puerto Rico (centrado)
 * - BV1:CB1 -> ACT-117A (derecha)
 * - A2:BT2 -> Department of Transportation and Public Works (centrado)
 * - BV2:CB2 -> (6/09) (derecha)
 * - A3:CB3 -> HIGHWAY AND TRANSPORTATION AUTHORITY (centrado)
 * - A5:CB5 -> ITEM CERTIFICATION WORKSHEET (centrado, bold)
 */
function setupInstitutionalHeader(ws: ExcelJS.Worksheet) {
    // 1. Fila 1: Central + ACT-117A a la derecha
    try {
        if (ws._merges['A1']) ws.unMergeCells('A1:CB1');
    } catch {}
    try {
        ws.mergeCells('A1:BT1');
        ws.mergeCells('BV1:CB1');
    } catch {}

    ws.getCell('A1').value = 'Government of Puerto Rico';
    ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell('A1').font = { name: 'Arial', size: 9, bold: false };

    ws.getCell('BV1').value = 'ACT-117A';
    ws.getCell('BV1').alignment = { horizontal: 'right', vertical: 'middle' };
    ws.getCell('BV1').font = { name: 'Arial', size: 9, bold: true };

    // 2. Fila 2: Central + (6/09) a la derecha
    try {
        if (ws._merges['A2']) ws.unMergeCells('A2:CB2');
    } catch {}
    try {
        ws.mergeCells('A2:BT2');
        ws.mergeCells('BV2:CB2');
    } catch {}

    ws.getCell('A2').value = 'Department of Transportation and Public Works';
    ws.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell('A2').font = { name: 'Arial', size: 9, bold: false };

    ws.getCell('BV2').value = '(6/09)';
    ws.getCell('BV2').alignment = { horizontal: 'right', vertical: 'middle' };
    ws.getCell('BV2').font = { name: 'Arial', size: 9, bold: false };

    // 3. Fila 3: HIGHWAY AND TRANSPORTATION AUTHORITY
    ws.getCell('A3').value = 'HIGHWAY AND TRANSPORTATION AUTHORITY';
    ws.getCell('A3').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell('A3').font = { name: 'Arial', size: 9, bold: false };

    // 4. Fila 5: ITEM CERTIFICATION WORKSHEET
    ws.getCell('A5').value = 'ITEM CERTIFICATION WORKSHEET';
    ws.getCell('A5').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell('A5').font = { name: 'Arial', size: 10, bold: true };

    // Alturas de filas superiores para que nunca se corten las letras
    ws.getRow(1).height = 15;
    ws.getRow(2).height = 15;
    ws.getRow(3).height = 16;
    ws.getRow(4).height = 8;
    ws.getRow(5).height = 18;
}

/**
 * Llena las filas de detalle (13 a 27) aplicando las reglas de Enrique:
 * 1. Location = Fecha de inspección (Date va vacía)
 * 2. Calculations = Vacía / en blanco
 * 3. Ensanchar altura de fila cuando no quepa la información
 * 4. Inspector en blanco
 * 5. Columna Page vacía
 * 6. REGLA FOTO 1: Si amount es cero, dejar la celda completamente en blanco
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

        // REGLA FOTO 1: En la columna de Amount (BJ, col 62), si es cero, deja en blanco esa celda
        if (!dataRow.quantity || dataRow.quantity <= 0) {
            ws.getCell(excelRow, 62).value = '';
        } else {
            ws.getCell(excelRow, 62).value = {
                formula: `IF(BD${excelRow}>0, AO7*BD${excelRow}, "")`,
                result: null,
            };
            ws.getCell(excelRow, 62).numFmt = '$#,##0.00';
        }

        // REGLA 4: En la columna Inspector (BQ, col 69), no escribir nada
        ws.getCell(excelRow, 69).value = '';

        // REGLA 1: Columna Date (BT, col 72), dejarla vacía
        ws.getCell(excelRow, 72).value = '';

        // REGLA: En la columna de Page (BX, col 76), que esté vacía
        ws.getCell(excelRow, 76).value = '';

        // Altura cómoda de fila
        ws.getRow(excelRow).height = 22;
    }
}

/** Limpia una fila sin dejar $0.00 en Amount (Foto 1) */
function clearDataRow(ws: ExcelJS.Worksheet, rowNum: number) {
    ws.getCell(rowNum, 3).value  = '';
    ws.getCell(rowNum, 28).value = '';
    ws.getCell(rowNum, 56).value = null;
    ws.getCell(rowNum, 62).value = ''; // REGLA FOTO 1: Si es cero o no hay dato, dejar en blanco la celda
    ws.getCell(rowNum, 69).value = '';
    ws.getCell(rowNum, 72).value = '';
    ws.getCell(rowNum, 76).value = ''; // Page vacía
    ws.getRow(rowNum).height = 18;
}

/**
 * Aplica los totales y el Gran Total en la última hoja de un ítem (Puntos 2 y 3):
 * - REGLA FOTO 2: La palabra "Gran Total" debe verse completa y sin cortarse
 * - Cuando se usan varias hojas para un ítem, en la última sale el Gran Total acumulado
 */
function applyTotals(ws: ExcelJS.Worksheet, ctx: {
    pageIdx: number;
    numPages: number;
    pageRows: CertExcelRow[];
    unitPrice: number;
    totalItemQty: number;
    totalItemAmt: number;
    itemSheetNames: string[];
}) {
    const { pageIdx, numPages, pageRows, unitPrice, totalItemQty, totalItemAmt, itemSheetNames } = ctx;

    const pageQty = pageRows.reduce((sum, r) => sum + (r.quantity || 0), 0);
    const pageAmt = unitPrice > 0 ? (pageQty * unitPrice) : pageRows.reduce((sum, r) => {
        const q = r.quantity || 0;
        return sum + (q * unitPrice);
    }, 0);

    // REGLA FOTO 2: Combinar BD30:BI30 y BJ30:BP30 para que "Gran Total" quepa completo sin cortarse
    try {
        if (ws._merges['BE30']) ws.unMergeCells('BE30:BI30');
    } catch {}
    try {
        ws.mergeCells('BD30:BI30');
    } catch {}

    try {
        if (ws._merges['BK30']) ws.unMergeCells('BK30:BP30');
    } catch {}
    try {
        ws.mergeCells('BJ30:BP30');
    } catch {}

    const totalLabelFont = { bold: true, size: 9, name: 'Arial' };
    const totalLabelAlign = { horizontal: 'center' as const, vertical: 'middle' as const, shrinkToFit: true };

    if (numPages <= 1) {
        // Ítem de 1 sola página: total estándar
        ws.getCell('BD28').value = { formula: 'SUM(BD13:BI27)', result: totalItemQty };
        ws.getCell('BJ28').value = { formula: 'SUM(BJ13:BP27)', result: totalItemAmt };

        ws.getCell('BD30').value = 'Total';
        ws.getCell('BD30').font = totalLabelFont;
        ws.getCell('BD30').alignment = totalLabelAlign;

        ws.getCell('BJ30').value = 'Total';
        ws.getCell('BJ30').font = totalLabelFont;
        ws.getCell('BJ30').alignment = totalLabelAlign;
    } else {
        // Ítem de múltiples páginas
        const isLastPage = pageIdx === numPages - 1;

        if (!isLastPage) {
            // Páginas intermedias: Sub-Total de la página
            ws.getCell('BD28').value = { formula: 'SUM(BD13:BI27)', result: pageQty };
            ws.getCell('BJ28').value = { formula: 'SUM(BJ13:BP27)', result: pageAmt };

            ws.getCell('BD30').value = 'Sub-Total';
            ws.getCell('BD30').font = totalLabelFont;
            ws.getCell('BD30').alignment = totalLabelAlign;

            ws.getCell('BJ30').value = 'Sub-Total';
            ws.getCell('BJ30').font = totalLabelFont;
            ws.getCell('BJ30').alignment = totalLabelAlign;
        } else {
            // ÚLTIMA PÁGINA: Gran Total acumulado de todas las páginas de este ítem
            const sumQtyFormula = itemSheetNames.map(s => `'${s}'!BD28`).join('+');
            const sumAmtFormula = itemSheetNames.map(s => `'${s}'!BJ28`).join('+');

            ws.getCell('BD28').value = { formula: sumQtyFormula, result: totalItemQty };
            ws.getCell('BJ28').value = { formula: sumAmtFormula, result: totalItemAmt };

            // REGLA FOTO 2: "Gran Total" sin cortes
            ws.getCell('BD30').value = 'Gran Total';
            ws.getCell('BD30').font = totalLabelFont;
            ws.getCell('BD30').alignment = totalLabelAlign;

            ws.getCell('BJ30').value = 'Gran Total';
            ws.getCell('BJ30').font = totalLabelFont;
            ws.getCell('BJ30').alignment = totalLabelAlign;
        }
    }

    ws.getCell('BD28').numFmt = '#,##0.000';
    ws.getCell('BJ28').numFmt = '$#,##0.00';
    ws.getRow(30).height = 16;
}

/**
 * REGLA FOTO 2 y FOTO 3: Asegurar que todas las líneas de las tablas estén completas y continuas.
 * Repasa bordes de encabezado (filas 11-12), filas de detalle (13-27) y pie de tabla (28).
 */
function ensureTableBorders(ws: ExcelJS.Worksheet) {
    const borderMediumBlack = { style: 'medium' as const, color: { argb: 'FF000000' } };
    const borderThinBlack   = { style: 'thin' as const, color: { argb: 'FF000000' } };

    // 1. Encabezados de tabla: filas 11 y 12 (columnas C a BZ = col 3 a 78)
    for (let c = 3; c <= 78; c++) {
        const c11 = ws.getCell(11, c);
        c11.border = { ...(c11.border || {}), top: borderMediumBlack };

        const c12 = ws.getCell(12, c);
        c12.border = { ...(c12.border || {}), bottom: borderMediumBlack };
    }

    // Líneas verticales de los encabezados (filas 11 y 12)
    const headerColsLeft = [3, 28, 56, 62, 69];
    const headerColsRight = [27, 55, 61, 68, 78];

    for (let r = 11; r <= 12; r++) {
        headerColsLeft.forEach(c => {
            const cell = ws.getCell(r, c);
            cell.border = { ...(cell.border || {}), left: borderMediumBlack };
        });
        headerColsRight.forEach(c => {
            const cell = ws.getCell(r, c);
            cell.border = { ...(cell.border || {}), right: borderMediumBlack };
        });
    }

    // En fila 12, divisiones de References (Insp 69-71, Date 72-75, Page 76-78)
    ws.getCell(12, 71).border = { ...(ws.getCell(12, 71).border || {}), right: borderMediumBlack };
    ws.getCell(12, 72).border = { ...(ws.getCell(12, 72).border || {}), left: borderMediumBlack };
    ws.getCell(12, 75).border = { ...(ws.getCell(12, 75).border || {}), right: borderMediumBlack };
    ws.getCell(12, 76).border = { ...(ws.getCell(12, 76).border || {}), left: borderMediumBlack };

    // 2. Filas de datos (13 a 27)
    const detailColsLeft = [3, 28, 56, 62, 69, 72, 76];
    const detailColsRight = [27, 55, 61, 68, 71, 75, 78];

    for (let r = DATA_ROW_START; r <= DATA_ROW_END; r++) {
        // Línea inferior horizontal delgada en toda la fila de la tabla
        for (let c = 3; c <= 78; c++) {
            const cell = ws.getCell(r, c);
            cell.border = { ...(cell.border || {}), bottom: borderThinBlack };
        }

        // Líneas verticales gruesas en los límites de cada columna combinada
        detailColsLeft.forEach(c => {
            const cell = ws.getCell(r, c);
            cell.border = { ...(cell.border || {}), left: borderMediumBlack };
        });
        detailColsRight.forEach(c => {
            const cell = ws.getCell(r, c);
            cell.border = { ...(cell.border || {}), right: borderMediumBlack };
        });
    }

    // 3. Fila de Totales (fila 28 y 29): asegurar borde inferior medium
    for (let c = 56; c <= 78; c++) {
        const cell = ws.getCell(29, c);
        cell.border = { ...(cell.border || {}), bottom: borderMediumBlack };
    }
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

    // Clonar TODOS los merges correctamente utilizando m.range o m.model
    // @ts-ignore
    const merges = source._merges || {};
    Object.values(merges).forEach((m: any) => {
        try {
            if (m && m.range) {
                target.mergeCells(m.range);
            } else if (m && m.model) {
                target.mergeCells(m.model.top, m.model.left, m.model.bottom, m.model.right);
            }
        } catch {}
    });

    if (source.pageSetup) {
        target.pageSetup = { ...source.pageSetup };
    }
}

