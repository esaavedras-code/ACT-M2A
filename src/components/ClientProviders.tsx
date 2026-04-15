"use client";

import { BackupGuardProvider } from "@/components/BackupModal";

/**
 * ClientProviders envuelve todos los providers que requieren ser Client Components.
 * Esto es necesario porque el layout.tsx raíz es un Server Component.
 */
export default function ClientProviders({ children }: { children: React.ReactNode }) {
    return (
        <BackupGuardProvider>
            {children}
        </BackupGuardProvider>
    );
}
