"use client";

import React, { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/lib/supabase";
import { Package, Info, Save } from "lucide-react";
import FloatingFormActions from "./FloatingFormActions";
import { formatCurrency } from "@/lib/utils";
import type { FormRef } from "./ProjectForm";

const FUND_SOURCES = ["ACT:100%", "FHWA:80.25", "FHWA:100%"];

const MaterialsForm = forwardRef<FormRef, { projectId?: string, numAct?: string, onDirty?: () => void, onSaved?: () => void }>(function MaterialsForm({ projectId, numAct, onDirty, onSaved }, ref) {
    const [certs, setCerts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (projectId) {
            fetchCerts();
        }
    }, [projectId]);

    const fetchCerts = async () => {
        const { data } = await supabase.from("payment_certifications").select("*").eq("project_id", projectId).order("cert_num", { ascending: true });
        if (data) {
            const normalized = data.map(c => {
                let items = c.items;
                if (c.items && !Array.isArray(c.items) && c.items.list) {
                    items = c.items.list;
                }
                return { ...c, items: Array.isArray(items) ? items : [] };
            });
            setCerts(normalized);
        }
    };

    const updateCertItem = (certIdx: number, itemIdx: number, field: string, value: any) => {
        const newList = [...certs];
        let finalValue = value;

        // Truncate price fields to 4 decimal places
        if (field === 'unit_price' || field === 'mos_unit_price') {
            const strVal = value.toString();
            if (strVal.includes('.')) {
                const [intPart, decPart] = strVal.split('.');
                finalValue = intPart + '.' + decPart.substring(0, 4);
            }
        }

        newList[certIdx].items[itemIdx][field] = finalValue;

        // Auto-calculate mos_unit_price = total / quantity
        if (field === 'mos_invoice_total' || field === 'mos_quantity') {
            const total = parseFloat(newList[certIdx].items[itemIdx].mos_invoice_total) || 0;
            const qty = parseFloat(newList[certIdx].items[itemIdx].mos_quantity) || 0;
            if (qty > 0) {
                const rawPrice = (total / qty).toString();
                let calcPrice = rawPrice;
                if (rawPrice.includes('.')) {
                    const [intP, decP] = rawPrice.split('.');
                    calcPrice = intP + '.' + decP.substring(0, 4);
                }
                newList[certIdx].items[itemIdx]['mos_unit_price'] = calcPrice;
            }
        }
        setCerts(newList);
        if (onDirty) onDirty();
    };

    const saveData = async (silent = false) => {
        if (!projectId) return;
        setLoading(true);

        try {
            // Guardar cada certificación individualmente para actualizar sus partidas de MOS
            for (const cert of certs) {
                const { error } = await supabase
                    .from("payment_certifications")
                    .update({ items: cert.items })
                    .eq("id", cert.id);

                if (error) throw error;
            }

            if (!silent) alert("Resumen de Materiales en Sitio actualizado");
            if (onSaved) onSaved();
        } catch (error: any) {
            if (!silent) alert("Error: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    useImperativeHandle(ref, () => ({ save: () => saveData(true) }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await saveData();
    };

    const getInvoicePU = (certsList: any[], itemNum: string, currentCertIdx: number) => {
        for (let i = currentCertIdx; i >= 0; i--) {
            if (!certsList[i]) continue;
            const its = Array.isArray(certsList[i].items) ? certsList[i].items : (certsList[i].items?.list || []);
            const match = its.find((itx: any) => itx.item_num === itemNum && itx.has_material_on_site && parseFloat(itx.mos_unit_price) > 0);
            if (match) return parseFloat(match.mos_unit_price);
        }
        return 0;
    };

    const groupedItems = new Map<string, any>();

    certs.forEach((c, cIdx) => {
        const items = c.items || [];
        items.forEach((it: any, iIdx: number) => {
            const hasAddition = it.has_material_on_site;
            const hasDeduction = parseFloat(it.qty_from_mos) > 0;

            if (hasAddition || hasDeduction) {
                if (!groupedItems.has(it.item_num)) {
                    groupedItems.set(it.item_num, {
                        item_num: it.item_num,
                        specification: it.specification,
                        description: it.description,
                        activities: []
                    });
                }
                const group = groupedItems.get(it.item_num);

                if (hasAddition) {
                    const cost = parseFloat(it.mos_invoice_total) || 0;
                    group.activities.push({
                        certNum: c.cert_num,
                        certIdx: cIdx,
                        itemIdx: iIdx,
                        type: 'addition',
                        qty: parseFloat(it.mos_quantity) || 0,
                        cost: cost,
                        mos_quantity: it.mos_quantity,
                        mos_unit_price: it.mos_unit_price,
                        mos_invoice_total: it.mos_invoice_total,
                        rawItem: it
                    });
                }

                if (hasDeduction) {
                    const mosPU = getInvoicePU(certs, it.item_num, cIdx);
                    const p = mosPU > 0 ? mosPU : (parseFloat(it.unit_price) || 0);
                    const qty = parseFloat(it.qty_from_mos) || 0;
                    const cost = qty * p;
                    group.activities.push({
                        certNum: c.cert_num,
                        certIdx: cIdx,
                        type: 'deduction',
                        qty: qty,
                        cost: cost
                    });
                }
            }
        });
    });

    const groupsList = Array.from(groupedItems.values())
        .sort((a, b) => a.item_num.localeCompare(b.item_num, undefined, { numeric: true }))
        .map(group => {
        let runBal = 0;
        group.activities.forEach((act: any) => {
            if (act.type === 'addition') {
                runBal += act.cost;
            } else {
                runBal -= act.cost;
            }
            act.runningBalance = Math.max(0, runBal);
        });
        return group;
    });

    return (
        <div className="w-full space-y-6">
            <div className="sticky top-0 z-40 bg-[#F8FAFC]/95 dark:bg-[#020617]/95 backdrop-blur-md pt-4 pb-4 -mx-4 px-4 md:-mx-8 md:px-8 border-b border-slate-200 dark:border-slate-800 flex flex-col items-center justify-between mb-6">
                <div className="w-full flex justify-center mb-2">
                    <div className="flex items-center gap-2 px-4 py-1.5 bg-red-50 border border-red-100 rounded-xl">
                        <Info size={14} className="text-red-600 shrink-0" />
                        <span className="text-sm font-black text-red-600 uppercase">Esta sección se actualiza automáticamente — no es necesario ingresar información aquí.</span>
                    </div>
                </div>
                <div className="w-full flex items-center justify-between">
                    <h2 className="text-2xl font-bold flex items-center gap-3">
                        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                            <Package className="text-amber-600" size={24} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Sección 4</span>
                            <div className="flex items-center gap-3">
                                <span>Inventario Material on Site</span>
                                <span className="text-lg px-3 py-0.5 rounded-lg border bg-slate-50 text-slate-700 border-slate-200">
                                    {formatCurrency(groupsList.reduce((acc, group) => {
                                        const actLen = group.activities.length;
                                        return acc + (actLen > 0 ? (group.activities[actLen - 1]?.runningBalance || 0) : 0);
                                    }, 0))}
                                </span>
                            </div>
                        </div>
                    </h2>
                </div>
            </div>


            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50/50 dark:bg-slate-800/50">
                            <tr className="text-[10px] uppercase font-black text-slate-400 tracking-wider">
                                <th className="py-4 px-6 w-32 border-b border-slate-200 dark:border-slate-700"># Item / Espec.</th>
                                <th className="py-4 px-4 w-64 border-b border-slate-200 dark:border-slate-700">Descripción</th>
                                <th className="py-4 px-4 text-center border-b border-slate-200 dark:border-slate-700">Cert #</th>
                                <th className="py-4 px-4 text-center border-b border-slate-200 dark:border-slate-700">Tipo</th>
                                <th className="py-4 px-4 text-right w-40 border-b border-slate-200 dark:border-slate-700">Cant.</th>
                                <th className="py-4 px-4 text-right w-40 border-b border-slate-200 dark:border-slate-700">Monto ($)</th>
                                <th className="py-4 px-6 text-right w-48 text-emerald-600 bg-emerald-50/30 border-b border-slate-200 dark:border-slate-700">Balance ($)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {groupsList.map((group, groupIdx) => {
                                const rowSpan = group.activities.length;
                                return (
                                    <React.Fragment key={groupIdx}>
                                        {group.activities.map((act: any, actIdx: number) => (
                                            <tr key={`${groupIdx}-${actIdx}`} className="hover:bg-slate-50/20 dark:hover:bg-slate-800/10 transition-colors">
                                                {actIdx === 0 && (
                                                    <>
                                                        <td className="py-4 px-6 align-top border-r border-slate-100 dark:border-slate-800" rowSpan={rowSpan}>
                                                            <div className="font-bold text-sm text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded px-2 py-1 inline-block mb-1">
                                                                {group.item_num}
                                                            </div>
                                                            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mt-1">
                                                                {group.specification}
                                                            </div>
                                                        </td>
                                                        <td className="py-4 px-4 align-top border-r border-slate-100 dark:border-slate-800" rowSpan={rowSpan}>
                                                            <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                                                                {group.description}
                                                            </div>
                                                        </td>
                                                    </>
                                                )}
                                                <td className="py-3 px-4 text-center align-middle">
                                                    <span className="text-[11px] font-black text-primary px-2 py-1 bg-primary/10 rounded-lg">#{act.certNum}</span>
                                                </td>
                                                <td className="py-3 px-4 text-center align-middle">
                                                    <span className={`text-[10px] font-bold px-2 py-1 rounded w-full block whitespace-nowrap ${act.type === 'addition' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                                                        {act.type === 'addition' ? 'Adición (Factura)' : 'Deducción (WP)'}
                                                    </span>
                                                </td>

                                                <td className="py-3 px-4 text-right align-middle">
                                                    {act.type === 'addition' ? (
                                                        <div className="flex flex-col items-end justify-center h-full">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                className="input-field text-xs font-bold text-right w-24 h-7 p-1 bg-amber-50/50 border-amber-200 focus:border-amber-500"
                                                                value={isNaN(parseFloat(act.mos_quantity)) ? "" : (act.mos_quantity ?? "")}
                                                                onChange={(e) => updateCertItem(act.certIdx, act.itemIdx, 'mos_quantity', e.target.value)}
                                                                title="Cantidad Adicionada"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs font-medium text-blue-600 font-geist">-{act.qty.toFixed(2)}</span>
                                                    )}
                                                </td>

                                                <td className="py-3 px-4 text-right align-middle">
                                                    {act.type === 'addition' ? (
                                                        <div className="flex flex-col gap-1.5 items-end justify-center h-full">
                                                            <span className="text-sm font-black text-amber-700 font-geist" title="Total Factura (Sección 6)">{formatCurrency(act.cost)}</span>
                                                            <div className="text-[9px] text-amber-600/70 font-bold flex gap-1.5 items-center">
                                                                <span>PU:</span>
                                                                <input
                                                                    type="number"
                                                                    step="0.0001"
                                                                    className="input-field text-[10px] font-bold text-right w-20 h-6 p-1 bg-white border-amber-200 focus:border-amber-500"
                                                                    value={isNaN(parseFloat(act.mos_unit_price)) ? "" : (act.mos_unit_price ?? "")}
                                                                    onChange={(e) => updateCertItem(act.certIdx, act.itemIdx, 'mos_unit_price', e.target.value)}
                                                                />
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-end gap-1">
                                                            <span className="text-sm font-black text-blue-600 font-geist">-{formatCurrency(act.cost)}</span>
                                                            <span className="text-[8px] font-bold text-slate-400 uppercase">Por Uso (WP)</span>
                                                        </div>
                                                    )}
                                                </td>

                                                <td className="py-3 px-6 text-right bg-emerald-50/20 dark:bg-emerald-900/10 align-middle">
                                                    <span className={`text-sm font-black font-geist ${act.runningBalance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                        {formatCurrency(act.runningBalance)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                        {/* Separador entre grupos */}
                                        <tr className="border-b-[4px] border-slate-200 dark:border-slate-700"></tr>
                                    </React.Fragment>
                                );
                            })}
                            {groupsList.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="py-20 text-center text-slate-400 italic font-medium">
                                        <div className="flex flex-col items-center gap-4">
                                            <Package size={40} className="text-slate-200" />
                                            No hay actividad de "Material on Site" en este proyecto.
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
});

export default MaterialsForm;
