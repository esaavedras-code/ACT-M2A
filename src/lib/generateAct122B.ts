import ExcelJS from 'exceljs';
import { formatDate, getFederalSharePct } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

/**
 * Genera el reporte ACT-122B utilizando las instrucciones MAESTRAS de Enrique Saavedra Sada, PE.
 * Mapeo de celdas según la tabla oficial Rev 12/2024 proporcionada por el usuario.
 */
export async function generateAct122B(
    projectId: string,
    choId: string
): Promise<Blob> {
    try {
        const { data: projData } = await supabase.from('projects').select('*').eq('id', projectId).single();
        if (!projData) throw new Error("Proyecto no encontrado");
        const { data: contrData } = await supabase.from('contractors').select('*').eq('project_id', projectId).single();
        const { data: choData } = await supabase.from('chos').select('*').eq('id', choId).single();
        const { data: allChos } = await supabase.from('chos').select('cho_num, time_extension_days, proposed_change').eq('project_id', projectId).order('cho_num', { ascending: true });
        
        if (!choId || !choData) throw new Error("CHO no encontrado");

        const response = await fetch('/ACT-122B_Template.xlsx');
        if (!response.ok) throw new Error(`Plantilla ACT-122B no encontrada`);
        const templateBuf = await response.arrayBuffer();

        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(templateBuf);
        const ws = wb.getWorksheet('ACT-122');
        if (!ws) throw new Error('No se encontró la hoja "ACT-122"');

        // Desproteger para permitir escritura limpia
        try { ws.unprotect(); } catch(e) {}

        // Cálculos de Tiempo y Montos Acumulados
        let prevExtDays = 0;
        let prevCostMods = 0;
        if (allChos) {
            for (const c of allChos) {
                const currentNum = parseFloat(choData.cho_num);
                const loopNum = parseFloat(c.cho_num);
                if (loopNum < currentNum) {
                    prevExtDays += (parseInt(c.time_extension_days) || 0);
                    prevCostMods += (parseFloat(c.proposed_change) || 0);
                }
            }
        }

        const originalCost = parseFloat(projData.cost_original) || 0;
        const actualContractAmount = originalCost + prevCostMods;
        const currentChoAmount = parseFloat(choData.proposed_change) || 0;
        const newContractAmount = actualContractAmount + currentChoAmount;

        const origEnd = projData.date_orig_completion ? new Date(projData.date_orig_completion + "T00:00:00") : null;
        const dateRevisedBox10 = origEnd ? new Date(origEnd.getTime() + prevExtDays * 86400000) : null;
        const timeExt = parseInt(choData.time_extension_days) || 0;
        const dateNewBox12 = dateRevisedBox10 ? new Date(dateRevisedBox10.getTime() + timeExt * 86400000) : null;
        
        const adminDate = projData.date_rev_completion ? new Date(projData.date_rev_completion + "T00:00:00") : dateNewBox12;
        let adminEnd = adminDate ? new Date(adminDate) : null;
        if (adminEnd) {
            adminEnd = new Date(adminEnd.getTime() + 730 * 86400000); // Instrucción 13: +730 días
        }

        // Helper para inyectar valores preservando estilos
        const setVal = (addr: string, val: any) => {
            const cell = ws.getCell(addr);
            cell.protection = { locked: false, hidden: false };
            cell.value = val;
            return cell;
        };

        // --- APLICANDO INSTRUCCIONES DE ENRIQUE (MAPEO FINAL) ---

        // 1-8 Bloque Identificación (Columna J)
        setVal('J7', projData.name || '');                              // 1. Nombre del proyecto
        setVal('J8', contrData?.name || projData.contractor_name || ''); // 2. Contratista
        setVal('J9', projData.num_act || '');                           // 3. Número de proyecto
        setVal('J10', projData.num_federal || 'N/A');                   // 4. Número federal
        setVal('J11', projData.num_oracle || '');                        // 5. Número Oracle
        setVal('J12', projData.num_contrato || '');                     // 6. Número contrato
        setVal('J13', choData.amendment_letter || '0');                 // 7. Letra enmienda
        setVal('J14', choData.cho_num || '');                           // 8. Número correlativo CHO

        // 9-14 Bloque Tiempo (Columna BA)
        setVal('BA7', projData.date_project_start ? new Date(projData.date_project_start + "T00:00:00") : null); // 9. NTP
        setVal('BA8', dateRevisedBox10);                                // 10. Term. contractual revisada
        setVal('BA9', timeExt);                                         // 11. Extensión de tiempo
        setVal('BA10', 0);                                              // 11.a Compensables
        setVal('BA11', dateNewBox12);                                   // 12. Automática: Nueva fecha term.
        setVal('BA12', adminEnd);                                       // 13. Automática: Vigencia Contralor
        setVal('BA13', projData.fmis_end_date ? new Date(projData.fmis_end_date + "T00:00:00") : null); // 14. FMIS End Date

        // 15. Checkboxes (Marcar con 'X')
        const type = (choData.type || '').toLowerCase();
        if (type.includes('contract')) setVal('B18', 'X');
        if (type.includes('extra')) setVal('V18', 'X');
        if (type.includes('time')) setVal('AN18', 'X');

        // 16. Descripción / Scope (B21:B26)
        setVal('B21', choData.description || '');

        // --- PARTIDAS / ITEMS (Celdas 32 a 36) ---
        const allItems = Array.isArray(choData.items) ? choData.items : [];
        const { data: contractItemsList } = await supabase.from('contract_items').select('item_num').eq('project_id', projectId);
        const contractItemNums = new Set(contractItemsList?.map(ci => ci.item_num) || []);

        const contractChoItems = allItems.filter((it: any) => contractItemNums.has(it.item_num));
        const extraWorkItems = allItems.filter((it: any) => !contractItemNums.has(it.item_num));

        // Partidas del Contrato (Filas 32-36)
        let row = 32;
        let subtotalContract = 0;
        contractChoItems.slice(0, 5).forEach((it: any) => {
            const amount = (parseFloat(it.proposed_change) || 0) * (parseFloat(it.unit_price) || 0);
            subtotalContract += amount;
            setVal(`B${row}`, it.item_num);             // 17. Número de partida
            setVal(`H${row}`, it.description);          // 19. Descripción
            setVal(`AJ${row}`, it.unit);                // 21. Unidad
            setVal(`AN${row}`, parseFloat(it.proposed_change) || 0); // 22. Cantidad
            setVal(`AT${row}`, parseFloat(it.unit_price) || 0);      // 23. Precio unitario
            setVal(`AZ${row}`, amount);                 // 24. Monto total
            const fedPct = getFederalSharePct(projData, it);
            setVal(`BF${row}`, fedPct / 100);           // 25. % Federal
            row++;
        });

        // Trabajo Extra (Usando el mismo bloque de partidas si aplica, o a continuación)
        // Enrique no especificó un bloque distinto para New Items en el PDF de celdas, 
        // pero usaremos el AZ42 para su subtotal según instrucción 27.
        let subtotalExtra = 0;
        extraWorkItems.forEach((it: any) => {
            subtotalExtra += (parseFloat(it.proposed_change) || 0) * (parseFloat(it.unit_price) || 0);
        });

        // 26-30 Resumen Financiero
        setVal('AZ37', subtotalContract);               // 26. Subtotal partidas contrato
        setVal('AZ42', subtotalExtra);                  // 27. Subtotal nuevas partidas
        setVal('BA44', subtotalContract + subtotalExtra); // 28. Suma total
        setVal('BA45', actualContractAmount);           // 29. Costo original + previos
        setVal('BA46', newContractAmount);              // 30. Monto revisado actual

        // 31-34 Firmas
        setVal('M44', projData.resident_engineer_name || '');   // 31. Residente
        setVal('M46', projData.contractor_name || '');          // 32. Contratista
        setVal('M48', projData.project_manager_name || '');     // 33. PM / Supervisor
        setVal('M52', 'Ing. Ayubi G. Gonzalez Cotto');          // 34. Director Ejecutivo

        // 36. Justificación Detallada (C68:BI107)
        setVal('C68', choData.justification || '');

        const buffer = await wb.xlsx.writeBuffer();
        return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    } catch (err: any) {
        console.error("ACT-122B Export error:", err);
        throw err;
    }
}
