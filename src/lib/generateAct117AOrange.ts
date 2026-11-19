import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { supabase } from './supabase';
import { ACT117A_TEMPLATE_BASE64 } from './act117aTemplate';
import {
    extractItemFromSheetName,
    normalizeItemKey,
    findContractItemInDb,
    isContractInfo,
    isContractOrSummaryRow,
    isAct117AWorksheet,
    cleanPersonName,
    isTraineeItem2,
    isTraineeItem3,
    estimateTextLines,
    calculateNeededRowHeight,
    CertExcelRow,
    GenerateAct117AFromExcelResult
} from './generateAct117AFromExcel';

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

// Incisos de inspectores para la leyenda inferior (filas 29 a 38)
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

/**
 * Regla 14: Reglas Multi-Inspector por fecha
 * Cuando en una misma fecha existen registros de varios inspectores para la misma partida:
 *  - Caso A (todos iguales): Si dos o más inspectores tienen la misma cantidad aprobada,
 *    se registra únicamente al primer inspector con dicho valor y se omiten los duplicados.
 *  - Caso B (un valor se repite entre varios): Si un valor se repite entre varios inspectores
 *    pero no todos son iguales, se reporta únicamente el valor repetido (con el primer inspector que lo tiene).
 *  - Caso C (cantidades diferentes): Si todos los inspectores tienen cantidades distintas,
 *    se incluyen todos los renglones.
 */
export function applyMultiInspectorRulesByDate(rows: CertExcelRow[]): CertExcelRow[] {
    if (!rows || rows.length <= 1) return rows;

    // Agrupar filas por fecha normalizada de inspección
    const dateGroups: Record<string, CertExcelRow[]> = {};
    for (const r of rows) {
        const dKey = formatDisplayDate(r.inspDate) || '__nodate__';
        if (!dateGroups[dKey]) dateGroups[dKey] = [];
        dateGroups[dKey].push(r);
    }

    const resultRows: CertExcelRow[] = [];

    for (const dKey of Object.keys(dateGroups)) {
        const dateRows = dateGroups[dKey];
        if (dateRows.length <= 1) {
            resultRows.push(...dateRows);
            continue;
        }

        // Mapear cantidades redondeadas a 3 decimales
        const qtyCounts: Record<string, number> = {};
        for (const r of dateRows) {
            const qKey = (r.quantity ?? 0).toFixed(3);
            qtyCounts[qKey] = (qtyCounts[qKey] || 0) + 1;
        }

        const uniqueQtys = Object.keys(qtyCounts);

        if (uniqueQtys.length === 1) {
            // Caso A: Todos los inspectores tienen la misma cantidad aprobada
            // Se registra únicamente al primer inspector con dicho valor y se omiten los duplicados
            resultRows.push(dateRows[0]);
        } else {
            // Revisar si algún valor se repite entre varios (frecuencia >= 2)
            const repeatedQtys = uniqueQtys.filter(q => qtyCounts[q] >= 2);

            if (repeatedQtys.length > 0) {
                // Caso B: Un valor se repite entre varios inspectores pero no todos son iguales
                // Se reporta únicamente el valor repetido (con el primer inspector que lo tiene)
                // Si hubiera más de uno repetido, tomar el de mayor frecuencia (o el primero)
                repeatedQtys.sort((a, b) => qtyCounts[b] - qtyCounts[a]);
                const targetQtyKey = repeatedQtys[0];
                const firstWithRepeated = dateRows.find(r => (r.quantity ?? 0).toFixed(3) === targetQtyKey);
                if (firstWithRepeated) {
                    resultRows.push(firstWithRepeated);
                } else {
                    resultRows.push(dateRows[0]);
                }
            } else {
                // Caso C: Todas las cantidades son diferentes
                // Si todos los inspectores tienen cantidades distintas, se incluyen todos los renglones
                resultRows.push(...dateRows);
            }
        }
    }

    return resultRows;
}

/**
 * Función Principal para el BOTÓN ANARANJADO
 * Genera el reporte ICW (ACT-117A) aplicando estrictamente las 19 reglas requeridas.
 */
export async function generateAct117AOrange(
    certExcelFile: File | ArrayBuffer,
    projectId: string,
    customCertNum?: string | number,
    customCertDate?: string,
    selectedItems?: string[],
    selectedInspectors?: string[],
): Promise<GenerateAct117AFromExcelResult> {
    const errors: string[] = [];

    // Regla 1: Exclusividad de formato Excel (.xlsx / .xls)
    let rawBuffer: ArrayBuffer;
    if (certExcelFile instanceof File) {
        const lowerName = certExcelFile.name.toLowerCase();
        if (!lowerName.endsWith('.xlsx') && !lowerName.endsWith('.xls')) {
            throw new Error('Solo se admiten archivos Excel (.xlsx y .xls). Se descartó cualquier archivo PDF.');
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

    // Regla 5, 6 y 7: Extracción con prioridad absoluta a "Quantity Verified and Approved"
    const { allRows, certNumDetected, certDateDetected } = extractDataFromWorkbookOrange(certWb, errors);

    if (allRows.length === 0) {
        throw new Error('No se encontraron registros de certificación con cantidades válidas en el archivo Excel.');
    }

    // Regla 2: Número de Certificación obligatorio y con prioridad
    const finalCertNum = (customCertNum !== undefined && customCertNum !== null && String(customCertNum).trim() !== '')
        ? String(customCertNum).trim()
        : (certNumDetected || '');

    if (!finalCertNum) {
        throw new Error('El campo Número de Certificación (Cert. Num) es obligatorio.');
    }

    // Regla 3: Fecha de la Certificación personalizada (estampada en BW7:CB7)
    const finalCertDate = (customCertDate && customCertDate.trim() !== '')
        ? customCertDate.trim()
        : (certDateDetected || new Date().toISOString().split('T')[0]);

    // Regla 17: Datos de Proyecto desde la base de datos PACT
    const { data: projData, error: projErr } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

    if (projErr || !projData) {
        throw new Error('No se pudo encontrar el proyecto activo en la base de datos de PACT.');
    }

    const { data: contrData } = await supabase
        .from('contractors')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle();

    const contractorName = contrData?.name || projData?.contractor_name || projData?.contractor || '';

    // Catálogo del Contrato desde PACT
    const { data: contractItems } = await supabase
        .from('contract_items')
        .select('*')
        .eq('project_id', projectId);

    const itemsDbList = contractItems || [];

    // Regla 15: Leyenda inferior de Inspectores e Incisos (nombres únicos de inspectores)
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

    // Agrupar por partida
    const itemGroups: Record<string, CertExcelRow[]> = {};
    for (const row of allRows) {
        const key = row.itemNum;
        if (!itemGroups[key]) itemGroups[key] = [];
        itemGroups[key].push(row);
    }

    // Ordenar y aplicar Regla 14 (Multi-Inspector por fecha) a cada partida
    for (const key of Object.keys(itemGroups)) {
        itemGroups[key].sort((a, b) => {
            const da = parseDateForSort(a.inspDate);
            const db = parseDateForSort(b.inspDate);
            return da - db;
        });
        itemGroups[key] = applyMultiInspectorRulesByDate(itemGroups[key]);
    }

    const sortedItemKeys = Object.keys(itemGroups).sort((a, b) => {
        const na = parseFloat(a) || 0;
        const nb = parseFloat(b) || 0;
        return na - nb || a.localeCompare(b);
    });

    // Regla 4: Selector y filtro de partidas a generar
    let targetItemKeys = sortedItemKeys;
    if (Array.isArray(selectedItems) && selectedItems.length > 0) {
        const selNorm = new Set(selectedItems.map(s => normalizeItemKey(String(s))));
        targetItemKeys = sortedItemKeys.filter(k => {
            const rawRows = itemGroups[k] || [];
            const firstRow = rawRows[0];
            const matchedDbItem = findContractItemInDb(k, firstRow?.specCode, itemsDbList);
            const displayItemNo = matchedDbItem?.item_num || k;

            const nK = normalizeItemKey(k);
            const nDisp = normalizeItemKey(displayItemNo);
            const nSpec = firstRow?.specCode ? normalizeItemKey(firstRow.specCode) : '';
            const nDbSpec = matchedDbItem?.specification ? normalizeItemKey(matchedDbItem.specification) : '';

            return selNorm.has(nK) || selNorm.has(nDisp) || (nSpec && selNorm.has(nSpec)) || (nDbSpec && selNorm.has(nDbSpec));
        });

        if (targetItemKeys.length === 0) {
            throw new Error('Ninguna de las partidas seleccionadas tiene registros válidos en el archivo Excel.');
        }
    }

    // Cargar plantilla oficial ACT-117A
    const workbook = new ExcelJS.Workbook();
    const bufferTemplate = Buffer.from(ACT117A_TEMPLATE_BASE64, 'base64');
    await workbook.xlsx.load(bufferTemplate as any);

    const templateSheet = workbook.getWorksheet(1);
    if (!templateSheet) {
        throw new Error('La plantilla oficial ACT-117A no contiene hojas válidas.');
    }

    let firstSheetUsed = false;
    let itemsProcessedCount = 0;

    for (const itemKey of targetItemKeys) {
        const rawRows = itemGroups[itemKey] || [];
        if (rawRows.length === 0) continue;

        const firstRow = rawRows[0];
        const matchedDbItem = findContractItemInDb(itemKey, firstRow?.specCode, itemsDbList);

        const displayItemNo = matchedDbItem?.item_num || itemKey;
        const unitPrice = matchedDbItem ? (parseFloat(matchedDbItem.unit_price) || 0) : 0;
        const itemDesc = matchedDbItem?.description || firstRow?.itemName || '';
        const itemUnit = matchedDbItem?.unit || '';

        const isTrainee2 = isTraineeItem2(displayItemNo, firstRow?.specCode, itemDesc);
        const isTrainee3 = isTraineeItem3(displayItemNo, firstRow?.specCode, itemDesc);

        // Regla 6: Exclusión de cantidades e importes en cero
        const validRows = rawRows.filter(r => {
            const q = r.quantity;
            return q !== null && q !== undefined && !isNaN(q) && q > 0;
        });

        if (validRows.length === 0) {
            // Si una partida no tiene ningún registro con cantidad mayor a cero, no se genera hoja para ella
            continue;
        }

        // Asegurar fechas para cada fila
        for (const r of validRows) {
            if (!r.inspDate || r.inspDate.trim() === '' || r.inspDate === '__nodate__' || r.inspDate === '__certdate__') {
                r.inspDate = finalCertDate;
            }
        }

        itemsProcessedCount++;

        // Regla 18: Paginación (15 filas por página, 13 a 27)
        const pagedRows: CertExcelRow[][] = [];
        for (let i = 0; i < validRows.length; i += ROWS_PER_PAGE) {
            pagedRows.push(validRows.slice(i, i + ROWS_PER_PAGE));
        }

        const numPages = pagedRows.length;
        const totalItemQty = validRows.reduce((sum, r) => sum + (r.quantity || 0), 0);
        const totalItemAmt = totalItemQty * unitPrice;

        const itemSheetNames: string[] = [];
        for (let p = 0; p < numPages; p++) {
            itemSheetNames.push(buildSheetNameOrange(displayItemNo, p + 1, numPages));
        }

        for (let pageIdx = 0; pageIdx < numPages; pageIdx++) {
            const pageRows = pagedRows[pageIdx];
            const sheetName = itemSheetNames[pageIdx];
            let ws: ExcelJS.Worksheet;

            if (!firstSheetUsed) {
                ws = templateSheet;
                ws.name = sheetName;
                firstSheetUsed = true;
            } else {
                ws = workbook.addWorksheet(sheetName);
                await cloneSheetOrange(templateSheet, ws);
            }

            // Regla 16: Encabezado institucional oficial idéntico y limpio
            // Regla 17: Datos de Proyecto desde PACT
            fillHeaderOrange(ws, {
                projectName: projData.name || '',
                projectNum:  formatProjectNumberOrange(projData.num_act || ''),
                contractor:  contractorName,
                itemNum:     displayItemNo,
                unitPrice:   unitPrice,
                itemDesc:    itemDesc,
                itemUnit:    itemUnit,
                certNum:     finalCertNum,
                certDate:    finalCertDate,
                pageNum:     pageIdx + 1,
                totalPages:  numPages,
            });

            // Reglas 8, 9, 10, 11, 12, 13, 15: Filas de Detalle para el Botón Anaranjado
            fillDataRowsOrange(ws, pageRows, finalInspectors, finalCertDate, isTrainee2, isTrainee3, itemDesc);

            // Regla 18: Manejo de páginas y "Gran Total" sin cortes
            applyTotalsOrange(ws, {
                pageIdx,
                numPages,
                pageRows,
                unitPrice,
                totalItemQty,
                totalItemAmt,
                itemSheetNames,
            });

            // Regla 15: Leyenda inferior de Inspectores e Incisos (filas 29 a 38)
            fillInspectorLegendOrange(ws, finalInspectors);

            // Regla 19: Bordes continuos y alturas de fila ajustadas
            ensureTableBordersOrange(ws);

            // Formato de fuentes: todo en negro excepto columna Quantity (BD13:BD27) en AZUL
            applyOrangeFontColors(ws);
        }
    }

    if (itemsProcessedCount === 0) {
        throw new Error('Ninguna de las partidas seleccionadas tiene registros con cantidades mayores a cero.');
    }

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

/**
 * Llena las 15 filas de detalle (13 a 27) según las reglas del Botón Anaranjado:
 * - Regla 8: En Location (C13:C27), fecha de inspección formateada como MM/DD/YYYY.
 * - Regla 9: En References Date (BT72), completamente en blanco.
 * - Regla 10: En Calculations (AB13:AB27), nombre del inspector.
 * - Regla 11: En References Page (BX76), completamente vacía.
 * - Regla 12: En Amount (BJ13:BJ27), fórmula =AO7*BD{fila} con formato de moneda. En blanco si no hay valor.
 * - Regla 13: Cantidades en Quantity (BD13:BD27) en color AZUL.
 * - Regla 15: En Insp. (BQ69), letra minúscula del inciso (a, b, etc.).
 */
function fillDataRowsOrange(
    ws: ExcelJS.Worksheet,
    pageRows: CertExcelRow[],
    inspectorsList: string[] = [],
    certDate: string = '',
    isTrainee2: boolean = false,
    isTrainee3: boolean = false,
    itemDesc: string = ''
) {
    for (let i = 0; i < ROWS_PER_PAGE; i++) {
        const excelRow = DATA_ROW_START + i;
        const dataRow = pageRows[i];

        // Regla 6: Si no hay fila o cantidad <= 0, limpiar celdas
        if (!dataRow || dataRow.quantity === undefined || dataRow.quantity === null || isNaN(dataRow.quantity) || dataRow.quantity <= 0) {
            clearDataRowOrange(ws, excelRow);
            continue;
        }

        const rowDate = (dataRow.inspDate && dataRow.inspDate !== '__nodate__' && dataRow.inspDate !== '__certdate__')
            ? dataRow.inspDate
            : certDate;
        const dateStr = formatDisplayDate(rowDate);

        // Location (columna C, col 3): en blanco para el botón naranjado
        const locCell = ws.getCell(excelRow, 3);
        locCell.value = '';
        locCell.alignment = { vertical: 'middle', horizontal: 'center' };
        locCell.font = { name: 'Arial', size: 9, bold: false, color: { argb: 'FF000000' } };

        // Calculations (columna AB, col 28):
        //   - Items 2 y 3: descripción adicional (nombre de la persona)
        //   - Otros items: nombre del inspector
        const calcCell = ws.getCell(excelRow, 28);
        let calcValue = (dataRow.inspector || '').trim();
        if (isTrainee2 || isTrainee3) {
            // Descripción adicional para ítems 2 y 3
            const personName = dataRow.personName?.trim() || dataRow.inspector?.trim() || '';
            if (isTrainee3) {
                calcValue = personName ? `YPP Trainees Man Hour (${personName})` : (itemDesc || 'YPP Trainees Man Hour');
            } else {
                calcValue = personName ? `Trainees Man Hour (${personName})` : (itemDesc || 'Trainees Man Hour');
            }
        }
        calcCell.value = calcValue;
        calcCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        calcCell.font = { name: 'Arial', size: 9, bold: false, color: { argb: 'FF000000' } };

        // Quantity (columna BD, col 56): en NEGRITAS y color AZUL
        const qtyCell = ws.getCell(excelRow, 56);
        qtyCell.value = dataRow.quantity;
        qtyCell.alignment = { vertical: 'middle', horizontal: 'right' };
        qtyCell.numFmt = '#,##0.000';
        qtyCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0000FF' } }; // AZUL + NEGRITAS

        // Amount (columna BJ, col 62): fórmula =AO7*BD{fila}
        const amtCell = ws.getCell(excelRow, 62);
        amtCell.value = {
            formula: `AO7*BD${excelRow}`,
            result: undefined,
        };
        amtCell.numFmt = '$#,##0.00';
        amtCell.font = { name: 'Arial', size: 9, bold: false, color: { argb: 'FF000000' } };
        amtCell.alignment = { vertical: 'middle', horizontal: 'right' };

        // Insp. (columna BQ, col 69): SIEMPRE EN BLANCO
        const inspCell = ws.getCell(excelRow, 69);
        inspCell.value = '';
        inspCell.alignment = { horizontal: 'center', vertical: 'middle' };
        inspCell.font = { name: 'Arial', size: 9, bold: false, color: { argb: 'FF000000' } };

        // Date (columna BT, col 72): fecha en formato MM/DD/YY
        const dateCell = ws.getCell(excelRow, 72);
        dateCell.value = dateStr;
        dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
        dateCell.font = { name: 'Arial', size: 9, bold: false, color: { argb: 'FF000000' } };

        // Page (columna BX, col 76): vacía
        const pageRefCell = ws.getCell(excelRow, 76);
        pageRefCell.value = '';

        // Altura de fila adecuada
        ws.getRow(excelRow).height = 22;
    }

    // Asegurar que la columna BT (col 72) sea suficientemente ancha para MM/DD/YY
    const colBT = ws.getColumn(72);
    if (!colBT.width || colBT.width < 10) {
        colBT.width = 10;
    }
}

function clearDataRowOrange(ws: ExcelJS.Worksheet, rowNum: number) {
    ws.getCell(rowNum, 3).value  = ''; // Location
    ws.getCell(rowNum, 28).value = ''; // Calculations
    ws.getCell(rowNum, 56).value = ''; // Quantity
    ws.getCell(rowNum, 62).value = ''; // Amount
    ws.getCell(rowNum, 69).value = ''; // Insp.
    ws.getCell(rowNum, 72).value = ''; // Date (References)
    ws.getCell(rowNum, 76).value = ''; // Page (References)
    ws.getRow(rowNum).height = 22;
}

/**
 * Regla 16 y 17: Encabezado oficial y datos del proyecto
 */
function fillHeaderOrange(ws: ExcelJS.Worksheet, data: {
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
    // Encabezado institucional oficial limpio (A1:CB5)
    setupInstitutionalHeaderOrange(ws);

    const setHeaderCell = (coord: string, value: any, options: { bold?: boolean; numFmt?: string; align?: 'left' | 'center' | 'right'; size?: number } = {}) => {
        const cell = ws.getCell(coord);
        cell.value = value ?? '';
        cell.font = {
            name: 'Arial',
            size: options.size || 9,
            bold: !!options.bold,
            color: { argb: 'FF000000' }
        };
        if (options.numFmt) {
            cell.numFmt = options.numFmt;
        }
        cell.alignment = {
            vertical: 'middle',
            horizontal: options.align || 'left',
            wrapText: true
        };
    };

    setHeaderCell(TEMPLATE_CELLS.PROJECT_NAME, data.projectName, { bold: false, align: 'left' });
    setHeaderCell(TEMPLATE_CELLS.PROJECT_NUM,  data.projectNum,  { align: 'left' });
    setHeaderCell(TEMPLATE_CELLS.CONTRACTOR,   data.contractor,  { align: 'left' });
    setHeaderCell(TEMPLATE_CELLS.ITEM_NO,      data.itemNum,     { bold: true, align: 'center' });
    setHeaderCell(TEMPLATE_CELLS.UNIT_PRICE,   data.unitPrice,   { numFmt: '$#,##0.00', align: 'right' });
    setHeaderCell(TEMPLATE_CELLS.ITEM_DESC,    data.itemDesc,    { align: 'left' });
    setHeaderCell(TEMPLATE_CELLS.ITEM_UNIT,    data.itemUnit,    { align: 'center' });
    setHeaderCell(TEMPLATE_CELLS.CERT_NUM,     data.certNum,     { bold: true, align: 'center' });
    setHeaderCell(TEMPLATE_CELLS.CERT_DATE,    formatDisplayDate(data.certDate), { align: 'center' });
    setHeaderCell(TEMPLATE_CELLS.PAGE_OF_NUM,  data.pageNum,     { bold: true, align: 'center' });
    setHeaderCell(TEMPLATE_CELLS.TOTAL_PAGES,  data.totalPages,  { bold: true, align: 'center' });

    const pNameLen = (data.projectName || '').length;
    let r6Height = 26;
    if (pNameLen > 35) r6Height = 36;
    if (pNameLen > 70) r6Height = 48;
    ws.getRow(6).height = r6Height;
    ws.getRow(7).height = 20;

    const descLen = (data.itemDesc || '').length;
    ws.getRow(8).height = Math.max(22, Math.ceil(descLen / 45) * 16);
}

function setupInstitutionalHeaderOrange(ws: ExcelJS.Worksheet) {
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

/**
 * Regla 18: Manejo de páginas y "Gran Total" sin cortes
 */
function applyTotalsOrange(ws: ExcelJS.Worksheet, ctx: {
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

    const totalLabelFont = { bold: true, size: 9, name: 'Arial', color: { argb: 'FF000000' } };
    const totalLabelAlign = { horizontal: 'center' as const, vertical: 'middle' as const, shrinkToFit: true };
    const totalValFont = { bold: true, size: 9, name: 'Arial', color: { argb: 'FF000000' } };

    if (numPages <= 1) {
        ws.getCell('BD28').value = { formula: 'SUM(BD13:BD27)', result: totalItemQty };
        ws.getCell('BD28').font = totalValFont;
        ws.getCell('BJ28').value = { formula: 'SUM(BJ13:BJ27)', result: totalItemAmt };
        ws.getCell('BJ28').font = totalValFont;

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
            ws.getCell('BD28').font = totalValFont;
            ws.getCell('BJ28').value = { formula: 'SUM(BJ13:BJ27)', result: pageAmt };
            ws.getCell('BJ28').font = totalValFont;

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
            ws.getCell('BD28').font = totalValFont;
            ws.getCell('BJ28').value = { formula: sumAmtFormula, result: totalItemAmt };
            ws.getCell('BJ28').font = totalValFont;

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
 * Regla 15: Leyenda inferior de Inspectores e Incisos (filas 29 a 38)
 */
function fillInspectorLegendOrange(ws: ExcelJS.Worksheet, inspectors: string[]) {
    INSPECTOR_INCISOS.forEach(inc => {
        ws.getCell(inc.cell).value = '';
    });

    inspectors.forEach((name, idx) => {
        if (idx < INSPECTOR_INCISOS.length) {
            const cell = ws.getCell(INSPECTOR_INCISOS[idx].cell);
            cell.value = name;
            cell.alignment = { vertical: 'bottom', horizontal: 'left' };
            cell.font = { name: 'Arial', size: 9, bold: false, color: { argb: 'FF000000' } };
        }
    });
}

/**
 * Regla 19: Bordes continuos
 */
function ensureTableBordersOrange(ws: ExcelJS.Worksheet) {
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

/**
 * Aplica colores de fuente para el reporte anaranjado:
 * - Regla 13: Cantidades en columna Quantity (BD13:BD27) en color AZUL (FF0000FF).
 * - Todo el resto del documento en color NEGRO (FF000000).
 */
function applyOrangeFontColors(ws: ExcelJS.Worksheet) {
    ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
        row.eachCell({ includeEmpty: false }, (cell, colNum) => {
            // Si es la columna BD (56) entre las filas 13 y 27 y tiene valor numérico, mantener AZUL
            if (rowNum >= DATA_ROW_START && rowNum <= DATA_ROW_END && colNum === 56 && cell.value !== '' && cell.value !== null && cell.value !== undefined) {
                cell.font = {
                    ...(cell.font || {}),
                    name: 'Arial',
                    size: 9,
                    color: { argb: 'FF0000FF' }, // AZUL
                };
            } else {
                cell.font = {
                    ...(cell.font || {}),
                    color: { argb: 'FF000000' }, // NEGRO
                };
            }
        });
    });
}

// ─── Extracción de Datos del Libro con Prioridad a Quantity Verified and Approved ────

function extractDataFromWorkbookOrange(wb: XLSX.WorkBook, errors: string[]) {
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

        const { allRows: sheetRows, certNumDetected: sCertNum, certDateDetected: sCertDate } =
            extractDataFromExcelOrange(sheet, errors, sheetItemInfo || undefined);

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
    }

    return { allRows, certNumDetected, certDateDetected };
}

function extractDataFromExcelOrange(
    sheet: XLSX.WorkSheet,
    errors: string[],
    defaultItemInfo?: { itemNum: string; itemName?: string }
) {
    const rawMatrix: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (!rawMatrix || rawMatrix.length === 0) {
        return { allRows: [], certNumDetected: '', certDateDetected: '' };
    }

    // Saltar hojas que son la plantilla oficial ACT-117A (ya generadas)
    if (isAct117AWorksheet(sheet, rawMatrix)) {
        return { allRows: [], certNumDetected: '', certDateDetected: '' };
    }

    // Detectar formato de bloques con "Item Number:" (igual que el botón verde)
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
        return extractFromBlockFormatOrange(rawMatrix, errors, defaultItemInfo);
    }

    let certNumDetected = '';
    let certDateDetected = '';
    const fallbackItemNum = defaultItemInfo?.itemNum || '';

    // Escanear metadatos (Cert No, Fechas)
    for (const r of rawMatrix) {
        if (!r) continue;
        for (const cell of r) {
            const strVal = String(cell || '').trim();
            const lower = strVal.toLowerCase();
            if (!certNumDetected && lower.includes('cert') && (lower.includes('no') || lower.includes('num') || lower.includes('#'))) {
                const match = strVal.match(/\d+/);
                if (match) certNumDetected = match[0];
            }
        }
    }

    // Direct check en celdas estándar de ACT-117A
    const bw6Val = sheet['BW6']?.v ?? sheet['BQ6']?.v;
    if (bw6Val !== undefined && !certNumDetected) {
        const m = String(bw6Val).trim().match(/\d+/);
        if (m) certNumDetected = m[0];
    }
    const bw7Val = sheet['BW7']?.v ?? sheet['BQ7']?.v;
    if (bw7Val !== undefined && !certDateDetected) {
        const fd = formatRawDate(bw7Val);
        if (fd) certDateDetected = fd;
    }

    // Regla 5: Localizar fila de encabezados dando PRIORIDAD ABSOLUTA a "Quantity Verified and Approved"
    let headerRowIdx = -1;
    let colIndices: any = null;

    for (let r = 0; r < Math.min(rawMatrix.length, 35); r++) {
        const row = rawMatrix[r];
        if (!row || row.length === 0) continue;

        let foundApprovedCol: number | undefined = undefined;
        let foundMeasuredCol: number | undefined = undefined;
        let foundFallbackQtyCol: number | undefined = undefined;

        let foundItemNumCol: number | undefined = undefined;
        let foundInspectorCol: number | undefined = undefined;
        let foundDateCol: number | undefined = undefined;

        row.forEach((cellVal: any, cIdx: number) => {
            const orig = String(cellVal || '').trim();
            const lower = orig.toLowerCase();
            const norm = lower.replace(/[\s_\-\.:#/\\()&]/g, '');

            // Regla 5: Prioridad 1 -> Quantity Verified and Approved
            if (
                norm.includes('quantityverifiedandapproved') ||
                norm.includes('qtyverifiedandapproved') ||
                norm.includes('verifiedandapproved') ||
                norm.includes('verifiedapproved') ||
                norm.includes('qtyapproved') ||
                norm.includes('quantityapproved') ||
                norm.includes('approvedqty') ||
                norm.includes('approvedquantity') ||
                norm.includes('cantidadaprobada') ||
                norm.includes('cantaprobada')
            ) {
                foundApprovedCol = cIdx;
            }
            // Regla 5: Prioridad 2 -> Quantity Measured
            else if (
                norm.includes('quantitymeasured') ||
                norm.includes('qtymeasured') ||
                norm.includes('measuredqty') ||
                norm.includes('measuredquantity') ||
                norm.includes('cantidadmedida') ||
                norm.includes('cantmedida')
            ) {
                foundMeasuredCol = cIdx;
            }
            // Prioridad 3 -> Fallback genérico de cantidad
            else if (
                norm.includes('cantidad') ||
                norm.includes('quantity') ||
                norm.includes('qty') ||
                norm.includes('hours') ||
                norm.includes('horas') ||
                norm.includes('manhour')
            ) {
                if (foundFallbackQtyCol === undefined) {
                    foundFallbackQtyCol = cIdx;
                }
            }

            if (norm.includes('itemnumber') || norm.includes('itemno') || norm.includes('itemnum') || norm === 'item' || norm.startsWith('item') || norm.includes('partida')) {
                foundItemNumCol = cIdx;
            } else if (norm.includes('inspector') || norm.includes('insp') || norm.includes('inspeccionado')) {
                foundInspectorCol = cIdx;
            } else if (norm.includes('date') || norm.includes('fecha') || norm.includes('inspectiondate')) {
                foundDateCol = cIdx;
            }
        });

        // La columna definitiva de cantidad respeta la jerarquía de prioridad
        const chosenQtyCol = foundApprovedCol !== undefined
            ? foundApprovedCol
            : (foundMeasuredCol !== undefined ? foundMeasuredCol : foundFallbackQtyCol);

        if (chosenQtyCol !== undefined || (fallbackItemNum && foundDateCol !== undefined)) {
            headerRowIdx = r;
            colIndices = {
                itemNum: foundItemNumCol,
                quantity: chosenQtyCol,
                inspector: foundInspectorCol,
                inspDate: foundDateCol,
                _startRow: r + 1,
            };

            // Revisar si la fila siguiente (r+1) tiene sub-cabeceras (ej: Inspector o Fecha)
            if (r + 1 < rawMatrix.length) {
                const nextRow = rawMatrix[r + 1];
                nextRow.forEach((cellVal: any, cIdx: number) => {
                    const norm = String(cellVal || '').toLowerCase().replace(/[\s_\-\.:#/\\()&]/g, '');
                    if (colIndices.inspector === undefined && (norm.includes('inspector') || norm.includes('insp'))) {
                        colIndices.inspector = cIdx;
                    }
                    if (colIndices.inspDate === undefined && (norm.includes('date') || norm.includes('fecha'))) {
                        colIndices.inspDate = cIdx;
                    }
                });
            }

            break;
        }
    }

    if (headerRowIdx === -1 || !colIndices) {
        colIndices = {
            itemNum: undefined,
            quantity: undefined,
            inspector: undefined,
            inspDate: undefined,
            _startRow: 1,
        };
    }

    const allRows: CertExcelRow[] = [];
    const startRow = colIndices._startRow || 1;

    for (let i = startRow; i < rawMatrix.length; i++) {
        const row = rawMatrix[i];
        if (!row || row.length === 0) continue;

        // Regla 7: Omitir filas de resumen / totales del archivo de origen
        if (isContractOrSummaryRow(row)) {
            continue;
        }

        let itemNumRaw = fallbackItemNum;
        if (colIndices.itemNum !== undefined && row[colIndices.itemNum] !== undefined && String(row[colIndices.itemNum]).trim() !== '') {
            itemNumRaw = String(row[colIndices.itemNum]).trim();
        }
        if (!itemNumRaw) continue;

        let qty: number = 0;
        if (colIndices.quantity !== undefined && row[colIndices.quantity] !== undefined && row[colIndices.quantity] !== '') {
            const valStr = String(row[colIndices.quantity]).replace(/,/g, '').trim();
            qty = parseFloat(valStr);
        } else {
            for (let c = 0; c < row.length; c++) {
                if (c === colIndices.itemNum) continue;
                const cellStr = String(row[c] || '').replace(/,/g, '').trim();
                const cand = parseFloat(cellStr);
                if (!isNaN(cand) && cand > 0 && !cellStr.includes('/') && !cellStr.includes('-') && !cellStr.includes(':')) {
                    qty = cand;
                    break;
                }
            }
        }

        // Regla 6: Exclusión de cantidades e importes en cero o negativos
        if (isNaN(qty) || qty <= 0) {
            continue;
        }

        // Excluir filas de TOTAL/SUBTOTAL: filas sin fecha y sin inspector (filas acumuladas en negritas)
        const hasDate = colIndices.inspDate !== undefined && row[colIndices.inspDate] !== undefined && String(row[colIndices.inspDate] || '').trim() !== '';
        const hasInspector = colIndices.inspector !== undefined && row[colIndices.inspector] !== undefined && String(row[colIndices.inspector] || '').trim() !== '';
        const hasStatus = row.some((cell: any, cIdx: number) => {
            if (cIdx === colIndices.quantity || cIdx === colIndices.itemNum) return false;
            const val = String(cell || '').toLowerCase().trim();
            return val === 'submitted' || val === 'approved' || val === 'pending' || val === 'rejected';
        });
        // Si no tiene fecha, no tiene inspector, y no tiene STATUS → es fila de total → excluir
        if (!hasDate && !hasInspector && !hasStatus) {
            continue;
        }

        const inspDateRaw = colIndices.inspDate !== undefined ? row[colIndices.inspDate] : '';
        let formattedDate = formatRawDate(inspDateRaw);
        if (!formattedDate) {
            formattedDate = certDateDetected || '__certdate__';
        }

        const inspectorRaw = colIndices.inspector !== undefined ? String(row[colIndices.inspector] || '').trim() : '';

        allRows.push({
            itemNum: itemNumRaw,
            specCode: itemNumRaw,
            itemName: defaultItemInfo?.itemName,
            location: formattedDate, // En el botón anaranjado, location lleva la fecha de inspección
            calculations: inspectorRaw, // En el botón anaranjado, calculations lleva el nombre del inspector
            quantity: qty,
            inspector: inspectorRaw,
            inspDate: formattedDate,
            isBlueQty: true,
        });
    }

    if (!certDateDetected && allRows.length > 0) {
        const dates = allRows.map(r => r.inspDate).filter(d => d && d !== '__certdate__').sort().reverse();
        if (dates.length > 0) certDateDetected = dates[0];
    }

    return { allRows, certNumDetected, certDateDetected };
}

// ─── Funciones Auxiliares ───────────────────────────────────────────────────

function buildSheetNameOrange(itemNo: string, pageNum: number, totalPages: number): string {
    const cleanNo = itemNo.replace(/^0+/, '').trim() || itemNo.trim();
    if (totalPages <= 1) {
        return `Item ${cleanNo}`.substring(0, 31);
    }
    return `Item ${cleanNo} (${pageNum})`.substring(0, 31);
}

function formatProjectNumberOrange(numAct: string): string {
    if (!numAct) return '';
    if (numAct.match(/^AC-/i)) return numAct.toUpperCase();
    const digits = numAct.replace(/\D/g, '');
    return `AC-${digits}`;
}

function formatRawDate(raw: any): string | null {
    if (!raw) return null;
    if (raw instanceof Date) {
        if (!isNaN(raw.getTime())) return raw.toISOString().split('T')[0];
        return null;
    }
    const str = String(raw).trim();
    const mIso = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (mIso) {
        return `${mIso[1]}-${mIso[2].padStart(2, '0')}-${mIso[3].padStart(2, '0')}`;
    }
    const mUs = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
    if (mUs) {
        let yr = mUs[3];
        if (yr.length === 2) yr = '20' + yr;
        return `${yr}-${mUs[1].padStart(2, '0')}-${mUs[2].padStart(2, '0')}`;
    }
    return null;
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
        const yy = String(d.getFullYear()).slice(-2); // formato MM/DD/YY (2 dígitos año)
        return `${mm}/${dd}/${yy}`;
    } catch {
        return dateStr;
    }
}

function parseDateForSort(dateStr: string): number {
    if (!dateStr) return 0;
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.getTime();

    const parts = dateStr.split('/');
    if (parts.length === 3) {
        const pd = new Date(`${parts[2]}-${parts[0]}-${parts[1]}`);
        if (!isNaN(pd.getTime())) return pd.getTime();
    }
    return 0;
}

async function cloneSheetOrange(source: ExcelJS.Worksheet, target: ExcelJS.Worksheet) {
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

/**
 * Extrae datos de un Excel con formato de bloques "Item Number:" para el botón naranjado.
 * Reutiliza la misma lógica de detección de columnas que el formato tabular naranjado.
 */
function extractFromBlockFormatOrange(
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
                        if (nextV) { specVal = nextV; break; }
                    }
                }
                if (specVal) foundSpecInRow = specVal;
            }

            if (lower.includes('item name:')) {
                let nameVal = cellVal.replace(/item\s*name\s*:\s*/i, '').trim();
                if (!nameVal) {
                    for (let nextC = c + 1; nextC < row.length; nextC++) {
                        const nextV = String(row[nextC] || '').trim();
                        if (nextV) { nameVal = nextV; break; }
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
            const rowStr = row.map((c: any) => String(c).toLowerCase()).join(' ');

            // Detectar fila de cabecera de tabla
            if (
                rowStr.includes('record no') ||
                (rowStr.includes('inspector') && (rowStr.includes('quantity') || rowStr.includes('date') || rowStr.includes('cantidad') || rowStr.includes('hours') || rowStr.includes('horas'))) ||
                rowStr.includes('quantity verified') ||
                rowStr.includes('qty verified')
            ) {
                headerIndices = {} as any;
                row.forEach((colVal: any, colIdx: number) => {
                    const norm = String(colVal || '').toLowerCase().replace(/[\s_\-\.:#/\\()&]/g, '');
                    // Prioridad 1: Quantity Verified and Approved
                    if (norm.includes('quantityverifiedandapproved') || norm.includes('verifiedandapproved') || norm.includes('verifiedapproved') || norm.includes('qtyapproved') || norm.includes('quantityapproved') || norm.includes('approvedqty')) {
                        headerIndices.qtyApproved = colIdx;
                    } else if (norm.includes('quantitymeasured') || norm.includes('qtymeasured') || norm.includes('measuredqty')) {
                        headerIndices.qtyMeasured = colIdx;
                    } else if (norm === 'cantidad' || norm.startsWith('cantidad') || norm === 'quantity' || norm.startsWith('quantity') || norm.includes('hours') || norm.includes('horas') || norm.includes('manhour')) {
                        if (headerIndices.qtyCantidad === undefined) headerIndices.qtyCantidad = colIdx;
                    } else if (norm.includes('inspector') || norm.includes('insp')) {
                        headerIndices.inspector = colIdx;
                    } else if (norm.includes('inspectiondate') || norm.includes('date') || norm.includes('fecha')) {
                        headerIndices.inspDate = colIdx;
                    }
                });
                continue;
            }

            if (headerIndices && currentSpec) {
                if (isContractOrSummaryRow(row)) continue;

                // Columna de cantidad con jerarquía: Approved > Measured > Fallback
                const qtyCol = headerIndices.qtyApproved !== undefined
                    ? headerIndices.qtyApproved
                    : (headerIndices.qtyMeasured !== undefined ? headerIndices.qtyMeasured : headerIndices.qtyCantidad);

                let qty = 0;
                if (qtyCol !== undefined && row[qtyCol] !== undefined && row[qtyCol] !== '') {
                    const valStr = String(row[qtyCol]).replace(/,/g, '').trim();
                    qty = parseFloat(valStr);
                } else {
                    // Fallback: buscar primer número positivo en la fila
                    for (let c = 0; c < row.length; c++) {
                        const cellStr = String(row[c] || '').replace(/,/g, '').trim();
                        const cand = parseFloat(cellStr);
                        if (!isNaN(cand) && cand > 0 && !cellStr.includes('/') && !cellStr.includes('-') && !cellStr.includes(':')) {
                            qty = cand;
                            break;
                        }
                    }
                }

                if (isNaN(qty) || qty <= 0) continue;

                const inspDateRaw = headerIndices.inspDate !== undefined ? row[headerIndices.inspDate] : '';
                const formattedDate = formatRawDate(inspDateRaw) || certDateDetected || '__certdate__';
                const inspectorRaw = headerIndices.inspector !== undefined ? String(row[headerIndices.inspector] || '').trim() : '';

                allRows.push({
                    itemNum: currentSpec,
                    specCode: currentSpec,
                    itemName: currentItemName || undefined,
                    location: formattedDate,
                    calculations: inspectorRaw,
                    quantity: qty,
                    inspector: inspectorRaw,
                    inspDate: formattedDate,
                    isBlueQty: true,
                });
            }
        }
    }

    if (!certDateDetected && allRows.length > 0) {
        const dates = allRows.map(r => r.inspDate).filter(d => d && d !== '__certdate__').sort().reverse();
        if (dates.length > 0) certDateDetected = dates[0];
    }

    return { allRows, certNumDetected, certDateDetected };
}
