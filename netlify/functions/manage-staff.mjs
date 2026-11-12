import { createClient } from '@supabase/supabase-js';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function getEnv(name) {
  if (typeof Netlify !== 'undefined' && Netlify?.env?.get) {
    return Netlify.env.get(name);
  }
  return process.env[name];
}

export default async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL');
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      {
        error:
          'Server staff management is not configured yet. Add SUPABASE_SERVICE_ROLE_KEY to your Netlify Environment Variables (with Functions scope) and redeploy.',
        code: 'MISSING_SERVICE_ROLE',
      },
      503
    );
  }

  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return jsonResponse({ error: 'Missing authentication token' }, 401);
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON request body' }, 400);
  }

  const { action, targetUserId, newPassword, fullName, email, role, isActive } = payload || {};
  if (!action || !targetUserId) {
    return jsonResponse({ error: 'action and targetUserId are required' }, 400);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Verify caller identity using JWT
  const { data: authData, error: authErr } = await adminClient.auth.getUser(token);
  if (authErr || !authData?.user) {
    return jsonResponse({ error: 'Invalid or expired session' }, 401);
  }

  const callerId = authData.user.id;
  const { data: callerProfile, error: callerErr } = await adminClient
    .from('user_profiles')
    .select('id, tenant_id, role, is_active')
    .eq('id', callerId)
    .maybeSingle();

  if (callerErr || !callerProfile || !callerProfile.is_active) {
    return jsonResponse({ error: 'Caller account is inactive or missing' }, 403);
  }

  const isCallerSuperAdmin = callerProfile.role === 'super_admin';
  const isCallerOwner = callerProfile.role === 'lab_owner';

  if (!isCallerSuperAdmin && !isCallerOwner) {
    return jsonResponse({ error: 'Forbidden: Only Lab Owners can manage staff accounts' }, 403);
  }

  // 2. Fetch target profile & verify tenant boundary
  const { data: targetProfile, error: targetErr } = await adminClient
    .from('user_profiles')
    .select('id, tenant_id, email, full_name, role, is_active')
    .eq('id', targetUserId)
    .maybeSingle();

  if (targetErr || !targetProfile) {
    return jsonResponse({ error: 'Target staff profile not found' }, 404);
  }

  if (targetProfile.role === 'super_admin') {
    return jsonResponse({ error: 'Cannot modify a Super Admin account' }, 403);
  }

  if (!isCallerSuperAdmin && targetProfile.tenant_id !== callerProfile.tenant_id) {
    return jsonResponse({ error: 'Forbidden: Cross-tenant staff modification denied' }, 403);
  }

  if (targetProfile.id === callerId && (action === 'delete_staff' || action === 'toggle_active')) {
    return jsonResponse({ error: 'Cannot deactivate or delete your own active Owner account' }, 400);
  }

  // 3. Execute requested administrative action
  try {
    if (action === 'reset_password') {
      if (!newPassword || String(newPassword).length < 6) {
        return jsonResponse({ error: 'New password must be at least 6 characters' }, 400);
      }

      const { error: updErr } = await adminClient.auth.admin.updateUserById(targetUserId, {
        password: String(newPassword),
      });
      if (updErr) throw updErr;

      return jsonResponse({ success: true, message: 'Password updated successfully' });
    }

    if (action === 'toggle_active') {
      const nextState = typeof isActive === 'boolean' ? isActive : !targetProfile.is_active;
      const { error: dbErr } = await adminClient
        .from('user_profiles')
        .update({ is_active: nextState, updated_at: new Date().toISOString() })
        .eq('id', targetUserId);
      if (dbErr) throw dbErr;

      return jsonResponse({ success: true, is_active: nextState });
    }

    if (action === 'update_staff') {
      const nextRole = role && ['receptionist', 'lab_owner'].includes(role) ? role : targetProfile.role;
      const updates = {
        updated_at: new Date().toISOString(),
      };
      if (typeof fullName === 'string' && fullName.trim()) {
        updates.full_name = fullName.trim();
      }
      if (nextRole) {
        updates.role = nextRole;
      }

      const authUpdates = {};
      if (typeof email === 'string' && email.trim() && email.trim().toLowerCase() !== targetProfile.email.toLowerCase()) {
        updates.email = email.trim();
        authUpdates.email = email.trim();
        authUpdates.email_confirm = true;
      }

      if (Object.keys(authUpdates).length > 0) {
        const { error: authUpdErr } = await adminClient.auth.admin.updateUserById(targetUserId, authUpdates);
        if (authUpdErr) throw authUpdErr;
      }

      const { error: profUpdErr } = await adminClient
        .from('user_profiles')
        .update(updates)
        .eq('id', targetUserId);
      if (profUpdErr) throw profUpdErr;

      return jsonResponse({ success: true });
    }

    if (action === 'delete_staff') {
      const { error: profDelErr } = await adminClient
        .from('user_profiles')
        .delete()
        .eq('id', targetUserId);
      if (profDelErr) throw profDelErr;

      const { error: authDelErr } = await adminClient.auth.admin.deleteUser(targetUserId);
      if (authDelErr) throw authDelErr;

      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: `Unsupported action: ${action}` }, 400);
  } catch (err) {
    console.error('manage-staff error:', err);
    return jsonResponse({ error: err.message || 'Server error executing action' }, 500);
  }
};
