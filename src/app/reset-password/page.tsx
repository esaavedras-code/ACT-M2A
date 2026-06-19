"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Lock, Eye, EyeOff, ShieldCheck, CheckCircle2 } from "lucide-react";
import Image from "next/image";
import BrandName from "@/components/BrandName";

export default function ResetPasswordPage() {
    const router = useRouter();
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [sessionReady, setSessionReady] = useState(false);

    useEffect(() => {
        // Supabase detecta el token de recuperación en la URL automáticamente
        // con detectSessionInUrl: true. Verificamos que haya sesión activa.
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setSessionReady(true);
            } else {
                // Si no hay sesión, redirigir al login
                setError("Enlace de recuperación inválido o expirado. Solicita uno nuevo.");
            }
        };

        // Dar tiempo a Supabase para procesar el token en la URL
        setTimeout(checkSession, 500);
    }, []);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (newPassword !== confirmPassword) {
            setError("Las contraseñas no coinciden.");
            return;
        }

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d\s]).{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            setError("La contraseña debe tener mínimo 8 caracteres, al menos 1 mayúscula, 1 minúscula, 1 número y 1 símbolo.");
            return;
        }

        setLoading(true);
        try {
            const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
            if (updateError) {
                let msg = updateError.message;
                if (msg.includes("should be different")) msg = "La nueva contraseña debe ser diferente a la anterior.";
                throw new Error(msg);
            }
            setSuccess(true);
            setTimeout(() => router.push("/login"), 3000);
        } catch (err: any) {
            setError(err.message || "Error al actualizar la contraseña.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
                    {/* Header */}
                    <div className="bg-primary p-8 text-center relative overflow-hidden">
                        <div className="absolute inset-0 opacity-10"
                            style={{ backgroundImage: "radial-gradient(circle at 30% 50%, white 0%, transparent 60%)" }} />
                        <div className="relative z-10">
                            <div className="w-16 h-16 bg-white rounded-2xl shadow-lg flex items-center justify-center mx-auto mb-4">
                                <Image src="/icon.png" alt="PACT" width={48} height={48} className="rounded-xl" />
                            </div>
                            <BrandName size="lg" className="text-white font-black mb-1" />
                            <p className="text-white/70 text-sm font-medium">PROYECTOS ACT</p>
                        </div>
                    </div>

                    <div className="p-8">
                        {success ? (
                            <div className="text-center space-y-4">
                                <CheckCircle2 className="text-green-500 mx-auto" size={48} />
                                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                                    ¡Contraseña actualizada!
                                </h2>
                                <p className="text-slate-500 text-sm">
                                    Tu contraseña ha sido cambiada exitosamente. Redirigiendo al inicio de sesión...
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="p-2 bg-primary/10 rounded-xl">
                                        <ShieldCheck className="text-primary" size={22} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                                            Nueva contraseña
                                        </h2>
                                        <p className="text-slate-400 text-xs">Establece tu contraseña segura</p>
                                    </div>
                                </div>

                                {error && (
                                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
                                        <ShieldCheck size={16} className="text-red-500 shrink-0 mt-0.5" />
                                        <span className="text-sm font-semibold text-red-600">{error}</span>
                                    </div>
                                )}

                                {!sessionReady && !error && (
                                    <div className="text-center py-8">
                                        <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                                        <p className="text-slate-400 text-sm mt-3">Verificando enlace...</p>
                                    </div>
                                )}

                                {sessionReady && (
                                    <form onSubmit={handleReset} className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                                Nueva contraseña
                                            </label>
                                            <div className="relative">
                                                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    value={newPassword}
                                                    onChange={e => setNewPassword(e.target.value)}
                                                    className="input-field pl-9 pr-9 w-full"
                                                    placeholder="••••••••"
                                                    required
                                                />
                                                <button type="button" onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                                </button>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                                Confirmar contraseña
                                            </label>
                                            <div className="relative">
                                                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    value={confirmPassword}
                                                    onChange={e => setConfirmPassword(e.target.value)}
                                                    className="input-field pl-9 w-full"
                                                    placeholder="••••••••"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <p className="text-[11px] text-slate-400">
                                            Mínimo 8 caracteres · 1 mayúscula · 1 minúscula · 1 número · 1 símbolo
                                        </p>

                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="w-full btn-primary py-3 flex items-center justify-center gap-2 rounded-xl font-bold text-sm"
                                        >
                                            {loading ? (
                                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                <>
                                                    <ShieldCheck size={16} />
                                                    Actualizar contraseña
                                                </>
                                            )}
                                        </button>
                                    </form>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
