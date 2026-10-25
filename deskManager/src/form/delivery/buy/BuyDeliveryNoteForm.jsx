import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { AlertCircle, ArrowLeft, RefreshCw, Tag } from 'lucide-react';
import DeliveryNoteHeader from '../components/DeliveryNoteHeader';

export default function BuyDeliveryNoteForm({ editingNo: propEditingNo, tradeId: propTradeId }) {
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
    if (location.state?.returnState) {
      const returnState = location.state.returnState;
      const updatedQty = location.state.updatedQty;
      const actionType = location.state.actionType || (location.state.status === 'In Inventory' ? 'inventory' : 'inventory');

      setTradeId(returnState.tradeId);
      setFormData(returnState.formData);

      const mapped = returnState.items.map((it) => {
        if (it.item_code === returnState.selectedItemCode) {
          const inv_qty = actionType === 'inventory' ? (updatedQty !== undefined ? updatedQty : it.inv_qty || 0) : it.inv_qty || 0;
          const delivery_qty = inv_qty;
          const invDetails = actionType === 'inventory' ? location.state.inventoryDetails || it.inv_details : it.inv_details;

          return {
            ...it,
            selected: true,
            delivery_qty,
            inv_qty,
            inv_details: invDetails,
            linked_inventory_id: invDetails?.inventory_id || it.linked_inventory_id || null,
            linked_trace_item_id: invDetails?.trace_item_id || it.linked_trace_item_id || null,
            linked_p_item_id: invDetails?.trace_item_id || it.linked_p_item_id || null
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

        const mergedItems = lookupData.items.map((lookupItem) => {
          const dnItem = (noteData.items || []).find((di) => di.item_code === lookupItem.item_code);
          const isSelected = Boolean(dnItem);
          const deliveryQty = dnItem ? parseFloat(dnItem.quantity) || 0 : lookupItem.remaining_qty;
          const remainingLimit = lookupItem.remaining_qty + (dnItem ? parseFloat(dnItem.quantity) || 0 : 0);

          return {
            ...lookupItem,
            selected: isSelected,
            delivery_qty: deliveryQty,
            remaining_qty: remainingLimit,
            inv_qty: dnItem ? parseFloat(dnItem.quantity) || 0 : 0,
            inv_details: null
          };
        });

        setItems(mergedItems);
      } else {
        // Create mode
        if (!queryTradeId) throw new Error('trade_id query parameter is required to create a Buy Delivery Note');
        setTradeId(queryTradeId);

        const lookupRes = await fetch(`/api/delivery-notes/items-lookup/${encodeURIComponent(queryTradeId)}`);
        if (!lookupRes.ok) throw new Error('Failed to load item schema for trade');
        const lookupData = await lookupRes.json();

        const initialItems = lookupData.items.map((item) => ({
          ...item,
          selected: false,
          delivery_qty: 0,
          inv_qty: 0,
          inv_details: null,
          linked_inventory_id: null,
          linked_trace_item_id: null,
          linked_p_item_id: null
        }));

        setItems(initialItems);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to initialize Buy Delivery Note form');
    } finally {
      setIsLoading(false);
    }
  };

  const handleHeaderChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleItemCheckboxChange = (index) => {
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const newSelected = !item.selected;
        return {
          ...item,
          selected: newSelected,
          delivery_qty: newSelected ? item.delivery_qty || item.inv_qty || 0 : 0
        };
      })
    );
  };

  const handleAddInInventory = (item) => {
    navigate('/inventory/form', {
      state: {
        autofill: {
          item_code: item.item_code,
          qty: item.inv_qty || item.delivery_qty || item.remaining_qty,
          cost_price:
            item.rate_per_piece !== undefined && item.rate_per_piece !== ''
              ? item.rate_per_piece
              : item.inv_details?.cost_price || 0,
          trade_id: tradeId,
          delivery_note_no: formData.delivery_note_no || editingNo || '',
          status: 'In Inventory',
          actionType: 'inventory',
          existingDetails: item.inv_details,
          returnUrl: editingNo
            ? `/updateDeliveryNote/${encodeURIComponent(editingNo)}`
            : '/addDeliveryNote',
          returnState: {
            formData,
            tradeId,
            tradeType: 'buy',
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
          inv_qty: item.inv_qty || 0,
          inv_details: item.inv_details || null,
          stock_allocations: []
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
        throw new Error(errData.error || 'Failed to save Buy Delivery Note');
      }

      navigate(`/trade/${encodeURIComponent(tradeId)}`);
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
          <p className="text-xs font-semibold text-slate-500">Loading Buy Delivery Note details…</p>
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
              <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded bg-blue-100 text-blue-800 border border-blue-300">
                Buy Receiving
              </span>
              <h1 className="text-lg font-black text-slate-950 m-0">
                {editingNo ? 'Modify Buy Delivery Note' : 'Create Buy Delivery Note'}
              </h1>
            </div>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
              Receive inward supplier items and register into inventory against Purchase Order / Contract Order.
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
                Items from Purchase Order
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
                    <th className="px-3 py-2 text-right w-20">Received Qty</th>
                    <th className="px-3 py-2 text-right w-20">Price</th>
                    <th className="px-3 py-2 text-center w-[200px]">Action</th>
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
                        {item.inv_qty > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold bg-indigo-50 border border-indigo-200 text-indigo-700 shadow-sm animate-fade-in">
                              <Tag size={8} /> In Inventory: {item.inv_qty}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right text-slate-500 font-bold">{item.original_qty}</td>
                      <td className="px-3 py-1.5 text-right text-emerald-600 font-bold">{item.delivered_qty}</td>
                      <td className="px-3 py-1.5 text-right text-indigo-600 font-extrabold">{item.remaining_qty}</td>
                      <td className="px-3 py-1.5 text-right">
                        <span className="font-bold text-xs text-slate-800 font-mono">
                          {item.delivery_qty || 0}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono font-bold text-slate-800">
                        ₹{parseFloat(item.rate_per_piece || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleAddInInventory(item)}
                          className="px-2.5 py-1 text-[9px] font-extrabold rounded-lg text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-colors cursor-pointer"
                        >
                          {item.inv_qty > 0 ? 'Update Inventory' : 'Add in inventory'}
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
                'Save Buy Delivery Note'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
