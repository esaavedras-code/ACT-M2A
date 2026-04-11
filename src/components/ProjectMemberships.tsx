"use client";

import { useState, useEffect } from "react";
import { UserPlus, Link as LinkIcon, Users, Trash2, Shield } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Membership {
    id: string;
    role: string;
    user: { name: string, email: string };
    expires_at: string | null;
    is_active: boolean;
}

export default function ProjectMemberships({ projectId, currentUserRole }: { projectId: string, currentUserRole: string }) {
    const [members, setMembers] = useState<Membership[]>([]);
    const [loading, setLoading] = useState(true);
    const [email, setEmail] = useState("");
    const [role, setRole] = useState("C");
    const [linkRole, setLinkRole] = useState("C");
    const [generatedLink, setGeneratedLink] = useState<string | null>(null);
    const [linkCopied, setLinkCopied] = useState(false);
    const [inviteLoading, setInviteLoading] = useState(false);
    const [linkLoading, setLinkLoading] = useState(false);
    const [tempPassword, setTempPassword] = useState("");
    
    // Only A or B can manage members; A and B can toggle active status
    const canManage = ['A', 'B'].includes(currentUserRole);
    const canToggleActive = ['A', 'B'].includes(currentUserRole);

    useEffect(() => {
        fetchMemberships();
        // Generate a random 8-char password by default
        setTempPassword(Math.random().toString(36).slice(-8).toUpperCase());
    }, [projectId]);

    const fetchMemberships = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("memberships")
            .select("id, role, expires_at, user_id, is_active, public.users(name, email)")
            .eq("project_id", projectId)
            .is("revoked_at", null);
            
        if (data) {
            setMembers(data.map((m: any) => ({
                id: m.id,
                role: m.role,
                user: m.public_users ?? { name: "Invitado pendiente", email: "No aceptado" },
                expires_at: m.expires_at,
                is_active: m.is_active ?? true,
            })));
        }
        setLoading(false);
    };

    const copyToClipboard = (text: string) => {
        try {
            if (navigator.clipboard) {
                navigator.clipboard.writeText(text);
            } else {
                // Fallback para contextos sin clipboard API (electron en algunos casos)
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.focus();
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
        } catch (err) {
            console.error('Error copiando al portapapeles:', err);
        }
    };

    const handleInviteEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        setInviteLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                alert("Debes iniciar sesión para invitar miembros.");
                return;
            }
            
            // 1. Asegurar contraseña temporal, debe empezar con PACT- para forzar cambio si es usuario nuevo
            const actualPassword = tempPassword && tempPassword.startsWith('PACT-') ? tempPassword : `PACT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
            
            // 2. Crear y asignar usuario usando API
            const reqRes = await fetch('/api/create-project-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    role,
                    projectId,
                    password: actualPassword,
                    invitedBy: session.user.id
                })
            });

            const apiData = await reqRes.json();
            if (!reqRes.ok) {
                alert("No pudimos crear o asignar el usuario. Error: " + (apiData.error || reqRes.statusText));
                return;
            }

            // 3. Preparar enlace a login
            const loginLink = `https://act-m2-a.vercel.app/login`;

            // 4. Enviar correo vía Electron IPC o fallback de API Web
            // @ts-ignore
            const api = typeof window !== "undefined" ? (window as any).electronAPI : null;
            const emailData = {
                to: email,
                subject: `Acceso a Proyecto en PACT`,
                html: `
                    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
                        
                        <!-- Header -->
                        <div style="background-color: #2563eb; padding: 32px; text-align: center;">
                            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 800;">📋 PACT</h1>
                            <p style="color: #bfdbfe; margin: 8px 0 0 0; font-size: 14px;">Sistema de Gestión de Proyectos de Carreteras</p>
                        </div>

                        <!-- Body -->
                        <div style="padding: 32px; background-color: white;">
                            <h2 style="color: #1e293b; margin: 0 0 12px 0;">¡Tienes acceso a PACT!</h2>
                            <p style="color: #64748b; line-height: 1.6; margin: 0 0 24px 0;">
                                Se te ha asignado el rol <strong style="color: #2563eb;">Nivel ${role}</strong> en un proyecto de construcción de la ACT.
                            </p>

                            <!-- Credenciales -->
                            <div style="background-color: #f8fafc; padding: 20px; border-radius: 10px; margin: 0 0 24px 0; border: 1px solid #e2e8f0;">
                                <p style="margin: 0 0 12px 0; font-weight: 700; color: #374151; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">🔑 Tus Credenciales de Acceso</p>
                                <p style="margin: 5px 0; font-size: 15px;"><strong>Usuario:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${email}</code></p>
                                ${apiData.isNewUser ? `<p style="margin: 5px 0; font-size: 15px;"><strong>Password Temporal:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 16px; font-weight: bold;">${actualPassword}</code></p>` : `<p style="margin: 5px 0; font-size: 14px; color: #64748b;"><i>Usa tu contraseña actual de PACT.</i></p>`}
                            </div>

                            <!-- Botones -->
                            <div style="text-align: center; margin: 28px 0 20px 0;">
                                <a href="${loginLink}" style="background-color: #2563eb; color: white; padding: 16px 32px; text-decoration: none; border-radius: 10px; font-weight: 700; display: inline-block; font-size: 16px; margin-bottom: 12px;">
                                    🌐 Entrar al Programa Web
                                </a>
                            </div>

                            <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 20px 0 0 0; border-top: 1px solid #f1f5f9; padding-top: 16px;">
                                Enlace web: <a href="${loginLink}" style="color: #2563eb;">${loginLink}</a>
                            </p>
                        </div>

                        <!-- Footer -->
                        <div style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8;">
                            Este es un correo automático del Sistema PACT — ACT Puerto Rico
                        </div>
                    </div>
                `
            };

            let mailRes;
            if (api?.sendEmail) {
                mailRes = await api.sendEmail(emailData);
            } else {
                // Fallback para versión Web - URL hardcodeada para garantizar funcionamiento
                const SUPABASE_URL = 'https://dtpfhwxwodzpitzmrbqr.supabase.co';
                try {
                    console.log(`Llamando a Edge Function: ${SUPABASE_URL}/functions/v1/send-email`);
                    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(emailData)
                    });
                    const responseText = await res.text();
                    console.log(`Edge Function respuesta (${res.status}):`, responseText);
                    try {
                        mailRes = JSON.parse(responseText);
                    } catch {
                        mailRes = { success: res.ok, raw: responseText };
                    }
                } catch (err: any) {
                    console.error('Error llamando Edge Function:', err);
                    mailRes = { success: false, error: err.message || "Error en la red" };
                }
            }

            if (!mailRes?.success && !mailRes?.messageId) {
                alert(`⚠️ Usuario creado, pero el correo NO se pudo enviar.\n\nError: ${mailRes?.error || 'Servicio de correo no disponible'}\n\nNotifica al usuario manualmente e indícale que ingrese a:\n${loginLink}`);
                copyToClipboard(loginLink);
            } else {
                alert(`✅ Invitación enviada correctamente al correo: ${email}`);
            }

            setEmail("");
            fetchMemberships();
        } catch (error: any) {
            console.error("Invite error", error);
            alert("Ocurrió un error inesperado: " + error.message);
        } finally {
            setInviteLoading(false);
        }
    };

    const handleCreateLink = async () => {
        setLinkLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                alert("Debes iniciar sesión para generar un enlace.");
                return;
            }

            const token = crypto.randomUUID();

            const { error: insertError } = await supabase.from("memberships").insert([{
                project_id: projectId,
                role: linkRole,
                invited_by_user_id: session.user.id,
                invite_method: 'link',
                invite_token_hash: token,
                expires_at: null,
                max_uses: 10,
            }]);

            if (insertError) {
                alert("Error generando enlace: " + insertError.message);
                return;
            }

            const link = `https://act-m2-a.vercel.app/login?invite_token=${token}`;
            setGeneratedLink(link);
            copyToClipboard(link);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 3000);
            fetchMemberships();
        } catch (err: any) {
            alert("Error inesperado: " + err.message);
        } finally {
            setLinkLoading(false);
        }
    };

    const handleToggleActive = async (id: string, currentActive: boolean) => {
        // Optimistic UI update
        setMembers(prev => prev.map(m => m.id === id ? { ...m, is_active: !currentActive } : m));
        const { error } = await supabase.from("memberships")
            .update({ is_active: !currentActive })
            .eq("id", id);
        if (error) {
            // Revert on error
            setMembers(prev => prev.map(m => m.id === id ? { ...m, is_active: currentActive } : m));
            alert("Error al actualizar el estado: " + error.message);
        }
    };

    const handleRevoke = async (id: string) => {
        if (!confirm("¿Estás seguro de que deseas revocar este acceso?")) return;
        
        const secondConfirm = confirm("🛑 AVISO: Una vez revocado el acceso, el usuario ya no podrá ver ni editar información en este proyecto. ¿Confirmas la revocación?");
        if (!secondConfirm) return;
        const { error } = await supabase.from("memberships")
            .update({ revoked_at: new Date().toISOString() })
            .eq("id", id);
            
        if (!error) {
            fetchMemberships();
        } else {
            console.error(error);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
                <Users className="text-primary" />
                Control de Acceso (Miembros)
            </h2>
            
            {canManage && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    <form onSubmit={handleInviteEmail} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg space-y-3">
                        <label className="text-xs font-bold uppercase text-slate-500 flex items-center gap-1">
                            <UserPlus size={14} /> Invitar por correo
                        </label>
                        <div className="flex flex-col gap-2">
                            <input 
                                type="email" 
                                value={email} 
                                onChange={e => setEmail(e.target.value)} 
                                required
                                placeholder="usuario@ejemplo.com"
                                className="w-full rounded-md border-slate-200 p-2 text-sm"
                            />
                            <select 
                                value={role} 
                                onChange={e => setRole(e.target.value)} 
                                className="w-full rounded-md border-slate-200 p-2 text-sm"
                            >
                                {currentUserRole === 'A' && <option value="B">Administrador (B)</option>}
                                <option value="C">Data Entry (C)</option>
                                <option value="D">Solo Lectura (D)</option>
                                <option value="E">Inspector (E)</option>
                                {currentUserRole === 'A' && <option value="F">Contratista</option>}
                            </select>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Password Temporal (Opcional)</label>
                                <input 
                                    type="text" 
                                    value={tempPassword} 
                                    onChange={e => setTempPassword(e.target.value)} 
                                    placeholder="Password"
                                    className="w-full rounded-md border-slate-200 p-2 text-sm font-mono"
                                />
                            </div>
                            <button type="submit" disabled={inviteLoading} className="bg-primary text-white py-2 rounded-md font-bold text-sm disabled:opacity-60">
                                {inviteLoading ? 'Enviando...' : 'Enviar Invitación'}
                            </button>
                        </div>
                    </form>
                    
                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg flex flex-col justify-between">
                        <div>
                            <label className="text-xs font-bold uppercase text-slate-500 flex items-center gap-1 mb-2">
                                <LinkIcon size={14} /> Enlace de acceso temporal
                            </label>
                            <p className="text-xs text-slate-400 mb-2">Genera un enlace para compartir. Selecciona el nivel de acceso:</p>
                            <select
                                value={linkRole}
                                onChange={e => setLinkRole(e.target.value)}
                                className="w-full rounded-md border-slate-200 p-2 text-sm mb-3"
                            >
                                {currentUserRole === 'A' && <option value="B">Administrador (B)</option>}
                                <option value="C">Data Entry (C)</option>
                                <option value="D">Solo Lectura (D)</option>
                                <option value="E">Inspector (E)</option>
                                {currentUserRole === 'A' && <option value="F">Contratista</option>}
                            </select>
                            {generatedLink && (
                                <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs text-blue-700 break-all mb-2">
                                    {generatedLink}
                                </div>
                            )}
                        </div>
                        <button
                            onClick={handleCreateLink}
                            disabled={linkLoading}
                            className={`py-2 rounded-md font-bold text-sm border-2 transition-all ${
                                linkCopied
                                    ? 'bg-green-500 border-green-500 text-white'
                                    : 'bg-white border-primary text-primary hover:bg-primary/5'
                            }`}
                        >
                            {linkLoading ? 'Generando...' : linkCopied ? '✅ Copiado!' : 'Generar y Copiar Enlace'}
                        </button>
                    </div>
                </div>
            )}
            
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b text-xs uppercase text-slate-500 font-bold">
                            <th className="py-2">Usuario</th>
                            <th className="py-2">Rol (Nivel)</th>
                            <th className="py-2">Estado</th>
                            <th className="py-2">Expiración</th>
                            {canManage && <th className="py-2 text-right">Acciones</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan={4} className="py-4 text-center text-sm">Cargando...</td></tr>
                        ) : members.length === 0 ? (
                            <tr><td colSpan={4} className="py-4 text-center text-sm text-slate-400">No hay miembros registrados.</td></tr>
                        ) : members.map(m => (
                            <tr key={m.id} className={!m.is_active ? 'opacity-50 bg-slate-50' : ''}>
                                <td className="py-3">
                                    <div className="font-bold text-sm">{m.user.name}</div>
                                    <div className="text-xs text-slate-500">{m.user.email}</div>
                                </td>
                                <td className="py-3">
                                    <span className="flex items-center gap-1 text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-full w-fit">
                                        <Shield size={12} /> {
                                            m.role === 'F' ? 'Contratista' : 
                                            m.role === 'E' ? 'Inspector (E)' : 
                                            m.role === 'C' ? 'Data Entry (C)' : 
                                            `Nivel ${m.role}`
                                        }
                                    </span>
                                </td>
                                <td className="py-3">
                                    <div className="flex items-center gap-2">
                                        {canToggleActive ? (
                                            <label className="relative inline-flex items-center cursor-pointer" title={m.is_active ? 'Activo – clic para desactivar' : 'Inactivo – clic para activar'}>
                                                <input
                                                    type="checkbox"
                                                    checked={m.is_active}
                                                    onChange={() => handleToggleActive(m.id, m.is_active)}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                                                <span className="ml-2 text-xs font-semibold">
                                                    {m.is_active ? <span className="text-green-600">Activo</span> : <span className="text-slate-400">Inactivo</span>}
                                                </span>
                                            </label>
                                        ) : (
                                            <span className={`text-xs font-semibold ${m.is_active ? 'text-green-600' : 'text-slate-400'}`}>
                                                {m.is_active ? '● Activo' : '● Inactivo'}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="py-3 text-sm text-slate-500">
                                    {m.expires_at ? new Date(m.expires_at).toLocaleDateString() : 'Ilimitado'}
                                </td>
                                {canManage && (
                                    <td className="py-3 text-right">
                                        <button onClick={() => handleRevoke(m.id)} className="text-red-500 hover:text-red-700 p-2" title="Revocar acceso permanentemente">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
