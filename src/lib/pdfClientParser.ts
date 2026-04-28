/**
 * Procesa un PDF en base64 y extrae su texto directamente en el cliente.
 * Esto evita el uso de API Routes y permite la exportación estática para Electron.
 */
export async function parsePdfClient(base64: string): Promise<{ success: boolean; text?: string; error?: string }> {
    try {
        if (!base64) return { success: false, error: "No data provided" };
        
        // Importación dinámica para evitar errores de carga global en Next.js/Webpack
        // Usamos la ruta completa al archivo .mjs
        const pdfjsLib = await import('pdfjs-dist/build/pdf.mjs');
        
        // Configurar el worker de PDF.js (necesario para que funcione en el navegador)
        if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
        }

        // Limpiar base64
        const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
        const binaryData = atob(base64Data);
        const uint8Array = new Uint8Array(binaryData.length);
        for (let i = 0; i < binaryData.length; i++) {
            uint8Array[i] = binaryData.charCodeAt(i);
        }

        const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
        const pdf = await loadingTask.promise;
        let fullText = "";

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
                .map((item: any) => item.str)
                .join(" ");
            fullText += pageText + "\n";
        }

        return { success: true, text: fullText };
    } catch (error: any) {
        console.error("Error parsing PDF on client:", error);
        return { success: false, error: error.message || "Error parsing PDF" };
    }
}
