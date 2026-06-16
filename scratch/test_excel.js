const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Cargar variables de entorno de .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Error: Falta configurar variables de Supabase.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
    try {
        // Obtener el primer proyecto
        const { data: projects, error: pErr } = await supabase.from('projects').select('id, name, num_act').limit(1);
        if (pErr) throw pErr;
        if (!projects || projects.length === 0) {
            console.log("No se encontraron proyectos en la base de datos.");
            return;
        }

        const project = projects[0];
        console.log(`Proyecto de prueba: ${project.name} | ACT: ${project.num_act} | ID: ${project.id}`);

        // Cargar dinámicamente o requerir la lógica
        // generateDashboardExcel usa ES modules (import/export), para ejecutarlo directamente en Node.js
        // podemos usar un script dinámico que transpile o simular la llamada convirtiendo a CommonJS.
        // O bien, podemos compilar con webpack/next temporalmente o ejecutar un script de TS con ts-node.
        // Usemos ts-node o @babel/register para correr el archivo TypeScript generateDashboardExcel.ts.
    } catch (err) {
        console.error("Error:", err);
    }
}

test();
