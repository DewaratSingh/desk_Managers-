import { FileText, List, Edit2, Plus, ExternalLink, Truck, Layers, Package, MapPin, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const fmt = (v) => (parseFloat(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

const statusColor = (s) => {
  const v = (s || '').toLowerCase();
  if (v === 'delivered' || v === 'received' || v === 'completed')
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (v === 'shipped')   return 'bg-blue-50   text-blue-700   border-blue-200';
  if (v === 'ordered' || v === 'ro')   return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  if (v === 'cancelled') return 'bg-red-50    text-red-700    border-red-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
};

export default function ProcessRoPanel({ releaseOrder, tradeId }) {
  // Empty state when trade is initialized but no Process RO created yet
  if (!releaseOrder) {
    return (
      <div className="bg-[white] border border-slate-200 rounded-xl p-8 text-center shadow-sm space-y-4">
        <div className="max-w-sm mx-auto space-y-1">
          <h3 className="text-sm font-bold text-slate-800">No Process Release Order Raised</h3>
          <p className="text-xs text-slate-500 font-semibold">
            A Buy Process Contract Trade has been registered. The next step is to raise a Process Release Order.
          </p>
        </div>
        <Link
          to={`/process-contract-order?trade_id=${encodeURIComponent(tradeId || '')}`}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 text-white font-bold text-xs rounded-lg cursor-pointer shadow-sm"
          style={{ backgroundColor: 'var(--theme-color)' }}
          onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(0.9)'}
          onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}
        >
          <Plus size={13} /> Create Process Release Order
        </Link>
      </div>
    );
  }

  const sourceItems = releaseOrder.source_items || [];
  const targetItems = releaseOrder.target_items || releaseOrder.items || [];

  // Totals computation
  const targetBasic = targetItems.reduce(
    (s, i) => s + (parseFloat(i.price || i.unit_price) || 0) * (parseFloat(i.qty || i.quantity) || 0), 0
  );
  const gstTotal   = parseFloat(releaseOrder.gst)             || 0;
  const transport  = parseFloat(releaseOrder.transport)       || 0;
  const packing    = parseFloat(releaseOrder.packing_forward) || 0;
  const other      = parseFloat(releaseOrder.other)           || 0;
  const basicVal   = parseFloat(releaseOrder.basic_value)     || 0;
  const grandTotal = targetBasic + gstTotal + transport + packing + other + basicVal;

  return (
    <div className="bg-[white] border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
          <FileText size={14} style={{ color: 'var(--theme-color)' }} />
          Process Release Order
        </span>
        <div className="flex items-center gap-2">
          {releaseOrder.ro_no && (
            <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded">
              {releaseOrder.ro_no}
            </span>
          )}
          {releaseOrder.contract_ref && (
            <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded flex items-center gap-1">
              ARC: {releaseOrder.contract_ref}
            </span>
          )}

          {/* Create Delivery Note shortcut button */}
          <Link
            to={`/addDeliveryNote?trade_id=${encodeURIComponent(tradeId || '')}`}
            className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-white rounded-lg hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
            style={{ backgroundColor: 'var(--theme-color)' }}
          >
            <Truck size={11} /> Create Delivery Note
          </Link>

          {/* View full detail page */}
          <Link
            to={`/release-order/${encodeURIComponent(releaseOrder.ro_no)}`}
            className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-slate-600 bg-[white] border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <ExternalLink size={10} /> View
          </Link>

          {/* Edit shortcut */}
          <Link
            to={`/process-contract-order?ro_no=${encodeURIComponent(releaseOrder.ro_no)}&trade_id=${encodeURIComponent(tradeId || '')}`}
            className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-slate-600 bg-[white] border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Edit2 size={10} /> Edit
          </Link>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Meta row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-4 border-b border-slate-100">
          {[
            { label: 'RO Date', value: fmtDate(releaseOrder.date_of_start || releaseOrder.ro_date) },
            { label: 'Delivery Date', value: fmtDate(releaseOrder.date_of_end || releaseOrder.delivery_date) },
            { label: 'Seller / Processor', value: releaseOrder.seller || '—' },
            { label: 'Party / Client', value: releaseOrder.party || '—' },
            ...(releaseOrder.contract_ref ? [{ label: 'Contract Ref (ARC)', value: releaseOrder.contract_ref }] : []),
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
              <p className="text-sm font-semibold text-slate-800">{value}</p>
            </div>
          ))}
        </div>

        {/* Address and message info row if available */}
        {(releaseOrder.shipping_address || releaseOrder.message) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-slate-100 text-xs">
            {releaseOrder.shipping_address && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-start gap-2">
                <MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Shipping Address</p>
                  <p className="text-xs text-slate-700 font-medium whitespace-pre-line">{releaseOrder.shipping_address}</p>
                </div>
              </div>
            )}
            {releaseOrder.message && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-start gap-2">
                <MessageSquare size={13} className="text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Special Instructions</p>
                  <p className="text-xs text-slate-700 font-medium">{releaseOrder.message}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 1. Source Items Table (Same design as Process PO) */}
        <div>
          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1 mb-2">
            <Layers size={13} className="text-amber-600" /> Source Raw Materials (Consumed from Inventory) ({sourceItems.length})
          </p>
          <div className="border border-amber-200 rounded-lg overflow-x-auto shadow-2xs">
            <table className="w-full border-collapse text-left text-xs bg-amber-50/20">
              <thead>
                <tr className="bg-amber-50/50 border-b border-amber-200 text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                  <th className="px-4 py-2.5">Item Code</th>
                  <th className="px-4 py-2.5">Description</th>
                  <th className="px-4 py-2.5">Allocated Trace IDs</th>
                  <th className="px-4 py-2.5 text-right w-24">Required Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100 bg-[white]">
                {sourceItems.map((item, idx) => {
                  return (
                    <tr key={`src-${idx}`} className="hover:bg-amber-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-xs px-1.5 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-900">
                          {item.item_code}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-medium max-w-[200px] truncate">
                        {item.description || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {item.trace_item_id ? (
                          <span className="text-[9px] font-bold bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 rounded-full">
                            TR-{item.trace_item_id}{item.qty ? ` × ${item.qty}` : ''}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px] italic">Not assigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-black text-slate-800">
                        {item.qty}
                      </td>
                    </tr>
                  );
                })}
                {sourceItems.length === 0 && (
                  <tr>
                    <td colSpan="4" className="px-4 py-6 text-center text-slate-400 text-xs font-medium">
                      No source items allocated.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 2. Target Output Products Table (Same design as Process PO) */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 mb-2 mt-4" style={{ color: 'var(--theme-color)' }}>
            <Package size={13} style={{ color: 'var(--theme-color)' }} /> Target Output Products (Produced) ({targetItems.length})
          </p>
          <div className="border border-slate-200 rounded-lg overflow-x-auto shadow-2xs">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="px-4 py-2.5">Item Code</th>
                  <th className="px-4 py-2.5">Description</th>
                  <th className="px-4 py-2.5">Process Name</th>
                  <th className="px-4 py-2.5 text-right w-20">Total Qty</th>
                  <th className="px-4 py-2.5 text-right w-24">Pending Qty</th>
                  <th className="px-4 py-2.5 text-right w-24">Unit Price</th>
                  <th className="px-4 py-2.5 text-right w-24">Delivered Price</th>
                  <th className="px-4 py-2.5 text-right w-24">Remaining Price</th>
                  <th className="px-4 py-2.5 text-right w-24">Line Total</th>
                  <th className="px-4 py-2.5 w-28">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-[white]">
                {targetItems.map((item, idx) => {
                  const itemPrice = parseFloat(item.price || item.unit_price) || 0;
                  const itemQty = parseFloat(item.qty || item.quantity) || 0;
                  const lineTotal = itemPrice * itemQty;
                  const deliveredQty = parseFloat(item.delivered_qty) || 0;
                  const isFullyDelivered = (releaseOrder.status || '').toLowerCase() === 'delivered' || (deliveredQty >= itemQty && itemQty > 0);
                  const displayDeliveredQty = isFullyDelivered ? itemQty : deliveredQty;
                  const pendingQty = Math.max(0, itemQty - displayDeliveredQty);

                  return (
                    <tr key={`tgt-${idx}`} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className="font-mono font-bold text-xs px-1.5 py-0.5 rounded border"
                              style={{
                                color: 'var(--theme-color)',
                                borderColor: 'var(--theme-color)',
                                backgroundColor: 'rgba(217, 53, 45, 0.05)'
                              }}
                            >
                              {item.item_code}
                            </span>
                            {item.drawing_number && (
                              <span className="text-[10px] text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded">
                                DRW: {item.drawing_number}
                              </span>
                            )}
                          </div>
                          {item.shipping_address && (
                            <span className="text-[10px] text-slate-400 truncate max-w-xs" title={item.shipping_address}>
                              Ship: {item.shipping_address}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-medium max-w-[160px] truncate">
                        {item.description || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {item.process_name ? (
                          <span className="text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full">
                            {item.process_name}
                          </span>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">{itemQty}</td>
                      <td className="px-4 py-3 text-right font-black" style={{ color: 'var(--theme-color)' }}>{pendingQty}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">₹{fmt(itemPrice)}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-green-700">₹{fmt(deliveredQty * itemPrice)}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-orange-600">₹{fmt(pendingQty * itemPrice)}</td>
                      <td className="px-4 py-3 text-right font-mono font-black text-slate-900">₹{fmt(lineTotal)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${statusColor(releaseOrder.status)}`}>
                          {isFullyDelivered ? 'delivered' : (deliveredQty > 0 ? 'partial' : (releaseOrder.status || 'ordered'))}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {targetItems.length === 0 && (
                  <tr>
                    <td colSpan="10" className="px-4 py-6 text-center text-slate-400 text-xs font-medium">
                      No target items found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Additional Charges Summary */}
        {(gstTotal > 0 || transport > 0 || packing > 0 || other > 0 || basicVal > 0) && (
          <div className="border-t border-slate-100 pt-5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Additional Charges</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: 'GST / Tax',        value: gstTotal,  show: gstTotal > 0 },
                { label: 'Transport',        value: transport, show: transport > 0 },
                { label: 'Packing & Fwd',    value: packing,   show: packing > 0 },
                { label: 'Other',            value: other,     show: other > 0 },
                { label: 'Add. Basic Value', value: basicVal,  show: basicVal > 0 },
              ].filter(c => c.show).map(({ label, value }) => (
                <div key={label} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">₹{fmt(value)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Grand Total Row */}
        <div className="flex justify-between items-center pt-4 border-t border-slate-200">
          <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Grand Total Process RO Value</span>
          <span className="text-xl font-black text-slate-900">₹{fmt(grandTotal)}</span>
        </div>
      </div>
    </div>
  );
}
