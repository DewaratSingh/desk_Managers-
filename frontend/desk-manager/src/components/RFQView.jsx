import React, { useState, useRef, useEffect } from 'react';
import {
  Search, Edit2, Plus, RefreshCw, ArrowLeft, ListFilter, AlertCircle, X
} from 'lucide-react';
import { Link } from 'react-router-dom';

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'http://localhost:5000/api'
  : `${window.location.protocol}//${window.location.hostname}:5000/api`;

const EMPTY_FORM = {
  rfq_no: '',
  rfq_date: '',
  commercial_bid_due_date: '',
  technical_bid_due_date: '',
  buyer_id: null,
  buyer_name: '',
  buyer_email: '',
  buyer_phone: '',
  customer_id: '',
};

const fmtDate = (d) => {
  if (!d) return '—';
  if (d instanceof Date) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }
  if (typeof d === 'string' && d.match(/^\d{4}-\d{2}-\d{2}/)) {
    const parts = d.substring(0, 10).split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  const day = String(dt.getUTCDate()).padStart(2, '0');
  const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const year = dt.getUTCFullYear();
  return `${day}/${month}/${year}`;
};

export default function RFQView({
  rfqs, buyers, customers, items: catalogItems,
  onAddRFQ, onUpdateRFQ,
  onNavigateAndOpenForm,
  isLoading, error,
  fetchMoreData, searchResource
}) {
  const [viewMode, setViewMode] = useState('list');
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingRFQ, setEditingRFQ] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Buyer autocomplete
  const [buyerInput, setBuyerInput] = useState('');
  const [buyerSuggestions, setBuyerSuggestions] = useState([]);
  const [showBuyerDropdown, setShowBuyerDropdown] = useState(false);
  const buyerRef = useRef(null);

  // Customer autocomplete
  const [customerInput, setCustomerInput] = useState('');
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerRef = useRef(null);

  // Item search
  const [itemSearch, setItemSearch] = useState('');
  const [itemSuggestions, setItemSuggestions] = useState([]);
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const itemRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (buyerRef.current && !buyerRef.current.contains(e.target)) setShowBuyerDropdown(false);
      if (customerRef.current && !customerRef.current.contains(e.target)) setShowCustomerDropdown(false);
      if (itemRef.current && !itemRef.current.contains(e.target)) setShowItemDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Buyer ──
  const handleBuyerInput = async (val) => {
    setBuyerInput(val);
    setFormData(prev => ({ ...prev, buyer_name: val, buyer_id: null, buyer_email: '', buyer_phone: '' }));
    if (!val.trim()) { setBuyerSuggestions([]); setShowBuyerDropdown(false); return; }
    
    try {
      const res = await fetch(`${API_BASE_URL}/buyers?search=${encodeURIComponent(val)}&limit=5`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('dm_token')}` } });
      const data = await res.json();
      setBuyerSuggestions(data);
      setShowBuyerDropdown(true);
    } catch(e) { console.error(e); }
  };
  const selectBuyer = (b) => {
    setBuyerInput(b.name);
    setFormData(prev => ({ ...prev, buyer_id: b.id, buyer_name: b.name, buyer_email: b.email, buyer_phone: b.phone }));
    setShowBuyerDropdown(false);
  };
  const buyerNotFound = buyerInput.trim().length > 0 && !formData.buyer_id &&
    buyers.filter(b => b.name.toLowerCase().startsWith(buyerInput.toLowerCase())).length === 0;

  // ── Customer ──
  const handleCustomerInput = async (val) => {
    setCustomerInput(val);
    setFormData(prev => ({ ...prev, customer_id: val }));
    if (!val.trim()) { setCustomerSuggestions([]); setShowCustomerDropdown(false); return; }
    
    try {
      const res = await fetch(`${API_BASE_URL}/customers?search=${encodeURIComponent(val)}&limit=5`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('dm_token')}` } });
      const data = await res.json();
      setCustomerSuggestions(data);
      setShowCustomerDropdown(true);
    } catch(e) { console.error(e); }
  };
  const selectCustomer = (c) => {
    setCustomerInput(c.id);
    setFormData(prev => ({ ...prev, customer_id: c.id }));
    setShowCustomerDropdown(false);
  };
  const customerNotFound = customerInput.trim().length > 0 &&
    customers.filter(c => c.id.toLowerCase().startsWith(customerInput.toLowerCase()) || c.name.toLowerCase().startsWith(customerInput.toLowerCase())).length === 0;

  // ── Items ──
  const handleItemSearch = async (val) => {
    setItemSearch(val);
    if (!val.trim()) { setItemSuggestions([]); setShowItemDropdown(false); return; }
    
    try {
      const res = await fetch(`${API_BASE_URL}/items?search=${encodeURIComponent(val)}&limit=10`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('dm_token')}` } });
      const data = await res.json();
      const filtered = data.filter(i => !selectedItems.some(si => si.item_code === i.item_code));
      setItemSuggestions(filtered);
      setShowItemDropdown(true);
    } catch(e) { console.error(e); }
  };

  const addItem = (item) => {
    if (selectedItems.find(i => i.item_code === item.item_code)) {
      setItemSearch('');
      setShowItemDropdown(false);
      return; // already added
    }
    setSelectedItems(prev => [...prev, { item_code: item.item_code, description: item.description, drawing_number: item.drawing_number, quantity: 1 }]);
    setItemSearch('');
    setShowItemDropdown(false);
  };

  const removeItem = (item_code) => {
    setSelectedItems(prev => prev.filter(i => i.item_code !== item_code));
  };

  const handleQuantityChange = (item_code, qty) => {
    setSelectedItems(prev => prev.map(item => {
      if (item.item_code === item_code) {
        const parsed = parseInt(qty);
        return { 
          ...item, 
          quantity: qty === '' ? '' : (isNaN(parsed) || parsed < 1 ? 1 : parsed)
        };
      }
      return item;
    }));
  };

  // ── Navigation ──
  const openAddForm = () => {
    setEditingRFQ(null);
    setFormData(EMPTY_FORM);
    setBuyerInput(''); setCustomerInput('');
    setSelectedItems([]);
    setViewMode('form');
  };

  const openEditForm = (rfq) => {
    setEditingRFQ(rfq.rfq_no);
    setFormData({
      rfq_no: rfq.rfq_no,
      rfq_date: rfq.rfq_date ? rfq.rfq_date.slice(0, 10) : '',
      commercial_bid_due_date: rfq.commercial_bid_due_date ? rfq.commercial_bid_due_date.slice(0, 10) : '',
      technical_bid_due_date: rfq.technical_bid_due_date ? rfq.technical_bid_due_date.slice(0, 10) : '',
      buyer_id: rfq.buyer_id || null,
      buyer_name: rfq.buyer_name || '',
      buyer_email: rfq.buyer_email || '',
      buyer_phone: rfq.buyer_phone || '',
      customer_id: rfq.customer_id || '',
    });
    setBuyerInput(rfq.buyer_name || '');
    setCustomerInput(rfq.customer_id || '');
    setSelectedItems(Array.isArray(rfq.items) ? rfq.items.map(i => ({ ...i, quantity: i.quantity || 1 })) : []);
    setViewMode('form');
  };

  const backToList = () => {
    setEditingRFQ(null);
    setFormData(EMPTY_FORM);
    setBuyerInput(''); setCustomerInput('');
    setSelectedItems([]);
    setItemSearch('');
    setViewMode('list');
  };

  // ── Submit ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.rfq_no.trim() || !formData.rfq_date || !formData.commercial_bid_due_date || !formData.technical_bid_due_date) return;
    
    // if (selectedItems.length === 0) {
    //   alert("At least one item is required for the RFQ");
    //   return;
    // }

    for (const item of selectedItems) {
      const qty = parseInt(item.quantity);
      if (item.quantity === '' || isNaN(qty) || qty <= 0) {
        alert(`Quantity for item ${item.item_code} is compulsory and must be greater than 0.`);
        return;
      }
    }

    const payload = { ...formData, items: selectedItems };
    if (editingRFQ) {
      const ok = await onUpdateRFQ(editingRFQ, payload);
      if (ok) backToList();
    } else {
      const ok = await onAddRFQ(payload);
      if (ok) { setFormData(EMPTY_FORM); setBuyerInput(''); setCustomerInput(''); setSelectedItems([]); setItemSearch(''); }
    }
  };

  const set = (field) => (e) => setFormData(prev => ({ ...prev, [field]: e.target.value }));

  // ── Filter list ──
  useEffect(() => {
    if (searchResource) {
      const delayDebounceFn = setTimeout(() => {
        searchResource('rfqs', searchQuery);
      }, 300);
      return () => clearTimeout(delayDebounceFn);
    }
  }, [searchQuery]);

  const inputCls = "w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-base text-slate-900 focus:outline-none focus:border-blue-600 placeholder:text-slate-400 font-medium";
  const labelCls = "block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider";

  return (
    <div className="flex-1 p-4 sm:p-8 lg:p-10 bg-[#f1f5f9] max-w-5xl mx-auto w-full text-slate-900">

      {/* ================================================================
          LIST VIEW
         ================================================================ */}
      {viewMode === 'list' ? (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 m-0">RFQ Feeding</h1>
              <p className="text-base text-slate-500 mt-1 font-medium">Browse and manage Request for Quotation records.</p>
            </div>
            <button onClick={openAddForm} className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm self-start sm:self-auto">
              <Plus size={20} /> New RFQ
            </button>
          </div>

          {error && <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm font-semibold rounded-xl flex items-center gap-2"><AlertCircle size={16} />{error}</div>}

          <div className="flex items-center gap-3 border-2 border-slate-200 rounded-xl px-4 py-4 bg-white shadow-sm">
            <Search size={22} className="text-slate-400 shrink-0" />
            <input type="text" placeholder="Search by RFQ No., buyer name, or customer ID..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-transparent focus:outline-none text-lg text-slate-900 placeholder:text-slate-400 font-semibold" />
          </div>

          <div className="border-2 border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
              <span className="text-sm font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <ListFilter size={16} className="text-blue-600" /> RFQ Directory ({rfqs.length})
              </span>
            </div>

            {rfqs.length === 0 ? (
              <div className="p-16 text-center text-slate-400 text-lg font-semibold">No RFQ records found. Click "+ New RFQ" to create one.</div>
            ) : (
              <div className="divide-y divide-slate-200">
                {rfqs.map((rfq) => (
                    <div key={rfq.rfq_no} className="p-4 flex items-center gap-4 bg-white hover:bg-slate-50 transition-colors rounded-xl border border-slate-200">
                      <span className="font-mono font-extrabold text-sm text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">{rfq.rfq_no}</span>
                      <span className="text-sm text-slate-600">{fmtDate(rfq.rfq_date)}</span>
                      <span className="text-sm text-slate-600">{fmtDate(rfq.commercial_bid_due_date)}</span>
                      <span className="text-sm text-slate-600">{Array.isArray(rfq.items) ? rfq.items.length : 0} items</span>
                      <span className="text-sm text-slate-600">{rfq.customer_id || '—'}</span>
                      <div className="ml-auto flex items-center gap-2.5 shrink-0">
                        <button onClick={() => openEditForm(rfq)} className="px-6 py-3 text-sm border-2 border-slate-200 hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg text-slate-700 font-bold bg-white transition-colors flex items-center gap-1.5 cursor-pointer">
                          <Edit2 size={14} /> Update Record
                        </button>
                        <Link to={`/rfq/${rfq.rfq_no}`} className="px-6 py-3 text-sm border-2 border-slate-200 hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg text-slate-700 font-bold bg-white transition-colors flex items-center gap-1.5 justify-center">
                          View Details
                        </Link>
                      </div>
                    </div>
                ))}
              </div>
            )}
            {rfqs.length >= 20 && rfqs.length % 20 === 0 && (
              <div className="flex justify-center p-4 bg-slate-50 border-t border-slate-200">
                <button
                  onClick={() => fetchMoreData('rfqs', rfqs.length, searchQuery)}
                  className="px-6 py-2.5 border-2 border-slate-200 hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50 text-slate-700 font-bold text-sm rounded-lg transition-colors cursor-pointer"
                >
                  Load More RFQs
                </button>
              </div>
            )}
          </div>
        </div>

      ) : viewMode === 'view' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-4 p-4 bg-slate-50 rounded-xl">
            <div className="col-span-2">
              <span className="font-mono font-extrabold text-sm text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">{editingRFQ}</span>
            </div>
          </div>
          <button onClick={() => setViewMode('list')} className="mt-2 text-sm text-blue-600 hover:underline">Back to list</button>
        </div>
      ) : (
        /* ================================================================
            FORM VIEW
           ================================================================ */
        <div className="space-y-6">
          <div className="pb-4 border-b border-slate-200">
            <button onClick={backToList} className="mb-4 text-sm font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer bg-slate-200 hover:bg-slate-300 px-4 py-2 rounded-lg transition-colors">
              <ArrowLeft size={16} /> Back to Directory
            </button>
            <h1 className="text-3xl font-extrabold text-slate-900 m-0">{editingRFQ ? 'Modify RFQ Record' : 'New RFQ Entry'}</h1>
            <p className="text-base text-slate-500 mt-1 font-medium">{editingRFQ ? 'Update the details of an existing RFQ.' : 'Fill in the RFQ details below.'}</p>
          </div>

          {error && <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm font-semibold rounded-xl flex items-center gap-2"><AlertCircle size={16} />{error}</div>}

          <div className="bg-white border-2 border-slate-200 rounded-xl p-5 sm:p-8 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-5">

                {/* RFQ No. */}
                <div>
                  <label className={labelCls}>RFQ No. <b className="text-red-500">*</b></label>
                  <input type="text" required placeholder="e.g. RFQ-2024-001" value={formData.rfq_no} onChange={set('rfq_no')} disabled={!!editingRFQ}
                    className={inputCls + (editingRFQ ? ' bg-slate-100 text-slate-500 cursor-not-allowed' : '')} />
                  {editingRFQ && <p className="text-[11px] text-slate-400 font-semibold mt-1.5 pl-1">RFQ No. cannot be changed after creation.</p>}
                </div>

                {/* Date row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>RFQ Date <b className="text-red-500">*</b></label>
                    <input type="date" required value={formData.rfq_date} onChange={set('rfq_date')} className={inputCls} />
                    {console.log(formData)}
                  </div>
                  <div>
                    <label className={labelCls}>Commercial Bid Due Date <b className="text-red-500">*</b></label>
                    <input type="date" required value={formData.commercial_bid_due_date} onChange={set('commercial_bid_due_date')} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Technical Bid Due Date <b className="text-red-500">*</b></label>
                    <input type="date" required value={formData.technical_bid_due_date} onChange={set('technical_bid_due_date')} className={inputCls} />
                  </div>
                </div>

                {/* Buyer */}
                <div ref={buyerRef} className="relative">
                  <label className={labelCls}>Buyer Name <b className="text-red-500">*</b></label>
                  <input type="text" placeholder="Start typing buyer name..." value={buyerInput} onChange={(e) => handleBuyerInput(e.target.value)} onFocus={() => buyerInput.trim() && setShowBuyerDropdown(true)} className={inputCls} autoComplete="off" />
                  {showBuyerDropdown && buyerSuggestions.length > 0 && (
                    <div className="absolute z-30 w-full mt-1 bg-white border-2 border-slate-200 rounded-xl shadow-lg overflow-hidden">
                      {buyerSuggestions.slice(0, 6).map(b => (
                        <button key={b.id} type="button" onClick={() => selectBuyer(b)} className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer">
                          <div className="font-bold text-sm text-slate-900">{b.name}</div>
                          <div className="text-xs text-slate-500">{b.email} &bull; {b.phone}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  {buyerNotFound && (
                    <div className="mt-2 flex items-center justify-between gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs font-bold">
                      <div className="flex items-center gap-2">
                        <AlertCircle size={13} className="shrink-0" />
                        <span>No buyer found for "{buyerInput}".</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (onNavigateAndOpenForm) onNavigateAndOpenForm('add-buyer', 'buyer');
                        }}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-extrabold text-[10px] transition-colors cursor-pointer shrink-0 uppercase tracking-wider"
                      >
                        Add Buyer
                      </button>
                    </div>
                  )}
                  {formData.buyer_id && (
                    <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                      <span>✓ Buyer linked</span><span className="text-slate-400">|</span><span>{formData.buyer_email}</span><span className="text-slate-400">|</span><span>{formData.buyer_phone}</span>
                    </div>
                  )}
                </div>

                {/* Customer */}
                <div ref={customerRef} className="relative">
                  <label className={labelCls}>Customer ID <b className="text-red-500">*</b></label>
                  <input type="text" placeholder="Start typing customer ID or name..." value={customerInput} onChange={(e) => handleCustomerInput(e.target.value)} onFocus={() => customerInput.trim() && setShowCustomerDropdown(true)} className={inputCls} autoComplete="off" />
                  {showCustomerDropdown && customerSuggestions.length > 0 && (
                    <div className="absolute z-30 w-full mt-1 bg-white border-2 border-slate-200 rounded-xl shadow-lg overflow-hidden">
                      {customerSuggestions.slice(0, 6).map(c => (
                        <button key={c.id} type="button" onClick={() => selectCustomer(c)} className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer">
                          <div className="font-bold text-sm text-slate-900">{c.id}</div>
                          <div className="text-xs text-slate-500">{c.name} &bull; {c.address}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  {customerNotFound && (
                    <div className="mt-2 flex items-center justify-between gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs font-bold">
                      <div className="flex items-center gap-2">
                        <AlertCircle size={13} className="shrink-0" />
                        <span>No customer found for "{customerInput}".</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (onNavigateAndOpenForm) onNavigateAndOpenForm('add-customer', 'customer');
                        }}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-extrabold text-[10px] transition-colors cursor-pointer shrink-0 uppercase tracking-wider"
                      >
                        Add Customer
                      </button>
                    </div>
                  )}
                  {formData.customer_id && customers.find(c => c.id === formData.customer_id) && (
                    <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                      <span>✓ Customer linked</span><span className="text-slate-400">|</span><span>{customers.find(c => c.id === formData.customer_id)?.name}</span>
                    </div>
                  )}
                </div>

                {/* ── Items Section ── */}
                <div>
                  <label className={labelCls}>Items</label>

                  {/* Item search input */}
                  <div ref={itemRef} className="relative">
                    <input
                      type="text"
                      placeholder="Search item by code or description to add..."
                      value={itemSearch}
                      onChange={(e) => handleItemSearch(e.target.value)}
                      onFocus={() => itemSearch.trim() && setShowItemDropdown(true)}
                      className={inputCls}
                      autoComplete="off"
                    />

                    {/* Item dropdown */}
                    {showItemDropdown && itemSuggestions.filter(item => !selectedItems.some(i => i.item_code === item.item_code)).length > 0 && (
                      <div className="absolute z-30 w-full mt-1 bg-white border-2 border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
                        {itemSuggestions.filter(item => !selectedItems.some(i => i.item_code === item.item_code)).map(item => {
                          return (
                            <button
                              key={item.item_code}
                              type="button"
                              onClick={() => addItem(item)}
                              className="w-full text-left px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-blue-50 transition-colors cursor-pointer"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <span className="font-mono font-bold text-sm text-blue-700">{item.item_code}</span>
                                  {item.drawing_number && <span className="text-xs text-slate-400 ml-2">DRW: {item.drawing_number}</span>}
                                  <div className="text-xs text-slate-500 mt-0.5">{item.description}</div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* No item found */}
                    {itemSearch.trim().length > 0 && itemSuggestions.length === 0 && (
                      <div className="mt-2 flex items-center justify-between gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs font-bold">
                        <div className="flex items-center gap-2">
                          <AlertCircle size={13} className="shrink-0" />
                          <span>No item found for "{itemSearch}".</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (onNavigateAndOpenForm) onNavigateAndOpenForm('add-item', 'item');
                          }}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-extrabold text-[10px] transition-colors cursor-pointer shrink-0 uppercase tracking-wider"
                        >
                          Add Item
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Selected items list */}
                  {selectedItems.length > 0 && (
                    <div className="mt-3 border border-slate-200 rounded-xl overflow-hidden">
                      <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                        <span className="text-xs font-extrabold text-slate-500 uppercase tracking-widest">
                          Selected Items ({selectedItems.length})
                        </span>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {selectedItems.map((item) => (
                          <div key={item.item_code} className="flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 transition-colors">
                            <div className="min-w-0 flex-1 mr-4">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-bold text-sm text-blue-700">{item.item_code}</span>
                                {item.drawing_number && (
                                  <span className="text-xs text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                                    DRW: {item.drawing_number}
                                  </span>
                                )}
                              </div>
                              {item.description && (
                                <p className="text-xs text-slate-500 mt-0.5 truncate">{item.description}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <div className="flex flex-col items-end">
                                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5">Qty *</label>
                                <input
                                  type="number"
                                  min="1"
                                  required
                                  value={item.quantity}
                                  onChange={(e) => handleQuantityChange(item.item_code, e.target.value)}
                                  className="w-20 px-2 py-1 text-center font-bold text-sm text-slate-800 bg-white border-2 border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => removeItem(item.item_code)}
                                className="p-1.5 mt-4 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0"
                                title="Remove item"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedItems.length === 0 && (
                    <p className="mt-2 text-xs text-slate-400 font-medium pl-1">No items added yet. Search above to attach items to this RFQ.</p>
                  )}
                </div>

              </div>

              {/* Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-4">
                <button type="button" onClick={backToList} className="px-6 py-4 border-2 border-slate-200 hover:border-slate-300 rounded-lg font-bold text-base uppercase text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={isLoading}
                  className={`px-10 py-4 rounded-lg font-bold text-base uppercase tracking-wider text-white transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed
                    ${editingRFQ ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                  {isLoading ? 'Processing...' : editingRFQ
                    ? <><RefreshCw size={18} className="animate-spin" /> Update RFQ</>
                    : <><Plus size={18} /> Save RFQ</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
