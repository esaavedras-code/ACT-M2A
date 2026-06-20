import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const smtpUser = process.env.SMTP_USER || 'admin.pact@gmail.com';
const smtpPass = process.env.SMTP_PASS || '';

// Genera una contraseña temporal tipo PACT-XXXXXXXX
function generateTempPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let suffix = '';
    for (let i = 0; i < 8; i++) {
        suffix += chars[Math.floor(Math.random() * chars.length)];
    }
    return `PACT-${suffix}`;
}

// HTML del email de recuperación, mismo estilo que el de acceso directo
function buildEmailHTML(email: string, tempPassword: string, appUrl: string): string {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Recuperación de Contraseña - PACT</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a56db,#1e40af);padding:40px 32px;text-align:center;">
              <div style="font-size:32px;margin-bottom:8px;">🔐</div>
              <h1 style="color:#ffffff;font-size:28px;font-weight:900;margin:0;letter-spacing:-0.5px;">PACT</h1>
              <p style="color:rgba(255,255,255,0.75);font-size:13px;margin:4px 0 0;">Sistema de Gestión de Proyectos de Carreteras</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <h2 style="color:#1e293b;font-size:22px;font-weight:800;margin:0 0 12px;">Recuperación de Contraseña</h2>
              <p style="color:#64748b;font-size:15px;line-height:1.6;margin:0 0 28px;">
                Recibimos una solicitud para restablecer la contraseña de tu cuenta en PACT.
                Usa la contraseña temporal a continuación para iniciar sesión. Al ingresar, 
                el sistema te pedirá que establezcas una nueva contraseña.
              </p>

              <!-- Credenciales -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:2px solid #e2e8f0;border-radius:12px;margin-bottom:28px;">
                <tr>
                  <td style="padding:24px 28px;">
                    <p style="color:#94a3b8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 16px;">🔑 TUS CREDENCIALES DE ACCESO</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-bottom:10px;">
                          <span style="color:#64748b;font-size:13px;font-weight:600;">Usuario/Email:</span>
                          <span style="color:#1a56db;font-size:13px;font-weight:700;margin-left:8px;">${email}</span>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <span style="color:#64748b;font-size:13px;font-weight:600;">Password Temporero:</span>
                          <span style="background:#1e40af;color:#ffffff;font-size:14px;font-weight:800;font-family:monospace;padding:4px 12px;border-radius:6px;margin-left:8px;letter-spacing:1px;">${tempPassword}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Botón -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${appUrl}/login"
                       style="display:inline-block;background:linear-gradient(135deg,#1a56db,#1e40af);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;">
                      🚀 Entrar al Programa Web
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Aviso -->
              <p style="color:#94a3b8;font-size:12px;margin:28px 0 0;padding-top:20px;border-top:1px solid #f1f5f9;text-align:center;">
                Si no solicitaste este cambio, puedes ignorar este mensaje. Tu contraseña actual sigue activa hasta que uses la temporal.<br/><br/>
                <strong style="color:#64748b;">PACT Platform</strong> · Proyectos ACT
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function POST(req: Request) {
    try {
        const { email: rawEmail } = await req.json();
        const email = rawEmail?.trim().toLowerCase();

        if (!email) {
            return NextResponse.json({ error: 'Email requerido' }, { status: 400 });
        }

        // 1. Verificar que el usuario existe en la BD
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        const { data: userRecord } = await supabaseAdmin
            .from('users')
            .select('id, email, name, is_active')
            .eq('email', email)
            .single();

        // Siempre responder con éxito (no revelar si el email existe)
        if (!userRecord) {
            return NextResponse.json({ success: true });
        }

        if (userRecord.is_active === false) {
            return NextResponse.json({ error: 'Cuenta desactivada. Contacta al administrador.' }, { status: 403 });
        }

        // 2. Generar contraseña temporal
        const tempPassword = generateTempPassword();

        // 3. Actualizar la contraseña en Supabase Auth
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            userRecord.id,
            { password: tempPassword }
        );

        if (updateError) {
            console.error('Error actualizando contraseña:', updateError);
            return NextResponse.json(
                { error: 'No se pudo actualizar la contraseña.', details: updateError.message },
                { status: 500 }
            );
        }

        // 4. Enviar email con nodemailer via Gmail
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://act-m2-a.vercel.app';

        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            pool: true,
            auth: {
                user: smtpUser,
                pass: smtpPass,
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        await transporter.sendMail({
            from: `"PACT Platform" <${smtpUser}>`,
            to: email,
            subject: '🔐 Tu contraseña temporal de PACT',
            html: buildEmailHTML(email, tempPassword, appUrl),
        });

        return NextResponse.json({ success: true });

    } catch (err: any) {
        console.error('Error en forgot-password:', err);
        return NextResponse.json(
            { error: 'Error interno del servidor.', details: err.message },
            { status: 500 }
        );
    }
}
