export const TodayButton = ({ onSelect }: { onSelect: (date: string) => void }) => (
    <button 
        type="button" 
        onClick={() => onSelect(new Date().toISOString().split('T')[0])}
        className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-white/50 hover:bg-white text-[10px] font-bold text-primary rounded border border-primary/20 transition-all z-10"
    >
        HOY
    </button>
);
