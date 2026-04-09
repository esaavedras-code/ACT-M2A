"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Shield } from "lucide-react";

export default function RoleIndicatorBar() {
    const [role, setRole] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRole = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setRole(null);
                setLoading(false);
                return;
            }

            // Check global role first
            const { data: userData } = await supabase.from("users").select("role_global").eq("id", session.user.id).single();
            
            if (userData?.role_global === "A") {
                setRole("A");
            } else {
                // If not A, check for most common role or project role
                // For simplicity in the global bar, we look for any membership role
                // In a real app, this might depend on the current project context, 
                // but the request asks for a general indicator.
                const { data: membershipData } = await supabase.from("memberships")
                    .select("role")
                    .eq("user_id", session.user.id)
                    .is("revoked_at", null)
                    .limit(1);

                if (membershipData && membershipData.length > 0) {
                    setRole(membershipData[0].role);
                } else if (userData?.role_global) {
                    setRole(userData.role_global);
                }
            }
            setLoading(false);
        };

        fetchRole();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
            fetchRole();
        });

        return () => subscription.unsubscribe();
    }, []);

    if (loading || !role) return null;

    const roleConfig: Record<string, { label: string, color: string, letter: string }> = {
        'A': { label: 'Administrador del Programa', color: 'bg-amber-500', letter: 'A' },
        'B': { label: 'Administrador de proyecto', color: 'bg-blue-600', letter: 'B' },
        'C': { label: 'Data Entri', color: 'bg-emerald-600', letter: 'C' },
        'D': { label: 'Solo lectura', color: 'bg-slate-500', letter: 'D' },
        'E': { label: 'Inspector', color: 'bg-orange-600', letter: 'E' },
        'F': { label: 'Contratista', color: 'bg-[#670010]', letter: 'F' }
    };

    const config = roleConfig[role] || { label: 'Usuario', color: 'bg-slate-400', letter: '?' };

    return (
        <div className={`w-full h-2 fixed top-16 left-0 z-[49] ${config.color} transition-colors duration-500`}>
            <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-900 px-4 py-0.5 rounded-b-xl shadow-md border-x border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300">
                <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                    {config.letter} ({config.label})
                </span>
                <Shield size={10} className="text-slate-400" />
            </div>
        </div>
    );
}
