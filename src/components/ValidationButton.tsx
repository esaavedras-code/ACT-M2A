"use client";

import { CheckCircle } from "lucide-react";

export default function ValidationButton() {
    const handleValidate = () => {
        // Find all inputs, selects, textareas
        const elements = document.querySelectorAll("input, select, textarea");
        const missingFields: HTMLElement[] = [];

        elements.forEach((el) => {
            const htmlEl = el as HTMLElement;
            const style = window.getComputedStyle(htmlEl);
            
            // Check if it's the specific green color (#66FF99 -> rgb(102, 255, 153))
            // Sometimes it comes back as rgba or simply check if color matches
            if (style.backgroundColor === "rgb(102, 255, 153)" || style.backgroundColor === "#66FF99" || style.backgroundColor === "rgba(102, 255, 153, 1)") {
                const val = (htmlEl as HTMLInputElement).value;
                if (!val || val.trim() === "" || val === "0" || val === "$0.00" || val === "$ 0.00") {
                    missingFields.push(htmlEl);
                }
            }
        });

        if (missingFields.length > 0) {
            // Highlight them temporarily
            missingFields.forEach((el) => {
                const originalBorder = el.style.border;
                el.style.border = "2px solid red";
                setTimeout(() => {
                    el.style.border = originalBorder;
                }, 3000);
            });

            alert(`Faltan ${missingFields.length} campos verdes por llenar en esta sección. Fueron marcados en rojo temporalmente.`);
        } else {
            alert("¡Todos los campos verdes de esta sección están completados correctamente!");
        }
    };

    return (
        <button
            onClick={handleValidate}
            className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-lg text-sm font-medium transition-colors border border-emerald-200 dark:border-emerald-800/30"
            title="Validar completitud"
        >
            <CheckCircle size={16} />
            <span className="hidden sm:inline">Validar</span>
        </button>
    );
}
