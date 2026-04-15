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
            federalDocs: [] as string[]
        }
    });

    const [expiredDocs, setExpiredDocs] = useState<{ doc_type: string; date_expiry: string }[]>([]);
    const [fmisAlert, setFmisAlert] = useState<{ status: 'warning' | 'expired'; daysLeft: number } | null>(null);
    const [mounted, setMounted] = useState(false);
    const [liveIndicator, setLiveIndicator] = useState(false);
    const [showMOSDetails, setShowMOSDetails] = useState(false);

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

        const { data: chos } = await supabase.from("chos").select("proposed_change, doc_status, time_extension_days, items").eq("project_id", projectId);

        const { data: certs } = await supabase
            .from("payment_certifications")
            .select("cert_num, cert_date, items, skip_retention, show_retention_return, retention_return_amount")
            .eq("project_id", projectId)
            .order("cert_num", { ascending: true });

        const originalCost = proj?.cost_original || items?.reduce((acc, item) => roundedAmt(acc + roundedAmt(item.quantity * item.unit_price, 2), 2), 0) || 0;

        const approvedCHOs = chos?.filter(c => c.doc_status === 'Aprobado') || [];
        const pendingCHOs = chos?.filter(c => c.doc_status === 'En trámite') || [];

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

        const perItemMosBalance: Record<string, number> = {};

        certs?.forEach((cert: any) => {
            const certItems = Array.isArray(cert.items) ? cert.items : (cert.items?.list || []);
            let certAmount = 0;

            certItems.forEach((item: any) => {
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

                if (!perItemMosBalance[item.item_num]) perItemMosBalance[item.item_num] = 0;
                
                const mosInvoice = parseFloat(item.mos_invoice_total) || 0;
                if (mosInvoice > 0) perItemMosBalance[item.item_num] = roundedAmt(perItemMosBalance[item.item_num] + mosInvoice, 2);
                
                const qtyFromMos = parseFloat(item.qty_from_mos) || 0;
                const mosPU = parseFloat(item.mos_unit_price) || up;
                if (qtyFromMos > 0) perItemMosBalance[item.item_num] = roundedAmt(perItemMosBalance[item.item_num] - roundedAmt(qtyFromMos * mosPU, 2), 2);
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
        // mosTotal includes ALL items (positives and negatives) to match the MOS report total
        const mosTotal = roundedAmt(Object.values(perItemMosBalance).reduce((acc, b) => roundedAmt(acc + b, 2), 0), 2);

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
                totalItems: totalItemsCount || 0,
                adminSigned: proj?.liquidation_data?.admin_signed_count || 0,
                contractorSigned: proj?.liquidation_data?.contractor_signed_count || 0,
                liquidatorSigned: proj?.liquidation_data?.liquidator_signed_count || 0,
                percent: totalItemsCount > 0 ? Math.round(((
                    (proj?.liquidation_data?.admin_signed_count || 0) +
                    (proj?.liquidation_data?.contractor_signed_count || 0) +
                    (proj?.liquidation_data?.liquidator_signed_count || 0)
                ) / (totalItemsCount * 3)) * 100) : 0,
                federalDocs: proj?.liquidation_data?.federal_docs || []
            }
        });
    };

    if (!mounted) return null;

    return (
        <div suppressHydrationWarning className="space-y-8 animate-in fade-in duration-500">
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
                                    AQUÍ SE ENCUENTRA LA PRINCIPAL INFORMACIÓN DEL PROYECTO
                                </span>
                            </div>
                        </div>
                    </h2>
                </div>
            </div>

            {numAct && (
                <div className="flex items-center gap-2 -mt-6 mb-6">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Proyecto:</span>
                    <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-primary text-[10px] font-bold rounded border border-blue-100 dark:border-blue-800">
                        {numAct}
                    </span>
                </div>
            )}

            {/* ALERTA: FMIS Date Expiry */}
            {fmisAlert && (
                <div className={`rounded-xl border px-5 py-4 animate-pulse ${fmisAlert.status === 'expired'
                    ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300'
                    : 'border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
                    }`}>
                    <div className="flex items-center gap-3">
                        <AlertCircle size={24} className={fmisAlert.status === 'expired' ? 'text-orange-600' : 'text-amber-600'} />
                        <div className="flex-1">
                            <h4 className="text-sm font-black uppercase tracking-wider">
                                {fmisAlert.status === 'expired' ? 'FMIS END DATE VENCIDA' : 'ADVERTENCIA: VENCIMIENTO FMIS PRÓXIMO'}
                            </h4>
                            <p className="text-xs font-semibold opacity-90 mt-0.5">
                                {fmisAlert.status === 'expired'
                                    ? `La fecha de FMIS para este proyecto venció hace ${Math.abs(fmisAlert.daysLeft)} días.`
                                    : `Faltan ${fmisAlert.daysLeft} días para que expire la fecha de FMIS de este proyecto (${metrics.dates.fmis}).`
                                }
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* ALERTA: Documentos de cumplimiento vencidos */}
            {expiredDocs.length > 0 && (
                <div className="rounded-xl border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/40 px-5 py-4">
                    <div className="flex items-center gap-2 mb-3">
                        <ShieldAlert size={18} className="text-red-600 dark:text-red-400 shrink-0" />
                        <span className="text-sm font-extrabold text-red-800 dark:text-red-200 uppercase tracking-wide">
                            Cumplimiento Laboral — Documentos Vencidos
                        </span>
                        <span className="ml-auto bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                            {expiredDocs.length}
                        </span>
                    </div>
                    <ul className="space-y-1.5">
                        {expiredDocs.map((doc, i) => {
                            const expiryFormatted = formatDate(doc.date_expiry);
                            return (
                                <li key={i} className="flex items-center gap-2 text-sm">
                                    <span style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#ef4444", boxShadow: "0 0 5px 1px rgba(239,68,68,0.5)", flexShrink: 0 }} />
                                    <span className="font-semibold text-red-900 dark:text-red-300">{doc.doc_type}</span>
                                    <span className="text-red-600 dark:text-red-400 text-xs ml-auto font-mono">Venció: {expiryFormatted}</span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="card border-t-4 border-t-blue-500">
                    <div className="flex items-center gap-2 text-blue-700 font-bold mb-2 uppercase text-xs tracking-wider">
                        <Clock size={16} /> TIEMPO
                    </div>
                    <div className="space-y-1">
                        <MetricRow label="Comienzo Proyecto" value={formatDate(metrics.dates.start)} color="text-slate-800" />
                        <MetricRow label="Terminación Original" value={formatDate(metrics.dates.original)} color="text-slate-800" />
                        <MetricRow label="Terminación Revisada" value={formatDate(metrics.dates.revised)} color="text-slate-800" />
                        <MetricRow label="Terminación Sustancial" value={formatDate(metrics.dates.substantial)} color="text-blue-800 font-bold" />
                        <MetricRow label="Terminación Administrativa" value={formatDate(metrics.dates.administrative)} color="text-amber-800 font-bold" />
                        <MetricRow label="FMIS End Date" value={formatDate(metrics.dates.fmis)} color="text-emerald-700" />
                        <hr className="my-2 border-slate-200 dark:border-slate-800" />
                        <MetricRow label="Días Contrato" value={`${formatNumber(metrics.time.total, 0)} días`} />
                        <MetricRow label="Días Revisados (Original + CHO)" value={`${formatNumber(metrics.time.revised, 0)} días`} />
                        <MetricRow label="Tiempo transcurrido a la fecha" value={`${formatNumber(metrics.time.used, 0)} días`} />
                        <MetricRow label="Balance de días" value={`${formatNumber(metrics.time.balance, 0)} días`} color={metrics.time.balance < 0 ? "text-red-700 font-bold" : "text-emerald-700 font-bold"} />
                        <div className="pt-2">
                            <div className="flex justify-between text-xs mb-1 font-bold text-slate-800 dark:text-slate-200">
                                <span>Progreso de Tiempo</span>
                                <span>{metrics.time.percent.toFixed(2)}%</span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5">
                                <div className={`${metrics.time.percent > 100 ? 'bg-red-500' : 'bg-blue-600'} h-1.5 rounded-full transition-all duration-500`} style={{ width: `${Math.min(metrics.time.percent, 100)}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card border-t-4 border-t-amber-500">
                    <div className="flex items-center gap-2 text-amber-700 font-bold mb-2 uppercase text-xs tracking-wider">
                        <PieChart size={16} /> CHANGE ORDERS
                    </div>
                    <div className="space-y-0.5">
                        <div className="grid grid-cols-4 gap-1 text-[10px] font-black text-slate-500 uppercase pb-1 border-b border-slate-200 dark:border-slate-800">
                            <span></span>
                            <span className="text-center">#</span>
                            <span className="text-center">Días</span>
                            <span className="text-right">$</span>
                        </div>
                        <CHORow label="Aprobados" count={metrics.chos.approvedCount} days={metrics.chos.approvedDays} amount={formatCurrency(metrics.chos.approvedTotal)} color="text-emerald-800 dark:text-emerald-400" />
                        <CHORow label="En Trámite" count={metrics.chos.pendingCount} days={metrics.chos.pendingDays} amount={formatCurrency(metrics.chos.pendingTotal)} color="text-amber-800 dark:text-amber-400" />
                        <CHORow label="Resumen" count={metrics.chos.approvedCount + metrics.chos.pendingCount} days={metrics.chos.totalDays} amount={formatCurrency(metrics.chos.total)} color="font-black text-slate-950 dark:text-white" />
                        <hr className="my-2 border-slate-200 dark:border-slate-800" />
                        <MetricRow label="% de Cambio (Costo)" value={`${metrics.chos.percentChange}%`} color="text-amber-800 font-bold" />
                        <MetricRow label="% de Cambio (Días)" value={`${metrics.chos.percentDays}%`} color="text-amber-700" />
                    </div>
                </div>

                <div className="card border-t-4 border-t-violet-500">
                    <div className="flex items-center gap-2 text-violet-700 font-bold mb-2 uppercase text-xs tracking-wider">
                        <Layers size={16} /> RETENCIÓN
                    </div>
                    <div className="space-y-1">
                        <MetricRow label="5% Retenido (Acum.)" value={formatCurrency(metrics.retention.fivePercent)} />
                        <MetricRow label="Extra Retenido ($)" value={formatCurrency(metrics.retention.extra)} />
                        <MetricRow label="Ajuste de Precio ($)" value={formatCurrency(-metrics.retention.priceAdjustment)} color={metrics.retention.priceAdjustment !== 0 ? "text-blue-700" : ""} />
                        <MetricRow label="Multas Seguro ($)" value={formatCurrency(metrics.retention.insuranceFines)} color={metrics.retention.insuranceFines > 0 ? "text-red-700" : ""} />
                        <MetricRow label="Otras Penalidades ($)" value={formatCurrency(metrics.retention.otherPenalties)} color={metrics.retention.otherPenalties > 0 ? "text-red-700" : ""} />
                        <MetricRow label="Reembolso" value={metrics.retention.returned > 0 ? `-${formatCurrency(metrics.retention.returned)}` : formatCurrency(0)} color="text-emerald-700" />
                        <MetricRow label="Daños Líquidos (Dlq)" value={formatCurrency(metrics.penalties.liquidated)} color={metrics.penalties.liquidated > 0 ? "text-red-700 font-bold" : ""} />
                        <hr className="my-2 border-slate-200 dark:border-slate-800" />
                        <MetricRow label="Ajustes y penalidades" value={formatCurrency(metrics.retention.total)} color="text-violet-800 dark:text-violet-400 font-bold" />
                    </div>
                </div>

                <div className="card border-t-4 border-t-emerald-500 bg-amber-50/10 dark:bg-amber-900/5">
                    <div className="flex items-center gap-2 text-emerald-700 font-bold mb-2 uppercase text-xs tracking-wider">
                        <Activity size={16} /> LIQUIDACIÓN
                    </div>
                    <div className="space-y-1">
                        <div className="flex justify-between items-center py-1">
                            <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase">Total Partidas</span>
                            <div className="bg-white dark:bg-slate-800 border border-slate-400 dark:border-slate-600 px-3 py-1 rounded shadow-inner font-mono font-black text-slate-900 dark:text-slate-100 italic">
                                {formatNumber(metrics.liquidation.totalItems, 0)}
                            </div>
                        </div>
                        <div className="mt-2 space-y-1">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Firmadas por:</span>
                            <div className="pl-2 space-y-1">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-slate-700 dark:text-slate-300">Administrador</span>
                                    <span className="font-mono text-sm font-bold flex items-center gap-2">
                                        {formatNumber(metrics.liquidation.adminSigned, 0)} 
                                        <span className="text-[10px] text-blue-600 dark:text-blue-400">({metrics.liquidation.totalItems > 0 ? Math.round((metrics.liquidation.adminSigned / metrics.liquidation.totalItems) * 100) : 0}%)</span>
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-slate-700 dark:text-slate-300">Contratista</span>
                                    <span className="font-mono text-sm font-bold flex items-center gap-2">
                                        {formatNumber(metrics.liquidation.contractorSigned, 0)} 
                                        <span className="text-[10px] text-blue-600 dark:text-blue-400">({metrics.liquidation.totalItems > 0 ? Math.round((metrics.liquidation.contractorSigned / metrics.liquidation.totalItems) * 100) : 0}%)</span>
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-slate-700 dark:text-slate-300">Liquidador</span>
                                    <span className="font-mono text-sm font-bold flex items-center gap-2">
                                        {formatNumber(metrics.liquidation.liquidatorSigned, 0)} 
                                        <span className="text-[10px] text-blue-600 dark:text-blue-400">({metrics.liquidation.totalItems > 0 ? Math.round((metrics.liquidation.liquidatorSigned / metrics.liquidation.totalItems) * 100) : 0}%)</span>
                                    </span>
                                </div>
                            </div>
                        </div>
                        <hr className="my-2 border-slate-200 dark:border-slate-800" />
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

                <div className="card border-t-4 border-t-blue-600 md:col-span-2 lg:col-span-2">
                    <div className="flex items-center gap-2 text-blue-700 font-bold mb-3 uppercase text-xs tracking-wider">
                        <DollarSign size={16} /> COSTOS
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                        <div className="space-y-1">
                            <MetricRow label="Costo Original" value={formatCurrency(metrics.cost.original)} />
                            <MetricRow label="Costo (Revisado)" value={formatCurrency(metrics.cost.original + metrics.chos.approvedTotal)} color="text-slate-950 dark:text-white font-black" />
                            <MetricRow label={`Últ. Certificación pagada (#${metrics.cost.lastCertNum})`} value={formatCurrency(metrics.cost.lastCertAmount)} color="text-blue-700" />
                            <MetricRow label="Total Certificado" value={formatCurrency(metrics.cost.certTotal)} color="text-blue-700 font-black" />
                            <div className="pt-2">
                                <button 
                                    onClick={() => setShowMOSDetails(!showMOSDetails)}
                                    className="w-full flex justify-between items-center group"
                                >
                                    <MetricRow label="Material en Sitio&nbsp;&nbsp;&nbsp;(MOS)" value={formatCurrency(metrics.cost.materialOnSite)} color="text-amber-700 font-black" />
                                </button>
                                {showMOSDetails && metrics.cost.mosBalances.length > 0 && (
                                    <div className="pl-3 mt-1 space-y-0.5 border-l-2 border-amber-200 dark:border-amber-800 animate-in slide-in-from-top-1 duration-200">
                                        {metrics.cost.mosBalances.map((mb, i) => (
                                            <div key={i} className="flex justify-between text-[10px] font-bold">
                                                <span className="text-slate-500">Partida {mb.item_num}</span>
                                                <span className="text-amber-600 italic">{formatCurrency(mb.balance)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <MetricRow label="Balance Actual" value={formatCurrency(metrics.cost.balance)} color="text-blue-800 dark:text-blue-300 font-black" />
                            <hr className="my-1 border-slate-200 dark:border-slate-800" />
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider pt-0.5">Presupuesto Proyectado</p>
                            <MetricRow label="Prov. ACT" value={formatCurrency(metrics.cost.actProjected)} color="text-emerald-800 font-bold" />
                            <MetricRow label="Prov. FHWA" value={formatCurrency(metrics.cost.fhwaProjected)} color="text-blue-800 font-bold" />
                            <hr className="my-1 border-slate-200 dark:border-slate-800" />
                            <MetricRow label="% de Obra Ejecutada" value={`${metrics.cost.percentObra.toFixed(2)}%`} />
                            <div className="pt-1">
                                <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5">
                                    <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-700" style={{ width: `${Math.min(metrics.cost.percentObra, 100)}%` }}></div>
                                </div>
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
        <div className={`grid grid-cols-4 gap-1 py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0 ${color || 'text-slate-950 dark:text-white'}`}>
            <span className="text-[10px] font-black text-slate-800 dark:text-slate-300 uppercase tracking-tighter">{label}</span>
            <span className="text-sm font-black text-center">{count}</span>
            <span className="text-sm font-black text-center">{days}</span>
            <span className="text-sm font-black text-right">{amount}</span>
        </div>
    );
}
