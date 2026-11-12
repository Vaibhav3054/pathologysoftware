-- =========================================================================
-- MIGRATION 009: Super Admin Platform Isolation, Dedicated Demo Lab & Backend Guards
-- Run in Supabase SQL Editor. Safe & idempotent on existing databases.
-- =========================================================================

-- 1. Allow 'paused' status on tenant_subscriptions alongside active/trial/expired/cancelled
DO $$
DECLARE
  c_name TEXT;
BEGIN
  SELECT conname INTO c_name
  FROM pg_constraint
  WHERE conrelid = 'public.tenant_subscriptions'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%';

  IF c_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.tenant_subscriptions DROP CONSTRAINT %I', c_name);
  END IF;
END;
$$;

ALTER TABLE public.tenant_subscriptions
  ADD CONSTRAINT tenant_subscriptions_status_check
  CHECK (status IN ('active', 'trial', 'paused', 'expired', 'cancelled', 'grace_period'));

-- 2. Provision an isolated Super Admin Test/Demo Laboratory and bind super_admin profiles to it
DO $$
DECLARE
  v_demo_tenant_id UUID;
BEGIN
  SELECT id INTO v_demo_tenant_id
  FROM public.tenants
  WHERE slug = 'super-admin-sandbox-demo'
  LIMIT 1;

  IF v_demo_tenant_id IS NULL THEN
    INSERT INTO public.tenants (name, slug, phone, email, address, status, is_test_lab)
    VALUES (
      'Super Admin Test & Demo Lab',
      'super-admin-sandbox-demo',
      '+91 90000 00000',
      'demo@pathologysaas.com',
      'Isolated Sandbox Environment (Super Admin Demo)',
      'active',
      true
    )
    RETURNING id INTO v_demo_tenant_id;

    INSERT INTO public.tenant_settings (
      tenant_id, clinic_name, tagline, address, phone, email,
      report_number_prefix, report_number_digits, next_report_number
    ) VALUES (
      v_demo_tenant_id,
      'SUPER ADMIN TEST / DEMO LAB',
      'Isolated Platform Sandbox Laboratory',
      'Sandbox Mode — Customer Labs Remain Strictly Private',
      '+91 90000 00000',
      'demo@pathologysaas.com',
      'DEMO-',
      6,
      1
    );

    PERFORM public.seed_tenant_catalog(v_demo_tenant_id);

    INSERT INTO public.tenant_subscriptions (
      tenant_id, plan_type, subscription_source, status,
      billing_amount, starts_at, expires_at, is_unlimited, notes
    ) VALUES (
      v_demo_tenant_id,
      'unlimited',
      'test_demo',
      'active',
      0.00,
      now(),
      NULL,
      true,
      'Dedicated Isolated Super Admin Test & Demo Laboratory'
    );
  END IF;

  UPDATE public.user_profiles
  SET tenant_id = v_demo_tenant_id,
      updated_at = now()
  WHERE role = 'super_admin'
    AND tenant_id IS NULL;
END;
$$;

-- 3. Remove cross-tenant super_admin bypass from subscription & report-sequence functions
-- Super Admin operates strictly inside their own assigned Demo Lab (current_tenant_id()).
CREATE OR REPLACE FUNCTION public.has_active_subscription(p_tenant_id UUID DEFAULT public.current_tenant_id())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
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
    );
$$;

CREATE OR REPLACE FUNCTION public.generate_next_report_number(target_tenant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix TEXT;
  v_digits INT;
  v_next INT;
  v_result TEXT;
BEGIN
  IF current_user NOT IN ('postgres', 'supabase_admin', 'service_role') THEN
    IF target_tenant_id IS DISTINCT FROM public.current_tenant_id() THEN
      RAISE EXCEPTION 'Unauthorized tenant report number access';
    END IF;
    IF NOT public.has_active_subscription(target_tenant_id) THEN
      RAISE EXCEPTION 'Subscription expired or tenant suspended';
    END IF;
  END IF;

  SELECT report_number_prefix, report_number_digits, next_report_number
  INTO v_prefix, v_digits, v_next
  FROM public.tenant_settings
  WHERE tenant_id = target_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'LAB-' || TO_CHAR(now(), 'YYYYMMDD') || '-0001';
  END IF;

  v_result := COALESCE(v_prefix, 'LAB-') || LPAD(v_next::TEXT, COALESCE(v_digits, 6), '0');

  UPDATE public.tenant_settings
  SET next_report_number = v_next + 1,
      updated_at = now()
  WHERE tenant_id = target_tenant_id;

  RETURN v_result;
END;
$$;

-- 4. Strict Tenant Isolation on ALL Operational & Clinical Tables
-- Remove OR public.is_super_admin() from customer patient/medical/catalog/settings/audit tables.
-- Super Admin only has operational access inside their own isolated Demo Lab (current_tenant_id()).

-- tenant_settings
DROP POLICY IF EXISTS "Tenant staff can view lab settings" ON public.tenant_settings;
CREATE POLICY "Tenant staff can view lab settings"
  ON public.tenant_settings FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "Lab owner can update lab settings" ON public.tenant_settings;
CREATE POLICY "Lab owner can update lab settings"
  ON public.tenant_settings FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('lab_owner', 'super_admin')
    AND public.has_active_subscription(tenant_id)
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('lab_owner', 'super_admin')
    AND public.has_active_subscription(tenant_id)
  );

-- tenants (allow update only by platform super_admin or owner of own tenant)
DROP POLICY IF EXISTS "Lab owner can update their own lab details" ON public.tenants;
CREATE POLICY "Lab owner can update their own lab details"
  ON public.tenants FOR UPDATE TO authenticated
  USING (
    (id = public.current_tenant_id() AND public.current_user_role() = 'lab_owner' AND public.has_active_subscription(id))
    OR public.is_super_admin()
  )
  WITH CHECK (
    (id = public.current_tenant_id() AND public.current_user_role() = 'lab_owner' AND public.has_active_subscription(id))
    OR public.is_super_admin()
  );

-- doctors
DROP POLICY IF EXISTS "Tenant staff can view doctors" ON public.doctors;
CREATE POLICY "Tenant staff can view doctors"
  ON public.doctors FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.has_active_subscription(tenant_id));

DROP POLICY IF EXISTS "Lab owner can manage doctors" ON public.doctors;
CREATE POLICY "Lab owner can manage doctors"
  ON public.doctors FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('lab_owner', 'super_admin')
    AND public.has_active_subscription(tenant_id)
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('lab_owner', 'super_admin')
    AND public.has_active_subscription(tenant_id)
  );

-- tests
DROP POLICY IF EXISTS "Tenant staff can view tests" ON public.tests;
CREATE POLICY "Tenant staff can view tests"
  ON public.tests FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.has_active_subscription(tenant_id));

DROP POLICY IF EXISTS "Lab owner can manage tests" ON public.tests;
CREATE POLICY "Lab owner can manage tests"
  ON public.tests FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('lab_owner', 'super_admin')
    AND public.has_active_subscription(tenant_id)
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('lab_owner', 'super_admin')
    AND public.has_active_subscription(tenant_id)
  );

-- test_parameters
DROP POLICY IF EXISTS "Tenant staff can view test parameters" ON public.test_parameters;
CREATE POLICY "Tenant staff can view test parameters"
  ON public.test_parameters FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.has_active_subscription(tenant_id));

DROP POLICY IF EXISTS "Lab owner can manage test parameters" ON public.test_parameters;
CREATE POLICY "Lab owner can manage test parameters"
  ON public.test_parameters FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('lab_owner', 'super_admin')
    AND public.has_active_subscription(tenant_id)
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('lab_owner', 'super_admin')
    AND public.has_active_subscription(tenant_id)
  );

-- patients
DROP POLICY IF EXISTS "Tenant staff can view patients" ON public.patients;
CREATE POLICY "Tenant staff can view patients"
  ON public.patients FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.has_active_subscription(tenant_id));

DROP POLICY IF EXISTS "Tenant staff can manage patients" ON public.patients;
CREATE POLICY "Tenant staff can manage patients"
  ON public.patients FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('lab_owner', 'receptionist', 'super_admin')
    AND public.has_active_subscription(tenant_id)
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('lab_owner', 'receptionist', 'super_admin')
    AND public.has_active_subscription(tenant_id)
  );

-- reports
DROP POLICY IF EXISTS "Tenant staff can view reports" ON public.reports;
CREATE POLICY "Tenant staff can view reports"
  ON public.reports FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.has_active_subscription(tenant_id));

DROP POLICY IF EXISTS "Tenant staff can create reports" ON public.reports;
CREATE POLICY "Tenant staff can create reports"
  ON public.reports FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('lab_owner', 'receptionist', 'super_admin')
    AND public.has_active_subscription(tenant_id)
  );

DROP POLICY IF EXISTS "Tenant staff can update reports" ON public.reports;
CREATE POLICY "Tenant staff can update reports"
  ON public.reports FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('lab_owner', 'receptionist', 'super_admin')
    AND public.has_active_subscription(tenant_id)
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('lab_owner', 'receptionist', 'super_admin')
    AND public.has_active_subscription(tenant_id)
  );

-- report_services
DROP POLICY IF EXISTS "Tenant staff can view report services" ON public.report_services;
CREATE POLICY "Tenant staff can view report services"
  ON public.report_services FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.has_active_subscription(tenant_id));

DROP POLICY IF EXISTS "Tenant staff can manage report services" ON public.report_services;
CREATE POLICY "Tenant staff can manage report services"
  ON public.report_services FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('lab_owner', 'receptionist', 'super_admin')
    AND public.has_active_subscription(tenant_id)
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('lab_owner', 'receptionist', 'super_admin')
    AND public.has_active_subscription(tenant_id)
  );

-- report_test_results
DROP POLICY IF EXISTS "Tenant staff can view report test results" ON public.report_test_results;
CREATE POLICY "Tenant staff can view report test results"
  ON public.report_test_results FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.has_active_subscription(tenant_id));

DROP POLICY IF EXISTS "Tenant staff can manage report test results" ON public.report_test_results;
CREATE POLICY "Tenant staff can manage report test results"
  ON public.report_test_results FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('lab_owner', 'receptionist', 'super_admin')
    AND public.has_active_subscription(tenant_id)
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('lab_owner', 'receptionist', 'super_admin')
    AND public.has_active_subscription(tenant_id)
  );

-- report_xray_results
DROP POLICY IF EXISTS "Tenant staff can view report xray results" ON public.report_xray_results;
CREATE POLICY "Tenant staff can view report xray results"
  ON public.report_xray_results FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.has_active_subscription(tenant_id));

DROP POLICY IF EXISTS "Tenant staff can manage report xray results" ON public.report_xray_results;
CREATE POLICY "Tenant staff can manage report xray results"
  ON public.report_xray_results FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('lab_owner', 'receptionist', 'super_admin')
    AND public.has_active_subscription(tenant_id)
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('lab_owner', 'receptionist', 'super_admin')
    AND public.has_active_subscription(tenant_id)
  );

-- audit_logs: Restrict even Super Admin from reading customer labs' patient audit payloads
DROP POLICY IF EXISTS "Super Admin can view all audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Lab owner can view own tenant audit logs" ON public.audit_logs;
CREATE POLICY "Lab owner can view own tenant audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (
    tenant_id IS NOT NULL
    AND tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('lab_owner', 'super_admin')
  );
