const nodemailer = require('nodemailer');

async function testGmail() {
    console.log("Testeando SMTP...");
    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
            user: 'admin.pact@gmail.com',
            pass: 'ckzpmmfxlaxfforg' // El password de la linea 58 de route.ts
        }
    });

    try {
        await transporter.verify();
        console.log("✅ Conexión SMTP exitosa");
        
        const info = await transporter.sendMail({
            from: '"Test" <admin.pact@gmail.com>',
            to: 'admin.pact@gmail.com',
            subject: 'Test de Conexión',
            text: 'Si ves esto, el SMTP funciona.'
        });
        console.log("✅ Email de prueba enviado:", info.messageId);
    } catch (error) {
        console.error("❌ ERROR SMTP:", error);
    }
}

testGmail();
