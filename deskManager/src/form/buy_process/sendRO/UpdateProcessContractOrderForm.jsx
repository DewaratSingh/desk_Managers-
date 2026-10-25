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
  Save,
  FileSignature
} from 'lucide-react';
import { toast } from 'react-toastify';

import InventoryTraceSelectorModal from '../../../components/InventoryTraceSelectorModal';
import TargetItemSelectorModal from '../../../components/TargetItemSelectorModal';

export default function UpdateProcessContractOrderForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryTradeId = searchParams.get('trade_id');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  // Form State
  const [roNo, setRoNo] = useState('');
  const [dateOfStart, setDateOfStart] = useState('');
  const [dateOfEnd, setDateOfEnd] = useState('');
  const [seller, setSeller] = useState('');
  const [party, setParty] = useState('');
  const [contractId, setContractId] = useState('');
  const [contractRef, setContractRef] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [message, setMessage] = useState('');
  const [tradeId, setTradeId] = useState('');

  // GST & Additional Charges
  const [gstType, setGstType] = useState('CGST+SGST');
  const [gstRate, setGstRate] = useState('18');
  const [transport, setTransport] = useState('0');
  const [packingForward, setPackingForward] = useState('0');
  const [other, setOther] = useState('0');

  // Items
  const [sourceItems, setSourceItems] = useState([]);
  const [targetItems, setTargetItems] = useState([]);

  // Modals
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);

  // Autocomplete suggestions
  const [sellerInput, setSellerInput] = useState('');
  const [sellerSuggestions, setSellerSuggestions] = useState([]);
  const [showSellerDropdown, setShowSellerDropdown] = useState(false);
  const sellerRef = useRef(null);

  const [partyInput, setPartyInput] = useState('');
  const [partySuggestions, setPartySuggestions] = useState([]);
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);
  const partyRef = useRef(null);

  // Load Existing Process RO Data
  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError(null);

    fetch(`/api/process-ro/${encodeURIComponent(id)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Process Contract Order (RO) not found');
        return res.json();
      })
      .then((data) => {
        setRoNo(data.ro_no || '');
        setDateOfStart(data.date_of_start ? data.date_of_start.split('T')[0] : '');
        setDateOfEnd(data.date_of_end ? data.date_of_end.split('T')[0] : (data.delivery_date ? data.delivery_date.split('T')[0] : ''));
        setSeller(data.seller || '');
        setSellerInput(data.seller || '');
        setParty(data.party || '');
        setPartyInput(data.party || '');
        setContractId(data.contract_id || '');
        setContractRef(data.contract_ref || '');
        setShippingAddress(data.shipping_address || '');
        setMessage(data.message || '');
        setTradeId(data.trade_id || queryTradeId || '');
        setGstType(data.gst_type || 'CGST+SGST');
        setGstRate(data.gst_rate !== undefined && data.gst_rate !== null ? String(data.gst_rate) : '18');
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
            history: src.history || []
          }))
        );

        // Target Items
        const tgtList = Array.isArray(data.target_items) ? data.target_items : (Array.isArray(data.items) ? data.items : []);
        setTargetItems(
          tgtList.map((tgt) => ({
            item_code: tgt.item_code || '',
            description: tgt.description || '',
            process_name: tgt.process_name || 'Processing',
            qty: String(tgt.qty || tgt.quantity || 1),
            price: String(tgt.price || tgt.rate || 0),
            gst_type: tgt.gst_type || '',
            gst_rate: tgt.gst_rate !== undefined ? String(tgt.gst_rate) : ''
          }))
        );
      })
      .catch((err) => {
        console.error('Fetch error:', err);
        setError(err.message || 'Failed to load Process Contract Order');
      })
      .finally(() => setIsLoading(false));
  }, [id, queryTradeId]);

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sellerRef.current && !sellerRef.current.contains(e.target)) setShowSellerDropdown(false);
      if (partyRef.current && !partyRef.current.contains(e.target)) setShowPartyDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Seller Search
  const handleSellerChange = (e) => {
    const val = e.target.value;
    setSellerInput(val);
    setSeller(val);
    if (!val.trim()) {
      setSellerSuggestions([]);
      setShowSellerDropdown(false);
      return;
    }
    fetch(`/api/buyers?search=${encodeURIComponent(val)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setSellerSuggestions(Array.isArray(data) ? data : []);
        setShowSellerDropdown(true);
      })
      .catch(() => setSellerSuggestions([]));
  };

  // Party Search
  const handlePartyChange = (e) => {
    const val = e.target.value;
    setPartyInput(val);
    setParty(val);
    if (!val.trim()) {
      setPartySuggestions([]);
      setShowPartyDropdown(false);
      return;
    }
    fetch(`/api/customers?search=${encodeURIComponent(val)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setPartySuggestions(Array.isArray(data) ? data : []);
        setShowPartyDropdown(true);
      })
      .catch(() => setPartySuggestions([]));
  };

  // Source Items Handlers
  const handleSourceSelect = (selectedTraces) => {
    const newItems = selectedTraces.map((trace) => ({
      item_code: trace.item_code || trace.itemcode || '',
      description: trace.description || '',
      trace_item_id: trace.id || trace.trace_id,
      qty: String(trace.qty || 1),
      history: trace.history || []
    }));
    setSourceItems((prev) => [...prev, ...newItems]);
    setIsSourceModalOpen(false);
  };

  const removeSourceItem = (index) => {
    setSourceItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const updateSourceItemQty = (index, val) => {
    setSourceItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, qty: val } : item))
    );
  };

  // Target Items Handlers
  const handleTargetSelect = (selectedProducts) => {
    const list = Array.isArray(selectedProducts) ? selectedProducts : (selectedProducts ? [selectedProducts] : []);
    const newItems = list.map((p) => ({
      item_code: p.item_code || '',
      description: p.description || '',
      process_name: p.process_name || 'Processing',
      qty: String(p.qty || 1),
      price: String(p.price || 0),
      gst_type: gstType,
      gst_rate: gstRate
    }));
    setTargetItems((prev) => [...prev, ...newItems]);
    setIsTargetModalOpen(false);
  };

  const removeTargetItem = (index) => {
    setTargetItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const updateTargetItem = (index, field, val) => {
    setTargetItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: val } : item))
    );
  };

  // Financial Calculations
  const basicValue = targetItems.reduce((acc, t) => {
    const q = parseFloat(t.qty) || 0;
    const p = parseFloat(t.price) || 0;
    return acc + q * p;
  }, 0);

  const tVal = parseFloat(transport) || 0;
  const pfVal = parseFloat(packingForward) || 0;
  const oVal = parseFloat(other) || 0;
  const taxableBase = basicValue + tVal + pfVal + oVal;

  const rateNum = parseFloat(gstRate) || 0;
  const gstAmount = gstType !== 'NONE' ? (taxableBase * rateNum) / 100 : 0;
  const grandTotal = taxableBase + gstAmount;

  // Handle Save
  const handleSave = async (e) => {
    e.preventDefault();

    if (!seller || !seller.trim()) {
      toast.error('Seller / Processor is required');
      return;
    }
    if (!party || !party.trim()) {
      toast.error('Party / Client Customer is required');
      return;
    }
    if (targetItems.length === 0) {
      toast.error('At least one Target Item is required');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        contract_id: contractId || null,
        contract_ref: contractRef || null,
        date_of_start: dateOfStart || null,
        date_of_end: dateOfEnd || null,
        delivery_date: dateOfEnd || null,
        seller: seller.trim(),
        party: party.trim(),
        gst_type: gstType,
        gst_rate: parseFloat(gstRate) || 0,
        gst: gstAmount,
        transport: tVal,
        packing_forward: pfVal,
        other: oVal,
        basic_value: basicValue,
        shipping_address: shippingAddress || null,
        message: message || null,
        source_items: sourceItems.map((s) => ({
          item_code: s.item_code,
          description: s.description,
          trace_item_id: s.trace_item_id,
          qty: parseFloat(s.qty) || 1,
          history: s.history || []
        })),
        target_items: targetItems.map((t) => ({
          item_code: t.item_code,
          description: t.description,
          process_name: t.process_name || 'Processing',
          qty: parseFloat(t.qty) || 1,
          rate: parseFloat(t.price) || 0,
          price: (parseFloat(t.qty) || 1) * (parseFloat(t.price) || 0),
          gst_type: t.gst_type || gstType,
          gst_rate: parseFloat(t.gst_rate || gstRate) || 0
        }))
      };

      const res = await fetch(`/api/process-ro/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast.success(`Process Contract Order ${roNo} updated successfully!`);
        navigate(tradeId ? `/trade/${encodeURIComponent(tradeId)}` : '/dashboard');
      } else {
        const errData = await res.json();
        toast.error(errData.error || 'Failed to update Process Contract Order');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error updating Process Contract Order');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 p-6 bg-slate-100 min-h-screen flex items-center justify-center">
        <div className="bg-[white] border border-slate-200 rounded-2xl p-8 flex flex-col items-center gap-3 shadow-sm">
          <RefreshCw className="animate-spin text-amber-600" size={32} />
          <p className="text-sm font-bold text-slate-700">Loading Process Contract Order...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 p-6 bg-slate-100 min-h-screen flex items-center justify-center">
        <div className="bg-[white] border border-rose-200 rounded-2xl p-8 flex flex-col items-center gap-3 shadow-sm max-w-md text-center">
          <AlertCircle className="text-rose-500" size={36} />
          <h2 className="text-base font-bold text-slate-900">Failed to Load</h2>
          <p className="text-xs text-slate-500">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 sm:p-6 bg-slate-100 min-h-screen font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Bar */}
        <div className="bg-[white] border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-slate-800 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black tracking-wider text-amber-600 uppercase bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Process Contract Order (RO)
                </span>
                <span className="text-xs font-mono font-bold text-slate-400">#{roNo}</span>
              </div>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 mt-0.5">
                Update Process Contract Order
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow transition-all disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            {isSaving ? 'Updating...' : 'Save Changes'}
          </button>
        </div>

        {/* Main Form Body */}
        <form onSubmit={handleSave} className="space-y-6">
          {/* Header Specs Card */}
          <div className="bg-[white] border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5">
            <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <FileSignature size={14} className="text-amber-600" /> Contract Order Header Info
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">RO Number</label>
                <input
                  type="text"
                  value={roNo}
                  disabled
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Contract / ARC Ref</label>
                <input
                  type="text"
                  value={contractRef}
                  onChange={(e) => setContractRef(e.target.value)}
                  placeholder="e.g. ARC-2026-001"
                  className="w-full px-3 py-2 bg-[white] border border-slate-300 rounded-lg text-xs font-semibold focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Start / Order Date</label>
                <input
                  type="date"
                  value={dateOfStart}
                  onChange={(e) => setDateOfStart(e.target.value)}
                  className="w-full px-3 py-2 bg-[white] border border-slate-300 rounded-lg text-xs font-semibold focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Expected Delivery Date</label>
                <input
                  type="date"
                  value={dateOfEnd}
                  onChange={(e) => setDateOfEnd(e.target.value)}
                  className="w-full px-3 py-2 bg-[white] border border-slate-300 rounded-lg text-xs font-semibold focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Parties */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              <div ref={sellerRef} className="relative">
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                  <Building2 size={12} className="text-amber-600" /> Seller / Processor Vendor *
                </label>
                <input
                  type="text"
                  value={sellerInput}
                  onChange={handleSellerChange}
                  placeholder="Select or enter seller..."
                  className="w-full px-3 py-2 bg-[white] border border-slate-300 rounded-lg text-xs font-semibold focus:border-amber-500 focus:outline-none"
                />
                {showSellerDropdown && sellerSuggestions.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-[white] border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {sellerSuggestions.map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSeller(s.name || s.buyer_name || '');
                          setSellerInput(s.name || s.buyer_name || '');
                          setShowSellerDropdown(false);
                        }}
                        className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-amber-50 border-b border-slate-100 last:border-none"
                      >
                        {s.name || s.buyer_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div ref={partyRef} className="relative">
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                  <User size={12} className="text-amber-600" /> Party / Client Customer *
                </label>
                <input
                  type="text"
                  value={partyInput}
                  onChange={handlePartyChange}
                  placeholder="Select or enter client customer..."
                  className="w-full px-3 py-2 bg-[white] border border-slate-300 rounded-lg text-xs font-semibold focus:border-amber-500 focus:outline-none"
                />
                {showPartyDropdown && partySuggestions.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-[white] border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {partySuggestions.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setParty(p.name || p.customer_name || '');
                          setPartyInput(p.name || p.customer_name || '');
                          setShowPartyDropdown(false);
                        }}
                        className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-amber-50 border-b border-slate-100 last:border-none"
                      >
                        {p.name || p.customer_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Shipping & Message */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Shipping / Delivery Address</label>
                <textarea
                  rows={2}
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  placeholder="Enter delivery site/address..."
                  className="w-full px-3 py-2 bg-[white] border border-slate-300 rounded-lg text-xs font-medium focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Special Processing Instructions</label>
                <textarea
                  rows={2}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Notes, tolerances, packing instructions..."
                  className="w-full px-3 py-2 bg-[white] border border-slate-300 rounded-lg text-xs font-medium focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section: Source Items (Raw Materials from Inventory Trace) */}
          <div className="bg-[white] border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Package size={14} className="text-amber-600" /> Raw Materials Dispatched (Source Items)
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">Inventory batches sent to processor for jobwork</p>
              </div>
              <button
                type="button"
                onClick={() => setIsSourceModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                + Add Raw Material
              </button>
            </div>

            {sourceItems.length === 0 ? (
              <div className="p-6 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
                No raw material items assigned. Click "+ Add Raw Material" to select from inventory trace.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5">Item Code</th>
                      <th className="px-3 py-2.5">Description</th>
                      <th className="px-3 py-2.5">Trace Ref</th>
                      <th className="px-3 py-2.5 w-28">Quantity</th>
                      <th className="px-3 py-2.5 text-center w-12">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {sourceItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2 font-mono font-bold text-amber-700">{item.item_code}</td>
                        <td className="px-3 py-2 text-slate-600">{item.description || '—'}</td>
                        <td className="px-3 py-2 font-mono text-[11px] text-slate-500">
                          {item.trace_item_id ? `#${item.trace_item_id}` : 'Manual'}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.qty}
                            onChange={(e) => updateSourceItemQty(idx, e.target.value)}
                            className="w-full px-2 py-1 bg-[white] border border-slate-300 rounded font-semibold text-xs focus:border-amber-500 focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeSourceItem(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section: Target Items (Finished / Processed Products Expected) */}
          <div className="bg-[white] border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Layers size={14} className="text-amber-600" /> Output Products Expected (Target Items)
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">Finished output goods and jobwork processing charges</p>
              </div>
              <button
                type="button"
                onClick={() => setIsTargetModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                + Add Target Item
              </button>
            </div>

            {targetItems.length === 0 ? (
              <div className="p-6 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
                No target products defined. Click "+ Add Target Item" to add processed goods.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5">Item Code</th>
                      <th className="px-3 py-2.5">Description</th>
                      <th className="px-3 py-2.5">Process Name</th>
                      <th className="px-3 py-2.5 w-24">Qty</th>
                      <th className="px-3 py-2.5 w-28">Rate (₹)</th>
                      <th className="px-3 py-2.5 w-28">Total (₹)</th>
                      <th className="px-3 py-2.5 text-center w-12">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {targetItems.map((item, idx) => {
                      const q = parseFloat(item.qty) || 0;
                      const r = parseFloat(item.price) || 0;
                      const lineTotal = q * r;

                      return (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2 font-mono font-bold text-amber-700">{item.item_code}</td>
                          <td className="px-3 py-2 text-slate-600">{item.description || '—'}</td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={item.process_name}
                              onChange={(e) => updateTargetItem(idx, 'process_name', e.target.value)}
                              className="w-full px-2 py-1 bg-[white] border border-slate-300 rounded text-xs font-medium focus:border-amber-500 focus:outline-none"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={item.qty}
                              onChange={(e) => updateTargetItem(idx, 'qty', e.target.value)}
                              className="w-full px-2 py-1 bg-[white] border border-slate-300 rounded font-semibold text-xs focus:border-amber-500 focus:outline-none"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={item.price}
                              onChange={(e) => updateTargetItem(idx, 'price', e.target.value)}
                              className="w-full px-2 py-1 bg-[white] border border-slate-300 rounded font-semibold text-xs focus:border-amber-500 focus:outline-none"
                            />
                          </td>
                          <td className="px-3 py-2 font-mono font-bold text-slate-900">
                            ₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeTargetItem(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                            >
                              <Trash2 size={13} />
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

          {/* Charges & Summary Card */}
          <div className="bg-[white] border border-slate-200 rounded-2xl p-5 shadow-xs grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Taxes & Additional Charges
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">GST Type</label>
                  <select
                    value={gstType}
                    onChange={(e) => setGstType(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-[white] border border-slate-300 rounded-lg text-xs font-semibold focus:border-amber-500 focus:outline-none"
                  >
                    <option value="CGST+SGST">CGST + SGST</option>
                    <option value="IGST">IGST</option>
                    <option value="NONE">None / Exempt</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">GST Rate (%)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={gstRate}
                    onChange={(e) => setGstRate(e.target.value)}
                    disabled={gstType === 'NONE'}
                    className="w-full px-2.5 py-1.5 bg-[white] border border-slate-300 rounded-lg text-xs font-semibold focus:border-amber-500 focus:outline-none disabled:bg-slate-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Transport (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={transport}
                    onChange={(e) => setTransport(e.target.value)}
                    className="w-full px-2 py-1 bg-[white] border border-slate-300 rounded text-xs font-medium focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Packing (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={packingForward}
                    onChange={(e) => setPackingForward(e.target.value)}
                    className="w-full px-2 py-1 bg-[white] border border-slate-300 rounded text-xs font-medium focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Other (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={other}
                    onChange={(e) => setOther(e.target.value)}
                    className="w-full px-2 py-1 bg-[white] border border-slate-300 rounded text-xs font-medium focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-2">Order Value Breakdown</h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Basic Items Value:</span>
                  <span className="font-mono font-bold">₹{basicValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                {(tVal > 0 || pfVal > 0 || oVal > 0) && (
                  <div className="flex justify-between text-slate-600">
                    <span>Additional Charges:</span>
                    <span className="font-mono font-bold">₹{(tVal + pfVal + oVal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>GST ({gstType !== 'NONE' ? `${gstRate}%` : '0%'}):</span>
                  <span className="font-mono font-bold">₹{gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-black text-slate-900">
                  <span>Total Amount:</span>
                  <span className="font-mono text-amber-700">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              {isSaving ? 'Updating...' : 'Save & Update Contract Order'}
            </button>
          </div>
        </form>
      </div>

      {/* Trace Selection Modal for Source Items */}
      <InventoryTraceSelectorModal
        isOpen={isSourceModalOpen}
        onClose={() => setIsSourceModalOpen(false)}
        onApply={(selections) => {
          const newItems = selections.map((st) => ({
            item_code: st.item_code || '',
            description: st.description || '',
            trace_item_id: st.trace_id || st.trace_item_id || null,
            qty: String(st.qty || st.Qty || 1),
            available_qty: st.available_qty || ''
          }));
          setSourceItems(newItems);
        }}
        initialSelections={sourceItems}
        apiEndpoint="/api/process-po/trace-items"
      />

      {/* Target Items Modal */}
      <TargetItemSelectorModal
        isOpen={isTargetModalOpen}
        onClose={() => setIsTargetModalOpen(false)}
        onSelect={handleTargetSelect}
      />
    </div>
  );
}
