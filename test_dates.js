require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase.from('projects').select('*').limit(1);
  if (error) {
    console.error(error);
  } else {
    const p = data[0];
    console.log("Date contract sign:", p.date_contract_sign, "Type:", typeof p.date_contract_sign);
    console.log("Date project start:", p.date_project_start, "Type:", typeof p.date_project_start);
    console.log("All keys:", Object.keys(p).filter(k => k.includes('date')));
  }
}
test();
