"use client";
import { useEffect, useState } from "react";

export default function PlatformIndicator() {
    const [platform, setPlatform] = useState<string | null>(null);

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

    if (!platform) return null;

    return (
        <div className="fixed top-0 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none">
            <div className="bg-slate-900/90 text-white text-[9px] font-black tracking-[0.3em] uppercase px-6 py-1 rounded-b-xl border-x border-b border-white/20 shadow-2xl backdrop-blur-md">
                {platform}
            </div>
        </div>
    );
}
