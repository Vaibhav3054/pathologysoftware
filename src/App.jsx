import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import NewEntry from './components/NewEntry';
import ReportEntry from './components/ReportEntry';
import ReportPrintView from './components/ReportPrintView';
import PatientsView from './components/PatientsView';
import ReportsView from './components/ReportsView';
import TestsManager from './components/TestsManager';
import DoctorsManager from './components/DoctorsManager';
import SettingsView from './components/SettingsView';
import BackupView from './components/BackupView';
import SuperAdminPortal from './components/SuperAdminPortal';
import LoginView from './components/LoginView';
import RegisterLabView from './components/RegisterLabView';
import LegalPagesView from './components/LegalPagesView';
import { useAuth } from './context/AuthContext';
import {
  Activity,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Lock,
  LogOut,
  RefreshCw,
  CheckCircle2,
  ArrowRight,
  CreditCard,
  Menu,
  UserPlus,
  Eye,
  EyeOff,
  X,
} from 'lucide-react';

function getInitialRouteFromLocation() {
  if (typeof window === 'undefined') return { view: 'dashboard', legalTab: 'terms' };
  const path = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  if (path === 'terms') return { view: 'legal', legalTab: 'terms' };
  if (path === 'privacy') return { view: 'legal', legalTab: 'privacy' };
  if (path === 'refund' || path === 'refunds') return { view: 'legal', legalTab: 'refund' };
  if (
    ['dashboard', 'new-entry', 'patients', 'reports', 'tests', 'doctors', 'settings', 'backup', 'super-admin', 'legal'].includes(path)
  ) {
    return { view: path, legalTab: 'terms' };
  }
  return { view: 'dashboard', legalTab: 'terms' };
}

export default function App() {
  const { 
    user, 
    profile, 
    tenant, 
    tenantSettings, 
    subscription, 
    loading, 
    passwordRecovery,
    isSuperAdmin, 
    isAccountActive,
    canAccessView,
    isSubscriptionActive, 
    updateOwnPassword,
    signOut,
    refreshSession,
    isTrial,
    getTrialDaysRemaining,
    upgradeSubscription
  } = useAuth();

  const initialRoute = getInitialRouteFromLocation();
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [currentView, setCurrentView] = useState(initialRoute.view);
  const [legalInitialTab, setLegalInitialTab] = useState(initialRoute.legalTab);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState('clinic');
  const [activeReportId, setActiveReportId] = useState(null);
  const [prefilledPatient, setPrefilledPatient] = useState(null);
  const [upgradePlan, setUpgradePlan] = useState('monthly');
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState('');

  // Password Recovery & In-App Change Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [pwUpdating, setPwUpdating] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

  // Set default landing view for Super Admin when no URL route override was specified
  useEffect(() => {
    if (isSuperAdmin && !tenant && initialRoute.view === 'dashboard') {
      setCurrentView('super-admin');
    }
  }, [isSuperAdmin, tenant]);

  // Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-900 text-white font-sans px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center mb-4 shadow-xl shadow-sky-500/10">
          <Activity className="w-8 h-8 text-sky-400 stroke-[2.2] animate-pulse" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">PATHOLOGY SAAS</h1>
        <p className="text-xs text-sky-300 mt-1 flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Connecting to Secure Multi-Tenant Cloud...</span>
        </p>
      </div>
    );
  }

  // Password Recovery Flow (user clicked email reset link)
  if (passwordRecovery && user) {
    const handleRecoverySubmit = async (e) => {
      e.preventDefault();
      setPwError('');
      setPwSuccess('');
      if (newPassword.length < 6) {
        setPwError('New password must be at least 6 characters.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setPwError('Passwords do not match.');
        return;
      }
      try {
        setPwUpdating(true);
        await updateOwnPassword(newPassword);
        setNewPassword('');
        setConfirmPassword('');
      } catch (err) {
        setPwError(err.message || 'Failed to update password.');
      } finally {
        setPwUpdating(false);
      }
    };

    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-100 p-4 font-sans">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-sky-900 to-slate-900 p-6 text-white text-center">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center mx-auto mb-2">
              <Lock className="w-6 h-6 text-sky-400" />
            </div>
            <h2 className="text-lg font-bold">Set New Password</h2>
            <p className="text-xs text-sky-200 mt-0.5">Choose a strong password for {user.email}</p>
          </div>
          <form onSubmit={handleRecoverySubmit} className="p-6 sm:p-8 space-y-4 text-xs">
            {pwError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700">{pwError}</div>
            )}
            <div>
              <label className="block font-semibold text-slate-600 mb-1">New Password</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  required
                  className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-sky-500"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  tabIndex={-1}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  required
                  className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-sky-500"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex={-1}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={pwUpdating}
              className="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold shadow-md transition cursor-pointer"
            >
              {pwUpdating ? 'Saving Password...' : 'Save New Password & Continue'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Unauthenticated Screen
  if (!user) {
    if (authMode === 'register') {
      return <RegisterLabView onSwitchToLogin={() => setAuthMode('login')} />;
    }
    return <LoginView onSwitchToRegister={() => setAuthMode('register')} />;
  }

  // Deactivated User Account Guard
  if (!isAccountActive) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-100 p-4 font-sans">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200 p-6 sm:p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Account Deactivated</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Your user account ({user.email}) has been deactivated by your Laboratory Owner. Please contact your laboratory administrator if you believe this is an error.
          </p>
          <button
            onClick={signOut}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    );
  }

  // Subscription Expiry / Trial Ended Guard (Super Admin can always bypass)
  const subscriptionActive = isSubscriptionActive();
  if (!subscriptionActive && !isSuperAdmin) {
    const isTrialExpired = isTrial || subscription?.plan_type === 'trial' || subscription?.subscription_source === 'trial';
    const expiresDate = subscription?.expires_at 
      ? new Date(subscription.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'Expired';

    const handleActivateSubscription = async () => {
      try {
        setUpgrading(true);
        setUpgradeError('');
        await upgradeSubscription(upgradePlan);
      } catch (err) {
        console.error('Subscription activation error:', err);
        setUpgradeError(err.message || 'Failed to activate subscription. Please try again.');
      } finally {
        setUpgrading(false);
      }
    };

    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-100 p-4 font-sans py-8 sm:py-10">
        <div className="max-w-xl w-full bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-sky-900 to-slate-900 p-5 sm:p-6 text-white text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center mx-auto mb-2">
              <AlertTriangle className="w-6 h-6 text-amber-400" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight">
              {isTrialExpired ? 'Your 3-Day Free Trial Has Ended' : 'Laboratory Subscription Paused'}
            </h2>
            <p className="text-xs text-sky-200 mt-0.5">
              Choose a subscription plan to continue full access for {tenant?.name || 'Your Laboratory'}
            </p>
          </div>

          <div className="p-5 sm:p-8 space-y-6">
            {upgradeError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                {upgradeError}
              </div>
            )}

            {/* Plan Selector */}
            <div className="space-y-3">
              <span className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Select Your Subscription Plan
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className={`p-4 rounded-2xl border-2 cursor-pointer transition select-none ${
                  upgradePlan === 'monthly' ? 'bg-sky-50 border-sky-600 ring-2 ring-sky-500/20' : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}>
                  <input
                    type="radio"
                    name="upgradePlan"
                    value="monthly"
                    checked={upgradePlan === 'monthly'}
                    onChange={() => setUpgradePlan('monthly')}
                    className="sr-only"
                  />
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm">Monthly Plan</span>
                    <span className="w-4 h-4 rounded-full border-2 flex items-center justify-center border-sky-600">
                      {upgradePlan === 'monthly' && <span className="w-2 h-2 rounded-full bg-sky-600" />}
                    </span>
                  </div>
                  <div className="text-xl font-extrabold text-sky-950 font-mono mt-2">₹999 <span className="text-xs font-normal text-slate-500">/ month</span></div>
                  <ul className="text-[11px] text-slate-600 mt-3 space-y-1">
                    <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Full 30-Day Access</li>
                    <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Unlimited Patient Reports</li>
                    <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Cloud Backup Included</li>
                  </ul>
                </label>

                <label className={`p-4 rounded-2xl border-2 cursor-pointer transition select-none ${
                  upgradePlan === 'yearly' ? 'bg-sky-50 border-sky-600 ring-2 ring-sky-500/20' : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}>
                  <input
                    type="radio"
                    name="upgradePlan"
                    value="yearly"
                    checked={upgradePlan === 'yearly'}
                    onChange={() => setUpgradePlan('yearly')}
                    className="sr-only"
                  />
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 text-sm">Annual Plan</span>
                      <span className="ml-2 text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full font-bold">Save 16%</span>
                    </div>
                    <span className="w-4 h-4 rounded-full border-2 flex items-center justify-center border-sky-600">
                      {upgradePlan === 'yearly' && <span className="w-2 h-2 rounded-full bg-sky-600" />}
                    </span>
                  </div>
                  <div className="text-xl font-extrabold text-sky-950 font-mono mt-2">₹9,999 <span className="text-xs font-normal text-slate-500">/ year</span></div>
                  <ul className="text-[11px] text-slate-600 mt-3 space-y-1">
                    <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Full 365-Day Access</li>
                    <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Priority Support</li>
                    <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> 2 Months Free Value</li>
                  </ul>
                </label>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-2">
              <button
                onClick={handleActivateSubscription}
                disabled={upgrading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/30 transition active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                <span>{upgrading ? 'Activating Subscription...' : `Activate ${upgradePlan === 'yearly' ? 'Annual (₹9,999)' : 'Monthly (₹999)'} Plan`}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={refreshSession}
                  className="inline-flex items-center gap-1.5 text-xs text-sky-600 hover:text-sky-700 font-semibold cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Check for Updated Access</span>
                </button>

                <button
                  onClick={signOut}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Navigation handlers
  const handleViewReport = (reportId) => {
    setActiveReportId(reportId);
    setCurrentView('report-view');
  };

  const handleEditReport = (reportId) => {
    setActiveReportId(reportId);
    setCurrentView('report-entry');
  };

  const handleRegistrationComplete = (reportId) => {
    setActiveReportId(reportId);
    setCurrentView('report-entry');
  };

  const handleNewEntryForPatient = (patient) => {
    setPrefilledPatient(patient);
    setCurrentView('new-entry');
  };

  const labDisplayName = tenantSettings?.clinic_name || tenant?.name || 'DIAGNOSTIC CENTRE';

  return (
    <div className="flex flex-col lg:flex-row min-h-screen lg:h-screen w-full lg:overflow-hidden bg-slate-100 font-sans">
      {/* Mobile / Tablet Sticky Top Bar (Hidden on lg+ desktop and print) */}
      <header className="no-print lg:hidden sticky top-0 z-30 bg-slate-900 text-white px-3.5 py-2.5 flex items-center justify-between gap-2 shadow-md border-b border-slate-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition active:scale-95 shrink-0"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 min-w-0">
            {tenantSettings?.logo_url ? (
              <img
                src={tenantSettings.logo_url}
                alt="Logo"
                className="w-7 h-7 rounded-md object-contain bg-white p-0.5 shrink-0"
              />
            ) : (
              <div className="w-7 h-7 rounded-md bg-sky-600 flex items-center justify-center shrink-0">
                <Activity className="w-4 h-4 text-white" />
              </div>
            )}
            <div className="min-w-0">
              <span className="font-bold text-xs tracking-tight text-white block truncate max-w-[170px] sm:max-w-[260px]">
                {labDisplayName}
              </span>
              {isTrial && (
                <span className="text-[9px] font-bold text-emerald-400 block leading-none mt-0.5">
                  {getTrialDaysRemaining()}d Free Trial
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setPrefilledPatient(null);
            setCurrentView('new-entry');
          }}
          className="flex items-center gap-1 bg-sky-600 hover:bg-sky-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm transition active:scale-95 shrink-0"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>New Entry</span>
        </button>
      </header>

      {/* Sidebar (Desktop fixed + Mobile slide-out drawer) */}
      <Sidebar 
        currentView={currentView} 
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        onOpenChangePassword={() => {
          setNewPassword('');
          setConfirmPassword('');
          setPwError('');
          setPwSuccess('');
          setShowChangePasswordModal(true);
        }}
        setCurrentView={(view, extra) => {
          if (!canAccessView(view)) {
            setCurrentView(view); // Renders explicit Access Denied screen
            return;
          }
          if (view !== 'new-entry') {
            setPrefilledPatient(null);
          }
          if (view === 'settings') {
            setSettingsTab('clinic');
          }
          if (view === 'legal' && extra) {
            setLegalInitialTab(extra);
          }
          setCurrentView(view);
        }} 
      />

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 lg:h-screen lg:overflow-y-auto bg-slate-100/90 p-3.5 sm:p-6 lg:p-8 print:p-0 print:m-0 print:overflow-visible print:h-auto">
        {!canAccessView(currentView) ? (
          <div className="max-w-lg mx-auto mt-10 bg-white rounded-3xl border border-rose-200 shadow-lg p-6 sm:p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Access Denied</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Your current role (<span className="font-semibold uppercase text-slate-700">{profile?.role || 'staff'}</span>) does not have permission to access this administrative module. Only the Laboratory Owner can modify master catalog, doctors, user accounts, and system settings.
            </p>
            <button
              type="button"
              onClick={() => setCurrentView('dashboard')}
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
            >
              Return to Dashboard
            </button>
          </div>
        ) : (
          <>
            {currentView === 'super-admin' && isSuperAdmin && (
              <SuperAdminPortal />
            )}

            {currentView === 'dashboard' && (
              <Dashboard 
                setCurrentView={(view) => {
                  if (view === 'settings-subscription') {
                    if (!canAccessView('settings')) return;
                    setSettingsTab('subscription');
                    setCurrentView('settings');
                  } else {
                    setCurrentView(view);
                  }
                }}
                onViewReport={handleViewReport}
                onEditReport={handleEditReport}
              />
            )}

            {currentView === 'new-entry' && (
              <NewEntry 
                prefilledPatient={prefilledPatient}
                onRegistrationComplete={handleRegistrationComplete}
              />
            )}

            {currentView === 'report-entry' && activeReportId && (
              <ReportEntry 
                reportId={activeReportId}
                onBack={() => setCurrentView('reports')}
                onViewReport={handleViewReport}
              />
            )}

            {currentView === 'report-view' && activeReportId && (
              <ReportPrintView 
                reportId={activeReportId}
                onBack={() => setCurrentView('reports')}
                onEdit={() => handleEditReport(activeReportId)}
              />
            )}

            {currentView === 'patients' && (
              <PatientsView 
                onViewReport={handleViewReport}
                onEditReport={handleEditReport}
                onNewEntryForPatient={handleNewEntryForPatient}
              />
            )}

            {currentView === 'reports' && (
              <ReportsView 
                onViewReport={handleViewReport}
                onEditReport={handleEditReport}
                onNewEntry={() => setCurrentView('new-entry')}
              />
            )}

            {currentView === 'tests' && <TestsManager />}

            {currentView === 'doctors' && <DoctorsManager />}

            {currentView === 'settings' && <SettingsView initialTab={settingsTab} />}

            {currentView === 'backup' && <BackupView />}

            {currentView === 'legal' && (
              <LegalPagesView
                key={legalInitialTab}
                initialTab={legalInitialTab}
                onClose={() => setCurrentView(isSuperAdmin && !tenant ? 'super-admin' : 'dashboard')}
              />
            )}
          </>
        )}
      </main>

      {/* Change Own Password Modal */}
      {showChangePasswordModal && (
        <div className="no-print fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-sky-400" />
                <h3 className="font-bold text-sm">Change My Password</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowChangePasswordModal(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setPwError('');
                setPwSuccess('');
                if (newPassword.length < 6) {
                  setPwError('Password must be at least 6 characters.');
                  return;
                }
                if (newPassword !== confirmPassword) {
                  setPwError('Passwords do not match.');
                  return;
                }
                try {
                  setPwUpdating(true);
                  await updateOwnPassword(newPassword);
                  setPwSuccess('Your password has been updated!');
                  setNewPassword('');
                  setConfirmPassword('');
                  setTimeout(() => setShowChangePasswordModal(false), 1200);
                } catch (err) {
                  setPwError(err.message || 'Failed to update password.');
                } finally {
                  setPwUpdating(false);
                }
              }}
              className="p-6 space-y-4 text-xs"
            >
              {pwError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700">{pwError}</div>
              )}
              {pwSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700">{pwSuccess}</div>
              )}
              <div>
                <label className="block font-semibold text-slate-600 mb-1">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    required
                    className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    tabIndex={-1}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    required
                    className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex={-1}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowChangePasswordModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pwUpdating}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold shadow-sm cursor-pointer"
                >
                  {pwUpdating ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
