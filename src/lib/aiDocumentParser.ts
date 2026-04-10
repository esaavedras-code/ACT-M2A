import { supabase } from "./supabase";
import { parsePdfBase64 } from "./pdfTracker"; // Assuming this exists or is similar to pdfParser

export interface AIDocumentResult {
    success: boolean;
    data?: any;
    error?: string;
}

/**
 * Parses critical project documents using AI and extracts structured data.
 */
export async function autoProcessCriticalDocs(projectId: string): Promise<AIDocumentResult> {
    try {
        // 1. Get all documents for this project
        const { data: docs, error: docsError } = await supabase
            .from("project_documents")
            .select("*")
            .eq("project_id", projectId);

        if (docsError) throw docsError;
        if (!docs || docs.length === 0) {
            return { success: false, error: "No se encontraron documentos para procesar." };
        }

        // 2. Identify target files
        const contractDoc = docs.find(d => d.document_type === "Contrato");
        const proposalDoc = docs.find(d => d.document_type === "Proposal");
        const commencementDoc = docs.find(d => d.document_type === "Orden de comienzo");
        const agreementDoc = docs.find(d => d.document_type === "Project agreement");

        if (!contractDoc && !proposalDoc && !commencementDoc && !agreementDoc) {
            return { success: false, error: "No se encontraron los tipos de documentos requeridos (Contrato, Proposal, Orden de comienzo o Project Agreement)." };
        }

        const results: any = {
            general: {},
            items: [],
            dates: {},
            funds: []
        };

        // 3. Process each document found
        // Note: For actual implementation, we would download each blob and send to AI.
        // For now, I'll simulate the AI call structure as requested by the user.

        // TODO: Implement actual PDF parsing and LLM calls for each document type.
        // For this task, I will expose the logic in ProjectForm to trigger this.

        return { success: true, data: results };
    } catch (err: any) {
        console.error("AI Processing error:", err);
        return { success: false, error: err.message };
    }
}
