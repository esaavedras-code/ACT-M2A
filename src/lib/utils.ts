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

/**
 * Elimina los ceros a la izquierda de un número de item para su visualización.
 * Maneja casos simples ("007" → "7") y con prefijo de texto ("pt. 004" → "pt. 4").
 * No modifica el valor almacenado en BD, solo es para mostrar en pantalla.
 */
export function stripLeadingZeros(itemNum: string | number | null | undefined): string {
    if (itemNum === null || itemNum === undefined) return '';
    const str = String(itemNum).trim();
    if (!str) return str;
    // Si tiene prefijo de texto (ej: "pt. 004", "Pt. 002"), preserva el prefijo
    const match = str.match(/^([a-zA-Z\s.]*?)(\d+)(.*)$/);
    if (match) {
        const prefix = match[1];
        const num = parseInt(match[2], 10);
        const suffix = match[3];
        return `${prefix}${isNaN(num) ? match[2] : num}${suffix}`;
    }
    return str;
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
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
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

/**
 * Formato estandarizado para números de proyecto: AC-XXXXXX
 * cleanSuffix: Si es true, quita las letras A o C finales que se usan internamente
 */
export function formatProjectNumber(value: string | null | undefined, cleanSuffix = false): string {
    if (!value) return "";
    let cleanValue = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    
    // Si ya tiene el prefijo AC o similares, lo limpia temporalmente para procesar el cuerpo
    if (cleanValue.startsWith("AC")) {
        cleanValue = cleanValue.substring(2);
    }

    if (cleanSuffix) {
        // Quita 'C' o 'A' si están al final (usados para duplicados entre Contratista/ACT)
        if (cleanValue.endsWith("C") || cleanValue.endsWith("A")) {
            cleanValue = cleanValue.substring(0, cleanValue.length - 1);
        }
    }

    return `AC-${cleanValue}`;
}

/**
 * Ordena un arreglo de items de forma natural basándose en item_num.
 * Permite que "2" aparezca antes que "10".
 */
export function sortItemsNaturally(items: any[]): any[] {
    return [...items].sort((a, b) => {
        const numA = (a.item_num || "").toString().replace(/[^0-9]/g, '');
        const numB = (b.item_num || "").toString().replace(/[^0-9]/g, '');
        const parsedA = parseInt(numA || '0');
        const parsedB = parseInt(numB || '0');
        if (parsedA !== parsedB) return parsedA - parsedB;
        return (a.item_num || "").localeCompare(b.item_num || "");
    });
}

/**
 * Elimina duplicados por item_num y ordena de forma natural.
 * Si se encuentran duplicados, se suman las cantidades y montos si existen.
 */
export function uniqueSortItems(items: any[]): any[] {
    const map = new Map<string, any>();
    items.forEach(it => {
        const key = (it.item_num || "").toString().trim();
        if (!key) return;
        if (map.has(key)) {
            const existing = map.get(key);
            // Consolidar cantidades si son numéricas
            if (it.quantity != null) {
                const q1 = parseFloat(existing.quantity) || 0;
                const q2 = parseFloat(it.quantity) || 0;
                existing.quantity = q1 + q2;
            }
            // Consolidar cambios propuestos (específico de CHOs)
            if (it.proposed_change != null) {
                const p1 = parseFloat(existing.proposed_change) || 0;
                const p2 = parseFloat(it.proposed_change) || 0;
                existing.proposed_change = p1 + p2;
            }
            // Consolidar montos (amount) si existen
            if (it.amount != null) {
                const a1 = parseFloat(existing.amount) || 0;
                const a2 = parseFloat(it.amount) || 0;
                existing.amount = a1 + a2;
            }
        } else {
            map.set(key, { ...it });
        }
    });
    return sortItemsNaturally(Array.from(map.values()));
}

/**
 * Formats an item number by removing leading zeros.
 * For example: "002" becomes "2", "02A" becomes "2A", "000" remains "0".
 */
export function formatItemNum(num: string | number | null | undefined): string {
    if (num === null || num === undefined) return '';
    return num.toString().replace(/^0+(?!$)/, '');
}

/**
 * Obtiene el porcentaje de participación federal para un proyecto o item específico.
 * Prioriza la configuración individual del proyecto.
 */
export function getFederalSharePct(project: any, item?: any): number {
    // 1. Si el item tiene un porcentaje explícito en un campo numérico
    if (item && item.federal_share_pct != null) {
        const val = parseFloat(item.federal_share_pct);
        if (!isNaN(val)) return val;
    }
    
    // 2. Analizar el fund_source del ítem (ej: "FHWA:100%", "ACT:100%", "FHWA:80%")
    if (item && item.fund_source) {
        const source = item.fund_source.trim().toUpperCase();
        
        // Si el fondo es puramente estatal
        if (source.includes("ACT") && (source.includes("100") || !source.includes("FHWA"))) {
            return 0;
        }

        // Buscar un porcentaje explícito en el string (ej: "80%", "80.25%", "100%")
        const match = source.match(/(\d+(\.\d+)?)\s*%/);
        if (match) {
            return parseFloat(match[1]);
        }

        // Si solo dice FHWA sin porcentaje, usamos el valor del proyecto o el estándar
        if (source.includes("FHWA")) {
             const projPct = project?.federal_share_pct != null ? parseFloat(project.federal_share_pct) : 80.25;
             return isNaN(projPct) ? 80.25 : projPct;
        }
    }

    // 3. Porcentaje del proyecto como base si no hay información en el ítem
    if (project && project.federal_share_pct != null) {
        const projPct = parseFloat(project.federal_share_pct);
        if (!isNaN(projPct)) return projPct;
    }

    return 80.25;
}

/**
 * Genera el nombre del archivo del reporte siguiendo el formato: ACXXXXXX-YYMM-RRRRRRRR
 * @param projectNum Número del proyecto (ej: AC-123456)
 * @param reportName Nombre del reporte (ej: ROA, ACT-117C)
 */
export function getReportFileName(projectNum: string, reportName: string): string {
    const cleanNum = (projectNum || "").replace(/[^0-9]/g, '');
    const cleanReportName = (reportName || "").replace(/\s+/g, '_').toUpperCase();
    return `AC-${cleanNum}-${cleanReportName}`;
}

export function formatQuantity(value: number | string | null | undefined): string {
    const numericValue = typeof value === 'string' ? parseFloat(value) : value;
    if (numericValue === null || numericValue === undefined || isNaN(numericValue)) return '-';
    if (numericValue === 0) return '0.00';
    const formatted = Math.abs(numericValue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
    return numericValue < 0 ? `(${formatted})` : formatted;
}

/**
 * Normaliza las fuentes de fondos para evitar grupos duplicados causados por inconsistencias de tipeo.
 * Ej: "ACT 100%" y "ACT: 100%" y "ACT:100%" se normalizan a "ACT:100%"
 */
export function normalizeFundSource(source: string | null | undefined): string {
    if (!source) return "N/A";
    const cleaned = source.trim().toUpperCase();
    if (cleaned === "ACT 100%" || cleaned === "ACT:100%" || cleaned === "ACT: 100%") {
        return "ACT:100%";
    }
    if (cleaned === "FHWA 100%" || cleaned === "FHWA:100%" || cleaned === "FHWA: 100%") {
        return "FHWA:100%";
    }
    if (cleaned === "FHWA 80.25" || cleaned === "FHWA:80.25" || cleaned === "FHWA: 80.25" || cleaned === "FHWA:80.25%") {
        return "FHWA:80.25";
    }
    return source.trim();
}

