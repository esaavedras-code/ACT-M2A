"use client";

import { BackupGuardProvider } from "@/components/BackupModal";
import GreenCellPlaceholders from "@/components/GreenCellPlaceholders";

/**
 * ClientProviders envuelve todos los providers que requieren ser Client Components.
 * Esto es necesario porque el layout.tsx raíz es un Server Component.
 */
export default function ClientProviders({ children }: { children: React.ReactNode }) {
    return (
        <BackupGuardProvider>
            <GreenCellPlaceholders />
            {children}
        </BackupGuardProvider>
    );
}
