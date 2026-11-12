-- =========================================================================
-- MIGRATION 006: Harden user_profiles RLS & Prevent Privilege Escalation
-- Safe to run directly on an existing Supabase database.
-- =========================================================================

-- 1. Remove the insecure open INSERT policy that allowed any caller
--    (anon or authenticated) to insert arbitrary user_profiles rows.
DROP POLICY IF EXISTS "Allow user profile creation" ON public.user_profiles;

-- 2. Super Admin policy (full platform access strictly for real super_admins)
DROP POLICY IF EXISTS "Super Admin can view and manage all user profiles" ON public.user_profiles;
CREATE POLICY "Super Admin can view and manage all user profiles"
  ON public.user_profiles
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- 3. Users can view their own profile or staff within their own tenant
DROP POLICY IF EXISTS "Users can view staff within their own tenant" ON public.user_profiles;
CREATE POLICY "Users can view staff within their own tenant"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR (tenant_id IS NOT NULL AND tenant_id = public.current_tenant_id())
  );

-- 4. Lab owners can ONLY manage non-super-admin staff inside their own tenant
DROP POLICY IF EXISTS "Lab owners can manage staff profiles in their own lab" ON public.user_profiles;
CREATE POLICY "Lab owners can manage staff profiles in their own lab"
  ON public.user_profiles
  FOR ALL
  TO authenticated
  USING (
    public.current_user_role() = 'lab_owner'
    AND tenant_id IS NOT NULL
    AND tenant_id = public.current_tenant_id()
    AND role IN ('lab_owner', 'receptionist', 'technician')
  )
  WITH CHECK (
    public.current_user_role() = 'lab_owner'
    AND tenant_id IS NOT NULL
    AND tenant_id = public.current_tenant_id()
    AND role IN ('lab_owner', 'receptionist', 'technician')
  );

-- 5. Users can update ONLY non-privileged fields on their own profile
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
CREATE POLICY "Users can update their own profile"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = public.current_user_role()
    AND tenant_id IS NOT DISTINCT FROM public.current_tenant_id()
  );

-- 6. Defense-in-depth trigger blocking role/tenant/active-status tampering
CREATE OR REPLACE FUNCTION public.guard_user_profile_security()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
  v_caller_tenant UUID;
BEGIN
  -- Allow trusted DB owners / service_role / SECURITY DEFINER RPCs and Super Admins
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') OR public.is_super_admin() THEN
    RETURN NEW;
  END IF;

  v_caller_role := public.current_user_role();
  v_caller_tenant := public.current_tenant_id();

  IF TG_OP = 'INSERT' THEN
    IF v_caller_role = 'lab_owner'
       AND v_caller_tenant IS NOT NULL
       AND NEW.tenant_id = v_caller_tenant
       AND NEW.role IN ('lab_owner', 'receptionist', 'technician') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Unauthorized user_profiles insert or privilege assignment';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Cannot change profile user id';
    END IF;
    IF NEW.role = 'super_admin' THEN
      RAISE EXCEPTION 'Cannot assign super_admin role';
    END IF;
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
      RAISE EXCEPTION 'Cannot reassign tenant_id';
    END IF;

    IF v_caller_role <> 'lab_owner'
       OR v_caller_tenant IS NULL
       OR OLD.tenant_id IS DISTINCT FROM v_caller_tenant THEN
      IF NEW.role IS DISTINCT FROM OLD.role THEN
        RAISE EXCEPTION 'Cannot modify your own role';
      END IF;
      IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
        RAISE EXCEPTION 'Cannot modify account active status';
      END IF;
    ELSE
      -- Lab owner cannot change their own active status or touch non-lab roles
      IF NEW.id = auth.uid() AND NEW.is_active IS DISTINCT FROM OLD.is_active THEN
        RAISE EXCEPTION 'Cannot modify your own active status';
      END IF;
      IF NEW.id = auth.uid() AND NEW.role IS DISTINCT FROM OLD.role THEN
        RAISE EXCEPTION 'Cannot modify your own role';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_user_profile_security ON public.user_profiles;
CREATE TRIGGER trg_guard_user_profile_security
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_user_profile_security();

-- 7. Harden provision_new_tenant so p_owner_id cannot overwrite an existing
--    user's profile (e.g., an existing super_admin or another lab's owner).
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
  v_notes TEXT := p_notes;
BEGIN
  IF p_owner_id IS NOT NULL THEN
    IF NOT public.is_super_admin() AND auth.uid() IS NOT NULL AND p_owner_id <> auth.uid() THEN
      RAISE EXCEPTION 'Unauthorized owner assignment';
    END IF;

    IF EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_owner_id) THEN
      RAISE EXCEPTION 'User profile already belongs to an existing account';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = p_owner_id AND LOWER(email) = LOWER(TRIM(p_email))
    ) THEN
      RAISE EXCEPTION 'Referenced auth user does not exist or email mismatch';
    END IF;
  END IF;

  -- 3-Day Automatic Free Trial handling
  IF v_source = 'trial' OR v_plan = 'trial' THEN
    v_plan := 'trial';
    v_source := 'trial';
    v_billing_amount := 0.00;
    v_expires_at := v_starts_at + INTERVAL '3 days';
    IF v_notes = '' THEN
      v_notes := '3-Day Automatic Free Trial';
    END IF;
  ELSIF p_is_unlimited THEN
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
  VALUES (p_name, LOWER(p_slug), p_phone, p_email, p_address, 'active', p_is_test_lab)
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
    v_billing_amount, v_starts_at, v_expires_at, p_is_unlimited,
    p_admin_user_id, v_notes
  );

  -- 5. Create Lab Owner Profile (never updates/hijacks an existing profile)
  IF p_owner_id IS NOT NULL THEN
    INSERT INTO public.user_profiles (id, tenant_id, email, full_name, role, is_active)
    VALUES (
      p_owner_id,
      v_tenant_id,
      TRIM(p_email),
      COALESCE(p_owner_name, p_name),
      'lab_owner',
      true
    );
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
    'is_unlimited', p_is_unlimited,
    'is_test_lab', p_is_test_lab
  );
END;
$$;
