-- =========================================================================
-- MIGRATION 003: Row Level Security (RLS) Policies
-- Complete Tenant Isolation at the PostgreSQL Database Layer
-- =========================================================================

-- Enable RLS on all tables
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_xray_results ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------------------
-- 1. TENANTS POLICIES
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "Super Admin can manage all tenants" ON public.tenants;
CREATE POLICY "Super Admin can manage all tenants"
  ON public.tenants
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Tenant staff can view their own tenant record" ON public.tenants;
CREATE POLICY "Tenant staff can view their own tenant record"
  ON public.tenants
  FOR SELECT
  TO authenticated
  USING (id = public.current_tenant_id());

DROP POLICY IF EXISTS "Lab owner can update their own lab details" ON public.tenants;
CREATE POLICY "Lab owner can update their own lab details"
  ON public.tenants
  FOR UPDATE
  TO authenticated
  USING (id = public.current_tenant_id() AND public.current_user_role() IN ('lab_owner', 'super_admin'))
  WITH CHECK (id = public.current_tenant_id());

-- -------------------------------------------------------------------------
-- 2. TENANT SUBSCRIPTIONS POLICIES
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "Super Admin can manage all subscriptions" ON public.tenant_subscriptions;
CREATE POLICY "Super Admin can manage all subscriptions"
  ON public.tenant_subscriptions
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Tenants can view their own subscription status" ON public.tenant_subscriptions;
CREATE POLICY "Tenants can view their own subscription status"
  ON public.tenant_subscriptions
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- -------------------------------------------------------------------------
-- 3. USER PROFILES POLICIES
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "Super Admin can view and manage all user profiles" ON public.user_profiles;
CREATE POLICY "Super Admin can view and manage all user profiles"
  ON public.user_profiles
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Users can view staff within their own tenant" ON public.user_profiles;
CREATE POLICY "Users can view staff within their own tenant"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR (tenant_id IS NOT NULL AND tenant_id = public.current_tenant_id())
  );

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

-- Defense-in-depth trigger preventing self-promotion, role escalation, or tenant hijacking
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

-- -------------------------------------------------------------------------
-- 4. TENANT SETTINGS POLICIES
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "Tenant staff can view lab settings" ON public.tenant_settings;
CREATE POLICY "Tenant staff can view lab settings"
  ON public.tenant_settings
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Lab owner can update lab settings" ON public.tenant_settings;
CREATE POLICY "Lab owner can update lab settings"
  ON public.tenant_settings
  FOR ALL
  TO authenticated
  USING ((tenant_id = public.current_tenant_id() AND public.current_user_role() IN ('lab_owner', 'super_admin')) OR public.is_super_admin())
  WITH CHECK ((tenant_id = public.current_tenant_id() AND public.current_user_role() IN ('lab_owner', 'super_admin')) OR public.is_super_admin());

-- -------------------------------------------------------------------------
-- 5. DOCTORS POLICIES
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "Tenant staff can view doctors" ON public.doctors;
CREATE POLICY "Tenant staff can view doctors"
  ON public.doctors FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Tenant staff can manage doctors" ON public.doctors;
CREATE POLICY "Tenant staff can manage doctors"
  ON public.doctors FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin())
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_super_admin());

-- -------------------------------------------------------------------------
-- 6. TESTS & TEST PARAMETERS POLICIES
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "Tenant staff can view tests" ON public.tests;
CREATE POLICY "Tenant staff can view tests"
  ON public.tests FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Lab owner can manage tests" ON public.tests;
CREATE POLICY "Lab owner can manage tests"
  ON public.tests FOR ALL TO authenticated
  USING ((tenant_id = public.current_tenant_id() AND public.current_user_role() IN ('lab_owner', 'super_admin')) OR public.is_super_admin())
  WITH CHECK ((tenant_id = public.current_tenant_id() AND public.current_user_role() IN ('lab_owner', 'super_admin')) OR public.is_super_admin());

DROP POLICY IF EXISTS "Tenant staff can view test parameters" ON public.test_parameters;
CREATE POLICY "Tenant staff can view test parameters"
  ON public.test_parameters FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Lab owner can manage test parameters" ON public.test_parameters;
CREATE POLICY "Lab owner can manage test parameters"
  ON public.test_parameters FOR ALL TO authenticated
  USING ((tenant_id = public.current_tenant_id() AND public.current_user_role() IN ('lab_owner', 'super_admin')) OR public.is_super_admin())
  WITH CHECK ((tenant_id = public.current_tenant_id() AND public.current_user_role() IN ('lab_owner', 'super_admin')) OR public.is_super_admin());

-- -------------------------------------------------------------------------
-- 7. PATIENTS POLICIES
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "Tenant staff can view patients" ON public.patients;
CREATE POLICY "Tenant staff can view patients"
  ON public.patients FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Tenant staff can manage patients" ON public.patients;
CREATE POLICY "Tenant staff can manage patients"
  ON public.patients FOR ALL TO authenticated
  USING ((tenant_id = public.current_tenant_id() AND public.current_user_role() IN ('lab_owner', 'receptionist', 'super_admin')) OR public.is_super_admin())
  WITH CHECK ((tenant_id = public.current_tenant_id() AND public.current_user_role() IN ('lab_owner', 'receptionist', 'super_admin')) OR public.is_super_admin());

-- -------------------------------------------------------------------------
-- 8. REPORTS POLICIES
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "Tenant staff can view reports" ON public.reports;
CREATE POLICY "Tenant staff can view reports"
  ON public.reports FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Tenant staff can create reports" ON public.reports;
CREATE POLICY "Tenant staff can create reports"
  ON public.reports FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Tenant staff can update reports" ON public.reports;
CREATE POLICY "Tenant staff can update reports"
  ON public.reports FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin())
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_super_admin());

-- -------------------------------------------------------------------------
-- 9. REPORT SERVICES, TEST RESULTS, X-RAY RESULTS POLICIES
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "Tenant staff can view report services" ON public.report_services;
CREATE POLICY "Tenant staff can view report services"
  ON public.report_services FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Tenant staff can manage report services" ON public.report_services;
CREATE POLICY "Tenant staff can manage report services"
  ON public.report_services FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin())
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Tenant staff can view report test results" ON public.report_test_results;
CREATE POLICY "Tenant staff can view report test results"
  ON public.report_test_results FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Tenant staff can manage report test results" ON public.report_test_results;
CREATE POLICY "Tenant staff can manage report test results"
  ON public.report_test_results FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin())
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Tenant staff can view report xray results" ON public.report_xray_results;
CREATE POLICY "Tenant staff can view report xray results"
  ON public.report_xray_results FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "Tenant staff can manage report xray results" ON public.report_xray_results;
CREATE POLICY "Tenant staff can manage report xray results"
  ON public.report_xray_results FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin())
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_super_admin());
