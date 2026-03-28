"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Clock, DollarSign, PieChart, Activity, AlertCircle, Download, Layers, ShieldAlert, Info } from "lucide-react";
import { formatCurrency, roundedAmt, formatDate } from "@/lib/utils";
import Link from "next/link";

export default function SummaryDashboard({ projectId, numAct }: { projectId?: string, numAct?: string }) {
    const [metrics, setMetrics] = useState({
        time: { total: 0, used: 0, revised: 0, balance: 0, percent: 0 },
        dates: { start: "", original: "", revised: "", fmis: "", substantial: "", administrative: "" },
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
        retention: { fivePercent: 0, extra: 0, returned: 0, total: 0 },
        liquidation: { totalItems: 0, adminSigned: 0, contractorSigned: 0, liquidatorSigned: 0, percent: 0 }
    });

    const [expiredDocs, setExpiredDocs] = useState<{ doc_type: string; date_expiry: string }[]>([]);
    const [fmisAlert, setFmisAlert] = useState<{ status: 'warning' | 'expired'; daysLeft: number } | null>(null);
    const [mounted, setMounted] = useState(false);

    const [liveIndicator, setLiveIndicator] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!projectId || !mounted) return;

        fetchAllData();

        // ── Supabase Realtime: actualizar cuando cambien los datos del proyecto ──
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
        // 0. Fetch expired compliance documents
        const today = new Date();
        const todayStr = today.toISOString().split("T")[0];
        const { data: complianceData } = await supabase
            .from("labor_compliance")
            .select("doc_type, date_expiry")
            .eq("project_id", projectId)
            .not("date_expiry", "is", null)
            .lt("date_expiry", todayStr);
        setExpiredDocs(complianceData || []);

        // 1. Fetch Project
        const { data: proj } = await supabase.from("projects").select("*").eq("id", projectId).single();

        // 1.1 FMIS Expiry Check
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

        // 2. Fetch Items
        const { data: items } = await supabase.from("contract_items").select("*").eq("project_id", projectId);
        const totalItemsCount = items?.length || 0;

        // 3. Fetch CHOs
        const { data: chos } = await supabase.from("chos").select("proposed_change, doc_status, time_extension_days, items").eq("project_id", projectId);

        // 4. Fetch Payment Certifications
        const { data: certs } = await supabase
            .from("payment_certifications")
            .select("cert_num, cert_date, items, skip_retention, show_retention_return, retention_return_amount")
            .eq("project_id", projectId)
            .order("cert_num", { ascending: true });

        const originalCost = proj?.cost_original || items?.reduce((acc, item) => roundedAmt(acc + roundedAmt(item.quantity * item.unit_price, 2), 2), 0) || 0;

        // CHO calculations
        const approvedCHOs = chos?.filter(c => c.doc_status === 'Aprobado') || [];
        const pendingCHOs = chos?.filter(c => c.doc_status === 'En trámite') || [];

        const approvedCHO = approvedCHOs.reduce((acc, c) => roundedAmt(acc + parseFloat(c.proposed_change || '0'), 2), 0);
        const pendingCHO = pendingCHOs.reduce((acc, c) => roundedAmt(acc + parseFloat(c.proposed_change || '0'), 2), 0);
        const approvedDays = approvedCHOs.reduce((acc, c) => acc + (c.time_extension_days || 0), 0);
        const pendingDays = pendingCHOs.reduce((acc, c) => acc + (c.time_extension_days || 0), 0);

        // Calculate total certified amounts split by fund source
        let actTotal = 0;
        let fhwaTotal = 0;

        // Calculate projected budget splits
        let actProjected = 0;
        let fhwaProjected = 0;

        // Origin items projection
        items?.forEach((item: any) => {
            const amount = roundedAmt((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0), 2);
            if (item.fund_source?.includes('ACT')) {
                actProjected = roundedAmt(actProjected + amount, 2);
            } else if (item.fund_source?.includes('FHWA')) {
                fhwaProjected = roundedAmt(fhwaProjected + amount, 2);
            }
        });

        // CHO items projection
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
        let extraRetention = 0;

        // MOS balance: sum of invoiced MOS minus amounts used in work
        let mosBalance = 0;

        certs?.forEach((cert) => {
            const certItems = Array.isArray(cert.items) ? cert.items : (cert.items?.list || []);
            let certAmount = 0;

            certItems.forEach((item: any) => {
                const qty = parseFloat(item.quantity) || 0;
                const up = parseFloat(item.unit_price) || 0;
                const amount = roundedAmt(qty * up, 2);
                const source = (item.fund_source || "").trim();

                // ── Distribución por fuente de fondos ─────────────────────────
                // ACT:100%   → todo va a ACT (PRHTA)
                // FHWA:100%  → todo va a FHWA
                // FHWA:80.25 → 80.25% FHWA, 19.75% ACT
                if (source === "FHWA:100%") {
                    fhwaTotal = roundedAmt(fhwaTotal + amount, 2);
                } else if (source === "FHWA:80.25") {
                    const fhwaShare = roundedAmt(amount * 0.8025, 2);
                    const actShare = roundedAmt(amount - fhwaShare, 2);
                    fhwaTotal = roundedAmt(fhwaTotal + fhwaShare, 2);
                    actTotal = roundedAmt(actTotal + actShare, 2);
                } else {
                    // ACT:100% y cualquier otro valor → ACT
                    actTotal = roundedAmt(actTotal + amount, 2);
                }
                certAmount = roundedAmt(certAmount + amount, 2);

                // ── MOS balance ───────────────────────────────────────────────
                // Al AGREGAR material en sitio: suma el total facturado
                const mosInvoice = parseFloat(item.mos_invoice_total) || 0;
                if (mosInvoice > 0) {
                    mosBalance = roundedAmt(mosBalance + mosInvoice, 2);
                }
                // Al USAR material desde MOS en trabajo: descuenta qty_from_mos × precio
                const qtyFromMos = parseFloat(item.qty_from_mos) || 0;
                const mosPU = parseFloat(item.mos_unit_price) || up;
                if (qtyFromMos > 0) {
                    mosBalance = roundedAmt(mosBalance - roundedAmt(qtyFromMos * mosPU, 2), 2);
                }
            });

            // Track last cert
            if ((cert.cert_num || 0) > lastCertNum) {
                lastCertNum = cert.cert_num;
                lastCertAmount = certAmount;
            }

            // Retention
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
        });

        const certified = roundedAmt(actTotal + fhwaTotal, 2);
        const ret5 = totalRetentionDeducted; // Total acumulado bruto
        const retNet = roundedAmt(ret5 - totalRetentionReturned + extraRetention, 2); // Balance neto actual

        // Time calculations - Standardize with T00:00:00 or T23:59:59 to avoid timezone shifting
        const startDate = proj?.date_project_start ? new Date(proj.date_project_start + "T00:00:00") : null;
        const origEndDate = proj?.date_orig_completion ? new Date(proj.date_orig_completion + "T23:59:59") : null;
        
        let totalDays = 0;
        if (startDate && origEndDate && !isNaN(startDate.getTime()) && !isNaN(origEndDate.getTime())) {
            totalDays = Math.ceil((origEndDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
        }

        // El tiempo usado se detiene en la fecha de terminación sustancial (si existe); si no, usa hoy
        let timeEndDate = new Date();
        if (proj?.date_substantial_completion) {
            timeEndDate = new Date(proj.date_substantial_completion + "T23:59:59");
        } else if (proj?.date_real_completion) {
            timeEndDate = new Date(proj.date_real_completion + "T23:59:59");
        }

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
                materialOnSite: Math.max(mosBalance || 0, 0),
                priceAdjustment: 0,
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
                dlqReimbursement: 0,
                security: 0,
                others: 0,
                total: liqDamages || 0
            },
            retention: {
                fivePercent: ret5 || 0,
                extra: extraRetention || 0,
                returned: totalRetentionReturned || 0,
                total: retNet || 0
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
                ) / (totalItemsCount * 3)) * 100) : 0
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
                                <span>0. Interfaz Resumen de Información Principal</span>
                                <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                    (no hace falta meter ninguna información en esa sección)
                                </span>
                            </div>
                        </div>
                    </h2>
                </div>
            </div>

            {numAct && (
                <div className="flex items-center gap-2 -mt-6 mb-6">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Proyecto:</span>
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
                        <span className="text-sm font-extrabold text-red-700 dark:text-red-400 uppercase tracking-wide">
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
                                    <span
                                        style={{
                                            width: 10, height: 10, borderRadius: "50%",
                                            backgroundColor: "#ef4444",
                                            boxShadow: "0 0 5px 1px rgba(239,68,68,0.5)",
                                            flexShrink: 0,
                                        }}
                                    />
                                    <span className="font-semibold text-red-800 dark:text-red-300">{doc.doc_type}</span>
                                    <span className="text-red-500 dark:text-red-400 text-xs ml-auto font-mono">Venció: {expiryFormatted}</span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                {/* TIEMPO */}
                <div className="card border-t-4 border-t-blue-500">
                    <div className="flex items-center gap-2 text-blue-600 font-bold mb-2 uppercase text-xs tracking-wider">
                        <Clock size={16} /> TIEMPO
                    </div>
                    <div className="space-y-1">
                        <MetricRow label="Comienzo Proyecto" value={metrics.dates.start} color="text-slate-600" />
                        <MetricRow label="Terminación Original" value={metrics.dates.original} color="text-slate-600" />
                        <MetricRow label="Terminación Revisada" value={metrics.dates.revised} color="text-slate-600" />
                        <MetricRow label="Terminación Sustancial" value={metrics.dates.substantial} color="text-blue-700 font-bold" />
                        <MetricRow label="Terminación Administrativa" value={metrics.dates.administrative} color="text-amber-700 font-bold" />
                        <MetricRow label="FMIS End Date" value={metrics.dates.fmis} color="text-emerald-600" />
                        <hr className="my-2 border-slate-100 dark:border-slate-800" />
                        <MetricRow label="Tiempo Contrato" value={`${metrics.time.total} días`} />
                        <MetricRow label="Tiempo Revisado" value={`${metrics.time.revised} días`} />
                        <MetricRow label="Tiempo Usado" value={`${metrics.time.used} días`} />
                        <MetricRow label="Balance de Tiempo" value={`${metrics.time.balance} días`} color={metrics.time.balance < 0 ? "text-red-600 font-bold" : "text-emerald-600 font-bold"} />
                        <div className="pt-2">
                            <div className="flex justify-between text-xs mb-1">
                                <span>Progreso de Tiempo</span>
                                <span>{metrics.time.percent.toFixed(2)}%</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
                                <div className={`${metrics.time.percent > 100 ? 'bg-red-500' : 'bg-blue-500'} h-1.5 rounded-full transition-all duration-500`} style={{ width: `${Math.min(metrics.time.percent, 100)}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* CHANGE ORDERS */}
                <div className="card border-t-4 border-t-amber-500">
                    <div className="flex items-center gap-2 text-amber-600 font-bold mb-2 uppercase text-xs tracking-wider">
                        <PieChart size={16} /> CHANGE ORDERS
                    </div>
                    <div className="space-y-0.5">
                        {/* Header row */}
                        <div className="grid grid-cols-4 gap-1 text-[10px] font-bold text-slate-400 uppercase pb-1 border-b border-slate-100 dark:border-slate-800">
                            <span></span>
                            <span className="text-center">#</span>
                            <span className="text-center">Días</span>
                            <span className="text-right">$</span>
                        </div>
                        <CHORow
                            label="Aprobados"
                            count={metrics.chos.approvedCount}
                            days={metrics.chos.approvedDays}
                            amount={formatCurrency(metrics.chos.approvedTotal)}
                            color="text-emerald-700 dark:text-emerald-400"
                        />
                        <CHORow
                            label="En Trámite"
                            count={metrics.chos.pendingCount}
                            days={metrics.chos.pendingDays}
                            amount={formatCurrency(metrics.chos.pendingTotal)}
                            color="text-amber-700 dark:text-amber-400"
                        />
                        <CHORow
                            label="Total"
                            count={metrics.chos.approvedCount + metrics.chos.pendingCount}
                            days={metrics.chos.totalDays}
                            amount={formatCurrency(metrics.chos.total)}
                            color="font-bold text-slate-900 dark:text-white"
                        />
                        <hr className="my-2 border-slate-100 dark:border-slate-800" />
                        <MetricRow label="% de Cambio (Precio)" value={`${metrics.chos.percentChange}%`} color="text-amber-700 font-bold" />
                        <MetricRow label="% de Cambio (Tiempo)" value={`${metrics.chos.percentDays}%`} color="text-amber-600" />
                    </div>
                </div>

                {/* RETENCIÓN */}
                <div className="card border-t-4 border-t-violet-500">
                    <div className="flex items-center gap-2 text-violet-600 font-bold mb-2 uppercase text-xs tracking-wider">
                        <Layers size={16} /> RETENCIÓN
                    </div>
                    <div className="space-y-1">
                        <MetricRow label="5% Retenido (Acum.)" value={formatCurrency(metrics.retention.fivePercent)} />
                        <MetricRow label="Retención Devuelta" value={metrics.retention.returned > 0 ? `-${formatCurrency(metrics.retention.returned)}` : formatCurrency(0)} color="text-emerald-600" />
                        <MetricRow label="Extra Retenido" value={formatCurrency(metrics.retention.extra)} />
                        <MetricRow label="Cláusula Ajuste Precio" value={formatCurrency(metrics.cost.priceAdjustment)} />
                        <MetricRow label="Multas Seguridad" value={formatCurrency(metrics.penalties.security)} />
                        <MetricRow label="Otras Penalidades" value={formatCurrency(metrics.penalties.others)} />
                        <MetricRow label="Daños Líquidos (Dlq)" value={formatCurrency(metrics.penalties.liquidated)} color={metrics.penalties.liquidated > 0 ? "text-red-600 font-bold" : ""} />
                        <MetricRow label="Reembolso (Dlq)" value={formatCurrency(metrics.penalties.dlqReimbursement)} color="text-emerald-600" />
                        <hr className="my-2 border-slate-100 dark:border-slate-800" />
                        <MetricRow label="Total Retenido (Neto)" value={formatCurrency(metrics.retention.total)} color="text-violet-700 dark:text-violet-400 font-bold" />
                    </div>
                </div>

                {/* LIQUIDACIÓN */}
                <div className="card border-t-4 border-t-emerald-500 bg-amber-50/20 dark:bg-amber-900/5">
                    <div className="flex items-center gap-2 text-emerald-600 font-bold mb-2 uppercase text-xs tracking-wider">
                        <Activity size={16} /> LIQUIDACIÓN
                    </div>
                    <div className="space-y-1">
                        <div className="flex justify-between items-center py-1">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Total Partidas</span>
                            <div className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 px-3 py-1 rounded shadow-inner font-mono font-bold text-slate-700 dark:text-slate-200">
                                {metrics.liquidation.totalItems}
                            </div>
                        </div>

                        <div className="mt-3 space-y-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Firmadas por:</span>
                            <div className="pl-2 space-y-1.5">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-slate-600 dark:text-slate-400">Administrador</span>
                                    <div className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 px-3 py-0.5 rounded shadow-inner font-mono text-sm text-slate-600 dark:text-slate-300">
                                        {metrics.liquidation.adminSigned}
                                    </div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-slate-600 dark:text-slate-400">Contratista</span>
                                    <div className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 px-3 py-0.5 rounded shadow-inner font-mono text-sm text-slate-600 dark:text-slate-300">
                                        {metrics.liquidation.contractorSigned}
                                    </div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-slate-600 dark:text-slate-400">Liquidador</span>
                                    <div className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 px-3 py-0.5 rounded shadow-inner font-mono text-sm text-slate-600 dark:text-slate-300">
                                        {metrics.liquidation.liquidatorSigned}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <hr className="my-3 border-slate-100 dark:border-slate-800" />
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight">% Liquidación</span>
                            <div className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 px-3 py-1 rounded shadow-inner font-mono font-black text-primary text-lg">
                                {metrics.liquidation.percent} %
                            </div>
                        </div>
                    </div>
                </div>


                {/* COSTOS PROYECTO — wide card */}
                <div className="card border-t-4 border-t-primary md:col-span-2 lg:col-span-2">
                    <div className="flex items-center gap-2 text-primary font-bold mb-3 uppercase text-xs tracking-wider">
                        <DollarSign size={16} /> COSTOS
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                        {/* Columna 1: Costos principales */}
                        <div className="space-y-1">
                            <MetricRow label="Costo Original" value={formatCurrency(metrics.cost.original)} />
                            <MetricRow label="Costo Proyecto (Revisado)" value={formatCurrency(metrics.cost.original + metrics.chos.approvedTotal)} color="text-slate-900 dark:text-white font-bold" />
                            <MetricRow label={`Últ. Certificación #${metrics.cost.lastCertNum} (WP)`} value={formatCurrency(metrics.cost.lastCertAmount)} color="text-primary" />
                            <MetricRow label="Total Certificado (WP)" value={formatCurrency(metrics.cost.certTotal)} color="text-primary font-bold" />
                            <MetricRow label="Material en Sitio (MOS)" value={formatCurrency(metrics.cost.materialOnSite)} color="text-amber-600" />
                        </div>
                        {/* Columna 2: Balance y origen de fondos */}
                        <div className="space-y-1">
                            <MetricRow label="Balance Actual" value={formatCurrency(metrics.cost.balance)} color="text-blue-700 dark:text-blue-400 font-bold" />

                            <hr className="my-1 border-slate-100 dark:border-slate-800" />
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pt-0.5">Presupuesto Proyectado (Contrato + CHO)</p>
                            <MetricRow label="Balance Prov. ACT" value={formatCurrency(metrics.cost.actProjected)} color="text-emerald-700 dark:text-emerald-500 font-medium" />
                            <MetricRow label="Balance Prov. FHWA" value={formatCurrency(metrics.cost.fhwaProjected)} color="text-blue-700 dark:text-blue-500 font-medium" />

                            <hr className="my-1 border-slate-100 dark:border-slate-800" />
                            <MetricRow label="% de Obra Exec. (WP)" value={`${metrics.cost.percentObra.toFixed(2)}%`} />
                            <div className="pt-1">
                                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
                                    <div className="bg-primary h-1.5 rounded-full transition-all duration-700" style={{ width: `${Math.min(metrics.cost.percentObra, 100)}%` }}></div>
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
        <div className="flex justify-between items-center py-0.5 border-b border-slate-50 dark:border-slate-900 last:border-0">
            <span className="text-xs font-medium text-slate-500 uppercase">{label}</span>
            <span className={`text-sm font-semibold ${color || 'text-slate-900 dark:text-white'}`}>{value}</span>
        </div>
    );
}

function CHORow({ label, count, days, amount, color }: { label: string, count: number, days: number, amount: string, color?: string }) {
    return (
        <div className={`grid grid-cols-4 gap-1 py-0.5 border-b border-slate-50 dark:border-slate-900 last:border-0 ${color || 'text-slate-900 dark:text-white'}`}>
            <span className="text-xs font-medium text-slate-500 uppercase">{label}</span>
            <span className="text-sm font-semibold text-center">{count}</span>
            <span className="text-sm font-semibold text-center">{days}</span>
            <span className="text-sm font-semibold text-right">{amount}</span>
        </div>
    );
}


