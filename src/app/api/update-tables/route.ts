import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import * as xlsx from 'xlsx';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const projectId = formData.get('projectId') as string;

        if (!file || !projectId) {
            return NextResponse.json({ error: 'Faltan datos requeridos (archivo o ID de proyecto)' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        let extractedText = "";
        let structuredData = "";

        const fileExt = file.name.split('.').pop()?.toLowerCase();

        // 1. Extraction based on type
        if (fileExt === 'pdf') {
            const data = await pdf(buffer);
            extractedText = data.text;
        } else if (['xlsx', 'xls', 'csv'].includes(fileExt || '')) {
            const workbook = xlsx.read(buffer, { type: 'buffer' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            extractedText = xlsx.utils.sheet_to_txt(worksheet);
            structuredData = JSON.stringify(xlsx.utils.sheet_to_json(worksheet));
        } else if (['docx', 'doc'].includes(fileExt || '')) {
            const result = await mammoth.extractRawText({ buffer });
            extractedText = result.value;
        }

        if (!extractedText && !structuredData) {
            throw new Error("No se pudo extraer texto del archivo.");
        }

        // 2. AI Analysis
        const prompt = `Analiza el siguiente contenido extraído de un documento de proyecto de construcción. 
        Identifica partidas del contrato (item numbers, descripciones, cantidades, precios unitarios) y fechas clave.
        
        Contenido del documento:
        ---
        ${(structuredData || extractedText).substring(0, 30000)}
        ---
        
        Responde ÚNICAMENTE con un JSON válido en el siguiente formato exacto:
        {
          "changes": {
            "summary": "Resumen de lo que encontraste",
            "itemsCount": cuántas partidas identificaste (número),
            "datesChanged": true/false si hay fechas de proyecto,
            "updates": [
              { "table": "contract_items", "op": "upsert", "data": { "item_num": "001", "description": "...", "quantity": 10.5, "unit_price": 50.0, "unit": "...", "project_id": "${projectId}" } },
              { "table": "projects", "op": "update", "data": { "id": "${projectId}", "end_date": "YYYY-MM-DD" } }
            ]
          }
        }`;

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
                    { role: "system", content: "Eres un liquidador de proyectos ACT experto en extraer datos JSON de tablas de construcción." },
                    { role: "user", content: prompt }
                ],
                response_format: { type: "json_object" }
            })
        });

        const aiData = await aiResponse.json();
        const resultString = aiData.choices?.[0]?.message?.content;
        
        if (!resultString) throw new Error("La IA no devolvió una respuesta válida.");
        
        const result = JSON.parse(resultString).changes;

        // 3. Execution of updates
        if (result.updates && Array.isArray(result.updates)) {
            for (const update of result.updates) {
                if (update.table === "contract_items") {
                    // Limpiar data para asegurar project_id y tipos correctos
                    const cleanData = { 
                        ...update.data, 
                        project_id: projectId,
                        quantity: parseFloat(update.data.quantity) || 0,
                        unit_price: parseFloat(update.data.unit_price) || 0
                    };
                    
                    if (update.op === "upsert" && cleanData.item_num) {
                        await supabase
                            .from("contract_items")
                            .upsert([cleanData], { onConflict: 'project_id, item_num' });
                    }
                } else if (update.table === "projects") {
                    if (update.op === "update" && update.data.id === projectId) {
                        await supabase
                            .from("projects")
                            .update(update.data)
                            .eq("id", projectId);
                    }
                }
            }
        }

        return NextResponse.json({ changes: result });

    } catch (e: any) {
        console.error("Error in update-tables route:", e);
        return NextResponse.json({ error: e.message || "Error interno del servidor" }, { status: 500 });
    }
}
