"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePathname, useRouter } from "next/navigation";

export default function RegistrationModal() {
    const pathname = usePathname();
    const router = useRouter();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (pathname === '/login' || pathname === '/acerca-de') return;

        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                // If not logged in and not on login page, redirect
                router.push("/login");
            }
        };

        checkAuth();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session && pathname !== '/login' && pathname !== '/acerca-de') {
                router.push("/login");
            }
        });

        return () => subscription.unsubscribe();
    }, [pathname]);

    // This component no longer renders a modal, it's just an invisible AuthGuard
    return null;
}

