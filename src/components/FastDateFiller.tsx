"use client";

import { useEffect, useState } from "react";
import { Calendar } from "lucide-react";

export default function FastDateFiller() {
    const [hasDateInputs, setHasDateInputs] = useState(false);

    useEffect(() => {
        const checkInputs = () => {
            const dateInputs = document.querySelectorAll('input[type="date"]');
            setHasDateInputs(dateInputs.length > 0);
        };

        checkInputs();
        const observer = new MutationObserver(checkInputs);
        observer.observe(document.body, { childList: true, subtree: true });

        return () => observer.disconnect();
    }, []);

    const fillTodayAll = () => {
        // Enforce native UI time for format compatibility
        const todayUrl = new Date().toLocaleDateString('en-CA'); // 'en-CA' safely produces YYYY-MM-DD
        const today = new Date().toISOString().split('T')[0];

        const finalToday = todayUrl.includes('-') ? todayUrl : today;

        const dateInputs = document.querySelectorAll('input[type="date"]');
        
        dateInputs.forEach(input => {
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
            if (nativeInputValueSetter && input instanceof HTMLInputElement) {
                nativeInputValueSetter.call(input, finalToday);
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    };

    if (!hasDateInputs) return null;

    return (
        <button
            onClick={(e) => {
                e.preventDefault();
                fillTodayAll();
            }}
            className="fixed bottom-24 left-4 md:left-8 z-[70] flex items-center gap-2 px-4 py-3 bg-emerald-600/90 hover:bg-emerald-600 text-white rounded-full shadow-lg hover:shadow-emerald-500/30 transition-all hover:scale-105 active:scale-95 group border border-white/10 backdrop-blur-sm"
            title="Llenar todas las fechas con la fecha actual"
        >
            <Calendar size={18} className="drop-shadow-sm" />
            <span className="text-[10px] font-black uppercase tracking-wider overflow-hidden w-0 opacity-0 group-hover:w-auto group-hover:opacity-100 transition-all duration-300">
                Hoy
            </span>
        </button>
    );
}
