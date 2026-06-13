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
  ro_no: '',
  contract_ref: '',
  buyer_id: null,
  buyer_name: '',
  buyer_email: '',
  buyer_phone: '',
  customer_id: '',
  ro_date: '',
  delivery_date: '',
  gst: '0.00',
  transport: '0.00',
  other: '0.00',
  basic_value: '0.00',
  packing_forward: '0.00'
};

export default function ReleaseOrderView({
  releaseOrders = [],
  buyers = [],
  customers = [],
  onAddReleaseOrder,
  onUpdateReleaseOrder,
  onDeleteReleaseOrder,
  isLoading,
  error,
  fetchMoreData,
  searchResource
}) {
  const [viewMode, setViewMode] = useState('list');
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingNo, setEditingNo] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected items inside form
  const [selectedItems, setSelectedItems] = useState([]); // Array of { item_code, description, drawing_number, quantity, unit_price, shipping_address, showShipping }

  // Autocomplete states
  // Buyer
  const [buyerInput, setBuyerInput] = useState('');
  const [buyerSuggestions, setBuyerSuggestions] = useState([]);
  const [showBuyerDropdown, setShowBuyerDropdown] = useState(false);
  const buyerRef = useRef(null);

  // Customer
  const [customerInput, setCustomerInput] = useState('');
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerRef = useRef(null);

  // GST Autocomplete
  const [activeGstDropdown, setActiveGstDropdown] = useState(null);
  const [gstSuggestions, setGstSuggestions] = useState([]);
  const [gstRatesList, setGstRatesList] = useState([]);
  const [gstInputs, setGstInputs] = useState({});
  const gstRefs = useRef({});

  // Item catalog search
  const [itemSearch, setItemSearch] = useState('');
  const [itemSuggestions, setItemSuggestions] = useState([]);
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const itemRef = useRef(null);

  // Shipping address suggestions
  const [activeShippingDropdown, setActiveShippingDropdown] = useState(null);
  const shippingRefs = useRef({});

  // ARC items state (to automatically fetch price)
  const [arcItems, setArcItems] = useState([]);

  // Close dropdowns on click outside
  useEffect(() => {
    const handler = (e) => {
      if (buyerRef.current && !buyerRef.current.contains(e.target)) setShowBuyerDropdown(false);
      if (customerRef.current && !customerRef.current.contains(e.target)) setShowCustomerDropdown(false);
      if (itemRef.current && !itemRef.current.contains(e.target)) setShowItemDropdown(false);
      if (activeGstDropdown) {
        const ref = gstRefs.current[activeGstDropdown];
        if (ref && !ref.contains(e.target)) {
          // reset visible input back to the committed value (or empty)
          const item = selectedItems.find(i => i.item_code === activeGstDropdown);
          setGstInputs(prev => ({
            ...prev,
            [activeGstDropdown]: item ? (item.gst_type || '') : ''
          }));
          setActiveGstDropdown(null);
        }
      }

      if (activeShippingDropdown) {
        const ref = shippingRefs.current[activeShippingDropdown];
        if (ref && !ref.contains(e.target)) {
          setActiveShippingDropdown(null);
        }
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [activeShippingDropdown, activeGstDropdown, selectedItems]);

  // Load ARC prices on mount
  useEffect(() => {
    fetchARCPrices();
    
    const fetchGstRates = async () => {
      try {
        const savedToken = localStorage.getItem('dm_token');
        const headers = { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${savedToken}`
        };
        const res = await fetch(`${API_BASE_URL}/gst-rates?limit=100`, { headers });
        if (res.ok) {
          const data = await res.json();
          setGstRatesList(data);
        }
      } catch (err) {
        console.error('Error fetching GST rates:', err);
      }
    };
    fetchGstRates();
  }, []);

  const fetchARCPrices = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/arc`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('dm_token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setArcItems(data);
      }
    } catch (e) {
      console.error('Error fetching ARC prices:', e);
    }
  };

  // ── Autocomplete: Buyer ──
  const handleBuyerInput = async (val) => {
    setBuyerInput(val);
    setFormData((prev) => ({ ...prev, buyer_name: val, buyer_id: null, buyer_email: '', buyer_phone: '' }));
    if (!val.trim()) {
      setBuyerSuggestions([]);
      setShowBuyerDropdown(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/buyers?search=${encodeURIComponent(val)}&limit=5`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('dm_token')}` }
      });
      const data = await res.json();
      setBuyerSuggestions(data);
      setShowBuyerDropdown(true);
    } catch (e) {
      console.error(e);
    }
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

  // ── Autocomplete: Customer ──
  const handleCustomerInput = async (val) => {
    setCustomerInput(val);
    setFormData((prev) => ({ ...prev, customer_id: val }));
    if (!val.trim()) {
      setCustomerSuggestions([]);
      setShowCustomerDropdown(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/customers?search=${encodeURIComponent(val)}&limit=5`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('dm_token')}` }
      });
      const data = await res.json();
      setCustomerSuggestions(data);
      setShowCustomerDropdown(true);
    } catch (e) {
      console.error(e);
    }
  };

  const selectCustomer = (c) => {
    setCustomerInput(c.id);
    setFormData((prev) => ({ ...prev, customer_id: c.id }));
    setShowCustomerDropdown(false);
  };

  // ── Autocomplete: Item Search ──
  const handleItemSearch = async (val) => {
    setItemSearch(val);
    if (!val.trim()) {
      setItemSuggestions([]);
      setShowItemDropdown(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/arc?search=${encodeURIComponent(val)}&limit=10`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('dm_token')}` }
      });
      const data = await res.json();
      // Filter out items already selected
      const filtered = data.filter((i) => !selectedItems.some((si) => si.item_code === i.item_code));
      setItemSuggestions(filtered);
      setShowItemDropdown(true);
    } catch (e) {
      console.error(e);
    }
  };

  const addItem = (item) => {
    if (selectedItems.find((i) => i.item_code === item.item_code)) {
      setItemSearch('');
      setShowItemDropdown(false);
      return;
    }

    // Use price from the selected ARC item, fallback to arcItems lookup if needed
    const arcMatch = arcItems.find((a) => a.item_code === item.item_code);
    const unitPrice = item.price !== undefined && item.price !== null
      ? parseFloat(item.price).toFixed(2)
      : (arcMatch ? parseFloat(arcMatch.price).toFixed(2) : '0.00');

    const newItem = {
      item_code: item.item_code,
      description: item.description || '',
      drawing_number: item.drawing_number || '',
      quantity: 1,
      unit_price: unitPrice,
      delivery_date: '',
      gst_type: '',
      gst_rate: '0.00',
      shipping_address: '',
      showShipping: false,
      showDeliveryDate: false,
      checked: true
    };

    const updated = [...selectedItems, newItem];
    setSelectedItems(updated);
    updateFinancialValues(updated);

    setItemSearch('');
    setShowItemDropdown(false);
  };

  const removeItem = (item_code) => {
    const updated = selectedItems.filter((i) => i.item_code !== item_code);
    setSelectedItems(updated);
    updateFinancialValues(updated);
  };

  const handleItemQtyChange = (item_code, newQty) => {
    const val = parseInt(newQty) || 0;
    const updated = selectedItems.map((i) => {
      if (i.item_code === item_code) {
        return { ...i, quantity: val };
      }
      return i;
    });
    setSelectedItems(updated);
    updateFinancialValues(updated);
  };

  const handleItemPriceChange = (item_code, newPrice) => {
    const updated = selectedItems.map((i) => {
      if (i.item_code === item_code) {
        return { ...i, unit_price: newPrice };
      }
      return i;
    });
    setSelectedItems(updated);
    updateFinancialValues(updated);
  };

  const toggleShipping = (item_code) => {
    setSelectedItems(selectedItems.map(i => i.item_code === item_code ? { ...i, showShipping: !i.showShipping } : i));
  };

  const handleShippingChange = (item_code, val) => {
    setSelectedItems(selectedItems.map(i => i.item_code === item_code ? { ...i, shipping_address: val } : i));
  };

  const handleItemDeliveryDateChange = (item_code, val) => {
    setSelectedItems(selectedItems.map(i => i.item_code === item_code ? { ...i, delivery_date: val } : i));
  };

  const toggleDeliveryDate = (item_code) => {
    setSelectedItems(selectedItems.map(i => i.item_code === item_code ? { ...i, showDeliveryDate: !i.showDeliveryDate } : i));
  };

  const toggleItemChecked = (item_code) => {
    const updated = selectedItems.map((i) =>
      i.item_code === item_code ? { ...i, checked: !i.checked } : i
    );
    setSelectedItems(updated);
    updateFinancialValues(updated);
  };

  const handleItemGstInput = (item_code, val) => {
    // Always update the visible input text immediately
    setGstInputs(prev => ({ ...prev, [item_code]: val }));

    if (!val.trim()) {
      // user cleared the field — clear the committed value too
      const updated = selectedItems.map(i =>
        i.item_code === item_code ? { ...i, gst_type: '', gst_rate: '0.00' } : i
      );
      setSelectedItems(updated);
      updateFinancialValues(updated);
      setGstSuggestions([]);
      setActiveGstDropdown(null);
    } else {
      const filtered = gstRatesList.filter(r =>
        r.type.toLowerCase().includes(val.toLowerCase())
      );
      setGstSuggestions(filtered);
      setActiveGstDropdown(item_code);
    }
  };

  const selectItemGstCategory = (item_code, gst) => {
    const updated = selectedItems.map(i =>
      i.item_code === item_code ? { ...i, gst_type: gst.type, gst_rate: gst.rate.toString() } : i
    );
    setSelectedItems(updated);
    updateFinancialValues(updated);
    // sync the visible input to the selected label
    setGstInputs(prev => ({ ...prev, [item_code]: gst.type }));
    setActiveGstDropdown(null);
  };

  const updateFinancialValues = (itemsList) => {
    const total = itemsList
      .filter((i) => i.checked)
      .reduce((sum, i) => sum + (i.quantity || 0) * (parseFloat(i.unit_price) || 0), 0);
    const gstTotal = itemsList
      .filter((i) => i.checked)
      .reduce((sum, i) => {
        const basic = (i.quantity || 0) * (parseFloat(i.unit_price) || 0);
        const rate = parseFloat(i.gst_rate) || 0;
        return sum + basic * (rate / 100);
      }, 0);
    setFormData((prev) => ({ 
      ...prev, 
      basic_value: total.toFixed(2),
      gst: gstTotal.toFixed(2)
    }));
  };

  // ── Open Forms ──
  const handleOpenAddForm = () => {
    setEditingNo(null);
    setFormData({
      ...EMPTY_FORM,
      ro_date: new Date().toISOString().slice(0, 10)
    });
    setBuyerInput('');
    setCustomerInput('');
    setSelectedItems([]);
    setItemSearch('');
    setViewMode('form');
  };

  const handleEditClick = (ro) => {
    setEditingNo(ro.ro_no);
    setFormData({
      ro_no: ro.ro_no,
      contract_ref: ro.contract_ref || '',
      buyer_id: ro.buyer_id || null,
      buyer_name: ro.buyer_name || '',
      buyer_email: ro.buyer_email || '',
      buyer_phone: ro.buyer_phone || '',
      customer_id: ro.customer_id || '',
      ro_date: ro.ro_date ? ro.ro_date.slice(0, 10) : '',
      delivery_date: ro.delivery_date ? ro.delivery_date.slice(0, 10) : '',
      gst: parseFloat(ro.gst).toFixed(2),
      transport: parseFloat(ro.transport).toFixed(2),
      other: parseFloat(ro.other).toFixed(2),
      basic_value: parseFloat(ro.basic_value).toFixed(2),
      packing_forward: parseFloat(ro.packing_forward).toFixed(2)
    });

    setBuyerInput(ro.buyer_name || '');
    setCustomerInput(ro.customer_id || '');
    
    setSelectedItems(
      Array.isArray(ro.items)
        ? ro.items.map((i) => ({
            item_code: i.item_code,
            description: i.description || '',
            drawing_number: i.drawing_number || '',
            quantity: i.quantity || 1,
            unit_price: parseFloat(i.unit_price).toFixed(2),
            delivery_date: i.delivery_date ? i.delivery_date.slice(0, 10) : '',
            gst_type: i.gst_type || '',
            gst_rate: i.gst_rate !== undefined && i.gst_rate !== null ? parseFloat(i.gst_rate).toString() : '0.00',
            shipping_address: i.shipping_address || '',
            showShipping: !!i.shipping_address,
            showDeliveryDate: !!i.delivery_date,
            checked: true
          }))
        : []
    );
    setViewMode('form');
  };

  const handleBackToDirectory = () => {
    setEditingNo(null);
    setFormData(EMPTY_FORM);
    setBuyerInput('');
    setCustomerInput('');
    setSelectedItems([]);
    setItemSearch('');
    setViewMode('list');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.ro_no.trim() || !formData.ro_date) return;

    if (!formData.buyer_id) {
      alert('Please select a valid buyer from the suggestions.');
      return;
    }
    if (!formData.customer_id) {
      alert('Please select a valid customer from the suggestions.');
      return;
    }

    const activeItems = selectedItems.filter((i) => i.checked);
    if (activeItems.length === 0) {
      alert('You must select at least one item to order.');
      return;
    }

    // Validate quantities, prices, and GST Category
    for (const item of activeItems) {
      if (item.quantity <= 0) {
        alert(`Quantity for item ${item.item_code} must be greater than 0.`);
        return;
      }
      if (parseFloat(item.unit_price) < 0) {
        alert(`Unit price for item ${item.item_code} cannot be negative.`);
        return;
      }
      if (!item.gst_type || !item.gst_type.trim()) {
        alert(`Please select a valid GST Category for item ${item.item_code}.`);
        return;
      }
    }

    const payload = {
      ...formData,
      items: activeItems.map((i) => ({
        item_code: i.item_code,
        quantity: i.quantity,
        unit_price: i.unit_price,
        delivery_date: i.delivery_date || null,
        gst_type: i.gst_type || '',
        gst_rate: i.gst_rate !== '' ? parseFloat(i.gst_rate) : 0.00,
        shipping_address: i.shipping_address || null
      }))
    };

    if (editingNo) {
      const success = await onUpdateReleaseOrder(editingNo, payload);
      if (success) handleBackToDirectory();
    } else {
      const success = await onAddReleaseOrder(payload);
      if (success) {
        setFormData({
          ...EMPTY_FORM,
          ro_date: new Date().toISOString().slice(0, 10)
        });
        setBuyerInput('');
        setCustomerInput('');
        setSelectedItems([]);
        setItemSearch('');
      }
    }
  };

  const set = (field) => (e) =>
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  useEffect(() => {
    if (searchResource) {
      const delayDebounceFn = setTimeout(() => {
        searchResource('release-orders', searchQuery);
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

  const calculateTotalROValue = (ro) => {
    const basic = parseFloat(ro.basic_value) || 0;
    const tax = parseFloat(ro.gst) || 0;
    const shipping = parseFloat(ro.transport) || 0;
    const pAndF = parseFloat(ro.packing_forward) || 0;
    const otherCharges = parseFloat(ro.other) || 0;
    return basic + tax + shipping + pAndF + otherCharges;
  };

  const inputCls = "w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-base text-slate-900 focus:outline-none focus:border-blue-600 placeholder:text-slate-400 font-medium";
  const labelCls = "block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider";

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
              <h1 className="text-3xl font-extrabold text-slate-900 m-0">Release Orders</h1>
              <p className="text-base text-slate-500 mt-1 font-medium">
                Record and manage release orders linked to clients and agreements.
              </p>
            </div>
            <button
              onClick={handleOpenAddForm}
              className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm self-start sm:self-auto"
            >
              <Plus size={20} />
              New Release Order
            </button>
          </div>

          {/* Search */}
          <div className="flex items-center gap-3 border-2 border-slate-200 rounded-xl px-4 py-4 bg-white shadow-sm">
            <Search size={22} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search by RO no., customer ID, buyer name, or item code..."
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
                Release Order Directory ({releaseOrders.length})
              </span>
            </div>

            {releaseOrders.length === 0 ? (
              <div className="p-16 text-center text-slate-400 text-lg font-semibold">
                No Release Orders found. Click "New Release Order" to create one.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {releaseOrders.map((ro) => (
                  <div
                    key={ro.ro_no}
                    className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white hover:bg-slate-50/75 transition-colors"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-extrabold text-sm text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                          {ro.ro_no}
                        </span>
                        {ro.contract_ref && (
                          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                            Contract Ref: {ro.contract_ref}
                          </span>
                        )}
                        {ro.customer_id && (
                          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-semibold">
                            Cust ID: {ro.customer_id}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 font-medium">
                        <span>Date: {fmtDate(ro.ro_date)}</span>
                        {ro.delivery_date && (
                          <>
                            <span>•</span>
                            <span className="text-slate-700 font-semibold">Delivery: {fmtDate(ro.delivery_date)}</span>
                          </>
                        )}
                        <span>•</span>
                        <span>Items: {Array.isArray(ro.items) ? ro.items.length : 0}</span>
                        <span>•</span>
                        <span className="text-slate-700 font-bold">
                          Total Value: ₹{calculateTotalROValue(ro).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      {ro.buyer_name && (
                        <p className="text-xs text-slate-400 font-semibold">
                          Buyer: {ro.buyer_name} ({ro.buyer_email || '—'})
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleEditClick(ro)}
                        className="px-4 py-2 text-sm border-2 border-slate-200 hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg text-slate-700 font-bold bg-white transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit2 size={14} /> Edit
                      </button>
                      <Link
                        to={`/release-order/${encodeURIComponent(ro.ro_no)}`}
                        className="px-4 py-2 text-sm border-2 border-slate-200 hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg text-slate-700 font-bold bg-white transition-colors flex items-center gap-1.5 justify-center"
                      >
                        View Details
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {releaseOrders.length >= 20 && releaseOrders.length % 20 === 0 && (
              <div className="flex justify-center p-4 bg-slate-50 border-t border-slate-200">
                <button
                  onClick={() => fetchMoreData('release-orders', releaseOrders.length, searchQuery)}
                  className="px-6 py-2.5 border-2 border-slate-200 hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50 text-slate-700 font-bold text-sm rounded-lg transition-colors cursor-pointer"
                >
                  Load More Release Orders
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
              {editingNo ? 'Modify Release Order' : 'Create Release Order'}
            </h1>
            <p className="text-base text-slate-500 mt-1 font-medium">
              Formulate a Release Order with ARC rates, search-based customer/buyer selection, and shipping details.
            </p>
          </div>

          <div className="bg-white border-2 border-slate-200 rounded-xl p-5 sm:p-8 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Header Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider">
                    Release Order No. <b className="text-red-500">*</b>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingNo}
                    value={formData.ro_no}
                    onChange={set('ro_no')}
                    placeholder="Enter RO Number"
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-base text-slate-900 focus:outline-none focus:border-blue-600 font-mono font-bold disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    Contract Ref.
                  </label>
                  <input
                    type="text"
                    value={formData.contract_ref}
                    onChange={set('contract_ref')}
                    placeholder="Optional"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    RO Date <b className="text-red-500">*</b>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.ro_date}
                    onChange={set('ro_date')}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    Date of Delivery
                  </label>
                  <input
                    type="date"
                    value={formData.delivery_date}
                    onChange={set('delivery_date')}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Buyer & Customer Dropdowns (Search-based similar to RFQ) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Buyer */}
                <div ref={buyerRef} className="relative">
                  <label className={labelCls}>Buyer Name <b className="text-red-500">*</b></label>
                  <input
                    type="text"
                    placeholder="Start typing buyer name..."
                    value={buyerInput}
                    onChange={(e) => handleBuyerInput(e.target.value)}
                    onFocus={() => buyerInput.trim() && setShowBuyerDropdown(true)}
                    className={inputCls}
                    autoComplete="off"
                  />
                  {showBuyerDropdown && buyerSuggestions.length > 0 && (
                    <div className="absolute z-30 w-full mt-1 bg-white border-2 border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
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
                  {buyerInput.trim().length > 0 && !formData.buyer_id && buyerSuggestions.length === 0 && (
                    <div className="mt-2 flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs font-bold">
                      <AlertCircle size={13} />
                      No registered buyers found matching "{buyerInput}".
                    </div>
                  )}
                </div>

                {/* Customer */}
                <div ref={customerRef} className="relative">
                  <label className={labelCls}>Customer ID <b className="text-red-500">*</b></label>
                  <input
                    type="text"
                    placeholder="Start typing customer ID..."
                    value={customerInput}
                    onChange={(e) => handleCustomerInput(e.target.value)}
                    onFocus={() => customerInput.trim() && setShowCustomerDropdown(true)}
                    className={inputCls}
                    autoComplete="off"
                  />
                  {showCustomerDropdown && customerSuggestions.length > 0 && (
                    <div className="absolute z-30 w-full mt-1 bg-white border-2 border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                      {customerSuggestions.slice(0, 6).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => selectCustomer(c)}
                          className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                        >
                          <div className="font-bold text-sm text-slate-900">{c.id}</div>
                          <div className="text-xs text-slate-500">{c.name} &bull; {c.address}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  {customerInput.trim().length > 0 && !formData.customer_id && customerSuggestions.length === 0 && (
                    <div className="mt-2 flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs font-bold">
                      <AlertCircle size={13} />
                      No registered customers found matching "{customerInput}".
                    </div>
                  )}
                </div>
              </div>

              {/* Item Search box */}
              <div ref={itemRef} className="relative">
                <label className={labelCls}>Add Item (Search based)</label>
                <input
                  type="text"
                  placeholder="Type item code or description to add to this Release Order..."
                  value={itemSearch}
                  onChange={(e) => handleItemSearch(e.target.value)}
                  onFocus={() => itemSearch.trim() && setShowItemDropdown(true)}
                  className={inputCls}
                  autoComplete="off"
                />
                {showItemDropdown && itemSuggestions.length > 0 && (
                  <div className="absolute z-30 w-full mt-1 bg-white border-2 border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                    {itemSuggestions.slice(0, 6).map((item) => (
                      <button
                        key={item.item_code}
                        type="button"
                        onClick={() => addItem(item)}
                        className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                      >
                        <div className="font-bold text-sm text-slate-900">{item.item_code}</div>
                        <div className="text-xs text-slate-500">
                          {item.description} {item.drawing_number ? `&bull; DRW: ${item.drawing_number}` : ''}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

            {selectedItems.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-visible bg-white mt-4">
                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 rounded-t-xl flex justify-between items-center">
                    <span className="text-xs font-extrabold text-slate-500 uppercase tracking-widest">
                      Release Order Items List ({selectedItems.length})
                    </span>
                  </div>
                  <div className="space-y-4 p-4 bg-slate-50/50">
                    {selectedItems.map((item, index) => (
                      <React.Fragment key={item.item_code}>
                        <div
                          className="relative border-2 border-slate-200 rounded-xl transition-all duration-200 overflow-visible bg-white hover:border-red-500 hover:shadow-md"
                        >
                          <div className="flex flex-col lg:flex-row lg:items-center px-5 py-4 gap-6 transition-colors">
                            {/* Delete Button on Left */}
                            <button
                              type="button"
                              onClick={() => removeItem(item.item_code)}
                              className="text-red-600 hover:text-red-800 focus:outline-none shrink-0 cursor-pointer bg-transparent border-0 p-1.5 rounded hover:bg-red-50 transition-colors"
                              title="Remove Item"
                            >
                              <Trash2 size={20} />
                            </button>

                            {/* Details */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-bold text-base text-red-600">
                                  {item.item_code}
                                </span>
                                {item.drawing_number && (
                                  <span className="text-xs text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                                    DRW: {item.drawing_number}
                                  </span>
                                )}
                              </div>
                              {item.description && (
                                <p className="text-xs text-slate-400 mt-1 font-semibold">{item.description}</p>
                              )}
                            </div>

                            {/* Inputs (Quantity, Price, GST Search) */}
                            <div className="flex flex-wrap items-center gap-4 shrink-0">
                              {/* GST Category Autocomplete per item */}
                              <div className="flex flex-col items-center relative" ref={(el) => (gstRefs.current[item.item_code] = el)}>
                                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                                  GST Category
                                </label>
                                <input
                                  type="text"
                                  placeholder="Search GST (e.g. CGST 18%)"
                                  value={gstInputs[item.item_code] !== undefined ? gstInputs[item.item_code] : (item.gst_type || '')}
                                  onChange={(e) => handleItemGstInput(item.item_code, e.target.value)}
                                  onFocus={() => {
                                    // show all suggestions (or filtered) on focus
                                    const currentVal = gstInputs[item.item_code] !== undefined ? gstInputs[item.item_code] : (item.gst_type || '');
                                    const filtered = currentVal.trim()
                                      ? gstRatesList.filter(r => r.type.toLowerCase().includes(currentVal.toLowerCase()))
                                      : gstRatesList;
                                    setGstSuggestions(filtered);
                                    setActiveGstDropdown(item.item_code);
                                  }}
                                  className="w-44 px-2.5 py-1.5 text-center font-bold text-sm text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-red-500"
                                  autoComplete="off"
                                />
                                {activeGstDropdown === item.item_code && gstSuggestions.length > 0 && (
                                  <div className="absolute z-30 w-56 top-full mt-1 bg-white border-2 border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                                    {gstSuggestions.map((gst) => (
                                      <button
                                        key={gst.id}
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => selectItemGstCategory(item.item_code, gst)}
                                        className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                                      >
                                        <div className="font-bold text-xs text-slate-900">{gst.type}</div>
                                        <div className="text-[10px] text-slate-500">Rate: {parseFloat(gst.rate)}%</div>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="flex flex-col items-center">
                                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                                  Quantity
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => handleItemQtyChange(item.item_code, e.target.value)}
                                  className="w-24 px-2.5 py-1.5 text-center font-bold text-sm text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-red-500 disabled:bg-slate-50 disabled:text-slate-400"
                                />
                              </div>
                              <div className="flex flex-col items-center">
                                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                                  Price (₹)
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={item.unit_price}
                                  onChange={(e) => handleItemPriceChange(item.item_code, e.target.value)}
                                  className="w-28 px-2.5 py-1.5 text-center font-bold text-sm text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-red-500 disabled:bg-slate-50 disabled:text-slate-400"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Optional Section per item (Shipping Address & Special Delivery Date) */}
                          <div className="px-14 pb-4 bg-red-50/5 border-t border-red-100 rounded-b-xl">
                              {/* Buttons row */}
                              <div className="flex flex-wrap gap-4 mt-2">
                                {!item.showShipping && (
                                  <button
                                    type="button"
                                    onClick={() => toggleShipping(item.item_code)}
                                    className="text-xs font-bold text-red-700 hover:text-red-800 flex items-center gap-1 cursor-pointer bg-transparent border-0"
                                  >
                                    + Add Shipping Address (Optional)
                                  </button>
                                )}
                                {!item.showDeliveryDate && (
                                  <button
                                    type="button"
                                    onClick={() => toggleDeliveryDate(item.item_code)}
                                    className="text-xs font-bold text-red-700 hover:text-red-800 flex items-center gap-1 cursor-pointer bg-transparent border-0"
                                  >
                                    + Date of Delivery (Optional)
                                  </button>
                                )}
                              </div>

                              {/* Shipping Address Section */}
                              {item.showShipping && (
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
                                      className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-red-500 placeholder:text-slate-400 font-medium"
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

                              {/* Delivery Date Section */}
                              {item.showDeliveryDate && (
                                <div className="mt-3 bg-white p-3 rounded-lg border border-slate-200">
                                  <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs font-bold text-slate-700">Special Date of Delivery</label>
                                    <button
                                      type="button"
                                      onClick={() => toggleDeliveryDate(item.item_code)}
                                      className="text-xs text-red-500 hover:text-red-700 font-semibold cursor-pointer"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                  <input
                                    type="date"
                                    value={item.delivery_date || ''}
                                    onChange={(e) => handleItemDeliveryDateChange(item.item_code, e.target.value)}
                                    className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-red-500 font-medium"
                                  />
                                </div>
                              )}
                            </div>
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}
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
                      step="0.01"
                      min="0"
                      disabled
                      value={formData.gst}
                      className="w-full px-4 py-2.5 bg-slate-100 border border-slate-300 rounded-lg text-sm text-slate-500 cursor-not-allowed font-bold"
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
                      Gross Total RO Value
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
                      <RefreshCw size={18} className="animate-spin" /> Update Release Order
                    </>
                  ) : (
                    <>
                      <Plus size={18} /> Save Release Order
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
