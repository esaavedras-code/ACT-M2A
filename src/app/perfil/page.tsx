"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { User, Key, Shield, Save, ArrowLeft, Building, Lock, Eye, EyeOff, CheckCircle2, Camera, Upload, Trash2 } from "lucide-react";
import Link from "next/link";

export default function ProfilePage() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showCurrent, setShowCurrent] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(true);
    const [savingProfile, setSavingProfile] = useState(false);
    const [savingPassword, setSavingPassword] = useState(false);
    const [projects, setProjects] = useState<any[]>([]);
    const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        const loadProfile = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                window.location.href = "/login";
                return;
            }

            setEmail(session.user.email || "");
            
            // Cargar datos extendidos del usuario (incluyendo avatar)
            const { data: userData } = await supabase
                .from("users")
                .select("name, avatar_url")
                .eq("id", session.user.id)
                .single();

            if (userData) {
                setName(userData.name || session.user.user_metadata?.name || "");
                setAvatarUrl(userData.avatar_url);
            } else {
                setName(session.user.user_metadata?.name || "");
            }

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

    // ── Formulario de Nombre ──────────────────────────────────────────────────
    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingProfile(true);
        setProfileMsg(null);

        try {
            const { error: metaError } = await supabase.auth.updateUser({ data: { name } });
            if (metaError) throw metaError;

            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase.from("users").update({ name, avatar_url: avatarUrl }).eq("id", user.id);
            }

            setProfileMsg({ type: 'success', text: "✓ Perfil actualizado correctamente." });
        } catch (err: any) {
            setProfileMsg({ type: 'error', text: err.message || "Error al actualizar perfil" });
        } finally {
            setSavingProfile(false);
        }
    };

    const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setUploading(true);
            setProfileMsg(null);

            if (!event.target.files || event.target.files.length === 0) {
                throw new Error('Debes seleccionar una imagen para subir.');
            }

            const file = event.target.files[0];
            const fileExt = file.name.split('.').pop();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("No hay sesión activa.");

            const filePath = `${session.user.id}/${Math.random()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('profiles')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('profiles')
                .getPublicUrl(filePath);

            setAvatarUrl(publicUrl);
            
            // Actualizar inmediatamente en la tabla users
            await supabase.from("users").update({ avatar_url: publicUrl }).eq("id", session.user.id);
            
            setProfileMsg({ type: 'success', text: "✓ Foto de perfil actualizada." });
        } catch (error: any) {
            setProfileMsg({ type: 'error', text: error.message });
        } finally {
            setUploading(false);
        }
    };

    // ── Formulario de Contraseña ──────────────────────────────────────────────
    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordMsg(null);

        if (!newPassword || newPassword.length < 6) {
            setPasswordMsg({ type: 'error', text: "La contraseña debe tener al menos 6 caracteres." });
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordMsg({ type: 'error', text: "Las contraseñas nuevas no coinciden." });
            return;
        }

        if (!currentPassword) {
            setPasswordMsg({ type: 'error', text: "Debes ingresar tu contraseña actual para realizar cambios." });
            return;
        }

        setSavingPassword(true);
        try {
            console.log("Verificando contraseña actual...");
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password: currentPassword
            });

            if (signInError) {
                console.error("Error al verificar contraseña actual:", signInError);
                throw new Error("La contraseña actual es incorrecta.");
            }

            console.log("Contraseña actual verificada. Procediendo con el cambio...");
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            
            if (error) {
                console.error("Error al actualizar con updateUser en perfil:", error);
                let msg = error.message;
                if (msg.includes("should be different")) msg = "La nueva contraseña debe ser diferente a la anterior.";
                if (msg.includes("too short")) msg = "La contraseña debe tener al menos 6 caracteres.";
                if (msg.includes("session missing")) msg = "Tu sesión ha expirado. Por favor cierra e inicia sesión nuevamente.";
                throw new Error(msg);
            }

            setNewPassword("");
            setConfirmPassword("");
            setCurrentPassword("");
            setPasswordMsg({ type: 'success', text: "✓ Contraseña actualizada correctamente." });
            
            console.log("Contraseña actualizada con éxito en perfil.");

        } catch (err: any) {
            console.error("Excepción al cambiar contraseña en perfil:", err);
            setPasswordMsg({ type: 'error', text: err.message || "Error al cambiar la contraseña. Verifica tu conexión o intenta cerrar e iniciar sesión de nuevo." });
        } finally {
            setSavingPassword(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
        </div>
    );

    const passwordHasContent = newPassword.length > 0;

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
                <div className="lg:col-span-2 space-y-6">

                    {/* ── Formulario de Nombre ── */}
                    <form onSubmit={handleUpdateProfile} className="card p-8 bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl space-y-6">
                        <div className="space-y-4">
                            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 border-b pb-2">
                                <Shield className="text-primary" size={20} /> Información Personal
                            </h2>

                            {/* Foto de Perfil */}
                            <div className="flex flex-col items-center gap-4 py-4">
                                <div className="relative group">
                                    <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-slate-100 dark:border-slate-800 shadow-xl bg-slate-50 relative">
                                        {avatarUrl ? (
                                            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                <User size={64} />
                                            </div>
                                        )}
                                        {uploading && (
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                                <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            </div>
                                        )}
                                    </div>
                                    <label className="absolute bottom-0 right-0 p-2 bg-primary hover:bg-blue-700 text-white rounded-full shadow-lg cursor-pointer transition-all transform group-hover:scale-110">
                                        <Camera size={20} />
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={uploadAvatar}
                                            disabled={uploading}
                                        />
                                    </label>
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-black text-slate-800 dark:text-white">Foto de Perfil</p>
                                    <p className="text-xs text-slate-400">JPG, PNG o GIF. Máx 2MB</p>
                                </div>
                                {avatarUrl && (
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            setAvatarUrl(null);
                                            // También actualizar en DB
                                            supabase.auth.getSession().then(({data}) => {
                                                if(data.session) supabase.from("users").update({ avatar_url: null }).eq("id", data.session.user.id);
                                            });
                                        }}
                                        className="text-xs text-red-500 font-bold hover:text-red-700 flex items-center gap-1"
                                    >
                                        <Trash2 size={12} /> Eliminar foto
                                    </button>
                                )}
                            </div>

                            {profileMsg && (
                                <div className={`p-4 rounded-xl text-sm font-bold border ${
                                    profileMsg.type === 'success'
                                        ? 'bg-green-50 border-green-200 text-green-700'
                                        : 'bg-red-50 border-red-200 text-red-600'
                                }`}>
                                    {profileMsg.text}
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
                        </div>

                        <button
                            type="submit"
                            disabled={savingProfile}
                            className="w-full bg-primary hover:bg-blue-700 text-white rounded-2xl py-4 font-black flex items-center justify-center gap-3 transition-all shadow-xl shadow-blue-500/20 active:scale-[0.98] disabled:opacity-50"
                        >
                            {savingProfile ? (
                                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>Guardar Nombre <Save size={20} /></>
                            )}
                        </button>
                    </form>

                    {/* ── Formulario de Contraseña ── */}
                    <form onSubmit={handleUpdatePassword} className={`card p-8 rounded-[2rem] shadow-xl space-y-6 transition-all duration-300 ${
                        passwordHasContent
                            ? 'bg-amber-50 border-2 border-amber-300 ring-4 ring-amber-100'
                            : 'bg-white dark:bg-slate-900 border border-slate-200'
                    }`}>
                        <div className="space-y-4">
                            <h2 className={`text-lg font-bold flex items-center gap-2 border-b pb-2 transition-colors ${
                                passwordHasContent ? 'text-amber-800 border-amber-200' : 'text-slate-800 dark:text-white'
                            }`}>
                                <Key className={passwordHasContent ? 'text-amber-600' : 'text-primary'} size={20} />
                                Cambiar Contraseña
                                {passwordHasContent && (
                                    <span className="ml-auto text-xs font-black px-2 py-0.5 bg-amber-500 text-white rounded-full uppercase tracking-wider">
                                        Activo
                                    </span>
                                )}
                            </h2>

                            {passwordHasContent && (
                                <div className="flex items-start gap-2 p-3 bg-amber-100 border border-amber-200 rounded-xl text-amber-800 text-xs font-bold">
                                    <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-amber-600" />
                                    <span>Se actualizará tu contraseña al guardar. Asegúrate de recordarla.</span>
                                </div>
                            )}

                            {passwordMsg && (
                                <div className={`p-4 rounded-xl text-sm font-bold border ${
                                    passwordMsg.type === 'success'
                                        ? 'bg-green-50 border-green-200 text-green-700'
                                        : 'bg-red-50 border-red-200 text-red-600'
                                }`}>
                                    {passwordMsg.text}
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className={`text-[10px] font-bold uppercase tracking-widest pl-1 ${passwordHasContent ? 'text-amber-700' : 'text-slate-400'}`}>
                                    Contraseña Actual
                                </label>
                                <div className="relative group">
                                    <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${passwordHasContent ? 'text-amber-500' : 'text-slate-400 group-focus-within:text-primary'}`}>
                                        <Lock size={18} />
                                    </div>
                                    <input
                                        type={showCurrent ? "text" : "password"}
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        className={`w-full rounded-xl py-3 pl-12 pr-12 outline-none transition-all ${
                                            passwordHasContent
                                                ? 'bg-white border-2 border-amber-400 focus:ring-4 focus:ring-amber-200 text-amber-900 placeholder-amber-300'
                                                : 'bg-slate-50 border border-slate-200 focus:ring-4 focus:ring-primary/10 focus:border-primary'
                                        }`}
                                        placeholder="Ingresa tu contraseña de acceso"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowCurrent(!showCurrent)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                                    >
                                        {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className={`text-[10px] font-bold uppercase tracking-widest pl-1 ${passwordHasContent ? 'text-amber-700' : 'text-slate-400'}`}>
                                    Nueva Contraseña
                                </label>
                                <div className="relative group">
                                    <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${passwordHasContent ? 'text-amber-500' : 'text-slate-400 group-focus-within:text-primary'}`}>
                                        <Key size={18} />
                                    </div>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className={`w-full rounded-xl py-3 pl-12 pr-12 outline-none transition-all ${
                                            passwordHasContent
                                                ? 'bg-white border-2 border-amber-400 focus:ring-4 focus:ring-amber-200 text-amber-900 placeholder-amber-300'
                                                : 'bg-slate-50 border border-slate-200 focus:ring-4 focus:ring-primary/10 focus:border-primary'
                                        }`}
                                        placeholder="Mínimo 6 caracteres"
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

                            <div className="space-y-2">
                                <label className={`text-[10px] font-bold uppercase tracking-widest pl-1 ${passwordHasContent ? 'text-amber-700' : 'text-slate-400'}`}>
                                    Confirmar Nueva Contraseña
                                </label>
                                <div className="relative group">
                                    <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${passwordHasContent ? 'text-amber-500' : 'text-slate-400 group-focus-within:text-primary'}`}>
                                        <Key size={18} />
                                    </div>
                                    <input
                                        type={showConfirm ? "text" : "password"}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className={`w-full rounded-xl py-3 pl-12 pr-12 outline-none transition-all ${
                                            passwordHasContent
                                                ? 'bg-white border-2 border-amber-400 focus:ring-4 focus:ring-amber-200 text-amber-900 placeholder-amber-300'
                                                : 'bg-slate-50 border border-slate-200 focus:ring-4 focus:ring-primary/10 focus:border-primary'
                                        }`}
                                        placeholder="Repite la contraseña"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirm(!showConfirm)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                                    >
                                        {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={savingPassword || !passwordHasContent}
                            className={`w-full rounded-2xl py-4 font-black flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50 ${
                                passwordHasContent
                                    ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-xl shadow-amber-500/25'
                                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                        >
                            {savingPassword ? (
                                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <><Key size={20} /> Cambiar Contraseña</>
                            )}
                        </button>
                    </form>

                </div>

                {/* Sidebar */}
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

                    <div className="p-6 bg-blue-50 border border-blue-100 rounded-[2rem]">
                        <h4 className="text-blue-800 font-bold text-sm mb-2">🔐 Cambio de Contraseña</h4>
                        <p className="text-blue-700 text-xs leading-relaxed">
                            El cambio de contraseña es independiente del nombre. Al escribir una nueva contraseña, el formulario cambia de color para confirmar que está activo.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
