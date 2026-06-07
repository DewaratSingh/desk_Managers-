import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Edit2,
  Plus,
  RefreshCw,
  ArrowLeft,
  ListFilter,
  AlertCircle,
  FileCheck,
  X
} from 'lucide-react';

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'http://localhost:5000/api'
  : `${window.location.protocol}//${window.location.hostname}:5000/api`;

const EMPTY_FORM = {
  received_quotation_no: '',
  buyer_id: null,
  buyer_name: '',
  buyer_email: '',
  buyer_phone: '',
  quotation_date: '',
  terms_and_conditions: ''
};

export default function ReceivedQuotationView({
  buyers,
  items: catalogItems,
  receivedQuotations,
  onAddReceivedQuotation,
  onUpdateReceivedQuotation,
  onNavigateAndOpenForm,
  isLoading,
  error,
  fetchMoreData,
  searchResource
}) {
  const [viewMode, setViewMode] = useState('list');
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingNo, setEditingNo] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected items and pricing
  const [selectedItems, setSelectedItems] = useState([]);

  // Buyer autocomplete
  const [buyerInput, setBuyerInput] = useState('');
  const [buyerSuggestions, setBuyerSuggestions] = useState([]);
  const [showBuyerDropdown, setShowBuyerDropdown] = useState(false);
  const buyerRef = useRef(null);

  // Item autocomplete
  const [itemInput, setItemInput] = useState('');
  const [itemSuggestions, setItemSuggestions] = useState([]);
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const itemRef = useRef(null);

  // Auto-generated ID preview
  const [nextQuotationNo, setNextQuotationNo] = useState('');

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (buyerRef.current && !buyerRef.current.contains(e.target)) setShowBuyerDropdown(false);
      if (itemRef.current && !itemRef.current.contains(e.target)) setShowItemDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchNextQuotationNo = async () => {
    try {
      const savedToken = localStorage.getItem('dm_token');
      const res = await fetch(`${API_BASE_URL}/received-quotations/next-no`, {
        headers: { 'Authorization': `Bearer ${savedToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNextQuotationNo(data.next_no);
      }
    } catch (err) {
      console.error('Error fetching next received quotation no:', err);
    }
  };

  // ── Buyer Lookup ──
  const handleBuyerInput = async (val) => {
    setBuyerInput(val);
    setFormData((prev) => ({ ...prev, buyer_name: val, buyer_id: null, buyer_email: '', buyer_phone: '' }));
    if (!val.trim()) { setBuyerSuggestions([]); setShowBuyerDropdown(false); return; }

    try {
      const res = await fetch(`${API_BASE_URL}/buyers?search=${encodeURIComponent(val)}&limit=5`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('dm_token')}` }
      });
      const data = await res.json();
      setBuyerSuggestions(data);
      setShowBuyerDropdown(true);
    } catch(e) { console.error(e); }
  };

  const selectBuyer = (b) => {
    setBuyerInput(b.name);
    setFormData((prev) => ({
      ...prev,
      buyer_id: b.id,
      buyer_name: b.name,
      buyer_email: b.email,
      buyer_phone: b.phone
    }));
    setShowBuyerDropdown(false);
  };

  const buyerNotFound = buyerInput.trim().length > 0 && !formData.buyer_id &&
    buyers.filter(b => b.name.toLowerCase().startsWith(buyerInput.toLowerCase())).length === 0;

  // ── Item Lookup ──
  const handleItemInput = async (val) => {
    setItemInput(val);
    if (!val.trim()) { setItemSuggestions([]); setShowItemDropdown(false); return; }

    try {
      const res = await fetch(`${API_BASE_URL}/items?search=${encodeURIComponent(val)}&limit=10`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('dm_token')}` }
      });
      const data = await res.json();
      // Filter out items already selected
      const filtered = data.filter(i => !selectedItems.some(si => si.item_code === i.item_code));
      setItemSuggestions(filtered);
      setShowItemDropdown(true);
    } catch(e) { console.error(e); }
  };

  const addItem = (item) => {
    if (selectedItems.some(i => i.item_code === item.item_code)) {
      setItemInput('');
      setShowItemDropdown(false);
      return;
    }
    setSelectedItems(prev => [...prev, {
      item_code: item.item_code,
      description: item.description,
      drawing_number: item.drawing_number || '',
      quantity: '', // set to empty string so user is forced to input
      unit_price: '' // set to empty string so user is forced to input
    }]);
    setItemInput('');
    setShowItemDropdown(false);
  };

  const removeItem = (item_code) => {
    setSelectedItems(prev => prev.filter(i => i.item_code !== item_code));
  };

  const handleItemValueChange = (item_code, field, val) => {
    setSelectedItems(prev => prev.map(item => {
      if (item.item_code === item_code) {
        return { ...item, [field]: val };
      }
      return item;
    }));
  };

  // ── Navigation ──
  const handleOpenAddForm = () => {
    setEditingNo(null);
    setFormData({
      ...EMPTY_FORM,
      quotation_date: new Date().toISOString().slice(0, 10)
    });
    setBuyerInput('');
    setItemInput('');
    setSelectedItems([]);
    fetchNextQuotationNo();
    setViewMode('form');
  };

  const handleEditClick = (rq) => {
    setEditingNo(rq.received_quotation_no);
    setFormData({
      received_quotation_no: rq.received_quotation_no,
      buyer_id: rq.buyer_id || null,
      buyer_name: rq.buyer_name || '',
      buyer_email: rq.buyer_email || '',
      buyer_phone: rq.buyer_phone || '',
      quotation_date: rq.quotation_date ? rq.quotation_date.slice(0, 10) : '',
      terms_and_conditions: rq.terms_and_conditions || ''
    });
    setBuyerInput(rq.buyer_name || '');
    setItemInput('');
    setSelectedItems(Array.isArray(rq.items) ? rq.items.map(i => ({
      item_code: i.item_code,
      description: i.description || '',
      drawing_number: i.drawing_number || '',
      quantity: i.quantity || '',
      unit_price: i.unit_price !== undefined ? i.unit_price : ''
    })) : []);
    setViewMode('form');
  };

  const handleBackToDirectory = () => {
    setEditingNo(null);
    setFormData(EMPTY_FORM);
    setBuyerInput('');
    setItemInput('');
    setSelectedItems([]);
    setViewMode('list');
  };

  // ── Submit ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.quotation_date) return;

    if (!formData.buyer_id) {
      alert('Please select a valid Buyer from the suggestion dropdown.');
      return;
    }

    if (selectedItems.length === 0) {
      alert('At least one item is required for the received quotation.');
      return;
    }

    // Validate quantities & prices (strictly compulsory)
    for (const item of selectedItems) {
      const qty = parseInt(item.quantity);
      if (item.quantity === '' || isNaN(qty) || qty <= 0) {
        alert(`Quantity for item ${item.item_code} is compulsory and must be greater than 0.`);
        return;
      }

      const price = parseFloat(item.unit_price);
      if (item.unit_price === '' || isNaN(price) || price < 0) {
        alert(`Unit price for item ${item.item_code} is compulsory and must be at least 0.`);
        return;
      }
    }

    const payload = {
      ...formData,
      items: selectedItems
    };

    if (editingNo) {
      const success = await onUpdateReceivedQuotation(editingNo, payload);
      if (success) handleBackToDirectory();
    } else {
      const success = await onAddReceivedQuotation(payload);
      if (success) {
        setFormData({
          ...EMPTY_FORM,
          quotation_date: new Date().toISOString().slice(0, 10)
        });
        setBuyerInput('');
        setItemInput('');
        setSelectedItems([]);
        fetchNextQuotationNo();
      }
    }
  };

  const set = (field) => (e) =>
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  // ── Search & Filter ──
  useEffect(() => {
    if (searchResource) {
      const delayDebounceFn = setTimeout(() => {
        searchResource('received-quotations', searchQuery);
      }, 300);
      return () => clearTimeout(delayDebounceFn);
    }
  }, [searchQuery]);

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

  const calculateTotal = (itemsList) => {
    if (!Array.isArray(itemsList)) return 0;
    return itemsList.reduce((sum, i) => sum + (i.quantity || 0) * (parseFloat(i.unit_price) || 0), 0);
  };

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
              <h1 className="text-3xl font-extrabold text-slate-900 m-0">Received Quotations</h1>
              <p className="text-base text-slate-500 mt-1 font-medium">
                Log and manage incoming quotations received from suppliers/buyers.
              </p>
            </div>
            <button
              onClick={handleOpenAddForm}
              className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm self-start sm:self-auto"
            >
              <Plus size={20} /> New Received Quotation
            </button>
          </div>

          {/* {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm font-semibold rounded-xl flex items-center gap-2">
              <AlertCircle size={16} /> {error}
            </div>
          )} */}

          <div className="flex items-center gap-3 border-2 border-slate-200 rounded-xl px-4 py-4 bg-white shadow-sm">
            <Search size={22} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search by quotation no. or buyer name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent focus:outline-none text-lg text-slate-900 placeholder:text-slate-400 font-semibold"
            />
          </div>

          <div className="border-2 border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
              <span className="text-sm font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <ListFilter size={16} className="text-blue-600" />
                Directory ({receivedQuotations.length})
              </span>
            </div>

            {receivedQuotations.length === 0 ? (
              <div className="p-16 text-center text-slate-400 text-lg font-semibold">
                No received quotations found. Click "+ New Received Quotation" to create one.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {receivedQuotations.map((rq) => (
                  <div
                    key={rq.received_quotation_no}
                    className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white hover:bg-slate-50/75 transition-colors"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-extrabold text-sm text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                          {rq.received_quotation_no}
                        </span>
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                          Buyer: {rq.buyer_name || '—'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 font-medium">
                        <span>Date: {fmtDate(rq.quotation_date)}</span>
                        <span>•</span>
                        <span>Items: {Array.isArray(rq.items) ? rq.items.length : 0}</span>
                        <span>•</span>
                        <span className="text-slate-700 font-bold">
                          Total Value: ₹{calculateTotal(rq.items).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <button
                        onClick={() => handleEditClick(rq)}
                        className="px-6 py-3 text-sm border-2 border-slate-200 hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg text-slate-700 font-bold bg-white transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit2 size={14} /> Update Record
                      </button>
                      <Link
                        to={`/received-quotation/${rq.received_quotation_no}`}
                        className="px-6 py-3 text-sm border-2 border-slate-200 hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg text-slate-700 font-bold bg-white transition-colors flex items-center gap-1.5 justify-center"
                      >
                        View Details
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {receivedQuotations.length >= 20 && receivedQuotations.length % 20 === 0 && (
              <div className="flex justify-center p-4 bg-slate-50 border-t border-slate-200">
                <button
                  onClick={() => fetchMoreData('received-quotations', receivedQuotations.length, searchQuery)}
                  className="px-6 py-2.5 border-2 border-slate-200 hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50 text-slate-700 font-bold text-sm rounded-lg transition-colors cursor-pointer"
                >
                  Load More Quotations
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ================================================================
            FORM VIEW
           ================================================================ */
        <div className="space-y-6">
          <div className="pb-4 border-b border-slate-200">
            <button
              onClick={handleBackToDirectory}
              className="mb-4 text-sm font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer bg-slate-200 hover:bg-slate-300 px-4 py-2 rounded-lg transition-colors"
            >
              <ArrowLeft size={16} /> Back to Directory
            </button>
            <h1 className="text-3xl font-extrabold text-slate-900 m-0">
              {editingNo ? 'Modify Received Quotation' : 'New Received Quotation Entry'}
            </h1>
            <p className="text-base text-slate-500 mt-1 font-medium">
              {editingNo
                ? 'Update incoming commercial details and terms.'
                : 'Log a new incoming quotation proposal.'}
            </p>
          </div>

          {/* {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm font-semibold rounded-xl flex items-center gap-2">
              <AlertCircle size={16} /> {error}
            </div>
          )} */}

          <div className="bg-white border-2 border-slate-200 rounded-xl p-5 sm:p-8 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-5">
                
                {/* Quotation No & Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Quotation ID</label>
                    <input
                      type="text"
                      disabled
                      value={editingNo ? formData.received_quotation_no : nextQuotationNo || 'Generating...'}
                      className="w-full px-4 py-3 bg-slate-100 border border-slate-300 rounded-lg text-base text-slate-500 cursor-not-allowed font-mono font-bold"
                    />
                    <p className="text-[10px] text-slate-400 font-semibold mt-1.5 pl-1">
                      Reference ID is auto-generated.
                    </p>
                  </div>
                  <div>
                    <label className={labelCls}>Quotation Date <b className="text-red-500">*</b></label>
                    <input
                      type="date"
                      required
                      value={formData.quotation_date}
                      onChange={set('quotation_date')}
                      className={inputCls}
                    />
                  </div>
                </div>

                {/* Buyer Lookup */}
                <div ref={buyerRef} className="relative">
                  <label className={labelCls}>Buyer Name <b className="text-red-500">*</b></label>
                  <input
                    type="text"
                    required
                    placeholder="Search and select buyer name..."
                    value={buyerInput}
                    onChange={(e) => handleBuyerInput(e.target.value)}
                    onFocus={() => buyerInput.trim() && setShowBuyerDropdown(true)}
                    className={inputCls}
                    autoComplete="off"
                  />
                  {showBuyerDropdown && buyerSuggestions.length > 0 && (
                    <div className="absolute z-30 w-full mt-1 bg-white border-2 border-slate-200 rounded-xl shadow-lg overflow-hidden">
                      {buyerSuggestions.slice(0, 6).map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => selectBuyer(b)}
                          className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                        >
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
                      <span>✓ Buyer linked</span>
                      <span className="text-slate-400">|</span>
                      <span>{formData.buyer_email}</span>
                      <span className="text-slate-400">|</span>
                      <span>{formData.buyer_phone}</span>
                    </div>
                  )}
                </div>

                {/* Item Lookup */}
                <div>
                  <label className={labelCls}>Search & Add Items</label>
                  <div ref={itemRef} className="relative">
                    <input
                      type="text"
                      placeholder="Search item by code, short desc, or long desc..."
                      value={itemInput}
                      onChange={(e) => handleItemInput(e.target.value)}
                      onFocus={() => itemInput.trim() && setShowItemDropdown(true)}
                      className={inputCls}
                      autoComplete="off"
                    />
                    {showItemDropdown && itemSuggestions.length > 0 && (
                      <div className="absolute z-30 w-full mt-1 bg-white border-2 border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
                        {itemSuggestions.map((item) => (
                          <button
                            key={item.item_code}
                            type="button"
                            onClick={() => addItem(item)}
                            className="w-full text-left px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-blue-50 transition-colors cursor-pointer"
                          >
                            <div className="font-bold text-sm text-slate-900 flex justify-between items-center">
                              <span className="font-mono text-blue-700">{item.item_code}</span>
                              {item.drawing_number && <span className="text-xs text-slate-400">DRW: {item.drawing_number}</span>}
                            </div>
                            <div className="text-xs text-slate-600 font-semibold mt-0.5">{item.description}</div>
                            {item.long_description && (
                              <div className="text-[10px] text-slate-400 mt-0.5 truncate">{item.long_description}</div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                    {itemInput.trim().length > 0 && itemSuggestions.length === 0 && (
                      <div className="mt-2 flex items-center justify-between gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs font-bold">
                        <div className="flex items-center gap-2">
                          <AlertCircle size={13} className="shrink-0" />
                          <span>No item found matching "{itemInput}".</span>
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

                  {/* Selected Items List */}
                  {selectedItems.length > 0 && (
                    <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden">
                      <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                        <span className="text-xs font-extrabold text-slate-500 uppercase tracking-widest">
                          Selected Items ({selectedItems.length})
                        </span>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {selectedItems.map((item) => (
                          <div
                            key={item.item_code}
                            className="flex flex-col md:flex-row md:items-center justify-between p-4 gap-4 bg-white"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-bold text-sm text-blue-700">
                                  {item.item_code}
                                </span>
                                {item.drawing_number && (
                                  <span className="text-xs text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                                    DRW: {item.drawing_number}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-600 font-semibold mt-1">{item.description}</p>
                            </div>

                            <div className="flex flex-wrap items-center gap-4 shrink-0">
                              {/* Quantity input (COMPULSORY) */}
                              <div className="flex flex-col items-end">
                                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5">
                                  Qty *
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  required
                                  placeholder="compulsory"
                                  value={item.quantity}
                                  onChange={(e) => handleItemValueChange(item.item_code, 'quantity', e.target.value)}
                                  className="w-24 px-2.5 py-1.5 text-center font-bold text-sm text-slate-800 bg-white border-2 border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                                />
                              </div>

                              {/* Price input (COMPULSORY) */}
                              <div className="flex flex-col items-end">
                                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5">
                                  Price / Piece (₹) *
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  required
                                  placeholder="compulsory"
                                  value={item.unit_price}
                                  onChange={(e) => handleItemValueChange(item.item_code, 'unit_price', e.target.value)}
                                  className="w-28 px-2.5 py-1.5 text-right font-bold text-sm text-slate-800 bg-white border-2 border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                                />
                              </div>

                              <button
                                type="button"
                                onClick={() => removeItem(item.item_code)}
                                className="p-2 mt-4 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0"
                                title="Remove item"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedItems.length === 0 && (
                    <p className="mt-2 text-xs text-slate-400 font-medium pl-1">
                      No items added yet. Search code or description to attach items.
                    </p>
                  )}
                </div>

                {/* Terms and Conditions */}
                <div>
                  <label className={labelCls}>Terms & Conditions</label>
                  <textarea
                    rows={4}
                    placeholder="Add delivery terms, validity details, custom terms..."
                    value={formData.terms_and_conditions}
                    onChange={set('terms_and_conditions')}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-base text-slate-900 focus:outline-none focus:border-blue-600 placeholder:text-slate-400 font-medium resize-none"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-4">
                <button
                  type="button"
                  onClick={handleBackToDirectory}
                  className="px-6 py-4 border-2 border-slate-200 hover:border-slate-300 rounded-lg font-bold text-base uppercase text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`px-10 py-4 rounded-lg font-bold text-base uppercase tracking-wider text-white transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed
                    ${editingNo ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  {isLoading ? (
                    'Processing...'
                  ) : editingNo ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" /> Update Quotation
                    </>
                  ) : (
                    <>
                      <Plus size={18} /> Save Quotation
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
