const nodemailer = require('nodemailer');

async function sendFixedEmail() {
    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
            user: 'admin.pact@gmail.com',
            pass: 'ckzpmmfxlaxfforg'
        }
    });

    const emailText = `Hola Enrique Saavedra Sada,

Este es un recordatorio automático del Programa ACT.

El documento de cumplimiento laboral "Registro Único de Licitadores (Bonneville Contracting and Technology Group, LLC)" vencerá en menos de 2 semanas (Fecha: 09/18/2026).

Por favor, actualice el documento en el sistema lo antes posible para evitar penalidades o retrasos.`;

    try {
        await transporter.verify();
        const info = await transporter.sendMail({
            from: '"PACT Platform" <admin.pact@gmail.com>',
            to: 'esaavedras@gmail.com',
            subject: 'Recordatorio automático del Programa ACT (Corregido)',
            text: emailText
        });
        console.log("Email enviado exitosamente:", info.messageId);
    } catch (error) {
        console.error("Error enviando email:", error);
    }
}

sendFixedEmail();
