import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Plus, RefreshCw, X, History } from 'lucide-react';
import { toast } from 'react-toastify';
import ItemQuoteHistory from '../components/ItemQuoteHistory.jsx';
import { useReceivedQuotation } from '../context/ReceivedQuotationContext.jsx';

const DEFAULT_TERMS = [
  "1. Price Validity: 30 days from date of quote.\n2. Delivery: 4-6 weeks after receipt of technically and commercially clear PO.\n3. Payment Terms: 30% advance with order, balance against delivery.\n4. Warranty: 12 months from dispatch.",
  "1. Payment Terms: Net 45 days.\n2. Price Basis: F.O.R. Shreeji Industries, taxes extra.\n3. Validity: This offer is valid for 15 days.\n4. Delivery: Within 2 weeks from PO.",
  "1. Delivery Terms: Ex-works, freight on to-pay basis.\n2. Payment: Net 30 days credit.\n3. Taxes & Duties: GST extra at actuals.\n4. Price Validity: 45 days from quote.",
  "1. Payment Terms: 50% advance along with order, 50% prior to dispatch.\n2. Delivery Period: 3 weeks from receipt of clear PO.\n3. Validity of Quote: 30 days.\n4. Unloading: In customer scope.",
  "1. Price: Firm and final, packing included.\n2. Payment: 100% within 30 days of dispatch.\n3. Validity: 60 days.\n4. Delivery: 1 week from order confirmation."
];

const labelCls = "block text-xs font-bold text-slate-700 uppercase mb-1.5";
const inputCls = "w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm placeholder:text-slate-400 font-medium focus:outline-none transition-colors duration-150 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed";

export default function ReceivedQuotationForm({ onNavigateAndOpenForm }) {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const queryTradeId = searchParams.get('trade_id');
  const editingNo = id || null;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nextRqNo, setNextRqNo] = useState('');

  const {
    activeRqId,
    setActiveRqId,
    formData,
    setFormData,
    selectedItems,
    setSelectedItems,
    buyerInput,
    setBuyerInput,
    customerInput,
    setCustomerInput,
    itemInput,
    setItemInput,
    historyItem,
    setHistoryItem,
    resetRqState
  } = useReceivedQuotation();

  // Buyer Autocomplete state
  const [buyerSuggestions, setBuyerSuggestions] = useState([]);
  const [showBuyerDropdown, setShowBuyerDropdown] = useState(false);
  const [buyerNotFound, setBuyerNotFound] = useState(false);

  // Customer Autocomplete state
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerNotFound, setCustomerNotFound] = useState(false);

  // Item Autocomplete state
  const [itemSuggestions, setItemSuggestions] = useState([]);
  const [showItemDropdown, setShowItemDropdown] = useState(false);

  const buyerRef = useRef(null);
  const customerRef = useRef(null);
  const itemRef = useRef(null);

  // Handle click outside dropdowns
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

  const fetchNextNo = async () => {
    try {
      const res = await fetch('/api/received-quotations/next-no');
      if (res.ok) {
        const data = await res.json();
        setNextRqNo(data.nextNo);
      }
    } catch (err) {
      console.error('Error fetching next received quotation no:', err);
    }
  };

  // Edit or Create mode selection
  useEffect(() => {
    if (activeRqId !== editingNo) {
      if (editingNo) {
        fetchQuotationDetails(editingNo);
      } else {
        resetRqState(null);
        fetchNextNo();
        const randomTerm = DEFAULT_TERMS[Math.floor(Math.random() * DEFAULT_TERMS.length)];
        setFormData(prev => ({
          ...prev,
          terms_and_conditions: randomTerm
        }));
      }
    }
  }, [editingNo, activeRqId]);

  // Debounced search for buyers (limit 5)
  useEffect(() => {
    const trimmed = buyerInput.trim();
    if (!trimmed || formData.buyer_id) {
      setBuyerSuggestions([]);
      setShowBuyerDropdown(false);
      setBuyerNotFound(false);
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      fetch(`/api/buyers?q=${encodeURIComponent(trimmed)}&limit=5`)
        .then(r => r.json())
        .then(data => {
          setBuyerSuggestions(data);
          setBuyerNotFound(data.length === 0);
          setShowBuyerDropdown(true);
        })
        .catch(console.error);
    }, 200);

    return () => clearTimeout(delayDebounceFn);
  }, [buyerInput, formData.buyer_id]);

  // Debounced search for customers (limit 5)
  useEffect(() => {
    const trimmed = customerInput.trim();
    if (!trimmed || formData.customer_id) {
      setCustomerSuggestions([]);
      setShowCustomerDropdown(false);
      setCustomerNotFound(false);
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      fetch(`/api/customers?q=${encodeURIComponent(trimmed)}&limit=5`)
        .then(r => r.json())
        .then(data => {
          setCustomerSuggestions(data);
          setCustomerNotFound(data.length === 0);
          setShowCustomerDropdown(true);
        })
        .catch(console.error);
    }, 200);

    return () => clearTimeout(delayDebounceFn);
  }, [customerInput, formData.customer_id]);

  // Debounced search for items (limit 5)
  useEffect(() => {
    const trimmed = itemInput.trim();
    if (!trimmed) {
      setItemSuggestions([]);
      setShowItemDropdown(false);
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      fetch(`/api/items?q=${encodeURIComponent(trimmed)}&limit=5`)
        .then(r => r.json())
        .then(data => {
          setItemSuggestions(data);
          setShowItemDropdown(true);
        })
        .catch(console.error);
    }, 200);

    return () => clearTimeout(delayDebounceFn);
  }, [itemInput]);

  const fetchQuotationDetails = async (rqNo) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/received-quotations/${encodeURIComponent(rqNo)}`);
      if (res.ok) {
        const data = await res.json();
        setActiveRqId(rqNo);
        setFormData({
          received_quotation_no: data.received_quotation_no,
          buyer_id: data.buyer_id || '',
          buyer_email: data.buyer_email || '',
          buyer_phone: data.buyer_phone || '',
          customer_id: data.customer_id || '',
          quotation_date: data.quotation_date ? data.quotation_date.split('T')[0] : '',
          terms_and_conditions: data.terms_and_conditions || ''
        });
        setSelectedItems(data.items || []);
        setBuyerInput(data.buyer_name || '');
        setCustomerInput(data.customer_name || '');
      } else {
        setError('Failed to fetch quotation details.');
      }
    } catch (err) {
      console.error('Error fetching quotation details:', err);
      setError('Connection error while fetching details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToDirectory = () => {
    if (queryTradeId) {
      navigate(`/trade/${queryTradeId}`);
    } else {
      navigate('/');
    }
  };

  const handleCancel = () => {
    resetRqState(undefined);
    if (queryTradeId) {
      navigate(`/trade/${queryTradeId}`);
    } else {
      navigate('/');
    }
  };

  const set = (field) => (e) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  };

  // Buyer Lookup Autocomplete
  const handleBuyerInput = (value) => {
    setBuyerInput(value);
    setFormData(prev => ({ ...prev, buyer_id: '', buyer_email: '', buyer_phone: '' }));
    if (!value.trim()) {
      setBuyerSuggestions([]);
      setShowBuyerDropdown(false);
      setBuyerNotFound(false);
    }
  };

  const selectBuyer = (b) => {
    setFormData(prev => ({
      ...prev,
      buyer_id: b.id,
      buyer_email: b.email || '',
      buyer_phone: b.phone || ''
    }));
    setBuyerInput(b.name);
    setShowBuyerDropdown(false);
    setBuyerNotFound(false);
  };

  // Customer Lookup Autocomplete
  const handleCustomerInput = (value) => {
    setCustomerInput(value);
    setFormData(prev => ({ ...prev, customer_id: '' }));
    if (!value.trim()) {
      setCustomerSuggestions([]);
      setShowCustomerDropdown(false);
      setCustomerNotFound(false);
    }
  };

  const selectCustomer = (c) => {
    setFormData(prev => ({ ...prev, customer_id: c.id }));
    setCustomerInput(c.name);
    setShowCustomerDropdown(false);
    setCustomerNotFound(false);
  };

  // Item Lookup Autocomplete
  const handleItemInput = (value) => {
    setItemInput(value);
    if (!value.trim()) {
      setItemSuggestions([]);
      setShowItemDropdown(false);
    }
  };

  const addItem = (item) => {
    if (selectedItems.some(i => i.item_code === item.item_code)) return;
    setSelectedItems(prev => [...prev, {
      item_code: item.item_code,
      description: item.description,
      drawing_number: item.drawing_number || '',
      long_description: item.long_description || '',
      quantity: 1,
      unit_price: 0
    }]);
    setItemInput('');
    setItemSuggestions([]);
    setShowItemDropdown(false);
  };

  const removeItem = (itemCode) => {
    setSelectedItems(prev => prev.filter(i => i.item_code !== itemCode));
  };

  const handleItemValueChange = (itemCode, key, val) => {
    setSelectedItems(prev => prev.map(item => {
      if (item.item_code === itemCode) {
        return { ...item, [key]: val };
      }
      return item;
    }));
  };

  const calculateBasicValue = (items) => {
    return items.reduce((sum, item) => sum + (parseFloat(item.unit_price) || 0) * (parseInt(item.quantity) || 0), 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);


    if (!formData.buyer_id) {
      setError('Please select a valid vendor Name.');
      setIsLoading(false);
      return;
    }
    if (!formData.customer_id) {
      setError('Please select a valid Seller vendor.');
      setIsLoading(false);
      return;
    }
    if (selectedItems.length === 0) {
      setError('Please add at least one item to the quotation.');
      setIsLoading(false);
      return;
    }

    const payload = {
      received_quotation_no: editingNo ? editingNo : formData.received_quotation_no,
      buyer_id: parseInt(formData.buyer_id),
      customer_id: formData.customer_id,
      quotation_date: formData.quotation_date,
      terms_and_conditions: formData.terms_and_conditions,
      items: selectedItems.map(item => ({
        item_code: item.item_code,
        quantity: parseInt(item.quantity) || 1,
        unit_price: parseFloat(item.unit_price) || 0
      }))
    };

    try {
      let res;
      if (editingNo) {
        res = await fetch(`/api/received-quotations/${encodeURIComponent(editingNo)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/received-quotations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        const data = await res.json();
        resetRqState(undefined);
        toast.success(`Received Quotation ${editingNo ? 'updated' : 'created'} successfully!`);
        const destTradeId = queryTradeId || data.trade_id;
        if (destTradeId) {
          navigate(`/trade/${destTradeId}`);
        } else {
          navigate('/');
        }
      } else {
        const errData = await res.json();
        setError(errData.error || 'Failed to save received quotation.');
      }
    } catch (err) {
      console.error(err);
      setError('Server connection error while saving quotation.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 p-6 bg-slate-100 text-slate-900 font-sans">
      <div className={historyItem ? "max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-6 items-start" : "max-w-2xl mx-auto space-y-5"}>
        <div className={historyItem ? "lg:col-span-3 space-y-5 flex flex-col w-full" : "space-y-5 flex flex-col w-full"}>
          <button
            type="button"
            onClick={handleBackToDirectory}
            className="mb-3 text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer bg-slate-200 hover:bg-slate-300 px-3 py-1.5 rounded-lg transition-colors self-start"
          >
          <ArrowLeft size={14} />
          Back
        </button>
        
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg flex items-center gap-1.5">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {/* ================================================================
            FORM VIEW
           ================================================================ */}
        <div className="pb-2 border-b border-slate-300">
          
          <h1 className="text-2xl font-bold text-slate-900 m-0">
            {editingNo ? 'Modify Received Quotation' : 'Create Received Quotation'}
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            {editingNo
              ? 'Update incoming commercial details and terms.'
              : 'Log a new incoming quotation proposal.'}
          </p>
        </div>

        <div className="bg-white border border-slate-300 rounded-lg p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-4">
              
              {/* Quotation No & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Quotation ID</label>
                  <input
                    type="text"
                    disabled={!!editingNo}
                    placeholder={nextRqNo ? `e.g. RQ-XXXX (Leave blank for ${nextRqNo})` : "Enter received quotation ID..."}
                    value={formData.received_quotation_no}
                    onChange={set('received_quotation_no')}
                    className={inputCls}
                    onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                    onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                  />
                  <p className="text-[10px] text-slate-400 font-semibold mt-1.5 pl-1">
                    {editingNo ? 'Reference ID cannot be modified.' : 'Leave blank to automatically generate Quotation ID.'}
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
                    onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                    onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                  />
                </div>
              </div>

              {/* Buyer Lookup */}
              <div ref={buyerRef} className="relative">
                <label className={labelCls}>Seller  <b className="text-red-500">*</b></label>
                <input
                  type="text"
                  required
                  placeholder="Search and select seller ..."
                  value={buyerInput}
                  onChange={(e) => handleBuyerInput(e.target.value)}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--theme-color)';
                    if (buyerInput.trim()) setShowBuyerDropdown(true);
                  }}
                  onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                  className={inputCls}
                  autoComplete="off"
                />
                {showBuyerDropdown && buyerSuggestions.length > 0 && (
                  <div className="absolute z-30 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                    {buyerSuggestions.slice(0, 6).map((b) => (
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
                      <span>No seller found for "{buyerInput}".</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/buyer/form')}
                      className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-[9px] transition-colors cursor-pointer uppercase tracking-wider"
                    >
                      Add SELLER
                    </button>
                  </div>
                )}
                {formData.buyer_id && (
                  <div className="mt-2 flex flex-wrap gap-2.5 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5">
                    <span className="text-emerald-600">✓ Seller vendor linked</span>
                    <span className="text-slate-300">|</span>
                    <span>{formData.buyer_email}</span>
                    <span className="text-slate-300">|</span>
                    <span>{formData.buyer_phone}</span>
                  </div>
                )}
              </div>

              {/* Customer Lookup */}
              <div ref={customerRef} className="relative">
                <label className={labelCls}>Party <b className="text-red-500">*</b></label>
                <input
                  type="text"
                  required
                  placeholder="Search and select seller vendor..."
                  value={customerInput}
                  onChange={(e) => handleCustomerInput(e.target.value)}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--theme-color)';
                    if (customerInput.trim()) setShowCustomerDropdown(true);
                  }}
                  onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                  className={inputCls}
                  autoComplete="off"
                />
                {showCustomerDropdown && customerSuggestions.length > 0 && (
                  <div className="absolute z-30 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                    {customerSuggestions.slice(0, 6).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selectCustomer(c)}
                        className="w-full text-left px-3.5 py-2 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                      >
                        <div className="font-bold text-xs text-slate-900">[{c.id}] {c.name}</div>
                        <div className="text-[10px] text-slate-500 truncate">{c.address}</div>
                      </button>
                    ))}
                  </div>
                )}
                {customerNotFound && (
                  <div className="mt-2 flex items-center justify-between gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs font-bold">
                    <div className="flex items-center gap-1.5">
                      <AlertCircle size={13} className="shrink-0" />
                      <span>No vendor found for "{customerInput}".</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/party/form')}
                      className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-[9px] transition-colors cursor-pointer uppercase tracking-wider"
                    >
                      Add VENDOR
                    </button>
                  </div>
                )}
                {formData.customer_id && (
                  <div className="mt-2 flex flex-wrap gap-2.5 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5">
                    <span className="text-emerald-600">✓ Customer linked</span>
                    <span className="text-slate-300">|</span>
                    <span>{customerInput}</span>
                  </div>
                )}
              </div>

              {/* Item Lookup */}
              <div>
                <label className={labelCls}>Items</label>

                {/* Selected Items List */}
                {selectedItems.length > 0 && (
                  <div className="mb-3 border border-slate-200 rounded overflow-hidden">
                    <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                      <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">
                        Attached Items ({selectedItems.length})
                      </span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {selectedItems.map((item) => (
                        <div key={item.item_code} className="px-4 py-3 bg-white hover:bg-slate-50 transition-colors">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono font-bold text-xs text-slate-900 border px-1.5 py-0.25 rounded" style={{ color: 'var(--theme-color)', borderColor: 'var(--theme-color)', backgroundColor: 'rgba(217, 53, 45, 0.05)' }}>
                                  {item.item_code}
                                </span>
                                {item.drawing_number && (
                                  <span className="text-[10px] text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                                    DRW: {item.drawing_number}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-600 font-semibold mt-1">{item.description}</p>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              {/* Quantity input */}
                              <div className="flex flex-col items-end">
                                <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5">
                                  Qty <b className="text-red-500">*</b>
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  required
                                  value={item.quantity}
                                  onChange={(e) => handleItemValueChange(item.item_code, 'quantity', e.target.value)}
                                  className="w-20 px-2 py-1 text-center font-bold text-xs text-slate-800 bg-white border border-slate-300 rounded focus:outline-none"
                                  onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                                  onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                                />
                              </div>

                              {/* Price input */}
                              <div className="flex flex-col items-end">
                                <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5">
                                  Price / Pc (₹) <b className="text-red-500">*</b>
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  required
                                  value={item.unit_price}
                                  onChange={(e) => handleItemValueChange(item.item_code, 'unit_price', e.target.value)}
                                  className="w-24 px-2 py-1 text-right font-bold text-xs text-slate-800 bg-white border border-slate-300 rounded focus:outline-none"
                                  onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                                  onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                                />
                              </div>

                              <button
                                type="button"
                                onClick={() => setHistoryItem(item.item_code)}
                                className="p-1.5 text-slate-400 hover:text-[var(--theme-color)] hover:bg-slate-50 rounded transition-colors cursor-pointer shrink-0"
                                title="View Quote History"
                              >
                                <History size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeItem(item.item_code)}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors cursor-pointer shrink-0"
                                title="Remove item"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>

                          {/* Inline history panel for mobile/small screen */}
                          {historyItem === item.item_code && (
                            <div className="block lg:hidden mt-3 p-4 bg-slate-50 border border-slate-300 rounded-lg space-y-4 animate-fade-in w-full">
                              <ItemQuoteHistory
                                code={historyItem}
                                onClose={() => setHistoryItem(null)}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Item Lookup input */}
                <div ref={itemRef} className="relative">
                  <input
                    type="text"
                    placeholder="Search item by code, short desc, or long desc..."
                    value={itemInput}
                    onChange={(e) => handleItemInput(e.target.value)}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'var(--theme-color)';
                      if (itemInput.trim()) setShowItemDropdown(true);
                    }}
                    onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                    className={inputCls}
                    autoComplete="off"
                  />
                  {showItemDropdown && itemSuggestions.length > 0 && (
                    <div className="absolute z-30 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg overflow-hidden max-h-56 overflow-y-auto">
                      {itemSuggestions.map((item) => (
                        <button
                          key={item.item_code}
                          type="button"
                          onClick={() => addItem(item)}
                          className="w-full text-left px-3.5 py-2 border-b border-slate-100 last:border-0 hover:bg-blue-50 transition-colors cursor-pointer"
                        >
                          <div className="font-bold text-xs text-slate-900 flex justify-between items-center">
                            <span className="font-mono font-bold" style={{ color: 'var(--theme-color)' }}>{item.item_code}</span>
                            {item.drawing_number && <span className="text-[10px] text-slate-400">DRW: {item.drawing_number}</span>}
                          </div>
                          <div className="text-xs text-slate-600 font-semibold mt-0.5">{item.description}</div>
                          {item.long_description && (
                            <div className="text-[9px] text-slate-400 mt-0.5 truncate">{item.long_description}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {itemInput.trim().length > 0 && itemSuggestions.length === 0 && (
                    <div className="mt-2 flex items-center justify-between gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs font-bold">
                      <div className="flex items-center gap-1.5">
                        <AlertCircle size={13} className="shrink-0" />
                        <span>No item found matching "{itemInput}".</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate('/item/form')}
                        className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-[9px] transition-colors cursor-pointer uppercase tracking-wider"
                      >
                        Add Item
                      </button>
                    </div>
                  )}
                </div>

                {/* Financial calculations */}
                {selectedItems.length > 0 && (
                  <div className="mt-3 bg-slate-50/50 border border-slate-200 rounded p-4 space-y-2">
                    <div className="font-bold text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200 pb-1.5">
                      Financial Calculations
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-col bg-white border border-slate-200 rounded p-2.5">
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">
                          Basic Value (Subtotal)
                        </span>
                        <span className="text-base font-bold text-slate-800 mt-0.5">
                          ₹{calculateBasicValue(selectedItems).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex flex-col bg-blue-50/30 border border-blue-100 rounded p-2.5">
                        <span className="text-[9px] font-extrabold text-red-500 uppercase tracking-widest">
                          Total Value
                        </span>
                        <span className="text-base font-black text-red-500 mt-0.5">
                          ₹{calculateBasicValue(selectedItems).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                {selectedItems.length === 0 && (
                  <p className="mt-2 text-xs text-slate-400 font-medium pl-1">
                    No items added yet. Search code or description below to attach items.
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
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm text-slate-900 focus:outline-none placeholder:text-slate-400 font-medium resize-none"
                  onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                  onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={handleCancel}
                className="px-5 py-2 border border-slate-300 hover:bg-slate-50 rounded text-xs font-bold uppercase text-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                style={{ backgroundColor: 'var(--theme-color)' }}
                onMouseEnter={(e) => e.target.style.filter = 'brightness(0.9)'}
                onMouseLeave={(e) => e.target.style.filter = 'none'}
                className="px-5 py-2 rounded text-xs font-bold uppercase text-white transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  'Processing...'
                ) : editingNo ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" /> Update Quotation
                  </>
                ) : (
                  <>
                    <Plus size={13} /> Save Quotation
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
        </div>

        {/* Right side history panel */}
        {historyItem && (
          <div className="hidden lg:block lg:col-span-2 bg-white border border-slate-300 rounded-lg p-5 shadow-sm space-y-4 animate-fade-in self-start lg:sticky lg:top-5 w-full">
            <ItemQuoteHistory
              code={historyItem}
              onClose={() => setHistoryItem(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
