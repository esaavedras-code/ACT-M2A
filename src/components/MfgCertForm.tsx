"use client";

import React, { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/lib/supabase";
import { Save, Factory, Plus, Trash2, Upload, Loader2, FileSearch, CheckCircle2, AlertCircle, Info, ShieldCheck, Download } from "lucide-react";
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
            addCert();
        }
        setHasLoaded(true);
    };

    const addCert = () => {
        setCerts(prev => [...prev, {
            project_id: projectId,
            item_id: "",
            quantity: 0,
            cert_date: new Date().toISOString().split('T')[0],
        }]);
        if (onDirty) onDirty();
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
            is_multiple: itemIds.length > 1, item_ids: itemIds
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
                        expanded.push({ ...c, item_id: iId, is_multiple: false, item_ids: undefined, quantity: c.multiple_quantities?.[iId] || 0 });
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
                <div className="flex gap-2">
                    <button onClick={handleFileUpload} disabled={loading || parsing} className="bg-emerald-100 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 text-emerald-700 hover:bg-emerald-200 transition-colors">
                        {parsing ? <Loader2 size={16} className="animate-spin" /> : <FileSearch size={16} />} 
                        {parsing ? "Leyendo..." : "Subir y Evaluar PDFs"}
                    </button>
                    <button onClick={() => exportSectionToJSON("mfg_certs", certs)} className="p-2 border rounded-lg hover:bg-slate-50"><Download size={18}/></button>
                </div>
            </div>

            <FloatingFormActions actions={[
                { label: loading ? "Guardando..." : "Guardar cambios", description: "Grabar certificados al servidor", icon: <Save />, onClick: () => saveData(false), variant: 'primary', disabled: loading }
            ]} />

            <div className="card overflow-x-auto p-0 border-none shadow-sm">
                <table className="w-full text-left border-collapse min-w-full">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-[9px] font-extrabold border-b">
                        <tr>
                            <th className="px-2 py-2 w-8">#</th>
                            <th className="px-2 py-2 w-[25%]">Partida</th>
                            <th className="px-2 py-2 w-16 text-center">Und.</th>
                            <th className="px-2 py-2">Fabricante</th>
                            <th className="px-2 py-2 w-24 text-center">Cantidad</th>
                            <th className="px-2 py-2 w-36 text-center">Fecha Cert.</th>
                            <th className="px-2 py-2 w-20 text-center">Validación</th>
                            <th className="px-2 py-2 w-16 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {certs.map((c, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                                <td className="px-2 py-2 text-center text-xs text-slate-400">{idx+1}</td>
                                <td className="px-2 py-2">
                                    <div className="flex flex-col gap-1 w-full relative">
                                        {c.is_multiple ? (
                                            <div className="relative group/multi">
                                                <div className="input-field text-[10px] font-bold !py-1 min-h-[32px] text-black bg-[#66FF99] flex items-center">
                                                    {c.item_ids?.length || 0} partidas sel.
                                                </div>
                                                <div className="absolute top-full left-0 w-64 max-h-48 overflow-y-auto bg-white border shadow-xl rounded-xl z-50 hidden group-hover/multi:block p-2">
                                                    {contractItems.filter(it => it.requires_mfg_cert).map(item => (
                                                        <label key={item.id} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 text-[10px] font-bold">
                                                            <input type="checkbox" checked={c.item_ids?.includes(item.id)} onChange={e => {
                                                                const newList = [...certs];
                                                                if(!newList[idx].item_ids) newList[idx].item_ids = [];
                                                                if(e.target.checked) newList[idx].item_ids.push(item.id);
                                                                else newList[idx].item_ids = newList[idx].item_ids.filter((id:any)=>id!==item.id);
                                                                setCerts(newList);
                                                            }} /> Pt. {item.item_num}
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <select className="input-field text-[10px] font-bold bg-[#66FF99]" value={c.item_id || ""} onChange={e => {
                                                const m = contractItems.find(it => it.id === e.target.value);
                                                const nl = [...certs]; nl[idx].item_id = e.target.value; if(m) nl[idx]._unit = m.unit; setCerts(nl);
                                            }}>
                                                <option value="">Elegir...</option>
                                                {contractItems.filter(it => it.requires_mfg_cert).map(it => <option key={it.id} value={it.id}>Pt. {it.item_num}</option>)}
                                            </select>
                                        )}
                                        <label className="text-[8px] font-bold flex gap-1"><input type="checkbox" checked={!!c.is_multiple} onChange={e => {const nl = [...certs]; nl[idx].is_multiple = e.target.checked; setCerts(nl);}} /> Múltiples</label>
                                    </div>
                                </td>
                                <td className="px-2 py-2 text-center text-[10px] font-bold">{c._unit || "—"}</td>
                                <td className="px-2 py-2">
                                    <input className="input-field text-[10px] font-bold bg-[#66FF99]" value={c.manufacturer_name || ""} onChange={e=>updateCert(idx, 'manufacturer_name', e.target.value)} />
                                </td>
                                <td className="px-2 py-2">
                                    <input type="number" className="input-field text-[10px] font-bold bg-[#66FF99] text-center" value={c.quantity} onChange={e=>updateCert(idx, 'quantity', parseFloat(e.target.value))} />
                                </td>
                                <td className="px-2 py-2 relative">
                                    <div className="relative">
                                        <input type="date" className="input-field text-[10px] font-bold bg-[#66FF99] text-center pr-10" value={c.cert_date || ""} onChange={e=>updateCert(idx, 'cert_date', e.target.value)} />
                                        <TodayButton onSelect={(d) => updateCert(idx, 'cert_date', d)} />
                                    </div>
                                </td>
                                <td className="px-2 py-2 text-center">
                                    <button onClick={()=>setShowValidationIdx(showValidationIdx === idx ? null : idx)} className={`px-2 py-1 rounded-full text-[9px] font-black uppercase ${c.validation?.isValid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {c.validation?.isValid ? "CUMPLE" : "REVISAR"}
                                    </button>
                                </td>
                                <td className="px-2 py-2 text-center">
                                    <button onClick={()=>removeCert(idx)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <button onClick={addCert} className="m-4 text-xs font-bold text-primary flex items-center gap-1"><Plus size={14}/> Añadir Certificado</button>
            </div>
        </div>
    );
});

export default MfgCertForm;
