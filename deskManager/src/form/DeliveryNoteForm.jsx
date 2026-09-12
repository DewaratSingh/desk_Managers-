import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { AlertCircle, ArrowLeft, RefreshCw, Tag, ShoppingCart, Cpu, Package, X } from 'lucide-react';

const labelCls = "block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider";
const inputCls = "w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs placeholder:text-slate-400 font-semibold focus:outline-none transition-colors duration-150 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed";

export default function DeliveryNoteForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const queryTradeId = searchParams.get('trade_id');
  const editingNo = id || null;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  // Trade ID to redirect back to
  const [tradeId, setTradeId] = useState(queryTradeId || '');

  // Stock Selection Modal state for SELL/ARC trades
  const [openStockPickerItem, setOpenStockPickerItem] = useState(null);
  const [stockList, setStockList] = useState([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockAllocations, setStockAllocations] = useState({});

  // Header state
  const [formData, setFormData] = useState({
    delivery_note_no: '',
    delivery_date: new Date().toISOString().split('T')[0],
    dispatch_through: '',
    dispatch_doc_no: '',
    motor_vehicle_no: ''
  });

  // Table items state
  // Each item: { item_code, description, drawing_number, original_qty, delivered_qty, remaining_qty, rate_per_piece, shipping_address, selected: bool, delivery_qty: number, inv_qty, sell_qty, process_qty, inv_details }
  const [items, setItems] = useState([]);
  const [tradeType, setTradeType] = useState('sell');

  useEffect(() => {
    if (location.state?.returnState) {
      const returnState = location.state.returnState;
      const updatedQty = location.state.updatedQty;
      const actionType = location.state.actionType || (location.state.status === 'For process' ? 'process' : location.state.status === 'For Sell' ? 'sell' : 'inventory');
      
      setTradeId(returnState.tradeId);
      setTradeType(returnState.tradeType || 'sell');
      setFormData(returnState.formData);
      
      const mapped = returnState.items.map(it => {
        if (it.item_code === returnState.selectedItemCode) {
          const inv_qty = actionType === 'inventory' ? (updatedQty !== undefined ? updatedQty : (it.inv_qty || 0)) : (it.inv_qty || 0);
          const sell_qty = actionType === 'sell' ? (updatedQty !== undefined ? updatedQty : (it.sell_qty || 0)) : (it.sell_qty || 0);
          const process_qty = actionType === 'process' ? (updatedQty !== undefined ? updatedQty : (it.process_qty || 0)) : (it.process_qty || 0);
          const delivery_qty = inv_qty + sell_qty + process_qty;

          return {
            ...it,
            selected: true,
            delivery_qty: delivery_qty,
            inv_qty: inv_qty,
            sell_qty: sell_qty,
            process_qty: process_qty,
            inv_details: location.state.inventoryDetails || it.inv_details
          };
        }
        return it;
      });
      setItems(mapped);
      setIsLoading(false);
    } else {
      loadInitialData();
    }
  }, [editingNo, queryTradeId, location.state]);

  const loadInitialData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (editingNo) {
        // Edit mode: fetch note details first
        const noteRes = await fetch(`/api/delivery-notes/${encodeURIComponent(editingNo)}`);
        if (!noteRes.ok) throw new Error('Delivery Note not found');
        const noteData = await noteRes.json();

        setTradeId(noteData.trade_id);
        setTradeType(noteData.trade_type || 'sell');
        setFormData({
          delivery_note_no: noteData.delivery_note_no,
          delivery_date: noteData.delivery_date ? noteData.delivery_date.split('T')[0] : '',
          dispatch_through: noteData.dispatch_through || '',
          dispatch_doc_no: noteData.dispatch_doc_no || '',
          motor_vehicle_no: noteData.motor_vehicle_no || ''
        });

        // Fetch items-lookup excluding current note
        const lookupRes = await fetch(`/api/delivery-notes/items-lookup/${encodeURIComponent(noteData.trade_id)}?exclude_dn_no=${encodeURIComponent(editingNo)}`);
        if (!lookupRes.ok) throw new Error('Failed to load item schema for trade');
        const lookupData = await lookupRes.json();

        // Merge noteData items into lookupData items
        const mergedItems = await Promise.all(lookupData.items.map(async (lookupItem) => {
          const dnItem = (noteData.items || []).find(di => di.item_code === lookupItem.item_code);
          const isSelected = !!dnItem;
          const deliveryQty = dnItem ? parseInt(dnItem.quantity) || 0 : lookupItem.remaining_qty;
          
          // Re-calculate remaining_qty for editing to include this note's quantity
          const remainingLimit = lookupItem.remaining_qty + (dnItem ? parseInt(dnItem.quantity) || 0 : 0);

          const currentTradeType = noteData.trade_type || 'sell';
          let inventory_qty = 0;
          let inventory_price = 0;
          if (currentTradeType === 'sell' || currentTradeType === 'ARC') {
            try {
              const res = await fetch(`/api/inventory/item/${encodeURIComponent(lookupItem.item_code)}/availability`);
              if (res.ok) {
                const invData = await res.json();
                inventory_qty = invData.available_qty;
                inventory_price = invData.price;
              }
            } catch (e) {
              console.error(e);
            }
          }

          return {
            ...lookupItem,
            selected: isSelected,
            delivery_qty: deliveryQty,
            remaining_qty: remainingLimit,
            inv_qty: 0,
            sell_qty: 0,
            process_qty: 0,
            inv_details: null,
            inventory_qty,
            inventory_price
          };
        }));

        setItems(mergedItems);
      } else {
        // Create mode: fetch lookup directly
        if (!queryTradeId) throw new Error('trade_id query parameter is required to create a Delivery Note');
        setTradeId(queryTradeId);

        const lookupRes = await fetch(`/api/delivery-notes/items-lookup/${encodeURIComponent(queryTradeId)}`);
        if (!lookupRes.ok) throw new Error('Failed to load item schema for trade');
        const lookupData = await lookupRes.json();
        const detectedTradeType = lookupData.trade_type || 'sell';
        setTradeType(detectedTradeType);

        // Check if there is autofillSell in state
        const autofillSell = location.state?.autofillSell;

        // Set items: default check true & pre-fill delivery quantity for BUY/PROCESS trades
        const initialItems = await Promise.all(lookupData.items.map(async (item) => {
          const isAutofill = autofillSell && item.item_code === autofillSell.item_code;
          const isBuyOrProcess = detectedTradeType.toLowerCase() === 'buy' || detectedTradeType.toLowerCase() === 'process';
          
          let inventory_qty = 0;
          let inventory_price = 0;
          if (detectedTradeType === 'sell' || detectedTradeType === 'ARC') {
            try {
              const res = await fetch(`/api/inventory/item/${encodeURIComponent(item.item_code)}/availability`);
              if (res.ok) {
                const invData = await res.json();
                inventory_qty = invData.available_qty;
                inventory_price = invData.price;
              }
            } catch (e) {
              console.error(e);
            }
          }

          const defaultSelected = isAutofill || (isBuyOrProcess && item.remaining_qty > 0);
          const defaultQty = isAutofill ? autofillSell.delivery_qty : (isBuyOrProcess ? item.remaining_qty : 0);

          return {
            ...item,
            selected: defaultSelected,
            delivery_qty: defaultQty,
            inv_qty: 0,
            sell_qty: 0,
            process_qty: 0,
            inv_details: null,
            linked_inventory_id: isAutofill ? autofillSell.inventory_id : null,
            linked_trace_item_id: isAutofill ? (autofillSell.trace_item_id || autofillSell.p_item_id || autofillSell.p_id) : null,
            linked_p_item_id: isAutofill ? (autofillSell.trace_item_id || autofillSell.p_item_id || autofillSell.p_id) : null,
            inventory_qty,
            inventory_price
          };
        }));

        setItems(initialItems);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to initialize Delivery Note form');
    } finally {
      setIsLoading(false);
    }
  };

  const handleHeaderChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const fetchStockForItem = async (item) => {
    setOpenStockPickerItem(item);
    setStockLoading(true);
    setStockList([]);
    setStockAllocations({});
    try {
      const res = await fetch(`/api/inventory?q=${encodeURIComponent(item.item_code)}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        const filtered = data.filter(inv => inv.item_code === item.item_code && inv.quantity > 0);
        setStockList(filtered.length > 0 ? filtered : data);
      }
    } catch (err) {
      console.error('Error fetching stock for item:', err);
    } finally {
      setStockLoading(false);
    }
  };

  const handleSelectStockRow = (invRow, qtyToAlloc) => {
    if (!openStockPickerItem) return;
    const qty = parseInt(qtyToAlloc, 10);
    if (isNaN(qty) || qty <= 0) {
      alert("Please enter a valid quantity greater than 0.");
      return;
    }
    if (qty > invRow.quantity) {
      alert(`Cannot select more than available quantity of ${invRow.quantity}.`);
      return;
    }
    if (qty > openStockPickerItem.remaining_qty) {
      alert(`Cannot select more than remaining order limit of ${openStockPickerItem.remaining_qty}.`);
      return;
    }

    setItems(prev => prev.map(it => {
      if (it.item_code === openStockPickerItem.item_code) {
        return {
          ...it,
          selected: true,
          delivery_qty: qty,
          linked_inventory_id: invRow.id,
          linked_trace_item_id: invRow.trace_item_id || invRow.p_item_id || null,
          linked_p_item_id: invRow.trace_item_id || invRow.p_item_id || null,
          inv_details: {
            location: invRow.location,
            rack: invRow.rack,
            shelf_number: invRow.shelf_number,
            price: invRow.price,
            trace_item_id: invRow.trace_item_id,
            status: invRow.trace_status || invRow.status
          }
        };
      }
      return it;
    }));

    setOpenStockPickerItem(null);
  };

  const handleItemCheckboxChange = (index) => {
    const targetItem = items[index];
    const newSelected = !targetItem.selected;

    setItems(prev => prev.map((item, idx) => {
      if (idx !== index) return item;
      return {
        ...item,
        selected: newSelected,
        delivery_qty: newSelected ? (item.delivery_qty || item.remaining_qty || 0) : 0,
        linked_inventory_id: newSelected ? item.linked_inventory_id : null,
        linked_trace_item_id: newSelected ? item.linked_trace_item_id : null
      };
    }));

    if (newSelected && (tradeType === 'sell' || tradeType === 'ARC')) {
      fetchStockForItem(targetItem);
    }
  };

  const handleItemQtyChange = (index, value) => {
    const parsedVal = parseInt(value, 10) || 0;
    setItems(prev => prev.map((item, idx) => {
      if (idx !== index) return item;
      
      // For SELL/ARC trades, validate against inventory level
      if (tradeType === 'sell' || tradeType === 'ARC') {
        if (parsedVal > (item.inventory_qty || 0)) {
          alert(`Quantity for item ${item.item_code} cannot exceed available stock of ${item.inventory_qty || 0}.`);
          return item; // Do not update
        }
      }

      return {
        ...item,
        delivery_qty: parsedVal,
        selected: parsedVal > 0 ? true : item.selected
      };
    }));
  };

  const handleAddInInventory = (item) => {
    navigate('/inventory/form', {
      state: {
        autofill: {
          item_code: item.item_code,
          quantity: item.inv_qty || item.delivery_qty || item.remaining_qty,
          price: item.inv_details?.price || item.rate_per_piece,
          trade_id: tradeId,
          status: 'In Inventory',
          actionType: 'inventory',
          existingDetails: item.inv_details,
          returnUrl: editingNo ? `/updateDeliveryNote/${encodeURIComponent(editingNo)}` : '/addDeliveryNote',
          returnState: {
            formData,
            tradeId,
            tradeType,
            editingNo,
            items,
            selectedItemCode: item.item_code
          }
        }
      }
    });
  };

  const handleSellClick = (item, idx) => {
    navigate('/inventory/form', {
      state: {
        autofill: {
          item_code: item.item_code,
          quantity: item.sell_qty || item.remaining_qty,
          price: item.rate_per_piece,
          trade_id: tradeId,
          status: 'For Sell',
          actionType: 'sell',
          existingDetails: item.inv_details,
          returnUrl: editingNo ? `/updateDeliveryNote/${encodeURIComponent(editingNo)}` : '/addDeliveryNote',
          returnState: {
            formData,
            tradeId,
            tradeType,
            editingNo,
            items,
            selectedItemCode: item.item_code
          }
        }
      }
    });
  };

  const handleProcessClick = (item, idx) => {
    navigate('/inventory/form', {
      state: {
        autofill: {
          item_code: item.item_code,
          quantity: item.process_qty || item.remaining_qty,
          price: item.rate_per_piece,
          trade_id: tradeId,
          status: 'For process',
          actionType: 'process',
          existingDetails: item.inv_details,
          returnUrl: editingNo ? `/updateDeliveryNote/${encodeURIComponent(editingNo)}` : '/addDeliveryNote',
          returnState: {
            formData,
            tradeId,
            tradeType,
            editingNo,
            items,
            selectedItemCode: item.item_code
          }
        }
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validations
    if (!formData.delivery_note_no.trim()) {
      setError('Delivery Note No is required.');
      return;
    }
    if (!formData.delivery_date) {
      setError('Delivery Date is required.');
      return;
    }
    if (!formData.dispatch_through.trim()) {
      setError('Dispatch Through is required.');
      return;
    }
    if (!formData.motor_vehicle_no.trim()) {
      setError('Motor Vehicle No is required.');
      return;
    }

    const selectedList = items.filter(i => i.selected);
    if (selectedList.length === 0) {
      setError('You must select at least one item to deliver.');
      return;
    }

    // Verify quantities
    for (const item of selectedList) {
      if (item.delivery_qty < 0) {
        setError(`Quantity for item ${item.item_code} cannot be negative.`);
        return;
      }
      if (item.delivery_qty > item.remaining_qty) {
        setError(`Quantity for item ${item.item_code} cannot exceed remaining limit of ${item.remaining_qty}.`);
        return;
      }
      if (tradeType === 'sell' || tradeType === 'ARC') {
        if (item.delivery_qty > (item.inventory_qty || 0)) {
          setError(`Quantity for item ${item.item_code} cannot exceed available stock of ${item.inventory_qty || 0}.`);
          return;
        }
      }
    }

    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        trade_id: tradeId,
        items: selectedList.map(item => ({
          item_code: item.item_code,
          quantity: item.delivery_qty,
          rate_per_piece: item.rate_per_piece,
          shipping_address: item.shipping_address,
          delivery_date: item.delivery_date,
          inv_qty: item.inv_qty || 0,
          sell_qty: item.sell_qty || 0,
          process_qty: item.process_qty || 0,
          inv_details: item.inv_details || null,
          linked_process_trades: item.linked_process_trades || [],
          linked_inventory_id: item.linked_inventory_id || null,
          linked_trace_item_id: item.linked_trace_item_id || item.linked_p_item_id || null,
          linked_p_item_id: item.linked_trace_item_id || item.linked_p_item_id || null
        }))
      };

      const url = editingNo ? `/api/delivery-notes/${encodeURIComponent(editingNo)}` : '/api/delivery-notes';
      const method = editingNo ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save Delivery Note');
      }

      // Dynamic redirect handling based on sell allocation source
      const autofillSell = location.state?.autofillSell;
      if (autofillSell && autofillSell.source === 'delivery_note' && autofillSell.returnState) {
        const ret = autofillSell.returnState;
        const updatedItems = ret.items.map(it => {
          if (it.item_code === ret.selectedItemCode) {
            const currentSellQty = autofillSell.delivery_qty;
            const currentInvQty = it.inv_qty || 0;
            const currentProcessQty = it.process_qty || 0;
            const updatedProcessTrades = [...(it.linked_process_trades || [])];
            if (autofillSell.trade_db_id && !updatedProcessTrades.includes(autofillSell.trade_db_id)) {
              updatedProcessTrades.push(autofillSell.trade_db_id);
            }

            return {
              ...it,
              selected: true,
              sell_qty: currentSellQty,
              delivery_qty: currentInvQty + currentSellQty + currentProcessQty,
              linked_process_trades: updatedProcessTrades
            };
          }
          return it;
        });

        const newReturnState = {
          ...ret,
          items: updatedItems
        };

        const returnUrl = ret.editingNo 
          ? `/updateDeliveryNote/${encodeURIComponent(ret.editingNo)}` 
          : '/addDeliveryNote';

        navigate(returnUrl, { state: { returnState: newReturnState } });
      } else if (autofillSell && autofillSell.source === 'inventory') {
        navigate('/inventory');
      } else {
        navigate(`/trade/${encodeURIComponent(tradeId)}`);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error occurred while saving Delivery Note.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackToTrade = () => {
    if (tradeId) {
      navigate(`/trade/${encodeURIComponent(tradeId)}`);
    } else {
      navigate('/');
    }
  };

  if (isLoading) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-2">
        <RefreshCw className="animate-spin text-indigo-600" size={24} style={{ color: 'var(--theme-color)' }} />
        <p className="text-xs font-semibold text-slate-500">Loading details…</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 flex items-center justify-center">
      <div className="max-w-7xl w-full bg-white border border-slate-200 shadow-lg rounded-xl p-4 sm:p-5 space-y-4">
        
        {/* Header */}
        <div className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-lg font-black text-slate-950 m-0">
              {editingNo ? 'Modify Delivery Note' : 'Create Delivery Note'}
            </h1>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
              Fill in details to log item dispatch. Items and maximum limits are pulled from the trade's PO or RO.
            </p>
          </div>
          <button
            onClick={handleBackToTrade}
            className="text-[10px] font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded-lg border border-slate-200 transition-colors self-start sm:self-center"
          >
            <ArrowLeft size={12} /> Back to Trade
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-[11px] font-bold text-red-600">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Header metadata inputs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className={labelCls}>Delivery Note No <span className="text-red-500">*</span></label>
              <input
                type="text"
                name="delivery_note_no"
                value={formData.delivery_note_no}
                onChange={handleHeaderChange}
                disabled={!!editingNo}
                onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                className={inputCls}
                placeholder="e.g. DN-2026-0001"
                required
              />
            </div>

            <div>
              <label className={labelCls}>Delivery Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                name="delivery_date"
                value={formData.delivery_date}
                onChange={handleHeaderChange}
                onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                className={inputCls}
                required
              />
            </div>

            <div>
              <label className={labelCls}>Dispatch Through <span className="text-red-500">*</span></label>
              <input
                type="text"
                name="dispatch_through"
                value={formData.dispatch_through}
                onChange={handleHeaderChange}
                onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                className={inputCls}
                placeholder="e.g. Road, VRL Logistics"
                required
              />
            </div>

            <div>
              <label className={labelCls}>Dispatch Doc No (Optional)</label>
              <input
                type="text"
                name="dispatch_doc_no"
                value={formData.dispatch_doc_no}
                onChange={handleHeaderChange}
                onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                className={inputCls}
                placeholder="e.g. L.R. No. 493810"
              />
            </div>

            <div>
              <label className={labelCls}>Motor Vehicle No <span className="text-red-500">*</span></label>
              <input
                type="text"
                name="motor_vehicle_no"
                value={formData.motor_vehicle_no}
                onChange={handleHeaderChange}
                onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                className={inputCls}
                placeholder="e.g. MH-12-PQ-1234"
                required
              />
            </div>

            <div className="flex flex-col justify-center">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Ref Trade ID</span>
              <span className="text-xs font-bold text-slate-800 font-mono mt-0.5">{tradeId}</span>
            </div>
          </div>

          {/* Items selection */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h2 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                Select Items to Deliver
              </h2>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="px-3 py-2 text-center w-10">Select</th>
                    <th className="px-3 py-2 w-20">Item Code</th>
                    <th className="px-3 py-2">Description & Drawing</th>
                    <th className="px-3 py-2 text-right w-16">Order Qty</th>
                    <th className="px-3 py-2 text-right w-16">Delivered</th>
                    <th className="px-3 py-2 text-right w-16">Remaining</th>
                    <th className="px-3 py-2 text-right w-20">Delivery Qty</th>
                    <th className="px-3 py-2 text-right w-20">Price</th>
                    {(tradeType === 'buy' || tradeType === 'process') && <th className="px-3 py-2 text-center w-[320px]">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {items.map((item, idx) => (
                    <tr
                      key={item.item_code}
                      className={`hover:bg-slate-50/50 transition-colors ${item.selected ? 'bg-indigo-50/5' : ''}`}
                    >
                      <td className="px-3 py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={() => handleItemCheckboxChange(idx)}
                          className="w-4 h-4 accent-indigo-600 rounded cursor-pointer border-slate-300"
                        />
                      </td>
                      <td className="px-3 py-1.5 font-mono font-bold text-slate-800">
                        <span className="px-1 py-0.5 border border-slate-200 rounded bg-slate-50 text-[10px]">
                          {item.item_code}
                        </span>
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="font-semibold text-slate-800 text-[11px]">{item.description || '—'}</div>
                        {item.drawing_number && (
                          <div className="text-[9px] text-slate-400 font-bold">DWG: {item.drawing_number}</div>
                        )}
                        {item.shipping_address && (
                          <div className="text-[8px] text-slate-500 max-w-[200px] truncate" title={item.shipping_address}>
                            Ship: {item.shipping_address}
                          </div>
                        )}
                        {/* Display allocations preview */}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(tradeType === 'sell' || tradeType === 'ARC') && (
                            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold shadow-sm ${
                              item.inventory_qty > 0 
                                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' 
                                : 'bg-rose-50 border border-rose-200 text-rose-700'
                            }`}>
                              <Package size={8} /> 
                              Available: {item.inventory_qty || 0} 
                              {item.inventory_qty > 0 && ` (Cost: ₹${parseFloat(item.inventory_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })})`}
                            </span>
                          )}
                          {item.linked_inventory_id && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-black bg-emerald-100 border border-emerald-300 text-emerald-900 shadow-xs animate-fade-in">
                              <Package size={8} /> Allocated TR-{item.linked_trace_item_id || 'Stock'} ({item.delivery_qty} units)
                            </span>
                          )}
                          {item.inv_qty > 0 && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold bg-indigo-50 border border-indigo-200 text-indigo-700 shadow-sm animate-fade-in">
                              <Tag size={8} /> In Inventory: {item.inv_qty}
                            </span>
                          )}
                          {item.sell_qty > 0 && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-700 shadow-sm animate-fade-in">
                              <ShoppingCart size={8} /> Sell: {item.sell_qty}
                            </span>
                          )}
                          {item.process_qty > 0 && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-50 border border-amber-200 text-amber-700 shadow-sm animate-fade-in">
                              <Cpu size={8} /> Process: {item.process_qty}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-right text-slate-500 font-bold">{item.original_qty}</td>
                      <td className="px-3 py-1.5 text-right text-emerald-600 font-bold">{item.delivered_qty}</td>
                      <td className="px-3 py-1.5 text-right text-indigo-600 font-extrabold">{item.remaining_qty}</td>
                      <td className="px-3 py-1.5 text-right">
                        <input
                          type="number"
                          value={item.delivery_qty}
                          min="0"
                          max={item.remaining_qty}
                          disabled={item.remaining_qty <= 0}
                          onChange={(e) => handleItemQtyChange(idx, e.target.value)}
                          className="w-full px-1.5 py-0.5 text-xs border border-slate-300 rounded font-bold text-right focus:outline-none disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono font-bold text-slate-800">
                        ₹{parseFloat(item.rate_per_piece || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      {(tradeType === 'sell' || tradeType === 'ARC') && (
                        <td className="px-3 py-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => fetchStockForItem(item)}
                            className="px-2.5 py-1 text-[9px] font-extrabold rounded-lg text-emerald-800 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 transition-colors cursor-pointer flex items-center justify-center gap-1 shadow-2xs mx-auto"
                          >
                            <Package size={10} />
                            {item.linked_inventory_id ? 'Re-select Stock' : 'Select from Stock'}
                          </button>
                        </td>
                      )}
                      {(tradeType === 'buy' || tradeType === 'process') && (
                        <td className="px-3 py-1.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleAddInInventory(item)}
                              className="px-2 py-0.5 text-[9px] font-extrabold rounded text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-colors cursor-pointer"
                            >
                              {item.inv_qty > 0 ? 'Update Inventory' : 'Add in inventory'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleProcessClick(item, idx)}
                              className="px-2 py-0.5 text-[9px] font-extrabold rounded text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
                            >
                              {item.process_qty > 0 ? 'Update Process' : 'Process'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSellClick(item, idx)}
                              className="px-2 py-0.5 text-[9px] font-extrabold rounded text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
                            >
                              {item.sell_qty > 0 ? 'Update Sell' : 'Sell'}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan="9" className="px-3 py-6 text-center text-slate-400 text-xs font-semibold">
                        No items found in linked PO/RO.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-3 border-t border-slate-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleBackToTrade}
              className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
              style={{ backgroundColor: 'var(--theme-color)' }}
              onMouseEnter={(e) => e.target.style.filter = 'brightness(0.9)'}
              onMouseLeave={(e) => e.target.style.filter = 'none'}
            >
              {isSaving ? (
                <><RefreshCw size={12} className="animate-spin" /> Saving...</>
              ) : (
                'Save Delivery Note'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Stock Selection Modal for SELL / ARC Delivery */}
      {openStockPickerItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 animate-fade-in">
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                  <Package size={18} className="text-indigo-600" />
                  Select Inventory Stock for Delivery
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-semibold">
                  Item Code: <span className="font-mono font-bold text-slate-800 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">{openStockPickerItem.item_code}</span> | Max Remaining to Deliver: <span className="text-indigo-600 font-extrabold">{openStockPickerItem.remaining_qty}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenStockPickerItem(null)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Stock List Table */}
            {stockLoading ? (
              <div className="py-12 text-center text-slate-400 text-xs font-semibold animate-pulse flex flex-col items-center justify-center gap-2">
                <RefreshCw size={20} className="animate-spin text-indigo-600" />
                Loading active inventory stock...
              </div>
            ) : stockList.length === 0 ? (
              <div className="py-10 text-center text-slate-500 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <AlertCircle size={24} className="mx-auto text-amber-500" />
                <p className="m-0 font-bold text-slate-800">No active stock entries found for item code {openStockPickerItem.item_code} in inventory.</p>
                <p className="text-[11px] text-slate-400 font-normal">You can record stock in Inventory first or enter delivery quantity manually.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="px-3.5 py-2.5">Item Code</th>
                      <th className="px-3.5 py-2.5">Location</th>
                      <th className="px-3.5 py-2.5 text-right">Available Qty</th>
                      <th className="px-3.5 py-2.5">Status</th>
                      <th className="px-3.5 py-2.5 text-right">Price</th>
                      <th className="px-3.5 py-2.5 text-right w-28">Select Qty</th>
                      <th className="px-3.5 py-2.5 text-center w-28">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white font-semibold text-slate-800">
                    {stockList.map((inv) => {
                      const st = inv.trace_status || inv.status || 'active';
                      let badgeCls = "bg-slate-100 border-slate-200 text-slate-700";
                      if (st === 'For process') badgeCls = "bg-amber-50 border-amber-300 text-amber-800";
                      else if (st === 'For Sell') badgeCls = "bg-emerald-50 border-emerald-300 text-emerald-800";
                      else if (st === 'In Inventory') badgeCls = "bg-indigo-50 border-indigo-300 text-indigo-800";
                      else if (st === 'manufacturing') badgeCls = "bg-amber-100 border-amber-300 text-amber-800";

                      const allocQty = stockAllocations[inv.id] !== undefined ? stockAllocations[inv.id] : 0;

                      return (
                        <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-3.5 py-3 font-mono font-bold text-slate-900">
                            <span className="px-1.5 py-0.5 border border-slate-200 rounded bg-slate-100 text-[10px]">
                              {inv.item_code}
                            </span>
                          </td>
                          <td className="px-3.5 py-3">
                            <div className="font-bold text-slate-900">{inv.location || '—'}</div>
                            {(inv.rack || inv.shelf_number) && (
                              <div className="text-[10px] text-slate-500">
                                {inv.rack && `Rack: ${inv.rack}`} {inv.rack && inv.shelf_number && '|'} {inv.shelf_number && `Shelf: ${inv.shelf_number}`}
                              </div>
                            )}
                          </td>
                          <td className="px-3.5 py-3 text-right font-mono font-black text-slate-900">
                            {inv.quantity || 0}
                          </td>
                          <td className="px-3.5 py-3">
                            <div className="flex flex-col gap-0.5 items-start">
                              {inv.trace_item_id && (
                                <span className="font-mono text-[9px] text-indigo-700 font-bold bg-indigo-50 border border-indigo-200 px-1 py-0.2 rounded">
                                  TR-{inv.trace_item_id}
                                </span>
                              )}
                              <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${badgeCls}`}>
                                {st}
                              </span>
                            </div>
                          </td>
                          <td className="px-3.5 py-3 text-right font-mono font-bold">
                            ₹{parseFloat(inv.calculated_price || inv.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3.5 py-3 text-right">
                            <input
                              type="number"
                              min="0"
                              max={Math.min(inv.quantity, openStockPickerItem.remaining_qty)}
                              value={allocQty}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                setStockAllocations(prev => ({ ...prev, [inv.id]: val }));
                              }}
                              className="w-20 px-2 py-1 text-xs border border-slate-300 rounded font-bold text-right focus:outline-none focus:border-indigo-500"
                            />
                          </td>
                          <td className="px-3.5 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleSelectStockRow(inv, allocQty)}
                              disabled={allocQty <= 0 || allocQty > inv.quantity}
                              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-[10px] rounded-lg transition-colors cursor-pointer shadow-xs disabled:cursor-not-allowed"
                            >
                              Select Stock
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpenStockPickerItem(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
