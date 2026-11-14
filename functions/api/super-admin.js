import { createAdminClient, getEnv, jsonResponse } from '../lib/supabaseAdmin.js';

const SUPER_ADMIN_DEMO_SLUG = 'super-admin-sandbox-demo';

export async function onRequestPost(context) {
  const req = context.request;
  const env = context.env;

  try {
    const supabaseUrl = getEnv(env, 'SUPABASE_URL') || getEnv(env, 'VITE_SUPABASE_URL');
    const serviceRoleKey = getEnv(env, 'SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(
        {
          error:
            'Server Super Admin API requires SUPABASE_SERVICE_ROLE_KEY in Cloudflare Pages Environment Variables.',
          code: 'MISSING_SERVICE_ROLE',
        },
        503
      );
    }

    // 1. Authenticate caller JWT
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      return jsonResponse({ error: '401 Unauthorized — Authentication token required' }, 401);
    }

    const adminClient = createAdminClient(supabaseUrl, serviceRoleKey);

    const { data: authData, error: authErr } = await adminClient.auth.getUser(token);
    if (authErr || !authData?.user) {
      return jsonResponse({ error: '401 Unauthorized — Invalid or expired session' }, 401);
    }

    // 2. Independently verify caller role from database (NEVER trust frontend)
    const callerId = authData.user.id;
    const { data: callerProfile, error: profErr } = await adminClient
      .from('user_profiles')
      .select('id, tenant_id, email, full_name, role, is_active')
      .eq('id', callerId)
      .maybeSingle();

    if (profErr || !callerProfile) {
      return jsonResponse({ error: '403 Forbidden — User profile not found' }, 403);
    }

    if (!callerProfile.is_active) {
      return jsonResponse({ error: '403 Forbidden — Account is deactivated' }, 403);
    }

    if (callerProfile.role !== 'super_admin') {
      return jsonResponse(
        { error: '403 Forbidden — Super Admin access required', code: 'FORBIDDEN_SUPER_ADMIN' },
        403
      );
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON request body' }, 400);
    }

    const { action } = body || {};
    if (!action) {
      return jsonResponse({ error: 'action is required' }, 400);
    }

    // Note: Only platform-level metadata (tenants, subscriptions, staff metadata) is accessed here.
    // Patient, clinical, and medical records are NEVER queried or exposed to Super Admin APIs.
    if (action === 'list_tenants') {
      const [{ data: tenants, error: tErr }, { data: subs, error: sErr }, { data: settings }, { data: profiles }] =
        await Promise.all([
          adminClient.from('tenants').select('*').order('created_at', { ascending: false }),
          adminClient
            .from('tenant_subscriptions')
            .select('id, tenant_id, plan_type, subscription_source, status, billing_amount, starts_at, expires_at, is_unlimited, notes, created_at')
            .order('created_at', { ascending: false }),
          adminClient.from('tenant_settings').select('tenant_id, clinic_name, phone, email, address'),
          adminClient.from('user_profiles').select('id, tenant_id, email, full_name, role, is_active, created_at'),
        ]);

      if (tErr) throw tErr;
      if (sErr) throw sErr;

      const subsByTenant = new Map();
      for (const s of subs || []) {
        if (!subsByTenant.has(s.tenant_id)) subsByTenant.set(s.tenant_id, []);
        subsByTenant.get(s.tenant_id).push(s);
      }

      const settingsByTenant = new Map();
      for (const st of settings || []) {
        settingsByTenant.set(st.tenant_id, st);
      }

      const staffByTenant = new Map();
      for (const p of profiles || []) {
        if (!p.tenant_id) continue;
        if (!staffByTenant.has(p.tenant_id)) staffByTenant.set(p.tenant_id, []);
        staffByTenant.get(p.tenant_id).push(p);
      }

      const enriched = (tenants || []).map((t) => {
        const tenantStaff = staffByTenant.get(t.id) || [];
        const tenantSettings = settingsByTenant.get(t.id);
        return {
          ...t,
          tenant_subscriptions: subsByTenant.get(t.id) || [],
          tenant_settings: tenantSettings ? [tenantSettings] : [],
          staff_count: tenantStaff.length,
          owner_email: tenantStaff.find((p) => p.role === 'lab_owner')?.email || t.email,
          is_super_admin_sandbox: t.slug === SUPER_ADMIN_DEMO_SLUG || t.id === callerProfile.tenant_id,
        };
      });

      return jsonResponse({
        success: true,
        tenants: enriched,
        sandbox_tenant_id: callerProfile.tenant_id || null,
      });
    }

    if (action === 'get_tenant_details') {
      const { tenantId } = body;
      if (!tenantId) return jsonResponse({ error: 'tenantId is required' }, 400);

      const [{ data: tenant, error: tErr }, { data: subs }, { data: settings }, { data: staff }] = await Promise.all([
        adminClient.from('tenants').select('*').eq('id', tenantId).maybeSingle(),
        adminClient
          .from('tenant_subscriptions')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false }),
        adminClient
          .from('tenant_settings')
          .select('clinic_name, tagline, phone, email, address, reg_no')
          .eq('tenant_id', tenantId)
          .maybeSingle(),
        adminClient
          .from('user_profiles')
          .select('id, email, full_name, role, is_active, created_at')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: true }),
      ]);

      if (tErr || !tenant) {
        return jsonResponse({ error: 'Laboratory not found' }, 404);
      }

      return jsonResponse({
        success: true,
        tenant: {
          ...tenant,
          profile_settings: settings || null,
          subscriptions: subs || [],
          staff: staff || [],
          is_super_admin_sandbox: tenant.slug === SUPER_ADMIN_DEMO_SLUG || tenant.id === callerProfile.tenant_id,
        },
      });
    }

    if (action === 'create_tenant') {
      const {
        labName,
        ownerName,
        email,
        password,
        phone = '',
        address = '',
        accessType = 'complimentary',
        durationDays = 30,
        isUnlimited = false,
        notes = '',
      } = body;

      if (!labName?.trim() || !email?.trim() || !password || String(password).length < 6) {
        return jsonResponse({ error: 'Lab name, valid owner email, and password (min 6 chars) are required.' }, 400);
      }

      const cleanSlug =
        labName
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '') +
        '-' +
        Math.floor(1000 + Math.random() * 9000);

      const isTestLab = accessType === 'test_demo';
      const subSource =
        accessType === 'test_demo' ? 'test_demo' : accessType === 'complimentary' ? 'complimentary' : 'super_admin';

      const { data: provRes, error: provErr } = await adminClient.rpc('provision_new_tenant', {
        p_name: labName.trim(),
        p_slug: cleanSlug,
        p_phone: String(phone || '').trim(),
        p_email: email.trim(),
        p_address: String(address || '').trim(),
        p_plan_type: accessType === 'paid' ? 'monthly' : 'custom',
        p_subscription_source: subSource,
        p_duration_days: isUnlimited ? null : Number(durationDays) || 30,
        p_is_unlimited: Boolean(isUnlimited),
        p_is_test_lab: isTestLab,
        p_notes: String(notes || '').trim() || `Created by Super Admin (${accessType})`,
        p_admin_user_id: callerId,
      });

      if (provErr || !provRes?.tenant_id) {
        throw new Error(provErr?.message || 'Failed to provision laboratory tenant.');
      }

      const newTenantId = provRes.tenant_id;

      const { data: createdAuth, error: createAuthErr } = await adminClient.auth.admin.createUser({
        email: email.trim(),
        password: String(password),
        email_confirm: true,
        user_metadata: { full_name: String(ownerName || 'Lab Administrator').trim() },
      });

      if (createAuthErr || !createdAuth?.user) {
        // Rollback newly created tenant so no orphaned empty tenant remains
        await adminClient.from('tenants').delete().eq('id', newTenantId);
        throw new Error(createAuthErr?.message || 'Failed to create owner login account.');
      }

      const { error: profInsertErr } = await adminClient.from('user_profiles').insert({
        id: createdAuth.user.id,
        tenant_id: newTenantId,
        email: email.trim(),
        full_name: String(ownerName || 'Lab Administrator').trim(),
        role: 'lab_owner',
        is_active: true,
      });

      if (profInsertErr) {
        await adminClient.auth.admin.deleteUser(createdAuth.user.id);
        await adminClient.from('tenants').delete().eq('id', newTenantId);
        throw profInsertErr;
      }

      return jsonResponse({ success: true, tenant_id: newTenantId, slug: cleanSlug });
    }

    if (action === 'pause_subscription' || action === 'resume_subscription' || action === 'end_subscription') {
      const { tenantId, reason = '' } = body;
      if (!tenantId) return jsonResponse({ error: 'tenantId is required' }, 400);

      const { data: targetTenant } = await adminClient
        .from('tenants')
        .select('id, slug, status')
        .eq('id', tenantId)
        .maybeSingle();

      if (!targetTenant) return jsonResponse({ error: 'Laboratory not found' }, 404);

      if (
        (action === 'pause_subscription' || action === 'end_subscription') &&
        (targetTenant.slug === SUPER_ADMIN_DEMO_SLUG || targetTenant.id === callerProfile.tenant_id)
      ) {
        return jsonResponse({ error: 'Cannot pause or end the Super Admin isolated Demo Laboratory' }, 400);
      }

      const { data: latestSub } = await adminClient
        .from('tenant_subscriptions')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nowIso = new Date().toISOString();

      if (action === 'pause_subscription') {
        const { error: tUpdErr } = await adminClient
          .from('tenants')
          .update({ status: 'suspended', updated_at: nowIso })
          .eq('id', tenantId);
        if (tUpdErr) throw tUpdErr;

        if (latestSub) {
          const { error: sUpdErr } = await adminClient
            .from('tenant_subscriptions')
            .update({
              status: 'paused',
              notes: `${latestSub.notes || ''} | Paused by Super Admin${reason ? `: ${reason}` : ''}`.trim(),
              updated_at: nowIso,
            })
            .eq('id', latestSub.id);
          if (sUpdErr) throw sUpdErr;
        }
        return jsonResponse({ success: true, status: 'paused' });
      }

      if (action === 'resume_subscription') {
        const { error: tUpdErr } = await adminClient
          .from('tenants')
          .update({ status: 'active', updated_at: nowIso })
          .eq('id', tenantId);
        if (tUpdErr) throw tUpdErr;

        if (latestSub) {
          const subUpdates = {
            status: 'active',
            notes: `${latestSub.notes || ''} | Resumed by Super Admin`.trim(),
            updated_at: nowIso,
          };
          if (!latestSub.is_unlimited && (!latestSub.expires_at || new Date(latestSub.expires_at) <= new Date())) {
            subUpdates.expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          }
          const { error: sUpdErr } = await adminClient
            .from('tenant_subscriptions')
            .update(subUpdates)
            .eq('id', latestSub.id);
          if (sUpdErr) throw sUpdErr;
        }
        return jsonResponse({ success: true, status: 'active' });
      }

      if (action === 'end_subscription') {
        const { error: tUpdErr } = await adminClient
          .from('tenants')
          .update({ status: 'suspended', updated_at: nowIso })
          .eq('id', tenantId);
        if (tUpdErr) throw tUpdErr;

        if (latestSub) {
          const { error: sUpdErr } = await adminClient
            .from('tenant_subscriptions')
            .update({
              status: 'expired',
              is_unlimited: false,
              expires_at: nowIso,
              notes: `${latestSub.notes || ''} | Subscription ended by Super Admin`.trim(),
              updated_at: nowIso,
            })
            .eq('id', latestSub.id);
          if (sUpdErr) throw sUpdErr;
        }
        return jsonResponse({ success: true, status: 'expired' });
      }
    }

    if (action === 'grant_complimentary') {
      const { tenantId, days, isUnlimited = false, notes = '' } = body;
      if (!tenantId) return jsonResponse({ error: 'tenantId is required' }, 400);

      const { data: latestSub } = await adminClient
        .from('tenant_subscriptions')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const now = new Date();
      const nowIso = now.toISOString();

      await adminClient
        .from('tenants')
        .update({ status: 'active', updated_at: nowIso })
        .eq('id', tenantId);

      let newExpiresAt = null;
      if (!isUnlimited) {
        const numDays = parseInt(days, 10);
        if (!numDays || numDays <= 0) {
          return jsonResponse({ error: 'Provide positive number of days or select Unlimited.' }, 400);
        }
        const currentExp = latestSub?.expires_at ? new Date(latestSub.expires_at) : now;
        const baseDate = currentExp > now ? currentExp : now;
        newExpiresAt = new Date(baseDate.getTime() + numDays * 24 * 60 * 60 * 1000).toISOString();
      }

      const noteText =
        notes?.trim() ||
        (isUnlimited ? 'Complimentary Unlimited Access granted by Super Admin' : `Complimentary +${days} days granted by Super Admin`);

      if (latestSub) {
        const { error: updErr } = await adminClient
          .from('tenant_subscriptions')
          .update({
            status: 'active',
            subscription_source: 'complimentary',
            billing_amount: 0,
            is_unlimited: Boolean(isUnlimited),
            expires_at: newExpiresAt,
            granted_by_admin_id: callerId,
            notes: `${latestSub.notes ? `${latestSub.notes} | ` : ''}${noteText}`,
            updated_at: nowIso,
          })
          .eq('id', latestSub.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await adminClient.from('tenant_subscriptions').insert({
          tenant_id: tenantId,
          plan_type: isUnlimited ? 'unlimited' : 'custom',
          subscription_source: 'complimentary',
          status: 'active',
          billing_amount: 0,
          starts_at: nowIso,
          expires_at: newExpiresAt,
          is_unlimited: Boolean(isUnlimited),
          granted_by_admin_id: callerId,
          notes: noteText,
        });
        if (insErr) throw insErr;
      }

      return jsonResponse({ success: true });
    }

    if (action === 'delete_tenant') {
      const { tenantId, confirmSlug } = body;
      if (!tenantId || !confirmSlug) {
        return jsonResponse({ error: 'tenantId and confirmation slug are required' }, 400);
      }

      const { data: targetTenant } = await adminClient
        .from('tenants')
        .select('id, name, slug')
        .eq('id', tenantId)
        .maybeSingle();

      if (!targetTenant) return jsonResponse({ error: 'Laboratory not found' }, 404);

      if (targetTenant.slug === SUPER_ADMIN_DEMO_SLUG || targetTenant.id === callerProfile.tenant_id) {
        return jsonResponse({ error: 'Cannot delete the isolated Super Admin Test/Demo Laboratory' }, 400);
      }

      if (String(confirmSlug).trim() !== targetTenant.slug) {
        return jsonResponse({ error: `Confirmation slug mismatch. Expected "${targetTenant.slug}".` }, 400);
      }

      // Collect non-super-admin auth users under this tenant before cascade deletion
      const { data: tenantUsers } = await adminClient
        .from('user_profiles')
        .select('id, role')
        .eq('tenant_id', tenantId);

      const userIdsToDelete = (tenantUsers || [])
        .filter((u) => u.role !== 'super_admin' && u.id !== callerId)
        .map((u) => u.id);

      // Delete tenant (cascades business tables, subscriptions, settings, and user_profiles)
      const { error: delTenantErr } = await adminClient.from('tenants').delete().eq('id', tenantId);
      if (delTenantErr) {
        if (String(delTenantErr.message || '').includes('audit_logs_tenant_id_fkey')) {
          return jsonResponse(
            {
              error:
                'Database audit trigger needs migration 010 (audit_logs_tenant_id_fkey). Please run supabase/migrations/010_fix_audit_logs_on_tenant_delete.sql in Supabase SQL Editor and retry.',
              code: 'MIGRATION_010_REQUIRED',
            },
            409
          );
        }
        throw delTenantErr;
      }

      // Best-effort cleanup of uploaded lab branding assets in storage
      try {
        const { data: files } = await adminClient.storage.from('lab-assets').list(tenantId);
        if (files && files.length > 0) {
          const paths = files.map((f) => `${tenantId}/${f.name}`);
          await adminClient.storage.from('lab-assets').remove(paths);
        }
      } catch (storageErr) {
        console.warn('Non-fatal storage cleanup error during tenant delete:', storageErr?.message);
      }

      // Remove auth accounts for that deleted laboratory
      for (const uid of userIdsToDelete) {
        await adminClient.auth.admin.deleteUser(uid);
      }

      return jsonResponse({ success: true, deleted_tenant: targetTenant.name });
    }

    return jsonResponse({ error: `Unsupported action: ${action}` }, 400);
  } catch (err) {
    console.error('super-admin function error:', err);
    return jsonResponse({ error: err.message || 'Server error executing Super Admin action' }, 500);
  }
}

export async function onRequest(context) {
  if (context.request.method === 'POST') {
    return onRequestPost(context);
  }
  return jsonResponse({ error: 'Method not allowed' }, 405);
}
