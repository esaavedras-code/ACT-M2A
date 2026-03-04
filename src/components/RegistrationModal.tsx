"use client";

import { useState, useEffect } from "react";
import { User, Mail, ShieldCheck, ArrowRight, CheckSquare, Square, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Project {
    id: string;
    name: string;
    num_act: string;
}

export default function RegistrationModal() {
    const [isMounted, setIsMounted] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [availableProjects, setAvailableProjects] = useState<Project[]>([]);
    const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(false);
    const [fetchingProjects, setFetchingProjects] = useState(true);

    useEffect(() => {
        setIsMounted(true);
        const registrationStr = localStorage.getItem("pact_registration");

        if (!registrationStr) {
            setIsOpen(true);
            document.body.style.overflow = "hidden";
            fetchProjects();
        } else {
            // Cargar datos existentes si ya está registrado
            const data = JSON.parse(registrationStr);
            setName(data.name || "");
            setEmail(data.email || "");
            setSelectedProjectIds(data.allowedProjectIds || []);
        }

        const handleOpenModal = () => {
            setIsOpen(true);
            document.body.style.overflow = "hidden";
            fetchProjects();
        };

        window.addEventListener("open_registration_modal", handleOpenModal);

        return () => {
            document.body.style.overflow = "unset";
            window.removeEventListener("open_registration_modal", handleOpenModal);
        };
    }, []);

    const fetchProjects = async () => {
        setFetchingProjects(true);
        try {
            const { data, error } = await supabase
                .from("projects")
                .select("id, name, num_act")
                .order("num_act", { ascending: true });

            if (error) throw error;
            setAvailableProjects(data || []);
        } catch (error) {
            console.error("Error fetching projects:", error);
        } finally {
            setFetchingProjects(false);
        }
    };

    const toggleProject = (id: string) => {
        setSelectedProjectIds(prev =>
            prev.includes(id)
                ? prev.filter(pId => pId !== id)
                : [...prev, id]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedProjectIds.length === 0) {
            alert("Por favor seleccione al menos un proyecto para continuar.");
            return;
        }

        setLoading(true);

        try {
            // Buscar si ya existe un registro con este email para actualizarlo o crear uno nuevo
            const { data: existing } = await supabase
                .from("app_registrations")
                .select("id")
                .eq("email", email)
                .maybeSingle();

            if (existing) {
                await supabase.from("app_registrations").update({
                    name,
                    user_agent: window.navigator.userAgent,
                    project_ids: selectedProjectIds
                }).eq("id", existing.id);
            } else {
                await supabase.from("app_registrations").insert([{
                    name,
                    email,
                    user_agent: window.navigator.userAgent,
                    project_ids: selectedProjectIds
                }]);
            }

            const registrationData = {
                name,
                email,
                allowedProjectIds: selectedProjectIds,
                registeredAt: new Date().toISOString()
            };
            localStorage.setItem("pact_registration", JSON.stringify(registrationData));

            window.dispatchEvent(new Event("pact_registration_updated"));

            setIsOpen(false);
            document.body.style.overflow = "unset";

            // Si el proyecto actual ya no está en la lista permitida, redirigir
            const urlParams = new URLSearchParams(window.location.search);
            const currentProjectId = urlParams.get("id");
            if (currentProjectId && !selectedProjectIds.includes(currentProjectId)) {
                window.location.href = "/proyectos";
            } else {
                window.location.reload();
            }
        } catch (error) {
            console.error("Error saving registration:", error);
            const registrationData = {
                name,
                email,
                allowedProjectIds: selectedProjectIds,
                registeredAt: new Date().toISOString()
            };
            localStorage.setItem("pact_registration", JSON.stringify(registrationData));
            window.dispatchEvent(new Event("pact_registration_updated"));
            setIsOpen(false);
            document.body.style.overflow = "unset";
            window.location.reload();
        } finally {
            setLoading(false);
        }
    };

    if (!isMounted || !isOpen) return null;

    const filteredProjects = availableProjects.filter(p =>
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.num_act?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xl animate-in fade-in duration-500">
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-500 flex flex-col max-h-[90vh]">
                {/* Header Section */}
                <div className="bg-primary p-8 text-white relative shrink-0">
                    <div className="relative z-10 flex items-center gap-6">
                        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-xl border border-white/30 rotate-3">
                            <ShieldCheck size={32} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-black tracking-tight">Bienvenido a PACT</h2>
                            <p className="text-blue-100 text-sm font-medium opacity-90">Sistema de control de proyectos ACT</p>
                        </div>
                    </div>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                </div>

                <div className="p-8 overflow-y-auto custom-scrollbar flex-grow">
                    <form id="registration-form" onSubmit={handleSubmit} className="space-y-8">
                        {/* Basic Info Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] block ml-1">Nombre Completo</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                        <User size={18} />
                                    </div>
                                    <input
                                        required
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Ej. Juan del Pueblo"
                                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 pl-12 pr-4 focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all placeholder:text-slate-400 font-medium"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] block ml-1">Correo Electrónico</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                        <Mail size={18} />
                                    </div>
                                    <input
                                        required
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="correo@ejemplo.com"
                                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 pl-12 pr-4 focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all placeholder:text-slate-400 font-medium"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Project Selection */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between px-1">
                                <div className="space-y-1">
                                    <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">Proyectos Autorizados</h3>
                                    <p className="text-xs text-slate-500">Seleccione los proyectos a los que tendrá acceso.</p>
                                </div>
                                <span className="text-[10px] font-bold bg-blue-50 text-primary px-2.5 py-1 rounded-full border border-blue-100 dark:bg-blue-900/20 dark:border-blue-800">
                                    {selectedProjectIds.length} SELECCIONADOS
                                </span>
                            </div>

                            <div className="relative group mb-4">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary">
                                    <Search size={16} />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Buscar por nombre o número ACT..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pl-11 pr-4 text-sm focus:ring-2 focus:ring-primary/10 outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto p-1 custom-scrollbar">
                                {fetchingProjects ? (
                                    <div className="col-span-full py-8 text-center space-y-3">
                                        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin mx-auto"></div>
                                        <p className="text-xs text-slate-400 font-medium">Cargando proyectos disponibles...</p>
                                    </div>
                                ) : filteredProjects.length > 0 ? (
                                    filteredProjects.map(project => (
                                        <button
                                            key={project.id}
                                            type="button"
                                            onClick={() => toggleProject(project.id)}
                                            className={`flex items-center gap-3 p-4 rounded-2xl border transition-all text-left group ${selectedProjectIds.includes(project.id)
                                                ? "bg-blue-50 border-primary/30 ring-1 ring-primary/30 shadow-sm"
                                                : "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                                                }`}
                                        >
                                            <div className={`shrink-0 transition-colors ${selectedProjectIds.includes(project.id) ? "text-primary" : "text-slate-300"}`}>
                                                {selectedProjectIds.includes(project.id) ? <CheckSquare size={20} className="text-primary fill-current opacity-70" /> : <Square size={20} />}
                                            </div>
                                            <div className="min-w-0">
                                                <span className={`block font-bold text-sm truncate ${selectedProjectIds.includes(project.id) ? "text-primary" : "text-slate-700 dark:text-slate-200"}`}>
                                                    {project.name || "Sin nombre"}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                                    ACT-{project.num_act}
                                                </span>
                                            </div>
                                        </button>
                                    ))
                                ) : (
                                    <div className="col-span-full py-8 text-center text-slate-400 text-sm italic">
                                        No se encontraron proyectos activos.
                                    </div>
                                )}
                            </div>
                        </div>
                    </form>
                </div>

                {/* Footer and Submit */}
                <div className="p-8 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 shrink-0">
                    <button
                        form="registration-form"
                        disabled={loading || !name || !email || selectedProjectIds.length === 0}
                        type="submit"
                        className="w-full bg-primary hover:bg-blue-700 text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-blue-500/20 flex items-center justify-center gap-3 group disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                    >
                        {loading ? (
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                <span>Verificando...</span>
                            </div>
                        ) : (
                            <>
                                <span>Finalizar Registro</span>
                                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>
                    <p className="text-center text-[9px] text-slate-400 mt-4 font-bold uppercase tracking-[0.2em]">
                        AL FINALIZAR TENDRÁ ACCESO EXCLUSIVO A LAS ÁREAS SELECCIONADAS
                    </p>
                </div>
            </div>
        </div>
    );
}
