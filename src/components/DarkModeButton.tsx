"use client";

import { useTheme } from "@/lib/ThemeContext";

export default function DarkModeButton() {
    const { isDark, toggleTheme } = useTheme();

    return (
        <button
            id="dark-mode-toggle"
            onClick={toggleTheme}
            title={isDark ? "Cambiar a modo claro" : "Cambiar a modo nocturno"}
            aria-label={isDark ? "Activar modo claro" : "Activar modo nocturno"}
            className={`
                relative flex items-center justify-center
                w-9 h-9 rounded-xl
                transition-all duration-300 ease-in-out
                focus:outline-none focus:ring-2 focus:ring-white/50
                active:scale-90
                ${isDark
                    ? "bg-yellow-400/20 hover:bg-yellow-400/35 text-yellow-300"
                    : "bg-white/15 hover:bg-white/25 text-white"
                }
            `}
        >
            {/* Ícono Sol (modo claro activo → mostrar luna para cambiar) */}
            <span
                className={`
                    absolute inset-0 flex items-center justify-center
                    transition-all duration-300
                    ${isDark ? "opacity-100 scale-100 rotate-0" : "opacity-0 scale-50 rotate-90"}
                `}
            >
                {/* Sol */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.592-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.591 1.591z" />
                </svg>
            </span>

            {/* Ícono Luna (modo nocturno activo → mostrar sol) */}
            <span
                className={`
                    absolute inset-0 flex items-center justify-center
                    transition-all duration-300
                    ${isDark ? "opacity-0 scale-50 -rotate-90" : "opacity-100 scale-100 rotate-0"}
                `}
            >
                {/* Luna */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" />
                </svg>
            </span>
        </button>
    );
}
