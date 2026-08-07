// Script para corregir la letra del CHO #8 en el proyecto AC-200024
// Cambia amendment_letter de "B" a "H"

const SUPABASE_URL = "https://dtpfhwxwodzpitzmrbqr.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0cGZod3h3b2R6cGl0em1yYnFyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTc4NDE5MCwiZXhwIjoyMDg3MzYwMTkwfQ.unqVuW0ZzNv5MYVHcHHqrmhN2wFe4McuhyzTEERpGLU";

async function fixCHO8Letter() {
    // 1. Buscar el proyecto AC-200024
    const projRes = await fetch(`${SUPABASE_URL}/rest/v1/projects?project_number=eq.AC-200024&select=id,project_number,name`, {
        headers: {
            'apikey': SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json'
        }
    });
    const projects = await projRes.json();
    console.log("Proyectos encontrados:", JSON.stringify(projects, null, 2));

    if (!projects || projects.length === 0) {
        console.log("❌ Proyecto AC-200024 no encontrado");
        return;
    }

    const projectId = projects[0].id;
    console.log(`✅ Proyecto encontrado: ${projects[0].name} (ID: ${projectId})`);

    // 2. Buscar el CHO #8 de ese proyecto
    const choRes = await fetch(`${SUPABASE_URL}/rest/v1/chos?project_id=eq.${projectId}&cho_num=eq.8&select=id,cho_num,amendment_letter,cho_date,doc_status`, {
        headers: {
            'apikey': SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json'
        }
    });
    const chos = await choRes.json();
    console.log("CHO #8 encontrado:", JSON.stringify(chos, null, 2));

    if (!chos || chos.length === 0) {
        console.log("❌ CHO #8 no encontrado en el proyecto AC-200024");
        return;
    }

    const cho = chos[0];
    console.log(`\n📋 CHO #8 actual: amendment_letter = "${cho.amendment_letter}"`);

    if (cho.amendment_letter === 'H') {
        console.log("✅ El CHO #8 ya tiene la letra H correcta. No se requiere corrección.");
        return;
    }

    // 3. Actualizar la letra a "H"
    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/chos?id=eq.${cho.id}`, {
        method: 'PATCH',
        headers: {
            'apikey': SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({ amendment_letter: 'H' })
    });

    if (updateRes.ok) {
        const updated = await updateRes.json();
        console.log(`\n✅ CORRECCIÓN EXITOSA:`);
        console.log(`   CHO #8 - Letra anterior: "${cho.amendment_letter}" → Nueva letra: "H"`);
        console.log("Resultado:", JSON.stringify(updated, null, 2));
    } else {
        const err = await updateRes.text();
        console.log(`❌ Error al actualizar: ${err}`);
    }
}

fixCHO8Letter().catch(console.error);
