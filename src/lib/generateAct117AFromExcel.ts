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
    personName?: string;  // Nombre de persona/trainee detectado
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

    // Descartar hojas de resumen general aunque lleven la palabra "item"
    if (['resumen', 'summary', 'total', 'totales', 'general', 'indice', 'index'].some(w => lower === w || lower.startsWith(w + ' '))) {
        return null;
    }
    if (['item summary', 'items summary', 'summary items', 'resumen items', 'total items', 'resumen de cantidades'].includes(lower)) {
        return null;
    }

    // Detección directa de Trainees (Items 2 y 3)
    if (lower.includes('ypp') || (lower.includes('trainee') && (lower.includes('3') || lower.includes('derek') || lower.includes('153')))) {
        return { itemNum: '3', itemName: 'YPP Trainees Man Hour' };
    }
    if (lower.includes('trainee') || lower.includes('ivonne') || lower.includes('152')) {
        return { itemNum: '2', itemName: 'Trainees Man Hour' };
    }

    // 1. "Item 7 - Borrow Class D" / "Item 603(1)" / "Item 6" / "Item 008 - Foundation Fill" / "Item 11" / "Item-10" / "Partida 2"
    const matchPrefix = s.match(/^(?:item|partida)[\s\.\-_:]*([a-zA-Z0-9\-\.\_\(\)]+)(?:\s*[\-\:–—\s]\s*(.*))?$/i);
    if (matchPrefix) {
        return {
            itemNum: matchPrefix[1].trim(),
            itemName: matchPrefix[2] ? matchPrefix[2].trim() : undefined,
        };
    }

    // 2. Si empieza por número seguido de guión o descripción: "2 - Trainees", "3 - YPP", "10 - Asfalto", "008 - Foundation Fill"
    const matchNumStart = s.match(/^(\d+[a-zA-Z0-9\-\.\_\(\)]*)\s*[\-\:–—]\s*(.*)$/);
    if (matchNumStart) {
        return {
            itemNum: matchNumStart[1].trim(),
            itemName: matchNumStart[2] ? matchNumStart[2].trim() : undefined,
        };
    }

    // 3. Si el nombre de la hoja es puramente un número de partida: "2", "3", "10", "603(1)"
    if (/^\d+[a-zA-Z0-9\-\.\_\(\)]*$/.test(s)) {
        return {
            itemNum: s,
            itemName: undefined,
        };
    }

    // 4. Si la palabra "Item" o "Partida" está en otra posición del nombre (ej: "Proyecto Item 10 - Asfalto")
    const matchAnywhere = s.match(/(?:item|partida)[\s\.\-_:]*([a-zA-Z0-9\-\.\_\(\)]+)(?:\s*[\-\:–—\s]\s*(.*))?$/i);
    if (matchAnywhere) {
        return {
            itemNum: matchAnywhere[1].trim(),
            itemName: matchAnywhere[2] ? matchAnywhere[2].trim() : undefined,
        };
    }

    // 5. Si tiene la palabra "Item" o "Partida" pero con texto continuo
    if (lower.includes('item') || lower.includes('partida')) {
        const cleaned = s.replace(/item|partida/gi, '').trim().replace(/^[\-\:–—\s]+/, '');
        return {
            itemNum: cleaned || s,
            itemName: cleaned || undefined,
        };
    }

    return null;
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
    // Si una hoja tiene nombre de ítem válido pero no se extrajeron datos, intentar una segunda pasada
    // con extracción más flexible para partidas como Trainees (Items 2 y 3)
    for (const sh of sheetItemsDetected) {
        if (!itemGroups[sh.itemNum] || itemGroups[sh.itemNum].length === 0) {
            // Intentar extraer datos con lógica flexible antes de crear placeholder
            const sheetData = certWb.Sheets[sh.sheetName];
            if (sheetData) {
                const flexRows = extractFlexibleQuantities(sheetData, sh.itemNum, sh.itemName);
                if (flexRows.length > 0) {
                    itemGroups[sh.itemNum] = flexRows;
                } else {
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
            } else {
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
                if (isNaN(q) || q <= 0) return false;
                if (isContractInfo(`${r.location} ${r.calculations}`) || isContractOrSummaryRow([r.location, r.calculations])) return false;
                return true;
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
            const na = parseFloat(a.itemNum || '') || 0;
            const nb = parseFloat(b.itemNum || '') || 0;
            return na - nb || (a.itemNum || '').localeCompare(b.itemNum || '');
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
                    if (isNaN(q) || q <= 0) return false;
                    if (isContractInfo(`${r.location} ${r.calculations}`) || isContractOrSummaryRow([r.location, r.calculations])) return false;
                    return true;
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

    // 5b. Para partidas detectadas en nombres de hojas que no tienen datos válidos,
    // intentar extracción flexible (especialmente para Trainees Items 2 y 3)
    const sheetItemsDetectedGen: { itemNum: string; itemName?: string; sheetName: string }[] = [];
    for (const sheetName of certWb.SheetNames) {
        const sheetItemInfo = extractItemFromSheetName(sheetName);
        if (sheetItemInfo) {
            sheetItemsDetectedGen.push({ ...sheetItemInfo, sheetName });
        }
    }
    for (const sh of sheetItemsDetectedGen) {
        const existing = itemGroups[sh.itemNum] || [];
        const hasValidData = existing.some(r => {
            const q = r.quantity;
            return q !== null && q !== undefined && !isNaN(q) && q > 0;
        });
        if (!hasValidData) {
            const sheetData = certWb.Sheets[sh.sheetName];
            if (sheetData) {
                const flexRows = extractFlexibleQuantities(sheetData, sh.itemNum, sh.itemName, finalCertDate);
                if (flexRows.length > 0) {
                    const consolidatedFlex = applyDateInspectorRules(flexRows);
                    itemGroups[sh.itemNum] = consolidatedFlex;
                }
            }
        }
    }

    const sortedItemKeys = Object.keys(itemGroups).sort((a, b) => {
        const na = parseFloat(a) || 0;
        const nb = parseFloat(b) || 0;
        return na - nb || a.localeCompare(b);
    });

    // Regla 4: Selector de Partidas - El sistema solo generará las partidas seleccionadas
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

    // ── Constantes para la regla de 3 meses ─────────────────────────────────────
    const certDateMs = finalCertDate ? new Date(finalCertDate).getTime() : NaN;
    const THREE_MONTHS_MS = 3 * 30 * 24 * 60 * 60 * 1000; // 90 días exactos de 24h

    for (const itemKey of targetItemKeys) {
        const rawRows = itemGroups[itemKey];
        const firstRow = rawRows[0];

        // Vincular con la base de datos PACT
        const matchedDbItem = findContractItemInDb(itemKey, firstRow?.specCode, itemsDbList);

        const displayItemNo = matchedDbItem?.item_num || itemKey;
        const unitPrice = matchedDbItem ? (parseFloat(matchedDbItem.unit_price) || 0) : 0;
        const itemDesc = matchedDbItem?.description || firstRow?.itemName || '';
        const itemUnit = matchedDbItem?.unit || '';

        // Para partidas de Trainees (Items 2 y 3)
        const isTrainee2Check = isTraineeItem2(itemKey, firstRow?.specCode, itemDesc);
        const isTrainee3Check = isTraineeItem3(itemKey, firstRow?.specCode, itemDesc);

        // Regla 10: Exclusión de Cantidades en Cero y Exclusión de Valores/Filas del Contrato
        // Solo incluye registros que tengan cantidades (> 0). Si falta la fecha, asignarle la fecha oficial de certificación
        // Regla usuario: No incluir cantidades con fecha que tengan más de 3 meses (90 días de 24h)
        //   de diferencia respecto a la fecha de certificación (en las filas 13 a 27 de la forma ACT-117A)
        const filteredRows = rawRows.filter(r => {
            const q = r.quantity;
            if (q === null || q === undefined || isNaN(q) || q <= 0) return false;
            if (!r.inspDate || r.inspDate.trim() === '' || r.inspDate === '__nodate__' || r.inspDate === '__certdate__') {
                r.inspDate = finalCertDate;
            }
            const textCheck = `${r.location} ${r.calculations} ${r.itemName || ''}`;
            if (isContractInfo(textCheck) || isContractOrSummaryRow([r.location, r.calculations, r.itemName])) {
                return false;
            }
            // Excluir registros cuya fecha de inspección difiera más de 3 meses (90 días de 24h) de la fecha de certificación
            if (!isNaN(certDateMs) && r.inspDate && r.inspDate !== '__certdate__' && r.inspDate !== '__nodate__') {
                const rowDateMs = new Date(r.inspDate).getTime();
                if (!isNaN(rowDateMs)) {
                    const diffMs = Math.abs(certDateMs - rowDateMs);
                    if (diffMs > THREE_MONTHS_MS) {
                        return false;
                    }
                }
            }
            return true;
        });

        // Para partidas de Trainees (Items 2 y 3), si no hay filas válidas, crear una fila placeholder
        // con la fecha de certificación para que siempre aparezca la hoja en el reporte
        let validRows = filteredRows;

        if (validRows.length === 0) {
            if (isTrainee2Check || isTrainee3Check) {
                // Buscar si hay alguna fila con cantidad > 0 sin restricción de fecha
                const anyRow = rawRows.find(r => {
                    const q = r.quantity;
                    return q !== null && q !== undefined && !isNaN(q) && q > 0;
                });
                if (anyRow) {
                    // Hay datos pero quedaron fuera por la regla de 3 meses;
                    // generar hoja con placeholder (la fila se mostrará vacía en las celdas 13-27)
                    validRows = [{
                        ...anyRow,
                        quantity: 0,
                        inspDate: finalCertDate,
                        location: isTrainee3Check
                            ? `YPP Trainees Man Hour (Derek Figueroa Rosado)`
                            : `Trainees Man Hour (Ivonne Rosado Rosario)`,
                    }];
                } else {
                    // No hay ningún dato en absoluto; crear placeholder vacío para que aparezca la hoja
                    validRows = [{
                        itemNum: itemKey,
                        specCode: itemKey,
                        itemName: itemDesc || (isTrainee3Check ? 'YPP Trainees Man Hour' : 'Trainees Man Hour'),
                        location: isTrainee3Check
                            ? `YPP Trainees Man Hour (Derek Figueroa Rosado)`
                            : `Trainees Man Hour (Ivonne Rosado Rosario)`,
                        calculations: '',
                        quantity: 0,
                        inspector: '',
                        inspDate: finalCertDate,
                        isBlueQty: true,
                    }];
                }
            } else {
                continue;
            }
        }

        const isTrainee2 = isTraineeItem2(displayItemNo, firstRow?.specCode || matchedDbItem?.specification, itemDesc);
        const isTrainee3 = isTraineeItem3(displayItemNo, firstRow?.specCode || matchedDbItem?.specification, itemDesc);

        // En los items 2 y 3, en localización además de lo que ya pones, entre paréntesis, incluye el nombre de la persona
        if (isTrainee2 || isTrainee3) {
            const defaultName = isTrainee2 ? 'Ivonne Rosado Rosario' : 'Derek Figueroa Rosado';

            let itemPersonDetected = '';
            for (const r of validRows) {
                const cand = cleanPersonName(r.personName || '') ||
                             cleanPersonName(r.inspector || '') ||
                             cleanPersonName(r.calculations || '') ||
                             cleanPersonName(r.location || '');
                if (cand) {
                    itemPersonDetected = cand;
                    break;
                }
            }
            if (!itemPersonDetected) {
                itemPersonDetected = cleanPersonName(firstRow?.itemName || '');
            }

            const assignedPerson = itemPersonDetected || defaultName;

            for (const r of validRows) {
                const rowPerson = cleanPersonName(r.personName || '') ||
                                  cleanPersonName(r.inspector || '') ||
                                  cleanPersonName(r.calculations || '') ||
                                  cleanPersonName(r.location || '') ||
                                  assignedPerson;

                if (isTrainee2) {
                    r.location = `Trainees Man Hour (${rowPerson})`;
                } else if (isTrainee3) {
                    r.location = `YPP Trainees Man Hour (${rowPerson})`;
                }
            }
        }

        itemsProcessedCount++;

        // Regla: Paginación Inteligente para no cortar renglones y usar las páginas necesarias
        const pagedRows = paginateItemRows(validRows);
        const numPages = pagedRows.length;

        const totalItemQty = validRows.reduce((sum, r) => sum + (r.quantity || 0), 0);
        const totalItemAmt = totalItemQty * unitPrice;

        const itemSheetNames: string[] = [];
        for (let p = 0; p < numPages; p++) {
            itemSheetNames.push(buildSheetName(displayItemNo, p + 1, numPages));
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
                await cloneSheet(templateSheet, ws);
            }

            // Regla 14: Encabezado Institucional Oficial y Regla 15: Datos de Proyecto
            fillHeader(ws, {
                projectName: projData.name || '',
                projectNum:  formatProjectNumber(projData.num_act || ''),
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

            // Reglas 5, 6, 7, 8, 9, 12: Filas de Detalle
            fillDataRows(ws, pageRows, finalInspectors, isTrainee2, isTrainee3, finalCertDate);

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

            // Regla del usuario: pintar de negro todos los caracteres que salgan en las ICW
            applyAllBlackFont(ws);
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

    // Si ya se obtuvo la localización directamente de la columna del Excel, mantenerla íntegra
    if (loc && !calc) {
        return { location: loc, calculations: '' };
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

// ─── Verificador de Información del Contrato y Nombres de Trainees ─────────

/**
 * Detecta si un texto contiene información o datos del contrato
 * (ej: "Contract: 13,390 LNM | Unit Price: $74.00 | Total: $990,860.00 | Certificación #16 - Octubre 2026")
 * para excluirlo por completo de las filas de detalle (13 a 28) del ACT-117A.
 */
export function isContractInfo(text: string): boolean {
    if (!text) return false;
    const lower = text.toLowerCase().trim();

    if (
        lower.includes('contract:') ||
        lower.includes('contrato:') ||
        lower.includes('unit price') ||
        lower.includes('precio unitario') ||
        lower.includes('certificación #') ||
        lower.includes('certificacion #') ||
        lower.includes('cert #') ||
        lower.includes('cert. #') ||
        lower.includes('certificación no') ||
        lower.includes('certificacion no') ||
        lower.includes('cert no') ||
        lower.includes('contract quantity') ||
        lower.includes('contract amount') ||
        lower.includes('contract value') ||
        lower.includes('contract item') ||
        lower.includes('original contract') ||
        lower.includes('cantidad contrato') ||
        lower.includes('cantidad de contrato') ||
        lower.includes('monto contrato') ||
        lower.includes('monto del contrato') ||
        lower.includes('valor contrato') ||
        lower.includes('contrato original') ||
        lower.includes('presupuesto') ||
        lower.includes('budget') ||
        lower.includes('planos mensura') ||
        lower.includes('material en sitio') ||
        lower.startsWith('contract ') ||
        lower.startsWith('contrato ') ||
        lower === 'contract' ||
        lower === 'contrato'
    ) {
        return true;
    }

    return false;
}

/**
 * Determina si una fila del Excel representa totales, balances o datos del contrato
 * (ej: "Contract", "Contrato", "Contract Quantity", "Original Contract", "Contract Amount", etc.)
 * para IGNORARLA y que nunca se transfiera a las tablas de detalle del ACT-117A.
 */
export function isContractOrSummaryRow(rowCells: any[]): boolean {
    if (!rowCells || rowCells.length === 0) return false;
    const rowStr = rowCells.map(c => String(c || '').toLowerCase().trim()).join(' ');

    // 1. Información del contrato
    if (isContractInfo(rowStr)) {
        return true;
    }

    // 2. Proteger partidas y registros de trainees de ser descartados por palabras comunes como "total"
    const isTraineeContent = rowStr.includes('trainee') || rowStr.includes('ypp') ||
        rowStr.includes('rosado') || rowStr.includes('figueroa') ||
        rowStr.includes('ivonne') || rowStr.includes('derek') ||
        rowStr.includes('man hour') || rowStr.includes('manhour');
    if (isTraineeContent) {
        return false;
    }

    // 3. Totales y resúmenes explícitos a nivel de fila completa
    for (const c of rowCells) {
        const val = String(c || '').toLowerCase().trim();
        if (
            val === 'total' ||
            val === 'subtotal' ||
            val === 'sub-total' ||
            val === 'grand total' ||
            val === 'gran total' ||
            val === 'balance' ||
            val === 'balance del contrato' ||
            val === 'resumen' ||
            val === 'summary'
        ) {
            return true;
        }
    }

    if (
        rowStr.includes('grand total') ||
        rowStr.includes('gran total') ||
        rowStr.includes('total general') ||
        rowStr.includes('balance del contrato') ||
        rowStr.includes('total de certificación') ||
        rowStr.includes('contract total') ||
        rowStr.includes('balance pendiente')
    ) {
        return true;
    }

    return false;
}

/**
 * Identifica si una partida corresponde al Item 2 (Trainees Man Hour)
 */
export function isTraineeItem2(itemNum: string, specCode?: string, itemDesc?: string): boolean {
    const cleanNum = String(itemNum || '').replace(/^item\s*/i, '').replace(/^0+/, '').trim();
    if (cleanNum === '2') return true;
    if (specCode && (specCode.includes('152-001') || specCode.includes('152'))) return true;
    const desc = `${itemDesc || ''}`.toLowerCase();
    if (desc.includes('trainee') && !desc.includes('ypp') && !desc.includes('abriendo')) return true;
    return false;
}

/**
 * Identifica si una partida corresponde al Item 3 (YPP Trainees Man Hour)
 */
export function isTraineeItem3(itemNum: string, specCode?: string, itemDesc?: string): boolean {
    const cleanNum = String(itemNum || '').replace(/^item\s*/i, '').replace(/^0+/, '').trim();
    if (cleanNum === '3') return true;
    if (specCode && (specCode.includes('153-001') || specCode.includes('153'))) return true;
    const desc = `${itemDesc || ''}`.toLowerCase();
    if (desc.includes('ypp')) return true;
    return false;
}

/**
 * Limpia y valida el nombre de la persona para los items de trainees (Items 2 y 3)
 */
export function cleanPersonName(raw: string): string {
    if (!raw) return '';
    let s = raw.trim();

    // Si viene entre paréntesis: (Ivonne Rosado Rosario)
    const mParen = s.match(/\(([A-Za-zÀ-ÿ\s\.\-\']+)\)/);
    if (mParen && mParen[1] && mParen[1].trim().length > 2) {
        s = mParen[1].trim();
    } else {
        // Si no tiene paréntesis pero tiene prefijo como "Trainee:" o "Nombre:"
        const prefixMatch = s.match(/^(?:trainee|trainees|nombre|name|student|empleado|persona|inspector)[\s\:\-]+(.+)$/i);
        if (prefixMatch && prefixMatch[1]) {
            s = prefixMatch[1].trim();
        }
    }

    // Quitar comillas
    s = s.replace(/["'«»]/g, '').trim();

    // Si contiene números o datos de contrato, no es un nombre de persona
    if (/\d/.test(s)) return '';
    if (isContractInfo(s)) return '';

    const lower = s.toLowerCase();
    if (
        lower === 'trainees man hour' ||
        lower === 'ypp trainees man hour' ||
        lower === 'ypp - trainees man hour' ||
        lower === 'ypp' ||
        lower === 'trainee' ||
        lower === 'trainees' ||
        lower === 'man hour' ||
        lower === 'man hours' ||
        lower === 'horas' ||
        lower === 'hours' ||
        lower === 'total' ||
        lower === 'subtotal' ||
        lower === 'n/a' ||
        lower.length < 3
    ) {
        return '';
    }

    return s;
}

// ─── Identificadores de Encabezados de Columna (Location / Calculations) ──────

/**
 * Identifica si un encabezado de columna corresponde a la columna de localización/trabajos.
 * Siguiendo la regla del usuario:
 * Debe escribir en location lo que dice la columna de:
 * "Descripción de Trabajos", "ID losa", "Descripción / Estaciones", "Descripción de Localización MOT" o cosas similares.
 */
export function isLocationHeader(headerText: string): boolean {
    if (!headerText) return false;
    const lower = String(headerText).toLowerCase().trim();
    const clean = lower.replace(/[\s_\-\.:#/\\()]/g, '');

    if (
        lower.includes('trabajo') || // "Descripción de Trabajos", "Trabajos", etc.
        lower.includes('work') ||    // "Work description", etc.
        lower.includes('losa') ||    // "ID losa", "ID Losa", "Losa", etc.
        clean.includes('idlosa') ||
        lower.includes('slab') ||
        lower.includes('estacion') || // "Descripción / Estaciones", "Estaciones"
        lower.includes('station') ||
        lower.includes('mot') ||      // "Descripción de Localización MOT", "MOT"
        lower.includes('localiz') ||  // "Localización", "Descripción de Localización"
        lower.includes('location') ||
        lower.includes('ubicac') ||   // "Ubicación"
        lower.includes('tramo') ||
        lower.includes('sitio') ||
        lower.includes('lugar') ||
        lower.includes('carril') ||
        lower.includes('lane') ||
        lower.includes('chainage')
    ) {
        return true;
    }

    return false;
}

/**
 * Identifica si un encabezado de columna corresponde estrictamente a cálculos o notas.
 */
export function isCalculationHeader(headerText: string): boolean {
    if (!headerText) return false;
    // Si ya es un encabezado de localización/trabajos, no clasificarlo como cálculos
    if (isLocationHeader(headerText)) return false;

    const lower = String(headerText).toLowerCase().trim();
    if (
        lower.includes('calculation') ||
        lower.includes('calculo') ||
        lower.includes('cálculo') ||
        lower.includes('formula') ||
        lower.includes('fórmula') ||
        lower.includes('remark') ||
        lower.includes('observaci') ||
        lower.includes('dimension') ||
        lower.includes('medida') ||
        lower.includes('nota') ||
        lower.includes('ancho') ||
        lower.includes('largo') ||
        lower.includes('espesor') ||
        lower.includes('depth') ||
        lower.includes('width') ||
        lower.includes('length') ||
        lower.includes('area') ||
        lower.includes('volumen')
    ) {
        return true;
    }

    if (lower === 'descripcion' || lower === 'descripción' || lower === 'description') {
        return true;
    }

    return false;
}

// ─── Extractor Flexible para hojas con datos que no se parsean con los patrones estándar ─────

/**
 * Intenta extraer cantidades de una hoja de Excel usando lógica más flexible.
 * Útil para hojas de Trainees (Items 2 y 3) u otras partidas con formatos no estándar.
 * Busca cualquier columna numérica que pueda representar cantidades (horas, unidades, etc.)
 */
function extractFlexibleQuantities(
    sheet: XLSX.WorkSheet,
    itemNum: string,
    itemName?: string,
    defaultDate?: string
): CertExcelRow[] {
    const rawMatrix: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (!rawMatrix || rawMatrix.length === 0) return [];

    const rows: CertExcelRow[] = [];

    // Buscar fila de encabezados (primera fila con 2 o más celdas no vacías)
    let headerRowIdx = -1;
    let headers: string[] = [];
    for (let r = 0; r < Math.min(rawMatrix.length, 30); r++) {
        const row = rawMatrix[r];
        if (!row) continue;
        const nonEmpty = row.filter((c: any) => String(c || '').trim() !== '').length;
        if (nonEmpty >= 2) {
            const rowText = row.map((c: any) => String(c || '').toLowerCase().trim()).join(' ');
            if (
                rowText.includes('qty') || rowText.includes('cantidad') || rowText.includes('hour') || rowText.includes('hora') ||
                rowText.includes('date') || rowText.includes('fecha') || rowText.includes('inspector') || rowText.includes('trainee') ||
                rowText.includes('empleado') || rowText.includes('employee') || rowText.includes('record') ||
                isLocationHeader(rowText) || isCalculationHeader(rowText)
            ) {
                headers = row.map((c: any) => String(c || '').trim());
                headerRowIdx = r;
                break;
            }
        }
    }

    if (headerRowIdx === -1) {
        // Si no se detectó cabecera con palabras clave, tomar la primera fila con al menos 2 celdas
        for (let r = 0; r < Math.min(rawMatrix.length, 10); r++) {
            const row = rawMatrix[r];
            if (row && row.filter((c: any) => String(c || '').trim() !== '').length >= 2) {
                headers = row.map((c: any) => String(c || '').trim());
                headerRowIdx = r;
                break;
            }
        }
    }

    // Mapear columnas con detección flexible
    let qtyCol = -1;
    let inspCol = -1;
    let dateCol = -1;
    const locCols: number[] = [];
    let calcCol = -1;
    let personCol = -1;
    let recordCol = -1;

    for (let c = 0; c < headers.length; c++) {
        const h = headers[c];
        const hClean = h.toLowerCase().replace(/[\s_\-\.:#]/g, '');
        if (qtyCol === -1 && (hClean.includes('cantidad') || hClean.includes('qty') || hClean.includes('quantity') ||
            hClean.includes('hours') || hClean.includes('horas') || hClean.includes('manhour') || hClean.includes('manhours') ||
            hClean.includes('approved') || hClean.includes('verified') || hClean.includes('measured') ||
            hClean.includes('amount') || hClean === 'hrs' || hClean === 'hr')) {
            qtyCol = c;
        } else if (inspCol === -1 && (hClean.includes('inspector') || hClean.includes('insp'))) {
            inspCol = c;
        } else if (dateCol === -1 && (hClean.includes('date') || hClean.includes('fecha'))) {
            dateCol = c;
        } else if (isLocationHeader(h)) {
            locCols.push(c);
        } else if (calcCol === -1 && isCalculationHeader(h)) {
            calcCol = c;
        } else if (personCol === -1 && (hClean.includes('trainee') || hClean.includes('persona') || hClean.includes('empleado') || hClean.includes('employee') || hClean.includes('nombre') || hClean === 'name')) {
            personCol = c;
        } else if (recordCol === -1 && (hClean.includes('record') || hClean.includes('no') || hClean === '#')) {
            recordCol = c;
        }
    }

    // Si no se detectó columna de cantidad, buscar cualquier columna numérica en las filas subsiguientes
    if (qtyCol === -1) {
        const startCheck = headerRowIdx >= 0 ? headerRowIdx + 1 : 0;
        for (let r = startCheck; r < Math.min(rawMatrix.length, startCheck + 5); r++) {
            const row = rawMatrix[r];
            if (!row) continue;
            for (let c = 0; c < row.length; c++) {
                if (c === inspCol || c === dateCol || locCols.includes(c) || c === calcCol || c === personCol || c === recordCol) continue;
                const cellStr = String(row[c] || '').replace(/,/g, '').trim();
                const num = parseFloat(cellStr);
                if (!isNaN(num) && num > 0 && !cellStr.includes('/') && !cellStr.includes(':') && cellStr.length < 10) {
                    qtyCol = c;
                    break;
                }
            }
            if (qtyCol !== -1) break;
        }
    }

    // Procesar filas de datos
    const startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 0;
    for (let r = startRow; r < rawMatrix.length; r++) {
        const row = rawMatrix[r];
        if (!row || row.length === 0) continue;

        // Solo saltar si es verdaderamente un resumen de contrato o total general
        if (isContractOrSummaryRow(row)) continue;

        let qty = 0;
        if (qtyCol !== -1 && row[qtyCol] !== undefined && row[qtyCol] !== '') {
            const valStr = String(row[qtyCol]).replace(/,/g, '').trim();
            qty = parseFloat(valStr);
        }
        // REGLA DEL USUARIO: solo incluye datos que tengan cantidades (> 0)
        if (isNaN(qty) || qty <= 0) continue;

        const inspDateRaw = dateCol !== -1 ? row[dateCol] : '';
        let formattedDate = formatRawDate(inspDateRaw);
        // Si no viene fecha en la celda individual de esta partida, usar la fecha de certificación o fallback
        if (!formattedDate) {
            formattedDate = defaultDate || '__certdate__';
        }

        const inspector = inspCol !== -1 ? String(row[inspCol] || '').trim() : '';
        const rawCalc = calcCol !== -1 ? String(row[calcCol] || '').trim() : '';
        const personNameRaw = personCol !== -1 ? String(row[personCol] || '').trim() : '';

        // Construir localización desde las columnas de location/trabajos/losa/estaciones/MOT
        const locParts: string[] = [];
        for (const lc of locCols) {
            const val = String(row[lc] || '').trim();
            if (val && !locParts.includes(val) && !isContractInfo(val)) {
                locParts.push(val);
            }
        }
        const rawLoc = locParts.join(' - ');

        // Descartar si el texto de ubicación o cálculo hace referencia a datos del contrato
        if (isContractInfo(`${rawLoc} ${rawCalc}`)) continue;

        rows.push({
            itemNum,
            specCode: itemNum,
            itemName: itemName || '',
            location: rawLoc,
            calculations: rawCalc,
            quantity: qty,
            inspector,
            inspDate: formattedDate,
            personName: cleanPersonName(personNameRaw) || undefined,
        });
    }

    // Si aún no se encontraron filas y es una partida de Trainees o similar, buscar celdas con horas/cantidad > 0
    if (rows.length === 0) {
        for (let r = 0; r < rawMatrix.length; r++) {
            const row = rawMatrix[r];
            if (!row || row.length === 0) continue;
            const rowStr = row.map((c: any) => String(c || '').toLowerCase()).join(' ');
            if (rowStr.includes('hora') || rowStr.includes('hour') || rowStr.includes('trainee') || rowStr.includes('total') || rowStr.includes('balance') || rowStr.includes('aprobado') || rowStr.includes('cert')) {
                for (const cell of row) {
                    const valStr = String(cell || '').replace(/,/g, '').trim();
                    const num = parseFloat(valStr);
                    if (!isNaN(num) && num > 0 && num < 100000 && !valStr.includes('/') && !valStr.includes('-')) {
                        const cleanNum = String(itemNum).replace(/^item\s*/i, '').trim();
                        const isYPP = cleanNum === '3' || rowStr.includes('ypp');
                        rows.push({
                            itemNum,
                            specCode: itemNum,
                            itemName: itemName || (isYPP ? 'YPP Trainees Man Hour' : 'Trainees Man Hour'),
                            location: isYPP ? 'YPP Trainees Man Hour (Derek Figueroa Rosado)' : 'Trainees Man Hour (Ivonne Rosado Rosario)',
                            calculations: '',
                            quantity: num,
                            inspector: '',
                            inspDate: defaultDate || '__certdate__',
                        });
                        break;
                    }
                }
                if (rows.length > 0) break;
            }
        }
    }

    return rows;
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
            if (rowStr.includes('record no') || (rowStr.includes('inspector') && (rowStr.includes('quantity') || rowStr.includes('date') || rowStr.includes('cantidad') || rowStr.includes('hours') || rowStr.includes('horas')))) {
                headerIndices = {
                    locationCols: [] as number[],
                };
                row.forEach((colVal, colIdx) => {
                    const orig = String(colVal || '').trim();
                    const norm = orig.toLowerCase().replace(/[\s_\-\.:#/\\()]/g, '');
                    if (norm.includes('recordno')) headerIndices.recordNo = colIdx;
                    else if (norm.includes('trainee') || norm.includes('persona') || norm.includes('empleado') || norm.includes('employee') || norm === 'nombre' || norm === 'name') headerIndices.personName = colIdx;
                    else if (norm.includes('inspector')) headerIndices.inspector = colIdx;
                    else if (norm === 'cantidad' || norm.startsWith('cantidad') || norm === 'quantity' || norm.startsWith('quantity') || norm.includes('hours') || norm.includes('horas') || norm.includes('manhour') || norm.includes('manhours')) headerIndices.qtyCantidad = colIdx;
                    else if (norm.includes('verified') && norm.includes('approved')) headerIndices.qtyApproved = colIdx;
                    else if (norm.includes('quantitymeasured')) headerIndices.qtyMeasured = colIdx;
                    else if (norm.includes('inspectiondate') || norm.includes('date') || norm.includes('fecha')) headerIndices.inspDate = colIdx;
                    else if (isLocationHeader(orig)) headerIndices.locationCols.push(colIdx);
                    else if (isCalculationHeader(orig)) headerIndices.calculations = colIdx;
                    else if (norm.includes('page')) headerIndices.page = colIdx;
                });
                continue;
            }

            // Leer fila de datos
            if (headerIndices && (headerIndices.recordNo !== undefined || headerIndices.qtyCantidad !== undefined || headerIndices.qtyApproved !== undefined || headerIndices.qtyMeasured !== undefined)) {
                // Descartar totales, resúmenes y datos del contrato (Regla: no incluir valores del contrato)
                if (isContractOrSummaryRow(row)) {
                    continue;
                }

                const recordNo = headerIndices.recordNo !== undefined ? String(row[headerIndices.recordNo] || '').trim() : '';
                const inspector = headerIndices.inspector !== undefined ? String(row[headerIndices.inspector] || '').trim() : '';
                const personNameRaw = headerIndices.personName !== undefined ? String(row[headerIndices.personName] || '').trim() : '';
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

                const inspDateRaw = headerIndices.inspDate !== undefined ? row[headerIndices.inspDate] : '';
                let formattedDate = formatRawDate(inspDateRaw);
                if (!formattedDate) {
                    formattedDate = certDateDetected || '__certdate__';
                }

                // Construir location a partir de las columnas detectadas (Descripción de Trabajos, ID losa, Estaciones, MOT, etc.)
                const locParts: string[] = [];
                for (const lc of (headerIndices.locationCols || [])) {
                    const val = String(row[lc] || '').trim();
                    if (val && !locParts.includes(val) && !isContractInfo(val)) {
                        locParts.push(val);
                    }
                }
                const rawLocation = locParts.join(' - ');

                const rawCalculations = headerIndices.calculations !== undefined && row[headerIndices.calculations]
                    ? String(row[headerIndices.calculations]).trim()
                    : '';

                // Descartar si el texto de ubicación o cálculo hace referencia a datos del contrato
                const locCalcCombined = `${rawLocation} ${rawCalculations} ${currentSpec} ${currentItemName}`;
                if (isContractInfo(locCalcCombined) || isContractOrSummaryRow([rawLocation, rawCalculations])) {
                    continue;
                }

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
                    inspDate: formattedDate,
                    page: pageVal,
                    personName: cleanPersonName(personNameRaw) || undefined,
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

/** Extrae de formato tabular plano estándar o plantillas con encabezados desplazados */
function extractFromTabularFormat(
    sheet: XLSX.WorkSheet,
    errors: string[],
    defaultItemInfo?: { itemNum: string; itemName?: string }
) {
    const rawMatrix: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (!rawMatrix || rawMatrix.length === 0) {
        return { allRows: [], certNumDetected: '', certDateDetected: '' };
    }

    let certNumDetected = '';
    let certDateDetected = '';
    const fallbackItemNum = defaultItemInfo?.itemNum || '';

    // 1. Escanear metadatos generales (Cert No, Fechas) en toda la hoja
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

    // 2. Localizar la fila de encabezados buscando palabras clave en las primeras 35 filas
    let headerRowIdx = -1;
    let colIndices: any = null;

    for (let r = 0; r < Math.min(rawMatrix.length, 35); r++) {
        const row = rawMatrix[r];
        if (!row || row.length === 0) continue;

        const rowStr = row.map(c => String(c || '').toLowerCase().trim()).join(' ');

        const hasQtyTerm = rowStr.includes('cantidad') || rowStr.includes('qty') || rowStr.includes('quantity') || rowStr.includes('approved') || rowStr.includes('medid') || rowStr.includes('amount') || rowStr.includes('hours') || rowStr.includes('horas') || rowStr.includes('man hour') || rowStr.includes('manhour');
        const hasOtherTerm = rowStr.includes('item') || rowStr.includes('location') || rowStr.includes('station') || rowStr.includes('ubicacion') ||
                             rowStr.includes('calc') || rowStr.includes('descrip') || rowStr.includes('inspector') || rowStr.includes('date') || rowStr.includes('fecha') || rowStr.includes('trainee') || rowStr.includes('employee') || rowStr.includes('empleado') || rowStr.includes('nombre') || rowStr.includes('name') ||
                             isLocationHeader(rowStr) || isCalculationHeader(rowStr);

        if (hasQtyTerm || (hasOtherTerm && (rowStr.includes('record') || rowStr.includes('total') || rowStr.includes('unit')))) {
            const indices: any = {
                locationCols: [] as number[],
            };
            row.forEach((cellVal, cIdx) => {
                const orig = String(cellVal || '').trim();
                const norm = orig.toLowerCase().replace(/[\s_\-\.:#/\\()]/g, '');
                if (norm.includes('itemnumber') || norm.includes('itemno') || norm.includes('itemnum') || norm === 'item' || norm.startsWith('item') || norm.includes('partida')) {
                    indices.itemNum = cIdx;
                } else if (norm.includes('trainee') || norm.includes('persona') || norm.includes('empleado') || norm.includes('employee') || norm === 'nombre' || norm === 'name') {
                    indices.personName = cIdx;
                } else if (isLocationHeader(orig)) {
                    indices.locationCols.push(cIdx);
                } else if (isCalculationHeader(orig)) {
                    indices.calculations = cIdx;
                } else if (norm.includes('cantidad') || norm.includes('qty') || norm.includes('quantity') || norm.includes('verified') || norm.includes('approved') || norm.includes('measured') || norm.includes('hours') || norm.includes('horas') || norm.includes('manhour') || norm.includes('manhours')) {
                    if (indices.quantity === undefined || norm.includes('approved') || norm.includes('verified') || norm.includes('cantidad')) {
                        indices.quantity = cIdx;
                    }
                } else if (norm.includes('inspector') || norm.includes('insp') || norm.includes('inspeccionado')) {
                    indices.inspector = cIdx;
                } else if (norm.includes('date') || norm.includes('fecha') || norm.includes('inspectiondate')) {
                    indices.inspDate = cIdx;
                } else if (norm.includes('page') || norm.includes('pagina') || norm.includes('pag')) {
                    indices.page = cIdx;
                }
            });

            if (indices.quantity !== undefined || (indices.locationCols.length > 0 && indices.calculations !== undefined) || (fallbackItemNum && indices.quantity !== undefined)) {
                headerRowIdx = r;
                colIndices = indices;
                break;
            }
        }
    }

    if (headerRowIdx === -1 || !colIndices) {
        colIndices = {
            itemNum: undefined,
            personName: undefined,
            locationCols: [],
            calculations: undefined,
            quantity: undefined,
            inspector: undefined,
            inspDate: undefined
        };
        headerRowIdx = 0;
    }

    const allRows: CertExcelRow[] = [];
    const startRow = headerRowIdx + 1;

    for (let i = startRow; i < rawMatrix.length; i++) {
        const row = rawMatrix[i];
        if (!row || row.length === 0) continue;

        // Descartar totales, resúmenes y datos del contrato (Regla: no incluir valores del contrato)
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
                if (c === colIndices.itemNum || c === colIndices.page) continue;
                const cellStr = String(row[c] || '').replace(/,/g, '').trim();
                const cand = parseFloat(cellStr);
                if (!isNaN(cand) && cand > 0 && !cellStr.includes('/') && !cellStr.includes('-') && !cellStr.includes(':')) {
                    qty = cand;
                    break;
                }
            }
        }

        // REGLA DEL USUARIO: solo incluye datos con cantidades (> 0)
        if (isNaN(qty) || qty <= 0) {
            continue;
        }

        const inspDateRaw = colIndices.inspDate !== undefined ? row[colIndices.inspDate] : '';
        let formattedDate = formatRawDate(inspDateRaw);
        if (!formattedDate) {
            formattedDate = certDateDetected || '__certdate__';
        }

        // Construir localización desde las columnas de location/trabajos/losa/estaciones/MOT
        const locParts: string[] = [];
        for (const lc of (colIndices.locationCols || [])) {
            const val = String(row[lc] || '').trim();
            if (val && !locParts.includes(val) && !isContractInfo(val)) {
                locParts.push(val);
            }
        }
        const rawLoc = locParts.join(' - ');
        const rawCalc = colIndices.calculations !== undefined ? String(row[colIndices.calculations] || '').trim() : '';
        const personNameRaw = colIndices.personName !== undefined ? String(row[colIndices.personName] || '').trim() : '';

        // Descartar si el texto de ubicación o cálculo hace referencia a datos del contrato
        const locCalcCombined = `${rawLoc} ${rawCalc} ${itemNumRaw} ${defaultItemInfo?.itemName || ''}`;
        if (isContractInfo(locCalcCombined) || isContractOrSummaryRow([rawLoc, rawCalc])) {
            continue;
        }

        const { location, calculations } = splitLocationAndCalculations(rawLoc, rawCalc, defaultItemInfo?.itemName || '');

        const inspector = colIndices.inspector !== undefined ? String(row[colIndices.inspector] || '').trim() : '';

        if (formattedDate && !certDateDetected) {
            certDateDetected = formattedDate;
        }

        const pageVal = colIndices.page !== undefined ? parseInt(String(row[colIndices.page])) || undefined : undefined;

        allRows.push({
            itemNum: itemNumRaw,
            specCode: itemNumRaw,
            itemName: defaultItemInfo?.itemName || '',
            location,
            calculations,
            quantity: qty,
            inspector,
            inspDate: formattedDate,
            page: pageVal,
            personName: cleanPersonName(personNameRaw) || undefined,
        });
    }

    if (!certDateDetected && allRows.length > 0) {
        const dates = allRows.map(r => r.inspDate).filter(Boolean).sort().reverse();
        if (dates.length > 0) certDateDetected = dates[0];
    }

    return { allRows, certNumDetected, certDateDetected };
}

// ─── Helpers de Base de Datos y Formateo ─────────────────────────────────────

export function normalizeItemKey(raw: string): string {
    if (!raw) return '';
    return String(raw)
        .toLowerCase()
        .replace(/^(?:item|partida)[\s\.\-_:]*/i, '')
        .replace(/[\s_\-\.\(\)\/]/g, '')
        .replace(/^0+/, '')
        .trim();
}

export function findContractItemInDb(
    itemKey: string,
    specCode: string | undefined,
    dbItems: any[]
): any | null {
    if (!dbItems || dbItems.length === 0) return null;

    const normKey = normalizeItemKey(itemKey);
    const normSpec = normalizeItemKey(specCode || '');

    // 1. Coincidencia exacta por item_num normalizado
    let found = dbItems.find(it => normalizeItemKey(it.item_num) === normKey);
    if (found) return found;

    // 2. Coincidencia por specification normalizada
    if (normSpec) {
        found = dbItems.find(it => normalizeItemKey(it.specification) === normSpec);
        if (found) return found;
    }
    found = dbItems.find(it => normalizeItemKey(it.specification) === normKey);
    if (found) return found;

    // 3. Casos especiales para Trainees (Items 2 y 3)
    if (normKey === '2' || normSpec.includes('152') || normKey.includes('152')) {
        found = dbItems.find(it => {
            const itNum = normalizeItemKey(it.item_num);
            const itSpec = normalizeItemKey(it.specification);
            const itDesc = String(it.description || '').toLowerCase();
            return itNum === '2' || itSpec.includes('152') || (itDesc.includes('trainee') && !itDesc.includes('ypp'));
        });
        if (found) return found;
    }

    if (normKey === '3' || normSpec.includes('153') || normKey.includes('153')) {
        found = dbItems.find(it => {
            const itNum = normalizeItemKey(it.item_num);
            const itSpec = normalizeItemKey(it.specification);
            const itDesc = String(it.description || '').toLowerCase();
            return itNum === '3' || itSpec.includes('153') || itDesc.includes('ypp');
        });
        if (found) return found;
    }

    // 4. Coincidencia si el número de ítem puramente numérico coincide
    if (normKey && /^\d+$/.test(normKey)) {
        found = dbItems.find(it => {
            const itNum = normalizeItemKey(it.item_num);
            return itNum === normKey;
        });
        if (found) return found;
    }

    // 5. Coincidencia parcial de especificación
    found = dbItems.find(it => {
        const itSpec = normalizeItemKey(it.specification);
        return itSpec && normSpec && (itSpec.includes(normSpec) || normSpec.includes(itSpec));
    });
    if (found) return found;

    // 6. Coincidencia por subcadena de item_num
    found = dbItems.find(it => {
        const itNum = normalizeItemKey(it.item_num);
        return itNum && normKey && (itNum === normKey || itNum.startsWith(normKey) || normKey.startsWith(itNum));
    });

    return found || null;
}

function formatRawDate(val: any): string {
    if (!val) return '';
    if (val instanceof Date && !isNaN(val.getTime())) {
        return val.toISOString().split('T')[0];
    }
    if (typeof val === 'number') {
        if (val > 1000 && val < 100000) {
            const d = new Date(Math.round((val - 25569) * 86400 * 1000));
            if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
        }
    }
    const str = String(val).trim();
    if (!str || !/\d/.test(str)) return '';
    const d = new Date(str);
    if (!isNaN(d.getTime()) && d.getFullYear() >= 1990 && d.getFullYear() <= 2100) {
        return d.toISOString().split('T')[0];
    }
    const parts = str.split(/[\/\-]/);
    if (parts.length === 3) {
        const n0 = parseInt(parts[0], 10);
        const n1 = parseInt(parts[1], 10);
        const n2 = parseInt(parts[2], 10);
        if (n2 >= 1990 && n2 <= 2100) {
            let month = n0;
            let day = n1;
            if (n0 > 12 && n1 <= 12) {
                day = n0;
                month = n1;
            }
            if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                return `${n2}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            }
        }
    }
    return '';
}

function detectColumns(firstRow: Record<string, any>) {
    const keys = Object.keys(firstRow);
    const norm = (s: string) => String(s || '').toLowerCase().replace(/[\s_\-\.:]/g, '');
    const find = (...terms: string[]) => keys.find(k => terms.some(t => norm(k).includes(norm(t))));

    // Usar identificadores especializados para localización y cálculos
    const locKey = keys.find(k => isLocationHeader(k));
    const calcKey = keys.find(k => isCalculationHeader(k));

    return {
        itemNum:      find('itemnumber', 'itemno', 'itemnum', 'item_num', 'item', 'partida', 'especificacion', 'specification'),
        location:     locKey || find('location', 'ubicacion', 'lugar', 'estacion', 'station', 'tramo'),
        calculations: calcKey || find('calculation', 'calculo', 'formula', 'notes', 'notas', 'remarks', 'observaciones', 'dimensiones'),
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

export function estimateTextLines(text: string, maxCharsPerLine: number): number {
    if (!text || text.trim() === '') return 1;
    const cleanText = text.trim();
    const manualLines = cleanText.split(/\r?\n/);
    let totalLines = 0;
    for (const line of manualLines) {
        const len = line.trim().length;
        if (len === 0) totalLines += 1;
        else totalLines += Math.max(1, Math.ceil(len / maxCharsPerLine));
    }
    return Math.max(1, totalLines);
}

export function calculateNeededRowHeight(loc: string, calc: string): number {
    const locLines = estimateTextLines(loc, 38);
    const calcLines = estimateTextLines(calc, 44);
    const lines = Math.max(locLines, calcLines);

    if (lines <= 1) return 22;
    if (lines === 2) return 34; // Espacio holgado para 2 líneas completas sin que el borde inferior corte las letras
    if (lines === 3) return 48;
    return Math.min(75, lines * 15 + 6);
}

export function paginateItemRows(rows: CertExcelRow[]): CertExcelRow[][] {
    if (!rows || rows.length === 0) return [[]];

    const pages: CertExcelRow[][] = [];
    let currentPage: CertExcelRow[] = [];
    let currentHeightSum = 0;

    // Altura máxima segura para la zona de detalle (filas 13 a 27) para caber en hoja Letter sin desbordar
    const MAX_PAGE_DATA_HEIGHT = 270;

    // Detectar si alguna fila del ítem es multilínea
    const hasMultiLine = rows.some(r => {
        const lines = Math.max(estimateTextLines(r.location || '', 38), estimateTextLines(r.calculations || '', 44));
        return lines > 1;
    });

    // Si tiene renglones largos, reducir la cantidad de filas por página (máximo 8-9) y usar las páginas necesarias
    const MAX_ROWS_PER_PAGE = hasMultiLine ? 9 : 15;

    for (const row of rows) {
        const h = calculateNeededRowHeight(row.location || '', row.calculations || '');

        if (
            currentPage.length > 0 &&
            (currentPage.length >= MAX_ROWS_PER_PAGE || (currentHeightSum + h > MAX_PAGE_DATA_HEIGHT))
        ) {
            pages.push(currentPage);
            currentPage = [];
            currentHeightSum = 0;
        }

        currentPage.push(row);
        currentHeightSum += h;
    }

    if (currentPage.length > 0) {
        pages.push(currentPage);
    }

    return pages;
}

function fillDataRows(
    ws: ExcelJS.Worksheet,
    pageRows: CertExcelRow[],
    inspectorsList: string[] = [],
    isTrainee2: boolean = false,
    isTrainee3: boolean = false,
    certDate: string = ''
) {
    // Preparar la validación de 3 meses para las filas 13 a 27
    const certDateMs = certDate ? new Date(certDate).getTime() : NaN;
    const THREE_MONTHS_MS = 3 * 30 * 24 * 60 * 60 * 1000; // ~90 días exactos de 24h

    for (let i = 0; i < ROWS_PER_PAGE; i++) {
        const excelRow = DATA_ROW_START + i;
        const dataRow = pageRows[i];

        // REGLA DEL USUARIO: y solo incluye en los datos de las filas 13 a 27, los datos del excel que tengan fechas y cantidades
        if (
            !dataRow ||
            !dataRow.inspDate ||
            dataRow.inspDate.trim() === '' ||
            dataRow.inspDate === '__nodate__' ||
            dataRow.quantity === undefined ||
            dataRow.quantity === null ||
            isNaN(dataRow.quantity) ||
            dataRow.quantity <= 0
        ) {
            clearDataRow(ws, excelRow);
            continue;
        }

        // Regla usuario: No incluir en las líneas 13 a 27 cantidades con fecha que tengan
        // más de 3 meses (90 días de 24h) de diferencia respecto a la fecha de certificación
        if (!isNaN(certDateMs) && dataRow.inspDate && dataRow.inspDate !== '__certdate__' && dataRow.inspDate !== '__nodate__') {
            const rowDateMs = new Date(dataRow.inspDate).getTime();
            if (!isNaN(rowDateMs)) {
                const diffMs = Math.abs(certDateMs - rowDateMs);
                if (diffMs > THREE_MONTHS_MS) {
                    clearDataRow(ws, excelRow);
                    continue;
                }
            }
        }

        // Regla: No incluir información del contrato en las filas de la 13 a la 28
        if (
            isContractInfo(`${dataRow.location} ${dataRow.calculations}`) ||
            isContractOrSummaryRow([dataRow.location, dataRow.calculations, dataRow.itemName])
        ) {
            clearDataRow(ws, excelRow);
            continue;
        }

        const dateStr = formatDisplayDate(dataRow.inspDate);

        const locCell = ws.getCell(excelRow, 3);
        let finalLoc = dataRow.location || '';
        if ((isTrainee2 || isTrainee3) && !finalLoc.includes('(')) {
            if (isTrainee3) {
                finalLoc = `YPP Trainees Man Hour (Derek Figueroa Rosado)`;
            } else {
                finalLoc = `Trainees Man Hour (Ivonne Rosado Rosario)`;
            }
        }
        locCell.value = finalLoc;
        locCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        locCell.font = { name: 'Arial', size: 9, bold: false, color: { argb: 'FF000000' } };

        const calcCell = ws.getCell(excelRow, 28);
        calcCell.value = dataRow.calculations || '';
        calcCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        calcCell.font = { name: 'Arial', size: 9, bold: false, color: { argb: 'FF000000' } };

        const qtyCell = ws.getCell(excelRow, 56);
        qtyCell.value = dataRow.quantity;
        qtyCell.alignment = { vertical: 'middle', horizontal: 'right' };
        qtyCell.numFmt = '#,##0.000';
        // Regla del usuario: pintar de negro todos los caracteres que salgan en las ICW
        qtyCell.font = { name: 'Arial', size: 9, bold: false, color: { argb: 'FF000000' } };

        if (!dataRow.quantity || dataRow.quantity <= 0) {
            ws.getCell(excelRow, 62).value = '';
        } else {
            ws.getCell(excelRow, 62).value = {
                formula: `AO7*BD${excelRow}`,
                result: undefined,
            };
            ws.getCell(excelRow, 62).numFmt = '$#,##0.00';
            ws.getCell(excelRow, 62).font = { name: 'Arial', size: 9, bold: false, color: { argb: 'FF000000' } };
            ws.getCell(excelRow, 62).alignment = { vertical: 'middle', horizontal: 'right' };
        }

        let inspLetter = '';
        const rawInsp = (dataRow.inspector || '').trim();
        if (rawInsp && inspectorsList.length > 0) {
            const idx = inspectorsList.findIndex(u => u.toLowerCase() === rawInsp.toLowerCase());
            if (idx >= 0 && idx < INSPECTOR_INCISOS.length) {
                inspLetter = INSPECTOR_INCISOS[idx].letter;
            } else if (isTrainee2 || isTrainee3) {
                // En items de trainees, si el campo contenía el nombre del trainee, asignar el primer inspector oficial
                inspLetter = INSPECTOR_INCISOS[0].letter;
            } else {
                inspLetter = rawInsp;
            }
        } else if (inspectorsList.length > 0) {
            inspLetter = INSPECTOR_INCISOS[0].letter;
        }
        const inspCell = ws.getCell(excelRow, 69);
        inspCell.value = inspLetter;
        inspCell.alignment = { horizontal: 'center', vertical: 'middle' };
        inspCell.font = { name: 'Arial', size: 9, bold: false, color: { argb: 'FF000000' } };

        const dateCell = ws.getCell(excelRow, 72);
        dateCell.value = dateStr;
        dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
        dateCell.font = { name: 'Arial', size: 9, bold: false, color: { argb: 'FF000000' } };

        ws.getCell(excelRow, 76).value = '';

        // Ajuste dinámico de altura para evitar que las letras se vean cortadas
        const neededHeight = calculateNeededRowHeight(finalLoc, dataRow.calculations || '');
        ws.getRow(excelRow).height = neededHeight;
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
    ws.getRow(rowNum).height = 16;
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

/**
 * Pinta de color negro todos los caracteres que salgan en los ICW (ACT-117A)
 */
function applyAllBlackFont(ws: ExcelJS.Worksheet) {
    ws.eachRow({ includeEmpty: false }, (row) => {
        row.eachCell({ includeEmpty: false }, (cell) => {
            if (cell.font) {
                cell.font = {
                    ...cell.font,
                    color: { argb: 'FF000000' },
                };
            } else {
                cell.font = {
                    name: 'Arial',
                    size: 9,
                    color: { argb: 'FF000000' },
                };
            }
        });
    });
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
