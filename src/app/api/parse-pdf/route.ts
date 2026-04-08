import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { base64 } = await req.json();

        if (!base64) {
            return NextResponse.json({ success: false, error: 'No base64 data provided' }, { status: 400 });
        }

        // Remover prefijos data:application/pdf;base64, si existen
        const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
        const pdfBuffer = Buffer.from(base64Data, 'base64');

        // Usar pdf2json en lugar de pdf-parse (compatible con Node.js v24 sin pdfjs-dist)
        // @ts-ignore
        const PDFParser = require('pdf2json');
        const pdfParser = new PDFParser(null, 1);

        const text: string = await new Promise((resolve, reject) => {
            pdfParser.on('pdfParser_dataError', (errData: any) => {
                reject(new Error(errData.parserError || 'Error parsing PDF'));
            });
            pdfParser.on('pdfParser_dataReady', () => {
                resolve(pdfParser.getRawTextContent());
            });
            pdfParser.parseBuffer(pdfBuffer);
        });

        return NextResponse.json({ success: true, text });
    } catch (e: any) {
        console.error("Error parse pdf:", e);
        return NextResponse.json({ success: false, error: e.message || "Error parsing PDF" }, { status: 500 });
    }
}
