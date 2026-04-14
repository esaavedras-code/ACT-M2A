"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Search, TrendingUp, Info, List, ArrowUpDown } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface HistoricalItem {
    spec_num: string;
    description: string;
    avg_price: number;
    unit: string;
}

export default function PriceComparison({ projectId }: { projectId?: string }) {
    const [searchTerm, setSearchTerm] = useState("");
    const [results, setResults] = useState<HistoricalItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [contractItems, setContractItems] = useState<any[]>([]);

    useEffect(() => {
        if (projectId) fetchContractItems();
    }, [projectId]);

    const fetchContractItems = async () => {
        const { data } = await supabase.from("contract_items").select("*").eq("project_id", projectId);
        if (data) setContractItems(data);
    };

    const searchHistory = async () => {
        setLoading(true);
        // We search in the historical_prices table
        const { data, error } = await supabase
            .from("historical_prices")
            .select("*")
            .or(`spec_num.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
            .limit(10);
        
        if (data) setResults(data);
        else setResults([]);
        setLoading(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <TrendingUp className="text-primary" /> Historial de Precios
                    </h3>
                    <p className="text-xs text-slate-400 font-medium font-mono uppercase tracking-widest mt-1">Comparativa con base de datos histórica 2024</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Search Panel */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="card bg-slate-50 dark:bg-slate-800/20 border-slate-100 dark:border-slate-800">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Buscar en Historial</label>
                        <div className="relative group">
                            <input 
                                type="text" 
                                className="input-field pl-4 bg-white dark:bg-slate-950" 
                                placeholder="Espec. o Nombre..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && searchHistory()}
                            />
                        </div>
                        <button 
                            onClick={searchHistory}
                            disabled={loading || !searchTerm}
                            className="btn-primary w-full mt-3 py-2 text-xs flex items-center justify-center gap-2"
                        >
                            {loading ? "Buscando..." : "Consultar Base de Datos"}
                        </button>
                    </div>

                    <div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100/50 dark:border-blue-800/30">
                        <p className="text-[10px] text-blue-600 dark:text-blue-400 leading-relaxed italic">
                            Esta herramienta compara los precios unitarios del contrato actual con el promedio de proyectos previos (hasta mzo 2024).
                        </p>
                    </div>
                </div>

                {/* Results Panel */}
                <div className="lg:col-span-2 space-y-4">
                    {results.length > 0 ? (
                        <div className="overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 dark:bg-slate-800/50">
                                    <tr>
                                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Espec.</th>
                                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Descripción Histórica</th>
                                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Precio Prom.</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                    {results.map((item, idx) => {
                                        // Try to find matching item in current project
                                        const projectItem = contractItems.find(ci => ci.spec_num?.startsWith(item.spec_num.trim()));
                                        const diff = projectItem ? (projectItem.unit_price - item.avg_price) / item.avg_price * 100 : 0;

                                        return (
                                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                                                <td className="px-4 py-4 text-xs font-bold font-mono text-primary">{item.spec_num}</td>
                                                <td className="px-4 py-4">
                                                    <div className="text-[11px] font-medium text-slate-700 dark:text-slate-200 line-clamp-1 truncate max-w-[300px]" title={item.description}>
                                                        {item.description}
                                                    </div>
                                                    <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5">UNIDAD: {item.unit}</div>
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    <div className="text-xs font-black text-slate-900 dark:text-white">{formatCurrency(item.avg_price)}</div>
                                                    {projectItem && (
                                                        <div className={`text-[9px] font-black mt-1 ${diff > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                                            {diff > 0 ? '+' : ''}{diff.toFixed(1)}% vs Licita
                                                            <div className="text-[8px] text-slate-400 font-normal">Actual: {formatCurrency(projectItem.unit_price)}</div>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[2.5rem] bg-slate-50/20">
                            <List className="text-slate-200 dark:text-slate-800 mb-3" size={48} />
                            <p className="text-slate-400 text-sm font-medium italic">Ingresa un código de especificación para comparar...</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
