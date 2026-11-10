import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Check, 
  Save, 
  Printer, 
  Download, 
  Eye, 
  ArrowLeft, 
  AlertTriangle,
  User,
  Calendar,
  IndianRupee,
  Activity,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { api } from '../services/api';

export default function ReportEntry({ reportId, onBack, onViewReport }) {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);
  const [services, setServices] = useState([]);
  const [testResults, setTestResults] = useState([]); // Array of { testId, testName, parameters: [...] }
  const [xrayResults, setXrayResults] = useState([]); // Array of { id, xray_id, xray_name, findings, impression, remarks }

  // Saving states
  const [saving, setSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  useEffect(() => {
    loadReport();
  }, [reportId]);

  const loadReport = async () => {
    try {
      setLoading(true);
      const data = await api.getReportDetails(reportId);
      if (data) {
        setReport(data.report);
        setServices(data.services);
        setTestResults(data.testResults);
        setXrayResults(data.xrayResults);
      }
    } catch (err) {
      console.error('Failed to load report data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Check if numeric result is abnormal against min and max
  const checkIsAbnormal = (valStr, normalRangeStr) => {
    if (!valStr || valStr.trim() === '') return false;
    const num = parseFloat(valStr);
    if (isNaN(num)) {
      // Check for common positive/reactive text values
      const lower = valStr.toLowerCase().trim();
      if (lower.includes('positive') || lower.includes('reactive') || lower.includes('present')) {
        return true;
      }
      return false;
    }

    // Try parsing range like "13.0 - 17.0" or "4,000 - 11,000" or "< 200" or "> 40"
    if (!normalRangeStr) return false;
    const cleanRange = normalRangeStr.replace(/,/g, '');

    const lessMatch = cleanRange.match(/<\s*([0-9.]+)/);
    if (lessMatch) {
      const threshold = parseFloat(lessMatch[1]);
      return num >= threshold;
    }

    const greaterMatch = cleanRange.match(/>\s*([0-9.]+)/);
    if (greaterMatch) {
      const threshold = parseFloat(greaterMatch[1]);
      return num <= threshold;
    }

    const rangeMatch = cleanRange.match(/([0-9.]+)\s*[-–to]\s*([0-9.]+)/);
    if (rangeMatch) {
      const min = parseFloat(rangeMatch[1]);
      const max = parseFloat(rangeMatch[2]);
      return num < min || num > max;
    }

    return false;
  };

  // Handle Blood Test Result Change
  const handleTestResultChange = (testId, paramId, value) => {
    setTestResults(prevTests => {
      return prevTests.map(test => {
        if (test.testId !== testId) return test;
        return {
          ...test,
          parameters: test.parameters.map(p => {
            if (p.id !== paramId) return p;
            const isAbnormal = checkIsAbnormal(value, p.normal_range);
            return {
              ...p,
              result: value,
              is_abnormal: isAbnormal ? 1 : 0
            };
          })
        };
      });
    });
  };

  // Manual toggle for abnormal flag
  const toggleAbnormal = (testId, paramId) => {
    setTestResults(prevTests => {
      return prevTests.map(test => {
        if (test.testId !== testId) return test;
        return {
          ...test,
          parameters: test.parameters.map(p => {
            if (p.id !== paramId) return p;
            return {
              ...p,
              is_abnormal: p.is_abnormal ? 0 : 1
            };
          })
        };
      });
    });
  };

  // Handle X-Ray Field Change
  const handleXrayChange = (xrayRecordId, field, value) => {
    setXrayResults(prev => {
      return prev.map(item => {
        if (item.id !== xrayRecordId) return item;
        return { ...item, [field]: value };
      });
    });
  };

  // Save report data
  const handleSave = async (status = 'completed') => {
    try {
      setSaving(true);
      setSaveSuccessMsg('');

      // Flatten parameters
      const flattenedParams = [];
      testResults.forEach(t => {
        t.parameters.forEach(p => {
          flattenedParams.push({
            id: p.id,
            result: p.result,
            is_abnormal: p.is_abnormal
          });
        });
      });

      await api.saveReportMedicalData(reportId, flattenedParams, xrayResults, status);
      
      setReport(prev => ({ ...prev, status }));
      setSaveSuccessMsg(status === 'completed' ? 'Report saved and marked as COMPLETED!' : 'Draft saved safely.');
      setTimeout(() => setSaveSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Error saving report data:', err);
      alert('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !report) {
    return (
      <div className="p-12 text-center text-slate-400">
        Loading patient report details...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Top Action & Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
            title="Back to Reports"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-base text-sky-700">{report.report_number}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-semibold capitalize ${
                report.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                {report.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Enter medical test results, X-ray findings & print report</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave('draft')}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Save Draft</span>
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave('completed')}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Save Report</span>
          </button>

          <button
            type="button"
            onClick={() => onViewReport(report.id)}
            className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold shadow-sm transition"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Preview & Print A4</span>
          </button>
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Patient & Billing Summary Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
        <div className="space-y-1">
          <span className="text-slate-400 uppercase font-semibold text-[10px] tracking-wider block">Patient Details</span>
          <div className="font-bold text-slate-800 text-sm">{report.patient_name}</div>
          <div className="text-slate-500">{report.patient_age} Years / {report.patient_gender}</div>
          <div className="text-slate-500 font-mono">{report.patient_phone}</div>
        </div>

        <div className="space-y-1">
          <span className="text-slate-400 uppercase font-semibold text-[10px] tracking-wider block">Reference Doctor</span>
          <div className="font-semibold text-slate-800">{report.doctor_name || 'Self / Direct'}</div>
          <div className="text-slate-400">Acharya Diagnostic Centre</div>
        </div>

        <div className="space-y-1">
          <span className="text-slate-400 uppercase font-semibold text-[10px] tracking-wider block">Registration Info</span>
          <div className="font-semibold text-slate-700">{report.registration_date}</div>
          <div className="text-slate-500">{report.registration_time}</div>
        </div>

        <div className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
          <span className="text-slate-400 uppercase font-semibold text-[10px] tracking-wider block">Payment</span>
          <div className="flex items-center justify-between font-mono">
            <span className="text-slate-500">Total: ₹{report.total_amount}</span>
            <span className="font-bold text-emerald-700">Paid: ₹{report.paid_amount}</span>
          </div>
          <div className="font-semibold text-rose-600 font-mono">
            Pending Due: ₹{report.pending_amount}
          </div>
        </div>
      </div>

      {/* BLOOD TESTS RESULT ENTRY */}
      {testResults.length > 0 && (
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <span className="text-lg">🩸</span>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
              Laboratory Blood Test Results
            </h3>
          </div>

          {testResults.map(test => (
            <div key={test.testId} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="p-4 bg-slate-50/80 border-b border-slate-200/70 flex items-center justify-between">
                <h4 className="font-bold text-slate-800 text-sm">{test.testName}</h4>
                <span className="text-xs text-slate-500 font-medium">
                  {test.parameters.length} Parameters
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/60 text-slate-600 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200/60">
                    <tr>
                      <th className="py-2.5 px-4 w-1/3">Parameter Name</th>
                      <th className="py-2.5 px-4 w-1/4">Result</th>
                      <th className="py-2.5 px-4 w-1/6">Unit</th>
                      <th className="py-2.5 px-4 w-1/4">Normal Reference Range</th>
                      <th className="py-2.5 px-4 text-center">Abnormal?</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {test.parameters.map(param => (
                      <tr 
                        key={param.id} 
                        className={`hover:bg-slate-50/80 transition-colors ${
                          param.is_abnormal ? 'bg-rose-50/40' : ''
                        }`}
                      >
                        <td className="py-2.5 px-4 font-semibold text-slate-800">
                          {param.parameter_name}
                        </td>
                        <td className="py-2.5 px-4">
                          <input
                            type="text"
                            value={param.result || ''}
                            onChange={(e) => handleTestResultChange(test.testId, param.id, e.target.value)}
                            placeholder="Enter result"
                            className={`w-full px-3 py-1.5 rounded-lg border text-xs font-semibold transition outline-none ${
                              param.is_abnormal
                                ? 'border-rose-400 bg-rose-50/80 text-rose-800 focus:ring-2 focus:ring-rose-500 font-bold'
                                : 'border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-sky-500'
                            }`}
                          />
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-600">
                          {param.unit || '—'}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600 font-medium">
                          {param.normal_range || '—'}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => toggleAbnormal(test.testId, param.id)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition ${
                              param.is_abnormal
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                            }`}
                            title="Click to toggle abnormal flag"
                          >
                            {param.is_abnormal ? 'Abnormal' : 'Normal'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* X-RAY RESULTS ENTRY */}
      {xrayResults.length > 0 && (
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <span className="text-lg">🩻</span>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
              Radiology / X-Ray Findings & Reports
            </h3>
          </div>

          {xrayResults.map(xray => (
            <div key={xray.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
              <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-600" />
                  <span>{xray.xray_name}</span>
                </h4>
                <span className="text-[11px] font-medium text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                  X-Ray Report
                </span>
              </div>

              {/* Findings */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Findings
                </label>
                <textarea
                  rows={4}
                  value={xray.findings || ''}
                  onChange={(e) => handleXrayChange(xray.id, 'findings', e.target.value)}
                  placeholder="Enter radiological findings (e.g. Bone architecture is normal. No fracture or dislocation seen. Joint spaces are well preserved...)"
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs leading-relaxed focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                />
              </div>

              {/* Impression */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Impression
                </label>
                <textarea
                  rows={2}
                  value={xray.impression || ''}
                  onChange={(e) => handleXrayChange(xray.id, 'impression', e.target.value)}
                  placeholder="Enter overall radiological impression (e.g. Normal study / No significant bony abnormality detected.)"
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold leading-relaxed focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                />
              </div>

              {/* Remarks */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-500">
                  Remarks / Advice (Optional)
                </label>
                <input
                  type="text"
                  value={xray.remarks || ''}
                  onChange={(e) => handleXrayChange(xray.id, 'remarks', e.target.value)}
                  placeholder="e.g. Clinical correlation suggested."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bottom Sticky Action Bar */}
      <div className="sticky bottom-4 bg-slate-900/90 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-slate-800 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-300">
            Report Status: <strong className="text-white capitalize">{report.status}</strong>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave('draft')}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition"
          >
            Save Draft
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave('completed')}
            className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-md transition"
          >
            Save Completed
          </button>
          <button
            type="button"
            onClick={() => onViewReport(report.id)}
            className="px-5 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>
    </div>
  );
}
