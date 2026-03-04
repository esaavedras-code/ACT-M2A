"use client";

import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/lib/supabase";
import { Save, FileEdit, Plus, Trash2, DollarSign, Activity, Timer } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import specsData from "@/data/specifications.json";
import type { FormRef } from "./ProjectForm";

const specs = specsData as Record<string, { unit: string; description: string }>;

const DOC_STATUSES = ["Borrador", "En trámite", "Aprobado"];
const TIME_EXT_STATUSES = ["Aprobada", "Pendiente"];
const FUND_SOURCES = ["ACT:100%", "FHWA:80.25", "FHWA:100%"];

const CHOForm = forwardRef<FormRef, { projectId?: string, onDirty?: () => void, onSaved?: () => void }>(function CHOForm({ projectId, onDirty, onSaved }, ref) {
    const [chos, setChos] = useState<any[]>([]);
    const [contractItems, setContractItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [expandedCHO, setExpandedCHO] = useState<string | null>(null);

    useEffect(() => {
        if (projectId) {
            fetchContractItems();
            fetchCHOs();
        }
    }, [projectId]);

    const fetchContractItems = async () => {
        const { data } = await supabase.from("contract_items").select("*").eq("project_id", projectId);
        if (data) setContractItems(data);
    };

    const fetchCHOs = async () => {
        const { data } = await supabase.from("chos").select("*").eq("project_id", projectId).order("cho_num", { ascending: true });
        if (data && data.length > 0) {
            setChos(data.map(c => ({
                ...c,
                items: Array.isArray(c.items) ? c.items : []
            })));
        } else {
            addCHO();
        }
    };

    const addCHO = () => {
        const lastNum = chos.length > 0 ? Math.max(...chos.map(c => c.cho_num)) : 0;
        const lastLetter = chos.length > 0 ? chos[chos.length - 1].amendment_letter : "";
        const nextLetter = lastLetter ? String.fromCharCode(lastLetter.charCodeAt(0) + 1) : "A";

        const newId = crypto.randomUUID();
        setChos([...chos, {
            id: newId,
            project_id: projectId,
            cho_num: lastNum + 1,
            amendment_letter: chos.length === 0 ? "A" : nextLetter,
            cho_date: new Date().toISOString().split('T')[0],
            time_extension_days: 0,
            doc_status: DOC_STATUSES[0],
            items: []
        }]);
        setExpandedCHO(newId);
        if (onDirty) onDirty();
    };

    const updateCHO = (index: number, field: string, value: any) => {
        const newList = [...chos];
        newList[index][field] = value;
        setChos(newList);
        if (onDirty) onDirty();
    };

    const removeCHO = (idx: number) => {
        setChos(chos.filter((_, i) => i !== idx));
        if (onDirty) onDirty();
    };

    const addCHOItem = (choIdx: number) => {
        const newList = [...chos];
        if (!newList[choIdx].items) newList[choIdx].items = [];
        newList[choIdx].items.push({
            item_num: "",
            specification: "",
            description: "",
            quantity: 0,
            unit_price: 0,
            fund_source: FUND_SOURCES[0]
        });
        setChos(newList);
        if (onDirty) onDirty();
    };

    const updateCHOItem = (choIdx: number, itemIdx: number, field: string, value: any) => {
        const newList = [...chos];
        let finalValue = value;

        if (field === 'item_num') {
            finalValue = value.toString().replace(/\D/g, '').substring(0, 3);
        }

        if (field === 'specification' && /^\d{6}$/.test(value.toString().trim())) {
            const val = value.toString().trim();
            finalValue = val.substring(0, 3) + '-' + val.substring(3);
        }

        newList[choIdx].items[itemIdx][field] = finalValue;

        if (field === 'item_num' || field === 'specification') {
            const searchValue = finalValue.toString().trim();
            const match = contractItems.find(it =>
                (field === 'item_num' && it.item_num === searchValue) ||
                (field === 'specification' && it.specification === searchValue)
            );

            if (match) {
                newList[choIdx].items[itemIdx]['specification'] = match.specification;
                newList[choIdx].items[itemIdx]['description'] = match.description;
                newList[choIdx].items[itemIdx]['unit'] = match.unit;
                newList[choIdx].items[itemIdx]['unit_price'] = match.unit_price;
                newList[choIdx].items[itemIdx]['fund_source'] = match.fund_source;
            }
        }

        if (field === 'specification') {
            const specInfo = specs[finalValue.toString().trim()];
            if (specInfo && !newList[choIdx].items[itemIdx]['unit_price']) {
                newList[choIdx].items[itemIdx]['description'] = specInfo.description;
                newList[choIdx].items[itemIdx]['unit'] = specInfo.unit;
            }
        }

        setChos(newList);
        if (onDirty) onDirty();
    };

    const removeCHOItem = (choIdx: number, itemIdx: number) => {
        const newList = [...chos];
        const newItems = (newList[choIdx].items || []).filter((_: any, i: number) => i !== itemIdx);
        newList[choIdx] = { ...newList[choIdx], items: newItems };
        setChos(newList);
        if (onDirty) onDirty();
    };

    const saveData = async (silent = false) => {
        if (!projectId) return;

        // Auto-add items that are not in the contract items list
        const missingItemsMap = new Map();
        for (const cho of chos) {
            for (const item of (cho.items || [])) {
                if (item.item_num && !contractItems.some(ci => ci.item_num === item.item_num)) {
                    if (!missingItemsMap.has(item.item_num)) {
                        missingItemsMap.set(item.item_num, {
                            project_id: projectId,
                            item_num: item.item_num,
                            specification: item.specification || "",
                            description: item.description || "",
                            quantity: 0, // Original quantity is 0 since it comes from CHO
                            unit: item.unit || "",
                            unit_price: item.unit_price || 0,
                            fund_source: item.fund_source || FUND_SOURCES[0]
                        });
                    }
                }
            }
        }

        if (missingItemsMap.size > 0) {
            const missingItemsToInsert = Array.from(missingItemsMap.values());
            const { error: insErr } = await supabase.from("contract_items").insert(missingItemsToInsert);
            if (!insErr) {
                fetchContractItems();
            } else {
                console.error("Error adding missing items to contract", insErr);
            }
        }

        await supabase.from("chos").delete().eq("project_id", projectId);
        const chosToSave = chos.map(c => {
            const { id: _, created_at, ...rest } = c;
            const total = (c.items || []).reduce((acc: number, item: any) => {
                const q = parseFloat(item.quantity) || 0;
                const p = parseFloat(item.unit_price) || 0;
                return acc + (q * p);
            }, 0);
            return { ...rest, project_id: projectId, proposed_change: total, items: c.items || [] };
        });
        const { error } = await supabase.from("chos").insert(chosToSave);
        if (error && !silent) alert("Error: " + error.message);
        else if (!error) {
            if (!silent) alert("Órdenes de Cambio sincronizadas");
            if (onSaved) onSaved();
        }
    };

    useImperativeHandle(ref, () => ({ save: () => saveData(true) }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!projectId) return;
        setLoading(true);
        await saveData(false);
        setLoading(false);
    };

    const toggleExpand = (id: string) => {
        setExpandedCHO(expandedCHO === id ? null : id);
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="sticky top-[133px] z-20 bg-slate-50/95 backdrop-blur-sm dark:bg-[#020617]/95 py-4 -mt-4 mb-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <FileEdit className="text-primary" />
                        5. Órdenes de Cambio (CHO)
                    </h2>
                </div>
                <div className="flex gap-2">
                    <button onClick={addCHO} className="bg-slate-100 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors hover:bg-slate-200">
                        <Plus size={16} /> Nueva Enmienda
                    </button>
                    <button onClick={handleSubmit} disabled={loading} className="btn-primary flex items-center gap-2">
                        <Save size={18} />
                        {loading ? "Sincronizando..." : "Guardar Cambios"}
                    </button>
                </div>
            </div>

            {/* Cuadro de Resumen Financiero de CHOs */}
            {(() => {
                const approvedTotal = chos
                    .filter(c => c.doc_status === "Aprobado")
                    .reduce((sum, c) => sum + (c.items || []).reduce((s: number, it: any) => s + ((parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0)), 0), 0);

                const pendingTotal = chos
                    .filter(c => c.doc_status === "En trámite")
                    .reduce((sum, c) => sum + (c.items || []).reduce((s: number, it: any) => s + ((parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0)), 0), 0);

                const approvedDays = chos
                    .filter(c => c.doc_status === "Aprobado")
                    .reduce((sum, c) => sum + (c.time_extension_days || 0), 0);

                return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <SummaryItem
                            label="Total Aprobado ($)"
                            value={approvedTotal}
                            icon={<DollarSign size={16} />}
                            color="text-emerald-600"
                            bgColor="bg-emerald-50 dark:bg-emerald-900/20"
                        />
                        <SummaryItem
                            label="Total en Trámite ($)"
                            value={pendingTotal}
                            icon={<DollarSign size={16} />}
                            color="text-amber-600"
                            bgColor="bg-amber-50 dark:bg-amber-900/20"
                        />
                        <SummaryItem
                            label="Impacto Económico"
                            value={approvedTotal}
                            icon={<Activity size={16} />}
                            color="text-primary"
                            bgColor="bg-blue-50 dark:bg-blue-900/20"
                            isCurrency={true}
                        />
                        <SummaryItem
                            label="Días de Extensión"
                            value={approvedDays}
                            icon={<Timer size={16} />}
                            color="text-slate-600"
                            bgColor="bg-slate-100 dark:bg-slate-800"
                            isCurrency={false}
                        />
                    </div>
                );
            })()}

            <div className="space-y-4">
                {chos.map((cho, idx) => (
                    <div key={cho.id || idx} className="card border-none shadow-sm overflow-hidden bg-white dark:bg-slate-900 p-0">
                        {/* Header de la CHO */}
                        <div className="p-4 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20">
                            <div className="flex items-center gap-6">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">CHO / Enmienda</label>
                                    <div className="text-2xl font-black text-primary flex items-baseline gap-1">
                                        #{cho.cho_num}
                                        <span className="text-lg text-slate-400 font-bold">{cho.amendment_letter}</span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Fecha</label>
                                    <input type="date" className="input-field text-sm font-bold bg-white dark:bg-slate-900" style={{ backgroundColor: '#66FF99' }} value={cho.cho_date || ""} onChange={(e) => updateCHO(idx, 'cho_date', e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Ext. Días</label>
                                    <input type="number" className="input-field text-sm font-bold w-20 bg-white dark:bg-slate-900" style={{ backgroundColor: '#66FF99' }} value={cho.time_extension_days ?? 0} onChange={(e) => updateCHO(idx, 'time_extension_days', parseInt(e.target.value))} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Estatus Doc.</label>
                                    <select className="input-field text-xs font-bold bg-white dark:bg-slate-900" style={{ backgroundColor: '#66FF99' }} value={cho.doc_status || DOC_STATUSES[0]} onChange={(e) => updateCHO(idx, 'doc_status', e.target.value)}>
                                        {DOC_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => toggleExpand(cho.id)}
                                    className="bg-slate-200/50 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                                >
                                    {expandedCHO === cho.id ? "Cerrar Partidas" : "Ver / Añadir Partidas"}
                                </button>
                                <button type="button" onClick={() => removeCHO(idx)} className="text-slate-300 hover:text-red-500 transition-colors">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Detalle de Partidas (Acordeón) */}
                        {expandedCHO === cho.id && (
                            <div className="p-4 border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2 duration-200">
                                {/* Resumen de esta Enmienda */}
                                {(() => {
                                    const choTotal = (cho.items || []).reduce((acc: number, item: any) => {
                                        const q = parseFloat(item.quantity) || 0;
                                        const p = parseFloat(item.unit_price) || 0;
                                        return acc + (q * p);
                                    }, 0);
                                    return (
                                        <div className="mb-6 p-5 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800/50 dark:to-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
                                            <div className="space-y-1">
                                                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">DATOS DE ESTA ENMIENDA</h5>
                                                <div className="flex items-baseline gap-4">
                                                    <div>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Impacto Económico</span>
                                                        <span className="text-2xl font-black text-primary font-geist tracking-tight">{formatCurrency(choTotal)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="px-3 py-1.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full uppercase tracking-widest">Impacto en Contrato</div>
                                        </div>
                                    );
                                })()}

                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-sm font-bold text-slate-600 flex items-center gap-2">
                                        <Plus size={14} className="text-primary" />
                                        Partidas de esta Enmienda
                                    </h4>
                                    <div className="flex gap-4">
                                        <button onClick={() => addCHOItem(idx)} className="text-xs font-bold text-primary hover:underline">
                                            + Añadir Manual
                                        </button>
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="text-[10px] uppercase font-bold text-slate-400 border-b border-slate-50 dark:border-slate-800">
                                            <tr>
                                                <th className="py-2 px-1 w-16 text-center"># Item</th>
                                                <th className="py-2 px-1 w-24">Espec.</th>
                                                <th className="py-2 px-1">Descripción</th>
                                                <th className="py-2 px-1 w-20 text-center">Unit</th>
                                                <th className="py-2 px-1 w-20 text-right">Qty</th>
                                                <th className="py-2 px-1 w-24 text-right">Unit Price</th>
                                                <th className="py-2 px-1 w-24 text-right">Amount</th>
                                                <th className="py-2 px-1 w-40">Fondos</th>
                                                <th className="py-2 px-1 w-8"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                            {(cho.items || []).map((item: any, itIdx: number) => (
                                                <tr key={itIdx}>
                                                    <td className="py-1 px-1">
                                                        <input
                                                            type="text"
                                                            maxLength={20}
                                                            className="input-field text-xs text-center p-1 h-7"
                                                            style={{ backgroundColor: '#66FF99' }}
                                                            value={item.item_num || ""}
                                                            onChange={(e) => updateCHOItem(idx, itIdx, 'item_num', e.target.value)}
                                                            onBlur={(e) => {
                                                                const val = e.target.value;
                                                                if (val !== "" && !isNaN(parseInt(val))) {
                                                                    updateCHOItem(idx, itIdx, 'item_num', val.padStart(3, '0'));
                                                                }
                                                            }}
                                                        />
                                                    </td>
                                                    <td className="py-1 px-1">
                                                        <input type="text" className="input-field text-xs p-1 h-7" value={item.specification || ""} onChange={(e) => updateCHOItem(idx, itIdx, 'specification', e.target.value)} />
                                                    </td>
                                                    <td className="py-1 px-1">
                                                        <div className="space-y-0.5">
                                                            <input type="text" className="input-field text-xs p-1 h-7" value={item.description || ""} onChange={(e) => updateCHOItem(idx, itIdx, 'description', e.target.value)} />
                                                            {(() => {
                                                                const match = contractItems.find(it => it.item_num === item.item_num);
                                                                if (match) {
                                                                    return <div className="text-[9px] font-bold text-slate-400 italic px-1">Orig Plan: {match.quantity} {match.unit}</div>;
                                                                }
                                                                return null;
                                                            })()}
                                                        </div>
                                                    </td>
                                                    <td className="py-1 px-1 text-center">
                                                        <input type="text" className="input-field text-xs p-1 h-7 text-center uppercase" value={item.unit || ""} onChange={(e) => updateCHOItem(idx, itIdx, 'unit', e.target.value)} />
                                                    </td>
                                                    <td className="py-1 px-1">
                                                        <input
                                                            type="text"
                                                            className="input-field text-xs text-right p-1 h-7 border-blue-200 focus:ring-blue-500"
                                                            style={{ backgroundColor: '#66FF99' }}
                                                            value={item.quantity ?? ""}
                                                            onChange={(e) => updateCHOItem(idx, itIdx, 'quantity', e.target.value)}
                                                        />
                                                    </td>
                                                    <td className="py-1 px-1">
                                                        <input
                                                            type="number"
                                                            step="0.0001"
                                                            className="input-field text-xs text-right p-1 h-7"
                                                            value={isNaN(parseFloat(item.unit_price)) ? "" : (item.unit_price ?? "")}
                                                            onChange={(e) => updateCHOItem(idx, itIdx, 'unit_price', e.target.value)}
                                                        />
                                                    </td>
                                                    <td className="py-1 px-2 text-right text-xs font-bold text-primary">
                                                        {formatCurrency((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0))}
                                                    </td>
                                                    <td className="py-1 px-1">
                                                        <select
                                                            className="input-field text-[10px] font-bold py-1 px-2"
                                                            value={item.fund_source || ""}
                                                            onChange={(e) => updateCHOItem(idx, itIdx, 'fund_source', e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Tab' && !e.shiftKey && itIdx === (cho.items || []).length - 1) {
                                                                    addCHOItem(idx);
                                                                }
                                                            }}
                                                        >
                                                            {FUND_SOURCES.map(f => <option key={f} value={f}>{f}</option>)}
                                                        </select>
                                                    </td>
                                                    <td className="py-1 px-1 text-center">
                                                        <button type="button" onClick={() => removeCHOItem(idx, itIdx)} className="text-slate-300 hover:text-red-500">
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {(cho.items || []).length === 0 && (
                                                <tr>
                                                    <td colSpan={9} className="py-8 text-center text-xs text-slate-400 font-medium italic">
                                                        No hay partidas añadidas a esta enmienda. Haz clic en "+ Añadir Manual".
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
});

export default CHOForm;

function SummaryItem({ label, value, icon, color, bgColor, isCurrency = true }: { label: string, value: number, icon: React.ReactNode, color: string, bgColor: string, isCurrency?: boolean }) {
    return (
        <div className={`${bgColor} rounded-xl p-3 border border-slate-100 dark:border-slate-800 flex items-start gap-3`}>
            <div className={`${color} p-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm`}>
                {icon}
            </div>
            <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</div>
                <div className={`text-sm font-black ${color}`}>
                    {isCurrency ? formatCurrency(value) : `${value} días`}
                </div>
            </div>
        </div>
    );
}
