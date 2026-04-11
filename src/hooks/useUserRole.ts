"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type ProjectRole = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'standard';

export function useUserRole() {
    const [role, setRole] = useState<ProjectRole>('standard');
    const [roleGlobal, setRoleGlobal] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRole = async () => {
            setLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setRole('standard');
                setLoading(false);
                return;
            }

            // Check if user is Global Admin first
            const { data: userData } = await supabase.from("users").select("role_global").eq("id", session.user.id).maybeSingle();
            
            if (userData?.role_global === 'A') {
                setRole('A');
                setRoleGlobal('A');
                setLoading(false);
                return;
            }

            if (userData?.role_global === 'F') {
                setRole('F');
                setRoleGlobal('F');
                setLoading(false);
                return;
            }
            setRoleGlobal(userData?.role_global || null);

            // Check memberships for specific roles (especially Contractor F)
            const { data: membershipData } = await supabase.from("memberships")
                .select("role")
                .eq("user_id", session.user.id)
                .is("revoked_at", null)
                .order('role', { ascending: true }) // A is higher than F alphabetically? No, we want priority
                .limit(1);

            if (membershipData && membershipData.length > 0) {
                setRole(membershipData[0].role as ProjectRole);
            } else {
                setRole('standard');
            }
            setLoading(false);
        };

        fetchRole();
        const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
            fetchRole();
        });
        return () => subscription.unsubscribe();
    }, []);

    return { role, roleGlobal, loading };
}
