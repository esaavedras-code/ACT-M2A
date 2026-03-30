/**
 * Utilidades para exportar e importar secciones del formulario en formato JSON.
 */

export async function exportSectionToJSON(filename: string, data: any) {
    try {
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${filename}_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Error exporting JSON:", error);
        alert("Error al exportar los datos.");
    }
}

export async function importSectionFromJSON(file: File): Promise<{ success: boolean; data?: any; error?: string }> {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target?.result as string);
                resolve({ success: true, data });
            } catch (err) {
                resolve({ success: false, error: "Formato de archivo inválido" });
            }
        };
        reader.onerror = () => resolve({ success: false, error: "Error al leer el archivo" });
        reader.readAsText(file);
    });
}
