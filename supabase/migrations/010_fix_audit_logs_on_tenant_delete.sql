-- =========================================================================
-- MIGRATION 010: Fix audit_logs Foreign Key Violation During Tenant Deletion
-- Run in Supabase SQL Editor. Safe & idempotent on existing databases.
-- =========================================================================
-- Problem:
--   When Super Admin deletes a laboratory (`DELETE FROM public.tenants`),
--   the AFTER DELETE trigger `record_audit_log()` runs for `tenants` and its
--   cascaded child tables (`tenant_subscriptions`, `user_profiles`, `doctors`, etc.)
--   and attempts to insert `tenant_id = <deleted_tenant_id>` into `public.audit_logs`.
--   Because that `tenants(id)` row no longer exists, PostgreSQL rejects the insert
--   with `audit_logs_tenant_id_fkey`.
--
-- Fix:
--   On `DELETE`, if the referenced tenant no longer exists in `public.tenants`
--   (including when deleting the tenant row itself), store `tenant_id = NULL`
--   in `public.audit_logs` (matching `ON DELETE SET NULL`), while preserving the
--   complete deleted row snapshot (with original tenant_id) inside `old_data`.

CREATE OR REPLACE FUNCTION public.record_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old JSONB := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END;
  v_new JSONB := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END;
  v_payload JSONB := COALESCE(v_new, v_old);
  v_tenant_id UUID;
  v_record_id TEXT;
  v_actor_id UUID := auth.uid();
  v_actor_email TEXT;
  v_actor_role TEXT;
BEGIN
  IF TG_TABLE_NAME = 'tenants' THEN
    v_tenant_id := NULLIF(v_payload->>'id', '')::UUID;
    v_record_id := v_payload->>'id';
  ELSIF TG_TABLE_NAME = 'tenant_settings' THEN
    v_tenant_id := NULLIF(v_payload->>'tenant_id', '')::UUID;
    v_record_id := v_payload->>'tenant_id';
  ELSE
    v_tenant_id := NULLIF(v_payload->>'tenant_id', '')::UUID;
    v_record_id := v_payload->>'id';
  END IF;

  -- During tenant deletion (and ON DELETE CASCADE across child tables), the parent
  -- tenant row is already gone when AFTER DELETE audit triggers execute.
  IF TG_OP = 'DELETE' AND v_tenant_id IS NOT NULL THEN
    IF TG_TABLE_NAME = 'tenants' OR NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = v_tenant_id) THEN
      v_tenant_id := NULL;
    END IF;
  END IF;

  IF v_actor_id IS NOT NULL THEN
    SELECT email, role
    INTO v_actor_email, v_actor_role
    FROM public.user_profiles
    WHERE id = v_actor_id
    LIMIT 1;
  END IF;

  INSERT INTO public.audit_logs (
    tenant_id,
    actor_user_id,
    actor_email,
    actor_role,
    table_name,
    record_id,
    action,
    old_data,
    new_data
  ) VALUES (
    v_tenant_id,
    v_actor_id,
    COALESCE(v_actor_email, current_user),
    COALESCE(v_actor_role, current_user),
    TG_TABLE_NAME,
    v_record_id,
    TG_OP,
    v_old,
    v_new
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
