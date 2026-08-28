"use client";

// @UNIFICATION_RESUMEN_PACT
import { calculateSummaryMetrics } from "@/lib/projectSummary";
// @UNIFICATION_RESUMEN_PACT_END

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Clock, DollarSign, PieChart, Activity, AlertCircle, Layers, ShieldAlert, Info } from "lucide-react";
import { formatCurrency, roundedAmt, formatDate, formatNumber, getFederalSharePct, stripLeadingZeros } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";

export default function SummaryDashboard({ projectId, numAct }: { projectId?: string, numAct?: string }) {
    const { role } = useUserRole();
    const [metrics, setMetrics] = useState({
        time: { total: 0, used: 0, revised: 0, balance: 0, percent: 0 },
        dates: { start: "", original: "", revised: "", fmis: "", substantial: "", administrative: "" },
        retention: { fivePercent: 0, lastRetentionAmount: 0, extra: 0, priceAdjustment: 0, insuranceFines: 0, otherPenalties: 0, returned: 0, total: 0 },
        cost: {
            original: 0,
            revisedTotal: 0,
            certTotal: 0,
            lastCertAmount: 0,
            lastCertNum: 0,
            lastCertDate: "",
            lastCertWPDate: "",
            balance: 0,
            percentObra: 0,
            actTotal: 0,
            fhwaTotal: 0,
            actProjected: 0,
            fhwaProjected: 0,
            materialOnSite: 0,
            mosHistoricalPaid: 0,
            mosLastPaid: 0,
            mosBalances: [] as { item_num: string, balance: number, mosPU?: number }[],
            mosTotalQty: 0,
            priceAdjustment: 0,
            paidCertsTotal: 0,
            paidCertsBalance: 0,
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

    const [expiredDocs, setExpiredDocs] = useState<any[]>([]);
    const [fmisAlert, setFmisAlert] = useState<{ status: 'warning' | 'expired'; daysLeft: number } | null>(null);
    const [mounted, setMounted] = useState(false);
    const [liveIndicator, setLiveIndicator] = useState(false);
    const [showMOSDetails, setShowMOSDetails] = useState(false);
    const [internalContractItems, setInternalContractItems] = useState<any[]>([]);
    const [mfgBlockedAlerts, setMfgBlockedAlerts] = useState<any[]>([]);

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
        
        const { data: proj } = await supabase.from("projects").select("*").eq("id", projectId).single();

        const { data: complianceData } = await supabase
            .from("labor_compliance")
            .select("doc_type, date_expiry, subcontractor_name, custom_doc_name, status")
            .eq("project_id", projectId);

        const expired = (complianceData || []).filter((doc: any) => {
            if (!doc.date_expiry || doc.date_expiry === "N/A" || doc.date_expiry.toUpperCase() === "N/A") return false;
            if (doc.status === "No requerido") return false;
            
            const expiry = new Date(doc.date_expiry + "T00:00:00");
            if (isNaN(expiry.getTime())) return false;

            // Si el proyecto tiene fecha de terminación sustancial, los documentos que expiran después de la terminación sustancial no son considerados vencidos
            if (proj?.date_substantial_completion) {
                const substantialDate = new Date(proj.date_substantial_completion + "T00:00:00");
                if (!isNaN(substantialDate.getTime()) && expiry > substantialDate) {
                    return false;
                }
            }
            
            const todayLimit = new Date(todayStr + "T00:00:00");
            return expiry < todayLimit;
        });
        setExpiredDocs(expired);

        if (proj?.fmis_end_date) {
            const fmisDate = new Date(proj.fmis_end_date + "T23:59:59");
            const diffTime = fmisDate.getTime() - today.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 3600 * 24));

            if (diffDays < 0) {
                setFmisAlert({ status: 'expired', daysLeft: diffDays });
            } else if (diffDays <= 30) {
                setFmisAlert({ status: 'warning', daysLeft: diffDays });
            } else {
                setFmisAlert(null);
            }
        }

        const { data: items } = await supabase.from("contract_items").select("*").eq("project_id", projectId);
        const { data: chos } = await supabase.from("chos").select("proposed_change, doc_status, time_extension_days, items").eq("project_id", projectId);
        
        // Consolidar todos los ítems (Contrato + CHOs aprobadas) para referencia de precios y descripciones
        const allReferenceItems: any[] = [...(items || [])];
        const approvedCHOs = chos?.filter(c => c.doc_status === 'Aprobado') || [];
        approvedCHOs.forEach(cho => {
            if (Array.isArray(cho.items)) {
                cho.items.forEach((it: any) => {
                    // Evitar duplicados si el ítem ya existe (preferir el del contrato o la última CHO)
                    const exists = allReferenceItems.find(r => r.item_num === it.item_num);
                    if (!exists) allReferenceItems.push(it);
                });
            }
        });
        setInternalContractItems(allReferenceItems);

        const totalItemsCount = items?.length || 0;
        const pendingCHOs = chos?.filter(c => c.doc_status === 'En tramite') || [];

        const { data: certs } = await supabase
            .from("payment_certifications")
            .select("cert_num, cert_date, wp_up_to, items, skip_retention, show_retention_return, retention_return_amount, extra_retention, price_adjustment, insurance_fines, other_penalties, refund, excluded, liquidated_damages, is_paid")
            .eq("project_id", projectId)
            .order("cert_num", { ascending: true });

        const { data: mfgCertsData } = await supabase
            .from("manufacturing_certificates")
            .select("item_id, item_num, quantity, cert_date, validation_status")
            .eq("project_id", projectId);

        // @UNIFICATION_RESUMEN_PACT
        const calculatedMetrics = calculateSummaryMetrics(proj, items || [], chos || [], certs || []);
        setMetrics(calculatedMetrics);
        // @UNIFICATION_RESUMEN_PACT_END

        // Calculate missing manufacturing certificates for ALL certifications (paid or unpaid)
        const normalizeItemNum = (num: any) => num?.toString().replace(/^0+/, '').trim().toUpperCase();
        const mfgAlerts: any[] = [];
        const mfgCerts = (mfgCertsData || []).map(cert => {
            const contractItem = allReferenceItems.find((it: any) => it.id === cert.item_id);
            return { ...cert, _item_num: contractItem?.item_num ?? cert.item_num ?? null };
        });
        const certsList = certs || [];

        if (certsList.length > 0) {
            certsList.forEach(cert => {
                const certIdx = certsList.findIndex(c => c.cert_num === cert.cert_num);
                const itemsInCert = cert.items || [];
                const blockedItems = itemsInCert.map((it: any) => {
                    const itemNumStr = normalizeItemNum(it.item_num);
                    if (!itemNumStr) return null;
                    
                    const baseItem = allReferenceItems.find(r => normalizeItemNum(r.item_num) === itemNumStr);
                    if (!baseItem || !baseItem.requires_mfg_cert) return null;

                    const matchingItemIds = new Set(
                        allReferenceItems
                            .filter(r => normalizeItemNum(r.item_num) === itemNumStr)
                            .map(r => r.id)
                    );

                    let totalMfgApproved = 0;
                    mfgCerts.forEach((m: any) => {
                        if (m.is_multiple) {
                            let matchedId = m.item_ids?.find((id: string) => matchingItemIds.has(id));
                            if (matchedId) {
                                totalMfgApproved += parseFloat(m.multiple_quantities?.[matchedId] ?? m.quantity) || 0;
                            } else if (m._item_nums && m._item_nums.some((num: string) => normalizeItemNum(num) === itemNumStr)) {
                                totalMfgApproved += parseFloat(m.quantity) || 0; // Fallback for old items
                            }
                        } else {
                            if (matchingItemIds.has(m.item_id)) {
                                totalMfgApproved += parseFloat(m.quantity) || 0;
                            } else if (m._item_num && normalizeItemNum(m._item_num) === itemNumStr) {
                                totalMfgApproved += parseFloat(m.quantity) || 0;
                            }
                        }
                    });

                    let paidInPrevious = 0;
                    for (let i = 0; i < certIdx; i++) {
                        const prevItems = certsList[i]?.items || [];
                        const match = prevItems.find((p: any) => normalizeItemNum(p.item_num) === itemNumStr);
                        if (match) paidInPrevious += parseFloat(match.quantity) || 0;
                    }

                    const isLS = baseItem.unit?.toUpperCase() === 'LS';
                    let available = 0;
                    let qtyToPay = parseFloat(it.quantity) || 0;
                    let missing = 0;
                    let displayUnit = it.unit;
                    let isInsufficient = false;

                    if (isLS) {
                        let mfgQtyLimit = 0;
                        const contractIt = (items || []).find((it: any) => normalizeItemNum(it.item_num) === itemNumStr);
                        if (contractIt) {
                            mfgQtyLimit = parseFloat(contractIt.mfg_cert_qty) || 1;
                        }
                        
                        const approvedCHOsForMfg = chos?.filter(c => c.doc_status === 'Aprobado') || [];
                        approvedCHOsForMfg.forEach((cho: any) => {
                            const choItems = Array.isArray(cho.items) ? cho.items : (cho.items as any)?.list || [];
                            const coIt = choItems.find((cit: any) => normalizeItemNum(cit.item_num) === itemNumStr);
                            if (coIt) {
                                if (coIt.mfg_cert_qty !== undefined && coIt.mfg_cert_qty !== null && coIt.mfg_cert_qty !== '') {
                                    mfgQtyLimit = parseFloat(coIt.mfg_cert_qty) || 0;
                                } else if (!contractIt && mfgQtyLimit === 0) {
                                    mfgQtyLimit = 1;
                                }
                            }
                        });
                        
                        if (mfgQtyLimit <= 0) mfgQtyLimit = 1;
                        const totalMfgApprovedScaled = totalMfgApproved * (100 / mfgQtyLimit);
                        const availablePct = totalMfgApprovedScaled - paidInPrevious;
                        
                        if (qtyToPay > availablePct + 0.001) {
                            isInsufficient = true;
                            const missingScaled = qtyToPay - availablePct;
                            missing = missingScaled * (mfgQtyLimit / 100);
                            available = totalMfgApproved - (paidInPrevious * (mfgQtyLimit / 100));
                            qtyToPay = qtyToPay * (mfgQtyLimit / 100);
                            displayUnit = 'CM';
                        }
                    } else {
                        available = totalMfgApproved - paidInPrevious;
                        if (qtyToPay > available + 0.001) {
                            isInsufficient = true;
                            missing = qtyToPay - available;
                        }
                    }

                    if (isInsufficient) {
                        return {
                            item_num: it.item_num,
                            unit: displayUnit,
                            qtyToPay,
                            available,
                            missing,
                            isPaid: cert.is_paid || false
                        };
                    }
                    return null;
                }).filter(Boolean);

                if (blockedItems.length > 0) {
                    mfgAlerts.push({
                        cert_num: cert.cert_num,
                        items: blockedItems
                    });
                }
            });
        }
        setMfgBlockedAlerts(mfgAlerts);
    };

    if (!mounted) return null;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col gap-2">
                <div className="w-full flex justify-center mb-2">
                    <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-100 rounded-xl">
                        <Info size={28} className="text-blue-600 shrink-0" />
                        <span className="text-[28px] font-black text-blue-600 uppercase">AQUI SE ENCUENTRA LA PRINCIPAL INFORMACION DEL PROYECTO</span>
                    </div>
                </div>
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <Activity className="text-primary" size={24} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-slate-950 dark:text-white">Resumen</span>
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

            {expiredDocs.length > 0 && (
                <div className="flex flex-col gap-3 p-4 rounded-xl border bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300 shadow-sm">
                    <div className="flex items-center gap-3">
                        <ShieldAlert className="text-red-600 dark:text-red-400 shrink-0 animate-pulse" size={22} />
                        <div className="flex-1">
                            <p className="text-sm font-black text-red-900 dark:text-red-200">
                                🚨 ¡CUMPLIMIENTO LABORAL! Se detectaron {expiredDocs.length} {expiredDocs.length === 1 ? 'documento vencido' : 'documentos vencidos'}.
                            </p>
                        </div>
                    </div>
                    <div className="pl-9 space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                        {expiredDocs.map((doc, idx) => {
                            const docNameDetail = doc.doc_type === "Otros" ? (doc.custom_doc_name || "Otros") : doc.doc_type;
                            const displayName = doc.subcontractor_name 
                                ? `${docNameDetail} (${doc.subcontractor_name})` 
                                : docNameDetail;
                            return (
                                <div key={idx} className="flex flex-col sm:flex-row sm:justify-between text-xs font-bold gap-1 sm:gap-4 border-b border-red-100 dark:border-red-900/10 pb-1 last:border-0 last:pb-0">
                                    <span className="text-slate-800 dark:text-slate-200">• {displayName}</span>
                                    <span className="text-red-700 dark:text-red-400 font-extrabold whitespace-nowrap">
                                        (Venció el {formatDate(doc.date_expiry)})
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {mfgBlockedAlerts.length > 0 && (
                <div className="flex flex-col gap-3 p-4 rounded-xl border bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-300 shadow-sm">
                    <div className="flex items-center gap-3">
                        <AlertCircle className="text-orange-600 dark:text-orange-400 shrink-0 animate-pulse" size={22} />
                        <div className="flex-1">
                            <p className="text-sm font-black text-orange-900 dark:text-orange-200">
                                🚨 ¡CERTIFICADOS DE MANUFACTURA INSUFICIENTES!
                            </p>
                        </div>
                    </div>
                    <div className="pl-9 space-y-3 max-h-60 overflow-y-auto custom-scrollbar">
                        {mfgBlockedAlerts.map((alert, idx) => (
                            <div key={idx} className="space-y-1.5">
                                <p className="text-xs font-black text-orange-800 dark:text-orange-300">
                                    En la Certificación de Pago #{alert.cert_num}:
                                </p>
                                {alert.items.map((it: any, i: number) => (
                                    <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-[10px] font-bold text-orange-700 dark:text-orange-400">
                                        <span className="bg-orange-100 dark:bg-orange-900/40 px-1.5 py-0.5 rounded font-black whitespace-nowrap">Partida {stripLeadingZeros(it.item_num)}</span>
                                        <span className="leading-tight">
                                            {it.isPaid ? 'Ya se pagó' : 'Se quiere pagar'} <span className="font-black">{formatNumber(it.qtyToPay)} {it.unit}</span>, pero solo hay <span className="font-black">{formatNumber(it.available)} {it.unit}</span> con CM aprobado.
                                        </span>
                                        <span className="bg-orange-200 dark:bg-orange-800 px-1.5 py-0.5 rounded font-black text-orange-800 dark:text-orange-200 whitespace-nowrap sm:ml-auto">
                                            Faltan {formatNumber(it.missing)} {it.unit}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="card border-t-4 border-t-blue-500">
                    <div className="flex items-center gap-2 text-blue-700 font-bold mb-4 uppercase text-xs tracking-wider">
                        <Clock size={16} /> FECHAS CLAVE
                    </div>
                    <div className="space-y-1">
                        <MetricRow label="Comienzo" value={formatDate(metrics.dates.start)} tooltip="Fecha oficial en que inician los trabajos del proyecto." />
                        <MetricRow label="Terminacion Original" value={formatDate(metrics.dates.original)} tooltip="Fecha prevista de finalización según el contrato original." />
                        <MetricRow label="Terminacion Revisada" value={formatDate(metrics.dates.revised)} color="text-blue-700 font-bold" tooltip="Nueva fecha de finalización incluyendo extensiones de tiempo aprobadas." />
                        <MetricRow label="Terminacion Sustancial" value={formatDate(metrics.dates.substantial)} tooltip="Fecha en que la obra está suficientemente completa para ser utilizada para su propósito previsto." />
                        <MetricRow label="Terminacion Administrativa" value={formatDate(metrics.dates.administrative)} color="text-amber-800 font-bold" tooltip="Fecha en que se completan todos los trámites y cierre de documentos del proyecto." />
                        <MetricRow label="FMIS End Date" value={formatDate(metrics.dates.fmis)} color="text-emerald-700" tooltip="Fecha límite del sistema financiero federal (FMIS) para los fondos del proyecto." />
                        <hr className="my-2 border-slate-200 dark:border-slate-800" />
                        <MetricRow label="Dias Contrato" value={`${formatNumber(metrics.time.total, 0)} dias`} tooltip="Número total de días establecidos en el contrato original." />
                        <MetricRow label="Dias Revisados (Original + CHO)" value={`${formatNumber(metrics.time.revised, 0)} dias`} tooltip="Días totales del contrato sumando los días originales más los días otorgados por órdenes de cambio (CHO)." />
                        <MetricRow label="Tiempo transcurrido a la fecha" value={`${formatNumber(metrics.time.used, 0)} dias`} tooltip="Cantidad de días que han pasado desde la fecha de comienzo hasta el día de hoy." />
                        <MetricRow label="Balance de dias" value={`${formatNumber(metrics.time.balance, 0)} dias`} color={metrics.time.balance < 0 ? "text-red-700 font-bold" : "text-emerald-700 font-bold"} tooltip="Días restantes para la terminación del proyecto (Días revisados menos tiempo transcurrido)." />
                    </div>
                </div>

                <div className="card border-t-4 border-t-emerald-500">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 text-emerald-700 font-bold uppercase text-xs tracking-wider">
                            <DollarSign size={16} /> COSTOS Y PAGOS
                        </div>
                    </div>
                    <div className="space-y-1">
                        <MetricRow label="Costo Original" value={formatCurrency(metrics.cost.original)} tooltip="Monto total del contrato según fue adjudicado originalmente." />
                        <MetricRow label="Costo ajustado (Revisado)" value={formatCurrency(metrics.cost.original + metrics.chos.approvedTotal)} color="text-emerald-700 font-bold" tooltip="Costo original más el total de órdenes de cambio (CHO) aprobadas." />
                        <MetricRow label="Certified to date (WP)" value={formatCurrency(metrics.cost.certTotal)} color="text-emerald-700" tooltip="Monto total certificado para pago hasta la fecha según el Work Performed (WP)." />
                        {metrics.cost.lastCertDate && (
                            <div className="ml-2 pl-2 border-l-2 border-emerald-200 dark:border-emerald-800 py-1">
                                <div className="flex justify-between items-center">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Última Cert #{metrics.cost.lastCertNum}</span>
                                    <span className="text-[10px] font-bold text-emerald-600">{formatDate(metrics.cost.lastCertDate)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                        MONTO (WP) {metrics.cost.lastCertWPDate ? formatDate(metrics.cost.lastCertWPDate) : ''}
                                    </span>
                                    <span className="text-[10px] font-bold text-emerald-600">{formatCurrency(metrics.cost.lastCertAmount)}</span>
                                </div>
                            </div>
                        )}
                        <MetricRow label="Balance actual (remaining)" value={formatCurrency(metrics.cost.balance)} color="text-blue-800 dark:text-blue-300 font-black" tooltip="Diferencia entre el costo revisado y el monto ya certificado. Lo que falta por certificar." />
                        <MetricRow
                            label="Balance certs. pagadas"
                            value={formatCurrency(metrics.cost.paidCertsTotal)}
                            color="text-emerald-700 dark:text-emerald-400 font-bold"
                            tooltip="Suma total de las certificaciones que ya han sido marcadas como pagadas."
                        />
                        
                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-help" title="Porcentaje del monto de obra ejecutado respecto al costo revisado total del contrato.">% DE OBRA EJECUTADA:</span>
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
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-help" title="Porcentaje de tiempo transcurrido del contrato respecto a los días revisados totales.">Progreso del tiempo transcurrido:</span>
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
                                <span className="cursor-help" title="Monto certificado y proyectado correspondiente a fondos federales FHWA.">TOTAL FHWA:</span>
                                <span>{formatCurrency(metrics.cost.fhwaTotal)} / {formatCurrency(metrics.cost.fhwaProjected)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="cursor-help" title="Monto certificado y proyectado correspondiente a fondos locales ACT.">TOTAL ACT:</span>
                                <span>{formatCurrency(metrics.cost.actTotal)} / {formatCurrency(metrics.cost.actProjected)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card border-t-4 border-t-blue-500">
                    <div className="flex items-center gap-2 text-blue-700 font-bold mb-4 uppercase text-xs tracking-wider">
                        <Layers size={16} /> MATERIAL ON SITE
                    </div>
                    <div className="space-y-3">
                        <MetricRow label="Balance Pagado Hasta la Fecha" value={formatCurrency(metrics.cost.mosHistoricalPaid)} color="text-slate-950 dark:text-white font-bold" tooltip="Total histórico pagado como Material on Site (materiales almacenados en obra antes de ser instalados)." />
                        <MetricRow label="Total MOS Ejecutado" value={formatCurrency(metrics.cost.mosHistoricalPaid - metrics.cost.materialOnSite)} color="text-emerald-700" tooltip="Monto de Material on Site que ya fue incorporado a la obra y certificado en trabajo ejecutado." />
                        <hr className="my-2 border-slate-200 dark:border-slate-800" />
                        <MetricRow label="Balance Actual" value={formatCurrency(metrics.cost.materialOnSite)} color="text-blue-800 dark:text-blue-400 font-black text-sm" tooltip="Saldo de materiales almacenados en sitio que aún no se han incorporado a la obra (pendiente de ejecutar)." />
                    </div>
                </div>

                <div className="card border-t-4 border-t-amber-500">
                    <div className="flex items-center gap-2 text-amber-700 font-bold mb-4 uppercase text-xs tracking-wider">
                        <PieChart size={16} /> CHANGE ORDERS
                    </div>
                    <div className="space-y-3">
                        <div className="grid grid-cols-[24%_12%_16%_48%] gap-1 items-end text-[9px] font-black text-slate-500 uppercase pb-1 border-b border-slate-200 dark:border-slate-800">
                            <span></span>
                            <span className="text-center" title="Número de órdenes de cambio">#</span>
                            <span className="text-center leading-tight cursor-help" title="Días de extensión de tiempo otorgados por las órdenes de cambio.">Dias<br/>Otorg.</span>
                            <span className="text-right cursor-help" title="Monto económico total de las órdenes de cambio.">$</span>
                        </div>
                        <CHORow label="Aprobados" count={metrics.chos.approvedCount} days={metrics.chos.approvedDays} amount={formatCurrency(metrics.chos.approvedTotal)} color="text-emerald-800 dark:text-emerald-400" tooltip="Órdenes de cambio formalmente aprobadas que ya forman parte del contrato revisado." />
                        <CHORow label="En Tramite" count={metrics.chos.pendingCount} days={metrics.chos.pendingDays} amount={formatCurrency(metrics.chos.pendingTotal)} color="text-amber-800 dark:text-amber-400" tooltip="Órdenes de cambio propuestas que están en proceso de revisión y aprobación." />
                        <CHORow label="Resumen" count={metrics.chos.approvedCount + metrics.chos.pendingCount} days={metrics.chos.totalDays} amount={formatCurrency(metrics.chos.total)} color="font-black text-slate-950 dark:text-white" tooltip="Total combinado de todas las órdenes de cambio (aprobadas + en trámite)." />
                        <hr className="my-2 border-slate-200 dark:border-slate-800" />
                        <MetricRow label="% de Cambio (Costo)" value={`${metrics.chos.percentChange}%`} color="text-amber-800 font-bold" tooltip="Porcentaje que representan las CHO aprobadas respecto al costo original del contrato." />
                        <MetricRow label="% de Cambio (Dias)" value={`${metrics.chos.percentDays}%`} color="text-amber-700" tooltip="Porcentaje que representan los días de extensión otorgados respecto a los días originales del contrato." />
                    </div>
                </div>

                <div className="card border-t-4 border-t-violet-500">
                    <div className="flex items-center gap-2 text-violet-700 font-bold mb-4 uppercase text-xs tracking-wider">
                        <Layers size={16} /> RETENCIONES Y OTROS
                    </div>
                    <div className="space-y-1">
                        <MetricRow label="Retencion 5% ($) (-)" value={formatCurrency(metrics.retention.fivePercent)} tooltip="Monto total retenido al contratista (5% del monto certificado) como garantía de calidad de la obra." />
                        {metrics.cost.lastCertDate && (
                            <div className="ml-2 pl-2 border-l-2 border-violet-200 dark:border-violet-800 py-1 mb-1">
                                <div className="flex justify-between items-center">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Last retention #{metrics.cost.lastCertNum}</span>
                                    <span className="text-[10px] font-bold text-violet-600">{formatDate(metrics.cost.lastCertDate)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Monto</span>
                                    <span className="text-[10px] font-bold text-violet-600">{formatCurrency(metrics.retention.lastRetentionAmount)}</span>
                                </div>
                            </div>
                        )}
                        <MetricRow label="Retención Extra ($) (-)" value={formatCurrency(metrics.retention.extra)} color={metrics.retention.extra > 0 ? "text-amber-700 font-bold" : ""} tooltip="Retención adicional aplicada por encima del 5% estándar, según condiciones especiales del contrato." />
                        <MetricRow label="Ajuste de Precio ($) (+)" value={formatCurrency(metrics.retention.priceAdjustment)} color={metrics.retention.priceAdjustment > 0 ? "text-emerald-700 font-bold" : ""} tooltip="Compensación por variación en costos de materiales u otros factores económicos reconocidos en el contrato." />
                        <MetricRow label="Multas Seguro ($) (-)" value={formatCurrency(metrics.retention.insuranceFines)} color={metrics.retention.insuranceFines > 0 ? "text-red-700" : ""} tooltip="Penalidades aplicadas por incumplimiento en los requisitos de seguro del contratista." />
                        <MetricRow label="Otras Penalidades ($) (-)" value={formatCurrency(metrics.retention.otherPenalties)} color={metrics.retention.otherPenalties > 0 ? "text-red-700" : ""} tooltip="Penalidades diversas no clasificadas en otra categoría, aplicadas al contratista." />
                        <MetricRow label="Daños Liquidos (DLQ) ($) (-)" value={formatCurrency(metrics.penalties.liquidated)} color={metrics.penalties.liquidated > 0 ? "text-red-700 font-bold" : ""} tooltip="Multas por atraso en la terminación del proyecto, calculadas diariamente según el contrato." />
                        
                        <hr className="my-1 border-slate-100 dark:border-slate-800" />
                        <MetricRow label="Reembolso Retención ($) (+)" value={metrics.retention.returned > 0 ? `+${formatCurrency(metrics.retention.returned)}` : formatCurrency(0)} color="text-emerald-700" tooltip="Monto de retención devuelto al contratista, usualmente al completar hitos importantes de la obra." />
                        <MetricRow label="Reembolso Penalidades ($) (+)" value={metrics.penalties.dlqReimbursement > 0 ? `+${formatCurrency(metrics.penalties.dlqReimbursement)}` : formatCurrency(0)} color="text-emerald-700" tooltip="Devolución de daños líquidos u otras penalidades previamente cobradas, aprobadas mediante resolución." />

                        <hr className="my-2 border-slate-200 dark:border-slate-800" />
                        <MetricRow label="Retenciones y Penalidades" value={formatCurrency(metrics.retention.total)} color="text-violet-800 dark:text-violet-400 font-bold" tooltip="Suma neta de todas las retenciones y penalidades aplicadas, menos los reembolsos recibidos." />
                        <MetricRow label="Net Paid" value={formatCurrency(roundedAmt(metrics.cost.certTotal - metrics.retention.total, 2))} color="text-emerald-700 dark:text-emerald-400 font-bold" tooltip="Monto neto efectivamente pagado al contratista (monto certificado menos retenciones y penalidades)." />
                    </div>
                </div>

                <div className="card border-t-4 border-t-emerald-500 bg-amber-50/10 dark:bg-amber-900/5">
                    <div className="flex items-center gap-2 text-emerald-700 font-bold mb-2 uppercase text-xs tracking-wider">
                        <Activity size={16} /> LIQUIDACION
                    </div>
                    <div className="space-y-1">
                        <div className="flex justify-between items-center py-1">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block cursor-help" title="Número de partidas del contrato que ya tienen las tres firmas de cierre requeridas (Admin, Contratista y Liquidador).">Items con Cierre:</span>
                            <span className="text-sm font-black">{metrics.liquidation.adminSigned} / {metrics.liquidation.totalItems}</span>
                        </div>
                        <div className="mt-2 mb-4">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-help" title="Porcentaje de firmas de liquidación recolectadas sobre el total requerido (3 firmas × total de items).">% FIRMAS RECOLECTADAS:</span>
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
                                <div className="text-[7px] font-bold text-slate-400 uppercase cursor-help" title="Número de items firmados por el Administrador del contrato.">Admin</div>
                            </div>
                            <div className="text-center border-x border-slate-100 dark:border-slate-800">
                                <div className="text-[10px] font-black text-emerald-600">{metrics.liquidation.contractorSignedCount}</div>
                                <div className="text-[7px] font-bold text-slate-400 uppercase cursor-help" title="Número de items firmados por el Contratista.">Contr</div>
                            </div>
                            <div className="text-center">
                                <div className="text-[10px] font-black text-emerald-600">{metrics.liquidation.liquidatorSignedCount}</div>
                                <div className="text-[7px] font-bold text-slate-400 uppercase cursor-help" title="Número de items firmados por el Liquidador.">Liq</div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1 cursor-help" title="Lista de documentos de cierre federal que han sido marcados como recibidos en el proyecto.">Documentos de Cierre Recibidos:</span>
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

            {role === 'A' && (
                <div className="card bg-slate-900 text-white border-none overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                        <ShieldAlert size={120} />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 text-blue-400 font-bold mb-4 uppercase text-xs tracking-widest">
                            <ShieldAlert size={16} /> PANEL DE ADMINISTRACIÓN (SUPABASE)
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <p className="text-slate-400 text-[10px] uppercase font-black tracking-widest mb-1">Última Actividad del Sistema:</p>
                                <p className="text-xl font-black text-white">{new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                                <p className="text-[10px] text-blue-400 font-bold mt-1">Conexión saludable con dtpfhwxwodzpitzmrbqr</p>
                            </div>
                            <div>
                                <p className="text-slate-400 text-[10px] uppercase font-black tracking-widest mb-1">Cuota de Almacenamiento (DB):</p>
                                <div className="flex items-end gap-2">
                                    <p className="text-xl font-black text-white">49 MB <span className="text-slate-500 text-sm">/ 500 MB</span></p>
                                    <p className="text-xs font-bold text-emerald-400 mb-1">(9.8% utilizado)</p>
                                </div>
                                <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
                                    <div className="h-full bg-blue-500" style={{ width: '9.8%' }} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function MetricRow({ label, value, color, tooltip }: { label: string, value: string | number, color?: string, tooltip?: string }) {
    return (
        <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
            <span className={`text-[11px] font-black text-slate-800 dark:text-slate-300 uppercase tracking-tight ${tooltip ? 'cursor-help' : ''}`} title={tooltip}>{label}</span>
            <span className={`text-sm font-black ${color || 'text-slate-950 dark:text-white'}`}>{value}</span>
        </div>
    );
}

function CHORow({ label, count, days, amount, color, tooltip }: { label: string, count: number, days: number, amount: string, color?: string, tooltip?: string }) {
    return (
        <div className={`grid grid-cols-[24%_12%_16%_48%] gap-1 items-center py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0 ${color || 'text-slate-950 dark:text-white'}`}>
            <span className={`text-[10px] font-black text-slate-800 dark:text-slate-300 uppercase tracking-tighter leading-none break-words ${tooltip ? 'cursor-help' : ''}`} title={tooltip}>{label}</span>
            <span className="text-sm font-black text-center">{count}</span>
            <span className="text-sm font-black text-center">{days}</span>
            <span className="text-[13px] font-black text-right tracking-tight truncate">{amount}</span>
        </div>
    );
}
