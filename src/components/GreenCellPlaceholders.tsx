"use client";

import { useEffect } from "react";

/**
 * Este componente se encarga de buscar todos los inputs y selects que tengan el fondo verde (#66FF99)
 * y asignarles un placeholder automáticamente basado en el título de la columna correspondiente.
 */
export default function GreenCellPlaceholders() {
    useEffect(() => {
        const updatePlaceholders = () => {
            // Buscamos todos los elementos con clase input-field o inputs/selects directos
            const elements = document.querySelectorAll('input, select, textarea');
            
            elements.forEach((el) => {
                const htmlEl = el as HTMLElement;
                const style = window.getComputedStyle(htmlEl);
                const bgColor = style.backgroundColor;
                
                // El color #66FF99 es rgb(102, 255, 153) en computed style
                const isGreen = bgColor === 'rgb(102, 255, 153)';
                
                if (isGreen) {
                    // Intentamos encontrar el título de la columna
                    const td = htmlEl.closest('td');
                    if (td) {
                        const cellIndex = td.cellIndex;
                        const table = td.closest('table');
                        if (table) {
                            // Buscamos en el thead de la tabla
                            const thead = table.querySelector('thead');
                            if (thead) {
                                // Buscamos la fila de headers (usualmente la primera o única)
                                const headerRow = thead.querySelector('tr');
                                if (headerRow) {
                                    const ths = headerRow.cells;
                                    if (ths && ths[cellIndex]) {
                                        const title = ths[cellIndex].textContent?.trim() || "";
                                        
                                        // Filtramos títulos poco útiles como "#" o iconos
                                        if (title && title.length > 1) {
                                            // Si es un input de texto, número o fecha, usamos placeholder
                                            if (htmlEl instanceof HTMLInputElement) {
                                                // Evitamos sobreescribir si ya tiene un placeholder real que no sea "..."
                                                if (!htmlEl.placeholder || htmlEl.placeholder === "..." || htmlEl.placeholder === "Subcontratista") {
                                                    htmlEl.placeholder = title;
                                                }
                                            }
                                            
                                            // Para selects y fechas (donde placeholder no se ve), usamos title (tooltip)
                                            // y también intentamos poner el title como atributo data para CSS futuro
                                            htmlEl.setAttribute('data-placeholder', title);
                                            if (!htmlEl.title) {
                                                htmlEl.title = title;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });
        };

        // Ejecutar inicialmente después de un pequeño delay para que React renderice
        const timer = setTimeout(updatePlaceholders, 1000);

        // Usar MutationObserver para detectar cambios dinámicos (nuevas filas, cambio de tabs, etc.)
        const observer = new MutationObserver((mutations) => {
            // Debounce simple para no saturar
            updatePlaceholders();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        return () => {
            clearTimeout(timer);
            observer.disconnect();
        };
    }, []);

    return null; // Este componente no renderiza nada visualmente
}
