import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Truck, Plus, List, Edit2, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const fmt = (v) => (parseFloat(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

export default function DeliveryPanel({ tradeId, deliveryNotes = [], invoices = [], onRefresh }) {
  const navigate = useNavigate();
  const [selectedDnNo, setSelectedDnNo] = useState(null);

  const activeDnNo = selectedDnNo || (deliveryNotes[0] ? deliveryNotes[0].delivery_note_no : null);
  const activeNote = deliveryNotes.find(dn => dn.delivery_note_no === activeDnNo) || deliveryNotes[0];

  const handleCreateRedirect = () => {
    navigate(`/addDeliveryNote?trade_id=${encodeURIComponent(tradeId)}`);
  };

  const handleRaiseInvoice = (dnNo) => {
    navigate(`/addInvoice?trade_id=${encodeURIComponent(tradeId)}&delivery_note_no=${encodeURIComponent(dnNo)}`);
  };

  // Render when no Delivery Notes exist yet
  if (deliveryNotes.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center shadow-sm space-y-4">
        <div className="w-12 h-12 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center mx-auto" style={{ color: 'var(--theme-color)' }}>
          <Truck size={24} />
        </div>
        <div className="max-w-sm mx-auto space-y-1">
          <h3 className="text-sm font-bold text-slate-800">No Delivery Note Registered</h3>
          <p className="text-xs text-slate-500 font-semibold text-center">
            The Purchase Order has been registered. The next step is to log dispatches and generate a Delivery Note.
          </p>
        </div>
        <button
          onClick={handleCreateRedirect}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 text-white font-bold text-xs rounded-lg cursor-pointer shadow-sm hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--theme-color)' }}
        >
          <Plus size={13} /> Create Delivery Note
        </button>
      </div>
    );
  }

  // Calculate items and totals for the selected active note
  const activeItems = activeNote ? (activeNote.items || []) : [];
  const activeGrandTotal = activeItems.reduce(
    (sum, item) => sum + (parseFloat(item.rate_per_piece) || 0) * (parseInt(item.quantity) || 0), 0
  );

  // Filter invoices for the active Delivery Note
  const noteInvoices = invoices.filter(inv => inv.delivery_note_no === activeDnNo);

  // Calculate billing status for active note
  const totalDeliveredQty = activeItems.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0);
  const totalInvoicedQty = activeItems.reduce((sum, item) => {
    const invoiced = noteInvoices.reduce((s, inv) => {
      const invItem = (inv.items || []).find(ii => ii.item_code === item.item_code);
      return s + (invItem ? parseInt(invItem.quantity) || 0 : 0);
    }, 0);
    return sum + invoiced;
  }, 0);

  const hasUninvoicedItems = activeItems.some(item => {
    const invoiced = noteInvoices.reduce((s, inv) => {
      const invItem = (inv.items || []).find(ii => ii.item_code === item.item_code);
      return s + (invItem ? parseInt(invItem.quantity) || 0 : 0);
    }, 0);
    return (parseInt(item.quantity) || 0) > invoiced;
  });

  const isFullyBilled = totalInvoicedQty >= totalDeliveredQty && totalDeliveredQty > 0;

  return (
    <div className="space-y-5">
      {/* Horizontal small boxes selector */}
      <div className="flex items-center gap-3 overflow-x-auto pb-3 scrollbar-thin">
        {deliveryNotes.map((dn, idx) => {
          const isSelected = dn.delivery_note_no === activeDnNo;
          return (
            <button
              key={dn.delivery_note_no}
              onClick={() => setSelectedDnNo(dn.delivery_note_no)}
              className={`flex flex-col items-start min-w-[150px] p-3.5 rounded-xl border text-left transition-all duration-150 cursor-pointer ${
                isSelected
                  ? 'border-[var(--theme-color)] bg-indigo-50/5 text-indigo-700 ring-1 ring-[var(--theme-color)] shadow-xs'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Dispatch #{idx + 1}</span>
              <span className="font-mono font-bold text-xs mt-0.5 truncate w-full">{dn.delivery_note_no}</span>
              <span className="text-[9px] font-bold text-slate-400 mt-1.5">{fmtDate(dn.delivery_date)}</span>
            </button>
          );
        })}
        
        {/* Log Dispatch Box */}
        <button
          onClick={handleCreateRedirect}
          className="flex flex-col items-center justify-center min-w-[150px] p-3.5 rounded-xl border border-dashed border-slate-300 hover:border-slate-400 bg-white text-slate-500 hover:text-slate-700 hover:bg-slate-50 hover:shadow-xs transition-all cursor-pointer"
        >
          <Plus size={16} />
          <span className="text-[9px] font-black uppercase tracking-wider mt-1.5">Log Dispatch</span>
        </button>
      </div>

      {/* Active Note details */}
      {activeNote && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            {/* Header */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Truck size={14} style={{ color: 'var(--theme-color)' }} />
                Delivery Details
              </span>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                  {activeNote.delivery_note_no}
                </span>
                <Link
                  to={`/updateDeliveryNote/${encodeURIComponent(activeNote.delivery_note_no)}`}
                  className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <Edit2 size={10} /> Edit Delivery
                </Link>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-5 border-b border-slate-100">
                {[
                  { label: 'Delivery Date', value: fmtDate(activeNote.delivery_date) },
                  { label: 'Dispatch Via',   value: activeNote.dispatch_through || '—' },
                  { label: 'Doc No',         value: activeNote.dispatch_doc_no || '—' },
                  { label: 'Vehicle No',     value: activeNote.motor_vehicle_no || '—' },
                  { label: 'Items Shipped',  value: activeItems.length },
                  { label: 'PO/RO Reference', value: activeNote.po_no || activeNote.ro_no || '—' },
                  { label: 'Dispatch Value', value: `₹${fmt(activeGrandTotal)}`, span: 2 }
                ].map(({ label, value, span }) => (
                  <div key={label} className={span === 2 ? 'col-span-2' : ''}>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
                    <p className="text-sm font-semibold text-slate-800 truncate">{value}</p>
                  </div>
                ))}
              </div>

              {/* Items Table */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-2">
                  <List size={11} /> Shipped Items ({activeItems.length})
                </p>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="px-4 py-2.5">Item Code</th>
                        <th className="px-4 py-2.5">Description</th>
                        <th className="px-4 py-2.5 text-right">Quantity</th>
                        <th className="px-4 py-2.5 text-right">Rate</th>
                        <th className="px-4 py-2.5 text-right">Total</th>
                        <th className="px-4 py-2.5">Shipping Destination</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {activeItems.map((item, idx) => {
                        const total = (parseFloat(item.rate_per_piece) || 0) * (parseInt(item.quantity) || 0);
                        return (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3">
                              <span className="font-mono font-bold text-xs px-1.5 py-0.5 rounded border"
                                style={{ color: 'var(--theme-color)', borderColor: 'var(--theme-color)', backgroundColor: 'rgba(217,53,45,0.05)' }}>
                                {item.item_code}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-700 font-medium">
                              <div>{item.description || '—'}</div>
                              {item.drawing_number && (
                                <div className="text-[10px] text-slate-400 font-bold mt-0.5">DWG: {item.drawing_number}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-slate-800">{item.quantity}</td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">₹{fmt(item.rate_per_piece)}</td>
                            <td className="px-4 py-3 text-right font-mono font-black text-slate-900">₹{fmt(total)}</td>
                            <td className="px-4 py-3 text-slate-600 font-medium max-w-[180px] truncate" title={item.shipping_address}>
                              {item.shipping_address || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Connection / Progress line to next step */}
          {/* <div className="flex flex-col items-center py-1">
            <div className="w-0.5 h-5 bg-slate-200"></div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest my-1.5">Next Step</span>
            <div className="w-0.5 h-5 bg-slate-200"></div>
          </div> */}

          {/* Nested Invoices Section */}
          <div className="space-y-4">
            {noteInvoices.length > 0 ? (
              <div className="space-y-3.5">
                {noteInvoices.map((inv, idx) => {
                  const invItems = inv.items || [];
                  const invGrandTotal = invItems.reduce(
                    (sum, item) => sum + (parseFloat(item.rate_per_piece) || 0) * (parseInt(item.quantity) || 0), 0
                  );

                  return (
                    <div
                      key={inv.invoice_no}
                      className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm"
                    >
                      {/* Header */}
                      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                            <FileText size={14} style={{ color: 'var(--theme-color)' }} />
                            Commercial Invoice
                          </span>
                          <span className="font-mono text-xs font-bold text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded">
                            {inv.invoice_no}
                          </span>
                        </div>
                        <Link
                          to={`/updateInvoice/${encodeURIComponent(inv.invoice_no)}`}
                          className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          <Edit2 size={10} /> Edit Invoice
                        </Link>
                      </div>

                      <div className="p-6 space-y-6">
                        {/* Metadata Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-5 border-b border-slate-100">
                          {[
                            { label: 'Invoice Date', value: fmtDate(inv.invoice_date) },
                            { label: 'Dispatch Via',  value: inv.dispatch_through || '—' },
                            { label: 'Doc No',        value: inv.dispatch_doc_no || '—' },
                            { label: 'Vehicle No',    value: inv.motor_vehicle_no || '—' },
                            { label: 'Grand Total',   value: `₹${fmt(invGrandTotal)}`, span: 4 }
                          ].map(({ label, value, span }) => (
                            <div key={label} className={span === 4 ? 'col-span-2' : ''}>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
                              <p className="text-sm font-semibold text-slate-800 truncate">{value}</p>
                            </div>
                          ))}
                        </div>

                        {/* Items Table */}
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-2">
                            <List size={11} /> Billed Items ({invItems.length})
                          </p>
                          <div className="border border-slate-200 rounded-lg overflow-hidden">
                            <table className="w-full border-collapse text-left text-xs">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                  <th className="px-4 py-2.5">Item Code</th>
                                  <th className="px-4 py-2.5">Description</th>
                                  <th className="px-4 py-2.5 text-right">Billed Qty</th>
                                  <th className="px-4 py-2.5 text-right">Rate</th>
                                  <th className="px-4 py-2.5 text-right">Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 bg-white">
                                {invItems.map((item, idx) => {
                                  const total = (parseFloat(item.rate_per_piece) || 0) * (parseInt(item.quantity) || 0);
                                  return (
                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                      <td className="px-4 py-3">
                                        <span className="font-mono font-bold text-xs px-1.5 py-0.5 rounded border"
                                          style={{ color: 'var(--theme-color)', borderColor: 'var(--theme-color)', backgroundColor: 'rgba(217,53,45,0.05)' }}>
                                          {item.item_code}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 text-slate-700 font-medium">
                                        <div>{item.description || '—'}</div>
                                        {item.drawing_number && (
                                          <div className="text-[10px] text-slate-400 font-bold mt-0.5">DWG: {item.drawing_number}</div>
                                        )}
                                      </td>
                                      <td className="px-4 py-3 text-right font-bold text-slate-800">{item.quantity}</td>
                                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">₹{fmt(item.rate_per_piece)}</td>
                                      <td className="px-4 py-3 text-right font-mono font-black text-slate-900">₹{fmt(total)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Partially invoiced prompt */}
                {hasUninvoicedItems && (
                  <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-amber-700">
                      <AlertCircle size={16} className="shrink-0" />
                      <div className="text-xs font-bold">
                        Partially Billed shipment. There are still delivered items in this dispatch waiting to be billed.
                      </div>
                    </div>
                    <button
                      onClick={() => handleRaiseInvoice(activeDnNo)}
                      className="inline-flex items-center gap-1 px-4 py-2 text-white font-bold text-xs rounded hover:opacity-90 transition-opacity cursor-pointer shadow-sm shrink-0"
                      style={{ backgroundColor: 'var(--theme-color)' }}
                    >
                      <Plus size={12} /> Raise Another Invoice
                    </button>
                  </div>
                )}

                {/* Fully invoiced badge */}
                {isFullyBilled && (
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 shadow-xs">
                    <CheckCircle2 size={16} className="shrink-0" />
                    <span className="text-xs font-bold">This dispatch has been fully invoiced and billed.</span>
                  </div>
                )}
              </div>
            ) : (
              /* Prompt when no invoices exist yet for the active Delivery Note */
              <div className="bg-white border border-slate-200 rounded-xl p-6 text-center shadow-sm space-y-4">
                <div className="w-10 h-10 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center mx-auto" style={{ color: 'var(--theme-color)' }}>
                  <FileText size={20} />
                </div>
                <div className="max-w-sm mx-auto space-y-1">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Next Step: Invoice & Billing</h4>
                  <p className="text-[11px] text-slate-500 font-semibold text-center">
                    No Invoice registered for this dispatch shipment. The next step is to generate a Commercial Invoice against this Delivery Note.
                  </p>
                </div>
                <button
                  onClick={() => handleRaiseInvoice(activeDnNo)}
                  className="inline-flex items-center gap-1.5 px-4.5 py-2 text-white font-bold text-xs rounded hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
                  style={{ backgroundColor: 'var(--theme-color)' }}
                >
                  <Plus size={12} /> Raise Invoice for {activeDnNo}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
