import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Plus,
  RefreshCw,
  Search,
  X
} from 'lucide-react';

const EMPTY_FORM = {
  rfq_no: '',
  rfq_date: '',
  commercial_bid_due_date: '',
  technical_bid_due_date: '',
  buyer_id: '',
  buyer_email: '',
  buyer_phone: '',
  customer_id: ''
};

const labelCls = "block text-xs font-bold text-slate-700 uppercase mb-1.5";
const inputCls = "w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm placeholder:text-slate-400 font-medium focus:outline-none transition-colors duration-150 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed";

export default function RfqForm({ onNavigateAndOpenForm }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const editingRFQ = id || null;

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [selectedItems, setSelectedItems] = useState([]);
  const [tradeId, setTradeId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Auto-complete resources from DB
  const [buyers, setBuyers] = useState([]);
  const [customers, setCustomers] = useState([]);
  
  // Buyer Auto-complete state
  const [buyerInput, setBuyerInput] = useState('');
  const [buyerSuggestions, setBuyerSuggestions] = useState([]);
  const [showBuyerDropdown, setShowBuyerDropdown] = useState(false);
  const [buyerNotFound, setBuyerNotFound] = useState(false);

  // Customer Auto-complete state
  const [customerInput, setCustomerInput] = useState('');
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerNotFound, setCustomerNotFound] = useState(false);

  // Item Auto-complete state
  const [itemSearch, setItemSearch] = useState('');
  const [itemSuggestions, setItemSuggestions] = useState([]);
  const [showItemDropdown, setShowItemDropdown] = useState(false);

  // Dropdown reference refs for click outside
  const buyerRef = useRef(null);
  const customerRef = useRef(null);
  const itemRef = useRef(null);
  const isQuotateRedirectRef = useRef(false);

  const units = ['Piece', 'Kg', 'Meter', 'Box', 'Set', 'Liter', 'Ton', 'Nos'];

  // Load buyers, customers on mount
  useEffect(() => {
    fetchBuyers();
    fetchCustomers();
  }, []);

  // Fetch RFQ data if in edit mode
  useEffect(() => {
    if (editingRFQ) {
      fetchRFQDetails(editingRFQ);
    } else {
      setFormData(EMPTY_FORM);
      setSelectedItems([]);
      setBuyerInput('');
      setCustomerInput('');
      setTradeId('');
    }
  }, [editingRFQ]);

  // Handle click outside dropdowns to close them
  useEffect(() => {
    function handleClickOutside(event) {
      if (buyerRef.current && !buyerRef.current.contains(event.target)) {
        setShowBuyerDropdown(false);
      }
      if (customerRef.current && !customerRef.current.contains(event.target)) {
        setShowCustomerDropdown(false);
      }
      if (itemRef.current && !itemRef.current.contains(event.target)) {
        setShowItemDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchBuyers = async () => {
    try {
      const res = await fetch('/api/buyers');
      if (res.ok) {
        const data = await res.json();
        setBuyers(data);
      }
    } catch (err) {
      console.error('Error fetching buyers:', err);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
      }
    } catch (err) {
      console.error('Error fetching customers:', err);
    }
  };

  const fetchRFQDetails = async (rfqNo) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/rfqs/${encodeURIComponent(rfqNo)}`);
      if (res.ok) {
        const rfq = await res.json();
        setFormData({
          rfq_no: rfq.rfq_no || '',
          rfq_date: rfq.rfq_date ? rfq.rfq_date.split('T')[0] : '',
          commercial_bid_due_date: rfq.commercial_bid_due_date ? rfq.commercial_bid_due_date.split('T')[0] : '',
          technical_bid_due_date: rfq.technical_bid_due_date ? rfq.technical_bid_due_date.split('T')[0] : '',
          buyer_id: rfq.buyer_id || '',
          buyer_email: rfq.buyer_email || '',
          buyer_phone: rfq.buyer_phone || '',
          customer_id: rfq.customer_id || ''
        });
        setBuyerInput(rfq.buyer_name || '');
        setCustomerInput(rfq.customer_id || '');
        setSelectedItems(rfq.items || []);
        setTradeId(rfq.trade_id || '');
      } else {
        setError('Failed to fetch RFQ details');
      }
    } catch (err) {
      console.error(err);
      setError('Connection error while fetching RFQ');
    } finally {
      setIsLoading(false);
    }
  };

  const set = (field) => (e) =>
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  // Autocomplete Handlers
  const handleBuyerInput = (value) => {
    setBuyerInput(value);
    // Clear linked buyer details when input is edited
    setFormData(prev => ({ ...prev, buyer_id: '', buyer_email: '', buyer_phone: '' }));
    
    if (!value.trim()) {
      setBuyerSuggestions([]);
      setShowBuyerDropdown(false);
      setBuyerNotFound(false);
      return;
    }

    const matches = buyers.filter(b => b.name.toLowerCase().includes(value.toLowerCase()));
    setBuyerSuggestions(matches);
    setShowBuyerDropdown(true);
    setBuyerNotFound(matches.length === 0);
  };

  const selectBuyer = (b) => {
    setFormData(prev => ({
      ...prev,
      buyer_id: b.id,
      buyer_email: b.email,
      buyer_phone: b.phone
    }));
    setBuyerInput(b.name);
    setShowBuyerDropdown(false);
    setBuyerNotFound(false);
  };

  const handleCustomerInput = (value) => {
    setCustomerInput(value);
    setFormData(prev => ({ ...prev, customer_id: '' }));

    if (!value.trim()) {
      setCustomerSuggestions([]);
      setShowCustomerDropdown(false);
      setCustomerNotFound(false);
      return;
    }

    const matches = customers.filter(c => 
      c.id.toLowerCase().includes(value.toLowerCase()) || 
      c.name.toLowerCase().includes(value.toLowerCase())
    );
    setCustomerSuggestions(matches);
    setShowCustomerDropdown(true);
    setCustomerNotFound(matches.length === 0);
  };

  const selectCustomer = (c) => {
    setFormData(prev => ({ ...prev, customer_id: c.id }));
    setCustomerInput(c.id);
    setShowCustomerDropdown(false);
    setCustomerNotFound(false);
  };

  const handleItemSearch = async (value) => {
    setItemSearch(value);
    if (!value.trim()) {
      setItemSuggestions([]);
      setShowItemDropdown(false);
      return;
    }

    try {
      const res = await fetch(`/api/items?q=${encodeURIComponent(value)}`);
      if (res.ok) {
        const data = await res.json();
        setItemSuggestions(data);
        setShowItemDropdown(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const addItem = (item) => {
    // Check if item already selected
    if (selectedItems.some(i => i.item_code === item.item_code)) return;

    setSelectedItems(prev => [
      ...prev,
      {
        item_code: item.item_code,
        drawing_number: item.drawing_number || '',
        description: item.description || '',
        quantity: 1,
        unit: 'Piece'
      }
    ]);
    setItemSearch('');
    setItemSuggestions([]);
    setShowItemDropdown(false);
  };

  const removeItem = (itemCode) => {
    setSelectedItems(prev => prev.filter(i => i.item_code !== itemCode));
  };

  const handleQuantityChange = (itemCode, value) => {
    const qty = parseInt(value) || 1;
    setSelectedItems(prev => prev.map(i => i.item_code === itemCode ? { ...i, quantity: qty } : i));
  };

  const handleUnitChange = (itemCode, value) => {
    setSelectedItems(prev => prev.map(i => i.item_code === itemCode ? { ...i, unit: value } : i));
  };

  const backToList = () => {
    navigate('/');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.rfq_no.trim() || !formData.rfq_date || !formData.commercial_bid_due_date || !formData.technical_bid_due_date) {
      setError('Please fill in all required RFQ header fields');
      return;
    }

    if (!formData.buyer_id) {
      setError('Please select and link a valid Buyer');
      return;
    }

    if (!formData.customer_id) {
      setError('Please select and link a valid Customer');
      return;
    }

    if (selectedItems.length === 0) {
      setError('Please attach at least one Item to this RFQ');
      return;
    }

    setIsLoading(true);
    const payload = {
      rfq_no: formData.rfq_no.trim(),
      rfq_date: formData.rfq_date,
      commercial_bid_due_date: formData.commercial_bid_due_date,
      technical_bid_due_date: formData.technical_bid_due_date,
      buyer_id: parseInt(formData.buyer_id),
      customer_id: formData.customer_id,
      items: selectedItems.map(item => ({
        item_code: item.item_code,
        quantity: parseInt(item.quantity) || 1,
        unit: item.unit || 'Piece'
      }))
    };

    try {
      let res;
      if (editingRFQ) {
        res = await fetch(`/api/rfqs/${encodeURIComponent(editingRFQ)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/rfqs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        const resData = await res.json();
        const finalTradeId = editingRFQ ? tradeId : resData.trade_id;

        if (isQuotateRedirectRef.current) {
          alert('RFQ saved successfully! Redirecting (placeholder)...');
        } else {
          alert(`RFQ ${editingRFQ ? 'updated' : 'created'} successfully!`);
        }
        
        if (finalTradeId) {
          navigate(`/trade/${finalTradeId}`);
        } else {
          navigate('/');
        }
      } else {
        const errData = await res.json();
        setError(errData.error || `Failed to ${editingRFQ ? 'update' : 'create'} RFQ`);
      }
    } catch (err) {
      console.error(err);
      setError('Server connection error while saving RFQ');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 p-6 bg-slate-100 text-slate-900">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 m-0">
            {editingRFQ ? 'Modify RFQ Record' : 'New RFQ Entry'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {editingRFQ ? 'Update the details of an existing RFQ.' : 'Fill in the RFQ details below.'}
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg flex items-center gap-1.5">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {/* Form Card */}
        <div className="bg-white border border-slate-300 rounded-lg p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* RFQ No */}
            <div>
              <label className={labelCls}>RFQ No. <b className="text-red-500">*</b></label>
              <input
                type="text"
                required
                placeholder="e.g. RFQ-2024-001"
                value={formData.rfq_no}
                onChange={set('rfq_no')}
                disabled={!!editingRFQ}
                className={inputCls}
                onFocus={(e) => !editingRFQ && (e.target.style.borderColor = 'var(--theme-color)')}
                onBlur={(e) => !editingRFQ && (e.target.style.borderColor = 'rgb(203, 213, 225)')}
              />
              {editingRFQ && (
                <p className="text-[10px] text-slate-400 font-semibold mt-1 pl-1">
                  RFQ No. cannot be changed after creation.
                </p>
              )}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>RFQ Date <b className="text-red-500">*</b></label>
                <input
                  type="date"
                  required
                  value={formData.rfq_date}
                  onChange={set('rfq_date')}
                  className={inputCls}
                  onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                  onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                />
              </div>
              <div>
                <label className={labelCls}>Commercial Bid Due <b className="text-red-500">*</b></label>
                <input
                  type="date"
                  required
                  value={formData.commercial_bid_due_date}
                  onChange={set('commercial_bid_due_date')}
                  className={inputCls}
                  onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                  onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                />
              </div>
              <div>
                <label className={labelCls}>Technical Bid Due <b className="text-red-500">*</b></label>
                <input
                  type="date"
                  required
                  value={formData.technical_bid_due_date}
                  onChange={set('technical_bid_due_date')}
                  className={inputCls}
                  onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                  onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                />
              </div>
            </div>

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
                onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                autoComplete="off"
              />
              {showBuyerDropdown && buyerSuggestions.length > 0 && (
                <div className="absolute z-30 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                  {buyerSuggestions.slice(0, 6).map(b => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => selectBuyer(b)}
                      className="w-full text-left px-3.5 py-2 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                    >
                      <div className="font-bold text-xs text-slate-900">{b.name}</div>
                      <div className="text-[10px] text-slate-500">{b.email} &bull; {b.phone}</div>
                    </button>
                  ))}
                </div>
              )}
              {buyerNotFound && (
                <div className="mt-2 flex items-center justify-between gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs font-bold">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle size={13} className="shrink-0" />
                    <span>No buyer found for "{buyerInput}".</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (onNavigateAndOpenForm) onNavigateAndOpenForm('add-buyer');
                    }}
                    className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-[9px] transition-colors cursor-pointer uppercase tracking-wider"
                  >
                    Add Buyer
                  </button>
                </div>
              )}
              {formData.buyer_id && (
                <div className="mt-2 flex flex-wrap gap-2.5 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5">
                  <span className="text-emerald-600">✓ Buyer Linked</span>
                  <span className="text-slate-300">|</span>
                  <span>{formData.buyer_email}</span>
                  <span className="text-slate-300">|</span>
                  <span>{formData.buyer_phone}</span>
                </div>
              )}
            </div>

            {/* Customer */}
            <div ref={customerRef} className="relative">
              <label className={labelCls}>Customer ID <b className="text-red-500">*</b></label>
              <input
                type="text"
                placeholder="Start typing customer ID or name..."
                value={customerInput}
                onChange={(e) => handleCustomerInput(e.target.value)}
                onFocus={() => customerInput.trim() && setShowCustomerDropdown(true)}
                className={inputCls}
                onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                autoComplete="off"
              />
              {showCustomerDropdown && customerSuggestions.length > 0 && (
                <div className="absolute z-30 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                  {customerSuggestions.slice(0, 6).map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectCustomer(c)}
                      className="w-full text-left px-3.5 py-2 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                    >
                      <div className="font-bold text-xs text-slate-900">{c.id}</div>
                      <div className="text-[10px] text-slate-500">{c.name} &bull; {c.address}</div>
                    </button>
                  ))}
                </div>
              )}
              {customerNotFound && (
                <div className="mt-2 flex items-center justify-between gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs font-bold">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle size={13} className="shrink-0" />
                    <span>No customer found for "{customerInput}".</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (onNavigateAndOpenForm) onNavigateAndOpenForm('add-customer');
                    }}
                    className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-[9px] transition-colors cursor-pointer uppercase tracking-wider"
                  >
                    Add Customer
                  </button>
                </div>
              )}
              {formData.customer_id && customers.find(c => c.id === formData.customer_id) && (
                <div className="mt-2 flex flex-wrap gap-2.5 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5">
                  <span className="text-emerald-600">✓ Customer Linked</span>
                  <span className="text-slate-300">|</span>
                  <span>{customers.find(c => c.id === formData.customer_id)?.name}</span>
                </div>
              )}
            </div>

            {/* Items Section */}
            <div>
              <label className={labelCls}>Items</label>

              {/* Item search autocomplete */}
              <div ref={itemRef} className="relative">
                <input
                  type="text"
                  placeholder="Search item by code or description to attach..."
                  value={itemSearch}
                  onChange={(e) => handleItemSearch(e.target.value)}
                  onFocus={() => itemSearch.trim() && setShowItemDropdown(true)}
                  className={inputCls}
                  onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                  onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                  autoComplete="off"
                />

                {showItemDropdown && itemSuggestions.filter(item => !selectedItems.some(i => i.item_code === item.item_code)).length > 0 && (
                  <div className="absolute z-30 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                    {itemSuggestions.filter(item => !selectedItems.some(i => i.item_code === item.item_code)).map(item => (
                      <button
                        key={item.item_code}
                        type="button"
                        onClick={() => addItem(item)}
                        className="w-full text-left px-3.5 py-2 border-b border-slate-100 last:border-0 hover:bg-blue-50 transition-colors cursor-pointer"
                      >
                        <div>
                          <span className="font-mono font-bold text-xs text-slate-900 border px-1.5 py-0.25 rounded" style={{ color: 'var(--theme-color)', borderColor: 'var(--theme-color)', backgroundColor: 'rgba(217, 53, 45, 0.05)' }}>
                            {item.item_code}
                          </span>
                          {item.drawing_number && <span className="text-[10px] text-slate-400 ml-2">DRW: {item.drawing_number}</span>}
                          <div className="text-[10px] text-slate-500 mt-1">{item.description}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {itemSearch.trim().length > 0 && itemSuggestions.length === 0 && (
                  <div className="mt-2 flex items-center justify-between gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs font-bold">
                    <div className="flex items-center gap-1.5">
                      <AlertCircle size={13} className="shrink-0" />
                      <span>No item found for "{itemSearch}".</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (onNavigateAndOpenForm) onNavigateAndOpenForm('add-item');
                      }}
                      className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-[9px] transition-colors cursor-pointer uppercase tracking-wider"
                    >
                      Add Item
                    </button>
                  </div>
                )}
              </div>

              {/* Selected Items */}
              {selectedItems.length > 0 && (
                <div className="mt-3 border border-slate-300 rounded-lg overflow-hidden bg-slate-50">
                  <div className="bg-slate-100 px-4 py-2 border-b border-slate-300">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Attached Items ({selectedItems.length})
                    </span>
                  </div>
                  <div className="divide-y divide-slate-200">
                    {selectedItems.map((item) => (
                      <div key={item.item_code} className="flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 transition-colors">
                        <div className="min-w-0 flex-1 mr-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-xs text-slate-900 border px-1.5 py-0.25 rounded" style={{ color: 'var(--theme-color)', borderColor: 'var(--theme-color)', backgroundColor: 'rgba(217, 53, 45, 0.05)' }}>
                              {item.item_code}
                            </span>
                            {item.drawing_number && (
                              <span className="text-[10px] text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.25 rounded">
                                DRW: {item.drawing_number}
                              </span>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-[10px] text-slate-500 mt-1 truncate">{item.description}</p>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="flex flex-col items-end">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Qty *</label>
                            <input
                              type="number"
                              min="1"
                              required
                              value={item.quantity}
                              onChange={(e) => handleQuantityChange(item.item_code, e.target.value)}
                              className="w-16 px-1.5 py-1 text-center font-bold text-xs text-slate-800 bg-white border border-slate-300 rounded focus:outline-none focus:border-[var(--theme-color)]"
                            />
                          </div>
                          <div className="flex flex-col items-end">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Unit *</label>
                            <input
                              type="text"
                              list="rfq-units-list"
                              required
                              placeholder="e.g. Piece"
                              value={item.unit || ''}
                              onChange={(e) => handleUnitChange(item.item_code, e.target.value)}
                              className="w-20 px-1.5 py-1 text-center font-bold text-xs text-slate-800 bg-white border border-slate-300 rounded focus:outline-none focus:border-[var(--theme-color)]"
                              autoComplete="off"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeItem(item.item_code)}
                            className="p-1 mt-3.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer shrink-0"
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

            {/* Action Buttons */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
              {!editingRFQ && (
                <button
                  type="submit"
                  onClick={() => { isQuotateRedirectRef.current = true; }}
                  disabled={isLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-semibold text-sm text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save &amp; Quotate
                </button>
              )}
              <button
                type="submit"
                onClick={() => { isQuotateRedirectRef.current = false; }}
                disabled={isLoading}
                className="px-4 py-2 rounded-lg font-semibold text-sm text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: 'var(--theme-color)' }}
                onMouseEnter={(e) => e.target.style.filter = 'brightness(0.9)'}
                onMouseLeave={(e) => e.target.style.filter = 'none'}
              >
                {isLoading ? (
                  <><RefreshCw size={14} className="animate-spin" /> Processing...</>
                ) : editingRFQ ? (
                  <><RefreshCw size={14} /> Update RFQ</>
                ) : (
                  <><Plus size={14} /> Save RFQ</>
                )}
              </button>
            </div>

          </form>
        </div>
      </div>

      <datalist id="rfq-units-list">
        {units.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
    </div>
  );
}
