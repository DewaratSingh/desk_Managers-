import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cpu, ArrowLeft, Layers, Package, Calendar, RefreshCw, Trash2, CheckCircle2, AlertCircle, Building2, User } from 'lucide-react';
import { toast } from 'react-toastify';

import InventoryTraceSelectorModal from '../components/InventoryTraceSelectorModal';
import TargetItemSelectorModal from '../components/TargetItemSelectorModal';

export default function ProcessRqForm() {
  const navigate = useNavigate();

  // Basic Header Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [message, setMessage] = useState('');

  // Seller Search State
  const [seller, setSeller] = useState('');
  const [sellerInput, setSellerInput] = useState('');
  const [sellerSuggestions, setSellerSuggestions] = useState([]);
  const [showSellerDropdown, setShowSellerDropdown] = useState(false);
  const sellerRef = useRef(null);

  // Party Search State
  const [party, setParty] = useState('');
  const [partyInput, setPartyInput] = useState('');
  const [partySuggestions, setPartySuggestions] = useState([]);
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);
  const partyRef = useRef(null);

  // Source Items & Target Items State
  const [sourceItems, setSourceItems] = useState([]); // Array of { item_code, description, trace_item_id, qty, available_qty }
  const [targetItems, setTargetItems] = useState([]); // Array of { item_code, description, qty, price }

  // Modal Visibility States
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  // Debounced Seller Lookup
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

  // Debounced Party Lookup
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

  // Click outside to close dropdowns
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

  // Handlers for Source Items Selection (InventoryTraceSelectorModal)
  const handleApplySourceSelections = (selectionsArray) => {
    if (!Array.isArray(selectionsArray) || selectionsArray.length === 0) return;

    const newSourceItems = selectionsArray.map(st => ({
      item_code: st.item_code || '',
      description: st.description || '',
      trace_item_id: st.trace_id || st.trace_item_id || null,
      qty: st.Qty !== undefined && st.Qty !== null ? String(st.Qty) : '1',
      available_qty: st.available_qty || ''
    }));

    setSourceItems(newSourceItems);
    setIsSourceModalOpen(false);
    toast.success(`Selected ${newSourceItems.length} source trace item(s)`);
  };

  const handleRemoveSourceItem = (index) => {
    setSourceItems(prev => prev.filter((_, idx) => idx !== index));
  };

  // Handlers for Target Items Selection (TargetItemSelectorModal)
  const handleApplyTargetSelection = (targetObj) => {
    setTargetItems(prev => [
      ...prev,
      {
        item_code: targetObj.item_code,
        description: targetObj.description || '',
        qty: targetObj.qty !== undefined ? String(targetObj.qty) : '1',
        price: targetObj.price !== undefined ? String(targetObj.price) : ''
      }
    ]);

    setIsTargetModalOpen(false);
    toast.success(`Added Target Item ${targetObj.item_code}`);
  };

  const handleRemoveTargetItem = (index) => {
    setTargetItems(prev => prev.filter((_, idx) => idx !== index));
  };

  // Submit Process Received Quotation Form
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!date) {
      toast.error('Process Date is required');
      return;
    }

    if (!seller || !seller.trim()) {
      toast.error('Seller / Processor is required');
      return;
    }

    if (!party || !party.trim()) {
      toast.error('Party / Client is required');
      return;
    }

    if (sourceItems.length === 0) {
      toast.error('Please select at least one Source Item using "Select Source Trace Items"');
      return;
    }

    if (targetItems.length === 0) {
      toast.error('Please select at least one Target Item using "Add Target Item"');
      return;
    }

    for (let i = 0; i < sourceItems.length; i++) {
      const src = sourceItems[i];
      const q = parseFloat(src.qty);
      if (isNaN(q) || q <= 0) {
        toast.error(`Source Item #${i + 1} (${src.item_code}): Quantity must be greater than 0`);
        return;
      }
    }

    for (let i = 0; i < targetItems.length; i++) {
      const tgt = targetItems[i];
      const q = parseFloat(tgt.qty);
      if (isNaN(q) || q <= 0) {
        toast.error(`Target Item #${i + 1} (${tgt.item_code}): Target Quantity must be greater than 0`);
        return;
      }
    }

    setIsSaving(true);
    try {
      const payload = {
        date,
        seller,
        party,
        message,
        source_items: sourceItems.map(s => ({
          item_code: s.item_code,
          trace_item_id: s.trace_item_id,
          qty: parseFloat(s.qty) || 0
        })),
        target_items: targetItems.map(t => ({
          item_code: t.item_code,
          qty: parseFloat(t.qty) || 0,
          price: parseFloat(t.price) || 0
        }))
      };

      const res = await fetch('/api/rq-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Process Received Quotation ${data.rq_process_no || ''} created successfully!`);
        navigate(data.trade_id ? `/trade/${encodeURIComponent(data.trade_id)}` : '/dashboard');
      } else {
        const errData = await res.json();
        toast.error(errData.error || 'Failed to create Process Received Quotation');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error creating Process Received Quotation');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 p-6 bg-slate-100 text-slate-900 font-sans min-h-screen">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* PAGE HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-300 gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl text-white shadow-sm" style={{ backgroundColor: 'var(--theme-color)' }}>
              <Cpu size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Create Process Trade Request</h1>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Define job process received quotation details, raw material inputs, and expected target output products.
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

            {/* BASIC METADATA SECTION */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              {/* Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Process Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] transition-all"
                />
              </div>

              {/* Seller / Processor Vendor */}
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
                    setSeller(e.target.value);
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
                          setSeller(b.name);
                          setShowSellerDropdown(false);
                        }}
                        onClick={() => {
                          setSellerInput(b.name);
                          setSeller(b.name);
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
                    setParty(e.target.value);
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
                          setParty(c.name);
                          setShowPartyDropdown(false);
                        }}
                        onClick={() => {
                          setPartyInput(c.name);
                          setParty(c.name);
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
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Process Note / Instruction
                </label>
                <input
                  type="text"
                  placeholder="e.g. Surface treatment & galvanizing"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] transition-all"
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
                      Source Raw Materials ({sourceItems.length})
                    </h3>
                    <p className="text-[10px] text-slate-500 m-0 font-medium">Select one or multiple trace items to process from inventory</p>
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

              {sourceItems.length > 0 ? (
                <div className="space-y-2">
                  {sourceItems.map((src, idx) => (
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
                  No Source Items selected. Click "Select Source Trace Items" to pick stock items to process.
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
                      Target Output Products ({targetItems.length})
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

              {targetItems.length > 0 ? (
                <div className="space-y-2">
                  {targetItems.map((tgt, idx) => (
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

            {/* FORM ACTIONS */}
            <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="px-5 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
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
                  <><RefreshCw size={15} className="animate-spin" /> Creating Trade Request...</>
                ) : (
                  'Create Process Trade Request'
                )}
              </button>
            </div>

          </form>
        </div>
      </div>

      {/* SOURCE ITEM SELECTOR MODAL (InventoryTraceSelectorModal) */}
      <InventoryTraceSelectorModal
        isOpen={isSourceModalOpen}
        onClose={() => setIsSourceModalOpen(false)}
        onApply={handleApplySourceSelections}
        initialSelections={sourceItems}
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
