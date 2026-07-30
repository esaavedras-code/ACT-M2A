"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Plus, Search, ArrowRight, Activity, FileText, User, ShieldCheck, DollarSign, Download, Info, AlertTriangle } from "lucide-react";
import { formatCurrency, getLocalStorageItem } from "@/lib/utils";

export default function Dashboard() {
    const [mounted, setMounted] = useState(false);
    const [stats, setStats] = useState<any>({
        totalProjects: 0,
        totalBudget: 0,
        totalCertified: 0,
        avgProgress: 0,
        recentProjects: [] as any[],
        pendingRequests: 0
    });
    // Mapa: projectId -> número de ítems con CM faltantes en certs sin pagar
    const [cmAlertsByProject, setCmAlertsByProject] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        setMounted(true);
        const checkRoles = () => {
            const regStr = getLocalStorageItem("pact_registration");
            if (regStr) {
                try {
                    const reg = JSON.parse(regStr);
                    if (reg && reg.role_global === 'A') setIsAdmin(true);
                } catch (e) { console.error(e); }
            }
        };
        checkRoles();
        fetchStats();
    }, []);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            let allowedIds: string[] = [];
            let userData: any = null;

            if (session) {
                // Get user data by ID first (preferred)
                let { data: fetchedUser } = await supabase.from("users").select("id, role_global").eq("id", session.user.id).single();
                
                // If ID match fails, try by email as a fallback
                if (!fetchedUser && session.user.email) {
                    const { data: userDataByEmail } = await supabase.from("users").select("id, role_global").eq("email", session.user.email.toLowerCase()).single();
                    fetchedUser = userDataByEmail;
                }
                
                userData = fetchedUser;

                if (userData?.role_global === "A") {
                    setIsAdmin(true);
                    allowedIds = ["ALL"];
                } else {
                    const queryId = userData?.id || session.user.id;
                    const { data: mems } = await supabase
                        .from("memberships")
                        .select("project_id")
                        .eq("user_id", queryId)
                        .is("revoked_at", null)
                        .eq("is_active", true);

                    if (mems && mems.length > 0) {
                        allowedIds = mems.map((m: any) => m.project_id);
                    }
                }
            } else {
                const registrationStr = getLocalStorageItem("pact_registration");
                try {
                    const reg = registrationStr ? JSON.parse(registrationStr) : null;
                    allowedIds = reg?.allowedProjectIds || [];
                } catch (e) {}
            }

            if (allowedIds.length === 0) {
                setStats((prev: any) => ({ ...prev, recentProjects: [] }));
                setLoading(false);
                return;
            }

            let projectsQuery = supabase
                .from("projects")
                .select("id, name, num_act, region, cost_original, project_origin, date_rev_completion")
                .order("created_at", { ascending: false });
            
            if (!allowedIds.includes("ALL")) {
                projectsQuery = projectsQuery.in("id", allowedIds);
            }

            // Aislamiento estricto: Roles B-E no ven F, y viceversa. PERO Rol A ve todo.
            if (userData?.role_global === 'F') {
                projectsQuery = projectsQuery.eq("project_origin", "Contratista");
            } else if (userData?.role_global !== 'A') {
                // Roles B, C, D, E ven solo ACT
                projectsQuery = projectsQuery.neq("project_origin", "Contratista");
            }
            // Si es 'A', no añadimos filtro de origin para que vea todos.
            
            const { data: projectsData } = await projectsQuery;
            const { data: allItems } = await supabase.from("contract_items").select("project_id, id, item_num, quantity, unit_price, unit, requires_mfg_cert, mfg_cert_qty");
            const { data: allChos } = await supabase.from("chos").select("project_id, proposed_change, doc_status, items");
            const { data: allCerts } = await supabase.from("payment_certifications").select("project_id, items, excluded, is_paid, cert_num");
            const { data: allMfgCerts } = await supabase.from("manufacturing_certificates").select("project_id, item_id, item_num, quantity");

            const projectSummaries = projectsData?.map((proj: any) => {
                const projectItems = (allItems || []).filter(i => i.project_id === proj.id);
                const originalCost = proj.cost_original || projectItems.reduce((acc, i) => acc + (i.quantity * i.unit_price), 0) || 0;
                const projectChos = (allChos || []).filter(c => c.project_id === proj.id && c.doc_status === "Aprobado");
                const approvedCHO = projectChos.reduce((acc, c) => acc + (parseFloat(c.proposed_change as any) || 0), 0);
                
                const normalizeNumLocal = (n: any) => n?.toString().replace(/^0+/, '').trim().toUpperCase();
                const allRefItems: any[] = [...projectItems];
                projectChos.forEach((cho: any) => {
                    if (Array.isArray(cho.items)) {
                        cho.items.forEach((it: any) => {
                            const exists = allRefItems.find((r: any) => normalizeNumLocal(r.item_num) === normalizeNumLocal(it.item_num));
                            if (!exists) allRefItems.push(it);
                        });
                    }
                });

                let certified = 0;
                (allCerts || []).filter(c => c.project_id === proj.id && !c.excluded).forEach(cert => {
                    const cItems = Array.isArray(cert.items) ? cert.items : (cert.items?.list || []);
                    cItems.forEach((item: any) => {
                        const baseItem = allRefItems.find((r: any) => normalizeNumLocal(r.item_num) === normalizeNumLocal(item.item_num));
                        const up = baseItem ? (parseFloat(baseItem.unit_price) || 0) : (parseFloat(item.unit_price) || 0);
                        certified += Math.round(((parseFloat(item.quantity) || 0) * up) * 100) / 100;
                    });
                });
                certified = Math.round(certified * 100) / 100;

                const adjustedCost = originalCost + approvedCHO;
                
                // Calculate remaining days
                let remainingDays = null;
                if (proj.date_rev_completion) {
                    const rev = new Date(proj.date_rev_completion);
                    const today = new Date();
                    const diff = rev.getTime() - today.getTime();
                    remainingDays = Math.floor(diff / (1000 * 3600 * 24));
                }

                return {
                    ...proj,
                    adjustedCost,
                    certified,
                    remainingDays,
                    progress: adjustedCost > 0 ? Math.round((certified / adjustedCost) * 100) : 0,
                    project_origin: proj.project_origin || 'ACT'
                };
            }) || [];

            // ── Calcular alertas de CM faltantes por proyecto ──
            const normalizeNum = (n: any) => n?.toString().replace(/^0+/, '').trim().toUpperCase();
            const cmAlerts: Record<string, number> = {};

            (projectsData || []).forEach((proj: any) => {
                const projectItems = (allItems || []).filter((i: any) => i.project_id === proj.id);
                const projectChos = (allChos || []).filter((c: any) => c.project_id === proj.id && c.doc_status === 'Aprobado');
                const mfgCertsForProject = (allMfgCerts || []).filter((m: any) => m.project_id === proj.id);

                // Consolidar todos los ítems de referencia (contrato + CHOs aprobadas)
                const allRefItems: any[] = [...projectItems];
                projectChos.forEach((cho: any) => {
                    if (Array.isArray(cho.items)) {
                        cho.items.forEach((it: any) => {
                            const exists = allRefItems.find((r: any) => normalizeNum(r.item_num) === normalizeNum(it.item_num));
                            if (!exists) allRefItems.push(it);
                        });
                    }
                });

                // Todas las certs (pagadas o no) para detectar CM faltantes
                const projectCerts = (allCerts || []).filter((c: any) => c.project_id === proj.id && !c.excluded);
                const certsList = projectCerts;
                if (certsList.length === 0) return;

                let blockedCount = 0;
                certsList.forEach((cert: any) => {
                    const certIdx = certsList.findIndex((c: any) => c.cert_num === cert.cert_num);
                    const itemsInCert = cert.items || [];
                    itemsInCert.forEach((it: any) => {
                        const itemNumStr = normalizeNum(it.item_num);
                        if (!itemNumStr) return;
                        const baseItem = allRefItems.find((r: any) => normalizeNum(r.item_num) === itemNumStr);
                        if (!baseItem || !baseItem.requires_mfg_cert) return;

                        const matchingIds = new Set(
                            allRefItems.filter((r: any) => normalizeNum(r.item_num) === itemNumStr).map((r: any) => r.id)
                        );
                        let totalMfgApproved = 0;
                        mfgCertsForProject.forEach((m: any) => {
                            if (matchingIds.has(m.item_id)) {
                                totalMfgApproved += parseFloat(m.quantity) || 0;
                            } else if (m.item_num && normalizeNum(m.item_num) === itemNumStr) {
                                totalMfgApproved += parseFloat(m.quantity) || 0;
                            }
                        });

                        let paidInPrevious = 0;
                        for (let i = 0; i < certIdx; i++) {
                            const prevItems = certsList[i]?.items || [];
                            const match = prevItems.find((p: any) => normalizeNum(p.item_num) === itemNumStr);
                            if (match) paidInPrevious += parseFloat(match.quantity) || 0;
                        }

                        const isLS = baseItem.unit?.toUpperCase() === 'LS';
                        const qtyToPay = parseFloat(it.quantity) || 0;
                        let isInsufficient = false;

                        if (isLS) {
                            const mfgQtyLimit = parseFloat(baseItem.mfg_cert_qty) || 1;
                            const totalScaled = totalMfgApproved * (100 / mfgQtyLimit);
                            const availablePct = totalScaled - paidInPrevious;
                            if (qtyToPay > availablePct + 0.001) isInsufficient = true;
                        } else {
                            const available = totalMfgApproved - paidInPrevious;
                            if (qtyToPay > available + 0.001) isInsufficient = true;
                        }

                        if (isInsufficient) blockedCount++;
                    });
                });

                if (blockedCount > 0) cmAlerts[proj.id] = blockedCount;
            });
            setCmAlertsByProject(cmAlerts);

            // Fetch pending requests if admin
            let pendingRequests = 0;
            const currentIsAdmin = userData?.role_global === "A" || isAdmin;
            if (currentIsAdmin) {
                const { count } = await supabase
                    .from("access_requests")
                    .select("id", { count: 'exact', head: true })
                    .eq("status", "pending");
                pendingRequests = count || 0;
            }

            setStats({
                totalProjects: projectSummaries.length,
                totalBudget: projectSummaries.reduce((acc, p) => acc + p.adjustedCost, 0),
                totalCertified: projectSummaries.reduce((acc, p) => acc + p.certified, 0),
                avgProgress: projectSummaries.length > 0 ? Math.round(projectSummaries.reduce((acc, p) => acc + p.progress, 0) / projectSummaries.length) : 0,
                recentProjects: projectSummaries,
                pendingRequests
            });
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleDownloadProjectJSON = async (e: React.MouseEvent, projId: string, projName: string) => {
        e.stopPropagation(); // Evitar navegar al detalle
        try {
            const { data, error } = await supabase.rpc('get_full_project_data', { p_id: projId }); // Intentar usar RPC si existe
            
            // Si no hay RPC, hacemos fetch manual de todo
            let fullData: any = {};
            
            const [proj, items, chos, certs, mems, docs, chp_items] = await Promise.all([
                supabase.from("projects").select("*").eq("id", projId).single(),
                supabase.from("contract_items").select("*").eq("project_id", projId),
                supabase.from("chos").select("*").eq("project_id", projId),
                supabase.from("payment_certifications").select("*").eq("project_id", projId),
                supabase.from("memberships").select("*").eq("project_id", projId),
                supabase.from("project_documents").select("*").eq("project_id", projId),
                supabase.from("cho_items").select("*").eq("project_id", projId)
            ]);

            fullData = {
                project: proj.data,
                items: items.data,
                chos: chos.data,
                cho_items: chp_items.data,
                certifications: certs.data,
                memberships: mems.data,
                documents_metadata: docs.data,
                exported_at: new Date().toISOString()
            };

            const blob = new Blob([JSON.stringify(fullData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Respaldo_PACT_${projName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            alert("✓ Información del proyecto descargada con éxito.");
        } catch (err: any) {
            alert("Error al descargar información: " + err.message);
        }
    };

    if (!mounted) return null;

    return (
        <div className="py-8 space-y-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex flex-col">
                    <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight uppercase">PROYECTOS ACT</h1>
                    <div className="flex items-center gap-3 mt-4">
                        <p className="text-slate-600 dark:text-slate-400 font-medium">Gestiona y supervisa todas las obras.</p>
                    </div>
                </div>
                <Link href="/proyectos/nuevo" className="btn-primary px-6 py-3 shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 group mr-[2in]">
                    <Plus size={20} className="group-hover:rotate-90 transition-transform" />
                    <span className="hidden sm:inline">Nuevo Proyecto</span>
                </Link>
            </div>

            {/* Notification for pending requests */}
            {isAdmin && stats.pendingRequests > 0 && (
                <Link href="/admin/requests" className="flex items-center justify-between bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-200 dark:border-amber-800 p-6 rounded-[2rem] hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-all shadow-lg shadow-amber-500/10 group">
                    <div className="flex items-center gap-4">
                        <div className="bg-amber-500 text-white p-3 rounded-2xl">
                            <User size={24} />
                        </div>
                        <div>
                            <h3 className="font-black text-amber-900 dark:text-amber-200 uppercase tracking-tight">Solicitudes Pendientes</h3>
                            <p className="text-amber-700 dark:text-amber-400 font-medium text-sm">Hay {stats.pendingRequests} personas esperando que apruebes su solicitud de acceso.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-black text-xs uppercase tracking-widest group-hover:translate-x-1 transition-transform">
                        Gestionar <ArrowRight size={16} />
                    </div>
                </Link>
            )}

            {/* Search Box */}
            <div className="relative group">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors" size={22} />
                <input 
                    type="text" 
                    placeholder="BUSCAR PROYECTO POR NOMBRE O NÚMERO DE AC..." 
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl shadow-blue-500/5 rounded-[2rem] py-5 pl-16 pr-8 text-sm font-black uppercase tracking-widest outline-none ring-2 ring-transparent focus:ring-blue-600/20 text-slate-900 dark:text-white transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard icon={<FileText className="text-blue-600 dark:text-blue-400" />} title="Proyectos" value={loading ? "..." : stats.totalProjects.toString()} subtitle="Obras registradas" />
            </div>

            <div className="space-y-6">
                <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-tight">
                    <Activity className="text-blue-600 dark:text-blue-400" size={20} />
                    Resumen de Proyectos
                </h2>
                <div className="overflow-x-auto card p-0 border border-slate-200 dark:border-slate-800 shadow-sm rounded-[2rem]">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">Proyecto / ACT</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 text-right">Terminación revisada</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 text-right">Costo ajustado</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 text-right">Remaining</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 text-right">Certified to date (WP)</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">Progreso</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {!loading && stats.recentProjects
                                .filter((p: any) => 
                                    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                    p.num_act?.toLowerCase().includes(searchTerm.toLowerCase())
                                )
                                .map((proj: any) => (
                                <tr key={proj.id} className="group hover:bg-blue-50/50 dark:hover:bg-slate-800/60 cursor-pointer" onClick={() => window.location.href = `/proyectos/detalle?id=${proj.id}`}>
                                    <td className="px-8 py-6">
                                        <div className="flex flex-col gap-1.5">
                                            <div className="flex items-center gap-2 max-w-[280px]">
                                                <span className="text-[10px] font-black bg-blue-600 text-white px-2 py-0.5 rounded-md uppercase tracking-tight shrink-0 shadow-sm">
                                                    {proj.num_act}
                                                </span>
                                                <span className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 leading-tight truncate overflow-hidden whitespace-nowrap" title={proj.name}>
                                                    {proj.name}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border shrink-0 ${proj.project_origin === 'Contratista' ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400' : 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400'}`}>
                                                    {proj.project_origin}
                                                </span>
                                                {cmAlertsByProject[proj.id] && (
                                                    <span
                                                        title={`${cmAlertsByProject[proj.id]} partida(s) con CM insuficientes en certificaciones sin pagar`}
                                                        className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border bg-orange-50 dark:bg-orange-950/40 border-orange-300 dark:border-orange-800 text-orange-700 dark:text-orange-400 animate-pulse shrink-0"
                                                    >
                                                        <AlertTriangle size={9} className="shrink-0" />
                                                        CM faltantes ({cmAlertsByProject[proj.id]})
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-right font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                        {proj.date_rev_completion ? new Date(proj.date_rev_completion).toLocaleDateString() : 'N/A'}
                                    </td>
                                    <td className="px-8 py-6 text-right font-bold text-slate-900 dark:text-slate-100">{formatCurrency(proj.adjustedCost)}</td>
                                    <td className={`px-8 py-6 text-right font-bold ${(proj.adjustedCost - proj.certified) < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                        {formatCurrency(proj.adjustedCost - proj.certified)}
                                    </td>
                                    <td className="px-8 py-6 text-right font-bold text-blue-600 dark:text-blue-400 underline decoration-blue-200 dark:decoration-blue-800 hover:decoration-blue-600 dark:hover:decoration-blue-400 transition-all">
                                        <Link href={`/proyectos/detalle?id=${proj.id}&tab=payment`} onClick={(e) => e.stopPropagation()}>
                                            {formatCurrency(proj.certified)}
                                        </Link>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 bg-slate-200 dark:bg-slate-800 rounded-full h-2 min-w-[80px]"><div className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full" style={{ width: `${proj.progress}%` }}></div></div>
                                            <span className="text-[10px] font-black text-slate-900 dark:text-slate-100">{proj.progress}%</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        <button 
                                            onClick={(e) => handleDownloadProjectJSON(e, proj.id, proj.name)}
                                            className="p-2 text-slate-400 hover:text-primary dark:hover:text-blue-400 hover:bg-primary/10 dark:hover:bg-blue-500/10 rounded-xl transition-all"
                                            title="Descargar Respaldo JSON"
                                        >
                                            <Download size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function StatCard({ icon, title, value, subtitle }: { icon: React.ReactNode, title: string, value: string, subtitle: string }) {
    return (
        <div className="card flex items-start gap-4 hover:shadow-xl transition-all rounded-[2rem]">
            <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60">{icon}</div>
            <div>
                <h3 className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">{title}</h3>
                <p className="text-2xl font-black text-slate-900 dark:text-white my-0.5 tracking-tight">{value}</p>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium italic">{subtitle}</span>
            </div>
        </div>
    );
}
