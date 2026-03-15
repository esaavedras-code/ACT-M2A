import type { Metadata } from "next";
import { Suspense } from "react";
import ReportesLink from "@/components/ReportesLink";
import RegistrationModal from "@/components/RegistrationModal";
import UserAccessButton from "@/components/UserAccessButton";
import ProjectHeaderActions from "@/components/ProjectHeaderActions";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
    title: "Proyectos ACT (PACT) - Sistema de Control de Proyectos",
    description: "Gestión de contratos y control de proyectos de construcción de carreteras en Puerto Rico",
};

const currentYear = new Date().getFullYear();

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="es" suppressHydrationWarning>
            <body className="antialiased min-h-screen relative" suppressHydrationWarning>
                <RegistrationModal />
                <div className="flex flex-col min-h-screen">
                    <header className="bg-primary text-white shadow-md px-0 fixed w-full z-50 h-16" suppressHydrationWarning>
                        <div className="mx-auto flex justify-between items-center h-full px-6">
                            <Link href="/" className="h-full flex items-center -ml-6">
                                <div className="h-full w-16 relative overflow-hidden">
                                    <Image
                                        src="/icon.png"
                                        alt="PACT Logo"
                                        fill
                                        className="object-cover"
                                        priority
                                    />
                                </div>
                                <span className="text-xl font-black tracking-tight ml-2">PACT</span>
                            </Link>
                            <div className="flex items-center gap-8">
                                <nav className="hidden lg:flex space-x-6 items-center">
                                    <Link href="/" className="hover:text-blue-200 transition-colors text-sm font-bold uppercase tracking-wider">Dashboard</Link>
                                    <Link href="/proyectos" className="hover:text-blue-200 transition-colors text-sm font-bold uppercase tracking-wider">Proyectos</Link>
                                    <Link href="/acerca-de" className="hover:text-blue-200 transition-colors text-sm font-bold uppercase tracking-wider">Acerca de</Link>
                                    <Suspense fallback={<span className="text-sm opacity-50">Reportes...</span>}>
                                        <div className="bg-white/10 h-6 w-px mx-2"></div>
                                        <ReportesLink />
                                    </Suspense>
                                </nav>
                                <div className="flex items-center gap-3">
                                    <Suspense fallback={null}>
                                        <ProjectHeaderActions />
                                    </Suspense>
                                    <UserAccessButton />
                                </div>
                            </div>
                        </div>
                    </header>
                    <main className="flex-grow pt-20 pb-10">
                        <div className="max-w-[1600px] mx-auto px-4 md:px-6 relative">
                            {/* M2A Logo in the white area corner */}
                            <div className="absolute top-0 right-6 hidden xl:block opacity-30 hover:opacity-100 transition-opacity">
                                <Image 
                                    src="/m2a_logo.png" 
                                    alt="M2A Group" 
                                    width={100} 
                                    height={40} 
                                    className="object-contain"
                                />
                            </div>
                            {children}
                        </div>
                    </main>
                    <footer className="bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-6 text-center text-slate-500 text-sm" suppressHydrationWarning>
                        <p suppressHydrationWarning>© {currentYear} M2A Group - Todos los derechos reservados</p>
                    </footer>
                </div>
            </body>
        </html>
    );
}
