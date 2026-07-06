const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase URL or Anon Key in env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  console.log("Fetching one row from payment_certifications to inspect columns...");
  const { data, error } = await supabase
    .from('payment_certifications')
    .select('*')
    .limit(1);

  if (error) {
    console.error("Error fetching payment_certifications:", error);
    return;
  }

  if (data && data.length > 0) {
    console.log("Columns found on existing record:", Object.keys(data[0]));
  } else {
    console.log("No records found in payment_certifications, trying to fetch schema info...");
    // If no rows, we can fetch metadata or do a RPC if available,
    // but usually there is at least one record. Let's try to insert/rollback or inspect via PostgREST
    // Let's do an API call to PostgREST representation of public schema
    const res = await fetch(`${supabaseUrl}/rest/v1/?apikey=${supabaseAnonKey}`);
    const schema = await res.json();
    if (schema && schema.definitions && schema.definitions.payment_certifications) {
      console.log("Schema properties:", Object.keys(schema.definitions.payment_certifications.properties));
    } else {
      console.log("Could not retrieve schema definitions");
    }
  }
}

main().catch(console.error);
