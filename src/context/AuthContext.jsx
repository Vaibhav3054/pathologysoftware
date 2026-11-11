import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { setApiTenantId } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [tenantSettings, setTenantSettings] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check initial active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        loadUserData(session.user);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth state changes (login, logout, refresh)
    const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user);
          await loadUserData(session.user);
        } else {
          setUser(null);
          setProfile(null);
          setTenant(null);
          setTenantSettings(null);
          setSubscription(null);
          setApiTenantId(null);
          setLoading(false);
        }
      }
    );

    return () => {
      authListener?.unsubscribe();
    };
  }, []);

  const loadUserData = async (authUser) => {
    try {
      setLoading(true);

      // 1. Fetch user profile
      const { data: userProfile, error: profErr } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (profErr) {
        console.error('Error fetching user profile:', profErr);
      }

      setProfile(userProfile);

      // 2. If user belongs to a tenant/lab, fetch lab details
      if (userProfile?.tenant_id) {
        const tenantId = userProfile.tenant_id;

        // Fetch tenant details
        const { data: tenantData } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', tenantId)
          .maybeSingle();
        setTenant(tenantData);
        setApiTenantId(tenantData?.id || null);

        // Fetch lab settings
        const { data: settingsData } = await supabase
          .from('tenant_settings')
          .select('*')
          .eq('tenant_id', tenantId)
          .maybeSingle();
        setTenantSettings(settingsData);

        // Fetch subscription status
        const { data: subData } = await supabase
          .from('tenant_subscriptions')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        setSubscription(subData);
      }
    } catch (err) {
      console.error('loadUserData error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Sign In with email & password
  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw error;
    return data;
  };

  // Onboard New Lab & Owner Account with 3-Day Automatic Free Trial
  const registerLab = async ({
    email,
    password,
    fullName,
    labName,
    labPhone,
    labAddress,
  }) => {
    // 1. Create Supabase Auth User
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    if (authErr) throw authErr;
    if (!authData.user) throw new Error('Failed to create account.');

    const userId = authData.user.id;
    const slug = labName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(1000 + Math.random() * 9000);

    // 2. Call stored function to provision tenant with 3-Day Free Trial
    const { data: provData, error: provErr } = await supabase.rpc('provision_new_tenant', {
      p_name: labName.trim(),
      p_slug: slug,
      p_phone: labPhone || '',
      p_email: email.trim(),
      p_address: labAddress || '',
      p_plan_type: 'trial',
      p_subscription_source: 'trial',
      p_duration_days: 3,
      p_is_unlimited: false,
      p_is_test_lab: false,
      p_notes: '3-Day Automatic Free Trial',
      p_admin_user_id: null,
      p_owner_id: userId,
      p_owner_name: fullName.trim(),
    });

    if (provErr) {
      console.error('Provisioning error:', provErr);
      throw provErr;
    }

    const tenantId = provData?.tenant_id;

    // 3. Fallback upsert user profile if not done by RPC
    try {
      await supabase.from('user_profiles').upsert({
        id: userId,
        tenant_id: tenantId,
        email: email.trim(),
        full_name: fullName.trim(),
        role: 'lab_owner',
        is_active: true,
      });
    } catch (e) {
      console.warn('Profile upsert note:', e);
    }

    // Refresh context if session is active
    if (authData.session) {
      await loadUserData(authData.user);
      return { success: true, tenantId, hasSession: true };
    }

    return { 
      success: true, 
      tenantId, 
      hasSession: false, 
      email: email.trim() 
    };
  };

  // Upgrade or Activate Paid Subscription (Monthly or Yearly)
  const upgradeSubscription = async (planType = 'monthly') => {
    if (!tenant?.id) throw new Error('No active laboratory found.');
    await api.activatePaidSubscription({
      tenantId: tenant.id,
      planType,
      notes: `Online upgrade to ${planType} plan`,
    });
    await refreshSession();
  };

  const isTrial = Boolean(subscription?.plan_type === 'trial' || subscription?.subscription_source === 'trial');

  const getTrialDaysRemaining = () => {
    if (!subscription?.expires_at) return 0;
    const diffMs = new Date(subscription.expires_at) - new Date();
    if (diffMs <= 0) return 0;
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setTenant(null);
    setTenantSettings(null);
    setSubscription(null);
    setApiTenantId(null);
  };

  const refreshSession = async () => {
    if (user) {
      await loadUserData(user);
    }
  };

  const isSuperAdmin = profile?.role === 'super_admin';
  const isLabOwner = profile?.role === 'lab_owner';
  const isReceptionist = profile?.role === 'receptionist';
  const isTechnician = profile?.role === 'technician';

  // Check if tenant's subscription is currently valid
  const isSubscriptionActive = () => {
    if (isSuperAdmin) return true;
    if (!subscription) return true; // Grace or default
    if (subscription.is_unlimited) return true;
    if (subscription.status !== 'active') return false;
    if (subscription.expires_at) {
      return new Date(subscription.expires_at) > new Date();
    }
    return true;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        tenant,
        tenantSettings,
        subscription,
        loading,
        signIn,
        registerLab,
        signOut,
        refreshSession,
        isSuperAdmin,
        isLabOwner,
        isReceptionist,
        isTechnician,
        isSubscriptionActive,
        isTrial,
        getTrialDaysRemaining,
        upgradeSubscription,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
