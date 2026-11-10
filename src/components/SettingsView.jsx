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
  Hash
} from 'lucide-react';
import { api } from '../services/api';

export default function SettingsView() {
  const [settings, setSettings] = useState({
    clinic_name: 'ACHARYA PATHOLOGY',
    tagline: 'Diagnostic, Clinical Laboratory & X-Ray Centre',
    address: 'Silwani, Dist. Raisen, Madhya Pradesh - 464886',
    phone: '+91 98765 43210',
    email: 'contact@acharyapathology.com',
    reg_no: 'REG/MP/SIL/2026/042',
    signatory_name: 'Dr. S. K. Acharya',
    signatory_degree: 'M.B.B.S., M.D. (Pathology)',
    signatory_designation: 'Consultant Pathologist',
    signatory_signature_path: '',
    logo_path: '',
    letterhead_mode: 'digital',
    letterhead_top_margin: 35,
    report_number_prefix: 'AP-',
    next_report_number: 1
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await api.getSettings();
      if (data && Object.keys(data).length > 0) {
        setSettings(data);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, val) => {
    setSettings(prev => ({ ...prev, [field]: val }));
  };

  const handleSelectImage = async (category) => {
    try {
      const res = await api.selectImage(category);
      if (res && res.dataUrl) {
        if (category === 'logo') {
          handleChange('logo_path', res.dataUrl);
        } else {
          handleChange('signatory_signature_path', res.dataUrl);
        }
      }
    } catch (err) {
      console.error('Image selection error:', err);
      alert('Could not load image: ' + err.message);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setSuccessMsg('');
      await api.updateSettings(settings);
      setSuccessMsg('Settings saved successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Error saving settings:', err);
      alert('Failed to save settings: ' + err.message);
    } finally {
      setSaving(false);
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
            <h2 className="text-xl font-bold text-slate-800">Pathology & Print Settings</h2>
            <p className="text-xs text-slate-500">Configure clinic details, doctor signatures, and A4 letterhead format</p>
          </div>
        </div>

        {successMsg && (
          <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 text-xs font-semibold animate-fade-in">
            <Check className="w-4 h-4" />
            <span>{successMsg}</span>
          </div>
        )}
      </div>

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
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Address (Printed on Report Header)
              </label>
              <input
                type="text"
                value={settings.address}
                onChange={(e) => handleChange('address', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Contact Phone Number
              </label>
              <input
                type="text"
                value={settings.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Government / Clinical Registration Number
              </label>
              <input
                type="text"
                value={settings.reg_no}
                onChange={(e) => handleChange('reg_no', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
              />
            </div>
          </div>

          {/* Logo Upload Section */}
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="block text-xs font-bold text-slate-700">Pathology Logo</span>
              <p className="text-[11px] text-slate-400">Upload a PNG or JPG logo to display on report header</p>
            </div>

            <div className="flex items-center gap-3">
              {settings.logo_path ? (
                <div className="flex items-center gap-3">
                  <img
                    src={settings.logo_path}
                    alt="Logo"
                    className="w-12 h-12 object-contain border border-slate-200 rounded-lg p-1 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleChange('logo_path', '')}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg text-xs"
                    title="Remove Logo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSelectImage('logo')}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Choose Logo File</span>
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
                placeholder="e.g. Dr. S. K. Acharya"
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
              {settings.signatory_signature_path ? (
                <div className="flex items-center gap-3">
                  <div className="p-1 border border-slate-200 rounded-lg bg-white">
                    <img
                      src={settings.signatory_signature_path}
                      alt="Signature"
                      className="h-10 object-contain"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleChange('signatory_signature_path', '')}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg text-xs"
                    title="Remove Signature"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSelectImage('signature')}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Signature PNG</span>
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
    </div>
  );
}
