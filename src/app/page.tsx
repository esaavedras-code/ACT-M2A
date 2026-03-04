"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Plus, ArrowRight, Clock, Percent, DollarSign, Activity, FileText, Download, FolderSearch } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { exportProjectToFile } from "@/lib/projectFileSystem";

export default function Dashboard() {
    const [stats, setStats] = useState({
        totalProjects: 0,
        totalBudget: 0,
        totalCertified: 0,
        totalPendingCHO: 0,
        avgProgress: 0,
        actTotal: 0,
        fhwaTotal: 0,
        totalBalance: 0,
        recentProjects: [] as any[]
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        setLoading(true);

        const registrationStr = localStorage.getItem("pact_registration");
        const registration = registrationStr ? JSON.parse(registrationStr) : null;
        const allowedIds = registration?.allowedProjectIds || [];

        if (allowedIds.length === 0) {
            setStats({ ...stats, totalProjects: 0, recentProjects: [] });
            setLoading(false);
            return;
        }

        // 1. Projects (Filtramos por allowedIds para la tabla inferior solamente)
        const { data: projectsData } = await supabase
            .from("projects")
            .select("id, name, num_act, region, created_at, cost_original, date_project_start, date_rev_completion")
            .in("id", allowedIds)
            .order("created_at", { ascending: false });

        // 2. Items
        const { data: allItems } = await supabase.from("contract_items").select("project_id, quantity, unit_price").in("project_id", allowedIds);

        // 3. CHOs
        const { data: allChos = [] } = await supabase.from("chos").select("project_id, proposed_change, doc_status, time_extension_days").in("project_id", allowedIds);

        // 4. Certifications
        const { data: allCerts = [] } = await supabase.from("payment_certifications").select("project_id, items, cert_date").in("project_id", allowedIds);

        const projectSummaries = projectsData?.map(proj => {
            const projectItems = (allItems || []).filter(i => i.project_id === proj.id);
            const originalCost = proj.cost_original || projectItems.reduce((acc, i) => acc + (i.quantity * i.unit_price), 0) || 0;

            const pChos = (allChos || []).filter(c => c.project_id === proj.id);
            const approvedCHO = pChos.filter(c => c.doc_status === "Aprobado").reduce((acc, c) => acc + (parseFloat(c.proposed_change as any) || 0), 0) || 0;
            const pendingCHO = pChos.filter(c => c.doc_status === "En trámite").reduce((acc, c) => acc + (parseFloat(c.proposed_change as any) || 0), 0) || 0;

            const pCerts = (allCerts || []).filter(c => c.project_id === proj.id).sort((a, b) => new Date(b.cert_date).getTime() - new Date(a.cert_date).getTime());
            let certified = 0;
            let actF = 0;
            let fhwaF = 0;

            (allCerts || []).filter(c => c.project_id === proj.id).forEach(cert => {
                const cItems = Array.isArray(cert.items) ? cert.items : (cert.items?.list || []);
                cItems.forEach((item: any) => {
                    const amount = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
                    if (item.fund_source?.includes("FHWA")) {
                        const rate = item.fund_source === "FHWA:80.25" ? 0.8025 : 1.0;
                        fhwaF += amount * rate;
                        actF += amount * (1 - rate);
                    } else {
                        actF += amount;
                    }
                    certified += amount;
                });
            });

            const adjustedCost = originalCost + approvedCHO;

            // Time
            const revEnd = proj.date_rev_completion ? new Date(proj.date_rev_completion) : null;
            let daysLeft = 0;
            if (revEnd) {
                daysLeft = Math.ceil((revEnd.getTime() - new Date().getTime()) / (1000 * 3600 * 24)) + 1;
            }

            return {
                ...proj,
                originalCost,
                approvedCHO,
                pendingCHO,
                adjustedCost,
                certified,
                actF,
                fhwaF,
                progress: adjustedCost > 0 ? Math.round((certified / adjustedCost) * 100) : 0,
                daysLeft,
                lastCertDate: pCerts[0]?.cert_date
            };
        }) || [];

        const globalCertified = projectSummaries.reduce((acc, p) => acc + p.certified, 0);
        const globalAdjusted = projectSummaries.reduce((acc, p) => acc + p.adjustedCost, 0);

        setStats({
            totalProjects: projectSummaries.length,
            totalBudget: globalAdjusted,
            totalCertified: globalCertified,
            totalPendingCHO: projectSummaries.reduce((acc, p) => acc + p.pendingCHO, 0),
            avgProgress: globalAdjusted > 0 ? Math.round((globalCertified / globalAdjusted) * 100) : 0,
            actTotal: projectSummaries.reduce((acc, p) => acc + p.actF, 0),
            fhwaTotal: projectSummaries.reduce((acc, p) => acc + p.fhwaF, 0),
            totalBalance: globalAdjusted - globalCertified,
            recentProjects: projectSummaries
        });
        setLoading(false);
    };

    const handleExport = async (e: React.MouseEvent, proj: any) => {
        e.preventDefault();
        e.stopPropagation();

        const { data: project } = await supabase.from("projects").select("folder_path, name").eq("id", proj.id).single();
        let path = project?.folder_path;

        if (!path) {
            // @ts-ignore
            if (window.electronAPI && window.electronAPI.selectFolder) {
                // @ts-ignore
                path = await window.electronAPI.selectFolder();
            } else {
                path = window.prompt("El proyecto no tiene una carpeta configurada. Ingrese la ruta de destino:");
            }
            if (!path) return;
            await supabase.from("projects").update({ folder_path: path }).eq("id", proj.id);
        }

        const result = await exportProjectToFile(proj.id, path, project?.name || proj.name);
        if (result.success) alert(`✓ Respaldo guardado exitosamente en:\n${path}`);
        else alert(`Error al exportar: ${result.error}`);
    };

    return (
        <div className="py-8 space-y-10">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">Proyectos ACT (PACT)</h1>
                    <p className="text-slate-500 mt-2 font-medium">Panel central de control y monitoreo de obras.</p>
                </div>
                <Link href="/proyectos/nuevo" className="btn-primary px-6 py-3 shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 group">
                    <Plus size={20} className="group-hover:rotate-90 transition-transform" />
                    Nuevo Proyecto
                </Link>
            </div>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    icon={<FileText className="text-blue-600" />}
                    title="Total Proyectos"
                    value={loading ? "..." : stats.totalProjects.toString()}
                    subtitle="Registrados en el programa"
                />
            </div>

            <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Activity className="text-primary" size={20} />
                        Resumen General de Proyectos
                    </h2>
                    <Link href="/proyectos" className="text-sm font-semibold text-primary hover:underline flex items-center gap-1 group">
                        Administrar todos
                        <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </Link>
                </div>

                <div className="overflow-x-auto card p-0 border-none shadow-sm">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Proyecto / ACT</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right">Costo Orig.</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right">Ajustado</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right">Certificado</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right">Balance</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Progreso</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-center">Exportar</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                            {loading ? (
                                [1, 2, 3].map(i => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={7} className="px-6 py-8"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-full"></div></td>
                                    </tr>
                                ))
                            ) : (
                                stats.recentProjects.map(proj => (
                                    <tr key={proj.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors cursor-pointer" onClick={() => window.location.href = `/proyectos/detalle?id=${proj.id}`}>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-900 dark:text-white line-clamp-1">{proj.name}</span>
                                                <span className="text-[10px] font-bold text-primary">ACT-{proj.num_act} • {proj.region}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm font-medium text-slate-500">{formatCurrency(proj.originalCost)}</td>
                                        <td className="px-6 py-4 text-right text-sm font-bold text-slate-700 dark:text-slate-200">{formatCurrency(proj.adjustedCost)}</td>
                                        <td className="px-6 py-4 text-right text-sm font-bold text-primary">{formatCurrency(proj.certified)}</td>
                                        <td className="px-6 py-4 text-right text-sm font-medium text-slate-500">{formatCurrency(proj.adjustedCost - proj.certified)}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 min-w-[60px]">
                                                    <div className="bg-primary h-1.5 rounded-full" style={{ width: `${proj.progress}%` }}></div>
                                                </div>
                                                <span className="text-[10px] font-bold w-8">{proj.progress}%</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={(e) => handleExport(e, proj)}
                                                className="p-2 hover:bg-primary/10 text-slate-400 hover:text-primary rounded-lg transition-colors"
                                                title="Exportar"
                                            >
                                                <Download size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                    {!loading && stats.recentProjects.length === 0 && (
                        <div className="text-center py-12 text-slate-400 italic">No hay proyectos para mostrar.</div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <div className="lg:col-span-3">
                        {/* Quick Access or other content could go here */}
                    </div>
                </div>
            </div>

            {/* Quick Actions (Moved to bottom or kept as sidebar style) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {/* Existing Quick Actions if needed, but the table above is now the focus */}
            </div>
        </div>
    );
}

function StatCard({ icon, title, value, subtitle }: { icon: React.ReactNode, title: string, value: string, subtitle: string }) {
    return (
        <div className="card flex items-start gap-4 hover:shadow-md transition-all">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/50">
                {icon}
            </div>
            <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</h3>
                <p className="text-2xl font-extrabold text-slate-900 dark:text-white my-0.5">{value}</p>
                <span className="text-[10px] text-slate-400 font-medium">{subtitle}</span>
            </div>
        </div>
    );
}
