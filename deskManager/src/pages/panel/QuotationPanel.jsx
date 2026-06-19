import { FileText, List, Edit2, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const fmt = (v) => (parseFloat(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

export default function QuotationPanel({ quotation, rfq, tradeId, tradeType, onRefresh, hasSubsequentDocs }) {
  // Prompt card when RFQ exists but no quotation yet
  if (!quotation) {
    if (!rfq) return null;
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center shadow-sm space-y-4">
        <div className="max-w-sm mx-auto space-y-1">
          <h3 className="text-sm font-bold text-slate-800">No Quotation Registered</h3>
          <p className="text-xs text-slate-500 font-semibold">
            An RFQ has been logged. The next step is to formulate a commercial quotation.
          </p>
        </div>
        <Link
          to={`/addQuotation?rfq_no=${rfq.rfq_no}&trade_id=${tradeId}`}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 text-white font-bold text-xs rounded-lg cursor-pointer shadow-sm"
          style={{ backgroundColor: 'var(--theme-color)' }}
          onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(0.9)'}
          onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}
        >
          <Plus size={13} /> Create Commercial Quotation
        </Link>
      </div>
    );
  }

  const handleReject = async () => {
    if (!window.confirm('Are you sure you want to reject this quotation? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/quotations/${encodeURIComponent(quotation.quotation_no)}/reject`, {
        method: 'PUT'
      });
      if (res.ok) {
        toast.success('Quotation rejected successfully');
        if (onRefresh) onRefresh();
      } else {
        const d = await res.json();
        toast.error(d.error || 'Failed to reject quotation');
      }
    } catch (err) {
      console.error(err);
      toast.error('An error occurred while rejecting the quotation');
    }
  };

  const itemsTotal = (quotation.items || []).reduce(
    (a, i) => a + (parseFloat(i.unit_price) || 0) * (parseInt(i.quantity) || 0), 0
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
          <FileText size={14} style={{ color: 'var(--theme-color)' }} />
          Commercial Quotation
        </span>
        <div className="flex items-center gap-2">
          {quotation.status === 'rejected' && (
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded border text-red-700 bg-red-50 border-red-200 shadow-sm shrink-0">
              Rejected
            </span>
          )}
          <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
            {quotation.quotation_no}
          </span>
          {quotation.status !== 'rejected' && (
            <Link
              to={`/updateQuotation/${quotation.quotation_no}?trade_id=${tradeId}`}
              className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <Edit2 size={10} /> Edit
            </Link>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Meta row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-5 border-b border-slate-100">
          {[
            { label: 'Quotation Date', value: fmtDate(quotation.quotation_date) },
            { label: 'Linked RFQ',    value: quotation.rfq_no || '—' },
            { label: 'Customer',      value: quotation.customer_id || '—' },
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
            <List size={11} /> Quoted Items &amp; Pricing ({(quotation.items || []).length})
          </p>
          <div className="border border-slate-200 rounded-lg overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-2.5">Item Code</th>
                  <th className="px-4 py-2.5">Drawing No.</th>
                  <th className="px-4 py-2.5">Description</th>
                  <th className="px-4 py-2.5 text-right">Qty</th>
                  <th className="px-4 py-2.5 text-right">Unit Price</th>
                  <th className="px-4 py-2.5 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {(quotation.items || []).map((item, idx) => {
                  const lineTotal = (parseFloat(item.unit_price) || 0) * (parseInt(item.quantity) || 0);
                  return (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-xs px-1.5 py-0.5 rounded border"
                          style={{ color: 'var(--theme-color)', borderColor: 'var(--theme-color)', backgroundColor: 'rgba(217,53,45,0.05)' }}>
                          {item.item_code}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-500">{item.drawing_number || '—'}</td>
                      <td className="px-4 py-3 text-slate-700 font-medium">{item.description || '—'}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">{item.quantity} &bull; {item.unit || 'Pc'}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">₹{fmt(item.unit_price)}</td>
                      <td className="px-4 py-3 text-right font-mono font-black text-slate-900">₹{fmt(lineTotal)}</td>
                    </tr>
                  );
                })}
                {(quotation.items || []).length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-4 py-6 text-center text-slate-400 text-xs font-medium">No items.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Total */}
          <div className="flex justify-end pt-2 pr-1 text-sm font-bold text-slate-700">
            Total Value: <span className="font-black text-slate-900 ml-2">₹{fmt(itemsTotal)}</span>
          </div>
        </div>

        {/* Terms */}
        {quotation.terms_and_conditions && (
          <div className="border-t border-slate-100 pt-5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Terms &amp; Conditions</p>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-700 font-medium whitespace-pre-line">
              {quotation.terms_and_conditions}
            </div>
          </div>
        )}

        {/* Linked received quotations */}
        {Array.isArray(quotation.received_quotations) && quotation.received_quotations.length > 0 && (
          <div className="border-t border-slate-100 pt-5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Linked Received Quotations</p>
            <div className="flex flex-wrap gap-2">
              {quotation.received_quotations.map((rqNo, idx) => (
                <span key={idx} className="bg-blue-50 border border-blue-200 text-blue-700 font-bold px-2.5 py-1 rounded text-[10px]">
                  {rqNo}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reject Button in Footer */}
      {quotation.status !== 'rejected' && tradeType === 'sell' && !hasSubsequentDocs && (
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-end">
          <button
            onClick={handleReject}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-sm hover:shadow-md active:scale-[0.98] duration-150"
          >
            Reject Quotation
          </button>
        </div>
      )}
    </div>
  );
}
