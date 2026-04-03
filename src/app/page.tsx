"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Plus, Search, ArrowRight, Activity, FileText, User, ShieldCheck, DollarSign, Download } from "lucide-react";
import { formatCurrency, getLocalStorageItem } from "@/lib/utils";

export default function Dashboard() {
    const [mounted, setMounted] = useState(false);
    const [stats, setStats] = useState<any>({
        totalProjects: 0,
        totalBudget: 0,
        totalCertified: 0,
        avgProgress: 0,
        recentProjects: [] as any[]
    });
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

            if (session) {
                // Get user data by ID first (preferred)
                let { data: userData } = await supabase.from("users").select("id, role_global").eq("id", session.user.id).single();
                
                // If ID match fails, try by email as a fallback
                if (!userData && session.user.email) {
                    const { data: userDataByEmail } = await supabase.from("users").select("id, role_global").eq("email", session.user.email.toLowerCase()).single();
                    userData = userDataByEmail;
                }

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
                .select("id, name, num_act, region, cost_original")
                .order("created_at", { ascending: false });
            
            if (!allowedIds.includes("ALL")) {
                projectsQuery = projectsQuery.in("id", allowedIds);
            }
            
            const { data: projectsData } = await projectsQuery;
            const { data: allItems } = await supabase.from("contract_items").select("project_id, quantity, unit_price");
            const { data: allChos } = await supabase.from("chos").select("project_id, proposed_change, doc_status");
            const { data: allCerts } = await supabase.from("payment_certifications").select("project_id, items");

            const projectSummaries = projectsData?.map((proj: any) => {
                const projectItems = (allItems || []).filter(i => i.project_id === proj.id);
                const originalCost = proj.cost_original || projectItems.reduce((acc, i) => acc + (i.quantity * i.unit_price), 0) || 0;
                const approvedCHO = (allChos || []).filter(c => c.project_id === proj.id && c.doc_status === "Aprobado")
                    .reduce((acc, c) => acc + (parseFloat(c.proposed_change as any) || 0), 0);
                
                let certified = 0;
                (allCerts || []).filter(c => c.project_id === proj.id).forEach(cert => {
                    const cItems = Array.isArray(cert.items) ? cert.items : (cert.items?.list || []);
                    cItems.forEach((item: any) => {
                        certified += (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
                    });
                });

                const adjustedCost = originalCost + approvedCHO;
                return {
                    ...proj,
                    adjustedCost,
                    certified,
                    progress: adjustedCost > 0 ? Math.round((certified / adjustedCost) * 100) : 0
                };
            }) || [];

            setStats({
                totalProjects: projectSummaries.length,
                totalBudget: projectSummaries.reduce((acc, p) => acc + p.adjustedCost, 0),
                totalCertified: projectSummaries.reduce((acc, p) => acc + p.certified, 0),
                avgProgress: projectSummaries.length > 0 ? Math.round(projectSummaries.reduce((acc, p) => acc + p.progress, 0) / projectSummaries.length) : 0,
                recentProjects: projectSummaries
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
                <div>
                    <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight uppercase">Dashboard Proyectos</h1>
                    <p className="text-slate-500 mt-2 font-medium">Panel central de control y monitoreo de obras.</p>
                </div>
                <Link href="/proyectos/nuevo" className="btn-primary px-6 py-3 shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 group">
                    <Plus size={20} className="group-hover:rotate-90 transition-transform" />
                </Link>
            </div>

            {/* Search Box */}
            <div className="relative group">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={22} />
                <input 
                    type="text" 
                    placeholder="BUSCAR PROYECTO POR NOMBRE O NÚMERO DE AC..." 
                    className="w-full bg-white border-none shadow-xl shadow-blue-500/5 rounded-[2rem] py-5 pl-16 pr-8 text-sm font-black uppercase tracking-widest outline-none ring-2 ring-transparent focus:ring-blue-600/20 transition-all placeholder:text-slate-300"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard icon={<FileText className="text-blue-600" />} title="Proyectos" value={loading ? "..." : stats.totalProjects.toString()} subtitle="Obras registradas" />
            </div>

            <div className="space-y-6">
                <h2 className="text-xl font-black flex items-center gap-2 uppercase tracking-tight">
                    <Activity className="text-blue-600" size={20} />
                    Resumen de Proyectos
                </h2>
                <div className="overflow-x-auto card p-0 border-none shadow-sm rounded-[2rem]">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Proyecto / ACT</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Ajustado</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Certificado</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Progreso</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {!loading && stats.recentProjects
                                .filter((p: any) => 
                                    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                    p.num_act?.toLowerCase().includes(searchTerm.toLowerCase())
                                )
                                .map((proj: any) => (
                                <tr key={proj.id} className="group hover:bg-blue-50/30 cursor-pointer" onClick={() => window.location.href = `/proyectos/detalle?id=${proj.id}`}>
                                    <td className="px-8 py-6">
                                        <span className="font-bold text-slate-900 group-hover:text-blue-600">{proj.name}</span><br/>
                                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{proj.num_act} • {proj.region}</span>
                                    </td>
                                    <td className="px-8 py-6 text-right font-bold text-slate-700">{formatCurrency(proj.adjustedCost)}</td>
                                    <td className="px-8 py-6 text-right font-bold text-blue-600">{formatCurrency(proj.certified)}</td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 bg-slate-100 rounded-full h-2 min-w-[100px]"><div className="bg-blue-600 h-2 rounded-full" style={{ width: `${proj.progress}%` }}></div></div>
                                            <span className="text-[10px] font-black">{proj.progress}%</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        <button 
                                            onClick={(e) => handleDownloadProjectJSON(e, proj.id, proj.name)}
                                            className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
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
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">{icon}</div>
            <div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</h3>
                <p className="text-2xl font-black text-slate-900 my-0.5 tracking-tight">{value}</p>
                <span className="text-[10px] text-slate-400 font-medium italic">{subtitle}</span>
            </div>
        </div>
    );
}
