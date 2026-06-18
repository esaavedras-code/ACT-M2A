import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkItem() {
  const { data, error } = await supabase
    .from('payment_certifications')
    .select('*')
    .order('cert_num', { ascending: false });

  if (error) {
    console.error("Error fetching certs:", error);
    return;
  }

  const itemsHistory = [];
  data.forEach(cert => {
    const item022 = cert.items?.find(it => it.item_num === '022' || it.item_num === 22);
    if (item022) {
      itemsHistory.push({
        cert_num: cert.cert_num,
        qty: item022.quantity,
        unit_price: item022.unit_price,
        has_mos: item022.has_material_on_site,
        mos_invoice_total: item022.mos_invoice_total,
        mos_quantity: item022.mos_quantity,
        mos_unit_price: item022.mos_unit_price,
        qty_from_mos: item022.qty_from_mos
      });
    }
  });

  console.log("History for Item 022:");
  console.log(JSON.stringify(itemsHistory, null, 2));
}

checkItem();
