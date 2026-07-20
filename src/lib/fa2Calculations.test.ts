import { describe, it, expect } from 'vitest';
import { calculateLaborTotal, applyAC51Rules, calculateEquipmentRental } from './fa2Calculations';

describe('FA-2 Math Logic', () => {
    describe('calculateLaborTotal', () => {
        it('calculates regular and overtime hours accurately', () => {
            const entry = {
                hoursReg: 10,
                hours15: 5,
                hours20: 2,
                hourlyRate: 15
            };
            // 10 * 15 = 150
            // 5 * 15 * 1.5 = 112.5
            // 2 * 15 * 2.0 = 60
            // Total = 150 + 112.5 + 60 = 322.5
            expect(calculateLaborTotal(entry as any)).toBe(322.5);
        });

        it('handles missing values gracefully', () => {
            expect(calculateLaborTotal({ hourlyRate: 20 } as any)).toBe(0);
        });
    });

    describe('applyAC51Rules', () => {
        it('applies all insurance and BI surcharges correctly', () => {
            const labor = 1000;
            const eq = 2000;
            const mat = 500;

            const result = applyAC51Rules(labor, eq, mat);

            // Mano de Obra:
            // plus20 = 1000 * 1.20 = 1200
            // Seguros: 5% + 6.2% + 1% + 2% + 0.5% = 14.7% de 1200 = 176.4
            // subtotalMO = 1200 + 176.4 = 1376.4
            // BI MO = 1376.4 * 0.06 = 82.584
            // finalMOTotal = 1376.4 + 82.584 = 1458.984
            expect(result.labor.subtotal).toBe(1000);
            expect(result.labor.plus20).toBe(1200);
            expect(result.labor.bi).toBeCloseTo(82.584);
            expect(result.labor.total).toBeCloseTo(1458.984);

            // Equipo:
            // BI = 2000 * 0.15 = 300
            // finalEQ = 2300
            expect(result.equipment.bi).toBe(300);
            expect(result.equipment.total).toBe(2300);

            // Materiales:
            // BI = 500 * 0.15 = 75
            // finalMAT = 575
            expect(result.materials.bi).toBe(75);
            expect(result.materials.total).toBe(575);

            // Grand Total: 1458.984 + 2300 + 575 = 4333.984
            expect(result.grandTotal).toBeCloseTo(4333.984);
        });
    });

    describe('calculateEquipmentRental', () => {
        it('calculates total rental correctly', () => {
            expect(calculateEquipmentRental(8, 100)).toBe(800);
            expect(calculateEquipmentRental(undefined as any, 100)).toBe(0);
        });
    });
});
