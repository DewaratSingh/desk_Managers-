import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FileText, ArrowLeft, Layers, Package, RefreshCw, Trash2, Building2, User, Truck, Box, DollarSign, Search, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-toastify';

import InventoryTraceSelectorModal from '../components/InventoryTraceSelectorModal';
import TargetItemSelectorModal from '../components/TargetItemSelectorModal';

export default function ProcessPoForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const queryTradeId = searchParams.get('trade_id');
  const queryRqId = searchParams.get('received_q_id') || searchParams.get('rq_id') || searchParams.get('rq_process_no') || searchParams.get('rq_process_id');
  const queryRecQtnNo = searchParams.get('received_quotation_no') || searchParams.get('quotation_no');

  // Header State
  const [poNo, setPoNo] = useState('');
  const [dateOfStart, setDateOfStart] = useState(new Date().toISOString().split('T')[0]);
  const [dateOfEnd, setDateOfEnd] = useState('');
  const [message, setMessage] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [receivedQId, setReceivedQId] = useState('');

  // Linked Received Quotation / Process RQ Search State
  const [rqSearchInput, setRqSearchInput] = useState('');
  const [rqSuggestions, setRqSuggestions] = useState([]);
  const [showRqDropdown, setShowRqDropdown] = useState(false);
  const [linkedRqLabel, setLinkedRqLabel] = useState('');
  const rqRef = useRef(null);

  // Seller Search State (Compulsory)
  const [seller, setSeller] = useState('');
  const [sellerInput, setSellerInput] = useState('');
  const [sellerSuggestions, setSellerSuggestions] = useState([]);
  const [showSellerDropdown, setShowSellerDropdown] = useState(false);
  const sellerRef = useRef(null);

  // Party Search State (Compulsory)
  const [party, setParty] = useState('');
  const [partyInput, setPartyInput] = useState('');
  const [partySuggestions, setPartySuggestions] = useState([]);
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);
  const partyRef = useRef(null);

  // Source & Target Items
  const [sourceItems, setSourceItems] = useState([]); // Array of { item_code, description, trace_item_id, qty, available_qty }
  const [targetItems, setTargetItems] = useState([]); // Array of { item_code, description, qty, price }

  // Financial Summary State
  const [gstType, setGstType] = useState('CGST + SGST');
  const [gstRate, setGstRate] = useState('18');
  const [transport, setTransport] = useState('0');
  const [packingForward, setPackingForward] = useState('0');
  const [other, setOther] = useState('0');

  // Modals
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Auto-fetch next PO Number
  useEffect(() => {
    fetch('/api/process-po/next-no')
      .then(r => r.ok ? r.json() : {})
      .then(data => {
        if (data.po_no) setPoNo(data.po_no);
      })
      .catch(console.error);
  }, []);

  // State for restricting inventory trace modal to source items defined in RQ
  const [rqSourceItemCodes, setRqSourceItemCodes] = useState([]);

  // Populate form fields from a Process RQ record object
  const populateFromProcessRq = (rq) => {
    if (!rq) return;
    if (rq.id) setReceivedQId(String(rq.id));
    if (rq.rq_process_no) {
      setLinkedRqLabel(rq.rq_process_no);
      setRqSearchInput(rq.rq_process_no);
    }
    if (rq.seller) {
      setSeller(rq.seller);
      setSellerInput(rq.seller);
    }
    if (rq.party) {
      setParty(rq.party);
      setPartyInput(rq.party);
    }
    // Record source item codes from RQ to restrict inventory picker (do NOT auto-copy sourceItems)
    if (Array.isArray(rq.source_items) && rq.source_items.length > 0) {
      const allowedCodes = rq.source_items.map(s => s.item_code).filter(Boolean);
      setRqSourceItemCodes(allowedCodes);
    } else if (Array.isArray(rq.items) && rq.items.length > 0) {
      const allowedCodes = rq.items.map(s => s.source_item_code || s.item_code).filter(Boolean);
      setRqSourceItemCodes(allowedCodes);
    }
    setSourceItems([]);

    if (Array.isArray(rq.target_items) && rq.target_items.length > 0) {
      setTargetItems(rq.target_items.map(t => ({
        item_code: t.item_code,
        description: t.description || '',
        qty: String(t.qty || 1),
        price: String(t.price || 0)
      })));
    }
  };

  // Populate form fields from a Received Quotation record object
  const populateFromReceivedQuotation = (rq) => {
    if (!rq) return;
    if (rq.received_quotation_no) {
      setLinkedRqLabel(rq.received_quotation_no);
      setRqSearchInput(rq.received_quotation_no);
    }
    if (rq.buyer_name) {
      setSeller(rq.buyer_name);
      setSellerInput(rq.buyer_name);
    }
    if (rq.customer_name) {
      setParty(rq.customer_name);
      setPartyInput(rq.customer_name);
    }
    if (Array.isArray(rq.items) && rq.items.length > 0) {
      setTargetItems(rq.items.map(t => ({
        item_code: t.item_code,
        description: t.description || '',
        qty: String(t.quantity || 1),
        price: String(t.unit_price || 0)
      })));
    }
  };

  // Initial Pre-fill Logic from Query Params (trade_id, received_q_id, rq_process_no, received_quotation_no)
  useEffect(() => {
    if (queryRqId) {
      fetch(`/api/rq-process/${encodeURIComponent(queryRqId)}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data) {
            populateFromProcessRq(data);
          } else if (queryRecQtnNo) {
            return fetch(`/api/received-quotation/${encodeURIComponent(queryRecQtnNo)}`).then(r => r.ok ? r.json() : null);
          }
        })
        .then(recData => {
          if (recData) populateFromReceivedQuotation(recData);
        })
        .catch(console.error);
    } else if (queryRecQtnNo) {
      fetch(`/api/received-quotation/${encodeURIComponent(queryRecQtnNo)}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data) populateFromReceivedQuotation(data);
        })
        .catch(console.error);
    }

    if (queryTradeId) {
      fetch(`/api/trades/${encodeURIComponent(queryTradeId)}`)
        .then(r => r.ok ? r.json() : null)
        .then(tradeData => {
          if (tradeData) {
            const docs = tradeData.documents || [];
            const prDoc = docs.find(d => d.type?.toUpperCase() === 'PR' || d.type?.toUpperCase() === 'RQ_PROCESS');
            const recDoc = docs.find(d => d.type?.toUpperCase() === 'RECEIVED_QUOTATION');

            if (prDoc && prDoc.id) {
              fetch(`/api/rq-process/${encodeURIComponent(prDoc.id)}`)
                .then(r => r.ok ? r.json() : null)
                .then(data => data && populateFromProcessRq(data))
                .catch(console.error);
            } else if (recDoc && recDoc.id) {
              fetch(`/api/received-quotation/${encodeURIComponent(recDoc.id)}`)
                .then(r => r.ok ? r.json() : null)
                .then(data => data && populateFromReceivedQuotation(data))
                .catch(console.error);
            } else {
              if (tradeData.buyer_name) { setSeller(tradeData.buyer_name); setSellerInput(tradeData.buyer_name); }
              if (tradeData.customer_name) { setParty(tradeData.customer_name); setPartyInput(tradeData.customer_name); }
            }
          }
        })
        .catch(console.error);
    }
  }, [queryRqId, queryRecQtnNo, queryTradeId]);

  // Debounced Linked Process RQ / Received Quotation Lookup
  useEffect(() => {
    const trimmed = rqSearchInput.trim();
    if (!trimmed) {
      setRqSuggestions([]);
      setShowRqDropdown(false);
      return;
    }
    const timer = setTimeout(() => {
      Promise.all([
        fetch('/api/rq-process').then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(`/api/received-quotations?q=${encodeURIComponent(trimmed)}&limit=5`).then(r => r.ok ? r.json() : []).catch(() => [])
      ]).then(([rqList, recList]) => {
        const filteredRq = (Array.isArray(rqList) ? rqList : []).filter(r =>
          (r.rq_process_no && r.rq_process_no.toLowerCase().includes(trimmed.toLowerCase())) ||
          (r.seller && r.seller.toLowerCase().includes(trimmed.toLowerCase())) ||
          (r.party && r.party.toLowerCase().includes(trimmed.toLowerCase()))
        ).map(r => ({ ...r, _type: 'PROCESS_RQ', label: r.rq_process_no }));

        const filteredRec = (Array.isArray(recList) ? recList : []).map(r => ({
          ...r,
          _type: 'RECEIVED_QUOTATION',
          label: r.received_quotation_no,
          seller: r.buyer_name,
          party: r.customer_name
        }));

        setRqSuggestions([...filteredRq, ...filteredRec]);
        setShowRqDropdown(true);
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [rqSearchInput]);

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

  // Outside click to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (rqRef.current && !rqRef.current.contains(e.target)) {
        setShowRqDropdown(false);
      }
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

  // Handlers for Source Items Selection
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

  // Handlers for Target Items Selection
  const handleApplyTargetSelection = (targetObj) => {
    setTargetItems(prev => [
      ...prev,
      {
        item_code: targetObj.item_code,
        description: targetObj.description || '',
        qty: targetObj.qty !== undefined ? String(targetObj.qty) : '1',
        price: targetObj.price !== undefined ? String(targetObj.price) : '0'
      }
    ]);

    setIsTargetModalOpen(false);
    toast.success(`Added Target Item ${targetObj.item_code}`);
  };

  const handleRemoveTargetItem = (index) => {
    setTargetItems(prev => prev.filter((_, idx) => idx !== index));
  };

  // Financial Calculations
  const calcTargetBasicTotal = () => {
    return targetItems.reduce((sum, item) => {
      const q = parseFloat(item.qty) || 0;
      const p = parseFloat(item.price) || 0;
      return sum + (q * p);
    }, 0);
  };

  const calcGstAmount = () => {
    const basic = calcTargetBasicTotal();
    const rate = parseFloat(gstRate) || 0;
    return (basic * rate) / 100;
  };

  const calcGrandTotal = () => {
    return (
      calcTargetBasicTotal() +
      calcGstAmount() +
      (parseFloat(transport) || 0) +
      (parseFloat(packingForward) || 0) +
      (parseFloat(other) || 0)
    );
  };

    // Submit Process PO Form
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!poNo || !poNo.trim()) {
      toast.error('Process PO Number is required');
      return;
    }

    if (!seller || !seller.trim()) {
      toast.error('Seller / Processor Vendor is required');
      return;
    }

    if (!party || !party.trim()) {
      toast.error('Party / Client Customer is required');
      return;
    }

    // Derive source and target items if modal arrays are empty
    let finalSourceItems = sourceItems;
    let finalTargetItems = targetItems;

    if (finalSourceItems.length === 0 && Array.isArray(items) && items.length > 0) {
      finalSourceItems = items.map(s => ({
        item_code: s.source_item_code || s.target_item_code,
        trace_item_id: s.trace_item_id || null,
        qty: parseFloat(s.source_qty) || parseFloat(s.target_qty) || 1
      }));
    }

    if (finalTargetItems.length === 0 && Array.isArray(items) && items.length > 0) {
      finalTargetItems = items.map(t => ({
        item_code: t.target_item_code,
        qty: parseFloat(t.target_qty) || 1,
        price: parseFloat(t.price) || 0,
        gst_type: gstType,
        gst_rate: parseFloat(gstRate) || 0,
        shipping_address: shippingAddress || null,
        delivery_date: dateOfEnd || null
      }));
    }

    if (finalSourceItems.length === 0) {
      toast.error('Please enter at least one source item or target item in the table');
      return;
    }

    if (finalTargetItems.length === 0) {
      toast.error('Please enter at least one target output product in the table');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        po_no: poNo.trim(),
        date_of_start: dateOfStart,
        date_of_end: dateOfEnd || null,
        received_q_id: receivedQId || queryRqId || null,
        trade_id: queryTradeId || null,
        seller: seller.trim(),
        party: party.trim(),
        gst_type: gstType,
        gst_rate: parseFloat(gstRate) || 0,
        gst: calcGstAmount(),
        transport: parseFloat(transport) || 0,
        packing_forward: parseFloat(packingForward) || 0,
        other: parseFloat(other) || 0,
        basic_value: calcTargetBasicTotal(),
        delivery_date: dateOfEnd || null,
        shipping_address: shippingAddress || null,
        message: message || null,
        source_items: finalSourceItems,
        target_items: finalTargetItems
      };

      const res = await fetch('/api/process-po', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Process Purchase Order ${data.po_no || ''} created successfully!`);
        const destTradeId = queryTradeId || data.trade_id;
        navigate(destTradeId ? `/trade/${encodeURIComponent(destTradeId)}` : '/dashboard');
      } else {
        const errData = await res.json();
        toast.error(errData.error || 'Failed to create Process Purchase Order');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error creating Process Purchase Order');
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
              <FileText size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Create Process Purchase Order</h1>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Raise an official Process PO for processing raw materials into target items with pricing, vendor details & tax structure.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate(queryTradeId ? `/trade/${queryTradeId}` : '/dashboard')}
            className="px-3.5 py-2 bg-white border border-slate-300 hover:border-slate-400 rounded-xl text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <ArrowLeft size={15} /> Back
          </button>
        </div>

        {/* FORM CONTAINER CARD */}
        <div className="border border-slate-300 rounded-3xl bg-white p-6 shadow-sm space-y-6">

          {/* LINKED RECEIVED QUOTATION / PROCESS RQ BANNER & SELECTOR */}
          <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <span className="text-[10px] font-black text-indigo-900 uppercase tracking-wider flex items-center gap-1">
                <FileText size={12} className="text-indigo-600" /> Linked Received Quotation / Process RQ
              </span>
              <p className="text-xs text-indigo-700 font-semibold m-0">
                {linkedRqLabel ? (
                  <span className="flex items-center gap-1.5 text-emerald-800 font-bold bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-lg w-fit mt-1">
                    <CheckCircle2 size={13} className="text-emerald-600" /> Pre-filled from Received Quotation: {linkedRqLabel}
                  </span>
                ) : (
                  'Select a Received Quotation or Process RQ to automatically load Seller, Party, and items.'
                )}
              </p>
            </div>

            <div ref={rqRef} className="relative w-full sm:w-72">
              <input
                type="text"
                placeholder="Search Received Quotation / Process RQ..."
                value={rqSearchInput}
                onChange={(e) => {
                  setRqSearchInput(e.target.value);
                  setShowRqDropdown(true);
                }}
                onFocus={() => {
                  if (rqSearchInput.trim()) setShowRqDropdown(true);
                }}
                className="w-full pl-8 pr-3.5 py-2 bg-white border border-indigo-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                autoComplete="off"
              />
              <Search size={14} className="absolute left-2.5 top-2.5 text-indigo-400" />

              {showRqDropdown && rqSuggestions.length > 0 && (
                <div className="absolute right-0 z-50 w-full sm:w-80 mt-1 bg-white border border-slate-300 rounded-xl shadow-xl overflow-hidden max-h-56 overflow-y-auto text-xs">
                  {rqSuggestions.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        if (item._type === 'PROCESS_RQ') {
                          populateFromProcessRq(item);
                        } else {
                          populateFromReceivedQuotation(item);
                        }
                        setShowRqDropdown(false);
                        toast.success(`Loaded details from ${item.label}`);
                      }}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0 cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{item.label}</span>
                        <span className="text-[9px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.2 rounded">
                          {item._type === 'PROCESS_RQ' ? 'Process RQ' : 'Rec Quotation'}
                        </span>
                      </div>
                      {(item.seller || item.party) && (
                        <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                          Seller: {item.seller || '—'} &bull; Party: {item.party || '—'}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* BASIC HEADER METADATA SECTION */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              
              {/* Process PO No */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Process PO No. <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PPO-0001"
                  value={poNo}
                  onChange={(e) => setPoNo(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] transition-all"
                />
              </div>

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

              {/* Delivery Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Delivery Date
                </label>
                <input
                  type="date"
                  value={dateOfEnd}
                  onChange={(e) => setDateOfEnd(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] transition-all"
                />
              </div>

              {/* Process Note / Message */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Process Instruction / Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Precision machining & polishing"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] transition-all"
                />
              </div>

              {/* Seller / Processor Vendor (COMPULSORY - Pre-filled from Received Quotation) */}
              <div ref={sellerRef} className="relative">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
                  <User size={12} className="text-slate-500" /> Seller / Processor Vendor <span className="text-red-500">*</span>
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

              {/* Party / Client Customer (COMPULSORY - Pre-filled from Received Quotation) */}
              <div ref={partyRef} className="relative">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
                  <Building2 size={12} className="text-slate-500" /> Party / Client Customer <span className="text-red-500">*</span>
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

              {/* Shipping Address (Optional) */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Shipping Address <span className="text-slate-400 font-normal lowercase">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Factory site address or delivery location"
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
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
                    <p className="text-[10px] text-slate-500 m-0 font-medium">Select trace items from inventory to process</p>
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
                    <p className="text-[10px] text-slate-500 m-0 font-medium">Add target output product catalog items, quantity & pricing</p>
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
                  {targetItems.map((tgt, idx) => {
                    const itemQty = parseFloat(tgt.qty) || 0;
                    const itemPrice = parseFloat(tgt.price) || 0;
                    const itemTotal = itemQty * itemPrice;

                    return (
                      <div key={idx} className="bg-white border border-emerald-200 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                        <div className="space-y-0.5 flex-1">
                          <div className="font-bold text-slate-900 text-xs">{tgt.item_code}</div>
                          {tgt.description && <div className="text-[10px] text-slate-500 truncate">{tgt.description}</div>}
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Target Qty:</span>
                            <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg shadow-2xs">
                              {tgt.qty || 0}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Unit Price:</span>
                            <span className="text-xs font-mono font-bold text-slate-800 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg shadow-2xs">
                              ₹{itemPrice.toFixed(2)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Total:</span>
                            <span className="text-xs font-mono font-black text-emerald-950 bg-emerald-100/80 border border-emerald-300 px-2.5 py-1 rounded-lg shadow-2xs">
                              ₹{itemTotal.toFixed(2)}
                            </span>
                          </div>

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
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 text-center border border-dashed border-emerald-300/80 rounded-xl bg-white text-slate-400 text-xs font-medium">
                  No Target Items added. Click "Add Target Item" to select target product code, quantity & price.
                </div>
              )}
            </div>

            {/* 3. FINANCIAL SUMMARY & TAXES / CHARGES SECTION */}
            <div className="border border-slate-300 rounded-2xl bg-slate-50 p-5 space-y-4 shadow-2xs">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5">
                <DollarSign size={18} className="text-slate-700" />
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider m-0">
                  Financial Summary & Charges (PO Card)
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                
                {/* Basic Value */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Basic Value (₹)
                  </label>
                  <div className="px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800">
                    ₹{calcTargetBasicTotal().toFixed(2)}
                  </div>
                </div>

                {/* GST Type */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    GST Type
                  </label>
                  <select
                    value={gstType}
                    onChange={(e) => setGstType(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] transition-all"
                  >
                    <option value="CGST + SGST">CGST + SGST</option>
                    <option value="IGST">IGST</option>
                    <option value="Exempt">Exempt</option>
                  </select>
                </div>

                {/* GST Rate % */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    GST Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="18"
                    value={gstRate}
                    onChange={(e) => setGstRate(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] transition-all"
                  />
                  <div className="text-[10px] text-slate-500 mt-1 font-mono">
                    GST Amount: ₹{calcGstAmount().toFixed(2)}
                  </div>
                </div>

                {/* Transport Charges */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Transport (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={transport}
                    onChange={(e) => setTransport(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] transition-all"
                  />
                </div>

                {/* Packing & Forwarding */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Packing/Forwarding (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={packingForward}
                    onChange={(e) => setPackingForward(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] transition-all"
                  />
                </div>

              </div>

              {/* Other Charges & Grand Total Callout */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-2 border-t border-slate-200">
                <div className="w-full sm:w-48">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Other Charges (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={other}
                    onChange={(e) => setOther(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] transition-all"
                  />
                </div>

                {/* GRAND TOTAL CALLOUT BOX */}
                <div className="w-full sm:w-auto p-4 rounded-2xl text-white shadow-md flex items-center gap-4 justify-between sm:justify-end" style={{ backgroundColor: 'var(--theme-color)' }}>
                  <div>
                    <span className="text-[10px] uppercase font-black text-white/80 tracking-wider block">
                      Grand Total PO Amount
                    </span>
                    <span className="text-2xl font-black font-mono tracking-tight">
                      ₹{calcGrandTotal().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* FORM ACTIONS */}
            <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => navigate(queryTradeId ? `/trade/${queryTradeId}` : '/dashboard')}
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
                  <><RefreshCw size={15} className="animate-spin" /> Creating Process PO...</>
                ) : (
                  'Create Process Purchase Order'
                )}
              </button>
            </div>

          </form>
        </div>
      </div>

      {/* SOURCE ITEM SELECTOR MODAL */}
      <InventoryTraceSelectorModal
        isOpen={isSourceModalOpen}
        onClose={() => setIsSourceModalOpen(false)}
        onApply={handleApplySourceSelections}
        initialSelections={sourceItems}
        allowedItemCodes={rqSourceItemCodes.length > 0 ? rqSourceItemCodes : null}
        rqId={receivedQId || queryRqId}
        apiEndpoint="/api/process-po/trace-items"
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
