"use client";

import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Save, Factory, Plus, Trash2, Upload, Loader2, CheckCircle2, AlertCircle, Info, ShieldCheck, Download, FileText, Printer, Paperclip } from "lucide-react";
import FloatingFormActions from "./FloatingFormActions";
import type { FormRef } from "./ProjectForm";
import { parsePdfClient } from "@/lib/pdfClientParser";

import { sortItemsNaturally } from "@/lib/utils";
import { TodayButton } from "./TodayButton";

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
    const [paymentCerts, setPaymentCerts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [parsing, setParsing] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [uploadingCmIdx, setUploadingCmIdx] = useState<number | null>(null);
    const cmFileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

    const [contractorName, setContractorName] = useState("");
    const [showValidationIdx, setShowValidationIdx] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState("");

    // Estados para el buscador de acumulado de certificados por partida
    const [sumSearchText, setSumSearchText] = useState("");
    const [sumSearchItemId, setSumSearchItemId] = useState("");
    const [isSumDropdownOpen, setIsSumDropdownOpen] = useState(false);

    // Función para calcular la suma de CMs aprobados para un ítem en específico
    const calculateTotalForItemId = (itemId: string) => {
        let total = 0;
        certs.forEach(c => {
            if (c.is_multiple) {
                if (c.item_ids?.includes(itemId)) {
                    total += parseFloat(c.multiple_quantities?.[itemId] ?? c.quantity) || 0;
                }
            } else {
                if (c.item_id === itemId) {
                    total += parseFloat(c.quantity) || 0;
                }
            }
        });
        return total;
    };

    // Función para calcular lo ya pagado en todas las certificaciones de pago para un item_num
    const calculatePaidForItemNum = (itemNum: string) => {
        const normalizeNum = (n: any) => {
            if (!n) return "";
            const s = n.toString().trim();
            return /^\d+$/.test(s) ? s.padStart(3, '0') : s;
        };
        const normTarget = normalizeNum(itemNum);
        let totalPaid = 0;
        const breakdown: { certNum: number; quantity: number }[] = [];
        paymentCerts.forEach(pc => {
            const items = pc.items || [];
            const match = items.find((it: any) => normalizeNum(it.item_num) === normTarget);
            if (match) {
                const qty = parseFloat(match.quantity) || 0;
                if (qty > 0) {
                    totalPaid += qty;
                    breakdown.push({ certNum: pc.cert_num, quantity: qty });
                }
            }
        });
        return { totalPaid, breakdown };
    };

    useEffect(() => {
        setMounted(true);
        if (projectId) {
            const loadData = async () => {
                await fetchContractor();
                const cItems = await fetchItems();
                if (cItems) {
                    await fetchCerts(cItems);
                }
                await fetchPaymentCerts();
            };
            loadData();
        }
    }, [projectId]);

    const fetchPaymentCerts = async () => {
        const { data } = await supabase
            .from('payment_certifications')
            .select('cert_num, items')
            .eq('project_id', projectId)
            .order('cert_num', { ascending: true });
        if (data) setPaymentCerts(data);
    };

    const fetchContractor = async () => {
        const { data } = await supabase.from("contractors").select("name").eq("project_id", projectId).single();
        if (data) setContractorName(data.name);
    };

    const fetchItems = async () => {
        const { data } = await supabase.from("contract_items").select("*").eq("project_id", projectId);
        if (data) {
            const sortedItems = sortItemsNaturally(data);
            setContractItems(sortedItems);
            return sortedItems;
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
        setCerts(prev => [{
            project_id: projectId,
            item_id: "",
            quantity: 0,
            cert_date: new Date().toISOString().split('T')[0],
        }, ...prev]);
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

    const handleCmFileUpload = async (idx: number, file: File) => {
        if (!projectId) return;
        setUploadingCmIdx(idx);
        try {
            const dateFolder = new Date().toISOString().split('T')[0];
            const timestamp = Date.now();
            const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_');
            const storagePath = `${projectId}/mfg/${dateFolder}/${timestamp}_${safeName}`;

            const { error: storageErr } = await supabase.storage.from("project-documents").upload(storagePath, file);
            if (storageErr) throw storageErr;

            // Registrar en project_documents
            await supabase.from("project_documents").insert({
                project_id: projectId,
                file_name: file.name,
                doc_type: "mfg",
                section: "mfg",
                storage_path: storagePath,
            });

            // Guardar ruta en el cert
            const newList = [...certs];
            newList[idx].cert_file_path = storagePath;
            newList[idx].cert_file_name = file.name;
            setCerts(newList);
            if (onDirty) onDirty();
            alert(`Archivo "${file.name}" subido correctamente a Certificados CM.`);
        } catch (err: any) {
            console.error("Error subiendo CM:", err);
            alert("Error al subir el archivo. Intente de nuevo.");
        } finally {
            setUploadingCmIdx(null);
        }
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
        let files: any[] = [];

        if (win.electronAPI?.selectPdfFiles) {
            // Versión Electron (Devuelve rutas o blobs dependiendo de la implementación)
            const result = await win.electronAPI.selectPdfFiles();
            if (result) files = result;
        } else {
            // Versión Web
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'application/pdf';
            input.multiple = true;
            
            files = await new Promise<any[]>((resolve) => {
                input.onchange = (ev: any) => resolve(Array.from(ev.target.files || []));
                input.click();
            });
        }

        if (files.length === 0) return;

        setParsing(true);
        const newCerts = [...certs];
        if (newCerts.length === 1 && !newCerts[0].item_id && !newCerts[0].id) newCerts.pop();

        let count = 0;
        for (const file of files) {
            try {
                let base64 = "";
                if (typeof file === 'string') {
                    // Si es una ruta (Electron antiguo), necesitamos leerla. 
                    // Pero asumamos que Electron ahora también puede pasar el objeto File o el contenido.
                    // Para mayor seguridad, usamos FileReader si es un Blob/File.
                    if (win.electronAPI?.readFileAsBase64) {
                        base64 = await win.electronAPI.readFileAsBase64(file);
                    }
                } else {
                    base64 = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = (e) => resolve(e.target?.result as string);
                        reader.readAsDataURL(file);
                    });
                }

                if (base64) {
                    const data = await parsePdfClient(base64);
                    if (data.success && data.text) {
                        const extracted = extractData(data.text);
                        newCerts.push({ ...extracted, project_id: projectId });
                        count++;
                    }
                }
            } catch (err) { 
                console.error("Parse err:", err); 
            }
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

    const filteredItemsForSum = contractItems.filter(it => {
        if (!sumSearchText) return true;
        const selectedLabel = `Pt. ${it.item_num}: ${it.description}`;
        if (sumSearchText === selectedLabel) return true;
        const term = sumSearchText.toLowerCase();
        return (it.item_num || "").toString().toLowerCase().includes(term) || (it.description || "").toLowerCase().includes(term);
    });

    if (!mounted) return null;

    return (
        <div suppressHydrationWarning className="w-full px-4 flex flex-col space-y-6">
            <div className="sticky top-0 z-40 bg-[#F8FAFC]/95 dark:bg-[#020617]/95 backdrop-blur-md pt-6 pb-4 -mx-4 px-4 md:-mx-8 md:px-8 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Factory className="text-primary" /> Certificados de Manufactura
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
            </div>

            <FloatingFormActions actions={[
                {
                    label: "Imprimir",
                    icon: <Printer />,
                    onClick: () => window.print(),
                    description: "Imprimir esta sección de Certificados de Manufactura",
                    variant: 'secondary' as const,
                    size: 'small' as const
                },
                { label: "Añadir CM", description: "Añadir nuevo certificado de manufactura", icon: <Plus />, onClick: addCert, variant: 'secondary' },
                { label: loading ? "Guardando..." : "Guardar cambios", description: "Grabar certificados al servidor", icon: <Save />, onClick: () => saveData(false), variant: 'primary', disabled: loading }
            ]} />

            {/* ====== PANEL: BUSCADOR DE ACUMULADO POR PARTIDA ====== */}
            <div className="relative bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950 rounded-3xl border border-emerald-200 dark:border-emerald-900/40 shadow-lg overflow-visible p-5">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-md shadow-emerald-200 dark:shadow-emerald-900">
                        <Factory size={18} className="text-white" />
                    </div>
                    <div>
                        <p className="text-xs font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-widest">Consultar Total de Certificados</p>
                        <p className="text-[10px] text-emerald-600/70 dark:text-emerald-500/70 font-medium">Busca una partida y ve la suma total de todas sus CMs</p>
                    </div>
                </div>

                {/* Input de búsqueda con dropdown */}
                <div className="relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setIsSumDropdownOpen(false); }}>
                    <input
                        type="text"
                        placeholder="Escribe número o descripción de partida..."
                        className="w-full bg-white dark:bg-slate-800 border-2 border-emerald-200 dark:border-emerald-800 rounded-2xl py-3 px-5 text-sm font-semibold focus:ring-4 focus:ring-emerald-300/30 focus:border-emerald-500 transition-all outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
                        value={sumSearchText}
                        onChange={(e) => { setSumSearchText(e.target.value); setSumSearchItemId(""); setIsSumDropdownOpen(true); }}
                        onFocus={() => setIsSumDropdownOpen(true)}
                    />
                    {sumSearchText && (
                        <button
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors text-lg leading-none"
                            onMouseDown={(e) => { e.preventDefault(); setSumSearchText(""); setSumSearchItemId(""); setIsSumDropdownOpen(false); }}
                        >✕</button>
                    )}

                    {/* Dropdown de partidas filtradas */}
                    {isSumDropdownOpen && sumSearchText && filteredItemsForSum.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border-2 border-emerald-200 dark:border-emerald-800 rounded-2xl shadow-2xl z-50 max-h-52 overflow-y-auto">
                            {filteredItemsForSum.map(it => {
                                const itemTotal = calculateTotalForItemId(it.id);
                                const certCount = certs.filter(c => {
                                    if (c.is_multiple) return c.item_ids?.includes(it.id);
                                    return c.item_id === it.id;
                                }).length;
                                return (
                                    <button
                                        key={it.id}
                                        className="w-full text-left px-5 py-3 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors flex items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700 last:border-0"
                                        onMouseDown={(e) => { e.preventDefault(); setSumSearchItemId(it.id); setSumSearchText(`Pt. ${it.item_num}: ${it.description}`); setIsSumDropdownOpen(false); }}
                                    >
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-xs font-black text-slate-800 dark:text-slate-100">Pt. {it.item_num}: {it.description}</span>
                                            <span className="text-[10px] text-slate-400 font-medium">{certCount} documento{certCount !== 1 ? 's' : ''} • {it.unit}</span>
                                        </div>
                                        <span className="text-sm font-black text-emerald-700 dark:text-emerald-400 whitespace-nowrap">{itemTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {it.unit}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Panel de resultado: suma, pagos y balance */}
                {sumSearchItemId && (() => {
                    const selectedItem = contractItems.find(it => it.id === sumSearchItemId);
                    const total = calculateTotalForItemId(sumSearchItemId);
                    const { totalPaid, breakdown: paidBreakdown } = calculatePaidForItemNum(selectedItem?.item_num);
                    
                    const isLS = selectedItem?.unit === 'LS' || selectedItem?.unit === 'LUMP SUM';
                    const targetQty = isLS ? (parseFloat(selectedItem?.mfg_cert_qty) || 1) : totalPaid;
                    const balance = total - targetQty;

                    const matchingCerts = certs.filter(c => {
                        if (c.is_multiple) return c.item_ids?.includes(sumSearchItemId);
                        return c.item_id === sumSearchItemId;
                    });
                    return (
                        <div className="mt-4 bg-white dark:bg-slate-900 rounded-2xl border border-emerald-200 dark:border-emerald-900/40 shadow-inner overflow-hidden">

                            {/* ── Barra de resumen con 3 métricas ── */}
                            <div className="grid grid-cols-3 divide-x divide-emerald-400/30">
                                {/* Total CMs */}
                                <div className="bg-emerald-500 px-4 py-4 flex flex-col gap-0.5">
                                    <p className="text-[9px] font-black text-emerald-100 uppercase tracking-widest">Total Certificado (CM)</p>
                                    <p className="text-xl font-black text-white leading-tight">{total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                    <p className="text-[9px] font-bold text-emerald-200">{selectedItem?.unit} • {matchingCerts.length} doc{matchingCerts.length !== 1 ? 's' : '.'}</p>
                                </div>
                                {/* Ya Pagado / Requerido */}
                                <div className="bg-blue-600 px-4 py-4 flex flex-col gap-0.5">
                                    <p className="text-[9px] font-black text-blue-100 uppercase tracking-widest">
                                        {isLS ? "Requerido (Partida)" : "Ya Pagado (Certs. Pago)"}
                                    </p>
                                    <p className="text-xl font-black text-white leading-tight">
                                        {targetQty.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                    <p className="text-[9px] font-bold text-blue-200">
                                        {isLS ? "Cantidad requerida de CM" : `${selectedItem?.unit} • ${paidBreakdown.length} cert${paidBreakdown.length !== 1 ? 's.' : '.'}`}
                                    </p>
                                </div>
                                {/* Balance */}
                                <div className={`px-4 py-4 flex flex-col gap-0.5 ${balance < 0 ? 'bg-red-600' : balance === 0 ? 'bg-slate-600' : 'bg-teal-600'}`}>
                                    <p className="text-[9px] font-black text-white/80 uppercase tracking-widest">Balance Disponible</p>
                                    <p className="text-xl font-black text-white leading-tight">{balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                    <p className="text-[9px] font-bold text-white/70">{selectedItem?.unit} {balance < 0 ? '⚠ Excedido' : balance === 0 ? '✓ Completo' : '✓ Disponible'}</p>
                                </div>
                            </div>

                            {/* Descripción de la partida */}
                            <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Partida {selectedItem?.item_num}</p>
                                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{selectedItem?.description}</p>
                            </div>

                            {/* ── Desglose: Certificados de Manufactura ── */}
                            {matchingCerts.length > 0 && (
                                <div>
                                    <p className="px-5 pt-3 pb-1 text-[9px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">Certificados de Manufactura</p>
                                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {matchingCerts.map((c, i) => {
                                            const qty = c.is_multiple
                                                ? (parseFloat(c.multiple_quantities?.[sumSearchItemId]) || 0)
                                                : (parseFloat(c.quantity) || 0);
                                            return (
                                                <div key={i} className="flex items-center justify-between px-5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                                                            {c.manufacturer_name || <span className="italic text-slate-400">Sin fabricante</span>}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400">{c.cert_date || '—'}{c.material_description ? ` • ${c.material_description}` : ''}</span>
                                                    </div>
                                                    <span className="text-sm font-black text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                                                        +{qty.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {selectedItem?.unit}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            {matchingCerts.length === 0 && (
                                <p className="px-5 py-3 text-xs text-slate-400 italic">No hay certificados de manufactura registrados para esta partida.</p>
                            )}

                            {/* ── Desglose: Certificaciones de Pago ── */}
                            {paidBreakdown.length > 0 && (
                                <div className="border-t border-slate-100 dark:border-slate-800">
                                    <p className="px-5 pt-3 pb-1 text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Pagado en Certificaciones de Pago</p>
                                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {paidBreakdown.map((p, i) => (
                                            <div key={i} className="flex items-center justify-between px-5 py-2 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors">
                                                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Certificación #{p.certNum}</span>
                                                <span className="text-sm font-black text-blue-600 dark:text-blue-400 whitespace-nowrap">
                                                    -{p.quantity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {selectedItem?.unit}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {paidBreakdown.length === 0 && matchingCerts.length > 0 && (
                                <p className="px-5 pb-3 text-[10px] text-slate-400 italic border-t border-slate-100 dark:border-slate-800 pt-2">Ninguna certificación de pago ha incluido esta partida aún.</p>
                            )}
                        </div>
                    );
                })()}
            </div>
            {/* ====== FIN PANEL BUSCADOR ====== */}

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
                                        <div className="w-full bg-[#66FF99] text-emerald-900 rounded-full px-4 py-2.5 text-xs font-black flex items-center justify-between cursor-pointer border border-emerald-400 group-hover/multi:border-emerald-600 transition-all">
                                            <span>{c.item_ids?.length || 0} PARTIDAS SELECCIONADAS</span>
                                            <div className="flex items-center gap-1">
                                                <Plus size={14} />
                                                {c.item_ids?.length > 0 && <Trash2 size={14} className="ml-1 hover:text-red-600 transition-colors" onClick={(e) => { e.stopPropagation(); updateCert(idx, 'item_ids', []); }} />}
                                            </div>
                                        </div>
                                        <div className="absolute top-full left-0 w-full max-h-64 overflow-y-auto bg-white dark:bg-slate-800 border-2 dark:border-slate-700 shadow-2xl rounded-2xl mt-1 z-[70] hidden group-hover/multi:block p-3 animate-in fade-in zoom-in-95 duration-200">
                                            <p className="text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Seleccionar partidas:</p>
                                            <div className="grid grid-cols-1 gap-1">
                                                {contractItems.filter(it => it.requires_mfg_cert).map(item => (
                                                    <label key={item.id} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${c.item_ids?.includes(item.id) ? 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600'}`}>
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
                                    <div className="relative group/single">
                                        <div className={`w-full bg-[#66FF99] text-emerald-900 rounded-full px-4 py-2.5 text-xs font-black flex items-center gap-2 border border-emerald-400 transition-all ${!c.item_id ? 'opacity-90' : ''}`}>
                                            <span className="truncate flex-1">
                                                {selectedItem ? `Pt. ${selectedItem.item_num}: ${selectedItem.description}` : "SELECCIONAR PARTIDA..."}
                                            </span>
                                            {c.item_id ? (
                                                <Trash2 size={14} className="cursor-pointer hover:text-red-600 transition-colors" onClick={() => updateCert(idx, 'item_id', "")} />
                                            ) : (
                                                <Plus size={14} className="rotate-45 opacity-50" />
                                            )}
                                        </div>
                                        <select 
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                            value={c.item_id || ""} 
                                            onChange={e => {
                                                const m = contractItems.find(it => it.id === e.target.value);
                                                const nl = [...certs]; 
                                                nl[idx].item_id = e.target.value; 
                                                if(m) nl[idx]._unit = m.unit; 
                                                setCerts(nl);
                                            }}
                                        >
                                            <option value="">SELECCIONAR PARTIDA...</option>
                                            {contractItems.filter(it => it.requires_mfg_cert).map(it => (
                                                <option key={it.id} value={it.id}>Pt. {it.item_num}: {it.description}</option>
                                            ))}
                                        </select>
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
                                        <button onClick={() => updateCert(idx, 'is_multiple', false)} className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
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


                            {/* Upload CM Button */}
                            <div className="flex flex-col items-center gap-1">
                                <input
                                    ref={el => { cmFileInputRefs.current[idx] = el; }}
                                    type="file"
                                    accept="application/pdf,image/*"
                                    className="hidden"
                                    onChange={e => {
                                        const file = e.target.files?.[0];
                                        if (file) handleCmFileUpload(idx, file);
                                        e.target.value = "";
                                    }}
                                />
                                <button
                                    onClick={() => cmFileInputRefs.current[idx]?.click()}
                                    disabled={uploadingCmIdx === idx}
                                    className={`flex items-center justify-center w-9 h-9 rounded-full border transition-all shadow-sm ${
                                        c.cert_file_path
                                            ? c.cert_file_name?.toLowerCase().endsWith('.pdf')
                                                ? 'border-red-400 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-600'
                                                : 'border-emerald-400 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:border-emerald-600'
                                            : 'border-blue-200 text-blue-400 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-400'
                                    }`}
                                    title={c.cert_file_path ? `CM: ${c.cert_file_name || 'Archivo subido'} — clic para reemplazar` : "Subir archivo CM"}
                                >
                                    {uploadingCmIdx === idx
                                        ? <Loader2 size={15} className="animate-spin" />
                                        : c.cert_file_path
                                            ? c.cert_file_name?.toLowerCase().endsWith('.pdf')
                                                ? <FileText size={15} />
                                                : <Paperclip size={15} />
                                            : <Upload size={15} />}
                                </button>
                                {c.cert_file_name && (
                                    <span className="text-[7px] text-emerald-600 font-bold max-w-[40px] truncate" title={c.cert_file_name}>
                                        {c.cert_file_name}
                                    </span>
                                )}
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
