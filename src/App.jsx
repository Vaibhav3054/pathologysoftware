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
import { Activity, AlertTriangle, ShieldCheck, LogOut, RefreshCw } from 'lucide-react';

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
    refreshSession
  } = useAuth();

  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [currentView, setCurrentView] = useState('dashboard');
  const [activeReportId, setActiveReportId] = useState(null);
  const [prefilledPatient, setPrefilledPatient] = useState(null);

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

  // Subscription Expiry / Suspended Guard (Super Admin can always bypass)
  const subscriptionActive = isSubscriptionActive();
  if (!subscriptionActive && !isSuperAdmin) {
    const expiresDate = subscription?.expires_at 
      ? new Date(subscription.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'Expired';

    return (
      <div className="min-h-screen w-screen flex items-center justify-center bg-slate-100 p-4 font-sans">
        <div className="max-w-lg w-full bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-amber-500/10 border-b border-amber-200/80 p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">Laboratory Subscription Expired</h2>
            <p className="text-xs text-slate-600 mt-1">Access to clinical tools and reporting has been paused</p>
          </div>

          <div className="p-6 space-y-4 text-xs text-slate-600">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex justify-between">
                <span className="font-semibold text-slate-500">Laboratory:</span>
                <span className="font-bold text-slate-800">{tenant?.name || 'Your Lab'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-500">Subscription Status:</span>
                <span className="font-bold text-rose-600 uppercase">{subscription?.status || 'Expired'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-500">Expiry Date:</span>
                <span className="font-mono font-bold text-slate-700">{expiresDate}</span>
              </div>
            </div>

            <p className="text-center text-slate-500 leading-relaxed">
              To renew your subscription or extend your complimentary access, please contact your Platform Administrator.
            </p>

            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={refreshSession}
                className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Check for Updated Subscription</span>
              </button>

              <button
                onClick={signOut}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
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
