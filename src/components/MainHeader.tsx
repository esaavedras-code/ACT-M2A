"use client";

import { Suspense } from "react";
import UserAccessButton from "@/components/UserAccessButton";
import ProjectHeaderActions from "@/components/ProjectHeaderActions";
import ReportesMenu from "@/components/ReportesMenu";
import Image from "next/image";
import Link from "next/link";
import MobileMenu from "@/components/MobileMenu";
import BrandName from "@/components/BrandName";
import ExitButton from "@/components/ExitButton";
import RestoreButton from "@/components/RestoreButton";
import { useUserRole } from "@/hooks/useUserRole";

export default function MainHeader() {
    const { role } = useUserRole();
    
    // Determine background color based on role
    // Role 'F' is Contractor -> Wine color (Vino)
    const headerBgClass = role === 'F' ? "bg-[#670010]" : "bg-blue-700";

    return (
        <header className={`${headerBgClass} text-white shadow-xl px-0 fixed top-0 w-full z-50 h-16 transition-all duration-300`} suppressHydrationWarning>
            <div className="mx-auto flex justify-between items-center h-full px-4 md:px-6 max-w-[1600px]">
                <div className="flex items-center gap-2 md:gap-6 h-full">
                    <Suspense fallback={<div className="w-6 h-6" />}>
                        <MobileMenu />
                    </Suspense>
                    <Link href="/" className="flex items-center font-black text-xs md:text-sm tracking-tighter hover:opacity-80 transition-opacity">
                        <div className="h-8 w-8 md:h-10 md:w-10 relative overflow-hidden bg-white rounded-lg p-0.5 mr-2 shrink-0">
                            <Image src="/icon.png" alt="Logo" fill className="object-contain" />
                        </div>
                        <BrandName />
                    </Link>
                    <nav className="hidden lg:flex gap-2 xl:gap-6 items-center border-l border-white/20 pl-4 xl:pl-6 ml-1 xl:ml-2">
                        <Link href="/" className="flex flex-col items-center justify-center text-[20px] xl:text-[23px] font-black uppercase tracking-[0.05em] xl:tracking-[0.1em] hover:text-blue-200 transition-colors shrink-0 leading-none">
                            <span>DASHBOARD</span>
                            <span className="text-[17px] xl:text-[20px] opacity-70 normal-case mt-[-2px]">(Proyectos)</span>
                        </Link>

                        <Suspense fallback={null}>
                            <ReportesMenu />
                        </Suspense>

                        <Link href="/acerca-de" className="text-[7px] xl:text-[8px] font-black uppercase tracking-[0.1em] hover:text-blue-200 transition-colors shrink-0">
                            ABOUT
                        </Link>
                    </nav>
                </div>
                <div className="flex items-center gap-2 md:gap-4 shrink-0">
                    <Suspense fallback={null}>
                        <div className="hidden sm:block">
                            <ProjectHeaderActions />
                        </div>
                    </Suspense>
                    <RestoreButton />
                    <ExitButton />
                    <UserAccessButton />
                </div>
            </div>
        </header>
    );
}
