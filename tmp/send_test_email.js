
const nodemailer = require('nodemailer');

async function sendTestEmail() {
  const emailData = {
    to: "esaavedras@gmail.com",
    subject: "🚀 PRUEBA: Invitación PACT (Prueba de Sistema)",
    html: `
      <div style="font-family: sans-serif; padding: 30px; border: 1px solid #eee; border-radius: 20px; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">¡Prueba de Sistema PACT!</h2>
        <p>Este es un correo de prueba enviado directamente desde el script de validación.</p>
        <div style="background: #f8fafc; padding: 25px; border-radius: 12px; margin: 25px 0; border: 1px solid #e2e8f0;">
          <p style="margin: 0;"><strong>Remitente:</strong> admin.pact@gmail.com</p>
          <p style="margin: 10px 0 0 0;"><strong>Estado:</strong> Sistema de Email validado con éxito ✅</p>
        </div>
        <p style="color: #475569; line-height: 1.6;">Si recibes este mensaje, significa que los credenciales de Gmail son correctos y el puente para la Web funcionará sin problemas.</p>
      </div>
    `
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
    });

    console.log("Enviando correo a " + emailData.to + "...");
    const info = await transporter.sendMail({
      from: '"PACT Platform" <admin.pact@gmail.com>',
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html
    });
    console.log('✅ Mensaje enviado: %s', info.messageId);
  } catch (err) {
    console.error("❌ Error en el envío:", err);
  }
}

sendTestEmail();
