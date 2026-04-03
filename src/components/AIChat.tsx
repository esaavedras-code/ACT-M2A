"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { MessageSquare, Send, X, Bot, User, Sparkles, Loader2, Minimize2 } from "lucide-react";
import { useSearchParams } from "next/navigation";

function AIChatContent() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<{ role: 'ai' | 'user', content: string }[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [minimized, setMinimized] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const searchParams = useSearchParams();
    const projectId = searchParams.get("id");

    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [hasMoved, setHasMoved] = useState(false);

    useEffect(() => {
        const savedPos = localStorage.getItem("pact_ai_pos");
        if (savedPos) {
            try {
                setPosition(JSON.parse(savedPos));
            } catch (e) {
                console.error("Error loading AI position", e);
            }
        }
    }, []);

    useEffect(() => {
        if (!isDragging) return;

        const handleMove = (e: MouseEvent | TouchEvent) => {
            const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
            const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
            
            const newX = clientX - dragStart.x;
            const newY = clientY - dragStart.y;
            
            if (Math.abs(newX - position.x) > 2 || Math.abs(newY - position.y) > 2) {
                setHasMoved(true);
            }
            
            setPosition({ x: newX, y: newY });
        };

        const handleEnd = () => {
            setIsDragging(false);
            localStorage.setItem("pact_ai_pos", JSON.stringify(position));
        };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('touchmove', handleMove);
        window.addEventListener('mouseup', handleEnd);
        window.addEventListener('touchend', handleEnd);

        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('mouseup', handleEnd);
            window.removeEventListener('touchend', handleEnd);
        };
    }, [isDragging, dragStart, position]);

    const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
        const clientX = 'touches' in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;
        
        setIsDragging(true);
        setHasMoved(false);
        setDragStart({ x: clientX - position.x, y: clientY - position.y });
    };

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMsg = input.trim();
        setInput("");
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setLoading(true);

        try {
            const { data, error } = await supabase.functions.invoke('ai-assistant', {
                body: { 
                    prompt: userMsg,
                    context: projectId 
                        ? `Trabajando en el proyecto con ID ${projectId}. IMPORTANTE: Siempre usa un formato visualmente atractivo con negrillas (**texto**) para resaltar puntos clave, usa viñetas si es necesario y separa frases con puntuación clara. Cuando cites proyectos, usa su número ACT y no IDs técnicos.` 
                        : 'General. IMPORTANTE: Usa un formato atractivo con negrillas (**texto**) y puntuación clara.'
                }
            });

            if (error) throw error;
            if (data?.text) {
                setMessages(prev => [...prev, { role: 'ai', content: data.text }]);
            } else {
                setMessages(prev => [...prev, { role: 'ai', content: "Lo siento, hubo un problema al procesar tu solicitud." }]);
            }
        } catch (err) {
            console.error("AI Error:", err);
            setMessages(prev => [...prev, { role: 'ai', content: "Error de conexión con el Asistente PACT." }]);
        } finally {
            setLoading(false);
        }
    };

    const renderMessage = (content: string) => {
        // Simple markdown-like parser for bold and line breaks
        const parts = content.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i} className="font-black text-blue-600 dark:text-blue-400">{part.slice(2, -2)}</strong>;
            }
            return part.split('\n').map((line, j) => (
                <span key={`${i}-${j}`}>
                    {line}
                    {j < part.split('\n').length - 1 && <br />}
                </span>
            ));
        });
    };

    if (!isOpen) {
        return (
            <button
                onMouseDown={handleMouseDown}
                onTouchStart={handleMouseDown}
                onClick={() => !hasMoved && setIsOpen(true)}
                className="fixed top-[2in] right-5 lg:right-10 w-16 h-16 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-blue-700 transition-all z-[100] group overflow-hidden cursor-move"
                style={{
                    transform: `translate(${position.x}px, ${position.y}px)`,
                    transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }}
            >
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-400/20 to-transparent animate-pulse" />
                <Bot size={28} className="relative z-10 group-hover:scale-110 transition-transform" />
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-4 border-white dark:border-slate-900 shadow-sm" />
            </button>
        );
    }

    return (
        <div 
            className={`fixed top-[2in] right-0 lg:right-10 w-full lg:w-[400px] bg-white dark:bg-slate-950 lg:rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-slate-200 dark:border-slate-800 flex flex-col z-[100] transition-all duration-300 ${minimized ? 'h-16 overflow-hidden' : 'h-[600px] max-h-[70vh]'}`}
            style={{
                transform: `translate(${position.x}px, ${position.y}px)`,
                transition: isDragging ? 'none' : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
        >
            {/* Header */}
            <div className="p-5 bg-blue-600 text-white flex justify-between items-center lg:rounded-t-[2rem]">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                        <Bot size={22} />
                    </div>
                    <div>
                        <h3 className="font-black text-xs uppercase tracking-widest leading-none">Asistente PACT</h3>
                        <p className="text-[9px] font-bold opacity-70 uppercase tracking-tighter italic">Llama 3.1 AI • Línea Directa</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setMinimized(!minimized)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <Minimize2 size={16} />
                    </button>
                    <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors border border-white/20">
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* Chat Messages */}
            {!minimized && (
                <>
                    <div ref={scrollRef} className="flex-grow overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-50 dark:bg-slate-900/50">
                        {messages.length === 0 && (
                            <div className="py-10 text-center space-y-4">
                                <div className="mx-auto w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-3xl flex items-center justify-center text-blue-400">
                                    <Sparkles size={32} className="opacity-40" />
                                </div>
                                <div className="space-y-1">
                                    <p className="font-black text-slate-900 dark:text-white uppercase text-sm tracking-widest px-4">¿En qué puedo ayudarte hoy?</p>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Especialista en Normativa ACT y Control de Proyectos</p>
                                </div>
                                <div className="grid grid-cols-1 gap-2 pt-4 px-6">
                                    {["¿Qué es un reporte MOS?", "¿Cómo crear una CHO?", "Resumen del proyecto"].map(q => (
                                        <button 
                                            key={q}
                                            onClick={() => setInput(q)}
                                            className="text-[10px] p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800 font-bold text-slate-600 dark:text-slate-400 transition-colors"
                                        >
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {messages.map((m, i) => (
                            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`flex gap-3 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                    <div className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center ${m.role === 'user' ? 'bg-slate-100 dark:bg-slate-800 shadow-sm' : 'bg-blue-100 dark:bg-blue-900/30'}`}>
                                        {m.role === 'user' ? <User size={14} className="text-slate-500" /> : <Bot size={14} className="text-blue-500" />}
                                    </div>
                                    <div className={`p-4 rounded-3xl text-[11px] leading-relaxed font-medium ${m.role === 'user' ? 'bg-slate-900 text-white rounded-tr-sm' : 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-800 dark:text-slate-200 shadow-sm rounded-tl-sm'}`}>
                                        {renderMessage(m.content)}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="flex gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                        <Loader2 size={14} className="text-blue-500 animate-spin" />
                                    </div>
                                    <div className="p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-3xl rounded-tl-sm flex gap-1 items-center h-10">
                                        <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" />
                                        <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                        <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input Area */}
                    <div className="p-5 bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-900 lg:rounded-b-[2rem]">
                        <div className="relative group">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                placeholder="Escribe tu consulta..."
                                className="w-full bg-slate-100 dark:bg-slate-900 border-none rounded-2xl py-4 pl-5 pr-14 text-xs focus:ring-2 focus:ring-blue-500 transition-all font-bold placeholder:font-black placeholder:uppercase placeholder:text-[9px] placeholder:tracking-widest"
                            />
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() || loading}
                                className="absolute right-2 top-2 w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 transition-all shadow-lg shadow-blue-500/20"
                            >
                                <Send size={16} />
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default function AIChat() {
    return (
        <Suspense fallback={null}>
            <AIChatContent />
        </Suspense>
    );
}
