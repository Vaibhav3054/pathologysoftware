import React, { useState, useEffect } from 'react';
import { 
  Users, 
  FileText, 
  Clock, 
  UserPlus, 
  Search, 
  IndianRupee, 
  ArrowRight, 
  Printer, 
  Eye, 
  Edit3,
  Calendar,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PERMISSIONS } from '../config/permissions';

export default function Dashboard({ setCurrentView, onViewReport, onEditReport }) {
  const { tenant, tenantSettings, isTrial, getTrialDaysRemaining, hasPermission } = useAuth();
  const canManageSubscription = hasPermission(PERMISSIONS.MANAGE_SUBSCRIPTION);
  const [stats, setStats] = useState({
    patientsToday: 0,
    reportsToday: 0,
    pendingPayments: 0,
    completedReports: 0,
    recentReports: []
  });
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await api.getDashboardStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load dashboard statistics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const todayFormatted = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome */}
      <div className="bg-gradient-to-r from-sky-800 to-sky-950 text-white rounded-2xl p-6 shadow-md relative overflow-hidden flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sky-200 text-xs font-semibold uppercase tracking-wider mb-1">
            <Calendar className="w-3.5 h-3.5" />
            <span>{todayFormatted}</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">
            {tenantSettings?.clinic_name || tenant?.name || 'Diagnostic Laboratory Centre'}
          </h2>
          <p className="text-sm text-sky-200/90 mt-0.5">
            {tenantSettings?.address || tenantSettings?.tagline || 'Clinical Pathology & Diagnostic Centre'}
          </p>
        </div>

        {/* Quick Launch Buttons */}
        <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2.5 sm:gap-3 w-full md:w-auto">
          <button
            onClick={() => setCurrentView('new-entry')}
            className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-5 py-2.5 rounded-xl shadow-md transition-all active:scale-95 text-sm"
          >
            <UserPlus className="w-4 h-4 stroke-[2.5]" />
            <span>+ New Patient Entry</span>
          </button>
          <div className="grid grid-cols-2 sm:flex items-center gap-2.5">
            <button
              onClick={() => setCurrentView('reports')}
              className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-medium px-4 py-2.5 rounded-xl backdrop-blur-sm transition-all text-xs sm:text-sm border border-white/20"
            >
              <FileText className="w-4 h-4" />
              <span>View Reports</span>
            </button>
            <button
              onClick={() => setCurrentView('patients')}
              className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-medium px-4 py-2.5 rounded-xl backdrop-blur-sm transition-all text-xs sm:text-sm border border-white/20"
            >
              <Search className="w-4 h-4" />
              <span>Search Patient</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3-Day Free Trial Notice Banner */}
      {isTrial && (
        <div className="bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-300/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-800 text-xs">3-Day Free Trial Active</span>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {getTrialDaysRemaining()} day(s) left
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                You have full access to patient registrations, medical test results, and A4 report printing.
              </p>
            </div>
          </div>

          {canManageSubscription && (
            <button
              onClick={() => setCurrentView('settings-subscription')}
              className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-sm shrink-0 cursor-pointer text-center"
            >
              Upgrade to Full Plan
            </button>
          )}
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Patients Today</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats.patientsToday}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Registered today</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Reports Today</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats.reportsToday}</h3>
            <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Tests & X-Rays</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Payments</p>
            <h3 className="text-2xl font-bold text-amber-600 mt-1">₹{Number(stats.pendingPayments).toLocaleString('en-IN')}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Total uncollected dues</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <IndianRupee className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Completed Reports</p>
            <h3 className="text-2xl font-bold text-indigo-600 mt-1">{stats.completedReports}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Ready for print</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Recent Reports Table / Cards */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-slate-800 text-base">Recent Patient Reports</h3>
            <p className="text-xs text-slate-500">Latest patient registrations and clinical reports</p>
          </div>
          <button
            onClick={() => setCurrentView('reports')}
            className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1 hover:underline shrink-0"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading recent records...</div>
        ) : stats.recentReports.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <FileText className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-slate-600">No reports created yet today.</p>
            <button
              onClick={() => setCurrentView('new-entry')}
              className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white font-medium px-4 py-2 rounded-lg text-xs"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Register First Patient</span>
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/80 text-slate-600 text-xs font-semibold uppercase tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4">Report No</th>
                    <th className="py-3 px-4">Patient</th>
                    <th className="py-3 px-4">Selected Services</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.recentReports.map((report) => (
                    <tr key={report.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-semibold text-sky-700">
                        {report.report_number}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{report.patient_name}</div>
                        <div className="text-xs text-slate-400">
                          {report.patient_age} Y / {report.patient_gender} • {report.patient_phone}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs truncate text-xs text-slate-600">
                        {report.services_summary || 'N/A'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          report.payment_status === 'Paid'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : report.payment_status === 'Partially Paid'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {report.payment_status} (₹{report.paid_amount}/{report.total_amount})
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium capitalize ${
                          report.status === 'completed'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {report.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => onViewReport(report.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-sky-600 hover:bg-sky-50 transition-colors"
                          title="View & Print A4 Report"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onEditReport(report.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                          title="Edit Results"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="block md:hidden divide-y divide-slate-100">
              {stats.recentReports.map((report) => (
                <div key={report.id} className="p-4 space-y-2.5 hover:bg-slate-50/50 transition">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono font-bold text-xs text-sky-700 block">
                        {report.report_number}
                      </span>
                      <div className="font-bold text-slate-900 text-sm mt-0.5">{report.patient_name}</div>
                      <div className="text-[11px] text-slate-500">
                        {report.patient_age} Y / {report.patient_gender} • {report.patient_phone}
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                      report.status === 'completed'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {report.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                    {report.services_summary || 'N/A'}
                  </p>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                      report.payment_status === 'Paid'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : report.payment_status === 'Partially Paid'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {report.payment_status} (₹{report.paid_amount}/{report.total_amount})
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onViewReport(report.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700 font-semibold text-xs border border-sky-200 active:scale-95"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </button>
                      <button
                        onClick={() => onEditReport(report.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 font-semibold text-xs border border-amber-200 active:scale-95"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
