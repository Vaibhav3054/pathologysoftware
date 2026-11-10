import React from 'react';
import { 
  LayoutDashboard, 
  UserPlus, 
  Users, 
  FileText, 
  Microscope, 
  UserCheck, 
  Settings, 
  Database,
  ShieldCheck,
  Activity
} from 'lucide-react';

export default function Sidebar({ currentView, setCurrentView }) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'new-entry', label: 'New Entry', icon: UserPlus, highlight: true },
    { id: 'patients', label: 'Patients', icon: Users },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'tests', label: 'Tests & X-Rays', icon: Microscope },
    { id: 'doctors', label: 'Reference Doctors', icon: UserCheck },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'backup', label: 'Backup', icon: Database },
  ];

  return (
    <aside className="no-print w-64 bg-slate-900 text-slate-200 flex flex-col justify-between shrink-0 select-none shadow-xl border-r border-slate-800">
      <div>
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sky-600 flex items-center justify-center text-white shadow-md shadow-sky-600/30">
              <Activity className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white leading-tight">ACHARYA</h1>
              <p className="text-xs font-semibold text-sky-400 tracking-wider">PATHOLOGY</p>
              <p className="text-[10px] text-slate-400">Silwani, Raisen, M.P.</p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1.5 mt-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            
            if (item.highlight) {
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentView(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-medium text-sm transition-all duration-150 shadow-md ${
                    isActive
                      ? 'bg-sky-500 text-white shadow-sky-500/30 scale-[1.01]'
                      : 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-600/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5" />
                    <span className="font-semibold">{item.label}</span>
                  </div>
                  <span className="bg-sky-400/40 text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                    + Reg
                  </span>
                </button>
              );
            }

            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-sky-400 font-semibold border-l-4 border-sky-400 pl-2.5 shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 text-xs space-y-2">
        <div className="flex items-center gap-2 text-emerald-400 font-medium">
          <ShieldCheck className="w-4 h-4" />
          <span>Offline SQLite Active</span>
        </div>
        <p className="text-[11px] text-slate-400">Acharya Pathology Desktop v1.0</p>
      </div>
    </aside>
  );
}
