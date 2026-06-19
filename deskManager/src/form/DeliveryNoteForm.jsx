import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';

const labelCls = "block text-xs font-bold text-slate-700 uppercase mb-1.5";
const inputCls = "w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm placeholder:text-slate-400 font-medium focus:outline-none transition-colors duration-150 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed";

export default function DeliveryNoteForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const queryTradeId = searchParams.get('trade_id');
  const editingNo = id || null;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  // Trade ID to redirect back to
  const [tradeId, setTradeId] = useState(queryTradeId || '');

  // Header state
  const [formData, setFormData] = useState({
    delivery_note_no: '',
    delivery_date: new Date().toISOString().split('T')[0],
    dispatch_through: '',
    dispatch_doc_no: '',
    motor_vehicle_no: ''
  });

  // Table items state
  // Each item: { item_code, description, drawing_number, original_qty, delivered_qty, remaining_qty, rate_per_piece, shipping_address, selected: bool, delivery_qty: number }
  const [items, setItems] = useState([]);

  useEffect(() => {
    loadInitialData();
  }, [editingNo, queryTradeId]);

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
        setFormData({
          delivery_note_no: noteData.delivery_note_no,
          delivery_date: noteData.delivery_date,
          dispatch_through: noteData.dispatch_through || '',
          dispatch_doc_no: noteData.dispatch_doc_no || '',
          motor_vehicle_no: noteData.motor_vehicle_no || ''
        });

        // Fetch items-lookup excluding current note
        const lookupRes = await fetch(`/api/delivery-notes/items-lookup/${encodeURIComponent(noteData.trade_id)}?exclude_dn_no=${encodeURIComponent(editingNo)}`);
        if (!lookupRes.ok) throw new Error('Failed to load item schema for trade');
        const lookupData = await lookupRes.json();

        // Merge noteData items into lookupData items
        const mergedItems = lookupData.items.map(lookupItem => {
          const dnItem = (noteData.items || []).find(di => di.item_code === lookupItem.item_code);
          const isSelected = !!dnItem;
          const deliveryQty = dnItem ? parseInt(dnItem.quantity) || 0 : lookupItem.remaining_qty;
          
          // Re-calculate remaining_qty for editing to include this note's quantity
          const remainingLimit = lookupItem.remaining_qty + (dnItem ? parseInt(dnItem.quantity) || 0 : 0);

          return {
            ...lookupItem,
            selected: isSelected,
            delivery_qty: deliveryQty,
            remaining_qty: remainingLimit // Maximum limit for this edit
          };
        });

        setItems(mergedItems);
      } else {
        // Create mode: fetch lookup directly
        if (!queryTradeId) throw new Error('trade_id query parameter is required to create a Delivery Note');
        setTradeId(queryTradeId);

        const lookupRes = await fetch(`/api/delivery-notes/items-lookup/${encodeURIComponent(queryTradeId)}`);
        if (!lookupRes.ok) throw new Error('Failed to load item schema for trade');
        const lookupData = await lookupRes.json();

        // Set items: default check all items with remaining quantity > 0
        const initialItems = lookupData.items.map(item => ({
          ...item,
          selected: item.remaining_qty > 0,
          delivery_qty: item.remaining_qty
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

  const handleItemCheckboxChange = (index) => {
    setItems(prev => prev.map((item, idx) => {
      if (idx !== index) return item;
      const newSelected = !item.selected;
      return {
        ...item,
        selected: newSelected,
        // Reset qty to remaining if checked, or 0 if unchecked
        delivery_qty: newSelected ? item.remaining_qty : 0
      };
    }));
  };

  const handleItemQtyChange = (index, value) => {
    const qty = parseInt(value) || 0;
    setItems(prev => prev.map((item, idx) => {
      if (idx !== index) return item;
      return {
        ...item,
        delivery_qty: qty
      };
    }));
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
      if (item.delivery_qty <= 0) {
        setError(`Quantity for item ${item.item_code} must be greater than 0.`);
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
        items: selectedList.map(item => ({
          item_code: item.item_code,
          quantity: item.delivery_qty,
          rate_per_piece: item.rate_per_piece,
          shipping_address: item.shipping_address,
          delivery_date: item.delivery_date
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

      // Redirect to trade details page
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

  if (isLoading) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="flex flex-col items-center gap-3">
        <RefreshCw className="animate-spin text-indigo-600" size={30} style={{ color: 'var(--theme-color)' }} />
        <p className="text-sm font-semibold text-slate-500">Loading details…</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 flex items-center justify-center">
      <div className="max-w-4xl w-full bg-white border border-slate-200 shadow-xl rounded-2xl p-6 sm:p-8 space-y-6">
        
        {/* Header */}
        <div className="pb-4 border-b border-slate-200">
          <button
            onClick={handleBackToTrade}
            className="mb-4 text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer bg-slate-100 hover:bg-slate-200 px-3.5 py-1.5 rounded-lg border border-slate-200 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Trade
          </button>
          <h1 className="text-2xl font-black text-slate-950 m-0">
            {editingNo ? 'Modify Delivery Note' : 'Create Delivery Note'}
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            Fill in details to log item dispatch. Items and maximum limits are pulled from the trade's PO or RO.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl p-4 text-xs font-bold text-red-600">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Header metadata inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
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

            <div className="flex flex-col justify-end pb-1.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Reference Trade ID</span>
              <span className="text-sm font-bold text-slate-800 font-mono mt-0.5">{tradeId}</span>
            </div>
          </div>

          {/* Items selection */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
              Select Items to Deliver
            </h3>
            
            <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="px-4 py-3 text-center w-12">Select</th>
                    <th className="px-4 py-3">Item Code</th>
                    <th className="px-4 py-3">Description & Drawing</th>
                    <th className="px-4 py-3 text-right">Order Qty</th>
                    <th className="px-4 py-3 text-right">Delivered</th>
                    <th className="px-4 py-3 text-right">Remaining Limit</th>
                    <th className="px-4 py-3 text-right w-28">Delivery Qty</th>
                    <th className="px-4 py-3 text-right">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {items.map((item, idx) => (
                    <tr
                      key={item.item_code}
                      className={`hover:bg-slate-50 transition-colors ${item.selected ? 'bg-indigo-50/10' : ''}`}
                    >
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={() => handleItemCheckboxChange(idx)}
                          className="w-4.5 h-4.5 accent-indigo-600 rounded cursor-pointer border-slate-300"
                        />
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-xs text-slate-800">
                        <span className="px-1.5 py-0.5 border border-slate-200 rounded bg-slate-50">
                          {item.item_code}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800 text-xs">{item.description || '—'}</div>
                        {item.drawing_number && (
                          <div className="text-[10px] text-slate-400 font-bold mt-0.5">DWG: {item.drawing_number}</div>
                        )}
                        {item.shipping_address && (
                          <div className="text-[9px] text-slate-500 mt-1 max-w-[180px] truncate" title={item.shipping_address}>
                            Ship: {item.shipping_address}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 font-bold">{item.original_qty}</td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-bold">{item.delivered_qty}</td>
                      <td className="px-4 py-3 text-right text-indigo-600 font-extrabold">{item.remaining_qty}</td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          value={item.delivery_qty}
                          min="1"
                          max={item.remaining_qty}
                          disabled={!item.selected}
                          onChange={(e) => handleItemQtyChange(idx, e.target.value)}
                          onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                          onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                          className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded font-bold text-right focus:outline-none disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">
                        ₹{parseFloat(item.rate_per_piece || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan="8" className="px-4 py-8 text-center text-slate-400 text-xs font-semibold">
                        No items found in linked PO/RO.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleBackToTrade}
              className="px-5 py-2.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 text-white font-bold text-xs rounded-lg shadow transition-opacity hover:opacity-90 disabled:opacity-55 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
              style={{ backgroundColor: 'var(--theme-color)' }}
            >
              {isSaving ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  Saving Note…
                </>
              ) : (
                'Save Delivery Note'
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
