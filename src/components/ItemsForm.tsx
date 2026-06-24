"use client";

import React, { useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/lib/supabase";
import { Save, ListChecks, Plus, Trash2, Info, PlusSquare, FileText, Printer, Search } from "lucide-react";
import FloatingFormActions from "./FloatingFormActions";
import { formatCurrency, formatNumber, roundedAmt, sortItemsNaturally } from "@/lib/utils";
import type { FormRef } from "./ProjectForm";
import mfgItemsData from "@/lib/mfgItems.json";

import specsData from "@/data/specifications.json";
// import { parsePdfClient, pdfToImages } from "@/lib/pdfClientParser"; // Eliminado por solicitud del usuario

const FUND_SOURCES = ["FHWA:100%", "FHWA:80.25", "ACT:100%"];

interface SpecInfo {
    unit: string;
    description: string;
}

const specs = specsData as Record<string, SpecInfo>;

const ItemsForm = forwardRef<FormRef, { projectId?: string, numAct?: string, onDirty?: () => void, onSaved?: () => void, readOnly?: boolean, onlyOriginals?: boolean }>(function ItemsForm({ projectId, numAct, onDirty, onSaved, readOnly = false, onlyOriginals = false }, ref) {
    const [items, setItems] = useState<any[]>([]);
    const [priceSuggestions, setPriceSuggestions] = useState<Record<string, number[]>>({});
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        if (projectId) {
            fetchItems();
            fetchPriceHistory();

            // Sincronización en tiempo real
            const channel = supabase
                .channel(`items-form-${projectId}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'contract_items', filter: `project_id=eq.${projectId}` }, () => fetchItems())
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        } else {
            setItems([{ item_num: "", specification: "", description: "", additional_description: "", quantity: 0, unit: "", unit_price: 0, fund_source: FUND_SOURCES[0], requires_mfg_cert: false, mfg_cert_qty: 1, mfg_cert_description: "" }]);
        }
    }, [projectId]);

    const fetchPriceHistory = async () => {
        const { data } = await supabase.from("contract_items").select("specification, unit_price");
        if (data) {
            const suggestions: Record<string, number[]> = {};
            data.forEach(item => {
                if (!item.specification) return;
                const spec = item.specification.trim();
                if (!suggestions[spec]) suggestions[spec] = [];
                if (!suggestions[spec].includes(item.unit_price)) {
                    suggestions[spec].push(item.unit_price);
                }
            });
            setPriceSuggestions(suggestions);
        }
    };

    const fetchItems = async () => {
        const { data } = await supabase.from("contract_items").select("*").eq("project_id", projectId).order('item_num', { ascending: true });
        if (data && data.length > 0) setItems(sortItemsNaturally(data));
        else setItems([{ item_num: "", specification: "", description: "", additional_description: "", quantity: 0, unit: "", unit_price: 0, fund_source: FUND_SOURCES[0], requires_mfg_cert: false, mfg_cert_qty: 1, mfg_cert_description: "" }]);
    };



    const addItem = () => {
        // Find the highest item number currently in the list and suggest next
        const maxNum = items.reduce((max, item) => {
            const num = parseInt(item.item_num);
            return isNaN(num) ? max : Math.max(max, num);
        }, 0);
        const nextNum = (maxNum + 1).toString().padStart(3, '0');
        setItems([...items, { item_num: nextNum, specification: "", description: "", additional_description: "", quantity: 0, unit: "", unit_price: 0, fund_source: FUND_SOURCES[0], requires_mfg_cert: false, mfg_cert_qty: 1, mfg_cert_description: "" }]);
        if (onDirty) onDirty();
    };

    const removeItem = (idx: number) => {
        setItems(items.filter((_, i) => i !== idx));
        if (onDirty) onDirty();
    };

    const insertItem = (idx: number) => {
        const newItems = [...items];
        const currentItemNum = parseInt(items[idx]?.item_num);
        const nextNum = !isNaN(currentItemNum) ? (currentItemNum + 1).toString().padStart(3, '0') : "";

        newItems.splice(idx + 1, 0, {
            item_num: nextNum,
            specification: "",
            description: "",
            additional_description: "",
            quantity: 0,
            unit: "",
            unit_price: 0,
            fund_source: FUND_SOURCES[0],
            requires_mfg_cert: false,
            mfg_cert_qty: 1,
            mfg_cert_description: ""
        });
        setItems(newItems);
        if (onDirty) onDirty();
    };

    const updateItem = (index: number, field: string, value: any) => {
        const newItems = [...items];
        let finalValue = value;
        if (field === 'item_num') {
            finalValue = value.toString().replace(/\D/g, '').substring(0, 3);
        }
        // Auto-format specification XXX-XXX
        if (field === 'specification' && /^\d{6}$/.test(value.toString().trim())) {
            const val = value.toString().trim();
            finalValue = val.substring(0, 3) + '-' + val.substring(3);
        }

        newItems[index][field] = finalValue;

        // Autofill logic for specification (global catalog)
        if (field === 'specification') {
            const specCode = finalValue.toString().trim();
            const specInfo = specs[specCode];
            if (specInfo) {
                newItems[index]['description'] = specInfo.description;
                newItems[index]['unit'] = specInfo.unit;
            }
            if ((mfgItemsData as Record<string, boolean>)[specCode] === true) {
                newItems[index]['requires_mfg_cert'] = true;
            } else if ((mfgItemsData as Record<string, boolean>)[specCode] === false) {
                newItems[index]['requires_mfg_cert'] = false;
            }
        }

        setItems(newItems);
        if (onDirty) onDirty();
    };

    const getFieldStyle = (item: any, field: string) => {
        const meta = item.ia_metadata;
        if (!meta || !meta.last_update) return {};
        
        // Solo resaltar si fue en las últimas 24 horas para evitar confusión permanente
        const lastUpdate = new Date(meta.last_update);
        const now = new Date();
        const isRecent = now.getTime() - lastUpdate.getTime() < 1000 * 60 * 60 * 24;
        
        if (!isRecent) return {};

        if (meta.updated_fields?.includes(field)) {
            return { backgroundColor: '#FFFF00', color: '#000000', fontWeight: 'bold' }; // Fondo Amarillo
        }
        if (meta.reviewed_fields?.includes(field)) {
            return { color: '#0000FF', fontWeight: 'bold' }; // Letra Azul
        }
        return {};
    };

    const saveData = async (silent = false) => {
        if (!projectId) return;

        try {
            const { data: existingItems, error: fetchError } = await supabase.from("contract_items").select("id").eq("project_id", projectId);
            if (fetchError) throw fetchError;

            const existingIds = existingItems?.map(item => item.id) || [];

            // Require at least an item_num to consider saving the row
            const validItems = items.filter(item => item.item_num?.trim() !== "");

            const updates = [];
            const inserts = [];

            for (const item of validItems) {
                const { id, created_at, ...rest } = item;
                const payload = { ...rest, project_id: projectId };

                if (id) {
                    updates.push({ id, ...payload });
                } else {
                    inserts.push(payload);
                }
            }

            const currentIds = updates.map(u => u.id);
            const idsToDelete = existingIds.filter(id => !currentIds.includes(id));

            if (idsToDelete.length > 0) {
                const { error: delError } = await supabase.from("contract_items").delete().in("id", idsToDelete);
                if (delError) throw delError;
            }

            if (updates.length > 0) {
                const { error: updateError } = await supabase.from("contract_items").upsert(updates, { onConflict: "id" });
                if (updateError) throw updateError;
            }

            if (inserts.length > 0) {
                const { error: insertError } = await supabase.from("contract_items").insert(inserts);
                if (insertError) throw insertError;
            }

            if (!silent) alert("Partidas actualizadas correctamente");

            await fetchItems(); // Actualizar IDs en estado

            if (onSaved) onSaved();

        } catch (error: any) {
            console.error("Save error:", error);
            if (!silent) alert("Error: " + error.message);
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

    return (
        <div className="space-y-6">
            <div className="sticky top-0 z-40 bg-[#F8FAFC]/95 dark:bg-[#020617]/95 backdrop-blur-md pt-4 pb-4 -mx-4 px-4 md:-mx-8 md:px-8 border-b border-slate-200 dark:border-slate-800 flex flex-col items-center justify-between mb-6">
                <div className="w-full flex justify-center mb-2">
                    <div className="flex items-center gap-2 px-4 py-1.5 bg-red-50 border border-red-100 rounded-xl">
                        <Info size={14} className="text-red-600 shrink-0" />
                        <span className="text-sm font-black text-red-600 uppercase">Esta sección se actualiza automáticamente — no es necesario ingresar información aquí.</span>
                    </div>
                </div>
                <div className="w-full flex items-center justify-between">
                    <div className="space-y-1">
                        <h2 className="text-2xl font-bold flex items-center gap-2 font-geist tracking-tight">
                            <ListChecks className="text-primary" />
                            Todas las partidas
                        </h2>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total del Contrato Original:</span>
                            <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full text-sm font-extrabold border border-emerald-100 dark:border-emerald-800/50">
                                {formatCurrency(React.useMemo(() => items.reduce((sum, item) => {
                                    return roundedAmt(sum + roundedAmt((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0), 2), 2);
                                }, 0), [items]))}
                            </span>
                        </div>
                    </div>

                    <div className="flex-1 max-w-md mx-6">
                        <div className="relative group">
                            <input 
                                type="text"
                                placeholder="Buscar por item, especificación o descripción..."
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-4 pr-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex gap-3">
                        {/* Los botones ahora son flotantes para mayor accesibilidad */}
                    </div>
                </div>
            </div>

            <FloatingFormActions
                actions={[
                    {
                        label: "Imprimir",
                        icon: <Printer />,
                        onClick: () => window.print(),
                        description: "Imprimir esta sección de Partidas de Contrato",
                        variant: 'secondary' as const,
                        size: 'small' as const
                    },

                    !readOnly ? {
                        label: "Añadir Item",
                        icon: <Plus />,
                        onClick: addItem,
                        description: "Crear una nueva fila de partida al final del contrato",
                        variant: 'secondary' as const
                    } : null,
                    !readOnly ? {
                        label: loading ? "Guardando..." : "Guardar cambios",
                        icon: <Save />,
                        onClick: () => saveData(false),
                        description: "Guardar todos los cambios realizados en las partidas y refrescar balances",
                        variant: 'primary' as const,
                        disabled: loading
                    } : null
                ].filter(Boolean) as any}
            />

            {loading && (
                <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/60 dark:bg-slate-950/60 backdrop-blur-sm">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3"></div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Guardando partidas...</span>
                </div>
            )}

            <div className="card overflow-x-auto p-0 border-none shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 uppercase text-[10px] font-extrabold border-b border-slate-100 dark:border-slate-800">
                        <tr>
                            <th className="px-1 py-2 min-w-[64px] text-center">#</th>
                            <th className="px-1 py-2 min-w-[96px] text-center">Espec.</th>
                            <th className="px-1 py-2 min-w-[200px]">Descripción</th>
                            <th className="px-1 py-2 min-w-[80px] text-right">Cant. Orig.</th>
                            <th className="px-1 py-2 min-w-[80px] text-center" style={{fontSize:'9px'}}>Unid.</th>
                            <th className="px-1 py-2 min-w-[96px] text-right">U.P. ($)</th>
                            <th className="px-1 py-2 min-w-[120px] text-right">Amount ($)</th>
                            <th className="px-1 py-2 min-w-[110px] text-center">Fondos</th>
                            <th className="px-1 py-2 min-w-[48px] text-center" title="Requiere Cert. Manufactura">CM</th>
                            <th className="px-1 py-2 min-w-[64px]"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                        {items
                                .map((item, originalIndex) => ({ item, originalIndex }))
                                .filter(({ item }) => {
                                    // Si solo queremos originales, filtramos los que tengan cantidad original 0
                                    if (onlyOriginals && (parseFloat(item.quantity) || 0) <= 0) return false;

                                    if (!searchTerm) return true;
                                    const s = searchTerm.toLowerCase().trim();
                                    return (
                                        item.item_num?.toLowerCase().includes(s) ||
                                        item.specification?.toLowerCase().includes(s) ||
                                        item.description?.toLowerCase().includes(s) ||
                                        item.additional_description?.toLowerCase().includes(s)
                                    );
                                })
                                .sort((a, b) => {
                                    const numA = (a.item.item_num || "").toString().replace(/[^0-9]/g, '');
                                    const numB = (b.item.item_num || "").toString().replace(/[^0-9]/g, '');
                                    const parsedA = parseInt(numA || '0');
                                    const parsedB = parseInt(numB || '0');
                                    if (parsedA !== parsedB) return parsedA - parsedB;
                                    return (a.item.item_num || "").localeCompare(b.item.item_num || "");
                                })
                                .map(({ item, originalIndex: idx }) => {
                            const amountFinal = roundedAmt((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0), 2);

                            return (
                                <React.Fragment key={idx}>
                                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                                        <td className="px-1 py-1.5">
                                            <div className="relative group flex justify-center">
                                                <input
                                                type="text"
                                                maxLength={3}
                                                disabled={readOnly}
                                                className={`input-field text-xs text-center font-bold h-8 !py-1 transition-all ${readOnly ? 'bg-transparent border-none' : 'bg-white shadow-sm'}`}
                                                value={item.item_num || ""}
                                                onChange={(e) => updateItem(idx, 'item_num', e.target.value)}
                                                onBlur={(e) => {
                                                    const val = e.target.value;
                                                    if (val !== "" && !isNaN(parseInt(val))) {
                                                        updateItem(idx, 'item_num', val.padStart(3, '0'));
                                                    }
                                                }}
                                                />
                                            </div>
                                        </td>
                                        <td className="px-1 py-1.5">
                                            <input type="text" disabled={readOnly} className="input-field text-xs text-center h-8 !py-1" style={{ backgroundColor: readOnly ? 'white' : '#66FF99', ...getFieldStyle(item, 'specification') }} value={item.specification || ""} onChange={(e) => updateItem(idx, 'specification', e.target.value)} />
                                        </td>
                                        <td className="px-1 py-1.5">
                                            <div className="space-y-1">
                                                <input type="text" disabled={readOnly} className="input-field text-xs h-8 !py-1" style={{ backgroundColor: readOnly ? 'white' : '#66FF99', ...getFieldStyle(item, 'description') }} value={item.description || ""} onChange={(e) => updateItem(idx, 'description', e.target.value)} />
                                                <input type="text" disabled={readOnly} className="input-field text-[10px] h-6 !py-0.5 opacity-70" style={{ backgroundColor: readOnly ? 'white' : '#66FF99', ...getFieldStyle(item, 'additional_description') }} value={item.additional_description || ""} onChange={(e) => updateItem(idx, 'additional_description', e.target.value)} placeholder="Descripción Adicional..." />
                                            </div>
                                        </td>
                                        <td className="px-1 py-1.5">
                                            <input type="number" disabled={readOnly} className="input-field text-xs text-right h-8 !py-1" style={{ backgroundColor: readOnly ? 'white' : '#66FF99', ...getFieldStyle(item, 'quantity') }} value={isNaN(item.quantity) ? "" : item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value === "" ? 0 : parseFloat(e.target.value))} />
                                        </td>
                                        <td className="px-1 py-1.5 text-center">
                                            <input type="text" disabled={readOnly} className="input-field uppercase h-8 !py-1 text-center px-1" style={{ fontSize: '9px', backgroundColor: readOnly ? 'white' : '#66FF99', ...getFieldStyle(item, 'unit') }} value={item.unit || ""} onChange={(e) => updateItem(idx, 'unit', e.target.value)} />
                                        </td>
                                        <td className="px-1 py-1.5">
                                            <input 
                                                type="number" 
                                                step="0.0001" 
                                                disabled={readOnly}
                                                className="input-field text-xs text-right font-medium h-8 !py-1" 
                                                style={{ backgroundColor: readOnly ? 'white' : '#66FF99', ...getFieldStyle(item, 'unit_price') }} 
                                                list={`prices-${idx}`}
                                                value={isNaN(item.unit_price) ? "" : item.unit_price} 
                                                onChange={(e) => updateItem(idx, 'unit_price', e.target.value === "" ? 0 : parseFloat(e.target.value))} 
                                            />
                                            <datalist id={`prices-${idx}`}>
                                                {(priceSuggestions[item.specification?.trim()] || []).map(p => (
                                                    <option key={p} value={p} />
                                                ))}
                                            </datalist>
                                        </td>
                                        <td className="px-1 py-1.5 text-right font-black text-xs text-primary pr-4">
                                            {formatCurrency(amountFinal)}
                                        </td>
                                        <td className="px-1 py-1.5">
                                            <select
                                                className="input-field text-[10px] font-bold h-8 !py-1"
                                                disabled={readOnly}
                                                style={{ backgroundColor: readOnly ? 'white' : '#66FF99' }}
                                                value={item.fund_source || ""}
                                                onChange={(e) => updateItem(idx, 'fund_source', e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Tab' && !e.shiftKey && idx === items.length - 1) {
                                                        addItem();
                                                    }
                                                }}
                                            >
                                                {FUND_SOURCES.map(f => <option key={f} value={f}>{f}</option>)}
                                            </select>
                                        </td>
                                        <td className="px-1 py-1.5 text-center">
                                            <label
                                                title="Requiere Cert. Manufactura"
                                                className={`inline-flex items-center justify-center w-6 h-6 rounded cursor-pointer border-2 transition-all ${item.requires_mfg_cert
                                                    ? 'bg-amber-500 border-amber-500 text-white'
                                                    : 'border-slate-300 hover:border-amber-400'
                                                    }`}
                                                style={!item.requires_mfg_cert ? { backgroundColor: readOnly ? 'white' : '#66FF99' } : {}}
                                            >
                                                <input
                                                    type="checkbox"
                                                    className="sr-only"
                                                    checked={!!item.requires_mfg_cert}
                                                    onChange={(e) => updateItem(idx, 'requires_mfg_cert', e.target.checked)}
                                                />
                                                {item.requires_mfg_cert && (
                                                    <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <polyline points="1,6 5,10 11,2" />
                                                    </svg>
                                                )}
                                            </label>
                                            {item.requires_mfg_cert && (item.unit === 'LS' || item.unit === 'LUMP SUM') && (
                                                <div className="mt-1 flex flex-col gap-1 items-center">
                                                    <input
                                                        type="number"
                                                        title="Cantidad de CMs Requeridos"
                                                        className="w-10 h-5 text-[10px] text-center font-bold border border-amber-300 rounded block"
                                                        value={item.mfg_cert_qty || 1}
                                                        min={1}
                                                        onChange={(e) => updateItem(idx, 'mfg_cert_qty', parseInt(e.target.value) || 1)}
                                                    />
                                                    <input
                                                        type="text"
                                                        title="Descripción del material que requiere CM"
                                                        placeholder="Descripción material CM..."
                                                        className="w-20 h-5 text-[9px] text-center border border-amber-200 rounded block px-1"
                                                        value={item.mfg_cert_description || ''}
                                                        onChange={(e) => updateItem(idx, 'mfg_cert_description', e.target.value)}
                                                    />
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-1 py-1.5 text-center">
                                            {!readOnly && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeItem(idx)}
                                                    className="transition-all rounded-full p-1 shadow-sm transform hover:scale-110 bg-red-100 text-red-600 hover:bg-red-500 hover:text-white"
                                                    title="Eliminar partida"
                                                >
                                                    <Trash2 size={14} strokeWidth={2.5} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                </React.Fragment>
                            );
                        })}
                        <tr>
                            <td colSpan={12} className="px-4 py-3 border-t border-slate-100 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={addItem}
                                    className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                                >
                                    <Plus size={14} />
                                    Añadir Item
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
});

export default ItemsForm;
