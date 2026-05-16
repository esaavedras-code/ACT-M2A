import ExcelJS from 'exceljs';
import { formatDate, getFederalSharePct, sortItemsNaturally, uniqueSortItems } from '@/lib/utils';
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
        const allItems = uniqueSortItems([...allItemsRaw]);
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
            
            let newFont = cell.font ? { ...cell.font } : {};
            if (options.fontSize) {
                newFont.size = options.fontSize;
            } else if (options.shrink && typeof val === 'string' && val.length > 25) {
                newFont.size = val.length > 45 ? 6 : 8;
            }
            
            if (typeof val === 'number' && val < 0) {
                newFont.color = { argb: 'FFFF0000' };
            }

            if (options.bold) {
                newFont.bold = true;
            }

            cell.font = newFont;
            
            let newAlignment = cell.alignment ? { ...cell.alignment } : {};
            if (options.center) {
                newAlignment.vertical = 'middle';
                newAlignment.horizontal = 'center';
                newAlignment.wrapText = true;
            } else if (options.shrink) {
                newAlignment.wrapText = true;
                newAlignment.vertical = 'middle';
            }
            if(Object.keys(newAlignment).length > 0) cell.alignment = newAlignment;

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
                    // Copia profunda del estilo para asegurar que se traslada sin referencias mutables
                    newCell.style = JSON.parse(JSON.stringify(cell.style));
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
            if (pageIndex === 0) {
                setVal(ws, 'B21', choData.description || '', { shrink: true });
            } else {
                setVal(ws, 'B21', '');
            }

            // 5. ÍTEMS
            const cStart = pageIndex * 5;
            const eStart = pageIndex * 3;
            
            // Items de Contrato (Filas 32-36)
            let row = 32;
            const pageContractItems = contractChoItems.slice(cStart, cStart + 5);
            for (let i = 0; i < 5; i++) {
                const it = pageContractItems[i];
                const currentRow = 32 + i;
                if (it) {
                    const qty = parseFloat(it.proposed_change || it.quantity) || 0;
                    const up = parseFloat(it.unit_price) || 0;
                    setVal(ws, `B${currentRow}`, it.item_num);
                    setVal(ws, `G${currentRow}`, it.specification);
                    setVal(ws, `H${currentRow}`, it.description, { shrink: true });
                    setVal(ws, `AJ${currentRow}`, it.unit);
                    setVal(ws, `AN${currentRow}`, qty);
                    setVal(ws, `AT${currentRow}`, up);
                    setVal(ws, `AZ${currentRow}`, qty * up);
                    setVal(ws, `BF${currentRow}`, (getFederalSharePct(projData, it) / 100));
                    setVal(ws, `E${currentRow}`, 'X', { center: true });
                } else {
                    // Limpiar fila si no hay item (evita repetición de página 1)
                    ['B','G','H','AJ','AN','AT','AZ','BF','E'].forEach(col => setVal(ws, `${col}${currentRow}`, null));
                }
            }

            // Items Extra (Filas 39-41)
            const pageExtraItems = extraWorkItems.slice(eStart, eStart + 3);
            for (let i = 0; i < 3; i++) {
                const it = pageExtraItems[i];
                const currentRow = 39 + i;
                if (it) {
                    const qty = parseFloat(it.proposed_change || it.quantity) || 0;
                    const up = parseFloat(it.unit_price) || 0;
                    setVal(ws, `B${currentRow}`, it.item_num);
                    setVal(ws, `G${currentRow}`, it.specification);
                    setVal(ws, `H${currentRow}`, it.description, { shrink: true });
                    setVal(ws, `AJ${currentRow}`, it.unit);
                    setVal(ws, `AN${currentRow}`, qty);
                    setVal(ws, `AT${currentRow}`, up);
                    setVal(ws, `AZ${currentRow}`, qty * up);
                    setVal(ws, `BF${currentRow}`, (getFederalSharePct(projData, it) / 100));
                    setVal(ws, `V${currentRow}`, 'X', { center: true });
                } else {
                    // Limpiar fila si no hay item (evita repetición de página 1)
                    ['B','G','H','AJ','AN','AT','AZ','BF','V'].forEach(col => setVal(ws, `${col}${currentRow}`, null));
                }
            }

            // 6. RESUMEN FINANCIERO
            // #26: Subtotales por página — suma solo de los ítems de ESTA página
            let pageContractSubtotal = 0;
            pageContractItems.forEach((it: any) => {
                const qty = parseFloat(it.proposed_change || it.quantity) || 0;
                const up = parseFloat(it.unit_price) || 0;
                pageContractSubtotal += qty * up;
            });
            let pageExtraSubtotal = 0;
            pageExtraItems.forEach((it: any) => {
                const qty = parseFloat(it.proposed_change || it.quantity) || 0;
                const up = parseFloat(it.unit_price) || 0;
                pageExtraSubtotal += qty * up;
            });

            setVal(ws, 'AZ37', pageContractSubtotal || 0);
            setVal(ws, 'AZ42', pageExtraSubtotal || 0);

            // #28, #29, #30: Totales finales del DOCUMENTO — en TODAS las páginas
            let grandTotalContract = 0;
            contractChoItems.forEach((it: any) => grandTotalContract += (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0));
            let grandTotalExtra = 0;
            extraWorkItems.forEach((it: any) => grandTotalExtra += (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0));

            setVal(ws, 'BA44', (grandTotalContract + grandTotalExtra) || 0);
            setVal(ws, 'BA45', actualContractAmount || 0);
            setVal(ws, 'BA46', newContractAmount || 0);

            // 7. FIRMAS (En todas las páginas para consistencia)
            setVal(ws, 'M44', personnelMap["Administrador del Proyecto"] || projData.resident_engineer_name || '', { shrink: true });
            setVal(ws, 'M46', contrData?.representative || contrData?.name || projData.contractor_name || '', { shrink: true });
            setVal(ws, 'M48', personnelMap["Supervisor de Área"] || projData.project_manager_name || '', { shrink: true });
            setVal(ws, 'M50', personnelMap["Director Regional"] || '', { shrink: true });
            setVal(ws, 'M52', 'Ing. Edwin González Montalvo', { shrink: true }); 
            setVal(ws, 'BA50', personnelMap["Director Oficina Construccion"] || '');
            setVal(ws, 'BA52', 'N/A');

            // 8. PÁGINA 2 (BACK)
            setVal(ws, 'K59', projData.name || '', { shrink: true });
            setVal(ws, 'K60', projData.num_act || '');
            
            // Campo AZ60: info de J13 (Amendment) y J14 (CHO Num)
            setVal(ws, 'AZ60', `${choData.cho_num}${choData.amendment_letter ? ` (Amdt. ${choData.amendment_letter})` : ''}`, { center: true });

            
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
            // Corrección: asegurar que la página trasera tiene el número de página oficial si aplica
            // Si hay un espacio designado, por ejemplo, lo pondríamos ahí, pero usaremos Z1.
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



