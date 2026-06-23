import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Plus, RefreshCw, X, CheckSquare, Square, Search, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';

const labelCls = "block text-xs font-bold text-slate-700 uppercase mb-1.5";
const inputCls = "w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm placeholder:text-slate-400 font-medium focus:outline-none transition-colors duration-150 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed";

export default function ReleaseOrderForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const queryTradeId = searchParams.get('trade_id');
  const editingNo    = id || null;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState(null);
  const [roNoError, setRoNoError] = useState('');

  // Buyers search state
  const [buyerInput, setBuyerInput]         = useState('');
  const [buyerSuggestions, setBuyerSuggestions] = useState([]);
  const [showBuyerDropdown, setShowBuyerDropdown] = useState(false);
  const [buyerNotFound, setBuyerNotFound]     = useState(false);
  const [selectedBuyer, setSelectedBuyer]     = useState(null);
  const buyerRef = useRef(null);

  // Customers search state (for Seller/Customer)
  const [customerInput, setCustomerInput]       = useState('');
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerNotFound, setCustomerNotFound] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const customerRef = useRef(null);

  // Items search (to add items to RO)
  const [itemSearchInput, setItemSearchInput] = useState('');
  const [itemSuggestions, setItemSuggestions] = useState([]);
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const itemSearchRef = useRef(null);

  // Per-item GST search state keyed by item_code
  const [gstSearchInput, setGstSearchInput]   = useState({});  // { item_code: string }
  const [gstDropdownOpen, setGstDropdownOpen] = useState({});  // { item_code: bool }
  const [gstSuggestions, setGstSuggestions]   = useState({});  // { item_code: array }
  const gstItemRefs = useRef({});
  const gstTimeoutRefs = useRef({});

  // Per-item shipping address search state
  const [shipInput, setShipInput]           = useState({});  // { item_code: string (display) }
  const [shipDropdownOpen, setShipDropdownOpen] = useState({});  // { item_code: bool }
  const [shipSuggestions, setShipSuggestions]   = useState({});  // { item_code: array }
  const shipItemRefs = useRef({});
  const shipTimeoutRefs = useRef({});

  // RO items in form
  const [roItems, setRoItems] = useState([]);

  // Form data
  const [formData, setFormData] = useState({
    ro_no:           '',
    contract_ref:    '',
    ro_date:         new Date().toISOString().split('T')[0],
    delivery_date:   '',
    transport:       '0',
    other:           '0',
    basic_value:     '0',
    packing_forward: '0',
    trade_id:        '',
  });

  useEffect(() => {
    if (editingNo) {
      fetchRoDetails(editingNo);
    } else {
      setFormData(prev => ({
        ...prev,
        ro_date: new Date().toISOString().split('T')[0]
      }));
      if (queryTradeId) {
        // Fetch RFQ items of this trade to prefill items if trade is active
        fetchTradeRfqItems(queryTradeId);
      }
    }
  }, [editingNo, queryTradeId]);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(gstTimeoutRefs.current).forEach(clearTimeout);
      Object.values(shipTimeoutRefs.current).forEach(clearTimeout);
    };
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (buyerRef.current && !buyerRef.current.contains(event.target)) {
        setShowBuyerDropdown(false);
      }
      if (customerRef.current && !customerRef.current.contains(event.target)) {
        setShowCustomerDropdown(false);
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

  // Debounced search for buyers (limit 5)
  useEffect(() => {
    const trimmed = buyerInput.trim();
    if (!trimmed) {
      setBuyerSuggestions([]);
      setShowBuyerDropdown(false);
      setBuyerNotFound(false);
      return;
    }

    if (selectedBuyer && selectedBuyer.name === buyerInput) {
      setShowBuyerDropdown(false);
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
  }, [buyerInput, selectedBuyer]);

  // Debounced search for customers (limit 5)
  useEffect(() => {
    const trimmed = customerInput.trim();
    if (!trimmed) {
      setCustomerSuggestions([]);
      setShowCustomerDropdown(false);
      setCustomerNotFound(false);
      return;
    }

    if (selectedCustomer && selectedCustomer.name === customerInput) {
      setShowCustomerDropdown(false);
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
  }, [customerInput, selectedCustomer]);

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

  const fetchNextNo = async () => {
    try {
      const res = await fetch('/api/release-orders/next-no');
      if (res.ok) {
        const data = await res.json();
        setFormData(prev => ({ ...prev, ro_no: data.nextNo }));
      }
    } catch (err) { console.error('Error fetching next RO no:', err); }
  };

  const fetchTradeRfqItems = async (tradeId) => {
    try {
      const res = await fetch(`/api/trades/${encodeURIComponent(tradeId)}`);
      if (res.ok) {
        const tradeData = await res.json();
        const rfqDoc = (tradeData.documents || []).find(d => d.type?.toUpperCase() === 'RFQ');
        if (rfqDoc) {
          const rfqRes = await fetch(`/api/rfqs/${encodeURIComponent(rfqDoc.id)}`);
          if (rfqRes.ok) {
            const rfqData = await rfqRes.json();
            // Pre-fill Buyer and Customer from RFQ
            if (rfqData.buyer_id) {
              fetchAndSelectBuyer(rfqData.buyer_id);
            }
            if (rfqData.customer_id) {
              fetchAndSelectCustomer(rfqData.customer_id);
            }
            if (Array.isArray(rfqData.items)) {
              const fetchedItems = await Promise.all(rfqData.items.map(async (i) => {
                let price = '0';
                try {
                  const arcRes = await fetch(`/api/arc-items?q=${encodeURIComponent(i.item_code)}&limit=1`);
                  if (arcRes.ok) {
                    const arcData = await arcRes.json();
                    const arcItem = arcData.find(ai => ai.item_code === i.item_code);
                    if (arcItem) price = String(arcItem.price);
                  }
                } catch (e) {
                  console.error('Error prefetching item price:', e);
                }
                return {
                  item_code:        i.item_code,
                  quantity:         i.quantity || 1,
                  unit_price:       price,
                  gst_type:         '',
                  gst_rate:         '',
                  shipping_address: '',
                  delivery_date:    '',
                  description:      i.description || '',
                  drawing_number:   i.drawing_number || '',
                  selected:         true
                };
              }));
              setRoItems(fetchedItems);
            }
          }
        }
      }
    } catch (err) { console.error('Error fetching trade details for pre-fill:', err); }
  };

  const fetchAndSelectBuyer = async (buyerId) => {
    try {
      const res = await fetch(`/api/buyers`);
      if (res.ok) {
        const list = await res.json();
        const b = list.find(x => x.id === buyerId);
        if (b) selectBuyer(b);
      }
    } catch (err) { console.error(err); }
  };

  const fetchAndSelectCustomer = async (custId) => {
    try {
      const res = await fetch(`/api/customers`);
      if (res.ok) {
        const list = await res.json();
        const c = list.find(x => x.id === custId);
        if (c) selectCustomer(c);
      }
    } catch (err) { console.error(err); }
  };

  const fetchRoDetails = async (roNo) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/release-orders/${encodeURIComponent(roNo)}`);
      if (!res.ok) throw new Error('Failed to fetch release order details');
      const ro = await res.json();

      setFormData({
        ro_no:           ro.ro_no,
        contract_ref:    ro.contract_ref || '',
        ro_date:         ro.ro_date ? ro.ro_date.split('T')[0] : '',
        delivery_date:   ro.delivery_date ? ro.delivery_date.split('T')[0] : '',
        transport:       String(ro.transport       || 0),
        other:           String(ro.other           || 0),
        basic_value:     String(ro.basic_value     || 0),
        packing_forward: String(ro.packing_forward || 0),
        trade_id:        ro.trade_id || '',
      });

      if (ro.buyer_id) {
        setSelectedBuyer({ id: ro.buyer_id, name: ro.buyer_name, email: ro.buyer_email, phone: ro.buyer_phone });
        setBuyerInput(ro.buyer_name || '');
      }
      if (ro.customer_id) {
        setSelectedCustomer({ id: ro.customer_id, name: ro.customer_name, address: ro.customer_address });
        setCustomerInput(ro.customer_name || '');
      }

      if (Array.isArray(ro.items)) {
        const items = ro.items.map(item => ({
          item_code:        item.item_code,
          quantity:         item.quantity,
          unit_price:       String(item.unit_price),
          gst_type:         item.gst_type  || '',
          gst_rate:         item.gst_rate  != null ? String(item.gst_rate) : '',
          shipping_address: item.shipping_address || '',
          delivery_date:    item.delivery_date ? item.delivery_date.split('T')[0] : '',
          description:      item.description  || '',
          drawing_number:   item.drawing_number || '',
          selected:         true
        }));
        setRoItems(items);

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
      setError(err.message || 'Connection error while fetching RO details.');
    } finally {
      setIsLoading(false);
    }
  };

  const set = (field) => (e) =>
    setFormData(prev => ({ ...prev, [field]: e.target.value }));

  // Buyer Autocomplete handlers
  const handleBuyerInput = (value) => {
    setBuyerInput(value);
    setSelectedBuyer(null);
    if (!value.trim()) { setBuyerSuggestions([]); setShowBuyerDropdown(false); setBuyerNotFound(false); }
  };

  const selectBuyer = (buyer) => {
    setSelectedBuyer(buyer);
    setBuyerInput(buyer.name);
    setShowBuyerDropdown(false);
    setBuyerNotFound(false);
  };

  // Customer Autocomplete handlers
  const handleCustomerInput = (value) => {
    setCustomerInput(value);
    setSelectedCustomer(null);
    if (!value.trim()) { setCustomerSuggestions([]); setShowCustomerDropdown(false); setCustomerNotFound(false); }
  };

  const selectCustomer = (cust) => {
    setSelectedCustomer(cust);
    setCustomerInput(cust.name);
    setShowCustomerDropdown(false);
    setCustomerNotFound(false);
  };

  // Item Autocomplete handlers
  const handleItemSearchInput = (value) => {
    setItemSearchInput(value);
    if (!value.trim()) { setItemSuggestions([]); setShowItemDropdown(false); }
  };

  const addRoItem = (item) => {
    // Check if already added
    if (roItems.some(i => i.item_code === item.item_code)) {
      toast.warn('Item already added.');
      return;
    }
    setRoItems(prev => [
      ...prev,
      {
        item_code:        item.item_code,
        quantity:         1,
        unit_price:       String(item.price || 0), // Pre-written from ARC price
        gst_type:         '',
        gst_rate:         '',
        shipping_address: '',
        delivery_date:    '',
        description:      item.description || '',
        drawing_number:   item.drawing_number || '',
        selected:         true
      }
    ]);
    setItemSearchInput('');
    setItemSuggestions([]);
    setShowItemDropdown(false);
  };

  const removeRoItem = (itemCode) => {
    setRoItems(prev => prev.filter(i => i.item_code !== itemCode));
  };

  // GST Search Suggestions On-Demand Fetcher
  const fetchGstSuggestions = (itemCode, val) => {
    if (gstTimeoutRefs.current[itemCode]) {
      clearTimeout(gstTimeoutRefs.current[itemCode]);
    }
    // Don't search if it's already selected format like "GST (18%)"
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
    setRoItems(prev => prev.map(i => i.item_code === itemCode ? { ...i, gst_type: '', gst_rate: '' } : i));
    setGstDropdownOpen(prev => ({ ...prev, [itemCode]: true }));
    fetchGstSuggestions(itemCode, value);
  };

  const selectItemGst = (itemCode, gst) => {
    setRoItems(prev => prev.map(i =>
      i.item_code === itemCode ? { ...i, gst_type: gst.type, gst_rate: String(gst.rate) } : i
    ));
    setGstSearchInput(prev => ({ ...prev, [itemCode]: `${gst.type} (${gst.rate}%)` }));
    setGstDropdownOpen(prev => ({ ...prev, [itemCode]: false }));
  };

  const clearItemGst = (itemCode) => {
    setRoItems(prev => prev.map(i =>
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
    setRoItems(prev => prev.map(i => i.item_code === itemCode ? { ...i, selected: !i.selected } : i));

  const updateItem = (itemCode, field, value) =>
    setRoItems(prev => prev.map(i => i.item_code === itemCode ? { ...i, [field]: value } : i));

  // Calculations
  const calcItemBasic   = (item) => (parseFloat(item.unit_price) || 0) * (parseInt(item.quantity) || 0);
  const calcItemGst     = (item) => (calcItemBasic(item) * (parseFloat(item.gst_rate) || 0)) / 100;
  const calcItemTotal   = (item) => calcItemBasic(item) + calcItemGst(item);

  const calcBasicTotal  = () => roItems.filter(i => i.selected).reduce((a, i) => a + calcItemBasic(i), 0);
  const calcGstTotal    = () => roItems.filter(i => i.selected).reduce((a, i) => a + calcItemGst(i), 0);
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
    setRoNoError('');

    if (!formData.ro_no.trim()) {
      setRoNoError('Release Order No. is required.');
      setIsLoading(false);
      return;
    }

    if (!selectedBuyer) {
      setError('Please select a Buyer.');
      setIsLoading(false);
      return;
    }

    if (!selectedCustomer) {
      setError('Please select a Customer (Seller).');
      setIsLoading(false);
      return;
    }

    const activeItems = roItems.filter(i => i.selected);
    if (activeItems.length === 0) {
      setError('Please select/add at least one item for the release order.');
      setIsLoading(false);
      return;
    }

    const payload = {
      ro_no:           editingNo || formData.ro_no.trim(),
      contract_ref:    formData.contract_ref || null,
      ro_date:         formData.ro_date,
      delivery_date:   formData.delivery_date || null,
      buyer_id:        selectedBuyer.id,
      customer_id:     selectedCustomer.id,
      trade_id:        queryTradeId || null,
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
      const url    = editingNo ? `/api/release-orders/${encodeURIComponent(editingNo)}` : '/api/release-orders';
      const method = editingNo ? 'PUT' : 'POST';
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Release Order ${editingNo ? 'updated' : 'created'} successfully!`);
        const finalTradeId = queryTradeId || data.trade_id || formData.trade_id;
        navigate(finalTradeId ? `/trade/${finalTradeId}` : '/');
      } else {
        const errData = await res.json();
        setError(errData.error || 'Failed to save release order');
      }
    } catch (err) {
      setError('Server connection error while saving release order.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 p-6 bg-slate-100 text-slate-900 min-h-screen">
      <div className="max-w-2xl mx-auto space-y-5">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 m-0">
            {editingNo ? 'Modify Release Order' : 'New Release Order'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {editingNo
              ? 'Update the details of an existing release order.'
              : 'Raise a release order for a trade pipeline.'}
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

            {/* RO No */}
            <div>
              <label className={labelCls}>Release Order No. <b className="text-red-500">*</b></label>
              <input
                type="text"
                required
                placeholder="e.g. RO-2024-001"
                value={formData.ro_no}
                onChange={(e) => { setFormData(prev => ({ ...prev, ro_no: e.target.value })); setRoNoError(''); }}
                disabled={!!editingNo}
                className={inputCls}
                onFocus={(e) => !editingNo && (e.target.style.borderColor = 'var(--theme-color)')}
                onBlur={(e)  => !editingNo && (e.target.style.borderColor = 'rgb(203, 213, 225)')}
              />
              {roNoError && <p className="text-[10px] text-red-500 font-semibold mt-1 pl-1">{roNoError}</p>}
              {editingNo  && <p className="text-[10px] text-slate-400 font-semibold mt-1 pl-1">RO No. cannot be changed after creation.</p>}
            </div>

            {/* Contract Ref */}
            <div>
              <label className={labelCls}>Contract Reference</label>
              <input
                type="text"
                placeholder="e.g. CONTRACT-REF-123"
                value={formData.contract_ref}
                onChange={set('contract_ref')}
                className={inputCls}
                onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                onBlur={(e)  => e.target.style.borderColor = 'rgb(203, 213, 225)'}
              />
            </div>

            {/* RO Date & Delivery Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>RO Date <b className="text-red-500">*</b></label>
                <input
                  type="date"
                  required
                  value={formData.ro_date}
                  onChange={set('ro_date')}
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

            {/* Buyer Autocomplete */}
            <div ref={buyerRef} className="relative">
              <label className={labelCls}>Buyer Name <b className="text-red-500">*</b></label>
              <input
                type="text"
                placeholder="Search Buyer name or email..."
                value={buyerInput}
                onChange={(e) => handleBuyerInput(e.target.value)}
                onFocus={() => buyerInput.trim() && setShowBuyerDropdown(true)}
                className={inputCls}
                onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                onBlur={(e)  => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                autoComplete="off"
              />
              {showBuyerDropdown && buyerSuggestions.length > 0 && (
                <div className="absolute z-30 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                  {buyerSuggestions.map(b => (
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
                <div className="mt-2 flex items-center gap-1.5 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs font-bold">
                  <AlertCircle size={13} className="shrink-0" />
                  No buyer found for "{buyerInput}".
                </div>
              )}
              {selectedBuyer && (
                <div className="mt-2 flex flex-wrap gap-2.5 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5">
                  <span className="text-emerald-600">✓ Buyer Linked</span>
                  <span className="text-slate-300">|</span>
                  <span>{selectedBuyer.email}</span>
                  <span className="text-slate-300">|</span>
                  <span>{selectedBuyer.phone}</span>
                </div>
              )}
            </div>

            {/* Customer (Seller) Autocomplete */}
            <div ref={customerRef} className="relative">
              <label className={labelCls}>Customer / Seller <b className="text-red-500">*</b></label>
              <input
                type="text"
                placeholder="Search Customer name or ID..."
                value={customerInput}
                onChange={(e) => handleCustomerInput(e.target.value)}
                onFocus={() => customerInput.trim() && setShowCustomerDropdown(true)}
                className={inputCls}
                onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                onBlur={(e)  => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                autoComplete="off"
              />
              {showCustomerDropdown && customerSuggestions.length > 0 && (
                <div className="absolute z-30 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                  {customerSuggestions.map(c => (
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
                <div className="mt-2 flex items-center gap-1.5 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs font-bold">
                  <AlertCircle size={13} className="shrink-0" />
                  No customer found for "{customerInput}".
                </div>
              )}
              {selectedCustomer && (
                <div className="mt-2 flex flex-wrap gap-2.5 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5">
                  <span className="text-emerald-600">✓ Customer Linked</span>
                  <span className="text-slate-300">|</span>
                  <span className="truncate">{selectedCustomer.address}</span>
                </div>
              )}
            </div>

            {/* Items Section */}
            <div className="border-t border-slate-200 pt-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-800 m-0 uppercase tracking-wider">RO Items &amp; Pricing</h3>
                <span className="text-[10px] font-bold text-slate-400">{roItems.filter(i=>i.selected).length} selected</span>
              </div>

              {/* Add Item search input */}
              <div ref={itemSearchRef} className="relative">
                <label className={labelCls}>Add Item by Code or Description</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Type Item Code or Description to add..."
                    value={itemSearchInput}
                    onChange={(e) => handleItemSearchInput(e.target.value)}
                    className={inputCls + " pl-8"}
                    autoComplete="off"
                  />
                  <Search size={14} className="absolute left-2.5 top-3 text-slate-400" />
                </div>
                {showItemDropdown && itemSuggestions.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                    {itemSuggestions.map(item => (
                      <button
                        key={item.item_code}
                        type="button"
                        onClick={() => addRoItem(item)}
                        className="w-full text-left px-3.5 py-2 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                      >
                        <div className="font-bold text-xs text-slate-900">{item.item_code}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{item.description} &bull; Dwg: {item.drawing_number || '—'}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Items List */}
              {roItems.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-slate-300 rounded-lg bg-slate-50">
                  <p className="text-xs text-slate-400 font-semibold m-0">No items added yet. Search and select above.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {roItems.map((item) => {
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
                                disabled
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
                                value={item.delivery_date}
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
            <div className="border-t border-slate-200 pt-5">
              <h3 className="text-sm font-extrabold text-slate-800 mb-3 uppercase tracking-wider">Other Fees &amp; Adjustments</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Transport Charges (₹)</label>
                  <input type="number" step="0.01" value={formData.transport} onChange={set('transport')} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Packing &amp; Forwarding (₹)</label>
                  <input type="number" step="0.01" value={formData.packing_forward} onChange={set('packing_forward')} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Basic Value Adjustment (₹)</label>
                  <input type="number" step="0.01" value={formData.basic_value} onChange={set('basic_value')} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Other Charges (₹)</label>
                  <input type="number" step="0.01" value={formData.other} onChange={set('other')} className={inputCls} />
                </div>
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
            <div className="flex items-center justify-end gap-3 pt-5 border-t border-slate-200">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 border border-slate-300 rounded text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-5 py-2 text-white text-xs font-bold rounded flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                style={{ backgroundColor: 'var(--theme-color)' }}
                onMouseEnter={(e) => !isLoading && (e.currentTarget.style.filter = 'brightness(0.9)')}
                onMouseLeave={(e) => !isLoading && (e.currentTarget.style.filter = 'none')}
              >
                {isLoading ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    {editingNo ? 'Update' : 'Create'} Release Order
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
