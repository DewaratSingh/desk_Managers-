import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Plus, RefreshCw, X, History, Cpu } from 'lucide-react';
import { toast } from 'react-toastify';
import ItemQuoteHistory from '../components/ItemQuoteHistory.jsx';

const DEFAULT_TERMS = [
  "1. Price Validity: 30 days from date of offer.\n2. Processing Time: 1-2 weeks after receipt of items.\n3. Payment Terms: Net 30 days.\n4. Quality Standard: Inspection as per approved drawing parameters.",
  "1. Payment Terms: Net 45 days.\n2. Delivery Basis: F.O.R. Customer Site.\n3. Offer Validity: 15 days.\n4. Processing Scope: Machining & Coating as specified."
];

const labelCls = "block text-xs font-bold text-slate-700 uppercase mb-1.5";
const inputCls = "w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm placeholder:text-slate-400 font-medium focus:outline-none transition-colors duration-150 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed";

export default function ProcessQuotationForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const queryTradeId = searchParams.get('trade_id');
  const editingNo = id || null;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nextPrqNo, setNextPrqNo] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    received_quotation_no: '',
    buyer_id: '',
    buyer_email: '',
    buyer_phone: '',
    customer_id: '',
    quotation_date: new Date().toISOString().split('T')[0],
    terms_and_conditions: '',
    delivery_charges: 0,
    packing_forwarding: 0,
    gst: 0,
    other_charges: 0
  });

  const [selectedItems, setSelectedItems] = useState([]);
  const [buyerInput, setBuyerInput] = useState('');
  const [customerInput, setCustomerInput] = useState('');
  const [itemInput, setItemInput] = useState('');
  const [historyItem, setHistoryItem] = useState(null);

  // Autocomplete states
  const [buyerSuggestions, setBuyerSuggestions] = useState([]);
  const [showBuyerDropdown, setShowBuyerDropdown] = useState(false);
  const [buyerNotFound, setBuyerNotFound] = useState(false);

  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerNotFound, setCustomerNotFound] = useState(false);

  const [itemSuggestions, setItemSuggestions] = useState([]);
  const [showItemDropdown, setShowItemDropdown] = useState(false);

  const buyerRef = useRef(null);
  const customerRef = useRef(null);
  const itemRef = useRef(null);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event) {
      if (buyerRef.current && !buyerRef.current.contains(event.target)) setShowBuyerDropdown(false);
      if (customerRef.current && !customerRef.current.contains(event.target)) setShowCustomerDropdown(false);
      if (itemRef.current && !itemRef.current.contains(event.target)) setShowItemDropdown(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    fetchNextNo();
    const randomTerm = DEFAULT_TERMS[Math.floor(Math.random() * DEFAULT_TERMS.length)];
    setFormData(prev => ({ ...prev, terms_and_conditions: randomTerm }));

    if (editingNo) {
      fetchQuotationDetails(editingNo);
    }
  }, [editingNo]);

  const fetchNextNo = async () => {
    try {
      const res = await fetch('/api/process-quotations/next-no');
      if (res.ok) {
        const data = await res.json();
        setNextPrqNo(data.nextNo);
      }
    } catch (err) {
      console.error('Error fetching next process quotation no:', err);
    }
  };

  const fetchQuotationDetails = async (prqNo) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/process-quotations/${encodeURIComponent(prqNo)}`);
      if (res.ok) {
        const data = await res.json();
        setFormData({
          received_quotation_no: data.received_quotation_no,
          buyer_id: data.buyer_id || '',
          buyer_email: data.buyer_email || '',
          buyer_phone: data.buyer_phone || '',
          customer_id: data.customer_id || '',
          quotation_date: data.quotation_date ? data.quotation_date.split('T')[0] : '',
          terms_and_conditions: data.terms_and_conditions || '',
          delivery_charges: data.delivery_charges || 0,
          packing_forwarding: data.packing_forwarding || 0,
          gst: data.gst || 0,
          other_charges: data.other_charges || 0
        });
        setSelectedItems(data.items || []);
        setBuyerInput(data.buyer_name || '');
        setCustomerInput(data.customer_name || '');
      } else {
        setError('Failed to fetch process quotation details.');
      }
    } catch (err) {
      console.error('Error fetching process quotation:', err);
      setError('Connection error while fetching details.');
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced search for buyers (sellers/vendors)
  useEffect(() => {
    const trimmed = buyerInput.trim();
    if (!trimmed || formData.buyer_id) {
      setBuyerSuggestions([]);
      setShowBuyerDropdown(false);
      setBuyerNotFound(false);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/buyers?q=${encodeURIComponent(trimmed)}&limit=5`)
        .then(r => r.json())
        .then(data => {
          setBuyerSuggestions(data);
          setBuyerNotFound(data.length === 0);
          setShowBuyerDropdown(true);
        })
        .catch(console.error);
    }, 200);
    return () => clearTimeout(timer);
  }, [buyerInput, formData.buyer_id]);

  // Debounced search for customers
  useEffect(() => {
    const trimmed = customerInput.trim();
    if (!trimmed || formData.customer_id) {
      setCustomerSuggestions([]);
      setShowCustomerDropdown(false);
      setCustomerNotFound(false);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/customers?q=${encodeURIComponent(trimmed)}&limit=5`)
        .then(r => r.json())
        .then(data => {
          setCustomerSuggestions(data);
          setCustomerNotFound(data.length === 0);
          setShowCustomerDropdown(true);
        })
        .catch(console.error);
    }, 200);
    return () => clearTimeout(timer);
  }, [customerInput, formData.customer_id]);

  // Debounced search for items (all master catalog items)
  useEffect(() => {
    const trimmed = itemInput.trim();
    if (!trimmed) {
      setItemSuggestions([]);
      setShowItemDropdown(false);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/items?q=${encodeURIComponent(trimmed)}&limit=10`)
        .then(r => r.json())
        .then(data => {
          setItemSuggestions(data);
          setShowItemDropdown(true);
        })
        .catch(console.error);
    }, 200);
    return () => clearTimeout(timer);
  }, [itemInput]);

  const handleBuyerInput = (value) => {
    setBuyerInput(value);
    setFormData(prev => ({ ...prev, buyer_id: '', buyer_email: '', buyer_phone: '' }));
    if (!value.trim()) setBuyerSuggestions([]);
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

  const handleCustomerInput = (value) => {
    setCustomerInput(value);
    setFormData(prev => ({ ...prev, customer_id: '' }));
    if (!value.trim()) setCustomerSuggestions([]);
  };

  const selectCustomer = (c) => {
    setFormData(prev => ({ ...prev, customer_id: c.id }));
    setCustomerInput(c.name);
    setShowCustomerDropdown(false);
    setCustomerNotFound(false);
  };

  const addItem = (item) => {
    if (selectedItems.some(i => i.item_code === item.item_code)) return;
    setSelectedItems(prev => [...prev, {
      item_code: item.item_code,
      description: item.description,
      drawing_number: item.drawing_number || '',
      process_name: '',
      expected_output_code: item.item_code, // Default same as item code
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

  const calculateBasicValue = () => {
    return selectedItems.reduce((sum, item) => sum + (parseFloat(item.unit_price) || 0) * (parseInt(item.quantity) || 0), 0);
  };

  const calculateTotalValue = () => {
    const basic = calculateBasicValue();
    const delivery = parseFloat(formData.delivery_charges) || 0;
    const packing = parseFloat(formData.packing_forwarding) || 0;
    const gst = parseFloat(formData.gst) || 0;
    const other = parseFloat(formData.other_charges) || 0;
    return basic + delivery + packing + gst + other;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!formData.buyer_id) {
      setError('Please select a valid Process Vendor / Seller.');
      setIsLoading(false);
      return;
    }
    if (!formData.customer_id) {
      setError('Please select a valid Party vendor.');
      setIsLoading(false);
      return;
    }
    if (selectedItems.length === 0) {
      setError('Please add at least one item to the process quotation.');
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
        process_name: item.process_name || '',
        expected_output_code: item.expected_output_code && item.expected_output_code.trim() ? item.expected_output_code.trim() : item.item_code,
        quantity: parseInt(item.quantity) || 1,
        unit_price: parseFloat(item.unit_price) || 0
      }))
    };

    try {
      let res;
      if (editingNo) {
        res = await fetch(`/api/process-quotations/${encodeURIComponent(editingNo)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/process-quotations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        const data = await res.json();
        toast.success(`Process Quotation ${editingNo ? 'updated' : 'created'} successfully!`);
        const destTradeId = queryTradeId || data.trade_id;
        if (destTradeId) {
          navigate(`/trade/${encodeURIComponent(destTradeId)}`);
        } else {
          navigate('/dashboard');
        }
      } else {
        const errData = await res.json();
        setError(errData.error || 'Failed to save process quotation.');
      }
    } catch (err) {
      console.error(err);
      setError('Server connection error while saving quotation.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 p-6 bg-slate-100 text-slate-900 font-sans min-h-screen">
      <div className={historyItem ? "max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-6 items-start" : "max-w-3xl mx-auto space-y-5"}>
        <div className={historyItem ? "lg:col-span-3 space-y-5 flex flex-col w-full" : "space-y-5 flex flex-col w-full"}>
          
          <button
            type="button"
            onClick={() => queryTradeId ? navigate(`/trade/${queryTradeId}`) : navigate('/dashboard')}
            className="mb-1 text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer bg-slate-200 hover:bg-slate-300 px-3 py-1.5 rounded-lg transition-colors self-start"
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </button>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg flex items-center gap-1.5">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {/* Form Header */}
          <div className="pb-2 border-b border-slate-300">
            <h1 className="text-2xl font-black text-slate-950 m-0 flex items-center gap-2">
              <Cpu size={24} className="text-amber-600" />
              {editingNo ? 'Modify Process Quotation' : 'Create Receive Quotation for Process'}
            </h1>
            <p className="text-xs text-slate-500 mt-1 font-semibold">
              Log incoming manufacturing process quotation proposal and create process trade.
            </p>
          </div>

          <div className="bg-white border border-slate-300 rounded-xl p-6 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* Process Quotation ID & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Process Quotation ID</label>
                  <input
                    type="text"
                    disabled={!!editingNo}
                    placeholder={nextPrqNo ? `e.g. PRQ-XXXX (Leave blank for ${nextPrqNo})` : "Enter process quotation ID..."}
                    value={formData.received_quotation_no}
                    onChange={(e) => setFormData(prev => ({ ...prev, received_quotation_no: e.target.value }))}
                    className={inputCls}
                    onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                    onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                  />
                  <p className="text-[10px] text-slate-400 font-semibold mt-1 pl-1">
                    {editingNo ? 'ID cannot be modified.' : 'Leave blank to auto-generate process quotation ID.'}
                  </p>
                </div>
                <div>
                  <label className={labelCls}>Quotation Date <b className="text-red-500">*</b></label>
                  <input
                    type="date"
                    required
                    value={formData.quotation_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, quotation_date: e.target.value }))}
                    className={inputCls}
                    onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                    onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                  />
                </div>
              </div>

              {/* Vendor / Seller Lookup */}
              <div ref={buyerRef} className="relative">
                <label className={labelCls}>Process Vendor / Seller <b className="text-red-500">*</b></label>
                <input
                  type="text"
                  required
                  placeholder="Search and select vendor for process..."
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
                        className="w-full text-left px-3.5 py-2 hover:bg-amber-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
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
                      <span>No vendor found for "{buyerInput}".</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/buyer/form')}
                      className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-[9px] transition-colors cursor-pointer uppercase tracking-wider"
                    >
                      Add Vendor
                    </button>
                  </div>
                )}
                {formData.buyer_id && (
                  <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5">
                    <span className="text-emerald-600">✓ Vendor linked</span>
                    <span className="text-slate-300">|</span>
                    <span>{formData.buyer_email}</span>
                    <span className="text-slate-300">|</span>
                    <span>{formData.buyer_phone}</span>
                  </div>
                )}
              </div>

              {/* Customer / Party Lookup */}
              <div ref={customerRef} className="relative">
                <label className={labelCls}>Party <b className="text-red-500">*</b></label>
                <input
                  type="text"
                  required
                  placeholder="Search and select party..."
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
                        className="w-full text-left px-3.5 py-2 hover:bg-amber-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
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
                      <span>No party found for "{customerInput}".</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/party/form')}
                      className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-[9px] transition-colors cursor-pointer uppercase tracking-wider"
                    >
                      Add Party
                    </button>
                  </div>
                )}
              </div>

              {/* Items Selection */}
              <div>
                <label className={labelCls}>Process Items</label>

                {/* Selected Process Items List */}
                {selectedItems.length > 0 && (
                  <div className="mb-3 border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                    <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                      <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">
                        Items for Process ({selectedItems.length})
                      </span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {selectedItems.map((item) => (
                        <div key={item.item_code} className="p-4 bg-white space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-black text-xs text-slate-900 border px-1.5 py-0.5 rounded bg-slate-100">
                                  {item.item_code}
                                </span>
                                {item.drawing_number && (
                                  <span className="text-[10px] text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                                    DRW: {item.drawing_number}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-700 font-semibold mt-1 m-0">{item.description}</p>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setHistoryItem(item.item_code)}
                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                title="View Quote History"
                              >
                                <History size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeItem(item.item_code)}
                                className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                title="Remove item"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>

                          {/* Process Name & Output Code Inputs */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50/70 border border-slate-200 p-3 rounded-lg">
                            <div>
                              <label className="block text-[9px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                                Process Name <b className="text-red-500">*</b>
                              </label>
                              <input
                                type="text"
                                required
                                placeholder="e.g. Anodizing, Machining"
                                value={item.process_name || ''}
                                onChange={(e) => handleItemValueChange(item.item_code, 'process_name', e.target.value)}
                                className="w-full px-2 py-1 text-xs border border-slate-300 rounded font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[9px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                                Output Item Code (Optional)
                              </label>
                              <input
                                type="text"
                                placeholder={`Same as ${item.item_code}`}
                                value={item.expected_output_code || ''}
                                onChange={(e) => handleItemValueChange(item.item_code, 'expected_output_code', e.target.value)}
                                className="w-full px-2 py-1 text-xs border border-slate-300 rounded font-semibold text-slate-800 focus:outline-none focus:border-amber-500 font-mono"
                              />
                            </div>

                            <div>
                              <label className="block text-[9px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                                Qty <b className="text-red-500">*</b>
                              </label>
                              <input
                                type="number"
                                min="1"
                                required
                                value={item.quantity}
                                onChange={(e) => handleItemValueChange(item.item_code, 'quantity', e.target.value)}
                                className="w-full px-2 py-1 text-xs border border-slate-300 rounded font-bold text-slate-800 text-right focus:outline-none focus:border-amber-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[9px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                                Price / Pc (₹) <b className="text-red-500">*</b>
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                required
                                value={item.unit_price}
                                onChange={(e) => handleItemValueChange(item.item_code, 'unit_price', e.target.value)}
                                className="w-full px-2 py-1 text-xs border border-slate-300 rounded font-bold text-slate-800 text-right focus:outline-none focus:border-amber-500"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Item Search Input (Searches all catalog items) */}
                <div ref={itemRef} className="relative">
                  <input
                    type="text"
                    placeholder="Search item code, short desc, or drawing no to process..."
                    value={itemInput}
                    onChange={(e) => setItemInput(e.target.value)}
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
                          className="w-full text-left px-3.5 py-2.5 border-b border-slate-100 last:border-0 hover:bg-amber-50 transition-colors cursor-pointer"
                        >
                          <div className="font-bold text-xs text-slate-900 flex justify-between items-center">
                            <span className="font-mono font-bold text-amber-700">{item.item_code}</span>
                            {item.drawing_number && <span className="text-[10px] text-slate-400 font-mono">DRW: {item.drawing_number}</span>}
                          </div>
                          <div className="text-xs text-slate-600 font-semibold mt-0.5">{item.description}</div>
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

                {/* Additional Price Options & Totals */}
                {selectedItems.length > 0 && (
                  <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="font-bold text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200 pb-2">
                      Pricing & Additional Cost Options
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[9px] font-extrabold text-slate-500 uppercase mb-1">Delivery Charges</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.delivery_charges}
                          onChange={(e) => setFormData(prev => ({ ...prev, delivery_charges: e.target.value }))}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded font-bold text-right focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-extrabold text-slate-500 uppercase mb-1">Packing &amp; Forwarding</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.packing_forwarding}
                          onChange={(e) => setFormData(prev => ({ ...prev, packing_forwarding: e.target.value }))}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded font-bold text-right focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-extrabold text-slate-500 uppercase mb-1">GST Amount</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.gst}
                          onChange={(e) => setFormData(prev => ({ ...prev, gst: e.target.value }))}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded font-bold text-right focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-extrabold text-slate-500 uppercase mb-1">Other Charges</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.other_charges}
                          onChange={(e) => setFormData(prev => ({ ...prev, other_charges: e.target.value }))}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded font-bold text-right focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                      <div className="flex flex-col bg-white border border-slate-200 rounded p-2.5">
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Basic Value</span>
                        <span className="text-base font-bold text-slate-800 mt-0.5">
                          ₹{calculateBasicValue().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex flex-col bg-amber-50 border border-amber-200 rounded p-2.5">
                        <span className="text-[9px] font-extrabold text-amber-800 uppercase tracking-widest">Total Value</span>
                        <span className="text-base font-black text-amber-900 mt-0.5">
                          ₹{calculateTotalValue().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Terms & Conditions */}
              <div>
                <label className={labelCls}>Terms &amp; Conditions</label>
                <textarea
                  rows={3}
                  placeholder="Add processing terms, warranty, lead time details..."
                  value={formData.terms_and_conditions}
                  onChange={(e) => setFormData(prev => ({ ...prev, terms_and_conditions: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none placeholder:text-slate-400 font-medium resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="px-5 py-2 border border-slate-300 hover:bg-slate-50 rounded-lg text-xs font-bold uppercase text-slate-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  style={{ backgroundColor: 'var(--theme-color)' }}
                  onMouseEnter={(e) => e.target.style.filter = 'brightness(0.9)'}
                  onMouseLeave={(e) => e.target.style.filter = 'none'}
                  className="px-5 py-2 rounded-lg text-xs font-bold uppercase text-white transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isLoading ? (
                    <><RefreshCw size={13} className="animate-spin" /> Saving...</>
                  ) : (
                    <><Plus size={13} /> Save Process Quotation</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* History Sidebar */}
        {historyItem && (
          <div className="hidden lg:block lg:col-span-2 sticky top-6">
            <ItemQuoteHistory code={historyItem} onClose={() => setHistoryItem(null)} />
          </div>
        )}
      </div>
    </div>
  );
}
