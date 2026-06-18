import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixCert13() {
  const { data, error } = await supabase
    .from('payment_certifications')
    .select('*')
    .eq('cert_num', 13);

  if (error) {
    console.error("Error fetching certs:", error);
    return;
  }

  for (const cert of data) {
    let modified = false;
    const newItems = cert.items.map(it => {
      if ((it.item_num === '022' || it.item_num === 22) && it.has_material_on_site) {
        console.log("Found Item 022 in Cert 13", it);
        it.mos_quantity = 3;
        it.mos_unit_price = (parseFloat(it.mos_invoice_total) / 3).toFixed(2);
        modified = true;
      }
      return it;
    });

    if (modified) {
      console.log("Updating Cert 13 ID:", cert.id);
      const { error: updateError } = await supabase
        .from('payment_certifications')
        .update({ items: newItems })
        .eq('id', cert.id);
        
      if (updateError) {
        console.error("Error updating:", updateError);
      } else {
        console.log("Successfully updated Cert 13.");
      }
    }
  }
}

fixCert13();
