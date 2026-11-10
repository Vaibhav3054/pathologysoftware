import React, { useState } from 'react';
import { 
  Database, 
  Download, 
  Upload, 
  ShieldCheck, 
  AlertTriangle, 
  Check, 
  HardDrive, 
  FolderArchive,
  RefreshCw
} from 'lucide-react';
import { api } from '../services/api';

export default function BackupView() {
  const [backupStatus, setBackupStatus] = useState('');
  const [restoreStatus, setRestoreStatus] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleCreateBackup = async () => {
    try {
      setProcessing(true);
      setBackupStatus('');
      const res = await api.createBackup();
      if (res && res.success) {
        setBackupStatus(`Database backup created successfully!\nSaved to: ${res.path}`);
      } else if (res && res.canceled) {
        setBackupStatus('Backup cancelled.');
      } else if (res && res.error) {
        setBackupStatus('Backup failed: ' + res.error);
      }
    } catch (err) {
      console.error('Backup error:', err);
      setBackupStatus('Error creating backup: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleRestoreBackup = async () => {
    const confirmed = confirm(
      'WARNING: Restoring a backup will replace your current patient records and test templates with the data from the backup file.\n\nDo you want to proceed?'
    );
    if (!confirmed) return;

    try {
      setProcessing(true);
      setRestoreStatus('');
      const res = await api.restoreBackup();
      if (res && res.success) {
        setRestoreStatus('Database successfully restored! Reloading application data...');
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else if (res && res.canceled) {
        setRestoreStatus('Restore cancelled.');
      } else if (res && res.error) {
        setRestoreStatus('Restore failed: ' + res.error);
      }
    } catch (err) {
      console.error('Restore error:', err);
      setRestoreStatus('Error restoring database: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Database Safety & Backups</h2>
            <p className="text-xs text-slate-500">Safely backup patient records, test templates, and billing history to external USB or drives</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl border border-emerald-200 text-xs font-semibold">
          <ShieldCheck className="w-4 h-4" />
          <span>Local SQLite Storage Protected</span>
        </div>
      </div>

      {/* Main Actions Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Create Manual Backup */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <Download className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Create Manual Backup</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Exports a snapshot of all patients, medical reports, test results, and billing data as an authentic SQLite database file.
              </p>
            </div>

            <div className="p-3 bg-sky-50/60 rounded-xl border border-sky-100 text-[11px] text-sky-900 space-y-1">
              <p className="font-semibold">Recommended Practice:</p>
              <p>Plug in a USB pen drive and save a weekly backup copy for complete physical data redundancy.</p>
            </div>
          </div>

          <div>
            {backupStatus && (
              <div className="p-3 mb-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono text-slate-700 whitespace-pre-wrap">
                {backupStatus}
              </div>
            )}

            <button
              onClick={handleCreateBackup}
              disabled={processing}
              className="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-600/20 transition active:scale-98 flex items-center justify-center gap-2"
            >
              <HardDrive className="w-4 h-4" />
              <span>{processing ? 'Processing...' : '📁 Choose Folder & Create Backup'}</span>
            </button>
          </div>
        </div>

        {/* Restore Backup */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Restore Database from Backup</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Restore patient registers and test catalog from a previously saved SQLite backup file (.db).
              </p>
            </div>

            <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 text-[11px] text-amber-900 space-y-1">
              <p className="font-semibold flex items-center gap-1 text-amber-800">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Caution</span>
              </p>
              <p>Restoring will replace existing records with the data inside the chosen backup file.</p>
            </div>
          </div>

          <div>
            {restoreStatus && (
              <div className="p-3 mb-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono text-slate-700 whitespace-pre-wrap">
                {restoreStatus}
              </div>
            )}

            <button
              onClick={handleRestoreBackup}
              disabled={processing}
              className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-md transition active:scale-98 flex items-center justify-center gap-2"
            >
              <FolderArchive className="w-4 h-4" />
              <span>{processing ? 'Processing...' : '🔄 Select Backup File to Restore'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Persistent Storage Architecture Notice */}
      <div className="bg-slate-100/80 border border-slate-200/80 rounded-2xl p-5 text-xs text-slate-600 space-y-2">
        <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
          Offline Data Safety Architecture
        </h4>
        <p className="leading-relaxed">
          Acharya Pathology maintains the primary active database in your local Windows user profile directory (<code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-300">%APPDATA%\AcharyaPathology\data\acharya.db</code>).
        </p>
        <p className="leading-relaxed">
          Because the database is completely decoupled from the application executable, software updates and re-installations will never overwrite or erase your existing patient diagnostic records.
        </p>
      </div>
    </div>
  );
}
