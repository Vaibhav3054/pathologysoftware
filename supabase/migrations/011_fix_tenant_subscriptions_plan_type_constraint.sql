-- =========================================================================
-- MIGRATION 011: Fix tenant_subscriptions Plan Type & Enable Trial Provisioning
-- Run in Supabase SQL Editor. Safe & idempotent on existing databases.
-- =========================================================================

-- 1. Fix plan_type check constraint on tenant_subscriptions to allow 'trial'
DO $$
DECLARE
  c_name TEXT;
BEGIN
  FOR c_name IN (
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.tenant_subscriptions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%plan_type%'
  ) LOOP
    EXECUTE format('ALTER TABLE public.tenant_subscriptions DROP CONSTRAINT IF EXISTS %I', c_name);
  END LOOP;
END;
$$;

ALTER TABLE public.tenant_subscriptions
  ADD CONSTRAINT tenant_subscriptions_plan_type_check
  CHECK (plan_type IN ('trial', 'monthly', 'yearly', 'custom', 'unlimited'));

-- 2. Fix subscription_source check constraint on tenant_subscriptions
DO $$
DECLARE
  c_name TEXT;
BEGIN
  FOR c_name IN (
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.tenant_subscriptions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%subscription_source%'
  ) LOOP
    EXECUTE format('ALTER TABLE public.tenant_subscriptions DROP CONSTRAINT IF EXISTS %I', c_name);
  END LOOP;
END;
$$;

ALTER TABLE public.tenant_subscriptions
  ADD CONSTRAINT tenant_subscriptions_source_check
  CHECK (subscription_source IN ('manual', 'payment', 'complimentary', 'trial', 'test_demo', 'super_admin'));

-- 3. Update provision_new_tenant:
--    - Allow 'trial' subscriptions safely
--    - Allow attaching tenant if an orphaned user_profile already exists (ON CONFLICT DO UPDATE)
--    - Auto-seed diagnostic catalog and 3-day free trial
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

  -- 4. Create Subscription Record (Active 3-day trial)
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

-- 4. Ensure permissions
GRANT EXECUTE ON FUNCTION public.provision_new_tenant(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INT, BOOLEAN, BOOLEAN, TEXT, UUID, UUID, TEXT
) TO anon, authenticated, service_role;
