const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
    const { data: proj } = await supabase.from('projects').select('id, project_number, items').ilike('project_number', 'ac-017418').single();
    if (!proj) return console.log("Project not found");
    console.log("Found project:", proj.project_number);
    const { data: chos } = await supabase.from('chos').select('id, cho_number, doc_status, items, cho_date').eq('project_id', proj.id);
    
    for (const cho of chos) {
        console.log("CHO", cho.cho_number, "status", cho.doc_status, "Array.isArray(cho.items):", Array.isArray(cho.items));
        const choItems = Array.isArray(cho.items) ? cho.items : cho.items?.list || [];
        const choItem63 = choItems.find(i => i.item_num == '063' || i.item_num == 63);
        if (choItem63) {
            console.log("  => Item 63 price:", choItem63.unit_price);
        }
    }
}
check();
