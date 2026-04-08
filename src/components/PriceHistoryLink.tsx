"use client";

import Link from "next/link";

export default function PriceHistoryLink() {
    return (
        <Link 
            href="/precios" 
            onClick={(e) => { 
                e.preventDefault(); 
                alert("Esta sección de 'Historial de precios' se encuentra actualmente EN CONSTRUCCIÓN."); 
            }}
            className="text-[8px] xl:text-[10px] font-black uppercase tracking-[0.05em] xl:tracking-[0.1em] hover:text-blue-200 transition-colors shrink-0 leading-tight flex items-center gap-2"
        >
            <span>Historial de precios <br /> de la ACT</span>
            <span className="bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded text-[7px] font-black uppercase">WIP</span>
        </Link>
    );
}
