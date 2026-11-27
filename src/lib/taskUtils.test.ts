import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
    supabase: {},
}));

import { calculateNextDueDate, formatRecurrenceLabel, previewNextDueDates } from "./taskUtils";

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

    it("calculates next due date for weekly recurrence with specific weekdays (Mon, Wed, Fri)", () => {
        // 2026-11-27 es Viernes (5) -> siguiente debe ser Lunes 2026-11-30
        const base = new Date(2026, 10, 27, 10, 0, 0);
        const next = calculateNextDueDate(base, "custom", 1, "weeks", null, {
            mode: "interval",
            weekdays: [1, 3, 5],
        });
        expect(next?.getFullYear()).toBe(2026);
        expect(next?.getMonth()).toBe(10);
        expect(next?.getDate()).toBe(30);
    });

    it("calculates day 15 of every month and clamps last day of month", () => {
        const base = new Date(2026, 10, 15, 9, 0, 0); // 15 nov 2026
        const next = calculateNextDueDate(base, "custom", 1, "months", null, {
            mode: "month_day",
            dayOfMonth: 15,
        });
        expect(next?.getFullYear()).toBe(2026);
        expect(next?.getMonth()).toBe(11);
        expect(next?.getDate()).toBe(15);

        // Último día de cada mes: 31 ene 2026 -> 28 feb 2026
        const jan31 = new Date(2026, 0, 31, 9, 0, 0);
        const febLast = calculateNextDueDate(jan31, "custom", 1, "months", null, {
            mode: "month_day",
            dayOfMonth: -1,
        });
        expect(febLast?.getFullYear()).toBe(2026);
        expect(febLast?.getMonth()).toBe(1);
        expect(febLast?.getDate()).toBe(28);
    });

    it("calculates first Tuesday of every month", () => {
        // 2026-11-27 -> primer martes siguiente es 1 dic 2026
        const base = new Date(2026, 10, 27, 12, 0, 0);
        const dates = previewNextDueDates(base, "custom", 1, "months", null, {
            mode: "month_weekday",
            ordinal: 1,
            weekday: 2, // Martes
        }, 2);
        expect(dates.length).toBe(2);
        // Dic 2026: 1 dic es martes
        expect(dates[0].getMonth()).toBe(11);
        expect(dates[0].getDate()).toBe(1);
        // Ene 2027: 5 ene es martes
        expect(dates[1].getFullYear()).toBe(2027);
        expect(dates[1].getMonth()).toBe(0);
        expect(dates[1].getDate()).toBe(5);
    });

    it("calculates Monday of the week of the third Thursday of every month", () => {
        // Nov 2026: 1er jue = 5, 2do jue = 12, 3er jue = 19 -> lunes de esa semana = 16 nov
        // Dic 2026: 1er jue = 3, 2do jue = 10, 3er jue = 17 -> lunes de esa semana = 14 dic
        const base = new Date(2026, 10, 16, 12, 0, 0); // 16 nov 2026
        const next = calculateNextDueDate(base, "custom", 1, "months", null, {
            mode: "month_relative_weekday",
            weekday: 1,       // Lunes
            ordinal: 3,       // Tercer
            anchorWeekday: 4, // Jueves
        });
        expect(next?.getFullYear()).toBe(2026);
        expect(next?.getMonth()).toBe(11);
        expect(next?.getDate()).toBe(14);
        expect(next?.getDay()).toBe(1);
    });

    it("handles relative weekday crossing month boundary (Monday of week of 1st Thursday of Oct 2026)", () => {
        // Oct 2026: 1 oct es jueves -> lunes de esa semana es 28 sep 2026
        // Nov 2026: 1er jueves es 5 nov -> lunes de esa semana es 2 nov 2026
        const octOccurrence = new Date(2026, 8, 28, 12, 0, 0); // 28 sep 2026
        const next = calculateNextDueDate(octOccurrence, "custom", 1, "months", null, {
            mode: "month_relative_weekday",
            weekday: 1,       // Lunes
            ordinal: 1,       // Primer
            anchorWeekday: 4, // Jueves
        });
        expect(next?.getFullYear()).toBe(2026);
        expect(next?.getMonth()).toBe(10); // Noviembre
        expect(next?.getDate()).toBe(2);
        expect(next?.getDay()).toBe(1);
    });

    it("calculates annual ordinal weekday (last Monday of May)", () => {
        // 2026: último lunes de mayo = 25 mayo 2026 -> siguiente es 31 mayo 2027
        const base = new Date(2026, 4, 25, 10, 0, 0);
        const next = calculateNextDueDate(base, "custom", 1, "years", null, {
            mode: "year_weekday",
            ordinal: -1,
            weekday: 1,
            month: 4, // Mayo
        });
        expect(next?.getFullYear()).toBe(2027);
        expect(next?.getMonth()).toBe(4);
        expect(next?.getDate()).toBe(31);
        expect(next?.getDay()).toBe(1);
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
        expect(formatRecurrenceLabel({
            recurrence_type: "custom",
            recurrence_interval: 1,
            recurrence_config: { mode: "month_day", dayOfMonth: 15 },
        })).toBe("Día 15 de cada mes");
        expect(formatRecurrenceLabel({
            recurrence_type: "custom",
            recurrence_interval: 1,
            recurrence_config: { mode: "month_weekday", ordinal: 1, weekday: 2 },
        })).toBe("Primer martes de cada mes");
        expect(formatRecurrenceLabel({
            recurrence_type: "custom",
            recurrence_interval: 1,
            recurrence_config: { mode: "month_relative_weekday", weekday: 1, ordinal: 3, anchorWeekday: 4 },
        })).toBe("Lunes (sem. 3.º jueves, cada mes)");
    });
});
