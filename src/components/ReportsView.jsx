import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Search, 
  Eye, 
  Edit3, 
  Printer, 
  Filter, 
  Calendar, 
  IndianRupee,
  Plus,
  RefreshCw
} from 'lucide-react';
import { api } from '../services/api';

export default function ReportsView({ onViewReport, onEditReport, onNewEntry }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    loadReports();
  }, [search, statusFilter, paymentFilter, dateFilter]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const list = await api.getReportsList({
        search,
        status: statusFilter,
        paymentStatus: paymentFilter,
        date: dateFilter
      });
      setReports(list);
    } catch (err) {
      console.error('Failed to load reports list:', err);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setPaymentFilter('all');
    setDateFilter('');
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Diagnostic Reports Register</h2>
            <p className="text-xs text-slate-500">Manage, filter, edit and print patient diagnostic test and X-ray records</p>
          </div>
        </div>

        <button
          onClick={onNewEntry}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2.5 rounded-xl text-xs shadow-md shadow-emerald-600/20 transition active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>+ New Registration</span>
        </button>
      </div>

      {/* Search & Filters Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-center">
          {/* Search Input */}
          <div className="lg:col-span-2 relative">
            <input
              type="text"
              placeholder="Search by Report No, Patient Name or Phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-sky-500 transition"
            >
              <option value="all">Report Status: All</option>
              <option value="draft">Draft</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {/* Payment Status Filter */}
          <div>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-sky-500 transition"
            >
              <option value="all">Payment: All</option>
              <option value="Paid">Paid</option>
              <option value="Partially Paid">Partially Paid</option>
              <option value="Pending">Pending</option>
            </select>
          </div>

          {/* Date Filter & Clear */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-sky-500"
            />
            {(search || statusFilter !== 'all' || paymentFilter !== 'all' || dateFilter) && (
              <button
                onClick={clearFilters}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                title="Reset filters"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Reports Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Loading reports register...</div>
        ) : reports.length === 0 ? (
          <div className="p-16 text-center text-slate-400 space-y-3">
            <FileText className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-sm font-medium text-slate-600">No reports matched your search or filters.</p>
            <button
              onClick={clearFilters}
              className="text-xs font-semibold text-sky-600 hover:underline"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Reports Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-600 uppercase font-semibold text-[11px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Report Number</th>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Patient Name</th>
                    <th className="py-3 px-4">Phone Number</th>
                    <th className="py-3 px-4">Selected Services</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reports.map((rep) => (
                    <tr key={rep.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-sky-800">
                        {rep.report_number}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-500">
                        <div>{rep.registration_date}</div>
                        <div className="text-[10px] text-slate-400">{rep.registration_time}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{rep.patient_name}</div>
                        <div className="text-[11px] text-slate-400">
                          {rep.patient_age} Y / {rep.patient_gender}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                        {rep.patient_phone}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs truncate text-slate-700 font-medium" title={rep.services_summary}>
                        {rep.services_summary || 'N/A'}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          rep.payment_status === 'Paid'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : rep.payment_status === 'Partially Paid'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {rep.payment_status} (₹{rep.paid_amount}/{rep.total_amount})
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold capitalize ${
                          rep.status === 'completed'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {rep.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => onViewReport(rep.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-sky-600 hover:bg-sky-50 transition"
                          title="View & Print A4 Report"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onEditReport(rep.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition"
                          title="Edit Medical Results"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Reports Cards */}
            <div className="block md:hidden divide-y divide-slate-100">
              {reports.map((rep) => (
                <div key={rep.id} className="p-4 space-y-3 hover:bg-slate-50/50 transition">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-sky-800">
                          {rep.report_number}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          • {rep.registration_date}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm mt-0.5">{rep.patient_name}</h4>
                      <div className="text-[11px] text-slate-500">
                        {rep.patient_age} Y / {rep.patient_gender} • <span className="font-mono">{rep.patient_phone}</span>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                      rep.status === 'completed'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {rep.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100 line-clamp-2">
                    {rep.services_summary || 'N/A'}
                  </p>

                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                      rep.payment_status === 'Paid'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : rep.payment_status === 'Partially Paid'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {rep.payment_status} (₹{rep.paid_amount}/{rep.total_amount})
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onViewReport(rep.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700 font-semibold text-xs border border-sky-200 active:scale-95"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View A4</span>
                      </button>
                      <button
                        onClick={() => onEditReport(rep.id)}
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
