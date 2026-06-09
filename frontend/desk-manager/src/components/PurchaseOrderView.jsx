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
  Receipt,
  CheckSquare,
  Square,
  Trash2,
  X
} from 'lucide-react';

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'http://localhost:5000/api'
  : `${window.location.protocol}//${window.location.hostname}:5000/api`;

const EMPTY_FORM = {
  po_no: '',
  contract_ref: '',
  quotation_no: '',
  po_date: '',
  gst: '0.00',
  transport: '0.00',
  other: '0.00',
  basic_value: '0.00',
  packing_forward: '0.00'
};

export default function PurchaseOrderView({
  quotations,
  purchaseOrders,
  customers = [],
  onAddPurchaseOrder,
  onUpdatePurchaseOrder,
  onDeletePurchaseOrder,
  isLoading,
  error,
  fetchMoreData,
  searchResource
}) {
  const [viewMode, setViewMode] = useState('list');
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingNo, setEditingNo] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Quotation details and its items
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const [poItems, setPoItems] = useState([]); // Array of { item_code, description, drawing_number, quantity, unit_price, checked }

  // Quotation autocomplete lookup
  const [qtnInput, setQtnInput] = useState('');
  const [qtnSuggestions, setQtnSuggestions] = useState([]);
  const [showQtnDropdown, setShowQtnDropdown] = useState(false);
  const qtnRef = useRef(null);

  // New states for item shipping address autocomplete
  const [activeShippingDropdown, setActiveShippingDropdown] = useState(null);
  const shippingRefs = useRef({});

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (qtnRef.current && !qtnRef.current.contains(e.target)) {
        setShowQtnDropdown(false);
      }
      
      // We check if click is outside the currently active shipping dropdown
      if (activeShippingDropdown) {
        const ref = shippingRefs.current[activeShippingDropdown];
        if (ref && !ref.contains(e.target)) {
          setActiveShippingDropdown(null);
        }
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [activeShippingDropdown]);

  const handleQtnInput = async (val) => {
    setQtnInput(val);
    setFormData((prev) => ({ ...prev, quotation_no: val }));
    setSelectedQuotation(null);
    setPoItems([]);

    if (!val.trim()) {
      setQtnSuggestions([]);
      setShowQtnDropdown(false);
      return;
    }

    try {
      const savedToken = localStorage.getItem('dm_token');
      const res = await fetch(`${API_BASE_URL}/quotations?search=${encodeURIComponent(val)}&limit=5`, {
        headers: { 'Authorization': `Bearer ${savedToken}` }
      });
      const data = await res.json();
      setQtnSuggestions(data);
      setShowQtnDropdown(true);
    } catch (e) {
      console.error(e);
    }
  };

  const selectQuotation = (qtn) => {
    setQtnInput(qtn.quotation_no);
    setFormData((prev) => ({ ...prev, quotation_no: qtn.quotation_no }));
    setSelectedQuotation(qtn);
    setShowQtnDropdown(false);

    // Initialize items with checked=true by default
    if (Array.isArray(qtn.items)) {
      const initializedItems = qtn.items.map((i) => ({
        item_code: i.item_code,
        description: i.description || '',
        drawing_number: i.drawing_number || '',
        quantity: i.quantity || 1,
        unit_price: i.unit_price || '0.00',
        shipping_address: '',
        showShipping: false,
        checked: true
      }));
      setPoItems(initializedItems);
      updateBasicValue(initializedItems);
    }
  };

  const toggleItemChecked = (item_code) => {
    const updatedItems = poItems.map((i) => {
      if (i.item_code === item_code) {
        return { ...i, checked: !i.checked };
      }
      return i;
    });
    setPoItems(updatedItems);
    updateBasicValue(updatedItems);
  };

  const handleItemQtyChange = (item_code, newQty) => {
    const val = parseInt(newQty) || 0;
    const updatedItems = poItems.map((i) => {
      if (i.item_code === item_code) {
        return { ...i, quantity: val };
      }
      return i;
    });
    setPoItems(updatedItems);
    updateBasicValue(updatedItems);
  };

  const handleItemPriceChange = (item_code, newPrice) => {
    const updatedItems = poItems.map((i) => {
      if (i.item_code === item_code) {
        return { ...i, unit_price: newPrice };
      }
      return i;
    });
    setPoItems(updatedItems);
    updateBasicValue(updatedItems);
  };

  const toggleShipping = (item_code) => {
    setPoItems(poItems.map(i => i.item_code === item_code ? { ...i, showShipping: !i.showShipping } : i));
  };

  const handleShippingChange = (item_code, val) => {
    setPoItems(poItems.map(i => i.item_code === item_code ? { ...i, shipping_address: val } : i));
  };

  const updateBasicValue = (itemsList) => {
    const total = itemsList
      .filter((i) => i.checked)
      .reduce((sum, i) => sum + (i.quantity || 0) * (parseFloat(i.unit_price) || 0), 0);
    setFormData((prev) => ({ ...prev, basic_value: total.toFixed(2) }));
  };

  const qtnNotFound =
    qtnInput.trim().length > 0 &&
    !selectedQuotation &&
    qtnSuggestions.length === 0;

  const handleOpenAddForm = () => {
    setEditingNo(null);
    setFormData({
      ...EMPTY_FORM,
      po_date: new Date().toISOString().slice(0, 10)
    });
    setQtnInput('');
    setSelectedQuotation(null);
    setPoItems([]);
    setViewMode('form');
  };

  const handleEditClick = (po) => {
    setEditingNo(po.po_no);
    setFormData({
      po_no: po.po_no,
      contract_ref: po.contract_ref || '',
      quotation_no: po.quotation_no || '',
      po_date: po.po_date ? po.po_date.slice(0, 10) : '',
      gst: parseFloat(po.gst).toFixed(2),
      transport: parseFloat(po.transport).toFixed(2),
      other: parseFloat(po.other).toFixed(2),
      basic_value: parseFloat(po.basic_value).toFixed(2),
      packing_forward: parseFloat(po.packing_forward).toFixed(2)
    });

    setQtnInput(po.quotation_no || '');
    // Find the linked quotation details
    const linkedQtn = quotations.find((q) => q.quotation_no === po.quotation_no);
    setSelectedQuotation(linkedQtn || null);

    // Map items, checking the ones that were saved in the PO
    if (linkedQtn && Array.isArray(linkedQtn.items)) {
      const mapped = linkedQtn.items.map((qItem) => {
        const poItemMatch = po.items.find((poi) => poi.item_code === qItem.item_code);
        return {
          item_code: qItem.item_code,
          description: qItem.description || '',
          drawing_number: qItem.drawing_number || '',
          quantity: poItemMatch ? poItemMatch.quantity : qItem.quantity,
          unit_price: poItemMatch ? poItemMatch.unit_price : qItem.unit_price,
          shipping_address: poItemMatch ? poItemMatch.shipping_address || '' : '',
          showShipping: !!(poItemMatch && poItemMatch.shipping_address),
          checked: !!poItemMatch
        };
      });
      setPoItems(mapped);
    } else {
      // If quotation is missing, load items directly from the PO
      setPoItems(
        Array.isArray(po.items)
          ? po.items.map((i) => ({
              item_code: i.item_code,
              description: i.description || '',
              drawing_number: i.drawing_number || '',
              quantity: i.quantity || 1,
              unit_price: i.unit_price || '0.00',
              shipping_address: i.shipping_address || '',
              showShipping: !!i.shipping_address,
              checked: true
            }))
          : []
      );
    }

    setViewMode('form');
  };

  const handleBackToDirectory = () => {
    setEditingNo(null);
    setFormData(EMPTY_FORM);
    setQtnInput('');
    setSelectedQuotation(null);
    setPoItems([]);
    setViewMode('list');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.po_date) return;

    if (!editingNo && !selectedQuotation) {
      alert('Please select a valid quotation from the suggestions.');
      return;
    }

    const selectedItems = poItems.filter((i) => i.checked);
    if (selectedItems.length === 0) {
      alert('You must select at least one item to order.');
      return;
    }

    // Validate quantities and prices
    for (const item of selectedItems) {
      if (item.quantity <= 0) {
        alert(`Quantity for item ${item.item_code} must be greater than 0.`);
        return;
      }
      if (parseFloat(item.unit_price) < 0) {
        alert(`Unit price for item ${item.item_code} cannot be negative.`);
        return;
      }
    }

    const payload = {
      ...formData,
      items: selectedItems.map((i) => ({
        item_code: i.item_code,
        quantity: i.quantity,
        unit_price: i.unit_price,
        shipping_address: i.shipping_address || null
      }))
    };

    if (editingNo) {
      const success = await onUpdatePurchaseOrder(editingNo, payload);
      if (success) handleBackToDirectory();
    } else {
      const success = await onAddPurchaseOrder(payload);
      if (success) {
        setFormData({
          ...EMPTY_FORM,
          po_date: new Date().toISOString().slice(0, 10)
        });
        setQtnInput('');
        setSelectedQuotation(null);
        setPoItems([]);
      }
    }
  };

  const set = (field) => (e) =>
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  useEffect(() => {
    if (searchResource) {
      const delayDebounceFn = setTimeout(() => {
        searchResource('purchase-orders', searchQuery);
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

  const calculateTotalPOValue = (po) => {
    const basic = parseFloat(po.basic_value) || 0;
    const tax = parseFloat(po.gst) || 0;
    const shipping = parseFloat(po.transport) || 0;
    const pAndF = parseFloat(po.packing_forward) || 0;
    const otherCharges = parseFloat(po.other) || 0;
    return basic + tax + shipping + pAndF + otherCharges;
  };

  return (
    <div className="flex-1 p-4 sm:p-8 lg:p-10 bg-[#f1f5f9] max-w-5xl mx-auto w-full text-slate-900">
      {/* ================================================================
          VIEW MODE: LIST (default)
         ================================================================ */}
      {viewMode === 'list' ? (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 m-0">Purchase Orders</h1>
              <p className="text-base text-slate-500 mt-1 font-medium">
                Record and manage purchase orders linked directly to commercial quotations.
              </p>
            </div>
            <button
              onClick={handleOpenAddForm}
              className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm self-start sm:self-auto"
            >
              <Plus size={20} />
              New Purchase Order
            </button>
          </div>

          {/* {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm font-semibold rounded-xl flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )} */}

          {/* Search */}
          <div className="flex items-center gap-3 border-2 border-slate-200 rounded-xl px-4 py-4 bg-white shadow-sm">
            <Search size={22} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search by PO no., Quotation no., customer ID or item code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent focus:outline-none text-lg text-slate-900 placeholder:text-slate-400 font-semibold"
            />
          </div>

          {/* Directory Grid */}
          <div className="border-2 border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
              <span className="text-sm font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <ListFilter size={16} className="text-blue-600" />
                Purchase Order Directory ({purchaseOrders.length})
              </span>
            </div>

            {purchaseOrders.length === 0 ? (
              <div className="p-16 text-center text-slate-400 text-lg font-semibold">
                No Purchase Orders found. Click "New Purchase Order" to create one.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {purchaseOrders.map((po) => (
                  <div
                    key={po.po_no}
                    className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white hover:bg-slate-50/75 transition-colors"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-extrabold text-sm text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                          {po.po_no}
                        </span>
                        {po.quotation_no && (
                          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                            Quotation: {po.quotation_no}
                          </span>
                        )}
                        {po.customer_id && (
                          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-semibold">
                            Cust ID: {po.customer_id}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 font-medium">
                        <span>Date: {fmtDate(po.po_date)}</span>
                        <span>•</span>
                        <span>Items: {Array.isArray(po.items) ? po.items.length : 0}</span>
                        <span>•</span>
                        <span className="text-slate-700 font-bold">
                          Total Value: ₹{calculateTotalPOValue(po).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      {po.buyer_name && (
                        <p className="text-xs text-slate-400 font-semibold">
                          Buyer: {po.buyer_name} ({po.buyer_email || '—'})
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleEditClick(po)}
                        className="px-4 py-2 text-sm border-2 border-slate-200 hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg text-slate-700 font-bold bg-white transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit2 size={14} /> Edit
                      </button>
                      <Link
                        to={`/purchase-order/${encodeURIComponent(po.po_no)}`}
                        className="px-4 py-2 text-sm border-2 border-slate-200 hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg text-slate-700 font-bold bg-white transition-colors flex items-center gap-1.5 justify-center"
                      >
                        View Details
                      </Link>
                      <button
                        onClick={() => onDeletePurchaseOrder(po.po_no)}
                        className="px-4 py-2 text-sm border-2 border-red-200 hover:border-red-600 hover:text-red-600 hover:bg-red-50 rounded-lg text-red-600 font-bold bg-white transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {purchaseOrders.length >= 20 && purchaseOrders.length % 20 === 0 && (
              <div className="flex justify-center p-4 bg-slate-50 border-t border-slate-200">
                <button
                  onClick={() => fetchMoreData('purchase-orders', purchaseOrders.length, searchQuery)}
                  className="px-6 py-2.5 border-2 border-slate-200 hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50 text-slate-700 font-bold text-sm rounded-lg transition-colors cursor-pointer"
                >
                  Load More Purchase Orders
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ================================================================
            VIEW MODE: FORM
           ================================================================ */
        <div className="space-y-6">
          {/* Header */}
          <div className="pb-4 border-b border-slate-200">
            <button
              type="button"
              onClick={handleBackToDirectory}
              className="mb-4 text-sm font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer bg-slate-200 hover:bg-slate-300 px-4 py-2 rounded-lg transition-colors"
            >
              <ArrowLeft size={16} />
              Back to Directory
            </button>
            <h1 className="text-3xl font-extrabold text-slate-900 m-0">
              {editingNo ? 'Modify Purchase Order' : 'Create Purchase Order'}
            </h1>
            <p className="text-base text-slate-500 mt-1 font-medium">
              Formulate a Purchase Order by importing quotation rates and adding tax/commercial structures.
            </p>
          </div>

          <div className="bg-white border-2 border-slate-200 rounded-xl p-5 sm:p-8 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Header Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider">
                    PO No. <b className="text-red-500">*</b>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingNo}
                    value={formData.po_no}
                    onChange={set('po_no')}
                    placeholder="Enter PO Number"
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-base text-slate-900 focus:outline-none focus:border-blue-600 font-mono font-bold disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider">
                    PO Date <b className="text-red-500">*</b>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.po_date}
                    onChange={set('po_date')}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-base text-slate-900 focus:outline-none focus:border-blue-600 font-medium"
                  />
                </div>
              </div>

              {/* Quotation Link */}
              <div ref={qtnRef} className="relative">
                <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider">
                  Link to Quotation <b className="text-red-500">*</b>
                </label>
                <input
                  type="text"
                  required
                  disabled={!!editingNo}
                  placeholder="Search quotation by no, customer ID, buyer name, or item code..."
                  value={qtnInput}
                  onChange={(e) => handleQtnInput(e.target.value)}
                  onFocus={() => qtnInput.trim() && setShowQtnDropdown(true)}
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-base text-slate-900 focus:outline-none focus:border-blue-600 placeholder:text-slate-400 font-medium disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                  autoComplete="off"
                />
                {showQtnDropdown && qtnSuggestions.length > 0 && (
                  <div className="absolute z-30 w-full mt-1 bg-white border-2 border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
                    {qtnSuggestions.map((q) => (
                      <button
                        key={q.quotation_no}
                        type="button"
                        onClick={() => selectQuotation(q)}
                        className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                      >
                        <div className="font-bold text-sm text-slate-900">{q.quotation_no}</div>
                        <div className="text-xs text-slate-500">
                          RFQ: {q.rfq_no} &bull; Customer: {q.customer_name || q.customer_id || '—'} &bull; Buyer: {q.buyer_name || '—'}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {qtnNotFound && (
                  <div className="mt-2 flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs font-bold">
                    <AlertCircle size={13} />
                    No quotations found matching "{qtnInput}". Try searching by customer ID, buyer, or item code.
                  </div>
                )}
              </div>

              {/* Quotation Details Indicator */}
              {selectedQuotation && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-sm text-slate-600">
                  <div className="font-bold text-slate-800 uppercase text-xs tracking-wider border-b border-slate-200 pb-1.5 mb-1.5">
                    Quotation Information
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div><b>Customer Name:</b> {selectedQuotation.customer_name || '—'} (ID: {selectedQuotation.customer_id || '—'})</div>
                    <div><b>Buyer Detail:</b> {selectedQuotation.buyer_name || '—'} ({selectedQuotation.buyer_email || '—'})</div>
                    <div><b>Address:</b> {selectedQuotation.customer_address || '—'}</div>
                    <div><b>RFQ Ref:</b> {selectedQuotation.rfq_no}</div>
                  </div>
                </div>
              )}

              {/* Items Table with Checkboxes */}
              {poItems.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-visible">
                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center rounded-t-xl">
                    <span className="text-xs font-extrabold text-slate-500 uppercase tracking-widest">
                      Select items to order from Quotation
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const allChecked = poItems.every(i => i.checked);
                        const updated = poItems.map(i => ({ ...i, checked: !allChecked }));
                        setPoItems(updated);
                        updateBasicValue(updated);
                      }}
                      className="text-xs text-blue-600 hover:text-blue-700 font-bold hover:underline cursor-pointer"
                    >
                      {poItems.every(i => i.checked) ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {poItems.map((item) => (
                      <React.Fragment key={item.item_code}>
                      <div
                        className={`flex flex-col sm:flex-row sm:items-center px-5 py-4 gap-4 transition-colors ${
                          item.checked ? 'bg-blue-50/20' : 'bg-white opacity-75'
                        }`}
                      >
                        {/* Checkbox */}
                        <button
                          type="button"
                          onClick={() => toggleItemChecked(item.item_code)}
                          className="text-blue-600 focus:outline-none shrink-0"
                        >
                          {item.checked ? <CheckSquare size={22} /> : <Square size={22} className="text-slate-400" />}
                        </button>

                        {/* Details */}
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
                          {item.description && (
                            <p className="text-xs text-slate-500 mt-1">{item.description}</p>
                          )}
                        </div>

                        {/* Inputs (Quantity & Price) */}
                        <div className="flex gap-4 shrink-0">
                          <div className="flex flex-col items-end">
                            <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5">
                              Quantity
                            </label>
                            <input
                              type="number"
                              min="1"
                              disabled={!item.checked}
                              value={item.quantity}
                              onChange={(e) => handleItemQtyChange(item.item_code, e.target.value)}
                              className="w-20 px-2.5 py-1 text-right font-bold text-sm text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
                            />
                          </div>
                          <div className="flex flex-col items-end">
                            <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5">
                              Price (₹)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              disabled={!item.checked}
                              value={item.unit_price}
                              onChange={(e) => handleItemPriceChange(item.item_code, e.target.value)}
                              className="w-28 px-2.5 py-1 text-right font-bold text-sm text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
                            />
                          </div>
                        </div>
                      </div>
                      
                      {/* Shipping Address Section per item */}
                      {item.checked && (
                        <div className="px-14 pb-4 bg-blue-50/20 border-t border-blue-100">
                          {!item.showShipping ? (
                            <button
                              type="button"
                              onClick={() => toggleShipping(item.item_code)}
                              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-2 cursor-pointer"
                            >
                              + Add Shipping Address (Optional)
                            </button>
                          ) : (
                            <div className="mt-3 bg-white p-3 rounded-lg border border-slate-200">
                              <div className="flex justify-between items-center mb-2">
                                <label className="text-xs font-bold text-slate-700">Shipping Address</label>
                                <button
                                  type="button"
                                  onClick={() => toggleShipping(item.item_code)}
                                  className="text-xs text-red-500 hover:text-red-700 font-semibold cursor-pointer"
                                >
                                  Remove
                                </button>
                              </div>
                              <div className="relative" ref={(el) => (shippingRefs.current[item.item_code] = el)}>
                                <textarea
                                  rows={2}
                                  placeholder="Start typing customer ID, name, or just type the address..."
                                  value={item.shipping_address || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    handleShippingChange(item.item_code, val);
                                    if (val.trim() && customers.some(c => c.id.toLowerCase().includes(val.toLowerCase()) || c.name.toLowerCase().includes(val.toLowerCase()))) {
                                      setActiveShippingDropdown(item.item_code);
                                    } else {
                                      setActiveShippingDropdown(null);
                                    }
                                  }}
                                  onFocus={(e) => {
                                    const val = e.target.value;
                                    if (val.trim() && customers.some(c => c.id.toLowerCase().includes(val.toLowerCase()) || c.name.toLowerCase().includes(val.toLowerCase()))) {
                                      setActiveShippingDropdown(item.item_code);
                                    }
                                  }}
                                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-600 placeholder:text-slate-400 font-medium"
                                  autoComplete="off"
                                />
                                {activeShippingDropdown === item.item_code && customers.filter(c => c.id.toLowerCase().includes((item.shipping_address || '').toLowerCase()) || c.name.toLowerCase().includes((item.shipping_address || '').toLowerCase())).length > 0 && (
                                  <div className="absolute z-30 w-full mt-1 bg-white border-2 border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                                    {customers
                                      .filter(c => c.id.toLowerCase().includes((item.shipping_address || '').toLowerCase()) || c.name.toLowerCase().includes((item.shipping_address || '').toLowerCase()))
                                      .slice(0, 6)
                                      .map(c => (
                                        <button
                                          key={c.id}
                                          type="button"
                                          onClick={() => {
                                            handleShippingChange(item.item_code, `${c.name}\n${c.address}`);
                                            setActiveShippingDropdown(null);
                                          }}
                                          className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                                        >
                                          <div className="font-bold text-sm text-slate-900">{c.id}</div>
                                          <div className="text-xs text-slate-500">{c.name} &bull; {c.address}</div>
                                        </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}

              {/* Purchase Order Financial details */}
              <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="font-bold text-slate-700 uppercase text-xs tracking-wider border-b border-slate-200 pb-2">
                  Commercial & Financial Breakdown
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Basic Value */}
                  <div>
                    <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider">
                      Basic Value (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.basic_value}
                      onChange={set('basic_value')}
                      className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-600 font-bold"
                    />
                    <p className="text-[9px] text-slate-400 mt-1 font-semibold">
                      Auto-calculated from selected items but fully editable.
                    </p>
                  </div>

                  {/* GST */}
                  <div>
                    <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider">
                      GST Tax (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01;0.1"
                      min="0"
                      value={formData.gst}
                      onChange={set('gst')}
                      className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-600 font-bold"
                    />
                  </div>

                  {/* Transport */}
                  <div>
                    <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider">
                      Transport / Freight (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.transport}
                      onChange={set('transport')}
                      className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-600 font-bold"
                    />
                  </div>

                  {/* Packing & Forwarding */}
                  <div>
                    <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider">
                      Packing & Forwarding (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.packing_forward}
                      onChange={set('packing_forward')}
                      className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-600 font-bold"
                    />
                  </div>

                  {/* Other charges */}
                  <div>
                    <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider">
                      Other Charges (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.other}
                      onChange={set('other')}
                      className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-600 font-bold"
                    />
                  </div>

                  {/* Dynamic Total Indicator */}
                  <div className="flex flex-col justify-center bg-blue-50/50 border border-blue-100 rounded-lg p-3">
                    <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest">
                      Gross Total PO Value
                    </span>
                    <span className="text-xl font-black text-blue-800 mt-1">
                      ₹{(
                        (parseFloat(formData.basic_value) || 0) +
                        (parseFloat(formData.gst) || 0) +
                        (parseFloat(formData.transport) || 0) +
                        (parseFloat(formData.packing_forward) || 0) +
                        (parseFloat(formData.other) || 0)
                      ).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Form Buttons */}
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
                      <RefreshCw size={18} className="animate-spin" /> Update Purchase Order
                    </>
                  ) : (
                    <>
                      <Plus size={18} /> Save Purchase Order
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
