import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Eye, 
  Edit3, 
  Printer, 
  UserPlus, 
  Calendar, 
  Phone, 
  Clock, 
  FileText,
  ChevronRight
} from 'lucide-react';
import { api } from '../services/api';

export default function PatientsView({ onViewReport, onEditReport, onNewEntryForPatient }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientHistory, setPatientHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    handleSearch('');
  }, []);

  const handleSearch = async (query) => {
    try {
      setLoading(true);
      const res = await api.searchPatients(query);
      setPatients(res);
      if (res.length > 0 && !selectedPatient) {
        selectPatient(res[0]);
      }
    } catch (err) {
      console.error('Search patients error:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectPatient = async (patient) => {
    setSelectedPatient(patient);
    try {
      setHistoryLoading(true);
      const history = await api.getPatientHistory(patient.id);
      setPatientHistory(history);
    } catch (err) {
      console.error('Error fetching patient history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Patients & Clinical History</h2>
            <p className="text-xs text-slate-500">Lookup patient records and trace complete diagnostic report history</p>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Search by Patient Name or Phone..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              handleSearch(e.target.value);
            }}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>
      </div>

      {/* Main Split Layout: Patient Directory on left, History on right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Patients List */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col h-[650px]">
          <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
              Directory ({patients.length})
            </h3>
            <span className="text-[11px] text-slate-500">Click to inspect</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loading ? (
              <div className="p-8 text-center text-slate-400 text-xs">Searching patients...</div>
            ) : patients.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs space-y-2">
                <Users className="w-8 h-8 mx-auto text-slate-300" />
                <p>No patients matched your search.</p>
              </div>
            ) : (
              patients.map(p => {
                const isSelected = selectedPatient?.id === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => selectPatient(p)}
                    className={`p-3.5 cursor-pointer select-none transition flex items-center justify-between ${
                      isSelected
                        ? 'bg-sky-50/80 border-l-4 border-sky-600 pl-2.5'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <h4 className="font-bold text-slate-800 text-xs">{p.name}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {p.age} Yrs • {p.gender}
                      </p>
                      <p className="text-[10px] font-mono text-slate-400 mt-0.5">{p.phone}</p>
                    </div>
                    <ChevronRight className={`w-4 h-4 ${isSelected ? 'text-sky-600' : 'text-slate-300'}`} />
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Selected Patient Profile & Clinical Report History */}
        <div className="lg:col-span-2 space-y-6">
          {selectedPatient ? (
            <>
              {/* Patient Profile Card */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-sky-600/20">
                    {selectedPatient.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{selectedPatient.name}</h3>
                    <p className="text-xs text-slate-500">
                      Age: <strong className="text-slate-700">{selectedPatient.age} Years</strong> • Gender: <strong className="text-slate-700">{selectedPatient.gender}</strong>
                    </p>
                    <p className="text-xs font-mono text-sky-700 mt-0.5">
                      Phone: <strong>{selectedPatient.phone}</strong>
                    </p>
                  </div>
                </div>

                {/* Quick Action: New Registration for this returning patient */}
                <button
                  onClick={() => onNewEntryForPatient(selectedPatient)}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-xl text-xs shadow-sm transition active:scale-95"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ New Test for Patient</span>
                </button>
              </div>

              {/* History Timeline / Table */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-sky-600" />
                    <h4 className="font-bold text-slate-800 text-sm">Past Reports History</h4>
                  </div>
                  <span className="text-xs font-semibold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full">
                    {patientHistory.length} Previous Visit{patientHistory.length === 1 ? '' : 's'}
                  </span>
                </div>

                {historyLoading ? (
                  <div className="p-8 text-center text-slate-400 text-xs">Loading report history...</div>
                ) : patientHistory.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-xs space-y-2">
                    <Clock className="w-8 h-8 mx-auto text-slate-300" />
                    <p>No diagnostic reports registered for this patient yet.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-100">
                        <tr>
                          <th className="py-3 px-4">Report No</th>
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Diagnostic Services</th>
                          <th className="py-3 px-4">Payment</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {patientHistory.map(rep => (
                          <tr key={rep.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3.5 px-4 font-mono font-bold text-sky-700">
                              {rep.report_number}
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                              {rep.registration_date}
                            </td>
                            <td className="py-3.5 px-4 max-w-xs truncate text-slate-700 font-medium">
                              {rep.services_summary || 'N/A'}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                rep.payment_status === 'Paid'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}>
                                {rep.payment_status} (₹{rep.paid_amount}/{rep.total_amount})
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold capitalize ${
                                rep.status === 'completed' ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {rep.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right space-x-1 whitespace-nowrap">
                              <button
                                onClick={() => onViewReport(rep.id)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-sky-600 hover:bg-sky-50 transition"
                                title="View & Print Report"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => onEditReport(rep.id)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition"
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
                )}
              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-slate-400 text-sm">
              Select a patient from the list on the left to view profile and previous reports.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
