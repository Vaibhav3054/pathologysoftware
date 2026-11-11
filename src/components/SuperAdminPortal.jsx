import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Building2, 
  Users, 
  CreditCard, 
  Plus, 
  Search, 
  Check, 
  X, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Gift,
  FlaskConical,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Eye,
  EyeOff
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function SuperAdminPortal() {
  const { user } = useAuth();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Manual Lab Creation Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [labName, setLabName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('Welcome123!');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  // Access Type: 'paid' | 'complimentary' | 'test_demo'
  const [accessType, setAccessType] = useState('complimentary');
  // Duration: '7', '30', '90', '180', '365', 'custom', 'unlimited'
  const [durationOption, setDurationOption] = useState('30');
  const [customDays, setCustomDays] = useState('60');
  const [adminNotes, setAdminNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      setLoading(true);
      const data = await api.getAllTenants();
      setTenants(data);
    } catch (err) {
      console.error('Failed to load tenants:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLab = async (e) => {
    e.preventDefault();
    if (!labName.trim() || !email.trim() || !password) return;

    try {
      setCreating(true);
      const slug = labName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(1000 + Math.random() * 9000);

      // Determine duration days and unlimited flag
      let durationDays = 30;
      let isUnlimited = false;

      if (durationOption === 'unlimited') {
        isUnlimited = true;
        durationDays = null;
      } else if (durationOption === 'custom') {
        durationDays = parseInt(customDays) || 30;
      } else {
        durationDays = parseInt(durationOption);
      }

      const isTestLab = accessType === 'test_demo';
      const subSource = accessType === 'test_demo' ? 'test_demo' : accessType === 'complimentary' ? 'complimentary' : 'super_admin';

      // 1. Provision Tenant via Stored Function
      const provRes = await api.provisionTenant({
        name: labName.trim(),
        slug,
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        plan_type: accessType === 'paid' ? 'monthly' : 'custom',
        subscription_source: subSource,
        duration_days: durationDays,
        is_unlimited: isUnlimited,
        is_test_lab: isTestLab,
        notes: adminNotes.trim() || `Created manually by Super Admin (${accessType})`,
        adminUserId: user?.id,
      });

      const tenantId = provRes.tenant_id;

      // 2. Create the Lab Owner Auth Account
      const { data: authData, error: authErr } = await api.supabase.auth.signUp({
        email: email.trim(),
        password: password,
      });

      if (authErr) {
        console.warn('Note: Auth signup notice:', authErr.message);
      }

      if (authData?.user) {
        // Link user profile
        await api.supabase.from('user_profiles').insert({
          id: authData.user.id,
          tenant_id: tenantId,
          email: email.trim(),
          full_name: ownerName.trim() || 'Lab Administrator',
          role: 'lab_owner',
          is_active: true,
        });
      }

      setShowCreateModal(false);
      resetForm();
      setActionSuccess(`Laboratory "${labName}" created successfully!`);
      setTimeout(() => setActionSuccess(''), 5000);
      await loadTenants();
    } catch (err) {
      console.error('Error creating lab:', err);
      alert('Failed to create lab: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (tenantId, currentStatus) => {
    const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
    if (!confirm(`Are you sure you want to ${nextStatus === 'active' ? 'ACTIVATE' : 'SUSPEND'} this laboratory?`)) return;

    try {
      await api.updateTenantStatus(tenantId, nextStatus);
      await loadTenants();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleExtendSubscription = async (tenant) => {
    const sub = tenant.tenant_subscriptions?.[0];
    if (!sub) return;

    const daysToAdd = prompt('Enter number of days to extend access by (or type "unlimited"):', '30');
    if (!daysToAdd) return;

    try {
      if (daysToAdd.toLowerCase() === 'unlimited') {
        await api.updateTenantSubscription(sub.id, {
          is_unlimited: true,
          expires_at: null,
          status: 'active',
          subscription_source: 'complimentary',
          notes: `${sub.notes || ''} | Extended to Unlimited by Super Admin`,
        });
      } else {
        const num = parseInt(daysToAdd);
        if (isNaN(num) || num <= 0) return;
        const currentExp = sub.expires_at ? new Date(sub.expires_at) : new Date();
        const baseDate = currentExp > new Date() ? currentExp : new Date();
        const newExp = new Date(baseDate.getTime() + num * 24 * 60 * 60 * 1000);

        await api.updateTenantSubscription(sub.id, {
          expires_at: newExp.toISOString(),
          status: 'active',
          is_unlimited: false,
          notes: `${sub.notes || ''} | Extended +${num} days by Super Admin`,
        });
      }
      await loadTenants();
      alert('Subscription extended successfully!');
    } catch (err) {
      alert('Failed to extend subscription: ' + err.message);
    }
  };

  const resetForm = () => {
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

  // Metrics
  const totalLabs = tenants.length;
  const activeLabs = tenants.filter(t => t.status === 'active').length;
  const testLabs = tenants.filter(t => t.is_test_lab).length;
  const compLabs = tenants.filter(t => {
    const sub = t.tenant_subscriptions?.[0];
    return sub?.subscription_source === 'complimentary' || sub?.subscription_source === 'super_admin';
  }).length;

  const filteredTenants = tenants.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.slug.toLowerCase().includes(search.toLowerCase()) ||
    t.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-sky-950 text-white rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4 border border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-sky-400 text-xs font-bold uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Platform Owner Administration</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight">SaaS Multi-Tenant Control Centre</h2>
          <p className="text-xs text-slate-300 mt-0.5">
            Manage laboratories, grant complimentary subscriptions, and spin up isolated test/demo environments
          </p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 text-xs transition active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>+ Create Laboratory Manually</span>
        </button>
      </div>

      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Laboratories</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{totalLabs}</div>
            <span className="text-[11px] text-slate-500">Registered on platform</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Laboratories</span>
            <div className="text-2xl font-black text-emerald-600 mt-1">{activeLabs}</div>
            <span className="text-[11px] text-emerald-600 font-medium">Full cloud access</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Complimentary Access</span>
            <div className="text-2xl font-black text-amber-600 mt-1">{compLabs}</div>
            <span className="text-[11px] text-slate-500">Admin granted (₹0 bill)</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Gift className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Test / Demo Labs</span>
            <div className="text-2xl font-black text-indigo-600 mt-1">{testLabs}</div>
            <span className="text-[11px] text-slate-500">Isolated dev testing</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <FlaskConical className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Tenants Register Table Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Laboratories & Subscription Directory</h3>
            <p className="text-xs text-slate-400">All pathology lab tenants with row-level security isolation</p>
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
            <p>No laboratories found. Click "+ Create Laboratory Manually" to create your first tenant.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Laboratory Name</th>
                  <th className="py-3 px-4">Slug / Tenant ID</th>
                  <th className="py-3 px-4">Access Type & Source</th>
                  <th className="py-3 px-4">Subscription Status</th>
                  <th className="py-3 px-4">Expires On</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTenants.map((t) => {
                  const sub = t.tenant_subscriptions?.[0];
                  const isTest = t.is_test_lab;
                  const isUnlimited = sub?.is_unlimited;
                  const source = sub?.subscription_source || 'payment';

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                            isTest ? 'bg-indigo-100 text-indigo-700' : 'bg-sky-100 text-sky-700'
                          }`}>
                            {isTest ? <FlaskConical className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block text-xs">{t.name}</span>
                            <span className="text-[10px] text-slate-400">{t.phone || t.email || 'No contact specified'}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">
                        <div>{t.slug}</div>
                        <div className="text-[9px] text-slate-400 truncate max-w-[120px]" title={t.id}>{t.id}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isTest 
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : source === 'complimentary' || source === 'super_admin'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {isTest ? (
                            <>
                              <FlaskConical className="w-3 h-3" />
                              <span>Test / Demo</span>
                            </>
                          ) : source === 'complimentary' || source === 'super_admin' ? (
                            <>
                              <Gift className="w-3 h-3" />
                              <span>Complimentary</span>
                            </>
                          ) : (
                            <>
                              <CreditCard className="w-3 h-3" />
                              <span>Paid ({sub?.plan_type || 'Monthly'})</span>
                            </>
                          )}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          t.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {t.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600">
                        {isUnlimited ? (
                          <span className="font-semibold text-emerald-600">Unlimited Access</span>
                        ) : sub?.expires_at ? (
                          <div>
                            <span className="font-mono">{new Date(sub.expires_at).toLocaleDateString()}</span>
                            <span className="text-[10px] text-slate-400 block">
                              {Math.ceil((new Date(sub.expires_at) - new Date()) / (1000 * 60 * 60 * 24))} days left
                            </span>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => handleExtendSubscription(t)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition"
                          title="Extend Days or Make Unlimited"
                        >
                          Extend Access
                        </button>

                        <button
                          onClick={() => handleToggleStatus(t.id, t.status)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                            t.status === 'active'
                              ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          {t.status === 'active' ? 'Suspend' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE NEW LAB MANUALLY MODAL (PATH 2 & PATH 3) */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-sky-600" />
                <h3 className="font-bold text-slate-900 text-base">Super Admin: Create New Laboratory</h3>
              </div>
              <button onClick={() => setShowCreateModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <form onSubmit={handleCreateLab} className="space-y-4 pt-3">
              {/* Lab Details */}
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

              {/* Lab Owner Account */}
              <div className="space-y-3 pb-3 border-b border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Initial Lab Owner Account</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Owner Name</label>
                    <input
                      type="text"
                      placeholder="Dr. Name / Lab Director"
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
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Access Type & Complimentary Options */}
              <div className="space-y-3 pb-3 border-b border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Access Type & Subscription</h4>
                
                <div className="grid grid-cols-3 gap-2.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setAccessType('complimentary')}
                    className={`p-3 rounded-xl border text-left transition select-none ${
                      accessType === 'complimentary'
                        ? 'bg-amber-50 border-amber-500 ring-1 ring-amber-500'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <Gift className={`w-4 h-4 mb-1 ${accessType === 'complimentary' ? 'text-amber-600' : 'text-slate-400'}`} />
                    <div className="font-bold text-slate-900">Complimentary</div>
                    <div className="text-[10px] text-slate-500">Free access (₹0 bill)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAccessType('test_demo')}
                    className={`p-3 rounded-xl border text-left transition select-none ${
                      accessType === 'test_demo'
                        ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <FlaskConical className={`w-4 h-4 mb-1 ${accessType === 'test_demo' ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <div className="font-bold text-slate-900">Test / Demo Lab</div>
                    <div className="text-[10px] text-slate-500">Isolated dev testing</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAccessType('paid')}
                    className={`p-3 rounded-xl border text-left transition select-none ${
                      accessType === 'paid'
                        ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <CreditCard className={`w-4 h-4 mb-1 ${accessType === 'paid' ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <div className="font-bold text-slate-900">Paid Access</div>
                    <div className="text-[10px] text-slate-500">Standard customer</div>
                  </button>
                </div>

                {/* Duration options for complimentary / test */}
                <div className="space-y-1.5 pt-1">
                  <label className="block text-xs font-semibold text-slate-600">Access Period / Duration</label>
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 text-xs">
                    {[
                      { id: '7', label: '7 Days' },
                      { id: '30', label: '30 Days' },
                      { id: '90', label: '3 Months' },
                      { id: '180', label: '6 Months' },
                      { id: '365', label: '1 Year' },
                      { id: 'custom', label: 'Custom' },
                      { id: 'unlimited', label: 'Unlimited' },
                    ].map(d => (
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
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Reason / Notes (Audit Trail)</label>
                  <input
                    type="text"
                    placeholder="e.g. Free access granted to Dr. Sharma clinic / Personal demo test lab"
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                </div>
              </div>

              {/* Action buttons */}
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
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition active:scale-95"
                >
                  {creating ? 'Creating & Provisioning...' : 'Create & Activate Laboratory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
