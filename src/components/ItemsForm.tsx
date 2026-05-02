"use client";

import React, { useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/lib/supabase";
import { Save, ListChecks, Plus, Trash2, Info, PlusSquare, FileText, Printer, Search } from "lucide-react";
import FloatingFormActions from "./FloatingFormActions";
import { formatCurrency, formatNumber, roundedAmt, sortItemsNaturally } from "@/lib/utils";
import type { FormRef } from "./ProjectForm";
import mfgItemsData from "@/lib/mfgItems.json";

import specsData from "@/data/specifications.json";
import { parsePdfClient, pdfToImages } from "@/lib/pdfClientParser";

const FUND_SOURCES = ["ACT:100%", "FHWA:80.25", "FHWA:100%"];

interface SpecInfo {
    unit: string;
    description: string;
}

const specs = specsData as Record<string, SpecInfo>;

const ItemsForm = forwardRef<FormRef, { projectId?: string, numAct?: string, onDirty?: () => void, onSaved?: () => void, readOnly?: boolean, onlyOriginals?: boolean }>(function ItemsForm({ projectId, numAct, onDirty, onSaved, readOnly = false, onlyOriginals = false }, ref) {
    const [items, setItems] = useState<any[]>([]);
    const [chos, setChos] = useState<any[]>([]);
    const [certs, setCerts] = useState<any[]>([]);
    const [priceSuggestions, setPriceSuggestions] = useState<Record<string, number[]>>({});
    const [expandedItem, setExpandedItem] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        if (projectId) {
            fetchItems();
            fetchCHOs();
            fetchCerts();
            fetchPriceHistory();

            // Sincronización en tiempo real
            const channel = supabase
                .channel(`items-form-${projectId}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'contract_items', filter: `project_id=eq.${projectId}` }, () => fetchItems())
                .on('postgres_changes', { event: '*', schema: 'public', table: 'chos', filter: `project_id=eq.${projectId}` }, () => fetchCHOs())
                .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_certifications', filter: `project_id=eq.${projectId}` }, () => fetchCerts())
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
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
        if (data && data.length > 0) setItems(sortItemsNaturally(data));
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


    const handleImportPDF = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        if (file.type !== 'application/pdf' && !file.type.startsWith('image/')) {
            alert("El archivo debe ser un documento PDF o imagen.");
            e.target.value = '';
            return;
        }
        
        try {
            setLoading(true);
            const reader = new FileReader();
            reader.onload = async (ev) => {
                const base64 = ev.target?.result as string;
                
                try {
                    let finalItems: any[] = [];
                    let usedAI = false;

                    // 1. Intentar Fuerza Bruta Nuclear (Solo PDF Textual)
                    if (file.type === 'application/pdf') {
                        const data = await parsePdfClient(base64);
                        if (data.success && data.text && data.text.trim().length > 50) {
                            const cleanText = data.text.replace(/\|/g, ' ').toUpperCase();
                            const extractedItems: any[] = [];
                            const allSpecs = Object.keys(specs);
                            const posMap = new Map<string, number>();

                            for (const sCode of allSpecs) {
                                const parts = sCode.split('-');
                                if (parts.length < 2) continue;
                                const prefixChars = parts[0].split('').join('\\s*');
                                const suffixChars = parts[1].split('').join('\\s*');
                                const patternStr = `(?:1\\s*)?${prefixChars}\\s*[-__.\\s]*\\s*${suffixChars}`;
                                const regex = new RegExp(patternStr, 'g');
                                
                                let match;
                                while ((match = regex.exec(cleanText)) !== null) {
                                    posMap.set(sCode + '-' + match.index, match.index);
                                    let lookahead = cleanText.substring(match.index + match[0].length, match.index + match[0].length + 1200);
                                    let lookbehind = cleanText.substring(Math.max(0, match.index - 80), match.index);
                                    let score = 0;
                                    
                                    const unitPatterns = [
                                        /L\s*S/i, /E\s*A/i, /S\s*Q\s*M/i, /L\s*F/i, /L\s*M/i, /L\s*N\s*M/i,
                                        /H\s*O\s*U\s*R\s*S?/i, /H\s*R\s*S?/i, /D\s*A\s*Y/i, 
                                        /M\s*2/i, /M\s*3/i, /T\s*O\s*N/i, /K\s*G/i
                                    ];
                                    let foundUnit = false;
                                    let uIdx = -1;
                                    for (const up of unitPatterns) {
                                        let um = lookahead.match(up);
                                        if (um) { foundUnit = true; uIdx = um.index || 0; break; }
                                    }
                                    if (foundUnit) score += 40;

                                    if (['654-165', '625-001', '620-002', '800-001'].some(ghost => sCode.includes(ghost))) continue;

                                    let price = 0;
                                    let amount = 0;
                                    let qty = 0;

                                    const allNums = [...lookahead.matchAll(/(\d[\d\s\.,]*)(\.\d{2})?/g)]
                                        .map(m => m[0].replace(/[\s,]/g, ''))
                                        .filter(s => s.length > 0 && !isNaN(Number(s)))
                                        .map(Number);

                                    if (allNums.length >= 2) {
                                        for (let i = allNums.length - 1; i > 0; i--) {
                                            let tot = allNums[i];
                                            let pri = allNums[i-1];
                                            if (pri > 0) {
                                                let q = tot / pri;
                                                if (Math.abs(q - Math.round(q)) < 0.01 && q > 0 && q < 10000) {
                                                    qty = Math.round(q);
                                                    price = pri;
                                                    amount = tot;
                                                    break;
                                                }
                                            }
                                        }
                                    }

                                    if (qty === 0 && foundUnit) {
                                        let beforeUnit = lookahead.substring(0, uIdx);
                                        let textNums = [...beforeUnit.matchAll(/(\d+)/g)].map(m => parseInt(m[0], 10));
                                        if (textNums.length > 0) {
                                            qty = textNums[textNums.length - 1];
                                        } else {
                                            qty = 1;
                                        }
                                    }

                                    if (qty > 0) score += 30;
                                    if (amount > 0) score += 40;

                                    const prefix = sCode.split('-')[0];
                                    const hasPrefixRepetition = new RegExp(`(?:\\s|^)${prefix}\\s+`, 'i').test(lookbehind);
                                    if (hasPrefixRepetition) score += 40;

                                    if (lookbehind.match(/(?:SEE|VER|SPEC|SECCION|SECTION|INCLUDES|INCLUYE|REF|ACCORDING|SEG\b|FOR\b|PARA\b|LIKE|COMO\b)/i)) {
                                        score -= 150;
                                    }
                                    if ((lookahead + lookbehind).match(/(?:SUPPORT|SOPORTE|POST\b|POSTE|MOUNT)/i)) {
                                        score -= 60;
                                    }

                                    if (score < 35) continue; 
                                    
                                    const specInfo = specs[sCode];
                                    let unitStr = (specInfo.unit || "LS").toUpperCase();
                                    if (unitStr === 'EA') unitStr = 'EACH';
                                    if (unitStr === 'SM') unitStr = 'SQM';
                                    if (unitStr === 'LM' || unitStr === 'LF') unitStr = 'LNM';
                                    if (unitStr === 'HR') unitStr = 'HOUR';
                                    if (unitStr === 'LUMP SUM') unitStr = 'LS';

                                    extractedItems.push({
                                        specification: sCode,
                                        description: specInfo.description || "",
                                        quantity: qty,
                                        unit: unitStr,
                                        unit_price: price,
                                        pos: match.index
                                    });
                                }
                            }
                            
                            if (extractedItems.length > 0) {
                                const seen = new Set();
                                const uniqueAndValid = [];
                                const sorted = extractedItems.sort((a, b) => a.pos - b.pos);

                                for (const it of sorted) {
                                    if (!seen.has(it.specification)) {
                                        if (it.description && it.description.trim() !== "" && it.description.toUpperCase() !== "N/A") {
                                            seen.add(it.specification);
                                            uniqueAndValid.push(it);
                                        }
                                    }
                                }

                                finalItems = uniqueAndValid;
                            }
                        }
                    }

                    // 2. Fallback a IA con Visión (Si es escaneo o imagen)
                    if (finalItems.length === 0) {
                        usedAI = true;
                        let imagesArray: string[] = [];
                        
                        if (file.type === 'application/pdf') {
                            const imgRes = await pdfToImages(base64);
                            if (imgRes.success && imgRes.images) {
                                imagesArray = imgRes.images;
                            }
                        } else {
                            imagesArray = [base64];
                        }

                        if (imagesArray.length > 0) {
                            const prompt = "Analiza esta imagen de partidas/items de contrato de construcción. Extrae cada partida y devuelve EXACTAMENTE un JSON array puro con este formato: [{\"specification\": \"123-456\", \"quantity\": 500, \"unit\": \"LNM\", \"unit_price\": 10.50}]. NO incluyas markdown, no incluyas descripciones de texto, SOLO EL ARREGLO JSON. Ignora texto no relacionado a items. Revisa bien las cantidades y precios. Si no encuentras items, devuelve [].";
                            
                            const payload = { prompt, image: imagesArray };
                            let aiResponse: any;

                            const win = typeof window !== 'undefined' ? (window as any) : null;
                            if (win?.electronAPI?.analyzeDocument) {
                                aiResponse = await win.electronAPI.analyzeDocument(payload);
                            } else {
                                const req = await fetch('/api/analyze-document', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(payload)
                                });
                                aiResponse = await req.json();
                            }

                            if (aiResponse?.success && aiResponse.result) {
                                try {
                                    let jsonStr = aiResponse.result.replace(/```json/g, '').replace(/```/g, '').trim();
                                    const parsedData = JSON.parse(jsonStr);
                                    if (Array.isArray(parsedData)) {
                                        finalItems = parsedData.map(it => {
                                            const specInfo = specs[it.specification] || { description: "Item no listado en Especificaciones" };
                                            return {
                                                specification: it.specification,
                                                description: specInfo.description,
                                                quantity: Number(it.quantity) || 0,
                                                unit: it.unit || "LS",
                                                unit_price: Number(it.unit_price) || 0
                                            };
                                        }).filter(it => it.quantity > 0 || it.unit_price > 0);
                                    }
                                } catch (err) {
                                    console.error("No se pudo parsear el JSON de la IA:", aiResponse.result);
                                }
                            }
                        }
                    }

                    // 3. Procesar resultados finales
                    if (finalItems.length > 0) {
                        const parsedItems = finalItems.map((it, idx) => ({
                            item_num: (idx + 1).toString().padStart(3, '0'),
                            specification: it.specification,
                            description: it.description,
                            additional_description: "",
                            quantity: it.quantity,
                            unit: it.unit,
                            unit_price: it.unit_price || 0,
                            fund_source: FUND_SOURCES[0],
                            requires_mfg_cert: (mfgItemsData as Record<string, boolean>)[it.specification] === true,
                            mfg_cert_qty: 1
                        }));

                        setItems(parsedItems);
                        if (onDirty) onDirty();
                        alert(`✓ ¡EXTRACCIÓN COMPLETADA!\n\nMétodo utilizado: ${usedAI ? 'Inteligencia Artificial (Visión)' : 'Extracción Nativa Rápida'}\nSe detectaron ${parsedItems.length} partidas válidas.\n\nRevisa los precios y cantidades para asegurar precisión.`);
                    } else {
                        alert("No se detectaron partidas automáticamente. La IA no encontró la tabla correctamente o la imagen es ilegible.");
                    }
                } catch (err: any) {
                    alert("Error procesando documento: " + err.message);
                } finally {
                    setLoading(false);
                }
            };
            reader.readAsDataURL(file);
        } catch (e: any) {
            setLoading(false);
            alert("Error de lectura: " + e.message);
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
                        label: "Extraer de PDF (IA)",
                        icon: <FileText />,
                        onClick: () => document.getElementById('import-items-pdf')?.click(),
                        description: "Leer un PDF o escaneo para extraer automáticamente las partidas",
                        variant: 'secondary' as const
                    } : null,
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

            <input id="import-items-pdf" type="file" accept="application/pdf" className="hidden" onChange={handleImportPDF} />




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
                                                disabled={readOnly}
                                                className={`input-field text-xs text-center font-bold h-8 !py-1 transition-all ${readOnly ? 'bg-transparent border-none' : 'bg-white shadow-sm'} ${parseFloat(item.quantity) === 0 && choQty > 0 ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}
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
                                            <input type="text" disabled={readOnly} className="input-field text-xs text-center h-8 !py-1" style={{ backgroundColor: readOnly ? 'white' : ((parseFloat(item.quantity) === 0 && choQty > 0) ? 'white' : '#66FF99'), ...getFieldStyle(item, 'specification') }} value={item.specification || ""} onChange={(e) => updateItem(idx, 'specification', e.target.value)} />
                                        </td>
                                        <td className="px-1 py-1.5">
                                            <div className="space-y-1">
                                                <input type="text" disabled={readOnly} className="input-field text-xs h-8 !py-1" style={{ backgroundColor: readOnly ? 'white' : ((parseFloat(item.quantity) === 0 && choQty > 0) ? 'white' : '#66FF99'), ...getFieldStyle(item, 'description') }} value={item.description || ""} onChange={(e) => updateItem(idx, 'description', e.target.value)} />
                                                <input type="text" disabled={readOnly} className="input-field text-[10px] h-6 !py-0.5 opacity-70" style={{ backgroundColor: readOnly ? 'white' : ((parseFloat(item.quantity) === 0 && choQty > 0) ? 'white' : '#66FF99'), ...getFieldStyle(item, 'additional_description') }} value={item.additional_description || ""} onChange={(e) => updateItem(idx, 'additional_description', e.target.value)} placeholder="Descripción Adicional..." />
                                            </div>
                                        </td>
                                        <td className="px-1 py-1.5">
                                            <input type="number" disabled={readOnly} className="input-field text-xs text-right h-8 !py-1" style={{ backgroundColor: readOnly ? 'white' : ((parseFloat(item.quantity) === 0 && choQty > 0) ? 'white' : '#66FF99'), ...getFieldStyle(item, 'quantity') }} value={isNaN(item.quantity) ? "" : item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value === "" ? 0 : parseFloat(e.target.value))} />
                                        </td>
                                        <td className="px-1 py-1.5 text-right text-xs font-bold text-blue-600 pr-4">
                                            {choQty !== 0 ? formatNumber(choQty) : "-"}
                                        </td>
                                        <td className="px-1 py-1.5 text-right text-xs font-black pr-4">
                                            {formatNumber(totalQty)}
                                        </td>
                                        <td className="px-1 py-1.5 text-center">
                                            <input type="text" disabled={readOnly} className="input-field uppercase h-8 !py-1 text-center px-1" style={{ fontSize: '9px', backgroundColor: readOnly ? 'white' : ((parseFloat(item.quantity) === 0 && choQty > 0) ? 'white' : '#66FF99'), ...getFieldStyle(item, 'unit') }} value={item.unit || ""} onChange={(e) => updateItem(idx, 'unit', e.target.value)} />
                                        </td>
                                        <td className="px-1 py-1.5">
                                            <input 
                                                type="number" 
                                                step="0.0001" 
                                                disabled={readOnly}
                                                className="input-field text-xs text-right font-medium h-8 !py-1" 
                                                style={{ backgroundColor: readOnly ? 'white' : ((parseFloat(item.quantity) === 0 && choQty > 0) ? 'white' : '#66FF99'), ...getFieldStyle(item, 'unit_price') }} 
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
                                                style={{ backgroundColor: readOnly ? 'white' : ((parseFloat(item.quantity) === 0 && choQty > 0) ? 'white' : '#66FF99') }}
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
                                                    {!readOnly && (
                                                        <button
                                                            onClick={() => insertItem(idx)}
                                                            className="bg-emerald-100 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all rounded-full p-1 shadow-sm transform hover:scale-110"
                                                            title="Insertar item debajo"
                                                        >
                                                            <PlusSquare size={14} strokeWidth={2.5} />
                                                        </button>
                                                    )}
                                                </div>
                                                {!readOnly && (
                                                    <button type="button" onClick={() => removeItem(idx)} className="text-slate-300 hover:text-red-500 transition-colors" title="Eliminar partida">
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                    {expandedItem === idx && (
                                        <tr className="bg-blue-50/30 dark:bg-blue-900/10 border-l-2 border-blue-400">
                                            <td colSpan={12} className="px-4 py-4">
                                                <div className="flex flex-col gap-3">
                                                    <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm">
                                                        <div className="space-y-1">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Resumen de Monthly payments</span>
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
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase">Monthly payments Registrados (Certificaciones)</span>
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
