import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Plus, RefreshCw, X, CheckSquare, Square, Search, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { useContractOrder } from '../../../context/ContractOrderContext.jsx';

const labelCls = "block text-xs font-bold text-slate-700 uppercase mb-1.5";
const inputCls = "w-full px-3 py-2  bg-[white] border border-slate-300 rounded text-sm placeholder:text-slate-400 font-medium focus:outline-none transition-colors duration-150 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed";

export default function CreateContractOrderForm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const queryTradeId = searchParams.get('trade_id');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState(null);
  const [coNoError, setCoNoError] = useState('');

  const {
    activeCoId,
    setActiveCoId,
    formData,
    setFormData,
    buyerInput,
    setBuyerInput,
    selectedBuyer,
    setSelectedBuyer,
    customerInput,
    setCustomerInput,
    selectedCustomer,
    setSelectedCustomer,
    contractInput,
    setContractInput,
    selectedContract,
    setSelectedContract,
    itemSearchInput,
    setItemSearchInput,
    gstSearchInput,
    setGstSearchInput,
    shipInput,
    setShipInput,
    coItems,
    setCoItems,
    resetCoState
  } = useContractOrder();

  // Autocomplete suggestions and open state (ui-only, not cached)
  const [buyerSuggestions, setBuyerSuggestions] = useState([]);
  const [showBuyerDropdown, setShowBuyerDropdown] = useState(false);
  const [buyerNotFound, setBuyerNotFound]     = useState(false);
  const buyerRef = useRef(null);

  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerNotFound, setCustomerNotFound] = useState(false);
  const customerRef = useRef(null);

  const [contractSuggestions, setContractSuggestions] = useState([]);
  const [showContractDropdown, setShowContractDropdown] = useState(false);
  const [contractNotFound, setContractNotFound] = useState(false);
  const contractRef = useRef(null);

  // Items loaded from selected contract (used to filter item search)
  const [contractItems, setContractItems] = useState([]);

  const [itemSuggestions, setItemSuggestions] = useState([]);
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const itemSearchRef = useRef(null);

  const [gstDropdownOpen, setGstDropdownOpen] = useState({});
  const [gstSuggestions, setGstSuggestions]   = useState({});
  const gstItemRefs = useRef({});
  const gstTimeoutRefs = useRef({});

  const [shipDropdownOpen, setShipDropdownOpen] = useState({});
  const [shipSuggestions, setShipSuggestions]   = useState({});
  const shipItemRefs = useRef({});
  const shipTimeoutRefs = useRef({});

  const fetchNextNo = async () => {
    try {
      const res = await fetch('/api/release-orders/next-no');
      if (res.ok) {
        const data = await res.json();
        setFormData(prev => ({ ...prev, co_no: data.nextNo }));
      }
    } catch (err) {
      console.error('Error fetching next CO no:', err);
    }
  };

  useEffect(() => {
    resetCoState(null);
    fetchNextNo();
    if (queryTradeId) {
      fetchTradeRfqItems(queryTradeId);
    }
  }, [queryTradeId]);

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
      if (contractRef.current && !contractRef.current.contains(event.target)) {
        setShowContractDropdown(false);
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

  // Debounced search for contracts (limit 5)
  useEffect(() => {
    const trimmed = contractInput.trim();
    if (!trimmed) {
      setContractSuggestions([]);
      setShowContractDropdown(false);
      setContractNotFound(false);
      return;
    }
    if (selectedContract && selectedContract.company_name === contractInput) {
      setShowContractDropdown(false);
      return;
    }
    const delay = setTimeout(() => {
      fetch(`/api/contracts?q=${encodeURIComponent(trimmed)}&limit=5`)
        .then(r => r.json())
        .then(data => {
          setContractSuggestions(Array.isArray(data) ? data : []);
          setContractNotFound(!Array.isArray(data) || data.length === 0);
          setShowContractDropdown(true);
        })
        .catch(console.error);
    }, 200);
    return () => clearTimeout(delay);
  }, [contractInput, selectedContract]);

  // Debounced search for items
  useEffect(() => {
    const trimmed = itemSearchInput.trim();
    if (!trimmed) {
      setItemSuggestions([]);
      setShowItemDropdown(false);
      return;
    }
    const delay = setTimeout(async () => {
      try {
        let items = contractItems;
        if (items.length === 0 && selectedContract) {
          items = await fetchContractItems(selectedContract);
        }
        if (items.length > 0) {
          const lower = trimmed.toLowerCase();
          const filtered = items.filter(i =>
            (i.item_code || '').toLowerCase().includes(lower) ||
            (i.description || '').toLowerCase().includes(lower)
          ).slice(0, 5);
          setItemSuggestions(filtered);
          setShowItemDropdown(true);
        } else {
          const res = await fetch(`/api/arc-items?q=${encodeURIComponent(trimmed)}&limit=5`);
          if (res.ok) {
            const data = await res.json();
            setItemSuggestions(Array.isArray(data) ? data : []);
            setShowItemDropdown(true);
          }
        }
      } catch (e) {
        console.error('Error searching items:', e);
      }
    }, 200);
    return () => clearTimeout(delay);
  }, [itemSearchInput, contractItems, selectedContract]);

  const fetchTradeRfqItems = async (tradeId) => {
    try {
      const res = await fetch(`/api/trades/${encodeURIComponent(tradeId)}`);
      if (!res.ok) return;
      const trade = await res.json();
      if (trade.rfq_items && trade.rfq_items.length > 0) {
        const items = trade.rfq_items.map(item => ({
          item_code:        item.item_code,
          quantity:         item.quantity,
          unit_price:       String(item.unit_price || 0),
          gst_type:         '',
          gst_rate:         '',
          shipping_address: '',
          delivery_date:    formData.delivery_date || '',
          description:      item.description || '',
          drawing_number:   item.drawing_number || '',
          selected:         true
        }));
        setCoItems(items);
      }
      if (trade.buyer_id) {
        setSelectedBuyer({ id: trade.buyer_id, name: trade.buyer_name, email: trade.buyer_email, phone: trade.buyer_phone });
        setBuyerInput(trade.buyer_name || '');
      }
      if (trade.customer_id) {
        setSelectedCustomer({ id: trade.customer_id, name: trade.customer_name, address: trade.customer_address });
        setCustomerInput(trade.customer_name || '');
      }
    } catch (err) {
      console.error('Error fetching trade RFQ items:', err);
    }
  };

  const fetchContractItems = async (contract) => {
    if (!contract) return [];
    try {
      let items = [];
      if (contract.type === 'CUSTOMER') {
        const res = await fetch(`/api/customer-contracts/${contract.id}`);
        if (res.ok) {
          const data = await res.json();
          items = data.items || [];
        }
      } else {
        const res = await fetch(`/api/vendor-contracts/${contract.id}`);
        if (res.ok) {
          const data = await res.json();
          items = data.items || [];
        }
      }
      setContractItems(items);
      return items;
    } catch (err) {
      console.error('Error fetching contract items:', err);
      setContractItems([]);
      return [];
    }
  };

  const selectContract = async (contract) => {
    setSelectedContract(contract);
    setContractInput(contract.company_name);
    setShowContractDropdown(false);
    setContractNotFound(false);
    setFormData(prev => ({ ...prev, contract_ref: String(contract.id) }));
    await fetchContractItems(contract);
  };

  const clearContract = () => {
    setSelectedContract(null);
    setContractInput('');
    setContractSuggestions([]);
    setContractNotFound(false);
    setContractItems([]);
    setFormData(prev => ({ ...prev, contract_ref: '' }));
  };

  const handleContractInput = (value) => {
    setContractInput(value);
    setSelectedContract(null);
    setContractItems([]);
    if (!value.trim()) {
      setContractSuggestions([]);
      setShowContractDropdown(false);
      setContractNotFound(false);
    }
  };

  const set = (field) => (e) =>
    setFormData(prev => ({ ...prev, [field]: e.target.value }));

  const handleCommonDeliveryDateChange = (e) => {
    const val = e.target.value;
    setFormData(prev => ({ ...prev, delivery_date: val }));
    setCoItems(prev => prev.map(item => ({ ...item, delivery_date: val })));
  };

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

  const addCoItem = (item) => {
    if (coItems.some(i => i.item_code === item.item_code)) {
      toast.warn('Item already added.');
      return;
    }
    setCoItems(prev => [
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

  const removeCoItem = (itemCode) => {
    setCoItems(prev => prev.filter(i => i.item_code !== itemCode));
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
    setCoItems(prev => prev.map(i => i.item_code === itemCode ? { ...i, gst_type: '', gst_rate: '' } : i));
    setGstDropdownOpen(prev => ({ ...prev, [itemCode]: true }));
    fetchGstSuggestions(itemCode, value);
  };

  const selectItemGst = (itemCode, gst) => {
    setCoItems(prev => prev.map(i =>
      i.item_code === itemCode ? { ...i, gst_type: gst.type, gst_rate: String(gst.rate) } : i
    ));
    setGstSearchInput(prev => ({ ...prev, [itemCode]: `${gst.type} (${gst.rate}%)` }));
    setGstDropdownOpen(prev => ({ ...prev, [itemCode]: false }));
  };

  const clearItemGst = (itemCode) => {
    setCoItems(prev => prev.map(i =>
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
    setCoItems(prev => prev.map(i => i.item_code === itemCode ? { ...i, selected: !i.selected } : i));

  const updateItem = (itemCode, field, value) =>
    setCoItems(prev => prev.map(i => i.item_code === itemCode ? { ...i, [field]: value } : i));

  // Calculations
  const calcItemBasic   = (item) => (parseFloat(item.unit_price) || 0) * (parseFloat(item.quantity) || 0);
  const calcItemGst     = (item) => (calcItemBasic(item) * (parseFloat(item.gst_rate) || 0)) / 100;
  const calcItemTotal   = (item) => calcItemBasic(item) + calcItemGst(item);

  const calcBasicTotal  = () => coItems.filter(i => i.selected).reduce((a, i) => a + calcItemBasic(i), 0);
  const calcGstTotal    = () => coItems.filter(i => i.selected).reduce((a, i) => a + calcItemGst(i), 0);
  const calcGrandTotal  = () =>
    calcBasicTotal()
    + calcGstTotal()
    + (parseFloat(formData.transport)       || 0)
    + (parseFloat(formData.other)           || 0)
    + (parseFloat(formData.basic_value)     || 0)
    + (parseFloat(formData.packing_forward) || 0);

  const fmt = (val) => (parseFloat(val) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  const handleBack = () => navigate(queryTradeId ? `/trade/${queryTradeId}` : '/');

  const handleCancel = () => {
    resetCoState(undefined);
    navigate(queryTradeId ? `/trade/${queryTradeId}` : '/');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setCoNoError('');

    if (!formData.co_no || !formData.co_no.trim()) {
      setCoNoError('Contract Order No. is required.');
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

    const activeItems = coItems.filter(i => i.selected);
    if (activeItems.length === 0) {
      setError('Please select/add at least one item for the contract order.');
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
      ro_no:           formData.co_no.trim(),
      contract_ref:    formData.contract_ref || null,
      ro_date:         formData.co_date,
      delivery_date:   formData.delivery_date || null,
      buyer_id:        selectedBuyer.id,
      customer_id:     selectedCustomer.id,
      trade_id:        queryTradeId || null,
      trade_type:      'buyARC',
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
      const res = await fetch('/api/release-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        resetCoState(undefined);
        toast.success('Contract Order created successfully!');
        const finalTradeId = queryTradeId || data.trade_id || formData.trade_id;
        navigate(finalTradeId ? `/trade/${finalTradeId}` : '/');
      } else {
        const errData = await res.json();
        setError(errData.error || 'Failed to save contract order');
      }
    } catch (err) {
      setError('Server connection error while saving contract order.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 p-6 bg-slate-100 text-slate-900 min-h-screen">
      <div className="max-w-2xl mx-auto space-y-5">
        <button
          type="button"
          onClick={handleBack}
          className="mb-3 text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer bg-slate-200 hover:bg-slate-300 px-3 py-1.5 rounded-lg transition-colors self-start"
        >
          <ArrowLeft size={14} />
          Back
        </button>

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 m-0">
            New Contract Order
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Raise a contract order for a trade pipeline.
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

            {/* CO No */}
            <div>
              <label className={labelCls}>Contract Order No. <b className="text-red-500">*</b></label>
              <input
                type="text"
                required
                placeholder="e.g. CO-2024-001"
                value={formData.co_no}
                onChange={(e) => { setFormData(prev => ({ ...prev, co_no: e.target.value })); setCoNoError(''); }}
                className={inputCls}
                onFocus={(e) => (e.target.style.borderColor = 'var(--theme-color)')}
                onBlur={(e)  => (e.target.style.borderColor = 'rgb(203, 213, 225)')}
              />
              {coNoError && <p className="text-[10px] text-red-500 font-semibold mt-1 pl-1">{coNoError}</p>}
            </div>

            {/* Contract Reference Autocomplete */}
            <div ref={contractRef} className="relative">
              <label className={labelCls}>Contract Reference (ARC)</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Type to search company name..."
                  value={contractInput}
                  onChange={(e) => handleContractInput(e.target.value)}
                  onFocus={() => { if (contractInput.trim()) setShowContractDropdown(true); }}
                  className={inputCls}
                  autoComplete="off"
                />
                {selectedContract && (
                  <button
                    type="button"
                    onClick={clearContract}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {showContractDropdown && contractSuggestions.length > 0 && (
                <div className="absolute z-30 w-full mt-1  bg-[white] border border-slate-300 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                  {contractSuggestions.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectContract(c)}
                      className="w-full text-left px-3.5 py-2 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                    >
                      <div className="font-bold text-xs text-slate-900">{c.company_name}</div>
                      <div className="text-[10px] text-slate-500">
                        Type: <span className="font-semibold text-slate-700">{c.type}</span> &bull; Status: {c.status}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {contractNotFound && (
                <div className="mt-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
                  <AlertCircle size={13} className="shrink-0" />
                  <span>No contracts found matching "{contractInput}".</span>
                </div>
              )}

              {selectedContract && (
                <div className="mt-2 flex flex-wrap gap-2.5 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5">
                  <span className="text-emerald-600">✓ Contract Linked</span>
                  <span className="text-slate-300">|</span>
                  <span>{selectedContract.company_name}</span>
                  <span className="text-slate-300">|</span>
                  <span>Type: {selectedContract.type}</span>
                  {contractItems.length > 0 && (
                    <>
                      <span className="text-slate-300">|</span>
                      <span className="text-blue-600">{contractItems.length} items in catalog</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* CO Date & Delivery Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>CO Date <b className="text-red-500">*</b></label>
                <input
                  type="date"
                  required
                  value={formData.co_date}
                  onChange={set('co_date')}
                  className={inputCls}
                  onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                  onBlur={(e)  => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                />
              </div>
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
            </div>

            {/* Buyer Autocomplete */}
            <div ref={buyerRef} className="relative">
              <label className={labelCls}>Buyer <b className="text-red-500">*</b></label>
              <input
                type="text"
                placeholder="Start typing buyer name..."
                value={buyerInput}
                onChange={(e) => handleBuyerInput(e.target.value)}
                onFocus={() => { if (buyerInput.trim()) setShowBuyerDropdown(true); }}
                className={inputCls}
                onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                autoComplete="off"
              />

              {showBuyerDropdown && buyerSuggestions.length > 0 && (
                <div className="absolute z-30 w-full mt-1  bg-[white] border border-slate-300 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
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
                <div className="mt-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
                  <AlertCircle size={13} className="shrink-0" />
                  <span>No buyer found for "{buyerInput}".</span>
                </div>
              )}

              {selectedBuyer && (
                <div className="mt-2 flex flex-wrap gap-2.5 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5">
                  <span className="text-emerald-600">✓ Buyer Linked</span>
                  <span className="text-slate-300">|</span>
                  <span>{selectedBuyer.name}</span>
                  {selectedBuyer.email && (
                    <>
                      <span className="text-slate-300">|</span>
                      <span>{selectedBuyer.email}</span>
                    </>
                  )}
                  {selectedBuyer.phone && (
                    <>
                      <span className="text-slate-300">|</span>
                      <span>{selectedBuyer.phone}</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Customer Autocomplete */}
            <div ref={customerRef} className="relative">
              <label className={labelCls}>Customer (Seller) <b className="text-red-500">*</b></label>
              <input
                type="text"
                placeholder="Start typing customer name..."
                value={customerInput}
                onChange={(e) => handleCustomerInput(e.target.value)}
                onFocus={() => { if (customerInput.trim()) setShowCustomerDropdown(true); }}
                className={inputCls}
                onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                autoComplete="off"
              />

              {showCustomerDropdown && customerSuggestions.length > 0 && (
                <div className="absolute z-30 w-full mt-1  bg-[white] border border-slate-300 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                  {customerSuggestions.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectCustomer(c)}
                      className="w-full text-left px-3.5 py-2 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                    >
                      <div className="font-bold text-xs text-slate-900">{c.name}</div>
                      <div className="text-[10px] text-slate-500 truncate">{c.address}</div>
                    </button>
                  ))}
                </div>
              )}

              {customerNotFound && (
                <div className="mt-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
                  <AlertCircle size={13} className="shrink-0" />
                  <span>No customer found for "{customerInput}".</span>
                </div>
              )}

              {selectedCustomer && (
                <div className="mt-2 flex flex-wrap gap-2.5 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5">
                  <span className="text-emerald-600">✓ Customer Linked</span>
                  <span className="text-slate-300">|</span>
                  <span>{selectedCustomer.name}</span>
                  {selectedCustomer.address && (
                    <>
                      <span className="text-slate-300">|</span>
                      <span className="truncate max-w-xs">{selectedCustomer.address}</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Items Section */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={labelCls}>Items ({coItems.filter(i => i.selected).length} selected)</label>
                <span className="text-[11px] font-semibold text-slate-500">
                  Basic: ₹{fmt(calcBasicTotal())} &bull; GST: ₹{fmt(calcGstTotal())}
                </span>
              </div>

              {/* Add item search */}
              <div ref={itemSearchRef} className="relative mb-3">
                <div className="relative">
                  <input
                    type="text"
                    placeholder={selectedContract ? "Search items from contract catalog..." : "Search items to add (item code or description)..."}
                    value={itemSearchInput}
                    onChange={(e) => handleItemSearchInput(e.target.value)}
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
                        onClick={() => addCoItem(item)}
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

              {coItems.length > 0 && (
                <div className="border border-slate-300 rounded-lg overflow-x-auto bg-slate-50">
                  <div className="divide-y divide-slate-200">
                    {coItems.map(item => (
                      <div
                        key={item.item_code}
                        className={`px-4 py-3  bg-[white] transition-colors ${!item.selected ? 'opacity-50 bg-slate-50' : ''}`}
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
                              onClick={() => removeCoItem(item.item_code)}
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
                                <div className="absolute z-40 left-0 right-0 mt-1  bg-[white] border border-slate-300 rounded shadow-lg overflow-hidden max-h-36 overflow-y-auto">
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
                                <div className="absolute z-40 left-0 right-0 mt-1  bg-[white] border border-slate-300 rounded shadow-lg overflow-hidden max-h-36 overflow-y-auto">
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
                    ))}
                  </div>
                </div>
              )}
            </div>

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
                  <><Plus size={14} /> Raise Contract Order</>
                )}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}
