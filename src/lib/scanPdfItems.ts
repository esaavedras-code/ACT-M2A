/**
 * scanPdfItems.ts
 * Escanea un archivo PDF de certificación de cantidades y extrae:
 *  - Lista de ítems/partidas detectadas
 *  - Número de certificación
 *  - Fecha de certificación
 *  - Inspectores detectados
 *
 * Devuelve el mismo formato que scanExcelItems para ser intercambiable.
 */

import type { DetectedItemSummary } from './generateAct117AFromExcel';
import { extractItemFromSheetName } from './generateAct117AFromExcel';

// ─── Carga PDF.js desde CDN (igual que pdfClientParser.ts) ────────────────────
async function loadPdfJs(): Promise<any> {
    if (typeof window === 'undefined') return null;
    // @ts-ignore
    if (window.pdfjsLib) return window.pdfjsLib;
    try {
        const url = 'https://unpkg.com/pdfjs-dist@4.10.38/build/pdf.min.mjs';
        const pdfjsLib = await eval(`import("${url}")`);
        // @ts-ignore
        window.pdfjsLib = pdfjsLib;
        return pdfjsLib;
    } catch (e) {
        console.error('Error cargando PDF.js:', e);
        throw new Error('No se pudo cargar el motor de PDF. Revisa tu conexión.');
    }
}

// ─── Helpers de detección ─────────────────────────────────────────────────────

/** Detecta una fecha en varios formatos y la devuelve como YYYY-MM-DD o string limpio */
function detectDate(text: string): string | undefined {
    // MM/DD/YYYY o M/D/YYYY
    const m1 = text.match(/\b(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])\/(\d{4})\b/);
    if (m1) {
        const mm = m1[1].padStart(2, '0');
        const dd = m1[2].padStart(2, '0');
        return `${m1[3]}-${mm}-${dd}`;
    }
    // YYYY-MM-DD
    const m2 = text.match(/\b(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/);
    if (m2) return m2[0];
    // DD/MM/YYYY
    const m3 = text.match(/\b(0?[1-9]|[12]\d|3[01])\/(0?[1-9]|1[0-2])\/(\d{4})\b/);
    if (m3) {
        const dd = m3[1].padStart(2, '0');
        const mm = m3[2].padStart(2, '0');
        return `${m3[3]}-${mm}-${dd}`;
    }
    return undefined;
}

/** Detecta el número de certificación */
function detectCertNum(lines: string[]): string | undefined {
    for (const line of lines) {
        // Patrones: "Cert. No. 16", "CERT NO 16", "Certificación No. 16", "Certification No. 16"
        const m = line.match(/(?:cert(?:ificaci[oó]n|ification)?\.?\s*(?:no|n[uú]m|num)?\.?\s*[:#]?\s*)(\d+)/i);
        if (m) return m[1];
    }
    return undefined;
}

/** Detecta inspectores en el texto */
function detectInspectors(lines: string[]): string[] {
    const found = new Set<string>();
    for (const line of lines) {
        // "Inspector: Juan del Pueblo", "INSPECTOR: Juan", "Inspected by: Nombre"
        const m = line.match(/(?:inspector(?:es)?|inspected\s+by|inspeccionado\s+por)\s*[:\-]?\s*(.+)/i);
        if (m) {
            const names = m[1].split(/[,;\/]/).map(s => s.trim()).filter(s => s.length > 2 && s.length < 60);
            names.forEach(n => found.add(n));
        }
    }
    return Array.from(found);
}

/**
 * Extrae partidas del texto completo del PDF.
 * Busca patrones "Item X", "Partida X", o líneas que identifiquen un ítem.
 */
function extractItemsFromText(fullText: string): DetectedItemSummary[] {
    const lines = fullText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const foundItems = new Map<string, DetectedItemSummary>();

    for (const line of lines) {
        // Patrón 1: "Item X", "ITEM X", "Item X - Descripción", "Partida X", etc.
        const matchItem = line.match(/^(?:item|partida|it\.|p\.)\s*[:\-]?\s*([a-zA-Z0-9\-\.\(\)]+)(?:\s*[\-–:]\s*(.*))?$/i);
        if (matchItem) {
            const rawNum = matchItem[1].trim();
            const rawDesc = matchItem[2]?.trim() || '';
            // Evitar falsos positivos (palabras completas como "ITEM NO." sin número)
            if (/^[a-zA-Z]{3,}$/.test(rawNum) && !rawNum.match(/^\d/)) continue;
            if (!foundItems.has(rawNum)) {
                foundItems.set(rawNum, {
                    itemKey: rawNum,
                    itemNum: rawNum,
                    itemName: rawDesc || undefined,
                    totalQty: 0,
                    rowsCount: 0,
                });
            }
            continue;
        }

        // Patrón 2: líneas donde "ITEM NO." o "ITEM NUMBER" va seguido del número en la misma o siguiente línea
        const matchLabel = line.match(/^(?:item\s*(?:no|num|number|n[oú]|#)\.?)\s*[:\-]?\s*([a-zA-Z0-9\-\.\(\)]+)?$/i);
        if (matchLabel && matchLabel[1]) {
            const rawNum = matchLabel[1].trim();
            if (!foundItems.has(rawNum)) {
                foundItems.set(rawNum, {
                    itemKey: rawNum,
                    itemNum: rawNum,
                    itemName: undefined,
                    totalQty: 0,
                    rowsCount: 0,
                });
            }
            continue;
        }

        // Patrón 3: líneas con "ITEM:" al inicio con número inmediato
        const matchColon = line.match(/^item\s*:\s*([a-zA-Z0-9\-\.\(\)]+)(?:\s*[\-–]\s*(.*))?$/i);
        if (matchColon) {
            const rawNum = matchColon[1].trim();
            const rawDesc = matchColon[2]?.trim() || '';
            if (!foundItems.has(rawNum)) {
                foundItems.set(rawNum, {
                    itemKey: rawNum,
                    itemNum: rawNum,
                    itemName: rawDesc || undefined,
                    totalQty: 0,
                    rowsCount: 0,
                });
            }
            continue;
        }

        // Patrón 4: en un bloque de texto con "Item X" embebido (ej. en una celda de tabla)
        const globalMatches = [...line.matchAll(/(?:item|partida)\s+([a-zA-Z0-9\-\.\(\)]+)/gi)];
        for (const gm of globalMatches) {
            const rawNum = gm[1].trim();
            // Descartar palabras comunes que no son números de ítem
            if (['no', 'number', 'num', 'of', 'de', 'del', 'summary', 'sheet'].includes(rawNum.toLowerCase())) continue;
            if (!foundItems.has(rawNum)) {
                foundItems.set(rawNum, {
                    itemKey: rawNum,
                    itemNum: rawNum,
                    itemName: undefined,
                    totalQty: 0,
                    rowsCount: 0,
                });
            }
        }

        // Patrón 5: usar extractItemFromSheetName para parsear líneas que parecen encabezados de ítem
        const parsed = extractItemFromSheetName(line);
        if (parsed && parsed.itemNum && !foundItems.has(parsed.itemNum)) {
            foundItems.set(parsed.itemNum, {
                itemKey: parsed.itemNum,
                itemNum: parsed.itemNum,
                itemName: parsed.itemName,
                totalQty: 0,
                rowsCount: 0,
            });
        }
    }

    const items = Array.from(foundItems.values());

    // Ordenar naturalmente por número de ítem
    items.sort((a, b) => {
        const na = parseFloat(a.itemNum || '') || 0;
        const nb = parseFloat(b.itemNum || '') || 0;
        return na - nb || (a.itemNum || '').localeCompare(b.itemNum || '');
    });

    return items;
}

// ─── Función principal ────────────────────────────────────────────────────────

/**
 * Escanea un archivo PDF de certificación y extrae partidas, cert num, fecha e inspectores.
 * Compatible con el formato de retorno de scanExcelItems.
 */
export async function scanPdfItems(file: File): Promise<{
    items: DetectedItemSummary[];
    certNumDetected?: string;
    certDateDetected?: string;
    inspectorsDetected?: string[];
    sheetNamesDetected?: string[];
}> {
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const pdfjsLib = await loadPdfJs();
    if (!pdfjsLib) throw new Error('PDF.js no disponible en este entorno.');

    pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://unpkg.com/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';

    const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
    const pdf = await loadingTask.promise;

    let fullText = '';
    const pageTexts: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        pageTexts.push(pageText);
        fullText += pageText + '\n';
    }

    const lines = fullText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    const certNumDetected  = detectCertNum(lines);
    const certDateDetected = detectDate(fullText);
    const inspectorsDetected = detectInspectors(lines);
    const items = extractItemsFromText(fullText);

    return {
        items,
        certNumDetected,
        certDateDetected,
        inspectorsDetected: inspectorsDetected.length > 0 ? inspectorsDetected : undefined,
        sheetNamesDetected: pageTexts.map((_, i) => `Página ${i + 1}`),
    };
}
