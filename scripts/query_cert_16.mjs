import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const normalizeItemNum = (num) => {
    if (num === undefined || num === null) return "";
    const str = num.toString().trim();
    if (/^\d+$/.test(str)) {
        return str.padStart(3, '0');
    }
    return str;
};

async function checkCert16() {
  const { data: allCerts, error } = await supabase
    .from('payment_certifications')
    .select('*')
    .order('cert_num', { ascending: false });

  if (error) {
    console.error("Error fetching certs:", error);
    return;
  }

  const getInvoicePUFromList = (certs, itemNum, currentCertIdx) => {
      if (!certs) return 0;
      for (let i = currentCertIdx; i < certs.length; i++) {
          const cert = certs[i];
          const items = cert?.items || [];
          const match = items.find(it => normalizeItemNum(it.item_num) === normalizeItemNum(itemNum) && it.has_material_on_site && (parseFloat(it.mos_unit_price) > 0));
          if (match) return parseFloat(match.mos_unit_price);
      }
      return 0;
  };

  const certIdx = allCerts.findIndex(c => c.cert_num === 16);
  if (certIdx === -1) {
    console.log("Cert 16 not found.");
    return;
  }

  const c = allCerts[certIdx];
  let certWork = 0;
  let certMOSNet = 0;
  
  (c.items || []).forEach(item => {
      const q = parseFloat(item.quantity) || 0;
      const p = parseFloat(item.unit_price) || 0;
      certWork += q * p;

      const addedMOS = item.has_material_on_site ? (parseFloat(item.mos_invoice_total) || 0) : 0;
      const mosPU = getInvoicePUFromList(allCerts, item.item_num, certIdx);
      const deductedMOS = (parseFloat(item.qty_from_mos) || 0) * (mosPU > 0 ? mosPU : p);
      certMOSNet += addedMOS - deductedMOS;
      
      if (addedMOS > 0 || deductedMOS > 0) {
          console.log(`Item ${item.item_num}: Added MOS=$${addedMOS}, Deducted MOS=$${deductedMOS} (Qty:${item.qty_from_mos} * PU:${mosPU > 0 ? mosPU : p})`);
      }
  });

  const certRetention = (c.items || []).reduce((acc, it) => {
      if (it.skip_retention) return acc;
      if ((it.specification || "").toString().trim() === "888-150" || (it.item_num || "").toString().trim() === "888-150") return acc;
      return acc + ((parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0) * 0.05);
  }, 0) - (c.retention_return_amount || 0);

  const certNetChange = certWork 
      - (c.skip_retention ? 0 : (certRetention < 0 && !c.show_retention_return ? 0 : certRetention)) 
      + certMOSNet
      - (parseFloat(c.liquidated_damages) || 0)
      - (parseFloat(c.extra_retention) || 0)
      + (parseFloat(c.price_adjustment) || 0)
      - (parseFloat(c.insurance_fines) || 0)
      - (parseFloat(c.other_penalties) || 0);

  console.log("--- Cert 16 Summary ---");
  console.log("Work Executed:", certWork);
  console.log("Retention:", certRetention);
  console.log("MOS Net:", certMOSNet);
  console.log("Net Certified:", certNetChange);
}

checkCert16();
