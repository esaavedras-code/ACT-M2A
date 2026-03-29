"use client";

import React, { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/lib/supabase";
import { Save, FileCheck, Plus, Trash2, Download, DollarSign, Wallet, ShieldAlert, Package, Timer, Printer, Loader2, PlusSquare } from "lucide-react";
import FloatingFormActions from "./FloatingFormActions";
import { generateAct117C } from "@/lib/generateAct117C";
import { downloadBlob } from "@/lib/reportLogic";
import { formatCurrency, formatNumber } from "@/lib/utils";
import specsData from "@/data/specifications.json";
import type { FormRef } from "./ProjectForm";

const specs = specsData as Record<string, { unit: string; description: string }>;

const FUND_SOURCES = ["ACT:100%", "FHWA:80.25", "FHWA:100%"];

const getInvoicePUFromList = (certsList: any[], itemNum: string, currentCertIdx: number) => {
    for (let i = currentCertIdx; i >= 0; i--) {
        if (!certsList[i]) continue;
        const its = Array.isArray(certsList[i].items) ? certsList[i].items : (certsList[i].items?.list || []);
        const match = its.find((itx: any) => itx.item_num === itemNum && itx.has_material_on_site && parseFloat(itx.mos_unit_price) > 0);
        if (match) return parseFloat(match.mos_unit_price);
    }
    return 0;
};

const PaymentCertForm = forwardRef<FormRef, { projectId?: string, numAct?: string, onDirty?: () => void, onSaved?: () => void }>(function PaymentCertForm({ projectId, numAct, onDirty, onSaved }, ref) {
    const [certs, setCerts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState<number | null>(null);
    const [summary, setSummary] = useState({
        executed: 0,
        paid: 0,
        retention: 0,
        materials: 0,
        liquidated: 0
    });
    const [contractItems, setContractItems] = useState<any[]>([]);
    const [chos, setChos] = useState<any[]>([]);
    const [mfgCerts, setMfgCerts] = useState<any[]>([]);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (projectId) {
            fetchCerts();
            fetchSummary();
            fetchContractItems();
            fetchCHOs();
            fetchMfgCerts();
        }
    }, [projectId]);

    const fetchContractItems = async () => {
        const { data } = await supabase.from("contract_items").select("*").eq("project_id", projectId);
        if (data) setContractItems(data);
    };

    const fetchCHOs = async () => {
        const { data } = await supabase.from("chos").select("*").eq("project_id", projectId);
        if (data) setChos(data);
    };

    const fetchMfgCerts = async () => {
        const { data } = await supabase.from("manufacturing_certificates").select("*").eq("project_id", projectId);
        if (data) setMfgCerts(data);
    };

    const getItemTotalRevisedQty = (itemNum: string) => {
        const baseItem = contractItems.find(it => it.item_num === itemNum);
        if (!baseItem) return 0;
        const baseQty = parseFloat(baseItem.quantity) || 0;

        let choQty = 0;
        chos.forEach(cho => {
            const items = Array.isArray(cho.items) ? cho.items : [];
            items.forEach((it: any) => {
                if (it.item_num === itemNum) {
                    choQty += (parseFloat(it.quantity) || 0);
                }
            });
        });

        return baseQty + choQty;
    };

    const fetchSummary = async () => {
        if (!projectId) return;

        // Fetch All Certifications to calculate MOS from items
        const { data: allCerts } = await supabase.from("payment_certifications").select("items").eq("project_id", projectId);
        let materialsVal = 0;
        allCerts?.forEach((c, cIdx) => {
            const items = Array.isArray(c.items) ? c.items : (c.items?.list || []);
            (items as any[]).forEach(it => {
                const addedValue = it.has_material_on_site ? (parseFloat(it.mos_invoice_total) || 0) : 0;
                const mosPU = getInvoicePUFromList(allCerts, it.item_num, cIdx);
                const deductedValue = (parseFloat(it.qty_from_mos) || 0) * (mosPU > 0 ? mosPU : (parseFloat(it.unit_price) || 0));
                materialsVal += addedValue - deductedValue;
            });
        });

        // Fetch Project and CHOs for Liquidated Damages
        const { data: proj } = await supabase.from("projects").select("*").eq("id", projectId).single();
        const { data: chos } = await supabase.from("chos").select("doc_status, time_extension_days").eq("project_id", projectId);

        const timeExt = chos?.filter(c => c.doc_status === 'Aprobado').reduce((acc, c) => acc + (c.time_extension_days || 0), 0) || 0;

        const startDate = proj?.date_project_start ? new Date(proj.date_project_start) : new Date();
        const origEndDate = proj?.date_orig_completion ? new Date(proj.date_orig_completion) : new Date();
        const totalDays = Math.ceil((origEndDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)) + 1;
        const usedDays = Math.ceil((new Date().getTime() - startDate.getTime()) / (1000 * 3600 * 24)) + 1;
        const revisedDays = (totalDays || 0) + timeExt;
        const liquidated = usedDays > revisedDays ? (usedDays - revisedDays) * 500 : 0;

        setSummary(prev => ({
            ...prev,
            materials: materialsVal,
            liquidated: liquidated
        }));
    };

    const fetchCerts = async () => {
        const { data } = await supabase.from("payment_certifications").select("*").eq("project_id", projectId).order("cert_num", { ascending: true });
        if (data && data.length > 0) {
            // Restore simpler structure: items is just a list
            const normalized = data.map(c => {
                let items = c.items;
                if (c.items && !Array.isArray(c.items) && c.items.list) {
                    items = c.items.list;
                }
                return { ...c, items };
            });
            setCerts(normalized);
        } else {
            addCert();
        }
    };

    const addCert = () => {
        const nextNum = certs.length > 0 ? Math.max(...certs.map(c => c.cert_num)) + 1 : 1;
        setCerts([...certs, {
            project_id: projectId,
            cert_num: nextNum,
            cert_date: new Date().toISOString().split('T')[0],
        }]);
        if (onDirty) onDirty();
    };

    const removeCert = (idx: number) => {
        setCerts(certs.filter((_, i) => i !== idx));
        if (onDirty) onDirty();
    };

    const updateCert = (idx: number, field: string, value: any) => {
        const newList = [...certs];
        newList[idx][field] = value;
        setCerts(newList);
        if (onDirty) onDirty();
    };

    const saveData = async (silent = false) => {
        if (!projectId) return;

        // Validation: Check if any item exceeds its available balance
        let hasConfirmedOverage = false;

        for (let i = 0; i < certs.length; i++) {
            const cert = certs[i];
            const certItems = cert.items || [];
            for (let j = 0; j < certItems.length; j++) {
                const item = certItems[j];
                const totalRevisedQty = getItemTotalRevisedQty(item.item_num);

                // Calculate quantity paid in PREVIOUS certifications only
                let paidInPrevious = 0;
                for (let k = 0; k < i; k++) {
                    const prevCertItems = certs[k].items || [];
                    const match = prevCertItems.find((p: any) => p.item_num === item.item_num);
                    if (match) paidInPrevious += parseFloat(match.quantity) || 0;
                }

                const availableBalance = totalRevisedQty - paidInPrevious;
                const currentQty = parseFloat(item.quantity) || 0;

                if (currentQty > (availableBalance + 0.0001)) { // Small epsilon for float comparison
                    if (!silent) {
                        if (!hasConfirmedOverage) {
                            const proceed = window.confirm(`Atención en Certificación #${cert.cert_num}: El ítem ${item.item_num} supera el balance de contrato disponible (${availableBalance.toFixed(2)}). Por favor verifique la cantidad.\n\n¿Desea guardar de todos modos? (Seleccione OK para Grabar)`);
                            if (!proceed) return;
                            hasConfirmedOverage = true;
                        }
                    } else {
                        // Si es guardado automático silencioso y supera balance, evitamos guardar sin permiso, o podríamos forzar
                        return;
                    }
                }

                // CM Validation
                const baseItemMatch = contractItems.find(it => it.item_num === item.item_num);
                if (baseItemMatch?.requires_mfg_cert) {
                    const totalApprovedMfg = mfgCerts
                        .filter(mc => mc.item_id === baseItemMatch.id)
                        .reduce((acc, mc) => acc + (parseFloat(mc.quantity) || 0), 0);
                    const mfgCertBalance = totalApprovedMfg - paidInPrevious;
                    if (currentQty > (mfgCertBalance + 0.0001)) {
                        if (!silent) {
                            if (!hasConfirmedOverage) {
                                const proceed = window.confirm(`Error en Certificación #${cert.cert_num}: El ítem ${item.item_num} supera el balance de CM disponible (${mfgCertBalance.toFixed(2)}). Por favor ajuste la cantidad.\n\n¿Desea guardar de todos modos? (Seleccione OK para Grabar)`);
                                if (!proceed) return;
                                hasConfirmedOverage = true;
                            }
                        } else {
                            return;
                        }
                    }
                }
            }
        }

        await supabase.from("payment_certifications").delete().eq("project_id", projectId);
        const certsToInsert = certs.map(c => {
            const { id, created_at, ...rest } = c;
            return {
                ...rest,
                project_id: projectId,
                wp_up_to: c.wp_up_to || null,
                skip_retention: !!c.skip_retention,
                items: c.items || []
            };
        });
        const { error } = await supabase.from("payment_certifications").insert(certsToInsert);
        if (error && !silent) alert("Error: " + error.message);
        else if (!error) {
            fetchSummary();
            if (!silent) alert("Certificaciones y partidas actualizadas");
            if (onSaved) onSaved();
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


    const [expandedCert, setExpandedCert] = useState<number | null>(null);

    const toggleExpand = (certNum: number) => {
        setExpandedCert(expandedCert === certNum ? null : certNum);
    };

    const handlePrint = async (cert: any) => {
        if (!projectId) return;
        setGenerating(cert.cert_num);
        try {
            const blob = await generateAct117C(projectId, cert.id, cert.cert_num, cert.cert_date);
            downloadBlob(blob, `ACT-117C_Cert_${cert.cert_num}_${numAct}.pdf`);
        } catch (error) {
            console.error(error);
            alert("Error al generar el reporte ACT-117C");
        } finally {
            setGenerating(null);
        }
    };

    const addCertItem = (certIdx: number) => {
        const newList = [...certs];
        if (!newList[certIdx].items) newList[certIdx].items = [];
        newList[certIdx].items.push({
            item_num: "",
            specification: "",
            description: "",
            unit: "",
            quantity: 0,
            unit_price: 0,
            fund_source: FUND_SOURCES[0],
            has_material_on_site: false,
            mos_quantity: 0,
            mos_unit_price: 0,
            mos_invoice_total: 0,
            mos_invoice_num: "",
            mos_provider: "",
            mos_lot_num: "1",
            qty_from_mos: 0,
            skip_retention: false,
        });
        setCerts(newList);
        if (onDirty) onDirty();
    };

    const insertCertItem = (certIdx: number, itemIdx: number) => {
        const newList = [...certs];
        const currentItemNum = parseInt(newList[certIdx].items[itemIdx]?.item_num);
        const nextNum = !isNaN(currentItemNum) ? (currentItemNum + 1).toString().padStart(3, '0') : "";

        newList[certIdx].items.splice(itemIdx + 1, 0, {
            item_num: nextNum,
            specification: "",
            description: "",
            unit: "",
            quantity: 0,
            unit_price: 0,
            fund_source: FUND_SOURCES[0],
            has_material_on_site: false,
            mos_quantity: 0,
            mos_unit_price: 0,
            mos_invoice_total: 0,
            mos_invoice_num: "",
            mos_provider: "",
            mos_lot_num: "1",
            qty_from_mos: 0,
            skip_retention: false,
        });
        setCerts(newList);
        if (onDirty) onDirty();
    };

    const updateCertItem = (certIdx: number, itemIdx: number, field: string, value: any) => {
        const newList = [...certs];
        let finalValue = value;

        // Limit item_num to 3 digits (allow free typing)
        if (field === 'item_num') {
            finalValue = value.toString().replace(/\D/g, '').substring(0, 3);
        }

        // Auto-format specification XXX-XXX
        if (field === 'specification' && /^\d{6}$/.test(value.toString().trim())) {
            const val = value.toString().trim();
            finalValue = val.substring(0, 3) + '-' + val.substring(3);
        }

        // Truncate price fields and qty_from_mos to 4 decimal places
        if (field === 'unit_price' || field === 'mos_unit_price' || field === 'qty_from_mos') {
            const strVal = value.toString();
            if (strVal.includes('.')) {
                const [intPart, decPart] = strVal.split('.');
                finalValue = intPart + '.' + decPart.substring(0, 4);
            }
        }

        newList[certIdx].items[itemIdx][field] = finalValue;

        // Proactive: Default MOS Invoice Total to Work Amount when checking box
        if (field === 'has_material_on_site' && finalValue === true) {
            const it = newList[certIdx].items[itemIdx];
            if (!it.mos_invoice_total) {
                const workAmount = (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0);
                if (workAmount > 0) {
                    newList[certIdx].items[itemIdx].mos_invoice_total = workAmount.toFixed(2);
                    // Also try to set MOS quantity = WP quantity as default
                    if (!it.mos_quantity) newList[certIdx].items[itemIdx].mos_quantity = it.quantity;
                    if (!it.mos_lot_num) newList[certIdx].items[itemIdx].mos_lot_num = "1";
                    // Trigger calculation of unit price
                    const total = workAmount;
                    const qty = parseFloat(it.quantity) || 0;
                    if (qty > 0) {
                        const rawPrice = (total / qty).toString();
                        newList[certIdx].items[itemIdx].mos_unit_price = rawPrice.includes('.') ? rawPrice.split('.')[0] + '.' + rawPrice.split('.')[1].substring(0, 4) : rawPrice;
                    }
                }
            }
        }

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

        // Autofill logic for item_num or specification from Contract Items (Section 4)
        if (field === 'item_num' || field === 'specification') {
            const searchValue = finalValue.toString().trim();
            const match = contractItems.find(it =>
                (field === 'item_num' && it.item_num === searchValue) ||
                (field === 'specification' && it.specification === searchValue)
            );

            if (match) {
                newList[certIdx].items[itemIdx]['specification'] = match.specification;
                newList[certIdx].items[itemIdx]['description'] = [match.description, match.additional_description].filter(Boolean).join(' - ');
                newList[certIdx].items[itemIdx]['unit'] = match.unit;
                newList[certIdx].items[itemIdx]['unit_price'] = match.unit_price ? parseFloat(match.unit_price.toString().split('.')[0] + '.' + (match.unit_price.toString().split('.')[1] || '').substring(0, 4)) : 0;
                newList[certIdx].items[itemIdx]['fund_source'] = match.fund_source;
            }
        }

        // Autofill logic for specification (global catalog fallback)
        if (field === 'specification') {
            const specInfo = specs[finalValue.toString().trim()];
            if (specInfo && !newList[certIdx].items[itemIdx]['unit_price']) {
                newList[certIdx].items[itemIdx]['description'] = specInfo.description;
                newList[certIdx].items[itemIdx]['unit'] = specInfo.unit;
            }
        }

        setCerts(newList);
        if (onDirty) onDirty();
    };

    const removeCertItem = (certIdx: number, itemIdx: number) => {
        const newList = [...certs];
        const newItems = (newList[certIdx].items || []).filter((_: any, i: number) => i !== itemIdx);
        newList[certIdx] = { ...newList[certIdx], items: newItems };
        setCerts(newList);
        if (onDirty) onDirty();
    };

    const importContractItems = (certIdx: number) => {
        const newList = [...certs];
        if (!newList[certIdx].items) newList[certIdx].items = [];

        const itemsToImport = contractItems.map(it => ({
            item_num: it.item_num,
            specification: it.specification,
            description: [it.description, it.additional_description].filter(Boolean).join(' - '),
            unit: it.unit,
            quantity: 0, // In certification, quantity is what's done in this period
            unit_price: it.unit_price ? parseFloat(it.unit_price.toString().split('.')[0] + '.' + (it.unit_price.toString().split('.')[1] || '').substring(0, 4)) : 0,
            fund_source: it.fund_source,
            skip_retention: false
        }));

        newList[certIdx].items = [...newList[certIdx].items, ...itemsToImport];
        setCerts(newList);
        if (onDirty) onDirty();
    };


    // Cálculos financieros memoizados para evitar lentitud al escribir
    const { liveExecuted, liveRetention, liveMOS, livePaid, totalProjectGrossRetention } = React.useMemo(() => {
        let executed = 0;
        let retentionTotal = 0;
        let mosTotal = 0;
        let grossRetention = 0;

        certs.forEach((c, cIdx) => {
            const certItems = Array.isArray(c.items) ? c.items : (c.items?.list || []);
            let certExecuted = 0;
            let certMOSChange = 0;
            let certGrossRetention = 0;

            certItems.forEach((it: any) => {
                const q = parseFloat(it.quantity) || 0;
                const p = parseFloat(it.unit_price) || 0;
                certExecuted += q * p;

                const addedMOS = it.has_material_on_site ? (parseFloat(it.mos_invoice_total) || 0) : 0;
                const mosPU = getInvoicePUFromList(certs, it.item_num, cIdx);
                const deductedMOS = (parseFloat(it.qty_from_mos) || 0) * (mosPU > 0 ? mosPU : p);
                certMOSChange += addedMOS - deductedMOS;

                if (!c.skip_retention && !it.skip_retention) {
                    certGrossRetention += (q * p * 0.05);
                }
            });

            executed += certExecuted;
            mosTotal += certMOSChange;
            grossRetention += certGrossRetention;

            let currentCertRetention = certGrossRetention;
            if (c.show_retention_return && c.retention_return_amount) {
                currentCertRetention -= parseFloat(c.retention_return_amount) || 0;
            }
            retentionTotal += currentCertRetention;
        });

        return {
            liveExecuted: executed,
            liveRetention: retentionTotal,
            liveMOS: mosTotal,
            livePaid: executed - retentionTotal + mosTotal,
            totalProjectGrossRetention: grossRetention
        };
    }, [certs]);

    if (!mounted) return null;

    return (
        <div suppressHydrationWarning className="w-full space-y-6">
            <div className="sticky top-0 z-40 bg-[#F8FAFC]/95 dark:bg-[#020617]/95 backdrop-blur-md pt-6 pb-4 -mx-4 px-4 md:-mx-8 md:px-8 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <FileCheck className="text-primary" />
                    7. Certificaciones de Pago
                </h2>
                <div className="flex gap-2">
                    {/* Los botones ahora son flotantes para mayor accesibilidad */}
                </div>
            </div>

            <FloatingFormActions
                actions={[
                    {
                        label: "Nueva Certificación",
                        icon: <Plus />,
                        onClick: addCert,
                        description: "Crear un nuevo documento de certificación de pago correlativo",
                        variant: 'secondary' as const
                    },
                    {
                        label: loading ? "Guardando..." : "Guardar cambios",
                        icon: <Save />,
                        onClick: () => saveData(false),
                        description: "Sincronizar todas las certificaciones y partidas con los balances del contrato",
                        variant: 'primary' as const,
                        disabled: loading
                    }
                ]}
            />

            {/* Cuadro de Resumen Financiero */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <SummaryItem
                    label="Trabajo Ejecutado (WP)"
                    value={liveExecuted}
                    icon={<DollarSign size={16} />}
                    color="text-emerald-600"
                    bgColor="bg-emerald-50 dark:bg-emerald-900/20"
                />
                <SummaryItem
                    label="Neto Pagado"
                    value={livePaid}
                    icon={<Wallet size={16} />}
                    color="text-primary"
                    bgColor="bg-blue-50 dark:bg-blue-900/20"
                />
                <SummaryItem
                    label="5% Retenido"
                    value={liveRetention}
                    icon={<ShieldAlert size={16} />}
                    color="text-amber-600"
                    bgColor="bg-amber-50 dark:bg-amber-900/20"
                />
                <SummaryItem
                    label="Balance MOS"
                    value={liveMOS}
                    icon={<Package size={16} />}
                    color="text-slate-600"
                    bgColor="bg-slate-100 dark:bg-slate-800"
                />
                <SummaryItem
                    label="Daños Líquidos"
                    value={summary.liquidated}
                    icon={<Timer size={16} />}
                    color="text-red-600"
                    bgColor="bg-red-50 dark:bg-red-900/20"
                />
            </div>

            <div className="space-y-4">
                {certs.map((c, certIdx) => {
                    const totalProjectGrossRetention = certs.reduce((acc, cert) => {
                        let cw = 0;
                        (cert.items || []).forEach((it: any) => {
                            cw += (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0);
                        });
                        return acc + (cert.skip_retention ? 0 : cw * 0.05);
                    }, 0);

                    let certWork = 0;
                    let certMOSNet = 0;
                    (c.items || []).forEach((item: any) => {
                        const q = parseFloat(item.quantity) || 0;
                        const p = parseFloat(item.unit_price) || 0;
                        certWork += q * p;

                        const addedMOS = item.has_material_on_site ? (parseFloat(item.mos_invoice_total) || 0) : 0;
                        const mosPU = getInvoicePUFromList(certs, item.item_num, certIdx);
                        const deductedMOS = (parseFloat(item.qty_from_mos) || 0) * (mosPU > 0 ? mosPU : p);
                        certMOSNet += addedMOS - deductedMOS;
                    });
                    const certRetention = (c.items || []).reduce((acc: number, it: any) => {
                        if (it.skip_retention) return acc;
                        return acc + ((parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0) * 0.05);
                    }, 0) - (c.retention_return_amount || 0);
                    const certNetChange = certWork - (c.skip_retention ? 0 : (certRetention < 0 && !c.show_retention_return ? 0 : certRetention)) + certMOSNet;

                    return (
                        <div key={certIdx} className="card border-none shadow-sm overflow-hidden bg-white dark:bg-slate-900 p-0">
                            {/* Header de la Certificación con Resumen Principal */}
                            <div className="p-4 flex flex-col xl:flex-row justify-between bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800 gap-6">
                                <div className="flex flex-col md:flex-row gap-6 lg:gap-8 flex-1">
                                    {/* Identificadores básicos */}
                                    <div className="flex flex-col gap-4 border-r-0 md:border-r border-slate-200 dark:border-slate-700/50 pr-0 md:pr-6 shrink-0">
                                        <div className="flex items-center gap-6">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Certificación #</label>
                                                <div className="text-2xl font-black text-primary">#{c.cert_num}</div>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Fecha Cert.</label>
                                                <input
                                                    type="date"
                                                    className="input-field text-sm font-bold bg-white dark:bg-slate-900"
                                                    style={{ backgroundColor: '#66FF99' }}
                                                    value={c.cert_date || ""}
                                                    onChange={(e) => updateCert(certIdx, 'cert_date', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest text-[#d97706]">Work Performed up to</label>
                                            <input
                                                type="date"
                                                className="input-field text-sm font-bold border-amber-200 focus:ring-amber-500 w-full bg-white dark:bg-slate-900"
                                                style={{ backgroundColor: '#66FF99' }}
                                                value={c.wp_up_to || ""}
                                                onChange={(e) => updateCert(certIdx, 'wp_up_to', e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    {/* Resumen de Certificación */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Trabajo ejec. (WP)</span>
                                            <span className="text-lg xl:text-xl font-black text-emerald-600 font-geist tracking-tight">{formatCurrency(certWork)}</span>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex flex-col items-start xl:flex-row xl:items-center xl:justify-between gap-1 xl:gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">5% Retenido</span>
                                                    <label className="flex items-center gap-1 cursor-pointer group" title="No retener en esta certificación">
                                                        <input
                                                            type="checkbox"
                                                            className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 w-3 h-3"
                                                            checked={!!c.skip_retention}
                                                            onChange={(e) => updateCert(certIdx, 'skip_retention', e.target.checked)}
                                                        />
                                                        <span className="text-[9px] font-bold text-slate-400 group-hover:text-amber-600 transition-colors">Sin Ret.</span>
                                                    </label>
                                                </div>
                                                <label className="flex items-center gap-1 cursor-pointer group" title="Devolución de retenido">
                                                    <input
                                                        type="checkbox"
                                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
                                                        checked={!!c.show_retention_return}
                                                        onChange={(e) => updateCert(certIdx, 'show_retention_return', e.target.checked)}
                                                    />
                                                    <span className="text-[8px] font-bold text-slate-400 group-hover:text-blue-600 transition-colors">Devolución</span>
                                                </label>
                                            </div>
                                            <div className="flex items-end gap-3 flex-wrap">
                                                <span className={`text-lg xl:text-xl font-black ${c.skip_retention ? 'text-slate-400 line-through' : 'text-amber-600'} font-geist tracking-tight`}>
                                                    {formatCurrency(c.skip_retention ? 0 : certRetention)}
                                                </span>
                                                {c.show_retention_return && (
                                                    <div className="flex items-center gap-2 bg-blue-50/50 dark:bg-blue-900/10 p-1.5 rounded-lg border border-blue-100 dark:border-blue-800/50 w-full mt-1">
                                                        <div className="flex flex-col">
                                                            <label className="text-[8px] font-bold text-blue-500 uppercase">A Devolver</label>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                className="w-full xl:w-20 h-6 text-xs font-bold border-b border-blue-200 focus:border-blue-500 outline-none bg-transparent"
                                                                placeholder="0.00"
                                                                value={c.retention_return_amount || ""}
                                                                onChange={(e) => updateCert(certIdx, 'retention_return_amount', parseFloat(e.target.value) || 0)}
                                                            />
                                                        </div>
                                                        <div className="flex flex-col gap-1 hidden md:flex">
                                                            <label className="text-[8px] font-bold text-slate-400 uppercase text-center">Presets</label>
                                                            <div className="flex gap-1">
                                                                <button
                                                                    onClick={() => updateCert(certIdx, 'retention_return_amount', totalProjectGrossRetention * 0.25)}
                                                                    className="px-1 py-0.5 bg-white border border-blue-200 text-[8px] font-bold text-blue-600 rounded hover:bg-blue-50 transition-colors"
                                                                >
                                                                    25%
                                                                </button>
                                                                <button
                                                                    onClick={() => updateCert(certIdx, 'retention_return_amount', totalProjectGrossRetention * 0.75)}
                                                                    className="px-1 py-0.5 bg-white border border-blue-200 text-[8px] font-bold text-blue-600 rounded hover:bg-blue-50 transition-colors"
                                                                >
                                                                    75%
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ajuste MOS (Neto)</span>
                                            <span className={`text-lg xl:text-xl font-black ${certMOSNet >= 0 ? 'text-blue-600' : 'text-amber-600'} font-geist tracking-tight`}>
                                                {formatCurrency(certMOSNet)}
                                            </span>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block text-primary">Total Pago de este Doc.</span>
                                            <span className="text-lg xl:text-xl font-black text-primary font-geist tracking-tight">{formatCurrency(certNetChange)}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center xl:items-start gap-2 justify-end xl:flex-col shrink-0">
                                    <div className="flex gap-2 mb-2 w-full justify-end">
                                        <button
                                            disabled={generating === c.cert_num}
                                            onClick={() => handlePrint(c)}
                                            className="text-slate-500 hover:text-blue-600 transition-all flex items-center gap-1.5 px-2 py-1 rounded bg-blue-50/50 hover:bg-blue-100 border border-blue-100 dark:bg-blue-900/10 dark:hover:bg-blue-900/20 dark:border-blue-800"
                                            title="Imprimir Formulario ACT-117C"
                                        >
                                            {generating === c.cert_num ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
                                            <span className="text-[10px] font-black uppercase">Imprimir ACT-117C</span>
                                        </button>
                                        <button type="button" onClick={() => removeCert(certIdx)} className="text-slate-300 hover:text-red-500 transition-colors" title="Eliminar certificación">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => toggleExpand(c.cert_num)}
                                        className={`bg-slate-200/50 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors w-full text-center ${expandedCert === c.cert_num ? 'bg-slate-200' : ''}`}
                                    >
                                        {expandedCert === c.cert_num ? "Ocultar Partidas" : "Ver / Añadir Partidas"}
                                    </button>
                                </div>
                            </div>

                            {/* Notas de la Certificación */}
                            <div className="px-4 py-2 bg-amber-50/30 dark:bg-amber-900/5 border-b border-amber-100 dark:border-amber-900/30">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-600">Notas / Observaciones de esta Certificación</span>
                                </div>
                                <textarea
                                    rows={2}
                                    className="w-full text-xs rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none font-medium text-slate-700 dark:text-slate-300 placeholder:text-slate-300"
                                    placeholder="Ej: Se incluye trabajos de drenaje aprobados en CH-04, retención reducida por acuerdo..."
                                    value={c.notes || ""}
                                    onChange={(e) => updateCert(certIdx, 'notes', e.target.value)}
                                />
                            </div>

                            {/* Detalle de Partidas (Acordeón) */}
                            {expandedCert === c.cert_num && (
                                <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2 duration-200">


                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-sm font-bold text-slate-600 flex items-center gap-2">
                                            <Plus size={14} className="text-primary" />
                                            Partidas de esta Certificación
                                        </h4>
                                        <div className="flex gap-4">
                                            <button onClick={() => importContractItems(certIdx)} className="text-xs font-bold text-blue-600 hover:underline">
                                                Importar Partidas Activas
                                            </button>
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200">
                                        <table suppressHydrationWarning className="min-w-[1300px] w-full text-left border-collapse">
                                            <thead className="text-[10px] uppercase font-bold text-slate-400 border-b border-slate-50 dark:border-slate-800">
                                                <tr>
                                                    <th className="py-2 px-1 min-w-[64px] text-center"># Item</th>
                                                    <th className="py-2 px-1 min-w-[96px]">Espec.</th>
                                                    <th className="py-2 px-1 min-w-[200px]">Descripción</th>
                                                    <th className="py-2 px-1 min-w-[64px] text-center">Unit</th>
                                                    <th className="py-2 px-1 min-w-[80px] text-right">Qty WP</th>
                                                    <th className="py-2 px-1 min-w-[80px] text-center text-blue-600" title="Balance disponible para pagar en esta partida">Bal. Qty</th>
                                                    <th className="py-2 px-1 min-w-[80px] text-right text-[#8B4513]">Deduc. MOS</th>
                                                    <th className="py-2 px-1 min-w-[100px] text-right">Unit Price</th>
                                                    <th className="py-2 px-1 min-w-[120px] text-right">Amount</th>
                                                    <th className="py-2 px-1 min-w-[110px]">Fondos</th>
                                                    <th className="py-2 px-1 min-w-[48px] text-center" title="Material on Site">MOS</th>
                                                    <th className="py-2 px-1 min-w-[100px] text-right" title="Balance acumulado de Material on Site">MOS Bal.</th>
                                                    <th className="py-2 px-1 min-w-[48px] text-center" title="No aplicar retenido a este item">No Ret.</th>
                                                    <th className="py-2 px-1 min-w-[64px]"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                                {(c.items || []).map((item: any, originalItIdx: number) => ({ item, originalItIdx }))
                                                    .sort((a: any, b: any) => (parseInt(a.item.item_num) || 0) - (parseInt(b.item.item_num) || 0))
                                                    .map(({ item, originalItIdx: itIdx }: { item: any; originalItIdx: number }) => {
                                                    const mosAmount = item.has_material_on_site
                                                        ? (parseFloat(item.mos_quantity) || 0) * (parseFloat(item.mos_unit_price) || 0)
                                                        : 0;
                                                    // 1. Calculate Cumulative MOS Balance BEFORE this item's work is processed
                                                    // We include invoices from previous certs AND this cert's new invoice
                                                    let cumulativeMOSInvoicedAmount = 0;
                                                    let cumulativeMOSUsedAmountBefore = 0;

                                                    certs.slice(0, certIdx + 1).forEach((cert, cIndex) => {
                                                        const certItems = Array.isArray(cert.items) ? cert.items : (cert.items?.list || []);
                                                        (certItems as any[]).forEach(it => {
                                                            if (it.item_num === item.item_num) {
                                                                // All invoices up to current
                                                                cumulativeMOSInvoicedAmount += parseFloat(it.has_material_on_site ? it.mos_invoice_total : 0) || 0;
                                                                // Only usage from PREVIOUS certifications
                                                                if (cIndex < certIdx) {
                                                                    const pr = getInvoicePUFromList(certs, it.item_num, cIndex);
                                                                    cumulativeMOSUsedAmountBefore += (parseFloat(it.qty_from_mos) || 0) * (pr > 0 ? pr : (parseFloat(it.unit_price) || 0));
                                                                }
                                                            }
                                                        });
                                                    });

                                                    const availableMOSBalance = cumulativeMOSInvoicedAmount - cumulativeMOSUsedAmountBefore;
                                                    const mosPUForCalc = getInvoicePUFromList(certs, item.item_num, certIdx);
                                                    const currentDeductionPU = mosPUForCalc > 0 ? mosPUForCalc : (parseFloat(item.unit_price) || 0);

                                                    const availableMOSQty = currentDeductionPU > 0 ? Math.max(0, availableMOSBalance / currentDeductionPU) : 0;
                                                    const workQty = parseFloat(item.quantity) || 0;

                                                    let autoQtyFromMOS = 0;
                                                    if (workQty <= availableMOSQty) {
                                                        autoQtyFromMOS = Math.max(0, workQty);
                                                    } else {
                                                        autoQtyFromMOS = availableMOSQty;
                                                    }

                                                    const finalQtyFromMOS = (item.qty_from_mos !== undefined && item.qty_from_mos !== null && item.qty_from_mos !== "") ? parseFloat(item.qty_from_mos) : autoQtyFromMOS;
                                                    
                                                    item.qty_from_mos = finalQtyFromMOS;

                                                    const workAmount = workQty * (parseFloat(item.unit_price) || 0);
                                                    const autoDeductionAmount = finalQtyFromMOS * currentDeductionPU;
                                                    const itemPayout = workAmount - autoDeductionAmount;

                                                    const totalRevisedQty = getItemTotalRevisedQty(item.item_num);
                                                    let paidInPrevious = 0;
                                                    certs.slice(0, certIdx).forEach(prevCert => {
                                                        const prevItems = prevCert.items || [];
                                                        const match = prevItems.find((p: any) => p.item_num === item.item_num);
                                                        if (match) paidInPrevious += parseFloat(match.quantity) || 0;
                                                    });
                                                    const availableBalance = totalRevisedQty - paidInPrevious;
                                                    const isExceeded = (parseFloat(item.quantity) || 0) > (availableBalance + 0.0001);

                                                    // --- Logic for Certificado de Manufactura (CM) ---
                                                    const baseItemMatch = contractItems.find(it => it.item_num === item.item_num);
                                                    const requiresMfgCert = baseItemMatch?.requires_mfg_cert;
                                                    let totalApprovedMfg = 0;
                                                    if (requiresMfgCert) {
                                                        totalApprovedMfg = mfgCerts
                                                            .filter(mc => mc.item_id === baseItemMatch.id)
                                                            .reduce((acc, mc) => acc + (parseFloat(mc.quantity) || 0), 0);
                                                    }
                                                    const mfgCertBalance = requiresMfgCert ? (totalApprovedMfg - paidInPrevious) : null;
                                                    const isMfgExceeded = requiresMfgCert && (parseFloat(item.quantity) || 0) > (mfgCertBalance! + 0.0001);
                                                    // ------------------------------------------------



                                                    return (
                                                        <React.Fragment key={itIdx}>
                                                            <tr key={`item-${itIdx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                                                                <td className="py-1 px-1">
                                                                    <input
                                                                        type="text"
                                                                        maxLength={20}
                                                                        className="input-field text-xs text-center p-1 h-7"
                                                                        style={{ backgroundColor: '#66FF99' }}
                                                                        value={item.item_num || ""}
                                                                        onChange={(e) => updateCertItem(certIdx, itIdx, 'item_num', e.target.value)}
                                                                        onBlur={(e) => {
                                                                            const val = e.target.value;
                                                                            if (val !== "" && !isNaN(parseInt(val))) {
                                                                                updateCertItem(certIdx, itIdx, 'item_num', val.padStart(3, '0'));
                                                                            }
                                                                        }}
                                                                    />
                                                                </td>
                                                                <td className="py-1 px-1">
                                                                    <input type="text" className="input-field text-xs p-1 h-7 font-bold" value={item.specification || ""} onChange={(e) => updateCertItem(certIdx, itIdx, 'specification', e.target.value)} />
                                                                </td>
                                                                <td className="py-1 px-1">
                                                                    <input type="text" className="input-field text-[10px] p-1 h-7" value={item.description || ""} title={item.description} onChange={(e) => updateCertItem(certIdx, itIdx, 'description', e.target.value)} />
                                                                </td>
                                                                <td className="py-1 px-1 w-20">
                                                                    <input type="text" className="input-field text-xs p-1 h-7 text-center" value={item.unit || ""} onChange={(e) => updateCertItem(certIdx, itIdx, 'unit', e.target.value)} />
                                                                </td>
                                                                <td className="py-1 px-1">
                                                                    <input
                                                                        type="text"
                                                                        className={`input-field text-xs text-right p-1 h-7 font-bold ${isExceeded || isMfgExceeded ? 'bg-red-50 border-red-500 text-red-600' : 'text-emerald-600'}`}
                                                                        style={{ backgroundColor: '#66FF99' }}
                                                                        value={item.quantity ?? ""}
                                                                        onChange={(e) => updateCertItem(certIdx, itIdx, 'quantity', e.target.value)}
                                                                    />
                                                                    {isMfgExceeded && (
                                                                        <div className="text-[7px] font-black text-red-600 mt-0.5 leading-none uppercase text-center">No hay CM suficientes</div>
                                                                    )}
                                                                </td>
                                                                <td className="py-1 px-1 text-center">
                                                                    <span className={`text-[10px] font-bold ${isExceeded || isMfgExceeded ? 'text-red-500 underline' : 'text-blue-600'}`}>
                                                                        {formatNumber(availableBalance)}
                                                                    </span>
                                                                    {requiresMfgCert && (
                                                                        <div className={`text-[8px] font-black ${isMfgExceeded ? 'text-red-600' : 'text-slate-400'} mt-0.5`} title="Balance de Certificado de Manufactura">
                                                                            CM: {formatNumber(mfgCertBalance)}
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td className="py-1 px-1">
                                                                    <input
                                                                        type="text"
                                                                        className="input-field text-xs text-right p-1 h-7 bg-white border-slate-200 text-[#8B4513] font-bold"
                                                                        title="Deducción de Material on Site (Sugestión automática aplicada si está vacío)"
                                                                        value={item.qty_from_mos ?? ""}
                                                                        onChange={(e) => updateCertItem(certIdx, itIdx, 'qty_from_mos', e.target.value)}
                                                                    />
                                                                </td>
                                                                <td className="py-1 px-1">
                                                                    <input
                                                                        type="number"
                                                                        step="0.0001"
                                                                        className="input-field text-xs text-right p-1 h-7 font-geist"
                                                                        value={isNaN(parseFloat(item.unit_price)) ? "" : (item.unit_price ?? "")}
                                                                        onChange={(e) => updateCertItem(certIdx, itIdx, 'unit_price', e.target.value)}
                                                                    />
                                                                </td>
                                                                <td className="py-1 px-2 text-right space-y-0.5">
                                                                    <div className="text-xs font-black text-slate-700">{formatCurrency(workAmount)}</div>
                                                                    {itemPayout < workAmount && (
                                                                        <div className="text-[9px] font-bold text-primary px-1 bg-primary/5 rounded border border-primary/10 inline-block">
                                                                            A Pagar: {formatCurrency(itemPayout)}
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td className="py-1 px-1">
                                                                    <select
                                                                        className="input-field text-[9px] font-bold py-1 px-1"
                                                                        value={item.fund_source || ""}
                                                                        onChange={(e) => updateCertItem(certIdx, itIdx, 'fund_source', e.target.value)}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Tab' && !e.shiftKey && itIdx === c.items.length - 1) {
                                                                                addCertItem(certIdx);
                                                                            }
                                                                        }}
                                                                    >
                                                                        {FUND_SOURCES.map(f => <option key={f} value={f}>{f}</option>)}
                                                                    </select>
                                                                </td>
                                                                {/* Checkbox MOS */}
                                                                <td className="py-1 px-1 text-center">
                                                                    <label
                                                                        title="Material on Site"
                                                                        className={`inline-flex items-center justify-center w-5 h-5 rounded cursor-pointer border-2 transition-all ${item.has_material_on_site
                                                                            ? 'bg-amber-500 border-amber-500 text-white'
                                                                            : 'border-slate-300 hover:border-amber-400'
                                                                            }`}
                                                                        style={{ backgroundColor: item.has_material_on_site ? undefined : '#66FF99' }}
                                                                    >
                                                                        <input
                                                                            type="checkbox"
                                                                            className="sr-only"
                                                                            checked={!!item.has_material_on_site}
                                                                            onChange={(e) => updateCertItem(certIdx, itIdx, 'has_material_on_site', e.target.checked)}
                                                                        />
                                                                        {item.has_material_on_site && (
                                                                            <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                                                <polyline points="1.5,6 4.5,9 10.5,3" />
                                                                            </svg>
                                                                        )}
                                                                    </label>
                                                                </td>
                                                                {/* MOS Balance Column */}
                                                                <td className="py-1 px-1 text-right">
                                                                    <span className={`text-[10px] font-bold ${(availableMOSBalance - autoDeductionAmount) < 0 ? 'text-red-500' : 'text-amber-600'}`}>
                                                                        {formatCurrency(availableMOSBalance - autoDeductionAmount)}
                                                                    </span>
                                                                </td>
                                                                {/* Checkbox No Retención */}
                                                                <td className="py-1 px-1 text-center">
                                                                    <label
                                                                        title="No aplicar retenido a este item"
                                                                        className={`inline-flex items-center justify-center w-5 h-5 rounded cursor-pointer border-2 transition-all ${item.skip_retention
                                                                            ? 'bg-red-500 border-red-500 text-white'
                                                                            : 'border-slate-300 hover:border-red-400'
                                                                            }`}
                                                                        style={{ backgroundColor: item.skip_retention ? undefined : '#66FF99' }}
                                                                    >
                                                                        <input
                                                                            type="checkbox"
                                                                            className="sr-only"
                                                                            checked={!!item.skip_retention}
                                                                            onChange={(e) => updateCertItem(certIdx, itIdx, 'skip_retention', e.target.checked)}
                                                                        />
                                                                        {item.skip_retention && (
                                                                            <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                                                <path d="M2,2 L10,10 M10,2 L2,10" />
                                                                            </svg>
                                                                        )}
                                                                    </label>
                                                                </td>
                                                                <td className="py-1 px-1 text-center">
                                                                    <div className="flex flex-col gap-1.5 items-center">
                                                                        <button type="button" onClick={() => insertCertItem(certIdx, itIdx)} className="bg-emerald-100 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all rounded-full p-1 shadow-sm transform hover:scale-110" title="Insertar item debajo">
                                                                            <PlusSquare size={12} strokeWidth={2.5} />
                                                                        </button>
                                                                        <button type="button" onClick={() => removeCertItem(certIdx, itIdx)} className="text-slate-300 hover:text-red-500" title="Eliminar partida de la certificación">
                                                                            <Trash2 size={12} />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                            {/* Fila MOS expandida */}
                                                            {item.has_material_on_site && (
                                                                <tr key={`mos-${itIdx}`} className="bg-amber-50/60 dark:bg-amber-900/10 border-l-2 border-amber-400">
                                                                    <td colSpan={2} className="py-1 px-2">
                                                                        <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Material on Site</span>
                                                                    </td>
                                                                    <td className="py-1 px-1" colSpan={3}>
                                                                        <span className="text-[10px] text-amber-500 font-bold">Proveedor</span>
                                                                        <input
                                                                            type="text"
                                                                            className="input-field text-xs p-1 h-7 border-amber-200 focus:ring-amber-400 font-bold"
                                                                            style={{ backgroundColor: '#66FF99' }}
                                                                            placeholder="Nombre del Proveedor"
                                                                            value={item.mos_provider ?? ""}
                                                                            onChange={(e) => updateCertItem(certIdx, itIdx, 'mos_provider', e.target.value)}
                                                                        />
                                                                    </td>
                                                                    <td className="py-1 px-1" colSpan={1}>
                                                                        <span className="text-[10px] text-amber-500 font-bold">N° Factura</span>
                                                                        <input
                                                                            type="text"
                                                                            className="input-field text-xs p-1 h-7 border-amber-200 focus:ring-amber-400 font-bold"
                                                                            style={{ backgroundColor: '#66FF99' }}
                                                                            placeholder="Factura"
                                                                            value={item.mos_invoice_num ?? ""}
                                                                            onChange={(e) => updateCertItem(certIdx, itIdx, 'mos_invoice_num', e.target.value)}
                                                                        />
                                                                    </td>
                                                                    <td className="py-1 px-1" colSpan={1}>
                                                                        <span className="text-[10px] text-amber-500 font-bold">Lote</span>
                                                                        <input
                                                                            type="text"
                                                                            className="input-field text-xs text-center p-1 h-7 border-amber-200 focus:ring-amber-400 font-bold"
                                                                            style={{ backgroundColor: '#66FF99' }}
                                                                            placeholder="1"
                                                                            value={item.mos_lot_num ?? "1"}
                                                                            onChange={(e) => updateCertItem(certIdx, itIdx, 'mos_lot_num', e.target.value)}
                                                                        />
                                                                    </td>
                                                                    <td className="py-1 px-1" colSpan={2}>
                                                                        <span className="text-[10px] text-amber-500 font-bold">Total Factura</span>
                                                                        <div className="relative">
                                                                            <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] text-amber-600 font-bold">$</span>
                                                                            <input
                                                                                type="number"
                                                                                step="0.01"
                                                                                className="input-field text-xs text-right p-1 pl-4 h-7 border-amber-200 focus:ring-amber-400 font-geist"
                                                                                style={{ backgroundColor: '#66FF99' }}
                                                                                placeholder="0.00"
                                                                                value={item.mos_invoice_total ?? ""}
                                                                                onChange={(e) => updateCertItem(certIdx, itIdx, 'mos_invoice_total', e.target.value)}
                                                                            />
                                                                        </div>
                                                                    </td>
                                                                    <td className="py-1 px-1" colSpan={2}>
                                                                        <span className="text-[10px] text-amber-500 font-bold">Cantidad en Factura</span>
                                                                        <input
                                                                            type="number"
                                                                            step="0.01"
                                                                            className="input-field text-xs text-right p-1 h-7 border-amber-200 focus:ring-amber-400"
                                                                            style={{ backgroundColor: '#66FF99' }}
                                                                            placeholder="Cantidad"
                                                                            value={item.mos_quantity ?? ""}
                                                                            onChange={(e) => updateCertItem(certIdx, itIdx, 'mos_quantity', e.target.value)}
                                                                        />
                                                                    </td>
                                                                    <td className="py-1 px-1" colSpan={2}>
                                                                        <span className="text-[10px] text-amber-500 font-bold">Precio Unitario Factura</span>
                                                                        <input
                                                                            type="number"
                                                                            step="0.0001"
                                                                            className="input-field text-xs text-right p-1 h-7 border-amber-200 focus:ring-amber-400 font-geist"
                                                                            placeholder="0.0000"
                                                                            value={item.mos_unit_price ?? ""}
                                                                            onChange={(e) => updateCertItem(certIdx, itIdx, 'mos_unit_price', e.target.value)}
                                                                        />
                                                                    </td>
                                                                    <td colSpan={1} />
                                                                </tr>
                                                            )}
                                                        </React.Fragment>
                                                    );
                                                })}
                                                {(c.items || []).length === 0 && (
                                                    <tr>
                                                        <td colSpan={11} className="py-8 text-center text-xs text-slate-400 font-medium italic">
                                                            No hay partidas añadidas a esta certificación. Haz clic en "Añadir Item Manual" o importa.
                                                        </td>
                                                    </tr>
                                                )}
                                                <tr>
                                                    <td colSpan={11} className="py-2 px-1 border-t border-slate-100 dark:border-slate-800">
                                                        <button onClick={() => addCertItem(certIdx)} className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                                                            <Plus size={14} /> Añadir Item Manual
                                                        </button>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
});

export default PaymentCertForm;

function SummaryItem({ label, value, icon, color, bgColor }: { label: string, value: number, icon: React.ReactNode, color: string, bgColor: string }) {
    return (
        <div className={`${bgColor} rounded-xl p-3 border border-slate-100 dark:border-slate-800 flex items-start gap-3`}>
            <div className={`${color} p-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm`}>
                {icon}
            </div>
            <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</div>
                <div className={`text-sm font-black ${value < 0 ? 'text-red-500' : color}`}>
                    {formatCurrency(value)}
                </div>
            </div>
        </div>
    );
}
