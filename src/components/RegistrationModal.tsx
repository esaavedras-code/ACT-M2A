"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePathname } from "next/navigation";

export default function RegistrationModal() {
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (pathname === '/login') return;

        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                // If not logged in and not on login page, redirect
                window.location.href = "/login";
            }
        };

        checkAuth();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session && pathname !== '/login') {
                window.location.href = "/login";
            }
        });

        return () => subscription.unsubscribe();
    }, [pathname]);

    // This component no longer renders a modal, it's just an invisible AuthGuard
    return null;
}

