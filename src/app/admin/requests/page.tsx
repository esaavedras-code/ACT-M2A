"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { UserCheck, UserX, Clock, Mail, Hash, Shield, ArrowLeft, Pencil, Check, X as XIcon, Users, ChevronDown } from "lucide-react";
import Link from "next/link";

interface AccessRequest {
    id: string;
    full_name: string;
    email: string;
    project_number: string | null;
    desired_role: string;
    status: string;
    created_at: string;
}

export default function AdminRequestsPage() {
    const [requests, setRequests] = useState<AccessRequest[]>([]);
    const [availableProjects, setAvailableProjects] = useState<{id: string, num_act: string, name: string}[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editRole, setEditRole] = useState("");
    const [selectedEditProjects, setSelectedEditProjects] = useState<string[]>([]);
    const [isCreatingDirectly, setIsCreatingDirectly] = useState(false);
    const [directEmail, setDirectEmail] = useState("");
    const [directName, setDirectName] = useState("");
    const [directRole, setDirectRole] = useState("C");
    const [selectedDirectProjects, setSelectedDirectProjects] = useState<string[]>([]);
    const [directLoading, setDirectLoading] = useState(false);
    const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
    const [isEditProjectDropdownOpen, setIsEditProjectDropdownOpen] = useState(false);

    useEffect(() => {
        const checkAdmin = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                window.location.href = "/login";
                return;
            }

            const { data: user } = await supabase
                .from("users")
                .select("role_global")
                .eq("id", session.user.id)
                .single();

            if (user?.role_global !== 'A') {
                alert("Acceso denegado. Se requiere rol de Administrador Global.");
                window.location.href = "/";
                return;
            }

            setIsAdmin(true);
            fetchInitialData();
        };

        checkAdmin();
    }, []);

    const fetchInitialData = async () => {
        setLoading(true);
        await Promise.all([
            fetchRequests(),
            fetchProjects()
        ]);
        setLoading(false);
    };

    const fetchRequests = async () => {
        const { data, error } = await supabase
            .from("access_requests")
            .select("*")
            .order("created_at", { ascending: false });

        if (data) setRequests(data);
    };

    const fetchProjects = async () => {
        const { data, error } = await supabase
            .from("projects")
            .select("id, num_act, name")
            .order("num_act", { ascending: true });

        if (data) setAvailableProjects(data.filter(p => p.num_act));
    };

    const handleUpdateStatus = async (id: string, newStatus: string) => {
        const req = requests.find(r => r.id === id);
        if (!req) return;

        const { error } = await supabase
            .from("access_requests")
            .update({ status: newStatus })
            .eq("id", id);

        if (!error) {
            setRequests(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
            
            if (newStatus === 'approved') {
                // Notificar al usuario que su solicitud fue aprobada
                try {
                    // @ts-ignore
                    const api = typeof window !== "undefined" ? (window as any).electronAPI : null;
                    if (api?.sendEmail) {
                        await api.sendEmail({
                            to: req.email,
                            subject: "✅ Solicitud de Acceso PACT Aprobada",
                            html: `
                                <div style="font-family: sans-serif; padding: 30px; border: 1px solid #eee; border-radius: 20px; max-width: 600px; margin: 0 auto;">
                                    <h2 style="color: #2563eb;">¡Hola ${req.full_name}!</h2>
                                    <p>Tu solicitud de acceso al sistema PACT ha sido <strong>aprobada</strong> por el administrador.</p>
                                    <p>Ya puedes iniciar sesión o completar tu registro usando tu correo electrónico registrado.</p>
                                    <div style="margin: 30px 0;">
                                        <a href="https://pact.m2a-group.com/login" style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; display: inline-block;">
                                            Ir al Sistema PACT
                                        </a>
                                    </div>
                                    <p style="font-size: 12px; color: #999;">Si tienes problemas, contacta al administrador del proyecto.</p>
                                </div>
                            `
                        });
                    }
                } catch (emailErr) {
                    console.error("Error enviando email de aprobación:", emailErr);
                }
                alert("✓ Solicitud aprobada y usuario notificado.");
            } else {
                alert("Solicitud rechazada.");
            }
        } else {
            alert("Error al actualizar estado: " + error.message);
        }
    };

    const handleCreateDirect = async (e: React.FormEvent) => {
        e.preventDefault();
        setDirectLoading(true);
        try {
            const projectsString = selectedDirectProjects.join(", ");
            // Generar una solicitud ya aprobada
            const { error: insertError } = await supabase.from("access_requests").insert([{
                full_name: directName,
                email: directEmail,
                project_number: projectsString || null,
                desired_role: directRole,
                status: 'approved'
            }]);

            if (insertError) throw insertError;

            // Enviar invitación
            // @ts-ignore
            const api = typeof window !== "undefined" ? (window as any).electronAPI : null;
            if (api?.sendEmail) {
                const tempPwd = Math.random().toString(36).slice(-8).toUpperCase();
                await api.sendEmail({
                    to: directEmail,
                    subject: "🚀 Acceso Directo a PACT",
                    html: `
                        <div style="font-family: sans-serif; padding: 30px; border: 1px solid #eee; border-radius: 20px; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #2563eb;">Acceso concedido a PACT</h2>
                            <p>El administrador te ha dado de alta directamente en el sistema.</p>
                            <div style="background: #f8fafc; padding: 20px; border-radius: 10px; margin: 20px 0;">
                                <p><strong>Email:</strong> ${directEmail}</p>
                                <p><strong>Password Temporal:</strong> <code>${tempPwd}</code></p>
                            </div>
                            <a href="https://pact.m2a-group.com/login" style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; display: inline-block;">
                                Iniciar Sesión Ahora
                            </a>
                        </div>
                    `
                });
            }

            alert("✓ Usuario creado e invitado correctamente.");
            setIsCreatingDirectly(false);
            setDirectEmail("");
            setDirectName("");
            setSelectedDirectProjects([]);
            setIsProjectDropdownOpen(false);
            fetchRequests();
        } catch (err: any) {
            alert("Error: " + err.message);
        } finally {
            setDirectLoading(false);
        }
    };

    const startEditing = (req: AccessRequest) => {
        setEditingId(req.id);
        setEditRole(req.desired_role);
        const projects = req.project_number ? req.project_number.split(",").map(p => p.trim()) : [];
        setSelectedEditProjects(projects);
    };

    const cancelEditing = () => {
        setEditingId(null);
        setIsEditProjectDropdownOpen(false);
    };

    const saveChanges = async (id: string) => {
        const projectsString = selectedEditProjects.join(", ");
        const { error } = await supabase
            .from("access_requests")
            .update({ 
                desired_role: editRole,
                project_number: projectsString || null
            })
            .eq("id", id);

        if (!error) {
            setRequests(prev => prev.map(r => r.id === id ? { ...r, desired_role: editRole, project_number: projectsString || null } : r));
            setEditingId(null);
            setSelectedEditProjects([]);
            setIsEditProjectDropdownOpen(false);
        } else {
            alert("Error al guardar cambios: " + error.message);
        }
    };

    if (!isAdmin) return null;

    return (
        <div className="max-w-6xl mx-auto py-10 px-4 space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <Link href="/" className="inline-flex items-center gap-1 text-slate-400 hover:text-primary text-sm font-bold mb-4 transition-colors">
                        <ArrowLeft size={16} /> Volver al Dashboard
                    </Link>
                    <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                        <Users className="text-primary" size={36} /> Solicitudes de Acceso
                    </h1>
                    <p className="text-slate-500 font-medium">Gestiona las peticiones de nuevos usuarios al sistema PACT.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setIsCreatingDirectly(!isCreatingDirectly)}
                        className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all flex items-center gap-2"
                    >
                        {isCreatingDirectly ? <XIcon size={16} /> : <UserCheck size={16} />}
                        {isCreatingDirectly ? 'Cancelar' : 'Dar de Alta Directamente'}
                    </button>
                    <div className="bg-primary/10 text-primary px-4 py-2 rounded-2xl border border-primary/20 text-[10px] font-black uppercase tracking-widest hidden md:block">
                        Panel de Administración
                    </div>
                </div>
            </div>

            {isCreatingDirectly && (
                <div className="card p-8 bg-blue-50 dark:bg-blue-900/10 border-2 border-primary/20 rounded-[2.5rem] animate-in slide-in-from-top-4 duration-300">
                    <form onSubmit={handleCreateDirect} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div className="space-y-1 md:col-span-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Nombre</label>
                            <input type="text" required value={directName} onChange={e => setDirectName(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl py-2 px-4 text-sm" placeholder="Nombre" />
                        </div>
                        <div className="space-y-1 md:col-span-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Email</label>
                            <input type="email" required value={directEmail} onChange={e => setDirectEmail(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl py-2 px-4 text-sm" placeholder="correo@ejemplo.com" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Proyecto(s)</label>
                            <MultiProjectDropdown 
                                availableProjects={availableProjects}
                                selectedProjects={selectedDirectProjects}
                                setSelectedProjects={setSelectedDirectProjects}
                                isOpen={isProjectDropdownOpen}
                                setIsOpen={setIsProjectDropdownOpen}
                                placeholder="Elegir proyectos..."
                            />
                        </div>
                        <div className="flex gap-2">
                            <div className="flex-1 space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Rol</label>
                                <select value={directRole} onChange={e => setDirectRole(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl py-2 px-4 text-sm">
                                    <option value="B">Admin Proyecto</option>
                                    <option value="C">Data Entry</option>
                                    <option value="D">Lectura</option>
                                </select>
                            </div>
                            <button disabled={directLoading} type="submit" className="bg-primary text-white p-3 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95">
                                {directLoading ? '...' : <Check size={20} />}
                            </button>
                        </div>
                    </form>
                </div>
            )}

                <AccessRequestLegend />

            <div className="card overflow-hidden border-none shadow-2xl shadow-slate-200 dark:shadow-none bg-white dark:bg-slate-900 rounded-[2rem]">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Solicitante</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Proyecto</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Rol Deseado</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Estado</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                            {loading ? (
                                [1, 2, 3].map(i => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={5} className="px-8 py-10"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-full"></div></td>
                                    </tr>
                                ))
                            ) : requests.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-8 py-20 text-center text-slate-400 italic">No hay solicitudes pendientes.</td>
                                </tr>
                            ) : requests.map(req => (
                                <tr key={req.id} className={`group transition-all ${editingId === req.id ? 'bg-blue-50/50 ring-2 ring-primary/20 ring-inset' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/20'}`}>
                                    <td className="px-8 py-6">
                                        <div className="flex flex-col gap-1">
                                            <span className="font-bold text-slate-900 dark:text-white text-lg">{req.full_name}</span>
                                            <span className="text-sm font-medium text-slate-500 flex items-center gap-1.5">
                                                <Mail size={14} className="text-slate-300" /> {req.email}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-mono mt-1 uppercase tracking-tighter">
                                                Recibida: {new Date(req.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        {editingId === req.id ? (
                                            <MultiProjectDropdown 
                                                availableProjects={availableProjects}
                                                selectedProjects={selectedEditProjects}
                                                setSelectedProjects={setSelectedEditProjects}
                                                isOpen={isEditProjectDropdownOpen}
                                                setIsOpen={setIsEditProjectDropdownOpen}
                                                placeholder="Elegir..."
                                            />
                                        ) : req.project_number ? (
                                            <div className="flex flex-wrap gap-1">
                                                {req.project_number.split(",").map((p, idx) => (
                                                    <span key={idx} className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-primary text-[10px] font-black rounded-md border border-blue-100 dark:border-blue-800">
                                                        {p.trim()}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-slate-300 text-xs italic">N/A</span>
                                        )}
                                    </td>
                                    <td className="px-8 py-6">
                                        {editingId === req.id ? (
                                            <select
                                                value={editRole}
                                                onChange={(e) => setEditRole(e.target.value)}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold"
                                            >
                                                <option value="B">Nivel B (Admin Proyecto)</option>
                                                <option value="C">Nivel C (Data Entry)</option>
                                                <option value="D">Nivel D (Solo Lectura)</option>
                                            </select>
                                        ) : (
                                            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl w-fit border border-slate-200 dark:border-slate-700">
                                                <Shield size={14} className="text-slate-400" /> Nivel {req.desired_role}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                            req.status === 'approved' 
                                                ? 'bg-green-50 border-green-100 text-green-600' 
                                                : req.status === 'rejected' 
                                                ? 'bg-red-50 border-red-100 text-red-600' 
                                                : 'bg-amber-50 border-amber-100 text-amber-600 animate-pulse'
                                        }`}>
                                            {req.status === 'approved' ? 'Aprobada' : req.status === 'rejected' ? 'Rechazada' : 'Pendiente'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <div className="flex justify-end gap-2">
                                            {editingId === req.id ? (
                                                <div className="flex items-center gap-1 bg-white p-1 rounded-2xl shadow-sm border border-slate-100">
                                                    <button 
                                                        onClick={cancelEditing}
                                                        className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                        title="Cancelar"
                                                    >
                                                        <XIcon size={18} />
                                                    </button>
                                                    <button 
                                                        onClick={() => saveChanges(req.id)}
                                                        className="px-4 py-2 bg-primary text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
                                                    >
                                                        <Check size={16} /> Guardar
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1">
                                                    <button 
                                                        onClick={() => startEditing(req)}
                                                        className="flex items-center gap-2 px-4 py-2 border-2 border-slate-100 text-slate-500 hover:text-primary hover:border-primary/30 hover:bg-primary/5 rounded-2xl transition-all group/btn"
                                                        title="Corregir Proyecto o Rol"
                                                    >
                                                        <Pencil size={18} className="group-hover/btn:scale-110 transition-transform" />
                                                        <span className="text-[10px] font-black uppercase tracking-widest">Corregir</span>
                                                    </button>
                                                    {req.status === 'pending' && (
                                                        <>
                                                            <div className="h-8 w-[1px] bg-slate-100 mx-1"></div>
                                                            <button 
                                                                onClick={() => handleUpdateStatus(req.id, 'rejected')}
                                                                className="p-3 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                                                                title="Rechazar"
                                                            >
                                                                <UserX size={20} />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleUpdateStatus(req.id, 'approved')}
                                                                className="p-3 text-green-500 hover:text-green-600 hover:bg-green-50 rounded-2xl transition-all"
                                                                title="Aprobar"
                                                            >
                                                                <UserCheck size={20} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
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

function MultiProjectDropdown({ 
    availableProjects, 
    selectedProjects, 
    setSelectedProjects, 
    isOpen, 
    setIsOpen,
    placeholder = "Seleccionar proyectos..."
}: {
    availableProjects: any[],
    selectedProjects: string[],
    setSelectedProjects: (projects: string[]) => void,
    isOpen: boolean,
    setIsOpen: (isOpen: boolean) => void,
    placeholder?: string
}) {
    const toggleProject = (numAct: string) => {
        if (selectedProjects.includes(numAct)) {
            setSelectedProjects(selectedProjects.filter(p => p !== numAct));
        } else {
            setSelectedProjects([...selectedProjects, numAct]);
        }
    };

    return (
        <div className="relative w-full">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-white border border-slate-200 rounded-xl py-2 px-4 text-sm flex items-center justify-between text-left min-h-[42px]"
            >
                <div className="flex flex-wrap gap-1 overflow-hidden">
                    {selectedProjects.length > 0 ? (
                        selectedProjects.map(p => (
                            <span key={p} className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-md border border-primary/20">
                                {p}
                            </span>
                        ))
                    ) : (
                        <span className="text-slate-400">{placeholder}</span>
                    )}
                </div>
                <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)}></div>
                    <div className="absolute z-50 mt-2 w-full max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl p-2 animate-in fade-in zoom-in-95 duration-200">
                        {availableProjects.length === 0 ? (
                            <div className="p-2 text-xs text-slate-400 text-center">No hay proyectos disponibles</div>
                        ) : (
                            availableProjects.map(project => (
                                <label
                                    key={project.id}
                                    className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                                >
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded text-primary focus:ring-primary border-slate-300"
                                        checked={selectedProjects.includes(project.num_act)}
                                        onChange={() => toggleProject(project.num_act)}
                                    />
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-slate-800">{project.num_act}</span>
                                        <span className="text-[10px] text-slate-500 truncate max-w-[200px]">{project.name}</span>
                                    </div>
                                </label>
                            ))
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

function AccessRequestLegend() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
            <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-primary font-bold text-xs italic">1</div>
                <p className="text-[10px] font-medium text-slate-500">Pulsa el botón <span className="text-primary font-black uppercase tracking-widest mx-1 font-sans border-b-2 border-primary/20">Corregir</span> para cambiar el proyecto o el rol de la solicitud.</p>
            </div>
            <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-primary font-bold text-xs italic">2</div>
                <p className="text-[10px] font-medium text-slate-500">Haz clic en <span className="text-primary font-black uppercase tracking-widest mx-1 font-sans border-b-2 border-primary/20">Guardar</span> cuando termines de hacer los cambios.</p>
            </div>
            <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-primary font-bold text-xs italic">3</div>
                <p className="text-[10px] font-medium text-slate-500">Pulsa el botón de <span className="text-green-600 font-black uppercase tracking-widest mx-1 font-sans border-b-2 border-green-200">Aprobar</span> para dar de alta al usuario.</p>
            </div>
        </div>
    );
}
