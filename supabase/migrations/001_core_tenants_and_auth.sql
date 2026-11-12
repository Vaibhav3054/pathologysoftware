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
  plan_type TEXT NOT NULL DEFAULT 'trial' CHECK (plan_type IN ('trial', 'monthly', 'yearly', 'custom', 'unlimited')),
  subscription_source TEXT NOT NULL DEFAULT 'trial' CHECK (subscription_source IN ('trial', 'payment', 'super_admin', 'complimentary', 'test_demo')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trial', 'expired', 'cancelled', 'grace_period')),
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
