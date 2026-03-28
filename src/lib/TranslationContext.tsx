
"use client";

import { createContext, useContext, useState, useEffect } from "react";

const translations = {
    es: {
        dashboard: "Panel de Control",
        projects: "Proyectos",
        priceHistory: "Historial de Precios",
        settings: "Configuración",
        logout: "Cerrar Sesión",
        newProject: "Nuevo Proyecto",
        openProject: "Abrir Proyecto",
        dashboardTitleDescription: "Panel central de control y monitoreo de obras.",
        loading: "Cargando...",
        save: "Guardar",
        delete: "Eliminar",
        cancel: "Cancelar",
        printPdf: "Imprimir PDF",
        weeklyMinutes: "Minuta Semanal",
        dailyLog: "Informe Diario",
        summary: "Resumen",
        contractor: "Contratista",
        items: "Partidas",
        payments: "Pagos",
        status: "Estado",
        budget: "Presupuesto",
        certified: "Certificado",
        balance: "Balance",
    },
    en: {
        dashboard: "Dashboard",
        projects: "Projects",
        priceHistory: "Price History",
        settings: "Settings",
        logout: "Log Out",
        newProject: "New Project",
        openProject: "Open Project",
        dashboardTitleDescription: "Central panel for control and monitoring of works.",
        loading: "Loading...",
        save: "Save",
        delete: "Delete",
        cancel: "Cancel",
        printPdf: "Print PDF",
        weeklyMinutes: "Weekly Minutes",
        dailyLog: "Daily Log",
        summary: "Summary",
        contractor: "Contractor",
        items: "Items",
        payments: "Payments",
        status: "Status",
        budget: "Budget",
        certified: "Certified",
        balance: "Balance",
    }
};

type Language = "es" | "en";

const TranslationContext = createContext({
    lang: "es" as Language,
    setLang: (lang: Language) => {},
    t: (key: keyof typeof translations.es): string => ""
});

export function TranslationProvider({ children }: { children: React.ReactNode }) {
    const [lang, setLang] = useState<Language>("es");

    useEffect(() => {
        try {
            const saved = localStorage.getItem("pact_lang") as Language;
            if (saved) setLang(saved);
        } catch (e) {
            console.warn("Storage access denied:", e);
        }
    }, []);

    const changeLang = (l: Language) => {
        setLang(l);
        try {
            localStorage.setItem("pact_lang", l);
        } catch (e) {
            console.warn("Storage access denied:", e);
        }
    };

    const t = (key: keyof typeof translations.es) => {
        return translations[lang][key] || key;
    };

    return (
        <TranslationContext.Provider value={{ lang, setLang: changeLang, t }}>
            {children}
        </TranslationContext.Provider>
    );
}

export function useTranslation() {
    return useContext(TranslationContext);
}
