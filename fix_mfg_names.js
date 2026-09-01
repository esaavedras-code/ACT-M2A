const { createClient } = require('@supabase/supabase-js');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

async function run() {
    const { data: certs, error } = await supabase.from('manufacturing_certificates').select('id, project_id, cert_file_name, cert_file_path').like('cert_file_name', '%AC-XXXXXX%');
    if (error) { console.error("Error fetching certs:", error); return; }
    
    console.log(`Found ${certs.length} certs with AC-XXXXXX`);

    const projectIds = [...new Set(certs.map(c => c.project_id).filter(Boolean))];
    if (projectIds.length === 0) { console.log("No projects found for certs"); return; }
    
    const { data: projects, error: err2 } = await supabase.from('projects').select('id, num_act').in('id', projectIds);
    const projMap = {};
    if (projects) projects.forEach(p => projMap[p.id] = p.num_act);

    for (let c of certs) {
        if (!c.cert_file_path || !c.cert_file_name || !c.project_id) continue;
        
        let numAct = projMap[c.project_id];
        if (!numAct) continue;
        
        let projectStr = numAct.startsWith('AC-') ? numAct : `AC-${numAct}`;
        let newName = c.cert_file_name.replace('AC-XXXXXX', projectStr);
        let newPath = c.cert_file_path.replace('AC-XXXXXX', projectStr);

        console.log(`Renaming: ${c.cert_file_name} -> ${newName}`);

        // Rename in storage
        const { data: moveData, error: moveError } = await supabase.storage.from('project-documents').move(c.cert_file_path, newPath);
        if (moveError) {
            console.error(`Error moving storage for ${c.cert_file_path}`, moveError.message);
        }
        
        // Update manufacturing_certificates
        await supabase.from('manufacturing_certificates').update({
            cert_file_name: newName,
            cert_file_path: newPath
        }).eq('id', c.id);

        // Update project_documents (using like in case of paths)
        await supabase.from('project_documents').update({
            file_name: newName,
            storage_path: newPath
        }).eq('storage_path', c.cert_file_path);
    }
    console.log("Done");
}

run();
