import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Plus, RefreshCw, X, CheckSquare, Square } from 'lucide-react';
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
  const [quotations, setQuotations]               = useState([]);
  const [qtnInput, setQtnInput]                   = useState('');
  const [qtnSuggestions, setQtnSuggestions]       = useState([]);
  const [showQtnDropdown, setShowQtnDropdown]     = useState(false);
  const [qtnNotFound, setQtnNotFound]             = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const qtnRef = useRef(null);

  // All GST rates from DB (fetched once)
  const [gstRates, setGstRates] = useState([]);

  // Customers list for shipping address search
  const [customers, setCustomers] = useState([]);

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

  useEffect(() => {
    fetchQuotations();
    fetchGstRates();
    fetchCustomers();
  }, []);

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

  const fetchQuotations = async () => {
    try {
      const res = await fetch('/api/quotations');
      if (res.ok) setQuotations(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchGstRates = async () => {
    try {
      const res = await fetch('/api/gst-rates');
      if (res.ok) setGstRates(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      if (res.ok) setCustomers(await res.json()); // [{ id, name, address }]
    } catch (err) { console.error(err); }
  };

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
    setQtnInput(value);
    setFormData(prev => ({ ...prev, quotation_no: '' }));
    setSelectedQuotation(null);
    setPoItems([]);
    setGstSearchInput({});
    if (!value.trim()) { setQtnSuggestions([]); setShowQtnDropdown(false); setQtnNotFound(false); return; }
    const matches = quotations.filter(q => q.quotation_no.toLowerCase().includes(value.toLowerCase()));
    setQtnSuggestions(matches);
    setShowQtnDropdown(true);
    setQtnNotFound(matches.length === 0);
  };

  const selectQuotation = (qtn) => {
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

  // Per-item GST search handlers
  const handleGstSearch = (itemCode, value) => {
    setGstSearchInput(prev => ({ ...prev, [itemCode]: value }));
    // Clear selection on the item
    setPoItems(prev => prev.map(i => i.item_code === itemCode ? { ...i, gst_type: '', gst_rate: '' } : i));
    setGstDropdownOpen(prev => ({ ...prev, [itemCode]: value.trim().length > 0 }));
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

  const getGstSuggestions = (itemCode) => {
    const query = (gstSearchInput[itemCode] || '').toLowerCase();
    if (!query) return gstRates;
    return gstRates.filter(g =>
      g.type.toLowerCase().includes(query) || String(g.rate).includes(query)
    );
  };

  // Per-item shipping address handlers
  const handleShipInput = (itemCode, value) => {
    setShipInput(prev => ({ ...prev, [itemCode]: value }));
    updateItem(itemCode, 'shipping_address', value);
    setShipDropdownOpen(prev => ({ ...prev, [itemCode]: true }));
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

  const getShipSuggestions = (itemCode) => {
    const query = (shipInput[itemCode] || '').toLowerCase();
    if (!query) return customers;
    return customers.filter(c =>
      c.id.toLowerCase().includes(query) ||
      c.name.toLowerCase().includes(query) ||
      (c.address || '').toLowerCase().includes(query)
    );
  };

  // Item toggle
  const toggleItem = (itemCode) =>
    setPoItems(prev => prev.map(i => i.item_code === itemCode ? { ...i, selected: !i.selected } : i));

  const updateItem = (itemCode, field, value) =>
    setPoItems(prev => prev.map(i => i.item_code === itemCode ? { ...i, [field]: value } : i));

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
            {poItems.length > 0 && (
              <div>
                <label className={labelCls}>Items</label>
                <div className="border border-slate-300 rounded-lg overflow-visible bg-slate-50">
                  {/* Items header */}
                  <div className="bg-slate-100 px-4 py-2 border-b border-slate-300 flex justify-between items-center rounded-t-lg">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Select Items ({poItems.filter(i => i.selected).length} of {poItems.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const allSelected = poItems.every(i => i.selected);
                        setPoItems(prev => prev.map(i => ({ ...i, selected: !allSelected })));
                      }}
                      className="text-xs text-blue-600 hover:text-blue-700 font-bold hover:underline cursor-pointer"
                    >
                      {poItems.every(i => i.selected) ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  {/* Items list */}
                  <div className="divide-y divide-slate-200">
                    {poItems.map((item) => (
                      <div
                        key={item.item_code}
                        className={`px-4 py-3 bg-white transition-colors ${!item.selected ? 'opacity-50' : ''}`}
                      >
                        {/* Row 1: checkbox + item info + price */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0 flex-1 mr-4">
                            <button
                              type="button"
                              onClick={() => toggleItem(item.item_code)}
                              className="focus:outline-none shrink-0 cursor-pointer"
                              style={{ color: 'var(--theme-color)' }}
                            >
                              {item.selected ? <CheckSquare size={18} /> : <Square size={18} className="text-slate-400" />}
                            </button>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className="font-mono font-bold text-xs border px-1.5 py-0.5 rounded"
                                  style={{ color: 'var(--theme-color)', borderColor: 'var(--theme-color)', backgroundColor: 'rgba(217, 53, 45, 0.05)' }}
                                >
                                  {item.item_code}
                                </span>
                                {item.drawing_number && (
                                  <span className="text-[10px] text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                                    DRW: {item.drawing_number}
                                  </span>
                                )}
                                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 shrink-0">
                                  <span className="text-[10px] text-slate-400 font-bold">Qty:</span>
                                  <input
                                    type="number"
                                    min="1"
                                    value={item.quantity}
                                    onChange={(e) => updateItem(item.item_code, 'quantity', parseInt(e.target.value) || 0)}
                                    className="w-12 text-[10px] font-bold text-slate-700 bg-white border border-slate-300 rounded text-center focus:outline-none focus:border-[var(--theme-color)]"
                                  />
                                </div>
                              </div>
                              {item.description && <p className="text-[10px] text-slate-500 mt-1 truncate">{item.description}</p>}
                            </div>
                          </div>
                          {/* Unit price + line total */}
                          <div className="shrink-0 text-right">
                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Unit Price</div>
                            <div className="font-bold text-sm text-slate-800">₹{fmt(item.unit_price)}</div>
                          </div>
                        </div>

                        {/* Row 2: per-item fields (only when selected) */}
                        {item.selected && (
                          <div className="mt-3 pl-9 space-y-3">

                            {/* GST search per item */}
                            <div
                              className="relative"
                              ref={el => { if (el) gstItemRefs.current[item.item_code] = el; }}
                            >
                              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 block">
                                GST / Tax <span className="normal-case font-semibold">(Optional)</span>
                              </label>
                              <div className="relative">
                                <input
                                  type="text"
                                  placeholder="Search GST type... e.g. IGST 18%"
                                  value={gstSearchInput[item.item_code] || ''}
                                  onChange={(e) => handleGstSearch(item.item_code, e.target.value)}
                                  onFocus={() => setGstDropdownOpen(prev => ({ ...prev, [item.item_code]: true }))}
                                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded font-medium placeholder:text-slate-400 focus:outline-none focus:border-[var(--theme-color)] pr-7"
                                  autoComplete="off"
                                />
                                {item.gst_type && (
                                  <button
                                    type="button"
                                    onClick={() => clearItemGst(item.item_code)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 cursor-pointer"
                                  >
                                    <X size={12} />
                                  </button>
                                )}
                              </div>

                              {/* GST dropdown */}
                              {gstDropdownOpen[item.item_code] && (
                                <div className="absolute z-40 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg overflow-hidden max-h-44 overflow-y-auto">
                                  {getGstSuggestions(item.item_code).length > 0 ? (
                                    getGstSuggestions(item.item_code).map((g) => (
                                      <button
                                        key={g.id}
                                        type="button"
                                        onClick={() => selectItemGst(item.item_code, g)}
                                        className="w-full text-left px-3.5 py-2 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                                      >
                                        <div className="font-bold text-xs text-slate-900">{g.type}</div>
                                        <div className="text-[10px] text-slate-500 mt-0.5">
                                          {g.rate}% &bull; On ₹{fmt(calcItemBasic(item))} = <span className="font-bold text-slate-700">₹{fmt((calcItemBasic(item) * g.rate) / 100)}</span>
                                        </div>
                                      </button>
                                    ))
                                  ) : (
                                    <div className="px-3.5 py-3 text-[10px] text-slate-400 font-medium">No GST rates found.</div>
                                  )}
                                </div>
                              )}

                              {/* GST linked indicator */}
                              {item.gst_type && (
                                <div className="mt-1.5 flex flex-wrap gap-2 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded px-2 py-1">
                                  <span className="text-emerald-600">✓ {item.gst_type} @ {item.gst_rate}%</span>
                                  <span className="text-slate-300">|</span>
                                  <span>GST: ₹{fmt(calcItemGst(item))}</span>
                                  <span className="text-slate-300">|</span>
                                  <span className="text-slate-800">Item Total: ₹{fmt(calcItemTotal(item))}</span>
                                </div>
                              )}
                            </div>

                            {/* Shipping Address (customer search) & Delivery Date */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {/* Shipping Address — customer search */}
                              <div
                                className="relative"
                                ref={el => { if (el) shipItemRefs.current[item.item_code] = el; }}
                              >
                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 block">
                                  Shipping Address <span className="normal-case font-semibold">(Optional)</span>
                                </label>
                                <div className="relative">
                                  <input
                                    type="text"
                                    placeholder="Search by Customer ID or name…"
                                    value={shipInput[item.item_code] || ''}
                                    onChange={(e) => handleShipInput(item.item_code, e.target.value)}
                                    onFocus={() => setShipDropdownOpen(prev => ({ ...prev, [item.item_code]: true }))}
                                    autoComplete="off"
                                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded font-medium placeholder:text-slate-400 focus:outline-none focus:border-[var(--theme-color)] pr-6"
                                  />
                                  {shipInput[item.item_code] && (
                                    <button
                                      type="button"
                                      onClick={() => clearShip(item.item_code)}
                                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 cursor-pointer"
                                    >
                                      <X size={11} />
                                    </button>
                                  )}
                                </div>

                                {/* Customer dropdown */}
                                {shipDropdownOpen[item.item_code] && (
                                  <div className="absolute z-40 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                                    {getShipSuggestions(item.item_code).length > 0 ? (
                                      getShipSuggestions(item.item_code).map((c) => (
                                        <button
                                          key={c.id}
                                          type="button"
                                          onClick={() => selectShipCustomer(item.item_code, c)}
                                          className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                                        >
                                          <div className="flex items-center gap-2">
                                            <span className="font-mono font-bold text-[10px] px-1 py-0.5 rounded border"
                                              style={{ color: 'var(--theme-color)', borderColor: 'var(--theme-color)', backgroundColor: 'rgba(217,53,45,0.05)' }}>
                                              {c.id}
                                            </span>
                                            <span className="font-bold text-xs text-slate-900">{c.name}</span>
                                          </div>
                                          <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{c.address}</div>
                                        </button>
                                      ))
                                    ) : (
                                      <div className="px-3 py-3 text-[10px] text-slate-400 font-medium">No customers found.</div>
                                    )}
                                  </div>
                                )}

                                {/* Filled address preview */}
                                {item.shipping_address && !shipDropdownOpen[item.item_code] && (
                                  <p className="mt-1 text-[10px] text-slate-500 font-medium line-clamp-2 pl-0.5">
                                    📍 {item.shipping_address}
                                  </p>
                                )}
                              </div>

                              {/* Delivery Date */}
                              <div>
                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 block">
                                  Item Delivery Date <span className="normal-case font-semibold">(Optional)</span>
                                </label>
                                <input
                                  type="date"
                                  value={item.delivery_date}
                                  onChange={(e) => updateItem(item.item_code, 'delivery_date', e.target.value)}
                                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded font-medium focus:outline-none focus:border-[var(--theme-color)]"
                                />
                              </div>
                            </div>

                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Totals footer */}
                  <div className="bg-slate-100 px-4 py-2.5 border-t border-slate-300 rounded-b-lg flex flex-col items-end gap-0.5">
                    <span className="text-[10px] font-bold text-slate-500">Items Basic: ₹{fmt(calcBasicTotal())}</span>
                    {calcGstTotal() > 0 && (
                      <span className="text-[10px] font-bold text-slate-500">GST Total: ₹{fmt(calcGstTotal())}</span>
                    )}
                    <span className="text-xs font-bold text-slate-800 border-t border-slate-300 pt-0.5 mt-0.5">
                      Items Sub-Total: ₹{fmt(calcBasicTotal() + calcGstTotal())}
                    </span>
                  </div>
                </div>
              </div>
            )}

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

            {/* Grand Total */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Estimated Grand Total</span>
              <span className="text-base font-black text-slate-900">₹{fmt(calcGrandTotal())}</span>
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
