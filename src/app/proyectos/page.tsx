"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Plus, Search, FolderOpen, MapPin, Calendar, ArrowRight, User, Globe, Lock, ShieldCheck } from "lucide-react";
import { getLocalStorageItem } from "@/lib/utils";
import AccessRequestModal from "@/components/AccessRequestModal";

export default function ProjectsPage() {
    const [mounted, setMounted] = useState(false);
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [viewScope, setViewScope] = useState<'my' | 'all'>('my');
    const [userProfile, setUserProfile] = useState<{name: string, email: string} | null>(null);
    const [allowedProjectIds, setAllowedProjectIds] = useState<string[]>([]);
    const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
    
    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    const [requestInitialData, setRequestInitialData] = useState<{fullName?: string, email?: string, projectNumber?: string}>({});

    const fetchProjects = async (scope: 'my' | 'all') => {
        setLoading(true);

        const { data: { session } } = await supabase.auth.getSession();
        let allowedIds: string[] = [];
        let globalAdmin = false;

        if (session) {
            // Get user data by ID first (preferred)
            let { data: userData } = await supabase.from("users").select("id, name, email, role_global").eq("id", session.user.id).single();
            
            // If ID match fails, try by email as a fallback (resilience)
            if (!userData && session.user.email) {
                const { data: userDataByEmail } = await supabase.from("users").select("id, name, email, role_global").eq("email", session.user.email.toLowerCase()).single();
                userData = userDataByEmail;
            }

            if (userData) {
                setUserProfile({ name: userData.name || "", email: userData.email || "" });
            }
            
            if (userData?.role_global === "A") {
                globalAdmin = true;
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
        }

        setAllowedProjectIds(allowedIds);
        setIsGlobalAdmin(globalAdmin);

        let query = supabase
            .from("projects")
            .select(`
                id, 
                name, 
                num_act, 
                region, 
                folder_path,
                date_project_start, 
                date_orig_completion
            `)
            .order("created_at", { ascending: false });

        if (scope === 'my' && !globalAdmin) {
            if (allowedIds.length === 0) {
                setProjects([]);
                setLoading(false);
                return;
            }
            query = query.in("id", allowedIds);
        }

        const { data: projectsData, error } = await query;

        if (error) {
            console.error("Error fetching projects:", error);
            setLoading(false);
            return;
        }

        setProjects(projectsData || []);
        setLoading(false);
    };

    useEffect(() => {
        setMounted(true);
        fetchProjects(viewScope);
    }, [viewScope]);

    const handleRequestAccess = (project: any) => {
        setRequestInitialData({
            fullName: userProfile?.name,
            email: userProfile?.email,
            projectNumber: project.num_act
        });
        setIsRequestModalOpen(true);
    };

    const filteredProjects = projects.filter(p =>
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.num_act?.includes(searchTerm)
    );

    if (!mounted) return null;

    return (
        <div className="py-8 space-y-8 max-w-7xl mx-auto px-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                        <FolderOpen className="text-primary" size={32} /> Proyectos
                    </h1>
                    <p className="text-slate-500 font-medium">Gestiona y monitorea todos los proyectos de carreteras.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl flex">
                        <button 
                            onClick={() => setViewScope('my')}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewScope === 'my' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Mis Proyectos
                        </button>
                        <button 
                            onClick={() => setViewScope('all')}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewScope === 'all' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Todos
                        </button>
                    </div>
                    <Link href="/proyectos/nuevo" className="bg-primary text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-blue-700 transition-all flex items-center gap-2">
                        <Plus size={18} /> Nuevo Proyecto
                    </Link>
                </div>
            </div>

            <div className="relative group">
                <input
                    type="text"
                    placeholder="Buscar por nombre o Núm. ACT..."
                    className="w-full bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-3xl py-5 px-14 text-sm focus:border-primary/30 focus:ring-4 focus:ring-primary/5 outline-none transition-all shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors" size={24} />
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-400 font-medium animate-pulse">Cargando proyectos...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {filteredProjects.map((project) => {
                        const hasAccess = isGlobalAdmin || allowedProjectIds.includes(project.id);
                        
                        return (
                            <div
                                key={project.id}
                                className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none p-6 group hover:border-primary/30 transition-all relative flex flex-col justify-between"
                            >
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-primary text-[10px] font-black rounded-lg uppercase tracking-widest border border-blue-100 dark:border-blue-800">
                                            {project.num_act}
                                        </span>
                                        {!hasAccess && (
                                            <Lock size={14} className="text-slate-300" />
                                        )}
                                    </div>
                                    <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors text-base leading-snug line-clamp-3 min-h-[4.5rem]">
                                        {project.name || "Sin nombre"}
                                    </h3>
                                </div>

                                <div className="mt-6 pt-4 border-t border-slate-50 dark:border-slate-800/50">
                                    {hasAccess ? (
                                        <Link
                                            href={`/proyectos/detalle?id=${project.id}`}
                                            className="w-full flex items-center justify-between group/link"
                                        >
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover/link:text-primary transition-colors">Abrir Proyecto</span>
                                            <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-xl group-hover/link:bg-primary/10 transition-all">
                                                <ArrowRight size={14} className="text-slate-400 group-hover/link:text-primary transition-all" />
                                            </div>
                                        </Link>
                                    ) : (
                                        <button
                                            onClick={() => handleRequestAccess(project)}
                                            className="w-full flex items-center justify-between group/link"
                                        >
                                            <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest group-hover/link:text-amber-600 transition-colors">Solicitar Acceso</span>
                                            <div className="bg-amber-50 dark:bg-amber-900/20 p-2 rounded-xl group-hover/link:bg-amber-100 transition-all">
                                                <ShieldCheck size={14} className="text-amber-500" />
                                            </div>
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {filteredProjects.length === 0 && (
                        <div className="col-span-full py-32 flex flex-col items-center justify-center text-slate-400 space-y-6 bg-slate-50/50 rounded-[3rem] border-2 border-dashed border-slate-100">
                            <div className="bg-white p-6 rounded-full shadow-lg shadow-slate-100">
                                <Search size={48} className="opacity-20" />
                            </div>
                            <div className="text-center space-y-1">
                                <p className="font-bold text-slate-600 text-lg">No se encontraron proyectos</p>
                                <p className="text-sm font-medium">Prueba con otro término de búsqueda o cambia el alcance.</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <AccessRequestModal
                isOpen={isRequestModalOpen}
                onClose={() => setIsRequestModalOpen(false)}
                initialData={requestInitialData}
            />
        </div>
    );
}

