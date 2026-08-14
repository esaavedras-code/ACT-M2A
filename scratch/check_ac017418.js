const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
    const { data: proj } = await supabase.from('projects').select('id, project_number, items').eq('project_number', 'ac-017418').single();
    if (!proj) return console.log("Project not found");
    const { data: chos } = await supabase.from('chos').select('id, cho_number, doc_status, items').eq('project_id', proj.id);
    
    const items = Array.isArray(proj.items) ? proj.items : proj.items?.list || [];
    const item63 = items.find(i => i.item_num == '063' || i.item_num == 63);
    console.log("Contract item 63:", item63);

    for (const cho of chos) {
        const choItems = Array.isArray(cho.items) ? cho.items : cho.items?.list || [];
        const choItem63 = choItems.find(i => i.item_num == '063' || i.item_num == 63);
        if (choItem63) {
            console.log("CHO", cho.cho_number, "status", cho.doc_status, "item 63:", choItem63);
        }
        console.log("CHO", cho.cho_number, "Array.isArray(cho.items):", Array.isArray(cho.items));
    }
}
check();
