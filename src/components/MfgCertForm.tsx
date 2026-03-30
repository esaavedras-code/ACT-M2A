"use client";

import React, { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/lib/supabase";
import { Save, Factory, Plus, Trash2, Upload, Loader2, FileSearch, CheckCircle2, AlertCircle, Info, ShieldCheck, Download } from "lucide-react";
import FloatingFormActions from "./FloatingFormActions";
import { exportSectionToJSON, importSectionFromJSON } from "@/lib/sectionIO";
import type { FormRef } from "./ProjectForm";

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
        
        // Si ya tiene ID, es que está registrado en la base de datos
        if (cert.id) {
            const proceed = window.confirm("¿Estás seguro de que deseas eliminar este certificado permanentemente de la base de datos? Esta acción no se puede deshacer.");
            if (!proceed) return;
            
            setLoading(true);
            const { error } = await supabase.from("manufacturing_certificates").delete().eq("id", cert.id);
            setLoading(false);
            
            if (error) {
                alert("Error al eliminar el certificado: " + error.message);
                return;
            }
        }
        
        const newList = certs.filter((_, i) => i !== idx);
        setCerts(newList);
        
        if (newList.length === 0) {
            addCert();
        }
        
        if (onDirty) onDirty();
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const result = await importSectionFromJSON(file);
        if (result.success && Array.isArray(result.data)) {
            const cleaned = result.data.map(c => {
                const { id, project_id, created_at, item_num, specification, ...rest } = c;
                return { 
                    ...rest, 
                    project_id: projectId 
                };
            });
            setCerts([...certs, ...cleaned]);
            alert("Certificados importados. Guarde para confirmar.");
        } else {
            alert("Error al importar: " + (result.error || "Formato inválido"));
        }
        e.target.value = "";
    };

    const extractData = (text: string) => {
        // Expresiones regulares mejoradas para detectar Partida, Cantidad y Fecha
        const cleanText = text.replace(/\s+/g, ' ');
        const itemRegex = /(?:Partida|Item|Renglón|Material|Code)\s*(?:#|No\.?|:)?\s*([A-Za-z0-9-]+)/gi;
        const itemMatches = [...text.matchAll(itemRegex)];
        let itemIds: string[] = [];

        itemMatches.forEach(m => {
            const itemNumRaw = m[1].trim();
            const match = contractItems.find(it =>
                it.item_num === itemNumRaw ||
                it.item_num === itemNumRaw.padStart(3, '0') ||
                (it.specification && it.specification.includes(itemNumRaw))
            );
            if (match && !itemIds.includes(match.id)) {
                itemIds.push(match.id);
            }
        });

        let itemId = itemIds.length > 0 ? itemIds[0] : "";
        let isMultiple = itemIds.length > 1;

        const qtyMatch = text.match(/(?:Cantidad|Cant\.?|Quantity|Qty|Total|Volumen)\s*(?::|=)?\s*([\d,.]+)/i);
        const dateMatch = text.match(/(?:Fecha|Date|Emisión|Issue)\s*(?::|=)?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})|(\d{4}-\d{2}-\d{2})/i);

        let quantity = 0;
        let certDate = new Date().toISOString().split('T')[0];

        if (qtyMatch) {
            quantity = parseFloat(qtyMatch[1].replace(/,/g, ''));
        }

        if (dateMatch) {
            const rawDate = dateMatch[1] || dateMatch[2] || dateMatch[0].match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2}/)?.[0];
            if (rawDate) {
                if (rawDate.includes('/') || (rawDate.includes('-') && rawDate.indexOf('-') < 4)) {
                    const parts = rawDate.split(/[\/\-]/);
                    if (parts.length === 3) {
                        let d, m, y;
                        if (parseInt(parts[1]) > 12) { [m, d, y] = parts; }
                        else { [d, m, y] = parts; }
                        if (y?.length === 2) y = "20" + y;
                        if (y && m && d) certDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                    }
                } else {
                    certDate = rawDate;
                }
            }
        }

        // Extracción de Fabricante y Descripción
        const mfgMatch = text.match(/(?:Manufacturer|Fabricante|Produced\s*by|Vendido\s*por|Supplier|Planta)\s*(?::)?\s*([^,\.\n\r]{2,50})/i);
        const descMatch = text.match(/(?:Material|Description|Specification|Product|Type|Descripci[óo]n)\s*(?::)?\s*([^,\.\n\r]{10,100})/i);

        const manufacturerName = mfgMatch ? mfgMatch[1].trim() : "";
        const materialDescription = descMatch ? descMatch[1].trim() : "Descripción identificada";

        const isSteel = /steel|iron|acero|hierro|molino|mill|reinforcing|rebar/i.test(text);
        const buyAmericaKeywords = [/United\s*States/i, /U\.S\.\s*A/i, /USA/i, /manufacturing\s*processes/i, /all\s*steel\s*and\s*iron/i];
        const hasBuyAmerica = buyAmericaKeywords.some(kw => kw.test(text));

        const recordsPhrase = /records\s*and\s*documents\s*pertinent\s*to\s*this\s*certificate/i;
        const hasRecords = recordsPhrase.test(text);

        const furnishedRegex = /Furnished\s*to:\s*([^,\.\n\r]*)/i;
        const furnishedMatch = text.match(furnishedRegex);
        const furnishedValue = furnishedMatch ? furnishedMatch[1].trim() : "";
        const hasFurnishedMatch = contractorName && furnishedValue.toLowerCase().includes(contractorName.toLowerCase());

        const hasProject = numAct ? text.includes(numAct) : false;
        const hasManufacturer = !!mfgMatch || /address|certified\s*by/i.test(text);

        // Nueva lógica para verificar que la especificación extraída coincida con los 3 primeros dígitos de la partida
        let hasSpecificationMatch = false;
        const materialSpec = descMatch ? descMatch[1].trim() : "";
        
        // Buscar la línea "conforms to" y números de 3 dígitos
        const conformsToLines = text.split(/\r?\n/).filter(line => /conforms\s*to/i.test(line));
        const all3DigitNumbers: string[] = [];
        conformsToLines.forEach(line => {
            const matches = line.match(/\b\d{3}\b/g);
            if (matches) all3DigitNumbers.push(...matches);
        });

        if (itemId && all3DigitNumbers.length > 0) {
            const itemMatch = contractItems.find(it => it.id === itemId);
            if (itemMatch && itemMatch.specification) {
                const itemSpecPrefix = itemMatch.specification.substring(0, 3);
                if (all3DigitNumbers.includes(itemSpecPrefix)) {
                    hasSpecificationMatch = true;
                }
            }
        }

        const validation: ValidationResult = {
            isSteel,
            hasBuyAmerica,
            hasRecords,
            hasFurnished: !!furnishedValue,
            hasFurnishedMatch: !!hasFurnishedMatch,
            hasProject: !!hasProject,
            hasItem: !!itemId,
            hasManufacturer,
            hasSpecificationMatch,
            isValid: false,
            manufacturer_name: manufacturerName,
            material_specification: materialSpec
        };

        let valid = true;
        if (isSteel) {
            if (!hasBuyAmerica || !hasRecords || !validation.hasFurnished) valid = false;
        }
        if (!hasProject || !hasManufacturer || !hasSpecificationMatch) valid = false;
        validation.isValid = valid;

        return {
            item_id: itemId,
            quantity,
            cert_date: certDate,
            validation,
            manufacturer_name: manufacturerName,
            material_description: materialDescription,
            is_multiple: isMultiple,
            item_ids: itemIds
        };
    };

    const handleFileUpload = async () => {
        const win = window as any;
        if (!win.electronAPI || !win.electronAPI.selectPdfFiles) {
            alert("Esta función solo está disponible en la versión de escritorio.");
            return;
        }

        const files = await win.electronAPI.selectPdfFiles();
        if (!files || files.length === 0) return;

        setParsing(true);
        const newCerts = [...certs];
        if (newCerts.length === 1 && !newCerts[0].item_id && !newCerts[0].id) {
            newCerts.pop();
        }

        let count = 0;
        for (const file of files) {
            try {
                const res = await win.electronAPI.parsePdf(file);
                if (res.success && res.text) {
                    const extracted = extractData(res.text);
                    newCerts.push({
                        ...extracted,
                        project_id: projectId,
                    });
                    count++;
                }
            } catch (err) {
                console.error("Error al procesar archivo:", file, err);
            }
        }

        setCerts(newCerts);
        setParsing(false);
        if (onDirty) onDirty();
        if (count > 0) {
            alert(`Se procesaron ${count} documentos y se agregaron a la lista.`);
        } else {
            alert("No se pudo extraer información válida de los documentos seleccionados.");
        }
    };

    const saveData = async (silent = false) => {
        if (!projectId || !hasLoaded) return;
        try {
            const { data: existingCerts, error: fetchError } = await supabase.from("manufacturing_certificates").select("id").eq("project_id", projectId);
            if (fetchError) throw fetchError;
            const existingIds = existingCerts?.map(cert => cert.id) || [];
            const validCerts = certs.filter(c => c.item_id);

            if (validCerts.length === 0 && existingIds.length > 0 && !silent) {
                const proceed = window.confirm("No has seleccionado ninguna partida para los certificados. Si guardas, se borrarán todos los certificados anteriores. ¿Deseas continuar?");
                if (!proceed) return;
            }

            const updates = [];
            const inserts = [];
            
            // Expand multiples
            const expandedCerts = [];
            for (const c of certs) {
                if (c.is_multiple && c.item_ids && c.item_ids.length > 0) {
                    for (const iId of c.item_ids) {
                        expandedCerts.push({ 
                            ...c, 
                            item_id: iId, 
                            item_ids: undefined, 
                            is_multiple: false, 
                            quantity: c.multiple_quantities?.[iId] || 0,
                            multiple_quantities: undefined 
                        });
                    }
                } else if (c.item_id) {
                    expandedCerts.push(c);
                }
            }

            for (const c of expandedCerts) {
                const { id, created_at, validation, file_name, _unit, item_num, specification, item_ids, is_multiple, multiple_quantities, ...rest } = c;
                const payload = {
                    ...rest,
                    project_id: projectId,
                    item_id: rest.item_id,
                    cert_date: rest.cert_date || null,
                    manufacturer_name: rest.manufacturer_name || (validation?.manufacturer_name) || "Detectado por PDF",
                    material_description: rest.material_description || (validation?.material_description),
                    is_steel: validation?.isSteel || false,
                    has_buy_america: validation?.hasBuyAmerica || false,
                    has_records: validation?.hasRecords || false,
                    has_furnished: validation?.hasFurnished || false,
                    validation_status: validation?.isValid ? 'CUMPLE' : (validation ? 'REVISAR' : 'PENDIENTE')
                };
                if (id) {
                    updates.push({ id, ...payload });
                } else {
                    inserts.push(payload);
                }
            }

            const currentIds = updates.map(u => u.id);
            const idsToDelete = existingIds.filter(id => !currentIds.includes(id));
            if (idsToDelete.length > 0) {
                const { error: delError } = await supabase.from("manufacturing_certificates").delete().in("id", idsToDelete);
                if (delError) throw delError;
            }
            if (updates.length > 0) {
                const { error: updateError } = await supabase.from("manufacturing_certificates").upsert(updates, { onConflict: "id" });
                if (updateError) throw updateError;
            }
            if (inserts.length > 0) {
                const { error: insertError } = await supabase.from("manufacturing_certificates").insert(inserts);
                if (insertError) throw insertError;
            }
            if (!silent) alert("Certificados de Manufactura actualizados");
            await fetchCerts(contractItems);
            if (onSaved) onSaved();
        } catch (error: any) {
            console.error("Save error:", error);
            if (!silent) alert("Error al guardar certificados: " + error.message);
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

    if (!mounted) return null;

    return (
        <div suppressHydrationWarning className="w-full px-4 flex flex-col space-y-6">
            <div className="sticky top-0 z-40 bg-[#F8FAFC]/95 dark:bg-[#020617]/95 backdrop-blur-md pt-6 pb-4 -mx-4 px-4 md:-mx-8 md:px-8 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Factory className="text-primary" />
                    8. Certificados de Manufactura
                </h2>
                <div className="flex gap-2">
                    <button onClick={handleFileUpload} disabled={loading || parsing} className="bg-emerald-100 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 text-emerald-700 hover:bg-emerald-200 transition-colors">
                        {parsing ? <Loader2 size={16} className="animate-spin" /> : <FileSearch size={16} />} 
                        {parsing ? "Leyendo..." : "Subir y Evaluar PDFs"}
                    </button>
                    {/* El botón de guardar ahora es flotante */}
                </div>
            </div>

            {numAct && (
                <div className="flex items-center gap-2 -mt-4 mb-6">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Proyecto:</span>
                    <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-primary text-[10px] font-bold rounded border border-blue-100 dark:border-blue-800">
                        ACT-{numAct}
                    </span>
                </div>
            )}

            <div className="card overflow-x-auto p-0 border-none shadow-sm">
                <table suppressHydrationWarning className="w-full text-left border-collapse min-w-full lg:table-fixed">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 uppercase text-[9px] font-extrabold border-b border-slate-100 dark:border-slate-800">
                        <tr>
                            <th className="px-2 py-1.5 w-8 text-center">#</th>
                            <th className="px-2 py-1.5 w-[22%]">Partida</th>
                            <th className="px-2 py-1.5 w-16 text-center">Unidad</th>
                            <th className="px-2 py-1.5 w-[20%]">Fabricante / Planta</th>
                            <th className="px-2 py-1.5 w-24 text-center">Cantidad</th>
                            <th className="px-2 py-1.5 w-32 text-center">Fecha Cert.</th>
                            <th className="px-2 py-1.5 w-20 text-center">Archivo</th>
                            <th className="px-2 py-1.5 w-24 text-center">Estado</th>
                             <th className="px-2 py-1.5 w-24 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                        {certs.map((c, idx) => (
                            <React.Fragment key={idx}>
                                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                                    <td className="px-2 py-1 text-center text-xs font-bold text-slate-400 w-10">{idx + 1}</td>
                                    <td className="px-2 py-1">
                                        <div className="flex flex-col gap-1 w-full relative">
                                            {c.is_multiple ? (
                                                <div className="relative group/multi">
                                                    <div className="input-field text-[10px] font-bold !py-1 min-h-[32px] text-black cursor-pointer flex items-center" style={{ backgroundColor: '#66FF99' }}>
                                                        {c.item_ids && c.item_ids.length > 0 ? `${c.item_ids.length} partidas seleccionadas` : "Elegir partidas..."}
                                                    </div>
                                                    <div className="absolute top-full left-0 w-64 max-h-48 overflow-y-auto bg-white border border-slate-200 shadow-xl rounded-xl z-50 hidden group-hover/multi:block p-2">
                                                        {contractItems.filter(item => item.requires_mfg_cert).map(item => (
                                                            <label key={item.id} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 cursor-pointer text-[10px] font-bold">
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={c.item_ids?.includes(item.id) || false} 
                                                                    onChange={(e) => {
                                                                        const newList = [...certs];
                                                                        if (!newList[idx].item_ids) newList[idx].item_ids = [];
                                                                        if (e.target.checked) {
                                                                            newList[idx].item_ids.push(item.id);
                                                                        } else {
                                                                            newList[idx].item_ids = newList[idx].item_ids.filter((id: string) => id !== item.id);
                                                                        }
                                                                        setCerts(newList);
                                                                        if (onDirty) onDirty();
                                                                    }}
                                                                />
                                                                Pt. {item.item_num}: {item.description}
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : (
                                                <select
                                                    className="input-field text-[10px] font-bold !py-1 min-h-[32px] text-black w-full"
                                                    style={{ backgroundColor: '#66FF99' }}
                                                    value={c.item_id || ""}
                                                    onChange={(e) => {
                                                        const selectedId = e.target.value;
                                                        const match = contractItems.find(it => it.id === selectedId);
                                                        const newList = [...certs];
                                                        newList[idx].item_id = selectedId;
                                                        if (match) {
                                                            newList[idx].item_num = match.item_num;
                                                            newList[idx].specification = match.specification;
                                                            newList[idx]._unit = match.unit || "";
                                                        }
                                                        setCerts(newList);
                                                        if (onDirty) onDirty();
                                                    }}
                                                >
                                                    <option value="">Elegir...</option>
                                                    {contractItems.filter(item => item.requires_mfg_cert).map(item => (
                                                        <option key={item.id} value={item.id}>Pt. {item.item_num}: {item.description}{item.additional_description ? ` - ${item.additional_description}` : ''}</option>
                                                    ))}
                                                </select>
                                            )}
                                            <label className="flex items-center gap-1 text-[9px] font-bold text-slate-500 cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={!!c.is_multiple} 
                                                    onChange={(e) => {
                                                        const newList = [...certs];
                                                        newList[idx].is_multiple = e.target.checked;
                                                        newList[idx].item_ids = newList[idx].item_id ? [newList[idx].item_id] : [];
                                                        setCerts(newList);
                                                    }} 
                                                    className="w-3 h-3 text-primary border-slate-300 rounded" 
                                                />
                                                Múltiples Ítems
                                            </label>
                                        </div>
                                    </td>
                                    <td className="px-2 py-1 text-center align-top">
                                        {c.is_multiple && c.item_ids?.length > 0 ? (
                                            <div className="flex flex-col gap-1">
                                                {c.item_ids.map((id: string) => (
                                                    <span key={id} className="text-[10px] font-black text-slate-600 bg-slate-100 px-1 py-1 rounded min-h-[32px] flex items-center justify-center">
                                                        {contractItems.find(it => it.id === id)?.unit || "—"}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-xs font-black text-slate-600 bg-slate-100 px-2 py-1 rounded inline-block min-h-[32px] flex items-center justify-center">
                                                {c._unit || contractItems.find(it => it.id === c.item_id)?.unit || "—"}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-2 py-1">
                                        <input
                                            type="text"
                                            className="input-field text-[10px] !py-1 min-h-[32px] font-bold text-black"
                                            style={{ backgroundColor: '#66FF99' }}
                                            value={c.manufacturer_name || ""}
                                            onChange={(e) => updateCert(idx, 'manufacturer_name', e.target.value)}
                                            placeholder={c.file_name ? "No detectado en PDF" : "Nombre del Fabricante"}
                                        />
                                    </td>
                                    <td className="px-2 py-1 align-top">
                                        {c.is_multiple && c.item_ids?.length > 0 ? (
                                            <div className="flex flex-col gap-1">
                                                {c.item_ids.map((id: string) => (
                                                    <div key={id} className="relative flex items-center">
                                                        <span className="absolute left-1 text-[8px] text-slate-500 font-bold z-10 pointer-events-none">Pt.{contractItems.find(it => it.id === id)?.item_num}</span>
                                                        <input
                                                            type="number"
                                                            className="input-field pl-9 text-[10px] text-center !py-1 min-h-[32px] font-bold text-black w-full relative z-0"
                                                            style={{ backgroundColor: '#66FF99' }}
                                                            value={c.multiple_quantities?.[id] !== undefined ? c.multiple_quantities[id] : ""}
                                                            onChange={(e) => {
                                                                const val = e.target.value === "" ? 0 : parseFloat(e.target.value);
                                                                const newList = [...certs];
                                                                newList[idx].multiple_quantities = { ...(newList[idx].multiple_quantities || {}), [id]: val };
                                                                setCerts(newList);
                                                                if (onDirty) onDirty();
                                                            }}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <input
                                                type="number"
                                                className="input-field text-[10px] text-center !py-1 min-h-[32px] font-bold text-black w-full"
                                                style={{ backgroundColor: '#66FF99' }}
                                                value={isNaN(c.quantity) ? "" : c.quantity}
                                                onChange={(e) => updateCert(idx, 'quantity', e.target.value === "" ? NaN : parseFloat(e.target.value))}
                                            />
                                        )}
                                    </td>
                                    <td className="px-2 py-1">
                                        <input
                                            type="date"
                                            className="input-field text-[10px] font-black !py-1 min-h-[32px] text-center text-black"
                                            style={{ backgroundColor: '#66FF99' }}
                                            value={c.cert_date || ""}
                                            onChange={(e) => updateCert(idx, 'cert_date', e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Tab' && !e.shiftKey && idx === certs.length - 1) {
                                                    addCert();
                                                }
                                            }}
                                        />
                                    </td>
                                    <td className="px-2 py-1 text-center">
                                        <div className="flex flex-col items-center justify-center gap-1">
                                            {!c.file_name ? (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const input = document.createElement('input');
                                                        input.type = 'file';
                                                        input.accept = 'application/pdf';
                                                        input.onchange = (ev: any) => {
                                                            const file = ev.target.files?.[0];
                                                            if (file) {
                                                                const newList = [...certs];
                                                                newList[idx].file_name = file.name;
                                                                setCerts(newList);
                                                                if (onDirty) onDirty();
                                                            }
                                                        };
                                                        input.click();
                                                    }}
                                                    className="p-1.5 rounded-lg flex items-center justify-center bg-white hover:bg-slate-100 text-slate-400 border border-slate-200 shadow-sm transition-colors"
                                                    title="Asignar archivo PDF manual (Sin evaluar)"
                                                >
                                                    <Upload size={16} />
                                                </button>
                                            ) : (
                                                <div className="flex gap-1 items-center bg-emerald-50 p-1 rounded-lg border border-emerald-100">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                        const input = document.createElement('input');
                                                        input.type = 'file';
                                                        input.accept = 'application/pdf';
                                                        input.onchange = async (ev: any) => {
                                                            const file = ev.target.files?.[0];
                                                            if (file) {
                                                                const win = window as any;
                                                                if (win.electronAPI && win.electronAPI.parsePdf) {
                                                                    setParsing(true);
                                                                    try {
                                                                        const res = await win.electronAPI.parsePdf(file);
                                                                        if (res.success && res.text) {
                                                                            const extracted = extractData(res.text);
                                                                            const newList = [...certs];
                                                                            // Actualizar datos de la fila con lo extraído
                                                                            newList[idx] = { ...newList[idx], ...extracted, file_name: file.name, item_id: newList[idx].item_id || extracted.item_id };
                                                                            setCerts(newList);
                                                                            if (onDirty) onDirty();
                                                                            alert("Documento leído exitosamente. Validaciones actualizadas.");
                                                                        }
                                                                    } catch (err) {
                                                                        alert("Error leyendo el PDF.");
                                                                    } finally {
                                                                        setParsing(false);
                                                                    }
                                                                } else {
                                                                    alert("Esta función sólo está disponible en la versión de escritorio.");
                                                                }
                                                            }
                                                        };
                                                        input.click();
                                                        }}
                                                        className="p-1.5 rounded-md flex items-center justify-center bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors"
                                                        title="Leer Documento con Inteligencia/Reglas para identificar las 4 condiciones"
                                                    >
                                                        <FileSearch size={16} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newList = [...certs];
                                                            newList[idx].file_name = undefined;
                                                            // Opcionalmente podemos resetear el status de validación aquí si queremos,
                                                            // pero lo dejaremos para que el usuario pueda borrar solo el fileName si se equivocó
                                                            setCerts(newList);
                                                            if (onDirty) onDirty();
                                                        }}
                                                        className="p-1.5 rounded-md flex items-center justify-center bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                                                        title="Borrar Documento"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            )}
                                            {c.file_name && <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest max-w-[80px] truncate cursor-help block mt-0.5" title={c.file_name}>CARGADO</span>}
                                        </div>
                                    </td>
                                    <td className="px-2 py-1 text-center">
                                        {(c.validation || c.validation_status) ? (
                                            <button
                                                type="button"
                                                onClick={() => setShowValidationIdx(showValidationIdx === idx ? null : idx)}
                                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter transition-all ${(c.validation?.isValid || c.validation_status === 'CUMPLE')
                                                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                                    : (c.validation_status === 'PENDIENTE' ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-700 hover:bg-amber-200')
                                                    }`}
                                            >
                                                {(c.validation?.isValid || c.validation_status === 'CUMPLE') ? <ShieldCheck size={12} /> : <AlertCircle size={12} />}
                                                {c.validation_status || (c.validation?.isValid ? "CUMPLE" : "REVISAR")}
                                            </button>
                                        ) : (
                                            <span className="text-[10px] text-slate-400 font-bold italic">N/A</span>
                                        )}
                                    </td>
                                    <td className="px-2 py-1 text-center">
                                         <button
                                             type="button"
                                             onClick={() => removeCert(idx)}
                                             className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 transition-all font-black text-[10px] uppercase tracking-wider shadow-sm"
                                             title="Eliminar certificado permanentemente"
                                         >
                                             <Trash2 size={13} />
                                             Borrar
                                         </button>
                                     </td>
                                </tr>
                                {showValidationIdx === idx && c.validation && (
                                    <tr className="bg-slate-50 dark:bg-slate-900/50">
                                        <td colSpan={9} className="px-2 py-2">
                                            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                                                <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700 p-2 px-4 flex justify-between items-center">
                                                    <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                                        <Info size={14} className="text-primary" />
                                                        Detalles de Validación de Documento
                                                    </span>
                                                    <button onClick={() => setShowValidationIdx(null)} className="text-slate-400 hover:text-slate-600">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                                    <div className="space-y-3">
                                                        <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b pb-1">Requisitos Generales</h4>
                                                        <div className="space-y-2">
                                                            <ValidationItem label="Nombre del Fabricante" status={c.validation.hasManufacturer} />
                                                            <ValidationItem label="Especificación" status={c.validation.hasSpecificationMatch} />
                                                            <ValidationItem label="Número de Proyecto (ACT)" status={c.validation.hasProject} />
                                                            <ValidationItem label="Partida / Ítem identificado" status={c.validation.hasItem} />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-3">
                                                        <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b pb-1">Requisitos de Acero/Hierro {c.validation.isSteel && <span className="text-blue-500 ml-2">(DETECTADO)</span>}</h4>
                                                        <div className="space-y-2">
                                                            <ValidationItem label="Cláusula 'Buy America' (Procesos en USA)" status={c.validation.hasBuyAmerica} disabled={!c.validation.isSteel} />
                                                            <ValidationItem label="Declaración de Registros Disponibles" status={c.validation.hasRecords} disabled={!c.validation.isSteel} />
                                                            <ValidationItem label="Entregado a (Furnished to):" status={c.validation.hasFurnished} disabled={!c.validation.isSteel} />
                                                            {c.validation.hasFurnished && (
                                                                <div className="pl-6 text-[10px] font-medium text-slate-500">
                                                                    {c.validation.hasFurnishedMatch
                                                                        ? <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 size={10} /> Coincide con contratista principal</span>
                                                                        : <span className="text-amber-600 flex items-center gap-1"><AlertCircle size={10} /> No se encontró coincidencia exacta con contratista</span>
                                                                    }
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                {!c.validation.isValid && (
                                                    <div className="bg-amber-50 dark:bg-amber-900/10 p-3 border-t border-amber-100 dark:border-amber-900/30">
                                                        <p className="text-[11px] text-amber-700 dark:text-amber-400 font-bold flex items-center gap-2">
                                                            <AlertCircle size={14} />
                                                            Este certificado podría ser rechazado por PRHTA. Por favor verifique los puntos marcados en rojo.
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                        <tr>
                            <td colSpan={9} className="px-4 py-3 border-t border-slate-100 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={addCert}
                                    className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                                >
                                    <Plus size={14} />
                                    Añadir item
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
                {certs.length === 0 && (
                    <div className="py-12 text-center text-slate-400 italic text-sm font-medium">
                        No hay certificados de manufactura registrados. <br />
                        Haz clic en "Añadir item" para comenzar.
                    </div>
                )}
            </div>
            <FloatingFormActions
                actions={[
                    {
                        label: "Exportar JSON", position: "middle-right" as const, size: "small" as const,
                        icon: <Download />,
                        onClick: () => exportSectionToJSON("mfg_certs", certs),
                        description: "Exportar todos los certificados de manufactura actuales a JSON",
                        variant: 'info' as const,
                        disabled: loading || parsing
                    },
                    {
                        label: "Importar JSON", position: "middle-right" as const, size: "small" as const,
                        icon: <Upload />,
                        onClick: () => document.getElementById('import-mfg-json')?.click(),
                        description: "Cargar certificados de manufactura desde un archivo JSON",
                        variant: 'secondary' as const,
                        disabled: loading || parsing
                    },
                    {
                        label: loading ? "Guardando..." : "Guardar cambios",
                        icon: <Save />,
                        onClick: () => saveData(false),
                        description: "Actualizar validar y sincronizar certificados de manufactura detectados",
                        variant: 'primary' as const,
                        disabled: loading || parsing
                    }
                ]}
            />
            <input id="import-mfg-json" type="file" accept=".json" className="hidden" onChange={handleImport} />

        </div>
    );
});

function ValidationItem({ label, status, disabled = false }: { label: string, status: boolean, disabled?: boolean }) {
    if (disabled) return (
        <div className="flex items-center gap-2 text-slate-300 dark:text-slate-700 italic">
            <div className="w-4 h-4 rounded-full border border-slate-200 dark:border-slate-800" />
            <span className="text-xs">{label} (No requerido)</span>
        </div>
    );
    return (
        <div className="flex items-center gap-2">
            {status ? (
                <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
            ) : (
                <AlertCircle size={16} className="text-red-500 shrink-0" />
            )}
            <span className={`text-xs font-bold ${status ? 'text-slate-600 dark:text-slate-300' : 'text-red-600 dark:text-red-400'}`}>
                {label}
            </span>
        </div>
    );
}

export default MfgCertForm;
