const { execSync } = require('child_process');

try {
    console.log("Setting production key...");
    execSync('npx vercel env add SUPABASE_SERVICE_ROLE_KEY production', {
        input: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0cGZod3h3b2R6cGl0em1yYnFyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTc4NDE5MCwiZXhwIjoyMDg3MzYwMTkwfQ.unqVuW0ZzNv5MYVHcHHqrmhN2wFe4McuhyzTEERpGLU',
        stdio: ['pipe', 'inherit', 'inherit']
    });
    
    console.log("Setting preview key...");
    execSync('npx vercel env add SUPABASE_SERVICE_ROLE_KEY preview', {
        input: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0cGZod3h3b2R6cGl0em1yYnFyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTc4NDE5MCwiZXhwIjoyMDg3MzYwMTkwfQ.unqVuW0ZzNv5MYVHcHHqrmhN2wFe4McuhyzTEERpGLU',
        stdio: ['pipe', 'inherit', 'inherit']
    });

    console.log("Setting development key...");
    execSync('npx vercel env add SUPABASE_SERVICE_ROLE_KEY development', {
        input: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0cGZod3h3b2R6cGl0em1yYnFyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTc4NDE5MCwiZXhwIjoyMDg3MzYwMTkwfQ.unqVuW0ZzNv5MYVHcHHqrmhN2wFe4McuhyzTEERpGLU',
        stdio: ['pipe', 'inherit', 'inherit']
    });
    
    console.log("Adding to .env.local via pull...");
    execSync('npx vercel env pull .env.local -y', { stdio: 'inherit' });
    
} catch(err) {
    console.error("Error setting vercel envs", err);
}
