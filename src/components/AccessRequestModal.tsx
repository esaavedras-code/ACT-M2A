"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { X, Send, CheckCircle2, AlertCircle, User, Mail, Hash, Shield } from "lucide-react";

interface AccessRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: {
        fullName?: string;
        email?: string;
        projectNumber?: string;
    }
}

export default function AccessRequestModal({ isOpen, onClose, initialData }: AccessRequestModalProps) {
    const [fullName, setFullName] = useState(initialData?.fullName || "");
    const [email, setEmail] = useState(initialData?.email || "");
    const [projectNumber, setProjectNumber] = useState(initialData?.projectNumber || "");
    const [desiredRole, setDesiredRole] = useState("D");
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Actualizar estados si initialData cambia y el modal se abre
    useEffect(() => {
        if (isOpen && initialData) {
            if (initialData.fullName) setFullName(initialData.fullName);
            if (initialData.email) setEmail(initialData.email);
            if (initialData.projectNumber) setProjectNumber(initialData.projectNumber);
        }
    }, [isOpen, initialData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error: insertError } = await supabase.from("access_requests").insert([{
                full_name: fullName,
                email: email,
                project_number: projectNumber || null,
                desired_role: desiredRole,
                status: 'pending'
            }]);

            if (insertError) throw insertError;

            // NOTIFICAR AL ADMINISTRADOR
            try {
                const { data: admins } = await supabase.from("users").select("email, name").eq("role_global", "A");
                
                // @ts-ignore
                const api = typeof window !== "undefined" ? (window as any).electronAPI : null;
                
                if (admins && admins.length > 0 && api?.sendEmail) {
                    const roleLabel = {
                        'A': 'Administrador Global',
                        'B': 'Administrador de Proyecto',
                        'C': 'Data Entry',
                        'D': 'Solo Lectura'
                    }[desiredRole] || desiredRole;

                    for (const admin of admins) {
                        await api.sendEmail({
                            to: admin.email,
                            subject: `🚨 Nueva Solicitud de Acceso PACT: ${fullName}`,
                            html: `
                                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 20px; overflow: hidden; background-color: #f8fafc;">
                                    <div style="background-color: #2563eb; padding: 30px; text-align: center;">
                                        <h2 style="color: white; margin: 0; font-size: 24px;">Nueva Solicitud de Acceso</h2>
                                        <p style="color: #bfdbfe; margin: 10px 0 0 0;">Sistema de Gestión de Carreteras PACT</p>
                                    </div>
                                    <div style="padding: 40px; background-color: white;">
                                        <p style="font-size: 16px; color: #1e293b;">Hola <strong>${admin.name}</strong>,</p>
                                        <p style="color: #64748b; line-height: 1.6;">Se ha registrado una nueva solicitud de acceso al sistema que requiere tu revisión:</p>
                                        
                                        <div style="background-color: #f1f5f9; padding: 25px; border-radius: 16px; margin: 25px 0; border: 1px solid #e2e8f0;">
                                            <p style="margin: 0 0 10px 0; font-size: 14px;"><strong style="color: #475569;">Nombre:</strong> ${fullName}</p>
                                            <p style="margin: 0 0 10px 0; font-size: 14px;"><strong style="color: #475569;">Email:</strong> ${email}</p>
                                            <p style="margin: 0 0 10px 0; font-size: 14px;"><strong style="color: #475569;">Proyecto Ref:</strong> ${projectNumber || 'No especificado'}</p>
                                            <p style="margin: 0; font-size: 14px;"><strong style="color: #475569;">Rol Deseado:</strong> ${roleLabel}</p>
                                        </div>

                                        <div style="text-align: center; margin-top: 35px;">
                                            <a href="https://pact.m2a-group.com/admin/requests" style="background-color: #2563eb; color: white; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: bold; display: inline-block; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);">
                                                Gestionar Solicitud en el Panel
                                            </a>
                                        </div>
                                    </div>
                                    <div style="padding: 20px; text-align: center; font-size: 12px; color: #94a3b8;">
                                        Este es un correo automático generado por el Sistema PACT.
                                    </div>
                                </div>
                            `
                        });
                    }
                }
            } catch (emailErr) {
                console.error("Error enviando notificación al admin:", emailErr);
                // No lanzamos el error para no bloquear el éxito del usuario
            }

            setSubmitted(true);
            setTimeout(() => {
                onClose();
                // Reset state after closing
                setSubmitted(false);
                setFullName("");
                setEmail("");
                setProjectNumber("");
                setDesiredRole("D");
            }, 3000);

        } catch (err: any) {
            setError(err.message || "Error al enviar la solicitud");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="bg-primary p-8 text-white relative overflow-hidden">
                    <div className="relative z-10 flex justify-between items-start">
                        <div>
                            <h2 className="text-3xl font-black tracking-tight">Solicitar Acceso</h2>
                            <p className="text-blue-100 font-medium mt-1">Completa el formulario para registrarte en PACT</p>
                        </div>
                        <button 
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-full transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>
                    <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
                </div>

                <div className="p-8">
                    {submitted ? (
                        <div className="text-center py-12 space-y-4 animate-in zoom-in duration-500">
                            <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/20">
                                <CheckCircle2 size={48} />
                            </div>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white">¡Solicitud Enviada!</h3>
                            <p className="text-slate-500 dark:text-slate-400 font-medium max-w-xs mx-auto">
                                El administrador revisará tu información y recibirás una notificación por correo electrónico pronto.
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {error && (
                                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-2xl p-4 text-sm font-bold flex items-center gap-3">
                                    <AlertCircle className="shrink-0" size={20} />
                                    <p>{error}</p>
                                </div>
                            )}

                            {/* Nombre Completo */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Nombre Completo</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                        <User size={18} />
                                    </div>
                                    <input
                                        type="text"
                                        required
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 pl-12 pr-4 focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all placeholder:text-slate-400 dark:text-white"
                                        placeholder="Ej: Juan del Pueblo"
                                    />
                                </div>
                            </div>

                            {/* Correo Electrónico */}
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
                                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 pl-12 pr-4 focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all placeholder:text-slate-400 dark:text-white"
                                        placeholder="ejemplo@correo.com"
                                    />
                                </div>
                            </div>

                            {/* Número de Proyecto (Opcional o Requerido) */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                                    {desiredRole === 'B' ? 'Números de Proyecto (REQUERIDO)' : 'Número de Proyecto (Si aplica)'}
                                </label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                        <Hash size={18} />
                                    </div>
                                    <input
                                        type="text"
                                        required={desiredRole === 'B'}
                                        value={projectNumber}
                                        onChange={(e) => setProjectNumber(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 pl-12 pr-4 focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all placeholder:text-slate-400 dark:text-white"
                                        placeholder={desiredRole === 'B' ? "Ej: AC-123456, AC-987654" : "Ej: AC-123456"}
                                    />
                                </div>
                            </div>

                            {/* Rol Deseado */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Rol Deseado</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                        <Shield size={18} />
                                    </div>
                                    <select
                                        value={desiredRole}
                                        onChange={(e) => setDesiredRole(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl py-3.5 pl-12 pr-4 focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all appearance-none dark:text-white"
                                    >
                                        <option value="D">Solo Lectura (Nivel D)</option>
                                        <option value="C">Data Entry (Nivel C)</option>
                                        <option value="B">Administrador de Proyecto (Nivel B)</option>
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                    </div>
                                </div>
                            </div>

                            <button
                                disabled={loading}
                                type="submit"
                                className="w-full bg-primary hover:bg-blue-700 text-white rounded-[1.25rem] py-4 font-black flex items-center justify-center gap-3 transition-all shadow-xl shadow-blue-500/20 active:scale-[0.98] disabled:opacity-50 mt-4 group"
                            >
                                {loading ? (
                                    <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        Enviar Solicitud <Send size={20} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
