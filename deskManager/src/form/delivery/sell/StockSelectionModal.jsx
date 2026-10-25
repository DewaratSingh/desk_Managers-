import React from 'react';
import { Package, X, RefreshCw, AlertCircle } from 'lucide-react';

export default function StockSelectionModal({
  openStockPickerItem,
  stockList,
  stockLoading,
  stockAllocations,
  setStockAllocations,
  onClose,
  onConfirm
}) {
  if (!openStockPickerItem) return null;

  const currentTotalSelected = stockList.reduce(
    (sum, inv) => sum + (parseFloat(stockAllocations[inv.id]) || 0),
    0
  );
  const isOverLimit = currentTotalSelected > openStockPickerItem.remaining_qty;

  const handleConfirm = () => {
    let totalAlloc = 0;
    const selectedAllocations = [];

    for (const invRow of stockList) {
      const qty = parseFloat(stockAllocations[invRow.id]) || 0;
      if (qty > 0) {
        if (qty > invRow.qty) {
          alert(`Cannot allocate ${qty} from batch TR-${invRow.id || 'Stock'} as only ${invRow.qty} is available.`);
          return;
        }
        totalAlloc += qty;
        selectedAllocations.push({
          trace_id: invRow.id,
          inventory_id: invRow.inventory_id,
          qty: qty,
          cost_price: invRow.cost_price || 0,
          location: invRow.location,
          status: invRow.status
        });
      }
    }

    if (selectedAllocations.length === 0) {
      alert("Please select at least one stock quantity.");
      return;
    }

    if (totalAlloc > openStockPickerItem.remaining_qty) {
      alert(`Total selected quantity (${totalAlloc}) cannot exceed remaining order limit of ${openStockPickerItem.remaining_qty}.`);
      return;
    }

    onConfirm(selectedAllocations, totalAlloc);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[white] border border-slate-300 rounded-2xl max-w-5xl w-full p-6 shadow-2xl space-y-4 animate-fade-in flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex justify-between items-start border-b border-slate-200 pb-3 shrink-0">
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
            onClick={onClose}
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
          <div className="overflow-y-auto overflow-x-auto border border-slate-200 rounded-xl shadow-xs flex-1">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-3.5 py-2.5">Item Code</th>
                  <th className="px-3.5 py-2.5">Location</th>
                  <th className="px-3.5 py-2.5 text-right">Available Qty</th>
                  <th className="px-3.5 py-2.5">Inv Status</th>
                  <th className="px-3.5 py-2.5">Trace Status</th>
                  <th className="px-3.5 py-2.5 text-right">Price</th>
                  <th className="px-3.5 py-2.5 text-right w-32">Select Qty</th>
                  <th className="px-3.5 py-2.5 text-center w-24">Quick fill</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-[white] font-semibold text-slate-800">
                {stockList.map((inv) => {
                  const st = inv.trace_status || inv.status || 'active';
                  let badgeCls = "bg-slate-100 border-slate-200 text-slate-700";
                  if (st === 'For process') badgeCls = "bg-amber-50 border-amber-300 text-amber-800";
                  else if (st === 'For Sell') badgeCls = "bg-emerald-50 border-emerald-300 text-emerald-800";
                  else if (st === 'In Inventory') badgeCls = "bg-indigo-50 border-indigo-300 text-indigo-800";
                  else if (st === 'manufacturing') badgeCls = "bg-amber-100 border-amber-300 text-amber-800";

                  const allocQty = stockAllocations[inv.id] !== undefined ? stockAllocations[inv.id] : 0;
                  
                  let traceStr = "Created";
                  if (inv.history && Array.isArray(inv.history) && inv.history.length > 0) {
                    const lastStep = inv.history[inv.history.length - 1];
                    traceStr = lastStep.trace || lastStep.action || lastStep.type || 'Created';
                  }

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3.5 py-3 font-mono font-bold text-slate-900">
                        <span className="px-1.5 py-0.5 border border-slate-200 rounded bg-slate-100 text-[10px]">
                          {inv.item_code}
                        </span>
                      </td>
                      <td className="px-3.5 py-3">
                        <div className="font-bold text-slate-900">{inv.location || '—'}</div>
                      </td>
                      <td className="px-3.5 py-3 text-right font-mono font-black text-slate-900">
                        {inv.qty || 0}
                      </td>
                      <td className="px-3.5 py-3">
                        <div className="flex flex-col gap-0.5 items-start">
                          {inv.id && (
                            <span className="font-mono text-[9px] text-indigo-700 font-bold bg-indigo-50 border border-indigo-200 px-1 py-0.2 rounded">
                              TR-{inv.id}
                            </span>
                          )}
                          <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${badgeCls}`}>
                            {st}
                          </span>
                        </div>
                      </td>
                      <td className="px-3.5 py-3 text-[10px] font-bold">
                        <span className="inline-flex items-center bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-200 shadow-sm truncate max-w-[120px]" title={traceStr}>
                          {traceStr}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 text-right font-mono font-bold">
                        ₹{parseFloat(inv.cost_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3.5 py-3 text-right">
                        <input
                          type="number"
                          step="any"
                          max={inv.qty}
                          value={allocQty}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setStockAllocations(prev => ({ ...prev, [inv.id]: val }));
                          }}
                          className="w-24 px-2 py-1 text-xs border border-slate-300 rounded font-bold text-right focus:outline-none focus:border-indigo-500"
                        />
                      </td>
                      <td className="px-3.5 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            const currentOtherAlloc = stockList.reduce(
                              (sum, item) => item.id === inv.id ? sum : sum + (parseFloat(stockAllocations[item.id]) || 0),
                              0
                            );
                            const needed = Math.max(0, openStockPickerItem.remaining_qty - currentOtherAlloc);
                            const maxFill = Math.min(inv.qty, needed);
                            setStockAllocations(prev => ({ ...prev, [inv.id]: maxFill }));
                          }}
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

        {/* Modal Actions */}
        <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
          <div className="text-xs font-bold text-slate-700">
            Total Selected Quantity:{' '}
            <span className={`font-mono text-sm font-black ${
              isOverLimit ? 'text-red-600' : currentTotalSelected > 0 ? 'text-emerald-600' : 'text-slate-800'
            }`}>
              {currentTotalSelected}
            </span>
            <span className="text-slate-400 font-semibold"> / {openStockPickerItem.remaining_qty} max allowed</span>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={currentTotalSelected <= 0 || isOverLimit}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-sm disabled:cursor-not-allowed"
            >
              Confirm Selected Stock
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
