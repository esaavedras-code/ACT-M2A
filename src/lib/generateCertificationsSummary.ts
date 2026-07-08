import ExcelJS from 'exceljs';
import { supabase } from './supabase';
import { formatDate } from './utils';

export async function generateCertificationsSummaryExcel(projectId: string): Promise<Blob> {
    const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single();
    if (!project) throw new Error('Project not found');

    const { data: certs } = await supabase
        .from('payment_certifications')
        .select('*')
        .eq('project_id', projectId)
        .order('cert_num', { ascending: true });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Resumen de Certificaciones');

    // Headers
    sheet.columns = [
        { header: 'Cert #', key: 'cert_num', width: 10 },
        { header: 'Proyecto', key: 'project', width: 25 },
        { header: 'Contratista', key: 'contractor', width: 30 },
        { header: 'Fecha', key: 'date', width: 15 },
        { header: 'Monto Certificado', key: 'amount', width: 20 },
        { header: 'Retención y Otros', key: 'retention', width: 20 },
        { header: 'Monto Pagado', key: 'paid', width: 20 },
        { header: 'Estado', key: 'status', width: 15 },
        { header: 'Ya se pagó', key: 'is_paid', width: 15 },
        { header: 'Excluido', key: 'excluded', width: 15 }
    ];

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { horizontal: 'center' };

    let totalAmount = 0;
    let totalRetention = 0;
    let totalPaid = 0;

    (certs || []).forEach(cert => {
        const certItems = Array.isArray(cert.items) ? cert.items : (cert.items?.list || []);
        let certAmount = 0;
        certItems.forEach((it: any) => {
            certAmount += (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0);
        });
        
        let retention = 0;
        if (!cert.skip_retention) {
            certItems.forEach((it: any) => {
                if (it.skip_retention !== true && it.skip_retention !== 'true') {
                    retention += ((parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0)) * 0.05;
                }
            });
        }
        
        const extraRet = parseFloat(String(cert.extra_retention || '0').replace(/,/g, '')) || 0;
        const insFines = parseFloat(cert.insurance_fines || '0') || 0;
        const penalties = parseFloat(cert.other_penalties || '0') || 0;
        const dlq = parseFloat(String(cert.liquidated_damages || '0').replace(/,/g, '')) || 0;
        const priceAdj = parseFloat(cert.price_adjustment || '0') || 0;
        const refund = parseFloat(String(cert.refund || '0').replace(/,/g, '')) || 0;
        
        let retReturn = 0;
        if (cert.show_retention_return) {
            retReturn = parseFloat(cert.retention_return_amount || '0') || 0;
        }

        const totalRetAndPen = retention + extraRet + insFines + penalties + dlq - priceAdj - refund - retReturn;
        const netPaid = certAmount - totalRetAndPen;

        if (!cert.excluded) {
            totalAmount += certAmount;
            totalRetention += totalRetAndPen;
            totalPaid += netPaid;
        }

        sheet.addRow({
            cert_num: cert.cert_num,
            project: project.name || project.num_act,
            contractor: project.contractor_name,
            date: formatDate(cert.cert_date),
            amount: certAmount,
            retention: totalRetAndPen,
            paid: netPaid,
            status: cert.excluded ? 'Excluido' : 'Vigente',
            is_paid: cert.is_paid ? 'Sí' : 'No',
            excluded: cert.excluded ? 'Sí' : 'No'
        });
    });

    // Formatear montos
    sheet.getColumn('amount').numFmt = '"$"#,##0.00';
    sheet.getColumn('retention').numFmt = '"$"#,##0.00';
    sheet.getColumn('paid').numFmt = '"$"#,##0.00';

    // Fila de totales
    const totalRow = sheet.addRow({
        date: 'TOTALES',
        amount: totalAmount,
        retention: totalRetention,
        paid: totalPaid,
    });
    totalRow.font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
