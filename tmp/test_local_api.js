
const http = require('http');

async function testApi() {
  const data = JSON.stringify({
    to: "esaavedras@gmail.com",
    subject: "Prueba desde Node (HTTP a Localhost)",
    html: "<b>Esta prueba llama al endpoint local http://localhost:3000/api/send-email</b>"
  });

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/send-email',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  const req = http.request(options, (res) => {
    let responseBody = '';
    console.log(`STATUS: ${res.statusCode}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => responseBody += chunk);
    res.on('end', () => {
      console.log('RESPONSE:', responseBody);
    });
  });

  req.on('error', (e) => {
    console.error(`Error en la petición: ${e.message}`);
  });

  req.write(data);
  req.end();
}

testApi();
