"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function UserPresenceTracker() {
    const pathname = usePathname();
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        const getSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setUserId(session.user.id);
            }
        };
        getSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                setUserId(session.user.id);
            } else {
                setUserId(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (!userId) return;

        let platform = "Web";
        if (typeof window !== "undefined") {
            if ((window as any).electronAPI) {
                platform = "App Windows";
            } else {
                const ua = window.navigator.userAgent.toLowerCase();
                if (/mobi|android|iphone|ipad|touch/i.test(ua)) {
                    platform = "Web (Celular)";
                } else {
                    platform = "Web (Computadora)";
                }
            }
        }
        
        const getFriendlyPathname = (path: string) => {
            if (path === "/") return "Dashboard";
            if (path === "/proyectos") return "Lista de Proyectos";
            if (path.startsWith("/proyectos/")) return `Viendo Proyecto`;
            if (path === "/precios") return "Historial de Precios";
            if (path === "/reportes") return "Módulo de Reportes";
            if (path === "/admin/requests") return "Gestión de Acceso";
            if (path === "/acerca-de") return "Acerca de";
            if (path === "/perfil") return "Perfil de Usuario";
            return `Modulo: ${path}`;
        };

        const activityDetail = getFriendlyPathname(pathname);

        // Update presence in users table
        const updatePresence = async () => {
            const { error: userError } = await supabase
                .from("users")
                .update({ 
                    last_active_at: new Date().toISOString(),
                    current_platform: platform
                })
                .eq("id", userId);
            
            if (userError) console.error("Error updating presence:", userError);

            // Log activity to user_activity_log
            const { error: logError } = await supabase
                .from("user_activity_log")
                .insert([{
                    user_id: userId,
                    platform: platform,
                    activity_detail: activityDetail
                }]);
            
            if (logError) console.error("Error logging activity:", logError);
        };

        updatePresence();

        // Heartbeat heartbeat only for online status every 2 minutes while page is open
        const interval = setInterval(async () => {
             await supabase
                .from("users")
                .update({ 
                    last_active_at: new Date().toISOString(),
                    current_platform: platform
                })
                .eq("id", userId);
        }, 120000); // 2 minutes

        return () => clearInterval(interval);

    }, [userId, pathname]);

    return null;
}
