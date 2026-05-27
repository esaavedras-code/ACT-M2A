const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
    const { data: project } = await supabase.from('projects').select('id, num_act').eq('num_act', 'AC-017630').single();
    if (!project) {
        console.log("Proyecto no encontrado");
        return;
    }
    console.log("Proyecto encontrado:", project);

    const { data: items } = await supabase.from('contract_items').select('id, item_num, specification, description, quantity, unit, requires_mfg_cert').eq('project_id', project.id);
    const { data: certs } = await supabase.from('payment_certifications').select('cert_num, cert_date, items').eq('project_id', project.id);
    const { data: mfgCerts } = await supabase.from('mfg_certs').select('item_id, item_num, quantity, cert_date').eq('project_id', project.id);

    console.log("\n--- ITEMS DEL CONTRATO QUE REQUIEREN CM ---");
    const targetItems = items.filter(it => it.requires_mfg_cert);
    targetItems.forEach(it => {
        console.log(`Item: ${it.item_num} | Spec: ${it.specification} | Cant. Contrato: ${it.quantity} | Unit: ${it.unit}`);
    });

    console.log("\n--- ENTRADAS DE MFG CERTS ---");
    mfgCerts.forEach(mc => {
        const it = items.find(i => i.id === mc.item_id);
        console.log(`Item: ${it?.item_num || mc.item_num} | Cant. CM: ${mc.quantity} | Fecha: ${mc.cert_date}`);
    });

    console.log("\n--- CANTIDADES EN CERTIFICACIONES DE PAGO ---");
    certs.forEach(c => {
        const certItems = Array.isArray(c.items) ? c.items : (c.items?.list || []);
        certItems.forEach(ci => {
            const matched = targetItems.find(ti => ti.item_num === ci.item_num);
            if (matched) {
                console.log(`Cert #${c.cert_num} (${c.cert_date}) | Item: ${ci.item_num} | Qty Pagada: ${ci.quantity}`);
            }
        });
    });
}

test().catch(console.error);
