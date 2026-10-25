import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  FileText,
  ArrowLeft,
  Layers,
  Package,
  RefreshCw,
  Trash2,
  Building2,
  User,
  DollarSign,
  Search,
  CheckCircle2,
  X,
  AlertCircle,
  Save
} from 'lucide-react';
import { toast } from 'react-toastify';

import InventoryTraceSelectorModal from '../../../components/InventoryTraceSelectorModal';
import TargetItemSelectorModal from '../../../components/TargetItemSelectorModal';

export default function UpdateProcessPurchaseOrderForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryTradeId = searchParams.get('trade_id');

  // Loading & State
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  // Header State
  const [poNo, setPoNo] = useState('');
  const [dateOfStart, setDateOfStart] = useState('');
  const [dateOfEnd, setDateOfEnd] = useState('');
  const [message, setMessage] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [tradeId, setTradeId] = useState('');
  const [receivedQId, setReceivedQId] = useState('');
  const [jobIds, setJobIds] = useState([]);

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

  // Source & Target Items
  const [sourceItems, setSourceItems] = useState([]);
  const [targetItems, setTargetItems] = useState([]);

  // Financial Summary State & Search-based GST
  const [gstType, setGstType] = useState('');
  const [gstRate, setGstRate] = useState('');
  const [summaryGstInput, setSummaryGstInput] = useState('');
  const [summaryGstSuggestions, setSummaryGstSuggestions] = useState([]);
  const [showSummaryGstDropdown, setShowSummaryGstDropdown] = useState(false);
  const summaryGstRef = useRef(null);
  const summaryGstTimeoutRef = useRef(null);

  // Per-target-item GST search state
  const [targetGstSearchInput, setTargetGstSearchInput] = useState({});
  const [targetGstDropdownOpen, setTargetGstDropdownOpen] = useState({});
  const [targetGstSuggestions, setTargetGstSuggestions] = useState({});
  const targetGstRefs = useRef({});
  const targetGstTimeoutRefs = useRef({});

  const [transport, setTransport] = useState('0');
  const [packingForward, setPackingForward] = useState('0');
  const [other, setOther] = useState('0');

  // Modals
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);

  // Fetch Existing Process PO Data
  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError(null);

    fetch(`/api/process-po/${encodeURIComponent(id)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Process Purchase Order not found');
        return res.json();
      })
      .then((data) => {
        setPoNo(data.po_no || '');
        setDateOfStart(data.date_of_start ? data.date_of_start.split('T')[0] : '');
        setDateOfEnd(data.date_of_end ? data.date_of_end.split('T')[0] : (data.delivery_date ? data.delivery_date.split('T')[0] : ''));
        setMessage(data.message || '');
        setShippingAddress(data.shipping_address || '');
        setTradeId(data.trade_id || queryTradeId || '');
        setReceivedQId(data.received_q_id ? String(data.received_q_id) : '');
        setJobIds(Array.isArray(data.job_ids) ? data.job_ids : []);

        const s = data.seller || '';
        setSeller(s);
        setSellerInput(s);

        const p = data.party || '';
        setParty(p);
        setPartyInput(p);

        setGstType(data.gst_type || '');
        setGstRate(data.gst_rate !== undefined && data.gst_rate !== null ? String(data.gst_rate) : '');
        if (data.gst_type) {
          setSummaryGstInput(`${data.gst_type} (${data.gst_rate || 0}%)`);
        }

        setTransport(String(data.transport || 0));
        setPackingForward(String(data.packing_forward || 0));
        setOther(String(data.other || 0));

        // Source Items
        const srcList = Array.isArray(data.source_items) ? data.source_items : [];
        setSourceItems(
          srcList.map((src) => ({
            item_code: src.item_code || '',
            description: src.description || '',
            trace_item_id: src.trace_item_id || null,
            qty: String(src.qty || 1),
            available_qty: src.available_qty || ''
          }))
        );

        // Target Items
        const tgtList = Array.isArray(data.target_items) ? data.target_items : [];
        setTargetItems(
          tgtList.map((tgt) => ({
            item_code: tgt.item_code || '',
            description: tgt.description || '',
            qty: String(tgt.qty || 1),
            price: String(tgt.price || 0),
            gst_type: tgt.gst_type || '',
            gst_rate: tgt.gst_rate !== undefined && tgt.gst_rate !== null ? String(tgt.gst_rate) : '',
            process_name: tgt.process_name || '',
            delivered_qty: tgt.delivered_qty || 0
          }))
        );
      })
      .catch((err) => {
        console.error(err);
        setError(err.message || 'Failed to load Process Purchase Order');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [id, queryTradeId]);

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
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => {
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
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => {
          if (Array.isArray(data)) setPartySuggestions(data);
        })
        .catch(console.error);
    }, 200);
    return () => clearTimeout(timer);
  }, [partyInput]);

  // Outside click to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sellerRef.current && !sellerRef.current.contains(e.target)) {
        setShowSellerDropdown(false);
      }
      if (partyRef.current && !partyRef.current.contains(e.target)) {
        setShowPartyDropdown(false);
      }
      if (summaryGstRef.current && !summaryGstRef.current.contains(e.target)) {
        setShowSummaryGstDropdown(false);
      }
      Object.keys(targetGstRefs.current).forEach((key) => {
        const ref = targetGstRefs.current[key];
        if (ref && !ref.contains(e.target)) {
          setTargetGstDropdownOpen((prev) => ({ ...prev, [key]: false }));
        }
      });
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Summary GST Search Suggestions On-Demand Fetcher
  const fetchSummaryGstSuggestions = (val) => {
    if (summaryGstTimeoutRef.current) {
      clearTimeout(summaryGstTimeoutRef.current);
    }
    const isSelectedFormat = /^[A-Z0-9\s+]+\s*\(\d+(\.\d+)?%\)$/i.test(val);
    if (isSelectedFormat) return;

    summaryGstTimeoutRef.current = setTimeout(() => {
      fetch(`/api/gst-rates?q=${encodeURIComponent(val)}&limit=5`)
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => {
          setSummaryGstSuggestions(Array.isArray(data) ? data : []);
        })
        .catch(console.error);
    }, 200);
  };

  const handleSummaryGstSearch = (value) => {
    setSummaryGstInput(value);
    setGstType('');
    setGstRate('');
    setShowSummaryGstDropdown(true);
    fetchSummaryGstSuggestions(value);
  };

  const selectSummaryGst = (gst) => {
    setGstType(gst.type);
    setGstRate(String(gst.rate));
    setSummaryGstInput(`${gst.type} (${gst.rate}%)`);
    setShowSummaryGstDropdown(false);
  };

  const clearSummaryGst = () => {
    setGstType('');
    setGstRate('');
    setSummaryGstInput('');
    setShowSummaryGstDropdown(false);
  };

  // Target Item GST Search Suggestions On-Demand Fetcher
  const fetchTargetGstSuggestions = (idx, val) => {
    if (targetGstTimeoutRefs.current[idx]) {
      clearTimeout(targetGstTimeoutRefs.current[idx]);
    }
    const isSelectedFormat = /^[A-Z0-9\s+]+\s*\(\d+(\.\d+)?%\)$/i.test(val);
    if (isSelectedFormat) return;

    targetGstTimeoutRefs.current[idx] = setTimeout(() => {
      fetch(`/api/gst-rates?q=${encodeURIComponent(val)}&limit=5`)
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => {
          setTargetGstSuggestions((prev) => ({ ...prev, [idx]: Array.isArray(data) ? data : [] }));
        })
        .catch(console.error);
    }, 200);
  };

  const handleTargetGstSearch = (idx, value) => {
    setTargetGstSearchInput((prev) => ({ ...prev, [idx]: value }));
    setTargetItems((prev) => prev.map((t, i) => (i === idx ? { ...t, gst_type: '', gst_rate: '' } : t)));
    setTargetGstDropdownOpen((prev) => ({ ...prev, [idx]: true }));
    fetchTargetGstSuggestions(idx, value);
  };

  const selectTargetItemGst = (idx, gst) => {
    setTargetItems((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, gst_type: gst.type, gst_rate: String(gst.rate) } : t))
    );
    setTargetGstSearchInput((prev) => ({ ...prev, [idx]: `${gst.type} (${gst.rate}%)` }));
    setTargetGstDropdownOpen((prev) => ({ ...prev, [idx]: false }));
  };

  const clearTargetItemGst = (idx) => {
    setTargetItems((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, gst_type: '', gst_rate: '' } : t))
    );
    setTargetGstSearchInput((prev) => ({ ...prev, [idx]: '' }));
    setTargetGstDropdownOpen((prev) => ({ ...prev, [idx]: false }));
  };

  const updateTargetItem = (index, field, value) => {
    setTargetItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  // Handlers for Source Items Selection
  const handleApplySourceSelections = (selectionsArray) => {
    if (!Array.isArray(selectionsArray) || selectionsArray.length === 0) return;

    const newSourceItems = selectionsArray.map((st) => ({
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
    setSourceItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Handlers for Target Items Selection
  const handleApplyTargetSelection = (targetObj) => {
    setTargetItems((prev) => [
      ...prev,
      {
        item_code: targetObj.item_code,
        description: targetObj.description || '',
        qty: targetObj.qty !== undefined ? String(targetObj.qty) : '1',
        price: targetObj.price !== undefined ? String(targetObj.price) : '0',
        gst_type: '',
        gst_rate: ''
      }
    ]);

    setIsTargetModalOpen(false);
    toast.success(`Added Target Item ${targetObj.item_code}`);
  };

  const handleRemoveTargetItem = (index) => {
    setTargetItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Financial Calculations
  const calcItemBasic = (item) => (parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0);
  const calcItemGst = (item) => {
    const itemRate = parseFloat(item.gst_rate);
    const effectiveRate = !isNaN(itemRate) && item.gst_rate !== '' ? itemRate : (parseFloat(gstRate) || 0);
    return (calcItemBasic(item) * effectiveRate) / 100;
  };
  const calcItemTotal = (item) => calcItemBasic(item) + calcItemGst(item);

  const calcTargetBasicTotal = () => {
    return targetItems.reduce((sum, item) => sum + calcItemBasic(item), 0);
  };

  const calcGstAmount = () => {
    return targetItems.reduce((sum, item) => sum + calcItemGst(item), 0);
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

  // Submit Update Process PO Form
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!seller || !seller.trim()) {
      toast.error('Seller / Processor Vendor is required');
      return;
    }

    if (!party || !party.trim()) {
      toast.error('Party / Client Customer is required');
      return;
    }

    if (sourceItems.length === 0) {
      toast.error('Please select at least one source trace item from inventory');
      return;
    }

    if (targetItems.length === 0) {
      toast.error('Please enter at least one target output product in the table');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        po_no: poNo.trim(),
        date_of_start: dateOfStart,
        date_of_end: dateOfEnd || null,
        seller: seller.trim(),
        party: party.trim(),
        gst_type: gstType || null,
        gst_rate: parseFloat(gstRate) || 0,
        gst: calcGstAmount(),
        transport: parseFloat(transport) || 0,
        packing_forward: parseFloat(packingForward) || 0,
        other: parseFloat(other) || 0,
        basic_value: calcTargetBasicTotal(),
        delivery_date: dateOfEnd || null,
        shipping_address: shippingAddress || null,
        message: message || null,
        source_items: sourceItems,
        target_items: targetItems.map((t) => {
          const itemRate = parseFloat(t.gst_rate);
          const effectiveRate = !isNaN(itemRate) && t.gst_rate !== '' ? itemRate : (parseFloat(gstRate) || 0);
          const effectiveType = t.gst_type || gstType || null;
          return {
            ...t,
            qty: parseFloat(t.qty) || 0,
            price: parseFloat(t.price) || 0,
            gst_type: effectiveType,
            gst_rate: effectiveRate
          };
        })
      };

      const res = await fetch(`/api/process-po/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Process Purchase Order ${data.po_no || poNo} updated successfully!`);
        const destTradeId = data.trade_id || tradeId || queryTradeId;
        navigate(destTradeId ? `/trade/${encodeURIComponent(destTradeId)}` : '/process-po-list');
      } else {
        const errData = await res.json();
        toast.error(errData.error || 'Failed to update Process Purchase Order');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error updating Process Purchase Order');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 p-6 bg-slate-100 min-h-screen flex items-center justify-center">
        <div className="bg-[white] border border-slate-200 rounded-2xl p-8 flex flex-col items-center gap-3 shadow-sm">
          <RefreshCw size={28} className="animate-spin text-slate-500" style={{ color: 'var(--theme-color)' }} />
          <p className="text-xs font-bold text-slate-600">Loading Process Purchase Order...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 p-6 bg-slate-100 min-h-screen flex items-center justify-center">
        <div className="bg-[white] border border-red-200 rounded-2xl p-8 flex flex-col items-center gap-3 shadow-sm max-w-md text-center">
          <div className="p-3 bg-red-50 text-red-600 rounded-full">
            <AlertCircle size={28} />
          </div>
          <h2 className="text-sm font-bold text-slate-900">{error}</h2>
          <button
            type="button"
            onClick={() => navigate(queryTradeId ? `/trade/${queryTradeId}` : '/process-po-list')}
            className="px-4 py-2 text-white text-xs font-bold rounded-xl cursor-pointer"
            style={{ backgroundColor: 'var(--theme-color)' }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

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
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  Update Process Purchase Order
                </h1>
                <span
                  className="font-mono text-xs font-bold px-2 py-0.5 rounded border"
                  style={{
                    color: 'var(--theme-color)',
                    borderColor: 'var(--theme-color)',
                    backgroundColor: 'rgba(217, 53, 45, 0.05)'
                  }}
                >
                  {poNo}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Modify vendor details, target items, raw materials, or tax & charge rates.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate(tradeId ? `/trade/${tradeId}` : (queryTradeId ? `/trade/${queryTradeId}` : '/process-po-list'))}
            className="px-3.5 py-2 bg-[white] border border-slate-300 hover:border-slate-400 rounded-xl text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <ArrowLeft size={15} /> Back
          </button>
        </div>

        {/* FORM CONTAINER CARD */}
        <div className="border border-slate-300 rounded-3xl bg-[white] p-6 shadow-sm space-y-6">

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* BASIC HEADER METADATA SECTION */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">

              {/* Process PO No */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Process PO No.
                </label>
                <input
                  type="text"
                  disabled
                  value={poNo}
                  className="w-full px-3.5 py-2 bg-slate-100 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-600 cursor-not-allowed"
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
                  className="w-full px-3.5 py-2 bg-[white] border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] transition-all"
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
                  className="w-full px-3.5 py-2 bg-[white] border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] transition-all"
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
                  className="w-full px-3.5 py-2 bg-[white] border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] transition-all"
                />
              </div>

              {/* Seller / Processor Vendor */}
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
                  className="w-full px-3.5 py-2 bg-[white] border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] transition-all"
                  autoComplete="off"
                />
                {showSellerDropdown && sellerSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-[white] border border-slate-300 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto text-xs">
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
                  className="w-full px-3.5 py-2 bg-[white] border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] transition-all"
                  autoComplete="off"
                />
                {showPartyDropdown && partySuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-[white] border border-slate-300 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto text-xs">
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

              {/* Shipping Address */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Shipping Address <span className="text-slate-400 font-normal lowercase">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Factory site address or delivery location"
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[white] border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] transition-all"
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
                    <div key={idx} className="bg-[white] border border-amber-200 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
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
                <div className="p-6 text-center border border-dashed border-amber-300/80 rounded-xl bg-[white] text-slate-400 text-xs font-medium">
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
                <div className="space-y-3">
                  {targetItems.map((tgt, idx) => {
                    const itemQty = parseFloat(tgt.qty) || 0;
                    const itemPrice = parseFloat(tgt.price) || 0;
                    const itemBasic = itemQty * itemPrice;
                    const itemGst = calcItemGst(tgt);
                    const itemTotal = itemBasic + itemGst;

                    return (
                      <div key={idx} className="bg-[white] border border-emerald-200 rounded-xl p-3.5 space-y-3 shadow-2xs">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                          <div className="space-y-0.5 flex-1">
                            <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                              <span>{tgt.item_code}</span>
                              {tgt.process_name && (
                                <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.2 rounded">
                                  {tgt.process_name}
                                </span>
                              )}
                            </div>
                            {tgt.description && <div className="text-[10px] text-slate-500 truncate">{tgt.description}</div>}
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <span className="text-[9px] text-slate-400 font-bold block uppercase">Total</span>
                              <span className="text-xs font-mono font-black text-emerald-950">₹{itemTotal.toFixed(2)}</span>
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

                        {/* Editable Qty, Unit Price, GST Rate Search, Item Total */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Target Qty *</label>
                            <input
                              type="number"
                              step="any"
                              min="0.01"
                              value={tgt.qty}
                              onChange={(e) => updateTargetItem(idx, 'qty', e.target.value)}
                              className="w-full px-2.5 py-1.5 font-bold text-xs text-slate-800 bg-[white] border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--theme-color)]"
                            />
                          </div>

                          <div>
                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Unit Price (₹) *</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={tgt.price}
                              onChange={(e) => updateTargetItem(idx, 'price', e.target.value)}
                              className="w-full px-2.5 py-1.5 font-bold text-xs text-slate-800 bg-[white] border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--theme-color)]"
                            />
                          </div>

                          {/* GST Rate search for Target Item */}
                          <div
                            className="relative"
                            style={{ zIndex: targetGstDropdownOpen[idx] ? 100 : 'auto' }}
                            ref={(el) => (targetGstRefs.current[idx] = el)}
                          >
                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">GST Rate</label>
                            <div className="relative">
                              <input
                                type="text"
                                placeholder={gstType ? `Inherit: ${gstType} (${gstRate}%)` : 'e.g. GST 18'}
                                value={targetGstSearchInput[idx] ?? (tgt.gst_type ? `${tgt.gst_type} (${tgt.gst_rate}%)` : '')}
                                onChange={(e) => handleTargetGstSearch(idx, e.target.value)}
                                onFocus={() => {
                                  setTargetGstDropdownOpen((prev) => ({ ...prev, [idx]: true }));
                                  fetchTargetGstSuggestions(idx, targetGstSearchInput[idx] || '');
                                }}
                                className="w-full pl-2.5 pr-6 py-1.5 text-xs text-slate-800 bg-[white] border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--theme-color)] font-medium"
                                autoComplete="off"
                              />
                              {tgt.gst_type && (
                                <button
                                  type="button"
                                  onClick={() => clearTargetItemGst(idx)}
                                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                                >
                                  <X size={12} />
                                </button>
                              )}
                            </div>

                            {targetGstDropdownOpen[idx] && (targetGstSuggestions[idx] || []).length > 0 && (
                              <div
                                className="absolute z-50 left-0 right-0 mt-1 bg-[white] border border-slate-300 rounded-lg shadow-xl max-h-44 overflow-y-auto"
                                style={{ backgroundColor: '#ffffff', opacity: 1 }}
                              >
                                {(targetGstSuggestions[idx] || []).map((g) => (
                                  <button
                                    key={g.id}
                                    type="button"
                                    onClick={() => selectTargetItemGst(idx, g)}
                                    className="w-full text-left px-2.5 py-1.5 bg-[white] hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer block"
                                    style={{ backgroundColor: '#ffffff' }}
                                  >
                                    <span className="font-bold text-xs text-slate-900">{g.type}</span>
                                    <span className="text-[10px] text-slate-500 ml-1.5">({g.rate}%)</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Item Total (₹)</label>
                            <div className="px-2.5 py-1.5 text-xs font-mono font-bold text-emerald-800 bg-emerald-50/60 border border-emerald-200 rounded-lg">
                              ₹{itemTotal.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 text-center border border-dashed border-emerald-300/80 rounded-xl bg-[white] text-slate-400 text-xs font-medium">
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
                  <div className="px-3.5 py-2 bg-[white] border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800">
                    ₹{calcTargetBasicTotal().toFixed(2)}
                  </div>
                </div>

                {/* GST Rate (Search-based autocomplete) */}
                <div
                  className="relative"
                  style={{ zIndex: showSummaryGstDropdown ? 100 : 'auto' }}
                  ref={summaryGstRef}
                >
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    GST Rate
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="e.g. GST 18"
                      value={summaryGstInput || (gstType ? `${gstType} (${gstRate}%)` : '')}
                      onChange={(e) => handleSummaryGstSearch(e.target.value)}
                      onFocus={() => {
                        setShowSummaryGstDropdown(true);
                        fetchSummaryGstSuggestions(summaryGstInput || '');
                      }}
                      className="w-full pl-3 pr-7 py-2 bg-[white] border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] transition-all"
                      autoComplete="off"
                    />
                    {gstType && (
                      <button
                        type="button"
                        onClick={clearSummaryGst}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  {showSummaryGstDropdown && summaryGstSuggestions.length > 0 && (
                    <div
                      className="absolute z-50 left-0 right-0 mt-1 bg-[white] border border-slate-300 rounded-xl shadow-xl max-h-48 overflow-y-auto"
                      style={{ backgroundColor: '#ffffff', opacity: 1 }}
                    >
                      {summaryGstSuggestions.map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => selectSummaryGst(g)}
                          className="w-full text-left px-3 py-2 bg-[white] hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer block"
                          style={{ backgroundColor: '#ffffff' }}
                        >
                          <span className="font-bold text-xs text-slate-900">{g.type}</span>
                          <span className="text-[10px] text-slate-500 ml-1.5">({g.rate}%)</span>
                        </button>
                      ))}
                    </div>
                  )}

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
                    className="w-full px-3.5 py-2 bg-[white] border border-slate-300 rounded-xl text-xs font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] transition-all"
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
                    className="w-full px-3.5 py-2 bg-[white] border border-slate-300 rounded-xl text-xs font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] transition-all"
                  />
                </div>

                {/* Other Charges */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Other Charges (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={other}
                    onChange={(e) => setOther(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[white] border border-slate-300 rounded-xl text-xs font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] transition-all"
                  />
                </div>

              </div>

              {/* Grand Total Callout */}
              <div className="flex justify-end pt-2 border-t border-slate-200">
                <div
                  className="w-full sm:w-auto p-4 rounded-2xl text-white shadow-md flex items-center gap-4 justify-between sm:justify-end"
                  style={{ backgroundColor: 'var(--theme-color)' }}
                >
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
                onClick={() => navigate(tradeId ? `/trade/${tradeId}` : (queryTradeId ? `/trade/${queryTradeId}` : '/process-po-list'))}
                className="px-5 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 text-white font-bold text-xs rounded-xl transition-all shadow-2xs cursor-pointer flex items-center gap-2 disabled:opacity-50"
                style={{ backgroundColor: 'var(--theme-color)' }}
                onMouseEnter={(e) => (e.target.style.filter = 'brightness(0.9)')}
                onMouseLeave={(e) => (e.target.style.filter = 'none')}
              >
                {isSaving ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" /> Updating Process PO...
                  </>
                ) : (
                  <>
                    <Save size={15} /> Update Process Purchase Order
                  </>
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
