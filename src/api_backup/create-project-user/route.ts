export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from "next/server";

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export async function POST(req: Request) {
    try {
        const { email: rawEmail, name, projectId, role, password, invitedBy } = await req.json();
        const email = rawEmail?.trim().toLowerCase();

        if (!email || !projectId || !role || !password) {
            return NextResponse.json({ error: "Faltan campos requeridos (email, projectId, role, password)" }, { status: 400 });
        }

        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceRoleKey || serviceRoleKey.startsWith('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0cGZod3h3b2R6cGl0em1yYnFyIiwicm9sZSI6ImFub24i')) {
             return NextResponse.json({ 
                 error: "Error de configuración del servidor. Key de admin no válida." 
             }, { status: 500 });
        }

        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        // 1. Check if user already exists in auth
        let targetUserId = null;
        let isNewUser = false;
        
        // We first query the database users table
        const { data: existingDbUser } = await supabaseAdmin
            .from("users")
            .select("id")
            .eq("email", email)
            .single();

        if (existingDbUser) {
            targetUserId = existingDbUser.id;
        } else {
            // Need to create them in auth
            console.log("Creando nuevo usuario en Auth API:", email);
            const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true // important so they don't need to click a link
            });

            if (authError) {
                // If it already exists in auth but not in users table (inconsistent state)
                if (authError.message.includes("already registered")) {
                    const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
                    const existingAuthUser = listData.users.find(u => u.email === email);
                    if (existingAuthUser) {
                        targetUserId = existingAuthUser.id;
                        // Update password to be sure they can log in
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

            // Insert into public.users if not exists
            if (targetUserId) {
                const { error: insertUserError } = await supabaseAdmin
                    .from("users")
                    .insert([{
                        id: targetUserId,
                        email: email,
                        name: name || email.split("@")[0],
                        role_global: 'D', // always default to D for project-invited users
                        is_active: true
                    }]);
                
                if (insertUserError) {
                    console.error("Error inserting into public.users", insertUserError);
                }
            }
        }

        // 2. Add or update membership for the project
        if (targetUserId) {
            // check if membership already exists
            const { data: existingMembership } = await supabaseAdmin
                .from("memberships")
                .select("id")
                .eq("project_id", projectId)
                .eq("user_id", targetUserId)
                .single();

            if (existingMembership) {
                // update role and make active
                await supabaseAdmin
                    .from("memberships")
                    .update({ 
                        role: role, 
                        is_active: true, 
                        revoked_at: null,
                        invited_by_user_id: invitedBy 
                    })
                    .eq("id", existingMembership.id);
            } else {
                // insert new membership
                const { error: memberError } = await supabaseAdmin
                    .from("memberships")
                    .insert([{
                        project_id: projectId,
                        user_id: targetUserId,
                        role: role,
                        invited_by_user_id: invitedBy,
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

