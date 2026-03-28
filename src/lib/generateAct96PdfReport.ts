import { generateInspectionReport } from './generateInspectionReport';
import { downloadBlob } from './reportLogic';
import { supabase } from './supabase';
import { formatDate as utilsFormatDate } from './utils';

export const generateAct96PdfReport = async (projectId: string, logId: string) => {
    try {
        const { data: log } = await supabase.from('daily_logs').select('*').eq('id', logId).single();
        if (!log) throw new Error('Log de inspección no encontrado');

        const blob = await generateInspectionReport(projectId, logId);
        downloadBlob(blob, `ACT-96_Informe_Inspeccion_${utilsFormatDate(log.log_date)}.pdf`);
    } catch (err: any) {
        console.error("Error generating ACT 96 PDF:", err);
        throw err;
    }
}
