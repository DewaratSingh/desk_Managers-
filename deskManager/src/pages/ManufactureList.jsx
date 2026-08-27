import React, { useState, useEffect } from 'react';
import { Hammer, Eye, X, MessageSquare, CheckCircle, Info, Calendar, Edit3, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';

export default function ManufactureList() {
  const [runs, setRuns] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRun, setSelectedRun] = useState(null);
  
  const [editMessage, setEditMessage] = useState('');
  const [actualProduceQty, setActualProduceQty] = useState('');
  
  const [isUpdatingMessage, setIsUpdatingMessage] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    fetchRuns();
  }, []);

  const fetchRuns = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/manufacturing');
      if (!res.ok) throw new Error('Failed to fetch manufacturing runs');
      const data = await res.json();
      setRuns(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load manufacturing runs.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDetails = (run) => {
    setSelectedRun(run);
    setEditMessage(run.message || '');
    setActualProduceQty(run.possible_quantity_produced || '');
  };

  const handleCloseDetails = () => {
    setSelectedRun(null);
    setEditMessage('');
    setActualProduceQty('');
  };

  const handleUpdateMessage = async () => {
    if (!selectedRun) return;
    setIsUpdatingMessage(true);
    try {
      const res = await fetch(`/api/manufacturing/${selectedRun.id}/message`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: editMessage })
      });
      if (!res.ok) throw new Error('Failed to update message');
      
      toast.success('Message updated successfully!');
      
      // Update local state
      setRuns(prev => prev.map(r => r.id === selectedRun.id ? { ...r, message: editMessage } : r));
      setSelectedRun(prev => ({ ...prev, message: editMessage }));
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to update message');
    } finally {
      setIsUpdatingMessage(false);
    }
  };

  const handleCompleteRun = async () => {
    if (!selectedRun) return;
    
    const parsedQty = parseInt(actualProduceQty, 10);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      toast.error('Please enter a valid actual quantity produced greater than 0.');
      return;
    }

    setIsCompleting(true);
    try {
      const res = await fetch(`/api/manufacturing/${selectedRun.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actual_quantity_produced: parsedQty })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to complete manufacturing run');
      }

      toast.success('Manufacturing completed! Output added to inventory.');
      handleCloseDetails();
      fetchRuns(); // Refresh runs list
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to complete manufacturing run.');
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <main className="p-6 text-slate-700 bg-slate-50 min-h-[calc(100vh-72px)] font-sans">
      <div className="mx-auto max-w-5xl bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
          <div>
            <h1 className="text-lg font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
              <Hammer className="text-indigo-600 animate-pulse" size={20} />
              Manufacturing Log
            </h1>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">
              Monitor active manufacturing jobs, update runs, and complete productions
            </p>
          </div>
        </div>

        {/* List table */}
        {isLoading ? (
          <div className="flex justify-center items-center py-20 text-slate-400 text-xs font-semibold">
            Loading runs...
          </div>
        ) : runs.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 p-6 text-slate-400 text-xs font-semibold">
            No active manufacturing runs staged in database.
          </div>
        ) : (
          <div className="border border-slate-200 rounded-2xl overflow-x-auto shadow-sm">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Source Item</th>
                  <th className="px-4 py-3 text-center">Transform</th>
                  <th className="px-4 py-3">Target Item</th>
                  <th className="px-4 py-3 text-right">Qty Used</th>
                  <th className="px-4 py-3 text-right">Expected Produce</th>
                  <th className="px-4 py-3 text-right">Est. Unit Cost</th>
                  <th className="px-4 py-3">Start Date</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white font-semibold text-slate-700">
                {runs.map((run) => (
                  <tr key={run.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3.5">
                      <span className="font-mono font-black text-slate-800 bg-slate-100 px-2 py-0.5 border border-slate-200 rounded">
                        {run.source_item_code_val}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center text-indigo-500">
                      <ArrowRight size={14} className="inline" />
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-mono font-black text-slate-800 bg-indigo-50 px-2 py-0.5 border border-indigo-200 rounded">
                        {run.target_item_code_val}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-black text-slate-500">{run.quantity_used}</td>
                    <td className="px-4 py-3.5 text-right font-black text-indigo-600">{run.possible_quantity_produced}</td>
                    <td className="px-4 py-3.5 text-right font-mono font-black text-slate-800">
                      ₹{parseFloat(run.possible_cost_per_unit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3.5 text-slate-400 font-bold">
                      {run.start_date ? run.start_date.split('T')[0] : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleOpenDetails(run)}
                        className="px-2.5 py-1 text-[10px] font-black uppercase rounded text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-colors cursor-pointer flex items-center gap-1 mx-auto"
                      >
                        <Eye size={12} />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* View Details Modal */}
        {selectedRun && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-scale-up relative">
              
              {/* Close button */}
              <button
                type="button"
                onClick={handleCloseDetails}
                className="absolute top-4 right-4 p-1 hover:bg-slate-100 rounded-full border border-slate-200 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>

              {/* Title */}
              <div>
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  <Hammer size={16} className="text-indigo-600" />
                  Staged Run Details (Job #{selectedRun.id})
                </h2>
                <p className="text-[10px] text-slate-400 font-bold">
                  Staged run configuration, cost references, and completion status
                </p>
              </div>

              {/* Grid Specifications */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 grid grid-cols-2 gap-3 text-xs font-semibold text-slate-600">
                <div className="flex justify-between border-b border-slate-100 pb-1.5 col-span-2">
                  <span className="text-slate-400 uppercase text-[9px]">Source Item Code</span>
                  <span className="font-mono text-slate-900 font-bold bg-white border px-1.5 py-0.5 rounded">
                    {selectedRun.source_item_code_val}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1.5 col-span-2">
                  <span className="text-slate-400 uppercase text-[9px]">Target Item Code</span>
                  <span className="font-mono text-slate-900 font-bold bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">
                    {selectedRun.target_item_code_val}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-slate-400">Qty Used</span>
                  <span className="text-slate-900 font-black">{selectedRun.quantity_used}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-slate-400">Expected Produce</span>
                  <span className="text-indigo-600 font-black">{selectedRun.possible_quantity_produced}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-slate-400">Est. Price / Unit</span>
                  <span className="font-mono text-slate-900 font-bold">
                    ₹{parseFloat(selectedRun.possible_cost_per_unit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-slate-400">Start Date</span>
                  <span className="text-slate-900 font-bold">{selectedRun.start_date ? selectedRun.start_date.split('T')[0] : '—'}</span>
                </div>
                <div className="flex justify-between col-span-2">
                  <span className="text-slate-400">Target End Date</span>
                  <span className="text-slate-900 font-bold">{selectedRun.possible_end_date ? selectedRun.possible_end_date.split('T')[0] : 'None'}</span>
                </div>
              </div>

              {/* Edit Message Form */}
              <div className="space-y-1.5">
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                  Optional Job Message / Note
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Update job notes..."
                    value={editMessage}
                    onChange={(e) => setEditMessage(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    disabled={isUpdatingMessage}
                    onClick={handleUpdateMessage}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-50 transition-colors text-xs font-bold text-slate-700 flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                  >
                    <Edit3 size={12} />
                    {isUpdatingMessage ? 'Saving...' : 'Update'}
                  </button>
                </div>
              </div>

              {/* Complete Job Section */}
              <div className="border-t border-slate-150 pt-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <CheckCircle size={14} className="text-emerald-500" />
                  <span>Execute Job Completion</span>
                </div>

                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Actual Quantity Produced <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="Actual output count..."
                      value={actualProduceQty}
                      onChange={(e) => setActualProduceQty(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={isCompleting || !actualProduceQty}
                    onClick={handleCompleteRun}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-sm shadow-emerald-600/20"
                  >
                    {isCompleting ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <CheckCircle size={12} />
                    )}
                    Complete Manufacture
                  </button>
                </div>
                
                <p className="text-[9px] text-slate-400 font-bold leading-normal">
                  * Completing this will remove this staging record, copy the process list from the source P-Item, append target cost tags, and log the output P-Item into inventory.
                </p>
              </div>

            </div>
          </div>
        )}

      </div>
    </main>
  );
}
