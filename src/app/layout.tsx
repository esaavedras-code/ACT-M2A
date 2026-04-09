import type { Metadata } from "next";
import { Suspense } from "react";
import RegistrationModal from "@/components/RegistrationModal";
import UserAccessButton from "@/components/UserAccessButton";
import ProjectHeaderActions from "@/components/ProjectHeaderActions";
import ReportesMenu from "@/components/ReportesMenu";
import Image from "next/image";
import Link from "next/link";
import { TranslationProvider } from "@/lib/TranslationContext";
import RoleIndicatorBar from "@/components/RoleIndicatorBar";
import MobileMenu from "@/components/MobileMenu";
import BottomNav from "@/components/BottomNav";
import QuickHelpModal from "@/components/QuickHelpModal";
import AIChat from "@/components/AIChat";
import UserPresenceTracker from "@/components/UserPresenceTracker";
import MaintenanceGuard from "@/components/MaintenanceGuard";
import PlatformIndicator from "@/components/PlatformIndicator";
import PriceHistoryLink from "@/components/PriceHistoryLink";
import BrandName from "@/components/BrandName";
import MainHeader from "@/components/MainHeader";
import "./globals.css";

export const metadata: Metadata = {
    title: "PACT-Administradores - Sistema de Control de Proyectos",
    description: "Gestión de contratos y control de proyectos",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="es" suppressHydrationWarning>
            <body className="antialiased min-h-screen relative font-sans text-slate-900 bg-slate-50" suppressHydrationWarning>
                <TranslationProvider>
                    <PlatformIndicator />
                    <UserPresenceTracker />
                    <Suspense fallback={null}>
                        <MaintenanceGuard />
                    </Suspense>
                    <RegistrationModal />
                    <div className="flex flex-col min-h-screen">
                        <Suspense fallback={<div className="bg-blue-700 h-16 fixed top-0 w-full z-50 shadow-xl" />}>
                            <MainHeader />
                        </Suspense>

                        <Suspense fallback={null}>
                            <RoleIndicatorBar />
                        </Suspense>

                        <main className="flex-grow pt-24 pb-24 lg:pb-12 sm:pt-24 md:pt-28">
                            <div className="max-w-[1600px] mx-auto px-4 md:px-8 relative overflow-x-hidden">
                                <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>}>
                                    {children}
                                </Suspense>
                            </div>
                        </main>

                        <footer className="bg-slate-900 text-slate-500 py-8 text-center text-[10px] font-bold uppercase tracking-[0.2em] border-t border-slate-800 mb-20 lg:mb-0" suppressHydrationWarning>
                            <p>© M2A Group - Sistema de Control de Proyectos Carreteras</p>
                        </footer>
                        <Suspense fallback={null}>
                            <QuickHelpModal />
                            <BottomNav />
                            <AIChat />
                        </Suspense>
                    </div>
                </TranslationProvider>
            </body>
        </html>
    );
}
