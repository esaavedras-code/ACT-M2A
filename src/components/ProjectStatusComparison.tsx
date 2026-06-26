"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Upload, FileText, Download, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { formatCurrency, roundedAmt } from "@/lib/utils";
import { ComparisonResult, generatePSComparisonExcel } from "@/lib/exportPSComparison";

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
                const amt = roundedAmt((parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 2);
                pactItemsMap[it.item_num] = {
                    itemNum: it.item_num,
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
                        const amt = roundedAmt((parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 2);
                        if (pactItemsMap[it.item_num]) {
                            pactItemsMap[it.item_num].qty += parseFloat(it.quantity) || 0;
                            pactItemsMap[it.item_num].amount = roundedAmt(pactItemsMap[it.item_num].amount + amt, 2);
                        } else {
                            pactItemsMap[it.item_num] = {
                                itemNum: it.item_num,
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
            let totalRetentionDeducted = 0;
            let totalRetentionReturned = 0;

            certs?.forEach(cert => {
                let certAmount = 0;
                const cItems = Array.isArray(cert.items) ? cert.items : (cert.items?.list || []);

                cItems.forEach((it: any) => {
                    const qty = parseFloat(it.quantity) || 0;
                    const up = parseFloat(it.unit_price) || 0;
                    const amt = roundedAmt(qty * up, 2);
                    certAmount = roundedAmt(certAmount + amt, 2);

                    // Retención del 5% por item (solo si no está marcado skip)
                    if (!cert.skip_retention && !it.skip_retention) {
                        totalRetentionDeducted = roundedAmt(totalRetentionDeducted + roundedAmt(amt * 0.05, 2), 2);
                    }

                    // Acumular por item para comparación partida por partida
                    if (pactItemsMap[it.item_num]) {
                        pactItemsMap[it.item_num].certQty += qty;
                        pactItemsMap[it.item_num].certAmnt = roundedAmt(pactItemsMap[it.item_num].certAmnt + amt, 2);
                    }
                });

                certified = roundedAmt(certified + certAmount, 2);

                // Retención devuelta
                if (cert.show_retention_return && cert.retention_return_amount) {
                    totalRetentionReturned = roundedAmt(totalRetentionReturned + (parseFloat(cert.retention_return_amount) || 0), 2);
                }

                if ((cert.cert_num || 0) > lastCertNum) {
                    lastCertNum = cert.cert_num;
                    lastCertAmount = certAmount;
                }
            });

            const remaining = roundedAmt(revised - certified, 2);
            const totalRetention = roundedAmt(totalRetentionDeducted - totalRetentionReturned, 2);
            // Net Paid = Certified - Retención neta (igual que Dashboard: certified - retention total)
            const netPaid = roundedAmt(certified - totalRetention, 2);

            // Compute remaining per item
            Object.values(pactItemsMap).forEach(it => {
                it.remQty = roundedAmt(it.qty - it.certQty, 4);
                it.remAmnt = roundedAmt(it.amount - it.certAmnt, 2);
            });

            setPactData({
                original,
                revised,
                certified,
                remaining,
                lastCertified: lastCertAmount,
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
        const THRESHOLD = 0.05; // 5 cents tolerance

        const checkMatch = (val1: number, val2: number) => Math.abs((val1 || 0) - (val2 || 0)) <= THRESHOLD;

        // Globals
        const globals = [
            { name: "Amount Original", ps: psData.globals.original, pact: pactData.original, psName: "Amount Original", pactName: "Costo Original" },
            { name: "Amount Revisado", ps: psData.globals.revised, pact: pactData.revised, psName: "Amount Revisado", pactName: "Costo Ajustado" },
            { name: "Amount Certificado", ps: psData.globals.certified, pact: pactData.certified, psName: "Amount Certificado", pactName: "Certified to date (WP)" },
            { name: "Amount Remaining", ps: psData.globals.remaining, pact: pactData.remaining, psName: "Amount Remaining", pactName: "Balance actual (remaining)" },
            { name: "Última Certificación", ps: psData.globals.lastCertified, pact: pactData.lastCertified, psName: "Last Certified", pactName: "Última Certificación" },
            { name: "Net Paid", ps: psData.globals.netPaid, pact: pactData.netPaid, psName: "Other Net Paid", pactName: "Net Paid" },
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
                diff: roundedAmt((g.ps || 0) - (g.pact || 0), 2),
                isEqual: checkMatch(g.ps, g.pact)
            });
        });

        // Items
        if (psData.items && Array.isArray(psData.items)) {
            psData.items.forEach((psItem: any) => {
                const pItem = pactData.items[psItem.itemNum];
                if (pItem) {
                    const desc = pItem.description ? ` - ${pItem.description}` : '';
                    comp.push({
                        category: `Partida ${psItem.itemNum}${desc}`,
                        metric: "Amount Certificado",
                        psName: "Certified Amnt",
                        pactName: "Importe Certificado",
                        psValue: psItem.certAmnt,
                        pactValue: pItem.certAmnt,
                        diff: roundedAmt(psItem.certAmnt - pItem.certAmnt, 2),
                        isEqual: checkMatch(psItem.certAmnt, pItem.certAmnt)
                    });
                    comp.push({
                        category: `Partida ${psItem.itemNum}${desc}`,
                        metric: "Cantidad certificada",
                        psName: "Certified QTY",
                        pactName: "Cantidad Certificada",
                        psValue: psItem.certQty,
                        pactValue: pItem.certQty,
                        diff: roundedAmt(psItem.certQty - pItem.certQty, 4),
                        isEqual: checkMatch(psItem.certQty, pItem.certQty)
                    });
                    comp.push({
                        category: `Partida ${psItem.itemNum}${desc}`,
                        metric: "Amount remanente",
                        psName: "Rem. Amount",
                        pactName: "Saldo Monto",
                        psValue: psItem.remAmnt,
                        pactValue: pItem.remAmnt,
                        diff: roundedAmt(psItem.remAmnt - pItem.remAmnt, 2),
                        isEqual: checkMatch(psItem.remAmnt, pItem.remAmnt)
                    });
                    comp.push({
                        category: `Partida ${psItem.itemNum}${desc}`,
                        metric: "Cantidad Remaining",
                        psName: "Rem QTY",
                        pactName: "Saldo Qty",
                        psValue: psItem.remQty,
                        pactValue: pItem.remQty,
                        diff: roundedAmt(psItem.remQty - pItem.remQty, 4),
                        isEqual: checkMatch(psItem.remQty, pItem.remQty)
                    });
                } else {
                    comp.push({
                        category: `Partida ${psItem.itemNum}`,
                        metric: "No encontrada en PACT",
                        psName: "N/A",
                        pactName: "N/A",
                        psValue: psItem.amount,
                        pactValue: 0,
                        diff: psItem.amount,
                        isEqual: false
                    });
                }
            });
        }

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
                            {results.map((r, i) => (
                                <tr key={i} className={`border-b dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 ${!r.isEqual ? 'bg-red-50/30 dark:bg-red-900/10' : ''}`}>
                                    <td className="px-4 py-2 font-medium">{r.category}</td>
                                    <td className="px-4 py-2">{r.metric}</td>
                                    <td className="px-4 py-2 text-right">{formatCurrency(r.psValue)}</td>
                                    <td className="px-4 py-2 text-right">{formatCurrency(r.pactValue)}</td>
                                    <td className={`px-4 py-2 text-right font-semibold ${!r.isEqual ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                        {formatCurrency(r.diff)}
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                        {r.isEqual ? (
                                            <span className="inline-block px-2 py-1 text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full font-medium">Igual</span>
                                        ) : (
                                            <span className="inline-block px-2 py-1 text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded-full font-medium">Diferente</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
