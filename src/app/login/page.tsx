"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { NextPage } from "next";
import { LogIn, Lock, Mail, ArrowRight, ShieldCheck, UserPlus, Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import AccessRequestModal from "@/components/AccessRequestModal";
import { getLocalStorageItem, setLocalStorageItem } from "@/lib/utils";

const LoginPage: NextPage = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isForgotLoading, setIsForgotLoading] = useState(false);
    const [forgotSuccess, setForgotSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    const [keepConnected, setKeepConnected] = useState(false);

    const [newPassword, setNewPassword] = useState("");
    const [confirmNewPassword, setConfirmNewPassword] = useState("");
    const [requirePasswordChange, setRequirePasswordChange] = useState(false);
    const [tempSessionUser, setTempSessionUser] = useState<any>(null);
    const [originalTempPassword, setOriginalTempPassword] = useState("");

    useEffect(() => {
        try {
            const storedPref = getLocalStorageItem("pact_keep_connected");
            if (storedPref !== null) {
                setKeepConnected(storedPref === "true");
            }
        } catch (e) {
            console.warn("Storage access denied:", e);
        }

        // Redirigir si ya está autenticado
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                window.location.href = "/";
            }
        };
        checkAuth();
    }, []);

    const completeLogin = async (user: any) => {
        // Sync with local memory if the old logic still checks for pact_registration temporarily
        const { data: userRecord } = await supabase
            .from("users")
            .select("*")
            .eq("id", user.id)
            .single();
            
        if (userRecord && userRecord.is_active === false) {
            setError("Su cuenta se encuentra desactivada. Contacte al administrador en esaavedra@m2a-group.com.");
            await supabase.auth.signOut();
            setLoading(false);
            return;
        }

        const registrationData = {
            name: userRecord?.name || user.email,
            email: user.email,
            role_global: userRecord?.role_global,
            allowedProjectIds: ["ALL"], // Para saltarse el modulo viejo
        };

        const registrationStr = getLocalStorageItem("pact_registration");
        setLocalStorageItem("pact_registration", JSON.stringify(registrationData));

        window.location.href = "/";
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            try {
                localStorage.setItem("pact_keep_connected", keepConnected.toString());
            } catch (e) {
                console.warn("Storage access denied for preference:", e);
            }

            const normalizedEmail = email.trim().toLowerCase();
            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email: normalizedEmail,
                password,
            });

            if (authError) throw authError;

            // Detectar si la contraseña es temporal (comienza con PACT- o es el patrón de 6-10 chars mayúsculas/números)
            const isTempPassword = password.startsWith("PACT-") || /^[A-Z0-9]{6,10}$/.test(password);
            
            if (isTempPassword) {
                setTempSessionUser(data.user);
                setOriginalTempPassword(password);
                setRequirePasswordChange(true);
                return; // Detenemos el flujo aquí
            }

            await completeLogin(data.user);
        } catch (err: any) {
            setError(err.message || "Error al iniciar sesión");
            setLoading(false);
        }
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Eliminamos el check redundant de oldPassword !== password ya que el usuario ya se autenticó exitosamente
        if (newPassword !== confirmNewPassword) {
            setError("Las contraseñas nuevas no coinciden. Verifique nuevamente.");
            return;
        }
        if (newPassword.length < 6) {
            setError("La nueva contraseña debe tener al menos 6 caracteres.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            console.log("Iniciando actualización de contraseña...");
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (updateError) {
                console.error("Error al actualizar con updateUser:", updateError);
                let msg = updateError.message;
                if (msg.includes("should be different")) msg = "La nueva contraseña debe ser diferente a la anterior.";
                if (msg.includes("too short")) msg = "La contraseña es muy corta.";
                throw new Error(msg);
            }
            
            console.log("Contraseña actualizada con éxito en login.");
            // Si el cambio fue exitoso, limpiamos y completamos el login
            setNewPassword("");
            setConfirmNewPassword("");
            await completeLogin(tempSessionUser);
        } catch (err: any) {
            console.error("Excepción en handlePasswordChange:", err);
            setError(err.message || "Error al actualizar contraseña. Intente nuevamente.");
            setLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail) {
            setError("Por favor, introduce tu correo electrónico primero.");
            return;
        }
        
        if (!confirm(`¿Deseas solicitar una nueva contraseña temporal para ${normalizedEmail}? Se enviará a tu correo electrónico.`)) return;
        
        setIsForgotLoading(true);
        setError(null);
        setForgotSuccess(false);
        
        try {
            const res = await fetch('/api/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: normalizedEmail })
            });
            
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error al solicitar recuperación");
            
            setForgotSuccess(true);
            alert("✓ Se ha enviado una contraseña temporal a tu correo electrónico. Por favor, revísalo para iniciar sesión.");
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsForgotLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
                    <div className="bg-primary p-8 text-center relative overflow-hidden">
                        <div className="relative z-10">
                            <div className="w-20 h-20 bg-white rounded-2xl mx-auto flex items-center justify-center shadow-lg relative overflow-hidden p-2 mb-4">
                                <Image
                                    src="/icon.png"
                                    alt="PACT Logo"
                                    fill
                                    className="object-contain p-2"
                                />
                            </div>
                            <h1 className="text-3xl font-black text-white tracking-tight">Proyectos ACT</h1>
                            <p className="text-blue-100 mt-2 font-medium">Control Inteligente de Obras</p>
                        </div>
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-900/40 rounded-full -ml-8 -mb-8 blur-xl"></div>
                    </div>

                    <div className="p-8">
                        {requirePasswordChange ? (
                            <form onSubmit={handlePasswordChange} className="space-y-6">
                                <div className="bg-amber-50 text-amber-700 border border-amber-200 rounded-xl p-4 text-sm font-bold flex items-center gap-2">
                                    <ShieldCheck className="shrink-0" size={18} />
                                    <p>Por seguridad, debes cambiar tu contraseña temporal antes de continuar.</p>
                                </div>
                                
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Confirma tu Contraseña Actual</label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                            <Lock size={18} />
                                        </div>
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            required
                                            value={originalTempPassword}
                                            readOnly
                                            className="w-full bg-slate-100 border border-slate-200 rounded-xl py-3 pl-12 pr-12 text-slate-500 opacity-60 cursor-not-allowed cursor-not-allowed"
                                        />
                                    </div>
                                </div>
                                {error && (
                                    <div className="bg-red-50 text-red-600 border border-red-200 rounded-xl p-4 text-sm font-bold flex items-center gap-2">
                                        <ShieldCheck className="shrink-0" size={18} />
                                        <p>{error}</p>
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Nueva Contraseña</label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                            <Lock size={18} />
                                        </div>
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            required
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-12 pr-12 focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all placeholder:text-slate-400"
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
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Confirmar Nueva Contraseña</label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                            <Lock size={18} />
                                        </div>
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            required
                                            value={confirmNewPassword}
                                            onChange={(e) => setConfirmNewPassword(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-12 pr-12 focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all placeholder:text-slate-400"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-3">
                                    <button
                                        disabled={loading}
                                        type="submit"
                                        className="w-full bg-primary hover:bg-blue-700 text-white rounded-xl py-4 font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98] disabled:opacity-50"
                                    >
                                        {loading ? (
                                            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        ) : (
                                            <>
                                                Actualizar Contraseña <ArrowRight size={18} />
                                            </>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setRequirePasswordChange(false);
                                            setError(null);
                                        }}
                                        className="w-full text-slate-400 hover:text-slate-600 text-xs font-bold py-2 transition-colors"
                                    >
                                        Cancelar y volver
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <form onSubmit={handleLogin} className="space-y-6">
                                {error && (
                                    <div className="bg-red-50 text-red-600 border border-red-200 rounded-xl p-4 text-sm font-bold flex items-center gap-2">
                                        <ShieldCheck className="shrink-0" size={18} />
                                        <p>{error}</p>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Correo Electrónico</label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                            <Mail size={18} />
                                        </div>
                                        <input
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-12 pr-4 focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all placeholder:text-slate-400"
                                            placeholder="tu@correo.com"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Contraseña</label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                            <Lock size={18} />
                                        </div>
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-12 pr-12 focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all placeholder:text-slate-400"
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
                                    <div className="flex justify-end pr-1 mt-1">
                                        <button 
                                            type="button"
                                            onClick={handleForgotPassword}
                                            disabled={isForgotLoading}
                                            className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-primary transition-colors disabled:opacity-50"
                                        >
                                            {isForgotLoading ? "Solicitando..." : "¿Olvidaste tu contraseña?"}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 px-1">
                                    <input 
                                        type="checkbox" 
                                        id="keepConnected" 
                                        checked={keepConnected}
                                        onChange={(e) => setKeepConnected(e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/20 cursor-pointer"
                                    />
                                    <label htmlFor="keepConnected" className="text-xs font-bold text-slate-500 cursor-pointer select-none">
                                        Mantener sesión iniciada
                                    </label>
                                </div>

                                <button
                                    disabled={loading}
                                    type="submit"
                                    className="w-full bg-primary hover:bg-blue-700 text-white rounded-xl py-4 font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98] disabled:opacity-50"
                                >
                                    {loading ? (
                                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        <>
                                            Iniciar Sesión <LogIn size={18} />
                                        </>
                                    )}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
                            <div className="mt-6 flex flex-col gap-4">
                    <button
                        onClick={() => setIsRequestModalOpen(true)}
                        className="w-full flex items-center justify-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors py-3 border-2 border-dashed border-slate-200 hover:border-primary/30 rounded-2xl group"
                    >
                        <UserPlus size={16} className="text-slate-400 group-hover:text-primary transition-colors" />
                        ¿No tienes cuenta? <span className="underline decoration-slate-300 group-hover:decoration-primary/50 underline-offset-4">Solicitar Acceso</span>
                    </button>

                    <Link
                        href="/acerca-de"
                        className="w-full flex items-center justify-center gap-2 text-[10px] font-bold text-slate-400 hover:text-primary transition-colors py-2 group"
                    >
                        <ShieldCheck size={12} className="opacity-50 group-hover:opacity-100" />
                        Acerca del Sistema PACT
                    </Link>

                    <p className="text-center text-slate-400 text-[10px] sm:text-xs font-medium uppercase tracking-widest opacity-60">
                        Plataforma Administrativa M2A Group
                    </p>
                </div>

                <AccessRequestModal
                    isOpen={isRequestModalOpen}
                    onClose={() => setIsRequestModalOpen(false)}
                />
            </div>
        </div>
    );
};

export default LoginPage;
