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
import { useAuth } from './context/AuthContext';
import { Activity, AlertTriangle, ShieldCheck, LogOut, RefreshCw, CheckCircle2, ArrowRight, CreditCard } from 'lucide-react';

export default function App() {
  const { 
    user, 
    profile, 
    tenant, 
    tenantSettings, 
    subscription, 
    loading, 
    isSuperAdmin, 
    isSubscriptionActive, 
    signOut,
    refreshSession,
    isTrial,
    upgradeSubscription
  } = useAuth();

  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [currentView, setCurrentView] = useState('dashboard');
  const [activeReportId, setActiveReportId] = useState(null);
  const [prefilledPatient, setPrefilledPatient] = useState(null);
  const [upgradePlan, setUpgradePlan] = useState('monthly');
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState('');

  // Set default landing view for Super Admin
  useEffect(() => {
    if (isSuperAdmin && !tenant) {
      setCurrentView('super-admin');
    }
  }, [isSuperAdmin, tenant]);

  // Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-slate-900 text-white font-sans">
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

  // Unauthenticated Screen
  if (!user) {
    if (authMode === 'register') {
      return <RegisterLabView onSwitchToLogin={() => setAuthMode('login')} />;
    }
    return <LoginView onSwitchToRegister={() => setAuthMode('register')} />;
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
      <div className="min-h-screen w-screen flex items-center justify-center bg-slate-100 p-4 font-sans py-10">
        <div className="max-w-xl w-full bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-sky-900 to-slate-900 p-6 text-white text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center mx-auto mb-2">
              <AlertTriangle className="w-6 h-6 text-amber-400" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">
              {isTrialExpired ? 'Your 3-Day Free Trial Has Ended' : 'Laboratory Subscription Paused'}
            </h2>
            <p className="text-xs text-sky-200 mt-0.5">
              Choose a subscription plan to continue full access for {tenant?.name || 'Your Laboratory'}
            </p>
          </div>

          <div className="p-8 space-y-6">
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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 font-sans">
      {/* Sidebar (automatically hidden in print mode) */}
      <Sidebar 
        currentView={currentView} 
        setCurrentView={(view) => {
          if (view !== 'new-entry') {
            setPrefilledPatient(null);
          }
          setCurrentView(view);
        }} 
      />

      {/* Main Content Area */}
      <main className="flex-1 h-screen overflow-y-auto bg-slate-100/90 p-4 sm:p-6 lg:p-8 print:p-0 print:m-0 print:overflow-visible print:h-auto">
        {currentView === 'super-admin' && isSuperAdmin && (
          <SuperAdminPortal />
        )}

        {currentView === 'dashboard' && (
          <Dashboard 
            setCurrentView={setCurrentView}
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

        {currentView === 'settings' && <SettingsView />}

        {currentView === 'backup' && <BackupView />}
      </main>
    </div>
  );
}
