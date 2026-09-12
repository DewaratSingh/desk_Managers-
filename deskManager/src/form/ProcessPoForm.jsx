import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Cpu, ArrowRight, AlertCircle, Loader2, Check,
  Package, X, RefreshCw, Plus, Trash2
} from 'lucide-react';

const inputCls = 'w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500 font-semibold bg-white text-slate-800';
const labelCls = 'block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5';

// ── Inventory Picker Modal ────────────────────────────────────────────────────
function InventoryPickerModal({ itemCode, itemLabel, onConfirm, onClose }) {
  const [stockList, setStockList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allocations, setAllocations] = useState({});

  useEffect(() => {
    const fetchStock = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/inventory?q=${encodeURIComponent(itemCode)}&limit=100`);
        if (res.ok) {
          const data = await res.json();
          // filter to exact item code match with quantity > 0
          const filtered = data.filter(inv => inv.item_code === itemCode && (inv.quantity || 0) > 0);
          setStockList(filtered.length > 0 ? filtered : data.filter(inv => inv.item_code === itemCode));
        }
      } catch (err) {
        console.error('Error fetching inventory:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStock();
  }, [itemCode]);

  const handleConfirm = () => {
    const selected = [];
    for (const inv of stockList) {
      const qty = parseInt(allocations[inv.id]) || 0;
      if (qty <= 0) continue;
      if (qty > inv.quantity) {
        alert(`Cannot allocate ${qty} from TR-${inv.trace_item_id || inv.id}: only ${inv.quantity} available.`);
        return;
      }
      selected.push({
        inventory_id: inv.id,
        trace_item_id: inv.trace_item_id || null,
        quantity: qty,
        price: inv.calculated_price || inv.price || 0,
      });
    }
    if (selected.length === 0) {
      alert('Please enter quantity for at least one inventory row.');
      return;
    }
    onConfirm(selected);
  };

  const statusBadge = (s) => {
    const v = (s || '').toLowerCase();
    if (v === 'in process' || v === 'in inventory') return 'bg-indigo-50 border-indigo-200 text-indigo-700';
    if (v === 'for sell') return 'bg-emerald-50 border-emerald-200 text-emerald-700';
    if (v === 'for process') return 'bg-amber-50 border-amber-200 text-amber-700';
    return 'bg-slate-100 border-slate-200 text-slate-600';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Select Inventory Stock</p>
            <h2 className="text-sm font-black text-slate-900 mt-0.5 flex items-center gap-2">
              <Package size={14} className="text-indigo-600" />
              {itemCode}
              {itemLabel && <span className="text-slate-500 font-normal text-xs">— {itemLabel}</span>}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Table */}
        <div className="overflow-y-auto flex-1 p-5">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
              <RefreshCw size={18} className="animate-spin text-indigo-500" />
              <span className="text-xs font-semibold">Loading inventory...</span>
            </div>
          ) : stockList.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <AlertCircle size={24} className="mx-auto text-amber-500" />
              <p className="text-sm font-bold text-slate-700">No inventory found for <span className="font-mono text-indigo-700">{itemCode}</span></p>
              <p className="text-xs text-slate-400">Add stock to inventory first before creating a Process PO.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="px-3.5 py-2.5">TR-ID</th>
                    <th className="px-3.5 py-2.5">Location</th>
                    <th className="px-3.5 py-2.5 text-right">Available Qty</th>
                    <th className="px-3.5 py-2.5">Status</th>
                    <th className="px-3.5 py-2.5 text-right">Price</th>
                    <th className="px-3.5 py-2.5 text-right w-32">Select Qty</th>
                    <th className="px-3.5 py-2.5 text-center w-24">Fill</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white font-semibold text-slate-800">
                  {stockList.map((inv) => {
                    const allocQty = parseInt(allocations[inv.id]) || 0;
                    const st = inv.trace_status || inv.status || 'In Inventory';
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3.5 py-3">
                          {inv.trace_item_id ? (
                            <span className="font-mono text-[10px] text-indigo-700 font-bold bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                              TR-{inv.trace_item_id}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">—</span>
                          )}
                        </td>
                        <td className="px-3.5 py-3">
                          <div className="font-bold text-slate-800">{inv.location || '—'}</div>
                          {(inv.rack || inv.shelf_number) && (
                            <div className="text-[10px] text-slate-400">
                              {inv.rack && `Rack: ${inv.rack}`}{inv.rack && inv.shelf_number && ' | '}{inv.shelf_number && `Shelf: ${inv.shelf_number}`}
                            </div>
                          )}
                        </td>
                        <td className="px-3.5 py-3 text-right font-mono font-black text-slate-900">{inv.quantity}</td>
                        <td className="px-3.5 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${statusBadge(st)}`}>
                            {st}
                          </span>
                        </td>
                        <td className="px-3.5 py-3 text-right font-mono">
                          ₹{parseFloat(inv.calculated_price || inv.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-3.5 py-3 text-right">
                          <input
                            type="number"
                            min="0"
                            max={inv.quantity}
                            value={allocQty}
                            onChange={(e) => setAllocations(prev => ({ ...prev, [inv.id]: parseInt(e.target.value) || 0 }))}
                            className="w-24 px-2 py-1 text-xs border border-slate-300 rounded font-bold text-right focus:outline-none focus:border-indigo-500"
                          />
                        </td>
                        <td className="px-3.5 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => setAllocations(prev => ({ ...prev, [inv.id]: inv.quantity }))}
                            className="px-2 py-0.5 text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded transition-colors cursor-pointer"
                          >
                            Fill Max
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4 flex justify-between items-center gap-4 shrink-0 bg-slate-50">
          <div className="text-xs text-slate-500 font-semibold">
            Total selected:{' '}
            <span className="font-black text-indigo-700">
              {Object.values(allocations).reduce((s, v) => s + (parseInt(v) || 0), 0)} units
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-5 py-2 text-xs font-bold text-white rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
              style={{ backgroundColor: 'var(--theme-color)' }}
            >
              <Check size={13} /> Confirm Allocation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Form ─────────────────────────────────────────────────────────────────
export default function ProcessPoForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rqProcessNo = searchParams.get('rq_process_no') || '';
  const tradeId = searchParams.get('trade_id') || '';

  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysLater = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  const [rqData, setRqData] = useState(null);
  const [date, setDate] = useState(today);
  const [deliveryDate, setDeliveryDate] = useState(thirtyDaysLater);
  const [poItems, setPoItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Inventory picker state
  const [pickerOpen, setPickerOpen] = useState(null); // { rowIdx, item_code, item_label }

  // Fetch RQ data on mount
  useEffect(() => {
    if (!rqProcessNo) {
      setError('No Process RQ number provided.');
      setIsLoading(false);
      return;
    }
    const fetchRq = async () => {
      try {
        const res = await fetch(`/api/rq-process/${encodeURIComponent(rqProcessNo)}`);
        if (!res.ok) throw new Error('Process RQ not found');
        const data = await res.json();
        setRqData(data);
        // Pre-fill items from RQ
        setPoItems((data.items || []).map(it => ({
          source_item_id: it.source_item_id,
          source_item_code: it.source_item_code,
          source_description: it.source_description,
          source_drawing_number: it.source_drawing_number,
          source_item_quantity: it.source_item_quantity || 1,
          target_item_id: it.target_item_id,
          target_item_code: it.target_item_code,
          target_description: it.target_description,
          target_drawing_number: it.target_drawing_number,
          target_item_quantity: it.target_item_quantity || 1,
          price: '',
          source_item_traceid_array: [], // allocations from inventory
        })));
      } catch (err) {
        setError(err.message || 'Failed to load Process RQ');
      } finally {
        setIsLoading(false);
      }
    };
    fetchRq();
  }, [rqProcessNo]);

  const updateItemField = (idx, field, value) => {
    setPoItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  const handleInventoryConfirm = (rowIdx, allocations) => {
    setPoItems(prev => prev.map((it, i) => i === rowIdx
      ? { ...it, source_item_traceid_array: allocations }
      : it
    ));
    setPickerOpen(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    for (let i = 0; i < poItems.length; i++) {
      const it = poItems[i];
      if (it.source_item_traceid_array.length === 0) {
        setError(`Please allocate inventory stock for source item "${it.source_item_code}" (row ${i + 1}).`);
        return;
      }
    }

    setIsSaving(true);
    try {
      const payload = {
        date,
        delivery_date: deliveryDate || null,
        rq_process_no: rqProcessNo,
        trade_id: tradeId,
        items: poItems.map(it => ({
          source_item_id: it.source_item_id,
          source_item_quantity: it.source_item_quantity,
          target_item_id: it.target_item_id,
          target_item_quantity: it.target_item_quantity,
          price: parseFloat(it.price) || 0,
          source_item_traceid_array: it.source_item_traceid_array,
        })),
      };

      const res = await fetch('/api/process-po', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to create Process PO');
      }

      const result = await res.json();
      setSuccess(`Process PO ${result.po_no} created successfully!`);
      setTimeout(() => {
        if (tradeId) navigate(`/trade/${tradeId}`);
        else navigate('/dashboard');
      }, 1800);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="animate-spin text-indigo-600" size={28} />
          <p className="text-sm font-semibold text-slate-500">Loading Process RQ...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Inventory Picker Modal */}
        {pickerOpen && (
          <InventoryPickerModal
            itemCode={pickerOpen.item_code}
            itemLabel={pickerOpen.item_label}
            onConfirm={(allocs) => handleInventoryConfirm(pickerOpen.rowIdx, allocs)}
            onClose={() => setPickerOpen(null)}
          />
        )}

        {/* Header */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-700">
              <Cpu size={20} />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-950">Create Process Purchase Order</h1>
              <p className="text-xs text-slate-500 font-semibold">
                Linked to: <span className="font-mono font-bold text-indigo-700">{rqProcessNo}</span>
                {tradeId && <> · Trade: <span className="font-mono font-bold text-slate-700">{tradeId}</span></>}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => tradeId ? navigate(`/trade/${tradeId}`) : navigate('/dashboard')}
            className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl border border-slate-200 transition-colors shrink-0"
          >
            <ArrowLeft size={14} /> Back
          </button>
        </div>

        {/* RQ Summary */}
        {rqData && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm px-6 py-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3">RQ Information</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              {[
                { label: 'RQ No', value: rqData.rq_process_no },
                { label: 'Date', value: rqData.date },
                { label: 'Seller / Processor', value: rqData.seller || '—' },
                { label: 'Party / Client', value: rqData.party || '—' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
                  <p className="font-bold text-slate-800">{value}</p>
                </div>
              ))}
            </div>
            {rqData.message && (
              <div className="mt-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-600 font-medium">
                <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">Note: </span>
                {rqData.message}
              </div>
            )}
          </div>
        )}

        {/* Error / Success */}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3.5 text-xs font-bold text-red-600">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs font-bold text-emerald-700">
            <Check size={15} className="shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Date Fields */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-4">PO Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>PO Date <span className="text-red-500">*</span></label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} required className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Expected Delivery Date</label>
                <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} className={inputCls} />
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Process Item Mappings</p>

            {poItems.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No items from the Process RQ.</p>
            ) : (
              <div className="space-y-4">
                {poItems.map((item, idx) => {
                  const totalAllocated = item.source_item_traceid_array.reduce((s, a) => s + (a.quantity || 0), 0);
                  return (
                    <div key={idx} className="border border-slate-200 rounded-xl overflow-hidden">
                      {/* Row Header */}
                      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                          Item Row {idx + 1}
                        </span>
                        {totalAllocated > 0 ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            ✓ {totalAllocated} units allocated
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            ⚠ No stock allocated yet
                          </span>
                        )}
                      </div>

                      <div className="p-4 space-y-4">
                        {/* Source → Target item display */}
                        <div className="flex items-center gap-3">
                          {/* Source Item */}
                          <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-0.5">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Source Item</p>
                            <p className="font-mono font-bold text-sm text-slate-900">{item.source_item_code}</p>
                            <p className="text-xs text-slate-600 font-medium">{item.source_description}</p>
                            {item.source_drawing_number && (
                              <p className="text-[10px] text-slate-400">DWG: {item.source_drawing_number}</p>
                            )}
                          </div>
                          <ArrowRight size={18} className="text-indigo-400 shrink-0" />
                          {/* Target Item */}
                          <div className="flex-1 bg-indigo-50 border border-indigo-200 rounded-xl p-3.5 space-y-0.5">
                            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-wider">Target Item (Output)</p>
                            <p className="font-mono font-bold text-sm text-indigo-900">{item.target_item_code}</p>
                            <p className="text-xs text-indigo-700 font-medium">{item.target_description}</p>
                            {item.target_drawing_number && (
                              <p className="text-[10px] text-indigo-400">DWG: {item.target_drawing_number}</p>
                            )}
                          </div>
                        </div>

                        {/* Quantity + Price Row */}
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className={labelCls}>Source Qty</label>
                            <input
                              type="number" min="1"
                              value={item.source_item_quantity}
                              onChange={e => updateItemField(idx, 'source_item_quantity', e.target.value)}
                              className={inputCls}
                            />
                          </div>
                          <div>
                            <label className={labelCls}>Target Qty (Expected Output)</label>
                            <input
                              type="number" min="1"
                              value={item.target_item_quantity}
                              onChange={e => updateItemField(idx, 'target_item_quantity', e.target.value)}
                              className={inputCls}
                            />
                          </div>
                          <div>
                            <label className={labelCls}>Processing Price (₹)</label>
                            <input
                              type="number" min="0" step="0.01"
                              value={item.price}
                              onChange={e => updateItemField(idx, 'price', e.target.value)}
                              placeholder="0.00"
                              className={inputCls}
                            />
                          </div>
                        </div>

                        {/* Inventory Allocation Section */}
                        <div className="border border-dashed border-slate-300 rounded-xl p-3.5 space-y-2.5 bg-slate-50/50">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                              <Package size={11} /> Source Inventory Allocation
                            </p>
                            <button
                              type="button"
                              onClick={() => setPickerOpen({
                                rowIdx: idx,
                                item_code: item.source_item_code,
                                item_label: item.source_description,
                              })}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                            >
                              <Package size={10} /> Allocate from Inventory
                            </button>
                          </div>

                          {/* Allocated badges */}
                          {item.source_item_traceid_array.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {item.source_item_traceid_array.map((alloc, ai) => (
                                <div key={ai} className="flex items-center gap-1.5 bg-white border border-indigo-200 rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-indigo-800 shadow-xs">
                                  <Package size={9} className="text-indigo-500" />
                                  {alloc.trace_item_id ? `TR-${alloc.trace_item_id}` : `Inv-${alloc.inventory_id}`}
                                  <span className="text-slate-400 font-normal">×</span>
                                  <span className="text-indigo-900 font-black">{alloc.quantity}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = item.source_item_traceid_array.filter((_, i2) => i2 !== ai);
                                      updateItemField(idx, 'source_item_traceid_array', updated);
                                    }}
                                    className="text-slate-400 hover:text-red-500 transition-colors cursor-pointer ml-0.5"
                                  >
                                    <X size={9} />
                                  </button>
                                </div>
                              ))}
                              <div className="flex items-center text-[10px] font-black text-slate-600 bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5">
                                Total: {totalAllocated}
                              </div>
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-400 font-medium italic">
                              Click "Allocate from Inventory" to select trace IDs from existing stock for <span className="font-bold not-italic">{item.source_item_code}</span>.
                            </p>
                          )}
                        </div>

                        {/* Target trace ID preview note */}
                        <div className="flex items-start gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-[11px] font-medium text-indigo-700">
                          <Cpu size={12} className="mt-0.5 shrink-0" />
                          A new inventory trace ID will be auto-created for <span className="font-bold mx-1">{item.target_item_code}</span>
                          with status <span className="font-black bg-indigo-100 px-1 rounded ml-0.5">"in process"</span> and quantity <span className="font-black ml-1">{item.target_item_quantity}</span> when PO is saved.
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pb-6">
            <button
              type="button"
              onClick={() => tradeId ? navigate(`/trade/${tradeId}`) : navigate('/dashboard')}
              className="px-5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || poItems.length === 0}
              className="px-6 py-2.5 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow-sm disabled:opacity-50"
              style={{ backgroundColor: 'var(--theme-color)' }}
            >
              {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Cpu size={13} />}
              {isSaving ? 'Creating PO...' : 'Create Process PO'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
