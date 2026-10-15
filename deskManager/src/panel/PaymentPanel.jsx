import { useState } from 'react';
import { DollarSign, Plus, Edit2, Loader2, Check, X, AlertCircle, Calendar, MessageSquare } from 'lucide-react';

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const fmt = (v) => (parseFloat(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

export default function PaymentPanel({ tradeId, payments = [], expectedTotal = 0, onRefresh }) {
  const today = new Date().toISOString().split('T')[0];
  const [showForm, setShowForm] = useState(false);
  const [paymentNo, setPaymentNo] = useState('');
  const [paymentDate, setPaymentDate] = useState(today);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [editMode, setEditMode] = useState(null); // payment_no being edited

  const totalPaid = payments.reduce((s, p) => s + (parseFloat(p.total_amount) || 0), 0);
  const balanceOutstanding = Math.max(0, expectedTotal - totalPaid);

  const resetForm = () => {
    setPaymentNo('');
    setPaymentDate(today);
    setAmount('');
    setNote('');
    setError(null);
    setEditMode(null);
  };

  const handleEdit = (pmt) => {
    setEditMode(pmt.payment_no);
    setPaymentNo(pmt.payment_no);
    setPaymentDate(pmt.payment_date ? pmt.payment_date.split('T')[0] : today);
    setAmount(pmt.total_amount || '');
    setNote(pmt.note || '');
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!paymentNo.trim()) { setError('Payment No is required'); return; }
    if (!paymentDate) { setError('Payment Date is required'); return; }
    if (!amount || parseFloat(amount) <= 0) { setError('Amount must be greater than 0'); return; }

    setSaving(true);
    try {
      let res;
      if (editMode) {
        res = await fetch(`/api/payments/${encodeURIComponent(editMode)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payment_date: paymentDate,
            total_amount: parseFloat(amount),
            note: note.trim() || null
          })
        });
      } else {
        res = await fetch('/api/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payment_no: paymentNo.trim(),
            trade_id: tradeId,
            payment_date: paymentDate,
            total_amount: parseFloat(amount),
            note: note.trim() || null
          })
        });
      }
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to save payment');
      }
      resetForm();
      setShowForm(false);
      onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const form = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Payment No */}
        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
            Payment No <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={paymentNo}
            onChange={e => setPaymentNo(e.target.value)}
            disabled={!!editMode}
            placeholder="e.g. PMT-10001"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] disabled:bg-slate-50 disabled:text-slate-500 font-mono font-bold"
          />
        </div>
        {/* Payment Date */}
        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
            Payment Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={paymentDate}
            onChange={e => setPaymentDate(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)]"
          />
        </div>
        {/* Amount */}
        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
            Amount (₹) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] font-mono font-bold"
          />
        </div>
      </div>

      {/* Note / Comments */}
      <div>
        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
          Payment Note / Remarks <span className="text-slate-400 font-semibold normal-case">(Optional)</span>
        </label>
        <textarea
          rows={2}
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Enter bank reference, transaction details, check details, etc..."
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] resize-none"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
          <AlertCircle size={13} className="shrink-0" /> {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => { resetForm(); setShowForm(false); }}
          className="px-4 py-2 text-xs font-bold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 text-white font-bold text-xs rounded-lg hover:opacity-90 transition-opacity cursor-pointer shadow-sm disabled:opacity-60"
          style={{ backgroundColor: 'var(--theme-color)' }}
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          {saving ? 'Saving…' : editMode ? 'Update Payment' : 'Record Payment'}
        </button>
      </div>
    </form>
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
          <DollarSign size={14} style={{ color: 'var(--theme-color)' }} />
          Payment Tracking
        </span>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-white rounded-lg hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
            style={{ backgroundColor: 'var(--theme-color)' }}
          >
            <Plus size={12} /> Add Payment Entry
          </button>
        )}
      </div>

      <div className="p-6 space-y-6">
        {/* Expected vs Paid Summary Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-center">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Total Contract Value</span>
            <span className="text-lg font-black text-slate-800 mt-1">₹{fmt(expectedTotal)}</span>
          </div>
          <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 flex flex-col justify-center">
            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">Total Payments Received</span>
            <span className="text-lg font-black text-emerald-700 mt-1">₹{fmt(totalPaid)}</span>
          </div>
          <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-4 flex flex-col justify-center">
            <span className="text-[9px] font-black text-amber-600 uppercase tracking-wider">Outstanding Balance</span>
            <span className={`text-lg font-black mt-1 ${balanceOutstanding > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
              ₹{fmt(balanceOutstanding)}
            </span>
          </div>
        </div>

        {/* Form container */}
        {showForm && (
          <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/50 space-y-3">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
              {editMode ? `Editing Payment: ${editMode}` : 'Record New Payment'}
            </p>
            {form}
          </div>
        )}

        {/* Payments table list */}
        {payments.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <DollarSign size={20} className="mx-auto text-slate-300" />
            <p className="text-xs text-slate-400 font-bold mt-2">No payment transactions recorded for this trade yet.</p>
          </div>
        ) : (
          <div className="border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Payment No</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Note / Remarks</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {payments.map(pmt => (
                  <tr key={pmt.payment_no} className="hover:bg-slate-50/40 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-slate-800">{pmt.payment_no}</td>
                    <td className="px-4 py-3 text-slate-600 font-semibold flex items-center gap-1.5">
                      <Calendar size={12} className="text-slate-400" />
                      {fmtDate(pmt.payment_date)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-black text-slate-900">₹{fmt(pmt.total_amount)}</td>
                    <td className="px-4 py-3 text-slate-600 font-medium max-w-[240px] truncate" title={pmt.note || ''}>
                      {pmt.note ? (
                        <div className="flex items-center gap-1.5">
                          <MessageSquare size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate">{pmt.note}</span>
                        </div>
                      ) : <span className="text-slate-400 italic">No notes</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleEdit(pmt)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-slate-600 border border-slate-300 rounded hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <Edit2 size={10} /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
