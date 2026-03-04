
"use client";

import { useSearchParams } from "next/navigation";
import { FileBarChart } from "lucide-react";
import Link from "next/link";

export default function ReportesLink() {
    const searchParams = useSearchParams();
    const projectId = searchParams.get("id");

    return (
        <Link
            href={projectId ? `/reportes?id=${projectId}` : "/reportes"}
            className="flex items-center gap-1.5 hover:text-blue-200 transition-colors py-2 font-medium"
        >
            <FileBarChart size={18} />
            Reportes
        </Link>
    );
}
