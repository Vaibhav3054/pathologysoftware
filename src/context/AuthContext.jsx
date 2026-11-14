import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { setApiTenantId } from '../services/api';
import {
  hasPermission as checkPermission,
  canAccessView as checkViewAccess,
} from '../config/permissions';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [tenantSettings, setTenantSettings] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.location.hash.includes('type=recovery') || window.location.search.includes('type=recovery');
    }
    return false;
  });

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

    // Listen for auth state changes (login, logout, refresh, password recovery)
    const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          setPasswordRecovery(true);
        }
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
          setPasswordRecovery(false);
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
      let { data: userProfile, error: profErr } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (profErr) {
        console.error('Error fetching user profile:', profErr);
      }

      // Auto-recovery: If user has no laboratory tenant but registration metadata exists, auto-provision 3-day trial
      if ((!userProfile || !userProfile.tenant_id) && userProfile?.role !== 'super_admin') {
        const meta = authUser.user_metadata || {};
        if (meta.lab_name) {
          try {
            const slug = meta.lab_name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(1000 + Math.random() * 9000);
            const { data: provRes, error: provErr } = await supabase.rpc('provision_new_tenant', {
              p_name: meta.lab_name.trim(),
              p_slug: slug,
              p_phone: meta.lab_phone || '',
              p_email: authUser.email.trim(),
              p_address: meta.lab_address || '',
              p_plan_type: 'trial',
              p_subscription_source: 'trial',
              p_duration_days: 3,
              p_is_unlimited: false,
              p_is_test_lab: false,
              p_notes: '3-Day Automatic Free Trial (Auto-Recovered)',
              p_admin_user_id: null,
              p_owner_id: authUser.id,
              p_owner_name: meta.full_name || 'Lab Owner',
            });
            if (provRes?.tenant_id) {
              const { data: refreshedProfile } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('id', authUser.id)
                .maybeSingle();
              if (refreshedProfile) {
                userProfile = refreshedProfile;
              }
            } else if (provErr) {
              console.warn('Auto-provisioning check error:', provErr);
            }
          } catch (autoErr) {
            console.warn('Auto-provisioning fallback failed:', autoErr);
          }
        }
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
      } else {
        setTenant(null);
        setTenantSettings(null);
        setSubscription(null);
        setApiTenantId(null);
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
    // 1. Create Supabase Auth User with metadata for recovery
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          lab_name: labName.trim(),
          lab_phone: labPhone || '',
          lab_address: labAddress || '',
        },
      },
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

  // Launch trial laboratory for a registered user whose tenant was pending/orphaned
  const provisionPendingLab = async ({ labName, fullName, phone, address }) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const currentUser = sessionData?.session?.user || user;
    if (!currentUser) throw new Error('You must be signed in to launch your laboratory.');

    const slug = labName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(1000 + Math.random() * 9000);

    const { data: provData, error: provErr } = await supabase.rpc('provision_new_tenant', {
      p_name: labName.trim(),
      p_slug: slug,
      p_phone: phone || '',
      p_email: currentUser.email.trim(),
      p_address: address || '',
      p_plan_type: 'trial',
      p_subscription_source: 'trial',
      p_duration_days: 3,
      p_is_unlimited: false,
      p_is_test_lab: false,
      p_notes: '3-Day Automatic Free Trial',
      p_admin_user_id: null,
      p_owner_id: currentUser.id,
      p_owner_name: fullName?.trim() || 'Laboratory Owner',
    });

    if (provErr) {
      console.error('provisionPendingLab error:', provErr);
      throw provErr;
    }

    await loadUserData(currentUser);
    return provData;
  };

  // Upgrade or Activate Paid Subscription (Monthly or Yearly)
  const upgradeSubscription = async (planType = 'monthly') => {
    if (!tenant?.id) throw new Error('No active laboratory found.');
    try {
      await api.activatePaidSubscription({
        tenantId: tenant.id,
        planType,
        notes: `Online upgrade to ${planType} plan`,
      });
      await refreshSession();
    } catch (err) {
      if (err?.code === '42501' || /permission denied|unauthorized/i.test(err?.message || '')) {
        throw new Error(
          'Self-serve online payment checkout is not enabled yet. Please contact the platform administrator or complete Razorpay/Stripe setup.'
        );
      }
      throw err;
    }
  };

  const isComplimentary = Boolean(
    subscription?.subscription_source === 'complimentary' ||
    subscription?.plan_type === 'custom' ||
    subscription?.plan_type === 'unlimited'
  );

  const isUnlimited = Boolean(
    subscription?.is_unlimited === true ||
    subscription?.plan_type === 'unlimited'
  );

  const isTrial = Boolean(
    !isComplimentary &&
    !isUnlimited &&
    (subscription?.plan_type === 'trial' || subscription?.subscription_source === 'trial')
  );

  const getDaysRemaining = () => {
    if (isUnlimited) return Infinity;
    if (!subscription?.expires_at) return 0;
    const diffMs = new Date(subscription.expires_at) - new Date();
    if (diffMs <= 0) return 0;
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  };

  const getTrialDaysRemaining = () => {
    const days = getDaysRemaining();
    return days === Infinity ? 0 : days;
  };

  // Send password reset email
  const requestPasswordReset = async (email) => {
    const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    if (error) throw error;
    return true;
  };

  // Set new password (during recovery link flow OR logged-in Change Password)
  const updateOwnPassword = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    setPasswordRecovery(false);
    if (typeof window !== 'undefined' && (window.location.hash.includes('recovery') || window.location.search.includes('recovery'))) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    return true;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setTenant(null);
    setTenantSettings(null);
    setSubscription(null);
    setApiTenantId(null);
    setPasswordRecovery(false);
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
  const isAccountActive = profile ? profile.is_active !== false : true;
  const hasPermission = (permission) => checkPermission(profile?.role, permission);
  const canAccessView = (viewId) => checkViewAccess(profile?.role, viewId);

  // Check if tenant's subscription is currently valid
  const isSubscriptionActive = () => {
    if (isSuperAdmin) return true;
    if (!tenant || tenant.status !== 'active') return false;
    if (!subscription || subscription.status !== 'active') return false;
    if (subscription.is_unlimited) return true;
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
        passwordRecovery,
        signIn,
        registerLab,
        provisionPendingLab,
        requestPasswordReset,
        updateOwnPassword,
        signOut,
        refreshSession,
        isSuperAdmin,
        isLabOwner,
        isReceptionist,
        isTechnician,
        isAccountActive,
        hasPermission,
        canAccessView,
        isSubscriptionActive,
        isTrial,
        isComplimentary,
        isUnlimited,
        getDaysRemaining,
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
