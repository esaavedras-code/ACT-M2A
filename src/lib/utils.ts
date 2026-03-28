/**
 * Tradución de la función VBA RoundedAmt para redondeo bancario específico (Banker's Rounding variant)
 * Utilizada para cálculos de dinero en todo el programa.
 */
export function roundedAmt(value: number | string | null | undefined, digits: number = 2): number {
    if (value === null || value === undefined) return 0;

    let valStr = String(value).trim();
    let val = parseFloat(valStr);

    if (isNaN(val)) return 0;

    const sign = val < 0 ? -1 : 1;
    const absValStr = String(Math.abs(val));
    const dotIndex = absValStr.indexOf('.');

    if (dotIndex === -1) return val; // No hay punto decimal

    const dgtsAfterDot = absValStr.length - dotIndex - 1;
    if (dgtsAfterDot <= digits) return val; // No necesita redondearse

    const lastDigitsCount = dgtsAfterDot - digits;
    const absVal = Math.abs(val);
    const factor = Math.pow(10, digits);

    if (lastDigitsCount === 1) {
        const firstFigDropped = parseInt(absValStr.charAt(absValStr.length - 1));
        const lastFigKept = parseInt(absValStr.charAt(absValStr.length - 2));

        if (firstFigDropped < 5) {
            return (Math.floor(absVal * factor) / factor) * sign;
        } else if (firstFigDropped === 5) {
            if (lastFigKept % 2 === 0) {
                return (Math.floor(absVal * factor) / factor) * sign;
            } else {
                return ((Math.floor(absVal * factor) + 1) / factor) * sign;
            }
        } else {
            return ((Math.floor(absVal * factor) + 1) / factor) * sign;
        }
    } else { // lastDigitsCount > 1
        const firstFigDropped = parseInt(absValStr.charAt(dotIndex + digits + 1));
        if (firstFigDropped < 5) {
            return (Math.floor(absVal * factor) / factor) * sign;
        } else {
            return ((Math.floor(absVal * factor) + 1) / factor) * sign;
        }
    }
}

export function formatCurrency(value: number | string | null | undefined, decimals = 2): string {
    const numericValue = typeof value === 'string' ? parseFloat(value) : value;
    if (numericValue === null || numericValue === undefined || isNaN(numericValue)) {
        return '$0.00';
    }

    // Aplicamos el redondeo específico antes de formatear
    const roundedValue = roundedAmt(numericValue, decimals);
    const absValue = Math.abs(roundedValue);

    const formatted = absValue.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    if (roundedValue < 0) {
        return `(${formatted})`;
    }
    return formatted;
}

export function formatNumber(value: number | string | null | undefined, decimals = 2): string {
    const numericValue = typeof value === 'string' ? parseFloat(value) : value;
    if (numericValue === null || numericValue === undefined || isNaN(numericValue)) {
        return '0.00';
    }
    const roundedValue = roundedAmt(numericValue, decimals);
    return roundedValue.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

export function formatPhoneNumber(value: string | null | undefined): string {
    if (!value) return "";
    const phoneNumber = value.replace(/[^\d]/g, "");
    const phoneNumberLength = phoneNumber.length;
    if (phoneNumberLength < 4) return phoneNumber;
    if (phoneNumberLength < 7) {
        return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
    }
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
}

/**
 * Formato de fecha estandarizado: mm/dd/yyyy
 */
export function formatDate(date: string | Date | null | undefined): string {
    if (!date) return "N/A";

    let d: Date;
    if (typeof date === 'string') {
        // Manejar formato YYYY-MM-DD directamente para evitar desfases de zona horaria
        if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            const [year, month, day] = date.split("-");
            return `${month}/${day}/${year}`;
        }
        d = new Date(date);
    } else {
        d = date;
    }

    if (isNaN(d.getTime())) return "N/A";

    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${month}/${day}/${year}`;
}

/**
 * Obtiene un valor de localStorage o sessionStorage de forma segura.
 */
export function getLocalStorageItem(key: string): string | null {
    if (typeof window === 'undefined') return null;
    try {
        return localStorage.getItem(key) || sessionStorage.getItem(key);
    } catch (e) {
        console.warn("Storage access denied:", e);
        return null;
    }
}

/**
 * Guarda un valor en localStorage o sessionStorage según la preferencia del usuario de forma segura.
 */
export function setLocalStorageItem(key: string, value: string): void {
    if (typeof window === 'undefined') return;
    try {
        const keepConnected = localStorage.getItem('pact_keep_connected') === 'true';
        if (keepConnected) {
            localStorage.setItem(key, value);
            sessionStorage.removeItem(key);
        } else {
            sessionStorage.setItem(key, value);
            localStorage.removeItem(key);
        }
    } catch (e) {
        console.warn("Storage access denied:", e);
    }
}
