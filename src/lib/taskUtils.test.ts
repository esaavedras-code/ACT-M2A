import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
    supabase: {},
}));

import { calculateNextDueDate, formatRecurrenceLabel } from "./taskUtils";

describe("taskUtils recurrence helpers", () => {
    it("calculates next due date for daily recurrence (24h per day)", () => {
        const next = calculateNextDueDate("2026-11-25T10:00:00.000Z", "daily", 1, "days");
        expect(next?.toISOString()).toBe("2026-11-26T10:00:00.000Z");
    });

    it("calculates next due date for weekly recurrence", () => {
        const next = calculateNextDueDate("2026-11-25T10:00:00.000Z", "weekly", 1, "weeks");
        expect(next?.toISOString()).toBe("2026-12-02T10:00:00.000Z");
    });

    it("calculates next due date for custom recurrence (every 3 days)", () => {
        const next = calculateNextDueDate("2026-11-25T10:00:00.000Z", "custom", 3, "days");
        expect(next?.toISOString()).toBe("2026-11-28T10:00:00.000Z");
    });

    it("calculates next due date for custom recurrence (every 2 months)", () => {
        const next = calculateNextDueDate("2026-01-15T10:00:00.000Z", "custom", 2, "months");
        expect(next?.toISOString().split("T")[0]).toBe("2026-03-15");
    });

    it("respects recurrence_end_date and returns null when exceeded", () => {
        const next = calculateNextDueDate("2026-11-25T10:00:00.000Z", "custom", 10, "days", "2026-11-30");
        expect(next).toBeNull();
    });

    it("formats recurrence labels in Spanish", () => {
        expect(formatRecurrenceLabel({ recurrence_type: "none" })).toBeNull();
        expect(formatRecurrenceLabel({ recurrence_type: "daily" })).toBe("Diario");
        expect(formatRecurrenceLabel({ recurrence_type: "custom", recurrence_interval: 5, recurrence_unit: "days" })).toBe("Cada 5 días");
        expect(formatRecurrenceLabel({ recurrence_type: "custom", recurrence_interval: 2, recurrence_unit: "weeks" })).toBe("Cada 2 semanas");
    });
});
