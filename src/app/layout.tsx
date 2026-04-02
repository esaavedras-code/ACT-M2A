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
import "./globals.css";

export const metadata: Metadata = {
    title: "PACT - Sistema de Control de Proyectos",
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
                        <header className="bg-blue-700 text-white shadow-xl px-0 fixed top-0 w-full z-50 h-16 transition-all duration-300" suppressHydrationWarning>
                            <div className="mx-auto flex justify-between items-center h-full px-4 md:px-6 max-w-[1600px]">
                                <div className="flex items-center gap-2 md:gap-6 h-full">
                                    <Suspense fallback={<div className="w-6 h-6" />}>
                                        <MobileMenu />
                                    </Suspense>
                                    <Link href="/" className="flex items-center font-black text-xl md:text-2xl tracking-tighter hover:opacity-80 transition-opacity">
                                        <div className="h-6 w-6 md:h-8 md:w-8 relative overflow-hidden bg-white rounded-lg p-1 mr-2 shrink-0">
                                            <Image src="/icon.png" alt="Logo" fill className="object-contain" />
                                        </div>
                                        <span className="truncate">PACT</span>
                                    </Link>
                                    <nav className="hidden lg:flex gap-2 xl:gap-6 items-center border-l border-white/20 pl-4 xl:pl-6 ml-1 xl:ml-2">
                                        <Link href="/" className="text-[9px] xl:text-[10px] font-black uppercase tracking-[0.1em] xl:tracking-[0.2em] hover:text-blue-200 transition-colors shrink-0">Dashboard</Link>
                                        <Link href="/proyectos" className="text-[9px] xl:text-[10px] font-black uppercase tracking-[0.1em] xl:tracking-[0.2em] hover:text-blue-200 transition-colors shrink-0">Proyectos</Link>
                                        <Link href="/precios" className="text-[8px] xl:text-[10px] font-black uppercase tracking-[0.05em] xl:tracking-[0.1em] hover:text-blue-200 transition-colors shrink-0 leading-tight">
                                            Historial de precios <br /> de la ACT
                                        </Link>
                                        <Suspense fallback={null}>
                                            <div className="bg-white/10 h-6 w-px mx-1"></div>
                                            <ReportesMenu />
                                        </Suspense>
                                    </nav>
                                </div>
                                <div className="flex items-center gap-2 md:gap-4 shrink-0">
                                    <Suspense fallback={null}>
                                        <div className="hidden sm:block">
                                            <ProjectHeaderActions />
                                        </div>
                                    </Suspense>
                                    <UserAccessButton />
                                </div>
                            </div>
                        </header>

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
