import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Building2,
  Users,
  CreditCard,
  Plus,
  Search,
  X,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Gift,
  FlaskConical,
  ArrowLeft,
  Eye,
  EyeOff,
  PauseCircle,
  PlayCircle,
  XCircle,
  Trash2,
  Sliders,
  Lock,
  LogOut,
  Crown,
  Server,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

function getTenantLifecycleState(t) {
  const sub = t.tenant_subscriptions?.[0];
  const isUnlimited = Boolean(sub?.is_unlimited);
  const subStatus = sub?.status || 'active';
  const expiredByDate =
    !isUnlimited && sub?.expires_at ? new Date(sub.expires_at) <= new Date() : false;

  if (subStatus === 'expired' || subStatus === 'cancelled' || (t.status === 'suspended' && expiredByDate)) {
    return 'ended';
  }
  if (t.status === 'suspended' || subStatus === 'paused') {
    return 'paused';
  }
  if (expiredByDate) {
    return 'ended';
  }
  return 'active';
}

export default function SuperAdminPortal({ onBackToLab, onOpenChangePassword }) {
  const { profile, signOut } = useAuth();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'active' | 'paused' | 'ended' | 'complimentary' | 'platform'
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyTenantId, setBusyTenantId] = useState(null);

  // Manual Lab Creation Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [labName, setLabName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('Welcome123!');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [accessType, setAccessType] = useState('complimentary');
  const [durationOption, setDurationOption] = useState('30');
  const [customDays, setCustomDays] = useState('60');
  const [adminNotes, setAdminNotes] = useState('');
  const [creating, setCreating] = useState(false);

  // Grant Complimentary Modal
  const [compTenant, setCompTenant] = useState(null);
  const [compMode, setCompMode] = useState('30'); // '7' | '30' | '90' | '365' | 'custom' | 'unlimited'
  const [compCustomDays, setCompCustomDays] = useState('45');
  const [compNotes, setCompNotes] = useState('');

  // Details Modal
  const [detailsTenant, setDetailsTenant] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Permanent Delete Confirmation Modal
  const [deleteTenant, setDeleteTenant] = useState(null);
  const [deleteConfirmSlug, setDeleteConfirmSlug] = useState('');

  useEffect(() => {
    loadTenants();
  }, []);

  const flashSuccess = (msg) => {
    setActionError('');
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(''), 5000);
  };

  const loadTenants = async () => {
    try {
      setLoading(true);
      setActionError('');
      const data = await api.getAllTenants();
      setTenants(data);
    } catch (err) {
      console.error('Failed to load tenants:', err);
      setActionError(err.message || 'Failed to load laboratories.');
    } finally {
      setLoading(false);
    }
  };

  const resetCreateForm = () => {
    setLabName('');
    setOwnerName('');
    setEmail('');
    setPassword('Welcome123!');
    setPhone('');
    setAddress('');
    setAccessType('complimentary');
    setDurationOption('30');
    setCustomDays('60');
    setAdminNotes('');
  };

  const handleCreateLab = async (e) => {
    e.preventDefault();
    if (!labName.trim() || !email.trim() || !password) return;

    let durationDays = 30;
    let isUnlimited = false;
    if (durationOption === 'unlimited') {
      isUnlimited = true;
      durationDays = null;
    } else if (durationOption === 'custom') {
      durationDays = parseInt(customDays, 10) || 30;
    } else {
      durationDays = parseInt(durationOption, 10);
    }

    try {
      setCreating(true);
      setActionError('');
      await api.createLabAsSuperAdmin({
        labName: labName.trim(),
        ownerName: ownerName.trim() || 'Lab Administrator',
        email: email.trim(),
        password,
        phone: phone.trim(),
        address: address.trim(),
        accessType,
        durationDays,
        isUnlimited,
        notes: adminNotes.trim(),
      });
      setShowCreateModal(false);
      resetCreateForm();
      flashSuccess(`Laboratory "${labName.trim()}" created & activated.`);
      await loadTenants();
    } catch (err) {
      setActionError(err.message || 'Failed to create laboratory.');
    } finally {
      setCreating(false);
    }
  };

  const handlePause = async (t) => {
    if (!confirm(`Pause subscription for "${t.name}"? Their lab users will be locked out until resumed.`)) return;
    try {
      setBusyTenantId(t.id);
      setActionError('');
      await api.pauseTenantSubscription(t.id);
      flashSuccess(`Paused "${t.name}".`);
      await loadTenants();
    } catch (err) {
      setActionError(err.message || 'Failed to pause subscription.');
    } finally {
      setBusyTenantId(null);
    }
  };

  const handleResume = async (t) => {
    try {
      setBusyTenantId(t.id);
      setActionError('');
      await api.resumeTenantSubscription(t.id);
      flashSuccess(`Resumed active access for "${t.name}".`);
      await loadTenants();
    } catch (err) {
      setActionError(err.message || 'Failed to resume subscription.');
    } finally {
      setBusyTenantId(null);
    }
  };

  const handleEnd = async (t) => {
    if (!confirm(`End subscription immediately for "${t.name}"? This marks their subscription expired.`)) return;
    try {
      setBusyTenantId(t.id);
      setActionError('');
      await api.endTenantSubscription(t.id);
      flashSuccess(`Ended subscription for "${t.name}".`);
      await loadTenants();
    } catch (err) {
      setActionError(err.message || 'Failed to end subscription.');
    } finally {
      setBusyTenantId(null);
    }
  };

  const handleOpenDetails = async (t) => {
    try {
      setDetailsLoading(true);
      setDetailsTenant({ name: t.name, loading: true });
      const info = await api.getSuperAdminTenantDetails(t.id);
      setDetailsTenant(info);
    } catch (err) {
      setDetailsTenant(null);
      setActionError(err.message || 'Failed to load laboratory details.');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleGrantComplimentary = async (e) => {
    e.preventDefault();
    if (!compTenant) return;
    const isUnlimited = compMode === 'unlimited';
    const days = compMode === 'custom' ? parseInt(compCustomDays, 10) : parseInt(compMode, 10);

    try {
      setBusyTenantId(compTenant.id);
      setActionError('');
      await api.grantComplimentaryAccess({
        tenantId: compTenant.id,
        days: isUnlimited ? null : days,
        isUnlimited,
        notes: compNotes.trim(),
      });
      flashSuccess(
        isUnlimited
          ? `Granted unlimited complimentary access to "${compTenant.name}".`
          : `Extended complimentary access for "${compTenant.name}" by ${days} days.`
      );
      setCompTenant(null);
      setCompNotes('');
      await loadTenants();
    } catch (err) {
      setActionError(err.message || 'Failed to apply complimentary access.');
    } finally {
      setBusyTenantId(null);
    }
  };

  const handleConfirmDelete = async (e) => {
    e.preventDefault();
    if (!deleteTenant) return;
    try {
      setBusyTenantId(deleteTenant.id);
      setActionError('');
      await api.deleteTenantPermanently(deleteTenant.id, deleteConfirmSlug);
      flashSuccess(`Permanently deleted laboratory "${deleteTenant.name}".`);
      setDeleteTenant(null);
      setDeleteConfirmSlug('');
      await loadTenants();
    } catch (err) {
      setActionError(err.message || 'Failed to delete laboratory.');
    } finally {
      setBusyTenantId(null);
    }
  };

  // Metrics
  const totalLabs = tenants.length;
  const activeCount = tenants.filter((t) => getTenantLifecycleState(t) === 'active').length;
  const pausedCount = tenants.filter((t) => getTenantLifecycleState(t) === 'paused').length;
  const endedCount = tenants.filter((t) => getTenantLifecycleState(t) === 'ended').length;
  const compCount = tenants.filter((t) => {
    const src = t.tenant_subscriptions?.[0]?.subscription_source;
    return src === 'complimentary' || src === 'super_admin' || t.is_test_lab;
  }).length;

  const filteredTenants = tenants.filter((t) => {
    const q = search.toLowerCase();
    const matchesSearch =
      t.name.toLowerCase().includes(q) ||
      t.slug.toLowerCase().includes(q) ||
      (t.email || '').toLowerCase().includes(q) ||
      (t.owner_email || '').toLowerCase().includes(q);
    if (!matchesSearch) return false;

    const state = getTenantLifecycleState(t);
    const src = t.tenant_subscriptions?.[0]?.subscription_source;
    if (activeTab === 'active') return state === 'active';
    if (activeTab === 'paused') return state === 'paused';
    if (activeTab === 'ended') return state === 'ended';
    if (activeTab === 'complimentary') {
      return src === 'complimentary' || src === 'super_admin' || t.is_test_lab;
    }
    return true;
  });

  return (
    <div className="min-h-screen w-full bg-slate-100 font-sans flex flex-col">
      {/* Standalone Super Admin Platform Header (Completely Separate from Lab Software UI) */}
      <header className="bg-slate-950 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-lg shadow-amber-500/20 shrink-0">
              <Crown className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black tracking-tight truncate">
                  Super Admin Platform Control
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold uppercase">
                  SUPER_ADMIN
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {profile?.email} • Platform Subscription &amp; Tenant Governance
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onBackToLab}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-sm transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Laboratory Software</span>
            </button>

            {onOpenChangePassword && (
              <button
                type="button"
                onClick={onOpenChangePassword}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 text-sky-400" />
                <span className="hidden sm:inline">Password</span>
              </button>
            )}

            <button
              type="button"
              onClick={signOut}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-900/50 text-slate-200 hover:text-rose-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main SaaS Platform Management Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-16">
        {/* Privacy Guarantee & Primary Action Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 text-white rounded-3xl p-5 sm:p-6 shadow-lg border border-slate-700/70 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              <span>Strict Tenant Privacy Isolation Active</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              SaaS Multi-Tenant Management
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl">
              Manage laboratory accounts, subscriptions (pause, resume, end, extend), and complimentary access. Patient records, clinical test results, and reports of customer labs remain strictly isolated.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              resetCreateForm();
              setShowCreateModal(true);
            }}
            className="inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 text-xs transition active:scale-95 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ Create Laboratory</span>
          </button>
        </div>

        {actionError && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {actionSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Metrics Row */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Labs</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{totalLabs}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Active</span>
            <div className="text-2xl font-black text-emerald-600 mt-1">{activeCount}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Paused</span>
            <div className="text-2xl font-black text-amber-600 mt-1">{pausedCount}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Ended / Expired</span>
            <div className="text-2xl font-black text-rose-600 mt-1">{endedCount}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs col-span-2 lg:col-span-1">
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Complimentary / Demo</span>
            <div className="text-2xl font-black text-indigo-600 mt-1">{compCount}</div>
          </div>
        </div>

        {/* Navigation Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'all', label: `All Labs (${totalLabs})` },
            { id: 'active', label: `Active (${activeCount})` },
            { id: 'paused', label: `Paused (${pausedCount})` },
            { id: 'ended', label: `Ended / Expired (${endedCount})` },
            { id: 'complimentary', label: `Complimentary / Demo (${compCount})` },
            { id: 'platform', label: 'Platform Settings', icon: Sliders },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB: Platform Settings (Static Architecture & Security Overview) */}
        {activeTab === 'platform' ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Platform Configuration & Security Controls</h3>
                <p className="text-xs text-slate-500">Static SaaS governance defaults and active backend enforcement rules</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Authentication & Role Hierarchy</span>
                </div>
                <ul className="space-y-1 text-slate-600 list-disc pl-4">
                  <li><strong>Login Portal:</strong> Single shared authentication gate</li>
                  <li><strong>Supported Roles:</strong> <code>super_admin</code>, <code>lab_owner</code>, <code>receptionist</code></li>
                  <li><strong>Backend Gate:</strong> <code>/.netlify/functions/super-admin</code> returns HTTP 403 for non-Super Admins</li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-sky-600" />
                  <span>Clinical & Operational Data Isolation</span>
                </div>
                <ul className="space-y-1 text-slate-600 list-disc pl-4">
                  <li><strong>Customer Data Privacy:</strong> Super Admin APIs exclude patients, reports, and results</li>
                  <li><strong>Lab Sandbox:</strong> <code>Back to Laboratory Software</code> opens isolated Demo Lab only</li>
                  <li><strong>PostgreSQL RLS:</strong> Cross-tenant clinical access blocked at database layer</li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-indigo-600" />
                  <span>Subscription Policy Defaults</span>
                </div>
                <ul className="space-y-1 text-slate-600 list-disc pl-4">
                  <li><strong>Self-Signup Trial:</strong> 3-Day Free Trial (server-enforced in RPC)</li>
                  <li><strong>Standard Monthly / Yearly Display:</strong> ₹999/month • ₹9,999/year</li>
                  <li><strong>Complimentary Access:</strong> ₹0 admin-granted days or unlimited</li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-amber-600" />
                  <span>Compliance & Audit Logging</span>
                </div>
                <ul className="space-y-1 text-slate-600 list-disc pl-4">
                  <li><strong>Legal Docs:</strong> Terms of Service, DPDP Privacy Policy, Refund Policy</li>
                  <li><strong>Audit Trail:</strong> Immutable PostgreSQL triggers on all 12 tables</li>
                  <li><strong>Staff Passwords:</strong> Owner-controlled reset via <code>/.netlify/functions/manage-staff</code></li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          /* Tenants Register Table Card */
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Laboratories & Subscription Directory</h3>
                <p className="text-xs text-slate-400">Platform metadata only — operational &amp; patient data stays isolated per lab</p>
              </div>

              <div className="relative w-full sm:w-72">
                <input
                  type="text"
                  placeholder="Search by lab name, slug or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-sky-500"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-400 text-xs">Loading laboratories...</div>
            ) : filteredTenants.length === 0 ? (
              <div className="p-16 text-center text-slate-400 text-xs space-y-3">
                <Building2 className="w-10 h-10 mx-auto text-slate-300" />
                <p>No laboratories match the selected filter.</p>
              </div>
            ) : (
              <>
                {/* Desktop Directory Table */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-100">
                      <tr>
                        <th className="py-3 px-4">Laboratory</th>
                        <th className="py-3 px-4">Plan &amp; Source</th>
                        <th className="py-3 px-4">Lifecycle Status</th>
                        <th className="py-3 px-4">Expires</th>
                        <th className="py-3 px-4 text-right">Platform Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredTenants.map((t) => {
                        const sub = t.tenant_subscriptions?.[0];
                        const isTest = t.is_test_lab;
                        const isUnlimited = sub?.is_unlimited;
                        const source = sub?.subscription_source || 'payment';
                        const lifecycle = getTenantLifecycleState(t);
                        const busy = busyTenantId === t.id;

                        return (
                          <tr key={t.id} className="hover:bg-slate-50/70 transition">
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                                  isTest ? 'bg-indigo-100 text-indigo-700' : 'bg-sky-100 text-sky-700'
                                }`}>
                                  {isTest ? <FlaskConical className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-slate-900 text-xs">{t.name}</span>
                                    {t.is_super_admin_sandbox && (
                                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-bold uppercase">
                                        Your Sandbox Lab
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-slate-400 block">
                                    {t.owner_email || t.email || 'No email'} • {t.staff_count || 0} staff •{' '}
                                    <span className="font-mono">{t.slug}</span>
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                isTest
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                  : source === 'complimentary' || source === 'super_admin'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : source === 'trial'
                                  ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}>
                                {isTest
                                  ? 'Test / Demo'
                                  : source === 'complimentary' || source === 'super_admin'
                                  ? 'Complimentary'
                                  : source === 'trial'
                                  ? '3-Day Trial'
                                  : `Paid (${sub?.plan_type || 'Monthly'})`}
                              </span>
                            </td>

                            <td className="py-3.5 px-4">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                lifecycle === 'active'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : lifecycle === 'paused'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}>
                                {lifecycle === 'ended' ? 'Ended / Expired' : lifecycle}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 text-slate-600">
                              {isUnlimited ? (
                                <span className="font-semibold text-emerald-600">Unlimited</span>
                              ) : sub?.expires_at ? (
                                <div>
                                  <span className="font-mono">{new Date(sub.expires_at).toLocaleDateString()}</span>
                                  <span className="text-[10px] text-slate-400 block">
                                    {Math.max(0, Math.ceil((new Date(sub.expires_at) - new Date()) / (1000 * 60 * 60 * 24)))}d left
                                  </span>
                                </div>
                              ) : (
                                '—'
                              )}
                            </td>

                            <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-1">
                              <button
                                type="button"
                                onClick={() => handleOpenDetails(t)}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold cursor-pointer"
                                title="View Lab Profile & Staff Metadata"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Details</span>
                              </button>

                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => {
                                  setCompTenant(t);
                                  setCompMode('30');
                                  setCompNotes('');
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-[11px] font-semibold cursor-pointer"
                                title="Grant Complimentary Days / Unlimited"
                              >
                                <Gift className="w-3 h-3" />
                                <span>Complimentary</span>
                              </button>

                              {!t.is_super_admin_sandbox && (
                                <>
                                  {lifecycle === 'active' ? (
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() => handlePause(t)}
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100/70 hover:bg-amber-200 text-amber-900 rounded-lg text-[11px] font-semibold cursor-pointer"
                                      title="Pause Subscription"
                                    >
                                      <PauseCircle className="w-3 h-3" />
                                      <span>Pause</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() => handleResume(t)}
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[11px] font-semibold cursor-pointer"
                                      title="Resume / Reactivate Subscription"
                                    >
                                      <PlayCircle className="w-3 h-3" />
                                      <span>Resume</span>
                                    </button>
                                  )}

                                  {lifecycle !== 'ended' && (
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() => handleEnd(t)}
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[11px] font-semibold cursor-pointer"
                                      title="End Subscription"
                                    >
                                      <XCircle className="w-3 h-3" />
                                      <span>End</span>
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => {
                                      setDeleteTenant(t);
                                      setDeleteConfirmSlug('');
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-rose-100/80 hover:bg-rose-200 text-rose-800 rounded-lg text-[11px] font-semibold transition cursor-pointer"
                                    title="Permanently Delete Laboratory"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>Delete</span>
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile & Tablet Tenant Cards */}
                <div className="block lg:hidden divide-y divide-slate-100">
                  {filteredTenants.map((t) => {
                    const sub = t.tenant_subscriptions?.[0];
                    const isTest = t.is_test_lab;
                    const isUnlimited = sub?.is_unlimited;
                    const source = sub?.subscription_source || 'payment';
                    const lifecycle = getTenantLifecycleState(t);
                    const busy = busyTenantId === t.id;

                    return (
                      <div key={t.id} className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900 text-sm">{t.name}</span>
                              {t.is_super_admin_sandbox && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-bold uppercase">
                                  Sandbox
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-500 block truncate">
                              {t.owner_email || t.email || t.slug} • {t.staff_count || 0} staff
                            </span>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                            lifecycle === 'active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : lifecycle === 'paused'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}>
                            {lifecycle === 'ended' ? 'Ended' : lifecycle}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <span className="font-semibold text-slate-700">
                            {isTest
                              ? 'Test / Demo'
                              : source === 'complimentary' || source === 'super_admin'
                              ? 'Complimentary'
                              : source === 'trial'
                              ? '3-Day Trial'
                              : `Paid (${sub?.plan_type || 'Monthly'})`}
                          </span>
                          <span className="font-mono text-slate-600">
                            {isUnlimited ? 'Unlimited' : sub?.expires_at ? `Exp: ${new Date(sub.expires_at).toLocaleDateString()}` : '—'}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(t)}
                            className="px-2.5 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-[11px] font-semibold"
                          >
                            Details
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setCompTenant(t);
                              setCompMode('30');
                              setCompNotes('');
                            }}
                            className="px-2.5 py-1.5 bg-amber-50 text-amber-800 rounded-lg text-[11px] font-semibold"
                          >
                            Complimentary
                          </button>
                          {!t.is_super_admin_sandbox && (
                            <>
                              {lifecycle === 'active' ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => handlePause(t)}
                                  className="px-2.5 py-1.5 bg-amber-100 text-amber-900 rounded-lg text-[11px] font-semibold"
                                >
                                  Pause
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => handleResume(t)}
                                  className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-[11px] font-semibold"
                                >
                                  Resume
                                </button>
                              )}
                              {lifecycle !== 'ended' && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => handleEnd(t)}
                                  className="px-2.5 py-1.5 bg-rose-50 text-rose-700 rounded-lg text-[11px] font-semibold"
                                >
                                  End
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => {
                                  setDeleteTenant(t);
                                  setDeleteConfirmSlug('');
                                }}
                                className="px-2.5 py-1.5 bg-rose-100 text-rose-800 rounded-lg text-[11px] font-semibold"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* CREATE NEW LAB MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-sky-600" />
                <h3 className="font-bold text-slate-900 text-base">Super Admin: Create New Laboratory</h3>
              </div>
              <button type="button" onClick={() => setShowCreateModal(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleCreateLab} className="space-y-4 pt-3">
              <div className="space-y-3 pb-3 border-b border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Laboratory Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Lab Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. City Diagnostic & Pathology Lab"
                      value={labName}
                      onChange={(e) => setLabName(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Phone Number</label>
                    <input
                      type="text"
                      placeholder="+91 98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Address</label>
                    <input
                      type="text"
                      placeholder="Enter street, city, state - PIN"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 pb-3 border-b border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Initial Lab Owner Account</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Owner Name</label>
                    <input
                      type="text"
                      placeholder="Dr. Name / Director"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Owner Email <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      placeholder="owner@pathologylab.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Initial Password <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pb-3 border-b border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Access Type &amp; Subscription</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setAccessType('complimentary')}
                    className={`p-3 rounded-xl border text-left transition ${
                      accessType === 'complimentary' ? 'bg-amber-50 border-amber-500 ring-1 ring-amber-500' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <Gift className={`w-4 h-4 mb-1 ${accessType === 'complimentary' ? 'text-amber-600' : 'text-slate-400'}`} />
                    <div className="font-bold text-slate-900">Complimentary</div>
                    <div className="text-[10px] text-slate-500">Free access (₹0 bill)</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccessType('test_demo')}
                    className={`p-3 rounded-xl border text-left transition ${
                      accessType === 'test_demo' ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <FlaskConical className={`w-4 h-4 mb-1 ${accessType === 'test_demo' ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <div className="font-bold text-slate-900">Test / Demo Lab</div>
                    <div className="text-[10px] text-slate-500">Isolated dev testing</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccessType('paid')}
                    className={`p-3 rounded-xl border text-left transition ${
                      accessType === 'paid' ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <CreditCard className={`w-4 h-4 mb-1 ${accessType === 'paid' ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <div className="font-bold text-slate-900">Paid Access</div>
                    <div className="text-[10px] text-slate-500">Standard customer</div>
                  </button>
                </div>

                <div className="space-y-1.5 pt-1">
                  <label className="block text-xs font-semibold text-slate-600">Access Period / Duration</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5 text-xs">
                    {[
                      { id: '7', label: '7 Days' },
                      { id: '30', label: '30 Days' },
                      { id: '90', label: '3 Months' },
                      { id: '180', label: '6 Months' },
                      { id: '365', label: '1 Year' },
                      { id: 'custom', label: 'Custom' },
                      { id: 'unlimited', label: 'Unlimited' },
                    ].map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setDurationOption(d.id)}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition border ${
                          durationOption === d.id
                            ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                  {durationOption === 'custom' && (
                    <div className="pt-2 flex items-center gap-2">
                      <span className="text-xs text-slate-600">Custom Duration:</span>
                      <input
                        type="number"
                        min="1"
                        max="3650"
                        value={customDays}
                        onChange={(e) => setCustomDays(e.target.value)}
                        className="w-24 px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                      />
                      <span className="text-xs text-slate-500">days</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Reason / Notes</label>
                  <input
                    type="text"
                    placeholder="e.g. Complimentary access granted to lab"
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition"
                >
                  {creating ? 'Creating & Provisioning...' : 'Create & Activate Laboratory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GRANT COMPLIMENTARY MODAL */}
      {compTenant && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-slate-900 text-sm">Grant Complimentary Access</h3>
              </div>
              <button type="button" onClick={() => setCompTenant(null)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Extend free subscription duration for <strong className="text-slate-800">{compTenant.name}</strong> (₹0 bill).
            </p>
            <form onSubmit={handleGrantComplimentary} className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: '7', label: '+7 Days' },
                  { id: '30', label: '+30 Days' },
                  { id: '90', label: '+90 Days' },
                  { id: '365', label: '+1 Year' },
                  { id: 'custom', label: 'Custom Days' },
                  { id: 'unlimited', label: 'Unlimited' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setCompMode(opt.id)}
                    className={`py-2 px-2 rounded-xl font-semibold border transition ${
                      compMode === opt.id
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {compMode === 'custom' && (
                <div className="flex items-center gap-2">
                  <label className="font-semibold text-slate-600">Days:</label>
                  <input
                    type="number"
                    min="1"
                    max="3650"
                    value={compCustomDays}
                    onChange={(e) => setCompCustomDays(e.target.value)}
                    className="w-28 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
              )}
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Admin Note</label>
                <input
                  type="text"
                  placeholder="Optional complimentary reason"
                  value={compNotes}
                  onChange={(e) => setCompNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCompTenant(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busyTenantId === compTenant.id}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold"
                >
                  Apply Complimentary Access
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LAB METADATA DETAILS MODAL (NO PATIENT DATA) */}
      {detailsTenant && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-sky-600" />
                <h3 className="font-bold text-slate-900 text-base">{detailsTenant.name}</h3>
              </div>
              <button type="button" onClick={() => setDetailsTenant(null)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {detailsLoading || detailsTenant.loading ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading platform details...</div>
            ) : (
              <div className="space-y-5 text-xs">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center gap-2">
                  <Lock className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>Only platform metadata &amp; staff accounts are visible here. Patient records and lab reports remain strictly isolated.</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Slug</span>
                    <div className="font-mono font-bold text-slate-800">{detailsTenant.slug}</div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Contact</span>
                    <div className="text-slate-700">{detailsTenant.email || '—'} • {detailsTenant.phone || '—'}</div>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Address</span>
                    <div className="text-slate-700">{detailsTenant.address || detailsTenant.profile_settings?.address || '—'}</div>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-slate-700 uppercase text-[11px] mb-2">
                    Registered Accounts ({detailsTenant.staff?.length || 0})
                  </h4>
                  <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100">
                    {(detailsTenant.staff || []).map((s) => (
                      <div key={s.id} className="p-3 flex items-center justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-800">{s.full_name}</div>
                          <div className="font-mono text-[11px] text-slate-500">{s.email}</div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold uppercase">
                            {s.role}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            s.is_active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                          }`}>
                            {s.is_active !== false ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-slate-700 uppercase text-[11px] mb-2">
                    Subscription History ({detailsTenant.subscriptions?.length || 0})
                  </h4>
                  <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100">
                    {(detailsTenant.subscriptions || []).map((sub) => (
                      <div key={sub.id} className="p-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-bold text-slate-800 uppercase">{sub.plan_type}</span>{' '}
                          <span className="text-slate-500">({sub.subscription_source})</span>
                          {sub.notes && <div className="text-[11px] text-slate-400 mt-0.5">{sub.notes}</div>}
                        </div>
                        <div className="text-right">
                          <span className="px-2 py-0.5 rounded bg-slate-100 font-bold uppercase text-[10px]">{sub.status}</span>
                          <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                            {sub.is_unlimited ? 'Unlimited' : sub.expires_at ? `Exp ${new Date(sub.expires_at).toLocaleDateString()}` : '—'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PERMANENT DELETE LAB MODAL */}
      {deleteTenant && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-200 space-y-4">
            <div className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-base">Permanently Delete Laboratory</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              This will permanently erase <strong className="text-slate-900">{deleteTenant.name}</strong>, all its staff login accounts, subscriptions, and all laboratory data. This cannot be undone.
            </p>
            <form onSubmit={handleConfirmDelete} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">
                  Type the laboratory slug <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-rose-700">{deleteTenant.slug}</code> to confirm:
                </label>
                <input
                  type="text"
                  value={deleteConfirmSlug}
                  onChange={(e) => setDeleteConfirmSlug(e.target.value)}
                  placeholder={deleteTenant.slug}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-rose-300 rounded-xl font-mono focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteTenant(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleteConfirmSlug.trim() !== deleteTenant.slug || busyTenantId === deleteTenant.id}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold"
                >
                  {busyTenantId === deleteTenant.id ? 'Deleting...' : 'Delete Permanently'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
