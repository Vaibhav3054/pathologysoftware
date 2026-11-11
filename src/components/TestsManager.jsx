import React, { useState, useEffect } from 'react';
import { 
  Microscope, 
  Activity, 
  Plus, 
  Edit2, 
  Trash2, 
  Check, 
  X, 
  Search, 
  ChevronRight, 
  ListPlus,
  Sliders
} from 'lucide-react';
import { api } from '../services/api';

export default function TestsManager() {
  const [activeTab, setActiveTab] = useState('blood'); // 'blood' or 'xray'
  const [tests, setTests] = useState([]);
  const [selectedTest, setSelectedTest] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddTestModal, setShowAddTestModal] = useState(false);
  const [newTestName, setNewTestName] = useState('');
  const [newTestPrice, setNewTestPrice] = useState('');

  const [editingTest, setEditingTest] = useState(null);

  // Parameters modal
  const [showAddParamModal, setShowAddParamModal] = useState(false);
  const [editingParam, setEditingParam] = useState(null);
  const [paramName, setParamName] = useState('');
  const [paramUnit, setParamUnit] = useState('');
  const [paramNormalRange, setParamNormalRange] = useState('');
  const [paramMinVal, setParamMinVal] = useState('');
  const [paramMaxVal, setParamMaxVal] = useState('');

  useEffect(() => {
    loadTests();
  }, [activeTab]);

  const loadTests = async () => {
    try {
      setLoading(true);
      const list = await api.getTests(activeTab);
      setTests(list);
      if (list.length > 0) {
        loadTestDetails(list[0].id);
      } else {
        setSelectedTest(null);
      }
    } catch (err) {
      console.error('Error loading tests:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTestDetails = async (id) => {
    try {
      const details = await api.getTestWithParameters(id);
      setSelectedTest(details);
    } catch (err) {
      console.error('Error loading test details:', err);
    }
  };

  // Add Test
  const handleAddTest = async (e) => {
    e.preventDefault();
    if (!newTestName.trim()) return;
    try {
      await api.addTest(
        activeTab,
        newTestName.trim(),
        parseFloat(newTestPrice) || 0,
        activeTab === 'blood' ? 'Pathology' : 'Radiology'
      );
      setNewTestName('');
      setNewTestPrice('');
      setShowAddTestModal(false);
      await loadTests();
    } catch (err) {
      alert('Failed to add service: ' + err.message);
    }
  };

  // Edit Test Price / Name
  const handleUpdateTest = async (e) => {
    e.preventDefault();
    if (!editingTest || !editingTest.name.trim()) return;
    try {
      await api.updateTest(editingTest.id, editingTest.name, editingTest.price);
      setEditingTest(null);
      await loadTests();
      if (selectedTest?.id === editingTest.id) {
        await loadTestDetails(editingTest.id);
      }
    } catch (err) {
      alert('Failed to update: ' + err.message);
    }
  };

  // Delete Test
  const handleDeleteTest = async (id, name) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This will also remove its parameter templates.`)) return;
    try {
      await api.deleteTest(id);
      await loadTests();
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  };

  // Save / Update Parameter
  const handleSaveParam = async (e) => {
    e.preventDefault();
    if (!paramName.trim() || !selectedTest) return;

    try {
      if (editingParam) {
        await api.updateParameter(editingParam.id, {
          name: paramName,
          unit: paramUnit,
          normal_range: paramNormalRange,
          min_val: paramMinVal,
          max_val: paramMaxVal,
          display_order: editingParam.display_order || 0
        });
      } else {
        await api.addParameter(selectedTest.id, {
          name: paramName,
          unit: paramUnit,
          normal_range: paramNormalRange,
          min_val: paramMinVal,
          max_val: paramMaxVal,
          display_order: (selectedTest.parameters?.length || 0) + 1
        });
      }

      setShowAddParamModal(false);
      setEditingParam(null);
      resetParamForm();
      await loadTestDetails(selectedTest.id);
    } catch (err) {
      alert('Failed to save parameter: ' + err.message);
    }
  };

  // Delete Parameter
  const handleDeleteParam = async (paramId) => {
    if (!confirm('Are you sure you want to delete this test parameter?')) return;
    try {
      await api.deleteParameter(paramId);
      await loadTestDetails(selectedTest.id);
    } catch (err) {
      alert('Failed to delete parameter: ' + err.message);
    }
  };

  const openEditParam = (param) => {
    setEditingParam(param);
    setParamName(param.name);
    setParamUnit(param.unit || '');
    setParamNormalRange(param.normal_range || '');
    setParamMinVal(param.min_val ?? '');
    setParamMaxVal(param.max_val ?? '');
    setShowAddParamModal(true);
  };

  const resetParamForm = () => {
    setParamName('');
    setParamUnit('');
    setParamNormalRange('');
    setParamMinVal('');
    setParamMaxVal('');
  };

  const filteredTests = tests.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Header & Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Tests & X-Rays Management</h2>
            <p className="text-xs text-slate-500">Configure prices, parameters, units, and normal reference ranges</p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="grid grid-cols-2 sm:flex items-center gap-2 bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('blood')}
            className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeTab === 'blood' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>🩸 Blood Tests</span>
          </button>
          <button
            onClick={() => setActiveTab('xray')}
            className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeTab === 'xray' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>🩻 X-Ray Services</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: List of Tests / Services */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col max-h-[340px] lg:h-[650px] lg:max-h-none overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder={`Search ${activeTab === 'blood' ? 'tests' : 'X-rays'}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-sky-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
            <button
              onClick={() => setShowAddTestModal(true)}
              className="flex items-center gap-1 bg-sky-600 hover:bg-sky-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loading ? (
              <div className="p-8 text-center text-slate-400 text-xs">Loading services...</div>
            ) : filteredTests.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">No services found.</div>
            ) : (
              filteredTests.map(test => {
                const isSelected = selectedTest?.id === test.id;
                return (
                  <div
                    key={test.id}
                    onClick={() => loadTestDetails(test.id)}
                    className={`p-3 cursor-pointer select-none transition flex items-center justify-between ${
                      isSelected ? 'bg-sky-50/80 border-l-4 border-sky-600 pl-2' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <h4 className="font-semibold text-slate-800 text-xs">{test.name}</h4>
                      <p className="font-mono text-emerald-700 font-bold text-[11px] mt-0.5">₹{test.price}</p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTest(test);
                        }}
                        className="p-1 text-slate-400 hover:text-amber-600 rounded"
                        title="Edit Price/Name"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTest(test.id, test.name);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <ChevronRight className={`w-4 h-4 ${isSelected ? 'text-sky-600' : 'text-slate-300'}`} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Parameters Template Management (for Blood Tests) or X-Ray details */}
        <div className="lg:col-span-2 space-y-6">
          {selectedTest ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-5">
              {/* Selected Service Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{activeTab === 'blood' ? '🩸' : '🩻'}</span>
                    <h3 className="text-lg font-bold text-slate-900">{selectedTest.name}</h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Service Fee: <strong className="text-emerald-700 font-mono text-sm">₹{selectedTest.price}</strong>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setEditingTest(selectedTest)}
                    className="flex items-center gap-1.5 px-3 py-2 sm:py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Change Price / Name</span>
                  </button>

                  {activeTab === 'blood' && (
                    <button
                      onClick={() => {
                        resetParamForm();
                        setEditingParam(null);
                        setShowAddParamModal(true);
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2 sm:py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold shadow-xs transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add Parameter</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Blood Test: Parameters Table */}
              {activeTab === 'blood' ? (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-600">
                      Report Template Parameters ({selectedTest.parameters?.length || 0})
                    </h4>
                    <span className="text-[11px] text-slate-400">
                      These parameters automatically appear during patient result entry
                    </span>
                  </div>

                  {(!selectedTest.parameters || selectedTest.parameters.length === 0) ? (
                    <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl space-y-2">
                      <ListPlus className="w-8 h-8 mx-auto text-slate-300" />
                      <p>No parameters defined for this test yet.</p>
                      <button
                        onClick={() => {
                          resetParamForm();
                          setShowAddParamModal(true);
                        }}
                        className="text-sky-600 font-semibold hover:underline"
                      >
                        + Add First Parameter
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Desktop Parameters Table */}
                      <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-xl">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-200">
                            <tr>
                              <th className="py-2.5 px-3 w-1/3">Parameter Name</th>
                              <th className="py-2.5 px-3 w-1/6">Unit</th>
                              <th className="py-2.5 px-3 w-1/3">Normal Range</th>
                              <th className="py-2.5 px-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {selectedTest.parameters.map((p) => (
                              <tr key={p.id} className="hover:bg-slate-50/70">
                                <td className="py-2.5 px-3 font-semibold text-slate-800">
                                  {p.name}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-slate-600">
                                  {p.unit || '—'}
                                </td>
                                <td className="py-2.5 px-3 text-slate-700">
                                  {p.normal_range || '—'}
                                </td>
                                <td className="py-2.5 px-3 text-right space-x-1 whitespace-nowrap">
                                  <button
                                    onClick={() => openEditParam(p)}
                                    className="p-1 text-slate-400 hover:text-amber-600 rounded"
                                    title="Edit Parameter"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteParam(p.id)}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                    title="Delete Parameter"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Parameters Cards */}
                      <div className="block md:hidden border border-slate-200 rounded-xl divide-y divide-slate-100">
                        {selectedTest.parameters.map((p) => (
                          <div key={p.id} className="p-3.5 flex items-center justify-between gap-3">
                            <div className="min-w-0 space-y-0.5">
                              <div className="font-bold text-slate-800 text-xs">{p.name}</div>
                              <div className="text-[11px] text-slate-500">
                                Unit: <span className="font-mono text-slate-700">{p.unit || '—'}</span>
                                {p.normal_range && <span> • Normal: <strong className="text-slate-700">{p.normal_range}</strong></span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => openEditParam(p)}
                                className="p-2 text-slate-500 hover:text-amber-600 bg-slate-50 rounded-lg border border-slate-200"
                                title="Edit Parameter"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteParam(p.id)}
                                className="p-2 text-slate-500 hover:text-rose-600 bg-slate-50 rounded-lg border border-slate-200"
                                title="Delete Parameter"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                /* X-Ray Template Info */
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 text-xs leading-relaxed text-slate-700">
                  <h4 className="font-bold text-slate-800 text-sm">X-Ray Service Reporting Form</h4>
                  <p>
                    When <strong>{selectedTest.name}</strong> is selected for a patient, the software automatically provides standard reporting fields:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-slate-600">
                    <li><strong>Findings:</strong> Multi-line descriptive area for radiological observations.</li>
                    <li><strong>Impression:</strong> Summary opinion / diagnosis.</li>
                    <li><strong>Remarks / Advice:</strong> Optional follow-up recommendations.</li>
                  </ul>
                  <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-200">
                    Standard price for this X-ray is ₹{selectedTest.price}. You can modify the price anytime using the "Change Price" button above.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-slate-400 text-sm">
              Select a service from the left to view or edit details.
            </div>
          )}
        </div>
      </div>

      {/* Add Service Modal */}
      {showAddTestModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm">
                Add New {activeTab === 'blood' ? 'Blood / Lab Test' : 'X-Ray Service'}
              </h3>
              <button onClick={() => setShowAddTestModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <form onSubmit={handleAddTest} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Service / Test Name</label>
                <input
                  type="text"
                  placeholder="e.g. Serum Calcium or X-Ray Pelvis"
                  value={newTestName}
                  onChange={(e) => setNewTestName(e.target.value)}
                  autoFocus
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Standard Price (₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 400"
                  value={newTestPrice}
                  onChange={(e) => setNewTestPrice(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddTestModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white shadow"
                >
                  Save Service
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Service Modal */}
      {editingTest && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm">Edit Service Name & Price</h3>
              <button onClick={() => setEditingTest(null)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <form onSubmit={handleUpdateTest} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Service Name</label>
                <input
                  type="text"
                  value={editingTest.name}
                  onChange={(e) => setEditingTest({ ...editingTest, name: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Price (₹)</label>
                <input
                  type="number"
                  value={editingTest.price}
                  onChange={(e) => setEditingTest({ ...editingTest, price: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTest(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white shadow"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Parameter Modal */}
      {showAddParamModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm">
                {editingParam ? 'Edit Parameter' : 'Add Test Parameter'} — {selectedTest?.name}
              </h3>
              <button onClick={() => setShowAddParamModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <form onSubmit={handleSaveParam} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Parameter Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Hemoglobin or Platelet Count"
                  value={paramName}
                  onChange={(e) => setParamName(e.target.value)}
                  autoFocus
                  required
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Unit</label>
                  <input
                    type="text"
                    placeholder="e.g. g/dL, /µL, mg/dL"
                    value={paramUnit}
                    onChange={(e) => setParamUnit(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Normal Reference Range Text</label>
                  <input
                    type="text"
                    placeholder="e.g. 13.0 - 17.0"
                    value={paramNormalRange}
                    onChange={(e) => setParamNormalRange(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                </div>
              </div>

              {/* Optional min/max for automatic abnormal flagging */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="text-[11px] font-semibold text-slate-500 block">
                  Automatic Abnormal Range Limits (Optional Numeric)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-500">Minimum Normal Limit</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 13.0"
                      value={paramMinVal}
                      onChange={(e) => setParamMinVal(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500">Maximum Normal Limit</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 17.0"
                      value={paramMaxVal}
                      onChange={(e) => setParamMaxVal(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddParamModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white shadow"
                >
                  {editingParam ? 'Update Parameter' : 'Save Parameter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
