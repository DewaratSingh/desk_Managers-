import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Truck, Plus, List, Edit2, FileText, CheckCircle2, AlertCircle,
  ClipboardCheck, XCircle, ChevronDown, ChevronUp, Loader2, DollarSign
} from 'lucide-react';

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const fmt = (v) => (parseFloat(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

// ── Inline GRN Form ────────────────────────────────────────────────────────────
function GrnForm({ tradeId, deliveryNoteNo, dnItems, existingGrn, onSaved }) {
  const today = new Date().toISOString().split('T')[0];

  const initialRejections = (existingGrn?.rejection_items || []).length > 0
    ? existingGrn.rejection_items
    : [{ item_code: '', quantity: '', reason: '' }];

  const [grnNo, setGrnNo] = useState(existingGrn?.grn_no || '');
  const [grnDate, setGrnDate] = useState(
    existingGrn?.grn_date ? existingGrn.grn_date.split('T')[0] : today
  );
  const [hasRejection, setHasRejection] = useState(existingGrn?.has_rejection || false);
  const [rejections, setRejections] = useState(initialRejections);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const isEdit = !!existingGrn;

  const addRejectionRow = () =>
    setRejections(prev => [...prev, { item_code: '', quantity: '', reason: '' }]);

  const removeRejectionRow = (i) =>
    setRejections(prev => prev.filter((_, idx) => idx !== i));

  const updateRejection = (i, field, value) =>
    setRejections(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!grnNo.trim()) { setError('GRN No is required'); return; }
    if (!grnDate) { setError('GRN Date is required'); return; }

    const validRejections = hasRejection
      ? rejections.filter(r => r.item_code && r.quantity)
      : [];

    if (hasRejection && validRejections.length === 0) {
      setError('Please add at least one rejection item with item code and quantity');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        grn_no: grnNo.trim(),
        delivery_note_no: deliveryNoteNo,
        trade_id: tradeId,
        grn_date: grnDate,
        has_rejection: hasRejection,
        rejection_items: validRejections
      };

      const url = isEdit ? `/api/grns/${encodeURIComponent(grnNo)}` : '/api/grns';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to save GRN');
      }

      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* GRN No + Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
            GRN No <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={grnNo}
            onChange={e => setGrnNo(e.target.value)}
            disabled={isEdit}
            placeholder={`GRN-${deliveryNoteNo}`}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] disabled:bg-slate-50 disabled:text-slate-500 font-mono font-bold"
          />
        </div>
        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
            GRN Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={grnDate}
            onChange={e => setGrnDate(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)]"
          />
        </div>
      </div>

      {/* Rejection Checkbox */}
      <div className="flex items-center gap-2.5 p-3.5 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer"
        onClick={() => setHasRejection(v => !v)}>
        <div className={`w-4.5 h-4.5 rounded border-2 flex items-center justify-center transition-colors ${hasRejection ? 'bg-amber-500 border-amber-500' : 'border-slate-400 bg-white'}`}>
          {hasRejection && <span className="text-white text-[10px] font-black">✓</span>}
        </div>
        <span className="text-xs font-bold text-amber-800">Is there any rejection?</span>
        <span className="text-[10px] text-amber-600 font-medium ml-auto">Tick to log rejected items</span>
      </div>

      {/* Rejection Items Form */}
      {hasRejection && (
        <div className="space-y-3 border border-red-200 rounded-xl p-4 bg-red-50/30">
          <p className="text-[10px] font-black text-red-600 uppercase tracking-wider flex items-center gap-1">
            <XCircle size={11} /> Rejection Note
          </p>

          {rejections.map((row, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-end">
              {/* Item Code */}
              <div className="col-span-4">
                {idx === 0 && (
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">
                    Item Code
                  </label>
                )}
                <select
                  value={row.item_code}
                  onChange={e => updateRejection(idx, 'item_code', e.target.value)}
                  className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-400 bg-white font-mono"
                >
                  <option value="">Select Item</option>
                  {dnItems.map(item => (
                    <option key={item.item_code} value={item.item_code}>
                      {item.item_code}{item.description ? ` – ${item.description}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div className="col-span-3">
                {idx === 0 && (
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">
                    Qty
                  </label>
                )}
                <input
                  type="number"
                  min="1"
                  value={row.quantity}
                  onChange={e => updateRejection(idx, 'quantity', e.target.value)}
                  placeholder="0"
                  className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-400 font-bold"
                />
              </div>

              {/* Reason */}
              <div className="col-span-4">
                {idx === 0 && (
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">
                    Reason
                  </label>
                )}
                <input
                  type="text"
                  value={row.reason}
                  onChange={e => updateRejection(idx, 'reason', e.target.value)}
                  placeholder="e.g. Damaged"
                  className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-400"
                />
              </div>

              {/* Remove Row */}
              <div className="col-span-1 flex items-center justify-center">
                {rejections.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRejectionRow(idx)}
                    className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
                  >
                    <XCircle size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addRejectionRow}
            className="flex items-center gap-1.5 text-[10px] font-bold text-red-600 hover:text-red-800 transition-colors cursor-pointer mt-1"
          >
            <Plus size={11} /> Add Another Rejection Item
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
          <AlertCircle size={13} className="shrink-0" /> {error}
        </div>
      )}

      {/* Submit */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 text-white font-bold text-xs rounded-lg hover:opacity-90 transition-opacity cursor-pointer shadow-sm disabled:opacity-60"
          style={{ backgroundColor: 'var(--theme-color)' }}
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <ClipboardCheck size={13} />}
          {saving ? 'Saving…' : isEdit ? 'Update GRN' : 'Submit GRN'}
        </button>
      </div>
    </form>
  );
}

// ── GRN Panel Section (for a single delivery note) ─────────────────────────────
function GrnSection({ tradeId, deliveryNoteNo, dnItems, grns, onRefresh }) {
  const noteGrn = grns.find(g => g.delivery_note_no === deliveryNoteNo);
  const [showForm, setShowForm] = useState(!noteGrn);
  const [loadingItems, setLoadingItems] = useState(false);
  const [items, setItems] = useState(dnItems || []);

  useEffect(() => {
    setItems(dnItems || []);
    setShowForm(!noteGrn);
  }, [deliveryNoteNo, dnItems, noteGrn]);

  const loadItems = async () => {
    if (items.length > 0) return; // already loaded
    setLoadingItems(true);
    try {
      const res = await fetch(`/api/grns/items-lookup/${encodeURIComponent(deliveryNoteNo)}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (e) { console.error(e); }
    finally { setLoadingItems(false); }
  };

  const handleShowForm = () => {
    setShowForm(true);
    loadItems();
  };

  const handleSaved = () => {
    setShowForm(false);
    onRefresh();
  };

  // ── Already submitted GRN view ──
  if (noteGrn && !showForm) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        {/* Header */}
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
            <ClipboardCheck size={14} style={{ color: 'var(--theme-color)' }} />
            Goods Received Note
          </span>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded">
              {noteGrn.grn_no}
            </span>
            <button
              onClick={handleShowForm}
              className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <Edit2 size={10} /> Edit GRN
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Meta */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-4 border-b border-slate-100">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">GRN Date</p>
              <p className="text-sm font-semibold text-slate-800">{fmtDate(noteGrn.grn_date)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Has Rejection</p>
              <p className={`text-sm font-bold ${noteGrn.has_rejection ? 'text-red-600' : 'text-emerald-600'}`}>
                {noteGrn.has_rejection ? 'Yes' : 'No'}
              </p>
            </div>
          </div>

          {/* Rejection Items Table */}
          {noteGrn.has_rejection && (noteGrn.rejection_items || []).length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider flex items-center gap-1 mb-2">
                <XCircle size={11} /> Rejection Items ({noteGrn.rejection_items.length})
              </p>
              <div className="border border-red-200 rounded-lg overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-red-50 border-b border-red-200 text-[10px] font-bold text-red-600 uppercase tracking-wider">
                      <th className="px-4 py-2.5">Item Code</th>
                      <th className="px-4 py-2.5 text-right">Qty Rejected</th>
                      <th className="px-4 py-2.5">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-100 bg-white">
                    {noteGrn.rejection_items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-red-50 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-xs px-1.5 py-0.5 rounded border border-red-300 text-red-700 bg-red-50">
                            {item.item_code}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-800">{item.quantity}</td>
                        <td className="px-4 py-3 text-slate-600 font-medium">{item.reason || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Fully accepted badge */}
          {!noteGrn.has_rejection && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 shadow-xs">
              <CheckCircle2 size={16} className="shrink-0" />
              <span className="text-xs font-bold">All goods received and accepted — no rejections.</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── GRN not yet submitted ──
  if (!noteGrn) {
    if (showForm) {
      return (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <ClipboardCheck size={14} style={{ color: 'var(--theme-color)' }} />
              Create Goods Received Note
            </span>
          </div>
          <div className="p-6">
            {loadingItems ? (
              <div className="flex items-center justify-center py-8 gap-2 text-slate-400">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-xs font-semibold">Loading items…</span>
              </div>
            ) : (
              <GrnForm
                tradeId={tradeId}
                deliveryNoteNo={deliveryNoteNo}
                dnItems={items}
                existingGrn={null}
                onSaved={handleSaved}
              />
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 text-center shadow-sm space-y-4">
        <div className="w-10 h-10 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center mx-auto" style={{ color: 'var(--theme-color)' }}>
          <ClipboardCheck size={20} />
        </div>
        <div className="max-w-sm mx-auto space-y-1">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Next Step: GRN</h4>
          <p className="text-[11px] text-slate-500 font-semibold text-center">
            No Goods Received Note has been raised for this dispatch. Raise a GRN to confirm receipt and log any rejections.
          </p>
        </div>
        <button
          onClick={handleShowForm}
          className="inline-flex items-center gap-1.5 px-4.5 py-2 text-white font-bold text-xs rounded hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
          style={{ backgroundColor: 'var(--theme-color)' }}
        >
          <Plus size={12} /> Raise GRN for {deliveryNoteNo}
        </button>
      </div>
    );
  }

  // ── Edit mode ──
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
          <ClipboardCheck size={14} style={{ color: 'var(--theme-color)' }} />
          Edit GRN — {noteGrn.grn_no}
        </span>
        <button
          type="button"
          onClick={() => setShowForm(false)}
          className="text-[10px] font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
        >
          Cancel
        </button>
      </div>
      <div className="p-6">
        {loadingItems ? (
          <div className="flex items-center justify-center py-8 gap-2 text-slate-400">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-xs font-semibold">Loading items…</span>
          </div>
        ) : (
          <GrnForm
            tradeId={tradeId}
            deliveryNoteNo={deliveryNoteNo}
            dnItems={items}
            existingGrn={noteGrn}
            onSaved={handleSaved}
          />
        )}
      </div>
    </div>
  );
}

export default function DeliveryPanel({ tradeId, deliveryNotes = [], invoices = [], grns = [], payments = [], onRefresh, focusedDeliveryId }) {
  const navigate = useNavigate();

  // Set default selection to focusedDeliveryId if it matches one of our delivery notes
  const initialDnNo = deliveryNotes.some(dn => dn.delivery_note_no === focusedDeliveryId)
    ? focusedDeliveryId
    : (deliveryNotes[0] ? deliveryNotes[0].delivery_note_no : null);

  const [selectedDnNo, setSelectedDnNo] = useState(initialDnNo);
  const containerRef = useRef(null);

  const activeDnNo = selectedDnNo || (deliveryNotes[0] ? deliveryNotes[0].delivery_note_no : null);
  const activeNote = deliveryNotes.find(dn => dn.delivery_note_no === activeDnNo) || deliveryNotes[0];

  useEffect(() => {
    if (focusedDeliveryId && deliveryNotes.some(dn => dn.delivery_note_no === focusedDeliveryId)) {
      setSelectedDnNo(focusedDeliveryId);
    }
  }, [focusedDeliveryId, deliveryNotes]);

  useEffect(() => {
    if (focusedDeliveryId && containerRef.current) {
      // Small timeout to allow content/tab rendering to complete before scrolling
      const t = setTimeout(() => {
        containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
      return () => clearTimeout(t);
    }
  }, [focusedDeliveryId]);

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
          <div
            ref={containerRef}
            className={`bg-white border rounded-xl overflow-hidden shadow-sm transition-all duration-500 ${
              focusedDeliveryId && activeNote.delivery_note_no === focusedDeliveryId
                ? 'ring-2 ring-[var(--theme-color)] shadow-lg scale-[1.01]'
                : 'border-slate-200'
            }`}
            style={
              focusedDeliveryId && activeNote.delivery_note_no === focusedDeliveryId
                ? { borderColor: 'var(--theme-color)' }
                : undefined
            }
          >
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
                <div className="border border-slate-200 rounded-lg overflow-x-auto">
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
                          <div className="border border-slate-200 rounded-lg overflow-x-auto">
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

          {/* ── GRN Section (after invoices) ─────────────────────────────── */}
          {noteInvoices.length > 0 && (
            <GrnSection
              tradeId={tradeId}
              deliveryNoteNo={activeDnNo}
              dnItems={activeItems}
              grns={grns}
              onRefresh={onRefresh}
            />
          )}


        </div>
      )}
    </div>
  );
}
