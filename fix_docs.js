const { createClient } = require('@supabase/supabase-js');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY || key);

async function run() {
    const { data: docs, error } = await supabase.from('project_documents').select('id, project_id, file_name, storage_path').like('file_name', '%AC-XXXXXX%');
    if (error) { console.error("Error fetching docs:", error); return; }
    
    console.log(`Found ${docs.length} docs with AC-XXXXXX`);

    const projectIds = [...new Set(docs.map(c => c.project_id).filter(Boolean))];
    if (projectIds.length === 0) { console.log("No projects found for docs"); return; }
    
    const { data: projects, error: err2 } = await supabase.from('projects').select('id, num_act').in('id', projectIds);
    const projMap = {};
    if (projects) projects.forEach(p => projMap[p.id] = p.num_act);

    for (let c of docs) {
        if (!c.storage_path || !c.file_name || !c.project_id) continue;
        
        let numAct = projMap[c.project_id];
        if (!numAct) continue;
        
        let projectStr = numAct.startsWith('AC-') ? numAct : `AC-${numAct}`;
        let newName = c.file_name.replace('AC-XXXXXX', projectStr);
        let newPath = c.storage_path.replace('AC-XXXXXX', projectStr);

        console.log(`Renaming: ${c.file_name} -> ${newName}`);

        const { data: moveData, error: moveError } = await supabase.storage.from('project-documents').move(c.storage_path, newPath);
        if (moveError) {
            console.error(`Error moving storage for ${c.storage_path}`, moveError.message);
        }
        
        await supabase.from('project_documents').update({
            file_name: newName,
            storage_path: newPath
        }).eq('id', c.id);
    }
    console.log("Done");
}

run();
