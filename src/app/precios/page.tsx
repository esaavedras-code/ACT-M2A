"use client";

import PriceComparison from "@/components/PriceComparison";
import { TrendingUp } from "lucide-react";

export default function GlobalPriceHistoryPage() {
    return (
        <div className="py-8 space-y-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-4">
                        <TrendingUp size={36} className="text-primary" />
                        Historial de Precios
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">Buscador global de precios unitarios históricos (ACT 2024).</p>
                </div>
            </div>

            <div className="card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-8 rounded-[2rem]">
                <PriceComparison />
            </div>
        </div>
    );
}
