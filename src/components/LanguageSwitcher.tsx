
"use client";

import { useTranslation } from "@/lib/TranslationContext";
import { Globe } from "lucide-react";

export default function LanguageSwitcher() {
    const { lang, setLang } = useTranslation();

    return (
        <button
            onClick={() => setLang(lang === "es" ? "en" : "es")}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl transition-all text-white border border-white/20 backdrop-blur-md"
            title={lang === "es" ? "Switch to English" : "Cambiar a Español"}
        >
            <Globe size={16} className="text-blue-200" />
            <span className="text-[10px] font-black uppercase tracking-widest">
                {lang === "es" ? "ES" : "EN"}
            </span>
        </button>
    );
}
