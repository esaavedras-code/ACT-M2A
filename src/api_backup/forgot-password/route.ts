export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from "next/server";
import nodemailer from 'nodemailer';

export const runtime = 'nodejs';

// La URL se puede mantener afuera porque es pública
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export async function POST(req: Request) {
    console.log('--- API: Recibida solicitud de recuperación de contraseña ---');
    try {
        const { email: rawEmail } = await req.json();
        const email = rawEmail?.trim().toLowerCase();

        if (!email) {
            return NextResponse.json({ error: "Email requerido" }, { status: 400 });
        }

        // Obtener la Service Role Key JUSTO AHORA para asegurar que lee el env actual de Vercel/Server
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        
        if (!serviceRoleKey || serviceRoleKey.startsWith('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0cGZod3h3b2R6cGl0em1yYnFyIiwicm9sZSI6ImFub24i')) {
             console.error('❌ ERROR: SUPABASE_SERVICE_ROLE_KEY es inválida o es la ANON_KEY');
             return NextResponse.json({ 
                 error: "Error de configuración del servidor. Por favor, verifique las variables de entorno en Vercel.",
                 details: "Service Role Key is missing or incorrectly set to Anon Key."
             }, { status: 500 });
        }

        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        console.log(`Buscando usuario en la base de datos: ${email}`);

        // 1. Buscar usuario en la tabla pública para confirmar existencia y obtener nombre
        const { data: user, error: userError } = await supabaseAdmin
            .from("users")
            .select("id, name")
            .eq("email", email)
            .single();

        if (userError || !user) {
            console.error('API Error: Usuario no encontrado en tabla public.users:', userError?.message || 'Sin datos');
            return NextResponse.json({ error: "No se encontró una cuenta activa con ese correo electrónico en el sistema." }, { status: 404 });
        }

        // 2. Generar contraseña temporal segura
        const tempPassword = "PACT-" + Math.random().toString(36).substring(2, 8).toUpperCase();
        console.log(`Generada contraseña temporal para ${email}`);

        // 3. Actualizar contraseña en Supabase Auth usando el Admin SDK
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
            user.id,
            { password: tempPassword }
        );

        if (authError) {
            console.error('API Error: Error al actualizar contraseña en Auth:', authError.message);
            return NextResponse.json({ 
                error: "Error de Supabase al actualizar las credenciales.",
                details: authError.message 
            }, { status: 500 });
        }

        // 4. Configurar y verificar Transporter (usando pool para mayor éxito en Vercel)
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            pool: true,
            auth: {
                user: 'admin.pact@gmail.com',
                pass: process.env.SMTP_PASS || 'ckzpmmfxlaxfforg',
            },
            tls: {
                rejectUnauthorized: false // Aumenta compatibilidad en algunos entornos cloud
            }
        });

        try {
            console.log('Verificando conexión SMTP antes de enviar...');
            await transporter.verify();
        } catch (smtpVerifyError: any) {
            console.error('❌ Error de conexión SMTP:', smtpVerifyError);
            return NextResponse.json({ 
                error: "Error de conexión con el servidor de correo.",
                details: smtpVerifyError.message 
            }, { status: 500 });
        }

        const mailOptions = {
            from: '"PACT Platform" <admin.pact@gmail.com>',
            to: email,
            subject: "Recuperación de Contraseña - PACT",
            text: `Hola ${user.name || 'Usuario'},\n\nSe ha solicitado una recuperación de contraseña para tu cuenta de PACT.\n\nTu contraseña temporal es: ${tempPassword}\n\nPor favor, inicia sesión y cambia tu contraseña lo antes posible.\n\nSaludos,\nEquipo PACT`,
            html: `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #1e293b; background-color: #f8fafc; border-radius: 20px;">
                    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 24px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
                        <h2 style="color: #0056b3; margin-top: 0; font-weight: 900; text-transform: uppercase; letter-spacing: -0.025em;">Recuperación de Contraseña</h2>
                        <p style="font-size: 16px; line-height: 1.6;">Hola <strong>${user.name || 'Usuario'}</strong>,</p>
                        <p style="font-size: 16px; line-height: 1.6;">Se ha solicitado una recuperación de contraseña para tu acceso a la plataforma <strong>PACT Control de Obras</strong>.</p>
                        
                        <div style="background-color: #f0f7ff; padding: 24px; border-radius: 16px; text-align: center; margin: 32px 0; border: 1px solid #cce3f6;">
                            <p style="margin: 0; font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 800; letter-spacing: 0.1em;">Nueva Contraseña Temporal</p>
                            <p style="margin: 8px 0 0 0; font-size: 32px; font-weight: 900; color: #0056b3; letter-spacing: 4px; font-family: monospace;">${tempPassword}</p>
                        </div>
                        
                        <p style="font-size: 14px; line-height: 1.6; color: #475569;">Por favor, utiliza esta clave para entrar al sistema. Una vez dentro, se te pedirá que la cambies por una de tu elección por motivos de seguridad.</p>
                        
                        <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #f1f5f9; text-align: center;">
                            <p style="font-size: 12px; color: #94a3b8; font-weight: 600;">¿No has solicitado este cambio? Ignora este mensaje o contacta a soporte.</p>
                            <p style="font-size: 10px; color: #cbd5e1; text-transform: uppercase; font-weight: 800; margin-top: 16px;">M2A Group - Programa ACT v3.25</p>
                        </div>
                    </div>
                </div>
            `,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Email de recuperación enviado a ${email}. MessageId: ${info.messageId}`);

        return NextResponse.json({ success: true, message: "Contraseña temporal enviada correctamente." });
    } catch (error: any) {
        console.error("❌ ERROR FATAL en API Forgot Password:", error);
        return NextResponse.json({ 
            error: "Error interno en el servidor al procesar la recuperación de contraseña.",
            details: error.message || error.toString()
        }, { status: 500 });
    }
}

