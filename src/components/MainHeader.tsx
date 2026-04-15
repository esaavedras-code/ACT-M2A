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
                    <Link href="/" className="flex items-center font-black text-xl md:text-2xl tracking-tighter hover:opacity-80 transition-opacity">
                        <div className="h-6 w-6 md:h-8 md:w-8 relative overflow-hidden bg-white rounded-lg p-1 mr-2 shrink-0">
                            <Image src="/icon.png" alt="Logo" fill className="object-contain" />
                        </div>
                        <BrandName />
                    </Link>
                    <nav className="hidden lg:flex gap-2 xl:gap-6 items-center border-l border-white/20 pl-4 xl:pl-6 ml-1 xl:ml-2">
                        <Link href="/" className="text-[9px] xl:text-[10px] font-black uppercase tracking-[0.05em] xl:tracking-[0.1em] hover:text-blue-200 transition-colors shrink-0 leading-tight">
                            DASHBOARD <br />
                            <span className="text-[7px] xl:text-[8px] opacity-70 normal-case">(Proyectos)</span>
                        </Link>

                        <Suspense fallback={null}>
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
                    <ExitButton />
                    <UserAccessButton />
                </div>
            </div>
        </header>
    );
}
