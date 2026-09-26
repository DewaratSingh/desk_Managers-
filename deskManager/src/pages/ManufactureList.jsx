import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Factory, Search, RefreshCw, Plus, Calendar, Package, ArrowRight, X, MapPin, CheckCircle2, Clock, Check, Layers, AlertCircle, Trash2, Eye, CheckSquare, Building2, Tag, ShoppingCart, Cpu } from 'lucide-react';
import { toast } from 'react-toastify';

import InventoryTraceSelectorModal from '../components/InventoryTraceSelectorModal';
import TargetItemSelectorModal from '../components/TargetItemSelectorModal';

export default function ManufactureList() {
  const navigate = useNavigate();
  const location = useLocation();

  const [manufactureList, setManufactureList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  // New Manufacture Job Form State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    process_name: '',
    date_of_start: new Date().toISOString().split('T')[0],
    date_of_end: '',
    message: '',
    source_items: [], // Array of { item_code, description, trace_item_id, qty, available_qty }
    target_items: []  // Array of { item_code, description, qty, price }
  });

  // Modal Visibility States
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);

  // Manufacture Job Production Completion Modal State
  const [viewingJob, setViewingJob] = useState(null);
  const [targetCompletionItems, setTargetCompletionItems] = useState([]);
  const [isProcessingComplete, setIsProcessingComplete] = useState(false);

  useEffect(() => {
    fetchManufactures();
  }, []);

  // Handle return state from /inventory/form after warehouse location selection
  useEffect(() => {
    if (location.state?.returnState && location.state?.inventoryDetails) {
      const { returnState, inventoryDetails, updatedQty } = location.state;
      const { jobId, targetItemCode, completionItems } = returnState;

      const updateJobAndItems = (jobsList) => {
        const foundJob = jobsList.find(j => j.id === jobId || String(j.id) === String(jobId));
        if (!foundJob) return;

        let baseItems = completionItems;
        if (!baseItems || baseItems.length === 0) {
          const rawTgtItems = Array.isArray(foundJob.target_items) && foundJob.target_items.length > 0
            ? foundJob.target_items
            : (foundJob.items || []).map(i => ({ item_code: i.target_item_code, description: i.target_item_description, qty: i.target_qty, price: i.price, id: i.id }));

          baseItems = rawTgtItems.map(tgt => {
            const orderQty = parseFloat(tgt.qty) || 0;
            const deliveredQty = parseFloat(tgt.delivered_qty !== undefined ? tgt.delivered_qty : (foundJob.status === 'completed' ? orderQty : 0)) || 0;
            const remainingQty = Math.max(0, orderQty - deliveredQty);
            return {
              id: tgt.id,
              item_code: tgt.item_code,
              description: tgt.description || '',
              drawing_number: tgt.drawing_number || '',
              order_qty: orderQty,
              delivered_qty: deliveredQty,
              remaining_qty: remainingQty,
              completion_qty: 0,
              price: tgt.price || 0,
              selected: false
            };
          });
        }

        const updatedItems = baseItems.map(item => {
          if (item.item_code === targetItemCode) {
            return {
              ...item,
              completion_qty: updatedQty !== undefined && updatedQty !== null ? updatedQty : item.completion_qty,
              inventoryDetails: inventoryDetails,
              configured: true,
              selected: true
            };
          }
          return item;
        });

        setViewingJob(foundJob);
        setTargetCompletionItems(updatedItems);
      };

      if (manufactureList.length > 0) {
        updateJobAndItems(manufactureList);
      } else {
        fetch('/api/manufacture')
          .then(res => res.json())
          .then(data => {
            setManufactureList(data);
            updateJobAndItems(data);
          })
          .catch(err => console.error(err));
      }

      window.history.replaceState({}, document.title);
    }
  }, [location.state, manufactureList]);

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

  // Handlers for Source Items Selection (InventoryTraceSelectorModal)
  const handleApplySourceSelections = (selectionsArray) => {
    if (!Array.isArray(selectionsArray) || selectionsArray.length === 0) return;

    const newSourceItems = selectionsArray.map(st => ({
      item_code: st.item_code || '',
      description: st.description || '',
      trace_item_id: st.trace_id || st.trace_item_id || null,
      qty: st.Qty !== undefined && st.Qty !== null ? String(st.Qty) : '',
      available_qty: st.available_qty || ''
    }));

    setFormData(prev => ({
      ...prev,
      source_items: newSourceItems
    }));

    setIsSourceModalOpen(false);
    toast.success(`Selected ${newSourceItems.length} source trace item(s)`);
  };

  const handleUpdateSourceQty = (index, qtyVal) => {
    setFormData(prev => {
      const updated = [...prev.source_items];
      updated[index] = { ...updated[index], qty: qtyVal };
      return { ...prev, source_items: updated };
    });
  };

  const handleRemoveSourceItem = (index) => {
    setFormData(prev => ({
      ...prev,
      source_items: prev.source_items.filter((_, idx) => idx !== index)
    }));
  };

  // Handlers for Target Items Selection (TargetItemSelectorModal)
  const handleApplyTargetSelection = (targetObj) => {
    setFormData(prev => ({
      ...prev,
      target_items: [
        ...prev.target_items,
        {
          item_code: targetObj.item_code,
          description: targetObj.description || '',
          qty: targetObj.qty !== undefined ? String(targetObj.qty) : '',
          price: targetObj.price !== undefined ? String(targetObj.price) : ''
        }
      ]
    }));

    setIsTargetModalOpen(false);
    toast.success(`Added Target Item ${targetObj.item_code}`);
  };

  const handleUpdateTargetField = (index, field, value) => {
    setFormData(prev => {
      const updated = [...prev.target_items];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, target_items: updated };
    });
  };

  const handleRemoveTargetItem = (index) => {
    setFormData(prev => ({
      ...prev,
      target_items: prev.target_items.filter((_, idx) => idx !== index)
    }));
  };

  // Open Details & Production Completion Modal for a Job
  const handleOpenJobDetails = (job) => {
    setViewingJob(job);

    // Build completion items table formatted similarly to Delivery Note Form table
    const rawTgtItems = Array.isArray(job.target_items) && job.target_items.length > 0
      ? job.target_items
      : (job.items || []).map(i => ({ item_code: i.target_item_code, description: i.target_item_description, qty: i.target_qty, price: i.price, id: i.id }));

    const formattedTgtItems = rawTgtItems.map(tgt => {
      const orderQty = parseFloat(tgt.qty) || 0;
      const deliveredQty = parseFloat(tgt.delivered_qty !== undefined ? tgt.delivered_qty : (job.status === 'completed' ? orderQty : 0)) || 0;
      const remainingQty = Math.max(0, orderQty - deliveredQty);
      return {
        id: tgt.id,
        item_code: tgt.item_code,
        description: tgt.description || '',
        drawing_number: tgt.drawing_number || '',
        order_qty: orderQty,
        delivered_qty: deliveredQty,
        remaining_qty: remainingQty,
        completion_qty: 0,
        price: tgt.price || 0,
        selected: false
      };
    });

    setTargetCompletionItems(formattedTgtItems);
  };

  const handleTargetItemCheckboxChange = (index) => {
    setTargetCompletionItems(prev => prev.map((it, idx) => {
      if (idx !== index) return it;
      const newSel = !it.selected;
      return {
        ...it,
        selected: newSel,
        completion_qty: newSel ? (it.remaining_qty > 0 ? it.remaining_qty : it.order_qty) : 0
      };
    }));
  };

  const handleTargetItemQtyChange = (index, value) => {
    const parsedVal = parseFloat(value) || 0;
    setTargetCompletionItems(prev => prev.map((it, idx) => {
      if (idx !== index) return it;
      return {
        ...it,
        completion_qty: parsedVal,
        selected: parsedVal > 0 ? true : it.selected
      };
    }));
  };

  // Navigates to Inventory form to add target item to inventory with prefilled data
  const handleAddInInventory = (item) => {
    if (!viewingJob) return;
    const qtyToAdd = item.completion_qty || item.remaining_qty || item.order_qty;
    const priceVal = item.price || 0;

    navigate('/inventory/form', {
      state: {
        autofill: {
          item_code: item.item_code,
          quantity: qtyToAdd,
          price: priceVal,
          status: 'In Inventory',
          actionType: 'inventory',
          existingDetails: {
            location: item.inventoryDetails?.location || 'Warehouse A',
            rack: item.inventoryDetails?.rack || '',
            shelf_number: item.inventoryDetails?.shelf_number || '',
            message: `Manufactured Stock via Job #${viewingJob.id} (${viewingJob.process_name})`
          },
          returnUrl: '/manufacture',
          returnState: {
            jobId: viewingJob.id,
            targetItemCode: item.item_code,
            completionItems: targetCompletionItems
          }
        }
      }
    });
  };

  // Submit Completed Qty for selected target items
  const handleCompleteProduction = async (e) => {
    e.preventDefault();
    if (!viewingJob) return;

    const selectedItems = targetCompletionItems.filter(i => i.selected);
    if (selectedItems.length === 0) {
      toast.error('Please select at least one Target Item to complete production');
      return;
    }

    for (let i = 0; i < selectedItems.length; i++) {
      const it = selectedItems[i];
      const q = parseFloat(it.completion_qty);
      if (isNaN(q) || q <= 0) {
        toast.error(`Item ${it.item_code}: Completion Quantity must be greater than 0`);
        return;
      }
    }

    const payloadItems = selectedItems.map(item => ({
      item_code: item.item_code,
      completed_qty: parseFloat(item.completion_qty) || 0,
      location: item.inventoryDetails?.location || 'Warehouse A',
      rack: item.inventoryDetails?.rack || null,
      shelf_number: item.inventoryDetails?.shelf_number || null,
      target_status: item.inventoryDetails?.status || 'In Inventory',
      price: parseFloat(item.price) || 0
    }));

    setIsProcessingComplete(true);
    try {
      const res = await fetch(`/api/manufacture/${viewingJob.id}/complete-production`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_items: payloadItems,
          remarks: `Completed Job #${viewingJob.id} (${viewingJob.process_name})`
        })
      });

      if (res.ok) {
        toast.success(`Successfully completed production for Job #${viewingJob.id}!`);
        setViewingJob(null);
        setTargetCompletionItems([]);
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

  // Submit Manufacture Job Form
  const handleSubmitManufactureForm = async (e) => {
    e.preventDefault();
    if (!formData.process_name || !formData.process_name.trim()) {
      toast.error('Process Name is required');
      return;
    }
    if (formData.source_items.length === 0) {
      toast.error('Please select at least one Source Item using "Select Source Trace Items"');
      return;
    }
    if (formData.target_items.length === 0) {
      toast.error('Please select at least one Target Item using "Add Target Item"');
      return;
    }

    for (let i = 0; i < formData.source_items.length; i++) {
      const src = formData.source_items[i];
      const q = parseFloat(src.qty);
      if (isNaN(q) || q <= 0) {
        toast.error(`Source Item #${i + 1} (${src.item_code}): Quantity must be greater than 0`);
        return;
      }
    }

    for (let i = 0; i < formData.target_items.length; i++) {
      const tgt = formData.target_items[i];
      const q = parseFloat(tgt.qty);
      if (isNaN(q) || q <= 0) {
        toast.error(`Target Item #${i + 1} (${tgt.item_code}): Target Quantity must be greater than 0`);
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
          date_of_start: new Date().toISOString().split('T')[0],
          date_of_end: '',
          message: '',
          source_items: [],
          target_items: []
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
    const srcList = item.source_items || [];
    const tgtList = item.target_items || [];
    const hasSrcMatch = srcList.some(s => s.item_code && s.item_code.toLowerCase().includes(q));
    const hasTgtMatch = tgtList.some(t => t.item_code && t.item_code.toLowerCase().includes(q));
    return (
      (item.process_name && item.process_name.toLowerCase().includes(q)) ||
      (item.message && item.message.toLowerCase().includes(q)) ||
      (String(item.id).includes(q)) ||
      hasSrcMatch ||
      hasTgtMatch
    );
  });

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
                  Track multi-source and multi-target manufacturing jobs, transformation, and production completion.
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
            placeholder="Search by job ID, process name, source items, target items, remarks..."
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
              Manufacturing Jobs ({filteredList.length})
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
                    <th className="px-4 py-3">Source Items Consumed</th>
                    <th className="px-4 py-3">Target Items Produced</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredList.map((m) => {
                    const srcList = Array.isArray(m.source_items) && m.source_items.length > 0
                      ? m.source_items
                      : (m.items || []).map(i => ({ item_code: i.source_item_code, qty: i.source_qty, trace_item_id: i.source_trace_id_array?.[0]?.trace_id }));

                    const tgtList = Array.isArray(m.target_items) && m.target_items.length > 0
                      ? m.target_items
                      : (m.items || []).map(i => ({ item_code: i.target_item_code, qty: i.target_qty, price: i.price }));

                    const isCompleted = m.status === 'completed';

                    return (
                      <tr 
                        key={m.id} 
                        onClick={() => handleOpenJobDetails(m)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      >
                        {/* Job ID */}
                        <td className="px-4 py-3.5 font-mono font-bold text-slate-800 align-top">
                          <span
                            className="px-2 py-0.5 rounded-md text-[11px] font-black border shadow-2xs"
                            style={{ color: 'var(--theme-color)', borderColor: 'var(--theme-color)', backgroundColor: 'rgba(0,0,0,0.03)' }}
                          >
                            #MFG-{m.id}
                          </span>
                          <div className="text-[10px] text-slate-400 font-sans mt-1">
                            {new Date(m.created_at).toLocaleDateString()}
                          </div>
                        </td>

                        {/* Process Name */}
                        <td className="px-4 py-3.5 font-bold text-slate-900 align-top">
                          <div className="text-xs">{m.process_name}</div>
                          {m.message && <div className="text-[10px] text-slate-400 font-normal truncate max-w-[150px]">{m.message}</div>}
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

                        {/* Source Items */}
                        <td className="px-4 py-3.5 align-top min-w-[200px]">
                          <div className="space-y-1.5">
                            {srcList.map((src, i) => (
                              <div key={i} className="bg-amber-50/70 border border-amber-200 rounded-lg p-2 text-[11px]">
                                <div className="font-bold text-slate-900">{src.item_code || '—'}</div>
                                {src.trace_item_id && (
                                  <span className="text-[9px] font-mono font-bold text-amber-900 bg-amber-100 border border-amber-300 px-1 py-0.2 rounded">
                                    TR-{src.trace_item_id}
                                  </span>
                                )}
                                <div className="font-mono text-red-600 font-bold text-[10px] mt-0.5">
                                  Qty: {src.qty || 0}
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>

                        {/* Target Items */}
                        <td className="px-4 py-3.5 align-top min-w-[200px]">
                          <div className="space-y-1.5">
                            {tgtList.map((tgt, i) => (
                              <div key={i} className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-2 text-[11px]">
                                <div className="font-bold text-slate-900">{tgt.item_code || '—'}</div>
                                <div className="flex items-center justify-between font-mono text-[10px] pt-0.5">
                                  <span className="font-bold text-emerald-700">
                                    Delivered: {tgt.delivered_qty || (isCompleted ? (tgt.qty || 0) : 0)} / {tgt.qty || 0}
                                  </span>
                                  {tgt.price && parseFloat(tgt.price) > 0 && (
                                    <span className="font-bold text-slate-700">₹{parseFloat(tgt.price).toFixed(2)}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5 text-center align-top">
                          <span className={`px-2.5 py-1 text-[10px] font-black rounded-lg border uppercase tracking-wider inline-flex items-center gap-1 ${
                            isCompleted
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : 'bg-amber-50 text-amber-800 border-amber-300'
                          }`}>
                            {isCompleted ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                            {isCompleted ? 'Completed' : 'In Progress'}
                          </span>
                        </td>

                        {/* Action Button */}
                        <td className="px-4 py-3.5 text-center align-top">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenJobDetails(m);
                            }}
                            className="px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors cursor-pointer flex items-center gap-1 mx-auto shadow-2xs"
                          >
                            <Eye size={13} />
                            Details
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
      </div>

      {/* MANUFACTURE JOB PRODUCTION COMPLETION MODAL */}
      {viewingJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white border border-slate-300 rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
            
            {/* TOP SECTION: Job Details Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl text-white shadow-2xs" style={{ backgroundColor: 'var(--theme-color)' }}>
                  <Factory size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 m-0 flex items-center gap-2">
                    Manufacture Job #{viewingJob.id} Details & Production Completion
                  </h2>
                  <p className="text-xs text-slate-500 font-medium m-0">
                    Process Name: <strong>{viewingJob.process_name}</strong> | Status: <span className="uppercase font-bold text-indigo-700">{viewingJob.status || 'in_progress'}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingJob(null)}
                className="p-1.5 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* MODAL BODY */}
            <form onSubmit={handleCompleteProduction} className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* TOP JOB DETAILS SUMMARY CARD */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50/80 p-4 rounded-2xl border border-slate-200 text-xs">
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Process Name</span>
                  <span className="text-sm font-black text-slate-900">{viewingJob.process_name}</span>
                  {viewingJob.message && (
                    <div className="text-[11px] text-slate-500 mt-1 font-medium">Remarks: {viewingJob.message}</div>
                  )}
                </div>

                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Start / End Dates</span>
                  <div className="text-xs font-bold text-slate-800 mt-0.5">
                    Start: {viewingJob.date_of_start ? new Date(viewingJob.date_of_start).toLocaleDateString() : '—'}
                  </div>
                  {viewingJob.date_of_end && (
                    <div className="text-[11px] text-slate-500 font-medium">
                      End: {new Date(viewingJob.date_of_end).toLocaleDateString()}
                    </div>
                  )}
                </div>

                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Source Consumed Summary</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {((viewingJob.source_items && viewingJob.source_items.length > 0)
                      ? viewingJob.source_items
                      : (viewingJob.items || []).map(i => ({ item_code: i.source_item_code, qty: i.source_qty, trace_item_id: i.source_trace_id_array?.[0]?.trace_id }))
                    ).map((src, i) => (
                      <span key={i} className="bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                        {src.item_code} (Qty: {src.qty})
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* BOTTOM SECTION: Target Items Table (Styled like Delivery Note Items Table, NO Delivery fields) */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Package size={16} style={{ color: 'var(--theme-color)' }} />
                    Target Items Production & Inventory Transfer
                  </h3>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-xs bg-white">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="px-3 py-2.5 text-center w-10">Select</th>
                        <th className="px-3 py-2.5 w-28">Item Code</th>
                        <th className="px-3 py-2.5">Description & Drawing</th>
                        <th className="px-3 py-2.5 text-right w-20">Order Qty</th>
                        <th className="px-3 py-2.5 text-right w-20">Delivered</th>
                        <th className="px-3 py-2.5 text-right w-20">Remaining</th>
                        <th className="px-3 py-2.5 text-right w-28">Selected Qty</th>
                        <th className="px-3 py-2.5 text-right w-24">Price (₹)</th>
                        <th className="px-3 py-2.5 text-center w-36">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white font-semibold">
                      {targetCompletionItems.map((item, idx) => (
                        <tr
                          key={item.item_code || idx}
                          className={`hover:bg-slate-50/60 transition-colors ${item.selected ? 'bg-indigo-50/10' : ''}`}
                        >
                          {/* Checkbox */}
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={() => handleTargetItemCheckboxChange(idx)}
                              className="w-4 h-4 accent-indigo-600 rounded cursor-pointer border-slate-300"
                            />
                          </td>

                          {/* Item Code */}
                          <td className="px-3 py-2 font-mono font-bold text-slate-800">
                            <span className="px-1.5 py-0.5 border border-slate-200 rounded bg-slate-50 text-[10px]">
                              {item.item_code}
                            </span>
                          </td>

                          {/* Description & Drawing */}
                          <td className="px-3 py-2">
                            <div className="font-semibold text-slate-800 text-[11px]">{item.description || '—'}</div>
                            {item.drawing_number && (
                              <div className="text-[9px] text-slate-400 font-bold">DWG: {item.drawing_number}</div>
                            )}
                            {item.inventoryDetails && (
                              <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-md font-mono font-bold w-fit shadow-2xs">
                                <CheckCircle2 size={11} className="shrink-0 text-emerald-600" />
                                <span>
                                  Location: {item.inventoryDetails.location || 'Warehouse A'}
                                  {item.inventoryDetails.rack ? ` (Rack: ${item.inventoryDetails.rack}` : ''}
                                  {item.inventoryDetails.shelf_number ? `, Shelf: ${item.inventoryDetails.shelf_number})` : item.inventoryDetails.rack ? ')' : ''}
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Order Qty */}
                          <td className="px-3 py-2 text-right text-slate-500 font-bold font-mono">{item.order_qty}</td>

                          {/* Delivered / Completed Qty */}
                          <td className="px-3 py-2 text-right text-emerald-600 font-bold font-mono">{item.delivered_qty}</td>

                          {/* Remaining Qty */}
                          <td className="px-3 py-2 text-right text-indigo-600 font-extrabold font-mono">{item.remaining_qty}</td>

                          {/* Completion Qty Div Display */}
                          <td className="px-3 py-2 text-right">
                            <div className={`px-2.5 py-1 text-xs rounded-lg font-bold text-right font-mono border shadow-2xs ${
                              item.completion_qty > 0
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}>
                              {item.completion_qty || 0}
                            </div>
                          </td>

                          {/* Price */}
                          <td className="px-3 py-2 text-right font-mono font-bold text-slate-800">
                            ₹{parseFloat(item.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>

                          {/* Action: Add in Inventory Button */}
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleAddInInventory(item)}
                              className={`px-2.5 py-1 text-[10px] font-black rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1 shadow-2xs mx-auto ${
                                item.configured || item.inventoryDetails
                                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                              }`}
                            >
                              {item.configured || item.inventoryDetails ? (
                                <>
                                  <CheckCircle2 size={11} className="text-emerald-600" />
                                  <span>Location Set</span>
                                </>
                              ) : (
                                <>
                                  <Package size={11} />
                                  <span>Add in Inventory</span>
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="pt-2 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setViewingJob(null)}
                  className="px-5 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessingComplete}
                  className="px-6 py-2.5 text-white font-bold text-xs rounded-xl transition-all shadow-2xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  style={{ backgroundColor: 'var(--theme-color)' }}
                >
                  {isProcessingComplete ? (
                    <><RefreshCw size={14} className="animate-spin" /> Processing...</>
                  ) : (
                    <><CheckCircle2 size={14} /> Confirm Production Completion</>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* CREATE MANUFACTURE JOB FORM MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white border border-slate-300 rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
            
            {/* Modal Header */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl text-white shadow-2xs" style={{ backgroundColor: 'var(--theme-color)' }}>
                  <Factory size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 m-0">New Manufacturing Job</h2>
                  <p className="text-xs text-slate-500 font-medium m-0">Define multi-source raw material items to multi-target output product items</p>
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
            <form onSubmit={handleSubmitManufactureForm} className="flex-1 overflow-y-auto p-6 space-y-5">
              
              {/* Process Name & Dates */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Process Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Multi-Component Machining & Assembly"
                    value={formData.process_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, process_name: e.target.value }))}
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] focus:border-transparent transition-all"
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
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] focus:border-transparent transition-all"
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
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* 1. SOURCE ITEMS SECTION */}
              <div className="border border-amber-200 rounded-2xl bg-amber-50/30 p-5 space-y-3.5 shadow-2xs">
                <div className="flex items-center justify-between border-b border-amber-200/70 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Layers size={16} className="text-amber-600" />
                    <div>
                      <h3 className="text-xs font-black text-amber-950 uppercase tracking-wider m-0">
                        Source Raw Materials ({formData.source_items.length})
                      </h3>
                      <p className="text-[10px] text-slate-500 m-0 font-medium">Select one or multiple trace items to consume from inventory</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSourceModalOpen(true)}
                    className="px-3 py-1.5 text-white font-bold text-xs rounded-xl transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
                    style={{ backgroundColor: 'var(--theme-color)' }}
                  >
                    <Layers size={13} /> Select Source Trace Items
                  </button>
                </div>

                {formData.source_items.length > 0 ? (
                  <div className="space-y-2">
                    {formData.source_items.map((src, idx) => (
                      <div key={idx} className="bg-white border border-amber-200 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                        <div className="space-y-0.5 flex-1">
                          <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                            <span>{src.item_code}</span>
                            {src.trace_item_id && (
                              <span className="text-[9px] font-mono font-bold text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded">
                                TR-{src.trace_item_id}
                              </span>
                            )}
                          </div>
                          {src.description && <div className="text-[10px] text-slate-500 truncate">{src.description}</div>}
                          {src.available_qty && <div className="text-[10px] text-slate-400 font-mono">Available Stock: {src.available_qty}</div>}
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Qty:</span>
                            <span className="text-xs font-mono font-bold text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-lg shadow-2xs">
                              {src.qty || 0}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveSourceItem(idx)}
                            className="p-1.5 text-slate-400 hover:text-red-600 transition-colors cursor-pointer rounded-lg hover:bg-slate-100"
                            title="Remove Source Item"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center border border-dashed border-amber-300/80 rounded-xl bg-white text-slate-400 text-xs font-medium">
                    No Source Items selected. Click "Select Source Trace Items" to pick stock items to consume.
                  </div>
                )}
              </div>

              {/* 2. TARGET ITEMS SECTION */}
              <div className="border border-emerald-200 rounded-2xl bg-emerald-50/30 p-5 space-y-3.5 shadow-2xs">
                <div className="flex items-center justify-between border-b border-emerald-200/70 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Package size={16} className="text-emerald-600" />
                    <div>
                      <h3 className="text-xs font-black text-emerald-950 uppercase tracking-wider m-0">
                        Target Output Products ({formData.target_items.length})
                      </h3>
                      <p className="text-[10px] text-slate-500 m-0 font-medium">Add one or multiple finished product catalog items to produce</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsTargetModalOpen(true)}
                    className="px-3 py-1.5 text-white font-bold text-xs rounded-xl transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
                    style={{ backgroundColor: 'var(--theme-color)' }}
                  >
                    <Package size={13} /> Add Target Item
                  </button>
                </div>

                {formData.target_items.length > 0 ? (
                  <div className="space-y-2">
                    {formData.target_items.map((tgt, idx) => (
                      <div key={idx} className="bg-white border border-emerald-200 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                        <div className="space-y-0.5 flex-1">
                          <div className="font-bold text-slate-900 text-xs">{tgt.item_code}</div>
                          {tgt.description && <div className="text-[10px] text-slate-500 truncate">{tgt.description}</div>}
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Target Qty:</span>
                            <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg shadow-2xs">
                              {tgt.qty || 0}
                            </span>
                          </div>

                          {tgt.price !== undefined && tgt.price !== null && tgt.price !== '' && parseFloat(tgt.price) > 0 && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-slate-500 uppercase">Price:</span>
                              <span className="text-xs font-mono font-bold text-slate-800 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg shadow-2xs">
                                ₹{parseFloat(tgt.price).toFixed(2)}
                              </span>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => handleRemoveTargetItem(idx)}
                            className="p-1.5 text-slate-400 hover:text-red-600 transition-colors cursor-pointer rounded-lg hover:bg-slate-100"
                            title="Remove Target Item"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center border border-dashed border-emerald-300/80 rounded-xl bg-white text-slate-400 text-xs font-medium">
                    No Target Items added. Click "Add Target Item" to select target catalog product code, quantity & price.
                  </div>
                )}
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Process Remarks / Instructions
                </label>
                <textarea
                  rows={2}
                  placeholder="Enter specific manufacturing instructions or batch notes..."
                  value={formData.message}
                  onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] focus:border-transparent transition-all resize-y"
                />
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
                  className="px-6 py-2.5 text-white font-bold text-xs rounded-xl transition-all shadow-2xs cursor-pointer flex items-center gap-2 disabled:opacity-50"
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

      {/* SOURCE ITEM SELECTOR MODAL (InventoryTraceSelectorModal) */}
      <InventoryTraceSelectorModal
        isOpen={isSourceModalOpen}
        onClose={() => setIsSourceModalOpen(false)}
        onApply={handleApplySourceSelections}
        initialSelections={formData.source_items}
      />

      {/* TARGET ITEM SELECTOR MODAL */}
      <TargetItemSelectorModal
        isOpen={isTargetModalOpen}
        onClose={() => setIsTargetModalOpen(false)}
        onApply={handleApplyTargetSelection}
        initialTargetItem={{}}
      />

    </div>
  );
}
