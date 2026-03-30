import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { text, prompt } = await req.json();

        if (!process.env.GROQ_API_KEY) {
            return NextResponse.json({ error: 'Configuración incompleta de IA (falta GROQ_API_KEY)' }, { status: 500 });
        }

        const systemMessage = "Eres un asistente experto en analizar documentos de proyectos de construcción de carreteras y contratos gubernamentales (ej. ACT, FHWA). El usuario te proporcionará el texto extraído de un documento PDF (Proposal, Contrato, etc.) y una instrucción específica sobre qué información extraer. Busca cuidadosamente en el texto y responde de forma profesional y clara únicamente con la información solicitada.";

        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                temperature: 0.2, // Baja temperatura para mayor rigor en la extracción
                messages: [
                    { role: "system", content: systemMessage },
                    { role: "user", content: `A continuación el texto del documento para analizar:\n\n---\n${text.substring(0, 45000)}\n---\n\nInstrucción del usuario: "${prompt}"` }
                ]
            })
        });

        const groqData = await groqResponse.json();
        
        if (groqData.error) {
            throw new Error(groqData.error.message || "Error de la API de IA");
        }
        
        let aiResult = groqData.choices?.[0]?.message?.content || "No se pudo generar una respuesta.";

        return NextResponse.json({ result: aiResult });
    } catch (e: any) {
        console.error("Error AI process document:", e);
        return NextResponse.json({ error: e.message || "Error analizando el documento" }, { status: 500 });
    }
}
