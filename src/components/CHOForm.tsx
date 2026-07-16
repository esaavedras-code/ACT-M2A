"use client";

import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/lib/supabase";
import { Save, FileEdit, Plus, Trash2, DollarSign, Activity, Timer, Files, PlusSquare, TrendingUp, Download, Upload, Printer } from "lucide-react";
import FloatingFormActions from "./FloatingFormActions";
import { formatCurrency, roundedAmt, sortItemsNaturally, getFederalSharePct } from "@/lib/utils";
import { generateCCMLReportLogic } from "@/lib/reportLogic";
import specsData from "@/data/specifications.json";

import type { FormRef } from "./ProjectForm";

const specs = specsData as Record<string, { unit: string; description: string }>;

const DOC_STATUSES = ["Borrador", "En trámite", "Aprobado"];
const TIME_EXT_STATUSES = ["Aprobada", "Pendiente"];
const FUND_SOURCES = ["FHWA:100%", "FHWA:80.25", "ACT:100%"];

import { TodayButton } from "./TodayButton";

const calculateChoBreakdown = (items: any[], project: any) => {
    let fed = 0, act = 0;
    (items || []).forEach((it: any) => {
        const total = roundedAmt((parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 2);
        const fedPct = getFederalSharePct(project, it);
        const fedShare = roundedAmt(total * (fedPct / 100), 2);
        const actShare = roundedAmt(total - fedShare, 2);
        fed = roundedAmt(fed + fedShare, 2);
        act = roundedAmt(act + actShare, 2);
    });
    return { fed, act, fedDynamic: 0, fed100: 0 }; // fedDynamic y fed100 se mantienen por compatibilidad si se usan en algún lugar
};

const CHOForm = forwardRef<FormRef, { projectId?: string, numAct?: string, onDirty?: () => void, onSaved?: () => void }>(function CHOForm({ projectId, numAct, onDirty, onSaved }, ref) {
    const [chos, setChos] = useState<any[]>([]);
    const [contractItems, setContractItems] = useState<any[]>([]);
    const [projectData, setProjectData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [expandedCHO, setExpandedCHO] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (projectId && mounted) {
            fetchProjectData();
            fetchContractItems();
            fetchCHOs();

            // Sincronización en tiempo real
            const channel = supabase
                .channel(`chos-form-${projectId}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'chos', filter: `project_id=eq.${projectId}` }, () => fetchCHOs())
                .on('postgres_changes', { event: '*', schema: 'public', table: 'contract_items', filter: `project_id=eq.${projectId}` }, () => fetchContractItems())
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [projectId, mounted]);

    const fetchProjectData = async () => {
        const { data } = await supabase.from("projects").select("*").eq("id", projectId).single();
        if (data) setProjectData(data);
    };

    const fetchContractItems = async () => {
        const { data } = await supabase.from("contract_items").select("*").eq("project_id", projectId);
        if (data) setContractItems(sortItemsNaturally(data));
    };

    const fetchCHOs = async () => {
        const { data } = await supabase.from("chos").select("*").eq("project_id", projectId).order("cho_num", { ascending: false });
        if (data && data.length > 0) {
            setChos(data.map(c => ({
                ...c,
                items: Array.isArray(c.items) ? c.items : []
            })));
        } else {
            addCHO(true);
        }
    };

    const addCHO = (silent = false) => {
        const lastNum = chos.length > 0 ? Math.max(...chos.map(c => c.cho_num)) : 0;
        const lastLetter = chos.length > 0 ? chos[chos.length - 1].amendment_letter : "";
        const nextLetter = lastLetter ? String.fromCharCode(lastLetter.charCodeAt(0) + 1) : "A";

        const newId = crypto.randomUUID();
        setChos([{
            id: newId,
            project_id: projectId,
            cho_num: lastNum + 1,
            amendment_letter: chos.length === 0 ? "A" : nextLetter,
            cho_date: new Date().toISOString().split('T')[0],
            time_extension_days: 0,
            doc_status: DOC_STATUSES[0],
            reason: "",
            justification: "",
            federal_share_pct: 0,
            toll_credits_amt: 0,
            non_participating_state_amt: 0,
            state_share_federal_funds: 0,
            fed_share_mod_letter: 0,
            toll_credits_mod: 0,
            is_change_of_contract: false,
            is_new_item: false,
            is_time_extension: false,
            is_admin_amendment: false,
            items: []
        }, ...chos]);
        setExpandedCHO(newId);
        if (!silent && onDirty) onDirty();
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
            is_new: false,
            is_admin_amendment: false,
            specification: "",
            description: "",
            additional_description: "",
            quantity: 0,
            unit_price: 0,
            fund_source: FUND_SOURCES[0]
        });
        setChos(newList);
        if (onDirty) onDirty();
    };

    const insertCHOItem = (choIdx: number, itemIdx: number) => {
        const newList = [...chos];
        if (!newList[choIdx].items) newList[choIdx].items = [];
        
        const currentItemNum = parseInt(newList[choIdx].items[itemIdx]?.item_num);
        const nextNum = !isNaN(currentItemNum) ? (currentItemNum + 1).toString().padStart(3, '0') : "";

        newList[choIdx].items.splice(itemIdx + 1, 0, {
            item_num: nextNum,
            is_new: false,
            is_admin_amendment: false,
            specification: "",
            description: "",
            additional_description: "",
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
                newList[choIdx].items[itemIdx]['additional_description'] = match.additional_description || "";
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
                if (item.item_num && !contractItems.some(ci => (ci.item_num || "").toString().trim().padStart(3, '0') === (item.item_num || "").toString().trim().padStart(3, '0'))) {
                    if (!missingItemsMap.has(item.item_num)) {
                        missingItemsMap.set(item.item_num, {
                            project_id: projectId,
                            item_num: item.item_num,
                            specification: item.specification || "",
                            description: item.description || "",
                            additional_description: item.additional_description || "",
                            quantity: 0, // Original quantity is 0 since it comes from CHO
                            unit: item.unit || "",
                            unit_price: item.unit_price || 0,
                            fund_source: item.fund_source || FUND_SOURCES[0],
                            requires_mfg_cert: item.requires_mfg_cert || false,
                            mfg_cert_qty: item.mfg_cert_qty || 1,
                            mfg_cert_unit: item.mfg_cert_unit || "",
                            mfg_cert_description: item.mfg_cert_description || ""
                        });
                    }
                }
            }
        }

        let currentContractItems = [...contractItems];

        if (missingItemsMap.size > 0) {
            const missingItemsToInsert = Array.from(missingItemsMap.values());
            const { data: insertedData, error: insErr } = await supabase
                .from("contract_items")
                .insert(missingItemsToInsert)
                .select();
            if (!insErr) {
                if (insertedData) {
                    currentContractItems = [...currentContractItems, ...insertedData];
                }
                fetchContractItems();
            } else {
                console.error("Error adding missing items to contract", insErr);
            }
        }

        // Sincronizar todos los ítems de los CHO en la tabla contract_items
        // NOTA: requires_mfg_cert se preserva del contract_item existente para respetar cambios manuales.
        const itemsToUpdate = [];
        const updatedItemNums = new Set();
        for (const cho of chos) {
            for (const item of (cho.items || [])) {
                if (item.item_num && !updatedItemNums.has(item.item_num)) {
                    const existingItem = currentContractItems.find(
                        ci => (ci.item_num || "").toString().trim().padStart(3, '0') === (item.item_num || "").toString().trim().padStart(3, '0')
                    );
                    if (existingItem) {
                        updatedItemNums.add(item.item_num);
                        itemsToUpdate.push({
                            id: existingItem.id, // UUID
                            project_id: projectId,
                            item_num: item.item_num,
                            specification: item.specification || "",
                            description: item.description || "",
                            additional_description: item.additional_description || "",
                            quantity: existingItem.quantity, // Conservamos la cantidad contractual original
                            unit: item.unit || "",
                            unit_price: item.unit_price || 0,
                            fund_source: item.fund_source || FUND_SOURCES[0],
                            // Preservamos el valor actual del contract_item, NO el del CHO,
                            // para respetar cambios manuales que el usuario haya hecho.
                            requires_mfg_cert: existingItem.requires_mfg_cert ?? (item.requires_mfg_cert || false),
                            mfg_cert_qty: item.mfg_cert_qty || 1,
                            mfg_cert_unit: item.mfg_cert_unit || "",
                            mfg_cert_description: item.mfg_cert_description || ""
                        });
                    }
                }
            }
        }

        if (itemsToUpdate.length > 0) {
            const { error: updErr } = await supabase.from("contract_items").upsert(itemsToUpdate, { onConflict: "id" });
            if (!updErr) {
                fetchContractItems();
            } else {
                console.error("Error updating contract items from CHO", updErr);
            }
        }

        try {
            const { data: existingRecords, error: fetchError } = await supabase.from("chos").select("id").eq("project_id", projectId);
            if (fetchError) throw fetchError;
            const existingIds = existingRecords?.map(r => r.id) || [];

            const updates = [];

            for (const c of chos) {
                const { id, created_at, ...rest } = c;
                const total = (c.items || []).reduce((acc: number, item: any) => {
                    const q = parseFloat(item.quantity) || 0;
                    const p = parseFloat(item.unit_price) || 0;
                    return roundedAmt(acc + roundedAmt(q * p, 2), 2);
                }, 0);

                const payload = {
                    ...rest,
                    project_id: projectId,
                    time_extension_days: parseInt(c.time_extension_days as any) || 0,
                    federal_share_pct: parseFloat(c.federal_share_pct as any) || 0,
                    toll_credits_amt: parseFloat(c.toll_credits_amt as any) || 0,
                    non_participating_state_amt: parseFloat(c.non_participating_state_amt as any) || 0,
                    state_share_federal_funds: parseFloat(c.state_share_federal_funds as any) || 0,
                    fed_share_mod_letter: parseFloat(c.fed_share_mod_letter as any) || 0,
                    toll_credits_mod: parseFloat(c.toll_credits_mod as any) || 0,
                    proposed_change: total,
                    is_change_of_contract: (c.items || []).some((it: any) => !it.is_new),
                    is_new_item: (c.items || []).some((it: any) => it.is_new),
                    is_time_extension: c.is_time_extension || (c.time_extension_days > 0),
                    is_admin_amendment: c.is_admin_amendment || false,
                    items: c.items || []
                };

                updates.push({ id, ...payload });
            }

            const currentIds = updates.map(u => u.id);
            const idsToDelete = existingIds.filter(id => !currentIds.includes(id));

            if (idsToDelete.length > 0) {
                const { error: delError } = await supabase.from("chos").delete().in("id", idsToDelete);
                if (delError) throw delError;
            }

            if (updates.length > 0) {
                const { error: updateError } = await supabase.from("chos").upsert(updates, { onConflict: "id" });
                if (updateError) throw updateError;
            }

            if (!silent) alert("Órdenes de Cambio sincronizadas");
            await fetchCHOs(); // Refresh IDs correctly
            if (onSaved) onSaved();

        } catch (error: any) {
            console.error("Save error:", error);
            if (!silent) alert("Error: " + error.message);
        }
    };


    useImperativeHandle(ref, () => ({ save: () => saveData(true) }));

    const toggleExpand = (id: string) => {
        setExpandedCHO(expandedCHO === id ? null : id);
    };

    if (!mounted) return null;

    return (
        <div suppressHydrationWarning className="w-full space-y-6">
            <div className="sticky top-0 z-40 bg-[#F8FAFC]/95 dark:bg-[#020617]/95 backdrop-blur-md pt-6 pb-4 -mx-4 px-4 md:-mx-8 md:px-8 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <TrendingUp className="text-primary" />
                        Change Orders / Enmiendas
                    </h2>
                </div>
                <div className="flex-1 max-w-md mx-6 hidden md:block">
                    <div className="relative group">
                        <input 
                            type="text"
                            placeholder="Buscar por descripción o nº de ítem..."
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex gap-2">
                </div>
            </div>

            <div className="md:hidden px-4 mb-2">
                <input 
                    type="text"
                    placeholder="Buscar por descripción o nº de ítem..."
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <FloatingFormActions
                actions={[
                    {
                        label: "Imprimir",
                        icon: <Printer />,
                        onClick: () => window.print(),
                        description: "Imprimir esta sección de Change Orders",
                        variant: 'secondary' as const,
                        size: 'small' as const
                    },
                    {
                        label: "Nueva Enmienda",
                        icon: <Plus />,
                        onClick: addCHO,
                        description: "Crear una nueva Orden de Cambio (CHO) para el proyecto",
                        variant: 'secondary' as const
                    },
                    {
                        label: loading ? "Guardando..." : "Guardar cambios",
                        icon: <Save />,
                        onClick: () => saveData(false),
                        description: "Sincronizar todas las enmiendas y partidas vinculadas con el contrato",
                        variant: 'primary' as const,
                        disabled: loading
                    }
                ]}
            />



            {/* Cuadro de Resumen Financiero de CHOs */}
            {(() => {
                const approvedTotal = chos.filter(c => c.doc_status === "Aprobado").reduce((sum, c) => sum + (c.items || []).reduce((s: number, it: any) => roundedAmt(s + roundedAmt((parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 2), 2), 0), 0);
                const pendingTotal = chos.filter(c => c.doc_status === "En trámite").reduce((sum, c) => sum + (c.items || []).reduce((s: number, it: any) => roundedAmt(s + roundedAmt((parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 2), 2), 0), 0);
                const approvedDays = chos.filter(c => c.doc_status === "Aprobado").reduce((sum, c) => sum + (c.time_extension_days || 0), 0);
                let approvedFed = 0, approvedAct = 0;
                const pFedPct = projectData?.federal_share_pct ?? 80.25;

                chos.filter(c => c.doc_status === "Aprobado").forEach(c => {
                    const b = calculateChoBreakdown(c.items, projectData);
                    approvedFed = roundedAmt(approvedFed + b.fed, 2);
                    approvedAct = roundedAmt(approvedAct + b.act, 2);
                });
                return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                        <SummaryItem label="Total Aprobado ($)" value={approvedTotal} icon={<DollarSign size={16} />} color="text-emerald-600" bgColor="bg-emerald-50 dark:bg-emerald-900/20" breakdown={{ fed: approvedFed, act: approvedAct }} />
                        <SummaryItem label="Total en Trámite ($)" value={pendingTotal} icon={<DollarSign size={16} />} color="text-amber-600" bgColor="bg-amber-50 dark:bg-amber-900/20" />
                        <SummaryItem label="Impacto Económico" value={approvedTotal} icon={<Activity size={16} />} color="text-primary" bgColor="bg-blue-50 dark:bg-blue-900/20" breakdown={{ fed: approvedFed, act: approvedAct }} />
                        <SummaryItem label="Días de Extensión" value={approvedDays} icon={<Timer size={16} />} color="text-slate-600" bgColor="bg-slate-100 dark:bg-slate-800" isCurrency={false} />
                    </div>
                );
            })()}

            <div className="space-y-4">
                {chos.map((cho, idx) => (
                    <div key={cho.id || idx} className="card border-none shadow-sm overflow-hidden bg-white dark:bg-slate-900 p-0">
                        <div className="p-4 flex flex-col gap-4 bg-slate-50/50 dark:bg-slate-800/20">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">CHO / Enmienda</label>
                                        <div className="text-2xl font-black text-primary flex items-baseline gap-1">
                                            #{cho.cho_num}
                                            <span className="text-lg text-slate-400 font-bold">{cho.amendment_letter}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1 relative">
                                        <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Fecha</label>
                                        <div className="relative">
                                            <input suppressHydrationWarning type="date" className="input-field text-xs font-bold bg-white dark:bg-slate-900 w-36 pr-12" style={{ backgroundColor: '#66FF99' }} value={cho.cho_date || ""} onChange={(e) => updateCHO(idx, 'cho_date', e.target.value)} />
                                            <TodayButton onSelect={(date) => updateCHO(idx, 'cho_date', date)} />
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Ext. Días</label>
                                        <input suppressHydrationWarning type="number" className="input-field text-xs text-center font-bold !w-[60px] bg-white dark:bg-slate-900" style={{ backgroundColor: '#66FF99' }} value={cho.time_extension_days ?? 0} onChange={(e) => updateCHO(idx, 'time_extension_days', parseInt(e.target.value))} />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Estatus Doc.</label>
                                        <select suppressHydrationWarning className="input-field text-xs font-bold bg-white dark:bg-slate-900" style={{ backgroundColor: '#66FF99' }} value={cho.doc_status || DOC_STATUSES[0]} onChange={(e) => updateCHO(idx, 'doc_status', e.target.value)}>
                                            {DOC_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Importe Total</label>
                                        <div className="input-field text-xs font-black bg-white dark:bg-slate-900 flex flex-col justify-center px-3 h-auto min-h-[30px] border-emerald-500/30 text-emerald-600 min-w-[200px] py-1">
                                            {(() => {
                                                const pFedPct = projectData?.federal_share_pct ?? 80.25;
                                                const { act, fed } = calculateChoBreakdown(cho.items, projectData);
                                                const total = roundedAmt(act + fed, 2);
                                                return (
                                                    <>
                                                        <div className="text-sm">{formatCurrency(total)}</div>
                                                        <div className="text-[13px] font-black flex flex-col mt-1.5 space-y-0.5 uppercase tracking-wide">
                                                            {act !== 0 && <span className="text-blue-600">ACT: {formatCurrency(act)}</span>}
                                                            {fed !== 0 && <span className="text-amber-600">FHWA: {formatCurrency(fed)}</span>}
                                                        </div>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => toggleExpand(cho.id)} className="bg-slate-200/50 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                                        {expandedCHO === cho.id ? "Cerrar Partidas" : "Ver / Añadir Partidas"}
                                    </button>
                                    <button type="button" onClick={() => removeCHO(idx)} className="text-slate-300 hover:text-red-500 transition-colors">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                            
                            <div className="flex gap-4 items-center bg-white/50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input type="checkbox" className="w-4 h-4 rounded text-primary border-slate-300 focus:ring-primary" checked={(cho.items || []).some((it: any) => !it.is_new)} readOnly disabled />
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Change of Contract Items</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input type="checkbox" className="w-4 h-4 rounded text-primary border-slate-300 focus:ring-primary" checked={(cho.items || []).some((it: any) => it.is_new)} readOnly disabled />
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">New Items (Extra Work)</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input type="checkbox" className="w-4 h-4 rounded text-primary border-slate-300 focus:ring-primary" checked={cho.is_time_extension || (cho.time_extension_days > 0)} onChange={(e) => updateCHO(idx, 'is_time_extension', e.target.checked)} />
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider group-hover:text-primary transition-colors">Time Extension</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input type="checkbox" className="w-4 h-4 rounded text-primary border-slate-300 focus:ring-primary" checked={cho.is_admin_amendment || false} onChange={(e) => updateCHO(idx, 'is_admin_amendment', e.target.checked)} />
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider group-hover:text-primary transition-colors">Enmienda Administrativa</span>
                                </label>
                            </div>
                        </div>

                        {expandedCHO === cho.id && (
                            <div className="p-4 border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2 duration-200">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="text-[10px] uppercase font-bold text-slate-400 border-b border-slate-50 dark:border-slate-800">
                                            <tr>
                                                <td colSpan={13} className="py-2">
                                                    <button onClick={() => addCHOItem(idx)} className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                                                        <Plus size={14} /> Añadir item
                                                    </button>
                                                </td>
                                            </tr>
                                            <tr>
                                                <th className="py-1 px-0.5 w-10 text-center text-blue-600">Nuevo</th>

                                                <th className="py-1 px-0.5 w-28 text-center"># Item</th>
                                                <th className="py-1 px-0.5 w-40 text-center">Espec.</th>
                                                <th className="py-1 px-0.5 min-w-[350px]">Descripción</th>
                                                <th className="py-1 px-0.5 w-28 text-center">Unit</th>
                                                <th className="py-1 px-0.5 w-36 text-right">Qty</th>
                                                <th className="py-1 px-0.5 w-40 text-right">Unit Price</th>
                                                <th className="py-1 px-0.5 w-44 text-right">Amount</th>
                                                <th className="py-1 px-0.5 w-48">Fondos</th>
                                                <th className="py-1 px-0.5 w-14 text-center" style={{ backgroundColor: '#66FF99' }}>CM</th>
                                                <th className="py-1 px-0.5 w-24 text-center">Cant. CM</th>
                                                <th className="py-1 px-0.5 w-20 text-center">Unidad CM</th>
                                                <th className="py-1 px-0.5 min-w-[150px]">Descr. CM</th>
                                                <th className="py-1 px-0.5 w-8"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                            {(cho.items || []).map((item: any, originalItIdx: number) => ({ item, originalItIdx }))
                                                .filter(({ item }: any) => {
                                                    if (!searchTerm) return true;
                                                    const term = searchTerm.toLowerCase();
                                                    return item.description?.toLowerCase().includes(term) || item.item_num?.toString().includes(term);
                                                })
                                                .sort((a, b) => {
                                                    const numA = (a.item.item_num || "").toString().replace(/[^0-9]/g, '');
                                                    const numB = (b.item.item_num || "").toString().replace(/[^0-9]/g, '');
                                                    const parsedA = parseInt(numA || '0');
                                                    const parsedB = parseInt(numB || '0');
                                                    if (parsedA !== parsedB) return parsedA - parsedB;
                                                    return (a.item.item_num || "").localeCompare(b.item.item_num || "");
                                                })
                                                .map(({ item, originalItIdx: itIdx }: any) => (
                                                <tr key={itIdx}>
                                                    <td className="py-0.5 px-0.5 text-center">
                                                        <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-primary" checked={item.is_new || false} onChange={(e) => updateCHOItem(idx, itIdx, 'is_new', e.target.checked)} disabled={item.is_admin_amendment} />
                                                    </td>

                                                    <td className="py-0.5 px-0.5">
                                                        <input type="text" maxLength={20} className="input-field text-xs text-center !px-2 h-7" style={{ backgroundColor: '#66FF99' }} value={item.item_num || ""} onChange={(e) => updateCHOItem(idx, itIdx, 'item_num', e.target.value)} onBlur={(e) => {
                                                            const val = e.target.value;
                                                            if (val !== "" && !isNaN(parseInt(val))) {
                                                                updateCHOItem(idx, itIdx, 'item_num', val.padStart(3, '0'));
                                                            }
                                                        }} disabled={item.is_admin_amendment} />
                                                    </td>
                                                    <td className="py-0.5 px-0.5">
                                                        <input type="text" className="input-field text-xs text-center !px-2 h-7" style={{ backgroundColor: item.is_new ? '#66FF99' : undefined }} value={item.specification || ""} onChange={(e) => updateCHOItem(idx, itIdx, 'specification', e.target.value)} disabled={item.is_admin_amendment} />
                                                    </td>
                                                    <td className="py-0.5 px-0.5">
                                                         <div className="space-y-1">
                                                             <textarea 
                                                                 className="input-field text-xs !px-2 py-1 min-h-[30px] h-auto resize-none w-full leading-tight" 
                                                                 value={item.description || ""} 
                                                                 onChange={(e) => updateCHOItem(idx, itIdx, 'description', e.target.value)} 
                                                                 disabled={item.is_admin_amendment}
                                                                 rows={1}
                                                             />
                                                             <textarea 
                                                                 className="input-field text-[10px] !px-2 py-1 min-h-[24px] h-auto resize-none w-full opacity-70 leading-tight" 
                                                                 style={{ backgroundColor: item.is_new ? '#66FF99' : undefined }} 
                                                                 value={item.additional_description || ""} 
                                                                 onChange={(e) => updateCHOItem(idx, itIdx, 'additional_description', e.target.value)} 
                                                                 placeholder="Descripción Adicional..." 
                                                                 disabled={item.is_admin_amendment}
                                                                 rows={1}
                                                             />
                                                         </div>
                                                     </td>
                                                    <td className="py-0.5 px-0.5">
                                                        <input type="text" className="input-field text-xs !px-2 h-7 text-center" value={item.unit || ""} onChange={(e) => updateCHOItem(idx, itIdx, 'unit', e.target.value)} disabled={item.is_admin_amendment} />
                                                    </td>
                                                    <td className="py-0.5 px-0.5">
                                                        <input type="text" className="input-field text-xs text-right !px-2 h-7" style={{ backgroundColor: '#66FF99' }} value={item.quantity ?? ""} onChange={(e) => updateCHOItem(idx, itIdx, 'quantity', e.target.value)} disabled={item.is_admin_amendment} />
                                                    </td>
                                                    <td className="py-0.5 px-0.5">
                                                        <input type="number" step="0.0001" className="input-field text-xs text-right !px-2 h-7" style={{ backgroundColor: '#66FF99' }} value={item.unit_price ?? ""} onChange={(e) => updateCHOItem(idx, itIdx, 'unit_price', e.target.value)} disabled={item.is_admin_amendment} />
                                                    </td>
                                                    <td className="py-0.5 px-0.5 text-right text-xs font-black text-primary !pr-4">
                                                        {formatCurrency(roundedAmt((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0), 2))}
                                                    </td>
                                                    <td className="py-0.5 px-0.5">
                                                        <select className="input-field text-[10px] font-bold py-1 px-2" style={{ backgroundColor: item.is_new ? '#66FF99' : undefined }} value={item.fund_source || ""} onChange={(e) => updateCHOItem(idx, itIdx, 'fund_source', e.target.value)} disabled={item.is_admin_amendment}>
                                                            {FUND_SOURCES.map(f => <option key={f} value={f}>{f}</option>)}
                                                        </select>
                                                    </td>
                                                     <td className="py-0.5 px-0.5 text-center">
                                                        <input 
                                                            type="checkbox" 
                                                            className="w-4 h-4 rounded border-slate-300 text-primary" 
                                                            checked={item.requires_mfg_cert || false} 
                                                            onChange={(e) => updateCHOItem(idx, itIdx, 'requires_mfg_cert', e.target.checked)} 
                                                            title="¿Requiere Certificado de Manufactura?"
                                                        />
                                                    </td>
                                                    <td className="py-0.5 px-0.5 text-center">
                                                        {(item.requires_mfg_cert && (item.unit?.toUpperCase().includes('LS') || item.unit?.toUpperCase().includes('LUMP'))) && (
                                                            <input 
                                                                type="number" 
                                                                className="input-field text-[10px] text-center font-bold h-7 !p-1 border-emerald-300"
                                                                style={{ backgroundColor: '#D1FAE5' }}
                                                                value={item.mfg_cert_qty ?? 1}
                                                                onChange={(e) => updateCHOItem(idx, itIdx, 'mfg_cert_qty', parseFloat(e.target.value) || 1)}
                                                                title="Cantidad de Certificados de Manufactura Requeridos"
                                                            />
                                                        )}
                                                    </td>
                                                    <td className="py-0.5 px-0.5 text-center">
                                                        {(item.requires_mfg_cert && (item.unit?.toUpperCase().includes('LS') || item.unit?.toUpperCase().includes('LUMP'))) && (
                                                            <input 
                                                                type="text" 
                                                                maxLength={10}
                                                                className="input-field text-[10px] text-center font-bold h-7 !p-1 border-emerald-300 w-full"
                                                                style={{ backgroundColor: '#D1FAE5' }}
                                                                value={item.mfg_cert_unit ?? ""}
                                                                onChange={(e) => updateCHOItem(idx, itIdx, 'mfg_cert_unit', e.target.value)}
                                                                placeholder="Ea"
                                                                title="Unidad del Certificado de Manufactura"
                                                            />
                                                        )}
                                                    </td>
                                                    <td className="py-0.5 px-0.5">
                                                        {(item.requires_mfg_cert && (item.unit?.toUpperCase().includes('LS') || item.unit?.toUpperCase().includes('LUMP'))) && (
                                                            <input 
                                                                type="text" 
                                                                className="input-field text-[10px] h-7 !p-1 border-emerald-300 min-w-[200px]"
                                                                style={{ backgroundColor: '#D1FAE5' }}
                                                                value={item.mfg_cert_description ?? ""}
                                                                onChange={(e) => updateCHOItem(idx, itIdx, 'mfg_cert_description', e.target.value)}
                                                                placeholder="Describa el o los certificados requeridos..."
                                                                title="Descripción de lo que necesita el certificado de manufactura"
                                                            />
                                                        )}
                                                    </td>
                                                    <td className="py-0.5 px-0.5 text-center">
                                                        <button type="button" onClick={() => removeCHOItem(idx, itIdx)} className="text-slate-300 hover:text-red-500">
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}

                                        </tbody>
                                    </table>
                                </div>
                                <div className="mt-8 space-y-4">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Justificación Técnica y Legal</label>
                                    <textarea className="w-full min-h-[120px] input-field text-xs p-3" value={cho.justification || ""} onChange={(e) => updateCHO(idx, 'justification', e.target.value)} />
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
});

CHOForm.displayName = "CHOForm";

export default CHOForm;

function SummaryItem({ label, value, icon, color, bgColor, isCurrency = true, breakdown }: { label: string, value: number, icon: React.ReactNode, color: string, bgColor: string, isCurrency?: boolean, breakdown?: { fed: number, act: number } }) {
    return (
        <div className={`${bgColor} rounded-xl p-3 border border-slate-100 dark:border-slate-800 flex items-start gap-3`}>
            <div className={`${color} p-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm font-bold`}>{icon}</div>
            <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</div>
                <div className={`text-sm font-black ${color} truncate`}>
                    {isCurrency ? formatCurrency(value) : `${value} días`}
                </div>
            </div>
        </div>
    );
}
