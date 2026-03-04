"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Clock, DollarSign, PieChart, Activity, AlertCircle, Download, Layers, ShieldAlert } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function SummaryDashboard({ projectId }: { projectId?: string }) {
    const [metrics, setMetrics] = useState({
        time: { total: 0, used: 0, revised: 0, balance: 0, percent: 0 },
        dates: { start: "", original: "", revised: "", fmis: "" },
        cost: {
            original: 0,
            certTotal: 0,
            lastCertAmount: 0,
            lastCertNum: 0,
            balance: 0,
            percentObra: 0,
            actTotal: 0,
            fhwaTotal: 0,
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
        retention: { fivePercent: 0, extra: 0, returned: 0, total: 0 }
    });

    const [expiredDocs, setExpiredDocs] = useState<{ doc_type: string; date_expiry: string }[]>([]);

    useEffect(() => {
        if (projectId) fetchAllData();
    }, [projectId]);

    const fetchAllData = async () => {
        // 0. Fetch expired compliance documents
        const today = new Date().toISOString().split("T")[0];
        const { data: complianceData } = await supabase
            .from("labor_compliance")
            .select("doc_type, date_expiry")
            .eq("project_id", projectId)
            .not("date_expiry", "is", null)
            .lt("date_expiry", today);
        setExpiredDocs(complianceData || []);

        // 1. Fetch Project
        const { data: proj } = await supabase.from("projects").select("*").eq("id", projectId).single();

        // 2. Fetch Items
        const { data: items } = await supabase.from("contract_items").select("quantity, unit_price").eq("project_id", projectId);

        // 3. Fetch CHOs
        const { data: chos } = await supabase.from("chos").select("proposed_change, doc_status, time_extension_days").eq("project_id", projectId);

        // 4. Fetch Payment Certifications
        const { data: certs } = await supabase
            .from("payment_certifications")
            .select("cert_num, cert_date, items, skip_retention, show_retention_return, retention_return_amount")
            .eq("project_id", projectId)
            .order("cert_num", { ascending: true });

        const originalCost = proj?.cost_original || items?.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0) || 0;

        // CHO calculations
        const approvedCHOs = chos?.filter(c => c.doc_status === 'Aprobado') || [];
        const pendingCHOs = chos?.filter(c => c.doc_status === 'En trámite') || [];

        const approvedCHO = approvedCHOs.reduce((acc, c) => acc + parseFloat(c.proposed_change || '0'), 0);
        const pendingCHO = pendingCHOs.reduce((acc, c) => acc + parseFloat(c.proposed_change || '0'), 0);
        const approvedDays = approvedCHOs.reduce((acc, c) => acc + (c.time_extension_days || 0), 0);
        const pendingDays = pendingCHOs.reduce((acc, c) => acc + (c.time_extension_days || 0), 0);

        // Calculate total certified amounts split by fund source
        let actTotal = 0;
        let fhwaTotal = 0;
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
                const amount = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
                const source = item.fund_source || "";

                let itemAmount = 0;
                if (source === "FHWA:80.25") {
                    fhwaTotal += amount * 0.8025;
                    actTotal += amount * (1 - 0.8025);
                    itemAmount = amount;
                } else if (source === "FHWA:100%") {
                    fhwaTotal += amount;
                    itemAmount = amount;
                } else {
                    actTotal += amount;
                    itemAmount = amount;
                }
                certAmount += itemAmount;

                // MOS balance: track material on site added and used
                if (item.has_material_on_site) {
                    // This cert uses materials from MOS → deduct from balance
                    const usedFromMOS = (parseFloat(item.qty_from_mos) || 0) * (parseFloat(item.mos_unit_price) || 0);
                    mosBalance -= usedFromMOS;
                }
                if (parseFloat(item.mos_invoice_total) > 0 && !item.has_material_on_site) {
                    // MOS was invoiced (added to site) → add to balance
                    mosBalance += parseFloat(item.mos_invoice_total) || 0;
                }
            });

            // Track last cert
            if ((cert.cert_num || 0) > lastCertNum) {
                lastCertNum = cert.cert_num;
                lastCertAmount = certAmount;
            }

            // Retention
            if (!cert.skip_retention) {
                totalRetentionDeducted += certAmount * 0.05;
            }
            if (cert.show_retention_return && cert.retention_return_amount) {
                totalRetentionReturned += parseFloat(cert.retention_return_amount) || 0;
            }
        });

        const certified = actTotal + fhwaTotal;
        const ret5 = totalRetentionDeducted;
        const retNet = ret5 - totalRetentionReturned;

        // Time calculations
        const startDate = proj?.date_project_start ? new Date(proj.date_project_start) : new Date();
        const origEndDate = proj?.date_orig_completion ? new Date(proj.date_orig_completion) : new Date();
        const totalDays = Math.ceil((origEndDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)) + 1;
        // El tiempo usado se detiene en la fecha de terminación sustancial (si existe); si no, usa hoy
        const timeEndDate = proj?.date_substantial_completion
            ? new Date(proj.date_substantial_completion)
            : new Date();
        const usedDays = Math.ceil((timeEndDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)) + 1;
        const revisedDays = (totalDays || 0) + approvedDays;

        const liqDamages = usedDays > revisedDays ? (usedDays - revisedDays) * 500 : 0;

        const formatDate = (dateStr: string) => {
            if (!dateStr) return "N/A";
            const date = new Date(dateStr);
            return date.toLocaleDateString('es-PR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        };

        setMetrics({
            time: {
                total: totalDays,
                used: usedDays > 0 ? usedDays : 0,
                revised: revisedDays,
                balance: revisedDays - usedDays,
                percent: revisedDays > 0 ? Math.round((usedDays / revisedDays) * 100) : 0
            },
            dates: {
                start: formatDate(proj?.date_project_start),
                original: formatDate(proj?.date_orig_completion),
                revised: formatDate(proj?.date_rev_completion),
                fmis: formatDate(proj?.fmis_end_date)
            },
            cost: {
                original: originalCost,
                certTotal: certified,
                lastCertAmount,
                lastCertNum,
                balance: (originalCost + approvedCHO) - certified,
                percentObra: (originalCost + approvedCHO) > 0 ? Math.round((certified / (originalCost + approvedCHO)) * 100) : 0,
                actTotal,
                fhwaTotal,
                materialOnSite: Math.max(mosBalance, 0),
                priceAdjustment: 0,
            },
            chos: {
                approvedTotal: approvedCHO,
                approvedCount: approvedCHOs.length,
                approvedDays,
                pendingTotal: pendingCHO,
                pendingCount: pendingCHOs.length,
                pendingDays,
                total: approvedCHO + pendingCHO,
                totalDays: approvedDays + pendingDays,
                percentChange: originalCost > 0 ? Math.round((approvedCHO / originalCost) * 100) : 0,
                percentDays: totalDays > 0 ? Math.round((approvedDays / totalDays) * 100) : 0,
            },
            penalties: {
                liquidated: liqDamages,
                dlqReimbursement: 0,
                security: 0,
                others: 0,
                total: liqDamages
            },
            retention: {
                fivePercent: ret5,
                extra: extraRetention,
                returned: totalRetentionReturned,
                total: retNet
            }
        });
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Activity className="text-primary" />
                    13. Interfaz Resumen de Información Principal
                </h2>
                <div className="flex gap-4 items-center">
                    <button
                        onClick={() => {
                            import("@/lib/reportLogic").then(mod => mod.generateDashboardReportLogic(projectId!));
                        }}
                        className="flex items-center gap-2 text-sm font-bold bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-400 px-3 py-1.5 rounded-md transition-colors"
                    >
                        <Download size={16} /> Descargar (PDF)
                    </button>
                    <button className="text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline" onClick={fetchAllData}>Actualizar Datos</button>
                </div>
            </div>

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
                            const expiryFormatted = new Date(doc.date_expiry + "T00:00:00").toLocaleDateString("es-PR", {
                                day: "2-digit", month: "2-digit", year: "numeric"
                            });
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
                    <div className="flex items-center gap-2 text-blue-600 font-bold mb-4 uppercase text-xs tracking-wider">
                        <Clock size={16} /> TIEMPO
                    </div>
                    <div className="space-y-3">
                        <MetricRow label="Comienzo Proyecto" value={metrics.dates.start} color="text-slate-600" />
                        <MetricRow label="Terminación Original" value={metrics.dates.original} color="text-slate-600" />
                        <MetricRow label="Terminación Revisada" value={metrics.dates.revised} color="text-slate-600" />
                        <MetricRow label="FMIS End Date" value={metrics.dates.fmis} color="text-emerald-600" />
                        <hr className="my-2 border-slate-100 dark:border-slate-800" />
                        <MetricRow label="Tiempo Contrato" value={`${metrics.time.total} días`} />
                        <MetricRow label="Tiempo Revisado" value={`${metrics.time.revised} días`} />
                        <MetricRow label="Tiempo Usado" value={`${metrics.time.used} días`} />
                        <MetricRow label="Balance de Tiempo" value={`${metrics.time.balance} días`} color={metrics.time.balance < 0 ? "text-red-600 font-bold" : "text-emerald-600 font-bold"} />
                        <div className="pt-2">
                            <div className="flex justify-between text-xs mb-1">
                                <span>Progreso de Tiempo</span>
                                <span>{metrics.time.percent}%</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
                                <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min(metrics.time.percent, 100)}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* CHANGE ORDERS */}
                <div className="card border-t-4 border-t-amber-500">
                    <div className="flex items-center gap-2 text-amber-600 font-bold mb-4 uppercase text-xs tracking-wider">
                        <PieChart size={16} /> CHANGE ORDERS
                    </div>
                    <div className="space-y-1">
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
                    <div className="flex items-center gap-2 text-violet-600 font-bold mb-4 uppercase text-xs tracking-wider">
                        <Layers size={16} /> RETENCIÓN
                    </div>
                    <div className="space-y-3">
                        <MetricRow label="5% Retenido" value={formatCurrency(metrics.retention.fivePercent)} />
                        <MetricRow label="Extra Retenido" value={formatCurrency(metrics.retention.extra)} />
                        <MetricRow label="Retención Devuelta" value={formatCurrency(metrics.retention.returned)} color="text-emerald-600" />
                        <hr className="my-2 border-slate-100 dark:border-slate-800" />
                        <MetricRow label="Total Retenido (Neto)" value={formatCurrency(metrics.retention.total)} color="text-violet-700 dark:text-violet-400 font-bold" />
                    </div>
                </div>

                {/* PENALIDADES */}
                <div className="card border-t-4 border-t-red-500">
                    <div className="flex items-center gap-2 text-red-600 font-bold mb-4 uppercase text-xs tracking-wider">
                        <AlertCircle size={16} /> PENALIDADES
                    </div>
                    <div className="space-y-3">
                        <MetricRow label="Daños Líquidos (Dlq)" value={formatCurrency(metrics.penalties.liquidated)} color={metrics.penalties.liquidated > 0 ? "text-red-600 font-bold" : ""} />
                        <MetricRow label="Reembolso (Dlq)" value={formatCurrency(metrics.penalties.dlqReimbursement)} color="text-emerald-600" />
                        <MetricRow label="Multas Seguridad" value={formatCurrency(metrics.penalties.security)} />
                        <MetricRow label="Otras Penalidades" value={formatCurrency(metrics.penalties.others)} />
                        <hr className="my-2 border-slate-100 dark:border-slate-800" />
                        <MetricRow label="Total Penalidades" value={formatCurrency(metrics.penalties.total)} color="text-red-700 font-bold" />
                    </div>
                </div>

                {/* COSTOS PROYECTO — wide card */}
                <div className="card border-t-4 border-t-primary md:col-span-2 lg:col-span-2">
                    <div className="flex items-center gap-2 text-primary font-bold mb-6 uppercase text-xs tracking-wider">
                        <DollarSign size={16} /> COSTOS Y LIQUIDACIÓN
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-12 gap-y-6">
                        {/* Columna 1: Costos principales */}
                        <div className="space-y-3">
                            <MetricRow label="Costo Original" value={formatCurrency(metrics.cost.original)} />
                            <MetricRow label="Costo Proyecto (Revisado)" value={formatCurrency(metrics.cost.original + metrics.chos.approvedTotal)} color="text-slate-900 dark:text-white font-bold" />
                            <MetricRow label={`Últ. Certificación #${metrics.cost.lastCertNum} (WP)`} value={formatCurrency(metrics.cost.lastCertAmount)} color="text-primary" />
                            <MetricRow label="Total Certificado (WP)" value={formatCurrency(metrics.cost.certTotal)} color="text-primary font-bold" />
                        </div>
                        {/* Columna 2: Deducciones y material */}
                        <div className="space-y-3">
                            <MetricRow label="Material en Sitio (MOS)" value={formatCurrency(metrics.cost.materialOnSite)} color="text-amber-600" />
                            <MetricRow label="5% Retenido" value={formatCurrency(metrics.retention.fivePercent)} />
                            <MetricRow label="Extra Retenido" value={formatCurrency(metrics.retention.extra)} />
                            <MetricRow label="Cláusula Ajuste Precio" value={formatCurrency(metrics.cost.priceAdjustment)} />
                            <MetricRow label="Multas Seguridad" value={formatCurrency(metrics.penalties.security)} />
                            <MetricRow label="Otras Penalidades" value={formatCurrency(metrics.penalties.others)} />
                            <MetricRow label="Daños Líquidos (Dlq)" value={formatCurrency(metrics.penalties.liquidated)} color={metrics.penalties.liquidated > 0 ? "text-red-600" : ""} />
                            <MetricRow label="Reembolso (Dlq)" value={formatCurrency(metrics.penalties.dlqReimbursement)} color="text-emerald-600" />
                        </div>
                        {/* Columna 3: Balance y origen de fondos */}
                        <div className="space-y-3">
                            <MetricRow label="Balance Actual" value={formatCurrency(metrics.cost.balance)} color="text-blue-700 dark:text-blue-400 font-bold" />
                            <hr className="my-1 border-slate-100 dark:border-slate-800" />
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Origen de Fondos</p>
                            <MetricRow label="ACT (PRHTA)" value={formatCurrency(metrics.cost.actTotal)} color="text-emerald-600" />
                            <MetricRow label="FHWA" value={formatCurrency(metrics.cost.fhwaTotal)} color="text-blue-600" />
                            <hr className="my-1 border-slate-100 dark:border-slate-800" />
                            <MetricRow label="% de Obra Exec. (WP)" value={`${metrics.cost.percentObra}%`} />
                            <div className="pt-1">
                                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
                                    <div className="bg-primary h-1.5 rounded-full" style={{ width: `${Math.min(metrics.cost.percentObra, 100)}%` }}></div>
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
        <div className="flex justify-between items-center py-2 border-b border-slate-50 dark:border-slate-900 last:border-0">
            <span className="text-xs font-medium text-slate-500 uppercase">{label}</span>
            <span className={`text-sm font-semibold ${color || 'text-slate-900 dark:text-white'}`}>{value}</span>
        </div>
    );
}

function CHORow({ label, count, days, amount, color }: { label: string, count: number, days: number, amount: string, color?: string }) {
    return (
        <div className={`grid grid-cols-4 gap-1 py-2 border-b border-slate-50 dark:border-slate-900 last:border-0 ${color || 'text-slate-900 dark:text-white'}`}>
            <span className="text-xs font-medium text-slate-500 uppercase">{label}</span>
            <span className="text-sm font-semibold text-center">{count}</span>
            <span className="text-sm font-semibold text-center">{days}</span>
            <span className="text-sm font-semibold text-right">{amount}</span>
        </div>
    );
}
