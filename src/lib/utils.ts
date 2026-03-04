export function formatCurrency(value: number | string | null | undefined, decimals = 2): string {
    const numericValue = typeof value === 'string' ? parseFloat(value) : value;
    if (numericValue === null || numericValue === undefined || isNaN(numericValue)) {
        return '$0.00';
    }
    return numericValue.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
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
