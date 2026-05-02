import { NextResponse } from 'next/server';

export const maxDuration = 60; // 60 segundos máximo para Vercel
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { text, prompt, image } = body;

        const apiKey = process.env.GROQ_API_KEY;

        if (!apiKey) {
            return NextResponse.json({ error: { message: "Falta GROQ_API_KEY en Vercel." } }, { status: 500 });
        }

        const systemMessage = "Eres un asistente experto en analizar documentos de proyectos de construcción de carreteras y contratos gubernamentales (ej. ACT, FHWA). El usuario te proporcionará texto o una imagen de un documento y una instrucción específica sobre qué información extraer. Responde de forma profesional y clara únicamente con la información solicitada.";
        const messages: any[] = [{ role: "system", content: systemMessage }];

        if (image) {
            const imagesArray = Array.isArray(image) ? image : [image];
            const limitedImages = imagesArray.slice(0, 5); // Llama Vision puede soportar múltiples, pero limitamos a 5
            
            const contentArray: any[] = [{ type: "text", text: `Instrucción del usuario: "${prompt}"` }];
            limitedImages.forEach((imgBase64) => {
                contentArray.push({
                    type: "image_url",
                    image_url: { url: imgBase64.startsWith('data:') ? imgBase64 : `data:image/jpeg;base64,${imgBase64}` }
                });
            });
            messages.push({ role: "user", content: contentArray });
        } else {
            messages.push({ 
                role: "user", 
                content: `A continuación el texto del documento para analizar:\n\n---\n${(text || "").substring(0, 45000)}\n---\n\nInstrucción del usuario: "${prompt}"` 
            });
        }

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: image ? "llama-3.2-90b-vision-preview" : "llama-3.3-70b-versatile",
                temperature: 0.2,
                messages: messages
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`Groq API Error Status: ${response.status} - ${errText}`);
            return NextResponse.json({ error: { message: `Error Groq API: ${response.status}` } }, { status: response.status });
        }

        const groqData = await response.json();
        if (groqData.error) {
            return NextResponse.json({ error: groqData.error }, { status: 500 });
        }

        const aiResult = groqData.choices?.[0]?.message?.content || "No se pudo generar una respuesta.";
        return NextResponse.json({ success: true, result: aiResult });

    } catch (error: any) {
        console.error("API Route Error:", error);
        return NextResponse.json({ error: { message: error.message || "Internal server error" } }, { status: 500 });
    }
}
