import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// Cargar variables de entorno de .env.local al primerísimo inicio
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Error: Falta configurar variables de Supabase.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
    try {
        const { data: projects, error: pErr } = await supabase.from('projects').select('id, name, num_act').limit(1);
        if (pErr) throw pErr;
        if (!projects || projects.length === 0) {
            console.log("No se encontraron proyectos en la base de datos.");
            return;
        }

        const project = projects[0];
        console.log(`Proyecto de prueba: ${project.name} | ACT: ${project.num_act} | ID: ${project.id}`);

        console.log("Importando generateDashboardExcel dinámicamente...");
        const { generateDashboardExcel } = await import('../src/lib/generateDashboardExcel');

        console.log("Generando reporte Excel...");
        const blob = await generateDashboardExcel(project.id);
        
        // Convertir Blob a Buffer para escribir en archivo
        const arrayBuffer = await blob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        const outputPath = path.join(__dirname, `Dashboard_Ejecutivo_Prueba_${project.num_act}.xlsx`);
        fs.writeFileSync(outputPath, buffer);
        console.log(`Reporte Excel de prueba generado con éxito en: ${outputPath}`);
    } catch (err) {
        console.error("Error en la prueba:", err);
    }
}

test();
