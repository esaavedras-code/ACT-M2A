
const nodemailer = require('nodemailer');

async function sendDiagnosticEmail() {
  console.log("=== DIAGNOSTIC EMAIL TEST ===");
  const emailData = {
    to: "esaavedras@gmail.com",
    subject: "🔍 DIAGNÓSTICO: Prueba de Envío",
    html: "<b>Este es un correo de diagnóstico para validar el sistema de invitaciones.</b>"
  };

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: 'admin.pact@gmail.com',
        pass: 'ckzpmmfxlaxfforg',
      },
      debug: true, // Enable debug
      logger: true // Enable logger
    });

    console.log("Iniciando envío SMTP...");
    const info = await transporter.sendMail({
      from: '"PACT Admin" <admin.pact@gmail.com>',
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html
    });
    
    console.log("✅ ÉXITO SMTP:", info.messageId);
    console.log("Respuesta del servidor:", info.response);
  } catch (err) {
    console.error("❌ ERROR SMTP:", err);
  }
}

sendDiagnosticEmail();
