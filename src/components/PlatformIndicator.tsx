"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function PlatformIndicatorContent() {
    const [platform, setPlatform] = useState<string | null>(null);
    const searchParams = useSearchParams();
    const projectId = searchParams.get("id");
    const [projectName, setProjectName] = useState<string | null>(null);

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
            supabase.from("projects").select("name").eq("id", projectId).single()
                .then(({ data }) => {
                    if (data) setProjectName(data.name);
                });
        } else {
            setProjectName(null);
        }
    }, [projectId]);

    if (!platform) return null;

    return (
        <div className="fixed top-0 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center pointer-events-none">
            <div className="bg-slate-900/90 text-white text-[9px] font-black tracking-[0.3em] uppercase px-6 py-1 rounded-b-xl border-x border-b border-white/20 shadow-2xl backdrop-blur-md">
                {platform}
            </div>
            
            {projectName && (
                <div className="mt-2 pointer-events-auto animate-in slide-in-from-top-4 duration-500">
                    <button 
                        onClick={() => {
                            // Si se hace clic, quizás refrescar o ir al detalle si no está ahí
                            if (!window.location.pathname.includes('/proyectos/detalle')) {
                                window.location.href = `/proyectos/detalle?id=${projectId}`;
                            }
                        }}
                        className="bg-white/5 hover:bg-white/15 backdrop-blur-sm px-10 py-1.5 rounded-2xl border border-white/20 shadow-[0_10px_30px_rgba(0,0,0,0.2)] transition-all hover:scale-105 active:scale-95 group"
                    >
                        <span className="text-3xl md:text-4xl font-extrabold text-white tracking-tighter uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                            {projectName}
                        </span>
                    </button>
                </div>
            )}
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
