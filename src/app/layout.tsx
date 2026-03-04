import type { Metadata } from "next";
import { Suspense } from "react";
import ReportesLink from "@/components/ReportesLink";
import RegistrationModal from "@/components/RegistrationModal";
import UserAccessButton from "@/components/UserAccessButton";
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
        <html lang="es">
            <body className="antialiased min-h-screen relative">
                <RegistrationModal />
                <div className="flex flex-col min-h-screen">
                    <header className="bg-primary text-white shadow-md py-4 px-6 fixed w-full z-50">
                        <div className="container mx-auto flex justify-between items-center">
                            <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
                                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center font-black rotate-6 border border-white/20 backdrop-blur-md">P</div>
                                PACT
                            </h2>
                            <div className="flex items-center gap-8">
                                <nav className="hidden lg:flex space-x-6 items-center">
                                    <a href="/" className="hover:text-blue-200 transition-colors text-sm font-bold uppercase tracking-wider">Dashboard</a>
                                    <a href="/proyectos" className="hover:text-blue-200 transition-colors text-sm font-bold uppercase tracking-wider">Proyectos</a>
                                    <Suspense fallback={<span className="text-sm opacity-50">Reportes...</span>}>
                                        <div className="bg-white/10 h-6 w-px mx-2"></div>
                                        <ReportesLink />
                                    </Suspense>
                                </nav>
                                <UserAccessButton />
                            </div>
                        </div>
                    </header>
                    <main className="flex-grow pt-20 pb-10">
                        <div className="max-w-[1600px] mx-auto px-4 md:px-6">
                            {children}
                        </div>
                    </main>
                    <footer className="bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-6 text-center text-slate-500 text-sm">
                        <p>© {currentYear} M2A Group - Todos los derechos reservados</p>
                    </footer>
                </div>
            </body>
        </html>
    );
}
