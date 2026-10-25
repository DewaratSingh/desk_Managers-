import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { AlertCircle, ArrowLeft, RefreshCw, Package } from 'lucide-react';
import DeliveryNoteHeader from '../components/DeliveryNoteHeader';
import StockSelectionModal from './StockSelectionModal';

export default function SellDeliveryNoteForm({ editingNo: propEditingNo, tradeId: propTradeId }) {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const queryTradeId = searchParams.get('trade_id') || propTradeId;
  const editingNo = propEditingNo || id || null;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const [tradeId, setTradeId] = useState(queryTradeId || '');

  // Stock Selection Modal state
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

  const [items, setItems] = useState([]);

  useEffect(() => {
    loadInitialData();
  }, [editingNo, queryTradeId]);

  const loadInitialData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (editingNo) {
        // Edit mode
        const noteRes = await fetch(`/api/delivery-notes/${encodeURIComponent(editingNo)}`);
        if (!noteRes.ok) throw new Error('Delivery Note not found');
        const noteData = await noteRes.json();

        setTradeId(noteData.trade_id);
        setFormData({
          delivery_note_no: noteData.delivery_note_no,
          delivery_date: noteData.delivery_date ? noteData.delivery_date.split('T')[0] : '',
          dispatch_through: noteData.dispatch_through || '',
          dispatch_doc_no: noteData.dispatch_doc_no || '',
          motor_vehicle_no: noteData.motor_vehicle_no || ''
        });

        const lookupRes = await fetch(
          `/api/delivery-notes/items-lookup/${encodeURIComponent(noteData.trade_id)}?exclude_dn_no=${encodeURIComponent(editingNo)}`
        );
        if (!lookupRes.ok) throw new Error('Failed to load item schema for trade');
        const lookupData = await lookupRes.json();

        const mergedItems = await Promise.all(
          lookupData.items.map(async (lookupItem) => {
            const dnItem = (noteData.items || []).find((di) => di.item_code === lookupItem.item_code);
            const isSelected = Boolean(dnItem);
            const deliveryQty = dnItem ? parseFloat(dnItem.quantity) || 0 : lookupItem.remaining_qty;
            const remainingLimit = lookupItem.remaining_qty + (dnItem ? parseFloat(dnItem.quantity) || 0 : 0);

            let inventory_qty = 0;
            let inventory_price = 0;
            try {
              const res = await fetch(`/api/inventory/item/${encodeURIComponent(lookupItem.item_code)}/availability`);
              if (res.ok) {
                const invData = await res.json();
                inventory_qty = invData.available_qty || 0;
                inventory_price = invData.price || 0;
              }
            } catch (e) {
              console.error(e);
            }

            return {
              ...lookupItem,
              selected: isSelected,
              delivery_qty: deliveryQty,
              remaining_qty: remainingLimit,
              inventory_qty,
              inventory_price,
              stock_allocations: dnItem?.stock_allocations || []
            };
          })
        );

        setItems(mergedItems);
      } else {
        // Create mode
        if (!queryTradeId) throw new Error('trade_id query parameter is required to create a Sell Delivery Note');
        setTradeId(queryTradeId);

        const lookupRes = await fetch(`/api/delivery-notes/items-lookup/${encodeURIComponent(queryTradeId)}`);
        if (!lookupRes.ok) throw new Error('Failed to load item schema for trade');
        const lookupData = await lookupRes.json();

        const autofillSell = location.state?.autofillSell;

        const initialItems = await Promise.all(
          lookupData.items.map(async (item) => {
            const isAutofill = autofillSell && item.item_code === autofillSell.item_code;

            let inventory_qty = 0;
            let inventory_price = 0;
            try {
              const res = await fetch(`/api/inventory/item/${encodeURIComponent(item.item_code)}/availability`);
              if (res.ok) {
                const invData = await res.json();
                inventory_qty = invData.available_qty || 0;
                inventory_price = invData.price || 0;
              }
            } catch (e) {
              console.error(e);
            }

            return {
              ...item,
              selected: isAutofill ? true : false,
              delivery_qty: isAutofill ? autofillSell.delivery_qty : 0,
              linked_inventory_id: isAutofill ? autofillSell.inventory_id : null,
              linked_trace_item_id: isAutofill ? (autofillSell.trace_item_id || autofillSell.p_item_id || autofillSell.p_id) : null,
              linked_p_item_id: isAutofill ? (autofillSell.trace_item_id || autofillSell.p_item_id || autofillSell.p_id) : null,
              inventory_qty,
              inventory_price,
              stock_allocations: isAutofill && autofillSell.inventory_id
                ? [{
                    inventory_id: autofillSell.inventory_id,
                    qty: autofillSell.delivery_qty,
                    quantity: autofillSell.delivery_qty,
                    trace_id: autofillSell.trace_item_id || autofillSell.p_item_id || autofillSell.p_id,
                    trace_item_id: autofillSell.trace_item_id || autofillSell.p_item_id || autofillSell.p_id
                  }]
                : []
            };
          })
        );

        setItems(initialItems);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to initialize Sell Delivery Note form');
    } finally {
      setIsLoading(false);
    }
  };

  const handleHeaderChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const fetchStockForItem = async (item) => {
    setOpenStockPickerItem(item);
    setStockLoading(true);
    setStockList([]);

    const initAllocations = {};
    if (item.stock_allocations && Array.isArray(item.stock_allocations)) {
      item.stock_allocations.forEach((alloc) => {
        initAllocations[alloc.inventory_id] = alloc.quantity;
      });
    } else if (item.linked_inventory_id) {
      initAllocations[item.linked_inventory_id] = item.delivery_qty;
    }
    setStockAllocations(initAllocations);

    try {
      const res = await fetch(`/api/inventory/stock-by-item?item_code=${encodeURIComponent(item.item_code)}`);
      if (res.ok) {
        const data = await res.json();
        setStockList(data);
      }
    } catch (err) {
      console.error('Error fetching stock for item:', err);
    } finally {
      setStockLoading(false);
    }
  };

  const handleConfirmMultiStock = (selectedAllocations, totalAlloc) => {
    if (!openStockPickerItem) return;
    const firstAlloc = selectedAllocations[0];

    setItems((prev) =>
      prev.map((it) => {
        if (it.item_code === openStockPickerItem.item_code) {
          return {
            ...it,
            selected: true,
            delivery_qty: totalAlloc,
            stock_allocations: selectedAllocations,
            linked_inventory_id: firstAlloc.inventory_id,
            linked_trace_item_id: firstAlloc.trace_id,
            linked_p_item_id: firstAlloc.trace_id,
            inv_details: {
              location: firstAlloc.location,
              cost_price: firstAlloc.cost_price,
              trace_id: firstAlloc.trace_id,
              inventory_id: firstAlloc.inventory_id,
              status: firstAlloc.status
            }
          };
        }
        return it;
      })
    );

    setOpenStockPickerItem(null);
  };

  const handleItemCheckboxChange = (index) => {
    const targetItem = items[index];
    const newSelected = !targetItem.selected;

    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        return {
          ...item,
          selected: newSelected,
          delivery_qty: newSelected ? item.delivery_qty || 0 : 0,
          linked_inventory_id: newSelected ? item.linked_inventory_id : null,
          linked_trace_item_id: newSelected ? item.linked_trace_item_id : null
        };
      })
    );

    if (newSelected) {
      fetchStockForItem(targetItem);
    }
  };

  const handleItemQtyChange = (index, value) => {
    const parsedVal = parseFloat(value) || 0;
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        if (parsedVal > (item.inventory_qty || 0)) {
          alert(`Quantity for item ${item.item_code} cannot exceed available stock of ${item.inventory_qty || 0}.`);
          return item;
        }
        return {
          ...item,
          delivery_qty: parsedVal,
          selected: parsedVal > 0 ? true : item.selected
        };
      })
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

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

    const selectedList = items.filter((i) => i.selected);
    if (selectedList.length === 0) {
      setError('You must select at least one item to deliver.');
      return;
    }

    for (const item of selectedList) {
      if (item.delivery_qty < 0) {
        setError(`Quantity for item ${item.item_code} cannot be negative.`);
        return;
      }
      if (item.delivery_qty > item.remaining_qty) {
        setError(`Quantity for item ${item.item_code} cannot exceed remaining limit of ${item.remaining_qty}.`);
        return;
      }
      if (item.delivery_qty > (item.inventory_qty || 0)) {
        setError(`Quantity for item ${item.item_code} cannot exceed available stock of ${item.inventory_qty || 0}.`);
        return;
      }
    }

    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        trade_id: tradeId,
        items: selectedList.map((item) => ({
          item_code: item.item_code,
          quantity: item.delivery_qty,
          rate_per_piece: item.rate_per_piece,
          shipping_address: item.shipping_address,
          delivery_date: item.delivery_date,
          inv_qty: 0,
          inv_details: item.inv_details || null,
          stock_allocations: Array.isArray(item.stock_allocations) ? item.stock_allocations : []
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
        throw new Error(errData.error || 'Failed to save Sell Delivery Note');
      }

      const autofillSell = location.state?.autofillSell;
      if (autofillSell && autofillSell.source === 'delivery_note' && autofillSell.returnState) {
        const ret = autofillSell.returnState;
        const updatedItems = ret.items.map((it) => {
          if (it.item_code === ret.selectedItemCode) {
            const currentSellQty = autofillSell.delivery_qty;
            const currentInvQty = it.inv_qty || 0;
            const currentProcessQty = it.process_qty || 0;
            return {
              ...it,
              selected: true,
              sell_qty: currentSellQty,
              delivery_qty: currentInvQty + currentSellQty + currentProcessQty
            };
          }
          return it;
        });

        const newReturnState = { ...ret, items: updatedItems };
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="animate-spin text-indigo-600" size={24} style={{ color: 'var(--theme-color)' }} />
          <p className="text-xs font-semibold text-slate-500">Loading Sell Delivery Note details…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 flex items-center justify-center">
      <div className="max-w-7xl w-full bg-[white] border border-slate-200 shadow-lg rounded-xl p-4 sm:p-5 space-y-4">
        {/* Header */}
        <div className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                Sell Dispatch
              </span>
              <h1 className="text-lg font-black text-slate-950 m-0">
                {editingNo ? 'Modify Sell Delivery Note' : 'Create Sell Delivery Note'}
              </h1>
            </div>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
              Select stock from inventory and record dispatch to customer against Release Order / PO.
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
          <DeliveryNoteHeader
            formData={formData}
            onChange={handleHeaderChange}
            editingNo={editingNo}
            tradeId={tradeId}
          />

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
                    <th className="px-3 py-2 text-center w-28">Stock Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-[white]">
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
                        <div className="flex flex-wrap gap-1 mt-1">
                          <span
                            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold shadow-sm ${
                              item.inventory_qty > 0
                                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                                : 'bg-rose-50 border border-rose-200 text-rose-700'
                            }`}
                          >
                            <Package size={8} />
                            Available: {item.inventory_qty || 0}
                            {item.inventory_qty > 0 &&
                              ` (Cost: ₹${parseFloat(item.inventory_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })})`}
                          </span>
                          {item.stock_allocations && item.stock_allocations.length > 0 ? (
                            item.stock_allocations.map((alloc, aIdx) => (
                              <span
                                key={aIdx}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-black bg-emerald-100 border border-emerald-300 text-emerald-900 shadow-xs"
                              >
                                <Package size={8} /> Allocated TR-{alloc.trace_item_id || 'Stock'} ({alloc.quantity} units)
                              </span>
                            ))
                          ) : item.linked_inventory_id ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-black bg-emerald-100 border border-emerald-300 text-emerald-900 shadow-xs">
                              <Package size={8} /> Allocated TR-{item.linked_trace_item_id || 'Stock'} ({item.delivery_qty} units)
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-right text-slate-500 font-bold">{item.original_qty}</td>
                      <td className="px-3 py-1.5 text-right text-emerald-600 font-bold">{item.delivered_qty}</td>
                      <td className="px-3 py-1.5 text-right text-indigo-600 font-extrabold">{item.remaining_qty}</td>
                      <td className="px-3 py-1.5 text-right">
                        <input
                          type="number"
                          step="any"
                          value={item.delivery_qty}
                          max={item.remaining_qty}
                          onChange={(e) => handleItemQtyChange(idx, e.target.value)}
                          className="w-full px-1.5 py-0.5 text-xs border border-slate-300 rounded font-bold text-right focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono font-bold text-slate-800">
                        ₹{parseFloat(item.rate_per_piece || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => fetchStockForItem(item)}
                          className="px-2.5 py-1 text-[9px] font-extrabold rounded-lg text-emerald-800 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 transition-colors cursor-pointer flex items-center justify-center gap-1 shadow-2xs mx-auto"
                        >
                          <Package size={10} />
                          {item.linked_inventory_id || (item.stock_allocations && item.stock_allocations.length > 0)
                            ? 'Re-select Stock'
                            : 'Select from Stock'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-6 text-center text-slate-400 text-xs font-semibold">
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
              className="px-4 py-2 bg-[white] border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
              style={{ backgroundColor: 'var(--theme-color)' }}
              onMouseEnter={(e) => { e.target.style.filter = 'brightness(0.9)'; }}
              onMouseLeave={(e) => { e.target.style.filter = 'none'; }}
            >
              {isSaving ? (
                <>
                  <RefreshCw size={12} className="animate-spin" /> Saving...
                </>
              ) : (
                'Save Sell Delivery Note'
              )}
            </button>
          </div>
        </form>
      </div>

      <StockSelectionModal
        openStockPickerItem={openStockPickerItem}
        stockList={stockList}
        stockLoading={stockLoading}
        stockAllocations={stockAllocations}
        setStockAllocations={setStockAllocations}
        onClose={() => setOpenStockPickerItem(null)}
        onConfirm={handleConfirmMultiStock}
      />
    </div>
  );
}
