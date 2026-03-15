"use client";

import React, { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/lib/supabase";
import { Save, Factory, Plus, Trash2, Upload, Loader2, FileSearch, CheckCircle2, AlertCircle, Info, ShieldCheck } from "lucide-react";
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
            fetchItems();
            fetchCerts();
            fetchContractor();
        }
    }, [projectId]);

    const fetchContractor = async () => {
        const { data } = await supabase.from("contractors").select("name").eq("project_id", projectId).single();
        if (data) setContractorName(data.name);
    };

    const fetchItems = async () => {
        const { data } = await supabase.from("contract_items").select("*").eq("project_id", projectId);
        if (data) setContractItems(data);
    };

    const fetchCerts = async () => {
        const { data, error } = await supabase.from("manufacturing_certificates").select("*").eq("project_id", projectId).order('created_at', { ascending: true });
        if (error) {
            console.error("Error fetching mfg certs:", error.message);
            return;
        }
        if (data && data.length > 0) {
            // Reconstruir el objeto de validación desde las columnas de la DB
            const mapped = data.map(c => ({
                ...c,
                validation: {
                    isSteel: c.is_steel,
                    hasBuyAmerica: c.has_buy_america,
                    hasRecords: c.has_records,
                    hasFurnished: c.has_furnished,
                    hasProject: true, // Si se guardó, asumimos que se validó el proyecto
                    hasManufacturer: !!c.manufacturer_name,
                    hasSpecificationMatch: c.validation_status === 'CUMPLE',
                    isValid: c.validation_status === 'CUMPLE',
                    hasFurnishedMatch: true, // Simplificación para carga
                    hasItem: true
                }
            }));
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

    const removeCert = (idx: number) => {
        setCerts(certs.filter((_, i) => i !== idx));
        if (onDirty) onDirty();
    };

    const extractData = (text: string) => {
        // Expresiones regulares mejoradas para detectar Partida, Cantidad y Fecha
        const cleanText = text.replace(/\s+/g, ' ');
        const itemMatch = text.match(/(?:Partida|Item|Renglón|Material|Code)\s*(?:#|No\.?|:)?\s*([A-Za-z0-9-]+)/i);
        const qtyMatch = text.match(/(?:Cantidad|Cant\.?|Quantity|Qty|Total|Volumen)\s*(?::|=)?\s*([\d,.]+)/i);
        const dateMatch = text.match(/(?:Fecha|Date|Emisión|Issue)\s*(?::|=)?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})|(\d{4}-\d{2}-\d{2})/i);

        let itemId = "";
        let quantity = 0;
        let certDate = new Date().toISOString().split('T')[0];

        if (itemMatch) {
            const itemNumRaw = itemMatch[1].trim();
            const match = contractItems.find(it =>
                it.item_num === itemNumRaw ||
                it.item_num === itemNumRaw.padStart(3, '0') ||
                (it.specification && it.specification.includes(itemNumRaw))
            );
            if (match) itemId = match.id;
        }

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

        const manufacturerName = mfgMatch ? mfgMatch[1].trim() : "Detectado en PDF";
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
        if (itemId && materialSpec) {
            const itemMatch = contractItems.find(it => it.id === itemId);
            if (itemMatch && itemMatch.specification) {
                const itemSpecPrefix = itemMatch.specification.substring(0, 3);
                if (materialSpec.includes(itemSpecPrefix)) {
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
            material_description: materialDescription
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
            for (const c of validCerts) {
                const { id, created_at, validation, ...rest } = c;
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
            await fetchCerts();
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
        <div suppressHydrationWarning className="max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Factory className="text-primary" />
                    7. Certificados de Manufactura
                </h2>
                <div className="flex gap-2">
                    <button
                        onClick={handleFileUpload}
                        disabled={parsing || loading}
                        className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-blue-100 transition-colors border border-blue-100"
                    >
                        {parsing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                        {parsing ? "Leyendo certificados..." : "Cargar certificados"}
                    </button>
                    <button onClick={addCert} className="bg-slate-100 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 text-slate-700 hover:bg-slate-200 transition-colors">
                        <Plus size={16} /> Nuevo Certificado
                    </button>
                    <button onClick={handleSubmit} disabled={loading || parsing} className="btn-primary flex items-center gap-2">
                        <Save size={18} />
                        {loading ? "Sincronizando..." : "Guardar Certificados"}
                    </button>
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
                <table suppressHydrationWarning className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 uppercase text-[10px] font-extrabold border-b border-slate-100 dark:border-slate-800">
                        <tr>
                            <th className="px-2 py-2 w-10 text-center">#</th>
                            <th className="px-2 py-2">Partida Vinculada</th>
                            <th className="px-2 py-2">Fabricante / Planta</th>
                            <th className="px-2 py-2 w-32 text-center">Cantidad</th>
                            <th className="px-2 py-2 w-48 text-center">Fecha del Certificado</th>
                            <th className="px-2 py-2 w-24 text-center">Estado PRHTA</th>
                            <th className="px-2 py-2 w-16"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                        {certs.map((c, idx) => (
                            <React.Fragment key={idx}>
                                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                                    <td className="px-2 py-1 text-center text-xs font-bold text-slate-400 w-10">{idx + 1}</td>
                                    <td className="px-2 py-1">
                                        <select
                                            className="input-field text-xs font-bold h-9 text-black"
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
                                                }
                                                setCerts(newList);
                                                if (onDirty) onDirty();
                                            }}
                                        >
                                            <option value="">Seleccionar Partida...</option>
                                            {contractItems.filter(item => item.requires_mfg_cert).map(item => (
                                                <option key={item.id} value={item.id}>Partida {item.item_num}: {item.description}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="px-2 py-1">
                                        <input
                                            type="text"
                                            className="input-field text-xs h-9"
                                            value={c.manufacturer_name || ""}
                                            onChange={(e) => updateCert(idx, 'manufacturer_name', e.target.value)}
                                            placeholder="Nombre del Fabricante"
                                        />
                                    </td>
                                    <td className="px-2 py-1">
                                        <input
                                            type="number"
                                            className="input-field text-xs text-center h-9 font-bold text-black"
                                            style={{ backgroundColor: '#66FF99' }}
                                            value={isNaN(c.quantity) ? "" : c.quantity}
                                            onChange={(e) => updateCert(idx, 'quantity', e.target.value === "" ? NaN : parseFloat(e.target.value))}
                                        />
                                    </td>
                                    <td className="px-2 py-1">
                                        <input
                                            type="date"
                                            className="input-field text-xs font-bold h-9 text-center text-black"
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
                                            className="text-slate-300 hover:text-red-500 transition-colors"
                                            title="Eliminar certificado"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                                {showValidationIdx === idx && c.validation && (
                                    <tr className="bg-slate-50 dark:bg-slate-900/50">
                                        <td colSpan={6} className="px-4 py-4">
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
                            <td colSpan={7} className="px-4 py-3 border-t border-slate-100 dark:border-slate-800">
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
