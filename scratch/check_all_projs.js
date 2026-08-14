const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
    const { data: projs, error } = await supabase.from('projects').select('project_number');
    if (error) console.log("Error:", error);
    console.log("All projects:", projs?.map(p => p.project_number).join(', '));
}
check();
