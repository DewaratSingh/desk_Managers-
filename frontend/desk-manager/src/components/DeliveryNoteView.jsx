import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Search,
  Edit2,
  Plus,
  RefreshCw,
  ArrowLeft,
  ListFilter,
  CheckSquare,
  Square,
  Truck
} from 'lucide-react';

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000/api'
  : `${window.location.protocol}//${window.location.hostname}:5000/api`;

const EMPTY_FORM = {
  delivery_note_no: '',
  po_no: '',
  ro_no: '',
  delivery_date: '',
  dispatch_doc_no: '',
  dispatch_through: '',
  motor_vehicle_no: ''
};

export default function DeliveryNoteView({
  deliveryNotes = [],
  onAddDeliveryNote,
  onUpdateDeliveryNote,
  isLoading,
  fetchMoreData,
  searchResource,
  onCancel
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('list');
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingNo, setEditingNo] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!location.state) return;

    const { prefillPoNo, prefillRoNo, editDeliveryNoteNo } = location.state;

    if (prefillPoNo) {
      const fetchAndPrefill = async () => {
        try {
          const savedToken = localStorage.getItem('dm_token');
          const headers = { 'Authorization': `Bearer ${savedToken}` };
          const res = await fetch(`${API_BASE_URL}/purchase-orders?search=${encodeURIComponent(prefillPoNo)}&limit=5`, { headers });
          if (res.ok) {
            const data = await res.json();
            const matched = data.find(p => p.po_no === prefillPoNo);
            if (matched) {
              setEditingNo(null);
              setFormData({
                ...EMPTY_FORM,
                delivery_date: new Date().toISOString().slice(0, 10),
                po_no: prefillPoNo
              });
              setOrderInput(prefillPoNo);
              
              if (Array.isArray(matched.items)) {
                setDnItems(matched.items.map(i => ({
                  item_code: i.item_code,
                  description: i.description || '',
                  drawing_number: i.drawing_number || '',
                  quantity: i.quantity || 1,
                  rate_per_piece: i.unit_price || '0.00',
                  shipping_address: i.shipping_address || '',
                  delivery_date: i.delivery_date ? i.delivery_date.slice(0, 10) : '',
                  checked: true
                })));
              }
              setViewMode('form');
            }
          }
        } catch (err) {
          console.error('Error prefilling PO in Delivery Note View:', err);
        }
      };
      fetchAndPrefill();
      navigate(location.pathname, { replace: true, state: {} });
    } else if (prefillRoNo) {
      const fetchAndPrefill = async () => {
        try {
          const savedToken = localStorage.getItem('dm_token');
          const headers = { 'Authorization': `Bearer ${savedToken}` };
          const res = await fetch(`${API_BASE_URL}/release-orders?search=${encodeURIComponent(prefillRoNo)}&limit=5`, { headers });
          if (res.ok) {
            const data = await res.json();
            const matched = data.find(p => p.ro_no === prefillRoNo);
            if (matched) {
              setEditingNo(null);
              setFormData({
                ...EMPTY_FORM,
                delivery_date: new Date().toISOString().slice(0, 10),
                ro_no: prefillRoNo
              });
              setOrderInput(prefillRoNo);
              
              if (Array.isArray(matched.items)) {
                setDnItems(matched.items.map(i => ({
                  item_code: i.item_code,
                  description: i.description || '',
                  drawing_number: i.drawing_number || '',
                  quantity: i.quantity || 1,
                  rate_per_piece: i.unit_price || '0.00',
                  shipping_address: i.shipping_address || '',
                  delivery_date: i.delivery_date ? i.delivery_date.slice(0, 10) : '',
                  checked: true
                })));
              }
              setViewMode('form');
            }
          }
        } catch (err) {
          console.error('Error prefilling RO in Delivery Note View:', err);
        }
      };
      fetchAndPrefill();
      navigate(location.pathname, { replace: true, state: {} });
    } else if (editDeliveryNoteNo) {
      const dn = deliveryNotes.find(d => d.delivery_note_no === editDeliveryNoteNo);
      if (dn) {
        handleEditClick(dn);
      } else {
        const fetchAndEdit = async () => {
          try {
            const savedToken = localStorage.getItem('dm_token');
            const headers = { 'Authorization': `Bearer ${savedToken}` };
            const res = await fetch(`${API_BASE_URL}/delivery-notes?search=${encodeURIComponent(editDeliveryNoteNo)}&limit=5`, { headers });
            if (res.ok) {
              const data = await res.json();
              const matched = data.find(d => d.delivery_note_no === editDeliveryNoteNo);
              if (matched) {
                handleEditClick(matched);
              }
            }
          } catch (err) {
            console.error('Error fetching DN for edit:', err);
          }
        };
        fetchAndEdit();
      }
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, deliveryNotes]);

  // Form Specific States
  const [orderInput, setOrderInput] = useState('');
  const [orderSuggestions, setOrderSuggestions] = useState([]);
  const [showOrderDropdown, setShowOrderDropdown] = useState(false);
  const orderRef = useRef(null);
  const [dnItems, setDnItems] = useState([]);

  // Handle outside click for dropdown
  useEffect(() => {
    const handler = (e) => {
      if (orderRef.current && !orderRef.current.contains(e.target)) {
        setShowOrderDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOrderSearch = async (val) => {
    setOrderInput(val);
    // Reset linked orders on search
    setFormData(prev => ({ ...prev, po_no: '', ro_no: '' }));

    if (!val.trim()) {
      setOrderSuggestions([]);
      setShowOrderDropdown(false);
      return;
    }

    try {
      const savedToken = localStorage.getItem('dm_token');
      const headers = { 'Authorization': `Bearer ${savedToken}` };

      const [poRes, roRes] = await Promise.all([
        fetch(`${API_BASE_URL}/purchase-orders?search=${encodeURIComponent(val)}&limit=5`, { headers }),
        fetch(`${API_BASE_URL}/release-orders?search=${encodeURIComponent(val)}&limit=5`, { headers })
      ]);

      const pos = await poRes.json();
      const ros = await roRes.json();

      const combined = [
        ...pos.map(p => ({ ...p, type: 'PO', id: p.po_no })),
        ...ros.map(r => ({ ...r, type: 'RO', id: r.ro_no }))
      ];

      setOrderSuggestions(combined);
      setShowOrderDropdown(true);
    } catch (e) {
      console.error(e);
    }
  };

  const selectOrder = (order) => {
    setOrderInput(order.id);
    if (order.type === 'PO') {
      setFormData(prev => ({ ...prev, po_no: order.id, ro_no: '' }));
    } else {
      setFormData(prev => ({ ...prev, ro_no: order.id, po_no: '' }));
    }
    setShowOrderDropdown(false);

    if (Array.isArray(order.items)) {
      setDnItems(order.items.map(i => ({
        item_code: i.item_code,
        description: i.description || '',
        drawing_number: i.drawing_number || '',
        quantity: i.quantity || 1,
        rate_per_piece: i.unit_price || '0.00',
        shipping_address: i.shipping_address || '',
        delivery_date: i.delivery_date ? i.delivery_date.slice(0, 10) : '',
        checked: true
      })));
    }
  };

  const handleOpenAddForm = () => {
    setEditingNo(null);
    setFormData({
      ...EMPTY_FORM,
      delivery_date: new Date().toISOString().slice(0, 10)
    });
    setOrderInput('');
    setDnItems([]);
    setViewMode('form');
  };

  const handleEditClick = (dn) => {
    setEditingNo(dn.delivery_note_no);
    setFormData({
      delivery_note_no: dn.delivery_note_no,
      po_no: dn.po_no || '',
      ro_no: dn.ro_no || '',
      delivery_date: dn.delivery_date ? dn.delivery_date.slice(0, 10) : '',
      dispatch_doc_no: dn.dispatch_doc_no || '',
      dispatch_through: dn.dispatch_through || '',
      motor_vehicle_no: dn.motor_vehicle_no || ''
    });
    setOrderInput(dn.po_no || dn.ro_no || '');
    setDnItems((dn.items || []).map(i => ({
      item_code: i.item_code,
      description: i.description || '',
      drawing_number: i.drawing_number || '',
      quantity: i.quantity || 1,
      rate_per_piece: i.rate_per_piece || '0.00',
      shipping_address: i.shipping_address || '',
      delivery_date: i.delivery_date ? i.delivery_date.slice(0, 10) : '',
      checked: true
    })));
    setViewMode('form');
  };

  const handleBackToDirectory = () => {
    setEditingNo(null);
    setFormData(EMPTY_FORM);
    setOrderInput('');
    setDnItems([]);
    if (onCancel) {
      onCancel(() => setViewMode('list'));
    } else {
      setViewMode('list');
    }
  };

  const toggleItemChecked = (item_code) => {
    setDnItems(prev => prev.map(i =>
      i.item_code === item_code ? { ...i, checked: !i.checked } : i
    ));
  };

  const handleItemQtyChange = (item_code, val) => {
    setDnItems(prev => prev.map(i =>
      i.item_code === item_code ? { ...i, quantity: val } : i
    ));
  };

  const handleItemRateChange = (item_code, val) => {
    setDnItems(prev => prev.map(i =>
      i.item_code === item_code ? { ...i, rate_per_piece: val } : i
    ));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const selectedItems = dnItems.filter(i => i.checked);
    if (selectedItems.length === 0) {
      alert('Please select at least one item.');
      return;
    }

    const payload = {
      ...formData,
      items: selectedItems.map(i => ({
        item_code: i.item_code,
        quantity: parseInt(i.quantity),
        rate_per_piece: parseFloat(i.rate_per_piece)
      }))
    };

    if (editingNo) {
      const success = await onUpdateDeliveryNote(editingNo, payload);
      if (success) handleBackToDirectory();
    } else {
      const success = await onAddDeliveryNote(payload);
      if (success) handleBackToDirectory();
    }
  };

  useEffect(() => {
    if (searchResource) {
      const delayDebounceFn = setTimeout(() => {
        searchResource('delivery-notes', searchQuery);
      }, 300);
      return () => clearTimeout(delayDebounceFn);
    }
  }, [searchQuery, searchResource]);

  const fmtDate = (d) => {
    if (!d) return '—';
    if (typeof d === 'string' && d.match(/^\d{4}-\d{2}-\d{2}/)) {
      const parts = d.substring(0, 10).split('-');
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return dt.toLocaleDateString('en-GB');
  };

  const setField = (field) => (e) => setFormData(prev => ({ ...prev, [field]: e.target.value }));

  // Compute subtotal of selected items
  const subtotal = dnItems
    .filter(i => i.checked)
    .reduce((sum, i) => sum + (parseFloat(i.quantity) || 0) * (parseFloat(i.rate_per_piece) || 0), 0);

  return (
    <div className="flex-1 p-4 sm:p-8 lg:p-10 bg-[#f1f5f9] max-w-5xl mx-auto w-full text-slate-900">
      {/* ================================================================
          VIEW MODE: LIST
         ================================================================ */}
      {viewMode === 'list' ? (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 m-0">Delivery Notes</h1>
              <p className="text-base text-slate-500 mt-1 font-medium">
                Manage and track deliveries against purchase or release orders.
              </p>
            </div>
            <button
              onClick={handleOpenAddForm}
              className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm self-start sm:self-auto"
            >
              <Plus size={20} /> New Delivery Note
            </button>
          </div>

          {/* Search */}
          <div className="flex items-center gap-3 border-2 border-slate-200 rounded-xl px-4 py-4 bg-white shadow-sm">
            <Search size={22} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search by DN no., PO no., customer or item code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent focus:outline-none text-lg text-slate-900 placeholder:text-slate-400 font-semibold"
            />
          </div>

          {/* Directory */}
          <div className="border-2 border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
              <span className="text-sm font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <ListFilter size={16} className="text-blue-600" />
                Delivery Note Directory ({deliveryNotes.length})
              </span>
            </div>

            {deliveryNotes.length === 0 ? (
              <div className="p-16 text-center text-slate-400 text-lg font-semibold">
                No Delivery Notes found. Click "New Delivery Note" to create one.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {deliveryNotes.map((dn) => (
                  <div
                    key={dn.delivery_note_no}
                    className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white hover:bg-slate-50/75 transition-colors"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-mono font-extrabold text-sm text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                          {dn.delivery_note_no}
                        </span>
                        {dn.po_no && (
                          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                            PO: {dn.po_no}
                          </span>
                        )}
                        {dn.ro_no && (
                          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                            RO: {dn.ro_no}
                          </span>
                        )}
                        {dn.customer_id && (
                          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-semibold">
                            Cust: {dn.customer_name || dn.customer_id}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 font-medium">
                        <span>Date: {fmtDate(dn.delivery_date)}</span>
                        <span>•</span>
                        <span>Items: {Array.isArray(dn.items) ? dn.items.length : 0}</span>
                        {dn.dispatch_through && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Truck size={12} /> {dn.dispatch_through}
                            </span>
                          </>
                        )}
                      </div>
                      {dn.buyer_name && (
                        <p className="text-xs text-slate-400 font-semibold">
                          Buyer: {dn.buyer_name} ({dn.buyer_email || '—'})
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleEditClick(dn)}
                        className="px-4 py-2 text-sm border-2 border-slate-200 hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg text-slate-700 font-bold bg-white transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit2 size={14} /> Edit
                      </button>
                      <Link
                        to={`/delivery-note/${encodeURIComponent(dn.delivery_note_no)}`}
                        className="px-4 py-2 text-sm border-2 border-slate-200 hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg text-slate-700 font-bold bg-white transition-colors flex items-center gap-1.5 justify-center"
                      >
                        View Details
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {deliveryNotes.length >= 20 && deliveryNotes.length % 20 === 0 && (
              <div className="flex justify-center p-4 bg-slate-50 border-t border-slate-200">
                <button
                  onClick={() => fetchMoreData('delivery-notes', deliveryNotes.length, searchQuery)}
                  className="px-6 py-2.5 border-2 border-slate-200 hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50 text-slate-700 font-bold text-sm rounded-lg transition-colors cursor-pointer"
                >
                  Load More Delivery Notes
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
              <ArrowLeft size={16} /> Back to Directory
            </button>
            <h1 className="text-3xl font-extrabold text-slate-900 m-0">
              {editingNo ? 'Modify Delivery Note' : 'Create Delivery Note'}
            </h1>
            <p className="text-base text-slate-500 mt-1 font-medium">
              {editingNo
                ? 'Update the delivery note details and item quantities.'
                : 'Create a Delivery Note by linking it to a Purchase Order or Release Order.'}
            </p>
          </div>

          <div className="bg-white border-2 border-slate-200 rounded-xl p-5 sm:p-8 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Row 1: DN No. + Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider">
                    Delivery Note No. <b className="text-red-500">*</b>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingNo}
                    value={formData.delivery_note_no}
                    onChange={setField('delivery_note_no')}
                    placeholder="Enter DN Number"
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-base text-slate-900 focus:outline-none focus:border-blue-600 font-mono font-bold disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider">
                    Delivery Date <b className="text-red-500">*</b>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.delivery_date}
                    onChange={setField('delivery_date')}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-base text-slate-900 focus:outline-none focus:border-blue-600 font-medium"
                  />
                </div>
              </div>

              {/* Row 2: Dispatch fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider">Dispatch Doc No.</label>
                  <input
                    type="text"
                    value={formData.dispatch_doc_no}
                    onChange={setField('dispatch_doc_no')}
                    placeholder="e.g. LR-12345"
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-base text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider">Dispatch Through</label>
                  <input
                    type="text"
                    value={formData.dispatch_through}
                    onChange={setField('dispatch_through')}
                    placeholder="e.g. DTDC, BlueDart"
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-base text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider">Motor Vehicle No.</label>
                  <input
                    type="text"
                    value={formData.motor_vehicle_no}
                    onChange={setField('motor_vehicle_no')}
                    placeholder="e.g. HR 26 AB 1234"
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-base text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Order Link */}
              <div ref={orderRef} className="relative">
                <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider">
                  Link to Order (PO / RO) <b className="text-red-500">*</b>
                </label>
                <input
                  type="text"
                  disabled={!!editingNo}
                  placeholder="Search PO or RO by number..."
                  value={orderInput}
                  onChange={(e) => handleOrderSearch(e.target.value)}
                  onFocus={() => orderInput.trim() && setShowOrderDropdown(true)}
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-base text-slate-900 focus:outline-none focus:border-blue-600 font-medium disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                  autoComplete="off"
                />
                {showOrderDropdown && orderSuggestions.length > 0 && (
                  <div className="absolute z-30 w-full mt-1 bg-white border-2 border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
                    {orderSuggestions.map((order) => (
                      <button
                        key={`${order.type}-${order.id}`}
                        type="button"
                        onClick={() => selectOrder(order)}
                        className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                      >
                        <div className="flex justify-between items-center">
                          <div className="font-bold text-sm text-slate-900">{order.id}</div>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${order.type === 'PO' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                            {order.type}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Items: {order.items?.length || 0} &bull; Cust: {order.customer_id || '—'}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Items List */}
              {dnItems.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-visible">
                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center rounded-t-xl">
                    <span className="text-xs font-extrabold text-slate-500 uppercase tracking-widest">
                      Items to Deliver
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const allChecked = dnItems.every(i => i.checked);
                        setDnItems(prev => prev.map(i => ({ ...i, checked: !allChecked })));
                      }}
                      className="text-xs text-blue-600 hover:text-blue-700 font-bold hover:underline cursor-pointer"
                    >
                      {dnItems.every(i => i.checked) ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  <div className="space-y-4 p-4 bg-slate-50/50">
                    {dnItems.map((item) => (
                      <div
                        key={item.item_code}
                        className={`border-2 rounded-xl transition-all duration-200 overflow-visible ${
                          item.checked
                            ? 'bg-white border-slate-200 hover:border-blue-500 hover:shadow-md'
                            : 'bg-slate-50/75 border-slate-100 opacity-60 hover:opacity-100 hover:border-slate-300 hover:shadow-sm'
                        }`}
                      >
                        <div className={`flex flex-col sm:flex-row sm:items-center px-5 py-4 gap-4 transition-colors ${item.checked ? 'bg-blue-50/10' : ''}`}>
                          {/* Checkbox */}
                          <button
                            type="button"
                            onClick={() => toggleItemChecked(item.item_code)}
                            className="text-blue-600 focus:outline-none shrink-0"
                          >
                            {item.checked ? <CheckSquare size={22} /> : <Square size={22} className="text-slate-400" />}
                          </button>

                          {/* Details */}
                          <div className="min-w-0 flex-1 text-left">
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
                            {(item.shipping_address || item.delivery_date) && (
                              <div className="mt-2 text-xs border-t border-slate-100 pt-2 space-y-1">
                                {item.shipping_address && (
                                  <div className="text-slate-600">
                                    <span className="font-extrabold text-slate-400 uppercase text-[9px] tracking-wider block">Target Shipping Address</span>
                                    <span className="font-medium whitespace-pre-wrap">{item.shipping_address}</span>
                                  </div>
                                )}
                                {item.delivery_date && (
                                  <div className="text-slate-600 flex items-center gap-1.5 mt-1">
                                    <span className="font-extrabold text-slate-400 uppercase text-[9px] tracking-wider">Target Delivery:</span>
                                    <span className="font-bold text-slate-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded text-[10px]">{fmtDate(item.delivery_date)}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Inputs */}
                          <div className="flex flex-wrap gap-4 shrink-0">
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
                                Rate (₹)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                disabled={!item.checked}
                                value={item.rate_per_piece}
                                onChange={(e) => handleItemRateChange(item.item_code, e.target.value)}
                                className="w-28 px-2.5 py-1 text-right font-bold text-sm text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Subtotal Banner */}
              {dnItems.filter(i => i.checked).length > 0 && (
                <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-5">
                  <div className="font-bold text-slate-700 uppercase text-xs tracking-wider border-b border-slate-200 pb-2 mb-4">
                    Delivery Summary
                  </div>
                  <div className="flex flex-wrap gap-6 items-center">
                    <div>
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                        Items Selected
                      </span>
                      <span className="text-xl font-black text-slate-800">
                        {dnItems.filter(i => i.checked).length}
                      </span>
                    </div>
                    <div className="flex flex-col justify-center bg-blue-50/50 border border-blue-100 rounded-lg p-3 ml-auto">
                      <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest">
                        Gross Delivery Value
                      </span>
                      <span className="text-xl font-black text-blue-800 mt-1">
                        ₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              )}

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
                  className={`px-10 py-4 rounded-lg font-bold text-base uppercase tracking-wider text-white transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                    editingNo ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {isLoading ? (
                    'Processing...'
                  ) : editingNo ? (
                    <><RefreshCw size={18} /> Update Delivery Note</>
                  ) : (
                    <><Plus size={18} /> Save Delivery Note</>
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
