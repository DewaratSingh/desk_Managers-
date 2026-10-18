import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Plus, RefreshCw, X, History } from 'lucide-react';
import { toast } from 'react-toastify';
import ItemQuoteHistory from '../../components/ItemQuoteHistory.jsx';

const labelCls = "block text-xs font-bold text-slate-700 uppercase mb-1.5";
const inputCls = "w-full px-3 py-2  bg-[white] border border-slate-300 rounded text-sm placeholder:text-slate-400 font-medium focus:outline-none transition-colors duration-150 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed";

const INITIAL_FORM = {
  quotation_number: '',
  quotation_date: '',
  commercial_bid_due_date: '',
  technical_bid_due_date: '',
  buyer_id: '',
  buyer_email: '',
  buyer_phone: '',
  customer_id: '',
  customer_name: ''
};

const COMMON_PROCESSES = [
  'Machining',
  'CNC Milling',
  'Turning',
  'Drilling',
  'Grinding',
  'Coating',
  'Plating',
  'Galvanizing',
  'Heat Treatment',
  'Welding',
  'Cutting',
  'Bending',
  'Threading',
  'Boring',
  'Polishing',
  'Assembly',
  'Surface Finishing',
  'Forging',
  'Stamping',
  'Quality Inspection'
];

export default function CreateProcessReceivedQuotationForm() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState(INITIAL_FORM);
  const [selectedItems, setSelectedItems] = useState([]);
  const [buyerInput, setBuyerInput] = useState('');
  const [customerInput, setCustomerInput] = useState('');
  const [itemSearch, setItemSearch] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [historyItem, setHistoryItem] = useState(null);

  // Autocomplete resources from DB
  const [buyerSuggestions, setBuyerSuggestions] = useState([]);
  const [showBuyerDropdown, setShowBuyerDropdown] = useState(false);
  const [buyerNotFound, setBuyerNotFound] = useState(false);

  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerNotFound, setCustomerNotFound] = useState(false);

  const [itemSuggestions, setItemSuggestions] = useState([]);
  const [showItemDropdown, setShowItemDropdown] = useState(false);

  // Dropdown reference refs for click outside
  const buyerRef = useRef(null);
  const customerRef = useRef(null);
  const itemRef = useRef(null);

  const buyerManualRef = useRef(false);
  const customerManualRef = useRef(false);

  // Close dropdowns when clicking outside
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

  const fetchBuyers = (query) => {
    fetch(`/api/buyers?q=${encodeURIComponent(query)}&limit=5`)
      .then(r => r.json())
      .then(data => {
        setBuyerSuggestions(Array.isArray(data) ? data : []);
        setBuyerNotFound(Array.isArray(data) && data.length === 0);
      })
      .catch(console.error);
  };

  const fetchCustomers = (query) => {
    fetch(`/api/customers?q=${encodeURIComponent(query)}&limit=5`)
      .then(r => r.json())
      .then(data => {
        setCustomerSuggestions(Array.isArray(data) ? data : []);
        setCustomerNotFound(Array.isArray(data) && data.length === 0);
      })
      .catch(console.error);
  };

  const fetchItems = (query) => {
    fetch(`/api/items?q=${encodeURIComponent(query)}&limit=5`)
      .then(r => r.json())
      .then(data => {
        setItemSuggestions(Array.isArray(data) ? data : []);
      })
      .catch(console.error);
  };

  // Debounced search for buyers
  useEffect(() => {
    if (!buyerManualRef.current) return;
    const delayDebounceFn = setTimeout(() => {
      fetchBuyers(buyerInput.trim());
    }, 200);
    return () => clearTimeout(delayDebounceFn);
  }, [buyerInput]);

  // Debounced search for customers
  useEffect(() => {
    if (!customerManualRef.current) return;
    const delayDebounceFn = setTimeout(() => {
      fetchCustomers(customerInput.trim());
    }, 200);
    return () => clearTimeout(delayDebounceFn);
  }, [customerInput]);

  // Debounced search for items
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchItems(itemSearch.trim());
    }, 200);
    return () => clearTimeout(delayDebounceFn);
  }, [itemSearch]);

  const setField = (field) => (e) =>
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  // Autocomplete Handlers
  const handleBuyerInput = (value) => {
    buyerManualRef.current = true;
    setBuyerInput(value);
    setFormData(prev => ({ ...prev, buyer_id: '', buyer_email: '', buyer_phone: '' }));
    setShowBuyerDropdown(true);
  };

  const selectBuyer = (b) => {
    buyerManualRef.current = false;
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
    customerManualRef.current = true;
    setCustomerInput(value);
    setFormData(prev => ({ ...prev, customer_id: '', customer_name: '' }));
    setShowCustomerDropdown(true);
  };

  const selectCustomer = (c) => {
    customerManualRef.current = false;
    setFormData(prev => ({
      ...prev,
      customer_id: c.customer_code || c.id,
      customer_name: c.name
    }));
    setCustomerInput(c.customer_code || c.id);
    setShowCustomerDropdown(false);
    setCustomerNotFound(false);
  };

  const handleItemSearch = (value) => {
    setItemSearch(value);
    setShowItemDropdown(true);
  };

  const addItem = (item) => {
    if (selectedItems.some(i => i.item_code === item.item_code)) return;

    setSelectedItems(prev => [
      ...prev,
      {
        item_code: item.item_code,
        drawing_number: item.drawing_number || '',
        description: item.description || '',
        process_name: '',
        quantity: 1,
        price: '0'
      }
    ]);
    setItemSearch('');
    setItemSuggestions([]);
    setShowItemDropdown(false);
  };

  const removeItem = (itemCode) => {
    setSelectedItems(prev => prev.filter(i => i.item_code !== itemCode));
  };

  const handleProcessNameChange = (itemCode, value) => {
    setSelectedItems(prev => prev.map(i => i.item_code === itemCode ? { ...i, process_name: value } : i));
  };

  const handleQuantityChange = (itemCode, value) => {
    const qty = parseFloat(value) || 1;
    setSelectedItems(prev => prev.map(i => i.item_code === itemCode ? { ...i, quantity: qty } : i));
  };

  const handlePriceChange = (itemCode, value) => {
    setSelectedItems(prev => prev.map(i => i.item_code === itemCode ? { ...i, price: value } : i));
  };

  const backToList = () => {
    navigate('/dashboard');
  };

  const handleCancel = () => {
    navigate('/dashboard');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.quotation_number.trim() || !formData.quotation_date || !formData.commercial_bid_due_date || !formData.technical_bid_due_date) {
      setError('Please fill in all required Process Received Quotation header fields');
      return;
    }

    if (!formData.buyer_id) {
      setError('Please select and link a valid Buyer');
      return;
    }

    if (!formData.customer_id) {
      setError('Please select and link a valid Customer/Supplier');
      return;
    }

    if (selectedItems.length === 0) {
      setError('Please attach at least one Item with its Process Name to this Received Quotation');
      return;
    }

    const missingProcessItem = selectedItems.find(i => !i.process_name || !i.process_name.trim());
    if (missingProcessItem) {
      setError(`Please provide a Process Name for item "${missingProcessItem.item_code}"`);
      return;
    }

    setIsLoading(true);
    const payload = {
      quotation_number: formData.quotation_number.trim(),
      quotation_date: formData.quotation_date,
      commercial_bid_due_date: formData.commercial_bid_due_date,
      technical_bid_due_date: formData.technical_bid_due_date,
      buyer_id: parseInt(formData.buyer_id),
      customer_id: formData.customer_id,
      items: selectedItems.map(item => ({
        item_code: item.item_code,
        process_name: item.process_name.trim(),
        quantity: parseFloat(item.quantity) || 1,
        price: parseFloat(item.price) || 0
      }))
    };

    try {
      const res = await fetch('/api/process-received-quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const resData = await res.json();
        toast.success('Buy Process Received Quotation created successfully!');
        if (resData.trade_id) {
          navigate(`/trade/${resData.trade_id}`);
        } else {
          navigate('/dashboard');
        }
      } else {
        const errData = await res.json();
        setError(errData.error || 'Failed to create Process Received Quotation');
      }
    } catch (err) {
      console.error(err);
      setError('Server connection error while saving Process Received Quotation');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 p-6 bg-slate-100 text-slate-900">
      <div className={historyItem ? "max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-6 items-start" : "max-w-3xl mx-auto space-y-5"}>
        <div className={historyItem ? "lg:col-span-3 space-y-5 flex flex-col w-full" : "space-y-5 flex flex-col w-full"}>
          
          <button
            type="button"
            onClick={backToList}
            className="mb-3 text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer bg-slate-200 hover:bg-slate-300 px-3 py-1.5 rounded-lg transition-colors self-start"
          >
            <ArrowLeft size={14} />
            Back to Dashboard
          </button>

          {/* Header */}
          <div>
            <div className="inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300 mb-1.5">
              Buy Process
            </div>
            <h1 className="text-2xl font-bold text-slate-900 m-0">
              New Process Received Quotation Entry
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Fill in the Buy Process Received Quotation details below.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg flex items-center gap-1.5">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {/* Form Card */}
          <div className=" bg-[white] border border-slate-300 rounded-lg p-6 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Quotation No */}
              <div>
                <label className={labelCls}>Quotation No. <b className="text-red-500">*</b></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PRQ-2024-001"
                  value={formData.quotation_number}
                  onChange={setField('quotation_number')}
                  className={inputCls}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--theme-color)')}
                  onBlur={(e) => (e.target.style.borderColor = 'rgb(203, 213, 225)')}
                />
              </div>

              {/* Dates Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Quotation Date <b className="text-red-500">*</b></label>
                  <input
                    type="date"
                    required
                    value={formData.quotation_date}
                    onChange={setField('quotation_date')}
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
                    onChange={setField('commercial_bid_due_date')}
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
                    onChange={setField('technical_bid_due_date')}
                    className={inputCls}
                    onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                    onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                  />
                </div>
              </div>

              {/* Buyer Name (Search Base) */}
              <div ref={buyerRef} className="relative">
                <label className={labelCls}>Buyer Name <b className="text-red-500">*</b></label>
                <input
                  type="text"
                  placeholder="Start typing buyer name..."
                  value={buyerInput}
                  onChange={(e) => handleBuyerInput(e.target.value)}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--theme-color)';
                    buyerManualRef.current = true;
                    setShowBuyerDropdown(true);
                    fetchBuyers(buyerInput);
                  }}
                  className={inputCls}
                  onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                  autoComplete="off"
                />
                {showBuyerDropdown && buyerSuggestions.length > 0 && (
                  <div className="absolute z-30 w-full mt-1  bg-[white] border border-slate-300 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                    {buyerSuggestions.slice(0, 6).map(b => (
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
                      <span>No buyer found for "{buyerInput}".</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/buyer/form')}
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

              {/* Customer / Supplier ID (Search Base) */}
              <div ref={customerRef} className="relative">
                <label className={labelCls}>Customer / Supplier ID <b className="text-red-500">*</b></label>
                <input
                  type="text"
                  placeholder="Start typing customer or supplier ID / name..."
                  value={customerInput}
                  onChange={(e) => handleCustomerInput(e.target.value)}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--theme-color)';
                    customerManualRef.current = true;
                    setShowCustomerDropdown(true);
                    fetchCustomers(customerInput);
                  }}
                  className={inputCls}
                  onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                  autoComplete="off"
                />
                {showCustomerDropdown && customerSuggestions.length > 0 && (
                  <div className="absolute z-30 w-full mt-1  bg-[white] border border-slate-300 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                    {customerSuggestions.slice(0, 6).map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selectCustomer(c)}
                        className="w-full text-left px-3.5 py-2 hover:bg-amber-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                      >
                        <div className="font-bold text-xs text-slate-900">{c.customer_code || c.id}</div>
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
                      onClick={() => navigate('/party/form')}
                      className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-[9px] transition-colors cursor-pointer uppercase tracking-wider"
                    >
                      Add Customer
                    </button>
                  </div>
                )}
                {formData.customer_id && (
                  <div className="mt-2 flex flex-wrap gap-2.5 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5">
                    <span className="text-emerald-600">✓ Customer Linked</span>
                    {formData.customer_name && (
                      <>
                        <span className="text-slate-300">|</span>
                        <span>{formData.customer_name}</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Items Section */}
              <div>
                <label className={labelCls}>Process Items</label>

                {/* Selected Items List */}
                {selectedItems.length > 0 && (
                  <div className="mb-3 border border-slate-300 rounded-lg overflow-x-auto bg-slate-50">
                    <div className="bg-slate-100 px-4 py-2 border-b border-slate-300 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Attached Items ({selectedItems.length})
                      </span>
                      <span className="text-[10px] text-slate-500 font-semibold">
                        Item Code &bull; Process Name &bull; Qty &bull; Price
                      </span>
                    </div>
                    <div className="divide-y divide-slate-200">
                      {selectedItems.map((item) => (
                        <div key={item.item_code} className="px-4 py-3  bg-[white] hover:bg-slate-50 transition-colors">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            
                            {/* Item details */}
                            <div className="min-w-0 flex-1">
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
                            
                            {/* Process Name, Qty, Price, Actions */}
                            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                              
                              {/* Process Name */}
                              <div className="flex flex-col items-start sm:items-end">
                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                                  Process Name *
                                </label>
                                <input
                                  type="text"
                                  list="process-names-list"
                                  required
                                  placeholder="e.g. Turning"
                                  value={item.process_name}
                                  onChange={(e) => handleProcessNameChange(item.item_code, e.target.value)}
                                  className="w-36 px-2 py-1 font-semibold text-xs text-slate-800  bg-[white] border border-slate-300 rounded focus:outline-none focus:border-[var(--theme-color)]"
                                />
                              </div>

                              {/* Qty */}
                              <div className="flex flex-col items-end">
                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                                  QTY *
                                </label>
                                <input
                                  type="number"
                                  step="any"
                                  min="0.001"
                                  required
                                  value={item.quantity}
                                  onChange={(e) => handleQuantityChange(item.item_code, e.target.value)}
                                  className="w-20 px-1.5 py-1 text-center font-bold text-xs text-slate-800  bg-[white] border border-slate-300 rounded focus:outline-none focus:border-[var(--theme-color)]"
                                />
                              </div>

                              {/* Price */}
                              <div className="flex flex-col items-end">
                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                                  Price
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0.00"
                                  value={item.price}
                                  onChange={(e) => handlePriceChange(item.item_code, e.target.value)}
                                  className="w-24 px-1.5 py-1 text-center font-bold text-xs text-slate-800  bg-[white] border border-slate-300 rounded focus:outline-none focus:border-[var(--theme-color)]"
                                />
                              </div>

                              {/* History button */}
                              <button
                                type="button"
                                onClick={() => setHistoryItem(item.item_code)}
                                className="p-1 mt-3.5 text-slate-400 hover:text-[var(--theme-color)] hover:bg-slate-50 rounded transition-colors cursor-pointer shrink-0"
                                title="View Quote History"
                              >
                                <History size={14} />
                              </button>

                              {/* Remove item button */}
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

                          {/* Mobile inline history panel */}
                          {historyItem === item.item_code && (
                            <div className="block lg:hidden mt-3 p-4 bg-slate-50 border border-slate-300 rounded-lg space-y-4 animate-fade-in w-full">
                              <ItemQuoteHistory
                                code={historyItem}
                                excludeRfq={null}
                                onClose={() => setHistoryItem(null)}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Search item autocomplete */}
                <div ref={itemRef} className="relative">
                  <input
                    type="text"
                    placeholder="Search item by code or description to attach..."
                    value={itemSearch}
                    onChange={(e) => handleItemSearch(e.target.value)}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'var(--theme-color)';
                      setShowItemDropdown(true);
                      fetchItems(itemSearch);
                    }}
                    className={inputCls}
                    onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                    autoComplete="off"
                  />

                  {showItemDropdown && itemSuggestions.filter(item => !selectedItems.some(i => i.item_code === item.item_code)).length > 0 && (
                    <div className="absolute z-30 w-full mt-1  bg-[white] border border-slate-300 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                      {itemSuggestions.filter(item => !selectedItems.some(i => i.item_code === item.item_code)).map(item => (
                        <button
                          key={item.item_code}
                          type="button"
                          onClick={() => addItem(item)}
                          className="w-full text-left px-3.5 py-2 border-b border-slate-100 last:border-0 hover:bg-amber-50 transition-colors cursor-pointer"
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
                        onClick={() => navigate('/item/form')}
                        className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-[9px] transition-colors cursor-pointer uppercase tracking-wider"
                      >
                        Add Item
                      </button>
                    </div>
                  )}
                </div>

                {selectedItems.length === 0 && (
                  <p className="mt-2 text-xs text-slate-400 font-medium pl-1">
                    No items added yet. Search above to attach items to this Buy Process Received Quotation.
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 rounded-lg font-semibold text-sm text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: 'var(--theme-color)' }}
                  onMouseEnter={(e) => e.target.style.filter = 'brightness(0.9)'}
                  onMouseLeave={(e) => e.target.style.filter = 'none'}
                >
                  {isLoading ? (
                    <><RefreshCw size={14} className="animate-spin" /> Processing...</>
                  ) : (
                    <><Plus size={14} /> Save Process Received Quotation</>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>

        {/* Right side history panel */}
        {historyItem && (
          <div className="hidden lg:block lg:col-span-2  bg-[white] border border-slate-300 rounded-lg p-5 shadow-sm space-y-4 animate-fade-in self-start lg:sticky lg:top-5 w-full">
            <ItemQuoteHistory
              code={historyItem}
              excludeRfq={null}
              onClose={() => setHistoryItem(null)}
            />
          </div>
        )}
      </div>

      {/* Datalist for Common Process Names */}
      <datalist id="process-names-list">
        {COMMON_PROCESSES.map((proc) => (
          <option key={proc} value={proc} />
        ))}
      </datalist>
    </div>
  );
}
