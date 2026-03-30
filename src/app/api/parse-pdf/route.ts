import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { base64 } = await req.json();

        if (!base64) {
            return NextResponse.json({ success: false, error: 'No base64 data provided' }, { status: 400 });
        }

        // Remover prefijos data:application/pdf;base64, si existen
        const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Usar require en vez de import() para evitar el "no default export" error de ESM en Vercel
        // @ts-ignore
        const pdfParse = require('pdf-parse');
        const data = await pdfParse(buffer);

        return NextResponse.json({ success: true, text: data.text });
    } catch (e: any) {
        console.error("Error parse pdf:", e);
        return NextResponse.json({ success: false, error: e.message || "Error parsing PDF" }, { status: 500 });
    }
}
