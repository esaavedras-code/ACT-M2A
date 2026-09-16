import { X, CalendarPlus } from "lucide-react";
import { useState, useEffect } from "react";

interface PaymentPlansModalProps {
    isOpen: boolean;
    onClose: () => void;
    paymentDates: string[];
    onSave: (dates: string[]) => void;
    docName?: string;
}

export default function PaymentPlansModal({ isOpen, onClose, paymentDates, onSave, docName }: PaymentPlansModalProps) {
    const [dates, setDates] = useState<string[]>(['', '', '', '', '']);

    useEffect(() => {
        if (isOpen) {
            const newDates = [...(paymentDates || [])];
            while (newDates.length < 5) newDates.push('');
            setDates(newDates.slice(0, 5));
        }
    }, [isOpen, paymentDates]);

    if (!isOpen) return null;

    const handleSave = () => {
        // Filtrar vacíos y ordenar
        const validDates = dates.filter(d => d.trim() !== '');
        validDates.sort();
        onSave(validDates);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 p-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                    <div>
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <CalendarPlus className="text-primary" size={20} />
                            Planes de Pago
                        </h2>
                        <p className="text-xs text-slate-500 mt-1 truncate max-w-xs">{docName || "Fondo del Seguro del Estado"}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto">
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                        Ingrese hasta 5 fechas de los planes de pago. La fecha activa se utilizará como la fecha de vencimiento del documento.
                    </p>
                    <div className="space-y-3">
                        {dates.map((date, idx) => (
                            <div key={idx} className="flex items-center gap-3">
                                <span className="text-xs font-bold text-slate-400 w-4">{idx + 1}.</span>
                                <input
                                    type="date"
                                    className="input-field flex-1"
                                    value={date}
                                    onChange={(e) => {
                                        const newDates = [...dates];
                                        newDates[idx] = e.target.value;
                                        setDates(newDates);
                                    }}
                                />
                                {date && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const newDates = [...dates];
                                            newDates[idx] = '';
                                            setDates(newDates);
                                        }}
                                        className="text-slate-400 hover:text-red-500 p-1"
                                        title="Borrar fecha"
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-2">
                    <button onClick={onClose} className="btn-secondary text-sm px-4 py-2">
                        Cancelar
                    </button>
                    <button onClick={handleSave} className="btn-primary text-sm px-4 py-2">
                        Guardar Fechas
                    </button>
                </div>
            </div>
        </div>
    );
}
