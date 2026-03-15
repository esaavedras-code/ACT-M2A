"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { NextPage } from "next";
import { LogIn, Lock, Mail, ArrowRight, ShieldCheck, UserPlus, Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import AccessRequestModal from "@/components/AccessRequestModal";

const LoginPage: NextPage = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

    useEffect(() => {
        // Redirigir si ya está autenticado
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                window.location.href = "/";
            }
        };
        checkAuth();
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError) throw authError;

            // Sync with local memory if the old logic still checks for pact_registration temporarily
            const { data: userRecord } = await supabase
                .from("users")
                .select("*")
                .eq("id", data.user.id)
                .single();
                
            localStorage.setItem("pact_registration", JSON.stringify({
                name: userRecord?.name || data.user.email,
                email: data.user.email,
                role_global: userRecord?.role_global,
                allowedProjectIds: ["ALL"], // Para saltarse el modulo viejo
            }));

            window.location.href = "/";
        } catch (err: any) {
            setError(err.message || "Error al iniciar sesión");
        } finally {
            setLoading(false);
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
