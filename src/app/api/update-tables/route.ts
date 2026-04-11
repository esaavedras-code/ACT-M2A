import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import * as xlsx from 'xlsx';

export async function POST(req: Request) {
    console.log("[UpdateTables] Iniciando procesamiento de solicitud...");
    try {
        const formData = await req.formData();
        const file = formData.get('file');
        const projectId = formData.get('projectId') as string;
        const numAct = formData.get('numAct') as string;

        if (!file || !(file instanceof File) || !projectId) {
            console.error("[UpdateTables] Faltan datos requeridos:", { hasFile: !!file, projectId });
            return NextResponse.json({ error: 'Faltan datos requeridos (archivo o ID de proyecto)' }, { status: 400 });
        }

        console.log("[UpdateTables] Archivo recibido:", file.name, "Proyecto:", numAct);
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

        // 2. Análisis con IA
        const prompt = `Analiza el contenido de este documento de construcción para el proyecto ACT-${numAct || 'desconocido'}.
        
        INSTRUCCIONES CRÍTICAS:
        1. Busca EXCLUSIVAMENTE datos relacionados al proyecto ACT-${numAct}. Si el documento menciona otros proyectos, IGNÓRALOS.
        2. Extrae tablas de partidas (ítems): item_num, specification, description, quantity, unit, unit_price.
        3. El item_num debe tener 3 dígitos (ej: 001, 102).
        4. Identifica fechas importantes: date_contract_sign, date_project_start, date_orig_completion.
        
        Contenido del documento:
        ---
        ${(structuredData || extractedText).substring(0, 28000)}
        ---
        
        Responde con un JSON con esta estructura:
        {
          "changes": {
            "summary": "Resumen de lo encontrado para ACT-${numAct}",
            "itemsCount": 0,
            "updates": [
              { 
                "table": "contract_items", 
                "data": { "item_num": "X", "specification": "X", "description": "X", "quantity": 0, "unit": "X", "unit_price": 0 } 
              },
              {
                "table": "projects",
                "data": { "date_contract_sign": "YYYY-MM-DD", "cost_original": 0 }
              }
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
                temperature: 0,
                messages: [
                    { role: "system", content: "Eres un experto en ingeniería civil y extracción de datos de construcción ACT." },
                    { role: "user", content: prompt }
                ],
                response_format: { type: "json_object" }
            })
        });

        if (!aiResponse.ok) throw new Error("La IA no pudo procesar el documento.");

        const aiData = await aiResponse.json();
        const resultString = aiData.choices?.[0]?.message?.content;
        const result = JSON.parse(resultString).changes;

        // 3. Ejecución y Tracking de Cambios
        console.log("[UpdateTables] Sincronizando datos con tracking...");
        const now = new Date().toISOString();

        if (result.updates && Array.isArray(result.updates)) {
            for (const update of result.updates) {
                try {
                    if (update.table === "contract_items") {
                        const itemNum = update.data.item_num?.toString().padStart(3, '0');
                        if (!itemNum) continue;

                        // Obtener estado actual
                        const { data: current } = await supabase
                            .from("contract_items")
                            .select("*")
                            .eq("project_id", projectId)
                            .eq("item_num", itemNum)
                            .single();

                        const updatedFields: string[] = [];
                        const reviewedFields: string[] = [];

                        const newData = {
                            ...update.data,
                            item_num: itemNum,
                            project_id: projectId,
                            quantity: parseFloat(update.data.quantity) || 0,
                            unit_price: parseFloat(update.data.unit_price) || 0
                        };

                        // Comparar
                        if (current) {
                            Object.keys(update.data).forEach(key => {
                                if (JSON.stringify(current[key]) !== JSON.stringify(newData[key])) {
                                    updatedFields.push(key);
                                } else {
                                    reviewedFields.push(key);
                                }
                            });
                        } else {
                            Object.keys(update.data).forEach(key => updatedFields.push(key));
                        }

                        // Guardar con metadata
                        const { error: upsertErr } = await supabase
                            .from("contract_items")
                            .upsert([{
                                ...newData,
                                ia_metadata: {
                                    updated_fields: updatedFields,
                                    reviewed_fields: reviewedFields,
                                    last_update: now
                                }
                            }], { onConflict: 'project_id, item_num' });

                        if (upsertErr) console.error("Error upserting item:", itemNum, upsertErr);

                    } else if (update.table === "projects") {
                        const { data: currentProject } = await supabase
                            .from("projects")
                            .select("*")
                            .eq("id", projectId)
                            .single();

                        const updatedFields: string[] = [];
                        const reviewedFields: string[] = [];

                        if (currentProject) {
                            Object.keys(update.data).forEach(key => {
                                if (JSON.stringify(currentProject[key]) !== JSON.stringify(update.data[key])) {
                                    updatedFields.push(key);
                                } else {
                                    reviewedFields.push(key);
                                }
                            });
                        }

                        await supabase
                            .from("projects")
                            .update({
                                ...update.data,
                                ia_metadata: {
                                    updated_fields: updatedFields,
                                    reviewed_fields: reviewedFields,
                                    last_update: now
                                }
                            })
                            .eq("id", projectId);
                    }
                } catch (err) {
                    console.warn("Error en item individual:", err);
                }
            }
        }

        return NextResponse.json({ changes: result });

    } catch (e: any) {
        console.error("[UpdateTables] ERROR:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

