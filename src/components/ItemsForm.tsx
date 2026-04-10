"use client";

import React, { useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/lib/supabase";
import { Save, ListChecks, Plus, Trash2, Info, PlusSquare, FileText, Download, Upload } from "lucide-react";
import FloatingFormActions from "./FloatingFormActions";
import { exportSectionToJSON, importSectionFromJSON } from "@/lib/sectionIO";
import { formatCurrency, formatNumber, roundedAmt } from "@/lib/utils";
import type { FormRef } from "./ProjectForm";
import mfgItemsData from "@/lib/mfgItems.json";

import specsData from "@/data/specifications.json";

const FUND_SOURCES = ["ACT:100%", "FHWA:80.25", "FHWA:100%"];

interface SpecInfo {
    unit: string;
    description: string;
}

const specs = specsData as Record<string, SpecInfo>;

const ItemsForm = forwardRef<FormRef, { projectId?: string, numAct?: string, onDirty?: () => void, onSaved?: () => void }>(function ItemsForm({ projectId, numAct, onDirty, onSaved }, ref) {
    const [items, setItems] = useState<any[]>([]);
    const [chos, setChos] = useState<any[]>([]);
    const [certs, setCerts] = useState<any[]>([]);
    const [priceSuggestions, setPriceSuggestions] = useState<Record<string, number[]>>({});
    const [expandedItem, setExpandedItem] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (projectId) {
            fetchItems();
            fetchCHOs();
            fetchCerts();
            fetchPriceHistory();
        } else {
            setItems([{ item_num: "", specification: "", description: "", additional_description: "", quantity: 0, unit: "", unit_price: 0, fund_source: FUND_SOURCES[0], requires_mfg_cert: false, mfg_cert_qty: 1 }]);
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
        if (data && data.length > 0) setItems(data);
        else setItems([{ item_num: "", specification: "", description: "", additional_description: "", quantity: 0, unit: "", unit_price: 0, fund_source: FUND_SOURCES[0], requires_mfg_cert: false, mfg_cert_qty: 1 }]);
    };

    const fetchCHOs = async () => {
        const { data } = await supabase.from("chos").select("*").eq("project_id", projectId);
        if (data) setChos(data);
    };

    const fetchCerts = async () => {
        const { data } = await supabase.from("payment_certifications").select("*").eq("project_id", projectId).order('cert_num', { ascending: true });
        if (data) setCerts(data);
    };

    const getCHOQty = (itemNum: string) => {
        let total = 0;
        chos.forEach(cho => {
            const items = Array.isArray(cho.items) ? cho.items : [];
            items.forEach((it: any) => {
                if (it.item_num === itemNum) {
                    total += (parseFloat(it.quantity) || 0);
                }
            });
        });
        return total;
    };

    const addItem = () => {
        // Find the highest item number currently in the list and suggest next
        const maxNum = items.reduce((max, item) => {
            const num = parseInt(item.item_num);
            return isNaN(num) ? max : Math.max(max, num);
        }, 0);
        const nextNum = (maxNum + 1).toString().padStart(3, '0');
        setItems([...items, { item_num: nextNum, specification: "", description: "", additional_description: "", quantity: 0, unit: "", unit_price: 0, fund_source: FUND_SOURCES[0], requires_mfg_cert: false, mfg_cert_qty: 1 }]);
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
            mfg_cert_qty: 1
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

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const result = await importSectionFromJSON(file);
        if (result.success && Array.isArray(result.data)) {
            const cleaned = result.data.map((it: any) => {
                const { id, project_id, created_at, ...rest } = it;
                return { ...rest, project_id: projectId };
            });
            setItems(cleaned);
            alert("Partidas importadas correctamente. Guarde para confirmar.");
        } else {
            alert("Error al importar: " + (result.error || "Formato inválido"));
        }
        e.target.value = "";
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
            <div className="sticky top-0 z-40 bg-[#F8FAFC]/95 dark:bg-[#020617]/95 backdrop-blur-md pt-6 pb-4 -mx-4 px-4 md:-mx-8 md:px-8 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between mb-6">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold flex items-center gap-2 font-geist tracking-tight">
                        <ListChecks className="text-primary" />
                        Todas las partidas
                    </h2>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total del Contrato (Revisado):</span>
                        <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full text-sm font-extrabold border border-emerald-100 dark:border-emerald-800/50">
                            {formatCurrency(React.useMemo(() => items.reduce((sum, item) => {
                                const choQty = getCHOQty(item.item_num);
                                const totalQty = (parseFloat(item.quantity) || 0) + choQty;
                                return roundedAmt(sum + roundedAmt(totalQty * (parseFloat(item.unit_price) || 0), 2), 2);
                            }, 0), [items, chos]))}
                        </span>
                    </div>
                </div>
                <div className="flex gap-3">
                    {/* Los botones ahora son flotantes para mayor accesibilidad */}
                </div>
            </div>

            <FloatingFormActions
                actions={[
                    ...(projectId ? [
                        {
                            label: "Exportar JSON", position: "middle-right" as const, size: "small" as const,
                            icon: <Download />,
                            onClick: () => exportSectionToJSON("items", items),
                            description: "Exportar todas las partidas actuales a un archivo JSON",
                            variant: 'info' as const,
                            disabled: loading
                        },
                        {
                            label: "Importar JSON", position: "middle-right" as const, size: "small" as const,
                            icon: <Upload />,
                            onClick: () => document.getElementById('import-items-json')?.click(),
                            description: "Cargar partidas desde un archivo JSON",
                            variant: 'secondary' as const,
                            disabled: loading
                        },
                        {
                            label: loading ? "Procesando..." : "Cargar desde PDFs",
                            icon: <FileText />,
                            onClick: async () => {
                                setLoading(true);
                                try {
                                    const win = window as any;
                                    const parsePdf = async (b64: string) => {
                                        if (win.electronAPI?.parsePdfBase64) {
                                            return await win.electronAPI.parsePdfBase64(b64);
                                        } else {
                                            const parseRes = await fetch('/api/parse-pdf', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ base64: b64 })
                                            });
                                            return await parseRes.json();
                                        }
                                    };
                                    const { data: dbDocs } = await supabase.from('project_documents').select('file_name, storage_path').eq('project_id', projectId);
                                    if (!dbDocs?.length) { alert("Sube documentos (Proposal, Contrato) en la pestaña 'Datos Proyecto' primero."); setLoading(false); return; }
                                    
                                    let itemsCount = 0;
                                    const itemsToInsert: any[] = [];
                                    const blobToBase64 = (b: Blob): Promise<string> => new Promise(r => {
                                        const rd = new FileReader(); rd.onloadend = () => r(rd.result as string); rd.readAsDataURL(b);
                                    });

                                    for (const doc of dbDocs) {
                                        if (!doc.storage_path || !doc.storage_path.toLowerCase().endsWith('.pdf')) continue;
                                        const { data: blob } = await supabase.storage.from('project-documents').download(doc.storage_path);
                                        if (!blob) continue;
                                        const res = await parsePdf(await blobToBase64(blob));
                                        if (res.success && res.text) {
                                            const lines = res.text.split("\n");
                                            const pat = /(?:^|\s)(\d{1,3})\s+([A-Z0-9-]{4,10})\s+(.+?)\s+([\d,]+\.?[\d]*)\s+(LS|LUMP\s*SUM|EA|EACH|LF|SF|SY|CY|TON|GAL|MGAL|HOUR|DAY|MONTH)\s+\$?\s*([\d,]+\.\d{2})/i;
                                            for (const l of lines) {
                                                const m = pat.exec(l);
                                                if (m) {
                                                    const n = m[1].padStart(3, '0');
                                                    if (!itemsToInsert.some(it => it.item_num === n)) {
                                                        const spec = m[2].trim();
                                                        itemsToInsert.push({ project_id: projectId, item_num: n, specification: spec, description: m[3].trim().substring(0, 200), quantity: parseFloat(m[4].replace(/,/g, '')), unit: m[5].toUpperCase().trim(), unit_price: parseFloat(m[6].replace(/,/g, '')), fund_source: "ACT:100%", requires_mfg_cert: !!(mfgItemsData as Record<string, boolean>)[spec], mfg_cert_qty: 1 });
                                                        itemsCount++;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    if (itemsToInsert.length) {
                                        await supabase.from("contract_items").upsert(itemsToInsert, { onConflict: 'project_id, item_num' });
                                        await fetchItems();
                                        alert(`Análisis Finalizado: Se importaron ${itemsCount} partidas.`);
                                    } else {
                                        alert("No se detectaron partidas en los documentos actuales.");
                                    }
                                } catch (e) { console.error(e); }
                                setLoading(false);
                            },
                            description: "Extraer datos de partidas automáticamente de los PDFs subidos",
                            variant: 'info' as const,
                            disabled: loading
                        }
                    ] : []),
                    {
                        label: "Añadir Item",
                        icon: <Plus />,
                        onClick: addItem,
                        description: "Crear una nueva fila de partida al final del contrato",
                        variant: 'secondary' as const
                    },
                    {
                        label: loading ? "Guardando..." : "Guardar cambios",
                        icon: <Save />,
                        onClick: () => saveData(false),
                        description: "Guardar todos los cambios realizados en las partidas y refrescar balances",
                        variant: 'primary' as const,
                        disabled: loading
                    }
                ]}
            />
            <input id="import-items-json" type="file" accept=".json" className="hidden" onChange={handleImport} />


            {numAct && (
                <div className="flex items-center gap-2 -mt-4 mb-6">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Proyecto:</span>
                    <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-primary text-[10px] font-bold rounded border border-blue-100 dark:border-blue-800">
                        ACT-{numAct}
                    </span>
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
                            <th className="px-1 py-2 min-w-[80px] text-right text-blue-600">Cant. CHO</th>
                            <th className="px-1 py-2 min-w-[80px] text-right font-black">Cant. Total</th>
                            <th className="px-1 py-2 min-w-[80px] text-center" style={{fontSize:'9px'}}>Unid.</th>
                            <th className="px-1 py-2 min-w-[96px] text-right">U.P. ($)</th>
                            <th className="px-1 py-2 min-w-[120px] text-right">Amount Final ($)</th>
                            <th className="px-1 py-2 min-w-[110px] text-center">Fondos</th>
                            <th className="px-1 py-2 min-w-[48px] text-center" title="Requiere Cert. Manufactura">CM</th>
                            <th className="px-1 py-2 min-w-[64px]"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                        {items.map((item, originalIndex) => ({ item, originalIndex }))
                                .sort((a, b) => (parseInt(a.item.item_num) || 0) - (parseInt(b.item.item_num) || 0))
                                .map(({ item, originalIndex: idx }) => {
                            const choQty = getCHOQty(item.item_num);
                            const totalQty = (parseFloat(item.quantity) || 0) + choQty;
                            const amountFinal = roundedAmt(totalQty * (parseFloat(item.unit_price) || 0), 2);

                            const paidBreakdown = certs.map(cert => {
                                const certItems = Array.isArray(cert.items) ? cert.items : [];
                                const itemInCert = certItems.find((it: any) => it.item_num === item.item_num);
                                if (!itemInCert) return null;
                                return {
                                    certNum: cert.cert_num,
                                    periodTo: cert.period_to,
                                    qty: parseFloat(itemInCert.quantity) || 0,
                                    amount: roundedAmt((parseFloat(itemInCert.quantity) || 0) * (parseFloat(item.unit_price) || 0), 2)
                                };
                            }).filter(Boolean);

                            const choBreakdown = chos.map(cho => {
                                const choItems = Array.isArray(cho.items) ? cho.items : [];
                                const itemInCho = choItems.find((it: any) => it.item_num === item.item_num);
                                if (!itemInCho) return null;
                                return {
                                    choNum: cho.cho_num,
                                    amendmentLetter: cho.amendment_letter,
                                    date: cho.cho_date,
                                    qty: parseFloat(itemInCho.quantity) || 0,
                                    unitPrice: parseFloat(itemInCho.unit_price) || 0,
                                    amount: roundedAmt((parseFloat(itemInCho.quantity) || 0) * (parseFloat(itemInCho.unit_price) || 0), 2)
                                };
                            }).filter(Boolean);

                            const paidQty = paidBreakdown.reduce((sum, b) => sum + (b?.qty || 0), 0);
                            const remainingQty = totalQty - paidQty;

                            return (
                                <React.Fragment key={idx}>
                                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                                        <td className="px-1 py-1.5">
                                            <div className="relative group flex justify-center">
                                                <input
                                                type="text"
                                                maxLength={3}
                                                className={`input-field text-xs text-center font-bold h-8 !py-1 transition-all ${parseFloat(item.quantity) === 0 && choQty > 0 ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}
                                                style={{ backgroundColor: 'white' }}
                                                value={item.item_num || ""}
                                                onChange={(e) => updateItem(idx, 'item_num', e.target.value)}
                                                onBlur={(e) => {
                                                    const val = e.target.value;
                                                    if (val !== "" && !isNaN(parseInt(val))) {
                                                        updateItem(idx, 'item_num', val.padStart(3, '0'));
                                                    }
                                                }}
                                                />
                                                {parseFloat(item.quantity) === 0 && choQty > 0 && (
                                                    <span className="absolute -top-2 -right-1 px-1 py-0.5 bg-blue-600 text-white text-[7px] font-black rounded shadow-sm animate-pulse whitespace-nowrap z-10 border border-white leading-none">
                                                        CHO
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-1 py-1.5">
                                            <input type="text" className="input-field text-xs text-center h-8 !py-1" style={{ backgroundColor: (parseFloat(item.quantity) === 0 && choQty > 0) ? 'white' : '#66FF99' }} value={item.specification || ""} onChange={(e) => updateItem(idx, 'specification', e.target.value)} />
                                        </td>
                                        <td className="px-1 py-1.5">
                                            <div className="space-y-1">
                                                <input type="text" className="input-field text-xs h-8 !py-1" style={{ backgroundColor: (parseFloat(item.quantity) === 0 && choQty > 0) ? 'white' : '#66FF99' }} value={item.description || ""} onChange={(e) => updateItem(idx, 'description', e.target.value)} />
                                                <input type="text" className="input-field text-[10px] h-6 !py-0.5 opacity-70" style={{ backgroundColor: (parseFloat(item.quantity) === 0 && choQty > 0) ? 'white' : '#66FF99' }} value={item.additional_description || ""} onChange={(e) => updateItem(idx, 'additional_description', e.target.value)} placeholder="Descripción Adicional..." />
                                            </div>
                                        </td>
                                        <td className="px-1 py-1.5">
                                            <input type="number" className="input-field text-xs text-right h-8 !py-1" style={{ backgroundColor: (parseFloat(item.quantity) === 0 && choQty > 0) ? 'white' : '#66FF99' }} value={isNaN(item.quantity) ? "" : item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value === "" ? 0 : parseFloat(e.target.value))} />
                                        </td>
                                        <td className="px-1 py-1.5 text-right text-xs font-bold text-blue-600 pr-4">
                                            {choQty !== 0 ? formatNumber(choQty) : "-"}
                                        </td>
                                        <td className="px-1 py-1.5 text-right text-xs font-black pr-4">
                                            {formatNumber(totalQty)}
                                        </td>
                                        <td className="px-1 py-1.5 text-center">
                                            <input type="text" className="input-field uppercase h-8 !py-1 text-center px-1" style={{ fontSize: '9px', backgroundColor: (parseFloat(item.quantity) === 0 && choQty > 0) ? 'white' : '#66FF99' }} value={item.unit || ""} onChange={(e) => updateItem(idx, 'unit', e.target.value)} />
                                        </td>
                                        <td className="px-1 py-1.5">
                                            <input 
                                                type="number" 
                                                step="0.0001" 
                                                className="input-field text-xs text-right font-medium h-8 !py-1" 
                                                style={{ backgroundColor: (parseFloat(item.quantity) === 0 && choQty > 0) ? 'white' : '#66FF99' }} 
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
                                                style={{ backgroundColor: (parseFloat(item.quantity) === 0 && choQty > 0) ? 'white' : '#66FF99' }}
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
                                                style={!item.requires_mfg_cert ? { backgroundColor: (parseFloat(item.quantity) === 0 && choQty > 0) ? 'white' : '#66FF99' } : {}}
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
                                                <input
                                                    type="number"
                                                    title="Cantidad de Certificados de Manufactura Requeridos"
                                                    className="w-10 h-5 mt-1 text-[10px] text-center font-bold border border-amber-300 rounded mx-auto block"
                                                    value={item.mfg_cert_qty || 1}
                                                    onChange={(e) => updateItem(idx, 'mfg_cert_qty', parseInt(e.target.value) || 1)}
                                                />
                                            )}
                                        </td>
                                        <td className="px-1 py-1.5 text-center">
                                            <div className="flex flex-col gap-1.5 items-center">
                                                <div className="flex gap-1.5">
                                                    <button
                                                        onClick={() => setExpandedItem(expandedItem === idx ? null : idx)}
                                                        className={`transition-all rounded-full p-1 shadow-sm transform hover:scale-110 ${expandedItem === idx ? 'bg-blue-600 text-white ring-2 ring-blue-300' : 'bg-blue-100/80 text-blue-600 hover:bg-blue-500 hover:text-white'}`}
                                                        title="Ver desglose de pagos detallado"
                                                    >
                                                        <Info size={14} strokeWidth={2.5} />
                                                    </button>
                                                    <button
                                                        onClick={() => insertItem(idx)}
                                                        className="bg-emerald-100 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all rounded-full p-1 shadow-sm transform hover:scale-110"
                                                        title="Insertar item debajo"
                                                    >
                                                        <PlusSquare size={14} strokeWidth={2.5} />
                                                    </button>
                                                </div>
                                                <button type="button" onClick={() => removeItem(idx)} className="text-slate-300 hover:text-red-500 transition-colors" title="Eliminar partida">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    {expandedItem === idx && (
                                        <tr className="bg-blue-50/30 dark:bg-blue-900/10 border-l-2 border-blue-400">
                                            <td colSpan={12} className="px-4 py-4">
                                                <div className="flex flex-col gap-3">
                                                    <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm">
                                                        <div className="space-y-1">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Resumen de Pagos</span>
                                                            <h6 className="text-sm font-black text-slate-700 dark:text-slate-200">Partida {item.item_num}</h6>
                                                        </div>
                                                        <div className="flex gap-6 items-center">
                                                            <div className="text-right">
                                                                <div className="text-[10px] uppercase font-bold text-slate-400">Cant. Total</div>
                                                                <div className="text-sm font-black text-slate-700">{formatNumber(totalQty)}</div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-[10px] uppercase font-bold text-slate-400">Sumatoria Pagada</div>
                                                                <div className="text-sm font-black text-emerald-600">
                                                                    {formatNumber(paidQty)}
                                                                    <span className="text-xs text-slate-400 font-normal ml-1">({totalQty ? ((paidQty / totalQty) * 100).toFixed(0) : 0}%)</span>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-[10px] uppercase font-bold text-slate-400">Balance Disponible</div>
                                                                <div className="text-sm font-black text-blue-600">{formatNumber(remainingQty)}</div>
                                                            </div>
                                                            <div className="text-right pl-6 border-l border-slate-100 dark:border-slate-700 ml-2">
                                                                <div className="text-[10px] uppercase font-bold text-primary tracking-wider">Resultado Económico</div>
                                                                <div className="text-xl font-black text-primary leading-none mt-1">
                                                                    {formatCurrency(roundedAmt(paidQty * (parseFloat(item.unit_price) || 0), 2))}
                                                                </div>
                                                                <div className="text-[9px] font-bold text-slate-400 uppercase mt-1">de {formatCurrency(amountFinal)}</div>
                                                            </div>
                                                            <div className="text-right pl-6 border-l border-slate-100 dark:border-slate-700 ml-2">
                                                                <div className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">Balance ($)</div>
                                                                <div className="text-xl font-black text-blue-600 leading-none mt-1">
                                                                    {formatCurrency(roundedAmt(remainingQty * (parseFloat(item.unit_price) || 0), 2))}
                                                                </div>
                                                                <div className="text-[9px] font-bold text-slate-400 uppercase mt-1">Pendiente</div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 gap-4">
                                                        {/* CHOs Horizontal Breakdown */}
                                                        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
                                                            <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700 p-2 px-3">
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase">Enmiendas (Órdenes de Cambio)</span>
                                                            </div>
                                                            <div className="p-4 overflow-x-auto flex flex-nowrap gap-8 min-w-max items-center">
                                                                {choBreakdown.length > 0 ? (
                                                                    <>
                                                                        {choBreakdown.map((b, i) => (
                                                                            <div key={`cho-${i}`} className="flex flex-col items-center min-w-[70px]">
                                                                                <span className="text-[11px] font-bold text-blue-600 mb-2 whitespace-nowrap">CHO #{b?.choNum}{b?.amendmentLetter}</span>
                                                                                <span className={`text-sm font-black ${b?.qty && b.qty > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                                                    {b?.qty && b.qty > 0 ? `+${formatNumber(b.qty)}` : formatNumber(b?.qty)}
                                                                                </span>
                                                                                <span className="text-[10px] font-medium text-slate-400 mt-1">{b?.amount ? formatCurrency(b.amount) : formatCurrency(0)}</span>
                                                                            </div>
                                                                        ))}
                                                                        <div className="border-l-2 border-slate-100 dark:border-slate-700 h-10 mx-2"></div>
                                                                        <div className="flex flex-col items-center min-w-[70px]">
                                                                            <span className="text-[11px] font-bold text-blue-600 mb-2 whitespace-nowrap">TOTAL CHO</span>
                                                                            <span className={`text-sm font-black ${choQty > 0 ? 'text-emerald-600' : (choQty < 0 ? 'text-red-500' : 'text-slate-700')}`}>
                                                                                {choQty > 0 ? `+${formatNumber(choQty)}` : formatNumber(choQty)}
                                                                            </span>
                                                                            <span className="text-[10px] font-bold text-slate-400 mt-1">{formatCurrency(roundedAmt(choQty * (parseFloat(item.unit_price) || 0), 2))}</span>
                                                                        </div>
                                                                    </>
                                                                ) : (
                                                                    <div className="text-xs font-bold text-slate-400 italic">No hay órdenes de cambio registradas que modifiquen esta partida.</div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Certifications Horizontal Breakdown */}
                                                        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
                                                            <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700 p-2 px-3">
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase">Pagos Registrados (Certificaciones)</span>
                                                            </div>
                                                            <div className="p-4 overflow-x-auto flex flex-nowrap gap-8 min-w-max items-center">
                                                                {paidBreakdown.length > 0 ? (
                                                                    <>
                                                                        {paidBreakdown.map((b, i) => (
                                                                            <div key={`cert-${i}`} className="flex flex-col items-center min-w-[70px]">
                                                                                <span className="text-[11px] font-bold text-emerald-600 mb-2 whitespace-nowrap">CERT #{b?.certNum}</span>
                                                                                <span className="text-sm font-black text-slate-700">{formatNumber(b?.qty)}</span>
                                                                                <span className="text-[10px] font-medium text-slate-400 mt-1">{b?.amount ? formatCurrency(b.amount) : formatCurrency(0)}</span>
                                                                            </div>
                                                                        ))}
                                                                        <div className="border-l-2 border-slate-100 dark:border-slate-700 h-10 mx-2"></div>
                                                                        <div className="flex flex-col items-center min-w-[70px]">
                                                                            <span className="text-[11px] font-bold text-emerald-600 mb-2 whitespace-nowrap">PAGADO</span>
                                                                            <span className="text-sm font-black text-emerald-600">{formatNumber(paidQty)}</span>
                                                                            <span className="text-[10px] font-bold text-emerald-600 mt-1">{formatCurrency(roundedAmt(paidQty * (parseFloat(item.unit_price) || 0), 2))}</span>
                                                                        </div>
                                                                    </>
                                                                ) : (
                                                                    <div className="text-xs font-bold text-slate-400 italic">Esta partida no ha sido cobrada en ninguna certificación todavía.</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
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
