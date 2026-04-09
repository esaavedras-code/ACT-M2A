"use client";

import { useEffect, useState, Fragment } from "react";
import { supabase } from "@/lib/supabase";
import { UserCheck, UserX, Clock, Mail, Hash, Shield, ArrowLeft, Pencil, Check, X as XIcon, Users, ChevronDown, ShieldCheck, Monitor, Smartphone, AppWindow } from "lucide-react";
import Link from "next/link";

interface UserProfile {
    id: string;
    email: string;
    name: string | null;
    role_global: string;
    created_at: string;
    is_active?: boolean;
    last_active_at?: string;
    current_platform?: string;
    avatar_url?: string;
    subscription_start?: string;
    subscription_end?: string;
    subscription_duration?: string;
}

interface ActivityLog {
    id: string;
    user_id: string;
    platform: string;
    activity_detail: string;
    created_at: string;
}

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
    const [viewMode, setViewMode] = useState<'requests' | 'users'>('requests');
    const [activeUsers, setActiveUsers] = useState<UserProfile[]>([]);
    
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
    const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
    const [restrictedProjects, setRestrictedProjects] = useState<string[]>([]);

    const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
    const [userHistory, setUserHistory] = useState<Record<string, ActivityLog[]>>({});
    const [historyLoading, setHistoryLoading] = useState(false);
    
    // User subscription editing
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [subStart, setSubStart] = useState("");
    const [subEnd, setSubEnd] = useState("");
    const [subDuration, setSubDuration] = useState("");
    const [isSavingSub, setIsSavingSub] = useState(false);

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

            let isGlobal = user?.role_global === 'A';
            let limitations: string[] = [];

            if (!isGlobal) {
                const { data: mems } = await supabase
                    .from("memberships")
                    .select("project_id, role, projects(num_act)")
                    .eq("user_id", session.user.id);
                const bMems = mems?.filter(m => m.role === 'B') || [];
                if (bMems.length > 0) {
                    limitations = bMems.map((m: any) => {
                        const proj = Array.isArray(m.projects) ? m.projects[0] : m.projects;
                        return proj?.num_act;
                    }).filter(Boolean);
                } else {
                    alert("Acceso denegado. Se requiere rol de Administrador de Proyecto o Global.");
                    window.location.href = "/";
                    return;
                }
            }

            setIsGlobalAdmin(isGlobal);
            setRestrictedProjects(limitations);
            setIsAdmin(true);
            fetchInitialData(isGlobal, limitations);
        };

        checkAdmin();
    }, []);

    const fetchInitialData = async (isGlobal: boolean = isGlobalAdmin, limitations: string[] = restrictedProjects) => {
        setLoading(true);
        await Promise.all([
            fetchRequests(isGlobal, limitations),
            fetchProjects(isGlobal, limitations),
            fetchActiveUsers()
        ]);
        setLoading(false);
    };

    const fetchActiveUsers = async () => {
        const { data } = await supabase
            .from("users")
            .select("id, email, name, role_global, created_at, is_active, last_active_at, current_platform, subscription_start, subscription_end, subscription_duration")
            .order("created_at", { ascending: false });
        if (data) setActiveUsers(data);
    };

    const getRoleLabel = (role: string) => {
        switch(role) {
            case 'A': return 'Administrador Global';
            case 'B': return 'Admin Proyecto';
            case 'C': return 'Data Entry';
            case 'D': return 'Lectura';
            case 'E': return 'Inspector';
            case 'F': return 'Contratista';
            default: return 'Estándar';
        }
    };

    const getRoleColorClass = (role: string) => {
        switch(role) {
            case 'A': return 'bg-primary/10 border-primary/20 text-primary';
            case 'B': return 'bg-amber-50 border-amber-100 text-amber-600';
            case 'C': return 'bg-slate-100 border-slate-200 text-slate-600';
            case 'D': return 'bg-slate-100 border-slate-200 text-slate-400';
            case 'E': return 'bg-blue-50 border-blue-100 text-blue-600';
            case 'F': return 'bg-rose-50 border-rose-100 text-rose-700'; // Color vino aprox
            default: return 'bg-slate-100 border-slate-200 text-slate-500';
        }
    };

    const fetchUserHistory = async (userId: string) => {
        if (expandedUserId === userId) {
            setExpandedUserId(null);
            return;
        }
        
        setExpandedUserId(userId);
        if (userHistory[userId]) return;
        
        setHistoryLoading(true);
        const { data } = await supabase
            .from("user_activity_log")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(20);
        if (data) {
            setUserHistory(prev => ({ ...prev, [userId]: data }));
        }
        setHistoryLoading(false);
    };

    const fetchRequests = async (isGlobal: boolean = isGlobalAdmin, limitations: string[] = restrictedProjects) => {
        const { data, error } = await supabase
            .from("access_requests")
            .select("*")
            .order("created_at", { ascending: false });

        if (data) {
            if (!isGlobal && limitations.length > 0) {
                const filtered = data.filter(r => {
                    if (!r.project_number) return false;
                    const reqProjects = r.project_number.split(',').map((p: string) => p.trim());
                    return reqProjects.some((p: string) => limitations.includes(p));
                });
                setRequests(filtered);
            } else {
                setRequests(data);
            }
        }
    };

    const fetchProjects = async (isGlobal: boolean = isGlobalAdmin, limitations: string[] = restrictedProjects) => {
        const { data, error } = await supabase
            .from("projects")
            .select("id, num_act, name")
            .order("num_act", { ascending: true });

        if (data) {
            let fp = data.filter(p => p.num_act);
            if (!isGlobal && limitations.length > 0) {
                fp = fp.filter(p => limitations.includes(p.num_act));
            }
            setAvailableProjects(fp);
        }
    };

    const handleUpdateStatus = async (id: string, newStatus: string) => {
        const req = requests.find(r => r.id === id);
        if (!req) return;

        if (newStatus === 'approved') {
            if (req.desired_role === 'A') {
                const firstConfirm = confirm("⚠️ ATENCIÓN: Estás por otorgar privilegios de ADMINISTRADOR GLOBAL (Nivel A). ¿Estás seguro de que quieres dar acceso total a este usuario?");
                if (!firstConfirm) return;
                const secondConfirm = confirm("🛑 ÚLTIMO AVISO: El acceso de Administrador Global permite borrar proyectos y gestionar otros usuarios. ¿Confirmas definitivamente elevar este usuario a Administrador Global?");
                if (!secondConfirm) return;
            }

            const tempPwd = "PACT-" + Math.random().toString(36).slice(-5).toUpperCase();
            
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-auth-v2`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session?.access_token}`,
                        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
                    },
                    body: JSON.stringify({
                        action: 'create_user',
                        email: req.email.toLowerCase(),
                        password: tempPwd,
                        name: req.full_name,
                        role: req.desired_role,
                        projects: req.project_number ? req.project_number.split(",").map(p => p.trim()) : []
                    })
                });

                const result = await response.json();
                if (result.error) throw new Error(result.error);

                const { error: DBerror } = await supabase
                    .from("access_requests")
                    .update({ status: newStatus })
                    .eq("id", id);
                
                if (DBerror) throw DBerror;

                setRequests(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));

                const api = typeof window !== "undefined" ? (window as any).electronAPI : null;
                const emailData = {
                    to: req.email,
                    subject: "🔐 Tus Credenciales de Acceso PACT",
                    html: `
                        <div style="font-family: sans-serif; padding: 30px; border: 1px solid #eee; border-radius: 20px; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #2563eb;">¡Hola ${req.full_name}!</h2>
                            <p>Tu solicitud de acceso al sistema PACT ha sido <strong>aprobada</strong> por el administrador.</p>
                            <div style="background: #f8fafc; padding: 25px; border-radius: 12px; margin: 25px 0; border: 1px solid #e2e8f0;">
                                <p style="margin: 0 0 10px 0;"><strong>Usuario:</strong> ${req.email}</p>
                                <p style="margin: 0;"><strong>Password Temporero:</strong> <code style="background: #e2e8f0; padding: 4px 8px; border-radius: 4px; font-size: 16px; font-weight: bold;">${tempPwd}</code></p>
                            </div>
                            <p style="color: #475569; line-height: 1.6;">Con esta información ya puedes acceder al sistema PACT desde el navegador.</p>
                            <div style="text-align: center; margin: 20px 0;">
                                <a href="https://act-m2-a.vercel.app" style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: 700; display: inline-block;">🌐 Entrar al Programa Web</a>
                            </div>
                            <p style="font-size: 12px; color: #94a3b8; margin-top: 30px; border-top: 1px solid #f1f5f9; pt: 20px;">Este es un mensaje automático del sistema de administración PACT.</p>
                        </div>
                    `
                };

                if (api?.sendEmail) {
                    await api.sendEmail(emailData);
                } else {
                    await fetch('https://dtpfhwxwodzpitzmrbqr.supabase.co/functions/v1/send-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(emailData)
                    });
                }
                alert("✓ Solicitud aprobada y usuario creado correctamente.");
                fetchActiveUsers();
            } catch (err: any) {
                console.error("Error en aprobación:", err);
                alert("Error al crear usuario: " + err.message);
                return;
            }
        } else {
            const { error: DBerror } = await supabase
                .from("access_requests")
                .update({ status: newStatus })
                .eq("id", id);

            if (DBerror) {
                alert("Error al actualizar estado: " + DBerror.message);
            } else {
                setRequests(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
                alert("Solicitud actualizada a: " + newStatus);
            }
        }
    };

    const handleToggleUserStatus = async (userId: string, currentStatus: boolean, email?: string) => {
        const newStatus = !currentStatus;
        const confirmMsg = newStatus
            ? `¿Estás seguro de que deseas ACTIVAR a ${email}? Podrá acceder al sistema nuevamente.`
            : `¿Estás seguro de que deseas DESACTIVAR a ${email}? Ya no podrá acceder al sistema, pero sus datos se mantendrán.`;
            
        if (!confirm(confirmMsg)) return;

        setIsDeletingId(userId);
        try {
            const { error } = await supabase
                .from("users")
                .update({ is_active: newStatus })
                .eq("id", userId);

            if (error) throw error;
            
            alert(`✓ Usuario ${newStatus ? 'activado' : 'desactivado'} correctamente.`);
            setActiveUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: newStatus } : u));
        } catch (err: any) {
            alert("Error al cambiar estado del usuario: " + err.message);
        } finally {
            setIsDeletingId(null);
        }
    };

    const handleDeleteUser = async (userId: string, email?: string) => {
        const confirmMsg = email 
            ? `¿Estás seguro de que deseas borrar el acceso de ${email}? Se eliminará de la base de datos y de la autenticación.`
            : "¿Estás seguro de que deseas borrar el acceso de este usuario?";
            
        if (!confirm(confirmMsg)) return;

        const secondConfirm = confirm("🛑 ATENCIÓN: Esta acción es IRREVERSIBLE. Se eliminarán permanentemente los permisos de acceso y el registro del usuario. ¿Confirmas definitivamente el borrado?");
        if (!secondConfirm) return;

        setIsDeletingId(userId);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            
            const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-auth-v2`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`,
                    'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
                },
                body: JSON.stringify({
                    action: 'delete_user',
                    userId: userId
                })
            });

            const result = await response.json();
            if (result.error) throw new Error(result.error);

            if (email) {
                await supabase.from("access_requests").delete().eq("email", email);
            }

            alert("✓ Acceso borrado correctamente.");
            await fetchInitialData();
        } catch (err: any) {
            alert("Error al borrar usuario: " + err.message);
        } finally {
            setIsDeletingId(null);
        }
    };

    const handleDeleteRequest = async (id: string) => {
        if (!confirm("¿Deseas eliminar este registro de solicitud? (Esto no borra al usuario si ya fue aprobado)")) return;
        
        const { error } = await supabase.from("access_requests").delete().eq("id", id);
        if (!error) {
            setRequests(prev => prev.filter(r => r.id !== id));
        } else {
            alert("Error al eliminar registro: " + error.message);
        }
    };

    const handleCreateDirect = async (e: React.FormEvent) => {
        e.preventDefault();
        setDirectLoading(true);
        try {
            const projectsString = selectedDirectProjects.join(", ");
            const { error: insertError } = await supabase.from("access_requests").insert([{
                full_name: directName,
                email: directEmail,
                project_number: projectsString || null,
                desired_role: directRole,
                status: 'approved'
            }]);

            if (insertError) throw insertError;

            if (directRole === 'A') {
                const firstConfirm = confirm("⚠️ ATENCIÓN: Estás por crear un usuario con privilegios de ADMINISTRADOR GLOBAL (Nivel A). ¿Estás seguro de que quieres otorgar acceso total al programa a esta persona?");
                if (!firstConfirm) {
                    setDirectLoading(false);
                    return;
                }
                const secondConfirm = confirm("🛑 ÚLTIMO AVISO: Un Administrador Global puede borrar proyectos, crear otros administradores y ver toda la información sensible. ¿Confirmas definitivamente la creación de este perfil de administrador?");
                if (!secondConfirm) {
                    setDirectLoading(false);
                    return;
                }
            }

            const tempPwd = "PACT-" + Math.random().toString(36).slice(-5).toUpperCase();
            
            const { data: { session } } = await supabase.auth.getSession();
            const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-auth-v2`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`,
                    'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
                },
                body: JSON.stringify({
                    action: 'create_user',
                    email: directEmail.toLowerCase(),
                    password: tempPwd,
                    name: directName,
                    role: directRole,
                    projects: selectedDirectProjects
                })
            });

            const result = await response.json();
            if (result.error) throw new Error(result.error);

            const api = typeof window !== "undefined" ? (window as any).electronAPI : null;
            const invitationData = {
                to: directEmail,
                subject: "🚀 Acceso Directo a PACT",
                html: `
                    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
                        <div style="background-color: #2563eb; padding: 32px; text-align: center;">
                            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 800;">📋 PACT</h1>
                            <p style="color: #bfdbfe; margin: 8px 0 0 0; font-size: 14px;">Sistema de Gestión de Proyectos de Carreteras</p>
                        </div>
                        <div style="padding: 32px; background-color: white;">
                            <h2 style="color: #1e293b; margin: 0 0 12px 0;">¡Acceso Concedido!</h2>
                            <p style="color: #64748b; line-height: 1.6; margin: 0 0 24px 0;">
                                El administrador te ha registrado directamente en el sistema PACT. Ya puedes acceder con las siguientes credenciales.
                            </p>
                            <div style="background-color: #f8fafc; padding: 20px; border-radius: 10px; margin: 0 0 24px 0; border: 1px solid #e2e8f0;">
                                <p style="margin: 0 0 12px 0; font-weight: 700; color: #374151; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">🔑 Tus Credenciales de Acceso</p>
                                <p style="margin: 5px 0; font-size: 15px;"><strong>Usuario/Email:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${directEmail}</code></p>
                                <p style="margin: 5px 0; font-size: 15px;"><strong>Password Temporero:</strong> <code style="background: #e2e8f0; padding: 4px 8px; border-radius: 4px; font-size: 16px; font-weight: bold;">${tempPwd}</code></p>
                            </div>
                            <div style="text-align: center; margin: 28px 0 20px 0;">
                                <a href="https://act-m2-a.vercel.app" style="background-color: #2563eb; color: white; padding: 16px 32px; text-decoration: none; border-radius: 10px; font-weight: 700; display: inline-block; font-size: 16px;">
                                    🌐 Entrar al Programa Web
                                </a>
                            </div>
                            <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 20px 0 0 0; border-top: 1px solid #f1f5f9; padding-top: 16px;">
                                Enlace directo: <a href="https://act-m2-a.vercel.app" style="color: #2563eb;">https://act-m2-a.vercel.app</a><br/>
                                Se recomienda cambiar tu contraseña en tu primer acceso.
                            </p>
                        </div>
                        <div style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8;">
                            Este es un correo automático del Sistema PACT — ACT Puerto Rico
                        </div>
                    </div>
                `
            };

            if (api?.sendEmail) {
                await api.sendEmail(invitationData);
            } else {
                await fetch('https://dtpfhwxwodzpitzmrbqr.supabase.co/functions/v1/send-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(invitationData)
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

    const startEditing = async (req: AccessRequest) => {
        setEditingId(req.id);
        setEditRole(req.desired_role);
        
        let projects = req.project_number ? req.project_number.split(",").map(p => p.trim()) : [];
        
        const existingUser = activeUsers.find(u => u.email.toLowerCase() === req.email.toLowerCase());
        if (existingUser) {
            const { data: mems } = await supabase
                .from("memberships")
                .select("projects(num_act)")
                .eq("user_id", existingUser.id);
            
            if (mems && mems.length > 0) {
                const currentProjects = mems
                    .map((m: any) => m.projects?.num_act)
                    .filter(Boolean);
                
                projects = Array.from(new Set([...projects, ...currentProjects]));
            }
        }
        
        setSelectedEditProjects(projects);
    };

    const cancelEditing = () => {
        setEditingId(null);
        setIsEditProjectDropdownOpen(false);
    };

    const saveChanges = async (id: string) => {
        const req = requests.find(r => r.id === id);
        if (!req) return;

        const projectsString = selectedEditProjects.join(", ");
        const { error } = await supabase
            .from("access_requests")
            .update({ 
                desired_role: editRole,
                project_number: projectsString || null
            })
            .eq("id", id);

        if (!error) {
            if (req.status === 'approved') {
                try {
                    const { data: { session } } = await supabase.auth.getSession();
                    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-auth-v2`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session?.access_token}`,
                            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
                        },
                        body: JSON.stringify({
                            action: 'create_user',
                            email: req.email.toLowerCase(),
                            name: req.full_name,
                            role: editRole,
                            projects: selectedEditProjects
                        })
                    });

                    const result = await response.json();
                    if (result.error) throw new Error(result.error);
                    
                    alert("✓ Cambios guardados y permisos sincronizados correctamente.");
                } catch (err: any) {
                    console.error("Error sincronizando permisos:", err);
                    alert("⚠️ Registro actualizado, pero hubo un problema sincronizando permisos reales: " + err.message);
                }
            } else {
                alert("✓ Registro actualizado exitosamente.");
            }

            setRequests(prev => prev.map(r => r.id === id ? { ...r, desired_role: editRole, project_number: projectsString || null } : r));
            setEditingId(null);
            setSelectedEditProjects([]);
            setIsEditProjectDropdownOpen(false);
        } else {
            alert("Error al guardar cambios: " + error.message);
        }
    };

    const handleStartEditSub = (user: UserProfile) => {
        setEditingUserId(user.id);
        setSubStart(user.subscription_start || "");
        setSubEnd(user.subscription_end || "");
        setSubDuration(user.subscription_duration || "");
    };

    const handleSaveSubscription = async (userId: string) => {
        setIsSavingSub(true);
        try {
            const { error } = await supabase
                .from("users")
                .update({
                    subscription_start: subStart || null,
                    subscription_end: subEnd || null,
                    subscription_duration: subDuration
                })
                .eq("id", userId);

            if (error) throw error;
            
            alert("✓ Membresía actualizada correctamente.");
            setEditingUserId(null);
            fetchActiveUsers();
        } catch (err: any) {
            alert("Error al actualizar membresía: " + err.message);
        } finally {
            setIsSavingSub(false);
        }
    };

    const handleUpdateUserRole = async (userId: string, newRole: string) => {
        try {
            const { error } = await supabase
                .from("users")
                .update({ role_global: newRole })
                .eq("id", userId);

            if (error) throw error;
            
            alert(`✓ Rol actualizado a ${getRoleLabel(newRole)} correctamente.`);
            fetchActiveUsers();
        } catch (err: any) {
            alert("Error al actualizar rol: " + err.message);
        }
    };

    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-500 font-medium animate-pulse">Verificando credenciales de administrador...</p>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto py-10 px-4 space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <Link href="/" className="inline-flex items-center gap-1 text-slate-400 hover:text-primary text-sm font-bold mb-4 transition-colors">
                        <ArrowLeft size={16} /> Volver
                    </Link>
                    <h1 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter flex items-center gap-3">
                        <ShieldCheck className="text-primary" size={32} />
                        Gestión de Usuarios y Accesos
                    </h1>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic ml-1">Administración de solicitudes y permisos globales</p>
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
                            <input 
                                type="text" 
                                required 
                                value={directName} 
                                onChange={e => setDirectName(e.target.value)} 
                                className="w-full bg-white border border-slate-200 rounded-xl py-2 px-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none relative z-20" 
                                placeholder="Nombre" 
                            />
                        </div>
                        <div className="space-y-1 md:col-span-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Email</label>
                            <input 
                                type="email" 
                                required 
                                value={directEmail} 
                                onChange={e => setDirectEmail(e.target.value)} 
                                className="w-full bg-white border border-slate-200 rounded-xl py-2 px-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none relative z-20" 
                                placeholder="correo@ejemplo.com" 
                            />
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
                                    {isGlobalAdmin && <option value="A">Administrador Global (A)</option>}
                                    {isGlobalAdmin && <option value="B">Administrador de Proyecto (B)</option>}
                                    <option value="C">Data Entry (C)</option>
                                    <option value="D">Solo Lectura (D)</option>
                                    <option value="E">Inspector (E)</option>
                                    <option value="F">Contratista (F)</option>
                                </select>
                            </div>
                            <button disabled={directLoading} type="submit" className="bg-primary text-white p-3 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95">
                                {directLoading ? '...' : <Check size={20} />}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white/50 backdrop-blur-md sticky top-0 z-10 rounded-t-2xl">
                <button 
                    onClick={() => setViewMode('requests')}
                    className={`flex-1 px-8 py-5 font-black text-xs uppercase tracking-widest transition-all border-b-4 flex items-center justify-center gap-2 ${viewMode === 'requests' ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    <Clock size={16} /> Solicitudes {requests.filter(r => r.status === 'pending').length > 0 && <span className="bg-amber-500 text-white px-2 py-0.5 rounded-full text-[8px]">{requests.filter(r => r.status === 'pending').length}</span>}
                </button>
                {isGlobalAdmin && (
                    <button 
                        onClick={() => setViewMode('users')}
                        className={`flex-1 px-8 py-5 font-black text-xs uppercase tracking-widest transition-all border-b-4 flex items-center justify-center gap-2 ${viewMode === 'users' ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        <Users size={16} /> Usuarios Activos <span className="opacity-50 font-normal">({activeUsers.length})</span>
                    </button>
                )}
            </div>

            {viewMode === 'users' && (
                <div className="relative z-20">
                    <input 
                        type="text"
                        placeholder="Buscar por nombre o email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-2xl py-4 px-12 text-sm focus:border-primary/30 focus:ring-0 transition-all shadow-sm relative z-20"
                    />
                    <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 z-30" size={20} />
                </div>
            )}

            {viewMode === 'requests' ? (
                <div className="space-y-6">
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
                                            <td colSpan={5} className="px-8 py-20 text-center text-slate-400 italic">No hay solicitudes registradas.</td>
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
                                                        Recibida: {new Date(req.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
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
                                                        {isGlobalAdmin && <option value="B">Nivel B (Admin de Proyecto)</option>}
                                                        <option value="C">Nivel C (Data Entry)</option>
                                                        <option value="D">Nivel D (Solo Lectura)</option>
                                                        <option value="E">Nivel E (Inspector)</option>
                                                        <option value="F">Nivel F (Contratista)</option>
                                                    </select>
                                                ) : (
                                                    <span className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl w-fit border ${getRoleColorClass(req.desired_role)}`}>
                                                        <Shield size={14} className="opacity-70" /> {getRoleLabel(req.desired_role)}
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
                                                                <Check size={16} />
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
                                                            </button>
                                                            {req.status === 'pending' ? (
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
                                                            ) : (
                                                                <button 
                                                                    onClick={() => handleDeleteRequest(req.id)}
                                                                    className="p-3 text-slate-300 hover:text-red-400 hover:bg-red-50 rounded-2xl transition-all"
                                                                    title="Eliminar Registro Histórico"
                                                                >
                                                                    <XIcon size={20} />
                                                                </button>
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
            ) : (
                <div className="card overflow-hidden border-none shadow-2xl shadow-slate-200 dark:shadow-none bg-white dark:bg-slate-900 rounded-[2rem]">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Usuario</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Estado / Plataforma</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Membresía / Vigencia</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Rol Global</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Registro</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                {activeUsers.filter(u => 
                                    u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                    (u.name || "").toLowerCase().includes(searchTerm.toLowerCase())
                                ).length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-8 py-20 text-center text-slate-400 italic">No se encontraron usuarios activos que coincidan.</td>
                                    </tr>
                                ) : activeUsers
                                    .filter(u => 
                                        u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                        (u.name || "").toLowerCase().includes(searchTerm.toLowerCase())
                                    )
                                    .map(user => (
                                        <Fragment key={user.id}>
                                            <tr className={`transition-all ${expandedUserId === user.id ? 'bg-blue-50/30' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/20'}`}>
                                                <td className="px-8 py-6">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="font-bold text-slate-900 dark:text-white text-lg flex items-center gap-2">
                                                            {user.name || 'Sin nombre'}
                                                            {user.is_active === false && (
                                                                <span className="bg-rose-100 text-rose-600 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest border border-rose-200">
                                                                    Inactivo
                                                                </span>
                                                            )}
                                                        </span>
                                                        <span className="text-sm font-medium text-slate-500 flex items-center gap-1.5">
                                                            <Mail size={14} className="text-slate-300" /> {user.email}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className="flex flex-col items-center gap-2">
                                                        {(() => {
                                                            const isOnline = user.last_active_at && (new Date().getTime() - new Date(user.last_active_at).getTime() < 300000); // 5 mins
                                                            return (
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`w-3 h-3 rounded-full shadow-sm ${isOnline ? 'bg-green-500 animate-pulse ring-4 ring-green-500/20' : 'bg-red-400'}`}></div>
                                                                    <span className={`text-[10px] font-black uppercase tracking-widest ${isOnline ? 'text-green-600' : 'text-slate-400'}`}>
                                                                        {isOnline ? 'En línea' : 'Desconectado'}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })()}
                                                        {user.current_platform && (
                                                            <span className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-black rounded border border-slate-200 dark:border-slate-700 w-fit text-center mx-auto">
                                                                {user.current_platform.includes('Celular') || user.current_platform === 'Mobile' ? <Smartphone size={10} /> : user.current_platform.includes('Windows') || user.current_platform === 'Windows' ? <AppWindow size={10} /> : <Monitor size={10} />}
                                                                {user.current_platform === 'Mobile' ? 'Web (Celular)' : user.current_platform === 'Desktop' ? 'Web (Computadora)' : user.current_platform === 'Windows' ? 'App Windows' : user.current_platform}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    {editingUserId === user.id ? (
                                                        <div className="flex flex-col gap-2 min-w-[200px]">
                                                            <div className="flex gap-1">
                                                                <div className="flex-1">
                                                                    <label className="text-[8px] font-bold text-slate-400 uppercase">Inicio</label>
                                                                    <input type="date" value={subStart} onChange={e => setSubStart(e.target.value)} className="w-full text-[10px] border rounded p-1" />
                                                                </div>
                                                                <div className="flex-1">
                                                                    <label className="text-[8px] font-bold text-slate-400 uppercase">Fin</label>
                                                                    <input type="date" value={subEnd} onChange={e => setSubEnd(e.target.value)} className="w-full text-[10px] border rounded p-1" />
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-1 items-end">
                                                                <div className="flex-1">
                                                                    <label className="text-[8px] font-bold text-slate-400 uppercase">Duración</label>
                                                                    <input type="text" placeholder="Ej: 1 año" value={subDuration} onChange={e => setSubDuration(e.target.value)} className="w-full text-[10px] border rounded p-1" />
                                                                </div>
                                                                <button onClick={() => handleSaveSubscription(user.id)} className="bg-primary text-white p-1.5 rounded hover:bg-blue-600 transition-colors">
                                                                    <Check size={14} />
                                                                </button>
                                                                <button onClick={() => setEditingUserId(null)} className="bg-slate-100 text-slate-500 p-1.5 rounded hover:bg-slate-200 transition-colors">
                                                                    <XIcon size={14} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col gap-1 cursor-pointer hover:bg-slate-50 p-1 rounded transition-colors group" onClick={() => handleStartEditSub(user)}>
                                                            {user.subscription_end ? (
                                                                <>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <Clock size={12} className={new Date(user.subscription_end) < new Date() ? 'text-red-500' : 'text-slate-400'} />
                                                                        <span className={`text-[10px] font-bold ${new Date(user.subscription_end) < new Date() ? 'text-red-600' : 'text-slate-600'}`}>
                                                                            Vence: {new Date(user.subscription_end).toLocaleDateString()}
                                                                        </span>
                                                                    </div>
                                                                    {user.subscription_duration && (
                                                                        <span className="text-[9px] text-slate-400 font-medium bg-slate-100 px-1.5 py-0.5 rounded w-fit">
                                                                            {user.subscription_duration}
                                                                        </span>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <span className="text-[10px] text-slate-400 italic">Sin membresía definida</span>
                                                            )}
                                                            <div className="text-[9px] text-slate-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <Pencil size={8} /> Click para editar
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className="group relative cursor-pointer" onClick={() => {
                                                        const newRole = prompt(`Cambiar rol para ${user.email}. \nRoles disponibles: B, C, D, E, F`, user.role_global);
                                                        if (newRole && ['B','C','D','E','F'].includes(newRole.toUpperCase())) {
                                                            const role = newRole.toUpperCase();
                                                            if (confirm(`¿Confirmas cambiar el rol de ${user.email} a ${getRoleLabel(role)}?`)) {
                                                                handleUpdateUserRole(user.id, role);
                                                            }
                                                        }
                                                    }}>
                                                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${getRoleColorClass(user.role_global)}`}>
                                                            {getRoleLabel(user.role_global)}
                                                        </span>
                                                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[8px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg">
                                                            Click para cambiar rol
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 text-[10px] text-slate-400 font-bold uppercase">
                                                    {new Date(user.created_at).toLocaleDateString([], { dateStyle: 'short' })}
                                                </td>
                                                <td className="px-8 py-6 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button 
                                                            onClick={() => fetchUserHistory(user.id)}
                                                            className={`p-3 rounded-2xl transition-all flex items-center gap-2 border shadow-sm ${expandedUserId === user.id ? 'bg-primary text-white border-primary shadow-primary/20' : 'bg-white border-slate-200 text-slate-500 hover:border-primary/50 hover:text-primary'}`}
                                                            title="Ver Historial de Actividad"
                                                        >
                                                            <Clock size={18} />
                                                            <ChevronDown size={14} className={`transition-transform duration-300 ${expandedUserId === user.id ? 'rotate-180' : ''}`} />
                                                        </button>
                                                        <div className="w-[1px] h-8 bg-slate-100 dark:bg-slate-800 mx-1"></div>
                                                        {/* Toggle Status Button */}
                                                        {(user.role_global !== 'A' || isGlobalAdmin) && (
                                                            <button 
                                                                disabled={isDeletingId === user.id || user.role_global === 'A'}
                                                                onClick={() => handleToggleUserStatus(user.id, user.is_active !== false, user.email)}
                                                                className={`p-3 rounded-2xl transition-all disabled:opacity-30 group flex-1 max-w-[40px] ${
                                                                    user.is_active === false 
                                                                        ? 'text-green-500 hover:bg-green-50' 
                                                                        : 'text-amber-500 hover:bg-amber-50'
                                                                }`}
                                                                title={user.is_active === false ? "Activar Usuario" : "Desactivar Usuario"}
                                                            >
                                                                {user.is_active === false ? <Check size={20} className="group-hover:scale-110 transition-transform" /> : <XIcon size={20} className="group-hover:scale-110 transition-transform" />}
                                                            </button>
                                                        )}
                                                        <button 
                                                            disabled={isDeletingId === user.id || user.role_global === 'A'}
                                                            onClick={() => handleDeleteUser(user.id, user.email)}
                                                            className="p-3 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all disabled:opacity-30 group"
                                                            title="Eliminar Acceso de Usuario"
                                                        >
                                                            <UserX size={20} className="group-hover:scale-110 transition-transform" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                            {expandedUserId === user.id && (
                                                <tr key={`${user.id}-history`} className="bg-blue-50/20 dark:bg-blue-900/5 animate-in slide-in-from-top-2 duration-300">
                                                    <td colSpan={5} className="px-8 py-0">
                                                        <div className="py-6 border-t border-blue-100/50 dark:border-blue-900/20">
                                                            <div className="flex items-center justify-between mb-3">
                                                                <h4 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                                                    <Clock size={12} /> Últimas 20 actividades
                                                                </h4>
                                                                {historyLoading && <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>}
                                                            </div>
                                                            
                                                            {userHistory[user.id]?.length === 0 ? (
                                                                <p className="text-[10px] text-slate-400 italic py-2">No hay registros de actividad recientes.</p>
                                                            ) : (
                                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                                                                    {userHistory[user.id]?.map((log) => (
                                                                        <div key={log.id} className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col gap-1 hover:shadow-md transition-shadow">
                                                                            <div className="flex justify-between items-start">
                                                                                <span className="text-[9px] font-bold text-slate-700 dark:text-slate-300 leading-tight pr-1 line-clamp-2" title={log.activity_detail}>
                                                                                    {log.activity_detail}
                                                                                </span>
                                                                                <span className="px-1.5 py-0.5 bg-slate-50 dark:bg-slate-900 text-[8px] font-bold text-slate-400 border border-slate-100 dark:border-slate-800 rounded">
                                                                                    {log.platform}
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex items-center gap-1 text-[9px] text-slate-400 font-medium">
                                                                                <Clock size={10} />
                                                                                {new Date(log.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
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

