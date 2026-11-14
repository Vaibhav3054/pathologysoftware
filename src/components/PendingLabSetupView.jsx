import React, { useState } from 'react';
import { Building2, Sparkles, AlertCircle, ArrowRight, LogOut, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function PendingLabSetupView() {
  const { user, profile, provisionPendingLab, signOut } = useAuth();
  const meta = user?.user_metadata || {};

  const [labName, setLabName] = useState(meta.lab_name || '');
  const [fullName, setFullName] = useState(meta.full_name || profile?.full_name || '');
  const [phone, setPhone] = useState(meta.lab_phone || '');
  const [address, setAddress] = useState(meta.lab_address || '');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLaunch = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!labName.trim()) {
      setErrorMsg('Please enter your Laboratory Name.');
      return;
    }

    try {
      setLoading(true);
      await provisionPendingLab({
        labName: labName.trim(),
        fullName: fullName.trim() || 'Laboratory Owner',
        phone: phone.trim(),
        address: address.trim(),
      });
    } catch (err) {
      console.error('Pending lab setup error:', err);
      setErrorMsg(err.message || 'Failed to activate laboratory trial. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-100 p-4 font-sans py-8 sm:py-12">
      <div className="max-w-lg w-full bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Banner */}
        <div className="bg-gradient-to-r from-sky-900 to-slate-900 p-6 text-white text-center">
          <div className="w-12 h-12 rounded-2xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center mx-auto mb-3 shadow">
            <Building2 className="w-6 h-6 text-sky-400" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/20 text-sky-200 text-xs font-semibold mb-2 border border-sky-400/20">
            <Sparkles className="w-3.5 h-3.5 text-sky-300" />
            <span>3-Day Automatic Free Trial</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight">Complete Laboratory Setup</h1>
          <p className="text-xs text-sky-200 mt-1 max-w-sm mx-auto">
            Welcome <strong className="text-white">{user?.email}</strong>! Enter your lab details below to immediately start your 3-day free trial.
          </p>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 space-y-6">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-600 space-y-2">
            <div className="flex items-center gap-2 text-slate-800 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>What is included in your 3-day free trial:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 pl-1 text-slate-500">
              <li>Full pathology software access (Patient registration, billing & reports)</li>
              <li>Pre-loaded Indian diagnostic test catalog (CBC, LFT, KFT, Sugars, etc.)</li>
              <li>Clean printable PDF reports with normal reference ranges</li>
            </ul>
          </div>

          <form onSubmit={handleLaunch} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Laboratory Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={labName}
                onChange={(e) => setLabName(e.target.value)}
                placeholder="e.g. City Diagnostic & Pathology Lab"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Owner / Doctor Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Dr. R. K. Sharma"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Lab Phone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">City / Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Bhopal, MP"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-500 hover:to-sky-600 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>{loading ? 'Activating 3-Day Free Trial...' : 'Activate 3-Day Free Trial & Launch'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Signed in as {user?.email}</span>
            <button
              onClick={signOut}
              className="inline-flex items-center gap-1.5 text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
