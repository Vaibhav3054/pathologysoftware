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
DROP FUNCTION IF EXISTS public.provision_new_tenant CASCADE;
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

-- Grant execution permissions on all public functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
