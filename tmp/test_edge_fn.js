
const https = require('https');

const emailData = JSON.stringify({
  to: "esaavedras@gmail.com",
  subject: "Prueba directa Edge Function Supabase",
  html: "<b>Esta prueba llama directamente a la Edge Function de Supabase send-email</b>"
});

const options = {
  hostname: 'dtpfhwxwodzpitzmrbqr.supabase.co',
  path: '/functions/v1/send-email',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(emailData)
  }
};

const req = https.request(options, (res) => {
  let body = '';
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('RESPONSE:', body);
  });
});

req.on('error', (e) => {
  console.error(`ERROR: ${e.message}`);
});

req.write(emailData);
req.end();
