import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import * as xlsx from 'xlsx';

export async function POST(req: Request) {
    console.log("[UpdateTables] Iniciando procesamiento de solicitud...");
    try {
        const formData = await req.formData();
        const file = formData.get('file');
        const projectId = formData.get('projectId') as string;

        if (!file || !(file instanceof File) || !projectId) {
            console.error("[UpdateTables] Faltan datos requeridos:", { hasFile: !!file, projectId });
            return NextResponse.json({ error: 'Faltan datos requeridos (archivo o ID de proyecto)' }, { status: 400 });
        }

        console.log("[UpdateTables] Archivo recibido:", file.name, "Tamaño:", file.size);
        const buffer = Buffer.from(await file.arrayBuffer());
        let extractedText = "";
        let structuredData = "";

        const fileExt = file.name.split('.').pop()?.toLowerCase();

        // 1. Extracción basada en tipo
        try {
            if (fileExt === 'pdf') {
                console.log("[UpdateTables] Procesando PDF...");
                // @ts-ignore
                const PDFParser = require('pdf2json');
                const pdfParser = new PDFParser(null, 1);
                
                extractedText = await new Promise((resolve, reject) => {
                    pdfParser.on('pdfParser_dataError', (errData: any) => reject(new Error(errData.parserError || 'Error parsing PDF')));
                    pdfParser.on('pdfParser_dataReady', () => resolve(pdfParser.getRawTextContent()));
                    pdfParser.parseBuffer(buffer);
                });
            } else if (['xlsx', 'xls', 'csv'].includes(fileExt || '')) {
                console.log("[UpdateTables] Procesando Excel/CSV...");
                const workbook = xlsx.read(buffer, { type: 'buffer' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                extractedText = xlsx.utils.sheet_to_txt(worksheet);
                structuredData = JSON.stringify(xlsx.utils.sheet_to_json(worksheet));
            } else if (['docx', 'doc'].includes(fileExt || '')) {
                console.log("[UpdateTables] Procesando Word...");
                // @ts-ignore
                const mammoth = require('mammoth');
                const result = await mammoth.extractRawText({ buffer });
                extractedText = result.value;
            } else {
                throw new Error(`Formato de archivo no soportado: ${fileExt}`);
            }
        } catch (extractError: any) {
            console.error("[UpdateTables] Error en extracción:", extractError);
            throw new Error(`Error al leer el contenido del archivo: ${extractError.message}`);
        }

        if (!extractedText && !structuredData) {
            throw new Error("No se pudo extraer texto del archivo.");
        }

        console.log("[UpdateTables] Texto extraído con éxito (longitud:", (extractedText || structuredData).length, ")");

        // 2. Análisis con IA
        const prompt = `Analiza el contenido de este documento de construcción.
        Busca tablas o listas de partidas (ítems) con sus descripciones, cantidades, precios unitarios y totales.
        También busca fechas importantes del proyecto.
        
        Contenido:
        ---
        ${(structuredData || extractedText).substring(0, 25000)}
        ---
        
        Responde EXCLUSIVAMENTE con un JSON con esta estructura:
        {
          "changes": {
            "summary": "Breve resumen",
            "itemsCount": número_de_partidas,
            "datesChanged": true/false,
            "updates": [
              { "table": "contract_items", "op": "upsert", "data": { "item_num": "X", "description": "X", "quantity": 0, "unit_price": 0, "unit": "X" } }
            ]
          }
        }`;

        console.log("[UpdateTables] Llamando a Groq API...");
        const aiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                temperature: 0.1,
                messages: [
                    { role: "system", content: "Eres un experto en extracción de datos de construcción para Supabase." },
                    { role: "user", content: prompt }
                ],
                response_format: { type: "json_object" }
            })
        });

        if (!aiResponse.ok) {
            const aiError = await aiResponse.text();
            console.error("[UpdateTables] Error de Groq API:", aiError);
            throw new Error("La IA no pudo procesar el documento en este momento.");
        }

        const aiData = await aiResponse.json();
        const resultString = aiData.choices?.[0]?.message?.content;
        
        if (!resultString) throw new Error("La respuesta de la IA llegó vacía.");
        
        let result;
        try {
            result = JSON.parse(resultString).changes;
        } catch (parseError) {
            console.error("[UpdateTables] Error parseando JSON de IA:", resultString);
            throw new Error("El análisis de la IA no devolvió un formato válido.");
        }

        // 3. Ejecución de actualizaciones
        console.log("[UpdateTables] Ejecutando actualizaciones en base de datos...");
        if (result.updates && Array.isArray(result.updates)) {
            for (const update of result.updates) {
                try {
                    if (update.table === "contract_items") {
                        const cleanData = { 
                            ...update.data, 
                            project_id: projectId,
                            quantity: parseFloat(update.data.quantity) || 0,
                            unit_price: parseFloat(update.data.unit_price) || 0
                        };
                        
                        if (update.op === "upsert" && cleanData.item_num) {
                            const { error: upsertErr } = await supabase
                                .from("contract_items")
                                .upsert([cleanData], { onConflict: 'project_id, item_num' });
                            if (upsertErr) console.warn("[UpdateTables] Error en upsert de item:", upsertErr);
                        }
                    } else if (update.table === "projects") {
                        if (update.op === "update") {
                            const { error: updateErr } = await supabase
                                .from("projects")
                                .update(update.data)
                                .eq("id", projectId);
                            if (updateErr) console.warn("[UpdateTables] Error en update de proyecto:", updateErr);
                        }
                    }
                } catch (updateItemError) {
                    console.error("[UpdateTables] Error procesando operación individual:", updateItemError);
                }
            }
        }

        console.log("[UpdateTables] Proceso completado con éxito.");
        return NextResponse.json({ changes: result });

    } catch (e: any) {
        console.error("[UpdateTables] ERROR CRÍTICO:", e);
        return NextResponse.json({ 
            error: e.message || "Error interno del servidor",
            details: "Consulta los logs del servidor para más información."
        }, { status: 500 });
    }
}

