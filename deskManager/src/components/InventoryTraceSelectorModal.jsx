import React, { useState, useEffect } from 'react';
import { Layers, Search, RefreshCw, X, AlertCircle, Check, MapPin } from 'lucide-react';
import { toast } from 'react-toastify';

export default function InventoryTraceSelectorModal({
  isOpen,
  onClose,
  onApply,
  initialSelections = {},
  sourceItemCode = '',
  allowedItemCodes = null,
  rqId = null,
  apiEndpoint = ''
}) {
  const [traceItems, setTraceItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSelections, setSelectedSelections] = useState({});

  useEffect(() => {
    if (isOpen) {
      // Format initial selections map
      const selMap = {};
      if (Array.isArray(initialSelections)) {
        initialSelections.forEach(s => {
          const tid = s.trace_id || s.traceid;
          if (tid) selMap[tid] = { ...s };
        });
      } else if (typeof initialSelections === 'object' && initialSelections !== null) {
        Object.keys(initialSelections).forEach(tid => {
          selMap[tid] = { ...initialSelections[tid] };
        });
      }
      setSelectedSelections(selMap);
      fetchTraceItems();
    }
  }, [isOpen, sourceItemCode, JSON.stringify(allowedItemCodes), rqId]);

  const fetchTraceItems = async () => {
    setLoading(true);
    try {
      let baseUrl = apiEndpoint || '/api/process-po/trace-items';
      const params = new URLSearchParams();

      if (sourceItemCode && sourceItemCode.trim()) {
        params.append('item_code', sourceItemCode.trim());
      } else if (allowedItemCodes) {
        const codesStr = Array.isArray(allowedItemCodes) ? allowedItemCodes.join(',') : String(allowedItemCodes);
        if (codesStr.trim()) params.append('allowed_item_codes', codesStr.trim());
      }
      
      if (rqId) {
        params.append('rq_id', String(rqId).trim());
      }

      const queryString = params.toString();
      const url = queryString ? `${baseUrl}?${queryString}` : baseUrl;

      let res = await fetch(url);
      if (!res.ok && baseUrl.includes('/api/process-po/trace-items')) {
        const fallbackUrl = queryString ? `/api/manufacture/trace-items?${queryString}` : '/api/manufacture/trace-items';
        res = await fetch(fallbackUrl);
      }

      if (res.ok) {
        const data = await res.json();
        // Map new schema fields if needed
        const mappedData = data.map(item => ({
          ...item,
          trace_id: item.trace_id || item.trace_item_id || item.id,
          available_qty: item.available_qty !== undefined ? item.available_qty : item.qty,
          price: item.price !== undefined ? item.price : item.cost_price,
        }));
        setTraceItems(mappedData);
      } else {
        toast.error('Failed to load inventory trace items');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error fetching inventory trace items');
    } finally {
      setLoading(false);
    }
  };

  const handleQtyChange = (item, qtyVal) => {
    const tid = item.trace_id || item.trace_item_id;
    const numQty = parseFloat(qtyVal);

    setSelectedSelections(prev => {
      const newMap = { ...prev };
      if (isNaN(numQty) || numQty <= 0) {
        delete newMap[tid];
      } else {
        const cappedQty = item.available_qty ? Math.min(numQty, parseFloat(item.available_qty)) : numQty;
        newMap[tid] = {
          trace_id: tid,
          Qty: cappedQty,
          inventory_id: item.inventory_id,
          item_code: item.item_code,
          description: item.description,
          available_qty: item.available_qty,
          price: item.price,
          location: item.location,
          rack: item.rack,
          shelf_number: item.shelf_number
        };
      }
      return newMap;
    });
  };

  const handleMaxSelect = (item) => {
    handleQtyChange(item, item.available_qty);
  };

  const handleConfirm = () => {
    const selectionsArray = Object.values(selectedSelections).map(s => ({
      trace_id: s.trace_id,
      Qty: parseFloat(s.Qty) || 0,
      inventory_id: s.inventory_id,
      item_code: s.item_code,
      description: s.description,
      available_qty: s.available_qty,
      price: s.price,
      location: s.location,
      rack: s.rack,
      shelf_number: s.shelf_number
    }));

    onApply(selectionsArray);
    onClose();
  };

  const filteredTraceItems = traceItems.filter(item => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const tidStr = String(item.trace_id || item.trace_item_id || '');
    const locStr = [item.location, item.rack, item.shelf_number].filter(Boolean).join(' ').toLowerCase();

    return (
      (item.item_code && item.item_code.toLowerCase().includes(q)) ||
      (item.description && item.description.toLowerCase().includes(q)) ||
      tidStr.includes(q) ||
      locStr.includes(q)
    );
  });

  if (!isOpen) return null;

  const totalSelectedCount = Object.keys(selectedSelections).length;
  const totalSelectedQty = Object.values(selectedSelections).reduce((sum, s) => sum + (parseFloat(s.Qty) || 0), 0);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="bg-white border border-slate-300 rounded-3xl max-w-4xl w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
        
        {/* Modal Header */}
        <div className="bg-amber-50 px-6 py-4 border-b border-amber-200 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl text-white bg-amber-600 shadow-xs">
              <Layers size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-amber-950 flex flex-wrap items-center gap-2">
                Select Inventory Trace Stock
                {sourceItemCode && (
                  <span className="text-xs font-mono font-bold bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-md">
                    Filter: {sourceItemCode}
                  </span>
                )}
                {!sourceItemCode && allowedItemCodes && (
                  <span className="text-xs font-mono font-bold bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-md">
                    RQ Source Items: {Array.isArray(allowedItemCodes) ? allowedItemCodes.join(', ') : allowedItemCodes}
                  </span>
                )}
                {rqId && !sourceItemCode && !allowedItemCodes && (
                  <span className="text-xs font-mono font-bold bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-md">
                    Linked RQ: {rqId}
                  </span>
                )}
              </h3>
              <p className="text-xs text-amber-800 font-medium mt-0.5">
                Listing available stock items with status <strong>'In Inventory'</strong> across warehouse locations
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-amber-100 rounded-xl text-amber-800 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2.5 border border-slate-300 rounded-xl px-3.5 py-2 bg-white shadow-2xs">
            <Search size={16} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search by item code, description, location, rack, shelf, trace ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent focus:outline-none text-xs text-slate-900 font-semibold placeholder:text-slate-400"
            />
          </div>
          <button
            type="button"
            onClick={fetchTraceItems}
            disabled={loading}
            className="p-2 bg-white border border-slate-300 hover:border-slate-400 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            title="Refresh Stock List"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Modal Body / Table */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="p-16 text-center text-slate-400 text-xs font-semibold flex flex-col items-center justify-center gap-2">
              <RefreshCw size={24} className="animate-spin text-amber-600" />
              Loading available inventory trace stock...
            </div>
          ) : filteredTraceItems.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs font-semibold flex flex-col items-center justify-center gap-2 bg-amber-50/50 rounded-2xl border border-amber-200">
              <AlertCircle size={28} className="text-amber-600" />
              <span>No available inventory stock found matching your search.</span>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="px-3.5 py-2.5">Trace ID</th>
                    <th className="px-3.5 py-2.5">Item Code & Details</th>
                    <th className="px-3.5 py-2.5">Warehouse Location</th>
                    <th className="px-3.5 py-2.5 text-right">Available Qty</th>
                    <th className="px-3.5 py-2.5 text-right">Price (₹)</th>
                    <th className="px-3.5 py-2.5 min-w-[130px]">Qty to Consume</th>
                    <th className="px-3.5 py-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white font-semibold">
                  {filteredTraceItems.map((item) => {
                    const tid = item.trace_id || item.trace_item_id;
                    const currentSel = selectedSelections[tid];
                    const currentQty = currentSel ? currentSel.Qty : '';

                    const locationStr = [
                      item.location,
                      item.rack ? `Rack: ${item.rack}` : null,
                      item.shelf_number ? `Shelf: ${item.shelf_number}` : null
                    ].filter(Boolean).join(' | ');

                    return (
                      <tr 
                        key={item.inventory_id || tid} 
                        className={`transition-colors ${currentSel ? 'bg-amber-50/60' : 'hover:bg-slate-50'}`}
                      >
                        <td className="px-3.5 py-2.5 font-mono font-bold text-slate-900 align-middle">
                          <span className="bg-amber-100 border border-amber-300 text-amber-900 px-2 py-0.5 rounded-md text-[11px] font-black shadow-2xs">
                            TR-{tid}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-900 align-middle">
                          <div className="font-bold text-slate-900 text-xs">{item.item_code}</div>
                          <div className="text-[10px] text-slate-500 truncate max-w-[180px]">{item.description || 'No description'}</div>
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-700 align-middle">
                          <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-700">
                            <MapPin size={12} className="text-amber-600 shrink-0" />
                            <span>{locationStr || 'Default Store'}</span>
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono font-black text-slate-900 align-middle">
                          {item.available_qty}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono text-slate-700 align-middle">
                          ₹{parseFloat(item.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-3.5 py-2.5 align-middle">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            max={item.available_qty}
                            placeholder="Qty"
                            value={currentQty}
                            onChange={(e) => handleQtyChange(item, e.target.value)}
                            className="w-24 px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-amber-500 shadow-2xs"
                          />
                        </td>
                        <td className="px-3.5 py-2.5 text-center align-middle">
                          <button
                            type="button"
                            onClick={() => handleMaxSelect(item)}
                            className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 border border-slate-300 transition-colors cursor-pointer shadow-2xs"
                          >
                            Max Select
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

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-between items-center">
          <div className="text-xs font-bold text-slate-700">
            Selected: <span className="text-amber-950 font-mono font-black text-sm">{totalSelectedCount}</span> trace item(s) 
            {totalSelectedQty > 0 && (
              <span className="text-slate-500 ml-2 font-mono text-xs">
                (Total Qty: <strong className="text-amber-900">{totalSelectedQty}</strong>)
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
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
              className="px-5 py-2.5 text-white font-bold text-xs rounded-xl transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
              style={{ backgroundColor: 'var(--theme-color)' }}
            >
              <Check size={16} />
              Select Items
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
