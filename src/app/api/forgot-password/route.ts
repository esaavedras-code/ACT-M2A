import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: Request) {
    try {
        const { email: rawEmail } = await req.json();
        const email = rawEmail?.trim().toLowerCase();

        if (!email) {
            return NextResponse.json({ error: 'Email requerido' }, { status: 400 });
        }

        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        // Determinar la URL base de la app
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://act-m2-a.vercel.app';

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${appUrl}/reset-password`,
        });

        if (error) {
            return NextResponse.json(
                { error: 'No se pudo procesar la solicitud.', details: error.message },
                { status: 500 }
            );
        }

        // Siempre devolver éxito para no revelar si el correo existe o no
        return NextResponse.json({ success: true });

    } catch (err: any) {
        return NextResponse.json(
            { error: 'Error interno del servidor.', details: err.message },
            { status: 500 }
        );
    }
}
