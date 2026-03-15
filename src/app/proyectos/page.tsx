"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Plus, Search, FolderOpen, MapPin, Calendar, ArrowRight, User } from "lucide-react";

export default function ProjectsPage() {
    const [mounted, setMounted] = useState(false);
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    const fetchProjects = async () => {
        setLoading(true);

        const registrationStr = localStorage.getItem("pact_registration");
        let registration = null;
        try {
            registration = registrationStr ? JSON.parse(registrationStr) : null;
        } catch (e) {
            console.error("Error parsing registration", e);
        }
        const allowedIds = registration?.allowedProjectIds || [];

        if (allowedIds.length === 0) {
            setProjects([]);
            setLoading(false);
            return;
        }

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

        if (!allowedIds.includes("ALL")) {
            query = query.in("id", allowedIds);
        }

        const { data: projectsData, error } = await query;

        if (error) {
            console.error("Error fetching projects:", error);
            setLoading(false);
            return;
        }

        // Obtener registros para encontrar el último usuario por proyecto
        const { data: regsData } = await supabase
            .from("app_registrations")
            .select("name, project_ids, registered_at")
            .order("registered_at", { ascending: false });

        const projectsWithLastUser = (projectsData || []).map(proj => {
            const lastReg = regsData?.find(r => r.project_ids?.includes(proj.id));
            return {
                ...proj,
                lastUser: lastReg?.name || null
            };
        });

        setProjects(projectsWithLastUser);
        setLoading(false);
    };

    useEffect(() => {
        setMounted(true);
        fetchProjects();
    }, []);

    const filteredProjects = projects.filter(p =>
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.num_act?.includes(searchTerm)
    );

    if (!mounted) return null;

    return (
        <div className="py-8 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Proyectos</h1>
                    <p className="text-slate-500 mt-1 text-sm">Gestiona y monitorea todos los proyectos de carreteras.</p>
                </div>
                <Link href="/proyectos/nuevo" className="btn-primary flex items-center gap-2 self-start md:self-auto">
                    <Plus size={18} />
                    Nuevo Proyecto
                </Link>
            </div>

            <div className="card flex items-center gap-3 px-4 py-3">
                <Search className="text-slate-400" size={20} />
                <input
                    type="text"
                    placeholder="Buscar por nombre o Núm. ACT..."
                    className="bg-transparent border-none outline-none w-full text-slate-700 dark:text-slate-200"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 font-geist">
                    {filteredProjects.map((project) => (
                        <Link
                            key={project.id}
                            href={`/proyectos/detalle?id=${project.id}`}
                            className="card group hover:border-primary/30 transition-all cursor-pointer relative overflow-hidden block"
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                <FolderOpen className="text-primary" size={20} />
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded uppercase tracking-wider border border-blue-100 dark:border-blue-800">
                                            {project.num_act}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">{project.region}</span>
                                    </div>
                                    <h3 className="font-bold text-slate-800 dark:text-white group-hover:text-primary transition-colors text-lg leading-tight">
                                        {project.name || "Sin nombre"}
                                    </h3>
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-xs">
                                    <div className="flex items-center gap-2 text-slate-500">
                                        <Calendar size={14} className="text-slate-400" />
                                        <span>Inicia: {project.date_project_start || '---'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-500">
                                        <MapPin size={14} className="text-slate-400" />
                                        <span>Puerto Rico</span>
                                    </div>
                                    {project.folder_path && (
                                        <div className="flex items-center gap-2 text-slate-500 col-span-2 overflow-hidden truncate italic">
                                            <FolderOpen size={14} className="text-slate-400 shrink-0" />
                                            <span className="truncate" title={project.folder_path}>{project.folder_path}</span>
                                        </div>
                                    )}
                                    {project.lastUser && (
                                        <div className="flex items-center gap-2 text-slate-400 col-span-2 text-[10px] font-bold uppercase mt-1">
                                            <User size={12} className="text-slate-300 shrink-0" />
                                            <span>Último: {project.lastUser}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-4 flex items-center justify-between border-t border-slate-50 dark:border-slate-800">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ver Detalles</span>
                                    <ArrowRight size={16} className="text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                </div>
                            </div>
                        </Link>
                    ))}

                    {filteredProjects.length === 0 && (
                        <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400 space-y-4">
                            <Search size={48} className="opacity-20" />
                            <p>No se encontraron proyectos.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
