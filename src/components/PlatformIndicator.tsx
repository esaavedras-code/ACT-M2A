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
        const isElectron = /electron/i.test(navigator.userAgent) || 
                          (window as any).electronAPI !== undefined ||
                          (typeof window !== 'undefined' && (window as any).process && (window as any).process.type);
        
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
        <>
            {/* Pastilla de plataforma - solo muestra WEB/ESCRITORIO, SIN número de proyecto */}
            <div className="fixed top-0 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none">
                <div className="bg-slate-900/90 text-white text-[9px] font-black tracking-[0.3em] uppercase px-6 py-1 rounded-b-xl border-x border-b border-white/20 shadow-2xl backdrop-blur-md">
                    {platform}
                </div>
            </div>

            {/* Número de proyecto - centrado en la barra azul del header (h-16 = 64px, justo debajo del top) */}
            {numAct && (
                <div
                    className="fixed z-[9998] left-1/2 -translate-x-1/2 pointer-events-auto"
                    style={{ top: '14px' }}  /* Centrado vertical en la barra azul de 64px */
                >
                    <button
                        onClick={() => {
                            if (projectId && !window.location.pathname.includes('/proyectos/detalle')) {
                                window.location.href = `/proyectos/detalle?id=${projectId}`;
                            }
                        }}
                        className="text-white/90 hover:text-white font-black tracking-widest uppercase transition-colors text-sm md:text-base drop-shadow-md"
                        title={`Proyecto ${numAct}`}
                    >
                        {numAct}
                    </button>
                </div>
            )}
        </>
    );
}

export default function PlatformIndicator() {
    return (
        <Suspense fallback={null}>
            <PlatformIndicatorContent />
        </Suspense>
    );
}
