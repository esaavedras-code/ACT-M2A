import { describe, it, expect } from 'vitest';
import { roundedAmt } from './utils';

describe('roundedAmt (Bankers Rounding)', () => {
    it('rounds standard decimals correctly', () => {
        expect(roundedAmt(2.501, 2)).toBe(2.50);
        expect(roundedAmt(2.499, 2)).toBe(2.50);
        expect(roundedAmt(2.344, 2)).toBe(2.34);
    });

    it('rounds exactly half based on previous digit (bankers rounding variant)', () => {
        // Banker's Rounding: al estar en la mitad (.5), redondea al dígito par más cercano.
        // 2.505 -> último dígito es 0 (par), se queda en 2.50.
        // 2.515 -> último dígito es 1 (impar), sube a 2.52.
        expect(roundedAmt(2.505, 2)).toBe(2.50);
        expect(roundedAmt(2.515, 2)).toBe(2.52);
    });

    it('handles negative numbers correctly', () => {
        expect(roundedAmt(-3.14159, 2)).toBe(-3.14);
        expect(roundedAmt(-2.505, 2)).toBe(-2.50);
    });

    it('handles null, undefined, and strings gracefully', () => {
        expect(roundedAmt(null)).toBe(0);
        expect(roundedAmt(undefined)).toBe(0);
        expect(roundedAmt("10.123", 2)).toBe(10.12);
        expect(roundedAmt("invalid_string")).toBe(0);
    });
});
