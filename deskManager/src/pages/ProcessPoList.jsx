import React, { useState, useEffect, useRef } from 'react';
import { FileText, Search, RefreshCw, Plus, Calendar, Package, ArrowRight, X, Layers, AlertCircle, ChevronDown, Eye, CheckSquare, Check } from 'lucide-react';
import { toast } from 'react-toastify';

export default function ProcessPoList() {
  const [processPoList, setProcessPoList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  // New Process PO Job Form State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    po_no: '',
    date_of_start: '',
    date_of_end: '',
    received_q_id: '',
    message: '',
    items: [
      {
        source_item_code: '',
        target_item_code: '',
        source_qty: '',
        target_qty: '',
        price: '',
        source_trace_id_array: []
      }
    ]
  });

  // Searchable Dropdowns Data & State
  const [inventoryItems, setInventoryItems] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [openDropdown, setOpenDropdown] = useState({ rowIndex: null, type: null }); // type: 'source' | 'target'
  const dropdownContainerRef = useRef(null);

  // Trace Pop-up Modal State
  const [traceModalState, setTraceModalState] = useState({
    isOpen: false,
    rowIndex: null,
    source_item_code: '',
    traceItems: [],
    loading: false,
    selectedSelections: {} // trace_id -> { trace_id, Qty, inventory_id, available_qty, price }
  });

  // Process PO Job Details Pop-up Modal State
  const [viewingJob, setViewingJob] = useState(null);
  const [completedQtyInputs, setCompletedQtyInputs] = useState({}); // process_po_item_id -> completedQty string
  const [isProcessingComplete, setIsProcessingComplete] = useState(false);

  useEffect(() => {
    fetchProcessPos();
    fetchCatalogItems();
    fetchInventoryItems();
  }, []);

  // Dismiss dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownContainerRef.current && !dropdownContainerRef.current.contains(e.target)) {
        setOpenDropdown({ rowIndex: null, type: null });
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchProcessPos = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/process-po');
      if (res.ok) {
        const data = await res.json();
        setProcessPoList(data);
      } else {
        toast.error('Failed to load Process PO records');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error fetching Process PO data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCatalogItems = async () => {
    try {
      const res = await fetch('/api/items?limit=200');
      if (res.ok) {
        const data = await res.json();
        setCatalogItems(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchInventoryItems = async () => {
    try {
      const res = await fetch('/api/inventory?limit=200');
      if (res.ok) {
        const data = await res.json();
        setInventoryItems(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handlers for Form Row Items
  const handleItemChange = (index, field, value) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      return { ...prev, items: newItems };
    });
  };

  const handleSelectSourceItem = (index, itemCode) => {
    handleItemChange(index, 'source_item_code', itemCode);
    setOpenDropdown({ rowIndex: null, type: null });
  };

  const handleSelectTargetItem = (index, itemCode) => {
    handleItemChange(index, 'target_item_code', itemCode);
    setOpenDropdown({ rowIndex: null, type: null });
  };

  const handleAddItemRow = () => {
    setFormData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          source_item_code: '',
          target_item_code: '',
          source_qty: '',
          target_qty: '',
          price: '',
          source_trace_id_array: []
        }
      ]
    }));
  };

  const handleRemoveItemRow = (index) => {
    if (formData.items.length === 1) return;
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index)
    }));
  };

  // Open Trace Modal
  const handleOpenTraceModal = async (rowIndex) => {
    const row = formData.items[rowIndex];
    if (!row.source_item_code) {
      toast.warn('Please select a Source Item Code first before picking trace items');
      return;
    }

    const initialSelections = {};
    (row.source_trace_id_array || []).forEach(st => {
      const tid = st.trace_id || st.traceid;
      if (tid) {
        initialSelections[tid] = { ...st };
      }
    });

    setTraceModalState({
      isOpen: true,
      rowIndex,
      source_item_code: row.source_item_code,
      traceItems: [],
      loading: true,
      selectedSelections: initialSelections
    });

    try {
      const res = await fetch(`/api/process-po/trace-items?item_code=${encodeURIComponent(row.source_item_code.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setTraceModalState(prev => ({
          ...prev,
          traceItems: data,
          loading: false
        }));
      } else {
        toast.error('Failed to load trace items for source item');
        setTraceModalState(prev => ({ ...prev, loading: false }));
      }
    } catch (err) {
      console.error(err);
      toast.error('Error fetching trace items');
      setTraceModalState(prev => ({ ...prev, loading: false }));
    }
  };

  const handleToggleTraceCheckbox = (item) => {
    const tid = item.trace_id;
    setTraceModalState(prev => {
      const nextSelections = { ...prev.selectedSelections };
      if (nextSelections[tid]) {
        delete nextSelections[tid];
      } else {
        nextSelections[tid] = {
          trace_id: tid,
          inventory_id: item.inventory_id,
          available_qty: item.available_qty,
          Qty: item.available_qty,
          price: item.price || 0
        };
      }
      return { ...prev, selectedSelections: nextSelections };
    });
  };

  const handleTraceQtyChange = (tid, newQty) => {
    setTraceModalState(prev => {
      const nextSelections = { ...prev.selectedSelections };
      if (nextSelections[tid]) {
        nextSelections[tid] = {
          ...nextSelections[tid],
          Qty: newQty
        };
      }
      return { ...prev, selectedSelections: nextSelections };
    });
  };

  const handleConfirmTraceSelections = () => {
    const selectionsArray = Object.values(traceModalState.selectedSelections).map(s => ({
      trace_id: s.trace_id,
      inventory_id: s.inventory_id,
      Qty: parseFloat(s.Qty) || 0
    })).filter(s => s.Qty > 0);

    const totalSourceQty = selectionsArray.reduce((sum, s) => sum + s.Qty, 0);

    let totalPrice = 0;
    Object.values(traceModalState.selectedSelections).forEach(s => {
      if (parseFloat(s.Qty) > 0) {
        totalPrice += (parseFloat(s.price) || 0) * (parseFloat(s.Qty) || 0);
      }
    });

    const calculatedUnitPrice = totalSourceQty > 0 ? (totalPrice / totalSourceQty).toFixed(2) : '';

    setFormData(prev => {
      const newItems = [...prev.items];
      const targetIndex = traceModalState.rowIndex;
      newItems[targetIndex] = {
        ...newItems[targetIndex],
        source_trace_id_array: selectionsArray,
        source_qty: totalSourceQty > 0 ? totalSourceQty : newItems[targetIndex].source_qty,
        target_qty: totalSourceQty > 0 ? totalSourceQty : newItems[targetIndex].target_qty,
        price: calculatedUnitPrice !== '' ? calculatedUnitPrice : newItems[targetIndex].price
      };
      return { ...prev, items: newItems };
    });

    setTraceModalState({
      isOpen: false,
      rowIndex: null,
      source_item_code: '',
      traceItems: [],
      loading: false,
      selectedSelections: {}
    });
    toast.success(`Populated ${selectionsArray.length} trace item(s)`);
  };

  // Submit New Process PO Form
  const handleSubmitProcessPo = async (e) => {
    e.preventDefault();
    if (!formData.po_no.trim()) {
      toast.error('Process PO Number/Name is required');
      return;
    }

    for (let i = 0; i < formData.items.length; i++) {
      const row = formData.items[i];
      if (!row.target_item_code.trim()) {
        toast.error(`Item Row #${i + 1}: Target Item Code is required`);
        return;
      }
      if (!row.target_qty || parseFloat(row.target_qty) <= 0) {
        toast.error(`Item Row #${i + 1}: Target Quantity must be greater than 0`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/process-po', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Process PO created successfully');
        setShowCreateModal(false);
        setFormData({
          po_no: '',
          date_of_start: '',
          date_of_end: '',
          received_q_id: '',
          message: '',
          items: [
            {
              source_item_code: '',
              target_item_code: '',
              source_qty: '',
              target_qty: '',
              price: '',
              source_trace_id_array: []
            }
          ]
        });
        fetchProcessPos();
      } else {
        toast.error(data.error || 'Failed to create Process PO job');
      }
    } catch (err) {
      console.error(err);
      toast.error('Server error creating Process PO job');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Complete Production Handler
  const handleCompleteProduction = async (jobId, manufactureItemId) => {
    const inputVal = completedQtyInputs[manufactureItemId];
    const qtyNum = parseFloat(inputVal);

    if (isNaN(qtyNum) || qtyNum <= 0) {
      toast.warn('Please enter a valid positive completion quantity');
      return;
    }

    setIsProcessingComplete(true);
    try {
      const res = await fetch(`/api/process-po/${jobId}/complete-production`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          process_po_item_id: manufactureItemId,
          completed_qty: qtyNum
        })
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('Completed production processed successfully!');
        setCompletedQtyInputs(prev => ({ ...prev, [manufactureItemId]: '' }));
        fetchProcessPos();
        const updatedRes = await fetch('/api/process-po');
        if (updatedRes.ok) {
          const list = await updatedRes.json();
          const refreshedJob = list.find(j => j.id === jobId);
          if (refreshedJob) setViewingJob(refreshedJob);
        }
      } else {
        toast.error(data.error || 'Failed to process completed production');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error processing completed production');
    } finally {
      setIsProcessingComplete(false);
    }
  };

  const filteredList = processPoList.filter(job => {
    const q = searchQuery.toLowerCase();
    const poName = (job.po_no || '').toLowerCase();
    const msg = (job.message || '').toLowerCase();
    const itemsMatch = (job.items || []).some(item =>
      (item.source_item_code || '').toLowerCase().includes(q) ||
      (item.target_item_code || '').toLowerCase().includes(q) ||
      (item.source_item_description || '').toLowerCase().includes(q) ||
      (item.target_item_description || '').toLowerCase().includes(q)
    );
    return poName.includes(q) || msg.includes(q) || itemsMatch;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8">
      {/* Top Header & Toolbar */}
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div
              className="p-3 rounded-xl text-white shadow-md flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'var(--theme-color)' }}
            >
              <FileText size={24} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Process PO Directory</h1>
              <p className="text-slate-500 text-xs font-semibold mt-0.5">Manage process purchase orders and production trace history</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchProcessPos}
              className="p-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-600 transition-all cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            </button>

            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
              style={{ backgroundColor: 'var(--theme-color)' }}
            >
              <Plus size={16} />
              <span>New Process PO Job</span>
            </button>
          </div>
        </div>

        {/* Search & Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2 relative">
            <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors ${searchFocused ? 'text-slate-700' : 'text-slate-400'}`} size={16} />
            <input
              type="text"
              placeholder="Search by PO#, item code, description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] transition-all shadow-xs"
            />
          </div>

          <div className="bg-white border border-slate-200 p-3.5 rounded-xl flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
                <FileText size={16} />
              </div>
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider text-[10px]">Total Jobs</span>
            </div>
            <span className="text-base font-black text-slate-900">{processPoList.length}</span>
          </div>

          <div className="bg-white border border-slate-200 p-3.5 rounded-xl flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100">
                <Package size={16} />
              </div>
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider text-[10px]">Active Items</span>
            </div>
            <span className="text-base font-black text-slate-900">
              {processPoList.reduce((sum, j) => sum + (j.items ? j.items.length : 0), 0)}
            </span>
          </div>
        </div>

        {/* Directory Grid / Cards */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-slate-200 shadow-xs">
            <RefreshCw size={28} className="animate-spin text-indigo-600 mb-2" />
            <p className="text-slate-500 text-xs font-semibold">Loading Process PO directory...</p>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-slate-200 text-center px-4 shadow-xs">
            <div className="p-3 bg-slate-100 text-slate-400 rounded-full mb-2">
              <AlertCircle size={28} />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No Process PO jobs found</h3>
            <p className="text-slate-500 text-xs font-medium mt-1 max-w-sm">
              {searchQuery ? 'No results match your search term.' : 'Click "New Process PO Job" above to create your first process order.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredList.map((job) => (
              <div
                key={job.id}
                className="bg-white hover:border-slate-300 border border-slate-200 rounded-2xl p-5 shadow-sm transition-all duration-200 flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                        Job #{job.id}
                      </span>
                      <h3 className="text-base font-black text-slate-900 mt-1.5 group-hover:text-indigo-600 transition-colors">
                        {job.po_no}
                      </h3>
                    </div>

                    <button
                      onClick={() => setViewingJob(job)}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 transition-all cursor-pointer border border-slate-200"
                      title="View Details & Production Status"
                    >
                      <Eye size={15} />
                    </button>
                  </div>

                  {job.message && (
                    <p className="text-xs text-slate-600 line-clamp-2 mb-4 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 font-medium">
                      {job.message}
                    </p>
                  )}

                  <div className="space-y-1.5 mb-4 text-xs font-medium text-slate-600">
                    <div className="flex items-center gap-2">
                      <Calendar size={13} className="text-indigo-500" />
                      <span>PO Date: {job.date_of_start ? new Date(job.date_of_start).toLocaleDateString() : 'N/A'}</span>
                    </div>
                  </div>

                  {/* Items Summary Table Preview */}
                  <div className="border-t border-slate-100 pt-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Items Summary</p>
                    <div className="space-y-2">
                      {(job.items || []).slice(0, 2).map((item, idx) => (
                        <div key={idx} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
                          <div>
                            <p className="font-mono font-bold text-slate-800">{item.source_item_code || 'N/A'} <ArrowRight size={10} className="inline text-indigo-500" /> {item.target_item_code || 'N/A'}</p>
                            <p className="text-[10px] text-slate-500 font-semibold">Target Qty: <span className="text-indigo-700 font-bold">{item.target_qty}</span></p>
                          </div>
                          <span className="text-xs font-mono font-black text-slate-900">₹{parseFloat(item.price || 0).toFixed(2)}</span>
                        </div>
                      ))}
                      {(job.items || []).length > 2 && (
                        <p className="text-[10px] text-center text-slate-400 font-bold">
                          + {(job.items || []).length - 2} more item(s)
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4 mt-4 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-medium">
                    Created {new Date(job.created_at).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => setViewingJob(job)}
                    className="flex items-center gap-1 text-xs font-bold text-indigo-700 hover:text-indigo-800 transition-colors"
                  >
                    <span>Job Details</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CREATE NEW PROCESS PO JOB MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-6xl p-6 md:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-xl">
                  <FileText size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-950">Create New Process PO Job</h2>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">Select source trace items from inventory and set target manufacturing details</p>
                </div>
              </div>

              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitProcessPo} className="space-y-6">
              {/* Job Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Process PO Number/Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PPO-0001 or Heat Treatment Job"
                    value={formData.po_no}
                    onChange={(e) => setFormData(prev => ({ ...prev, po_no: e.target.value }))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">PO Date</label>
                  <input
                    type="date"
                    value={formData.date_of_start}
                    onChange={(e) => setFormData(prev => ({ ...prev, date_of_start: e.target.value }))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Delivery Date</label>
                  <input
                    type="date"
                    value={formData.date_of_end}
                    onChange={(e) => setFormData(prev => ({ ...prev, date_of_end: e.target.value }))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Process Message / Description</label>
                  <input
                    type="text"
                    placeholder="Additional process instructions or specifications..."
                    value={formData.message}
                    onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Items Section */}
              <div ref={dropdownContainerRef} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-600 uppercase tracking-wider">Process Items</h3>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-xs font-bold text-slate-700 rounded-lg transition-all cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Add Item Row</span>
                  </button>
                </div>

                {formData.items.map((item, idx) => (
                  <div key={idx} className="bg-slate-50/70 border border-slate-200 p-4 rounded-2xl space-y-4 relative">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="text-xs font-bold text-indigo-700">Item Row #{idx + 1}</span>
                      {formData.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(idx)}
                          className="text-red-600 hover:text-red-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <X size={14} />
                          <span>Remove Row</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                      {/* Searchable Source Item Code Dropdown */}
                      <div className="relative">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Source Item Code</label>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Type to search..."
                            value={item.source_item_code}
                            onChange={(e) => {
                              handleItemChange(idx, 'source_item_code', e.target.value);
                              setOpenDropdown({ rowIndex: idx, type: 'source' });
                            }}
                            onFocus={() => setOpenDropdown({ rowIndex: idx, type: 'source' })}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 pr-7"
                          />
                          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>

                        {/* Source Item Dropdown */}
                        {openDropdown.rowIndex === idx && openDropdown.type === 'source' && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto z-30 divide-y divide-slate-100">
                            {inventoryItems
                              .filter(inv => (inv.item_code || '').toLowerCase().includes((item.source_item_code || '').toLowerCase()))
                              .map((inv, iIdx) => (
                                <button
                                  key={iIdx}
                                  type="button"
                                  onClick={() => handleSelectSourceItem(idx, inv.item_code)}
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 text-slate-800 flex flex-col cursor-pointer"
                                >
                                  <span className="font-bold text-indigo-700 font-mono">{inv.item_code}</span>
                                  <span className="text-[10px] text-slate-500 truncate">{inv.description || 'No description'}</span>
                                </button>
                              ))}
                          </div>
                        )}
                      </div>

                      {/* Source Trace ID Array Button */}
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Source Trace Pop-up</label>
                        <button
                          type="button"
                          onClick={() => handleOpenTraceModal(idx)}
                          className="w-full bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Layers size={14} />
                          <span>Trace ({item.source_trace_id_array.length})</span>
                        </button>
                      </div>

                      {/* Searchable Target Item Code Dropdown */}
                      <div className="relative">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Target Item Code *</label>
                        <div className="relative">
                          <input
                            type="text"
                            required
                            placeholder="Type target code..."
                            value={item.target_item_code}
                            onChange={(e) => {
                              handleItemChange(idx, 'target_item_code', e.target.value);
                              setOpenDropdown({ rowIndex: idx, type: 'target' });
                            }}
                            onFocus={() => setOpenDropdown({ rowIndex: idx, type: 'target' })}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 pr-7"
                          />
                          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>

                        {/* Target Item Dropdown */}
                        {openDropdown.rowIndex === idx && openDropdown.type === 'target' && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto z-30 divide-y divide-slate-100">
                            {catalogItems
                              .filter(c => (c.item_code || '').toLowerCase().includes((item.target_item_code || '').toLowerCase()))
                              .map((cat, cIdx) => (
                                <button
                                  key={cIdx}
                                  type="button"
                                  onClick={() => handleSelectTargetItem(idx, cat.item_code)}
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 text-slate-800 flex flex-col cursor-pointer"
                                >
                                  <span className="font-bold text-indigo-700 font-mono">{cat.item_code}</span>
                                  <span className="text-[10px] text-slate-500 truncate">{cat.description || 'No description'}</span>
                                </button>
                              ))}
                          </div>
                        )}
                      </div>

                      {/* Quantities & Price */}
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Source Qty</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="0"
                          value={item.source_qty}
                          onChange={(e) => handleItemChange(idx, 'source_qty', e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Target Qty *</label>
                        <input
                          type="number"
                          step="any"
                          required
                          placeholder="0"
                          value={item.target_qty}
                          onChange={(e) => handleItemChange(idx, 'target_qty', e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Price (₹)</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="0.00"
                          value={item.price}
                          onChange={(e) => handleItemChange(idx, 'price', e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2.5 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: 'var(--theme-color)' }}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Creating Job...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>Create Process PO Job</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TRACE SELECTION POP-UP MODAL */}
      {traceModalState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-3xl p-6 shadow-2xl space-y-5 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <Layers className="text-indigo-600" size={20} />
                <h3 className="text-sm font-bold text-slate-900">
                  Select Trace Items for <span className="text-indigo-700 font-mono">{traceModalState.source_item_code}</span>
                </h3>
              </div>
              <button
                onClick={() => setTraceModalState(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            {traceModalState.loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                <RefreshCw size={24} className="animate-spin mb-2 text-indigo-600" />
                <span className="text-xs font-semibold">Fetching available trace items from inventory...</span>
              </div>
            ) : traceModalState.traceItems.length === 0 ? (
              <div className="py-10 text-center text-slate-500 text-xs font-medium">
                No active inventory trace items found for item code "{traceModalState.source_item_code}".
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-2.5 px-3">Select</th>
                      <th className="py-2.5 px-3">Trace ID</th>
                      <th className="py-2.5 px-3">Available Qty</th>
                      <th className="py-2.5 px-3">Price (₹)</th>
                      <th className="py-2.5 px-3">Consume Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white font-semibold text-slate-800">
                    {traceModalState.traceItems.map((tItem) => {
                      const isSelected = !!traceModalState.selectedSelections[tItem.trace_id];
                      const selectedObj = traceModalState.selectedSelections[tItem.trace_id] || {};

                      return (
                        <tr key={tItem.trace_id} className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-indigo-50/60' : ''}`}>
                          <td className="py-2.5 px-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleTraceCheckbox(tItem)}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">#{tItem.trace_id}</td>
                          <td className="py-2.5 px-3 text-slate-800">{tItem.available_qty}</td>
                          <td className="py-2.5 px-3 text-emerald-700 font-mono font-bold">₹{parseFloat(tItem.price || 0).toFixed(2)}</td>
                          <td className="py-2.5 px-3">
                            {isSelected ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  step="any"
                                  max={tItem.available_qty}
                                  min="0.01"
                                  value={selectedObj.Qty || ''}
                                  onChange={(e) => handleTraceQtyChange(tItem.trace_id, e.target.value)}
                                  className="w-24 bg-white border border-indigo-400 rounded-lg px-2 py-1 text-xs text-slate-900 font-bold focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleTraceQtyChange(tItem.trace_id, tItem.available_qty)}
                                  className="px-1.5 py-0.5 text-[9px] font-black uppercase bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded border border-indigo-300 cursor-pointer"
                                >
                                  Max
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[11px]">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-slate-200 pt-4">
              <span className="text-xs text-slate-500 font-bold">
                Selected: <span className="text-indigo-700 font-black">{Object.keys(traceModalState.selectedSelections).length}</span> item(s)
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setTraceModalState(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmTraceSelections}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm cursor-pointer"
                  style={{ backgroundColor: 'var(--theme-color)' }}
                >
                  Confirm Trace Items
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PROCESS PO JOB DETAILS POP-UP MODAL & PRODUCTION COMPLETION */}
      {viewingJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl p-6 md:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Process PO Job #{viewingJob.id}
                </span>
                <h2 className="text-xl font-black text-slate-950 mt-1">{viewingJob.po_no}</h2>
              </div>
              <button
                onClick={() => setViewingJob(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {viewingJob.message && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Process Instructions</p>
                <p className="text-xs text-slate-700 font-semibold">{viewingJob.message}</p>
              </div>
            )}

            {/* Items Breakdown & Complete Production Form */}
            <div className="space-y-6">
              <h3 className="text-xs font-black text-slate-600 uppercase tracking-wider">Job Items Breakdown</h3>

              {(viewingJob.items || []).map((mItem, idx) => (
                <div key={mItem.id || idx} className="bg-slate-50/70 border border-slate-200 p-5 rounded-2xl space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                    <div>
                      <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Item Row #{idx + 1}</span>
                      <p className="text-sm font-mono font-bold text-slate-900 mt-0.5">
                        {mItem.source_item_code || 'N/A'} <ArrowRight size={13} className="inline text-indigo-500 mx-1" /> {mItem.target_item_code || 'N/A'}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-medium">
                      <div>
                        <span className="text-slate-500">Target Qty: </span>
                        <span className="font-bold text-indigo-700">{mItem.target_qty}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Price: </span>
                        <span className="font-mono font-black text-slate-900">₹{parseFloat(mItem.price || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Trace Arrays Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="bg-white p-3 rounded-xl border border-slate-200">
                      <p className="font-bold text-slate-600 mb-1.5 flex items-center gap-1.5 text-[11px]">
                        <Layers size={13} className="text-indigo-600" />
                        <span>Source Trace IDs ({mItem.source_trace_id_array ? mItem.source_trace_id_array.length : 0})</span>
                      </p>
                      {Array.isArray(mItem.source_trace_id_array) && mItem.source_trace_id_array.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {mItem.source_trace_id_array.map((st, sIdx) => (
                            <span key={sIdx} className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono text-[10px] font-bold text-slate-700">
                              Trace #{st.trace_id || st.traceid} (Qty: {st.Qty})
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">— No source trace items</span>
                      )}
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-slate-200">
                      <p className="font-bold text-slate-600 mb-1.5 flex items-center gap-1.5 text-[11px]">
                        <CheckSquare size={13} className="text-emerald-600" />
                        <span>Target Trace IDs ({mItem.target_trace_id_array ? mItem.target_trace_id_array.length : 0})</span>
                      </p>
                      {Array.isArray(mItem.target_trace_id_array) && mItem.target_trace_id_array.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {mItem.target_trace_id_array.map((tt, tIdx) => (
                            <span key={tIdx} className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 rounded font-mono text-[10px] font-bold text-emerald-800">
                              Target Trace #{tt.traceid || tt.trace_id}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">— No remaining target trace items</span>
                      )}
                    </div>
                  </div>

                  {/* Complete Production Action Bar */}
                  <div className="bg-white border border-slate-200 p-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-xs">
                    <div>
                      <p className="text-xs font-bold text-slate-900">Complete Process PO Stock</p>
                      <p className="text-[11px] text-slate-500 font-semibold">Enter completed quantity to update trace item status to 'in inventory'</p>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <div className="relative flex-1 md:flex-initial">
                        <input
                          type="number"
                          step="any"
                          placeholder="Completed Qty"
                          value={completedQtyInputs[mItem.id] || ''}
                          onChange={(e) => setCompletedQtyInputs({ ...completedQtyInputs, [mItem.id]: e.target.value })}
                          className="w-full md:w-36 bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => setCompletedQtyInputs({ ...completedQtyInputs, [mItem.id]: mItem.target_qty })}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded cursor-pointer"
                        >
                          MAX
                        </button>
                      </div>

                      <button
                        type="button"
                        disabled={isProcessingComplete}
                        onClick={() => handleCompleteProduction(viewingJob.id, mItem.id)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
                      >
                        {isProcessingComplete ? 'Processing...' : 'Complete Production'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
