"use client";

import { Info, ShieldCheck, Mail, Globe, Code2, Users, Building2, Award, Cpu, CalendarDays, MapPin } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function AboutPage() {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);
    if (!mounted) return null;

    return (
        <div className="max-w-4xl mx-auto py-12 px-6">
            {/* Header */}
            <div className="text-center mb-16">
                <div className="flex justify-center mb-6">
                    <div className="relative w-32 h-32 bg-white rounded-3xl shadow-xl overflow-hidden p-4 border border-slate-100">
                        <Image
                            src="/icon.png"
                            alt="PACT Logo"
                            fill
                            className="object-contain p-2"
                        />
                    </div>
                </div>
                <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">Proyectos ACT (PACT)</h1>
                <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                    La plataforma definitiva para el control de ingeniería y gestión de proyectos v3.1
                </p>
                <div className="mt-8 inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full font-bold text-sm border border-blue-100">
                    <ShieldCheck size={18} />
                    Versión del Sistema: 3.1
                </div>
                <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full font-semibold text-xs border border-emerald-100">
                    <CalendarDays size={14} />
                    Última actualización: 28 de marzo de 2026 &nbsp;·&nbsp; 5:15 PM
                </div>
            </div>

            {/* Autor del Programa */}
            <div className="mb-10">
                <div className="relative bg-gradient-to-br from-blue-700 via-blue-800 to-slate-900 rounded-3xl p-10 text-white overflow-hidden shadow-2xl">
                    {/* Decorative blobs */}
                    <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/20 rounded-full blur-2xl -ml-24 -mb-24 pointer-events-none" />

                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20">
                                <Award size={22} className="text-amber-300" />
                            </div>
                            <span className="text-xs font-black uppercase tracking-[0.2em] text-blue-200">Diseñador del Programa</span>
                        </div>

                        <h2 className="text-3xl font-black mb-1 tracking-tight">Ing. Enrique Saavedra Sada, PE</h2>
                        <p className="text-blue-200 font-semibold mb-6 text-lg">Professional Engineer · M2A Group</p>
                    </div>
                </div>
            </div>

            {/* Company + Contact */}
            <div className="grid md:grid-cols-2 gap-8 mb-16">
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                    <h2 className="text-2xl font-bold text-slate-900 mb-4">M2A Group</h2>
                    <p className="text-slate-600 leading-relaxed mb-6 text-justify">
                        M2A Group, P.S.C. es una firma puertorriqueña de servicios profesionales de ingeniería y consultoría técnica, ubicada en San Juan, Puerto Rico, que opera principalmente en el área de servicios de construcción técnica, ingeniería y gerencia de proyectos.
                    </p>
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 text-slate-700 font-medium">
                            <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500">
                                <MapPin size={16} />
                            </div>
                            Vick Center, 867 Av. Luis Muñoz Rivera D-305, San Juan, 00925, Puerto Rico
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl">
                    <h2 className="text-2xl font-bold mb-4">Contáctanos</h2>
                    <div className="mb-8">
                        <p className="text-blue-400 font-black uppercase tracking-widest text-[10px] mb-1">Professional Engineer</p>
                        <p className="text-slate-300 font-bold text-sm">Autoridad de Carreteras y Transportación</p>
                    </div>
                    
                    <div className="space-y-6">
                        <a href="mailto:esaavedra@m2a-group.com" className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-all">
                            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
                                <Mail size={20} />
                            </div>
                            <div>
                                <div className="text-xs text-slate-400 uppercase font-bold tracking-wider">Email</div>
                                <div className="font-medium">esaavedra@m2a-group.com</div>
                            </div>
                        </a>
                        
                        <div className="mt-8 flex justify-center">
                            <div className="relative w-48 h-48 bg-white rounded-3xl p-4 border border-white/10 overflow-hidden shadow-2xl">
                                <Image
                                    src="/m2a_logo.png"
                                    alt="M2A Logo"
                                    fill
                                    className="object-contain p-3"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* CTA Banner */}
            <div className="bg-blue-600 rounded-3xl p-10 text-white relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
                    <div className="flex-1">
                        <h3 className="text-2xl font-black mb-2 uppercase tracking-tighter italic">"Digitalizing Puerto Rico's Infrastructure"</h3>
                        <p className="text-blue-100">Comprometidos con la excelencia en la gestión de infraestructura vial.</p>
                    </div>
                    <Link href="/" className="px-8 py-4 bg-white text-blue-600 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-blue-50 transition-colors shadow-lg shadow-blue-900/20">
                        Volver al Dashboard
                    </Link>
                </div>
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full blur-2xl -ml-24 -mb-24"></div>
            </div>

            <footer className="mt-16 text-center text-slate-400 text-xs py-8 border-t border-slate-100">
                <p>© {new Date().getFullYear()} M2A Group · Ing. Enrique Saavedra Sada, PE · Todos los derechos reservados.</p>
                <div className="flex justify-center gap-4 mt-4">
                    <span className="hover:text-slate-600 cursor-help">Términos de Uso</span>
                    <span>•</span>
                    <span className="hover:text-slate-600 cursor-help">Política de Privacidad</span>
                </div>
            </footer>
        </div>
    );
}
