import { describe, it, expect, vi } from 'vitest';

vi.mock('./supabase', () => ({
    supabase: {
        from: vi.fn(),
    },
}));

import {
    isLocationHeader,
    isCalculationHeader,
    splitLocationAndCalculations,
    extractItemFromSheetName,
    normalizeItemKey,
    findContractItemInDb,
    estimateTextLines,
    calculateNeededRowHeight,
    paginateItemRows,
    isAct117AWorksheet,
    extractFromAct117AFormat
} from './generateAct117AFromExcel';

describe('ACT-117A Excel Column Identifiers & Rules', () => {
    it('debe reconocer "Descripción de Trabajos" y variantes como encabezado de location', () => {
        expect(isLocationHeader('Descripción de Trabajos')).toBe(true);
        expect(isLocationHeader('Descripcion de Trabajos')).toBe(true);
        expect(isLocationHeader('Descripción Trabajos')).toBe(true);
        expect(isLocationHeader('Trabajos')).toBe(true);
        expect(isLocationHeader('Work description')).toBe(true);
    });

    it('debe reconocer "ID losa" y variantes como encabezado de location', () => {
        expect(isLocationHeader('ID losa')).toBe(true);
        expect(isLocationHeader('ID Losa')).toBe(true);
        expect(isLocationHeader('Id Losa')).toBe(true);
        expect(isLocationHeader('ID_LOSA')).toBe(true);
        expect(isLocationHeader('Losa')).toBe(true);
        expect(isLocationHeader('Slab ID')).toBe(true);
    });

    it('debe reconocer "Descripción / Estaciones" y variantes como encabezado de location', () => {
        expect(isLocationHeader('Descripción / Estaciones')).toBe(true);
        expect(isLocationHeader('Descripcion / Estaciones')).toBe(true);
        expect(isLocationHeader('Descripción/Estaciones')).toBe(true);
        expect(isLocationHeader('Estaciones')).toBe(true);
        expect(isLocationHeader('Station')).toBe(true);
        expect(isLocationHeader('Stations')).toBe(true);
    });

    it('debe reconocer "Descripción de Localización MOT" y variantes como encabezado de location', () => {
        expect(isLocationHeader('Descripción de Localización MOT')).toBe(true);
        expect(isLocationHeader('Descripcion de Localizacion MOT')).toBe(true);
        expect(isLocationHeader('Localización MOT')).toBe(true);
        expect(isLocationHeader('Localizacion MOT')).toBe(true);
        expect(isLocationHeader('MOT Location')).toBe(true);
    });

    it('debe distinguir encabezados de cálculos puros vs location', () => {
        expect(isCalculationHeader('Cálculos')).toBe(true);
        expect(isCalculationHeader('Calculations')).toBe(true);
        expect(isCalculationHeader('Fórmula')).toBe(true);
        expect(isCalculationHeader('Remarks')).toBe(true);
        expect(isCalculationHeader('Dimensiones')).toBe(true);
        // "Descripción de Trabajos" NO debe ser cálculo
        expect(isCalculationHeader('Descripción de Trabajos')).toBe(false);
        expect(isCalculationHeader('ID losa')).toBe(false);
        expect(isCalculationHeader('Descripción / Estaciones')).toBe(false);
        expect(isCalculationHeader('Descripción de Localización MOT')).toBe(false);
    });

    it('debe conservar la localización intacta si vino directamente de la columna del Excel', () => {
        const res1 = splitLocationAndCalculations('Losa 14 - Remoción y reemplazo', '');
        expect(res1.location).toBe('Losa 14 - Remoción y reemplazo');
        expect(res1.calculations).toBe('');

        const res2 = splitLocationAndCalculations('KM 12.4 a KM 13.0 MOT Carril Derecho', '');
        expect(res2.location).toBe('KM 12.4 a KM 13.0 MOT Carril Derecho');
        expect(res2.calculations).toBe('');
    });

    it('debe detectar correctamente hojas de Trainees y partidas 2 y 3', () => {
        const t2a = extractItemFromSheetName('Trainees');
        expect(t2a?.itemNum).toBe('2');

        const t2b = extractItemFromSheetName('Item 2 - Trainees');
        expect(t2b?.itemNum).toBe('2');

        const t2c = extractItemFromSheetName('Partida 2');
        expect(t2c?.itemNum).toBe('2');

        const t2d = extractItemFromSheetName('2 - Trainees Man Hour');
        expect(t2d?.itemNum).toBe('2');

        const t3a = extractItemFromSheetName('YPP Trainees');
        expect(t3a?.itemNum).toBe('3');

        const t3b = extractItemFromSheetName('Item 3 - YPP');
        expect(t3b?.itemNum).toBe('3');

        const t3c = extractItemFromSheetName('3 - YPP Trainees Man Hour');
        expect(t3c?.itemNum).toBe('3');
    });

    it('debe vincular las partidas con el catálogo del contrato en base de datos aunque tengan prefijo Item o ceros', () => {
        const dbItems = [
            { item_num: '2', specification: '152(1)', description: 'Trainees Man Hour', unit: 'HR', unit_price: '30.00' },
            { item_num: '3', specification: '153(1)', description: 'YPP Trainees Man Hour', unit: 'HR', unit_price: '28.00' },
            { item_num: '10', specification: '401(1)', description: 'Superpave Asphalt Concrete', unit: 'TN', unit_price: '115.50' }
        ];

        // Partida 2
        const m2 = findContractItemInDb('Item 2', '152(1)', dbItems);
        expect(m2).not.toBeNull();
        expect(m2?.item_num).toBe('2');
        expect(m2?.unit_price).toBe('30.00');

        // Partida 3
        const m3 = findContractItemInDb('3', undefined, dbItems);
        expect(m3).not.toBeNull();
        expect(m3?.item_num).toBe('3');
        expect(m3?.unit_price).toBe('28.00');

        // Partida 10 con prefijo
        const m10 = findContractItemInDb('Item 10', undefined, dbItems);
        expect(m10).not.toBeNull();
        expect(m10?.item_num).toBe('10');
        expect(m10?.unit_price).toBe('115.50');
    });

    it('debe calcular altura holgada para renglones multilínea y no cortar letras', () => {
        const text1 = 'KM 12.4 a KM 13.0';
        expect(calculateNeededRowHeight(text1, '')).toBe(22);

        // Texto largo de 2 líneas como en la foto de Enrique
        const text2 = 'Cierre Paseo KM 5.4 / Cierre Carril derecho PR-52 KM 12 8 al 12 3 vaciado hormigón losa fase 6';
        const height2 = calculateNeededRowHeight(text2, '');
        expect(height2).toBeGreaterThanOrEqual(34);
    });

    it('debe reducir filas por página y crear las páginas necesarias cuando hay filas multilínea', () => {
        // 16 filas con texto largo
        const longRows: any[] = Array.from({ length: 16 }, (_, idx) => ({
            itemNum: '10',
            location: 'Cierre Paseo KM 5.4 / Cierre Carril derecho PR-52 KM 12 8 al 12 3 vaciado hormigón losa fase 6',
            calculations: 'Flash...',
            quantity: 10 + idx,
            inspDate: '2026-10-15',
            inspector: 'Juan del Pueblo'
        }));

        const pages = paginateItemRows(longRows);
        // Debe generar al menos 2 páginas y ninguna página debe exceder 9 filas cuando son largas
        expect(pages.length).toBeGreaterThanOrEqual(2);
        for (const p of pages) {
            expect(p.length).toBeLessThanOrEqual(9);
        }
    });

    it('debe mantener hasta 15 filas en una sola página si caben en las filas 13 a 27', () => {
        const rows: any[] = Array.from({ length: 11 }, (_, idx) => ({
            itemNum: '17',
            location: `Drenaje ${idx + 1}`,
            calculations: 'Medición en campo',
            quantity: 5 + idx,
            inspDate: '2026-10-30',
            inspector: 'Alexis Aleman'
        }));

        const pages = paginateItemRows(rows);
        expect(pages.length).toBe(1);
        expect(pages[0].length).toBe(11);
    });

    it('debe extraer fielmente los datos de las filas 13 a 27 de una hoja en formato ACT-117A', () => {
        // Simular matriz y celdas de una hoja ACT-117A
        const sheet: any = {
            A5: { v: 'ITEM CERTIFICATION WORKSHEET' },
            BW6: { v: '16' },
            BW7: { v: '10/30/2026' },
            AO6: { v: '17' },
            AR8: { v: 'Pavement Drains' },
            C11: { v: 'Location' },
            AB11: { v: 'Calculations' },
            BD11: { v: 'Quantity' },
            BQ12: { v: 'Insp.' },
            BT12: { v: 'Date' },
            // Fila 13
            C13: { v: 'Estación 10+50 a 11+00' },
            AB13: { v: '50 ml x 0.30 m' },
            BD13: { v: 15.0 },
            BQ13: { v: 'a' },
            BT13: { v: '10/15/2026' },
            BX13: { v: 1 },
            // Fila 14
            C14: { v: 'Estación 11+00 a 11+50' },
            AB14: { v: '50 ml x 0.30 m' },
            BD14: { v: 20.0 },
            BQ14: { v: 'b' },
            BT14: { v: '10/16/2026' },
            BX14: { v: 2 },
            // Inspectores en filas 29 y 30
            L29: { v: 'a.' },
            N29: { v: 'Alexis Aleman' },
            L30: { v: 'b.' },
            N30: { v: 'José Faña' },
        };

        const rawMatrix: any[][] = [];
        for (let r = 0; r <= 38; r++) {
            rawMatrix.push([]);
        }
        rawMatrix[4][0] = 'ITEM CERTIFICATION WORKSHEET';
        rawMatrix[10][2] = 'Location';
        rawMatrix[10][55] = 'Quantity';
        // Fila 13 (r=12)
        rawMatrix[12][2] = 'Estación 10+50 a 11+00';
        rawMatrix[12][27] = '50 ml x 0.30 m';
        rawMatrix[12][55] = 15.0;
        rawMatrix[12][68] = 'a';
        rawMatrix[12][71] = '10/15/2026';
        rawMatrix[12][75] = 1;
        // Fila 14 (r=13)
        rawMatrix[13][2] = 'Estación 11+00 a 11+50';
        rawMatrix[13][27] = '50 ml x 0.30 m';
        rawMatrix[13][55] = 20.0;
        rawMatrix[13][68] = 'b';
        rawMatrix[13][71] = '10/16/2026';
        rawMatrix[13][75] = 2;
        // Inspectores
        rawMatrix[28][11] = 'a.';
        rawMatrix[28][13] = 'Alexis Aleman';
        rawMatrix[29][11] = 'b.';
        rawMatrix[29][13] = 'José Faña';

        expect(isAct117AWorksheet(sheet, rawMatrix)).toBe(true);

        const result = extractFromAct117AFormat(sheet, rawMatrix, []);
        expect(result.certNumDetected).toBe('16');
        expect(result.allRows.length).toBe(2);

        // Fila 13
        expect(result.allRows[0].location).toBe('Estación 10+50 a 11+00');
        expect(result.allRows[0].calculations).toBe('50 ml x 0.30 m');
        expect(result.allRows[0].quantity).toBe(15.0);
        expect(result.allRows[0].inspector).toBe('Alexis Aleman');
        expect(result.allRows[0].page).toBe(1);

        // Fila 14
        expect(result.allRows[1].location).toBe('Estación 11+00 a 11+50');
        expect(result.allRows[1].calculations).toBe('50 ml x 0.30 m');
        expect(result.allRows[1].quantity).toBe(20.0);
        expect(result.allRows[1].inspector).toBe('José Faña');
        expect(result.allRows[1].page).toBe(2);
    });
});
