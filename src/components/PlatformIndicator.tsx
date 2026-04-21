"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function PlatformIndicatorContent() {
    const [platform, setPlatform] = useState<string | null>(null);
    const searchParams = useSearchParams();
    const projectId = searchParams.get("id");
    const [numAct, setNumAct] = useState<string | null>(null);

    useEffect(() => {
        // Detectar si estamos en Electron
        const isElectron = /electron/i.test(navigator.userAgent) || 
                          (window as any).electronAPI !== undefined ||
                          (typeof window !== 'undefined' && (window as any).process && (window as any).process.type);
        
        // Detectar si es localhost
        const isLocal = window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1' ||
                        window.location.hostname.startsWith('192.168.') ||
                        window.location.hostname.startsWith('10.');

        if (isElectron) {
            setPlatform("ESCRITORIO");
        } else if (isLocal) {
            setPlatform("WEB LOCAL");
        } else {
            setPlatform("WEB");
        }
    }, []);

    useEffect(() => {
        if (projectId) {
            supabase.from("projects").select("num_act").eq("id", projectId).single()
                .then(({ data }) => {
                    if (data?.num_act) setNumAct(data.num_act);
                    else setNumAct(null);
                });
        } else {
            setNumAct(null);
        }
    }, [projectId]);

    if (!platform) return null;

    return (
        <div className="fixed top-0 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center pointer-events-none">
            {/* Etiqueta de plataforma + número de proyecto integrados en una sola pastilla */}
            <div className="bg-slate-900/90 text-white text-[9px] font-black tracking-[0.3em] uppercase px-5 py-1 rounded-b-xl border-x border-b border-white/20 shadow-2xl backdrop-blur-md flex items-center gap-2">
                <span>{platform}</span>
                {numAct && (
                    <>
                        <span className="opacity-30">|</span>
                        <span 
                            className="text-[10px] font-black tracking-widest text-blue-300 pointer-events-auto cursor-pointer hover:text-blue-100 transition-colors"
                            onClick={() => {
                                if (projectId && !window.location.pathname.includes('/proyectos/detalle')) {
                                    window.location.href = `/proyectos/detalle?id=${projectId}`;
                                }
                            }}
                        >
                            {numAct}
                        </span>
                    </>
                )}
            </div>
        </div>
    );
}

export default function PlatformIndicator() {
    return (
        <Suspense fallback={null}>
            <PlatformIndicatorContent />
        </Suspense>
    );
}
