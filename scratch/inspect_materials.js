const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectMaterials() {
    try {
        console.log("Conectando a Supabase...");

        // 1. Ver qué campos tienen initial_certifications e initial_certification_items
        const { data: icSample } = await supabase.from('initial_certifications').select('*').limit(1);
        if (icSample && icSample.length > 0) {
            console.log("\nCampos de initial_certifications:", Object.keys(icSample[0]));
            console.log("Ejemplo de initial_certification:", icSample[0]);
        }

        const { data: iciSample } = await supabase.from('initial_certification_items').select('*').limit(1);
        if (iciSample && iciSample.length > 0) {
            console.log("\nCampos de initial_certification_items:", Object.keys(iciSample[0]));
            console.log("Ejemplo de initial_certification_item:", iciSample[0]);
        }

        // 2. Ver si en projects.liquidation_data hay alguna sección de materiales rechazados o con descuento
        const { data: projectsData } = await supabase.from('projects').select('id, num_act, liquidation_data');
        projectsData.forEach(p => {
            if (p.liquidation_data) {
                console.log(`\nProyecto: ${p.num_act} - Llaves en liquidation_data:`, Object.keys(p.liquidation_data));
                console.log("Contenido completo de liquidation_data:", JSON.stringify(p.liquidation_data, null, 2));
            }
        });

    } catch (e) {
        console.error("Error:", e);
    }
}

inspectMaterials();
