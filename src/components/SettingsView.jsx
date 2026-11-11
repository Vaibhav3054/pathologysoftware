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
  Sparkles
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';

export default function SettingsView() {
  const { tenant, profile, subscription, isLabOwner, isSuperAdmin, isTrial, getTrialDaysRemaining, upgradeSubscription } = useAuth();

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

  const [activeTab, setActiveTab] = useState('clinic'); // 'clinic' | 'staff' | 'subscription'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

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
      // 1. Sign up user via Supabase Auth
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: staffEmail.trim(),
        password: staffPassword,
      });

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
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('clinic')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'clinic'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-200/60'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Clinic & Print Setup</span>
        </button>

        <button
          onClick={() => setActiveTab('staff')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'staff'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-200/60'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Staff & Team ({staffList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('subscription')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'subscription'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-200/60'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
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
              <p className="text-xs text-slate-500">Manage user logins for receptionists, technicians, and laboratory administrators</p>
            </div>

            <button
              onClick={() => setShowAddStaffModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition shadow-sm"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Add Staff Member</span>
            </button>
          </div>

          {staffSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>{staffSuccess}</span>
            </div>
          )}

          {/* Staff List Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Full Name</th>
                  <th className="p-3.5">Email</th>
                  <th className="p-3.5">Assigned Role</th>
                  <th className="p-3.5">Account Status</th>
                  <th className="p-3.5">Joined Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staffList.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-6 text-center text-slate-400 text-xs">
                      No additional staff accounts added yet.
                    </td>
                  </tr>
                ) : (
                  staffList.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/70 transition">
                      <td className="p-3.5 font-bold text-slate-800">
                        {user.full_name || 'Staff Member'}
                      </td>
                      <td className="p-3.5 font-mono">{user.email}</td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          user.role === 'lab_owner'
                            ? 'bg-purple-100 text-purple-800'
                            : user.role === 'receptionist'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                          <Check className="w-3 h-3" />
                          <span>Active</span>
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-400 font-mono text-[11px]">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Subscription & Cloud Details */}
      {activeTab === 'subscription' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-6">
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
                <div className="flex justify-between">
                  <span className="font-medium">Tenant ID:</span>
                  <span className="font-mono text-[11px] font-bold text-slate-800 truncate max-w-[200px]" title={tenant?.id}>
                    {tenant?.id || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Lab Slug:</span>
                  <span className="font-mono text-[11px] text-slate-700">{tenant?.slug || 'lab'}</span>
                </div>
                <div className="flex justify-between">
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
                <div className="flex justify-between">
                  <span className="font-medium">Plan Type:</span>
                  <span className="font-bold text-slate-800 uppercase">{subscription?.plan_type || 'Monthly'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Access Source:</span>
                  <span className="font-bold uppercase text-sky-700">
                    {subscription?.subscription_source || 'complimentary'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Expires On:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {subscription?.is_unlimited ? 'Lifetime / Unlimited' : subscription?.expires_at ? new Date(subscription.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Active'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {showAddStaffModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4">
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
                  <option value="receptionist">Receptionist (Patient Entry & Invoicing)</option>
                  <option value="technician">Technician (Test Result Entry & Reports)</option>
                  <option value="lab_owner">Lab Administrator (Full Lab Access)</option>
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
    </div>
  );
}
