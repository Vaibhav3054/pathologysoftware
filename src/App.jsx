import React, { useState } from 'react';
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

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [activeReportId, setActiveReportId] = useState(null);
  const [prefilledPatient, setPrefilledPatient] = useState(null);

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
