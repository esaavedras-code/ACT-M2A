import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!; // Fallback to Anon Key if strictly necessary

// Create a single supabase client for interacting with your database
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function getUserFromRequest(req: NextRequest) {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return null;
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    
    if (error || !user) return null;
    
    const { data: publicUser } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
        
    return publicUser;
}

// Authorization Rules (from pseudocode)

export const isA = (user: any) => user?.role_global === 'A';

export const getMembership = async (userId: string, projectId: string) => {
    const { data: membership } = await supabaseAdmin
        .from('memberships')
        .select('role, revoked_at, expires_at')
        .eq('user_id', userId)
        .eq('project_id', projectId)
        .is('revoked_at', null)
        .single();
        
    if (!membership) return null;
    if (membership.expires_at && new Date(membership.expires_at) < new Date()) return null;
    
    return membership.role;
};

export const canManageProject = async (user: any, projectId: string) => {
    if (isA(user)) return true;
    const role = await getMembership(user.id, projectId);
    return role === 'B';
};

export const canWriteData = async (user: any, projectId: string) => {
    if (isA(user)) return true;
    const role = await getMembership(user.id, projectId);
    return role === 'B' || role === 'C';
};

export const canReadData = async (user: any, projectId: string) => {
    if (isA(user)) return true;
    const role = await getMembership(user.id, projectId);
    return role === 'B' || role === 'C' || role === 'D';
};

export const canManageMemberships = async (user: any, projectId: string) => {
    if (isA(user)) return true;
    const role = await getMembership(user.id, projectId);
    return role === 'B';
};

export const getReportScope = async (user: any) => {
    if (isA(user)) return 'ALL_PROJECTS';
    
    const { data: memberships } = await supabaseAdmin
        .from('memberships')
        .select('project_id, role, revoked_at, expires_at')
        .eq('user_id', user.id)
        .is('revoked_at', null);
        
    if (!memberships) return [];
    
    const validProjectIds = memberships
        .filter(m => !m.expires_at || new Date(m.expires_at) > new Date())
        .filter(m => ['B', 'C', 'D'].includes(m.role))
        .map(m => m.project_id);
        
    return validProjectIds;
};

export const logAudit = async (actorId: string, action: string, entity: string, entityId: string | null = null, projectId: string | null = null, metadata: any = {}) => {
    await supabaseAdmin.from('audit_logs_rbac').insert([{
        actor_user_id: actorId,
        action,
        entity,
        entity_id: entityId,
        project_id_nullable: projectId,
        metadata_json: metadata
    }]);
};
