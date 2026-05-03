/**
 * Carga la librería PDF.js desde un CDN de forma segura
 */
async function loadPdfJs() {
    if (typeof window === 'undefined') return null;
    
    // @ts-ignore
    if (window.pdfjsLib) return window.pdfjsLib;

    try {
        // Engañamos a Webpack usando eval para que no intente procesar la URL de internet
        const url = 'https://unpkg.com/pdfjs-dist@4.10.38/build/pdf.min.mjs';
        const pdfjsLib = await eval(`import("${url}")`);
        // @ts-ignore
        window.pdfjsLib = pdfjsLib;
        return pdfjsLib;
    } catch (e) {
        console.error("Error cargando PDF.js desde CDN:", e);
        throw new Error('No se pudo cargar el motor de PDF desde la nube. Revisa tu conexión.');
    }
}

export async function parsePdfClient(base64: string): Promise<{ success: boolean; text?: string; error?: string }> {
    try {
        if (!base64) return { success: false, error: "No data provided" };
        
        // Carga dinámica ultra-robusta
        const pdfjsLib: any = await loadPdfJs();
        if (!pdfjsLib) throw new Error("Entorno no compatible");

        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs`;

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

export async function pdfToImages(base64: string): Promise<{ success: boolean; images?: string[]; error?: string }> {
    try {
        if (!base64) return { success: false, error: "No data provided" };
        
        const pdfjsLib: any = await loadPdfJs();
        if (!pdfjsLib) throw new Error("Entorno no compatible");

        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs`;

        const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
        const binaryData = atob(base64Data);
        const uint8Array = new Uint8Array(binaryData.length);
        for (let i = 0; i < binaryData.length; i++) {
            uint8Array[i] = binaryData.charCodeAt(i);
        }

        const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
        const pdf = await loadingTask.promise;
        const images: string[] = [];

        const maxPages = Math.min(pdf.numPages, 5);

        for (let i = 1; i <= maxPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.2 });
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (!context) continue;
            
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };
            
            await page.render(renderContext).promise;
            const base64Img = canvas.toDataURL('image/jpeg', 0.5);
            images.push(base64Img);
        }

        return { success: true, images };
    } catch (error: any) {
        console.error("Error converting PDF to images:", error);
        return { success: false, error: error.message || "Error converting PDF" };
    }
}
