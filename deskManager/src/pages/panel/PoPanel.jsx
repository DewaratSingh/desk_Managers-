import { ShoppingCart, List, Edit2, Plus, ExternalLink } from 'lucide-react';
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
  if (v === 'ordered')   return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  if (v === 'cancelled') return 'bg-red-50    text-red-700    border-red-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
};

export default function PoPanel({ purchaseOrder, quotation, tradeId, isBuySide }) {
  // Check if quotation was rejected
  if (quotation && quotation.status === 'rejected') {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center shadow-sm">
        <div className="max-w-sm mx-auto space-y-1">
          <h3 className="text-sm font-bold text-red-600">Quotation Rejected</h3>
          <p className="text-xs text-slate-500 font-semibold">
            This commercial quotation has been rejected. No Purchase Order needs to be raised.
          </p>
        </div>
      </div>
    );
  }

  // Prompt card when quotation exists but no PO yet
  if (!purchaseOrder) {
    if (!quotation) return null;
    const qtnNo = quotation.received_quotation_no || quotation.quotation_no;
    const addUrl = isBuySide
      ? `/addReceivedPurchaseOrder?quotation_no=${qtnNo}&trade_id=${tradeId}`
      : `/addPurchaseOrder?quotation_no=${qtnNo}&trade_id=${tradeId}`;
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center shadow-sm space-y-4">
        <div className="max-w-sm mx-auto space-y-1">
          <h3 className="text-sm font-bold text-slate-800">No Purchase Order Raised</h3>
          <p className="text-xs text-slate-500 font-semibold">
            A Quotation has been registered. The next step is to raise a Purchase Order.
          </p>
        </div>
        <Link
          to={addUrl}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 text-white font-bold text-xs rounded-lg cursor-pointer shadow-sm"
          style={{ backgroundColor: 'var(--theme-color)' }}
          onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(0.9)'}
          onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}
        >
          <Plus size={13} /> Create Purchase Order
        </Link>
      </div>
    );
  }

  // Calculated totals
  const itemsBasic = (purchaseOrder.items || []).reduce(
    (s, i) => s + (parseFloat(i.unit_price) || 0) * (parseInt(i.quantity) || 0), 0
  );
  const gstTotal   = parseFloat(purchaseOrder.gst)             || 0;
  const transport  = parseFloat(purchaseOrder.transport)       || 0;
  const packing    = parseFloat(purchaseOrder.packing_forward) || 0;
  const other      = parseFloat(purchaseOrder.other)           || 0;
  const basicVal   = parseFloat(purchaseOrder.basic_value)     || 0;
  const grandTotal = itemsBasic + gstTotal + transport + packing + other + basicVal;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
          <ShoppingCart size={14} style={{ color: 'var(--theme-color)' }} />
          Purchase Order
        </span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
            {purchaseOrder.po_no}
          </span>
          {/* View full detail page */}
          <Link
            to={`/order/${encodeURIComponent(purchaseOrder.po_no)}`}
            className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <ExternalLink size={10} /> View
          </Link>
          <Link
            to={isBuySide ? `/updateReceivedPurchaseOrder/${purchaseOrder.po_no}?trade_id=${tradeId}` : `/updatePurchaseOrder/${purchaseOrder.po_no}?trade_id=${tradeId}`}
            className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Edit2 size={10} /> Edit
          </Link>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Meta row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-5 border-b border-slate-100">
          {[
            { label: 'PO Date',       value: fmtDate(purchaseOrder.po_date) },
            { label: 'Delivery Date', value: fmtDate(purchaseOrder.delivery_date) },
            { label: 'Linked QTN',   value: purchaseOrder.quotation_no || '—' },
            { label: 'Grand Total',  value: `₹${fmt(grandTotal)}` },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
              <p className="text-sm font-semibold text-slate-800">{value}</p>
            </div>
          ))}
        </div>

        {/* Items table */}
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-2">
            <List size={11} /> Ordered Items ({(purchaseOrder.items || []).length})
          </p>
          <div className="border border-slate-200 rounded-lg overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-2.5">Item Code</th>
                  <th className="px-4 py-2.5">Description</th>
                  <th className="px-4 py-2.5 text-right">Qty</th>
                  <th className="px-4 py-2.5 text-right">Pending Qty</th>
                  <th className="px-4 py-2.5 text-right">Unit Price</th>
                  <th className="px-4 py-2.5 text-right">GST</th>
                  <th className="px-4 py-2.5 text-right">Line Total</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Vendor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {(purchaseOrder.items || []).map((item, idx) => {
                  const lineBasic = (parseFloat(item.unit_price) || 0) * (parseInt(item.quantity) || 0);
                  const lineGst   = lineBasic * ((parseFloat(item.gst_rate) || 0) / 100);
                  const lineTotal = lineBasic + lineGst;
                  return (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-xs px-1.5 py-0.5 rounded border"
                          style={{ color: 'var(--theme-color)', borderColor: 'var(--theme-color)', backgroundColor: 'rgba(217,53,45,0.05)' }}>
                          {item.item_code}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-medium max-w-[160px] truncate">{item.description || '—'}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">{item.quantity}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">
                        {Math.max(0, (parseInt(item.quantity) || 0) - (parseInt(item.delivered_qty) || 0))}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">₹{fmt(item.unit_price)}</td>
                      <td className="px-4 py-3 text-right">
                        {item.gst_rate ? (
                          <span className="text-slate-600 font-semibold">{item.gst_rate}%</span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-black text-slate-900">₹{fmt(lineTotal)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${statusColor(item.status)}`}>
                          {item.status || 'pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-700">{item.vendor || '—'}</td>
                    </tr>
                  );
                })}
                {(purchaseOrder.items || []).length === 0 && (
                  <tr>
                    <td colSpan="9" className="px-4 py-6 text-center text-slate-400 text-xs font-medium">No items.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Charges summary */}
        {(gstTotal > 0 || transport > 0 || packing > 0 || other > 0 || basicVal > 0) && (
          <div className="border-t border-slate-100 pt-5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Additional Charges</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'GST / Tax',          value: gstTotal,   show: gstTotal > 0 },
                { label: 'Transport',          value: transport,  show: transport > 0 },
                { label: 'Packing & Fwd',      value: packing,    show: packing > 0 },
                { label: 'Other',              value: other,      show: other > 0 },
                { label: 'Add. Basic Value',   value: basicVal,   show: basicVal > 0 },
              ].filter(c => c.show).map(({ label, value }) => (
                <div key={label} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">₹{fmt(value)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Grand total row */}
        <div className="flex justify-between items-center pt-4 border-t border-slate-200">
          <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Grand Total PO Value</span>
          <span className="text-xl font-black text-slate-900">₹{fmt(grandTotal)}</span>
        </div>
      </div>
    </div>
  );
}
