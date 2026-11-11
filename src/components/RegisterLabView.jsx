import React, { useState } from 'react';
import { Activity, Building2, User, Mail, Lock, Phone, MapPin, ArrowRight, ArrowLeft, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function RegisterLabView({ onSwitchToLogin }) {
  const { registerLab } = useAuth();
  const [labName, setLabName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [planType, setPlanType] = useState('monthly');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!labName.trim() || !fullName.trim() || !email.trim() || !password) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    try {
      setLoading(true);
      await registerLab({
        labName: labName.trim(),
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        labPhone: phone.trim(),
        labAddress: address.trim(),
        planType,
      });
      // Context automatically sets tenant & session, routing into main app!
    } catch (err) {
      console.error('Registration error:', err);
      setErrorMsg(err.message || 'Failed to register laboratory.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-slate-100 p-4 font-sans py-12">
      <div className="max-w-xl w-full bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-900 to-slate-900 p-6 text-white text-center">
          <div className="w-12 h-12 rounded-2xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center mx-auto mb-2 shadow">
            <Building2 className="w-6 h-6 text-sky-400" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Register Your Laboratory</h1>
          <p className="text-xs text-sky-200 mt-0.5">Instant multi-tenant cloud laboratory setup</p>
        </div>

        {/* Form Container */}
        <div className="p-8 space-y-6">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Laboratory Info */}
            <div className="space-y-3 pb-3 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">1. Laboratory Details</h3>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Pathology / Centre Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={labName}
                    onChange={(e) => setLabName(e.target.value)}
                    placeholder="e.g. City Diagnostic & Pathology Lab"
                    required
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Lab Phone Number</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                    />
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">City / Address</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="e.g. Silwani, Raisen, M.P."
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                    />
                    <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  </div>
                </div>
              </div>
            </div>

            {/* Owner Account Info */}
            <div className="space-y-3 pb-3 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">2. Lab Owner Account</h3>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Owner Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Dr. S. K. Acharya"
                    required
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Login Email <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="owner@lab.com"
                      required
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                    />
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      required
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  </div>
                </div>
              </div>
            </div>

            {/* Plan Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-600">Select Subscription Plan</label>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <label className={`p-3 rounded-xl border cursor-pointer select-none transition ${
                  planType === 'monthly' ? 'bg-sky-50 border-sky-500 ring-1 ring-sky-500' : 'bg-slate-50 border-slate-200'
                }`}>
                  <input
                    type="radio"
                    name="plan"
                    value="monthly"
                    checked={planType === 'monthly'}
                    onChange={() => setPlanType('monthly')}
                    className="sr-only"
                  />
                  <div className="font-bold text-slate-800">Monthly Plan</div>
                  <div className="text-sky-700 font-mono font-bold text-sm mt-0.5">₹999 / mo</div>
                  <div className="text-[10px] text-slate-400 mt-1">30 days full access</div>
                </label>

                <label className={`p-3 rounded-xl border cursor-pointer select-none transition ${
                  planType === 'yearly' ? 'bg-sky-50 border-sky-500 ring-1 ring-sky-500' : 'bg-slate-50 border-slate-200'
                }`}>
                  <input
                    type="radio"
                    name="plan"
                    value="yearly"
                    checked={planType === 'yearly'}
                    onChange={() => setPlanType('yearly')}
                    className="sr-only"
                  />
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">Annual Plan</span>
                    <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-bold">Save 16%</span>
                  </div>
                  <div className="text-sky-700 font-mono font-bold text-sm mt-0.5">₹9,999 / yr</div>
                  <div className="text-[10px] text-slate-400 mt-1">365 days full access</div>
                </label>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/30 transition active:scale-98 flex items-center justify-center gap-2 mt-4"
            >
              <span>{loading ? 'Setting up Laboratory...' : 'Create Laboratory & Launch'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Back to Login */}
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Staff Sign In</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
