export const dynamic = 'force-dynamic';
// IMPORTANTE: nodemailer requiere el runtime de Node.js, NO funciona en el Edge Runtime de Vercel
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';


export async function POST(req: Request) {
    console.log('--- API: Recibida solicitud de envío de email ---');
    try {
        const body = await req.json();
        const { to, subject, html, text } = body;

        console.log(`Destinatario: ${to}`);
        console.log(`Asunto: ${subject}`);
        console.log(`Password configurado: ${process.env.SMTP_PASS ? 'SÍ (desde ENV)' : 'NO (usando fallback)'}`);

        if (!to || !subject || (!html && !text)) {
            console.error('API Error: Faltan campos');
            return NextResponse.json({ error: 'Faltan campos requeridos (to, subject, html o text)' }, { status: 400 });
        }

        // Configuración de Transporter más robusta
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            pool: true, // Usar pooling para mejor rendimiento en Next.js
            auth: {
                user: 'admin.pact@gmail.com',
                pass: process.env.SMTP_PASS || 'ckzpmmfxlaxfforg',
            },
        });

        console.log('Verificando conexión SMTP...');
        await transporter.verify();
        console.log('Conexión SMTP verificada correctamente.');

        const mailOptions = {
            from: '"PACT Platform" <admin.pact@gmail.com>',
            to,
            subject,
            text: text || "Solicitud de acceso PACT",
            html: html,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Mensaje enviado con éxito vía API! MessageId:', info.messageId);

        return NextResponse.json({ success: true, messageId: info.messageId });
    } catch (error: any) {
        console.error('❌ ERROR FATAL en API de Email:', error);
        return NextResponse.json({ 
            error: error.message || 'Error interno al enviar email',
            details: error.toString() 
        }, { status: 500 });
    }
}

