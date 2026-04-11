import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { text, prompt, image } = await req.json();

        if (!process.env.GROQ_API_KEY) {
            return NextResponse.json({ error: 'Configuración incompleta de IA (falta GROQ_API_KEY)' }, { status: 500 });
        }

        const isJsonRequested = prompt.toLowerCase().includes("json");
        const systemMessage = isJsonRequested 
            ? "Eres un extractor de datos experto. Tu única tarea es devolver un objeto JSON válido según el esquema solicitado. No incluyas explicaciones, preámbulos ni comentarios. Solo el objeto JSON."
            : "Eres un asistente experto en analizar documentos de proyectos de construcción de carreteras y contratos gubernamentales (ej. ACT, FHWA). El usuario te proporcionará texto o una imagen de un documento y una instrucción específica sobre qué información extraer. Responde de forma profesional y clara únicamente con la información solicitada.";

        const messages: any[] = [{ role: "system", content: systemMessage }];

        if (image) {
            // Soporte para visión con Groq (Llama 3.2 Vision)
            const imagesArray = Array.isArray(image) ? image : [image];
            const limitedImages = imagesArray.slice(0, 5);
            
            const contentArray: any[] = [
                { type: "text", text: `Instrucción del usuario: "${prompt}"` }
            ];
            
            limitedImages.forEach((imgBase64) => {
                contentArray.push({
                    type: "image_url",
                    image_url: { url: imgBase64.startsWith('data:') ? imgBase64 : `data:image/jpeg;base64,${imgBase64}` }
                });
            });

            messages.push({
                role: "user",
                content: contentArray
            });
        } else {
            messages.push({ 
                role: "user", 
                content: `A continuación el texto del documento para analizar:\n\n---\n${(text || "").substring(0, 45000)}\n---\n\nInstrucción del usuario: "${prompt}"` 
            });
        }

        const groqBody: any = {
            model: image ? "llama-3.2-11b-vision-preview" : "llama-3.3-70b-versatile",
            temperature: 0.1,
            messages: messages
        };

        if (isJsonRequested && !image) {
            groqBody.response_format = { type: "json_object" };
        }

        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(groqBody)
        });

        const groqData = await groqResponse.json();
        
        if (groqData.error) {
            console.error("Groq API Error:", groqData.error);
            throw new Error(groqData.error.message || "Error de la API de IA");
        }
        
        let aiResult = groqData.choices?.[0]?.message?.content || "{}";

        return NextResponse.json({ result: aiResult });
    } catch (e: any) {
        console.error("Error AI process document:", e);
        return NextResponse.json({ error: e.message || "Error analizando el documento" }, { status: 500 });
    }
}
