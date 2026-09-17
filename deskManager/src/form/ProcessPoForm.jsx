import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, FileText, Plus, Calendar, Package, ArrowRight, X,
  Layers, AlertCircle, ChevronDown, Check, Trash2, RefreshCw, Cpu
} from 'lucide-react';
import { toast } from 'react-toastify';

export default function ProcessPoForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rqProcessNo = searchParams.get('rq_process_no') || '';
  const tradeId = searchParams.get('trade_id') || '';

  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysLater = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    po_no: '',
    date_of_start: today,
    date_of_end: thirtyDaysLater,
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

  // Catalog & Inventory Items for Searchable Dropdowns
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

  // Fetch Catalogs & RQ Process Data on Mount
  useEffect(() => {
    fetchCatalogItems();
    fetchInventoryItems();
    if (rqProcessNo) {
      fetchRqData(rqProcessNo);
    }
  }, [rqProcessNo]);

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

  const fetchRqData = async (rqNo) => {
    try {
      const res = await fetch(`/api/rq-process/${encodeURIComponent(rqNo)}`);
      if (res.ok) {
        const data = await res.json();
        setFormData(prev => ({
          ...prev,
          received_q_id: data.id || '',
          message: data.message ? `Linked RQ: ${rqNo} - ${data.message}` : `Linked RQ: ${rqNo}`,
          items: Array.isArray(data.items) && data.items.length > 0
            ? data.items.map(it => ({
                source_item_code: it.source_item_code || '',
                target_item_code: it.target_item_code || '',
                source_qty: it.source_item_quantity || '',
                target_qty: it.target_item_quantity || '',
                price: it.price || '',
                source_trace_id_array: []
              }))
            : prev.items
        }));
      }
    } catch (err) {
      console.error('Error fetching RQ process details:', err);
    }
  };

  // Handlers for Form Item Rows
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

  // Submit Process PO Form
  const handleSubmit = async (e) => {
    e.preventDefault();

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
      const payload = {
        ...formData,
        trade_id: tradeId || null,
        rq_process_no: rqProcessNo || null
      };

      const res = await fetch('/api/process-po', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Process PO created successfully!');
        if (tradeId) {
          navigate(`/trade/${tradeId}`);
        } else {
          navigate('/order');
        }
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-xl text-white shadow-sm flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'var(--theme-color)' }}
            >
              <Cpu size={20} />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-950">Create Process Purchase Order</h1>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                {rqProcessNo && <>RQ Ref: <span className="font-mono font-bold text-indigo-700">{rqProcessNo}</span></>}
                {tradeId && <> · Trade: <span className="font-mono font-bold text-slate-700">{tradeId}</span></>}
                {!rqProcessNo && !tradeId && 'Create a new standalone process purchase order'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => tradeId ? navigate(`/trade/${tradeId}`) : navigate('/order')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-all cursor-pointer shrink-0"
          >
            <ArrowLeft size={14} /> Back
          </button>
        </div>

        {/* Main Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Metadata Grid */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">Process PO Details</h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Process PO Number/Name</label>
                <input
                  type="text"
                  placeholder="Auto-generated if blank (e.g. PPO-0001)"
                  value={formData.po_no}
                  onChange={(e) => setFormData(prev => ({ ...prev, po_no: e.target.value }))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">PO Date *</label>
                <input
                  type="date"
                  required
                  value={formData.date_of_start}
                  onChange={(e) => setFormData(prev => ({ ...prev, date_of_start: e.target.value }))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Expected Delivery Date</label>
                <input
                  type="date"
                  value={formData.date_of_end}
                  onChange={(e) => setFormData(prev => ({ ...prev, date_of_end: e.target.value }))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Process Message / Description</label>
                <input
                  type="text"
                  placeholder="Additional processing instructions or notes..."
                  value={formData.message}
                  onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Items Table Grid */}
          <div ref={dropdownContainerRef} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">Process Item Mappings</h3>
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
                      <Trash2 size={14} />
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

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => tradeId ? navigate(`/trade/${tradeId}`) : navigate('/order')}
              className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition-all cursor-pointer bg-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50"
              style={{ backgroundColor: 'var(--theme-color)' }}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Creating Process PO...</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>Create Process PO</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

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
                type="button"
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
    </div>
  );
}
