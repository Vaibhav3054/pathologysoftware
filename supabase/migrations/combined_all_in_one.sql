-- =========================================================================
-- MIGRATION 001: Core Multi-Tenant Architecture & User Authentication Profiles
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Tenants Table (Each Pathology Lab is a Tenant)
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  address TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),
  is_test_lab BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by slug or status
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON public.tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON public.tenants(status);

-- 2. Tenant Subscriptions Table (Tracks Paid, Complimentary & Test/Demo Access)
CREATE TABLE IF NOT EXISTS public.tenant_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL DEFAULT 'monthly' CHECK (plan_type IN ('monthly', 'yearly', 'custom', 'unlimited')),
  subscription_source TEXT NOT NULL DEFAULT 'payment' CHECK (subscription_source IN ('payment', 'super_admin', 'complimentary', 'test_demo')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'grace_period')),
  billing_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ, -- NULL when is_unlimited is true
  is_unlimited BOOLEAN NOT NULL DEFAULT false,
  granted_by_admin_id UUID, -- References auth.users(id) for Super Admin audit trail
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_tenant ON public.tenant_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_status ON public.tenant_subscriptions(status);

-- 3. User Profiles Table (Linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE, -- NULL ONLY for Platform Super Admin
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'receptionist' CHECK (role IN ('super_admin', 'lab_owner', 'receptionist', 'technician')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant ON public.user_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);

-- 4. Helper Security Functions (Used by RLS Policies across all tables)
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role = 'super_admin' FROM public.user_profiles WHERE id = auth.uid() LIMIT 1),
    false
  );
$$;
-- =========================================================================
-- MIGRATION 002: Multi-Tenant Business Tables
-- =========================================================================

-- 1. Tenant Settings Table (Per-lab branding, header, letterhead & signage)
CREATE TABLE IF NOT EXISTS public.tenant_settings (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  clinic_name TEXT NOT NULL DEFAULT 'Diagnostic Centre',
  tagline TEXT DEFAULT 'Clinical Laboratory & X-Ray',
  address TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  reg_no TEXT DEFAULT '',
  signatory_name TEXT DEFAULT 'Consultant Pathologist',
  signatory_degree TEXT DEFAULT 'M.B.B.S., M.D. (Pathology)',
  signatory_designation TEXT DEFAULT 'Consultant Pathologist',
  logo_url TEXT DEFAULT '',
  signature_url TEXT DEFAULT '',
  letterhead_mode TEXT NOT NULL DEFAULT 'digital' CHECK (letterhead_mode IN ('digital', 'pad')),
  letterhead_top_margin INT NOT NULL DEFAULT 35,
  report_number_prefix TEXT NOT NULL DEFAULT 'AP-',
  report_number_digits INT NOT NULL DEFAULT 6,
  next_report_number INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Reference Doctors Table (Per-lab)
CREATE TABLE IF NOT EXISTS public.doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT public.current_tenant_id() REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_doctors_tenant ON public.doctors(tenant_id);

-- 3. Tests & Services Catalog (Per-lab)
CREATE TABLE IF NOT EXISTS public.tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT public.current_tenant_id() REFERENCES public.tenants(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'blood' CHECK (category IN ('blood', 'xray')),
  name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  department TEXT DEFAULT 'Pathology',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tests_tenant_cat ON public.tests(tenant_id, category);

-- 4. Test Parameters Table (Per-lab test profile templates)
CREATE TABLE IF NOT EXISTS public.test_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT public.current_tenant_id() REFERENCES public.tenants(id) ON DELETE CASCADE,
  test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT DEFAULT '',
  normal_range TEXT DEFAULT '',
  min_val NUMERIC,
  max_val NUMERIC,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_test_params_test ON public.test_parameters(test_id, display_order);

-- 5. Patients Table (Per-lab)
CREATE TABLE IF NOT EXISTS public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT public.current_tenant_id() REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  age INT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
  phone TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patients_tenant_search ON public.patients(tenant_id, phone, name);

-- 6. Clinical & Billing Reports Table (Per-lab)
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT public.current_tenant_id() REFERENCES public.tenants(id) ON DELETE CASCADE,
  report_number TEXT NOT NULL,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  patient_age INT NOT NULL,
  patient_gender TEXT NOT NULL,
  patient_phone TEXT NOT NULL,
  doctor_name TEXT DEFAULT 'Self / Direct',
  registration_date DATE NOT NULL DEFAULT CURRENT_DATE,
  registration_time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed')),
  total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  paid_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  pending_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  payment_status TEXT NOT NULL DEFAULT 'Pending' CHECK (payment_status IN ('Paid', 'Partially Paid', 'Pending')),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, report_number)
);

CREATE INDEX IF NOT EXISTS idx_reports_tenant_status ON public.reports(tenant_id, status, registration_date);
CREATE INDEX IF NOT EXISTS idx_reports_patient ON public.reports(patient_id);

-- 7. Report Selected Services Table
CREATE TABLE IF NOT EXISTS public.report_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT public.current_tenant_id() REFERENCES public.tenants(id) ON DELETE CASCADE,
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL,
  service_id UUID NOT NULL,
  service_name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0.00
);

CREATE INDEX IF NOT EXISTS idx_report_services_report ON public.report_services(report_id);

-- 8. Report Blood Test Results Table
CREATE TABLE IF NOT EXISTS public.report_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT public.current_tenant_id() REFERENCES public.tenants(id) ON DELETE CASCADE,
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  test_id UUID NOT NULL,
  test_name TEXT NOT NULL,
  parameter_id UUID,
  parameter_name TEXT NOT NULL,
  result TEXT DEFAULT '',
  unit TEXT DEFAULT '',
  normal_range TEXT DEFAULT '',
  is_abnormal BOOLEAN NOT NULL DEFAULT false,
  display_order INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_report_results_report ON public.report_test_results(report_id, test_id);

-- 9. Report Radiology / X-Ray Results Table
CREATE TABLE IF NOT EXISTS public.report_xray_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT public.current_tenant_id() REFERENCES public.tenants(id) ON DELETE CASCADE,
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  xray_id UUID NOT NULL,
  xray_name TEXT NOT NULL,
  findings TEXT DEFAULT '',
  impression TEXT DEFAULT '',
  remarks TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_report_xray_report ON public.report_xray_results(report_id);
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
  USING (tenant_id = public.current_tenant_id() OR id = auth.uid());

DROP POLICY IF EXISTS "Lab owners can manage staff profiles in their own lab" ON public.user_profiles;
CREATE POLICY "Lab owners can manage staff profiles in their own lab"
  ON public.user_profiles
  FOR ALL
  TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.current_user_role() = 'lab_owner')
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.current_user_role() = 'lab_owner');

DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
CREATE POLICY "Users can update their own profile"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

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
-- =========================================================================
-- MIGRATION 004: Standard Indian Diagnostic Catalog Seeder & Sequence Generator
-- =========================================================================

-- 1. Atomic Report Number Generator Function
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
  -- Lock settings row for target tenant to avoid race conditions
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

  -- Increment for next report
  UPDATE public.tenant_settings
  SET next_report_number = v_next + 1,
      updated_at = now()
  WHERE tenant_id = target_tenant_id;

  RETURN v_result;
END;
$$;

-- 2. Tenant Catalog Auto-Seeder Function (CBC, LFT, KFT, Sugars, Urine, X-Rays)
CREATE OR REPLACE FUNCTION public.seed_tenant_catalog(target_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cbc_id UUID;
  v_fbs_id UUID;
  v_ppbs_id UUID;
  v_rbs_id UUID;
  v_hba1c_id UUID;
  v_lipid_id UUID;
  v_lft_id UUID;
  v_kft_id UUID;
  v_thyroid_id UUID;
  v_widal_id UUID;
  v_urine_id UUID;
  v_dengue_id UUID;
  v_malaria_id UUID;
  v_lytes_id UUID;
BEGIN
  -- Insert Standard Reference Doctors
  INSERT INTO public.doctors (tenant_id, name) VALUES
    (target_tenant_id, 'Self / Direct'),
    (target_tenant_id, 'Dr. R. K. Sharma (M.B.B.S.)'),
    (target_tenant_id, 'Dr. Anita Verma (M.S., Gynae)'),
    (target_tenant_id, 'Dr. M. P. Singh (M.D., Physician)')
  ON CONFLICT DO NOTHING;

  -- 1. Complete Blood Count (CBC)
  INSERT INTO public.tests (tenant_id, category, name, price, department)
  VALUES (target_tenant_id, 'blood', 'Complete Blood Count (CBC)', 350.00, 'Pathology')
  RETURNING id INTO v_cbc_id;

  INSERT INTO public.test_parameters (tenant_id, test_id, name, unit, normal_range, min_val, max_val, display_order) VALUES
    (target_tenant_id, v_cbc_id, 'Hemoglobin (Hb)', 'g/dL', '13.0 - 17.0 (M) / 12.0 - 15.0 (F)', 12.0, 17.0, 1),
    (target_tenant_id, v_cbc_id, 'Total Leukocyte Count (TLC / WBC)', '/µL', '4,000 - 11,000', 4000, 11000, 2),
    (target_tenant_id, v_cbc_id, 'Neutrophils', '%', '40 - 70', 40, 70, 3),
    (target_tenant_id, v_cbc_id, 'Lymphocytes', '%', '20 - 45', 20, 45, 4),
    (target_tenant_id, v_cbc_id, 'Eosinophils', '%', '1 - 6', 1, 6, 5),
    (target_tenant_id, v_cbc_id, 'Monocytes', '%', '2 - 8', 2, 8, 6),
    (target_tenant_id, v_cbc_id, 'Basophils', '%', '0 - 1', 0, 1, 7),
    (target_tenant_id, v_cbc_id, 'Platelet Count', 'Lakh/µL', '1.50 - 4.50', 1.5, 4.5, 8),
    (target_tenant_id, v_cbc_id, 'Total RBC Count', 'million/µL', '4.5 - 5.5', 4.5, 5.5, 9),
    (target_tenant_id, v_cbc_id, 'Packed Cell Volume (PCV / HCT)', '%', '36 - 50', 36, 50, 10),
    (target_tenant_id, v_cbc_id, 'MCV', 'fL', '80 - 100', 80, 100, 11),
    (target_tenant_id, v_cbc_id, 'MCH', 'pg', '27 - 32', 27, 32, 12),
    (target_tenant_id, v_cbc_id, 'MCHC', 'g/dL', '32 - 36', 32, 36, 13),
    (target_tenant_id, v_cbc_id, 'ESR (Westergren)', 'mm/1st hr', '0 - 15 (M) / 0 - 20 (F)', 0, 20, 14);

  -- 2. Fasting Blood Sugar (FBS)
  INSERT INTO public.tests (tenant_id, category, name, price, department)
  VALUES (target_tenant_id, 'blood', 'Blood Glucose (Fasting)', 100.00, 'Pathology')
  RETURNING id INTO v_fbs_id;
  INSERT INTO public.test_parameters (tenant_id, test_id, name, unit, normal_range, min_val, max_val, display_order) VALUES
    (target_tenant_id, v_fbs_id, 'Fasting Blood Sugar (FBS)', 'mg/dL', '70 - 100', 70, 100, 1);

  -- 3. Post Prandial Blood Sugar (PPBS)
  INSERT INTO public.tests (tenant_id, category, name, price, department)
  VALUES (target_tenant_id, 'blood', 'Blood Glucose (Post Prandial)', 100.00, 'Pathology')
  RETURNING id INTO v_ppbs_id;
  INSERT INTO public.test_parameters (tenant_id, test_id, name, unit, normal_range, min_val, max_val, display_order) VALUES
    (target_tenant_id, v_ppbs_id, 'Post Prandial Blood Sugar (PPBS)', 'mg/dL', '70 - 140', 70, 140, 1);

  -- 4. Random Blood Sugar (RBS)
  INSERT INTO public.tests (tenant_id, category, name, price, department)
  VALUES (target_tenant_id, 'blood', 'Blood Glucose (Random)', 80.00, 'Pathology')
  RETURNING id INTO v_rbs_id;
  INSERT INTO public.test_parameters (tenant_id, test_id, name, unit, normal_range, min_val, max_val, display_order) VALUES
    (target_tenant_id, v_rbs_id, 'Random Blood Sugar (RBS)', 'mg/dL', '70 - 140', 70, 140, 1);

  -- 5. HbA1c
  INSERT INTO public.tests (tenant_id, category, name, price, department)
  VALUES (target_tenant_id, 'blood', 'HbA1c (Glycated Hemoglobin)', 450.00, 'Pathology')
  RETURNING id INTO v_hba1c_id;
  INSERT INTO public.test_parameters (tenant_id, test_id, name, unit, normal_range, min_val, max_val, display_order) VALUES
    (target_tenant_id, v_hba1c_id, 'HbA1c', '%', '< 5.7 Normal, 5.7-6.4 Prediabetic, >= 6.5 Diabetic', 4.0, 5.7, 1),
    (target_tenant_id, v_hba1c_id, 'Estimated Average Glucose (eAG)', 'mg/dL', '90 - 120', 90, 120, 2);

  -- 6. Lipid Profile
  INSERT INTO public.tests (tenant_id, category, name, price, department)
  VALUES (target_tenant_id, 'blood', 'Lipid Profile', 600.00, 'Pathology')
  RETURNING id INTO v_lipid_id;
  INSERT INTO public.test_parameters (tenant_id, test_id, name, unit, normal_range, min_val, max_val, display_order) VALUES
    (target_tenant_id, v_lipid_id, 'Total Cholesterol', 'mg/dL', '< 200 Desirable', 100, 200, 1),
    (target_tenant_id, v_lipid_id, 'Triglycerides', 'mg/dL', '< 150 Normal', 50, 150, 2),
    (target_tenant_id, v_lipid_id, 'HDL Cholesterol (Good)', 'mg/dL', '> 40 (M) / > 50 (F)', 40, 60, 3),
    (target_tenant_id, v_lipid_id, 'LDL Cholesterol (Bad)', 'mg/dL', '< 100 Optimal', 50, 100, 4),
    (target_tenant_id, v_lipid_id, 'VLDL Cholesterol', 'mg/dL', '10 - 30', 10, 30, 5),
    (target_tenant_id, v_lipid_id, 'Total / HDL Ratio', 'ratio', '< 4.5', 2.0, 4.5, 6);

  -- 7. Liver Function Test (LFT)
  INSERT INTO public.tests (tenant_id, category, name, price, department)
  VALUES (target_tenant_id, 'blood', 'Liver Function Test (LFT)', 650.00, 'Pathology')
  RETURNING id INTO v_lft_id;
  INSERT INTO public.test_parameters (tenant_id, test_id, name, unit, normal_range, min_val, max_val, display_order) VALUES
    (target_tenant_id, v_lft_id, 'Serum Bilirubin (Total)', 'mg/dL', '0.2 - 1.2', 0.2, 1.2, 1),
    (target_tenant_id, v_lft_id, 'Serum Bilirubin (Direct)', 'mg/dL', '0.0 - 0.3', 0.0, 0.3, 2),
    (target_tenant_id, v_lft_id, 'Serum Bilirubin (Indirect)', 'mg/dL', '0.2 - 0.9', 0.2, 0.9, 3),
    (target_tenant_id, v_lft_id, 'SGOT / AST', 'U/L', '5 - 40', 5, 40, 4),
    (target_tenant_id, v_lft_id, 'SGPT / ALT', 'U/L', '5 - 45', 5, 45, 5),
    (target_tenant_id, v_lft_id, 'Serum Alkaline Phosphatase (ALP)', 'U/L', '30 - 120', 30, 120, 6),
    (target_tenant_id, v_lft_id, 'Serum Total Protein', 'g/dL', '6.0 - 8.3', 6.0, 8.3, 7),
    (target_tenant_id, v_lft_id, 'Serum Albumin', 'g/dL', '3.5 - 5.0', 3.5, 5.0, 8),
    (target_tenant_id, v_lft_id, 'Serum Globulin', 'g/dL', '2.0 - 3.5', 2.0, 3.5, 9),
    (target_tenant_id, v_lft_id, 'A:G Ratio', 'ratio', '1.2 - 2.2', 1.2, 2.2, 10);

  -- 8. Kidney Function Test (KFT / RFT)
  INSERT INTO public.tests (tenant_id, category, name, price, department)
  VALUES (target_tenant_id, 'blood', 'Kidney Function Test (KFT / RFT)', 650.00, 'Pathology')
  RETURNING id INTO v_kft_id;
  INSERT INTO public.test_parameters (tenant_id, test_id, name, unit, normal_range, min_val, max_val, display_order) VALUES
    (target_tenant_id, v_kft_id, 'Blood Urea', 'mg/dL', '15 - 40', 15, 40, 1),
    (target_tenant_id, v_kft_id, 'Serum Creatinine', 'mg/dL', '0.6 - 1.2', 0.6, 1.2, 2),
    (target_tenant_id, v_kft_id, 'Blood Urea Nitrogen (BUN)', 'mg/dL', '7 - 20', 7, 20, 3),
    (target_tenant_id, v_kft_id, 'Serum Uric Acid', 'mg/dL', '3.5 - 7.2 (M) / 2.6 - 6.0 (F)', 2.6, 7.2, 4),
    (target_tenant_id, v_kft_id, 'Serum Calcium', 'mg/dL', '8.5 - 10.5', 8.5, 10.5, 5),
    (target_tenant_id, v_kft_id, 'Serum Sodium (Na+)', 'mEq/L', '135 - 145', 135, 145, 6),
    (target_tenant_id, v_kft_id, 'Serum Potassium (K+)', 'mEq/L', '3.5 - 5.1', 3.5, 5.1, 7);

  -- 9. Thyroid Profile
  INSERT INTO public.tests (tenant_id, category, name, price, department)
  VALUES (target_tenant_id, 'blood', 'Thyroid Profile (Total T3, T4, TSH)', 500.00, 'Pathology')
  RETURNING id INTO v_thyroid_id;
  INSERT INTO public.test_parameters (tenant_id, test_id, name, unit, normal_range, min_val, max_val, display_order) VALUES
    (target_tenant_id, v_thyroid_id, 'Total Triiodothyronine (T3)', 'ng/dL', '70 - 200', 70, 200, 1),
    (target_tenant_id, v_thyroid_id, 'Total Thyroxine (T4)', 'µg/dL', '4.5 - 12.0', 4.5, 12.0, 2),
    (target_tenant_id, v_thyroid_id, 'TSH (Thyroid Stimulating Hormone)', 'µIU/mL', '0.35 - 4.94', 0.35, 4.94, 3);

  -- 10. Widal Test
  INSERT INTO public.tests (tenant_id, category, name, price, department)
  VALUES (target_tenant_id, 'blood', 'Widal Slide Agglutination', 200.00, 'Pathology')
  RETURNING id INTO v_widal_id;
  INSERT INTO public.test_parameters (tenant_id, test_id, name, unit, normal_range, min_val, max_val, display_order) VALUES
    (target_tenant_id, v_widal_id, 'Salmonella Typhi "O"', 'Titre', '< 1:80 (Negative)', NULL, NULL, 1),
    (target_tenant_id, v_widal_id, 'Salmonella Typhi "H"', 'Titre', '< 1:80 (Negative)', NULL, NULL, 2),
    (target_tenant_id, v_widal_id, 'Salmonella Paratyphi "AH"', 'Titre', '< 1:80 (Negative)', NULL, NULL, 3),
    (target_tenant_id, v_widal_id, 'Salmonella Paratyphi "BH"', 'Titre', '< 1:80 (Negative)', NULL, NULL, 4);

  -- 11. Urine Routine & Microscopic
  INSERT INTO public.tests (tenant_id, category, name, price, department)
  VALUES (target_tenant_id, 'blood', 'Urine Routine & Microscopic (Urine R/M)', 150.00, 'Pathology')
  RETURNING id INTO v_urine_id;
  INSERT INTO public.test_parameters (tenant_id, test_id, name, unit, normal_range, min_val, max_val, display_order) VALUES
    (target_tenant_id, v_urine_id, 'Colour', '', 'Pale Yellow', NULL, NULL, 1),
    (target_tenant_id, v_urine_id, 'Appearance', '', 'Clear', NULL, NULL, 2),
    (target_tenant_id, v_urine_id, 'Reaction / pH', '', '5.0 - 7.5', 5.0, 7.5, 3),
    (target_tenant_id, v_urine_id, 'Specific Gravity', '', '1.010 - 1.025', 1.010, 1.025, 4),
    (target_tenant_id, v_urine_id, 'Protein / Albumin', '', 'Nil', NULL, NULL, 5),
    (target_tenant_id, v_urine_id, 'Sugar / Glucose', '', 'Nil', NULL, NULL, 6),
    (target_tenant_id, v_urine_id, 'Ketone Bodies', '', 'Absent', NULL, NULL, 7),
    (target_tenant_id, v_urine_id, 'Pus Cells', '/HPF', '1 - 5', 0, 5, 8),
    (target_tenant_id, v_urine_id, 'Epithelial Cells', '/HPF', '1 - 4', 0, 4, 9),
    (target_tenant_id, v_urine_id, 'Red Blood Cells (RBCs)', '/HPF', 'Nil', 0, 0, 10),
    (target_tenant_id, v_urine_id, 'Crystals', '', 'Nil', NULL, NULL, 11),
    (target_tenant_id, v_urine_id, 'Casts', '', 'Nil', NULL, NULL, 12);

  -- 12. Dengue Combo
  INSERT INTO public.tests (tenant_id, category, name, price, department)
  VALUES (target_tenant_id, 'blood', 'Dengue Serology (NS1 + IgM + IgG)', 700.00, 'Pathology')
  RETURNING id INTO v_dengue_id;
  INSERT INTO public.test_parameters (tenant_id, test_id, name, unit, normal_range, min_val, max_val, display_order) VALUES
    (target_tenant_id, v_dengue_id, 'Dengue NS1 Antigen', '', 'Negative', NULL, NULL, 1),
    (target_tenant_id, v_dengue_id, 'Dengue IgM Antibody', '', 'Negative', NULL, NULL, 2),
    (target_tenant_id, v_dengue_id, 'Dengue IgG Antibody', '', 'Negative', NULL, NULL, 3);

  -- 13. Malaria Antigen
  INSERT INTO public.tests (tenant_id, category, name, price, department)
  VALUES (target_tenant_id, 'blood', 'Malaria Antigen (Pv / Pf Rapid)', 250.00, 'Pathology')
  RETURNING id INTO v_malaria_id;
  INSERT INTO public.test_parameters (tenant_id, test_id, name, unit, normal_range, min_val, max_val, display_order) VALUES
    (target_tenant_id, v_malaria_id, 'Plasmodium vivax (Pv)', '', 'Negative', NULL, NULL, 1),
    (target_tenant_id, v_malaria_id, 'Plasmodium falciparum (Pf)', '', 'Negative', NULL, NULL, 2);

  -- 14. Serum Electrolytes
  INSERT INTO public.tests (tenant_id, category, name, price, department)
  VALUES (target_tenant_id, 'blood', 'Serum Electrolytes (Na+, K+, Cl-)', 400.00, 'Pathology')
  RETURNING id INTO v_lytes_id;
  INSERT INTO public.test_parameters (tenant_id, test_id, name, unit, normal_range, min_val, max_val, display_order) VALUES
    (target_tenant_id, v_lytes_id, 'Sodium (Na+)', 'mEq/L', '135 - 145', 135, 145, 1),
    (target_tenant_id, v_lytes_id, 'Potassium (K+)', 'mEq/L', '3.5 - 5.1', 3.5, 5.1, 2),
    (target_tenant_id, v_lytes_id, 'Chloride (Cl-)', 'mEq/L', '96 - 106', 96, 106, 3);

  -- Standard Radiology / X-Ray Services
  INSERT INTO public.tests (tenant_id, category, name, price, department) VALUES
    (target_tenant_id, 'xray', 'Chest X-Ray (PA View)', 400.00, 'Radiology'),
    (target_tenant_id, 'xray', 'Chest X-Ray (AP View)', 400.00, 'Radiology'),
    (target_tenant_id, 'xray', 'X-Ray Cervical Spine (AP & Lat)', 600.00, 'Radiology'),
    (target_tenant_id, 'xray', 'X-Ray Lumbar Spine (AP & Lat)', 600.00, 'Radiology'),
    (target_tenant_id, 'xray', 'X-Ray Knee Joint (AP & Lat)', 500.00, 'Radiology'),
    (target_tenant_id, 'xray', 'X-Ray Hand / Wrist (AP & Oblique)', 450.00, 'Radiology'),
    (target_tenant_id, 'xray', 'X-Ray Foot / Ankle (AP & Lat)', 450.00, 'Radiology'),
    (target_tenant_id, 'xray', 'X-Ray Pelvis (AP View)', 500.00, 'Radiology'),
    (target_tenant_id, 'xray', 'X-Ray Skull (AP & Lat)', 600.00, 'Radiology'),
    (target_tenant_id, 'xray', 'X-Ray Abdomen (Erect / KUB)', 450.00, 'Radiology');
END;
$$;
-- =========================================================================
-- MIGRATION 005: Supabase Storage & Tenant Provisioning Workflows
-- Supports: Normal Customer Paid, Super Admin Complimentary & Test/Demo Labs
-- =========================================================================

-- 1. Create Supabase Storage Bucket for Lab Assets (Logos & Signatures)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lab-assets',
  'lab-assets',
  true,
  5242880, -- 5 MB max per image
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Storage Bucket RLS Policies
-- Allow anyone to view lab logos and signatures (needed for A4 report printing and patient report URLs)
DROP POLICY IF EXISTS "Public can view lab assets" ON storage.objects;
CREATE POLICY "Public can view lab assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'lab-assets');

-- Allow authenticated tenant staff to upload and update images in their own tenant folder
DROP POLICY IF EXISTS "Tenant staff can upload assets to their own folder" ON storage.objects;
CREATE POLICY "Tenant staff can upload assets to their own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'lab-assets' AND
    (storage.foldername(name))[1] = public.current_tenant_id()::TEXT
  );

DROP POLICY IF EXISTS "Tenant staff can update assets in their own folder" ON storage.objects;
CREATE POLICY "Tenant staff can update assets in their own folder"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'lab-assets' AND
    (storage.foldername(name))[1] = public.current_tenant_id()::TEXT
  );

DROP POLICY IF EXISTS "Tenant staff can delete assets in their own folder" ON storage.objects;
CREATE POLICY "Tenant staff can delete assets in their own folder"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'lab-assets' AND
    (storage.foldername(name))[1] = public.current_tenant_id()::TEXT
  );

-- Allow new user profile creation during self-service registration
DROP POLICY IF EXISTS "Allow user profile creation" ON public.user_profiles;
CREATE POLICY "Allow user profile creation"
  ON public.user_profiles FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- 3. Comprehensive Stored Function for Provisioning New Tenants
-- Handles all 3 paths: Normal Customer, Super Admin Complimentary, and Test/Demo
CREATE OR REPLACE FUNCTION public.provision_new_tenant(
  p_name TEXT,
  p_slug TEXT,
  p_phone TEXT,
  p_email TEXT,
  p_address TEXT,
  p_plan_type TEXT DEFAULT 'monthly',
  p_subscription_source TEXT DEFAULT 'payment',
  p_duration_days INT DEFAULT 30,
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
BEGIN
  -- Compute expiration date
  IF p_is_unlimited THEN
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
  -- If complimentary or test_demo, billing_amount is strictly 0.00 (no fake payment)
  IF p_subscription_source IN ('complimentary', 'test_demo', 'super_admin') THEN
    v_billing_amount := 0.00;
  ELSIF p_plan_type = 'yearly' THEN
    v_billing_amount := 9999.00;
  ELSE
    v_billing_amount := 999.00;
  END IF;

  INSERT INTO public.tenant_subscriptions (
    tenant_id, plan_type, subscription_source, status,
    billing_amount, starts_at, expires_at, is_unlimited,
    granted_by_admin_id, notes
  ) VALUES (
    v_tenant_id, p_plan_type, p_subscription_source, 'active',
    v_billing_amount, v_starts_at, v_expires_at, p_is_unlimited,
    p_admin_user_id, p_notes
  );

  -- 5. Create Lab Owner Profile if owner_id provided
  IF p_owner_id IS NOT NULL THEN
    INSERT INTO public.user_profiles (id, tenant_id, email, full_name, role, is_active)
    VALUES (
      p_owner_id, 
      v_tenant_id, 
      p_email, 
      COALESCE(p_owner_name, p_name), 
      'lab_owner', 
      true
    )
    ON CONFLICT (id) DO UPDATE SET
      tenant_id = v_tenant_id,
      role = 'lab_owner',
      full_name = EXCLUDED.full_name;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'tenant_id', v_tenant_id,
    'name', p_name,
    'slug', p_slug,
    'plan_type', p_plan_type,
    'subscription_source', p_subscription_source,
    'starts_at', v_starts_at,
    'expires_at', v_expires_at,
    'is_unlimited', p_is_unlimited,
    'is_test_lab', p_is_test_lab
  );
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.provision_new_tenant TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.seed_tenant_catalog TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_next_report_number TO anon, authenticated, service_role;
