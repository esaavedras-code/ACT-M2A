import { describe, it, expect, vi } from 'vitest';

vi.mock('./supabase', () => ({
    supabase: {
        from: vi.fn(),
    },
}));

import { isLocationHeader, isCalculationHeader, splitLocationAndCalculations } from './generateAct117AFromExcel';

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
});
