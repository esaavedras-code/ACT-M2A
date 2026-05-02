"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Clock, DollarSign, PieChart, Activity, AlertCircle, Layers, ShieldAlert } from "lucide-react";
import { formatCurrency, roundedAmt, formatDate, formatNumber } from "@/lib/utils";

export default function SummaryDashboard({ projectId, numAct }: { projectId?: string, numAct?: string }) {
    const [metrics, setMetrics] = useState({
        time: { total: 0, used: 0, revised: 0, balance: 0, percent: 0 },
        dates: { start: "", original: "", revised: "", fmis: "", substantial: "", administrative: "" },
        retention: { fivePercent: 0, extra: 0, priceAdjustment: 0, insuranceFines: 0, otherPenalties: 0, returned: 0, total: 0 },
        cost: {
            original: 0,
            certTotal: 0,
            lastCertAmount: 0,
            lastCertNum: 0,
            balance: 0,
            percentObra: 0,
            actTotal: 0,
            fhwaTotal: 0,
            actProjected: 0,
            fhwaProjected: 0,
            materialOnSite: 0,
            mosBalances: [] as { item_num: string, balance: number }[],
            priceAdjustment: 0,
        },
        chos: {
            approvedTotal: 0,
            approvedCount: 0,
            approvedDays: 0,
            pendingTotal: 0,
            pendingCount: 0,
            pendingDays: 0,
            total: 0,
            totalDays: 0,
            percentChange: 0,
            percentDays: 0,
        },
        penalties: { liquidated: 0, dlqReimbursement: 0, security: 0, others: 0, total: 0 },
        liquidation: { 
            totalItems: 0, adminSigned: 0, contractorSigned: 0, liquidatorSigned: 0, percent: 0,
            federalDocs: [] as string[],
            adminSignedCount: 0, contractorSignedCount: 0, liquidatorSignedCount: 0
        }
    });

    const [expiredDocs, setExpiredDocs] = useState<{ doc_type: string; date_expiry: string }[]>([]);
    const [fmisAlert, setFmisAlert] = useState<{ status: 'warning' | 'expired'; daysLeft: number } | null>(null);
    const [mounted, setMounted] = useState(false);
    const [liveIndicator, setLiveIndicator] = useState(false);
    const [showMOSDetails, setShowMOSDetails] = useState(false);
    const [internalContractItems, setInternalContractItems] = useState<any[]>([]);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!projectId || !mounted) return;

        fetchAllData();

        let liveTimer: ReturnType<typeof setTimeout>;
        const handleRealtimeEvent = () => {
            setLiveIndicator(true);
            clearTimeout(liveTimer);
            liveTimer = setTimeout(() => setLiveIndicator(false), 3000);
            fetchAllData();
        };

        const channel = supabase
            .channel(`dashboard:${projectId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: `id=eq.${projectId}` }, handleRealtimeEvent)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'contract_items', filter: `project_id=eq.${projectId}` }, handleRealtimeEvent)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'chos', filter: `project_id=eq.${projectId}` }, handleRealtimeEvent)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_certifications', filter: `project_id=eq.${projectId}` }, handleRealtimeEvent)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'labor_compliance', filter: `project_id=eq.${projectId}` }, handleRealtimeEvent)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            clearTimeout(liveTimer);
        };
    }, [projectId, mounted]);

    const fetchAllData = async () => {
        const today = new Date();
        const todayStr = today.toISOString().split("T")[0];
        
        const { data: complianceData } = await supabase
            .from("labor_compliance")
            .select("doc_type, date_expiry")
            .eq("project_id", projectId)
            .not("date_expiry", "is", null)
            .lt("date_expiry", todayStr);
        setExpiredDocs(complianceData || []);

        const { data: proj } = await supabase.from("projects").select("*").eq("id", projectId).single();

        if (proj?.fmis_end_date) {
            const fmisDate = new Date(proj.fmis_end_date + "T23:59:59");
            const diffTime = fmisDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 3600 * 24));

            if (diffDays < 0) {
                setFmisAlert({ status: 'expired', daysLeft: diffDays });
            } else if (diffDays <= 30) {
                setFmisAlert({ status: 'warning', daysLeft: diffDays });
            } else {
                setFmisAlert(null);
            }
        }

        const { data: items } = await supabase.from("contract_items").select("*").eq("project_id", projectId);
        const totalItemsCount = items?.length || 0;
        setInternalContractItems(items || []);

        const { data: chos } = await supabase.from("chos").select("proposed_change, doc_status, time_extension_days, items").eq("project_id", projectId);

        const { data: certs } = await supabase
            .from("payment_certifications")
            .select("cert_num, cert_date, items, skip_retention, show_retention_return, retention_return_amount, extra_retention, price_adjustment, insurance_fines, other_penalties, refund")
            .eq("project_id", projectId)
            .order("cert_num", { ascending: true });

        const originalCost = proj?.cost_original || items?.reduce((acc, item) => roundedAmt(acc + roundedAmt(item.quantity * item.unit_price, 2), 2), 0) || 0;

        const approvedCHOs = chos?.filter(c => c.doc_status === 'Aprobado') || [];
        const pendingCHOs = chos?.filter(c => c.doc_status === 'En tramite') || [];

        const approvedCHO = approvedCHOs.reduce((acc, c) => roundedAmt(acc + parseFloat(c.proposed_change || '0'), 2), 0);
        const pendingCHO = pendingCHOs.reduce((acc, c) => roundedAmt(acc + parseFloat(c.proposed_change || '0'), 2), 0);
        const approvedDays = approvedCHOs.reduce((acc, c) => acc + (c.time_extension_days || 0), 0);
        const pendingDays = pendingCHOs.reduce((acc, c) => acc + (c.time_extension_days || 0), 0);

        let actTotal = 0;
        let fhwaTotal = 0;
        let actProjected = 0;
        let fhwaProjected = 0;

        items?.forEach((item: any) => {
            const amount = roundedAmt((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0), 2);
            if (item.fund_source?.includes('ACT')) {
                actProjected = roundedAmt(actProjected + amount, 2);
            } else if (item.fund_source?.includes('FHWA')) {
                fhwaProjected = roundedAmt(fhwaProjected + amount, 2);
            }
        });

        chos?.forEach((cho: any) => {
            if (cho.items && Array.isArray(cho.items)) {
                cho.items.forEach((item: any) => {
                    const amount = roundedAmt((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0), 2);
                    if (item.fund_source?.includes('ACT')) {
                        actProjected = roundedAmt(actProjected + amount, 2);
                    } else if (item.fund_source?.includes('FHWA')) {
                        fhwaProjected = roundedAmt(fhwaProjected + amount, 2);
                    }
                });
            }
        });

        let lastCertAmount = 0;
        let lastCertNum = 0;
        let totalRetentionDeducted = 0;
        let totalRetentionReturned = 0;
        let totalExtraRetention = 0;
        let totalPriceAdjustment = 0;
        let totalInsuranceFines = 0;
        let totalOtherPenalties = 0;
        let totalRefund = 0;

        const getInvoicePU = (certsList: any[], itemNum: string, currentCertIdx: number) => {
            for (let i = currentCertIdx; i >= 0; i--) {
                if (!certsList[i]) continue;
                const its = Array.isArray(certsList[i].items) ? certsList[i].items : (certsList[i].items?.list || []);
                const match = its.find((itx: any) => itx.item_num === itemNum && itx.has_material_on_site && parseFloat(itx.mos_unit_price) > 0);
                if (match) return parseFloat(match.mos_unit_price);
            }
            return 0;
        };

        const perItemMosBalance: Record<string, number> = {};

        certs?.forEach((cert: any, cIdx: number) => {
            const certItems = Array.isArray(cert.items) ? cert.items : (cert.items?.list || []);
            let certAmount = 0;

            certItems.forEach((item: any) => {
                const itemNum = item.item_num;
                if (!itemNum) return;

                const qty = parseFloat(item.quantity) || 0;
                const up = parseFloat(item.unit_price) || 0;
                const amount = roundedAmt(qty * up, 2);
                const source = (item.fund_source || "").trim();

                if (source === "FHWA:100%") {
                    fhwaTotal = roundedAmt(fhwaTotal + amount, 2);
                } else if (source === "FHWA:80.25") {
                    const fhwaShare = roundedAmt(amount * 0.8025, 2);
                    const actShare = roundedAmt(amount - fhwaShare, 2);
                    fhwaTotal = roundedAmt(fhwaTotal + fhwaShare, 2);
                    actTotal = roundedAmt(actTotal + actShare, 2);
                } else {
                    actTotal = roundedAmt(actTotal + amount, 2);
                }
                certAmount = roundedAmt(certAmount + amount, 2);

                const manualDeductionQty = parseFloat(item.qty_from_mos) || 0;
                const hasAddition = !!item.has_material_on_site || (item.mos_invoice_total && parseFloat(item.mos_invoice_total) > 0);
                
                const currentBalance = perItemMosBalance[itemNum] || 0;
                const mosPU = getInvoicePU(certs, itemNum, cIdx);
                const price = mosPU > 0 ? mosPU : up;
                
                let deductionQty = 0;
                if (currentBalance > 0.01) {
                    const availableQty = currentBalance / (price || 1);
                    if (manualDeductionQty > 0) {
                        deductionQty = Math.min(manualDeductionQty, availableQty);
                    } else if (qty > 0) {
                        deductionQty = Math.min(qty, availableQty);
                    }
                }

                if (hasAddition) {
                    const cost = parseFloat(item.mos_invoice_total) || 0;
                    perItemMosBalance[itemNum] = roundedAmt(currentBalance + cost, 2);
                }

                if (deductionQty > 0) {
                    const cost = roundedAmt(deductionQty * price, 2);
                    const newBal = roundedAmt((perItemMosBalance[itemNum] || 0) - cost, 2);
                    perItemMosBalance[itemNum] = Math.max(0, newBal);
                }
            });

            if ((cert.cert_num || 0) > lastCertNum) {
                lastCertNum = cert.cert_num;
                lastCertAmount = certAmount;
            }

            if (!cert.skip_retention) {
                certItems.forEach((item: any) => {
                    if (!item.skip_retention) {
                        const itemAmt = roundedAmt((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0), 2);
                        totalRetentionDeducted = roundedAmt(totalRetentionDeducted + roundedAmt(itemAmt * 0.05, 2), 2);
                    }
                });
            }
            if (cert.show_retention_return && cert.retention_return_amount) {
                totalRetentionReturned = roundedAmt(totalRetentionReturned + (parseFloat(cert.retention_return_amount) || 0), 2);
            }

            totalExtraRetention = roundedAmt(totalExtraRetention + (parseFloat(cert.extra_retention) || 0), 2);
            totalPriceAdjustment = roundedAmt(totalPriceAdjustment + (parseFloat(cert.price_adjustment) || 0), 2);
            totalInsuranceFines = roundedAmt(totalInsuranceFines + (parseFloat(cert.insurance_fines) || 0), 2);
            totalOtherPenalties = roundedAmt(totalOtherPenalties + (parseFloat(cert.other_penalties) || 0), 2);
            totalRefund = roundedAmt(totalRefund + (parseFloat(cert.refund) || 0), 2);
        });

        const mosEntries = Object.entries(perItemMosBalance)
            .filter(([_, balance]) => balance > 0.01)
            .map(([item_num, balance]) => ({ item_num, balance }));
        const mosTotal = roundedAmt(mosEntries.reduce((acc, e) => roundedAmt(acc + e.balance, 2), 0), 2);

        const certified = roundedAmt(actTotal + fhwaTotal, 2);
        const startDate = proj?.date_project_start ? new Date(proj.date_project_start + "T00:00:00") : null;
        const origEndDate = proj?.date_orig_completion ? new Date(proj.date_orig_completion + "T23:59:59") : null;
        
        let totalDays = 0;
        if (startDate && origEndDate && !isNaN(startDate.getTime()) && !isNaN(origEndDate.getTime())) {
            totalDays = Math.ceil((origEndDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
        }

        let timeEndDate = new Date();
        if (proj?.date_substantial_completion) timeEndDate = new Date(proj.date_substantial_completion + "T23:59:59");
        else if (proj?.date_real_completion) timeEndDate = new Date(proj.date_real_completion + "T23:59:59");

        let usedDays = 0;
        if (startDate && !isNaN(startDate.getTime()) && !isNaN(timeEndDate.getTime())) {
            usedDays = Math.ceil((timeEndDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
        }
        if (usedDays < 0) usedDays = 0;
        
        const revisedDays = (totalDays || 0) + (approvedDays || 0);

        let adminDateStr = "";
        const baseAdminDate = proj?.date_rev_completion || proj?.date_orig_completion;
        if (baseAdminDate) {
            const revDate = new Date(baseAdminDate + "T23:59:59");
            if (!isNaN(revDate.getTime())) {
                revDate.setFullYear(revDate.getFullYear() + 2);
                adminDateStr = revDate.toISOString().split("T")[0];
            }
        }

        const damAmt = parseFloat(proj?.liquidated_damages_amount || "500");
        const liqDamages = Math.max(0, ((usedDays || 0) - (revisedDays || 0)) * damAmt);

        const adminCount = proj?.liquidation_data?.admin_signed_count || 0;
        const contractorCount = proj?.liquidation_data?.contractor_signed_count || 0;
        const liquidatorCount = proj?.liquidation_data?.liquidator_signed_count || 0;
        const totalSigned = adminCount + contractorCount + liquidatorCount;
        const liqPercent = totalItemsCount > 0 ? Math.round((totalSigned / (totalItemsCount * 3)) * 100) : 0;

        setMetrics({
            time: {
                total: totalDays || 0,
                used: usedDays || 0,
                revised: revisedDays || 0,
                balance: (revisedDays || 0) - (usedDays || 0),
                percent: revisedDays > 0 ? roundedAmt((usedDays / revisedDays) * 100, 2) : 0
            },
            dates: {
                start: proj?.date_project_start || "",
                original: proj?.date_orig_completion || "",
                revised: proj?.date_rev_completion || "",
                substantial: proj?.date_substantial_completion || "",
                administrative: adminDateStr || "",
                fmis: proj?.fmis_end_date || ""
            },
            retention: {
                fivePercent: totalRetentionDeducted || 0,
                extra: totalExtraRetention || 0,
                priceAdjustment: totalPriceAdjustment || 0,
                insuranceFines: totalInsuranceFines || 0,
                otherPenalties: totalOtherPenalties || 0,
                returned: totalRetentionReturned || 0,
                total: roundedAmt(totalRetentionDeducted - totalRetentionReturned + totalExtraRetention + totalInsuranceFines + totalOtherPenalties - totalPriceAdjustment - totalRefund, 2)
            },
            cost: {
                original: originalCost || 0,
                certTotal: certified || 0,
                lastCertAmount: lastCertAmount || 0,
                lastCertNum: lastCertNum || 0,
                balance: roundedAmt(((originalCost || 0) + (approvedCHO || 0)) - (certified || 0), 2),
                percentObra: ((originalCost || 0) + (approvedCHO || 0)) > 0 ? roundedAmt(((certified || 0) / ((originalCost || 0) + (approvedCHO || 0))) * 100, 2) : 0,
                actTotal: actTotal || 0,
                fhwaTotal: fhwaTotal || 0,
                actProjected: actProjected || 0,
                fhwaProjected: fhwaProjected || 0,
                materialOnSite: mosTotal,
                mosBalances: mosEntries,
                priceAdjustment: totalPriceAdjustment || 0,
            },
            chos: {
                approvedTotal: approvedCHO || 0,
                approvedCount: approvedCHOs?.length || 0,
                approvedDays: approvedDays || 0,
                pendingTotal: pendingCHO || 0,
                pendingCount: pendingCHOs?.length || 0,
                pendingDays: pendingDays || 0,
                total: roundedAmt((approvedCHO || 0) + (pendingCHO || 0), 2),
                totalDays: (approvedDays || 0) + (pendingDays || 0),
                percentChange: (originalCost || 0) > 0 ? Math.round(((approvedCHO || 0) / (originalCost || 0)) * 100) : 0,
                percentDays: (totalDays || 0) > 0 ? Math.round(((approvedDays || 0) / (totalDays || 0)) * 100) : 0,
            },
            penalties: {
                liquidated: liqDamages || 0,
                dlqReimbursement: totalRefund || 0,
                security: totalInsuranceFines || 0,
                others: totalOtherPenalties || 0,
                total: roundedAmt(liqDamages + totalInsuranceFines + totalOtherPenalties, 2)
            },
            liquidation: {
                totalItems: totalItemsCount,
                adminSigned: adminCount,
                contractorSigned: contractorCount,
                liquidatorSigned: liquidatorCount,
                percent: liqPercent,
                federalDocs: proj?.liquidation_data?.federal_docs || [],
                adminSignedCount: adminCount,
                contractorSignedCount: contractorCount,
                liquidatorSignedCount: liquidatorCount
            }
        });
    };

    if (!mounted) return null;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <Activity className="text-primary" size={24} />
                        </div>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-3">
                                <span className="text-slate-950 dark:text-white">Resumen</span>
                                <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200 shadow-sm uppercase tracking-wider">
                                    AQUI SE ENCUENTRA LA PRINCIPAL INFORMACION DEL PROYECTO
                                </span>
                            </div>
                        </div>
                    </h2>
                </div>
            </div>

            {fmisAlert && (
                <div className={`flex items-center gap-3 p-4 rounded-xl border animate-pulse ${
                    fmisAlert.status === 'expired' 
                        ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300' 
                        : 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300'
                }`}>
                    <AlertCircle size={20} />
                    <div className="flex-1">
                        <p className="text-sm font-bold">
                            {fmisAlert.status === 'expired' 
                                ? `¡ALERTA FMIS! La fecha limite del FMIS ha expirado hace ${Math.abs(fmisAlert.daysLeft)} dias.` 
                                : `¡AVISO FMIS! Quedan solo ${fmisAlert.daysLeft} dias para la fecha limite del FMIS.`}
                        </p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card border-t-4 border-t-blue-500">
                    <div className="flex items-center gap-2 text-blue-700 font-bold mb-4 uppercase text-xs tracking-wider">
                        <Clock size={16} /> FECHAS CLAVE
                    </div>
                    <div className="space-y-1">
                        <MetricRow label="Comienzo" value={formatDate(metrics.dates.start)} />
                        <MetricRow label="Original" value={formatDate(metrics.dates.original)} />
                        <MetricRow label="Revisada" value={formatDate(metrics.dates.revised)} color="text-blue-700 font-bold" />
                        <MetricRow label="Sustancial" value={formatDate(metrics.dates.substantial)} />
                        <MetricRow label="Terminacion Administrativa" value={formatDate(metrics.dates.administrative)} color="text-amber-800 font-bold" />
                        <MetricRow label="FMIS End Date" value={formatDate(metrics.dates.fmis)} color="text-emerald-700" />
                        <hr className="my-2 border-slate-200 dark:border-slate-800" />
                        <MetricRow label="Dias Contrato" value={`${formatNumber(metrics.time.total, 0)} dias`} />
                        <MetricRow label="Dias Revisados (Original + CHO)" value={`${formatNumber(metrics.time.revised, 0)} dias`} />
                        <MetricRow label="Tiempo transcurrido a la fecha" value={`${formatNumber(metrics.time.used, 0)} dias`} />
                        <MetricRow label="Balance de dias" value={`${formatNumber(metrics.time.balance, 0)} dias`} color={metrics.time.balance < 0 ? "text-red-700 font-bold" : "text-emerald-700 font-bold"} />
                    </div>
                </div>

                <div className="card border-t-4 border-t-emerald-500">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 text-emerald-700 font-bold uppercase text-xs tracking-wider">
                            <DollarSign size={16} /> COSTOS Y PAGOS
                        </div>
                    </div>
                    <div className="space-y-1">
                        <MetricRow label="Costo Original" value={formatCurrency(metrics.cost.original)} />
                        <MetricRow label="Costo Ajustado" value={formatCurrency(metrics.cost.original + metrics.chos.approvedTotal)} color="text-emerald-700 font-bold" />
                        <MetricRow label="Certified to date (WP)" value={formatCurrency(metrics.cost.certTotal)} color="text-emerald-700" />
                        <MetricRow label="Balance actual (remaining)" value={formatCurrency(metrics.cost.balance)} color="text-blue-800 dark:text-blue-300 font-black" />
                        
                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">% DE OBRA EJECUTADA:</span>
                                <span className="text-sm font-black text-emerald-600">{metrics.cost.percentObra}%</span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-emerald-500 transition-all duration-1000" 
                                    style={{ width: `${Math.min(100, metrics.cost.percentObra)}%` }}
                                />
                            </div>
                        </div>

                        <div className="mt-4">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Progreso del tiempo transcurrido:</span>
                                <span className="text-sm font-black text-blue-600">{metrics.time.percent}%</span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-blue-500 transition-all duration-1000" 
                                    style={{ width: `${Math.min(100, metrics.time.percent)}%` }}
                                />
                            </div>
                        </div>

                        <div className="mt-2 text-[10px] font-bold flex flex-col gap-1 text-slate-500 bg-slate-50 dark:bg-slate-900/50 p-2 rounded">
                            <div className="flex justify-between">
                                <span>TOTAL FHWA:</span>
                                <span>{formatCurrency(metrics.cost.fhwaTotal)} / {formatCurrency(metrics.cost.fhwaProjected)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>TOTAL ACT:</span>
                                <span>{formatCurrency(metrics.cost.actTotal)} / {formatCurrency(metrics.cost.actProjected)}</span>
                            </div>
                        </div>

                        <div className="mt-2">
                            <button 
                                onClick={() => setShowMOSDetails(!showMOSDetails)}
                                className="w-full flex justify-between items-center p-2 rounded bg-amber-50 dark:bg-amber-950/20 text-amber-700 hover:bg-amber-100 transition-colors"
                            >
                                <span className="text-[10px] font-black uppercase">Material on Site (MOS):</span>
                                <span className="text-sm font-black">{formatCurrency(metrics.cost.materialOnSite)}</span>
                            </button>
                            
                            {showMOSDetails && metrics.cost.mosBalances.length > 0 && (
                                <div className="mt-2 p-2 bg-white dark:bg-slate-900 border border-amber-100 dark:border-amber-900/30 rounded shadow-inner space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                                    {metrics.cost.mosBalances.map((e, i) => {
                                        const it = (internalContractItems || []).find((ci: any) => ci.item_num === e.item_num);
                                        const pu = it?.unit_price || 1;
                                        const qty = e.balance / pu;
                                        return (
                                            <div key={i} className="flex justify-between items-center text-[10px] font-bold text-amber-800 py-1 border-b border-amber-50 dark:border-amber-900/10 last:border-0">
                                                <div className="flex gap-2">
                                                    <span className="w-12">Item {e.item_num}</span>
                                                    <span className="text-amber-600/70 font-black">({formatNumber(qty, 2)} {it?.unit || 'UN'})</span>
                                                </div>
                                                <span className="font-black">{formatCurrency(e.balance)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="card border-t-4 border-t-amber-500">
                    <div className="flex items-center gap-2 text-amber-700 font-bold mb-4 uppercase text-xs tracking-wider">
                        <PieChart size={16} /> CHANGE ORDERS
                    </div>
                    <div className="space-y-3">
                        <div className="grid grid-cols-[24%_12%_16%_48%] gap-1 items-end text-[9px] font-black text-slate-500 uppercase pb-1 border-b border-slate-200 dark:border-slate-800">
                            <span></span>
                            <span className="text-center">#</span>
                            <span className="text-center leading-tight">Dias<br/>Otorg.</span>
                            <span className="text-right">$</span>
                        </div>
                        <CHORow label="Aprobados" count={metrics.chos.approvedCount} days={metrics.chos.approvedDays} amount={formatCurrency(metrics.chos.approvedTotal)} color="text-emerald-800 dark:text-emerald-400" />
                        <CHORow label="En Tramite" count={metrics.chos.pendingCount} days={metrics.chos.pendingDays} amount={formatCurrency(metrics.chos.pendingTotal)} color="text-amber-800 dark:text-amber-400" />
                        <CHORow label="Resumen" count={metrics.chos.approvedCount + metrics.chos.pendingCount} days={metrics.chos.totalDays} amount={formatCurrency(metrics.chos.total)} color="font-black text-slate-950 dark:text-white" />
                        <hr className="my-2 border-slate-200 dark:border-slate-800" />
                        <MetricRow label="% de Cambio (Costo)" value={`${metrics.chos.percentChange}%`} color="text-amber-800 font-bold" />
                        <MetricRow label="% de Cambio (Dias)" value={`${metrics.chos.percentDays}%`} color="text-amber-700" />
                    </div>
                </div>

                <div className="card border-t-4 border-t-violet-500">
                    <div className="flex items-center gap-2 text-violet-700 font-bold mb-4 uppercase text-xs tracking-wider">
                        <Layers size={16} /> RETENCIONES Y OTROS
                    </div>
                    <div className="space-y-1">
                        <MetricRow label="Retencion 5% ($)" value={formatCurrency(metrics.retention.fivePercent)} />
                        <MetricRow label="Ajuste de Precio ($)" value={formatCurrency(metrics.retention.priceAdjustment)} color={metrics.retention.priceAdjustment > 0 ? "text-emerald-700 font-bold" : ""} />
                        <MetricRow label="Multas Seguro ($)" value={formatCurrency(metrics.retention.insuranceFines)} color={metrics.retention.insuranceFines > 0 ? "text-red-700" : ""} />
                        <MetricRow label="Otras Penalidades ($)" value={formatCurrency(metrics.retention.otherPenalties)} color={metrics.retention.otherPenalties > 0 ? "text-red-700" : ""} />
                        <MetricRow label="Reembolso" value={metrics.retention.returned > 0 ? `-${formatCurrency(metrics.retention.returned)}` : formatCurrency(0)} color="text-emerald-700" />
                        <MetricRow label="Daños Liquidos (Dlq)" value={formatCurrency(metrics.penalties.liquidated)} color={metrics.penalties.liquidated > 0 ? "text-red-700 font-bold" : ""} />
                        <hr className="my-2 border-slate-200 dark:border-slate-800" />
                        <MetricRow label="Retenciones y penalidades" value={formatCurrency(metrics.retention.total)} color="text-violet-800 dark:text-violet-400 font-bold" />
                    </div>
                </div>

                <div className="card border-t-4 border-t-emerald-500 bg-amber-50/10 dark:bg-amber-900/5">
                    <div className="flex items-center gap-2 text-emerald-700 font-bold mb-2 uppercase text-xs tracking-wider">
                        <Activity size={16} /> LIQUIDACION
                    </div>
                    <div className="space-y-1">
                        <div className="flex justify-between items-center py-1">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Items con Cierre:</span>
                            <span className="text-sm font-black">{metrics.liquidation.adminSigned} / {metrics.liquidation.totalItems}</span>
                        </div>
                        <div className="mt-2 mb-4">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">% FIRMAS RECOLECTADAS:</span>
                                <span className="text-sm font-black text-emerald-600">{metrics.liquidation.percent}%</span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-emerald-500 transition-all duration-1000 shadow-[0_0_8px_rgba(16,185,129,0.3)]" 
                                    style={{ width: `${Math.min(100, metrics.liquidation.percent)}%` }}
                                />
                            </div>
                            <span className="text-[8px] text-slate-400 mt-1 block">Firma de Administrador, Contratista y Liquidador requeridas por item.</span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-100 dark:border-slate-800">
                            <div className="text-center">
                                <div className="text-[10px] font-black text-emerald-600">{metrics.liquidation.adminSignedCount}</div>
                                <div className="text-[7px] font-bold text-slate-400 uppercase">Admin</div>
                            </div>
                            <div className="text-center border-x border-slate-100 dark:border-slate-800">
                                <div className="text-[10px] font-black text-emerald-600">{metrics.liquidation.contractorSignedCount}</div>
                                <div className="text-[7px] font-bold text-slate-400 uppercase">Contr</div>
                            </div>
                            <div className="text-center">
                                <div className="text-[10px] font-black text-emerald-600">{metrics.liquidation.liquidatorSignedCount}</div>
                                <div className="text-[7px] font-bold text-slate-400 uppercase">Liq</div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Documentos de Cierre Recibidos:</span>
                            <div className="max-h-32 overflow-y-auto space-y-1 custom-scrollbar pr-1">
                                {metrics.liquidation.federalDocs.length > 0 ? (
                                    metrics.liquidation.federalDocs.map((doc, i) => (
                                        <div key={i} className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-1 rounded border border-emerald-100 dark:border-emerald-900/30">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]" />
                                            <span className="truncate">{doc}</span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-[10px] text-slate-400 italic">No hay documentos marcados.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function MetricRow({ label, value, color }: { label: string, value: string | number, color?: string }) {
    return (
        <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
            <span className="text-[11px] font-black text-slate-800 dark:text-slate-300 uppercase tracking-tight">{label}</span>
            <span className={`text-sm font-black ${color || 'text-slate-950 dark:text-white'}`}>{value}</span>
        </div>
    );
}

function CHORow({ label, count, days, amount, color }: { label: string, count: number, days: number, amount: string, color?: string }) {
    return (
        <div className={`grid grid-cols-[24%_12%_16%_48%] gap-1 items-center py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0 ${color || 'text-slate-950 dark:text-white'}`}>
            <span className="text-[10px] font-black text-slate-800 dark:text-slate-300 uppercase tracking-tighter leading-none break-words">{label}</span>
            <span className="text-sm font-black text-center">{count}</span>
            <span className="text-sm font-black text-center">{days}</span>
            <span className="text-[13px] font-black text-right tracking-tight truncate">{amount}</span>
        </div>
    );
}
