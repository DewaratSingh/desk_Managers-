import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Plus, RefreshCw, X, CheckSquare, Square, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';

const labelCls = "block text-xs font-bold text-slate-700 uppercase mb-1.5";
const inputCls = "w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm placeholder:text-slate-400 font-medium focus:outline-none transition-colors duration-150 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed";

export default function PurchaseOrderForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const queryQuotationNo = searchParams.get('quotation_no');
  const queryTradeId     = searchParams.get('trade_id');
  const editingNo        = id || null;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState(null);
  const [poNoError, setPoNoError] = useState('');

  // Quotation autocomplete
  const [qtnInput, setQtnInput]                   = useState('');
  const [qtnSuggestions, setQtnSuggestions]       = useState([]);
  const [showQtnDropdown, setShowQtnDropdown]     = useState(false);
  const [qtnNotFound, setQtnNotFound]             = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const qtnRef = useRef(null);
  const qtnManualRef = useRef(false);

  // Per-item GST search state keyed by item_code
  const [gstSearchInput, setGstSearchInput]       = useState({});  // { item_code: string }
  const [gstDropdownOpen, setGstDropdownOpen]     = useState({});  // { item_code: bool }
  const gstItemRefs = useRef({});

  // Per-item shipping address search state
  const [shipInput, setShipInput]           = useState({});  // { item_code: string (display) }
  const [shipDropdownOpen, setShipDropdownOpen] = useState({});  // { item_code: bool }
  const shipItemRefs = useRef({});

  // PO items
  const [poItems, setPoItems] = useState([]);



  const [gstSuggestions, setGstSuggestions]   = useState({});  // { item_code: array }
  const [shipSuggestions, setShipSuggestions]   = useState({});  // { item_code: array }
  const gstTimeoutRefs = useRef({});
  const shipTimeoutRefs = useRef({});

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

  // Debounced search for quotations (limit 5)
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
      fetch(`/api/quotations?q=${encodeURIComponent(trimmed)}&limit=5`)
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
    if (editingNo) {
      fetchPoDetails(editingNo);
    } else {
      setFormData(prev => ({
        ...prev,
        quotation_no: queryQuotationNo || '',
        po_date: new Date().toISOString().split('T')[0]
      }));
      setQtnInput(queryQuotationNo || '');
      if (queryQuotationNo) fetchQuotationDetails(queryQuotationNo);
    }
  }, [editingNo, queryQuotationNo]);



  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (qtnRef.current && !qtnRef.current.contains(event.target)) {
        setShowQtnDropdown(false);
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



  const fetchQuotationDetails = async (qNo) => {
    try {
      const res = await fetch(`/api/quotations/${encodeURIComponent(qNo)}`);
      if (res.ok) selectQuotation(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchPoDetails = async (poNo) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/purchase-orders/${encodeURIComponent(poNo)}`);
      if (!res.ok) throw new Error('Failed to fetch purchase order details');
      const po = await res.json();

      setFormData({
        po_no:           po.po_no,
        quotation_no:    po.quotation_no || '',
        po_date:         po.po_date ? po.po_date.split('T')[0] : '',
        delivery_date:   po.delivery_date ? po.delivery_date.split('T')[0] : '',
        transport:       String(po.transport       || 0),
        other:           String(po.other           || 0),
        basic_value:     String(po.basic_value     || 0),
        packing_forward: String(po.packing_forward || 0),
      });
      setQtnInput(po.quotation_no || '');

      if (Array.isArray(po.items)) {
        const items = po.items.map(item => ({
          item_code:        item.item_code,
          quantity:         item.quantity,
          unit_price:       item.unit_price,
          gst_type:         item.gst_type  || '',
          gst_rate:         item.gst_rate  != null ? String(item.gst_rate) : '',
          shipping_address: item.shipping_address || '',
          delivery_date:    item.delivery_date ? item.delivery_date.split('T')[0] : '',
          description:      item.description  || '',
          drawing_number:   item.drawing_number || '',
          selected:         true
        }));
        setPoItems(items);

        // Pre-fill gst + shipping inputs from saved data
        const initGstInputs  = {};
        const initShipInputs = {};
        items.forEach(i => {
          if (i.gst_type)         initGstInputs[i.item_code]  = `${i.gst_type} (${i.gst_rate}%)`;
          if (i.shipping_address) initShipInputs[i.item_code] = i.shipping_address;
        });
        setGstSearchInput(initGstInputs);
        setShipInput(initShipInputs);
      }
    } catch (err) {
      setError(err.message || 'Connection error while fetching PO details.');
    } finally {
      setIsLoading(false);
    }
  };

  const set = (field) => (e) =>
    setFormData(prev => ({ ...prev, [field]: e.target.value }));

  // Quotation autocomplete
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
    setFormData(prev => ({ ...prev, quotation_no: qtn.quotation_no }));
    setQtnInput(qtn.quotation_no);
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
        delivery_date:    '',
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

  const removeRoItem = removePoItem;

  // Calculations
  const calcItemBasic   = (item) => (parseFloat(item.unit_price) || 0) * (parseInt(item.quantity) || 0);
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
    setPoNoError('');

    if (!formData.po_no.trim()) {
      setPoNoError('PO No. is required.');
      setIsLoading(false);
      return;
    }

    const activeItems = poItems.filter(i => i.selected);
    if (activeItems.length === 0) {
      setError('Please select at least one item for the purchase order.');
      setIsLoading(false);
      return;
    }

    const payload = {
      po_no:           editingNo || formData.po_no.trim(),
      quotation_no:    formData.quotation_no || null,
      po_date:         formData.po_date,
      delivery_date:   formData.delivery_date || null,
      transport:       parseFloat(formData.transport)       || 0,
      other:           parseFloat(formData.other)           || 0,
      basic_value:     parseFloat(formData.basic_value)     || 0,
      packing_forward: parseFloat(formData.packing_forward) || 0,
      items: activeItems.map(i => ({
        item_code:        i.item_code,
        quantity:         parseInt(i.quantity)     || 1,
        unit_price:       parseFloat(i.unit_price) || 0,
        gst_type:         i.gst_type  || null,
        gst_rate:         parseFloat(i.gst_rate)  || 0,
        shipping_address: i.shipping_address || null,
        delivery_date:    i.delivery_date    || null
      }))
    };

    try {
      const url    = editingNo ? `/api/purchase-orders/${encodeURIComponent(editingNo)}` : '/api/purchase-orders';
      const method = editingNo ? 'PUT' : 'POST';
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast.success(`Purchase Order ${editingNo ? 'updated' : 'created'} successfully!`);
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
    <div className="flex-1 p-6 bg-slate-100 text-slate-900">
      <div className="max-w-2xl mx-auto space-y-5">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 m-0">
            {editingNo ? 'Modify Purchase Order' : 'New Purchase Order'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {editingNo
              ? 'Update the details of an existing purchase order.'
              : 'Raise a purchase order linked to a commercial quotation.'}
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

            {/* PO No */}
            <div>
              <label className={labelCls}>PO No. <b className="text-red-500">*</b></label>
              <input
                type="text"
                required
                placeholder="e.g. PO-2024-001"
                value={formData.po_no}
                onChange={(e) => { setFormData(prev => ({ ...prev, po_no: e.target.value })); setPoNoError(''); }}
                disabled={!!editingNo}
                className={inputCls}
                onFocus={(e) => !editingNo && (e.target.style.borderColor = 'var(--theme-color)')}
                onBlur={(e)  => !editingNo && (e.target.style.borderColor = 'rgb(203, 213, 225)')}
              />
              {poNoError && <p className="text-[10px] text-red-500 font-semibold mt-1 pl-1">{poNoError}</p>}
              {editingNo  && <p className="text-[10px] text-slate-400 font-semibold mt-1 pl-1">PO No. cannot be changed after creation.</p>}
            </div>

            {/* PO Date & Delivery Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <div>
                <label className={labelCls}>Expected Delivery Date <span className="text-slate-400 font-semibold normal-case">(Optional)</span></label>
                <input
                  type="date"
                  value={formData.delivery_date}
                  onChange={set('delivery_date')}
                  className={inputCls}
                  onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                  onBlur={(e)  => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                />
              </div>
            </div>

            {/* Quotation Autocomplete */}
            <div ref={qtnRef} className="relative">
              <label className={labelCls}>Link to Quotation No. <span className="text-slate-400 font-semibold normal-case">(Optional)</span></label>
              <input
                type="text"
                disabled={!!editingNo || !!queryQuotationNo}
                placeholder="Type Quotation No. to link..."
                value={qtnInput}
                onChange={(e) => handleQtnInput(e.target.value)}
                className={inputCls}
                onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                onBlur={(e)  => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                autoComplete="off"
              />
              {showQtnDropdown && qtnSuggestions.length > 0 && (
                <div className="absolute z-30 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                  {qtnSuggestions.map((qtn) => (
                    <button
                      key={qtn.quotation_no}
                      type="button"
                      onClick={() => selectQuotation(qtn)}
                      className="w-full text-left px-3.5 py-2 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                    >
                      <div className="font-bold text-xs text-slate-900">{qtn.quotation_no}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        RFQ: {qtn.rfq_no || '—'} &bull; Customer: {qtn.customer_id || '—'} &bull; {Array.isArray(qtn.items) ? qtn.items.length : 0} items
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {qtnNotFound && (
                <div className="mt-2 flex items-center gap-1.5 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs font-bold">
                  <AlertCircle size={13} className="shrink-0" />
                  No Quotation found for "{qtnInput}".
                </div>
              )}
              {selectedQuotation && (
                <div className="mt-2 flex flex-wrap gap-2.5 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5">
                  <span className="text-emerald-600">✓ Quotation Linked</span>
                  {selectedQuotation.rfq_no      && <><span className="text-slate-300">|</span><span>RFQ: {selectedQuotation.rfq_no}</span></>}
                  {selectedQuotation.customer_id && <><span className="text-slate-300">|</span><span>Customer: {selectedQuotation.customer_id}</span></>}
                </div>
              )}
              {(editingNo || queryQuotationNo) && (
                <p className="text-[10px] text-slate-400 font-semibold mt-1 pl-1">
                  Quotation link cannot be modified for existing purchase orders.
                </p>
              )}
            </div>

            {/* Items Section */}
            <div className="border-t border-slate-200 pt-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-800 m-0 uppercase tracking-wider">PO Items &amp; Pricing</h3>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-slate-400">{poItems.filter(i=>i.selected).length} of {poItems.length} selected</span>
                  <button
                    type="button"
                    onClick={() => {
                      const allSelected = poItems.every(i => i.selected);
                      setPoItems(prev => prev.map(i => ({ ...i, selected: !allSelected })));
                    }}
                    className="text-[10px] text-blue-600 hover:text-blue-700 font-bold hover:underline cursor-pointer"
                  >
                    {poItems.every(i => i.selected) ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
              </div>

              {/* Items List */}
              {poItems.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-slate-300 rounded-lg bg-slate-50">
                  <p className="text-xs text-slate-400 font-semibold m-0">No items linked to this Quotation. Please link a valid Quotation above.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {poItems.map((item) => {
                    const basic = calcItemBasic(item);
                    const gstVal = calcItemGst(item);
                    const total  = calcItemTotal(item);

                    return (
                      <div
                        key={item.item_code}
                        className={`border rounded-lg p-4 transition-all duration-150 ${item.selected ? 'bg-slate-50/50 border-slate-300 shadow-sm' : 'bg-slate-100/50 border-slate-200 opacity-60'}`}
                      >
                        {/* Header: Checkbox + Code + Details */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => toggleItem(item.item_code)}
                              className="text-slate-600 hover:text-slate-900 transition-colors cursor-pointer shrink-0"
                            >
                              {item.selected ? <CheckSquare size={17} style={{ color: 'var(--theme-color)' }} /> : <Square size={17} />}
                            </button>
                            <div>
                              <span className="font-mono font-black text-xs px-2 py-0.5 border rounded"
                                style={{ color: 'var(--theme-color)', borderColor: 'var(--theme-color)', backgroundColor: 'rgba(217,53,45,0.05)' }}>
                                {item.item_code}
                              </span>
                              <p className="text-xs font-bold text-slate-700 mt-1">{item.description}</p>
                              {item.drawing_number && (
                                <p className="text-[9px] font-mono font-semibold text-slate-400 mt-0.5">Dwg No: {item.drawing_number}</p>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeRoItem(item.item_code)}
                            className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded border border-transparent hover:border-red-100 transition-colors cursor-pointer shrink-0"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        {/* Fields (only enabled if item selected) */}
                        {item.selected && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 border-t border-slate-200 pt-3">
                            {/* Quantity & Unit Price */}
                            <div>
                              <label className={labelCls}>Quantity</label>
                              <input
                                type="number"
                                min="1"
                                required
                                value={item.quantity}
                                onChange={(e) => updateItem(item.item_code, 'quantity', e.target.value)}
                                className={inputCls}
                              />
                            </div>
                            <div>
                              <label className={labelCls}>Unit Price (₹)</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                required
                                value={item.unit_price}
                                onChange={(e) => updateItem(item.item_code, 'unit_price', e.target.value)}
                                className={inputCls}
                              />
                            </div>

                            {/* GST search-based autocomplete */}
                            <div ref={el => gstItemRefs.current[item.item_code] = el} className="relative">
                              <label className={labelCls}>GST Category</label>
                              <div className="relative">
                                <input
                                  type="text"
                                  placeholder="Type GST rate or type..."
                                  value={gstSearchInput[item.item_code] || ''}
                                  onChange={(e) => handleGstSearch(item.item_code, e.target.value)}
                                  onFocus={() => {
                                    const currentVal = gstSearchInput[item.item_code] || '';
                                    setGstDropdownOpen(prev => ({ ...prev, [item.item_code]: true }));
                                    fetchGstSuggestions(item.item_code, currentVal);
                                  }}
                                  className={inputCls + " pr-7"}
                                />
                                {item.gst_type && (
                                  <button
                                    type="button"
                                    onClick={() => clearItemGst(item.item_code)}
                                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                                  >
                                    <X size={12} />
                                  </button>
                                )}
                              </div>
                              {gstDropdownOpen[item.item_code] && (gstSuggestions[item.item_code] || []).length > 0 && (
                                <div className="absolute z-20 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg overflow-hidden max-h-40 overflow-y-auto">
                                  {(gstSuggestions[item.item_code] || []).map(g => (
                                    <button
                                      key={g.id}
                                      type="button"
                                      onClick={() => selectItemGst(item.item_code, g)}
                                      className="w-full text-left px-3 py-1.5 text-[11px] font-bold text-slate-800 hover:bg-blue-50 border-b border-slate-100 last:border-0 cursor-pointer"
                                    >
                                      {g.type} ({g.rate}%)
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Shipping address autocomplete */}
                            <div ref={el => shipItemRefs.current[item.item_code] = el} className="relative">
                              <label className={labelCls}>Shipping Address</label>
                              <div className="relative">
                                <input
                                  type="text"
                                  placeholder="Type address or search customer..."
                                  value={shipInput[item.item_code] || ''}
                                  onChange={(e) => handleShipInput(item.item_code, e.target.value)}
                                  onFocus={() => {
                                    const currentVal = shipInput[item.item_code] || '';
                                    setShipDropdownOpen(prev => ({ ...prev, [item.item_code]: true }));
                                    fetchShipSuggestions(item.item_code, currentVal);
                                  }}
                                  className={inputCls + " pr-7"}
                                />
                                {shipInput[item.item_code] && (
                                  <button
                                    type="button"
                                    onClick={() => clearShip(item.item_code)}
                                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                                  >
                                    <X size={12} />
                                  </button>
                                )}
                              </div>
                              {shipDropdownOpen[item.item_code] && (shipSuggestions[item.item_code] || []).length > 0 && (
                                <div className="absolute z-20 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg overflow-hidden max-h-40 overflow-y-auto">
                                  {(shipSuggestions[item.item_code] || []).slice(0, 5).map(c => (
                                    <button
                                      key={c.id}
                                      type="button"
                                      onClick={() => selectShipCustomer(item.item_code, c)}
                                      className="w-full text-left px-3 py-2 border-b border-slate-100 last:border-0 hover:bg-blue-50 transition-colors cursor-pointer"
                                    >
                                      <div className="font-bold text-[10px] text-slate-900 leading-tight">[{c.id}] {c.name}</div>
                                      <div className="text-[9px] text-slate-500 truncate mt-0.5">{c.address}</div>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Delivery Date */}
                            <div className="sm:col-span-2">
                              <label className={labelCls}>Expected Delivery Date</label>
                              <input
                                type="date"
                                value={item.delivery_date || ''}
                                onChange={(e) => updateItem(item.item_code, 'delivery_date', e.target.value)}
                                className={inputCls}
                              />
                            </div>
                          </div>
                        )}

                        {/* pricing footer snippet */}
                        {item.selected && (
                          <div className="mt-3.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500">
                            <div>
                              <span>Basic: ₹{fmt(basic)}</span>
                              {gstVal > 0 && <span className="ml-3">GST ({item.gst_rate}%): ₹{fmt(gstVal)}</span>}
                            </div>
                            <span className="text-slate-800 font-extrabold">Item Total: ₹{fmt(total)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Other Charges */}
            <div>
              <label className={labelCls}>Other Charges</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { field: 'transport',       label: 'Transport (₹)' },
                  { field: 'packing_forward', label: 'Packing & Fwd (₹)' },
                  { field: 'other',           label: 'Other (₹)' },
                  { field: 'basic_value',     label: 'Add. Basic Value (₹)' },
                ].map(({ field, label }) => (
                  <div key={field}>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={formData[field]}
                      onChange={set(field)}
                      className="w-full px-2.5 py-1.5 text-sm bg-white border border-slate-300 rounded font-medium focus:outline-none text-slate-800"
                      onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                      onBlur={(e)  => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Summary Footer */}
            <div className="border-t border-slate-200 pt-5 space-y-2">
              <div className="flex justify-between text-xs font-bold text-slate-500">
                <span>Items Total:</span>
                <span className="font-mono">₹{fmt(calcBasicTotal() + calcGstTotal())}</span>
              </div>
              <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-100">
                <span>Grand Total:</span>
                <span className="font-mono text-lg" style={{ color: 'var(--theme-color)' }}>₹{fmt(calcGrandTotal())}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-50 rounded-lg font-semibold text-sm text-slate-700 transition-colors cursor-pointer"
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
                ) : editingNo ? (
                  <><RefreshCw size={14} /> Update PO</>
                ) : (
                  <><Plus size={14} /> Save Purchase Order</>
                )}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}
