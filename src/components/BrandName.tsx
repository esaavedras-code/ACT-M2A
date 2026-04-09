"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function useBrandName() {
    const [brandName, setBrandName] = useState("PACT-Administradores");

    useEffect(() => {
        const fetchRole = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { data: membershipData } = await supabase.from("memberships")
                .select("role")
                .eq("user_id", session.user.id)
                .is("revoked_at", null)
                .eq("role", "F")
                .limit(1);

            if (membershipData && membershipData.length > 0) {
                setBrandName("PACT-Contratista");
            } else {
                setBrandName("PACT-Administradores");
            }
        };

        fetchRole();
        const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
            fetchRole();
        });
        return () => subscription.unsubscribe();
    }, []);

    return brandName;
}

export default function BrandName() {
    const brandName = useBrandName();
    return <span className="truncate">{brandName}</span>;
}
