"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { History, Search, ArrowLeft, Filter, User, Table as TableIcon, Database } from "lucide-react";
import Link from "next/link";

interface AuditLog {
    id: number;
    evento: string;
    tabla: string;
    fila_id: string;
    usuario_db: string;
    timestamp_utc: string;
    datos_anteriores: any;
    datos_nuevos: any;
}

export default function AuditLogsPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [users, setUsers] = useState<{email: string, name: string | null}[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedTable, setSelectedTable] = useState("all");
    const [selectedUser, setSelectedUser] = useState("all");

    useEffect(() => {
        const checkAdmin = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                window.location.href = "/login";
                return;
            }

            const { data: user } = await supabase
                .from("users")
                .select("role_global")
                .eq("id", session.user.id)
                .single();

            if (user?.role_global !== 'A') {
                alert("Acceso restringido: Solo el Administrador Global puede ver los logs de auditoría.");
                window.location.href = "/";
                return;
            }

            setIsAdmin(true);
            fetchInitialData();
        };

        checkAdmin();
    }, []);

    const fetchInitialData = async () => {
        setLoading(true);
        await Promise.all([
            fetchLogs(),
            fetchUsers()
        ]);
        setLoading(false);
    };

    const fetchUsers = async () => {
        const { data } = await supabase.from("users").select("email, name").order("name");
        if (data) setUsers(data);
    };

    const fetchLogs = async () => {
        let query = supabase
            .from("audit_log")
            .select("*")
            .order("timestamp_utc", { ascending: false })
            .limit(200);

        const { data } = await query;
        if (data) setLogs(data);
    };

    const filteredLogs = logs.filter(log => {
        const matchesSearch = 
            log.fila_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.evento?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesTable = selectedTable === "all" || log.tabla === selectedTable;
        const matchesUser = selectedUser === "all" || log.usuario_db === selectedUser;
        return matchesSearch && matchesTable && matchesUser;
    });

    const tables = Array.from(new Set(logs.map(l => l.tabla))).sort();

    if (!isAdmin) return null;

    return (
        <div className="max-w-7xl mx-auto py-10 px-4 space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <Link href="/" className="inline-flex items-center gap-1 text-slate-400 hover:text-primary text-sm font-bold mb-4 transition-colors">
                        <ArrowLeft size={16} /> Volver al Dashboard
                    </Link>
                    <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                        <History className="text-primary" size={36} /> Logs de Auditoría
                    </h1>
                    <p className="text-slate-500 font-medium tracking-tight">Registro completo de actividades y cambios en el sistema.</p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
                        <input 
                            type="text" 
                            placeholder="Buscar por ID o Evento..." 
                            className="pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2">
                        <User size={16} className="text-slate-400" />
                        <select 
                            className="bg-transparent outline-none font-bold text-xs uppercase tracking-wider pr-4 cursor-pointer max-w-[150px]"
                            value={selectedUser}
                            onChange={(e) => setSelectedUser(e.target.value)}
                        >
                            <option value="all">Cualquier Usuario</option>
                            {users.map(u => (
                                <option key={u.email} value={u.email}>
                                    {u.name || u.email}
                                </option>
                            ))}
                        </select>
                    </div>
                    
                    <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2">
                        <Filter size={16} className="text-slate-400" />
                        <select 
                            className="bg-transparent outline-none font-bold text-xs uppercase tracking-wider pr-4 cursor-pointer"
                            value={selectedTable}
                            onChange={(e) => setSelectedTable(e.target.value)}
                        >
                            <option value="all">Todas las Tablas</option>
                            {tables.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>

                    <button 
                        onClick={fetchLogs}
                        className="p-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors"
                        title="Refrescar"
                    >
                        <Database size={20} />
                    </button>
                </div>
            </div>

            <div className="card overflow-hidden border-none shadow-2xl bg-white dark:bg-slate-900 rounded-[2rem]">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Fecha / Hora</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Usuario</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Evento</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Tabla / Registro</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Detalles</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loading ? (
                                [1, 2, 3, 4, 5].map(i => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={5} className="px-6 py-6"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-full"></div></td>
                                    </tr>
                                ))
                            ) : filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center text-slate-400 italic">No se encontraron registros que coincidan con los filtros.</td>
                                </tr>
                            ) : filteredLogs.map(log => (
                                <tr key={log.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all">
                                    <td className="px-6 py-5">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                                                {new Date(log.timestamp_utc).toLocaleDateString()}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-mono">
                                                {new Date(log.timestamp_utc).toLocaleTimeString()}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                                            <User size={14} className="text-slate-400" />
                                            {log.usuario_db}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter ${
                                            log.evento === 'INSERT' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                            log.evento === 'UPDATE' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                            'bg-red-50 text-red-600 border border-red-100'
                                        }`}>
                                            {log.evento}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 uppercase tracking-tighter">
                                                <TableIcon size={12} className="text-primary" /> {log.tabla}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-mono mt-0.5 truncate max-w-[150px]" title={log.fila_id}>
                                                ID: {log.fila_id}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <button 
                                            onClick={() => {
                                                console.log("OLD:", log.datos_anteriores);
                                                console.log("NEW:", log.datos_nuevos);
                                                alert("Detalles enviados a la consola (F12) para revisión técnica.");
                                            }}
                                            className="text-[10px] font-black text-primary hover:underline"
                                        >
                                            VER JSON
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
