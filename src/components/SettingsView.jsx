import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Save, 
  Upload, 
  Trash2, 
  Check, 
  Building, 
  FileText, 
  ShieldCheck, 
  Image as ImageIcon,
  PenTool,
  Hash,
  Users,
  UserPlus,
  Mail,
  Lock,
  User,
  Calendar,
  Gift,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
  CreditCard,
  ArrowRight,
  KeyRound,
  Edit2,
  UserX,
  UserCheck,
  ShieldAlert
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { supabase, createAuthUserWithoutSessionReplace } from '../services/supabase';
import { PERMISSIONS, getRoleDisplayLabel } from '../config/permissions';

export default function SettingsView({ initialTab = 'clinic' }) {
  const {
    tenant,
    profile,
    subscription,
    isLabOwner,
    isSuperAdmin,
    isTrial,
    getTrialDaysRemaining,
    upgradeSubscription,
    hasPermission,
  } = useAuth();
  const canManageSettings = hasPermission(PERMISSIONS.MANAGE_SETTINGS);
  const canManageStaff = hasPermission(PERMISSIONS.MANAGE_STAFF);

  const [settings, setSettings] = useState({
    clinic_name: 'DIAGNOSTIC & CLINICAL LABORATORY',
    tagline: 'Diagnostic, Clinical Laboratory & X-Ray Centre',
    address: 'Main Road, City, State - PIN',
    phone: '+91 98765 43210',
    email: 'contact@pathologylab.com',
    reg_no: 'REG/LAB/2026/001',
    signatory_name: 'Consultant Pathologist',
    signatory_degree: 'M.B.B.S., M.D. (Pathology)',
    signatory_designation: 'Consultant Pathologist',
    signatory_signature_path: '',
    signature_url: '',
    logo_path: '',
    logo_url: '',
    letterhead_mode: 'digital',
    letterhead_top_margin: 35,
    report_number_prefix: 'LAB-',
    next_report_number: 1
  });

  const [activeTab, setActiveTab] = useState(initialTab || 'clinic'); // 'clinic' | 'staff' | 'subscription'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Upgrade state for trial users
  const [upgradePlan, setUpgradePlan] = useState('monthly');
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState('');

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  // Staff Management State
  const [staffList, setStaffList] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [staffRole, setStaffRole] = useState('receptionist');
  const [staffError, setStaffError] = useState('');
  const [staffSuccess, setStaffSuccess] = useState('');
  const [staffActionLoading, setStaffActionLoading] = useState(null);

  // Direct Staff Password Reset Modal
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState('');

  // Edit Staff Modal
  const [editingStaffUser, setEditingStaffUser] = useState(null);
  const [editStaffName, setEditStaffName] = useState('');
  const [editStaffEmail, setEditStaffEmail] = useState('');
  const [editStaffRole, setEditStaffRole] = useState('receptionist');
  const [editStaffError, setEditStaffError] = useState('');

  useEffect(() => {
    loadSettings();
    if (tenant?.id) {
      loadStaff();
    }
  }, [tenant]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await api.getSettings(tenant?.id);
      if (data && Object.keys(data).length > 0) {
        setSettings(prev => ({
          ...prev,
          ...data,
          logo_path: data.logo_url || data.logo_path || prev.logo_path,
          signatory_signature_path: data.signature_url || data.signatory_signature_path || prev.signatory_signature_path,
        }));
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStaff = async () => {
    if (!tenant?.id) return;
    try {
      setStaffLoading(true);
      const members = await api.getTenantStaff(tenant.id);
      setStaffList(members);
    } catch (err) {
      console.error('Failed to load staff list:', err);
    } finally {
      setStaffLoading(false);
    }
  };

  const handleChange = (field, val) => {
    setSettings(prev => ({ ...prev, [field]: val }));
  };

  const handleSelectImage = async (category) => {
    try {
      setUploadingImage(true);
      const res = await api.selectImage(category);
      if (res && res.dataUrl) {
        if (category === 'logo') {
          handleChange('logo_path', res.dataUrl);
          handleChange('logo_url', res.dataUrl);
        } else {
          handleChange('signatory_signature_path', res.dataUrl);
          handleChange('signature_url', res.dataUrl);
        }
      }
    } catch (err) {
      console.error('Image selection error:', err);
      alert('Could not upload image: ' + err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setSuccessMsg('');
      await api.updateSettings(settings, tenant?.id);
      setSuccessMsg('Settings saved successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Error saving settings:', err);
      alert('Failed to save settings: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setStaffError('');
    setStaffSuccess('');

    if (!staffName.trim() || !staffEmail.trim() || !staffPassword) {
      setStaffError('Please provide staff name, email, and password.');
      return;
    }

    if (staffPassword.length < 6) {
      setStaffError('Password must be at least 6 characters.');
      return;
    }

    try {
      // 1. Sign up staff user without replacing the Lab Owner's active session
      const { data: authData, error: authErr } = await createAuthUserWithoutSessionReplace(
        staffEmail,
        staffPassword
      );

      if (authErr) throw authErr;
      if (!authData.user) throw new Error('Failed to create staff login account.');

      // 2. Create user profile linked to current tenant
      const { error: profErr } = await supabase.from('user_profiles').insert({
        id: authData.user.id,
        tenant_id: tenant.id,
        email: staffEmail.trim(),
        full_name: staffName.trim(),
        role: staffRole,
        is_active: true,
      });

      if (profErr) throw profErr;

      setStaffSuccess(`Staff member ${staffName.trim()} created successfully!`);
      setStaffName('');
      setStaffEmail('');
      setStaffPassword('');
      setShowAddStaffModal(false);
      await loadStaff();
    } catch (err) {
      console.error('Staff creation error:', err);
      setStaffError(err.message || 'Failed to create staff member.');
    }
  };

  const openResetPasswordModal = (user) => {
    setResetPasswordUser(user);
    setResetNewPassword('');
    setShowResetPassword(false);
    setResetPasswordError('');
    setStaffError('');
    setStaffSuccess('');
  };

  const handleResetStaffPassword = async (e) => {
    e.preventDefault();
    if (!canManageStaff || !resetPasswordUser) return;
    setResetPasswordError('');
    if (!resetNewPassword || resetNewPassword.length < 6) {
      setResetPasswordError('Password must be at least 6 characters.');
      return;
    }

    try {
      setStaffActionLoading(resetPasswordUser.id);
      await api.manageStaffAccount({
        action: 'reset_password',
        targetUserId: resetPasswordUser.id,
        newPassword: resetNewPassword,
      });
      setStaffSuccess(`Password updated for ${resetPasswordUser.full_name || resetPasswordUser.email}.`);
      setResetPasswordUser(null);
      setResetNewPassword('');
    } catch (err) {
      setResetPasswordError(err.message || 'Failed to reset password.');
    } finally {
      setStaffActionLoading(null);
    }
  };

  const openEditStaffModal = (user) => {
    setEditingStaffUser(user);
    setEditStaffName(user.full_name || '');
    setEditStaffEmail(user.email || '');
    setEditStaffRole(user.role === 'lab_owner' ? 'lab_owner' : 'receptionist');
    setEditStaffError('');
    setStaffError('');
    setStaffSuccess('');
  };

  const handleUpdateStaff = async (e) => {
    e.preventDefault();
    if (!canManageStaff || !editingStaffUser) return;
    setEditStaffError('');
    if (!editStaffName.trim() || !editStaffEmail.trim()) {
      setEditStaffError('Full name and email are required.');
      return;
    }

    try {
      setStaffActionLoading(editingStaffUser.id);
      await api.manageStaffAccount({
        action: 'update_staff',
        targetUserId: editingStaffUser.id,
        fullName: editStaffName.trim(),
        email: editStaffEmail.trim(),
        role: editStaffRole,
      });
      setStaffSuccess(`Updated details for ${editStaffName.trim()}.`);
      setEditingStaffUser(null);
      await loadStaff();
    } catch (err) {
      setEditStaffError(err.message || 'Failed to update staff account.');
    } finally {
      setStaffActionLoading(null);
    }
  };

  const handleToggleStaffActive = async (user) => {
    if (!canManageStaff) return;
    const nextActive = user.is_active === false;
    const label = user.full_name || user.email;
    if (!nextActive && !confirm(`Deactivate ${label}? They will immediately lose access until reactivated.`)) {
      return;
    }

    try {
      setStaffError('');
      setStaffSuccess('');
      setStaffActionLoading(user.id);
      await api.manageStaffAccount({
        action: 'toggle_active',
        targetUserId: user.id,
        isActive: nextActive,
      });
      setStaffSuccess(`${label} has been ${nextActive ? 'activated' : 'deactivated'}.`);
      await loadStaff();
    } catch (err) {
      setStaffError(err.message || 'Failed to update account status.');
    } finally {
      setStaffActionLoading(null);
    }
  };

  const handleDeleteStaff = async (user) => {
    if (!canManageStaff) return;
    const label = user.full_name || user.email;
    if (!confirm(`Permanently delete staff account "${label}" (${user.email})? This action cannot be undone.`)) {
      return;
    }

    try {
      setStaffError('');
      setStaffSuccess('');
      setStaffActionLoading(user.id);
      await api.manageStaffAccount({
        action: 'delete_staff',
        targetUserId: user.id,
      });
      setStaffSuccess(`Staff account ${label} was deleted.`);
      await loadStaff();
    } catch (err) {
      setStaffError(err.message || 'Failed to delete staff account.');
    } finally {
      setStaffActionLoading(null);
    }
  };

  if (!canManageSettings) {
    return (
      <div className="max-w-lg mx-auto mt-10 bg-white rounded-2xl border border-rose-200 shadow-sm p-8 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Access Denied</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          Only Lab Owners can access laboratory settings, staff logins, and subscription configuration.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 text-xs">
        Loading settings...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Laboratory & Cloud Settings</h2>
            <p className="text-xs text-slate-500">Configure clinic branding, doctor signatures, staff access, and subscription</p>
          </div>
        </div>

        {successMsg && (
          <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 text-xs font-semibold animate-fade-in">
            <Check className="w-4 h-4" />
            <span>{successMsg}</span>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 border-b border-slate-200 pb-2.5">
        <button
          onClick={() => setActiveTab('clinic')}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'clinic'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-200/60 bg-white sm:bg-transparent border border-slate-200 sm:border-transparent'
          }`}
        >
          <Building className="w-4 h-4 shrink-0" />
          <span>Clinic & Print</span>
        </button>

        <button
          onClick={() => setActiveTab('staff')}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'staff'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-200/60 bg-white sm:bg-transparent border border-slate-200 sm:border-transparent'
          }`}
        >
          <Users className="w-4 h-4 shrink-0" />
          <span>Staff ({staffList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('subscription')}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'subscription'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-200/60 bg-white sm:bg-transparent border border-slate-200 sm:border-transparent'
          }`}
        >
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>Subscription & Cloud</span>
        </button>
      </div>

      {/* TAB 1: Clinic & Print Setup Form */}
      {activeTab === 'clinic' && (
        <form onSubmit={handleSave} className="space-y-6">
          {/* 1. Pathology Centre Information */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-100">
              <Building className="w-4 h-4 text-sky-600" />
              <span>1. Pathology Centre Details</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Centre / Pathology Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={settings.clinic_name}
                  onChange={(e) => handleChange('clinic_name', e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Tagline / Subheading
                </label>
                <input
                  type="text"
                  value={settings.tagline}
                  onChange={(e) => handleChange('tagline', e.target.value)}
                  placeholder="e.g. Diagnostic, Clinical Laboratory & X-Ray Centre"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Centre Address
                </label>
                <input
                  type="text"
                  value={settings.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  placeholder="Street, City, District, State - PIN"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Contact Phone Numbers
                </label>
                <input
                  type="text"
                  value={settings.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="+91 98765 43210, +91 94250 12345"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Contact Email Address
                </label>
                <input
                  type="email"
                  value={settings.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="lab@yourdomain.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Registration / Licence No.
                </label>
                <input
                  type="text"
                  value={settings.reg_no}
                  onChange={(e) => handleChange('reg_no', e.target.value)}
                  placeholder="e.g. REG/MP/SIL/2026/042"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>
            </div>

            {/* Centre Logo Image Upload */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="block text-xs font-bold text-slate-700">Laboratory Logo Image</span>
                <p className="text-[11px] text-slate-400">Upload a PNG or JPEG logo to appear on letterhead and reports. Stored safely in cloud bucket.</p>
              </div>

              <div className="flex items-center gap-3">
                {(settings.logo_url || settings.logo_path) ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={settings.logo_url || settings.logo_path}
                      alt="Logo"
                      className="w-12 h-12 object-contain border border-slate-200 rounded-lg p-1 bg-white shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        handleChange('logo_path', '');
                        handleChange('logo_url', '');
                      }}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg text-xs"
                      title="Remove Logo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={uploadingImage}
                    onClick={() => handleSelectImage('logo')}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingImage ? 'Uploading...' : 'Upload Cloud Logo'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 2. Authorized Signatory & Digital Signature */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-100">
              <PenTool className="w-4 h-4 text-sky-600" />
              <span>2. Authorized Signatory Details</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Doctor / Signatory Name
                </label>
                <input
                  type="text"
                  value={settings.signatory_name}
                  onChange={(e) => handleChange('signatory_name', e.target.value)}
                  placeholder="e.g. Dr. Full Name"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Medical Degrees
                </label>
                <input
                  type="text"
                  value={settings.signatory_degree}
                  onChange={(e) => handleChange('signatory_degree', e.target.value)}
                  placeholder="e.g. M.B.B.S., M.D. (Pathology)"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Designation
                </label>
                <input
                  type="text"
                  value={settings.signatory_designation}
                  onChange={(e) => handleChange('signatory_designation', e.target.value)}
                  placeholder="e.g. Consultant Pathologist"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>
            </div>

            {/* Digital Signature Image Upload */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="block text-xs font-bold text-slate-700">Digital Signature Image (PNG)</span>
                <p className="text-[11px] text-slate-400">Upload a scan/PNG of doctor's signature to print automatically. If blank, a dotted manual sign line is printed.</p>
              </div>

              <div className="flex items-center gap-3">
                {(settings.signature_url || settings.signatory_signature_path) ? (
                  <div className="flex items-center gap-3">
                    <div className="p-1 border border-slate-200 rounded-lg bg-white shadow-sm">
                      <img
                        src={settings.signature_url || settings.signatory_signature_path}
                        alt="Signature"
                        className="h-10 object-contain"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        handleChange('signatory_signature_path', '');
                        handleChange('signature_url', '');
                      }}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg text-xs"
                      title="Remove Signature"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={uploadingImage}
                    onClick={() => handleSelectImage('signature')}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingImage ? 'Uploading...' : 'Upload Cloud Signature PNG'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 3. A4 Stationery & Report Numbering */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-100">
              <FileText className="w-4 h-4 text-sky-600" />
              <span>3. Stationery & Numbering Format</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Letterhead Mode */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-600">Default Printing Stationery</label>
                <div className="space-y-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition">
                    <input
                      type="radio"
                      name="letterhead_mode"
                      value="digital"
                      checked={settings.letterhead_mode === 'digital'}
                      onChange={(e) => handleChange('letterhead_mode', e.target.value)}
                      className="text-sky-600 focus:ring-sky-500"
                    />
                    <div>
                      <span className="font-bold text-slate-800 block">Plain A4 Paper (Full Digital Header)</span>
                      <span className="text-[11px] text-slate-400">Prints clinic name, logo, address and contact directly on blank paper</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition">
                    <input
                      type="radio"
                      name="letterhead_mode"
                      value="pad"
                      checked={settings.letterhead_mode === 'pad'}
                      onChange={(e) => handleChange('letterhead_mode', e.target.value)}
                      className="text-sky-600 focus:ring-sky-500"
                    />
                    <div>
                      <span className="font-bold text-slate-800 block">Pre-printed Letterhead Pad Stationery</span>
                      <span className="text-[11px] text-slate-400">Suppresses header and leaves top margin for physical clinic letterhead pad</span>
                    </div>
                  </label>
                </div>

                {settings.letterhead_mode === 'pad' && (
                  <div className="mt-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Top Blank Margin (in mm)
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="80"
                      value={settings.letterhead_top_margin || 35}
                      onChange={(e) => handleChange('letterhead_top_margin', parseInt(e.target.value) || 35)}
                      className="w-32 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                )}
              </div>

              {/* Report Number Prefix & Counter */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-600">Report Numbering Sequence</label>
                
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Report Prefix</label>
                  <input
                    type="text"
                    value={settings.report_number_prefix}
                    onChange={(e) => handleChange('report_number_prefix', e.target.value)}
                    placeholder="AP-"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Next Number Counter</label>
                  <input
                    type="number"
                    min="1"
                    value={settings.next_report_number}
                    onChange={(e) => handleChange('next_report_number', parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Preview: {settings.report_number_prefix}{String(settings.next_report_number).padStart(6, '0')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white font-bold px-6 py-2.5 rounded-xl text-xs shadow-md shadow-sky-600/30 transition active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save All Settings'}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: Staff & Team Management */}
      {activeTab === 'staff' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-800 text-base">Laboratory Staff & Role Accounts</h3>
              <p className="text-xs text-slate-500">Manage Owner (full access) and Receptionist (patient entry, billing &amp; reporting) login accounts</p>
            </div>

            <button
              onClick={() => {
                setStaffError('');
                setStaffSuccess('');
                setShowAddStaffModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition shadow-sm"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Add Staff Member</span>
            </button>
          </div>

          {staffError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{staffError}</span>
            </div>
          )}

          {staffSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{staffSuccess}</span>
            </div>
          )}

          {/* Desktop Staff List Table */}
          <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Full Name</th>
                  <th className="p-3.5">Email</th>
                  <th className="p-3.5">Assigned Role</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Joined</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staffList.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-6 text-center text-slate-400 text-xs">
                      No additional staff accounts added yet.
                    </td>
                  </tr>
                ) : (
                  staffList.map((user) => {
                    const isActive = user.is_active !== false;
                    const isSelf = user.id === profile?.id;
                    const busy = staffActionLoading === user.id;
                    return (
                      <tr key={user.id} className="hover:bg-slate-50/70 transition">
                        <td className="p-3.5 font-bold text-slate-800">
                          {user.full_name || 'Staff Member'}
                          {isSelf && (
                            <span className="ml-1.5 text-[10px] font-semibold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded">
                              You
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 font-mono text-[11px]">{user.email}</td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            user.role === 'lab_owner'
                              ? 'bg-purple-100 text-purple-800'
                              : user.role === 'super_admin'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {getRoleDisplayLabel(user.role)}
                          </span>
                        </td>
                        <td className="p-3.5">
                          {isActive ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                              <Check className="w-3 h-3" />
                              <span>Active</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600">
                              <UserX className="w-3 h-3" />
                              <span>Deactivated</span>
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-slate-400 font-mono text-[11px]">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-3.5 text-right whitespace-nowrap space-x-1">
                          <button
                            type="button"
                            onClick={() => openResetPasswordModal(user)}
                            disabled={busy}
                            className="p-1.5 text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition"
                            title="Reset Password"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>
                          {!isSelf && (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditStaffModal(user)}
                                disabled={busy}
                                className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                                title="Edit Staff Details"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleStaffActive(user)}
                                disabled={busy}
                                className={`p-1.5 rounded-lg transition ${
                                  isActive
                                    ? 'text-slate-500 hover:text-amber-700 hover:bg-amber-50'
                                    : 'text-emerald-600 hover:bg-emerald-50'
                                }`}
                                title={isActive ? 'Deactivate Account' : 'Activate Account'}
                              >
                                {isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteStaff(user)}
                                disabled={busy}
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                title="Delete Staff Account"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Staff Cards */}
          <div className="block md:hidden border border-slate-200 rounded-2xl divide-y divide-slate-100">
            {staffList.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                No additional staff accounts added yet.
              </div>
            ) : (
              staffList.map((user) => {
                const isActive = user.is_active !== false;
                const isSelf = user.id === profile?.id;
                const busy = staffActionLoading === user.id;
                return (
                  <div key={user.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-800 text-sm">
                          {user.full_name || 'Staff Member'}
                          {isSelf && (
                            <span className="ml-1.5 text-[10px] font-semibold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-mono text-slate-500 mt-0.5 break-all">
                          {user.email}
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                        user.role === 'lab_owner'
                          ? 'bg-purple-100 text-purple-800'
                          : user.role === 'super_admin'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {getRoleDisplayLabel(user.role)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                          <Check className="w-3 h-3" />
                          <span>Active Account</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-rose-600">
                          <UserX className="w-3 h-3" />
                          <span>Deactivated</span>
                        </span>
                      )}
                      <span className="text-slate-400 font-mono">
                        Joined {new Date(user.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => openResetPasswordModal(user)}
                        disabled={busy}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-50 text-sky-700 text-[11px] font-semibold"
                      >
                        <KeyRound className="w-3 h-3" /> Reset Password
                      </button>
                      {!isSelf && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditStaffModal(user)}
                            disabled={busy}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-semibold"
                          >
                            <Edit2 className="w-3 h-3" /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStaffActive(user)}
                            disabled={busy}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold ${
                              isActive ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            {isActive ? <UserX className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                            {isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteStaff(user)}
                            disabled={busy}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-700 text-[11px] font-semibold"
                          >
                            <Trash2 className="w-3 h-3" /> Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Subscription & Cloud Details */}
      {activeTab === 'subscription' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 sm:p-6 space-y-6">
          <div className="pb-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-800 text-base">Cloud Subscription & Multi-Tenant Status</h3>
            <p className="text-xs text-slate-500">Live details regarding your cloud laboratory isolation and hosting plan</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center gap-2 text-sky-700 font-bold text-xs uppercase">
                <ShieldCheck className="w-4 h-4" />
                <span>Tenant Isolation</span>
              </div>
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between gap-2">
                  <span className="font-medium shrink-0">Tenant ID:</span>
                  <span className="font-mono text-[11px] font-bold text-slate-800 truncate" title={tenant?.id}>
                    {tenant?.id || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="font-medium">Lab Slug:</span>
                  <span className="font-mono text-[11px] text-slate-700 truncate">{tenant?.slug || 'lab'}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="font-medium">Demo / Test Lab:</span>
                  <span className="font-bold">{tenant?.is_test_lab ? 'Yes (Isolated Demo)' : 'No (Production)'}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs uppercase">
                <Calendar className="w-4 h-4" />
                <span>Subscription Plan</span>
              </div>
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between gap-2">
                  <span className="font-medium">Plan Type:</span>
                  <span className="font-bold text-slate-800 uppercase">{subscription?.plan_type || 'Monthly'}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="font-medium">Access Source:</span>
                  <span className="font-bold uppercase text-sky-700">
                    {subscription?.subscription_source || 'complimentary'}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="font-medium">Expires On:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {subscription?.is_unlimited ? 'Lifetime / Unlimited' : subscription?.expires_at ? new Date(subscription.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Active'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Upgrade Subscription Option for Free Trial Labs */}
          {isTrial && (
            <div className="p-4 sm:p-5 bg-gradient-to-br from-sky-50 to-emerald-50/40 rounded-2xl border border-sky-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <h4 className="font-bold text-slate-900 text-sm">Upgrade from 3-Day Free Trial</h4>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {getTrialDaysRemaining()} day(s) remaining in your trial. Activate a full plan now to guarantee uninterrupted access.
                  </p>
                </div>
              </div>

              {upgradeError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                  {upgradeError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className={`p-3.5 rounded-xl border-2 cursor-pointer transition select-none ${
                  upgradePlan === 'monthly' ? 'bg-white border-sky-600 shadow-sm' : 'bg-white/60 border-slate-200 hover:border-slate-300'
                }`}>
                  <input
                    type="radio"
                    name="settingsUpgradePlan"
                    value="monthly"
                    checked={upgradePlan === 'monthly'}
                    onChange={() => setUpgradePlan('monthly')}
                    className="sr-only"
                  />
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs">Monthly Plan</span>
                    <span className="text-sm font-black font-mono text-sky-900">₹999/mo</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Full 30-day access • Unlimited patient records</p>
                </label>

                <label className={`p-3.5 rounded-xl border-2 cursor-pointer transition select-none ${
                  upgradePlan === 'yearly' ? 'bg-white border-sky-600 shadow-sm' : 'bg-white/60 border-slate-200 hover:border-slate-300'
                }`}>
                  <input
                    type="radio"
                    name="settingsUpgradePlan"
                    value="yearly"
                    checked={upgradePlan === 'yearly'}
                    onChange={() => setUpgradePlan('yearly')}
                    className="sr-only"
                  />
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs">
                      Annual Plan <span className="ml-1 text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full font-bold">Save 16%</span>
                    </span>
                    <span className="text-sm font-black font-mono text-sky-900">₹9,999/yr</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Full 365-day access • Priority support</p>
                </label>
              </div>

              <button
                type="button"
                disabled={upgrading}
                onClick={async () => {
                  try {
                    setUpgrading(true);
                    setUpgradeError('');
                    await upgradeSubscription(upgradePlan);
                    setSuccessMsg('Subscription activated successfully!');
                    setTimeout(() => setSuccessMsg(''), 4000);
                  } catch (err) {
                    setUpgradeError(err.message || 'Failed to upgrade subscription.');
                  } finally {
                    setUpgrading(false);
                  }
                }}
                className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                <span>{upgrading ? 'Activating Plan...' : `Activate ${upgradePlan === 'yearly' ? 'Annual Plan (₹9,999)' : 'Monthly Plan (₹999)'}`}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Add Staff Modal */}
      {showAddStaffModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full max-h-[90vh] overflow-y-auto rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="font-bold text-slate-900 text-sm">Add New Staff Account</h4>
              <button
                onClick={() => setShowAddStaffModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {staffError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{staffError}</span>
              </div>
            )}

            <form onSubmit={handleCreateStaff} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Staff Full Name</label>
                <div className="relative">
                  <input
                    type="text"
                    value={staffName}
                    onChange={(e) => setStaffName(e.target.value)}
                    placeholder="e.g. Ramesh Sharma"
                    required
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                  <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Login Email</label>
                <div className="relative">
                  <input
                    type="email"
                    value={staffEmail}
                    onChange={(e) => setStaffEmail(e.target.value)}
                    placeholder="ramesh@lab.com"
                    required
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Login Password</label>
                <div className="relative">
                  <input
                    type={showStaffPassword ? 'text' : 'password'}
                    value={staffPassword}
                    onChange={(e) => setStaffPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    required
                    className="w-full pl-8 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <button
                    type="button"
                    onClick={() => setShowStaffPassword(!showStaffPassword)}
                    tabIndex={-1}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                    title={showStaffPassword ? 'Hide password' : 'Show password'}
                  >
                    {showStaffPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Assigned Role</label>
                <select
                  value={staffRole}
                  onChange={(e) => setStaffRole(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                >
                  <option value="receptionist">Receptionist (Patient Entry, Billing &amp; Reports — Read-Only Catalog)</option>
                  <option value="lab_owner">Owner (Full Lab, Tests, Pricing, Doctors &amp; Staff Access)</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-xs shadow-md shadow-sky-600/20 transition active:scale-95"
                >
                  Create Staff Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Staff Password Modal */}
      {resetPasswordUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 space-y-5">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-sky-600" />
                <span>Reset Staff Password</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Set a new password immediately for{' '}
                <strong className="text-slate-700">{resetPasswordUser.full_name || resetPasswordUser.email}</strong>{' '}
                without requiring email confirmation.
              </p>
            </div>

            {resetPasswordError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{resetPasswordError}</span>
              </div>
            )}

            <form onSubmit={handleResetStaffPassword} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">New Password</label>
                <div className="relative">
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    value={resetNewPassword}
                    onChange={(e) => setResetNewPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    required
                    minLength={6}
                    autoFocus
                    className="w-full pl-3.5 pr-9 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    tabIndex={-1}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                    title={showResetPassword ? 'Hide password' : 'Show password'}
                  >
                    {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResetPasswordUser(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={staffActionLoading === resetPasswordUser.id}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-xs shadow-md shadow-sky-600/20 transition disabled:opacity-60"
                >
                  {staffActionLoading === resetPasswordUser.id ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Details Modal */}
      {editingStaffUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 space-y-5">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-sky-600" />
                <span>Edit Staff Account</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Update login details or role for {editingStaffUser.full_name || editingStaffUser.email}.
              </p>
            </div>

            {editStaffError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editStaffError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateStaff} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Full Name</label>
                <input
                  type="text"
                  value={editStaffName}
                  onChange={(e) => setEditStaffName(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Login Email</label>
                <input
                  type="email"
                  value={editStaffEmail}
                  onChange={(e) => setEditStaffEmail(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Assigned Role</label>
                <select
                  value={editStaffRole}
                  onChange={(e) => setEditStaffRole(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                >
                  <option value="receptionist">Receptionist (Patient Entry, Billing &amp; Reports)</option>
                  <option value="lab_owner">Owner (Full Lab &amp; Staff Access)</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingStaffUser(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={staffActionLoading === editingStaffUser.id}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-xs shadow-md shadow-sky-600/20 transition disabled:opacity-60"
                >
                  {staffActionLoading === editingStaffUser.id ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
