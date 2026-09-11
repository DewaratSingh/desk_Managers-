import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, X, RefreshCw, Package } from 'lucide-react';
import { toast } from 'react-toastify';

const tradeTypeStyle = (type) => {
  const t = (type || '').toUpperCase();
  if (t === 'SELL') return { color: '#0284c7', borderColor: '#bae6fd', backgroundColor: '#f0f9ff' };
  if (t === 'BUY')  return { color: '#4f46e5', borderColor: '#c7d2fe', backgroundColor: '#eef2ff' };
  if (t === 'ARC')  return { color: '#7c3aed', borderColor: '#ddd6fe', backgroundColor: '#f5f3ff' };
  return { color: '#475569', borderColor: '#cbd5e1', backgroundColor: '#f8fafc' };
};

const statusStyle = (s) => {
  const v = (s || '').toLowerCase();
  if (v === 'ordered')             return { color: '#4f46e5', borderColor: '#a5b4fc', backgroundColor: '#eef2ff' };
  if (v === 'quotation')           return { color: '#0369a1', borderColor: '#7dd3fc', backgroundColor: '#f0f9ff' };
  if (v === 'payment')             return { color: '#15803d', borderColor: '#86efac', backgroundColor: '#f0fdf4' };
  if (v === 'completed')           return { color: '#15803d', borderColor: '#86efac', backgroundColor: '#f0fdf4' };
  if (v === 'delivered')           return { color: '#15803d', borderColor: '#86efac', backgroundColor: '#f0fdf4' };
  if (v === 'payed')               return { color: '#15803d', borderColor: '#86efac', backgroundColor: '#f0fdf4' };
  if (v === 'partially delivered') return { color: '#d97706', borderColor: '#fcd34d', backgroundColor: '#fef3c7' };
  if (v === 'cancelled')           return { color: '#9f1239', borderColor: '#fca5a5', backgroundColor: '#fff1f2' };
  if (v === 'active')              return { color: '#16a34a', borderColor: '#bbf7d0', backgroundColor: '#f0fdf4' };
  return { color: '#475569', borderColor: '#cbd5e1', backgroundColor: '#f8fafc' };
};

export default function ItemQuoteHistory({ code, excludeRfq, onClose }) {
  const navigate = useNavigate();
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [inventoryData, setInventoryData] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);

  useEffect(() => {
    if (!code) return;
    
    const fetchHistory = async () => {
      setHistoryLoading(true);
      setHistoryData([]);
      try {
        const queryParams = new URLSearchParams();
        if (excludeRfq) {
          queryParams.append('exclude_rfq', excludeRfq);
        }
        const url = `/api/items/${encodeURIComponent(code)}/history?${queryParams.toString()}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setHistoryData(data);
        } else {
          toast.error('Failed to load item history');
        }
      } catch (err) {
        console.error(err);
        toast.error('Error fetching item history');
      } finally {
        setHistoryLoading(false);
      }
    };

    const fetchInventory = async () => {
      setInventoryLoading(true);
      setInventoryData([]);
      try {
        const res = await fetch(`/api/inventory?q=${encodeURIComponent(code)}&limit=50`);
        if (res.ok) {
          const data = await res.json();
          const filtered = data.filter(inv => inv.item_code === code);
          setInventoryData(filtered.length > 0 ? filtered : data);
        }
      } catch (err) {
        console.error('Error fetching inventory stock for item:', err);
      } finally {
        setInventoryLoading(false);
      }
    };

    fetchHistory();
    fetchInventory();
  }, [code, excludeRfq]);

  if (!code) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-start border-b border-slate-200 pb-3">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 m-0 flex items-center gap-1.5">
            <History size={16} className="text-slate-500" />
            Item Quote History & Inventory
          </h3>
          <span className="inline-block mt-1 font-mono font-bold text-[10px] text-slate-900 border px-1.5 py-0.25 rounded" style={{ color: 'var(--theme-color)', borderColor: 'var(--theme-color)', backgroundColor: 'rgba(217, 53, 45, 0.05)' }}>
            {code}
          </span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors cursor-pointer flex items-center justify-center"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Quote History Section */}
      <div>
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <History size={13} className="text-slate-500" /> Past Quote History ({historyData.length})
        </h4>

        {historyLoading ? (
          <div className="py-6 text-center text-slate-400 text-xs font-semibold animate-pulse flex flex-col items-center justify-center gap-2">
            <RefreshCw size={16} className="animate-spin text-slate-400" />
            Loading history...
          </div>
        ) : historyData.length === 0 ? (
          <div className="py-4 text-center text-slate-400 text-[11px] font-medium bg-slate-50 border border-slate-200 rounded-lg">
            No past quote history found for this item.
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white shadow-2xs">
            <table className="w-full border-collapse text-left text-[10px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-2.5 py-2">Date</th>
                  <th className="px-2.5 py-2 text-center">Type</th>
                  <th className="px-2.5 py-2">Buyer / Customer</th>
                  <th className="px-2.5 py-2 text-right">Price</th>
                  <th className="px-2.5 py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {historyData.map((row, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => row.trade_id && navigate(`/trade/${row.trade_id}`)}
                    title={row.trade_id ? `Click to view Trade: ${row.trade_id}` : ''}
                  >
                    <td className="px-2.5 py-2 text-slate-600 font-medium">
                      {row.date ? new Date(row.date).toLocaleDateString('en-IN') : '—'}
                      <div className="text-[9px] text-slate-400 font-bold mt-0.5 uppercase tracking-wider">{row.source}</div>
                    </td>
                    <td className="px-2.5 py-2 text-center">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border"
                            style={tradeTypeStyle(row.trade_type)}>
                        {row.trade_type || '—'}
                      </span>
                    </td>
                    <td className="px-2.5 py-2 max-w-[120px] truncate">
                      <div className="font-bold text-slate-800 truncate" title={row.buyer_name || '—'}>
                        {row.buyer_name || '—'}
                      </div>
                      <div className="text-[9px] text-slate-400 font-semibold mt-0.5 truncate" title={`Cust ID: ${row.customer_id || '—'}`}>
                        {row.customer_id ? `Cust: ${row.customer_id}` : '—'}
                      </div>
                    </td>
                    <td className="px-2.5 py-2 text-right font-black text-slate-900">
                      ₹{parseFloat(row.unit_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-2.5 py-2 text-center">
                      <span className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border"
                            style={statusStyle(row.status)}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inventory Stock Section */}
      <div className="pt-2 border-t border-slate-200">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Package size={13} className="text-indigo-600" /> Current Inventory Stock ({inventoryData.length})
        </h4>

        {inventoryLoading ? (
          <div className="py-6 text-center text-slate-400 text-xs font-semibold animate-pulse flex flex-col items-center justify-center gap-2">
            <RefreshCw size={16} className="animate-spin text-slate-400" />
            Loading inventory stock...
          </div>
        ) : inventoryData.length === 0 ? (
          <div className="py-4 text-center text-slate-400 text-[11px] font-medium bg-slate-50 border border-slate-200 rounded-lg">
            No active inventory stock records for this item.
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white shadow-2xs">
            <table className="w-full border-collapse text-left text-[10px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-2.5 py-2">Position / Location</th>
                  <th className="px-2.5 py-2 text-right">Qty</th>
                  <th className="px-2.5 py-2 text-right">Price</th>
                  <th className="px-2.5 py-2">Trace ID & Status</th>
                  <th className="px-2.5 py-2">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold">
                {inventoryData.map((inv) => {
                  const st = inv.trace_status || inv.status || 'active';
                  let badgeCls = "bg-slate-100 border-slate-200 text-slate-700";
                  if (st === 'For process') badgeCls = "bg-amber-50 border-amber-300 text-amber-800";
                  else if (st === 'For Sell') badgeCls = "bg-emerald-50 border-emerald-300 text-emerald-800";
                  else if (st === 'In Inventory') badgeCls = "bg-indigo-50 border-indigo-300 text-indigo-800";
                  else if (st === 'manufacturing') badgeCls = "bg-amber-100 border-amber-300 text-amber-800";

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-2.5 py-2">
                        <div className="font-bold text-slate-800">{inv.location || '—'}</div>
                        {(inv.rack || inv.shelf_number) && (
                          <div className="text-[9px] text-slate-400 font-medium">
                            {inv.rack && `R: ${inv.rack}`} {inv.rack && inv.shelf_number && '|'} {inv.shelf_number && `S: ${inv.shelf_number}`}
                          </div>
                        )}
                      </td>
                      <td className="px-2.5 py-2 text-right font-mono font-black text-slate-900">
                        {inv.quantity || 0}
                      </td>
                      <td className="px-2.5 py-2 text-right font-mono font-bold text-slate-800">
                        ₹{parseFloat(inv.calculated_price || inv.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-2.5 py-2">
                        <div className="flex flex-col gap-1 items-start">
                          {inv.trace_item_id && (
                            <span className="font-mono text-[9px] bg-indigo-50 border border-indigo-200 text-indigo-700 px-1 py-0.2 rounded font-bold">
                              TR-{inv.trace_item_id}
                            </span>
                          )}
                          <span className={`inline-block px-1.5 py-0.25 rounded text-[8px] font-black uppercase tracking-wider border ${badgeCls}`}>
                            {st}
                          </span>
                        </div>
                      </td>
                      <td className="px-2.5 py-2 text-slate-500 max-w-[120px] truncate" title={inv.message}>
                        {inv.message || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
