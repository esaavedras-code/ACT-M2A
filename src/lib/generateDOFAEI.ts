import ExcelJS from 'exceljs';
import { supabase } from './supabase';
import { formatCurrency } from './utils';

// Esta función ahora devolverá un Buffer del Excel relleno
export async function generateDOFAEI(projectId: string, choId: string) {
    try {
        const { data: projData } = await supabase.from('projects').select('*').eq('id', projectId).single();
        const { data: choData } = await supabase.from('chos').select('*').eq('id', choId).single();
        
        if (!projData || !choData) throw new Error("Datos insuficientes");

        const dofaei = choData.dofaei_data || {};
        const determinations = dofaei.determination_conditions || {};
        const evaluations = dofaei.evaluations || {};

        // Cargar el template
        const workbook = new ExcelJS.Workbook();
        
        // En un entorno de Next.js/Browser, el acceso a archivos locales directos es restringido, 
        // pero como es una App de Electron y el código corre en el cliente, 
        // podemos intentar cargar el archivo desde la carpeta de la app o vía fetch si está en public.
        // Asumimos que el archivo se copió a la carpeta public o se puede acceder vía API.
        
        // Intentar cargar el template desde public
        const templateUrl = '/templates/DOFAEI.xlsx';
        console.log("Intentando cargar template desde:", templateUrl);
        
        let response = await fetch(templateUrl);
        if (!response.ok) {
             console.error("Error al cargar el template:", response.status, response.statusText);
             throw new Error(`No se pudo cargar la plantilla del servidor (${response.status})`);
        }
        const arrayBuffer = await response.arrayBuffer();
        await workbook.xlsx.load(arrayBuffer);
        
        const sheet = workbook.getWorksheet(1);
        if (!sheet) throw new Error("No se encontró la hoja en el Excel");

        // --- SECTION I: Project Information ---
        sheet.getCell('D11').value = projData.name || "";
        sheet.getCell('D13').value = projData.num_act || "";
        sheet.getCell('D15').value = projData.num_federal || "";

        // Road Classif
        const roadClassif = dofaei.road_classif || "NHS";
        sheet.getCell('P11').value = roadClassif === "Interstate" ? "X" : "";
        sheet.getCell('P13').value = roadClassif === "NHS" ? "X" : "";
        sheet.getCell('P15').value = roadClassif === "Non NHS" ? "X" : "";

        // --- SECTION II & III ---
        const isCO = choData.is_change_of_contract !== false;
        sheet.getCell('D20').value = isCO ? "X" : "";
        sheet.getCell('D22').value = !isCO ? "X" : "";

        sheet.getCell('L20').value = choData.is_new_item ? "X" : "";
        sheet.getCell('L22').value = choData.is_time_extension ? "X" : "";
        
        const isOverrun = (choData.proposed_change || 0) > 0 && !choData.is_new_item;
        sheet.getCell('U22').value = isOverrun ? "X" : "";

        // --- SECTION IV: Determination Conditions ---
        sheet.getCell('D31').value = determinations.deductive_items ? "X" : "";
        sheet.getCell('D33').value = determinations.safety_items ? "X" : "";
        sheet.getCell('L31').value = determinations.rideability_bonus ? "X" : "";
        sheet.getCell('L33').value = determinations.sub_estimated_items ? "X" : "";
        sheet.getCell('V31').value = determinations.minor_change ? "X" : "";
        sheet.getCell('V33').value = determinations.known_non_participating ? "X" : "";
        sheet.getCell('Y31').value = determinations.other ? "X" : "";
        sheet.getCell('AA31').value = determinations.other || "";

        // --- SECTION V: Items Evaluated ---
        const items = Array.isArray(choData.items) ? choData.items : [];
        let startRow = 42;
        items.forEach((it, idx) => {
            const row = sheet.getRow(startRow + idx);
            const isFed = (it.fund_source || "").includes("FHWA");
            const ratio = isFed ? ((it.fund_source || "").includes("80.25") ? "80.25%" : "100%") : "0%";
            
            row.getCell(2).value = it.item_num;
            row.getCell(4).value = it.specification;
            row.getCell(6).value = it.description;
            row.getCell(16).value = parseFloat(it.quantity) || 0;
            row.getCell(18).value = it.unit;
            row.getCell(20).value = parseFloat(it.unit_price) || 0;
            row.getCell(23).value = (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0);
            row.getCell(26).value = isFed ? "Yes" : "No";
            row.getCell(29).value = ratio;
        });

        // --- SECTION VI: Evaluation Matrix ---
        // Basado en el análisis de celdas, los ítems en la matriz empiezan en columnas L, O, R... (saltan de 3 en 3)
        const matrixCols = [12, 15, 18, 21, 24]; // L, O, R, U, X
        
        // Mapeo de IDs de criterios a filas del Excel
        const criterionRows: Record<string, number> = {
            "1.1": 70, "1.2": 72, "1.3": 74, "1.4": 76, "1.5": 78, "1.6": 80,
            "2.1": 83, "2.2": 85,
            "3.1": 87,
            "4.1": 89, "4.2": 90
        };

        items.slice(0, 5).forEach((it, itemIdx) => {
            const colIdx = matrixCols[itemIdx];
            
            // Poner el número de ítem en el header de la matriz
            sheet.getCell(68, colIdx).value = `#${it.item_num}`;

            Object.entries(criterionRows).forEach(([critId, rowIdx]) => {
                const val = evaluations[it.item_num]?.[critId]; // "YT" o "NF"
                if (val === "NF") {
                    sheet.getCell(rowIdx, colIdx - 1).value = "X"; // Columna izquierda (N/F)
                } else if (val === "YT") {
                    sheet.getCell(rowIdx, colIdx).value = "X"; // Columna derecha (Y/T)
                }
            });
        });

        // --- SECTION VII: Impact ---
        sheet.getCell('F94').value = choData.time_extension_days || 0;
        sheet.getCell('N94').value = Math.abs(parseFloat(choData.proposed_change) || 0);

        // Signatures
        const preparer = dofaei.prepared_by_name || "";
        const prepPos = dofaei.prepared_by_position || "";
        const prepDate = dofaei.prepared_by_date || "";

        sheet.getCell('I96').value = preparer;
        sheet.getCell('I99').value = prepPos;
        sheet.getCell('W96').value = prepDate;

        // Generar Buffer
        const buffer = await workbook.xlsx.writeBuffer();
        return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    } catch (err: any) {
        console.error("Error generating DOFAEI Excel:", err);
        throw err;
    }
}
