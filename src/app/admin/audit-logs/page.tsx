"use client";

import { useEffect, useState, Fragment } from "react";
import { supabase } from "@/lib/supabase";
import { History, Search, ArrowLeft, Filter, User, Table as TableIcon, Database, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";

interface AuditLog {
    id: number;
    evento: string;
    tabla: string;
    proyecto_id: string | null;
    fila_id: string;
    usuario_db: string;
    timestamp_utc: string;
    datos_anteriores: any;
    datos_nuevos: any;
}

export default function AuditLogsPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [users, setUsers] = useState<{email: string, name: string | null}[]>([]);
    const [projects, setProjects] = useState<{id: string, name: string}[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedTable, setSelectedTable] = useState("all");
    const [selectedUser, setSelectedUser] = useState("all");
    const [selectedProject, setSelectedProject] = useState("all");
    const [expandedLog, setExpandedLog] = useState<number | null>(null);

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
        setError(null);
        try {
            await Promise.all([
                fetchLogs(),
                fetchUsers(),
                fetchProjects()
            ]);
        } catch (err: any) {
            console.error("Fetch Initial Data Error:", err);
            setError("Error al cargar datos iniciales. Verifique su conexión y permisos.");
        }
        setLoading(false);
    };

    const fetchProjects = async () => {
        const { data } = await supabase.from("projects").select("id, name").order("name");
        if (data) setProjects(data);
    };

    const fetchUsers = async () => {
        const { data } = await supabase.from("users").select("email, name").order("name");
        if (data) setUsers(data);
    };

    const fetchLogs = async () => {
        console.log("Fetching logs...");
        const { data, error: fetchErr } = await supabase
            .from("audit_log")
            .select("*")
            .order("timestamp_utc", { ascending: false })
            .limit(200);

        if (fetchErr) {
            console.error("Detailed Audit Fetch Error:", fetchErr);
            setError("No se pudieron consultar los logs: " + fetchErr.message);
            return;
        }
        if (data) {
            console.log(`Successfully fetched ${data.length} logs.`);
            setLogs(data);
        }
    };

    const filteredLogs = logs.filter(log => {
        const matchesSearch = 
            log.fila_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.evento?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.tabla?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesTable = selectedTable === "all" || log.tabla === selectedTable;
        const matchesUser = selectedUser === "all" || log.usuario_db === selectedUser;
        const matchesProject = selectedProject === "all" || log.proyecto_id === selectedProject;
        return matchesSearch && matchesTable && matchesUser && matchesProject;
    });

    const tables = Array.from(new Set(logs.map(l => l.tabla))).sort();

    if (!isAdmin) return null;

    return (
        <div className="max-w-7xl mx-auto py-6 md:py-10 px-4 space-y-6 md:space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <div className="space-y-1">
                    <Link href="/" className="inline-flex items-center gap-1 text-slate-400 hover:text-primary text-sm font-bold mb-2 md:mb-4 transition-colors">
                        <ArrowLeft size={16} /> Volver al Dashboard
                    </Link>
                    <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                        <History className="text-primary" size={32} /> Logs de Auditoría
                    </h1>
                    <p className="text-slate-500 font-medium tracking-tight text-sm md:text-base text-balance">Registro completo de actividades y cambios en el sistema.</p>
                </div>

                {error && (
                    <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 p-4 rounded-2xl flex items-center gap-3 text-red-600 dark:text-red-400 font-bold text-sm">
                        <AlertCircle size={18} />
                        {error}
                        <button onClick={fetchInitialData} className="ml-auto underline text-xs">Reintentar</button>
                    </div>
                )}
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex gap-3 w-full lg:w-auto">
                    <div className="relative group col-span-1 sm:col-span-2 lg:flex-1 lg:min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
                        <input 
                            type="text" 
                            placeholder="Buscar por ID o Evento..." 
                            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5">
                        <User size={16} className="text-slate-400 shrink-0" />
                        <select 
                            className="bg-transparent outline-none font-bold text-[10px] uppercase tracking-wider w-full cursor-pointer"
                            value={selectedUser}
                            onChange={(e) => setSelectedUser(e.target.value)}
                        >
                            <option value="all">Cualquier Usuario</option>
                            <option value="postgres">SISTEMA (Postgres)</option>
                            <option value="authenticated">CLIENTE (En sesión)</option>
                            {users.map(u => (
                                <option key={u.email} value={u.email}>
                                    {u.name || u.email}
                                </option>
                            ))}
                        </select>
                    </div>
                    
                    <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5">
                        <TableIcon size={16} className="text-slate-400 shrink-0" />
                        <select 
                            className="bg-transparent outline-none font-bold text-[10px] uppercase tracking-wider w-full cursor-pointer"
                            value={selectedTable}
                            onChange={(e) => setSelectedTable(e.target.value)}
                        >
                            <option value="all">Todas las Tablas</option>
                            {tables.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>

                    <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5">
                        <Database size={16} className="text-slate-400 shrink-0" />
                        <select 
                            className="bg-transparent outline-none font-bold text-[10px] uppercase tracking-wider w-full cursor-pointer max-w-[200px]"
                            value={selectedProject}
                            onChange={(e) => setSelectedProject(e.target.value)}
                        >
                            <option value="all">Cualquier Proyecto</option>
                            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>

                    <button 
                        onClick={fetchInitialData}
                        className="p-2.5 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest sm:col-span-2 lg:col-span-1"
                        title="Refrescar"
                    >
                        <Database size={18} />
                        <span className="lg:hidden">Refrescar Datos</span>
                    </button>
                </div>
            </div>

            <div className="card overflow-hidden border-none shadow-xl bg-white dark:bg-slate-900 rounded-[2rem] p-0">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800">
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">ID</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Fecha / Hora</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Evento</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Tabla / Registro</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Usuario</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Detalles</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loading ? (
                                [1, 2, 3, 4, 5].map(i => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={6} className="px-6 py-6"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-full"></div></td>
                                    </tr>
                                ))
                            ) : filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center text-slate-400 italic font-medium">No se encontraron registros que coincidan con los filtros.</td>
                                </tr>
                            ) : filteredLogs.map(log => (
                                <Fragment key={log.id}>
                                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                        <td className="px-6 py-5">
                                            <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">#{log.id}</span>
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                                    {new Date(log.timestamp_utc).toLocaleDateString("es-PR")}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-mono tracking-tighter italic">
                                                    {new Date(log.timestamp_utc).toLocaleTimeString("es-PR")}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                                                log.evento === 'INSERT' ? 'bg-emerald-100 text-emerald-700' : 
                                                log.evento === 'UPDATE' ? 'bg-blue-100 text-blue-700' : 
                                                'bg-rose-100 text-rose-700'}`}>
                                                {log.evento}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-tight">{log.tabla}</span>
                                                <span className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">ID: {log.fila_id}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                                                <div className={`w-6 h-6 rounded-lg ${log.usuario_db === 'postgres' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 dark:bg-slate-800'} flex items-center justify-center text-[10px]`}>
                                                    {log.usuario_db?.substring(0, 2).toUpperCase() || '??'}
                                                </div>
                                                <span className="truncate max-w-[150px]" title={log.usuario_db}>
                                                    {log.usuario_db === 'postgres' ? 'SISTEMA (Postgres)' : (log.usuario_db === 'authenticated' ? 'CLIENTE (En sesión)' : log.usuario_db)}
                                                </span>
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <button 
                                                onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                                                className={`p-2 rounded-xl transition-all inline-flex items-center gap-2 text-[10px] font-bold ${expandedLog === log.id ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-primary'}`}
                                            >
                                                {expandedLog === log.id ? 'CERRAR' : 'VER JSON'}
                                                <ChevronDown size={14} className={`transform transition-transform ${expandedLog === log.id ? 'rotate-180' : ''}`} />
                                            </button>
                                        </td>
                                    </tr>
                                    {expandedLog === log.id && (
                                        <tr className="bg-slate-50 dark:bg-slate-800/20 animate-in slide-in-from-top-1 duration-200">
                                            <td colSpan={6} className="px-10 py-8 border-b border-slate-100 dark:border-slate-800">
                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                                    <div className="space-y-3">
                                                        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                                                            Estado Anterior
                                                        </h4>
                                                        <pre className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl text-[11px] overflow-auto max-h-[400px] font-mono text-slate-400 shadow-sm leading-relaxed">
                                                            {log.datos_anteriores ? JSON.stringify(log.datos_anteriores, null, 2) : "// Sin datos previos"}
                                                        </pre>
                                                    </div>
                                                    <div className="space-y-3">
                                                        <h4 className="text-[10px] font-black uppercase text-blue-500 tracking-widest flex items-center gap-2">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                                            Nuevo Estado
                                                        </h4>
                                                        <pre className="bg-blue-50/10 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 p-5 rounded-2xl text-[11px] overflow-auto max-h-[400px] font-mono text-slate-600 dark:text-slate-300 shadow-sm leading-relaxed">
                                                            {log.datos_nuevos ? JSON.stringify(log.datos_nuevos, null, 2) : "// Registro eliminado"}
                                                        </pre>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="p-6 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] text-slate-400 font-medium italic flex items-center gap-2">
                        <Info size={14} className="text-slate-300" />
                        Mostrando los últimos 200 eventos globales del sistema. Use los filtros superiores para refinar la búsqueda.
                    </p>
                </div>
            </div>
        </div>
    );
}
