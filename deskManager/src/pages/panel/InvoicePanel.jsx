import { Link, useNavigate } from 'react-router-dom';
import { FileText, Plus, List, Edit2, ChevronDown, ChevronUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const fmt = (v) => (parseFloat(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

export default function InvoicePanel({ tradeId, deliveryNotes = [], invoices = [], onRefresh }) {
  const navigate = useNavigate();
  const [openInvoiceIndex, setOpenInvoiceIndex] = useState(0);

  const toggleInvoice = (index) => {
    setOpenInvoiceIndex(openInvoiceIndex === index ? -1 : index);
  };

  const handleRaiseInvoice = (dnNo) => {
    navigate(`/addInvoice?trade_id=${encodeURIComponent(tradeId)}&delivery_note_no=${encodeURIComponent(dnNo)}`);
  };

  // Helper to determine which Delivery Notes have uninvoiced quantities remaining
  const getDnInvoiceStatus = (note) => {
    const noteItems = note.items || [];
    const noteInvoices = invoices.filter(inv => inv.delivery_note_no === note.delivery_note_no);
    
    let totalDelivered = 0;
    let totalInvoiced = 0;
    const itemsList = noteItems.map(item => {
      const delivered = parseInt(item.quantity) || 0;
      totalDelivered += delivered;

      const invoiced = noteInvoices.reduce((sum, inv) => {
        const invItem = (inv.items || []).find(ii => ii.item_code === item.item_code);
        return sum + (invItem ? parseInt(invItem.quantity) || 0 : 0);
      }, 0);
      totalInvoiced += invoiced;

      const remaining = Math.max(0, delivered - invoiced);
      return {
        ...item,
        delivered,
        invoiced,
        remaining
      };
    });

    const isFullyInvoiced = totalInvoiced >= totalDelivered && totalDelivered > 0;
    const isPartiallyInvoiced = totalInvoiced > 0 && totalInvoiced < totalDelivered;
    const hasRemaining = itemsList.some(i => i.remaining > 0);

    return {
      isFullyInvoiced,
      isPartiallyInvoiced,
      hasRemaining,
      items: itemsList
    };
  };

  // Get delivery notes that are still eligible for invoicing
  const eligibleDns = deliveryNotes.map(note => ({
    note,
    status: getDnInvoiceStatus(note)
  })).filter(item => item.status.hasRemaining);

  return (
    <div className="space-y-4">

      {/* Raising Invoice Prompt Section */}
      {eligibleDns.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="text-indigo-600" />
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Pending Billing Dispatches
            </h4>
          </div>
          <p className="text-xs text-slate-500 font-semibold">
            The following shipments have delivered items waiting to be invoiced. Select a Delivery Note to raise a commercial invoice.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {eligibleDns.map(({ note, status }) => (
              <div
                key={note.delivery_note_no}
                className="bg-white border border-slate-200 rounded-lg p-3.5 flex items-center justify-between shadow-xs"
              >
                <div>
                  <div className="font-mono text-xs font-bold text-slate-900">{note.delivery_note_no}</div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                    Delivered: {fmtDate(note.delivery_date)}
                  </div>
                  {status.isPartiallyInvoiced && (
                    <span className="inline-block mt-1 text-[9px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full">
                      Partially Billed
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleRaiseInvoice(note.delivery_note_no)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-white font-bold text-[10px] rounded hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
                  style={{ backgroundColor: 'var(--theme-color)' }}
                >
                  <Plus size={11} /> Raise Invoice
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Render list of generated invoices */}
      {invoices.length > 0 ? (
        <div className="space-y-3.5">
          {invoices.map((inv, idx) => {
            const isOpen = openInvoiceIndex === idx;
            const items = inv.items || [];
            const grandTotal = items.reduce(
              (sum, item) => sum + (parseFloat(item.rate_per_piece) || 0) * (parseInt(item.quantity) || 0), 0
            );

            return (
              <div
                key={inv.invoice_no}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm transition-all duration-150"
              >
                {/* Header accordion trigger */}
                <div
                  onClick={() => toggleInvoice(idx)}
                  className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText size={14} style={{ color: 'var(--theme-color)' }} />
                      Invoice #{idx + 1}
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded">
                      {inv.invoice_no}
                    </span>
                  </div>

                  <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                    <Link
                      to={`/updateInvoice/${encodeURIComponent(inv.invoice_no)}`}
                      className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <Edit2 size={10} /> Edit
                    </Link>
                    <button
                      onClick={() => toggleInvoice(idx)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {/* Collapsible content */}
                {isOpen && (
                  <div className="p-6 space-y-6">
                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-5 border-b border-slate-100">
                      {[
                        { label: 'Invoice Date', value: fmtDate(inv.invoice_date) },
                        { label: 'Delivery Ref', value: inv.delivery_note_no || '—' },
                        { label: 'Dispatch Via',  value: inv.dispatch_through || '—' },
                        { label: 'Vehicle No',    value: inv.motor_vehicle_no || '—' },
                        { label: 'Items Billed',   value: items.length },
                        { label: 'Doc No',        value: inv.dispatch_doc_no || '—' },
                        { label: 'Grand Total',   value: `₹${fmt(grandTotal)}`, span: 2 }
                      ].map(({ label, value, span }) => (
                        <div key={label} className={span === 2 ? 'col-span-2' : ''}>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
                          <p className="text-sm font-semibold text-slate-800 truncate">{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Items table */}
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-2">
                        <List size={11} /> Billed Items ({items.length})
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
                            {items.map((item, idx) => {
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
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty state when no invoices have been registered and no pending dispatches exist */
        eligibleDns.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center shadow-sm space-y-4">
            <div className="w-12 h-12 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center mx-auto" style={{ color: 'var(--theme-color)' }}>
              <FileText size={24} />
            </div>
            <div className="max-w-sm mx-auto space-y-1">
              <h3 className="text-sm font-bold text-slate-800">No Invoices Registered</h3>
              <p className="text-xs text-slate-500 font-semibold text-center">
                Deliveries have been completed. Once shipments are registered, commercial invoices can be raised against them.
              </p>
            </div>
          </div>
        )
      )}

    </div>
  );
}
