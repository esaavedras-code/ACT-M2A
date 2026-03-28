"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RefreshButton() {
    const router = useRouter();
    const [spinning, setSpinning] = useState(false);

    const handleRefresh = () => {
        setSpinning(true);
        router.refresh();
        setTimeout(() => setSpinning(false), 1000);
    };

    return (
        <button 
            onClick={handleRefresh} 
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600/50 hover:bg-blue-500 rounded-full transition-all text-white font-black text-[10px] uppercase tracking-widest border border-blue-400 border-opacity-30"
            title="Refrescar Datos de la Aplicación"
        >
            <RefreshCw size={14} className={spinning ? "animate-spin" : ""} />
            <span className="hidden md:inline">Actualizar</span>
        </button>
    );
}
