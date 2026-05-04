import ExcelJS from 'exceljs';
import { formatDate, getFederalSharePct, sortItemsNaturally } from '@/lib/utils';
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
        
        const { data: personnel } = await supabase.from('act_personnel').select('*').eq('project_id', projectId);
        const personnelMap: Record<string, string> = {};
        personnel?.forEach(p => { personnelMap[p.role] = p.name; });

        if (!choId || !choData) throw new Error("CHO no encontrado");

        // Usar la plantilla nueva copiada (Rev 12-2024)
        const response = await fetch('/ACT-122B_Template.xlsx');
        if (!response.ok) throw new Error(`Plantilla ACT-122B no encontrada`);
        const templateBuf = await response.arrayBuffer();

        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(templateBuf);
        const templateWs = wb.getWorksheet('ACT-122');
        if (!templateWs) throw new Error('No se encontró la hoja "ACT-122" en la plantilla');

        // --- CÁLCULOS ---
        let prevExtDays = 0;
        let prevCostMods = 0;
        const currentChoNum = parseFloat(choData.cho_num);
        if (allChos) {
            for (const c of allChos) {
                const loopNum = parseFloat(c.cho_num);
                if (loopNum < currentChoNum) {
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
            adminEnd = new Date(adminEnd.getTime() + 730 * 86400000); 
        }

        const allItemsRaw = Array.isArray(choData.items) ? choData.items : [];
        const allItems = sortItemsNaturally([...allItemsRaw]);
        const contractChoItems = allItems.filter((it: any) => !it.is_new);
        const extraWorkItems = allItems.filter((it: any) => it.is_new);

        // Determinamos cuántas páginas necesitamos. 
        // Cada página tiene espacio para 5 ítems de contrato y 3 ítems extra.
        const totalPages = Math.max(
            Math.ceil(contractChoItems.length / 5), 
            Math.ceil(extraWorkItems.length / 3), 
            1
        );

        // --- FUNCIONES DE AYUDA ---
        const setVal = (ws: ExcelJS.Worksheet, addr: string, val: any, options: { bold?: boolean, center?: boolean, shrink?: boolean, fontSize?: number } = {}) => {
            const cell = ws.getCell(addr);
            cell.value = val;
            
            if (options.fontSize) {
                cell.font = { ...cell.font, size: options.fontSize };
            } else if (options.shrink && typeof val === 'string' && val.length > 25) {
                cell.font = { ...cell.font, size: val.length > 45 ? 6 : 8 };
            }
            
            if (options.center) {
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            }
            return cell;
        };

        // Función para clonar el formato de la hoja maestra de forma segura
        const cloneSheetFormat = (source: ExcelJS.Worksheet, target: ExcelJS.Worksheet) => {
            // Copiar dimensiones de columnas
            source.columns.forEach((col, i) => {
                if (col.width) target.getColumn(i + 1).width = col.width;
            });

            // Copiar filas y estilos
            source.eachRow({ includeEmpty: true }, (row, rowNum) => {
                const newRow = target.getRow(rowNum);
                newRow.height = row.height;
                row.eachCell({ includeEmpty: true }, (cell, colNum) => {
                    const newCell = newRow.getCell(colNum);
                    newCell.style = cell.style;
                    newCell.value = cell.value;
                });
            });

            // Copiar celdas combinadas usando el modelo oficial
            const sourceModel = (source as any).model;
            if (sourceModel && sourceModel.merges) {
                sourceModel.merges.forEach((mergeRange: string) => {
                    try { target.mergeCells(mergeRange); } catch(e) {}
                });
            }
        };

        const fillPage = (ws: ExcelJS.Worksheet, pageIndex: number, isLast: boolean) => {
            try { ws.unprotect(); } catch(e) {}

            // 1. Identificación y Proyecto
            setVal(ws, 'J7', projData.name || '', { shrink: true });
            setVal(ws, 'J8', contrData?.name || projData.contractor_name || '', { shrink: true });
            setVal(ws, 'J9', projData.num_act || '');
            setVal(ws, 'J10', projData.num_federal || 'N/A');
            setVal(ws, 'J11', projData.num_oracle || '');
            setVal(ws, 'J12', projData.num_contrato || '');
            setVal(ws, 'J13', choData.amendment_letter || '0');
            setVal(ws, 'J14', choData.cho_num || '');

            // Descripción del proyecto (bajo el nombre)
            setVal(ws, 'B16', projData.description || '', { shrink: true });

            // 2. Tiempo
            const safeDate = (d: any) => (d instanceof Date && !isNaN(d.getTime())) ? d : null;

            setVal(ws, 'BA7', safeDate(projData.date_project_start ? new Date(projData.date_project_start + "T00:00:00") : null));
            setVal(ws, 'BA8', safeDate(dateRevisedBox10));
            setVal(ws, 'BA9', timeExt || 0);
            setVal(ws, 'BA10', 0);
            setVal(ws, 'BA11', safeDate(dateNewBox12));
            setVal(ws, 'BA12', safeDate(adminEnd));
            setVal(ws, 'BA13', safeDate(projData.fmis_end_date ? new Date(projData.fmis_end_date + "T00:00:00") : null));

            // 3. Checkboxes de Tipo (Sección 15)
            if (contractChoItems.length > 0) setVal(ws, 'B18', 'X', { center: true });
            if (extraWorkItems.length > 0) setVal(ws, 'V18', 'X', { center: true });
            if (timeExt > 0) setVal(ws, 'AN18', 'X', { center: true });

            // 4. Descripción / Scope del CHO
            setVal(ws, 'B21', choData.description || '', { shrink: true });

            // 5. ÍTEMS
            const cStart = pageIndex * 5;
            const eStart = pageIndex * 3;
            
            // Items de Contrato (Filas 32-36)
            let row = 32;
            contractChoItems.slice(cStart, cStart + 5).forEach((it: any) => {
                const qty = parseFloat(it.quantity) || 0;
                const up = parseFloat(it.unit_price) || 0;
                setVal(ws, `B${row}`, it.item_num);
                setVal(ws, `G${row}`, it.specification);
                setVal(ws, `H${row}`, it.description, { shrink: true });
                setVal(ws, `AJ${row}`, it.unit);
                setVal(ws, `AN${row}`, qty);
                setVal(ws, `AT${row}`, up);
                setVal(ws, `AZ${row}`, qty * up);
                setVal(ws, `BF${row}`, (getFederalSharePct(projData, it) / 100));
                setVal(ws, `E${row}`, 'X', { center: true }); // Marcamos como item de contrato
                row++;
            });

            // Items Extra (Filas 39-41)
            row = 39;
            extraWorkItems.slice(eStart, eStart + 3).forEach((it: any) => {
                const qty = parseFloat(it.quantity) || 0;
                const up = parseFloat(it.unit_price) || 0;
                setVal(ws, `B${row}`, it.item_num);
                setVal(ws, `G${row}`, it.specification);
                setVal(ws, `H${row}`, it.description, { shrink: true });
                setVal(ws, `AJ${row}`, it.unit);
                setVal(ws, `AN${row}`, qty);
                setVal(ws, `AT${row}`, up);
                setVal(ws, `AZ${row}`, qty * up);
                setVal(ws, `BF${row}`, (getFederalSharePct(projData, it) / 100));
                setVal(ws, `V${row}`, 'X', { center: true }); // Marcamos como ítem nuevo
                row++;
            });

            // 6. RESUMEN FINANCIERO (Solo en la última página)
            if (isLast) {
                let totalContract = 0;
                contractChoItems.forEach((it: any) => totalContract += (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0));
                let totalExtra = 0;
                extraWorkItems.forEach((it: any) => totalExtra += (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0));

                setVal(ws, 'AZ37', totalContract || 0);
                setVal(ws, 'AZ42', totalExtra || 0);
                setVal(ws, 'BA44', (totalContract + totalExtra) || 0);
                setVal(ws, 'BA45', actualContractAmount || 0);
                setVal(ws, 'BA46', newContractAmount || 0);
            } else {
                // Dejar nulos si no es la última (Excel prefiere null a '' en celdas de número)
                setVal(ws, 'AZ37', null);
                setVal(ws, 'AZ42', null);
                setVal(ws, 'BA44', null);
                setVal(ws, 'BA45', null);
                setVal(ws, 'BA46', null);
            }

            // 7. FIRMAS (En todas las páginas para consistencia)
            setVal(ws, 'M44', personnelMap["Administrador del Proyecto"] || projData.resident_engineer_name || '', { shrink: true });
            setVal(ws, 'M46', contrData?.representative || contrData?.name || projData.contractor_name || '', { shrink: true });
            setVal(ws, 'M48', personnelMap["Supervisor de Área"] || projData.project_manager_name || '', { shrink: true });
            setVal(ws, 'M50', personnelMap["Director Regional"] || '', { shrink: true });
            setVal(ws, 'M52', 'Ing. Edwin González Montalvo, P.E.', { shrink: true }); 
            setVal(ws, 'BA50', personnelMap["Director Oficina Construccion"] || '');
            setVal(ws, 'BA52', 'N/A');

            // 8. PÁGINA 2 (BACK)
            setVal(ws, 'J61', projData.name || '', { shrink: true });
            setVal(ws, 'J63', projData.num_act || '');
            // Campo 8: CHO Number con enmienda
            setVal(ws, 'BA63', `${choData.cho_num}${choData.amendment_letter ? ` (Amdt. ${choData.amendment_letter})` : ''}`, { center: true });
            
            const reason = (choData.reason || '');
            if (reason === 'Design') setVal(ws, 'I69', 'X', { center: true });
            if (reason === 'Construction') setVal(ws, 'O69', 'X', { center: true });
            if (reason === 'Contract') setVal(ws, 'U69', 'X', { center: true });
            if (reason === 'Utilities') setVal(ws, 'AA69', 'X', { center: true });
            if (reason === 'Other') setVal(ws, 'AG69', 'X', { center: true });

            // Justificación con letra el doble de grande (aprox 16-18pt)
            setVal(ws, 'C76', choData.justification || '', { fontSize: 16 });

            // Numeración de página
            setVal(ws, 'Z1', `Page ${pageIndex + 1} of ${totalPages}`, { bold: true, center: true });
        };

        // Llenar página 1 (ya existe en el workbook como 'ACT-122')
        fillPage(templateWs, 0, totalPages === 1);

        // Crear y llenar páginas adicionales si es necesario
        for (let i = 1; i < totalPages; i++) {
            const newWs = wb.addWorksheet(`Sheet ${i + 1}`);
            cloneSheetFormat(templateWs, newWs);
            fillPage(newWs, i, i === totalPages - 1);
        }

        const buffer = await wb.xlsx.writeBuffer();
        return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    } catch (err: any) {
        console.error("ACT-122B Export error:", err);
        throw err;
    }
}



