import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cpu, ArrowLeft, RefreshCw, Building2, User, Plus, Trash2, Layers, Package, X } from 'lucide-react';
import { toast } from 'react-toastify';

import InventoryTraceSelectorModal from '../components/InventoryTraceSelectorModal';
import TargetItemSelectorModal from '../components/TargetItemSelectorModal';

export default function ProcessRqForm() {
  const navigate = useNavigate();

  // Basic Header Form State
  const [dateOfStart, setDateOfStart] = useState(new Date().toISOString().split('T')[0]);
  const [dateOfEnd, setDateOfEnd] = useState('');
  const [message, setMessage] = useState('');

  // Seller/Processor (party_id -> buyers)
  const [partyId, setPartyId] = useState(null);
  const [sellerInput, setSellerInput] = useState('');
  const [sellerSuggestions, setSellerSuggestions] = useState([]);
  const [showSellerDropdown, setShowSellerDropdown] = useState(false);
  const sellerRef = useRef(null);

  // Party/Client (customer_id -> customers)
  const [customerId, setCustomerId] = useState(null);
  const [partyInput, setPartyInput] = useState('');
  const [partySuggestions, setPartySuggestions] = useState([]);
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);
  const partyRef = useRef(null);

  // Local Jobs State (Created Jobs)
  const [localJobs, setLocalJobs] = useState([]); // Array of local job objects

  // Job Modal State
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [jobFormData, setJobFormData] = useState({
    process_name: '',
    date_of_start: new Date().toISOString().split('T')[0],
    date_of_end: '',
    message: '',
    source_items: [],
    target_items: []
  });

  // Source & Target Item Modal States (for the Job Modal)
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  // -------------------------------------------------------------
  //   Debounced Lookups
  // -------------------------------------------------------------
  useEffect(() => {
    const trimmed = sellerInput.trim();
    if (!trimmed) {
      setSellerSuggestions([]);
      setShowSellerDropdown(false);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/buyers?q=${encodeURIComponent(trimmed)}&limit=5`)
        .then(r => r.ok ? r.json() : [])
        .then(data => {
          if (Array.isArray(data)) setSellerSuggestions(data);
        })
        .catch(console.error);
    }, 200);
    return () => clearTimeout(timer);
  }, [sellerInput]);

  useEffect(() => {
    const trimmed = partyInput.trim();
    if (!trimmed) {
      setPartySuggestions([]);
      setShowPartyDropdown(false);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/customers?q=${encodeURIComponent(trimmed)}&limit=5`)
        .then(r => r.ok ? r.json() : [])
        .then(data => {
          if (Array.isArray(data)) setPartySuggestions(data);
        })
        .catch(console.error);
    }, 200);
    return () => clearTimeout(timer);
  }, [partyInput]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sellerRef.current && !sellerRef.current.contains(e.target)) {
        setShowSellerDropdown(false);
      }
      if (partyRef.current && !partyRef.current.contains(e.target)) {
        setShowPartyDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // -------------------------------------------------------------
  //   Job Creation Handlers (Inside Modal)
  // -------------------------------------------------------------
  const handleApplySourceSelections = (selectionsArray) => {
    if (!Array.isArray(selectionsArray) || selectionsArray.length === 0) return;
    const newSourceItems = selectionsArray.map(st => ({
      item_code: st.item_code || '',
      description: st.description || '',
      trace_item_id: st.trace_id || st.trace_item_id || null,
      qty: st.Qty !== undefined && st.Qty !== null ? String(st.Qty) : '',
      available_qty: st.available_qty || ''
    }));
    setJobFormData(prev => ({ ...prev, source_items: newSourceItems }));
    setIsSourceModalOpen(false);
    toast.success(`Selected ${newSourceItems.length} source trace item(s)`);
  };

  const handleApplyTargetSelection = (targetObj) => {
    setJobFormData(prev => ({
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

  const handleSaveJobLocal = (e) => {
    e.preventDefault();
    if (!jobFormData.process_name.trim()) {
      toast.error('Process Name is required');
      return;
    }
    if (jobFormData.source_items.length === 0) {
      toast.error('Please select at least one Source Item');
      return;
    }
    if (jobFormData.target_items.length === 0) {
      toast.error('Please select at least one Target Item');
      return;
    }

    // Add to local array
    setLocalJobs(prev => [...prev, jobFormData]);

    // Reset Job Form Data and close modal
    setJobFormData({
      process_name: '',
      date_of_start: new Date().toISOString().split('T')[0],
      date_of_end: '',
      message: '',
      source_items: [],
      target_items: []
    });
    setIsJobModalOpen(false);
    toast.success('Job added to list!');
  };

  const handleRemoveLocalJob = (index) => {
    setLocalJobs(prev => prev.filter((_, idx) => idx !== index));
  };

  // -------------------------------------------------------------
  //   Main Form Submission
  // -------------------------------------------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!dateOfStart) {
      toast.error('Start Date is required');
      return;
    }
    if (!partyId) {
      toast.error('Please select a valid Seller / Processor from the list');
      return;
    }
    if (!customerId) {
      toast.error('Please select a valid Party / Client from the list');
      return;
    }

    setIsSaving(true);
    let createdJobIds = [];

    try {
      // Step 1: Create local jobs via backend sequentially
      if (localJobs.length > 0) {
        setSaveStatus(`Creating ${localJobs.length} jobs...`);
        for (let i = 0; i < localJobs.length; i++) {
          const job = localJobs[i];
          const jobRes = await fetch('/api/manufacture/jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(job)
          });
          if (jobRes.ok) {
            const jobData = await jobRes.json();
            if (jobData.job && jobData.job.id) {
              createdJobIds.push(jobData.job.id);
            }
          } else {
            const errData = await jobRes.json();
            toast.error(`Failed to create Job "${job.process_name}": ${errData.error}`);
            throw new Error('Job creation failed');
          }
        }
      }

      // Step 2: Create Process RQ
      setSaveStatus('Creating Process Request...');
      const payload = {
        dateOfStart,
        dateOfEnd: dateOfEnd || null,
        party_id: partyId,
        customer_id: customerId,
        message,
        job_ids: createdJobIds
      };

      const res = await fetch('/api/rq-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Process Request ${data.number || ''} created successfully!`);
        navigate(data.trade_id ? `/trade/${encodeURIComponent(data.trade_id)}` : '/dashboard');
      } else {
        const errData = await res.json();
        toast.error(errData.error || 'Failed to create Process Request');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error creating Process Request');
    } finally {
      setIsSaving(false);
      setSaveStatus('');
    }
  };

  return (
    <div className="flex-1 p-6 bg-slate-100 text-slate-900 font-sans min-h-screen relative">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* PAGE HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-300 gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl text-white shadow-sm" style={{ backgroundColor: 'var(--theme-color)' }}>
              <Cpu size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Create Process Request</h1>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Define process request details, party, schedule, and link jobs.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="px-3.5 py-2 bg-white border border-slate-300 hover:border-slate-400 rounded-xl text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <ArrowLeft size={15} /> Back to Dashboard
          </button>
        </div>

        {/* FORM CONTAINER CARD */}
        <div className="border border-slate-300 rounded-3xl bg-white p-6 shadow-sm space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-2xl border border-slate-200 bg-slate-50/50">
              {/* Start Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={dateOfStart}
                  onChange={(e) => setDateOfStart(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] transition-all"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={dateOfEnd}
                  onChange={(e) => setDateOfEnd(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] transition-all"
                />
              </div>

              {/* Seller / Processor Vendor (Buyers) */}
              <div ref={sellerRef} className="relative">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
                  <User size={12} className="text-slate-500" /> Seller / Processor <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Search seller vendor..."
                  value={sellerInput}
                  onChange={(e) => {
                    setSellerInput(e.target.value);
                    setPartyId(null);
                    setShowSellerDropdown(true);
                  }}
                  onFocus={() => {
                    if (sellerInput.trim()) setShowSellerDropdown(true);
                  }}
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] transition-all"
                  autoComplete="off"
                />
                {showSellerDropdown && sellerSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto text-xs">
                    {sellerSuggestions.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setSellerInput(b.name);
                          setPartyId(b.id);
                          setShowSellerDropdown(false);
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0 cursor-pointer"
                      >
                        <div className="font-bold text-slate-900">{b.name}</div>
                        {(b.email || b.phone) && (
                          <div className="text-[10px] text-slate-500">{b.email} &bull; {b.phone}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Party / Client Customer */}
              <div ref={partyRef} className="relative">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
                  <Building2 size={12} className="text-slate-500" /> Party / Client <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Search party client..."
                  value={partyInput}
                  onChange={(e) => {
                    setPartyInput(e.target.value);
                    setCustomerId(null);
                    setShowPartyDropdown(true);
                  }}
                  onFocus={() => {
                    if (partyInput.trim()) setShowPartyDropdown(true);
                  }}
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] transition-all"
                  autoComplete="off"
                />
                {showPartyDropdown && partySuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto text-xs">
                    {partySuggestions.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setPartyInput(c.name);
                          setCustomerId(c.db_id || c.id);
                          setShowPartyDropdown(false);
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0 cursor-pointer"
                      >
                        <div className="font-bold text-slate-900">{c.name}</div>
                        {c.address && (
                          <div className="text-[10px] text-slate-500 truncate">{c.address}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Process Note / Message */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Process Note / Instruction
                </label>
                <textarea
                  placeholder="e.g. Surface treatment & galvanizing"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] transition-all min-h-[60px]"
                />
              </div>
            </div>

            {/* JOBS SECTION */}
            <div className="border border-indigo-200 rounded-2xl bg-indigo-50/30 p-5 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-indigo-200/70 pb-3">
                <div>
                  <h3 className="text-xs font-black text-indigo-950 uppercase tracking-wider m-0">
                    Linked Jobs ({localJobs.length})
                  </h3>
                  <p className="text-[10px] text-slate-500 m-0 font-medium mt-0.5">
                    Jobs will be created and linked automatically when you save the Process Request.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsJobModalOpen(true)}
                  className="px-4 py-2 text-white font-bold text-xs rounded-xl transition-all shadow-sm cursor-pointer flex items-center gap-1.5 hover:brightness-95"
                  style={{ backgroundColor: 'var(--theme-color)' }}
                >
                  <Plus size={14} /> Add Job
                </button>
              </div>

              {localJobs.length > 0 ? (
                <div className="space-y-3">
                  {localJobs.map((job, idx) => (
                    <div key={idx} className="bg-white border border-indigo-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                      <div className="flex-1 space-y-1">
                        <div className="font-bold text-slate-900 text-sm">{job.process_name}</div>
                        <div className="text-[11px] text-slate-500 font-medium">
                          {new Date(job.date_of_start).toLocaleDateString()} {job.date_of_end && `- ${new Date(job.date_of_end).toLocaleDateString()}`}
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded text-[10px] font-bold">
                            <Layers size={10} /> {job.source_items.length} Sources
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-[10px] font-bold">
                            <Package size={10} /> {job.target_items.length} Targets
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveLocalJob(idx)}
                        className="p-2 text-slate-400 hover:text-red-600 transition-colors cursor-pointer rounded-lg hover:bg-slate-100 border border-transparent hover:border-red-200"
                        title="Remove Job"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center border border-dashed border-indigo-300 rounded-xl bg-white text-slate-400 text-xs font-medium">
                  No jobs added yet. Click "Add Job" to define processing tasks.
                </div>
              )}
            </div>

            {/* FORM ACTIONS */}
            <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="px-5 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 text-white font-bold text-xs rounded-xl transition-all shadow-2xs cursor-pointer flex items-center gap-2 disabled:opacity-50"
                style={{ backgroundColor: 'var(--theme-color)' }}
                onMouseEnter={(e) => e.target.style.filter = 'brightness(0.9)'}
                onMouseLeave={(e) => e.target.style.filter = 'none'}
              >
                {isSaving ? (
                  <><RefreshCw size={15} className="animate-spin" /> {saveStatus || 'Saving...'}</>
                ) : (
                  'Save Process Request'
                )}
              </button>
            </div>

          </form>
        </div>
      </div>

      {/* JOB CREATION MODAL */}
      {isJobModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white border border-slate-300 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
            
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl text-white shadow-2xs bg-indigo-600">
                  <Plus size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 m-0">Add New Job</h2>
                  <p className="text-xs text-slate-500 font-medium m-0">Define process and stock requirements for this task.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsJobModalOpen(false)}
                className="p-1.5 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                    Process Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Cutting and Bending"
                    value={jobFormData.process_name}
                    onChange={(e) => setJobFormData({ ...jobFormData, process_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Start Date</label>
                  <input
                    type="date"
                    value={jobFormData.date_of_start}
                    onChange={(e) => setJobFormData({ ...jobFormData, date_of_start: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">End Date</label>
                  <input
                    type="date"
                    value={jobFormData.date_of_end}
                    onChange={(e) => setJobFormData({ ...jobFormData, date_of_end: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Message / Remarks</label>
                  <input
                    type="text"
                    placeholder="e.g. Expedite if possible"
                    value={jobFormData.message}
                    onChange={(e) => setJobFormData({ ...jobFormData, message: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Source Items */}
              <div className="border border-amber-200 rounded-xl bg-amber-50/40 p-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-[11px] font-black text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers size={14} className="text-amber-600" /> Source Raw Materials
                  </h4>
                  <button
                    type="button"
                    onClick={() => setIsSourceModalOpen(true)}
                    className="text-[10px] font-bold bg-white border border-amber-300 text-amber-800 px-3 py-1.5 rounded-lg shadow-2xs hover:bg-amber-100 cursor-pointer"
                  >
                    Select Inventory Trace
                  </button>
                </div>
                {jobFormData.source_items.length > 0 ? (
                  <div className="space-y-2">
                    {jobFormData.source_items.map((src, i) => (
                      <div key={i} className="flex items-center justify-between bg-white border border-amber-200 p-2.5 rounded-lg">
                        <div className="text-[11px] font-bold text-slate-800">
                          {src.item_code} {src.trace_item_id && <span className="ml-1 text-[9px] bg-amber-100 px-1 py-0.5 rounded text-amber-900 border border-amber-300">TR-{src.trace_item_id}</span>}
                        </div>
                        <div className="flex items-center gap-3">
                          <input 
                            type="number" 
                            className="w-16 border border-slate-300 rounded px-1 py-0.5 text-xs text-center" 
                            value={src.qty} 
                            placeholder="Qty"
                            onChange={(e) => {
                              const v = e.target.value;
                              setJobFormData(prev => {
                                const newSrc = [...prev.source_items];
                                newSrc[i].qty = v;
                                return { ...prev, source_items: newSrc };
                              });
                            }}
                          />
                          <button type="button" onClick={() => setJobFormData(prev => ({ ...prev, source_items: prev.source_items.filter((_, idx) => idx !== i) }))} className="text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-500 font-medium italic text-center py-2 bg-white border border-amber-200 border-dashed rounded-lg">No source items selected</div>
                )}
              </div>

              {/* Target Items */}
              <div className="border border-emerald-200 rounded-xl bg-emerald-50/40 p-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-[11px] font-black text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Package size={14} className="text-emerald-600" /> Target Output Items
                  </h4>
                  <button
                    type="button"
                    onClick={() => setIsTargetModalOpen(true)}
                    className="text-[10px] font-bold bg-white border border-emerald-300 text-emerald-800 px-3 py-1.5 rounded-lg shadow-2xs hover:bg-emerald-100 cursor-pointer"
                  >
                    Add Output Item
                  </button>
                </div>
                {jobFormData.target_items.length > 0 ? (
                  <div className="space-y-2">
                    {jobFormData.target_items.map((tgt, i) => (
                      <div key={i} className="flex items-center justify-between bg-white border border-emerald-200 p-2.5 rounded-lg">
                        <div className="text-[11px] font-bold text-slate-800">
                          {tgt.item_code}
                        </div>
                        <div className="flex items-center gap-3">
                          <input 
                            type="number" 
                            className="w-16 border border-slate-300 rounded px-1 py-0.5 text-xs text-center" 
                            value={tgt.qty} 
                            placeholder="Qty"
                            onChange={(e) => {
                              const v = e.target.value;
                              setJobFormData(prev => {
                                const newTgt = [...prev.target_items];
                                newTgt[i].qty = v;
                                return { ...prev, target_items: newTgt };
                              });
                            }}
                          />
                          <button type="button" onClick={() => setJobFormData(prev => ({ ...prev, target_items: prev.target_items.filter((_, idx) => idx !== i) }))} className="text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-500 font-medium italic text-center py-2 bg-white border border-emerald-200 border-dashed rounded-lg">No target items added</div>
                )}
              </div>

            </div>
            
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsJobModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveJobLocal}
                className="px-6 py-2 text-white font-bold text-xs rounded-lg transition-all shadow-md cursor-pointer bg-indigo-600 hover:bg-indigo-700"
              >
                Save Job Locally
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RENDER MODALS outside Job Modal */}
      {isSourceModalOpen && (
        <InventoryTraceSelectorModal
          isOpen={isSourceModalOpen}
          onClose={() => setIsSourceModalOpen(false)}
          onApply={handleApplySourceSelections}
        />
      )}
      {isTargetModalOpen && (
        <TargetItemSelectorModal
          isOpen={isTargetModalOpen}
          onClose={() => setIsTargetModalOpen(false)}
          onApply={handleApplyTargetSelection}
        />
      )}
    </div>
  );
}
