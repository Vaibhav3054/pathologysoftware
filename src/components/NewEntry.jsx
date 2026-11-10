import React, { useState, useEffect } from 'react';
import { 
  UserPlus, 
  Search, 
  Check, 
  Plus, 
  X, 
  IndianRupee, 
  Activity, 
  ChevronRight, 
  RotateCcw,
  Sparkles,
  Phone,
  User,
  Calendar,
  Clock,
  HeartPulse
} from 'lucide-react';
import { api } from '../services/api';

export default function NewEntry({ onRegistrationComplete, prefilledPatient = null }) {
  // Form State
  const [reportNumber, setReportNumber] = useState('');
  const [registrationDate, setRegistrationDate] = useState('');
  const [registrationTime, setRegistrationTime] = useState('');

  // Patient Info
  const [patientId, setPatientId] = useState(prefilledPatient?.id || null);
  const [name, setName] = useState(prefilledPatient?.name || '');
  const [age, setAge] = useState(prefilledPatient?.age ? prefilledPatient.age.toString() : '');
  const [gender, setGender] = useState(prefilledPatient?.gender || 'Male');
  const [phone, setPhone] = useState(prefilledPatient?.phone || '');
  const [doctorName, setDoctorName] = useState('Self / Direct');
  const [doctorsList, setDoctorsList] = useState([]);
  const [showAddDoctorModal, setShowAddDoctorModal] = useState(false);
  const [newDoctorInput, setNewDoctorInput] = useState('');

  // Returning Patient Auto-suggest
  const [suggestedPatients, setSuggestedPatients] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Available Services
  const [bloodTests, setBloodTests] = useState([]);
  const [xrayServices, setXrayServices] = useState([]);
  const [bloodSearch, setBloodSearch] = useState('');
  const [xraySearch, setXraySearch] = useState('');

  // Selected Services: array of objects { id, name, category, price }
  const [selectedServices, setSelectedServices] = useState([]);

  // Billing & Payment
  const [paymentStatus, setPaymentStatus] = useState('Paid');
  const [paidAmount, setPaidAmount] = useState(0);

  // UI state
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Initialize data on component mount
  useEffect(() => {
    initForm();
  }, []);

  useEffect(() => {
    if (prefilledPatient) {
      setPatientId(prefilledPatient.id || null);
      setName(prefilledPatient.name || '');
      setAge(prefilledPatient.age ? prefilledPatient.age.toString() : '');
      setGender(prefilledPatient.gender || 'Male');
      setPhone(prefilledPatient.phone || '');
    }
  }, [prefilledPatient]);

  const initForm = async () => {
    try {
      const { reportNumber: nextNo } = await api.generateNextReportNumber();
      setReportNumber(nextNo);

      const now = new Date();
      setRegistrationDate(now.toISOString().split('T')[0]);
      setRegistrationTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }));

      const docs = await api.getDoctors();
      setDoctorsList(docs);
      if (docs.length > 0 && !doctorName) {
        setDoctorName(docs[0].name);
      }

      const tests = await api.getTests();
      setBloodTests(tests.filter(t => t.category === 'blood'));
      setXrayServices(tests.filter(t => t.category === 'xray'));
    } catch (err) {
      console.error('Error initializing New Entry:', err);
    }
  };

  // Live total calculation
  const totalAmount = selectedServices.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);

  // Calculate pending amount based on status and paid amount
  let calculatedPaid = 0;
  let calculatedPending = 0;

  if (paymentStatus === 'Paid') {
    calculatedPaid = totalAmount;
    calculatedPending = 0;
  } else if (paymentStatus === 'Pending') {
    calculatedPaid = 0;
    calculatedPending = totalAmount;
  } else {
    // Partially Paid
    calculatedPaid = Math.min(parseFloat(paidAmount) || 0, totalAmount);
    calculatedPending = Math.max(0, totalAmount - calculatedPaid);
  }

  // Handle Phone input and auto-suggestions
  const handlePhoneChange = async (val) => {
    setPhone(val);
    setPatientId(null);
    if (val.trim().length >= 3) {
      try {
        const matches = await api.searchPatients(val);
        setSuggestedPatients(matches);
        setShowSuggestions(matches.length > 0);
      } catch (err) {
        console.error('Suggestion search error:', err);
      }
    } else {
      setSuggestedPatients([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestedPatient = (p) => {
    setPatientId(p.id);
    setName(p.name);
    setAge(p.age.toString());
    setGender(p.gender);
    setPhone(p.phone);
    setShowSuggestions(false);
  };

  // Toggle service selection
  const toggleService = (service) => {
    const isSelected = selectedServices.some(s => s.id === service.id && s.category === service.category);
    if (isSelected) {
      setSelectedServices(selectedServices.filter(s => !(s.id === service.id && s.category === service.category)));
    } else {
      setSelectedServices([...selectedServices, service]);
    }
  };

  const isServiceSelected = (service) => {
    return selectedServices.some(s => s.id === service.id && s.category === service.category);
  };

  // Quick Add Doctor
  const handleAddDoctor = async (e) => {
    e.preventDefault();
    if (!newDoctorInput.trim()) return;
    try {
      await api.addDoctor(newDoctorInput.trim());
      const updatedDocs = await api.getDoctors();
      setDoctorsList(updatedDocs);
      setDoctorName(newDoctorInput.trim());
      setNewDoctorInput('');
      setShowAddDoctorModal(false);
    } catch (err) {
      alert('Doctor already exists or failed to save.');
    }
  };

  // Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('Patient Name is required.');
      return;
    }
    if (!age || parseInt(age) <= 0 || parseInt(age) > 130) {
      setErrorMsg('Please enter a valid age.');
      return;
    }
    if (!phone.trim()) {
      setErrorMsg('Phone Number is required.');
      return;
    }
    if (selectedServices.length === 0) {
      setErrorMsg('Please select at least one Blood Test or X-Ray service.');
      return;
    }

    try {
      setSaving(true);
      const res = await api.createRegistration({
        patientData: {
          id: patientId,
          name: name.trim(),
          age: parseInt(age),
          gender,
          phone: phone.trim(),
          doctor_name: doctorName
        },
        selectedServices,
        billingData: {
          total_amount: totalAmount,
          paid_amount: calculatedPaid,
          pending_amount: calculatedPending,
          payment_status: paymentStatus,
          notes: ''
        }
      });

      // Proceed immediately to report entry
      if (res && res.reportId) {
        onRegistrationComplete(res.reportId);
      }
    } catch (err) {
      console.error('Registration failed:', err);
      setErrorMsg('Failed to save registration: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Filtered lists
  const filteredBloodTests = bloodTests.filter(t => 
    t.name.toLowerCase().includes(bloodSearch.toLowerCase())
  );
  const filteredXrays = xrayServices.filter(t => 
    t.name.toLowerCase().includes(xraySearch.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Page Title & Number Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">New Patient Registration</h2>
            <p className="text-xs text-slate-500">Register patient, select diagnostic tests & calculate bill</p>
          </div>
        </div>

        {/* Auto Generated Report Info Box */}
        <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-xs">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Report Number</span>
            <span className="font-mono font-bold text-sm text-sky-700">{reportNumber || 'Generating...'}</span>
          </div>
          <div className="h-7 w-px bg-slate-200" />
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Date & Time</span>
            <span className="font-semibold text-slate-700">{registrationDate} • {registrationTime}</span>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')}><X className="w-4 h-4" /></button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECTION 1: PATIENT DETAILS */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
            <User className="w-4 h-4 text-sky-600" />
            <span>1. Patient Details</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Phone Number with Auto-suggest */}
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Phone Number <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="e.g. 9876543210"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:bg-white outline-none transition"
                />
                <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              </div>

              {/* Suggestions Dropdown for Returning Patients */}
              {showSuggestions && suggestedPatients.length > 0 && (
                <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden text-xs">
                  <div className="p-2 bg-sky-50 border-b border-sky-100 text-sky-800 font-semibold flex items-center justify-between">
                    <span>Returning Patients Found:</span>
                    <button type="button" onClick={() => setShowSuggestions(false)}><X className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {suggestedPatients.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectSuggestedPatient(p)}
                        className="w-full text-left p-2.5 hover:bg-slate-50 transition border-b border-slate-100 flex items-center justify-between"
                      >
                        <div>
                          <span className="font-bold text-slate-800">{p.name}</span>
                          <span className="text-slate-500 ml-2">({p.age} Y / {p.gender})</span>
                        </div>
                        <span className="text-[11px] font-mono text-sky-600">{p.phone}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Patient Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Patient Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full Name"
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:bg-white outline-none transition"
              />
            </div>

            {/* Age & Gender */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Age <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="125"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="Yrs"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:bg-white outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Gender
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:bg-white outline-none transition"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {/* Reference Doctor */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Ref Doctor
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddDoctorModal(true)}
                  className="text-[11px] text-sky-600 hover:text-sky-700 font-semibold flex items-center gap-0.5"
                >
                  <Plus className="w-3 h-3" />
                  <span>New Doctor</span>
                </button>
              </div>
              <select
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:bg-white outline-none transition"
              >
                {doctorsList.map((doc) => (
                  <option key={doc.id} value={doc.name}>
                    {doc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* SECTION 2: SERVICES SELECTION (BLOOD TESTS & X-RAYS) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 🩸 BLOOD TESTS */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col h-[420px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-lg">🩸</span>
                <h3 className="font-bold text-slate-800 text-sm">Blood Tests</h3>
              </div>
              <span className="text-xs bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full font-semibold">
                {bloodTests.length} Available
              </span>
            </div>

            {/* Search Bar */}
            <div className="relative my-3">
              <input
                type="text"
                placeholder="Search blood test (e.g. CBC, Sugar)..."
                value={bloodSearch}
                onChange={(e) => setBloodSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-rose-400 focus:bg-white transition"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>

            {/* Test Checklist */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {filteredBloodTests.map(test => {
                const selected = isServiceSelected(test);
                return (
                  <div
                    key={`blood-${test.id}`}
                    onClick={() => toggleService(test)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer select-none transition-all ${
                      selected
                        ? 'bg-rose-50/70 border-rose-300 text-slate-900 shadow-xs'
                        : 'bg-white hover:bg-slate-50 border-slate-200/70 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-4 h-4 rounded flex items-center justify-center border transition ${
                        selected ? 'bg-rose-600 border-rose-600 text-white' : 'border-slate-300 bg-white'
                      }`}>
                        {selected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className="font-medium">{test.name}</span>
                    </div>
                    <span className="font-semibold font-mono text-slate-700">₹{test.price}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 🩻 X-RAY SERVICES */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col h-[420px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-lg">🩻</span>
                <h3 className="font-bold text-slate-800 text-sm">X-Ray Services</h3>
              </div>
              <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">
                {xrayServices.length} Available
              </span>
            </div>

            {/* Search Bar */}
            <div className="relative my-3">
              <input
                type="text"
                placeholder="Search X-ray (e.g. Chest, Spine, Knee)..."
                value={xraySearch}
                onChange={(e) => setXraySearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>

            {/* X-Ray Checklist */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {filteredXrays.map(xray => {
                const selected = isServiceSelected(xray);
                return (
                  <div
                    key={`xray-${xray.id}`}
                    onClick={() => toggleService(xray)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer select-none transition-all ${
                      selected
                        ? 'bg-indigo-50/70 border-indigo-300 text-slate-900 shadow-xs'
                        : 'bg-white hover:bg-slate-50 border-slate-200/70 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-4 h-4 rounded flex items-center justify-center border transition ${
                        selected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                      }`}>
                        {selected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className="font-medium">{xray.name}</span>
                    </div>
                    <span className="font-semibold font-mono text-slate-700">₹{xray.price}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* SECTION 3: AUTOMATIC BILL CALCULATION & PAYMENT */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
            <IndianRupee className="w-4 h-4 text-sky-600" />
            <span>3. Billing Summary & Payment</span>
          </h3>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Selected Items Breakdown */}
            <div className="lg:col-span-2 space-y-3">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Selected Services ({selectedServices.length})
              </h4>

              {selectedServices.length === 0 ? (
                <div className="p-6 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-400">
                  No tests or X-rays selected yet. Select from the lists above.
                </div>
              ) : (
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 max-h-52 overflow-y-auto space-y-1.5 divide-y divide-slate-100">
                  {selectedServices.map((s, idx) => (
                    <div key={`${s.category}-${s.id}`} className="flex items-center justify-between text-xs pt-1.5 first:pt-0">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-mono w-4">{idx + 1}.</span>
                        <span className="font-medium text-slate-800">{s.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold uppercase ${
                          s.category === 'blood' ? 'bg-rose-100 text-rose-700' : 'bg-indigo-100 text-indigo-700'
                        }`}>
                          {s.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-semibold text-slate-700">₹{s.price}</span>
                        <button
                          type="button"
                          onClick={() => toggleService(s)}
                          className="text-slate-400 hover:text-rose-500"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payment Panel */}
            <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Total Bill</span>
                <span className="text-2xl font-bold font-mono text-emerald-400">₹{totalAmount}</span>
              </div>

              {/* Payment Status Radios */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 block">Payment Status</label>
                <div className="grid grid-cols-3 gap-1.5 bg-slate-800 p-1 rounded-xl text-xs">
                  {['Paid', 'Partially Paid', 'Pending'].map(status => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setPaymentStatus(status)}
                      className={`py-1.5 rounded-lg font-semibold transition ${
                        paymentStatus === status
                          ? status === 'Paid'
                            ? 'bg-emerald-500 text-white shadow'
                            : status === 'Partially Paid'
                            ? 'bg-amber-500 text-white shadow'
                            : 'bg-rose-500 text-white shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {status === 'Partially Paid' ? 'Partial' : status}
                    </button>
                  ))}
                </div>
              </div>

              {/* Partially Paid Input */}
              {paymentStatus === 'Partially Paid' && (
                <div className="space-y-1">
                  <label className="text-xs text-slate-300 block font-medium">Amount Received (₹)</label>
                  <input
                    type="number"
                    min="0"
                    max={totalAmount}
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-amber-400 outline-none"
                    placeholder="Enter amount paid"
                  />
                </div>
              )}

              {/* Amount Breakdown */}
              <div className="space-y-1.5 text-xs pt-1 border-t border-slate-800">
                <div className="flex justify-between text-slate-400">
                  <span>Paid Amount:</span>
                  <span className="font-mono text-white font-semibold">₹{calculatedPaid}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Pending / Due:</span>
                  <span className={`font-mono font-bold ${calculatedPending > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    ₹{calculatedPending}
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={saving || selectedServices.length === 0}
                className={`w-full py-3 rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 transition active:scale-98 ${
                  selectedServices.length === 0
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-600/30'
                }`}
              >
                <span>{saving ? 'Saving Registration...' : 'Save & Continue'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Quick Add Doctor Modal */}
      {showAddDoctorModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-base">Add New Reference Doctor</h3>
              <button onClick={() => setShowAddDoctorModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <form onSubmit={handleAddDoctor} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Doctor Name & Degree</label>
                <input
                  type="text"
                  placeholder="e.g. Dr. A. K. Jain (M.B.B.S., Silwani)"
                  value={newDoctorInput}
                  onChange={(e) => setNewDoctorInput(e.target.value)}
                  autoFocus
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddDoctorModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white shadow"
                >
                  Save Doctor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
