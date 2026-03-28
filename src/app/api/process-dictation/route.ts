import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { text, context, currentData, contractItems } = await req.json();

        if (!process.env.GROQ_API_KEY) {
            return NextResponse.json({ error: 'Configuración incompleta de IA (falta GROQ_API_KEY)' }, { status: 500 });
        }

        let systemMessage = "Eres un asistente de IA para ingenieros e inspectores. Transcribes y estructuras datos.";
        
        switch (context) {
            case "personal":
                systemMessage = `El usuario dictará información sobre qué personal trabajó.
Debes devolver un JSON con un arreglo "personal" donde cada elemento tenga:
{
    "compañia": "string (opcional)",
    "nombres": "string",
    "clasificacion": "string (ej: Inspector, Obrero, etc)",
    "horas": numero (opcional, ej: 8)
}
Escucha atentamente lo que dice el usuario y extrae todos los empleados mencionados. Si menciona nombres múltiples, haz múltiples entradas.
DEVUELVE ÚNICAMENTE JSON VÁLIDO. NO INCLUYAS TEXTO ADICIONAL NI MARKDOWNS COMO \`\`\`json.`;
                break;
            case "equipo":
                systemMessage = `El usuario dictará vehículos o equipo pesado que se utilizó.
Devuelve un JSON con un arreglo "equipo" donde cada elemento tenga:
{
    "tipo": "string (ej: Pickup, Bobcat, Camión)",
    "descripcion": "string (opcional, ej placa o detalle)",
    "horas_op": numero (opcional, ej: 8)
}
Extráelo del texto proporcionado.
DEVUELVE ÚNICAMENTE JSON VÁLIDO. NO INCLUYAS TEXTO ADICIONAL NI FORMATO MARKDOWN.`;
                break;
            case "partidas":
                const itemsList = contractItems ? JSON.stringify(contractItems.map((c: any) => ({id: c.id, num: c.item_num, desc: c.description}))) : '[]';
                systemMessage = `El usuario dictará detalles sobre partidas de contrato trabajadas hoy.
Las partidas posibles en este proyecto son: ${itemsList}.
Intenta asociar lo que diga el usuario con las partidas de esta lista mediante similitud en numero de partida o descripción.
Devuelve un JSON con un arreglo llamado "partidas_trabajadas" donde cada elemento sea:
{
    "item_id": "string (id de la partida de contrato mapeada o vacio si no estas seguro)",
    "qty_worked": numero (cantidad trabajada, vacio si no especifica),
    "notes": "string (comentarios adicionales o descripción de lo que se hizo)"
}
DEVUELVE ÚNICAMENTE JSON VÁLIDO. NO MARKDOWNS. AL REGRESAR DEBE ESTAR TODO EN EL ARRAY "partidas_trabajadas".`;
                break;
            case "notas":
                systemMessage = `El usuario dictó notas del informe diario.
Tu tarea es corregir la gramática, estructurar los puntos principales claramente (manteniendo el tono profesional), sin agregar información falsa.
Devuelve ÚNICAMENTE un JSON con la propiedad "texto" que contenga el texto procesado. NO MANDES MARKDOWNS.
Ejemplo: {"texto": "El tramo se pavimentó correctamente..."}`;
                break;
            case "seguridad":
                systemMessage = `El usuario informará de la seguridad en la obra.
Debes identificar las notas generales, y si hay incidentes de seguridad descritos.
Devuelve un JSON con:
{
    "es_incidente_grave": boolean,
    "texto": "Texto estructurado, profesional de las observaciones de seguridad."
}
NO DEVUELVAS NINGÚN OTRO CARÁCTER NI MARKDOWN, SOLO JSON.`;
                break;
            default:
                break;
        }

        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                temperature: 0.1,
                messages: [
                    { role: "system", content: systemMessage },
                    { role: "user", content: `El texto dictado es: "${text}"` }
                ]
            })
        });

        const groqData = await groqResponse.json();
        
        let aiResult = groqData.choices[0].message.content;
        
        // Limpiamos markdown si el modelo se niega a cumplir la regla
        if (aiResult.startsWith('```json')) {
            aiResult = aiResult.replace(/```json\n?/, '').replace(/```\n?$/, '');
        }

        return NextResponse.json(JSON.parse(aiResult));
    } catch (e: any) {
        console.error("Error process AI", e);
        return NextResponse.json({ error: e.message || "Error procesando el dictado" }, { status: 500 });
    }
}
