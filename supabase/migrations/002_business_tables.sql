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
