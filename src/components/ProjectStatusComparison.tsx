"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Upload, FileText, Download, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { formatCurrency, roundedAmt } from "@/lib/utils";
import { ComparisonResult, generatePSComparisonExcel } from "@/lib/exportPSComparison";

const normalizeItemNum = (num: string | number): string => {
    const raw = String(num).trim();
    return /^\d+$/.test(raw) ? String(parseInt(raw, 10)).padStart(3, '0') : raw;
};

interface ProjectStatusComparisonProps {
    projectId: string;
    numAct?: string;
    projectName?: string;
}

export default function ProjectStatusComparison({ projectId, numAct, projectName }: ProjectStatusComparisonProps) {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [parsingError, setParsingError] = useState("");
    const [results, setResults] = useState<ComparisonResult[] | null>(null);
    const [pactData, setPactData] = useState<any>(null);

    // Fetch PACT data on mount
    useEffect(() => {
        if (projectId) fetchPactData();
    }, [projectId]);

    const fetchPactData = async () => {
        try {
            const { data: proj } = await supabase.from("projects").select("*").eq("id", projectId).single();
            const { data: items } = await supabase.from("contract_items").select("*").eq("project_id", projectId);
            const { data: chos } = await supabase.from("chos").select("*").eq("project_id", projectId);
            const { data: certs } = await supabase.from("payment_certifications").select("*").eq("project_id", projectId).order("cert_num", { ascending: true });

            // ─── Costo Original: igual que SummaryDashboard ───
            const original = proj?.cost_original
                || (items?.reduce((acc: number, it: any) => roundedAmt(acc + roundedAmt((parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 2), 2) ?? 0)
                || 0);

            const pactItemsMap: Record<string, any> = {};
            items?.forEach(it => {
                const normKey = normalizeItemNum(it.item_num);
                const amt = roundedAmt((parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 2);
                pactItemsMap[normKey] = {
                    itemNum: normKey,
                    description: it.description,
                    originalQty: parseFloat(it.quantity) || 0,
                    qty: parseFloat(it.quantity) || 0,
                    unitPrice: parseFloat(it.unit_price) || 0,
                    amount: amt,
                    certQty: 0,
                    certAmnt: 0
                };
            });

            // ─── Costo Revisado = Original + suma de proposed_change de CHOs aprobados (igual que Dashboard) ───
            const approvedCHOs = chos?.filter(c => c.doc_status === 'Aprobado') || [];
            const approvedCHOTotal = approvedCHOs.reduce((acc: number, c: any) => roundedAmt(acc + parseFloat(c.proposed_change || '0'), 2), 0);
            const revised = roundedAmt(original + approvedCHOTotal, 2);
            // ─── Actualizar pactItemsMap con qty ajustada por CHOs aprobados ───
            approvedCHOs.forEach(cho => {
                if (Array.isArray(cho.items)) {
                    cho.items.forEach((it: any) => {
                        const normKey = normalizeItemNum(it.item_num);
                        const amt = roundedAmt((parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 2);
                        if (pactItemsMap[normKey]) {
                            pactItemsMap[normKey].qty += parseFloat(it.quantity) || 0;
                            pactItemsMap[normKey].amount = roundedAmt(pactItemsMap[normKey].amount + amt, 2);
                        } else {
                            pactItemsMap[normKey] = {
                                itemNum: normKey,
                                description: it.description,
                                qty: parseFloat(it.quantity) || 0,
                                unitPrice: parseFloat(it.unit_price) || 0,
                                amount: amt,
                                certQty: 0,
                                certAmnt: 0
                            };
                        }
                    });
                }
            });

            // ─── Certificaciones: igual que SummaryDashboard ───
            let certified = 0;
            let lastCertAmount = 0;
            let lastCertNum = 0;
            let lastRetention = 0;
            let totalRetentionDeducted = 0;
            let totalRetentionReturned = 0;

            certs?.forEach(cert => {
                if (cert.excluded) return;
                let certAmount = 0;
                let certRetention = 0;
                const cItems = Array.isArray(cert.items) ? cert.items : (cert.items?.list || []);

                cItems.forEach((it: any) => {
                    const qty = parseFloat(it.quantity) || 0;
                    const up = parseFloat(it.unit_price) || 0;
                    const amt = roundedAmt(qty * up, 2);
                    certAmount = roundedAmt(certAmount + amt, 2);

                    // Retención del 5% por item (solo si no está marcado skip)
                    if (!cert.skip_retention && !it.skip_retention) {
                        const itemRet = roundedAmt(amt * 0.05, 2);
                        totalRetentionDeducted = roundedAmt(totalRetentionDeducted + itemRet, 2);
                        certRetention = roundedAmt(certRetention + itemRet, 2);
                    }

                    // Acumular por item para comparación partida por partida
                    const normKey = normalizeItemNum(it.item_num);
                    if (pactItemsMap[normKey]) {
                        pactItemsMap[normKey].certQty += qty;
                        pactItemsMap[normKey].certAmnt = roundedAmt(pactItemsMap[normKey].certAmnt + amt, 2);
                    }
                });

                certified = roundedAmt(certified + certAmount, 2);

                // Retención devuelta
                if (cert.show_retention_return && cert.retention_return_amount) {
                    totalRetentionReturned = roundedAmt(totalRetentionReturned + (parseFloat(cert.retention_return_amount) || 0), 2);
                }

                // Guardar retención de la última certificación
                if ((cert.cert_num || 0) > lastCertNum) {
                    lastCertNum = cert.cert_num;
                    lastCertAmount = certAmount;
                    lastRetention = certRetention;
                }
            });

            const remaining = roundedAmt(revised - certified, 2);
            const totalRetention = roundedAmt(totalRetentionDeducted - totalRetentionReturned, 2);
            // Net Paid = Certified - Retención neta (igual que Dashboard: certified - retention total)
            const netPaid = roundedAmt(certified - totalRetention, 2);

            // Compute remaining per item (sin redondear para cumplir con: "No redondees números")
            Object.values(pactItemsMap).forEach(it => {
                it.remQty = it.qty - it.certQty;
                it.remAmnt = it.amount - it.certAmnt;
            });

            setPactData({
                original,
                revised,
                certified,
                remaining,
                lastCertified: lastCertAmount,
                lastRetention,
                netPaid,
                retentionTD: totalRetention,
                items: pactItemsMap
            });

        } catch (err) {
            console.error("Error fetching PACT data", err);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
            setParsingError("");
            setResults(null);
        }
    };

    const processPDF = async () => {
        if (!file || !pactData) return;
        setLoading(true);
        setParsingError("");

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/api/parse-project-status", {
                method: "POST",
                body: formData
            });
            const json = await res.json();
            
            if (!json.success) {
                setParsingError(json.error || "Error al procesar el PDF");
                setLoading(false);
                return;
            }

            const psData = json.data;
            compareData(psData);

        } catch (err: any) {
            setParsingError(err.message || "Error desconocido");
        } finally {
            setLoading(false);
        }
    };

    const compareData = (psData: any) => {
        const comp: ComparisonResult[] = [];
        const THRESHOLD = 0.0001; // Tolerancia muy pequeña o diferencia exacta

        const checkMatch = (val1: number, val2: number) => Math.abs((val1 || 0) - (val2 || 0)) < THRESHOLD;

        // Globals
        const globals = [
            { name: "Amount Original", ps: psData.globals.original, pact: pactData.original, psName: "Amount Original", pactName: "Costo Original" },
            { name: "Amount Revisado", ps: psData.globals.revised, pact: pactData.revised, psName: "Amount Revisado", pactName: "Costo Ajustado" },
            { name: "Amount Certified", ps: psData.globals.certified, pact: pactData.certified, psName: "Amount Certified", pactName: "Certified to date (WP)" },
            { name: "Amount Remaining", ps: psData.globals.remaining, pact: pactData.remaining, psName: "Amount Remaining", pactName: "Balance actual (remaining)" },
            { name: "Última Certificación", ps: psData.globals.lastCertified, pact: pactData.lastCertified, psName: "Last Certified", pactName: "Última Certificación" },
            { name: "Net payment", ps: psData.globals.certified, pact: pactData.netPaid, psName: "Other Net Paid", pactName: "Net Paid" },
            { name: "Última Retención", ps: psData.globals.lastRetention, pact: pactData.lastRetention, psName: "Last Retention", pactName: "Última Retención (última cert)" },
            { name: "Retention TD", ps: psData.globals.retentionTD, pact: pactData.retentionTD, psName: "Retention TD", pactName: "Retention TD" }
        ];

        globals.forEach(g => {
            comp.push({
                category: "Métrica Global",
                metric: g.name,
                psName: g.psName,
                pactName: g.pactName,
                psValue: g.ps || 0,
                pactValue: g.pact || 0,
                diff: (g.ps || 0) - (g.pact || 0), // Sin redondeo
                isEqual: checkMatch(g.ps, g.pact)
            });
        });

        // 1. Consolidar la Lista A (PS) sumando sus valores por partida
        const consolidatedPSItems: Record<string, any> = {};
        if (psData.items && Array.isArray(psData.items)) {
            psData.items.forEach((psItem: any) => {
                const normNum = normalizeItemNum(psItem.itemNum);
                
                if (!consolidatedPSItems[normNum]) {
                    consolidatedPSItems[normNum] = {
                        itemNum: normNum,
                        description: psItem.description || "",
                        certAmnt: 0,
                        certQty: 0,
                        remAmnt: 0,
                        remQty: 0
                    };
                }
                
                consolidatedPSItems[normNum].certAmnt += (psItem.certAmnt || 0);
                consolidatedPSItems[normNum].certQty += (psItem.certQty || 0);
                consolidatedPSItems[normNum].remAmnt += (psItem.remAmnt || 0);
                consolidatedPSItems[normNum].remQty += (psItem.remQty || 0);
                
                if (!consolidatedPSItems[normNum].description && psItem.description) {
                    consolidatedPSItems[normNum].description = psItem.description;
                }
            });
        }

        // 2. Full Outer Join entre consolidatedPSItems y pactData.items
        const allKeys = new Set([
            ...Object.keys(consolidatedPSItems),
            ...Object.keys(pactData.items)
        ]);

        const sortedKeys = Array.from(allKeys).sort((a, b) => {
            const isNumA = /^\d+$/.test(a);
            const isNumB = /^\d+$/.test(b);
            if (isNumA && isNumB) {
                return parseInt(a, 10) - parseInt(b, 10);
            }
            return a.localeCompare(b);
        });

        let partidaIndex = 1;
        sortedKeys.forEach((key) => {
            const psItem = consolidatedPSItems[key];
            const pItem = pactData.items[key];

            let description = "";
            const psExists = !!psItem;
            const pactExists = !!pItem;

            if (pItem) {
                description = pItem.description;
            } else if (psItem) {
                description = psItem.description || "No encontrada en PACT";
            }

            const formattedIndex = String(partidaIndex).padStart(3, '0');
            
            // Identificar partidas que no existen en una de las listas
            let warningSuffix = "";
            if (!psExists) {
                warningSuffix = " (No existe en PS)";
            } else if (!pactExists) {
                warningSuffix = " (No existe en PACT)";
            }

            const categoryName = `Partida ${formattedIndex} - ${key}${description ? ' - ' + description : ''}${warningSuffix}`;
            partidaIndex++;

            const psValues = psItem || { certAmnt: 0, certQty: 0, remAmnt: 0, remQty: 0 };
            const pactValues = pItem || { certAmnt: 0, certQty: 0, remQty: 0, remAmnt: 0 };

            const fields = [
                { metric: "Amount Certified", psVal: psValues.certAmnt, pactVal: pactValues.certAmnt, psName: "Certified Amnt", pactName: "Importe Certificado" },
                { metric: "Quantity Certified", psVal: psValues.certQty, pactVal: pactValues.certQty, psName: "Certified QTY", pactName: "Cantidad Certificada" },
                { metric: "Amount Remaining", psVal: psValues.remAmnt, pactVal: pactValues.remAmnt, psName: "Rem. Amount", pactName: "Saldo Monto" },
                { metric: "Quantity Remaining", psVal: psValues.remQty, pactVal: pactValues.remQty, psName: "Rem QTY", pactName: "Saldo Qty" }
            ];

            fields.forEach(f => {
                const diff = (f.psVal || 0) - (f.pactVal || 0); // Sin redondeo
                comp.push({
                    category: categoryName,
                    metric: f.metric,
                    psName: f.psName,
                    pactName: f.pactName,
                    psValue: f.psVal || 0,
                    pactValue: f.pactVal || 0,
                    diff: diff,
                    isEqual: checkMatch(f.psVal, f.pactVal)
                });
            });
        });

        setResults(comp);
    };

    const handleExport = () => {
        if (!results) return;
        generatePSComparisonExcel(results, projectName || numAct || "Desconocido");
    };

    return (
        <div className="p-6 bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800">
            <h2 className="text-xl font-bold mb-4 flex items-center text-gray-800 dark:text-gray-100">
                <FileText className="mr-2 text-blue-600" size={24} />
                Comparación con Project Status
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Sube el archivo PDF del Project Status para cruzar la información automáticamente con los datos registrados en PACT.
            </p>

            <div className="flex flex-col md:flex-row gap-4 mb-8">
                <label className="flex flex-col items-center justify-center w-full md:w-1/2 h-32 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 transition">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-8 h-8 text-gray-500 dark:text-gray-400 mb-2" />
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {file ? <span className="font-semibold text-blue-600 dark:text-blue-400">{file.name}</span> : <span>Haz clic para seleccionar el PDF</span>}
                        </p>
                    </div>
                    <input type="file" className="hidden" accept=".pdf" onChange={handleFileChange} />
                </label>
                
                <div className="flex flex-col justify-center gap-3">
                    <button 
                        onClick={processPDF} 
                        disabled={!file || loading || !pactData}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded shadow disabled:opacity-50 flex items-center justify-center transition"
                    >
                        {loading ? <Loader2 className="animate-spin mr-2" size={18} /> : <CheckCircle className="mr-2" size={18} />}
                        {loading ? "Procesando..." : "Comparar Datos"}
                    </button>
                    {results && (
                        <button 
                            onClick={handleExport}
                            className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-6 rounded shadow flex items-center justify-center transition"
                        >
                            <Download className="mr-2" size={18} />
                            Exportar Excel
                        </button>
                    )}
                </div>
            </div>

            {parsingError && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
                    <div className="flex items-center text-red-700">
                        <AlertTriangle className="mr-2" size={18} />
                        <p>{parsingError}</p>
                    </div>
                </div>
            )}

            {results && (
                <div className="overflow-x-auto">
                    <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">Resultados de la Comparación</h3>
                    <table className="min-w-full text-sm text-left text-gray-600 dark:text-gray-400 border-collapse">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-800 dark:text-gray-300">
                            <tr>
                                <th className="px-4 py-3 border-b dark:border-gray-700">Categoría</th>
                                <th className="px-4 py-3 border-b dark:border-gray-700">Métrica</th>
                                <th className="px-4 py-3 border-b dark:border-gray-700 text-right">Project Status</th>
                                <th className="px-4 py-3 border-b dark:border-gray-700 text-right">PACT</th>
                                <th className="px-4 py-3 border-b dark:border-gray-700 text-right">Diferencia</th>
                                <th className="px-4 py-3 border-b dark:border-gray-700 text-center">Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.map((r, i) => {
                                const isQty = r.metric.toLowerCase().includes("quantity");
                                const formatVal = (val: number) => isQty ? (val || 0).toFixed(4) : formatCurrency(val);
                                return (
                                    <tr key={i} className={`border-b dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 ${!r.isEqual ? 'bg-red-50/30 dark:bg-red-900/10' : ''}`}>
                                        <td className="px-4 py-2 font-medium">{r.category}</td>
                                        <td className="px-4 py-2">{r.metric}</td>
                                        <td className="px-4 py-2 text-right">{formatVal(r.psValue)}</td>
                                        <td className="px-4 py-2 text-right">{formatVal(r.pactValue)}</td>
                                        <td className={`px-4 py-2 text-right font-semibold ${!r.isEqual ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                            {formatVal(r.diff)}
                                        </td>
                                    <td className="px-4 py-2 text-center">
                                        {r.isEqual ? (
                                            <span className="inline-block px-2 py-1 text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full font-medium">Igual</span>
                                        ) : (
                                            <span className="inline-block px-2 py-1 text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded-full font-medium">Diferente</span>
                                        )}
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
