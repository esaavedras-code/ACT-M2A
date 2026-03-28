"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function ReportesMenu() {
    const searchParams = useSearchParams();
    const projectId = searchParams.get("id");

    return (
        <Link
            href={projectId ? `/reportes?id=${projectId}` : "#"}
            onClick={(e) => {
                if (!projectId) {
                    e.preventDefault();
                    alert("No hay ningún proyecto seleccionado");
                }
            }}
            className="text-[10px] font-black uppercase tracking-[0.2em] hover:text-blue-200 transition-colors"
        >
            Central de reportes
        </Link>
    );
}
