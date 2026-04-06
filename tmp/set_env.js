const { execSync } = require('child_process');
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0cGZod3h3b2R6cGl0em1yYnFyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTc4NDE5MCwiZXhwIjoyMDg3MzYwMTkwfQ.unqVuW0ZzNv5MYVHcHHqrmhN2wFe4McuhyzTEERpGLU";

try {
    console.log("Configurando SUPABASE_SERVICE_ROLE_KEY...");
    // Eliminamos la variable si ya existe para asegurar que el valor sea correcto sin saltos de linea
    try {
        execSync(`npx vercel env rm SUPABASE_SERVICE_ROLE_KEY production --yes`);
    } catch(e) { /* ignore if not exist */ }
    
    // Usamos el proceso de entrada estándar para evitar problemas con el shell y saltos de línea
    const cp = require('child_process').spawn('npx', ['vercel', 'env', 'add', 'SUPABASE_SERVICE_ROLE_KEY', 'production', '--yes']);
    cp.stdin.write(key);
    cp.stdin.end();
    
    cp.stdout.on('data', (data) => console.log(data.toString()));
    cp.stderr.on('data', (data) => console.error(data.toString()));
    
} catch (error) {
    console.error("ERROR configurando ENV:", error);
}
