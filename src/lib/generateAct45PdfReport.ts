import { generateDailyLogReport } from './generateDailyLogReport';
import { downloadBlob } from './reportLogic';
import { supabase } from './supabase';
import { formatDate as utilsFormatDate } from './utils';

export const generateAct45PdfReport = async (projectId: string, logId: string) => {
    try {
        const { data: log } = await supabase.from('daily_logs').select('*').eq('id', logId).single();
        if (!log) throw new Error('Log no encontrado');

        const blob = await generateDailyLogReport(projectId, logId);
        downloadBlob(blob, `ACT-45_Informe_Diario_${utilsFormatDate(log.log_date)}.pdf`);
    } catch (err: any) {
        console.error("Error generating ACT 45 PDF:", err);
        throw err;
    }
}
