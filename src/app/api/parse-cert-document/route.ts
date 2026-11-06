import { NextResponse } from "next/server";
import PDFParser from "pdf2json";

function safeDecode(s: string): string {
    try {
        return decodeURIComponent(s);
    } catch {
        try {
            return unescape(s);
        } catch {
            return s;
        }
    }
}

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        if (!file) {
            return NextResponse.json({ error: "No se proporcionó ningún archivo" }, { status: 400 });
        }

        const fileName = (file.name || "").toLowerCase();
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const isPdf = fileName.endsWith(".pdf") || buffer.slice(0, 5).toString().startsWith("%PDF");

        if (!isPdf) {
            return NextResponse.json({
                success: true,
                isPdf: false,
                message: "Archivo no es PDF (procesar directamente como Excel)"
            });
        }

        // Parsear PDF con pdf2json
        const pdfParser = new (PDFParser as any)();

        return await new Promise<NextResponse>((resolve) => {
            pdfParser.on("pdfParser_dataError", (errData: any) => {
                console.error("Error parseando PDF con pdf2json:", errData);
                resolve(NextResponse.json({ error: "Error al leer el archivo PDF" }, { status: 500 }));
            });

            pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
                const matrix: string[][] = [];
                let fullRawText = "";

                if (pdfData && Array.isArray(pdfData.Pages)) {
                    pdfData.Pages.forEach((page: any, pageIdx: number) => {
                        if (!page || !Array.isArray(page.Texts)) return;

                        // Agrupar elementos de texto por coordenada vertical (Y)
                        // Con tolerancia de ~0.35 para agrupar palabras en la misma línea
                        const lineMap = new Map<number, { x: number; str: string }[]>();

                        page.Texts.forEach((t: any) => {
                            if (!t || !Array.isArray(t.R)) return;
                            const yGroup = Math.round((t.y || 0) * 3) / 3;
                            if (!lineMap.has(yGroup)) {
                                lineMap.set(yGroup, []);
                            }
                            const rawStr = t.R.map((r: any) => r.T || "").join("");
                            const str = safeDecode(rawStr).trim();
                            if (str) {
                                lineMap.get(yGroup)!.push({ x: t.x || 0, str });
                            }
                        });

                        const sortedY = Array.from(lineMap.keys()).sort((a, b) => a - b);
                        sortedY.forEach((y) => {
                            const items = lineMap.get(y)!.sort((a, b) => a.x - b.x);
                            const row = items.map((it) => it.str);
                            if (row.length > 0) {
                                matrix.push(row);
                                fullRawText += row.join(" \t ") + "\n";
                            }
                        });

                        // Marca de salto de página
                        matrix.push([`--- PAGE ${pageIdx + 1} BREAK ---`]);
                    });
                }

                resolve(NextResponse.json({
                    success: true,
                    isPdf: true,
                    matrix,
                    rawText: fullRawText,
                    pagesCount: pdfData?.Pages?.length || 0
                }));
            });

            pdfParser.parseBuffer(buffer);
        });

    } catch (err: any) {
        console.error("Error en /api/parse-cert-document:", err);
        return NextResponse.json({ error: err.message || "Error procesando documento" }, { status: 500 });
    }
}
