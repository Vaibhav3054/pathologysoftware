-- =========================================================================
-- MIGRATION 007: Lock Down SECURITY DEFINER RPCs & Enforce Subscription Expiry in RLS
-- Safe to run directly on an existing Supabase database.
-- =========================================================================

-- 1. Database-level Subscription & Tenant Status Check
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

-- 2. Harden provision_new_tenant: non-super-admins are strictly forced into 3-day trial
CREATE OR REPLACE FUNCTION public.provision_new_tenant(
  p_name TEXT,
  p_slug TEXT,
  p_phone TEXT,
  p_email TEXT,
  p_address TEXT,
  p_plan_type TEXT DEFAULT 'trial',
  p_subscription_source TEXT DEFAULT 'trial',
  p_duration_days INT DEFAULT 3,
  p_is_unlimited BOOLEAN DEFAULT false,
  p_is_test_lab BOOLEAN DEFAULT false,
  p_notes TEXT DEFAULT '',
  p_admin_user_id UUID DEFAULT NULL,
  p_owner_id UUID DEFAULT NULL,
  p_owner_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_starts_at TIMESTAMPTZ := now();
  v_expires_at TIMESTAMPTZ;
  v_billing_amount NUMERIC(10, 2) := 0.00;
  v_prefix TEXT;
  v_plan TEXT := p_plan_type;
  v_source TEXT := p_subscription_source;
  v_is_unlimited BOOLEAN := p_is_unlimited;
  v_is_test_lab BOOLEAN := p_is_test_lab;
  v_admin_user_id UUID := p_admin_user_id;
  v_notes TEXT := p_notes;
  v_is_privileged BOOLEAN := (current_user IN ('postgres', 'supabase_admin', 'service_role') OR public.is_super_admin());
BEGIN
  IF NOT v_is_privileged THEN
    -- Self-service signups MUST bind to a newly registered auth.users owner and strictly get a 3-day trial
    IF p_owner_id IS NULL THEN
      RAISE EXCEPTION 'Owner user ID is required for self-registration';
    END IF;

    v_plan := 'trial';
    v_source := 'trial';
    v_is_unlimited := false;
    v_is_test_lab := false;
    v_admin_user_id := NULL;
    v_notes := '3-Day Automatic Free Trial';
  END IF;

  IF p_owner_id IS NOT NULL THEN
    IF NOT v_is_privileged AND auth.uid() IS NOT NULL AND p_owner_id <> auth.uid() THEN
      RAISE EXCEPTION 'Unauthorized owner assignment';
    END IF;

    -- Only block if the user profile already belongs to another ACTIVE laboratory
    IF EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_owner_id AND tenant_id IS NOT NULL) THEN
      RAISE EXCEPTION 'User profile already belongs to an existing laboratory';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = p_owner_id AND LOWER(email) = LOWER(TRIM(p_email))
    ) THEN
      RAISE EXCEPTION 'Referenced auth user does not exist or email mismatch';
    END IF;
  END IF;

  -- Trial vs Super Admin / Paid duration handling
  IF v_source = 'trial' OR v_plan = 'trial' THEN
    v_plan := 'trial';
    v_source := 'trial';
    v_billing_amount := 0.00;
    v_expires_at := v_starts_at + INTERVAL '3 days';
    v_is_unlimited := false;
    IF COALESCE(v_notes, '') = '' THEN
      v_notes := '3-Day Automatic Free Trial';
    END IF;
  ELSIF v_is_unlimited THEN
    v_expires_at := NULL;
  ELSIF p_duration_days IS NOT NULL AND p_duration_days > 0 THEN
    v_expires_at := v_starts_at + (p_duration_days || ' days')::INTERVAL;
  ELSE
    v_expires_at := v_starts_at + INTERVAL '30 days';
  END IF;

  -- Generate short 3-letter prefix for reports from lab name
  v_prefix := UPPER(SUBSTRING(REGEXP_REPLACE(p_name, '[^a-zA-Z]', '', 'g') FROM 1 FOR 3)) || '-';
  IF LENGTH(v_prefix) < 4 THEN
    v_prefix := 'LAB-';
  END IF;

  -- 1. Create Tenant Record
  INSERT INTO public.tenants (name, slug, phone, email, address, status, is_test_lab)
  VALUES (p_name, LOWER(p_slug), p_phone, p_email, p_address, 'active', v_is_test_lab)
  RETURNING id INTO v_tenant_id;

  -- 2. Create Initial Tenant Settings
  INSERT INTO public.tenant_settings (
    tenant_id, clinic_name, tagline, address, phone, email,
    report_number_prefix, report_number_digits, next_report_number
  ) VALUES (
    v_tenant_id, p_name, 'Diagnostic & Clinical Laboratory', p_address, p_phone, p_email,
    v_prefix, 6, 1
  );

  -- 3. Automatically Seed Standard Indian Diagnostic Catalog
  PERFORM public.seed_tenant_catalog(v_tenant_id);

  -- 4. Create Subscription Record
  IF v_source IN ('trial', 'complimentary', 'test_demo', 'super_admin') THEN
    v_billing_amount := 0.00;
  ELSIF v_plan = 'yearly' THEN
    v_billing_amount := 9999.00;
  ELSE
    v_billing_amount := 999.00;
  END IF;

  INSERT INTO public.tenant_subscriptions (
    tenant_id, plan_type, subscription_source, status,
    billing_amount, starts_at, expires_at, is_unlimited,
    granted_by_admin_id, notes
  ) VALUES (
    v_tenant_id, v_plan, v_source, 'active',
    v_billing_amount, v_starts_at, v_expires_at, v_is_unlimited,
    v_admin_user_id, v_notes
  );

  -- 5. Create or Update Lab Owner Profile
  IF p_owner_id IS NOT NULL THEN
    INSERT INTO public.user_profiles (id, tenant_id, email, full_name, role, is_active)
    VALUES (
      p_owner_id,
      v_tenant_id,
      TRIM(p_email),
      COALESCE(p_owner_name, p_name),
      'lab_owner',
      true
    )
    ON CONFLICT (id) DO UPDATE
    SET tenant_id = v_tenant_id,
        role = 'lab_owner',
        is_active = true,
        full_name = COALESCE(EXCLUDED.full_name, public.user_profiles.full_name),
        updated_at = now();
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'tenant_id', v_tenant_id,
    'name', p_name,
    'slug', p_slug,
    'plan_type', v_plan,
    'subscription_source', v_source,
    'starts_at', v_starts_at,
    'expires_at', v_expires_at,
    'is_unlimited', v_is_unlimited,
    'is_test_lab', v_is_test_lab
  );
END;
$$;

-- 3. Harden generate_next_report_number: caller must own the tenant with active sub
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
  IF current_user NOT IN ('postgres', 'supabase_admin', 'service_role') AND NOT public.is_super_admin() THEN
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
    v_prefix := 'AP-';
    v_digits := 6;
    v_next := 1;
  END IF;

  v_result := v_prefix || LPAD(v_next::TEXT, v_digits, '0');

  UPDATE public.tenant_settings
  SET next_report_number = v_next + 1,
      updated_at = now()
  WHERE tenant_id = target_tenant_id;

  RETURN v_result;
END;
$$;

-- 4. Guard activate_paid_subscription: ONLY service_role (verified payment webhook) or Super Admin
CREATE OR REPLACE FUNCTION public.activate_paid_subscription(
  target_tenant_id UUID,
  p_plan_type TEXT DEFAULT 'monthly',
  p_payment_notes TEXT DEFAULT 'Online Subscription Activation'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_starts_at TIMESTAMPTZ := now();
  v_expires_at TIMESTAMPTZ;
  v_billing_amount NUMERIC(10, 2);
  v_sub_id UUID;
BEGIN
  IF current_user NOT IN ('postgres', 'supabase_admin', 'service_role') AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized: paid subscription activation requires verified server payment';
  END IF;

  IF p_plan_type = 'yearly' THEN
    v_billing_amount := 9999.00;
    v_expires_at := v_starts_at + INTERVAL '365 days';
  ELSE
    v_billing_amount := 999.00;
    v_expires_at := v_starts_at + INTERVAL '30 days';
  END IF;

  INSERT INTO public.tenant_subscriptions (
    tenant_id, plan_type, subscription_source, status,
    billing_amount, starts_at, expires_at, is_unlimited,
    notes
  ) VALUES (
    target_tenant_id, p_plan_type, 'payment', 'active',
    v_billing_amount, v_starts_at, v_expires_at, false,
    p_payment_notes
  )
  RETURNING id INTO v_sub_id;

  UPDATE public.tenants SET status = 'active', updated_at = now() WHERE id = target_tenant_id;

  RETURN jsonb_build_object(
    'success', true,
    'subscription_id', v_sub_id,
    'plan_type', p_plan_type,
    'billing_amount', v_billing_amount,
    'starts_at', v_starts_at,
    'expires_at', v_expires_at
  );
END;
$$;

-- 5. Least-Privilege Function EXECUTE Permissions (revoke blanket anon/client access)
REVOKE ALL ON FUNCTION public.activate_paid_subscription(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_paid_subscription(UUID, TEXT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.generate_next_report_number(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_next_report_number(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.seed_tenant_catalog(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_tenant_catalog(UUID) TO service_role;

REVOKE ALL ON FUNCTION public.has_active_subscription(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(UUID) TO authenticated, service_role;

-- 6. Enforce has_active_subscription() in RLS Across Business & Asset Tables
-- Tenants (keep SELECT open for Paywall screen, gate UPDATE)
DROP POLICY IF EXISTS "Lab owner can update their own lab details" ON public.tenants;
CREATE POLICY "Lab owner can update their own lab details"
  ON public.tenants
  FOR UPDATE
  TO authenticated
  USING (
    (id = public.current_tenant_id() AND public.current_user_role() = 'lab_owner' AND public.has_active_subscription(id))
    OR public.is_super_admin()
  )
  WITH CHECK (
    (id = public.current_tenant_id() AND public.current_user_role() = 'lab_owner' AND public.has_active_subscription(id))
    OR public.is_super_admin()
  );

-- Tenant Settings (keep SELECT open for Paywall branding, gate writes)
DROP POLICY IF EXISTS "Lab owner can update lab settings" ON public.tenant_settings;
CREATE POLICY "Lab owner can update lab settings"
  ON public.tenant_settings
  FOR ALL
  TO authenticated
  USING (
    (tenant_id = public.current_tenant_id() AND public.current_user_role() = 'lab_owner' AND public.has_active_subscription(tenant_id))
    OR public.is_super_admin()
  )
  WITH CHECK (
    (tenant_id = public.current_tenant_id() AND public.current_user_role() = 'lab_owner' AND public.has_active_subscription(tenant_id))
    OR public.is_super_admin()
  );

-- Doctors
DROP POLICY IF EXISTS "Tenant staff can view doctors" ON public.doctors;
CREATE POLICY "Tenant staff can view doctors"
  ON public.doctors FOR SELECT TO authenticated
  USING ((tenant_id = public.current_tenant_id() AND public.has_active_subscription(tenant_id)) OR public.is_super_admin());

DROP POLICY IF EXISTS "Tenant staff can manage doctors" ON public.doctors;
CREATE POLICY "Tenant staff can manage doctors"
  ON public.doctors FOR ALL TO authenticated
  USING ((tenant_id = public.current_tenant_id() AND public.has_active_subscription(tenant_id)) OR public.is_super_admin())
  WITH CHECK ((tenant_id = public.current_tenant_id() AND public.has_active_subscription(tenant_id)) OR public.is_super_admin());

-- Tests & Parameters
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

-- Patients
DROP POLICY IF EXISTS "Tenant staff can view patients" ON public.patients;
CREATE POLICY "Tenant staff can view patients"
  ON public.patients FOR SELECT TO authenticated
  USING ((tenant_id = public.current_tenant_id() AND public.has_active_subscription(tenant_id)) OR public.is_super_admin());

DROP POLICY IF EXISTS "Tenant staff can manage patients" ON public.patients;
CREATE POLICY "Tenant staff can manage patients"
  ON public.patients FOR ALL TO authenticated
  USING ((tenant_id = public.current_tenant_id() AND public.current_user_role() IN ('lab_owner', 'receptionist') AND public.has_active_subscription(tenant_id)) OR public.is_super_admin())
  WITH CHECK ((tenant_id = public.current_tenant_id() AND public.current_user_role() IN ('lab_owner', 'receptionist') AND public.has_active_subscription(tenant_id)) OR public.is_super_admin());

-- Reports
DROP POLICY IF EXISTS "Tenant staff can view reports" ON public.reports;
CREATE POLICY "Tenant staff can view reports"
  ON public.reports FOR SELECT TO authenticated
  USING ((tenant_id = public.current_tenant_id() AND public.has_active_subscription(tenant_id)) OR public.is_super_admin());

DROP POLICY IF EXISTS "Tenant staff can create reports" ON public.reports;
CREATE POLICY "Tenant staff can create reports"
  ON public.reports FOR INSERT TO authenticated
  WITH CHECK ((tenant_id = public.current_tenant_id() AND public.has_active_subscription(tenant_id)) OR public.is_super_admin());

DROP POLICY IF EXISTS "Tenant staff can update reports" ON public.reports;
CREATE POLICY "Tenant staff can update reports"
  ON public.reports FOR UPDATE TO authenticated
  USING ((tenant_id = public.current_tenant_id() AND public.has_active_subscription(tenant_id)) OR public.is_super_admin())
  WITH CHECK ((tenant_id = public.current_tenant_id() AND public.has_active_subscription(tenant_id)) OR public.is_super_admin());

-- Report Services, Test Results, X-Ray Results
DROP POLICY IF EXISTS "Tenant staff can view report services" ON public.report_services;
CREATE POLICY "Tenant staff can view report services"
  ON public.report_services FOR SELECT TO authenticated
  USING ((tenant_id = public.current_tenant_id() AND public.has_active_subscription(tenant_id)) OR public.is_super_admin());

DROP POLICY IF EXISTS "Tenant staff can manage report services" ON public.report_services;
CREATE POLICY "Tenant staff can manage report services"
  ON public.report_services FOR ALL TO authenticated
  USING ((tenant_id = public.current_tenant_id() AND public.has_active_subscription(tenant_id)) OR public.is_super_admin())
  WITH CHECK ((tenant_id = public.current_tenant_id() AND public.has_active_subscription(tenant_id)) OR public.is_super_admin());

DROP POLICY IF EXISTS "Tenant staff can view report test results" ON public.report_test_results;
CREATE POLICY "Tenant staff can view report test results"
  ON public.report_test_results FOR SELECT TO authenticated
  USING ((tenant_id = public.current_tenant_id() AND public.has_active_subscription(tenant_id)) OR public.is_super_admin());

DROP POLICY IF EXISTS "Tenant staff can manage report test results" ON public.report_test_results;
CREATE POLICY "Tenant staff can manage report test results"
  ON public.report_test_results FOR ALL TO authenticated
  USING ((tenant_id = public.current_tenant_id() AND public.has_active_subscription(tenant_id)) OR public.is_super_admin())
  WITH CHECK ((tenant_id = public.current_tenant_id() AND public.has_active_subscription(tenant_id)) OR public.is_super_admin());

DROP POLICY IF EXISTS "Tenant staff can view report xray results" ON public.report_xray_results;
CREATE POLICY "Tenant staff can view report xray results"
  ON public.report_xray_results FOR SELECT TO authenticated
  USING ((tenant_id = public.current_tenant_id() AND public.has_active_subscription(tenant_id)) OR public.is_super_admin());

DROP POLICY IF EXISTS "Tenant staff can manage report xray results" ON public.report_xray_results;
CREATE POLICY "Tenant staff can manage report xray results"
  ON public.report_xray_results FOR ALL TO authenticated
  USING ((tenant_id = public.current_tenant_id() AND public.has_active_subscription(tenant_id)) OR public.is_super_admin())
  WITH CHECK ((tenant_id = public.current_tenant_id() AND public.has_active_subscription(tenant_id)) OR public.is_super_admin());

-- Storage bucket uploads/updates/deletes gated by active subscription
DROP POLICY IF EXISTS "Tenant staff can upload assets to their own folder" ON storage.objects;
CREATE POLICY "Tenant staff can upload assets to their own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'lab-assets'
    AND (storage.foldername(name))[1] = public.current_tenant_id()::TEXT
    AND public.has_active_subscription(public.current_tenant_id())
  );

DROP POLICY IF EXISTS "Tenant staff can update assets in their own folder" ON storage.objects;
CREATE POLICY "Tenant staff can update assets in their own folder"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'lab-assets'
    AND (storage.foldername(name))[1] = public.current_tenant_id()::TEXT
    AND public.has_active_subscription(public.current_tenant_id())
  );

DROP POLICY IF EXISTS "Tenant staff can delete assets in their own folder" ON storage.objects;
CREATE POLICY "Tenant staff can delete assets in their own folder"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'lab-assets'
    AND (storage.foldername(name))[1] = public.current_tenant_id()::TEXT
    AND public.has_active_subscription(public.current_tenant_id())
  );
