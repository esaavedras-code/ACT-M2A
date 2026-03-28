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
                    <RegistrationModal />
                    <div className="flex flex-col min-h-screen">
                        <header className="bg-blue-700 text-white shadow-xl px-0 fixed w-full z-50 h-16" suppressHydrationWarning>
                            <div className="mx-auto flex justify-between items-center h-full px-6 max-w-[1600px]">
                                <div className="flex items-center gap-6 h-full">
                                    <Link href="/" className="flex items-center font-black text-2xl tracking-tighter hover:opacity-80 transition-opacity">
                                        <div className="h-8 w-8 relative overflow-hidden bg-white rounded-lg p-1 mr-2">
                                            <Image src="/icon.png" alt="Logo" fill className="object-contain" />
                                        </div>
                                        PACT
                                    </Link>
                                    <nav className="hidden lg:flex gap-6 items-center">
                                        <Link href="/" className="text-[10px] font-black uppercase tracking-[0.2em] hover:text-blue-200 transition-colors">Dashboard</Link>
                                        <Link href="/proyectos" className="text-[10px] font-black uppercase tracking-[0.2em] hover:text-blue-200 transition-colors">Proyectos</Link>
                                        <Link href="/precios" className="text-[10px] font-black uppercase tracking-[0.2em] hover:text-blue-200 transition-colors">Historial</Link>
                                        <Suspense fallback={null}>
                                            <div className="bg-white/10 h-6 w-px mx-1"></div>
                                            <ReportesMenu />
                                        </Suspense>
                                    </nav>
                                </div>
                                <div className="flex items-center gap-4">
                                    <Suspense fallback={null}>
                                        <RoleIndicatorBar />
                                    </Suspense>
                                    <Suspense fallback={null}>
                                        <ProjectHeaderActions />
                                    </Suspense>
                                    <UserAccessButton />
                                </div>
                            </div>
                        </header>

                        <main className="flex-grow pt-24 pb-12">
                            <div className="max-w-[1600px] mx-auto px-4 md:px-8 relative overflow-x-hidden">
                                {children}
                            </div>
                        </main>

                        <footer className="bg-slate-900 text-slate-500 py-8 text-center text-[10px] font-bold uppercase tracking-[0.2em] border-t border-slate-800" suppressHydrationWarning>
                            <p>© M2A Group - Sistema de Control de Proyectos Carreteras</p>
                        </footer>
                    </div>
                </TranslationProvider>
            </body>
        </html>
    );
}
