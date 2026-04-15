"use client";

import React, { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/lib/supabase";
import { Save, Factory, Plus, Trash2, Upload, Loader2, CheckCircle2, AlertCircle, Info, ShieldCheck, Download, FileText } from "lucide-react";
import FloatingFormActions from "./FloatingFormActions";
import { exportSectionToJSON, importSectionFromJSON } from "@/lib/sectionIO";
import type { FormRef } from "./ProjectForm";

const TodayButton = ({ onSelect }: { onSelect: (date: string) => void }) => (
    <button 
        type="button" 
        onClick={() => onSelect(new Date().toISOString().split('T')[0])}
        className="absolute right-1 top-1/2 -translate-y-1/2 px-1.5 py-0.5 bg-white/80 hover:bg-white text-[9px] font-bold text-primary rounded border border-primary/20 transition-all z-10"
    >
        HOY
    </button>
);

interface ValidationResult {
    isSteel: boolean;
    hasBuyAmerica: boolean;
    hasRecords: boolean;
    hasFurnished: boolean;
    hasFurnishedMatch: boolean;
    hasProject: boolean;
    hasItem: boolean;
    hasManufacturer: boolean;
    hasSpecificationMatch: boolean;
    isValid: boolean;
    manufacturer_name?: string;
    material_specification?: string;
}

const MfgCertForm = forwardRef<FormRef, { projectId?: string, numAct?: string, onDirty?: () => void, onSaved?: () => void }>(function MfgCertForm({ projectId, numAct, onDirty, onSaved }, ref) {
    const [certs, setCerts] = useState<any[]>([]);
    const [contractItems, setContractItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [parsing, setParsing] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [mounted, setMounted] = useState(false);

    const [contractorName, setContractorName] = useState("");
    const [showValidationIdx, setShowValidationIdx] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        setMounted(true);
        if (projectId) {
            const loadData = async () => {
                await fetchContractor();
                const cItems = await fetchItems();
                if (cItems) {
                    await fetchCerts(cItems);
                }
            };
            loadData();
        }
    }, [projectId]);

    const fetchContractor = async () => {
        const { data } = await supabase.from("contractors").select("name").eq("project_id", projectId).single();
        if (data) setContractorName(data.name);
    };

    const fetchItems = async () => {
        const { data } = await supabase.from("contract_items").select("*").eq("project_id", projectId);
        if (data) {
            setContractItems(data);
            return data;
        }
        return null;
    };

    const fetchCerts = async (cItems: any[]) => {
        const { data, error } = await supabase.from("manufacturing_certificates").select("*").eq("project_id", projectId);
        if (error) {
            console.error("Error fetching mfg certs:", error.message);
            return;
        }
        if (data && data.length > 0) {
            const mapped = data.map(c => {
                const matchItem = cItems.find((it: any) => it.id === c.item_id);
                return {
                    ...c,
                    item_num: matchItem ? matchItem.item_num : null,
                    validation: {
                        isSteel: c.is_steel,
                        hasBuyAmerica: c.has_buy_america,
                        hasRecords: c.has_records,
                        hasFurnished: c.has_furnished,
                        hasProject: true,
                        hasManufacturer: !!c.manufacturer_name,
                        hasSpecificationMatch: c.validation_status === 'CUMPLE',
                        isValid: c.validation_status === 'CUMPLE',
                        hasFurnishedMatch: true,
                        hasItem: true
                    }
                };
            });
            // Ordenar por item_num ascendente
            mapped.sort((a, b) => {
                if (!a.item_num) return 1;
                if (!b.item_num) return -1;
                return a.item_num.toString().localeCompare(b.item_num.toString(), undefined, { numeric: true });
            });
            setCerts(mapped);
        } else {
            addCert(true);
        }
        setHasLoaded(true);
    };

    const addCert = (silent = false) => {
        setCerts(prev => [...prev, {
            project_id: projectId,
            item_id: "",
            quantity: 0,
            cert_date: new Date().toISOString().split('T')[0],
        }]);
        if (!silent && onDirty) onDirty();
    };

    const updateCert = (idx: number, field: string, value: any) => {
        const newList = [...certs];
        newList[idx][field] = value;
        setCerts(newList);
        if (onDirty) onDirty();
    };

    const removeCert = async (idx: number) => {
        const cert = certs[idx];
        if (cert.id) {
            const proceed = window.confirm("¿Estás seguro de que deseas eliminar este certificado permanentemente?");
            if (!proceed) return;
            setLoading(true);
            await supabase.from("manufacturing_certificates").delete().eq("id", cert.id);
            setLoading(false);
        }
        const newList = certs.filter((_, i) => i !== idx);
        setCerts(newList);
        if (newList.length === 0) addCert();
        if (onDirty) onDirty();
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const result = await importSectionFromJSON(file);
        if (result.success && Array.isArray(result.data)) {
            const cleaned = result.data.map(c => {
                const { id, project_id, created_at, ...rest } = c;
                return { ...rest, project_id: projectId };
            });
            setCerts([...certs, ...cleaned]);
            alert("Certificados importados.");
        }
        e.target.value = "";
    };

    const extractData = (text: string) => {
        const itemRegex = /(?:Partida|Item|Renglón|Material|Code)\s*(?:#|No\.?|:)?\s*([A-Za-z0-9-]+)/gi;
        const itemMatches = [...text.matchAll(itemRegex)];
        let itemIds: string[] = [];
        itemMatches.forEach(m => {
            const itemNumRaw = m[1].trim();
            const match = contractItems.find(it => it.item_num === itemNumRaw || it.item_num === itemNumRaw.padStart(3, '0'));
            if (match && !itemIds.includes(match.id)) itemIds.push(match.id);
        });

        let itemId = itemIds.length > 0 ? itemIds[0] : "";
        const qtyMatch = text.match(/(?:Cantidad|Cant\.?|Quantity|Qty|Total|Volumen)\s*(?::|=)?\s*([\d,.]+)/i);
        const dateMatch = text.match(/(?:Fecha|Date|Emisión|Issue)\s*(?::|=)?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})|(\d{4}-\d{2}-\d{2})/i);

        let quantity = 0;
        let certDate = new Date().toISOString().split('T')[0];
        if (qtyMatch) quantity = parseFloat(qtyMatch[1].replace(/,/g, ''));
        if (dateMatch) {
            const rawDate = dateMatch[1] || dateMatch[2] || dateMatch[0].match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2}/)?.[0];
            if (rawDate) {
                if (rawDate.includes('/') || (rawDate.includes('-') && rawDate.indexOf('-') < 4)) {
                    const parts = rawDate.split(/[\/\-]/);
                    if (parts.length === 3) {
                        let d, m, y;
                        if (parseInt(parts[1]) > 12) { [m, d, y] = parts; } else { [d, m, y] = parts; }
                        if (y?.length === 2) y = "20" + y;
                        if (y && m && d) certDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                    }
                } else certDate = rawDate;
            }
        }

        const mfgMatch = text.match(/(?:Manufacturer|Fabricante|Produced\s*by|Vendido\s*por|Supplier|Planta)\s*(?::)?\s*([^,\.\n\r]{2,50})/i);
        const descMatch = text.match(/(?:Material|Description|Specification|Product|Type|Descripci[óo]n)\s*(?::)?\s*([^,\.\n\r]{10,100})/i);
        const manufacturerName = mfgMatch ? mfgMatch[1].trim() : "";
        const materialDescription = descMatch ? descMatch[1].trim() : "Descripción identificada";

        const isSteel = /steel|iron|acero|hierro|molino|mill|reinforcing|rebar/i.test(text);
        const buyAmericaKeywords = [/United\s*States/i, /U\.S\.\s*A/i, /USA/i, /manufacturing\s*processes/i, /all\s*steel\s*and\s*iron/i];
        const hasBuyAmerica = buyAmericaKeywords.some(kw => kw.test(text));
        const hasRecords = /records\s*and\s*documents\s*pertinent\s*to\s*this\s*certificate/i.test(text);
        const furnishedRegex = /Furnished\s*to:\s*([^,\.\n\r]*)/i;
        const furnishedMatch = text.match(furnishedRegex);
        const furnishedValue = furnishedMatch ? furnishedMatch[1].trim() : "";
        const hasFurnishedMatch = contractorName && furnishedValue.toLowerCase().includes(contractorName.toLowerCase());
        const hasProject = numAct ? text.includes(numAct) : false;
        
        let hasSpecificationMatch = false;
        if (itemId) {
            const itemMatch = contractItems.find(it => it.id === itemId);
            if (itemMatch && itemMatch.specification) {
                const prefix = itemMatch.specification.substring(0, 3);
                if (text.includes(prefix)) hasSpecificationMatch = true;
            }
        }

        const validation: ValidationResult = {
            isSteel, hasBuyAmerica, hasRecords, hasFurnished: !!furnishedValue,
            hasFurnishedMatch: !!hasFurnishedMatch, hasProject: !!hasProject,
            hasItem: !!itemId, hasManufacturer: !!mfgMatch,
            hasSpecificationMatch, isValid: false,
            manufacturer_name: manufacturerName,
            material_specification: materialDescription
        };

        validation.isValid = (isSteel ? (hasBuyAmerica && hasRecords && validation.hasFurnished) : true) && hasProject && validation.hasManufacturer && hasSpecificationMatch;

        return {
            item_id: itemId, quantity, cert_date: certDate, validation,
            manufacturer_name: manufacturerName, material_description: materialDescription,
            is_multiple: itemIds.length > 1, item_ids: itemIds,
            multiple_quantities: itemIds.length > 1 ? Object.fromEntries(itemIds.map(id => [id, quantity])) : {}
        };
    };

    const handleFileUpload = async () => {
        const win = window as any;
        if (!win.electronAPI || !win.electronAPI.selectPdfFiles) {
            // WEB VERSION
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'application/pdf';
            input.multiple = true;
            input.onchange = async (ev: any) => {
                const files = Array.from((ev.target as HTMLInputElement).files || []);
                if (files.length === 0) return;
                setParsing(true);
                const newCerts = [...certs];
                if (newCerts.length === 1 && !newCerts[0].item_id && !newCerts[0].id) newCerts.pop();

                let count = 0;
                for (const file of files) {
                    try {
                        const formData = new FormData();
                        formData.append("file", file);
                        const res = await fetch("/api/parse-pdf", { method: "POST", body: formData });
                        const data = await res.json();
                        if (data.success && data.text) {
                            const extracted = extractData(data.text);
                            newCerts.push({ ...extracted, project_id: projectId });
                            count++;
                        }
                    } catch (err) { console.error("Web parse err:", err); }
                }
                setCerts(newCerts);
                setParsing(false);
                if (onDirty) onDirty();
                if (count > 0) alert(`Se procesaron ${count} documentos.`);
            };
            input.click();
            return;
        }

        // ELECTRON VERSION
        const files = await win.electronAPI.selectPdfFiles();
        if (!files || files.length === 0) return;
        setParsing(true);
        const newCerts = [...certs];
        if (newCerts.length === 1 && !newCerts[0].item_id && !newCerts[0].id) newCerts.pop();

        let count = 0;
        for (const file of files) {
            try {
                const res = await win.electronAPI.parsePdf(file);
                if (res.success && res.text) {
                    const extracted = extractData(res.text);
                    newCerts.push({ ...extracted, project_id: projectId });
                    count++;
                }
            } catch (err) { console.error("Electron parse err:", err); }
        }
        setCerts(newCerts);
        setParsing(false);
        if (onDirty) onDirty();
        if (count > 0) alert(`Se procesaron ${count} documentos.`);
    };

    const saveData = async (silent = false) => {
        if (!projectId || !hasLoaded) return;
        try {
            const { data: existing } = await supabase.from("manufacturing_certificates").select("id").eq("project_id", projectId);
            const existingIds = existing?.map(r => r.id) || [];
            
            const expanded = [];
            for (const c of certs) {
                if (c.is_multiple && c.item_ids?.length > 0) {
                    for (const iId of c.item_ids) {
                        const qty = c.multiple_quantities?.[iId] ?? c.quantity;
                        expanded.push({ ...c, item_id: iId, is_multiple: false, item_ids: undefined, quantity: qty || 0 });
                    }
                } else if (c.item_id) expanded.push(c);
            }

            const updates = [], inserts = [];
            for (const c of expanded) {
                const { id, created_at, validation, _unit, item_num, specification, item_ids, is_multiple, multiple_quantities, ...rest } = c;
                const payload = {
                    ...rest,
                    project_id: projectId,
                    is_steel: validation?.isSteel || false,
                    has_buy_america: validation?.hasBuyAmerica || false,
                    has_records: validation?.hasRecords || false,
                    has_furnished: validation?.hasFurnished || false,
                    validation_status: validation?.isValid ? 'CUMPLE' : (validation ? 'REVISAR' : 'PENDIENTE')
                };
                if (id) updates.push({ id, ...payload }); else inserts.push(payload);
            }

            const currentUpsertIds = updates.map(u => u.id);
            const idsToDelete = existingIds.filter(id => !currentUpsertIds.includes(id));
            if (idsToDelete.length > 0) await supabase.from("manufacturing_certificates").delete().in("id", idsToDelete);
            if (updates.length > 0) await supabase.from("manufacturing_certificates").upsert(updates);
            if (inserts.length > 0) await supabase.from("manufacturing_certificates").insert(inserts);

            if (!silent) alert("Certificados guardados");
            fetchCerts(contractItems);
            if (onSaved) onSaved();
        } catch (err: any) { console.error(err); }
    };

    useImperativeHandle(ref, () => ({ save: () => saveData(true) }));

    if (!mounted) return null;

    return (
        <div suppressHydrationWarning className="w-full px-4 flex flex-col space-y-6">
            <div className="sticky top-0 z-40 bg-[#F8FAFC]/95 dark:bg-[#020617]/95 backdrop-blur-md pt-6 pb-4 -mx-4 px-4 md:-mx-8 md:px-8 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Factory className="text-primary" /> 8. Certificados de Manufactura
                </h2>
                <div className="flex-1 max-w-md mx-6 hidden md:block">
                    <div className="relative group">
                        <input 
                            type="text"
                            placeholder="Buscar por ítem o fabricante..."
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => exportSectionToJSON("mfg_certs", certs)} className="p-2 border rounded-lg hover:bg-slate-50"><Download size={18}/></button>
                </div>
            </div>

            <FloatingFormActions actions={[
                { label: "Añadir CM", description: "Añadir nuevo certificado de manufactura", icon: <Plus />, onClick: addCert, variant: 'secondary' },
                { label: loading ? "Guardando..." : "Guardar cambios", description: "Grabar certificados al servidor", icon: <Save />, onClick: () => saveData(false), variant: 'primary', disabled: loading }
            ]} />

            <div className="flex flex-col space-y-3">
                {/* Header Row (Optional for reference) */}
                <div className="md:hidden px-4 mb-4">
                    <input 
                        type="text"
                        placeholder="Buscar por ítem o fabricante..."
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {certs.map((c, originalIdx) => ({ c, originalIdx })).filter(({ c }) => {
                    if (!searchTerm) return true;
                    const term = searchTerm.toLowerCase();
                    const itemMatch = contractItems.find(it => it.id === c.item_id);
                    if (itemMatch && (itemMatch.item_num?.toLowerCase().includes(term) || itemMatch.description?.toLowerCase().includes(term))) return true;
                    if (c.manufacturer_name?.toLowerCase().includes(term)) return true;
                    return false;
                }).map(({ c, originalIdx: idx }) => {
                    const selectedItem = contractItems.find(it => it.id === c.item_id);
                    return (
                        <div key={idx} className="flex flex-wrap md:flex-nowrap items-center gap-3 p-4 bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
                            {/* Index */}
                            <div className="text-sm font-bold text-slate-300 w-6">{idx + 1}</div>

                            {/* Item Selector */}
                            <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                                {c.is_multiple ? (
                                    <div className="relative group/multi">
                                        <div className="w-full bg-[#66FF99] text-emerald-900 rounded-full px-4 py-2.5 text-xs font-black flex items-center justify-between cursor-pointer">
                                            <span>{c.item_ids?.length || 0} PARTIDAS SELECCIONADAS</span>
                                            <Plus size={14} />
                                        </div>
                                        <div className="absolute top-full left-0 w-full max-h-64 overflow-y-auto bg-white dark:bg-slate-800 border dark:border-slate-700 shadow-2xl rounded-2xl mt-1 z-[70] hidden group-hover/multi:block p-3">
                                            <p className="text-[10px] font-black text-slate-400 mb-2 uppercase">Seleccionar partidas:</p>
                                            <div className="grid grid-cols-1 gap-1">
                                                {contractItems.filter(it => it.requires_mfg_cert).map(item => (
                                                    <label key={item.id} className="flex items-center gap-3 p-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg cursor-pointer transition-colors">
                                                        <input 
                                                            type="checkbox" 
                                                            className="w-4 h-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                                                            checked={c.item_ids?.includes(item.id)} 
                                                            onChange={e => {
                                                                const newList = [...certs];
                                                                if(!newList[idx].item_ids) newList[idx].item_ids = [];
                                                                if(e.target.checked) {
                                                                    newList[idx].item_ids.push(item.id);
                                                                    if(!newList[idx].multiple_quantities) newList[idx].multiple_quantities = {};
                                                                    if(!newList[idx].multiple_quantities[item.id]) newList[idx].multiple_quantities[item.id] = newList[idx].quantity || 0;
                                                                } else {
                                                                    newList[idx].item_ids = newList[idx].item_ids.filter((id:any)=>id!==item.id);
                                                                }
                                                                setCerts(newList);
                                                            }} 
                                                        /> 
                                                        <span className="text-[11px] font-bold">Pt. {item.item_num}: {item.description}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <select 
                                            className="w-full appearance-none bg-[#66FF99] text-emerald-900 rounded-full px-4 py-2.5 text-xs font-black focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all pr-8"
                                            value={c.item_id || ""} 
                                            onChange={e => {
                                                const m = contractItems.find(it => it.id === e.target.value);
                                                const nl = [...certs]; 
                                                nl[idx].item_id = e.target.value; 
                                                if(m) nl[idx]._unit = m.unit; 
                                                setCerts(nl);
                                            }}
                                        >
                                            <option value="" className="bg-white">SELECCIONAR PARTIDA...</option>
                                            {contractItems.filter(it => it.requires_mfg_cert).map(it => (
                                                <option key={it.id} value={it.id} className="bg-white">Pt. {it.item_num}: {it.description}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-emerald-700">
                                            <Plus size={14} className="rotate-45" />
                                        </div>
                                    </div>
                                )}
                                <label className="flex items-center gap-3 px-4 py-2 mt-1 cursor-pointer group bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 hover:border-emerald-500 transition-all max-w-fit">
                                    <div className="relative flex items-center justify-center">
                                        <input 
                                            type="checkbox" 
                                            className="peer appearance-none w-5 h-5 rounded-lg border-2 border-emerald-300 checked:border-emerald-500 checked:bg-emerald-500 transition-all cursor-pointer"
                                            checked={!!c.is_multiple} 
                                            onChange={e => {
                                                const nl = [...certs]; 
                                                nl[idx].is_multiple = e.target.checked; 
                                                if (e.target.checked && nl[idx].item_id && (!nl[idx].item_ids || nl[idx].item_ids.length === 0)) {
                                                    nl[idx].item_ids = [nl[idx].item_id];
                                                    nl[idx].multiple_quantities = { [nl[idx].item_id]: nl[idx].quantity };
                                                }
                                                setCerts(nl);
                                            }} 
                                        />
                                        <CheckCircle2 size={12} className="absolute text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-tighter">Múltiples Ítems</span>
                                        <span className="text-[7px] font-bold text-emerald-600/60 uppercase">Activar para varias cantidades</span>
                                    </div>
                                </label>
                            </div>

                            {/* Multiple Items Quantities UI */}
                            {c.is_multiple && c.item_ids?.length > 0 && (
                                <div className="absolute top-[105%] left-4 right-4 bg-white dark:bg-slate-800 border-2 border-emerald-100 dark:border-emerald-900/30 shadow-2xl rounded-3xl p-4 z-[60] animate-in slide-in-from-top-2">
                                    <div className="flex items-center justify-between mb-3 px-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 bg-emerald-100 rounded-lg flex items-center justify-center">
                                                <Plus size={12} className="text-emerald-600" />
                                            </div>
                                            <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Cantidades por Partida</span>
                                        </div>
                                        <button onClick={() => updateCert(idx, 'is_multiple', false)} className="text-slate-400 hover:text-red-500"><X size={14} /></button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                        {c.item_ids.map((iId: string) => {
                                            const it = contractItems.find(i => i.id === iId);
                                            return (
                                                <div key={iId} className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-2 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                                                    <div className="flex flex-col min-w-0 pr-2">
                                                        <span className="text-[10px] font-black text-slate-800 truncate">Pt. {it?.item_num}</span>
                                                        <span className="text-[8px] font-bold text-slate-400 truncate uppercase">{it?.description}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <input 
                                                            type="number"
                                                            step="0.01"
                                                            className="w-20 bg-emerald-50 border border-emerald-100 rounded-xl py-1 px-2 text-center text-[11px] font-black text-emerald-700 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                                            value={c.multiple_quantities?.[iId] || 0}
                                                            onChange={e => {
                                                                const nl = [...certs];
                                                                if (!nl[idx].multiple_quantities) nl[idx].multiple_quantities = {};
                                                                nl[idx].multiple_quantities[iId] = parseFloat(e.target.value) || 0;
                                                                setCerts(nl);
                                                            }}
                                                        />
                                                        <div className="text-[8px] font-black text-slate-400 uppercase w-8">{it?.unit || "UNIT"}</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Unit */}
                            <div className="w-16 flex justify-center">
                                <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-lg px-2 py-1 text-[10px] font-black uppercase border border-slate-200 dark:border-slate-700">
                                    {c._unit || selectedItem?.unit || "—"}
                                </span>
                            </div>

                            {/* Manufacturer & Description Info */}
                            <div className="flex-[1.5] flex flex-col gap-2 min-w-[250px]">
                                <div className="flex flex-col gap-1">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-3">Fabricante / Manufacturer</span>
                                    <input 
                                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-full px-4 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-700 transition-all placeholder:text-slate-300"
                                        placeholder="Nombre del fabricante..."
                                        value={c.manufacturer_name || ""} 
                                        onChange={e=>updateCert(idx, 'manufacturer_name', e.target.value)} 
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-3">Material / Descripción</span>
                                    <input 
                                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-full px-4 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-700 transition-all placeholder:text-slate-300 italic"
                                        placeholder="Ej: Agregado Fino, Tubería..."
                                        value={c.material_description || ""} 
                                        onChange={e=>updateCert(idx, 'material_description', e.target.value)} 
                                    />
                                </div>
                            </div>

                            {/* Quantity */}
                            <div className="w-24">
                                <input 
                                    type="number" 
                                    className="w-full bg-[#66FF99] text-emerald-900 rounded-full px-3 py-2.5 text-xs font-black text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                                    value={c.quantity} 
                                    onChange={e=>updateCert(idx, 'quantity', parseFloat(e.target.value))} 
                                />
                            </div>

                            {/* Date */}
                            <div className="w-36 flex flex-col gap-1">
                                <div className="relative group/date">
                                    <input 
                                        type="date" 
                                        className="w-full bg-[#66FF99] text-emerald-900 rounded-full px-4 py-2.5 text-xs font-black text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all cursor-pointer pr-8"
                                        value={c.cert_date || ""} 
                                        onChange={e=>updateCert(idx, 'cert_date', e.target.value)} 
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-700">
                                        <TodayButton onSelect={(d) => updateCert(idx, 'cert_date', d)} />
                                    </div>
                                </div>
                            </div>


                            {/* Delete Button */}
                            <button 
                                onClick={()=>removeCert(idx)} 
                                className="flex items-center justify-center w-9 h-9 rounded-full border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-600 hover:border-red-400 transition-all shadow-sm"
                                title="Eliminar certificado"
                            >
                                <Trash2 size={15} />
                            </button>
                        </div>
                    );
                })}


            </div>
        </div>
    );
});

export default MfgCertForm;
