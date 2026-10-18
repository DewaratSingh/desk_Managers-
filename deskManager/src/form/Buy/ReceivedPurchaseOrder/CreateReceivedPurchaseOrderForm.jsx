import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Plus, RefreshCw, X, Search, Trash2, CheckSquare, Square } from 'lucide-react';
import { toast } from 'react-toastify';

const labelCls = "block text-xs font-bold text-slate-700 uppercase mb-1.5";
const inputCls = "w-full px-3 py-2  bg-[white] border border-slate-300 rounded text-sm placeholder:text-slate-400 font-medium focus:outline-none transition-colors duration-150 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed";

export default function CreateReceivedPurchaseOrderForm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const queryQuotationNo = searchParams.get('quotation_no');
  const queryTradeId     = searchParams.get('trade_id');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState(null);

  // Received Quotation autocomplete
  const [qtnInput, setQtnInput]                   = useState('');
  const [qtnSuggestions, setQtnSuggestions]       = useState([]);
  const [showQtnDropdown, setShowQtnDropdown]     = useState(false);
  const [qtnNotFound, setQtnNotFound]             = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const qtnRef = useRef(null);
  const qtnManualRef = useRef(false);

  // Per-item GST search state keyed by item_code
  const [gstSearchInput, setGstSearchInput]       = useState({});
  const [gstDropdownOpen, setGstDropdownOpen]     = useState({});
  const gstItemRefs = useRef({});

  // Per-item shipping address search state
  const [shipInput, setShipInput]           = useState({});
  const [shipDropdownOpen, setShipDropdownOpen] = useState({});
  const shipItemRefs = useRef({});

  // PO items
  const [poItems, setPoItems] = useState([]);

  // Items search state
  const [itemSearchInput, setItemSearchInput] = useState('');
  const [itemSuggestions, setItemSuggestions] = useState([]);
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const itemSearchRef = useRef(null);

  const [gstSuggestions, setGstSuggestions]   = useState({});  // { item_code: array }
  const [shipSuggestions, setShipSuggestions]   = useState({});  // { item_code: array }
  const gstTimeoutRefs = useRef({});
  const shipTimeoutRefs = useRef({});

  // System-generated PO No.
  const [nextPoNo, setNextPoNo] = useState('');

  // Form data
  const [formData, setFormData] = useState({
    po_no:           '',
    quotation_no:    '',
    po_date:         new Date().toISOString().split('T')[0],
    delivery_date:   '',
    transport:       '0',
    other:           '0',
    basic_value:     '0',
    packing_forward: '0',
  });

  // Debounced search for received quotations (limit 5)
  useEffect(() => {
    const trimmed = qtnInput.trim();
    if (!trimmed) {
      setQtnSuggestions([]);
      setShowQtnDropdown(false);
      setQtnNotFound(false);
      return;
    }

    if (!qtnManualRef.current) {
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      fetch(`/api/received-quotations?q=${encodeURIComponent(trimmed)}&limit=5`)
        .then(r => r.json())
        .then(data => {
          setQtnSuggestions(data);
          setQtnNotFound(data.length === 0);
          setShowQtnDropdown(true);
        })
        .catch(console.error);
    }, 200);

    return () => clearTimeout(delayDebounceFn);
  }, [qtnInput]);

  useEffect(() => {
    fetchNextPoNo();
    setFormData(prev => ({
      ...prev,
      quotation_no: queryQuotationNo || '',
      po_date: new Date().toISOString().split('T')[0]
    }));
    setQtnInput(queryQuotationNo || '');
    if (queryQuotationNo) fetchQuotationDetails(queryQuotationNo);
  }, [queryQuotationNo]);

  // Debounced search for items (limit 5)
  useEffect(() => {
    const trimmed = itemSearchInput.trim();
    if (!trimmed) {
      setItemSuggestions([]);
      setShowItemDropdown(false);
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      fetch(`/api/arc-items?q=${encodeURIComponent(trimmed)}&limit=5`)
        .then(r => r.json())
        .then(data => {
          setItemSuggestions(data);
          setShowItemDropdown(true);
        })
        .catch(console.error);
    }, 200);

    return () => clearTimeout(delayDebounceFn);
  }, [itemSearchInput]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (qtnRef.current && !qtnRef.current.contains(event.target)) {
        setShowQtnDropdown(false);
      }
      if (itemSearchRef.current && !itemSearchRef.current.contains(event.target)) {
        setShowItemDropdown(false);
      }
      Object.keys(gstItemRefs.current).forEach(code => {
        if (gstItemRefs.current[code] && !gstItemRefs.current[code].contains(event.target)) {
          setGstDropdownOpen(prev => ({ ...prev, [code]: false }));
        }
      });
      Object.keys(shipItemRefs.current).forEach(code => {
        if (shipItemRefs.current[code] && !shipItemRefs.current[code].contains(event.target)) {
          setShipDropdownOpen(prev => ({ ...prev, [code]: false }));
        }
      });
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNextPoNo = async () => {
    try {
      const res = await fetch('/api/purchase-orders/next-no');
      if (res.ok) {
        const data = await res.json();
        setNextPoNo(data.nextNo);
        setFormData(prev => ({ ...prev, po_no: data.nextNo }));
      }
    } catch (err) { console.error('Error fetching next PO no:', err); }
  };

  const fetchQuotationDetails = async (qNo) => {
    try {
      const res = await fetch(`/api/received-quotations/${encodeURIComponent(qNo)}`);
      if (res.ok) selectQuotation(await res.json());
    } catch (err) { console.error(err); }
  };

  const set = (field) => (e) =>
    setFormData(prev => ({ ...prev, [field]: e.target.value }));

  const handleCommonDeliveryDateChange = (e) => {
    const val = e.target.value;
    setFormData(prev => ({ ...prev, delivery_date: val }));
    setPoItems(prev => prev.map(item => ({ ...item, delivery_date: val })));
  };

  // Received Quotation autocomplete
  const handleQtnInput = (value) => {
    qtnManualRef.current = true;
    setQtnInput(value);
    setFormData(prev => ({ ...prev, quotation_no: '' }));
    setSelectedQuotation(null);
    setPoItems([]);
    setGstSearchInput({});
    setShowQtnDropdown(true);
  };

  const selectQuotation = (qtn) => {
    qtnManualRef.current = false;
    setSelectedQuotation(qtn);
    setFormData(prev => ({ ...prev, quotation_no: qtn.received_quotation_no }));
    setQtnInput(qtn.received_quotation_no);
    setShowQtnDropdown(false);
    setQtnNotFound(false);
    if (Array.isArray(qtn.items)) {
      setPoItems(qtn.items.map(i => ({
        item_code:        i.item_code,
        quantity:         i.quantity,
        unit_price:       i.unit_price,
        gst_type:         '',
        gst_rate:         '',
        shipping_address: '',
        delivery_date:    formData.delivery_date || '',
        description:      i.description    || '',
        drawing_number:   i.drawing_number || '',
        selected:         true
      })));
      setGstSearchInput({});
      setShipInput({});
    }
  };

  // GST Search Suggestions On-Demand Fetcher
  const fetchGstSuggestions = (itemCode, val) => {
    if (gstTimeoutRefs.current[itemCode]) {
      clearTimeout(gstTimeoutRefs.current[itemCode]);
    }
    const isSelectedFormat = /^[A-Z0-9\s]+\s*\(\d+(\.\d+)?%\)$/i.test(val);
    if (isSelectedFormat) {
      return;
    }
    gstTimeoutRefs.current[itemCode] = setTimeout(() => {
      fetch(`/api/gst-rates?q=${encodeURIComponent(val)}&limit=5`)
        .then(r => r.json())
        .then(data => {
          setGstSuggestions(prev => ({ ...prev, [itemCode]: data }));
        })
        .catch(console.error);
    }, 200);
  };

  // Per-item GST handlers
  const handleGstSearch = (itemCode, value) => {
    setGstSearchInput(prev => ({ ...prev, [itemCode]: value }));
    setPoItems(prev => prev.map(i => i.item_code === itemCode ? { ...i, gst_type: '', gst_rate: '' } : i));
    setGstDropdownOpen(prev => ({ ...prev, [itemCode]: true }));
    fetchGstSuggestions(itemCode, value);
  };

  const selectItemGst = (itemCode, gst) => {
    setPoItems(prev => prev.map(i =>
      i.item_code === itemCode ? { ...i, gst_type: gst.type, gst_rate: String(gst.rate) } : i
    ));
    setGstSearchInput(prev => ({ ...prev, [itemCode]: `${gst.type} (${gst.rate}%)` }));
    setGstDropdownOpen(prev => ({ ...prev, [itemCode]: false }));
  };

  const clearItemGst = (itemCode) => {
    setPoItems(prev => prev.map(i =>
      i.item_code === itemCode ? { ...i, gst_type: '', gst_rate: '' } : i
    ));
    setGstSearchInput(prev => ({ ...prev, [itemCode]: '' }));
    setGstDropdownOpen(prev => ({ ...prev, [itemCode]: false }));
  };

  // Shipping Address Customer Suggestions On-Demand Fetcher
  const fetchShipSuggestions = (itemCode, val) => {
    if (shipTimeoutRefs.current[itemCode]) {
      clearTimeout(shipTimeoutRefs.current[itemCode]);
    }
    shipTimeoutRefs.current[itemCode] = setTimeout(() => {
      fetch(`/api/customers?q=${encodeURIComponent(val)}&limit=5`)
        .then(r => r.json())
        .then(data => {
          setShipSuggestions(prev => ({ ...prev, [itemCode]: data }));
        })
        .catch(console.error);
    }, 200);
  };

  // Per-item shipping address handlers
  const handleShipInput = (itemCode, value) => {
    setShipInput(prev => ({ ...prev, [itemCode]: value }));
    updateItem(itemCode, 'shipping_address', value);
    setShipDropdownOpen(prev => ({ ...prev, [itemCode]: true }));
    fetchShipSuggestions(itemCode, value);
  };

  const selectShipCustomer = (itemCode, customer) => {
    setShipInput(prev => ({ ...prev, [itemCode]: customer.address }));
    updateItem(itemCode, 'shipping_address', customer.address);
    setShipDropdownOpen(prev => ({ ...prev, [itemCode]: false }));
  };

  const clearShip = (itemCode) => {
    setShipInput(prev => ({ ...prev, [itemCode]: '' }));
    updateItem(itemCode, 'shipping_address', '');
    setShipDropdownOpen(prev => ({ ...prev, [itemCode]: false }));
  };

  const toggleItem = (itemCode) =>
    setPoItems(prev => prev.map(i => i.item_code === itemCode ? { ...i, selected: !i.selected } : i));

  const updateItem = (itemCode, field, value) =>
    setPoItems(prev => prev.map(i => i.item_code === itemCode ? { ...i, [field]: value } : i));

  const removePoItem = (itemCode) => {
    setPoItems(prev => prev.filter(i => i.item_code !== itemCode));
  };

  const addPoItem = (item) => {
    if (poItems.some(i => i.item_code === item.item_code)) {
      toast.warn('Item already added.');
      return;
    }
    setPoItems(prev => [
      ...prev,
      {
        item_code:        item.item_code,
        quantity:         1,
        unit_price:       String(item.price || 0),
        gst_type:         '',
        gst_rate:         '',
        shipping_address: '',
        delivery_date:    formData.delivery_date || '',
        description:      item.description || '',
        drawing_number:   item.drawing_number || '',
        selected:         true
      }
    ]);
    setItemSearchInput('');
    setItemSuggestions([]);
    setShowItemDropdown(false);
  };

  const calcItemBasic   = (item) => (parseFloat(item.unit_price) || 0) * (parseFloat(item.quantity) || 0);
  const calcItemGst     = (item) => (calcItemBasic(item) * (parseFloat(item.gst_rate) || 0)) / 100;
  const calcItemTotal   = (item) => calcItemBasic(item) + calcItemGst(item);

  const calcBasicTotal  = () => poItems.filter(i => i.selected).reduce((a, i) => a + calcItemBasic(i), 0);
  const calcGstTotal    = () => poItems.filter(i => i.selected).reduce((a, i) => a + calcItemGst(i), 0);
  const calcGrandTotal  = () =>
    calcBasicTotal()
    + calcGstTotal()
    + (parseFloat(formData.transport)       || 0)
    + (parseFloat(formData.other)           || 0)
    + (parseFloat(formData.basic_value)     || 0)
    + (parseFloat(formData.packing_forward) || 0);

  const fmt = (val) => (parseFloat(val) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  const handleCancel = () => navigate(queryTradeId ? `/trade/${queryTradeId}` : '/');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const finalPoNo = formData.po_no || nextPoNo;
    if (!finalPoNo) {
      setError('PO ID is still generating. Please try again.');
      setIsLoading(false);
      return;
    }

    const activeItems = poItems.filter(i => i.selected);
    if (activeItems.length === 0) {
      setError('Please select at least one item for the purchase order.');
      setIsLoading(false);
      return;
    }

    const hasMissingDeliveryDate = activeItems.some(i => !(i.delivery_date || formData.delivery_date));
    if (hasMissingDeliveryDate) {
      setError('Delivery Date is compulsory. Please select a common delivery date or enter a delivery date for each item.');
      setIsLoading(false);
      return;
    }

    const payload = {
      po_no:           finalPoNo,
      quotation_no:    formData.quotation_no || null,
      po_date:         formData.po_date,
      delivery_date:   formData.delivery_date || null,
      transport:       parseFloat(formData.transport)       || 0,
      other:           parseFloat(formData.other)           || 0,
      basic_value:     parseFloat(formData.basic_value)     || 0,
      packing_forward: parseFloat(formData.packing_forward) || 0,
      items: activeItems.map(i => ({
        item_code:        i.item_code,
        quantity:         parseFloat(i.quantity)   || 0,
        unit_price:       parseFloat(i.unit_price) || 0,
        gst_type:         i.gst_type  || null,
        gst_rate:         parseFloat(i.gst_rate)  || 0,
        shipping_address: i.shipping_address || null,
        delivery_date:    i.delivery_date || formData.delivery_date || null
      }))
    };

    try {
      const res = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast.success('Purchase Order created successfully!');
        const destTradeId = queryTradeId || selectedQuotation?.trade_id;
        navigate(destTradeId ? `/trade/${destTradeId}` : '/');
      } else {
        const errData = await res.json();
        setError(errData.error || 'Failed to save purchase order');
      }
    } catch (err) {
      setError('Server connection error while saving purchase order.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 p-6 bg-slate-100 text-slate-900 font-sans">
      <div className="max-w-2xl mx-auto space-y-5">
        
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg flex items-center gap-1.5">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {/* Header */}
        <div className="pb-2 border-b border-slate-300">
          <button
            type="button"
            onClick={handleCancel}
            className="mb-3 text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer bg-slate-200 hover:bg-slate-300 px-3 py-1.5 rounded-lg transition-colors"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <h1 className="text-2xl font-bold text-slate-900 m-0">
            Create Purchase Order
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Raise a purchase order linked to a received quotation proposal.
          </p>
        </div>

        {/* Form Card */}
        <div className=" bg-[white] border border-slate-300 rounded-lg p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* PO No */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>PO No.</label>
                <input
                  type="text"
                  disabled
                  value={nextPoNo || 'Generating...'}
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded text-sm text-slate-500 cursor-not-allowed font-mono font-bold"
                />
                <p className="text-[10px] text-slate-400 font-semibold mt-1.5 pl-1">
                  Automatically generated reference number.
                </p>
              </div>

              {/* PO Date */}
              <div>
                <label className={labelCls}>PO Date <b className="text-red-500">*</b></label>
                <input
                  type="date"
                  required
                  value={formData.po_date}
                  onChange={set('po_date')}
                  className={inputCls}
                  onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                  onBlur={(e)  => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                />
              </div>
            </div>

            {/* Delivery Date */}
            <div>
              <label className={labelCls}>Delivery Date</label>
              <input
                type="date"
                value={formData.delivery_date}
                onChange={handleCommonDeliveryDateChange}
                className={inputCls}
                onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                onBlur={(e)  => e.target.style.borderColor = 'rgb(203, 213, 225)'}
              />
            </div>

            {/* Received Quotation Autocomplete */}
            <div ref={qtnRef} className="relative">
              <label className={labelCls}>Received Quotation Reference</label>
              <input
                type="text"
                placeholder="Start typing received quotation number..."
                value={qtnInput}
                onChange={(e) => handleQtnInput(e.target.value)}
                onFocus={() => {
                  e.target.style.borderColor = 'var(--theme-color)';
                  qtnManualRef.current = true;
                  if (qtnInput.trim()) setShowQtnDropdown(true);
                }}
                className={inputCls}
                onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                autoComplete="off"
              />

              {showQtnDropdown && qtnSuggestions.length > 0 && (
                <div className="absolute z-30 w-full mt-1  bg-[white] border border-slate-300 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                  {qtnSuggestions.map(q => (
                    <button
                      key={q.received_quotation_no}
                      type="button"
                      onClick={() => selectQuotation(q)}
                      className="w-full text-left px-3.5 py-2 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                    >
                      <div className="font-bold text-xs text-slate-900">{q.received_quotation_no}</div>
                      <div className="text-[10px] text-slate-500">
                        Date: {q.quotation_date ? q.quotation_date.split('T')[0] : '—'} &bull; Items: {q.items?.length || 0}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {qtnNotFound && (
                <div className="mt-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
                  <AlertCircle size={13} className="shrink-0" />
                  <span>No received quotation found for "{qtnInput}".</span>
                </div>
              )}

              {selectedQuotation && (
                <div className="mt-2 flex flex-wrap gap-2.5 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5">
                  <span className="text-emerald-600">✓ Received Quotation Linked</span>
                  <span className="text-slate-300">|</span>
                  <span>{selectedQuotation.received_quotation_no}</span>
                  {selectedQuotation.customer_id && (
                    <>
                      <span className="text-slate-300">|</span>
                      <span>Cust: {selectedQuotation.customer_id}</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Items Search */}
            <div ref={itemSearchRef} className="relative">
              <label className={labelCls}>Add Items (Catalog)</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search catalog items to add (item code or description)..."
                  value={itemSearchInput}
                  onChange={(e) => setItemSearchInput(e.target.value)}
                  onFocus={() => { if (itemSearchInput.trim()) setShowItemDropdown(true); }}
                  className={inputCls}
                  autoComplete="off"
                />
                <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              {showItemDropdown && itemSuggestions.length > 0 && (
                <div className="absolute z-40 left-0 right-0 mt-1  bg-[white] border border-slate-300 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                  {itemSuggestions.map(item => (
                    <button
                      key={item.item_code}
                      type="button"
                      onClick={() => addPoItem(item)}
                      className="w-full text-left px-3.5 py-2 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs text-slate-900">{item.item_code}</span>
                        {item.price != null && (
                          <span className="text-xs font-semibold text-emerald-700">₹{item.price}</span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 truncate">{item.description}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Items Section */}
            {poItems.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={labelCls}>Items ({poItems.filter(i => i.selected).length} selected)</label>
                  <span className="text-[11px] font-semibold text-slate-500">
                    Basic: ₹{fmt(calcBasicTotal())} &bull; GST: ₹{fmt(calcGstTotal())}
                  </span>
                </div>

                <div className="border border-slate-300 rounded-lg bg-slate-50">
                  <div className="divide-y divide-slate-200">
                    {poItems.map((item, index) => {
                      const isDropdownActive = shipDropdownOpen[item.item_code] || gstDropdownOpen[item.item_code];
                      return (
                        <div
                          key={item.item_code}
                          className={`px-4 py-3  bg-[white] transition-colors relative ${
                            !item.selected ? 'opacity-50 bg-slate-50' : ''
                          }`}
                          style={{ zIndex: isDropdownActive ? 50 : (poItems.length - index) }}
                        >
                        {/* Row 1: Checkbox + Item Info */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => toggleItem(item.item_code)}
                              className="mt-0.5 text-slate-500 hover:text-slate-800 focus:outline-none shrink-0"
                            >
                              {item.selected
                                ? <CheckSquare size={16} className="text-blue-600" />
                                : <Square size={16} />}
                            </button>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className="font-mono font-bold text-xs border px-1.5 py-0.25 rounded"
                                  style={{ color: 'var(--theme-color)', borderColor: 'var(--theme-color)', backgroundColor: 'rgba(217, 53, 45, 0.05)' }}
                                >
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
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right">
                              <span className="text-[10px] text-slate-400 font-bold block uppercase">Total</span>
                              <span className="font-mono font-bold text-xs text-slate-800">₹{fmt(calcItemTotal(item))}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => removePoItem(item.item_code)}
                              className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
                              title="Remove item"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Row 2: Editable fields */}
                        {item.selected && (
                          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
                            <div>
                              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Qty *</label>
                              <input
                                type="number"
                                step="any"
                                min="0.01"
                                required
                                value={item.quantity}
                                onChange={(e) => updateItem(item.item_code, 'quantity', e.target.value)}
                                className="w-full px-2 py-1 font-bold text-xs text-slate-800  bg-[white] border border-slate-300 rounded focus:outline-none focus:border-[var(--theme-color)]"
                              />
                            </div>

                            <div>
                              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Unit Price (₹) *</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                required
                                value={item.unit_price}
                                onChange={(e) => updateItem(item.item_code, 'unit_price', e.target.value)}
                                className="w-full px-2 py-1 font-bold text-xs text-slate-800  bg-[white] border border-slate-300 rounded focus:outline-none focus:border-[var(--theme-color)]"
                              />
                            </div>

                            {/* GST Rate search */}
                            <div
                              className="relative"
                              ref={el => gstItemRefs.current[item.item_code] = el}
                            >
                              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">GST Rate</label>
                              <div className="relative">
                                <input
                                  type="text"
                                  placeholder="e.g. GST 18"
                                  value={gstSearchInput[item.item_code] ?? (item.gst_type ? `${item.gst_type} (${item.gst_rate}%)` : '')}
                                  onChange={(e) => handleGstSearch(item.item_code, e.target.value)}
                                  onFocus={() => {
                                    setGstDropdownOpen(prev => ({ ...prev, [item.item_code]: true }));
                                    fetchGstSuggestions(item.item_code, gstSearchInput[item.item_code] || '');
                                  }}
                                  className="w-full pl-2 pr-5 py-1 text-xs text-slate-800  bg-[white] border border-slate-300 rounded focus:outline-none focus:border-[var(--theme-color)] font-medium"
                                  autoComplete="off"
                                />
                                {item.gst_type && (
                                  <button
                                    type="button"
                                    onClick={() => clearItemGst(item.item_code)}
                                    className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                                  >
                                    <X size={11} />
                                  </button>
                                )}
                              </div>

                              {gstDropdownOpen[item.item_code] && (gstSuggestions[item.item_code] || []).length > 0 && (
                                <div className="absolute z-50 left-0 right-0 mt-1  bg-[white] border border-slate-300 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                  {(gstSuggestions[item.item_code] || []).map(g => (
                                    <button
                                      key={g.id}
                                      type="button"
                                      onClick={() => selectItemGst(item.item_code, g)}
                                      className="w-full text-left px-2.5 py-1.5 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                                    >
                                      <span className="font-bold text-xs text-slate-900">{g.type}</span>
                                      <span className="text-[10px] text-slate-500 ml-1.5">({g.rate}%)</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Per-item Delivery Date */}
                            <div>
                              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                                Delivery Date <b className="text-red-500">*</b>
                              </label>
                              <input
                                type="date"
                                required={!formData.delivery_date}
                                value={item.delivery_date || formData.delivery_date || ''}
                                onChange={(e) => updateItem(item.item_code, 'delivery_date', e.target.value)}
                                className="w-full px-2 py-1 text-xs text-slate-800  bg-[white] border border-slate-300 rounded focus:outline-none focus:border-[var(--theme-color)]"
                              />
                            </div>

                            {/* Shipping Address autocomplete — spans all 4 cols */}
                            <div
                              className="col-span-2 sm:col-span-4 relative mt-1"
                              ref={el => shipItemRefs.current[item.item_code] = el}
                            >
                              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Shipping Address</label>
                              <div className="relative">
                                <input
                                  type="text"
                                  placeholder="Type customer name to pick address..."
                                  value={shipInput[item.item_code] ?? item.shipping_address}
                                  onChange={(e) => handleShipInput(item.item_code, e.target.value)}
                                  onFocus={() => {
                                    setShipDropdownOpen(prev => ({ ...prev, [item.item_code]: true }));
                                    fetchShipSuggestions(item.item_code, shipInput[item.item_code] || '');
                                  }}
                                  className="w-full pl-2 pr-5 py-1 text-xs text-slate-800  bg-[white] border border-slate-300 rounded focus:outline-none focus:border-[var(--theme-color)] font-medium"
                                  autoComplete="off"
                                />
                                {item.shipping_address && (
                                  <button
                                    type="button"
                                    onClick={() => clearShip(item.item_code)}
                                    className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                                  >
                                    <X size={11} />
                                  </button>
                                )}
                              </div>

                              {shipDropdownOpen[item.item_code] && (shipSuggestions[item.item_code] || []).length > 0 && (
                                <div className="absolute z-50 left-0 right-0 mt-1  bg-[white] border border-slate-300 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                  {(shipSuggestions[item.item_code] || []).map(c => (
                                    <button
                                      key={c.id}
                                      type="button"
                                      onClick={() => selectShipCustomer(item.item_code, c)}
                                      className="w-full text-left px-2.5 py-1.5 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                                    >
                                      <span className="font-bold text-xs text-slate-900">{c.name}</span>
                                      <p className="text-[10px] text-slate-500 truncate">{c.address}</p>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  </div>
                </div>
              </div>
            )}

            {/* Additional Charges */}
            <div className="border-t border-slate-200 pt-3">
              <label className={labelCls}>Additional Charges &amp; Summary</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Transport (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.transport}
                    onChange={set('transport')}
                    className="w-full px-2 py-1 text-xs text-slate-800  bg-[white] border border-slate-300 rounded focus:outline-none focus:border-[var(--theme-color)]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Packing &amp; Fwd (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.packing_forward}
                    onChange={set('packing_forward')}
                    className="w-full px-2 py-1 text-xs text-slate-800  bg-[white] border border-slate-300 rounded focus:outline-none focus:border-[var(--theme-color)]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Basic Extra (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.basic_value}
                    onChange={set('basic_value')}
                    className="w-full px-2 py-1 text-xs text-slate-800  bg-[white] border border-slate-300 rounded focus:outline-none focus:border-[var(--theme-color)]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Other (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.other}
                    onChange={set('other')}
                    className="w-full px-2 py-1 text-xs text-slate-800  bg-[white] border border-slate-300 rounded focus:outline-none focus:border-[var(--theme-color)]"
                  />
                </div>
              </div>

              {/* Grand Total Bar */}
              <div className="mt-3 flex items-center justify-between bg-slate-100 border border-slate-300 rounded-lg px-4 py-2.5">
                <div className="text-xs text-slate-600 font-medium space-x-3">
                  <span>Basic: <b>₹{fmt(calcBasicTotal())}</b></span>
                  <span>GST: <b>₹{fmt(calcGstTotal())}</b></span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Grand Total</span>
                  <span className="text-base font-extrabold text-slate-900 font-mono">₹{fmt(calcGrandTotal())}</span>
                </div>
              </div>
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
                  <><RefreshCw size={14} className="animate-spin" /> Saving...</>
                ) : (
                  <><Plus size={14} /> Raise Purchase Order</>
                )}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}
