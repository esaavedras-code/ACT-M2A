"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { User, Key, Shield, Save, ArrowLeft, Building, Lock, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

export default function ProfilePage() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [projects, setProjects] = useState<any[]>([]);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        const loadProfile = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                window.location.href = "/login";
                return;
            }

            setEmail(session.user.email || "");
            setName(session.user.user_metadata?.name || "");

            // Load allowed projects
            const { data: userProjects } = await supabase
                .from("memberships")
                .select("projects(id, name, num_act)")
                .eq("user_id", session.user.id)
                .is("revoked_at", null);

            if (userProjects) {
                setProjects(userProjects.map((m: any) => m.projects).filter(Boolean));
            }

            setLoading(false);
        };

        loadProfile();
    }, []);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            // Update metadata (name)
            const { error: metaError } = await supabase.auth.updateUser({
                data: { name }
            });

            if (metaError) throw metaError;

            // Update user in public users table if exists
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase.from("users").update({ name }).eq("id", user.id);
            }

            // Update password if provided
            if (newPassword) {
                const { error: pwdError } = await supabase.auth.updateUser({
                    password: newPassword
                });
                if (pwdError) throw pwdError;
                setNewPassword("");
            }

            setMessage({ type: 'success', text: "perfil actualizado correctamente." });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || "Error al actualizar perfil" });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto py-10 px-4 space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <Link href="/" className="inline-flex items-center gap-1 text-slate-400 hover:text-primary text-sm font-bold mb-4 transition-colors">
                        <ArrowLeft size={16} /> Volver al Dashboard
                    </Link>
                    <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                        <User className="text-primary" size={36} /> Mi Perfil
                    </h1>
                    <p className="text-slate-500 font-medium">Gestiona tu identidad y seguridad en el sistema PACT.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* User Settings Form */}
                <div className="lg:col-span-2 space-y-6">
                    <form onSubmit={handleUpdateProfile} className="card p-8 bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl space-y-6">
                        <div className="space-y-4">
                            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 border-b pb-2">
                                <Shield className="text-primary" size={20} /> Información Personal
                            </h2>

                            {message && (
                                <div className={`p-4 rounded-xl text-sm font-bold border ${
                                    message.type === 'success' ? 'bg-green-50 border-green-200 text-green-600' : 'bg-red-50 border-red-200 text-red-600'
                                }`}>
                                    {message.text}
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Correo Electrónico (No editable)</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300">
                                        <Lock size={18} />
                                    </div>
                                    <input
                                        type="email"
                                        disabled
                                        value={email}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-12 pr-4 text-slate-400 opacity-60 cursor-not-allowed"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Nombre Completo</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                        <User size={18} />
                                    </div>
                                    <input
                                        type="text"
                                        required
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-12 pr-4 focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                                        placeholder="Nombre Completo"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2 pt-4">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Nueva Contraseña (Dejar en blanco para no cambiar)</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                        <Key size={18} />
                                    </div>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-12 pr-12 focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full bg-primary hover:bg-blue-700 text-white rounded-2xl py-4 font-black flex items-center justify-center gap-3 transition-all shadow-xl shadow-blue-500/20 active:scale-[0.98] disabled:opacity-50"
                        >
                            {saving ? (
                                <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    Guardar Cambios <Save size={20} />
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Account Info / Projects Badge */}
                <div className="space-y-6">
                    <div className="card p-6 bg-slate-900 border-none rounded-[2rem] text-white shadow-2xl">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                            <Building size={16} /> Mis Proyectos
                        </h3>
                        <div className="space-y-3">
                            {projects.length === 0 ? (
                                <p className="text-slate-500 text-sm italic">No tienes proyectos asignados.</p>
                            ) : (
                                projects.map(p => (
                                    <div key={p.id} className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors">
                                        <p className="font-bold text-sm truncate">{p.name}</p>
                                        <p className="text-[10px] text-blue-300 font-bold">{p.num_act}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="p-6 bg-amber-50 border border-amber-100 rounded-[2rem]">
                        <h4 className="text-amber-800 font-bold text-sm mb-2">💡 Nota Importante</h4>
                        <p className="text-amber-700 text-xs leading-relaxed">
                            Cualquier cambio en tu nombre será visible para otros miembros del equipo en los logs de actividad y reportes.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
