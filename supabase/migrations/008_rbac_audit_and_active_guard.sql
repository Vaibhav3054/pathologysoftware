-- =========================================================================
-- MIGRATION 008: Strict Least-Privilege RBAC, Active User Guard & Audit Trail
-- Safe to run directly on an existing Supabase database.
-- =========================================================================

-- 1. Helper function checking whether the authenticated user's profile is active
CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_active FROM public.user_profiles WHERE id = auth.uid() LIMIT 1),
    false
  );
$$;

-- Include is_active_user() inside has_active_subscription() so deactivated staff
-- are immediately rejected by PostgreSQL RLS on all business tables.
CREATE OR REPLACE FUNCTION public.has_active_subscription(p_tenant_id UUID DEFAULT public.current_tenant_id())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_super_admin()
    OR (
      p_tenant_id IS NOT NULL
      AND (auth.uid() IS NULL OR public.is_active_user())
      AND EXISTS (
        SELECT 1
        FROM public.tenants t
        WHERE t.id = p_tenant_id
          AND t.status = 'active'
          AND EXISTS (
            SELECT 1
            FROM (
              SELECT s.status, s.is_unlimited, s.expires_at
              FROM public.tenant_subscriptions s
              WHERE s.tenant_id = t.id
              ORDER BY s.created_at DESC
              LIMIT 1
            ) latest_sub
            WHERE latest_sub.status = 'active'
              AND (
                latest_sub.is_unlimited = true
                OR latest_sub.expires_at IS NULL
                OR latest_sub.expires_at > now()
              )
          )
      )
    );
$$;

REVOKE ALL ON FUNCTION public.is_active_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_user() TO authenticated, service_role;

-- 2. Strict Least-Privilege RBAC Policies (Owner vs Receptionist)
-- Doctors: Receptionist can READ (registration dropdown); ONLY Owner/Super Admin can write
DROP POLICY IF EXISTS "Tenant staff can view doctors" ON public.doctors;
CREATE POLICY "Tenant staff can view doctors"
  ON public.doctors FOR SELECT TO authenticated
  USING ((tenant_id = public.current_tenant_id() AND public.has_active_subscription(tenant_id)) OR public.is_super_admin());

DROP POLICY IF EXISTS "Tenant staff can manage doctors" ON public.doctors;
DROP POLICY IF EXISTS "Lab owner can manage doctors" ON public.doctors;
CREATE POLICY "Lab owner can manage doctors"
  ON public.doctors
  FOR ALL
  TO authenticated
  USING ((tenant_id = public.current_tenant_id() AND public.current_user_role() = 'lab_owner' AND public.has_active_subscription(tenant_id)) OR public.is_super_admin())
  WITH CHECK ((tenant_id = public.current_tenant_id() AND public.current_user_role() = 'lab_owner' AND public.has_active_subscription(tenant_id)) OR public.is_super_admin());

-- Tests & Test Parameters: Receptionist can READ prices/catalog; ONLY Owner/Super Admin can write
DROP POLICY IF EXISTS "Tenant staff can view tests" ON public.tests;
CREATE POLICY "Tenant staff can view tests"
  ON public.tests FOR SELECT TO authenticated
  USING ((tenant_id = public.current_tenant_id() AND public.has_active_subscription(tenant_id)) OR public.is_super_admin());

DROP POLICY IF EXISTS "Lab owner can manage tests" ON public.tests;
CREATE POLICY "Lab owner can manage tests"
  ON public.tests FOR ALL TO authenticated
  USING ((tenant_id = public.current_tenant_id() AND public.current_user_role() = 'lab_owner' AND public.has_active_subscription(tenant_id)) OR public.is_super_admin())
  WITH CHECK ((tenant_id = public.current_tenant_id() AND public.current_user_role() = 'lab_owner' AND public.has_active_subscription(tenant_id)) OR public.is_super_admin());

DROP POLICY IF EXISTS "Tenant staff can view test parameters" ON public.test_parameters;
CREATE POLICY "Tenant staff can view test parameters"
  ON public.test_parameters FOR SELECT TO authenticated
  USING ((tenant_id = public.current_tenant_id() AND public.has_active_subscription(tenant_id)) OR public.is_super_admin());

DROP POLICY IF EXISTS "Lab owner can manage test parameters" ON public.test_parameters;
CREATE POLICY "Lab owner can manage test parameters"
  ON public.test_parameters FOR ALL TO authenticated
  USING ((tenant_id = public.current_tenant_id() AND public.current_user_role() = 'lab_owner' AND public.has_active_subscription(tenant_id)) OR public.is_super_admin())
  WITH CHECK ((tenant_id = public.current_tenant_id() AND public.current_user_role() = 'lab_owner' AND public.has_active_subscription(tenant_id)) OR public.is_super_admin());

-- User Profiles: Receptionist can ONLY view their own profile; Owner sees their tenant staff
DROP POLICY IF EXISTS "Users can view staff within their own tenant" ON public.user_profiles;
CREATE POLICY "Users can view staff within their own tenant"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR (
      public.current_user_role() = 'lab_owner'
      AND tenant_id IS NOT NULL
      AND tenant_id = public.current_tenant_id()
    )
  );

-- Operational Patient & Report Data: Active Owner or Receptionist in own tenant + Super Admin
DROP POLICY IF EXISTS "Tenant staff can manage patients" ON public.patients;
CREATE POLICY "Tenant staff can manage patients"
  ON public.patients FOR ALL TO authenticated
  USING ((tenant_id = public.current_tenant_id() AND public.current_user_role() IN ('lab_owner', 'receptionist') AND public.has_active_subscription(tenant_id)) OR public.is_super_admin())
  WITH CHECK ((tenant_id = public.current_tenant_id() AND public.current_user_role() IN ('lab_owner', 'receptionist') AND public.has_active_subscription(tenant_id)) OR public.is_super_admin());

DROP POLICY IF EXISTS "Tenant staff can create reports" ON public.reports;
CREATE POLICY "Tenant staff can create reports"
  ON public.reports FOR INSERT TO authenticated
  WITH CHECK ((tenant_id = public.current_tenant_id() AND public.current_user_role() IN ('lab_owner', 'receptionist') AND public.has_active_subscription(tenant_id)) OR public.is_super_admin());

DROP POLICY IF EXISTS "Tenant staff can update reports" ON public.reports;
CREATE POLICY "Tenant staff can update reports"
  ON public.reports FOR UPDATE TO authenticated
  USING ((tenant_id = public.current_tenant_id() AND public.current_user_role() IN ('lab_owner', 'receptionist') AND public.has_active_subscription(tenant_id)) OR public.is_super_admin())
  WITH CHECK ((tenant_id = public.current_tenant_id() AND public.current_user_role() IN ('lab_owner', 'receptionist') AND public.has_active_subscription(tenant_id)) OR public.is_super_admin());

DROP POLICY IF EXISTS "Tenant staff can manage report services" ON public.report_services;
CREATE POLICY "Tenant staff can manage report services"
  ON public.report_services FOR ALL TO authenticated
  USING ((tenant_id = public.current_tenant_id() AND public.current_user_role() IN ('lab_owner', 'receptionist') AND public.has_active_subscription(tenant_id)) OR public.is_super_admin())
  WITH CHECK ((tenant_id = public.current_tenant_id() AND public.current_user_role() IN ('lab_owner', 'receptionist') AND public.has_active_subscription(tenant_id)) OR public.is_super_admin());

DROP POLICY IF EXISTS "Tenant staff can manage report test results" ON public.report_test_results;
CREATE POLICY "Tenant staff can manage report test results"
  ON public.report_test_results FOR ALL TO authenticated
  USING ((tenant_id = public.current_tenant_id() AND public.current_user_role() IN ('lab_owner', 'receptionist') AND public.has_active_subscription(tenant_id)) OR public.is_super_admin())
  WITH CHECK ((tenant_id = public.current_tenant_id() AND public.current_user_role() IN ('lab_owner', 'receptionist') AND public.has_active_subscription(tenant_id)) OR public.is_super_admin());

DROP POLICY IF EXISTS "Tenant staff can manage report xray results" ON public.report_xray_results;
CREATE POLICY "Tenant staff can manage report xray results"
  ON public.report_xray_results FOR ALL TO authenticated
  USING ((tenant_id = public.current_tenant_id() AND public.current_user_role() IN ('lab_owner', 'receptionist') AND public.has_active_subscription(tenant_id)) OR public.is_super_admin())
  WITH CHECK ((tenant_id = public.current_tenant_id() AND public.current_user_role() IN ('lab_owner', 'receptionist') AND public.has_active_subscription(tenant_id)) OR public.is_super_admin());

-- Storage uploads/updates/deletes restricted to Lab Owner (settings branding) + Super Admin
DROP POLICY IF EXISTS "Tenant staff can upload assets to their own folder" ON storage.objects;
CREATE POLICY "Tenant staff can upload assets to their own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'lab-assets'
    AND (storage.foldername(name))[1] = public.current_tenant_id()::TEXT
    AND public.current_user_role() IN ('lab_owner', 'super_admin')
    AND public.has_active_subscription(public.current_tenant_id())
  );

DROP POLICY IF EXISTS "Tenant staff can update assets in their own folder" ON storage.objects;
CREATE POLICY "Tenant staff can update assets in their own folder"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'lab-assets'
    AND (storage.foldername(name))[1] = public.current_tenant_id()::TEXT
    AND public.current_user_role() IN ('lab_owner', 'super_admin')
    AND public.has_active_subscription(public.current_tenant_id())
  );

DROP POLICY IF EXISTS "Tenant staff can delete assets in their own folder" ON storage.objects;
CREATE POLICY "Tenant staff can delete assets in their own folder"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'lab-assets'
    AND (storage.foldername(name))[1] = public.current_tenant_id()::TEXT
    AND public.current_user_role() IN ('lab_owner', 'super_admin')
    AND public.has_active_subscription(public.current_tenant_id())
  );

-- 3. Immutable Audit Trail Table & Automatic PostgreSQL Triggers
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  actor_user_id UUID,
  actor_email TEXT,
  actor_role TEXT,
  table_name TEXT NOT NULL,
  record_id TEXT,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_time ON public.audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_time ON public.audit_logs(table_name, created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Immutable: ONLY SELECT is permitted (to Super Admin & Lab Owner for their own tenant).
-- Zero INSERT/UPDATE/DELETE policies exist for anon or authenticated callers.
DROP POLICY IF EXISTS "Super Admin can view all audit logs" ON public.audit_logs;
CREATE POLICY "Super Admin can view all audit logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Lab owner can view own tenant audit logs" ON public.audit_logs;
CREATE POLICY "Lab owner can view own tenant audit logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (
    tenant_id IS NOT NULL
    AND tenant_id = public.current_tenant_id()
    AND public.current_user_role() = 'lab_owner'
  );

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

DO $$
DECLARE
  tbl TEXT;
  audited_tables TEXT[] := ARRAY[
    'tenants',
    'tenant_subscriptions',
    'user_profiles',
    'tenant_settings',
    'doctors',
    'tests',
    'test_parameters',
    'patients',
    'reports',
    'report_services',
    'report_test_results',
    'report_xray_results'
  ];
BEGIN
  FOREACH tbl IN ARRAY audited_tables
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.record_audit_log()',
      tbl, tbl
    );
  END LOOP;
END;
$$;
