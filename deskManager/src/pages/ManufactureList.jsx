import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Factory, Search, RefreshCw, Plus, Calendar, Package, ArrowRight, Edit3, X, MapPin, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'react-toastify';

export default function ManufactureList() {
  const navigate = useNavigate();
  const [manufactureList, setManufactureList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  // Update Production Modal State
  const [selectedJob, setSelectedJob] = useState(null);
  const [updateFormData, setUpdateFormData] = useState({
    manufactured_quantity: '',
    message: '',
    location: '',
    rack: '',
    shelf_number: ''
  });
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    fetchManufactures();
  }, []);

  const fetchManufactures = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/manufacture');
      if (res.ok) {
        const data = await res.json();
        setManufactureList(data);
      } else {
        toast.error('Failed to load manufacturing jobs');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error fetching manufacturing data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenUpdateModal = (job) => {
    setSelectedJob(job);
    setUpdateFormData({
      manufactured_quantity: '',
      message: '',
      location: job.location || '',
      rack: job.rack || '',
      shelf_number: job.shelf_number || ''
    });
  };

  const handleCloseUpdateModal = () => {
    setSelectedJob(null);
  };

  const handleUpdateProductionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedJob) return;

    const mfgQty = parseInt(updateFormData.manufactured_quantity, 10);
    if (isNaN(mfgQty) || mfgQty <= 0) {
      toast.error('Please enter a valid Manufactured Quantity greater than 0');
      return;
    }

    setIsUpdating(true);
    try {
      const res = await fetch(`/api/manufacture/${selectedJob.id}/update-production`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateFormData)
      });

      if (res.ok) {
        toast.success(`Successfully updated production for Job #${selectedJob.id}!`);
        handleCloseUpdateModal();
        fetchManufactures();
      } else {
        const errData = await res.json();
        toast.error(errData.error || 'Failed to update production');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error updating production data');
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredList = manufactureList.filter(item => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (item.source_item_code && item.source_item_code.toLowerCase().includes(q)) ||
      (item.target_item_code && item.target_item_code.toLowerCase().includes(q)) ||
      (item.source_item_description && item.source_item_description.toLowerCase().includes(q)) ||
      (item.target_item_description && item.target_item_description.toLowerCase().includes(q)) ||
      (item.message && item.message.toLowerCase().includes(q))
    );
  });

  const activeJobs = filteredList.filter(item => !item.completed);
  const completedJobs = filteredList.filter(item => item.completed);

  return (
    <div className="flex-1 p-4 bg-slate-100 text-slate-900 font-sans overflow-x-hidden">
      <div className="w-full space-y-5">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-3 border-b border-slate-300 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg text-white" style={{ backgroundColor: 'var(--theme-color)' }}>
                <Factory size={18} />
              </div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Manufacture Directory</h1>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
              Track active manufacturing jobs and review completed production archives.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={fetchManufactures}
              disabled={isLoading}
              className="p-1.5 bg-white border border-slate-300 hover:border-slate-400 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => navigate('/inventory/form')}
              className="px-3 py-1.5 text-white font-bold text-xs rounded-lg transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
              style={{ backgroundColor: 'var(--theme-color)' }}
              onMouseEnter={(e) => e.target.style.filter = 'brightness(0.9)'}
              onMouseLeave={(e) => e.target.style.filter = 'none'}
            >
              <Plus size={14} />
              New Job from Inventory
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div 
          className="flex items-center gap-2 border border-slate-300 rounded-xl px-3 py-2 bg-white shadow-sm transition-all"
          style={{ borderColor: searchFocused ? 'var(--theme-color)' : 'rgb(203, 213, 225)' }}
        >
          <Search size={16} className="text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search by source item, target item, description, remarks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className="w-full bg-transparent focus:outline-none text-xs text-slate-900 placeholder:text-slate-400 font-semibold"
          />
        </div>

        {/* TABLE 1: ACTIVE / IN-PROGRESS MANUFACTURING JOBS */}
        <div className="border border-slate-300 rounded-xl overflow-hidden bg-white shadow-sm space-y-0">
          <div className="bg-amber-50/70 px-4 py-2.5 border-b border-slate-200 flex justify-between items-center">
            <span className="text-xs font-black text-amber-900 uppercase tracking-wider flex items-center gap-2">
              <Clock size={14} className="text-amber-600" />
              Active Manufacturing Jobs ({activeJobs.length})
            </span>
          </div>

          {isLoading && manufactureList.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-xs font-semibold flex flex-col items-center justify-center gap-2">
              <RefreshCw size={20} className="animate-spin text-slate-400" />
              Loading active manufacturing jobs...
            </div>
          ) : activeJobs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-semibold flex flex-col items-center justify-center gap-1">
              <Factory size={24} className="text-slate-300" />
              <span>No active manufacturing jobs in progress.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-[11px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[9px]">
                    <th className="px-3 py-2">Job ID</th>
                    <th className="px-3 py-2">Source Item</th>
                    <th className="px-2 py-2 text-center">Flow</th>
                    <th className="px-3 py-2">Target Item</th>
                    <th className="px-3 py-2 text-right">Completed</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2">Dates</th>
                    <th className="px-3 py-2">Message</th>
                    <th className="px-3 py-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {activeJobs.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Job ID */}
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-800">
                        <span className="bg-amber-100 border border-amber-300 text-amber-900 px-1.5 py-0.5 rounded text-[10px]">
                          #MFG-{m.id}
                        </span>
                      </td>

                      {/* Source Item */}
                      <td className="px-3 py-2.5">
                        <div className="font-bold text-slate-900 flex items-center gap-1">
                          <Package size={12} className="text-slate-400 shrink-0" />
                          {m.source_item_code || '—'}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[140px]" title={m.source_item_description}>
                          {m.source_item_description || '—'}
                        </div>
                        <div className="mt-0.5">
                          <span className="inline-block bg-red-50 text-red-700 text-[9px] px-1 py-0.2 rounded border border-red-200 font-bold">
                            Used: {m.quantity_used}
                          </span>
                        </div>
                      </td>

                      {/* Flow Arrow */}
                      <td className="px-2 py-2.5 text-center">
                        <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-500">
                          <ArrowRight size={11} />
                        </div>
                      </td>

                      {/* Target Item */}
                      <td className="px-3 py-2.5">
                        <div className="font-bold text-slate-900 flex items-center gap-1">
                          <Package size={12} className="text-indigo-500 shrink-0" />
                          {m.target_item_code || '—'}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[140px]" title={m.target_item_description}>
                          {m.target_item_description || '—'}
                        </div>
                      </td>

                      {/* Completed Qty */}
                      <td className="px-3 py-2.5 text-right font-black text-slate-900">
                        <span className="inline-block bg-amber-50 text-amber-800 px-1.5 py-0.2 rounded border border-amber-300 text-[11px] font-mono font-bold">
                          {m.completed_quantity || 0}
                        </span>
                      </td>

                      {/* Total Qty (Expected) */}
                      <td className="px-3 py-2.5 text-right font-black text-slate-900 font-mono text-[11px]">
                        {m.expected_quantity || 0}
                      </td>

                      {/* Dates */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1 text-slate-700 font-semibold text-[10px]">
                          <Calendar size={11} className="text-slate-400 shrink-0" />
                          <span>Start: {m.date_of_starting ? new Date(m.date_of_starting).toLocaleDateString() : '—'}</span>
                        </div>
                        {m.date_of_ending && (
                          <div className="text-[9px] text-slate-400 font-medium mt-0.5">
                            End: {new Date(m.date_of_ending).toLocaleDateString()}
                          </div>
                        )}
                      </td>

                      {/* Message */}
                      <td className="px-3 py-2.5 text-slate-500 max-w-[130px] truncate" title={m.message}>
                        {m.message || '—'}
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleOpenUpdateModal(m)}
                          className="px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1 mx-auto shadow-2xs"
                        >
                          <Edit3 size={12} />
                          Update
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* TABLE 2: COMPLETED MANUFACTURING JOBS */}
        <div className="border border-slate-300 rounded-xl overflow-hidden bg-white shadow-sm space-y-0">
          <div className="bg-emerald-50/70 px-4 py-2.5 border-b border-slate-200 flex justify-between items-center">
            <span className="text-xs font-black text-emerald-900 uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-600" />
              Completed Manufacturing Jobs ({completedJobs.length})
            </span>
          </div>

          {completedJobs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-semibold flex flex-col items-center justify-center gap-1">
              <CheckCircle2 size={24} className="text-slate-300" />
              <span>No completed manufacturing jobs archived yet.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-[11px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[9px]">
                    <th className="px-3 py-2">Job ID</th>
                    <th className="px-3 py-2">Source Item</th>
                    <th className="px-2 py-2 text-center">Flow</th>
                    <th className="px-3 py-2">Target Item</th>
                    <th className="px-3 py-2 text-right">Completed</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2">Dates</th>
                    <th className="px-3 py-2">Message</th>
                    <th className="px-3 py-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {completedJobs.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors bg-emerald-50/10">
                      {/* Job ID */}
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-800">
                        <span className="bg-emerald-100 border border-emerald-300 text-emerald-900 px-1.5 py-0.5 rounded text-[10px]">
                          #MFG-{m.id}
                        </span>
                      </td>

                      {/* Source Item */}
                      <td className="px-3 py-2.5">
                        <div className="font-bold text-slate-900 flex items-center gap-1">
                          <Package size={12} className="text-slate-400 shrink-0" />
                          {m.source_item_code || '—'}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[140px]" title={m.source_item_description}>
                          {m.source_item_description || '—'}
                        </div>
                        <div className="mt-0.5">
                          <span className="inline-block bg-red-50 text-red-700 text-[9px] px-1 py-0.2 rounded border border-red-200 font-bold">
                            Used: {m.quantity_used}
                          </span>
                        </div>
                      </td>

                      {/* Flow Arrow */}
                      <td className="px-2 py-2.5 text-center">
                        <div className="w-5 h-5 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-600">
                          <ArrowRight size={11} />
                        </div>
                      </td>

                      {/* Target Item */}
                      <td className="px-3 py-2.5">
                        <div className="font-bold text-slate-900 flex items-center gap-1">
                          <Package size={12} className="text-emerald-600 shrink-0" />
                          {m.target_item_code || '—'}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[140px]" title={m.target_item_description}>
                          {m.target_item_description || '—'}
                        </div>
                      </td>

                      {/* Completed Qty */}
                      <td className="px-3 py-2.5 text-right font-black text-slate-900">
                        <span className="inline-block bg-emerald-100 text-emerald-900 px-1.5 py-0.2 rounded border border-emerald-300 text-[11px] font-mono font-bold">
                          {m.completed_quantity || 0}
                        </span>
                      </td>

                      {/* Total Qty (Expected) */}
                      <td className="px-3 py-2.5 text-right font-black text-slate-900 font-mono text-[11px]">
                        {m.expected_quantity || 0}
                      </td>

                      {/* Dates */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1 text-slate-700 font-semibold text-[10px]">
                          <Calendar size={11} className="text-slate-400 shrink-0" />
                          <span>Start: {m.date_of_starting ? new Date(m.date_of_starting).toLocaleDateString() : '—'}</span>
                        </div>
                        {m.date_of_ending && (
                          <div className="text-[9px] text-slate-400 font-medium mt-0.5">
                            End: {new Date(m.date_of_ending).toLocaleDateString()}
                          </div>
                        )}
                      </td>

                      {/* Message */}
                      <td className="px-3 py-2.5 text-slate-500 max-w-[130px] truncate" title={m.message}>
                        {m.message || '—'}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-2.5 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 size={10} /> 100% Completed
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* UPDATE PRODUCTION MODAL */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white border border-slate-300 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-5 animate-scale-up">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Factory size={18} style={{ color: 'var(--theme-color)' }} />
                  Update Manufacture Job #{selectedJob.id}
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Target Item: <span className="font-bold text-slate-800">{selectedJob.target_item_code}</span> (Completed: {selectedJob.completed_quantity || 0} / Total: {selectedJob.expected_quantity})
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseUpdateModal}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateProductionSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Manufactured Quantity Added <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="e.g. 5"
                  value={updateFormData.manufactured_quantity}
                  onChange={(e) => setUpdateFormData(prev => ({ ...prev, manufactured_quantity: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-[var(--theme-color)]"
                />
                <p className="text-[10px] text-slate-400 font-semibold mt-1">
                  Quantity produced in this batch (will update trace item and inventory stock).
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Manufacture Message / Update Note
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Completed batch #1 quality inspection passed"
                  value={updateFormData.message}
                  onChange={(e) => setUpdateFormData(prev => ({ ...prev, message: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-[var(--theme-color)]"
                />
              </div>

              <div className="border-t border-slate-200 pt-3">
                <span className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <MapPin size={12} className="text-slate-400" />
                  Inventory Warehouse Location (Optional)
                </span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Location</label>
                    <input
                      type="text"
                      placeholder="e.g. Warehouse A"
                      value={updateFormData.location}
                      onChange={(e) => setUpdateFormData(prev => ({ ...prev, location: e.target.value }))}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Rack</label>
                    <input
                      type="text"
                      placeholder="e.g. R-01"
                      value={updateFormData.rack}
                      onChange={(e) => setUpdateFormData(prev => ({ ...prev, rack: e.target.value }))}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Shelf</label>
                    <input
                      type="text"
                      placeholder="e.g. S-03"
                      value={updateFormData.shelf_number}
                      onChange={(e) => setUpdateFormData(prev => ({ ...prev, shelf_number: e.target.value }))}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseUpdateModal}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-4 py-2 text-white font-bold text-xs rounded-xl transition-all shadow-sm cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  style={{ backgroundColor: 'var(--theme-color)' }}
                  onMouseEnter={(e) => e.target.style.filter = 'brightness(0.9)'}
                  onMouseLeave={(e) => e.target.style.filter = 'none'}
                >
                  {isUpdating ? (
                    <><RefreshCw size={14} className="animate-spin" /> Saving...</>
                  ) : (
                    'Submit Production Update'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
