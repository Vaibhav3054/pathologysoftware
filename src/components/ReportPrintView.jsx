import React, { useState, useEffect } from 'react';
import { 
  Printer, 
  Download, 
  ArrowLeft, 
  X, 
  Settings2, 
  FileCheck,
  CheckCircle2,
  Building2,
  Phone,
  FileText,
  IndianRupee,
  CreditCard,
  EyeOff,
  Check
} from 'lucide-react';
import { api } from '../services/api';

export default function ReportPrintView({ reportId, onBack, onEdit }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [settings, setSettings] = useState(null);
  const [hideHeaderForLetterhead, setHideHeaderForLetterhead] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // CHANGE 2: Payment Display Option for Print / PDF
  // Options: 'complete' | 'fully_paid' | 'total_only' | 'hidden'
  const [paymentPrintMode, setPaymentPrintMode] = useState('complete');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // 'print' or 'pdf'

  useEffect(() => {
    loadAll();
  }, [reportId]);

  const loadAll = async () => {
    try {
      setLoading(true);
      const repData = await api.getReportDetails(reportId);
      const sett = await api.getSettings();
      setData(repData);
      setSettings(sett);
      // Initialize letterhead preference from clinic settings
      setHideHeaderForLetterhead(sett.letterhead_mode === 'pad');
    } catch (err) {
      console.error('Failed to load report for print:', err);
    } finally {
      setLoading(false);
    }
  };

  // Open modal before printing or exporting
  const handlePrintClick = () => {
    setPendingAction('print');
    setShowPaymentModal(true);
  };

  const handleExportPDFClick = () => {
    setPendingAction('pdf');
    setShowPaymentModal(true);
  };

  // Execute print or export after modal confirmation
  const executeConfirmedAction = async () => {
    setShowPaymentModal(false);
    const action = pendingAction;
    setPendingAction(null);

    // Short timeout to ensure state update renders in DOM before Chromium print dialog captures page
    setTimeout(async () => {
      if (action === 'print') {
        try {
          await api.printReport();
        } catch (err) {
          console.error('Print error:', err);
          window.print();
        }
      } else if (action === 'pdf') {
        try {
          setIsExporting(true);
          const patientName = data?.report?.patient_name ? data.report.patient_name.replace(/[^a-zA-Z0-9]/g, '_') : 'Patient';
          const defaultName = `${data?.report?.report_number || 'Report'}_${patientName}.pdf`;
          const res = await api.exportPDF(defaultName);
          if (res && res.filePath) {
            alert(`Report successfully exported to:\n${res.filePath}`);
          }
        } catch (err) {
          console.error('Export PDF error:', err);
          alert('Failed to export PDF: ' + err.message);
        } finally {
          setIsExporting(false);
        }
      }
    }, 150);
  };

  if (loading || !data || !settings) {
    return (
      <div className="p-12 text-center text-slate-400">
        Preparing A4 report preview...
      </div>
    );
  }

  const { report, services, testResults, xrayResults } = data;

  return (
    <div className="space-y-6 pb-24">
      {/* Top Floating Action Header (Hidden during physical printing) */}
      <div className="no-print max-w-4xl mx-auto bg-white p-4 rounded-2xl border border-slate-200/80 shadow-md flex flex-wrap items-center justify-between gap-4 sticky top-4 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <span className="font-mono font-bold text-sky-800 text-sm">{report.report_number}</span>
            <span className="text-slate-500 text-xs ml-2">— A4 Print Preview</span>
          </div>
        </div>

        {/* Print Configuration Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Quick Payment Display Selector on Preview Bar */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs text-slate-700">
            <span className="text-[11px] text-slate-400 font-semibold uppercase">Print Payment:</span>
            <select
              value={paymentPrintMode}
              onChange={(e) => setPaymentPrintMode(e.target.value)}
              className="bg-transparent font-semibold text-slate-800 outline-none cursor-pointer text-xs"
            >
              <option value="complete">Complete Payment Info</option>
              <option value="fully_paid">Show as Fully Paid</option>
              <option value="total_only">Show Only Total Amount</option>
              <option value="hidden">Hide All Payment Details</option>
            </select>
          </div>

          {/* Letterhead Mode Toggle */}
          <label className="flex items-center gap-2 cursor-pointer bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-100 select-none">
            <input
              type="checkbox"
              checked={hideHeaderForLetterhead}
              onChange={(e) => setHideHeaderForLetterhead(e.target.checked)}
              className="rounded text-sky-600 focus:ring-sky-500"
            />
            <span>Skip Header (Pad)</span>
          </label>

          <button
            onClick={onEdit}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
          >
            Edit Results
          </button>

          <button
            onClick={handleExportPDFClick}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold shadow-sm transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Exporting...' : 'Export PDF'}</span>
          </button>

          <button
            onClick={handlePrintClick}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-600/30 transition active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>🖨 Print A4 Report</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          AUTHENTIC A4 REPORT DOCUMENT (PREVIEW & PRINT CONTAINER)
          Standard A4 width: 210mm (~794px at 96 DPI screen preview)
          CHANGE 1: Uses standard block layout so pagination and footer/signature 
          never get clipped or overflow outside printable page area.
          ========================================================================= */}
      <div className="report-page-container max-w-[210mm] min-h-[297mm] mx-auto bg-white border border-slate-300 shadow-xl print:shadow-none print:border-none p-8 md:p-12 text-slate-900 leading-normal block">
        
        {/* SECTION A: CLINIC HEADER (SUPPRESSED IF USING PRE-PRINTED LETTERHEAD PAD) */}
        {hideHeaderForLetterhead ? (
          <div style={{ height: `${settings.letterhead_top_margin || 35}mm` }} className="no-print:border-b no-print:border-dashed no-print:border-slate-300 no-print:flex no-print:items-center no-print:justify-center no-print:text-xs no-print:text-slate-400">
            <span className="no-print">[ Pre-printed Letterhead Pad Space: {settings.letterhead_top_margin || 35}mm ]</span>
          </div>
        ) : (
          <header className="border-b-2 border-sky-900 pb-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {(settings.logo_url || settings.logo_path) ? (
                  <img
                    src={settings.logo_url || settings.logo_path}
                    alt="Logo"
                    className="w-16 h-16 object-contain rounded-lg"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-sky-900 text-white flex items-center justify-center font-bold text-2xl shadow">
                    {settings.clinic_name ? settings.clinic_name.substring(0, 2).toUpperCase() : 'PL'}
                  </div>
                )}
                <div>
                  <h1 className="text-2xl font-black text-sky-950 tracking-tight leading-tight uppercase font-sans">
                    {settings.clinic_name || 'PATHOLOGY & DIAGNOSTIC LABORATORY'}
                  </h1>
                  <p className="text-xs font-bold text-sky-700 tracking-wide mt-0.5 uppercase">
                    {settings.tagline || 'Diagnostic & Clinical Centre'}
                  </p>
                  <p className="text-[11px] text-slate-600 font-medium mt-1">
                    {settings.address || 'Diagnostic Centre Address / City'}
                  </p>
                  <p className="text-[11px] text-slate-600 font-medium">
                    Phone: <span className="font-bold">{settings.phone || '+91 98765 43210'}</span>
                    {settings.reg_no && <span> • Reg. No: <span className="font-semibold">{settings.reg_no}</span></span>}
                  </p>
                </div>
              </div>

              <div className="text-right border-l-2 border-slate-200 pl-4 text-xs space-y-1">
                <div className="font-bold text-sky-900 uppercase tracking-wider text-[11px]">DIAGNOSTIC REPORT</div>
                <div className="font-mono text-xs font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-800">
                  {report.report_number}
                </div>
                <div className="text-[10px] text-slate-500 font-medium">
                  {report.registration_date}
                </div>
              </div>
            </div>
          </header>
        )}

        {/* SECTION B: PATIENT DEMOGRAPHICS BAR */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-5 text-xs text-slate-800 avoid-break-inside">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-2 gap-x-4">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Patient Name</span>
              <span className="font-bold text-sm text-slate-900">{report.patient_name}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Age / Gender</span>
              <span className="font-semibold">{report.patient_age} Yrs / {report.patient_gender}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Phone Number</span>
              <span className="font-mono font-medium">{report.patient_phone}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Report Number</span>
              <span className="font-mono font-bold text-sky-900">{report.report_number}</span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Referred By</span>
              <span className="font-semibold text-sky-950">{report.doctor_name || 'Self / Direct'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Reg Date & Time</span>
              <span className="font-medium">{report.registration_date} • {report.registration_time}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Report Status</span>
              <span className="font-bold text-slate-800 uppercase text-[11px]">{report.status}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Centre</span>
              <span className="font-medium">{settings.clinic_name || 'Diagnostic Laboratory Centre'}</span>
            </div>
          </div>
        </div>

        {/* SECTION C: BLOOD TEST RESULTS */}
        {testResults.length > 0 && (
          <div className="mb-6 space-y-5">
            {testResults.map((test) => (
              <div key={test.testId} className="avoid-break-inside">
                {/* Test Category Header */}
                <div className="bg-sky-900 text-white px-3 py-1 rounded-t text-xs font-bold tracking-wider uppercase flex items-center justify-between">
                  <span>{test.testName}</span>
                  <span className="text-[10px] font-normal text-sky-200">Clinical Pathology</span>
                </div>

                {/* Results Table */}
                <table className="w-full text-left text-xs border border-slate-200 border-t-0">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-1.5 px-3 w-[40%]">Test Parameter</th>
                      <th className="py-1.5 px-3 w-[20%] text-center">Observed Result</th>
                      <th className="py-1.5 px-3 w-[15%]">Unit</th>
                      <th className="py-1.5 px-3 w-[25%]">Biological Reference Range</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {test.parameters.map((param) => {
                      const isAbnormal = param.is_abnormal === 1;
                      return (
                        <tr key={param.id} className={isAbnormal ? 'bg-rose-50/50' : ''}>
                          <td className="py-1.5 px-3 font-medium text-slate-800">
                            {param.parameter_name}
                          </td>
                          <td className={`py-1.5 px-3 text-center ${
                            isAbnormal ? 'font-bold text-rose-700 text-sm' : 'font-semibold text-slate-900'
                          }`}>
                            {param.result || '—'}
                            {isAbnormal && <span className="ml-1 text-[10px] text-rose-600 font-bold">*</span>}
                          </td>
                          <td className="py-1.5 px-3 font-mono text-slate-600 text-[11px]">
                            {param.unit || '—'}
                          </td>
                          <td className="py-1.5 px-3 text-slate-600 text-[11px]">
                            {param.normal_range || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        {/* SECTION D: X-RAY REPORTS */}
        {xrayResults.length > 0 && (
          <div className="mb-6 space-y-4">
            {xrayResults.map(xray => (
              <div key={xray.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50/40 avoid-break-inside">
                <div className="border-b border-slate-200 pb-1.5 mb-3 flex items-center justify-between">
                  <h3 className="font-bold text-sky-950 text-xs uppercase tracking-wider">
                    DEPARTMENT OF RADIOLOGY: {xray.xray_name}
                  </h3>
                  <span className="text-[10px] font-semibold text-slate-500">Plain Radiograph</span>
                </div>

                <div className="space-y-3 text-xs leading-relaxed">
                  <div>
                    <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wide text-sky-900">
                      Radiological Findings:
                    </h4>
                    <p className="text-slate-800 whitespace-pre-wrap mt-0.5 pl-2">
                      {xray.findings || 'No bony or soft tissue abnormality detected. Normal study.'}
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wide text-sky-900">
                      Impression:
                    </h4>
                    <p className="font-bold text-slate-900 whitespace-pre-wrap mt-0.5 pl-2">
                      {xray.impression || 'Normal radiological appearance.'}
                    </p>
                  </div>

                  {xray.remarks && (
                    <div className="text-[11px] text-slate-600 pt-1 border-t border-slate-200">
                      <strong>Advice / Remarks: </strong> {xray.remarks}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* SECTION E: CHARGES & BILLING STATEMENT (CONTROLLED BY PRINT PAYMENT DISPLAY OPTION) */}
        {paymentPrintMode !== 'hidden' && (
          <div className="avoid-break-inside border border-slate-300 rounded-lg p-3 bg-slate-50/60 mb-6 text-xs">
            <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px] border-b border-slate-200 pb-1 mb-2 flex items-center justify-between">
              <span>Test Charges & Payment Summary</span>
              <span className="text-[10px] font-medium text-slate-500">Official Receipt</span>
            </div>

            {/* Individual Services & Charges Table */}
            <table className="w-full text-left mb-2">
              <thead>
                <tr className="text-[10px] text-slate-500 uppercase border-b border-slate-200">
                  <th className="py-1">Service / Test Description</th>
                  <th className="py-1 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {services.map(s => (
                  <tr key={`bill-${s.id}`} className="text-slate-700">
                    <td className="py-1 font-medium">{s.service_name}</td>
                    <td className="py-1 text-right font-mono font-semibold">₹{s.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Billing Summary Cards depending on paymentPrintMode */}
            {paymentPrintMode === 'total_only' ? (
              // Option 2: Show Only Total Amount (Hides Paid, Pending, and Status)
              <div className="border-t-2 border-slate-300 pt-2 flex items-center justify-between text-xs font-semibold px-2 bg-white rounded border border-slate-200 py-2">
                <span className="text-xs uppercase text-slate-600 font-bold">Total Test Charges:</span>
                <span className="font-mono text-base text-slate-900 font-bold">₹{report.total_amount}</span>
              </div>
            ) : paymentPrintMode === 'fully_paid' ? (
              // Option 3: Show as Fully Paid (Displays Total, Paid = Total, Pending = ₹0, Status = Paid for this print only)
              <div className="border-t-2 border-slate-300 pt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-semibold">
                <div className="bg-white p-1.5 rounded border border-slate-200">
                  <span className="text-[10px] text-slate-500 block uppercase">Total Amount</span>
                  <span className="font-mono text-sm text-slate-900 font-bold">₹{report.total_amount}</span>
                </div>
                <div className="bg-white p-1.5 rounded border border-slate-200">
                  <span className="text-[10px] text-slate-500 block uppercase">Amount Paid</span>
                  <span className="font-mono text-sm text-emerald-700 font-bold">₹{report.total_amount}</span>
                </div>
                <div className="bg-white p-1.5 rounded border border-slate-200">
                  <span className="text-[10px] text-slate-500 block uppercase">Pending Due</span>
                  <span className="font-mono text-sm text-emerald-700 font-bold">₹0</span>
                </div>
                <div className="bg-white p-1.5 rounded border border-slate-200 flex flex-col justify-center">
                  <span className="text-[10px] text-slate-500 block uppercase">Payment Status</span>
                  <span className="text-xs font-bold uppercase text-emerald-700">
                    PAID
                  </span>
                </div>
              </div>
            ) : (
              // Option 1: Complete Actual Payment Information from DB
              <div className="border-t-2 border-slate-300 pt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-semibold">
                <div className="bg-white p-1.5 rounded border border-slate-200">
                  <span className="text-[10px] text-slate-500 block uppercase">Total Amount</span>
                  <span className="font-mono text-sm text-slate-900 font-bold">₹{report.total_amount}</span>
                </div>
                <div className="bg-white p-1.5 rounded border border-slate-200">
                  <span className="text-[10px] text-slate-500 block uppercase">Amount Paid</span>
                  <span className="font-mono text-sm text-emerald-700 font-bold">₹{report.paid_amount}</span>
                </div>
                <div className="bg-white p-1.5 rounded border border-slate-200">
                  <span className="text-[10px] text-slate-500 block uppercase">Pending Due</span>
                  <span className={`font-mono text-sm font-bold ${
                    parseFloat(report.pending_amount) > 0 ? 'text-rose-600' : 'text-emerald-700'
                  }`}>
                    ₹{report.pending_amount}
                  </span>
                </div>
                <div className="bg-white p-1.5 rounded border border-slate-200 flex flex-col justify-center">
                  <span className="text-[10px] text-slate-500 block uppercase">Payment Status</span>
                  <span className={`text-xs font-bold uppercase ${
                    report.payment_status === 'Paid' ? 'text-emerald-700' : 'text-amber-700'
                  }`}>
                    {report.payment_status}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            SECTION F: FOOTER & AUTHORIZED SIGNATORY (CHANGE 1 FIX)
            - break-inside: avoid / page-break-inside: avoid so signature is NEVER cut off
            - Extra padding and clear safe spacing ensure it fits cleanly on page or
              moves completely intact to the next page without clipping.
            ========================================================================= */}
        <footer className="report-footer-section avoid-break-inside pt-5 pb-2 mt-6 border-t-2 border-slate-300 text-xs">
          <div className="flex items-end justify-between gap-4">
            <div className="text-[10px] text-slate-500 space-y-0.5 max-w-[65%]">
              <p className="font-bold text-slate-800 text-[11px] leading-tight">{settings.clinic_name || 'Pathology & Diagnostic Centre'}</p>
              <p className="text-slate-600">{settings.address || 'Emergency & Routine Diagnostic Services'}</p>
              <p className="italic text-slate-500">* Biological reference ranges are clinical guidelines for medical interpretation.</p>
              <p className="font-mono text-[9px] text-slate-400">Generated on: {report.registration_date} • Electronic Diagnostic Record</p>
            </div>

            {/* Authorized Signatory Block (Guaranteed Never Cut Off) */}
            <div className="text-right flex flex-col items-end min-w-[210px] pb-1">
              {(settings.signature_url || settings.signatory_signature_path) ? (
                <div className="h-12 mb-1 flex items-end justify-end">
                  <img
                    src={settings.signature_url || settings.signatory_signature_path}
                    alt="Authorized Signature"
                    className="max-h-12 object-contain"
                  />
                </div>
              ) : (
                <div className="w-40 border-b border-dashed border-slate-500 h-8 mb-2" />
              )}
              <div className="font-bold text-slate-900 text-xs tracking-tight">{settings.signatory_name || 'Consultant Pathologist'}</div>
              <div className="text-[11px] text-slate-700 font-medium">{settings.signatory_degree || 'M.B.B.S., M.D. (Pathology)'}</div>
              <div className="text-[10px] text-sky-900 font-bold uppercase tracking-wider">{settings.signatory_designation || 'Consultant Pathologist'}</div>
            </div>
          </div>
        </footer>

      </div>

      {/* =========================================================================
          CHANGE 2: PAYMENT INFORMATION POPUP MODAL (PRINT REPORT MODAL)
          Appears when staff clicks "Print Report" or "Export PDF"
          ========================================================================= */}
      {showPaymentModal && (
        <div className="no-print fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-sky-900 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-300">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-wide">Payment Information for Printed Report</h3>
                  <p className="text-[11px] text-sky-200/80">Choose how payment details should appear on the printed copy</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setShowPaymentModal(false);
                  setPendingAction(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content / Options List */}
            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-500">
                This choice affects <strong>only this printed report / PDF</strong>. The actual database payment records will remain unchanged.
              </p>

              {/* Option 1: Complete Payment Information */}
              <label 
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer select-none transition ${
                  paymentPrintMode === 'complete' 
                    ? 'bg-sky-50/80 border-sky-500 ring-1 ring-sky-500' 
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="modal_payment_mode"
                  value="complete"
                  checked={paymentPrintMode === 'complete'}
                  onChange={() => setPaymentPrintMode('complete')}
                  className="mt-0.5 text-sky-600 focus:ring-sky-500"
                />
                <div className="flex-1 text-xs">
                  <span className="font-bold text-slate-900 block text-xs">
                    1. Show Complete Payment Information
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5 block leading-relaxed">
                    Prints individual test charges, Total Amount (₹{report.total_amount}), Paid Amount (₹{report.paid_amount}), Pending Due (₹{report.pending_amount}), and Payment Status ({report.payment_status}).
                  </span>
                </div>
              </label>

              {/* Option 2: Show as Fully Paid */}
              <label 
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer select-none transition ${
                  paymentPrintMode === 'fully_paid' 
                    ? 'bg-emerald-50/80 border-emerald-500 ring-1 ring-emerald-500' 
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="modal_payment_mode"
                  value="fully_paid"
                  checked={paymentPrintMode === 'fully_paid'}
                  onChange={() => setPaymentPrintMode('fully_paid')}
                  className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="flex-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 block text-xs">
                      2. Show as Fully Paid
                    </span>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.2 rounded font-bold uppercase">
                      Paid in Full
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 mt-0.5 block leading-relaxed">
                    Prints receipt showing Total (₹{report.total_amount}), Paid = ₹{report.total_amount}, Pending = ₹0, and Status: "PAID" on the printed report. (Leaves saved database record untouched).
                  </span>
                </div>
              </label>

              {/* Option 3: Show Only Total Amount */}
              <label 
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer select-none transition ${
                  paymentPrintMode === 'total_only' 
                    ? 'bg-sky-50/80 border-sky-500 ring-1 ring-sky-500' 
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="modal_payment_mode"
                  value="total_only"
                  checked={paymentPrintMode === 'total_only'}
                  onChange={() => setPaymentPrintMode('total_only')}
                  className="mt-0.5 text-sky-600 focus:ring-sky-500"
                />
                <div className="flex-1 text-xs">
                  <span className="font-bold text-slate-900 block text-xs">
                    3. Show Only Total Amount
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5 block leading-relaxed">
                    Prints individual test charges and Total Amount (₹{report.total_amount}). Completely hides Paid Amount, Pending Due, and Payment Status.
                  </span>
                </div>
              </label>

              {/* Option 4: Hide All Payment Details */}
              <label 
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer select-none transition ${
                  paymentPrintMode === 'hidden' 
                    ? 'bg-sky-50/80 border-sky-500 ring-1 ring-sky-500' 
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="modal_payment_mode"
                  value="hidden"
                  checked={paymentPrintMode === 'hidden'}
                  onChange={() => setPaymentPrintMode('hidden')}
                  className="mt-0.5 text-sky-600 focus:ring-sky-500"
                />
                <div className="flex-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 block text-xs">
                      4. Hide All Payment Details
                    </span>
                    <span className="bg-slate-100 text-slate-700 text-[10px] px-1.5 py-0.2 rounded font-bold uppercase">
                      Pure Report
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 mt-0.5 block leading-relaxed">
                    Prints only the medical test results and X-ray report. Omits all billing tables, test prices, and payment details entirely.
                  </span>
                </div>
              </label>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowPaymentModal(false);
                  setPendingAction(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/70 transition"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={executeConfirmedAction}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-600/30 transition active:scale-95"
              >
                {pendingAction === 'pdf' ? (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Continue to Export PDF</span>
                  </>
                ) : (
                  <>
                    <Printer className="w-3.5 h-3.5" />
                    <span>Continue to Print</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
