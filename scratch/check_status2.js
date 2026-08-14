const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
    const { data: chos } = await supabase.from('chos').select('cho_number, doc_status, project_id, items, cho_date');
    const projectChos = chos.filter(c => c.items);
    console.log(projectChos.map(c => ({num: c.cho_number, status: c.doc_status})));
}
check();
