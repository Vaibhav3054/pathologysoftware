import React, { useState } from 'react';
import {
  Activity,
  Lock,
  Mail,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import LegalPagesView from './LegalPagesView';

export default function LoginView({ onSwitchToRegister }) {
  const { signIn, requestPasswordReset } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'forgot'
  const [legalTab, setLegalTab] = useState(null); // null | 'terms' | 'privacy' | 'refund'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (mode === 'forgot') {
      if (!email.trim()) {
        setErrorMsg('Please enter your registered email address.');
        return;
      }
      try {
        setLoading(true);
        await requestPasswordReset(email);
        setSuccessMsg(
          `Password reset link sent to ${email.trim()}. Check your inbox (and spam folder) to set a new password.`
        );
      } catch (err) {
        console.error('Reset request error:', err);
        setErrorMsg(err.message || 'Failed to send password reset email.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!email.trim() || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    try {
      setLoading(true);
      await signIn(email, password);
    } catch (err) {
      console.error('Login error:', err);
      setErrorMsg(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-100 p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-900 to-slate-900 p-6 sm:p-8 text-white text-center relative overflow-hidden">
          <div className="w-14 h-14 rounded-2xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center mx-auto mb-3 shadow-lg">
            <Activity className="w-8 h-8 text-sky-400 stroke-[2.2]" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">PATHOLOGY SAAS</h1>
          <p className="text-xs text-sky-200 font-medium mt-1">Diagnostic Laboratory Management Cloud</p>
        </div>

        {/* Form Container */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="text-center">
            <h2 className="text-lg font-bold text-slate-800">
              {mode === 'forgot' ? 'Reset Your Password' : 'Sign in to your Laboratory'}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {mode === 'forgot'
                ? 'Enter your account email and we will send a secure reset link'
                : 'Enter your Owner or Receptionist credentials to continue'}
            </p>
          </div>

          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="doctor@pathologylab.com"
                  required
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none transition"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>

            {mode === 'login' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-600">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setErrorMsg('');
                      setSuccessMsg('');
                    }}
                    className="text-[11px] font-semibold text-sky-600 hover:text-sky-700 hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none transition"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 p-0.5 rounded transition cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-600/30 transition active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>
                {loading
                  ? mode === 'forgot'
                    ? 'Sending Reset Link...'
                    : 'Authenticating...'
                  : mode === 'forgot'
                  ? 'Send Password Reset Link'
                  : 'Sign In to Laboratory'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="w-full inline-flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-semibold pt-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Sign In</span>
              </button>
            )}
          </form>

          {/* Onboarding Link */}
          <div className="pt-4 border-t border-slate-100 text-center space-y-2">
            <p className="text-xs text-slate-500">
              Own a pathology or diagnostic lab?
            </p>
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="text-xs font-bold text-sky-600 hover:text-sky-700 hover:underline cursor-pointer"
            >
              + Register New Laboratory (3-Day Free Trial)
            </button>
          </div>
        </div>

        {/* Footer info + Legal Links */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 text-center text-[11px] text-slate-400 space-y-2">
          <div className="flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Multi-Tenant Row-Level Security Protected</span>
          </div>
          <div className="flex items-center justify-center gap-3 text-[11px]">
            <button type="button" onClick={() => setLegalTab('terms')} className="hover:text-sky-600 hover:underline cursor-pointer">
              Terms of Service
            </button>
            <span>•</span>
            <button type="button" onClick={() => setLegalTab('privacy')} className="hover:text-sky-600 hover:underline cursor-pointer">
              Privacy Policy
            </button>
            <span>•</span>
            <button type="button" onClick={() => setLegalTab('refund')} className="hover:text-sky-600 hover:underline cursor-pointer">
              Refund Policy
            </button>
          </div>
        </div>
      </div>

      {legalTab && (
        <LegalPagesView
          initialTab={legalTab}
          isModal
          onClose={() => setLegalTab(null)}
        />
      )}
    </div>
  );
}
