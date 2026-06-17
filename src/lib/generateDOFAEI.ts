import ExcelJS from 'exceljs';
import { supabase } from './supabase';
import { getFederalSharePct, sortItemsNaturally, uniqueSortItems, formatItemNum } from './utils';
import { DOFAEI_TEMPLATE_BASE64 } from './dofaeiTemplate';

export async function generateDOFAEI(projectId: string, choId: string) {
    try {
        const { data: projData } = await supabase.from('projects').select('*').eq('id', projectId).single();
        const { data: choData } = await supabase.from('chos').select('*').eq('id', choId).single();
        
        if (!projData || !choData) throw new Error("Datos insuficientes");

        const dofaei = choData.dofaei_data || {};
        const determinations = dofaei.determination_conditions || {};
        const evaluations = dofaei.evaluations || {};
        const itemsRaw = Array.isArray(choData.items) ? choData.items : [];
        const items = uniqueSortItems([...itemsRaw]);

        const workbook = new ExcelJS.Workbook();
        const bufferTemplate = Buffer.from(DOFAEI_TEMPLATE_BASE64, 'base64');
        await workbook.xlsx.load(bufferTemplate);
        
        const itemsPerPage = 5;
        const totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage));

        // Rellenar la primera hoja (que ya viene con estilos y datos de ejemplo del template)
        const firstSheet = workbook.getWorksheet(1);
        if (firstSheet) {
            firstSheet.name = "Página 1";
            fillSheetConservatively(firstSheet, projData, choData, items, 0, itemsPerPage, determinations, evaluations, dofaei);
        }

        // Si hay más páginas, intentamos crear hojas nuevas
        if (totalPages > 1) {
            for (let p = 1; p < totalPages; p++) {
                const newSheetName = `Página ${p + 1}`;
                // Para mantener la perfección, cargamos el template de nuevo en una hoja nueva si es posible,
                // o simplemente clonamos la primera hoja antes de llenarla.
                const newSheet = workbook.addWorksheet(newSheetName);
                await cloneSheetPerfectly(firstSheet!, newSheet);
                fillSheetConservatively(newSheet, projData, choData, items, p, itemsPerPage, determinations, evaluations, dofaei);
            }
        }

        const outBuffer = await workbook.xlsx.writeBuffer();
        return new Blob([outBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    } catch (err: any) {
        console.error("Error generating DOFAEI Excel:", err);
        throw err;
    }
}

// Función que llena la hoja SIN borrar datos existentes, solo sobreescribiendo donde hay datos nuevos
function fillSheetConservatively(sheet: ExcelJS.Worksheet, projData: any, choData: any, allItems: any[], pageIdx: number, itemsPerPage: number, determinations: any, evaluations: any, dofaei: any) {
    const p = pageIdx;
    const startIdx = p * itemsPerPage;
    const pageItems = allItems.slice(startIdx, startIdx + itemsPerPage);

    // Solo escribimos si el dato existe para evitar borrar lo que hay en el template por accidente
    if (projData.name) sheet.getCell('B17').value = projData.name;
    if (projData.num_act) sheet.getCell('T17').value = projData.num_act;
    if (projData.num_federal) sheet.getCell('AK19').value = projData.num_federal;

    const roadClassif = dofaei.road_classif || "NHS";
    // Solo marcamos X, no borramos otras celdas de clasificación por si tienen texto
    if (roadClassif === "Interstate") sheet.getCell('B14').value = "X";
    if (roadClassif === "NHS") sheet.getCell('T14').value = "X";
    if (roadClassif === "Non NHS") sheet.getCell('AK14').value = "X";

    // Modification Types
    const isCO = choData.is_change_of_contract !== false;
    if (isCO) sheet.getCell('D24').value = "X";
    else sheet.getCell('D26').value = "X"; 

    if (choData.is_new_item) sheet.getCell('S24').value = "X"; 
    if (choData.is_time_extension) sheet.getCell('S26').value = "X";
    
    if ((parseFloat(choData.proposed_change) || 0) > 0 && !choData.is_new_item) sheet.getCell('AH26').value = "X";
    if (choData.is_spec_change) sheet.getCell('AH24').value = "X";

    // Determination Conditions
    if (determinations.deductive_items) sheet.getCell('D31').value = "X";
    if (determinations.safety_items) sheet.getCell('D33').value = "X";
    if (determinations.rideability_bonus) sheet.getCell('L31').value = "X";
    if (determinations.sub_estimated_items) sheet.getCell('L33').value = "X";
    if (determinations.minor_change) sheet.getCell('V31').value = "X";
    if (determinations.known_non_participating) sheet.getCell('V33').value = "X";
    if (determinations.other) {
        sheet.getCell('AA31').value = "X";
        sheet.getCell('AC31').value = determinations.other;
    }

    // --- SECTION V: Items Evaluated ---
    // NO BORRAMOS FILAS. Solo sobreescribimos las primeras 5 con los datos reales.
    let startRow = 46;
    pageItems.forEach((it, idx) => {
        const row = sheet.getRow(startRow + idx);
        const fedPct = getFederalSharePct(projData, it);
        const isFed = fedPct > 0;
        const ratio = (it.fund_source || "").toUpperCase() === "ACT:100%" ? "0%" : `${fedPct.toFixed(2)}%`;
        
        row.getCell(2).value = formatItemNum(it.item_num);
        row.getCell(5).value = it.specification;
        row.getCell(11).value = it.description;
        row.getCell(32).value = parseFloat(it.quantity) || 0;
        row.getCell(37).value = it.unit;
        row.getCell(41).value = parseFloat(it.unit_price) || 0;
        row.getCell(46).value = (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0);
        row.getCell(56).value = isFed ? "Yes" : "No";
        row.getCell(61).value = ratio;
    });

    // --- SECTION VI: Evaluation Matrix ---
    const matrixCols = [12, 16, 20, 24, 28]; // L, P, T, X, AB
    const criterionRows: Record<string, number> = {
        "1.1": 70, "1.2": 72, "1.3": 74, "1.4": 76, "1.5": 78, "1.6": 80,
        "2.1": 83, "2.2": 85,
        "3.1": 87,
        "4.1": 89, "4.2": 90
    };

    // Solo escribimos en la matriz los ítems de esta página
    pageItems.forEach((it, itemIdx) => {
        const colIdx = matrixCols[itemIdx];
        if (!colIdx) return;

        sheet.getCell(68, colIdx).value = `#${formatItemNum(it.item_num)}`;

        Object.entries(criterionRows).forEach(([critId, rowIdx]) => {
            const val = evaluations[it.item_num]?.[critId];
            if (val === "NF") {
                sheet.getCell(rowIdx, colIdx - 1).value = "X";
                sheet.getCell(rowIdx, colIdx).value = ""; // Limpiamos el otro lado
            } else if (val === "YT") {
                sheet.getCell(rowIdx, colIdx).value = "X";
                sheet.getCell(rowIdx, colIdx - 1).value = ""; // Limpiamos el otro lado
            }
        });
    });

    // --- SECTION VII: Impact ---
    sheet.getCell('F94').value = choData.time_extension_days || 0;
    sheet.getCell('N94').value = Math.abs(parseFloat(choData.proposed_change) || 0);

    if (dofaei.prepared_by_name) sheet.getCell('I96').value = dofaei.prepared_by_name;
    if (dofaei.prepared_by_position) sheet.getCell('I99').value = dofaei.prepared_by_position;
    if (dofaei.prepared_by_date) sheet.getCell('W96').value = dofaei.prepared_by_date;
}

async function cloneSheetPerfectly(source: ExcelJS.Worksheet, target: ExcelJS.Worksheet) {
    // Clonar columnas
    source.columns.forEach((col, i) => {
        target.getColumn(i + 1).width = col.width;
    });

    // Clonar filas y celdas
    source.eachRow({ includeEmpty: true }, (row, rowNum) => {
        const newRow = target.getRow(rowNum);
        newRow.height = row.height;
        row.eachCell({ includeEmpty: true }, (cell, colNum) => {
            const newCell = newRow.getCell(colNum);
            newCell.value = cell.value;
            newCell.style = JSON.parse(JSON.stringify(cell.style || {}));
        });
    });

    // Clonar celdas combinadas (Esto es VITAL para el formato de Enrique)
    // Usamos el acceso interno porque ExcelJS no expone merges de forma pública fácilmente
    // @ts-ignore
    const merges = source._merges || {};
    Object.values(merges).forEach((m: any) => {
        try {
            target.mergeCells(m.tl, m.br);
        } catch (e) {}
    });
}
