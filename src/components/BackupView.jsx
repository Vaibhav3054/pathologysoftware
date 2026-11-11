import React, { useState } from 'react';
import { 
  Database, 
  Download, 
  ShieldCheck, 
  HardDrive, 
  CloudCheck,
  RefreshCw,
  Server,
  FileCheck2,
  Lock
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function BackupView() {
  const { tenant } = useAuth();
  const [backupStatus, setBackupStatus] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleExportData = async () => {
    try {
      setProcessing(true);
      setBackupStatus('');
      const res = await api.createBackup();
      if (res && res.success) {
        setBackupStatus(`Cloud archive downloaded successfully!\nFile saved: ${res.path}`);
      } else {
        setBackupStatus('Export failed: ' + (res?.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Export error:', err);
      setBackupStatus('Error exporting laboratory data: ' + err.message);
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
            <h2 className="text-xl font-bold text-slate-800">Cloud Data Safety & Full Export</h2>
            <p className="text-xs text-slate-500">Continuous enterprise cloud backups with on-demand local data archive</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl border border-emerald-200 text-xs font-semibold">
          <ShieldCheck className="w-4 h-4" />
          <span>PostgreSQL Cloud Protected</span>
        </div>
      </div>

      {/* Main Actions Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Export Data Archive */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <Download className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Download Full Laboratory Archive</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Exports a complete snapshot of all patient registrations, diagnostic reports, test parameters, and clinic settings for <strong>{tenant?.name || 'Your Lab'}</strong> as an authentic JSON archive.
              </p>
            </div>

            <div className="p-3 bg-sky-50/60 rounded-xl border border-sky-100 text-[11px] text-sky-900 space-y-1">
              <p className="font-semibold">Local Redundancy & Compliance:</p>
              <p>Keep monthly downloaded archives on external drives or office computers for total data sovereignty.</p>
            </div>
          </div>

          <div>
            {backupStatus && (
              <div className="p-3 mb-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono text-slate-700 whitespace-pre-wrap">
                {backupStatus}
              </div>
            )}

            <button
              onClick={handleExportData}
              disabled={processing}
              className="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-600/20 transition active:scale-98 flex items-center justify-center gap-2"
            >
              <HardDrive className="w-4 h-4" />
              <span>{processing ? 'Exporting Laboratory Archive...' : 'Download Laboratory Archive (.json)'}</span>
            </button>
          </div>
        </div>

        {/* Cloud High Availability & Disaster Recovery */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Automated Cloud Redundancy</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Your diagnostic laboratory records are continuously safeguarded on Supabase PostgreSQL enterprise infrastructure.
              </p>
            </div>

            <div className="space-y-2 text-xs text-slate-600 pt-1">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Automated daily WAL snapshot backups</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Zero computer crash loss — data stored in cloud</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Multi-tenant Row-Level Security (RLS) isolation</span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 font-semibold flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Continuous Realtime Replication Active</span>
          </div>
        </div>
      </div>

      {/* Cloud Architecture Notice */}
      <div className="bg-slate-100/80 border border-slate-200/80 rounded-2xl p-5 text-xs text-slate-600 space-y-2">
        <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
          Enterprise Cloud Multi-Tenant Architecture
        </h4>
        <p className="leading-relaxed">
          In SaaS Version 2.0, all diagnostic lab data is securely hosted on Supabase PostgreSQL with strict Row Level Security. Hard drive failures, Windows corruptions, or malware on your local computers will never destroy your patient medical history.
        </p>
      </div>
    </div>
  );
}
