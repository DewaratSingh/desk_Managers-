import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';

export default function ReleaseOrderDetailView({ releaseOrders, customers, buyers }) {
  const { ro_no: ro_no_param } = useParams();
  const ro_no = decodeURIComponent(ro_no_param);
  const navigate = useNavigate();

  const ro = releaseOrders.find((r) => r.ro_no === ro_no);

  if (!ro) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#f1f5f9] p-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Release Order Not Found</h2>
        <p className="text-slate-600 mb-6">No Release Order record matches the identifier <span className="font-mono bg-slate-100 px-2 py-1 rounded">{ro_no}</span>.</p>
        <button onClick={() => navigate(-1)} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 cursor-pointer border-0">
          <ArrowLeft size={18} /> Back
        </button>
      </div>
    );
  }

  // Find linked customer/buyer info
  const customer = customers.find((c) => c.id === ro.customer_id);
  const buyer = (buyers || []).find((b) => b.id === ro.buyer_id);

  const fmtDate = (d) => {
    if (!d) return '—';
    if (d instanceof Date) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
    if (typeof d === 'string' && d.match(/^\d{4}-\d{2}-\d{2}/)) {
      const parts = d.substring(0, 10).split('-');
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    const day = String(dt.getUTCDate()).padStart(2, '0');
    const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const year = dt.getUTCFullYear();
    return `${day}/${month}/${year}`;
  };

  const calculateTotalItemsAmount = (itemsList) => {
    if (!Array.isArray(itemsList)) return 0;
    return itemsList.reduce((sum, i) => sum + (i.quantity || 0) * (parseFloat(i.unit_price) || 0), 0);
  };

  const gstValue = parseFloat(ro.gst) || 0;
  const transportValue = parseFloat(ro.transport) || 0;
  const packingValue = parseFloat(ro.packing_forward) || 0;
  const otherValue = parseFloat(ro.other) || 0;
  const basicValue = parseFloat(ro.basic_value) || 0;
  const grossTotal = basicValue + gstValue + transportValue + packingValue + otherValue;

  return (
    <div className="max-w-5xl mx-auto p-6 sm:p-8 bg-[#f1f5f9] print:bg-white print:p-0 min-h-screen text-slate-900">
      <div className="flex items-center mb-6 print:hidden">
        <button onClick={() => navigate(-1)} className="flex items-center text-blue-600 hover:underline mr-4 cursor-pointer bg-transparent border-0 px-4 py-2 rounded-lg transition-colors text-sm">
          <ArrowLeft size={16} className="mr-1.5" /> Back
        </button>
        <h1 className="text-3xl font-extrabold text-slate-900">Release Order Detail – {ro.ro_no}</h1>
      </div>
      <h1 className="text-2xl font-extrabold text-slate-900 mb-6 hidden print:block">Release Order – {ro.ro_no}</h1>

      {/* Grid of basic info, customer info, buyer info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-6 rounded-xl shadow-sm border border-slate-200 print:shadow-none print:border print:border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-800 mb-3 border-b border-slate-100 pb-1.5">RO Information</h2>
          <div className="space-y-2 text-sm">
            <p><span className="font-semibold text-slate-500">RO No:</span> <span className="font-mono bg-slate-100 px-2 py-0.5 rounded font-bold text-blue-700">{ro.ro_no}</span></p>
            <p><span className="font-semibold text-slate-500">RO Date:</span> <span className="font-bold">{fmtDate(ro.ro_date)}</span></p>
            {ro.delivery_date && (
              <p><span className="font-semibold text-slate-500">Delivery Date:</span> <span className="font-bold text-slate-800">{fmtDate(ro.delivery_date)}</span></p>
            )}
            {ro.contract_ref && (
              <p><span className="font-semibold text-slate-500">Contract Ref:</span> <span className="font-bold">{ro.contract_ref}</span></p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {ro.customer_name || customer ? (
            <div>
              <p className="font-bold text-slate-500 text-xs uppercase tracking-wider">Customer</p>
              <p className="font-bold text-slate-800">{ro.customer_name || customer?.name} (ID: {ro.customer_id || customer?.id})</p>
              <p className="text-xs text-slate-500 mt-0.5">{ro.customer_address || customer?.address}</p>
            </div>
          ) : (
            <p className="text-slate-500">Customer information not available.</p>
          )}

          {ro.buyer_name || buyer ? (
            <div className="border-t border-slate-100 pt-3">
              <p className="font-bold text-slate-500 text-xs uppercase tracking-wider">Buyer Contact</p>
              <p className="font-bold text-slate-800">{ro.buyer_name || buyer?.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {ro.buyer_email || buyer?.email} &bull; {ro.buyer_phone || buyer?.phone}
              </p>
            </div>
          ) : (
            <p className="text-slate-500 border-t border-slate-100 pt-3">Buyer information not available.</p>
          )}
        </div>
      </div>

      {/* Items Section */}
      <div className="mt-6 bg-white p-6 rounded-xl shadow-sm border border-slate-200 print:shadow-none print:border print:border-slate-200">
        <h2 className="text-xl font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Release Items ({Array.isArray(ro.items) ? ro.items.length : 0})</h2>
        {Array.isArray(ro.items) && ro.items.length > 0 ? (
          <div className="space-y-4">
            {ro.items.map((item) => (
              <div
                key={item.item_code}
                className="p-5 bg-slate-50/30 hover:bg-white border border-slate-200 hover:border-red-500 hover:shadow-md rounded-xl transition-all duration-200 flex flex-col gap-3 print:bg-white print:border-slate-200 print:shadow-none"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-red-600">{item.item_code}</span>
                      {item.drawing_number && (
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">DRW: {item.drawing_number}</span>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-xs text-slate-500 mt-1">{item.description}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{item.gst_type || 'CGST/SGST'}</span>
                    <span className="text-slate-800 font-bold text-sm">
                      {item.gst_rate !== undefined && item.gst_rate !== null ? parseFloat(item.gst_rate) : 0}% (₹{((item.quantity || 1) * parseFloat(item.unit_price) * ((parseFloat(item.gst_rate) || 0) / 100)).toLocaleString('en-IN', { minimumFractionDigits: 2 })})
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Qty</span>
                    <span className="text-slate-800 font-bold text-sm">{item.quantity || 1}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Rate</span>
                    <span className="text-slate-800 font-bold text-sm">₹{parseFloat(item.unit_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Amount</span>
                    <span className="text-slate-800 font-bold text-sm">₹{((item.quantity || 1) * parseFloat(item.unit_price)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
                {(item.shipping_address || item.delivery_date) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded border border-slate-200 text-xs print:bg-white print:border-slate-200">
                    {item.shipping_address && (
                      <div>
                        <span className="font-bold text-slate-600 block mb-1 uppercase tracking-wider text-[10px]">Shipping Address</span>
                        <span className="text-slate-700 whitespace-pre-wrap">{item.shipping_address}</span>
                      </div>
                    )}
                    {item.delivery_date && (
                      <div>
                        <span className="font-bold text-slate-600 block mb-1 uppercase tracking-wider text-[10px]">Special Delivery Date</span>
                        <span className="text-slate-700 font-bold">{fmtDate(item.delivery_date)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-500">No items listed in this Release Order.</p>
        )}
      </div>

      {/* Commercial Breakdown */}
      <div className="mt-6 bg-white p-6 rounded-xl shadow-sm border border-slate-200 print:shadow-none print:border print:border-slate-200">
        <h2 className="text-xl font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Financial Breakdown</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
          <div className="space-y-2.5">
            <div className="flex justify-between border-b border-slate-100 pb-1.5">
              <span className="font-semibold text-slate-500">Items Subtotal:</span>
              <span className="font-mono">₹{calculateTotalItemsAmount(ro.items).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-1.5">
              <span className="font-semibold text-slate-500">Basic Value (Customizable):</span>
              <span className="font-mono font-bold">₹{basicValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-1.5">
              <span className="font-semibold text-slate-500">GST (Tax):</span>
              <span className="font-mono">₹{gstValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
          <div className="space-y-2.5">
            <div className="flex justify-between border-b border-slate-100 pb-1.5">
              <span className="font-semibold text-slate-500">Transport / Freight:</span>
              <span className="font-mono">₹{transportValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-1.5">
              <span className="font-semibold text-slate-500">Packing &amp; Forwarding:</span>
              <span className="font-mono">₹{packingValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-1.5">
              <span className="font-semibold text-slate-500">Other Charges:</span>
              <span className="font-mono">₹{otherValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t-2 border-slate-100 flex justify-between items-center">
          <span className="text-sm font-extrabold uppercase text-slate-500 tracking-wider">Gross Total RO Value</span>
          <span className="text-2xl font-black text-blue-800">
            ₹{grossTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="mt-8 flex items-center justify-end gap-3 print:hidden">
        <button 
          onClick={() => window.print()} 
          className="px-6 py-3 border-2 border-slate-300 hover:border-slate-400 hover:bg-slate-50 text-slate-700 font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <Printer size={18} /> Print / Save as PDF
        </button>
      </div>
    </div>
  );
}
