import React, { useState, useEffect } from 'react';
import { 
  UserCheck, 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  X, 
  Check, 
  Stethoscope 
} from 'lucide-react';
import { api } from '../services/api';

export default function DoctorsManager() {
  const [doctors, setDoctors] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newDoctorName, setNewDoctorName] = useState('');

  const [editingDoctor, setEditingDoctor] = useState(null);

  useEffect(() => {
    loadDoctors();
  }, []);

  const loadDoctors = async () => {
    try {
      setLoading(true);
      const list = await api.getDoctors();
      setDoctors(list);
    } catch (err) {
      console.error('Failed to load doctors:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newDoctorName.trim()) return;
    try {
      await api.addDoctor(newDoctorName.trim());
      setNewDoctorName('');
      setShowAddModal(false);
      await loadDoctors();
    } catch (err) {
      alert('Failed to add doctor: ' + err.message);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingDoctor || !editingDoctor.name.trim()) return;
    try {
      await api.updateDoctor(editingDoctor.id, editingDoctor.name.trim());
      setEditingDoctor(null);
      await loadDoctors();
    } catch (err) {
      alert('Failed to update: ' + err.message);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Are you sure you want to remove "${name}" from the reference doctor list?`)) return;
    try {
      await api.deleteDoctor(id);
      await loadDoctors();
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  };

  const filteredDoctors = doctors.filter(d => 
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Reference Doctors</h2>
            <p className="text-xs text-slate-500">Manage referring doctors appearing in registration dropdown and reports</p>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold px-4 py-2.5 rounded-xl text-xs shadow-md transition active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>+ Add Reference Doctor</span>
        </button>
      </div>

      {/* Search & List Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search reference doctors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
          </div>
          <span className="text-xs font-semibold text-slate-500">
            Total Doctors: {doctors.length}
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Loading doctors...</div>
        ) : filteredDoctors.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2 text-xs">
            <Stethoscope className="w-8 h-8 mx-auto text-slate-300" />
            <p>No reference doctors found.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredDoctors.map((doc, idx) => (
              <div
                key={doc.id}
                className="p-4 hover:bg-slate-50/70 transition flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-slate-400 w-6 text-right">{idx + 1}.</span>
                  <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-800 flex items-center justify-center font-bold text-xs">
                    {doc.name.replace(/^(Dr\.\s*)/i, '').charAt(0)}
                  </div>
                  <span className="font-semibold text-slate-800 text-sm">{doc.name}</span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditingDoctor(doc)}
                    className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-amber-50 transition"
                    title="Edit Name"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(doc.id, doc.name)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                    title="Delete Doctor"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm">Add Reference Doctor</h3>
              <button onClick={() => setShowAddModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Doctor Name & Qualifications</label>
                <input
                  type="text"
                  placeholder="e.g. Dr. R. K. Sharma (M.B.B.S., Silwani)"
                  value={newDoctorName}
                  onChange={(e) => setNewDoctorName(e.target.value)}
                  autoFocus
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
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

      {/* Edit Modal */}
      {editingDoctor && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm">Edit Doctor Name</h3>
              <button onClick={() => setEditingDoctor(null)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Doctor Name</label>
                <input
                  type="text"
                  value={editingDoctor.name}
                  onChange={(e) => setEditingDoctor({ ...editingDoctor, name: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingDoctor(null)}
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
    </div>
  );
}
