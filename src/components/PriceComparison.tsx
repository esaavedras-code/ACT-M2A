"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { TrendingUp, TrendingDown, Minus, BarChart3, Filter, ArrowUpDown, ChevronDown, ChevronUp, Info, List } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface HistoricalItem {
    spec_num: string;
    description: string;
    avg_price: number;
    min_price: number;
    max_price: number;
    unit: string;
    sample_count: number;
    latest_date: string;
    contractor_count: number;
}

interface ContractItem {
    id: string;
    item_num: string;
    specification: string;
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
}

type SortField = 'spec' | 'description' | 'avg_price' | 'diff';
type SortDir = 'asc' | 'desc';

export default function PriceComparison({ projectId }: { projectId?: string }) {
    const [searchTerm, setSearchTerm] = useState("");
    const [historyData, setHistoryData] = useState<HistoricalItem[]>([]);
    const [contractItems, setContractItems] = useState<ContractItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortField, setSortField] = useState<SortField>('spec');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [showOnlyMatched, setShowOnlyMatched] = useState(false);
    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const [visibleCount, setVisibleCount] = useState(50);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Load historical data from static JSON + contract items from Supabase
    useEffect(() => {
        const loadAll = async () => {
            setLoading(true);
            try {
                // Load static JSON with 9,488 historical items
                const res = await fetch('/items_history.json');
                const data: HistoricalItem[] = await res.json();
                setHistoryData(data);
            } catch (err) {
                console.error("Error loading historical data:", err);
            }

            if (projectId) {
                const { data } = await supabase
                    .from("contract_items")
                    .select("id, item_num, specification, description, quantity, unit, unit_price")
                    .eq("project_id", projectId)
                    .order("item_num");
                if (data) setContractItems(data);
            }
            setLoading(false);
        };
        loadAll();
    }, [projectId]);

    // Find matching contract item for a given historical spec
    const findContractMatch = (specNum: string): ContractItem | null => {
        const cleanSpec = specNum.trim().replace(/\s+/g, '');
        return contractItems.find(ci => {
            const ciSpec = (ci.specification || ci.item_num || '').trim().replace(/\s+/g, '');
            return ciSpec === cleanSpec || ciSpec.startsWith(cleanSpec) || cleanSpec.startsWith(ciSpec);
        }) || null;
    };

    // Filter and sort results
    const filteredResults = useMemo(() => {
        let results = historyData;

        // Search filter
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase().trim();
            results = results.filter(item =>
                item.spec_num.toLowerCase().includes(term) ||
                item.description.toLowerCase().includes(term)
            );
        }

        // Show only items that match the project contract
        if (showOnlyMatched) {
            results = results.filter(item => findContractMatch(item.spec_num) !== null);
        }

        // Sort
        results = [...results].sort((a, b) => {
            let cmp = 0;
            switch (sortField) {
                case 'spec':
                    cmp = a.spec_num.localeCompare(b.spec_num);
                    break;
                case 'description':
                    cmp = a.description.localeCompare(b.description);
                    break;
                case 'avg_price':
                    cmp = a.avg_price - b.avg_price;
                    break;
                case 'diff': {
                    const matchA = findContractMatch(a.spec_num);
                    const matchB = findContractMatch(b.spec_num);
                    const diffA = matchA ? ((matchA.unit_price - a.avg_price) / a.avg_price * 100) : -9999;
                    const diffB = matchB ? ((matchB.unit_price - b.avg_price) / b.avg_price * 100) : -9999;
                    cmp = diffA - diffB;
                    break;
                }
            }
            return sortDir === 'asc' ? cmp : -cmp;
        });

        return results;
    }, [historyData, searchTerm, showOnlyMatched, sortField, sortDir, contractItems]);

    const visibleResults = filteredResults.slice(0, visibleCount);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('asc');
        }
    };

    const SortIcon = ({ field }: { field: SortField }) => (
        sortField === field
            ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
            : <ArrowUpDown size={10} className="opacity-30" />
    );

    // Stats
    const matchedCount = useMemo(() =>
        historyData.filter(item => findContractMatch(item.spec_num) !== null).length
    , [historyData, contractItems]);

    if (loading) {
        return (
            <div className="w-full py-20 flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-[10px] font-black tracking-widest uppercase text-slate-400">Cargando base de datos histórica...</p>
            </div>
        );
    }

    return (
        <div className="w-full space-y-8">
            {/* Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Base Histórica</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{historyData.length.toLocaleString()}</p>
                    <p className="text-[9px] text-slate-400 font-bold">items únicos</p>
                </div>
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Contrato Actual</p>
                    <p className="text-2xl font-black text-blue-600 mt-1">{contractItems.length}</p>
                    <p className="text-[9px] text-slate-400 font-bold">partidas del proyecto</p>
                </div>
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Coincidencias</p>
                    <p className="text-2xl font-black text-emerald-600 mt-1">{matchedCount}</p>
                    <p className="text-[9px] text-slate-400 font-bold">items comparables</p>
                </div>
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Resultados</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{filteredResults.length.toLocaleString()}</p>
                    <p className="text-[9px] text-slate-400 font-bold">con filtro actual</p>
                </div>
            </div>

            {/* Search & Filters */}
            <div className="flex flex-col md:flex-row gap-4 items-stretch">
                <div className="flex-1">
                    <input
                        type="text"
                        className="input-field pl-5 bg-white dark:bg-slate-950 text-sm w-full"
                        placeholder="Buscar por código de especificación o descripción del item..."
                        value={searchTerm}
                        onChange={e => { setSearchTerm(e.target.value); setVisibleCount(50); }}
                    />
                </div>
                <button
                    onClick={() => { setShowOnlyMatched(!showOnlyMatched); setVisibleCount(50); }}
                    className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 transition-all whitespace-nowrap ${
                        showOnlyMatched
                            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-emerald-300'
                    }`}
                >
                    <Filter size={14} /> {showOnlyMatched ? 'Mostrando Coincidencias' : 'Solo del Contrato'}
                </button>
            </div>

            {/* Results Table */}
            <div ref={scrollRef} className="overflow-x-auto rounded-[2rem] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg">
                <table className="w-full text-left min-w-[800px]">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/60 text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 border-b border-slate-100 dark:border-slate-800">
                            <th className="px-5 py-4 cursor-pointer hover:text-slate-600 transition-colors" onClick={() => handleSort('spec')}>
                                <span className="flex items-center gap-1">Espec. <SortIcon field="spec" /></span>
                            </th>
                            <th className="px-5 py-4 cursor-pointer hover:text-slate-600 transition-colors" onClick={() => handleSort('description')}>
                                <span className="flex items-center gap-1">Descripción <SortIcon field="description" /></span>
                            </th>
                            <th className="px-5 py-4">Unidad</th>
                            <th className="px-5 py-4 text-right cursor-pointer hover:text-slate-600 transition-colors" onClick={() => handleSort('avg_price')}>
                                <span className="flex items-center justify-end gap-1">Precio Histórico <SortIcon field="avg_price" /></span>
                            </th>
                            <th className="px-5 py-4 text-right">Precio Contratista</th>
                            <th className="px-5 py-4 text-right cursor-pointer hover:text-slate-600 transition-colors" onClick={() => handleSort('diff')}>
                                <span className="flex items-center justify-end gap-1">Diferencia <SortIcon field="diff" /></span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                        {visibleResults.length > 0 ? visibleResults.map((item) => {
                            const match = findContractMatch(item.spec_num);
                            const diff = match ? ((match.unit_price - item.avg_price) / item.avg_price * 100) : null;
                            const isExpanded = expandedRow === item.spec_num;

                            return (
                                <tr key={item.spec_num} className="group">
                                    <td colSpan={6} className="p-0">
                                        <div
                                            className={`grid grid-cols-[auto_1fr_auto_auto_auto_auto] min-w-[800px] items-center cursor-pointer transition-colors ${
                                                match ? 'hover:bg-blue-50/50 dark:hover:bg-blue-900/10' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
                                            }`}
                                            onClick={() => setExpandedRow(isExpanded ? null : item.spec_num)}
                                        >
                                            {/* Spec */}
                                            <div className="px-5 py-4">
                                                <span className={`text-xs font-black font-mono ${match ? 'text-blue-600' : 'text-slate-500'}`}>
                                                    {item.spec_num}
                                                </span>
                                            </div>
                                            {/* Description */}
                                            <div className="px-5 py-4">
                                                <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[350px]" title={item.description}>
                                                    {item.description}
                                                </div>
                                                <div className="text-[9px] text-slate-400 font-bold mt-0.5">
                                                    {item.sample_count} muestras · {item.contractor_count} contratistas
                                                </div>
                                            </div>
                                            {/* Unit */}
                                            <div className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase">{item.unit}</div>
                                            {/* Avg Price */}
                                            <div className="px-5 py-4 text-right">
                                                <div className="text-xs font-black text-slate-900 dark:text-white">{formatCurrency(item.avg_price)}</div>
                                                <div className="text-[8px] text-slate-400 font-bold mt-0.5">
                                                    {formatCurrency(item.min_price)} — {formatCurrency(item.max_price)}
                                                </div>
                                            </div>
                                            {/* Contract Price */}
                                            <div className="px-5 py-4 text-right">
                                                {match ? (
                                                    <div className="text-xs font-black text-blue-600">{formatCurrency(match.unit_price)}</div>
                                                ) : (
                                                    <div className="text-[10px] text-slate-300 italic font-bold">—</div>
                                                )}
                                            </div>
                                            {/* Diff */}
                                            <div className="px-5 py-4 text-right min-w-[100px]">
                                                {diff !== null ? (
                                                    <div className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-black ${
                                                        diff > 10
                                                            ? 'bg-red-50 dark:bg-red-900/20 text-red-600'
                                                            : diff < -10
                                                            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600'
                                                            : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600'
                                                    }`}>
                                                        {diff > 5 ? <TrendingUp size={12} /> : diff < -5 ? <TrendingDown size={12} /> : <Minus size={12} />}
                                                        {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-slate-300 italic">N/A</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Expanded Details */}
                                        {isExpanded && (
                                            <div className="px-8 pb-6 pt-2 bg-slate-50/80 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-top duration-200">
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                                    <div>
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Precio Mínimo Hist.</p>
                                                        <p className="text-sm font-black text-emerald-600">{formatCurrency(item.min_price)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Precio Máximo Hist.</p>
                                                        <p className="text-sm font-black text-red-500">{formatCurrency(item.max_price)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Precio Promedio</p>
                                                        <p className="text-sm font-black text-slate-900 dark:text-white">{formatCurrency(item.avg_price)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Última Fecha</p>
                                                        <p className="text-sm font-black text-slate-600 dark:text-slate-300">{item.latest_date || '—'}</p>
                                                    </div>
                                                </div>
                                                {match && (
                                                    <div className="mt-6 p-5 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-800/50">
                                                        <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-2">Partida del Contrato Actual</p>
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                            <div>
                                                                <span className="text-[9px] text-blue-400 font-bold block">Item #</span>
                                                                <span className="font-black text-blue-900 dark:text-blue-200">{match.item_num}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-[9px] text-blue-400 font-bold block">Descripción</span>
                                                                <span className="font-bold text-blue-800 dark:text-blue-300 text-[11px]">{match.description}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-[9px] text-blue-400 font-bold block">Cantidad</span>
                                                                <span className="font-black text-blue-900 dark:text-blue-200">{match.quantity} {match.unit}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-[9px] text-blue-400 font-bold block">Precio Contratista</span>
                                                                <span className="font-black text-blue-600 text-lg">{formatCurrency(match.unit_price)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        }) : (
                            <tr>
                                <td colSpan={6} className="px-8 py-20 text-center">
                                    <List className="text-slate-200 dark:text-slate-700 mx-auto mb-4" size={48} />
                                    <p className="text-slate-400 font-bold italic text-sm">
                                        {searchTerm ? 'No se encontraron items con ese criterio de búsqueda.' : 'Ingrese un código o descripción para buscar en el historial.'}
                                    </p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Load More */}
            {visibleCount < filteredResults.length && (
                <div className="text-center">
                    <button
                        onClick={() => setVisibleCount(prev => prev + 50)}
                        className="px-8 py-3 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-all"
                    >
                        Cargar más resultados ({filteredResults.length - visibleCount} restantes)
                    </button>
                </div>
            )}

            {/* Info Footer */}
            <div className="flex items-start gap-3 bg-blue-50/50 dark:bg-blue-900/10 p-5 rounded-2xl border border-blue-100/50 dark:border-blue-800/30">
                <Info size={16} className="text-blue-500 mt-0.5 shrink-0" />
                <div className="text-[10px] text-blue-600 dark:text-blue-400 leading-relaxed space-y-1">
                    <p className="font-bold">Base de datos: Historial de Items de Carreteras ACT (hasta marzo 2024)</p>
                    <p>Los precios mostrados son promedios históricos de {historyData.reduce((s, i) => s + i.sample_count, 0).toLocaleString()} registros de licitaciones.
                    El indicador <span className="text-red-500 font-black">rojo ↑</span> señala que el contratista cotiza por encima del histórico.
                    El indicador <span className="text-emerald-500 font-black">verde ↓</span> señala que cotiza por debajo.</p>
                </div>
            </div>
        </div>
    );
}
