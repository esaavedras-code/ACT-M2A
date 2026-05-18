import * as XLSX from 'xlsx';
import { supabase } from './supabase';
import { formatDate, roundedAmt } from './utils';
import { MOBILIZATION_TEMPLATE_BASE64 } from './mobilizationTemplate';

/**
 * Decodifica una cadena Base64 a Uint8Array de forma segura en navegador y Node.js.
 */
function base64ToUint8Array(base64: string): Uint8Array {
    const raw = typeof window !== 'undefined' ? window.atob(base64) : Buffer.from(base64, 'base64').toString('binary');
    const uint8Array = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
        uint8Array[i] = raw.charCodeAt(i);
    }
    return uint8Array;
}

export async function generateMobilizationReport(projectId: string): Promise<Blob> {
    // 1. Obtener datos del proyecto
    const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single();
    const { data: items } = await supabase.from('contract_items').select('*').eq('project_id', projectId);
    const { data: certs } = await supabase.from('payment_certifications').select('*').eq('project_id', projectId).order('cert_num', { ascending: true });

    if (!project) throw new Error("Proyecto no encontrado");

    // 2. Identificar partida de movilización (Item 001 o descripción)
    const mobItem = items?.find(i => i.item_num === '001' || i.item_num === '1' || i.description.toUpperCase().includes('MOBILIZACION') || i.description.toUpperCase().includes('MOVILIZACION'));
    if (!mobItem) throw new Error("No se encontró la partida de Mobilización (Item 001) en este proyecto.");

    const mobCost = (parseFloat(mobItem.quantity) * parseFloat(mobItem.unit_price)) || 0;
    const originalContractCost = project.cost_original || items?.reduce((acc, it) => acc + (parseFloat(it.quantity) * parseFloat(it.unit_price) || 0), 0) || 0;
    const contractExclMob = originalContractCost - mobCost;

    // 3. Cargar Plantilla desde Base64
    const templateBytes = base64ToUint8Array(MOBILIZATION_TEMPLATE_BASE64);
    const workbook = XLSX.read(templateBytes, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];

    // Funciones auxiliares para escribir en celdas
    const setVal = (cell: string, val: any) => {
        if (!worksheet[cell]) worksheet[cell] = { t: 's', v: '' };
        if (typeof val === 'number') {
            worksheet[cell].t = 'n';
            worksheet[cell].v = val;
            worksheet[cell].z = '"$"#,##0.00';
        } else {
            worksheet[cell].t = 's';
            worksheet[cell].v = val;
        }
    };

    // 4. Llenar Encabezado General
    setVal('A5', `Proyecto: ${project.num_act || ''} ${project.name || ''}`);
    setVal('H11', originalContractCost);
    setVal('H12', contractExclMob);
    setVal('H13', mobCost);

    // 5. Analizar Certificaciones para hitos
    let earnedExclMob = 0;
    let milestoneA: any = null; // 2.5%
    let milestoneB: any = null; // 5%
    let milestoneC: any = null; // 10%
    let milestoneD: any = null; // Final

    for (const cert of (certs || [])) {
        const certItems = Array.isArray(cert.items) ? cert.items : (cert.items?.list || []);
        let certEarnedExclMob = 0;
        
        certItems.forEach((it: any) => {
            if (it.item_num !== mobItem.item_num) {
                certEarnedExclMob += (parseFloat(it.quantity) * parseFloat(it.unit_price) || 0);
            }
        });

        earnedExclMob = roundedAmt(earnedExclMob + certEarnedExclMob, 2);

        // Los hitos se basan en haber ganado el respectivo % del monto original del contrato a través de otros renglones
        if (!milestoneA && earnedExclMob >= roundedAmt(originalContractCost * 0.025, 2)) {
            milestoneA = { cert, earned: earnedExclMob };
        }
        if (!milestoneB && earnedExclMob >= roundedAmt(originalContractCost * 0.05, 2)) {
            milestoneB = { cert, earned: earnedExclMob };
        }
        if (!milestoneC && earnedExclMob >= roundedAmt(originalContractCost * 0.10, 2)) {
            milestoneC = { cert, earned: earnedExclMob };
        }
        
        if (cert.is_final) {
            milestoneD = { cert, earned: earnedExclMob };
        }
    }

    // 6. Llenar Hitos en el Excel
    
    // Pago 1 (2.5% de A / 25% de C)
    let toPayA = 0;
    if (milestoneA) {
        setVal('C16', milestoneA.cert.cert_num);
        setVal('H16', formatDate(milestoneA.cert.cert_date));
        setVal('H18', roundedAmt(contractExclMob * 0.025, 2));
        setVal('H20', milestoneA.earned);
        setVal('H24', roundedAmt(mobCost * 0.25, 2)); // 25% de movilización
        setVal('H26', roundedAmt(originalContractCost * 0.025, 2)); // 2.5% del monto original
        toPayA = Math.min(roundedAmt(mobCost * 0.25, 2), roundedAmt(originalContractCost * 0.025, 2));
        setVal('H28', toPayA);
        setVal('H30', 0.25);
    } else {
        // Limpiar valores de ejemplo del template si no se ha alcanzado
        setVal('C16', '');
        setVal('H16', '');
        setVal('H18', '');
        setVal('H20', '');
        setVal('H24', '');
        setVal('H26', '');
        setVal('H28', '');
        setVal('H30', '');
    }

    // Pago 2 (5% de A / 50% de C)
    let toPayB = 0;
    if (milestoneB) {
        setVal('C33', milestoneB.cert.cert_num);
        setVal('H33', formatDate(milestoneB.cert.cert_date));
        setVal('H35', roundedAmt(contractExclMob * 0.05, 2));
        setVal('H37', milestoneB.earned);
        
        setVal('A41', '    (c)     50% de C'); 
        const valC = roundedAmt(mobCost * 0.50, 2);
        setVal('H41', valC);
        
        const valD = roundedAmt(originalContractCost * 0.05, 2);
        setVal('H43', valD);
        
        const totalToDate = Math.min(valC, valD);
        setVal('H45', totalToDate);
        
        const paidPrev = milestoneA ? toPayA : 0;
        setVal('H47', paidPrev);
        toPayB = totalToDate - paidPrev;
        setVal('H49', toPayB);
        setVal('H51', 0.50);
    } else {
        // Limpiar valores de ejemplo del template
        setVal('C33', '');
        setVal('H33', '');
        setVal('H35', '');
        setVal('H37', '');
        setVal('A41', '    (c)     50% de C');
        setVal('H41', '');
        setVal('H43', '');
        setVal('H45', '');
        setVal('H47', '');
        setVal('H49', '');
        setVal('H51', '');
    }

    // Pago 3 (10% de A / 100% de C)
    let toPayC = 0;
    if (milestoneC) {
        setVal('C54', milestoneC.cert.cert_num);
        setVal('H54', formatDate(milestoneC.cert.cert_date));
        setVal('H56', roundedAmt(contractExclMob * 0.10, 2));
        setVal('H58', milestoneC.earned);
        
        setVal('A60', '    (c)     100% de C');
        setVal('H60', mobCost);
        
        const valD = roundedAmt(originalContractCost * 0.10, 2);
        setVal('H62', valD);
        
        const totalToDate = Math.min(mobCost, valD);
        setVal('H64', totalToDate);
        
        const paidPrev = (milestoneB ? Math.min(roundedAmt(mobCost * 0.50, 2), roundedAmt(originalContractCost * 0.05, 2)) : 
                         (milestoneA ? toPayA : 0));
        setVal('H66', paidPrev);
        toPayC = totalToDate - paidPrev;
        setVal('H68', toPayC);
        setVal('H70', 1.00);
    } else {
        // Limpiar valores de ejemplo del template
        setVal('C54', '');
        setVal('H54', '');
        setVal('H56', '');
        setVal('H58', '');
        setVal('A60', '    (c)     100% de C');
        setVal('H60', '');
        setVal('H62', '');
        setVal('H64', '');
        setVal('H66', '');
        setVal('H68', '');
        setVal('H70', '');
    }

    // Pago 4 (Aceptación Final)
    if (milestoneD) {
        setVal('H73', formatDate(milestoneD.cert.cert_date));
        setVal('H75', mobCost);
        
        const totalPaidBefore = (milestoneC ? Math.min(mobCost, roundedAmt(originalContractCost * 0.10, 2)) :
                                (milestoneB ? Math.min(roundedAmt(mobCost * 0.50, 2), roundedAmt(originalContractCost * 0.05, 2)) :
                                (milestoneA ? toPayA : 0)));
        
        setVal('H77', totalPaidBefore);
        setVal('H79', mobCost - totalPaidBefore);
        setVal('H81', 1.00);
    } else {
        // Limpiar valores de ejemplo del template
        setVal('H73', '');
        setVal('H75', '');
        setVal('H77', '');
        setVal('H79', '');
        setVal('H81', '');
    }

    // 7. Generar Salida
    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
