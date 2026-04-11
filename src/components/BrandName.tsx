"use client";

import { useUserRole } from "@/hooks/useUserRole";

export function useBrandName() {
    const { role } = useUserRole();
    return role === 'F' ? "PACT-Contratista" : "PACT-Administradores";
}

export default function BrandName() {
    const brandName = useBrandName();
    return <span>{brandName}</span>;
}
