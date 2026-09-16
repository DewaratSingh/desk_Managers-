import React, { useState, useEffect, useRef } from 'react';
import { Factory, Search, RefreshCw, Plus, Calendar, Package, ArrowRight, X, MapPin, CheckCircle2, Clock, Trash2, Check, Layers, AlertCircle, ChevronDown, Eye, CheckSquare } from 'lucide-react';
import { toast } from 'react-toastify';

export default function ManufactureList() {
  const [manufactureList, setManufactureList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  // New Manufacture Job Form State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    process_name: '',
    date_of_start: '',
    date_of_end: '',
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

  // Manufacture Job Details Pop-up Modal State
  const [viewingJob, setViewingJob] = useState(null);
  const [completedQtyInputs, setCompletedQtyInputs] = useState({}); // manufacture_item_id -> completedQty string
  const [isProcessingComplete, setIsProcessingComplete] = useState(false);

  useEffect(() => {
    fetchManufactures();
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

  const fetchManufactures = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/manufacture');
      if (res.ok) {
        const data = await res.json();
        setManufactureList(data);
      } else {
        toast.error('Failed to load manufacture records');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error fetching manufacture data');
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

  // Open Trace Modal (`btn()`)
  const handleOpenTraceModal = async (rowIndex) => {
    const row = formData.items[rowIndex];
    if (!row.source_item_code) {
      toast.warn('Please select a Source Item Code first before picking trace items');
      return;
    }

    // Pre-populate existing selections
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
      const res = await fetch(`/api/manufacture/trace-items?item_code=${encodeURIComponent(row.source_item_code.trim())}`);
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

  const handleTraceQtyInput = (traceItem, qtyVal) => {
    const tid = traceItem.trace_id || traceItem.trace_item_id;
    const numQty = parseFloat(qtyVal);

    setTraceModalState(prev => {
      const newSelections = { ...prev.selectedSelections };
      if (isNaN(numQty) || numQty <= 0) {
        delete newSelections[tid];
      } else {
        newSelections[tid] = {
          trace_id: tid,
          Qty: numQty,
          inventory_id: traceItem.inventory_id,
          available_qty: traceItem.available_qty,
          price: traceItem.price
        };
      }
      return { ...prev, selectedSelections: newSelections };
    });
  };

  const handleMaxSelectTrace = (traceItem) => {
    handleTraceQtyInput(traceItem, traceItem.available_qty);
  };

  // Confirm Trace Modal Selections ("Select" button)
  const handleConfirmTraceSelections = () => {
    const { rowIndex, selectedSelections } = traceModalState;
    if (rowIndex === null) return;

    const selectionsArray = Object.values(selectedSelections).map(s => ({
      trace_id: s.trace_id,
      Qty: parseFloat(s.Qty) || 0,
      inventory_id: s.inventory_id
    }));

    // Auto calculate total source_qty from trace selections
    const totalSourceQty = selectionsArray.reduce((sum, s) => sum + s.Qty, 0);

    setFormData(prev => {
      const newItems = [...prev.items];
      newItems[rowIndex] = {
        ...newItems[rowIndex],
        source_trace_id_array: selectionsArray,
        source_qty: totalSourceQty > 0 ? totalSourceQty : newItems[rowIndex].source_qty
      };
      return { ...prev, items: newItems };
    });

    setTraceModalState(prev => ({ ...prev, isOpen: false }));
    toast.success(`Selected ${selectionsArray.length} trace item(s) (Total Qty: ${totalSourceQty})`);
  };

  // Open Details Pop-up Modal when clicking a manufacture row
  const handleOpenJobDetails = (job) => {
    setViewingJob(job);
    const initialInputs = {};
    (job.items || []).forEach(mi => {
      initialInputs[mi.id] = '';
    });
    setCompletedQtyInputs(initialInputs);
  };

  const handleSetMaxCompletedQty = (mi) => {
    setCompletedQtyInputs(prev => ({
      ...prev,
      [mi.id]: String(mi.target_qty || '')
    }));
  };

  // Submit Completed Qty logic
  const handleCompleteProduction = async (mi) => {
    const qtyVal = completedQtyInputs[mi.id];
    const parsedQty = parseFloat(qtyVal);

    if (isNaN(parsedQty) || parsedQty <= 0) {
      toast.error('Please enter a valid Completed Quantity greater than 0');
      return;
    }

    setIsProcessingComplete(true);
    try {
      const res = await fetch(`/api/manufacture/${viewingJob.id}/complete-production`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manufacture_item_id: mi.id,
          completed_qty: parsedQty
        })
      });

      if (res.ok) {
        toast.success(`Successfully processed production completion for Job #${viewingJob.id}!`);
        setViewingJob(null);
        fetchManufactures();
      } else {
        const errData = await res.json();
        toast.error(errData.error || 'Failed to complete production');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error completing production');
    } finally {
      setIsProcessingComplete(false);
    }
  };

  // Submit Final Manufacture Form
  const handleSubmitManufactureForm = async (e) => {
    e.preventDefault();
    if (!formData.process_name) {
      toast.error('Process Name is required');
      return;
    }

    for (let i = 0; i < formData.items.length; i++) {
      const item = formData.items[i];
      if (!item.target_item_code) {
        toast.error(`Item row #${i + 1}: Target Item is required`);
        return;
      }
      if (!item.target_qty || parseFloat(item.target_qty) <= 0) {
        toast.error(`Item row #${i + 1}: Qty for target must be greater than 0`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/manufacture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Manufacture Job #${data.id} created successfully!`);
        setShowCreateModal(false);
        // Reset form
        setFormData({
          process_name: '',
          date_of_start: '',
          date_of_end: '',
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
        fetchManufactures();
      } else {
        const errData = await res.json();
        toast.error(errData.error || 'Failed to create manufacture job');
      }
    } catch (err) {
      console.error(err);
      toast.error('An error occurred while creating manufacture job');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredList = manufactureList.filter(item => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const hasMatchInItems = (item.items || []).some(
      mi =>
        (mi.source_item_code && mi.source_item_code.toLowerCase().includes(q)) ||
        (mi.target_item_code && mi.target_item_code.toLowerCase().includes(q)) ||
        (mi.source_item_description && mi.source_item_description.toLowerCase().includes(q)) ||
        (mi.target_item_description && mi.target_item_description.toLowerCase().includes(q))
    );
    return (
      (item.process_name && item.process_name.toLowerCase().includes(q)) ||
      (item.message && item.message.toLowerCase().includes(q)) ||
      (String(item.id).includes(q)) ||
      hasMatchInItems
    );
  });

  // Unique lists for dropdown options
  const uniqueInventoryItems = Array.from(
    new Map(inventoryItems.map(inv => [inv.item_code, inv])).values()
  );

  const uniqueCatalogItems = Array.from(
    new Map(catalogItems.map(it => [it.item_code, it])).values()
  );

  return (
    <div className="flex-1 p-6 bg-slate-100 text-slate-900 font-sans min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* PAGE HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-300 gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl text-white shadow-sm" style={{ backgroundColor: 'var(--theme-color)' }}>
                <Factory size={22} />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Manufacture Directory</h1>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  Track manufacturing processes, trace stock transformation, and manage output logs.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={fetchManufactures}
              disabled={isLoading}
              className="p-2 bg-white border border-slate-300 hover:border-slate-400 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-xs cursor-pointer disabled:opacity-50"
              title="Refresh Records"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2.5 text-white font-bold text-xs rounded-xl transition-all shadow-sm cursor-pointer flex items-center gap-2"
              style={{ backgroundColor: 'var(--theme-color)' }}
              onMouseEnter={(e) => e.target.style.filter = 'brightness(0.9)'}
              onMouseLeave={(e) => e.target.style.filter = 'none'}
            >
              <Plus size={16} />
              New Job from Inventory
            </button>
          </div>
        </div>

        {/* SEARCH BAR */}
        <div 
          className="flex items-center gap-2.5 border border-slate-300 rounded-xl px-3.5 py-2.5 bg-white shadow-xs transition-all"
          style={{ borderColor: searchFocused ? 'var(--theme-color)' : 'rgb(203, 213, 225)' }}
        >
          <Search size={18} className="text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search by job ID, process name, source item, target item, remarks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className="w-full bg-transparent focus:outline-none text-xs text-slate-900 placeholder:text-slate-400 font-semibold"
          />
        </div>

        {/* MANUFACTURE DIRECTORY LIST TABLE */}
        <div className="border border-slate-300 rounded-2xl overflow-hidden bg-white shadow-sm">
          <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex justify-between items-center">
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Layers size={15} style={{ color: 'var(--theme-color)' }} />
              Manufacturing Records ({filteredList.length})
            </span>
            <span className="text-[10px] text-slate-400 font-semibold">Click any row to view details & complete production</span>
          </div>

          {isLoading && manufactureList.length === 0 ? (
            <div className="p-16 text-center text-slate-400 text-xs font-semibold flex flex-col items-center justify-center gap-2">
              <RefreshCw size={24} className="animate-spin text-slate-400" />
              Loading manufacture records...
            </div>
          ) : filteredList.length === 0 ? (
            <div className="p-16 text-center text-slate-400 text-xs font-semibold flex flex-col items-center justify-center gap-2">
              <Factory size={32} className="text-slate-300" />
              <span>No manufacture records found. Click "New Job from Inventory" to record one.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="px-4 py-3">Job ID</th>
                    <th className="px-4 py-3">Process Name</th>
                    <th className="px-4 py-3">Dates</th>
                    <th className="px-4 py-3">Manufactured Item Details</th>
                    <th className="px-4 py-3">Trace Arrays (Source / Target)</th>
                    <th className="px-4 py-3">Message / Remarks</th>
                    <th className="px-4 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredList.map((m) => (
                    <tr 
                      key={m.id} 
                      onClick={() => handleOpenJobDetails(m)}
                      className="hover:bg-indigo-50/40 transition-colors cursor-pointer"
                    >
                      {/* Job ID */}
                      <td className="px-4 py-3.5 font-mono font-bold text-slate-800 align-top">
                        <span className="bg-indigo-50 border border-indigo-200 text-indigo-800 px-2 py-0.5 rounded-md text-[11px] font-black shadow-2xs">
                          #MFG-{m.id}
                        </span>
                        <div className="text-[10px] text-slate-400 font-sans mt-1">
                          {new Date(m.created_at).toLocaleDateString()}
                        </div>
                      </td>

                      {/* Process Name */}
                      <td className="px-4 py-3.5 font-bold text-slate-900 align-top">
                        <div className="text-xs">{m.process_name}</div>
                      </td>

                      {/* Dates */}
                      <td className="px-4 py-3.5 text-slate-700 align-top">
                        <div className="flex items-center gap-1 font-semibold text-[11px]">
                          <Calendar size={12} className="text-slate-400 shrink-0" />
                          <span>Start: {m.date_of_start ? new Date(m.date_of_start).toLocaleDateString() : '—'}</span>
                        </div>
                        {m.date_of_end && (
                          <div className="text-[10px] text-slate-500 mt-0.5 font-medium">
                            End: {new Date(m.date_of_end).toLocaleDateString()}
                          </div>
                        )}
                      </td>

                      {/* Manufactured Items Breakdown */}
                      <td className="px-4 py-3.5 align-top min-w-[260px]">
                        <div className="space-y-2">
                          {(m.items || []).map((itemRow, idx) => (
                            <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[11px] space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-slate-800 flex items-center gap-1">
                                  <Package size={12} className="text-slate-400" />
                                  Source: {itemRow.source_item_code || '—'}
                                </span>
                                <span className="font-mono text-red-600 font-bold bg-red-50 border border-red-200 px-1.5 py-0.2 rounded text-[10px]">
                                  Qty: {itemRow.source_qty}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 text-slate-400 my-0.5 text-[10px]">
                                <ArrowRight size={12} />
                                <span>Produces</span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-indigo-700 flex items-center gap-1">
                                  <Package size={12} className="text-indigo-500" />
                                  Target: {itemRow.target_item_code || '—'}
                                </span>
                                <span className="font-mono text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded text-[10px]">
                                  Qty: {itemRow.target_qty}
                                </span>
                              </div>
                              {itemRow.price && parseFloat(itemRow.price) > 0 && (
                                <div className="text-right text-[10px] font-mono font-bold text-slate-700 pt-0.5">
                                  Price: ₹{parseFloat(itemRow.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* Trace Arrays */}
                      <td className="px-4 py-3.5 align-top min-w-[220px]">
                        <div className="space-y-2 text-[10px]">
                          {(m.items || []).map((itemRow, idx) => (
                            <div key={idx} className="space-y-1 bg-slate-50 border border-slate-200 rounded-lg p-2">
                              <div>
                                <span className="font-bold text-slate-600">Source Trace:</span>
                                {Array.isArray(itemRow.source_trace_id_array) && itemRow.source_trace_id_array.length > 0 ? (
                                  <div className="flex flex-wrap gap-1 mt-0.5">
                                    {itemRow.source_trace_id_array.map((st, i) => (
                                      <span key={i} className="bg-amber-50 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded font-mono font-bold">
                                        TR-{st.trace_id || st.traceid} (Qty: {st.Qty})
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 ml-1">—</span>
                                )}
                              </div>
                              <div>
                                <span className="font-bold text-slate-600">Target Trace:</span>
                                {Array.isArray(itemRow.target_trace_id_array) && itemRow.target_trace_id_array.length > 0 ? (
                                  <div className="flex flex-wrap gap-1 mt-0.5">
                                    {itemRow.target_trace_id_array.map((tt, i) => (
                                      <span key={i} className="bg-emerald-50 text-emerald-900 border border-emerald-300 px-1.5 py-0.2 rounded font-mono font-bold">
                                        TR-{tt.traceid || tt.trace_id}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 ml-1">—</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* Message / Remarks */}
                      <td className="px-4 py-3.5 text-slate-500 align-top max-w-[200px] truncate" title={m.message}>
                        {m.message || '—'}
                      </td>

                      {/* Action Button */}
                      <td className="px-4 py-3.5 text-center align-top">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenJobDetails(m);
                          }}
                          className="px-3 py-1.5 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-colors cursor-pointer flex items-center gap-1 mx-auto shadow-2xs"
                        >
                          <Eye size={13} />
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MANUFACTURE JOB DETAILS POP-UP MODAL (WITH COMPLETED QTY OPTION) */}
      {viewingJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white border border-slate-300 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
            
            {/* Modal Header */}
            <div className="bg-indigo-50 px-6 py-4 border-b border-indigo-200 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl text-white bg-indigo-600 shadow-xs">
                  <Factory size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-indigo-950 flex items-center gap-2">
                    Manufacture Job Details #{viewingJob.id}
                  </h2>
                  <p className="text-xs text-indigo-700 font-medium mt-0.5">
                    Process: <span className="font-bold">{viewingJob.process_name}</span> | Created: {new Date(viewingJob.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingJob(null)}
                className="p-1.5 hover:bg-indigo-100 rounded-xl text-indigo-800 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Job Info Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <span className="block text-[10px] font-bold text-slate-500 uppercase">Process Name</span>
                  <span className="text-sm font-black text-slate-900">{viewingJob.process_name}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-500 uppercase">Start / End Dates</span>
                  <span className="text-xs font-bold text-slate-800">
                    {viewingJob.date_of_start ? new Date(viewingJob.date_of_start).toLocaleDateString() : '—'}
                    {viewingJob.date_of_end ? ` to ${new Date(viewingJob.date_of_end).toLocaleDateString()}` : ''}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-500 uppercase">Remarks / Message</span>
                  <span className="text-xs font-semibold text-slate-700">{viewingJob.message || '—'}</span>
                </div>
              </div>

              {/* Items Breakdown and Completed Qty Section */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Package size={16} className="text-indigo-600" />
                  Manufactured Item Rows & Production Completion
                </h3>

                {(viewingJob.items || []).map((mi, idx) => (
                  <div key={mi.id || idx} className="border border-slate-200 rounded-2xl bg-white p-5 space-y-4 shadow-2xs">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                      <span className="text-xs font-black text-slate-800 flex items-center gap-2">
                        <Layers size={14} className="text-amber-600" />
                        Item Row #{idx + 1}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                        Price: ₹{parseFloat(mi.price || 0).toFixed(2)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Source Item Box */}
                      <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3.5 space-y-2">
                        <span className="text-[10px] font-black uppercase text-amber-900 tracking-wider">Source Item Consumed</span>
                        <div className="text-xs font-bold text-slate-900">{mi.source_item_code || '—'}</div>
                        <div className="text-[10px] text-slate-500 truncate">{mi.source_item_description}</div>
                        <div className="text-xs font-mono font-bold text-red-600">
                          Source Qty Consumed: {mi.source_qty}
                        </div>
                        <div className="pt-1 text-[10px]">
                          <span className="font-bold text-amber-900">Source Traces:</span>
                          {Array.isArray(mi.source_trace_id_array) && mi.source_trace_id_array.length > 0 ? (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {mi.source_trace_id_array.map((st, i) => (
                                <span key={i} className="bg-amber-100 border border-amber-300 text-amber-900 px-1.5 py-0.2 rounded font-mono font-bold">
                                  TR-{st.trace_id || st.traceid} (Qty: {st.Qty})
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 ml-1">—</span>
                          )}
                        </div>
                      </div>

                      {/* Target Item Box */}
                      <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3.5 space-y-2">
                        <span className="text-[10px] font-black uppercase text-emerald-900 tracking-wider">Target Item Manufactured</span>
                        <div className="text-xs font-bold text-indigo-700">{mi.target_item_code || '—'}</div>
                        <div className="text-[10px] text-slate-500 truncate">{mi.target_item_description}</div>
                        <div className="text-xs font-mono font-bold text-emerald-700">
                          Target Qty Manufactured: {mi.target_qty}
                        </div>
                        <div className="pt-1 text-[10px]">
                          <span className="font-bold text-emerald-900">Target Traces:</span>
                          {Array.isArray(mi.target_trace_id_array) && mi.target_trace_id_array.length > 0 ? (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {mi.target_trace_id_array.map((tt, i) => (
                                <span key={i} className="bg-emerald-100 border border-emerald-300 text-emerald-900 px-1.5 py-0.2 rounded font-mono font-bold">
                                  TR-{tt.traceid || tt.trace_id}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 ml-1">(None - Completed & Transitioned)</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Completed Qty Option Section */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <span className="text-xs font-black text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                          <CheckSquare size={15} className="text-emerald-600" />
                          Complete Production for Item #{idx + 1}
                        </span>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Enter completed quantity to update target trace status to <strong>'In Inventory'</strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1 shadow-2xs">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            placeholder="Qty"
                            value={completedQtyInputs[mi.id] || ''}
                            onChange={(e) => setCompletedQtyInputs(prev => ({ ...prev, [mi.id]: e.target.value }))}
                            className="w-24 bg-transparent focus:outline-none text-xs font-mono font-bold text-slate-900"
                          />
                          <button
                            type="button"
                            onClick={() => handleSetMaxCompletedQty(mi)}
                            className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-900 rounded-md border border-slate-200 transition-colors cursor-pointer"
                          >
                            Max
                          </button>
                        </div>

                        <button
                          type="button"
                          disabled={isProcessingComplete}
                          onClick={() => handleCompleteProduction(mi)}
                          className="px-4 py-2 text-white font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 shrink-0"
                        >
                          {isProcessingComplete ? (
                            <><RefreshCw size={14} className="animate-spin" /> Processing...</>
                          ) : (
                            <><Check size={14} /> Complete Production</>
                          )}
                        </button>
                      </div>
                    </div>

                  </div>
                ))}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingJob(null)}
                className="px-5 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Close Details
              </button>
            </div>

          </div>
        </div>
      )}

      {/* CREATE MANUFACTURE JOB FORM MODAL (WIDE VIEW: max-w-6xl) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white border border-slate-300 rounded-3xl max-w-6xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
            
            {/* Modal Header */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl text-white" style={{ backgroundColor: 'var(--theme-color)' }}>
                  <Factory size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">New Manufacture Job</h2>
                  <p className="text-xs text-slate-500 font-medium">Record source stock consumption and output target item transformation</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSubmitManufactureForm} className="flex-1 overflow-y-auto p-6 space-y-6" ref={dropdownContainerRef}>
              
              {/* Process Name, Dates, Message Header */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50/70 p-4 rounded-2xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Process Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Laser Cutting, Assembly"
                    value={formData.process_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, process_name: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-[var(--theme-color)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Date of Start
                  </label>
                  <input
                    type="date"
                    value={formData.date_of_start}
                    onChange={(e) => setFormData(prev => ({ ...prev, date_of_start: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-[var(--theme-color)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Date of End
                  </label>
                  <input
                    type="date"
                    value={formData.date_of_end}
                    onChange={(e) => setFormData(prev => ({ ...prev, date_of_end: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-[var(--theme-color)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Message / Remarks
                  </label>
                  <input
                    type="text"
                    placeholder="Process remarks or notes..."
                    value={formData.message}
                    onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-[var(--theme-color)]"
                  />
                </div>
              </div>

              {/* Items Table Section */}
              <div className="border border-slate-300 rounded-2xl overflow-hidden bg-white shadow-xs">
                <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex justify-between items-center">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Package size={15} style={{ color: 'var(--theme-color)' }} />
                    Manufacture Item Rows
                  </span>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="px-3 py-1.5 bg-white border border-slate-300 hover:border-slate-400 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  >
                    <Plus size={14} />
                    Add Item Row
                  </button>
                </div>

                <div className="p-4 space-y-4">
                  {formData.items.map((row, idx) => {
                    // Filter source inventory items matching typed text
                    const sourceSearch = (row.source_item_code || '').toLowerCase();
                    const filteredSourceSuggestions = uniqueInventoryItems.filter(
                      inv => (inv.item_code && inv.item_code.toLowerCase().includes(sourceSearch)) ||
                             (inv.description && inv.description.toLowerCase().includes(sourceSearch))
                    );

                    // Filter target catalog items matching typed text
                    const targetSearch = (row.target_item_code || '').toLowerCase();
                    const filteredTargetSuggestions = uniqueCatalogItems.filter(
                      it => (it.item_code && it.item_code.toLowerCase().includes(targetSearch)) ||
                            (it.description && it.description.toLowerCase().includes(targetSearch))
                    );

                    const isSourceDropdownOpen = openDropdown.rowIndex === idx && openDropdown.type === 'source';
                    const isTargetDropdownOpen = openDropdown.rowIndex === idx && openDropdown.type === 'target';

                    return (
                      <div key={idx} className="p-4 border border-slate-200 rounded-2xl bg-slate-50/50 space-y-3">
                        <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                          <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                            <Layers size={13} className="text-indigo-600" />
                            Item Row #{idx + 1}
                          </span>
                          {formData.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItemRow(idx)}
                              className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
                              title="Remove row"
                            >
                              <Trash2 size={14} /> Remove Row
                            </button>
                          )}
                        </div>

                        {/* Row Inputs: 12-Column Grid Layout for Spacious Fit */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">
                          
                          {/* Trace Button (2 Cols) */}
                          <div className="md:col-span-2">
                            <button
                              type="button"
                              onClick={() => handleOpenTraceModal(idx)}
                              className={`w-full py-2.5 px-3 rounded-xl text-xs font-black border transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs ${
                                row.source_trace_id_array && row.source_trace_id_array.length > 0
                                  ? 'bg-amber-100 border-amber-300 text-amber-900 hover:bg-amber-200'
                                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <Layers size={14} className="shrink-0" />
                              <span>
                                {row.source_trace_id_array && row.source_trace_id_array.length > 0
                                  ? `Traced (${row.source_trace_id_array.length})`
                                  : 'Trace Stock'}
                              </span>
                            </button>
                          </div>

                          {/* Source Item Searchable Select Dropdown (3 Cols) */}
                          <div className="md:col-span-3 relative">
                            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                              Source Item (Inventory Stock)
                            </label>
                            <div className="relative">
                              <input
                                type="text"
                                placeholder="Search inventory item..."
                                value={row.source_item_code}
                                onChange={(e) => handleItemChange(idx, 'source_item_code', e.target.value)}
                                onFocus={() => setOpenDropdown({ rowIndex: idx, type: 'source' })}
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:border-[var(--theme-color)] pr-8"
                                autoComplete="off"
                              />
                              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>

                            {/* Dropdown Suggestions */}
                            {isSourceDropdownOpen && filteredSourceSuggestions.length > 0 && (
                              <div className="absolute z-40 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-56 overflow-y-auto divide-y divide-slate-100 animate-fade-in">
                                {filteredSourceSuggestions.map((inv) => (
                                  <button
                                    key={inv.item_code}
                                    type="button"
                                    onClick={() => handleSelectSourceItem(idx, inv.item_code)}
                                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 transition-colors cursor-pointer flex flex-col gap-0.5"
                                  >
                                    <div className="font-bold text-xs text-slate-900">{inv.item_code}</div>
                                    <div className="text-[10px] text-slate-500 truncate">{inv.description || 'No description'}</div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Source Qty (1.5 Cols) */}
                          <div className="md:col-span-1 border-r border-slate-200 pr-2">
                            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                              Source Qty
                            </label>
                            <input
                              type="number"
                              step="any"
                              placeholder="0"
                              value={row.source_qty}
                              onChange={(e) => handleItemChange(idx, 'source_qty', e.target.value)}
                              className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:border-[var(--theme-color)] text-right font-mono"
                            />
                          </div>

                          {/* Target Item Searchable Select Dropdown (3.5 Cols) */}
                          <div className="md:col-span-3.5 relative">
                            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                              Target Item (Catalog) <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                              <input
                                type="text"
                                required
                                placeholder="Search catalog item..."
                                value={row.target_item_code}
                                onChange={(e) => handleItemChange(idx, 'target_item_code', e.target.value)}
                                onFocus={() => setOpenDropdown({ rowIndex: idx, type: 'target' })}
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:border-[var(--theme-color)] pr-8"
                                autoComplete="off"
                              />
                              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>

                            {/* Dropdown Suggestions */}
                            {isTargetDropdownOpen && filteredTargetSuggestions.length > 0 && (
                              <div className="absolute z-40 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-56 overflow-y-auto divide-y divide-slate-100 animate-fade-in">
                                {filteredTargetSuggestions.map((cat) => (
                                  <button
                                    key={cat.item_code}
                                    type="button"
                                    onClick={() => handleSelectTargetItem(idx, cat.item_code)}
                                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 transition-colors cursor-pointer flex flex-col gap-0.5"
                                  >
                                    <div className="font-bold text-xs text-indigo-700">{cat.item_code}</div>
                                    <div className="text-[10px] text-slate-500 truncate">{cat.description || 'No description'}</div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Target Qty (1 Col) */}
                          <div className="md:col-span-1">
                            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                              Target Qty <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="number"
                              step="any"
                              required
                              placeholder="0"
                              value={row.target_qty}
                              onChange={(e) => handleItemChange(idx, 'target_qty', e.target.value)}
                              className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:border-[var(--theme-color)] text-right font-mono"
                            />
                          </div>

                          {/* Price (1 Col) */}
                          <div className="md:col-span-1">
                            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                              Price (₹)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={row.price}
                              onChange={(e) => handleItemChange(idx, 'price', e.target.value)}
                              className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:border-[var(--theme-color)] text-right font-mono"
                            />
                          </div>

                        </div>

                        {/* Display Selected Trace Summary */}
                        {row.source_trace_id_array && row.source_trace_id_array.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-semibold text-slate-600 border-t border-slate-200 mt-2">
                            <span className="font-black text-amber-900 uppercase text-[10px]">Selected Source Traces:</span>
                            {row.source_trace_id_array.map((st, i) => (
                              <span key={i} className="bg-amber-100 border border-amber-300 text-amber-900 px-2 py-0.5 rounded-md font-mono font-bold text-[10px] shadow-2xs">
                                TR-{st.trace_id} (Qty: {st.Qty})
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 text-white font-bold text-xs rounded-xl transition-all shadow-sm cursor-pointer flex items-center gap-2 disabled:opacity-50"
                  style={{ backgroundColor: 'var(--theme-color)' }}
                  onMouseEnter={(e) => e.target.style.filter = 'brightness(0.9)'}
                  onMouseLeave={(e) => e.target.style.filter = 'none'}
                >
                  {isSubmitting ? (
                    <><RefreshCw size={15} className="animate-spin" /> Creating Job...</>
                  ) : (
                    'Create Manufacture Job'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TRACE FROM INVENTORY POP-UP MODAL (`btn()`) */}
      {traceModalState.isOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white border border-slate-300 rounded-3xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
            
            {/* Modal Header */}
            <div className="bg-amber-50 px-6 py-4 border-b border-amber-200 flex justify-between items-center">
              <div>
                <h3 className="text-base font-black text-amber-950 flex items-center gap-2">
                  <Layers size={18} className="text-amber-700" />
                  Select Trace Items for Source ({traceModalState.source_item_code})
                </h3>
                <p className="text-xs text-amber-800 font-medium mt-0.5">
                  Pick specific inventory trace items to consume and specify quantity for each
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTraceModalState(prev => ({ ...prev, isOpen: false }))}
                className="p-1 hover:bg-amber-100 rounded-xl text-amber-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body / Table */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {traceModalState.loading ? (
                <div className="p-12 text-center text-slate-400 text-xs font-semibold flex flex-col items-center justify-center gap-2">
                  <RefreshCw size={20} className="animate-spin text-amber-600" />
                  Loading inventory trace items for {traceModalState.source_item_code}...
                </div>
              ) : traceModalState.traceItems.length === 0 ? (
                <div className="p-10 text-center text-slate-500 text-xs font-semibold flex flex-col items-center justify-center gap-2 bg-amber-50/50 rounded-2xl border border-amber-200">
                  <AlertCircle size={24} className="text-amber-600" />
                  <span>No available inventory stock found for source item code <strong>'{traceModalState.source_item_code}'</strong>.</span>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                        <th className="px-3.5 py-2.5">Trace ID</th>
                        <th className="px-3.5 py-2.5">Item Code</th>
                        <th className="px-3.5 py-2.5 text-right">Available Qty</th>
                        <th className="px-3.5 py-2.5 text-right">Price (₹)</th>
                        <th className="px-3.5 py-2.5">Qty to Consume</th>
                        <th className="px-3.5 py-2.5 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white font-semibold">
                      {traceModalState.traceItems.map((item) => {
                        const tid = item.trace_id || item.trace_item_id;
                        const currentSel = traceModalState.selectedSelections[tid];
                        const currentQty = currentSel ? currentSel.Qty : '';

                        return (
                          <tr key={item.inventory_id || tid} className="hover:bg-amber-50/30 transition-colors">
                            <td className="px-3.5 py-2.5 font-mono font-bold text-slate-900">
                              <span className="bg-amber-100 border border-amber-300 text-amber-900 px-1.5 py-0.5 rounded text-[10px]">
                                TR-{tid}
                              </span>
                            </td>
                            <td className="px-3.5 py-2.5 text-slate-800">{item.item_code}</td>
                            <td className="px-3.5 py-2.5 text-right font-mono font-black text-slate-900">
                              {item.available_qty}
                            </td>
                            <td className="px-3.5 py-2.5 text-right font-mono text-slate-700">
                              ₹{parseFloat(item.price || 0).toFixed(2)}
                            </td>
                            <td className="px-3.5 py-2.5">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                max={item.available_qty}
                                placeholder="0"
                                value={currentQty}
                                onChange={(e) => handleTraceQtyInput(item, e.target.value)}
                                className="w-24 px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500"
                              />
                            </td>
                            <td className="px-3.5 py-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleMaxSelectTrace(item)}
                                className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-md bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 border border-slate-200 transition-colors cursor-pointer"
                              >
                                Max Select
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex justify-between items-center">
              <div className="text-xs font-bold text-slate-700">
                Selected: <span className="text-amber-900 font-mono font-black">{Object.keys(traceModalState.selectedSelections).length}</span> trace item(s)
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTraceModalState(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmTraceSelections}
                  className="px-5 py-2 text-white font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                  style={{ backgroundColor: 'var(--theme-color)' }}
                >
                  <Check size={14} />
                  Select & Apply Traces
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
