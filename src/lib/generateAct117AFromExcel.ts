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
    isBlueQty?: boolean;
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

export interface DetectedItemSummary {
    itemKey: string;
    itemNum?: string;
    specCode?: string;
    itemName?: string;
    totalQty: number;
    rowsCount: number;
}

// ─── Extractor de Ítem a partir del Nombre de la Página del Excel ──────────────

/**
 * Busca e identifica el número y descripción del ítem a partir del nombre de la pestaña / página de Excel.
 * Soporta nombres como:
 * - "Item 7 - Borrow Class D", "Partida 008 - Foundation Fill", "Item 6", "Partida 11", "Item 603(1)"
 * - "7 - Borrow Class D", "6", "008", "603-01", "10"
 */
export function extractItemFromSheetName(sheetName: string): { itemNum: string; itemName?: string } | null {
    if (!sheetName) return null;
    const s = sheetName.trim();
    const lower = s.toLowerCase();

    // Descartar hojas auxiliares que no representen partidas
    if (['summary', 'resumen', 'totales', 'total', 'portada', 'cover', 'general', 'datos', 'instrucciones', 'instructions'].includes(lower)) {
        return null;
    }

    // 1. "Item 7 - Borrow Class D" / "Partida 008 - Foundation Fill" / "Item 603(1)" / "Item 6" / "Partida 11"
    const matchPrefix = s.match(/^(?:item|partida|it[\.\s]|p[\.\s])\s*([a-zA-Z0-9\-\.\_\(\)]+)(?:\s*[\-\:–—]\s*(.*))?$/i);
    if (matchPrefix) {
        return {
            itemNum: matchPrefix[1].trim(),
            itemName: matchPrefix[2] ? matchPrefix[2].trim() : undefined,
        };
    }

    // 2. Comienza directamente con número: "7 - Borrow Class D", "008 Foundation", "6", "7", "008", "603-01", "10"
    const matchNum = s.match(/^([0-9]+[a-zA-Z0-9\-\.\_\(\)]*)(?:\s*[\-\:–—\s]\s*(.*))?$/);
    if (matchNum) {
        return {
            itemNum: matchNum[1].trim(),
            itemName: matchNum[2] ? matchNum[2].trim() : undefined,
        };
    }

    // 3. Si no tiene número pero es una hoja de trabajo activa
    return {
        itemNum: s,
        itemName: s,
    };
}

/**
 * Escanea un archivo Excel de certificación:
 * 1. Busca el nombre de TODAS las páginas del archivo de Excel.
 * 2. Selecciona e identifica los ítems que están presentes en el Excel.
 * 3. Extrae fechas, números de certificación e inspectores detectados en todo el libro.
 */
export async function scanExcelItems(
    certExcelFile: File | ArrayBuffer,
): Promise<{
    items: DetectedItemSummary[];
    certNumDetected?: string;
    certDateDetected?: string;
    inspectorsDetected?: string[];
    sheetNamesDetected?: string[];
}> {
    let rawBuffer: ArrayBuffer;
    if (certExcelFile instanceof File) {
        const lowerName = certExcelFile.name.toLowerCase();
        if (!lowerName.endsWith('.xlsx') && !lowerName.endsWith('.xls')) {
            throw new Error('Solo se admiten archivos Excel (.xlsx o .xls). No se permiten otros formatos.');
        }
        rawBuffer = await certExcelFile.arrayBuffer();
    } else {
        rawBuffer = certExcelFile;
    }

    const certWb = XLSX.read(rawBuffer, { type: 'array', cellDates: true });
    if (!certWb.SheetNames || certWb.SheetNames.length === 0) {
        return { items: [] };
    }

    const errors: string[] = [];
    const { allRows, certNumDetected, certDateDetected, sheetItemsDetected } = extractDataFromWorkbook(certWb, errors);

    const consolidatedRows = applyDateInspectorRules(allRows);
    const itemGroups = groupByItem(consolidatedRows);

    // Asegurar que todos los ítems detectados en los nombres de las páginas existan en itemGroups
    for (const sh of sheetItemsDetected) {
        if (!itemGroups[sh.itemNum]) {
            itemGroups[sh.itemNum] = [{
                itemNum: sh.itemNum,
                specCode: sh.itemNum,
                itemName: sh.itemName || '',
                location: '',
                calculations: '',
                quantity: 0,
                inspector: '',
                inspDate: '',
            }];
        }
    }

    // Determinar si el Excel usa formato de múltiples hojas (una hoja por ítem)
    // vs. una sola hoja tabular con todas las partidas
    const hasMultipleSheets = certWb.SheetNames.length > 1;

    // Si el Excel tiene múltiples hojas, la lista de ítems se basa en los nombres de las hojas.
    // Si tiene una sola hoja tabular, se basa en los ítems detectados con cantidad > 0.
    let items: DetectedItemSummary[];

    if (hasMultipleSheets) {
        // MÚLTIPLES HOJAS: cada hoja es una partida.
        // Construir la lista directamente desde sheetItemsDetected + itemGroups enriquecidos.
        const usedKeys = new Set<string>();
        items = [];

        for (const sh of sheetItemsDetected) {
            const key = sh.itemNum;
            if (usedKeys.has(key)) continue;
            usedKeys.add(key);

            const rows = itemGroups[key] || [];
            const validRows = rows.filter(r => {
                const q = parseFloat(String(r.quantity ?? 0));
                return !isNaN(q) && q > 0;
            });
            const totalQty = validRows.reduce((s, r) => s + (r.quantity || 0), 0);
            const first = rows[0];

            items.push({
                itemKey: key,
                itemNum: key,
                specCode: first?.specCode || key,
                itemName: sh.itemName || first?.itemName || '',
                totalQty,
                rowsCount: validRows.length > 0 ? validRows.length : rows.length,
            });
        }

        // Ordenar naturalmente por número
        items.sort((a, b) => {
            const na = parseFloat(a.itemNum) || 0;
            const nb = parseFloat(b.itemNum) || 0;
            return na - nb || a.itemNum.localeCompare(b.itemNum);
        });
    } else {
        // UNA SOLA HOJA TABULAR: solo mostrar partidas con cantidad > 0
        const sortedItemKeys = Object.keys(itemGroups).sort((a, b) => {
            const na = parseFloat(a) || 0;
            const nb = parseFloat(b) || 0;
            return na - nb || a.localeCompare(b);
        });

        items = sortedItemKeys
            .map(k => {
                const rows = itemGroups[k] || [];
                const first = rows[0];
                const validRows = rows.filter(r => {
                    const q = parseFloat(String(r.quantity ?? 0));
                    return !isNaN(q) && q > 0;
                });
                const totalQty = validRows.reduce((s, r) => s + (r.quantity || 0), 0);
                return {
                    itemKey: k,
                    itemNum: k,
                    specCode: first?.specCode,
                    itemName: first?.itemName || '',
                    totalQty,
                    rowsCount: validRows.length,
                };
            })
            .filter(it => it.rowsCount > 0);
    }

    const uniqueInsp: string[] = [];
    for (const r of allRows) {
        const insp = (r.inspector || '').trim();
        if (insp && !uniqueInsp.some(u => u.toLowerCase() === insp.toLowerCase())) {
            uniqueInsp.push(insp);
        }
    }

    return {
        items,
        certNumDetected: certNumDetected ? String(certNumDetected) : undefined,
        certDateDetected: certDateDetected ? String(certDateDetected) : undefined,
        inspectorsDetected: uniqueInsp,
        sheetNamesDetected: certWb.SheetNames,
    };
}

// ─── Función Principal ───────────────────────────────────────────────────────

/**
 * Genera el reporte ACT-117A (Item Certification Worksheet) a partir de:
 *  - Un archivo Excel de certificación cargado por el usuario (.xlsx o .xls)
 *  - El número de certificación ingresado por el usuario (prioridad absoluta)
 *  - La fecha de certificación ingresada por el usuario (prioridad absoluta)
 *  - Información del proyecto activo en la base de datos de PACT
 *  - Partidas seleccionadas (opcional, solo genera las marcadas)
 *  - Inspectores seleccionados o ingresados por el usuario
 */
export async function generateAct117AFromExcel(
    certExcelFile: File | ArrayBuffer,
    projectId: string,
    customCertNum?: string | number,
    customCertDate?: string,
    selectedItems?: string[],
    selectedInspectors?: string[],
): Promise<GenerateAct117AFromExcelResult> {
    const errors: string[] = [];

    // 1. Archivos Permitidos: Aceptar únicamente archivos Excel (.xlsx y .xls)
    let rawBuffer: ArrayBuffer;
    if (certExcelFile instanceof File) {
        const lowerName = certExcelFile.name.toLowerCase();
        if (!lowerName.endsWith('.xlsx') && !lowerName.endsWith('.xls')) {
            throw new Error('Solo se admiten archivos Excel (.xlsx y .xls). No se permiten otros formatos.');
        }
        rawBuffer = await certExcelFile.arrayBuffer();
    } else {
        rawBuffer = certExcelFile;
    }

    const headerBytes = new Uint8Array(rawBuffer.slice(0, 5));
    const headerStr = String.fromCharCode(...Array.from(headerBytes));
    if (headerStr.startsWith('%PDF')) {
        throw new Error('El archivo seleccionado es un documento PDF. Solo se admiten archivos Excel (.xlsx y .xls).');
    }

    const certWb = XLSX.read(rawBuffer, { type: 'array', cellDates: true });
    if (!certWb.SheetNames || certWb.SheetNames.length === 0) {
        throw new Error('El archivo Excel no contiene hojas de trabajo válidas.');
    }

    // 2. Extraer datos de TODAS las páginas del documento Excel
    const { allRows, certNumDetected, certDateDetected } = extractDataFromWorkbook(certWb, errors);

    if (allRows.length === 0) {
        throw new Error('No se encontraron registros de certificación con cantidades válidas en el archivo Excel.');
    }

    // Regla 2: Número de Certificación
    // El valor ingresado manualmente por el usuario tendrá prioridad absoluta sobre cualquier número detectado en el Excel
    const finalCertNum = (customCertNum !== undefined && customCertNum !== null && String(customCertNum).trim() !== '')
        ? String(customCertNum).trim()
        : (certNumDetected || '');

    if (!finalCertNum) {
        throw new Error('El campo Cert. Num. es obligatorio para generar los formularios ACT-117A.');
    }

    // Regla 3: Fecha de Certificación
    // La fecha ingresada manualmente sustituye cualquier fecha encontrada en el archivo fuente
    const finalCertDate = (customCertDate && customCertDate.trim() !== '')
        ? customCertDate.trim()
        : (certDateDetected || new Date().toISOString().split('T')[0]);

    // 3. Regla 15: Datos de Proyecto desde PACT
    const { data: projData, error: projErr } = await supabase
        .from('projects')
        .select('name, num_act')
        .eq('id', projectId)
        .single();

    if (projErr || !projData) {
        throw new Error('No se pudo encontrar el proyecto activo en la base de datos de PACT.');
    }

    const { data: contrData } = await supabase
        .from('contractors')
        .select('name')
        .eq('project_id', projectId)
        .maybeSingle();

    // Catálogo del Contrato desde PACT
    const { data: contractItems } = await supabase
        .from('contract_items')
        .select('item_num, specification, description, unit, unit_price')
        .eq('project_id', projectId);

    const itemsDbList = contractItems || [];

    // 4. Regla 13: Lista final de inspectores únicos
    const uniqueExcelInspectors: string[] = [];
    for (const r of allRows) {
        const rawInsp = (r.inspector || '').trim();
        if (rawInsp && !uniqueExcelInspectors.some(u => u.toLowerCase() === rawInsp.toLowerCase())) {
            uniqueExcelInspectors.push(rawInsp);
        }
    }

    let finalInspectors: string[] = [];
    if (Array.isArray(selectedInspectors) && selectedInspectors.length > 0) {
        finalInspectors = Array.from(new Set(selectedInspectors.map(s => String(s).trim()).filter(Boolean)));
    } else {
        finalInspectors = uniqueExcelInspectors;
    }

    // 5. Agrupar registros por partida
    const consolidatedRows = applyDateInspectorRules(allRows);
    const itemGroups = groupByItem(consolidatedRows);
    const sortedItemKeys = Object.keys(itemGroups).sort((a, b) => {
        const na = parseFloat(a) || 0;
        const nb = parseFloat(b) || 0;
        return na - nb || a.localeCompare(b);
    });

    // Regla 4: Selector de Partidas - El sistema solo generará las partidas seleccionadas
    let targetItemKeys = sortedItemKeys;
    if (Array.isArray(selectedItems) && selectedItems.length > 0) {
        const selNorm = new Set(selectedItems.map(s => String(s).trim().toLowerCase()));
        targetItemKeys = sortedItemKeys.filter(k => {
            const rawRows = itemGroups[k] || [];
            const firstRow = rawRows[0];
            const matchedDbItem = findContractItemInDb(k, firstRow?.specCode, itemsDbList);
            const displayItemNo = matchedDbItem?.item_num || k;

            return selNorm.has(k.toLowerCase()) ||
                   selNorm.has(displayItemNo.toLowerCase()) ||
                   (firstRow?.specCode && selNorm.has(firstRow.specCode.toLowerCase())) ||
                   (matchedDbItem?.specification && selNorm.has(matchedDbItem.specification.toLowerCase()));
        });

        if (targetItemKeys.length === 0) {
            throw new Error('Ninguna de las partidas seleccionadas tiene registros válidos en el archivo Excel.');
        }
    }

    // 6. Cargar plantilla oficial ACT-117A
    const workbook = new ExcelJS.Workbook();
    const bufferTemplate = Buffer.from(ACT117A_TEMPLATE_BASE64, 'base64');
    await workbook.xlsx.load(bufferTemplate as any);

    const templateSheet = workbook.getWorksheet(1);
    if (!templateSheet) {
        throw new Error('La plantilla oficial ACT-117A no contiene hojas válidas.');
    }

    // 7. Crear hojas independientes para cada partida con registros mayores a cero
    let firstSheetUsed = false;
    let itemsProcessedCount = 0;

    for (const itemKey of targetItemKeys) {
        const rawRows = itemGroups[itemKey];
        const firstRow = rawRows[0];

        // Vincular con la base de datos PACT
        const matchedDbItem = findContractItemInDb(itemKey, firstRow?.specCode, itemsDbList);

        const displayItemNo = matchedDbItem?.item_num || itemKey;
        const unitPrice = matchedDbItem ? (parseFloat(matchedDbItem.unit_price) || 0) : 0;
        const itemDesc = matchedDbItem?.description || firstRow?.itemName || '';
        const itemUnit = matchedDbItem?.unit || '';

        // Regla 10: Exclusión de Cantidades en Cero
        const validRows = rawRows.filter(r => {
            const q = r.quantity;
            return q !== null && q !== undefined && !isNaN(q) && q > 0;
        });

        if (validRows.length === 0) {
            continue;
        }

        itemsProcessedCount++;

        // Regla 16: Paginación de Partidas (Máximo 15 líneas de detalle por página, filas 13 a 27)
        const numPages = Math.ceil(validRows.length / ROWS_PER_PAGE) || 1;

        const totalItemQty = validRows.reduce((sum, r) => sum + (r.quantity || 0), 0);
        const totalItemAmt = totalItemQty * unitPrice;

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

            // Regla 14: Encabezado Institucional Oficial y Regla 15: Datos de Proyecto
            fillHeader(ws, {
                projectName: projData.name || '',
                projectNum:  formatProjectNumber(projData.num_act || ''),
                contractor:  contrData?.name || '',
                itemNum:     displayItemNo,
                unitPrice:   unitPrice,
                itemDesc:    itemDesc,
                itemUnit:    itemUnit,
                certNum:     finalCertNum,
                certDate:    finalCertDate,
                pageNum:     pageIdx + 1,
                totalPages:  numPages,
            });

            // Reglas 5, 6, 7, 8, 9, 12: Filas de Detalle
            fillDataRows(ws, pageRows, finalInspectors);

            // Regla 16: Totales (Sub-Total en páginas intermedias y Gran Total en la última)
            applyTotals(ws, {
                pageIdx,
                numPages,
                pageRows,
                unitPrice,
                totalItemQty,
                totalItemAmt,
                itemSheetNames,
            });

            // Regla 13: Leyenda Inferior de Inspectores (filas 29 a 38)
            fillInspectorLegend(ws, finalInspectors);

            // Regla 17: Bordes y Alturas de Fila
            ensureTableBorders(ws);
        }
    }

    if (itemsProcessedCount === 0) {
        throw new Error('Ninguna de las partidas seleccionadas tiene registros con cantidades mayores a cero.');
    }

    // Generar archivo Excel final
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

// ─── Separador Inteligente de Location y Calculations ─────────────────────────

export function splitLocationAndCalculations(
    rawLoc: string,
    rawCalc: string,
    rawDesc: string = ''
): { location: string; calculations: string } {
    const loc = (rawLoc || '').trim();
    const calc = (rawCalc || rawDesc || '').trim();

    if (loc && calc && loc.toLowerCase() !== calc.toLowerCase()) {
        return { location: loc, calculations: calc };
    }

    const full = loc || calc;
    if (!full) return { location: '', calculations: '' };

    const sep = full.match(/^(.+?)\s*(?:[-–—:]|\s\/\s)\s*(.+)$/);
    if (sep) {
        const p1 = sep[1].trim();
        const p2 = sep[2].trim();
        if (/^(sta|station|km|est|tramo|rampa|cl|eb|wb|nb|sb|lote|calle|ave|ave\.|puente|pier|abutment)\b/i.test(p1) || /\d+\+\d+/.test(p1)) {
            return { location: p1, calculations: p2 };
        }
        if (/^(sta|station|km|est|tramo|rampa|cl|eb|wb|nb|sb|lote|calle|ave|ave\.|puente|pier|abutment)\b/i.test(p2) || /\d+\+\d+/.test(p2)) {
            return { location: p2, calculations: p1 };
        }
        return { location: p1, calculations: p2 };
    }

    const matchStation = full.match(/^(?:STA(?:\.|TION)?\s*\d+\+\d+(?:\s*(?:TO|A|-)\s*(?:STA(?:\.|TION)?\s*)?\d+\+\d+)?|KM\s*\d+(?:\.\d+)?(?:\s*(?:TO|A|-)\s*KM\s*\d+(?:\.\d+)?)?)/i);
    if (matchStation) {
        const matchedLoc = matchStation[0].trim();
        const rem = full.substring(matchStation[0].length).replace(/^[\s,;:\-]+/, '').trim();
        return { location: matchedLoc, calculations: rem };
    }

    return { location: full, calculations: '' };
}

// ─── Extractor de Datos del Libro Completo (Todas las Hojas) ─────────────────

function extractDataFromWorkbook(wb: XLSX.WorkBook, errors: string[]) {
    const allRows: CertExcelRow[] = [];
    let certNumDetected = '';
    let certDateDetected = '';
    const sheetItemsDetected: { itemNum: string; itemName?: string; sheetName: string }[] = [];

    for (const sheetName of wb.SheetNames) {
        const sheet = wb.Sheets[sheetName];
        if (!sheet) continue;

        const sheetItemInfo = extractItemFromSheetName(sheetName);
        if (sheetItemInfo) {
            sheetItemsDetected.push({ ...sheetItemInfo, sheetName });
        }

        // Extraer datos de esta hoja individual
        const { allRows: sheetRows, certNumDetected: sCertNum, certDateDetected: sCertDate } = extractDataFromExcel(sheet, errors, sheetItemInfo || undefined);

        if (sCertNum && !certNumDetected) certNumDetected = sCertNum;
        if (sCertDate && !certDateDetected) certDateDetected = sCertDate;

        for (const row of sheetRows) {
            if ((!row.itemNum || row.itemNum.trim() === '') && sheetItemInfo?.itemNum) {
                row.itemNum = sheetItemInfo.itemNum;
                row.specCode = sheetItemInfo.itemNum;
            }
            if (!row.itemName && sheetItemInfo?.itemName) {
                row.itemName = sheetItemInfo.itemName;
            }
            allRows.push(row);
        }

        // Si la hoja tiene nombre de ítem (ej. "Item 7") pero no tuvo filas por formato tabular
        if (sheetItemInfo && sheetRows.length === 0) {
            const rawMatrix: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
            let foundQty = 0;
            let foundLoc = '';
            let foundInsp = '';
            let foundDate = '';

            for (const r of rawMatrix) {
                if (!r || r.length === 0) continue;
                for (let c = 0; c < r.length; c++) {
                    const val = String(r[c] || '').toLowerCase().trim();
                    if (!certNumDetected && val.includes('cert') && (val.includes('no') || val.includes('num'))) {
                        const match = String(r[c] || '').match(/\d+/);
                        if (match) certNumDetected = match[0];
                    }
                    if (val.includes('quantity') || val.includes('cantidad') || val.includes('qty')) {
                        for (let nextC = c + 1; nextC < r.length; nextC++) {
                            const candidate = parseFloat(String(r[nextC] || '').replace(/,/g, ''));
                            if (!isNaN(candidate) && candidate > 0 && foundQty === 0) {
                                foundQty = candidate;
                                break;
                            }
                        }
                    }
                }
            }

            allRows.push({
                itemNum: sheetItemInfo.itemNum,
                specCode: sheetItemInfo.itemNum,
                itemName: sheetItemInfo.itemName || '',
                location: foundLoc,
                calculations: '',
                quantity: foundQty > 0 ? foundQty : 0,
                inspector: foundInsp,
                inspDate: foundDate,
            });
        }
    }

    return { allRows, certNumDetected, certDateDetected, sheetItemsDetected };
}

function extractDataFromExcel(
    sheet: XLSX.WorkSheet,
    errors: string[],
    defaultItemInfo?: { itemNum: string; itemName?: string }
) {
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
        return extractFromBlockFormat(rawMatrix, errors, defaultItemInfo);
    } else {
        return extractFromTabularFormat(sheet, errors, defaultItemInfo);
    }
}

/** Extrae de reportes por bloques/secciones con "Item Number:" */
function extractFromBlockFormat(
    rawMatrix: any[][],
    errors: string[],
    defaultItemInfo?: { itemNum: string; itemName?: string }
) {
    const allRows: CertExcelRow[] = [];
    let currentSpec = defaultItemInfo?.itemNum || '';
    let currentItemName = defaultItemInfo?.itemName || '';
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
            if (rowStr.includes('record no') || (rowStr.includes('inspector') && (rowStr.includes('quantity') || rowStr.includes('date') || rowStr.includes('cantidad')))) {
                headerIndices = {};
                row.forEach((colVal, colIdx) => {
                    const norm = String(colVal || '').toLowerCase().trim();
                    if (norm.includes('record no')) headerIndices.recordNo = colIdx;
                    else if (norm.includes('inspector')) headerIndices.inspector = colIdx;
                    else if (norm === 'cantidad' || norm.startsWith('cantidad') || norm === 'quantity' || norm.startsWith('quantity')) headerIndices.qtyCantidad = colIdx;
                    else if (norm.includes('verified') && norm.includes('approved')) headerIndices.qtyApproved = colIdx;
                    else if (norm.includes('quantity measured')) headerIndices.qtyMeasured = colIdx;
                    else if (norm.includes('inspection date') || norm.includes('date') || norm.includes('fecha')) headerIndices.inspDate = colIdx;
                    else if (norm.includes('location') || norm.includes('station') || norm.includes('ubicacion')) headerIndices.location = colIdx;
                    else if (norm.includes('calculation') || norm.includes('calculo') || norm.includes('remarks') || norm.includes('description') || norm.includes('notas')) headerIndices.calculations = colIdx;
                    else if (norm.includes('page')) headerIndices.page = colIdx;
                });
                continue;
            }

            // Leer fila de datos
            if (headerIndices && (headerIndices.recordNo !== undefined || headerIndices.qtyCantidad !== undefined || headerIndices.qtyApproved !== undefined || headerIndices.qtyMeasured !== undefined)) {
                const isTotalRow = row.some(cell => {
                    const val = String(cell || '').toLowerCase().trim();
                    return val.includes('total') || val.includes('subtotal') || val.includes('balance') || val.includes('resumen') || val.includes('summary');
                });
                if (isTotalRow) continue;

                const recordNo = headerIndices.recordNo !== undefined ? String(row[headerIndices.recordNo] || '').trim() : '';
                const inspector = headerIndices.inspector !== undefined ? String(row[headerIndices.inspector] || '').trim() : '';
                const inspDateRaw = headerIndices.inspDate !== undefined ? row[headerIndices.inspDate] : '';

                if (!recordNo && !inspector && !inspDateRaw) {
                    continue;
                }

                let qtyStr = '';
                if (headerIndices.qtyCantidad !== undefined && row[headerIndices.qtyCantidad] !== undefined && row[headerIndices.qtyCantidad] !== '') {
                    qtyStr = String(row[headerIndices.qtyCantidad]);
                } else if (headerIndices.qtyApproved !== undefined && row[headerIndices.qtyApproved] !== undefined && row[headerIndices.qtyApproved] !== '') {
                    qtyStr = String(row[headerIndices.qtyApproved]);
                } else if (headerIndices.qtyMeasured !== undefined && row[headerIndices.qtyMeasured] !== undefined && row[headerIndices.qtyMeasured] !== '') {
                    qtyStr = String(row[headerIndices.qtyMeasured]);
                }

                const qty = parseFloat(qtyStr.replace(/,/g, ''));
                if (isNaN(qty) || qty <= 0) {
                    continue;
                }

                const rawLocation = headerIndices.location !== undefined && row[headerIndices.location]
                    ? String(row[headerIndices.location]).trim()
                    : '';

                const rawCalculations = headerIndices.calculations !== undefined && row[headerIndices.calculations]
                    ? String(row[headerIndices.calculations]).trim()
                    : '';

                const { location, calculations } = splitLocationAndCalculations(rawLocation, rawCalculations, currentItemName);
                const pageVal = headerIndices.page !== undefined ? parseInt(String(row[headerIndices.page])) || undefined : undefined;

                allRows.push({
                    itemNum: currentSpec,
                    specCode: currentSpec,
                    itemName: currentItemName,
                    location,
                    calculations,
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
function extractFromTabularFormat(
    sheet: XLSX.WorkSheet,
    errors: string[],
    defaultItemInfo?: { itemNum: string; itemName?: string }
) {
    const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, {
        defval: '',
        raw: false,
        dateNF: 'YYYY-MM-DD'
    });

    if (rawRows.length === 0) {
        return { allRows: [], certNumDetected: '', certDateDetected: '' };
    }

    const colMap = detectColumns(rawRows[0]);
    const fallbackItemNum = defaultItemInfo?.itemNum || '';

    if (!colMap.itemNum && !fallbackItemNum) {
        return { allRows: [], certNumDetected: '', certDateDetected: '' };
    }

    const allRows: CertExcelRow[] = [];
    for (let i = 0; i < rawRows.length; i++) {
        const raw = rawRows[i];
        try {
            const get = (key: string | undefined) => key ? (raw[key] ?? '') : '';
            const detectedItemNum = colMap.itemNum ? String(get(colMap.itemNum)).trim() : '';
            const itemNumRaw = detectedItemNum || fallbackItemNum;
            if (!itemNumRaw || itemNumRaw === '' || itemNumRaw === '0') continue;

            const rowVals = Object.values(raw).map(v => String(v || '').toLowerCase().trim());
            if (rowVals.some(v => v.includes('total') || v.includes('subtotal') || v.includes('balance') || v.includes('resumen') || v.includes('summary'))) {
                continue;
            }

            const qtyStr = String(get(colMap.quantity)).replace(/,/g, '').trim();
            const qty = parseFloat(qtyStr);

            if (isNaN(qty) || qty <= 0) {
                continue;
            }

            const rawLoc = String(get(colMap.location)).trim();
            const rawCalc = String(get(colMap.calculations)).trim();
            const { location, calculations } = splitLocationAndCalculations(rawLoc, rawCalc, defaultItemInfo?.itemName || '');

            allRows.push({
                itemNum: itemNumRaw,
                specCode: itemNumRaw,
                itemName: defaultItemInfo?.itemName || '',
                location,
                calculations,
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
        calculations: find('calculation', 'calculo', 'formula', 'notes', 'notas', 'remarks', 'observaciones', 'descripcion', 'description'),
        quantity:     find('cantidad', 'qty', 'quantity', 'quantityverifiedandapproved', 'verifiedandapproved', 'verifiedapproved', 'quantityverified', 'qtyverified', 'qtyapproved', 'quantityapproved', 'quantitymeasured'),
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

function applyDateInspectorRules(rows: CertExcelRow[]): CertExcelRow[] {
    const byItem: Record<string, CertExcelRow[]> = {};
    for (const row of rows) {
        if (!byItem[row.itemNum]) byItem[row.itemNum] = [];
        byItem[row.itemNum].push(row);
    }

    const result: CertExcelRow[] = [];

    for (const itemKey of Object.keys(byItem)) {
        const itemRows = byItem[itemKey];

        const byDate: Record<string, CertExcelRow[]> = {};
        for (const row of itemRows) {
            const dateKey = row.inspDate || '__nodate__';
            if (!byDate[dateKey]) byDate[dateKey] = [];
            byDate[dateKey].push(row);
        }

        for (const dateKey of Object.keys(byDate)) {
            const dateRows = byDate[dateKey];

            if (dateRows.length === 1) {
                result.push({ ...dateRows[0], isBlueQty: true });
                continue;
            }

            const qtys = dateRows.map(r => r.quantity ?? 0);
            const freqMap: Record<number, number> = {};
            for (const q of qtys) {
                freqMap[q] = (freqMap[q] || 0) + 1;
            }

            let maxFreq = 1;
            let repeatedQty: number | null = null;
            for (const [qStr, freq] of Object.entries(freqMap)) {
                if (freq > maxFreq) {
                    maxFreq = freq;
                    repeatedQty = Number(qStr);
                } else if (freq === maxFreq && maxFreq > 1 && repeatedQty === null) {
                    repeatedQty = Number(qStr);
                }
            }

            const allSame = Object.keys(freqMap).length === 1;
            const someRepeat = repeatedQty !== null;

            if (allSame) {
                result.push({ ...dateRows[0], isBlueQty: true });
            } else if (someRepeat) {
                const firstRepeated = dateRows.find(r => (r.quantity ?? 0) === repeatedQty);
                if (firstRepeated) {
                    result.push({ ...firstRepeated, isBlueQty: true });
                }
            } else {
                for (const row of dateRows) {
                    result.push({ ...row, isBlueQty: true });
                }
            }
        }
    }

    return result;
}

function groupByItem(rows: CertExcelRow[]): Record<string, CertExcelRow[]> {
    const groups: Record<string, CertExcelRow[]> = {};
    for (const row of rows) {
        const key = row.itemNum;
        if (!groups[key]) groups[key] = [];
        groups[key].push(row);
    }

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

    ws.getRow(7).height = 20;

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

function setupInstitutionalHeader(ws: ExcelJS.Worksheet) {
    ['A1:CB1', 'A1:BT1', 'A1:BU1', 'BV1:CB1', 'A2:CB2', 'A2:BT2', 'A2:BU2', 'BV2:CB2'].forEach(r => {
        try { ws.unMergeCells(r); } catch {}
    });

    for (let c = 1; c <= 80; c++) {
        ws.getCell(1, c).value = '';
        ws.getCell(2, c).value = '';
    }

    try {
        ws.mergeCells('A1:BU1');
        ws.mergeCells('BV1:CB1');
    } catch {}

    ws.getCell('A1').value = 'Government of Puerto Rico';
    ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell('A1').font = { name: 'Arial', size: 9, bold: false };

    ws.getCell('BV1').value = 'ACT-117A';
    ws.getCell('BV1').alignment = { horizontal: 'right', vertical: 'middle' };
    ws.getCell('BV1').font = { name: 'Arial', size: 9, bold: true };

    try {
        ws.mergeCells('A2:BU2');
        ws.mergeCells('BV2:CB2');
    } catch {}

    ws.getCell('A2').value = 'Department of Transportation and Public Works';
    ws.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell('A2').font = { name: 'Arial', size: 9, bold: false };

    ws.getCell('BV2').value = '(6/09)';
    ws.getCell('BV2').alignment = { horizontal: 'right', vertical: 'middle' };
    ws.getCell('BV2').font = { name: 'Arial', size: 9, bold: false };

    try { ws.mergeCells('A3:CB3'); } catch {}
    ws.getCell('A3').value = 'HIGHWAY AND TRANSPORTATION AUTHORITY';
    ws.getCell('A3').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell('A3').font = { name: 'Arial', size: 9, bold: false };

    for (let c = 1; c <= 80; c++) {
        ws.getCell(4, c).value = '';
    }

    try { ws.mergeCells('A5:CB5'); } catch {}
    ws.getCell('A5').value = 'ITEM CERTIFICATION WORKSHEET';
    ws.getCell('A5').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell('A5').font = { name: 'Arial', size: 10, bold: true };

    ws.getRow(1).height = 15;
    ws.getRow(2).height = 15;
    ws.getRow(3).height = 16;
    ws.getRow(4).height = 8;
    ws.getRow(5).height = 18;
}

const INSPECTOR_INCISOS = [
    { letter: 'a', row: 29, cell: 'N29' },
    { letter: 'b', row: 30, cell: 'N30' },
    { letter: 'c', row: 31, cell: 'N31' },
    { letter: 'd', row: 32, cell: 'N32' },
    { letter: 'e', row: 33, cell: 'N33' },
    { letter: 'f', row: 34, cell: 'N34' },
    { letter: 'g', row: 35, cell: 'N35' },
    { letter: 'h', row: 36, cell: 'N36' },
    { letter: 'i', row: 37, cell: 'N37' },
    { letter: 'j', row: 38, cell: 'N38' },
];

function fillDataRows(
    ws: ExcelJS.Worksheet,
    pageRows: CertExcelRow[],
    inspectorsList: string[] = []
) {
    for (let i = 0; i < ROWS_PER_PAGE; i++) {
        const excelRow = DATA_ROW_START + i;
        const dataRow = pageRows[i];

        if (!dataRow) {
            clearDataRow(ws, excelRow);
            continue;
        }

        const dateStr = formatDisplayDate(dataRow.inspDate);

        const locCell = ws.getCell(excelRow, 3);
        locCell.value = dataRow.location || '';
        locCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        locCell.font = { name: 'Arial', size: 9, bold: false };

        const calcCell = ws.getCell(excelRow, 28);
        calcCell.value = dataRow.calculations || '';
        calcCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        calcCell.font = { name: 'Arial', size: 9, bold: false };

        const qtyCell = ws.getCell(excelRow, 56);
        qtyCell.value = dataRow.quantity;
        qtyCell.alignment = { vertical: 'middle', horizontal: 'right' };
        qtyCell.numFmt = '#,##0.000';
        if (dataRow.isBlueQty) {
            qtyCell.font = { name: 'Arial', size: 9, color: { argb: 'FF0000FF' }, bold: false };
        } else {
            qtyCell.font = { name: 'Arial', size: 9, bold: false };
        }

        if (!dataRow.quantity || dataRow.quantity <= 0) {
            ws.getCell(excelRow, 62).value = '';
        } else {
            ws.getCell(excelRow, 62).value = {
                formula: `AO7*BD${excelRow}`,
                result: undefined,
            };
            ws.getCell(excelRow, 62).numFmt = '$#,##0.00';
            ws.getCell(excelRow, 62).font = { name: 'Arial', size: 9, bold: false };
            ws.getCell(excelRow, 62).alignment = { vertical: 'middle', horizontal: 'right' };
        }

        let inspLetter = '';
        const rawInsp = (dataRow.inspector || '').trim();
        if (rawInsp && inspectorsList.length > 0) {
            const idx = inspectorsList.findIndex(u => u.toLowerCase() === rawInsp.toLowerCase());
            if (idx >= 0 && idx < INSPECTOR_INCISOS.length) {
                inspLetter = INSPECTOR_INCISOS[idx].letter;
            } else {
                inspLetter = rawInsp;
            }
        } else if (inspectorsList.length > 0) {
            inspLetter = INSPECTOR_INCISOS[0].letter;
        }
        const inspCell = ws.getCell(excelRow, 69);
        inspCell.value = inspLetter;
        inspCell.alignment = { horizontal: 'center', vertical: 'middle' };
        inspCell.font = { name: 'Arial', size: 9, bold: false };

        const dateCell = ws.getCell(excelRow, 72);
        dateCell.value = dateStr;
        dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
        dateCell.font = { name: 'Arial', size: 9, bold: false };

        ws.getCell(excelRow, 76).value = '';
        ws.getRow(excelRow).height = 20;
    }
}

function clearDataRow(ws: ExcelJS.Worksheet, rowNum: number) {
    ws.getCell(rowNum, 3).value  = '';
    ws.getCell(rowNum, 28).value = '';
    ws.getCell(rowNum, 56).value = '';
    ws.getCell(rowNum, 62).value = '';
    ws.getCell(rowNum, 69).value = '';
    ws.getCell(rowNum, 72).value = '';
    ws.getCell(rowNum, 76).value = '';
    ws.getRow(rowNum).height = 18;
}

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
    const pageAmt = pageQty * unitPrice;

    try {
        if ((ws as any)._merges?.['BE30']) ws.unMergeCells('BE30:BI30');
    } catch {}
    try {
        ws.mergeCells('BD30:BI30');
    } catch {}

    try {
        if ((ws as any)._merges?.['BK30']) ws.unMergeCells('BK30:BP30');
    } catch {}
    try {
        ws.mergeCells('BJ30:BP30');
    } catch {}

    const totalLabelFont = { bold: true, size: 9, name: 'Arial' };
    const totalLabelAlign = { horizontal: 'center' as const, vertical: 'middle' as const, shrinkToFit: true };

    if (numPages <= 1) {
        ws.getCell('BD28').value = { formula: 'SUM(BD13:BD27)', result: totalItemQty };
        ws.getCell('BJ28').value = { formula: 'SUM(BJ13:BJ27)', result: totalItemAmt };

        ws.getCell('BD30').value = 'Total';
        ws.getCell('BD30').font = totalLabelFont;
        ws.getCell('BD30').alignment = totalLabelAlign;

        ws.getCell('BJ30').value = 'Total';
        ws.getCell('BJ30').font = totalLabelFont;
        ws.getCell('BJ30').alignment = totalLabelAlign;
    } else {
        const isLastPage = pageIdx === numPages - 1;

        if (!isLastPage) {
            ws.getCell('BD28').value = { formula: 'SUM(BD13:BD27)', result: pageQty };
            ws.getCell('BJ28').value = { formula: 'SUM(BJ13:BJ27)', result: pageAmt };

            ws.getCell('BD30').value = 'Sub-Total';
            ws.getCell('BD30').font = totalLabelFont;
            ws.getCell('BD30').alignment = totalLabelAlign;

            ws.getCell('BJ30').value = 'Sub-Total';
            ws.getCell('BJ30').font = totalLabelFont;
            ws.getCell('BJ30').alignment = totalLabelAlign;
        } else {
            const sumQtyFormula = itemSheetNames.map(s => `'${s}'!BD28`).join('+');
            const sumAmtFormula = itemSheetNames.map(s => `'${s}'!BJ28`).join('+');

            ws.getCell('BD28').value = { formula: sumQtyFormula, result: totalItemQty };
            ws.getCell('BJ28').value = { formula: sumAmtFormula, result: totalItemAmt };

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

function fillInspectorLegend(ws: ExcelJS.Worksheet, inspectors: string[]) {
    INSPECTOR_INCISOS.forEach(inc => {
        ws.getCell(inc.cell).value = '';
    });

    inspectors.forEach((name, idx) => {
        if (idx < INSPECTOR_INCISOS.length) {
            const cell = ws.getCell(INSPECTOR_INCISOS[idx].cell);
            cell.value = name;
            cell.alignment = { vertical: 'bottom', horizontal: 'left' };
            cell.font = { name: 'Arial', size: 9, bold: false };
        }
    });
}

function ensureTableBorders(ws: ExcelJS.Worksheet) {
    const borderMediumBlack = { style: 'medium' as const, color: { argb: 'FF000000' } };
    const borderThinBlack   = { style: 'thin' as const, color: { argb: 'FF000000' } };

    for (let c = 3; c <= 78; c++) {
        const c11 = ws.getCell(11, c);
        c11.border = { ...(c11.border || {}), top: borderMediumBlack };

        const c12 = ws.getCell(12, c);
        c12.border = { ...(c12.border || {}), bottom: borderMediumBlack };
    }

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

    ws.getCell(12, 71).border = { ...(ws.getCell(12, 71).border || {}), right: borderMediumBlack };
    ws.getCell(12, 72).border = { ...(ws.getCell(12, 72).border || {}), left: borderMediumBlack };
    ws.getCell(12, 75).border = { ...(ws.getCell(12, 75).border || {}), right: borderMediumBlack };
    ws.getCell(12, 76).border = { ...(ws.getCell(12, 76).border || {}), left: borderMediumBlack };

    const detailColsLeft = [3, 28, 56, 62, 69, 72, 76];
    const detailColsRight = [27, 55, 61, 68, 71, 75, 78];

    for (let r = DATA_ROW_START; r <= DATA_ROW_END; r++) {
        for (let c = 3; c <= 78; c++) {
            const cell = ws.getCell(r, c);
            cell.border = { ...(cell.border || {}), bottom: borderThinBlack };
        }

        detailColsLeft.forEach(c => {
            const cell = ws.getCell(r, c);
            cell.border = { ...(cell.border || {}), left: borderMediumBlack };
        });
        detailColsRight.forEach(c => {
            const cell = ws.getCell(r, c);
            cell.border = { ...(cell.border || {}), right: borderMediumBlack };
        });
    }

    for (let c = 56; c <= 78; c++) {
        const cell = ws.getCell(29, c);
        cell.border = { ...(cell.border || {}), bottom: borderMediumBlack };
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
