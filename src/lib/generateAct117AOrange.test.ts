import { describe, it, expect, vi } from 'vitest';

vi.mock('./supabase', () => ({
    supabase: {
        from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
    },
}));

import { applyMultiInspectorRulesByDate } from './generateAct117AOrange';
import { CertExcelRow } from './generateAct117AFromExcel';

describe('generateAct117AOrange - Regla 14: Multi-Inspector por fecha', () => {
    it('Caso A (todos iguales): Si dos o más inspectores tienen la misma cantidad aprobada, se registra únicamente al primer inspector y se omiten los duplicados', () => {
        const rows: CertExcelRow[] = [
            { itemNum: '10', location: '', calculations: '', quantity: 15.5, inspector: 'Alexis Aleman', inspDate: '2026-09-15' },
            { itemNum: '10', location: '', calculations: '', quantity: 15.5, inspector: 'José Faña', inspDate: '2026-09-15' },
            { itemNum: '10', location: '', calculations: '', quantity: 15.5, inspector: 'Norma Vega', inspDate: '2026-09-15' },
        ];

        const result = applyMultiInspectorRulesByDate(rows);
        expect(result.length).toBe(1);
        expect(result[0].inspector).toBe('Alexis Aleman');
        expect(result[0].quantity).toBe(15.5);
    });

    it('Caso B (un valor se repite entre varios): Si un valor se repite entre varios pero no todos son iguales, se reporta únicamente el valor repetido (con el primer inspector)', () => {
        const rows: CertExcelRow[] = [
            { itemNum: '10', location: '', calculations: '', quantity: 20.0, inspector: 'Alexis Aleman', inspDate: '2026-09-16' },
            { itemNum: '10', location: '', calculations: '', quantity: 20.0, inspector: 'José Faña', inspDate: '2026-09-16' },
            { itemNum: '10', location: '', calculations: '', quantity: 35.0, inspector: 'Norma Vega', inspDate: '2026-09-16' },
        ];

        const result = applyMultiInspectorRulesByDate(rows);
        expect(result.length).toBe(1);
        expect(result[0].inspector).toBe('Alexis Aleman');
        expect(result[0].quantity).toBe(20.0);
    });

    it('Caso C (cantidades diferentes): Si todos los inspectores tienen cantidades distintas, se incluyen todos los renglones', () => {
        const rows: CertExcelRow[] = [
            { itemNum: '10', location: '', calculations: '', quantity: 10.0, inspector: 'Alexis Aleman', inspDate: '2026-09-17' },
            { itemNum: '10', location: '', calculations: '', quantity: 25.0, inspector: 'José Faña', inspDate: '2026-09-17' },
            { itemNum: '10', location: '', calculations: '', quantity: 40.0, inspector: 'Luis Gómez', inspDate: '2026-09-17' },
        ];

        const result = applyMultiInspectorRulesByDate(rows);
        expect(result.length).toBe(3);
        expect(result.map(r => r.quantity)).toEqual([10.0, 25.0, 40.0]);
    });

    it('debe mantener registros de fechas diferentes independientes', () => {
        const rows: CertExcelRow[] = [
            // Fecha 1: Caso A (2 iguales) -> 1 registro
            { itemNum: '10', location: '', calculations: '', quantity: 5.0, inspector: 'Alexis Aleman', inspDate: '2026-09-15' },
            { itemNum: '10', location: '', calculations: '', quantity: 5.0, inspector: 'José Faña', inspDate: '2026-09-15' },
            // Fecha 2: Caso C (diferentes) -> 2 registros
            { itemNum: '10', location: '', calculations: '', quantity: 12.0, inspector: 'Alexis Aleman', inspDate: '2026-09-16' },
            { itemNum: '10', location: '', calculations: '', quantity: 18.0, inspector: 'Norma Vega', inspDate: '2026-09-16' },
        ];

        const result = applyMultiInspectorRulesByDate(rows);
        expect(result.length).toBe(3);
    });
});
