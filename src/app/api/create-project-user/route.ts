export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from "next/server";
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export async function POST(req: Request) {
    try {
        const { email: rawEmail, name, projectId, role, password, invitedBy } = await req.json();
        const email = rawEmail?.trim().toLowerCase();

        if (!email || !projectId || !role || !password) {
            return NextResponse.json(
                { error: "Faltan campos requeridos (email, projectId, role, password)" },
                { status: 400 }
            );
        }

        // ──────────────────────────────────────────────────────────────────────
        // VALIDACIÓN DE AUTORIZACIÓN EN EL SERVIDOR
        // Verificar que el usuario que llama tiene Rol A (global) o Rol B
        // activo en este proyecto específico. Sin esto, cualquiera podría
        // manipular el request para añadir usuarios a proyectos ajenos.
        // ──────────────────────────────────────────────────────────────────────
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceRoleKey || serviceRoleKey.startsWith('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0cGZod3h3b2R6cGl0em1yYnFyIiwicm9sZSI6ImFub24i')) {
            return NextResponse.json(
                { error: "Error de configuración del servidor. Service Role Key no válida." },
                { status: 500 }
            );
        }

        // Cliente con service role (para operaciones admin)
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        // Verificar el JWT del usuario que llama usando el Authorization header
        const authHeader = req.headers.get('Authorization');
        let callerUserId: string | null = invitedBy || null;

        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.replace('Bearer ', '');
            const { data: { user }, error: jwtError } = await supabaseAdmin.auth.getUser(token);
            if (!jwtError && user) {
                callerUserId = user.id;
            }
        }

        if (!callerUserId) {
            return NextResponse.json(
                { error: "No autenticado. Debes iniciar sesión para realizar esta acción." },
                { status: 401 }
            );
        }

        // Verificar si el usuario que llama es Administrador Global (Rol A)
        const { data: callerData } = await supabaseAdmin
            .from("users")
            .select("role_global")
            .eq("id", callerUserId)
            .single();

        const isGlobalAdmin = callerData?.role_global === 'A';

        if (!isGlobalAdmin) {
            // No es admin global — verificar si tiene Rol B activo en ESTE proyecto específico
            const { data: callerMembership } = await supabaseAdmin
                .from("memberships")
                .select("role")
                .eq("project_id", projectId)
                .eq("user_id", callerUserId)
                .eq("is_active", true)
                .is("revoked_at", null)
                .single();

            const callerRole = callerMembership?.role;

            if (callerRole !== 'B') {
                return NextResponse.json(
                    {
                        error: "Acceso denegado. Solo el Administrador del Proyecto (Rol B) o el Administrador del Programa (Rol A) pueden crear usuarios en este proyecto.",
                        callerRole: callerRole ?? "sin membresía"
                    },
                    { status: 403 }
                );
            }

            // Rol B tiene restricción adicional: no puede asignar Rol A, B ni F
            const rolesPermitidosPorB = ['C', 'D', 'E'];
            if (!rolesPermitidosPorB.includes(role)) {
                return NextResponse.json(
                    {
                        error: `El Administrador del Proyecto (Rol B) solo puede asignar los roles C (Data Entry), D (Solo Lectura) o E (Inspector). No puede asignar el rol '${role}'.`
                    },
                    { status: 403 }
                );
            }
        }
        // ── FIN DE VALIDACIÓN DE AUTORIZACIÓN ─────────────────────────────────

        // 1. Verificar si el usuario ya existe en la base de datos
        let targetUserId: string | null = null;
        let isNewUser = false;

        const { data: existingDbUser } = await supabaseAdmin
            .from("users")
            .select("id")
            .eq("email", email)
            .single();

        if (existingDbUser) {
            targetUserId = existingDbUser.id;
        } else {
            // Crear nuevo usuario en Auth
            console.log("Creando nuevo usuario en Auth API:", email);
            const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true
            });

            if (authError) {
                if (authError.message.includes("already registered")) {
                    const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
                    const existingAuthUser = listData.users.find(u => u.email === email);
                    if (existingAuthUser) {
                        targetUserId = existingAuthUser.id;
                        await supabaseAdmin.auth.admin.updateUserById(targetUserId, { password });
                    } else {
                        return NextResponse.json({ error: "Error en Auth de Supabase", details: authError.message }, { status: 500 });
                    }
                } else {
                    return NextResponse.json({ error: "Error creando usuario en Auth", details: authError.message }, { status: 500 });
                }
            } else {
                targetUserId = authData.user.id;
                isNewUser = true;
            }

            // Insertar en public.users si no existe
            if (targetUserId) {
                const { error: insertUserError } = await supabaseAdmin
                    .from("users")
                    .insert([{
                        id: targetUserId,
                        email: email,
                        name: name || email.split("@")[0],
                        role_global: 'D', // siempre D por defecto para usuarios invitados por proyecto
                        is_active: true
                    }]);

                if (insertUserError) {
                    console.error("Error insertando en public.users:", insertUserError);
                }
            }
        }

        // 2. Crear o actualizar la membresía para el proyecto
        if (targetUserId) {
            const { data: existingMembership } = await supabaseAdmin
                .from("memberships")
                .select("id")
                .eq("project_id", projectId)
                .eq("user_id", targetUserId)
                .single();

            if (existingMembership) {
                await supabaseAdmin
                    .from("memberships")
                    .update({
                        role: role,
                        is_active: true,
                        revoked_at: null,
                        invited_by_user_id: callerUserId
                    })
                    .eq("id", existingMembership.id);
            } else {
                const { error: memberError } = await supabaseAdmin
                    .from("memberships")
                    .insert([{
                        project_id: projectId,
                        user_id: targetUserId,
                        role: role,
                        invited_by_user_id: callerUserId,
                        is_active: true
                    }]);

                if (memberError) {
                    return NextResponse.json({ error: "Error al asignar proyecto", details: memberError.message }, { status: 500 });
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: "Usuario gestionado y asignado al proyecto exitosamente.",
            isNewUser
        });

    } catch (error: any) {
        console.error("Error en create-project-user API:", error);
        return NextResponse.json({ error: "Error interno", details: error.message }, { status: 500 });
    }
}
