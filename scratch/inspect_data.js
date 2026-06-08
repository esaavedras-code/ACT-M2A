const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectProject() {
    const projectId = "2e0d8d80-3542-451c-bbef-63a791012e34"; // AC-017630
    try {
        console.log(`Inspeccionando proyecto: ${projectId}`);
        
        // 1. Datos del proyecto
        const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single();
        console.log("Proyecto:", {
            id: project.id,
            num_act: project.num_act,
            num_federal: project.num_federal,
            num_contrato: project.num_contrato,
            date_project_start: project.date_project_start,
            date_real_completion: project.date_real_completion,
            date_substantial_completion: project.date_substantial_completion,
            liquidation_data: project.liquidation_data
        });

        // 2. Obtener chos
        const { data: chos } = await supabase.from('chos').select('*').eq('project_id', projectId);
        console.log(`\nChange Orders (CHOs) encontrados: ${chos.length}`);
        chos.forEach(c => {
            console.log(`- CHO #${c.cho_num}, status: ${c.status}, approved_date: ${c.approved_date}`);
        });

        // 3. Obtener certificaciones de pago
        const { data: certs } = await supabase.from('payment_certifications').select('*').eq('project_id', projectId).order('cert_num');
        console.log(`\nCertificaciones de pago encontradas: ${certs.length}`);
        
        // 4. Obtener contract_items
        const { data: items } = await supabase.from('contract_items').select('*').eq('project_id', projectId);
        console.log(`\nContract Items encontrados: ${items.length}`);
        
        // Ver las propiedades de un contract_item
        if (items.length > 0) {
            console.log("Campos de un item:", Object.keys(items[0]));
        }

        // 5. Obtener certificados de manufactura
        const { data: mfgCerts } = await supabase.from('manufacturing_certificates').select('*').eq('project_id', projectId);
        console.log(`\nCertificados de manufactura encontrados: ${mfgCerts.length}`);
        if (mfgCerts.length > 0) {
            console.log("Campos de mfgCert:", Object.keys(mfgCerts[0]));
            console.log("Ejemplo de mfgCert:", mfgCerts[0]);
        }

        // 6. Vamos a buscar si hay algún item con descuento o rechazado
        // Busquemos en la base de datos de contract_items si hay algún campo JSON o columna relevante que indique estado de aceptación/descuento/rechazo.
        // O si hay en liquidation_data algo sobre descuento o materiales rechazados.
        console.log("\nInspección de liqudiation_data del proyecto:");
        console.log(JSON.stringify(project.liquidation_data, null, 2));

        // Veamos si hay certificados de manufactura notarizados o algo
        const notarized = mfgCerts.filter(c => c.notarized);
        console.log(`\nCertificados notarizados: ${notarized.length}`);

    } catch (e) {
        console.error("Error:", e);
    }
}

inspectProject();
