import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Plus,
  RefreshCw,
  X
} from 'lucide-react';

const labelCls = "block text-xs font-bold text-slate-700 uppercase mb-1.5";
const inputCls = "w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm placeholder:text-slate-400 font-medium focus:outline-none transition-colors duration-150 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed";

export default function ReceivedPurchaseOrderForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const queryQuotationNo = searchParams.get('quotation_no');
  const queryTradeId     = searchParams.get('trade_id');
  const editingNo        = id || null;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState(null);

  // Received Quotation autocomplete
  const [quotations, setQuotations]               = useState([]);
  const [qtnInput, setQtnInput]                   = useState('');
  const [qtnSuggestions, setQtnSuggestions]       = useState([]);
  const [showQtnDropdown, setShowQtnDropdown]     = useState(false);
  const [qtnNotFound, setQtnNotFound]             = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const qtnRef = useRef(null);

  // All GST rates from DB
  const [gstRates, setGstRates] = useState([]);

  // Customers list for shipping address search
  const [customers, setCustomers] = useState([]);

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

  useEffect(() => {
    fetchQuotations();
    fetchGstRates();
    fetchCustomers();
  }, []);

  useEffect(() => {
    if (editingNo) {
      fetchPoDetails(editingNo);
    } else {
      fetchNextPoNo();
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
      const res = await fetch('/api/received-quotations');
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
      if (res.ok) setCustomers(await res.json());
    } catch (err) { console.error(err); }
  };

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

  // Received Quotation autocomplete
  const handleQtnInput = (value) => {
    setQtnInput(value);
    setFormData(prev => ({ ...prev, quotation_no: '' }));
    setSelectedQuotation(null);
    setPoItems([]);
    setGstSearchInput({});
    if (!value.trim()) { setQtnSuggestions([]); setShowQtnDropdown(false); setQtnNotFound(false); return; }
    const matches = quotations.filter(q => q.received_quotation_no.toLowerCase().includes(value.toLowerCase()));
    setQtnSuggestions(matches);
    setShowQtnDropdown(true);
    setQtnNotFound(matches.length === 0);
  };

  const selectQuotation = (qtn) => {
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
  const handleShipSearch = (itemCode, value) => {
    setShipInput(prev => ({ ...prev, [itemCode]: value }));
    setPoItems(prev => prev.map(i => i.item_code === itemCode ? { ...i, shipping_address: '' } : i));
    setShipDropdownOpen(prev => ({ ...prev, [itemCode]: value.trim().length > 0 }));
  };

  const selectItemShip = (itemCode, cust) => {
    setPoItems(prev => prev.map(i =>
      i.item_code === itemCode ? { ...i, shipping_address: cust.address } : i
    ));
    setShipInput(prev => ({ ...prev, [itemCode]: `${cust.name} (${cust.address})` }));
    setShipDropdownOpen(prev => ({ ...prev, [itemCode]: false }));
  };

  const clearItemShip = (itemCode) => {
    setPoItems(prev => prev.map(i =>
      i.item_code === itemCode ? { ...i, shipping_address: '' } : i
    ));
    setShipInput(prev => ({ ...prev, [itemCode]: '' }));
    setShipDropdownOpen(prev => ({ ...prev, [itemCode]: false }));
  };

  const getShipSuggestions = (itemCode) => {
    const query = (shipInput[itemCode] || '').toLowerCase();
    if (!query) return customers;
    return customers.filter(c =>
      c.name.toLowerCase().includes(query) || c.address.toLowerCase().includes(query)
    );
  };

  // Item select/deselect/quantity change
  const handleItemSelectToggle = (itemCode) => {
    setPoItems(prev => prev.map(i => i.item_code === itemCode ? { ...i, selected: !i.selected } : i));
  };

  const handleItemValueChange = (itemCode, field, val) => {
    setPoItems(prev => prev.map(i => i.item_code === itemCode ? { ...i, [field]: val } : i));
  };

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

    const finalPoNo = editingNo || formData.po_no || nextPoNo;
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
        alert(`Purchase Order ${editingNo ? 'updated' : 'created'} successfully!`);
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
            {editingNo ? 'Modify Purchase Order' : 'Create Purchase Order'}
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            {editingNo
              ? 'Update commercial purchase details and terms.'
              : 'Raise a purchase order linked to a received quotation proposal.'}
          </p>
        </div>

        <div className="bg-white border border-slate-300 rounded-lg p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-4">
              
              {/* PO No & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>PO ID</label>
                  <input
                    type="text"
                    disabled
                    value={editingNo ? formData.po_no : nextPoNo || 'Generating...'}
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded text-sm text-slate-500 cursor-not-allowed font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-400 font-semibold mt-1.5 pl-1">
                    PO ID is auto-generated.
                  </p>
                </div>
                <div>
                  <label className={labelCls}>PO Date <b className="text-red-500">*</b></label>
                  <input
                    type="date"
                    required
                    value={formData.po_date}
                    onChange={set('po_date')}
                    className={inputCls}
                    onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                    onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                  />
                </div>
              </div>

              {/* Received Quotation Lookup */}
              <div ref={qtnRef} className="relative">
                <label className={labelCls}>Received Quotation <b className="text-red-500">*</b></label>
                <input
                  type="text"
                  required
                  disabled={!!editingNo}
                  placeholder="Search and link received quotation number..."
                  value={qtnInput}
                  onChange={(e) => handleQtnInput(e.target.value)}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--theme-color)';
                    if (qtnInput.trim()) setShowQtnDropdown(true);
                  }}
                  onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                  className={inputCls}
                  autoComplete="off"
                />
                {showQtnDropdown && qtnSuggestions.length > 0 && (
                  <div className="absolute z-30 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                    {qtnSuggestions.map((q) => (
                      <button
                        key={q.received_quotation_no}
                        type="button"
                        onClick={() => selectQuotation(q)}
                        className="w-full text-left px-3.5 py-2 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                      >
                        <div className="font-bold text-xs text-slate-900">{q.received_quotation_no}</div>
                        <div className="text-[10px] text-slate-500">Date: {new Date(q.quotation_date).toLocaleDateString('en-IN')} &bull; Seller: {q.buyer_name}</div>
                      </button>
                    ))}
                  </div>
                )}
                {qtnNotFound && (
                  <div className="mt-2 flex items-center justify-between gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs font-bold">
                    <div className="flex items-center gap-1.5">
                      <AlertCircle size={13} className="shrink-0" />
                      <span>No received quotation found for "{qtnInput}".</span>
                    </div>
                  </div>
                )}
                {formData.quotation_no && (
                  <div className="mt-2 flex flex-wrap gap-2.5 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5">
                    <span className="text-emerald-600">✓ Quotation linked</span>
                    <span className="text-slate-300">|</span>
                    <span>Seller: {selectedQuotation ? selectedQuotation.buyer_name : 'Linked'}</span>
                  </div>
                )}
              </div>

              {/* Items Section */}
              {poItems.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-extrabold text-slate-800 m-0 uppercase tracking-wider">Quotation Items</h3>
                    <span className="text-[10px] font-bold text-slate-400">{poItems.filter(i=>i.selected).length} selected</span>
                  </div>
                  
                  <div className="space-y-4">
                    {poItems.map((item) => {
                      const isSelected = item.selected;
                      return (
                        <div
                          key={item.item_code}
                          className={`border rounded-lg p-4 transition-all ${isSelected ? 'border-slate-300 bg-white' : 'border-slate-200 bg-slate-50/50 opacity-75'}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleItemSelectToggle(item.item_code)}
                                className="w-4 h-4 cursor-pointer accent-blue-600"
                              />
                              <div>
                                <span className="font-mono font-bold text-xs text-slate-900 border px-1.5 py-0.25 rounded" style={{ color: 'var(--theme-color)', borderColor: 'var(--theme-color)', backgroundColor: 'rgba(217, 53, 45, 0.05)' }}>
                                  {item.item_code}
                                </span>
                                {item.drawing_number && (
                                  <span className="text-[10px] text-slate-400 ml-2">DRW: {item.drawing_number}</span>
                                )}
                                <p className="text-xs text-slate-600 font-semibold mt-1">{item.description}</p>
                              </div>
                            </div>
                          </div>

                          {isSelected && (
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-100">
                              {/* Quantity */}
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Quantity</label>
                                <input
                                  type="number"
                                  min="1"
                                  required
                                  value={item.quantity}
                                  onChange={(e) => handleItemValueChange(item.item_code, 'quantity', e.target.value)}
                                  className={inputCls}
                                  onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                                  onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                                />
                              </div>

                              {/* Unit Price */}
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Unit Price (₹)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  required
                                  value={item.unit_price}
                                  onChange={(e) => handleItemValueChange(item.item_code, 'unit_price', e.target.value)}
                                  className={inputCls}
                                  onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                                  onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                                />
                              </div>

                              {/* GST autocomplete */}
                              <div ref={el => gstItemRefs.current[item.item_code] = el} className="relative">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">GST Rate</label>
                                <div className="relative">
                                  <input
                                    type="text"
                                    placeholder="Search GST..."
                                    value={gstSearchInput[item.item_code] || ''}
                                    onChange={(e) => handleGstSearch(item.item_code, e.target.value)}
                                    onFocus={() => setGstDropdownOpen(prev => ({ ...prev, [item.item_code]: true }))}
                                    className={inputCls}
                                    onFocusCapture={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                                    onBlurCapture={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                                    autoComplete="off"
                                  />
                                  {gstSearchInput[item.item_code] && (
                                    <button
                                      type="button"
                                      onClick={() => clearItemGst(item.item_code)}
                                      className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                    >
                                      <X size={14} />
                                    </button>
                                  )}
                                </div>
                                {gstDropdownOpen[item.item_code] && (
                                  <div className="absolute z-20 w-full mt-1 bg-white border border-slate-300 rounded shadow-lg max-h-36 overflow-y-auto">
                                    {getGstSuggestions(item.item_code).map(g => (
                                      <button
                                        key={g.id}
                                        type="button"
                                        onClick={() => selectItemGst(item.item_code, g)}
                                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 border-b border-slate-100 last:border-0 cursor-pointer"
                                      >
                                        {g.type} ({g.rate}%)
                                      </button>
                                    ))}
                                    {getGstSuggestions(item.item_code).length === 0 && (
                                      <div className="p-2 text-center text-[10px] text-slate-400 font-semibold">No matches</div>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Shipping address autocomplete */}
                              <div ref={el => shipItemRefs.current[item.item_code] = el} className="relative">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Ship To Address</label>
                                <div className="relative">
                                  <input
                                    type="text"
                                    placeholder="Search Customer..."
                                    value={shipInput[item.item_code] || ''}
                                    onChange={(e) => handleShipSearch(item.item_code, e.target.value)}
                                    onFocus={() => setShipDropdownOpen(prev => ({ ...prev, [item.item_code]: true }))}
                                    className={inputCls}
                                    onFocusCapture={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                                    onBlurCapture={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                                    autoComplete="off"
                                  />
                                  {shipInput[item.item_code] && (
                                    <button
                                      type="button"
                                      onClick={() => clearItemShip(item.item_code)}
                                      className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                    >
                                      <X size={14} />
                                    </button>
                                  )}
                                </div>
                                {shipDropdownOpen[item.item_code] && (
                                  <div className="absolute z-20 w-full mt-1 bg-white border border-slate-300 rounded shadow-lg max-h-36 overflow-y-auto">
                                    {getShipSuggestions(item.item_code).map(c => (
                                      <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => selectItemShip(item.item_code, c)}
                                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 border-b border-slate-100 last:border-0 cursor-pointer"
                                      >
                                        <div className="font-bold">{c.name}</div>
                                        <div className="text-[9px] text-slate-500 truncate">{c.address}</div>
                                      </button>
                                    ))}
                                    {getShipSuggestions(item.item_code).length === 0 && (
                                      <div className="p-2 text-center text-[10px] text-slate-400 font-semibold">No matches</div>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Item delivery date */}
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Delivery Date</label>
                                <input
                                  type="date"
                                  value={item.delivery_date || ''}
                                  onChange={(e) => handleItemValueChange(item.item_code, 'delivery_date', e.target.value)}
                                  className={inputCls}
                                  onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                                  onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                                />
                              </div>

                              {/* Item values summary row */}
                              <div className="md:col-span-4 mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500">
                                <span>Basic: ₹{fmt(calcItemBasic(item))}</span>
                                <span>GST: ₹{fmt(calcItemGst(item))} ({item.gst_type || 'None'} {item.gst_rate ? `${item.gst_rate}%` : ''})</span>
                                <span className="text-slate-800">Total: ₹{fmt(calcItemTotal(item))}</span>
                              </div>

                            </div>
                          )}

                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Delivery Date */}
              <div>
                <label className={labelCls}>Global Delivery Date</label>
                <input
                  type="date"
                  value={formData.delivery_date}
                  onChange={set('delivery_date')}
                  className={inputCls}
                  onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                  onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                />
              </div>

              {/* Additional Charges / Adjustments */}
              <div className="space-y-3 pt-3 border-t border-slate-200">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block">Additional Charges</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'Transport (₹)',          key: 'transport' },
                    { label: 'Packing & Fwd (₹)',      key: 'packing_forward' },
                    { label: 'Other (₹)',              key: 'other' },
                    { label: 'Add. Basic Value (₹)',   key: 'basic_value' },
                  ].map(c => (
                    <div key={c.key}>
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">{c.label}</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData[c.key]}
                        onChange={set(c.key)}
                        className={inputCls}
                        onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                        onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Calculation Summary Card */}
              {poItems.filter(i => i.selected).length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded p-4 space-y-2">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block border-b border-slate-200 pb-1.5">PO Value Calculation Summary</span>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="flex flex-col bg-white border border-slate-200 rounded p-2">
                      <span className="text-[9px] font-extrabold text-slate-400 uppercase">Items Basic Value</span>
                      <span className="text-sm font-bold text-slate-800 mt-0.5">₹{fmt(calcBasicTotal())}</span>
                    </div>
                    <div className="flex flex-col bg-white border border-slate-200 rounded p-2">
                      <span className="text-[9px] font-extrabold text-slate-400 uppercase">Total GST</span>
                      <span className="text-sm font-bold text-slate-800 mt-0.5">₹{fmt(calcGstTotal())}</span>
                    </div>
                    <div className="flex flex-col bg-white border border-slate-200 rounded p-2 col-span-2">
                      <span className="text-[9px] font-extrabold text-slate-400 uppercase">Charges &amp; Adjustments</span>
                      <span className="text-sm font-bold text-slate-800 mt-0.5">
                        ₹{fmt(
                          (parseFloat(formData.transport) || 0) +
                          (parseFloat(formData.packing_forward) || 0) +
                          (parseFloat(formData.other) || 0) +
                          (parseFloat(formData.basic_value) || 0)
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-200 mt-2">
                    <span className="text-xs font-black text-slate-700 uppercase">Grand Total PO Value</span>
                    <span className="text-base font-black text-blue-800">₹{fmt(calcGrandTotal())}</span>
                  </div>
                </div>
              )}

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
                    <RefreshCw size={13} className="animate-spin" /> Update Purchase Order
                  </>
                ) : (
                  <>
                    <Plus size={13} /> Create Purchase Order
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
