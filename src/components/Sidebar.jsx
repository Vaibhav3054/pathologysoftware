import React from 'react';
import { 
  LayoutDashboard, 
  UserPlus, 
  Users, 
  FileText, 
  Microscope, 
  UserCheck, 
  Settings, 
  ShieldCheck,
  Activity,
  LogOut,
  Crown,
  KeyRound,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getRoleDisplayLabel } from '../config/permissions';

export default function Sidebar({ currentView, setCurrentView, isOpen = false, onClose, onOpenChangePassword }) {
  const { profile, tenant, tenantSettings, signOut, isSuperAdmin, canAccessView, isTrial, getTrialDaysRemaining } = useAuth();

  const allMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'new-entry', label: 'New Entry', icon: UserPlus, highlight: true },
    { id: 'patients', label: 'Patients', icon: Users },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'tests', label: 'Tests & X-Rays', icon: Microscope },
    { id: 'doctors', label: 'Reference Doctors', icon: UserCheck },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const menuItems = allMenuItems.filter((item) => canAccessView(item.id));

  if (isSuperAdmin) {
    menuItems.unshift({
      id: 'super-admin',
      label: 'SaaS Admin Portal',
      icon: Crown,
      superBadge: true,
    });
  }

  const labName = tenantSettings?.clinic_name || tenant?.name || 'DIAGNOSTIC CENTRE';
  const labLogo = tenantSettings?.logo_url;

  const handleSelectView = (viewId, extra) => {
    setCurrentView(viewId, extra);
    if (onClose) onClose();
  };

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full bg-slate-900 text-slate-200 select-none">
      <div className="overflow-y-auto flex-1">
        {/* Lab Branding Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            {labLogo ? (
              <img
                src={labLogo}
                alt="Logo"
                className="w-10 h-10 rounded-lg object-contain bg-white p-0.5 shadow-md shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-sky-600 flex items-center justify-center text-white shadow-md shadow-sky-600/30 shrink-0">
                <Activity className="w-6 h-6 stroke-[2.2]" />
              </div>
            )}
            <div className="overflow-hidden min-w-0">
              <h1 className="text-sm font-bold tracking-tight text-white leading-tight truncate" title={labName}>
                {labName}
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className="text-[10px] font-semibold text-sky-400 tracking-wider uppercase">
                  {getRoleDisplayLabel(profile?.role)}
                </span>
                {tenant?.is_test_lab && (
                  <span className="bg-indigo-500/30 text-indigo-300 text-[9px] px-1 rounded font-bold">Demo</span>
                )}
                {isTrial && (
                  <span className="bg-emerald-500/30 text-emerald-300 text-[9px] px-1 rounded font-bold">
                    {getTrialDaysRemaining()}d Trial
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Drawer Close Button */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition shrink-0"
              aria-label="Close navigation menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
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
                  onClick={() => handleSelectView(item.id)}
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

            if (item.superBadge) {
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectView(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                    isActive
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-sm'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 text-amber-400" />
                    <span>{item.label}</span>
                  </div>
                  <span className="text-[9px] bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded font-black uppercase">
                    Admin
                  </span>
                </button>
              );
            }

            return (
              <button
                key={item.id}
                onClick={() => handleSelectView(item.id)}
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

      {/* Footer Info & Sign Out */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 text-xs space-y-2.5 shrink-0">
        <div className="flex items-center justify-between text-slate-400">
          <div className="flex items-center gap-1.5 text-emerald-400 font-medium text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Cloud Supabase RLS</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">v2.0 SaaS</span>
        </div>

        <button
          onClick={() => {
            if (onOpenChangePassword) onOpenChangePassword();
            if (onClose) onClose();
          }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white transition text-xs font-medium border border-slate-700/60"
        >
          <KeyRound className="w-3.5 h-3.5 text-sky-400" />
          <span>Change Password</span>
        </button>

        <button
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-slate-800/80 hover:bg-rose-900/40 text-slate-300 hover:text-rose-300 transition text-xs font-semibold border border-slate-700/60"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>

        <div className="pt-1 text-center text-[10px] text-slate-500 flex items-center justify-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => handleSelectView('legal', 'terms')}
            className="hover:text-slate-300 transition"
          >
            Terms
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={() => handleSelectView('legal', 'privacy')}
            className="hover:text-slate-300 transition"
          >
            Privacy
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={() => handleSelectView('legal', 'refund')}
            className="hover:text-slate-300 transition"
          >
            Refund Policy
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Docked Sidebar */}
      <aside className="no-print hidden lg:flex w-64 bg-slate-900 flex-col shrink-0 shadow-xl border-r border-slate-800 h-full">
        {sidebarContent}
      </aside>

      {/* Mobile / Tablet Slide-out Drawer */}
      {isOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <aside className="relative w-72 max-w-[82vw] h-full bg-slate-900 shadow-2xl border-r border-slate-800 z-10 flex flex-col">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
