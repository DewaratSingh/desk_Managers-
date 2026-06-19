import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Printer, Edit2, Check, X, FileText,
  Package, Tag, Hash, ChevronRight
} from 'lucide-react';

const fmtDate = (d) => {
  if (!d) return '—';
  const s = typeof d === 'string' ? d : d.toISOString?.() ?? String(d);
  if (s.match(/^\d{4}-\d{2}-\d{2}/)) {
    const [y, m, day] = s.substring(0, 10).split('-');
    return `${day}/${m}/${y}`;
  }
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return `${String(dt.getUTCDate()).padStart(2,'0')}/${String(dt.getUTCMonth()+1).padStart(2,'0')}/${dt.getUTCFullYear()}`;
};

const fmt = (v) => (parseFloat(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

const statusColor = (s) => {
  const v = (s || '').toLowerCase();
  if (v === 'delivered' || v === 'received' || v === 'completed')
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (v === 'shipped')    return 'bg-blue-50    text-blue-700    border-blue-200';
  if (v === 'ordered')    return 'bg-indigo-50  text-indigo-700  border-indigo-200';
  if (v === 'cancelled')  return 'bg-red-50     text-red-700     border-red-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
};

/* ── Reusable inline search dropdown ──────────────────────────────────────── */
function SearchDropdown({ value, onChange, suggestions, placeholder, onSelect, onClear }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = value.trim()
    ? suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase()))
    : suggestions;

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={value}
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className="w-36 px-2 py-1 border border-slate-300 rounded text-xs font-medium bg-white focus:outline-none focus:border-[var(--theme-color)] placeholder:text-slate-400"
        />
        {value && (
          <button type="button" onClick={onClear}
            className="text-slate-400 hover:text-red-500 cursor-pointer shrink-0">
            <X size={11} />
          </button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 mt-1 w-48 bg-white border border-slate-300 rounded-lg shadow-lg overflow-hidden max-h-44 overflow-y-auto">
          {filtered.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onSelect(s); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-blue-50 border-b border-slate-100 last:border-0 cursor-pointer transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main component ────────────────────────────────────────────────────────── */
export default function PurchaseOrderView() {
  const { po_no: rawParam } = useParams();
  const po_no = decodeURIComponent(rawParam);
  const navigate = useNavigate();

  const [po, setPo]               = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState(null);

  // Reference data
  const [statuses, setStatuses]   = useState([]);
  const [customers, setCustomers] = useState([]);   // for vendor search

  // Inline edit state
  const [editingCode, setEditingCode] = useState(null);
  const [editStatus, setEditStatus]   = useState('');
  const [editVendor, setEditVendor]   = useState('');
  const [isSaving, setIsSaving]       = useState(false);
  const [saveError, setSaveError]     = useState(null);

  useEffect(() => {
    fetchPo();
    fetchStatuses();
    fetchCustomers();
  }, [po_no]);

  const fetchPo = async () => {
    setIsLoading(true); setError(null);
    try {
      const res = await fetch(`/api/purchase-orders/${encodeURIComponent(po_no)}`);
      if (!res.ok) throw new Error('Purchase order not found');
      setPo(await res.json());
    } catch (err) { setError(err.message); }
    finally { setIsLoading(false); }
  };

  const fetchStatuses = async () => {
    try {
      const res = await fetch('/api/statuses');
      if (res.ok) setStatuses(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      if (res.ok) {
        const data = await res.json();
        // Build flat list of customer names for vendor search
        setCustomers(data.map(c => c.name).filter(Boolean));
      }
    } catch (err) { console.error(err); }
  };

  const startEdit = (item) => {
    setEditingCode(item.item_code);
    setEditStatus(item.status || '');
    setEditVendor(item.vendor || '');
    setSaveError(null);
  };

  const cancelEdit = () => { setEditingCode(null); setSaveError(null); };

  const saveEdit = async (itemCode) => {
    setIsSaving(true); setSaveError(null);
    try {
      const res = await fetch(
        `/api/purchase-orders/${encodeURIComponent(po_no)}/items/${encodeURIComponent(itemCode)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: editStatus || null, vendor: editVendor || null })
        }
      );
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed to save'); }
      const updatedItems = await res.json();
      setPo(prev => ({ ...prev, items: updatedItems }));
      setEditingCode(null);
    } catch (err) { setSaveError(err.message); }
    finally { setIsSaving(false); }
  };

  /* Totals */
  const itemsBasic = (po?.items || []).reduce((s, i) =>
    s + (parseFloat(i.unit_price)||0) * (parseInt(i.quantity)||0), 0);
  const gstTotal = (po?.items || []).reduce((s, i) => {
    const line = (parseFloat(i.unit_price)||0) * (parseInt(i.quantity)||0);
    return s + line * ((parseFloat(i.gst_rate)||0) / 100);
  }, 0);
  const transport  = parseFloat(po?.transport)       || 0;
  const packing    = parseFloat(po?.packing_forward) || 0;
  const other      = parseFloat(po?.other)           || 0;
  const basicVal   = parseFloat(po?.basic_value)     || 0;
  const grandTotal = itemsBasic + gstTotal + transport + packing + other + basicVal;

  /* Loading / Error */
  if (isLoading) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <p className="text-slate-500 font-bold text-sm animate-pulse">Loading Purchase Order…</p>
    </div>
  );

  if (error || !po) return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center gap-4 p-8">
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-semibold max-w-md text-center">
        {error || 'Purchase Order not found.'}
      </div>
      <button onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-lg text-sm cursor-pointer transition-colors">
        <ArrowLeft size={15} /> Go Back
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 print:bg-white">

      {/* ── Sticky Top Bar ──────────────────────────────────────────────────── */}
      <div className="print:hidden sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
        <div className="w-full px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-colors cursor-pointer shrink-0">
              <ArrowLeft size={14} /> Back
            </button>
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 min-w-0">
              {po.trade_id && (
                <>
                  <Link to={`/trade/${po.trade_id}`}
                    className="truncate hover:underline cursor-pointer"
                    style={{ color: 'var(--theme-color)' }}>
                    {po.trade_id}
                  </Link>
                  <ChevronRight size={12} className="shrink-0" />
                </>
              )}
              {po.quotation_no && (
                <>
                  <span className="truncate text-slate-500">{po.quotation_no}</span>
                  <ChevronRight size={12} className="shrink-0" />
                </>
              )}
              <span className="font-black text-slate-800 truncate">{po.po_no}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {po.trade_id && (
              <Link to={`/trade/${po.trade_id}`}
                className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1.5">
                <FileText size={13} /> View Trade
              </Link>
            )}
            <button onClick={() => window.print()}
              className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1.5">
              <Printer size={13} /> Print
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="w-full px-4 sm:px-8 py-8 space-y-6">

        {/* Title row */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Purchase Order</h1>
            <p className="text-xs text-slate-500 mt-0.5 font-semibold">Per-item status &amp; vendor management</p>
          </div>
          <span className="font-mono font-black text-sm px-3 py-1.5 rounded-lg border"
            style={{ color: 'var(--theme-color)', borderColor: 'var(--theme-color)', backgroundColor: 'rgba(217,53,45,0.06)' }}>
            {po.po_no}
          </span>
        </div>

        {/* ── PO Info Card ─────────────────────────────────────────────────── */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="bg-slate-50 px-6 py-3 border-b border-slate-200">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <Hash size={13} style={{ color: 'var(--theme-color)' }} /> PO Information
            </span>
          </div>
          <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-4">
            {[
              { label: 'PO No.',        value: po.po_no,            mono: true },
              { label: 'PO Date',       value: fmtDate(po.po_date) },
              { label: 'Delivery Date', value: fmtDate(po.delivery_date) },
              { label: 'Quotation',     value: po.quotation_no || '—', mono: true },
              { label: 'Trade',         value: po.trade_id     || '—', mono: true },
            ].map(({ label, value, mono }) => (
              <div key={label}>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
                <p className={`text-sm font-bold text-slate-800 ${mono ? 'font-mono' : ''}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Items Table ──────────────────────────────────────────────────── */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex justify-between items-center">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <Package size={13} style={{ color: 'var(--theme-color)' }} />
              Ordered Items ({(po.items || []).length})
            </span>
            <span className="text-[10px] font-bold text-slate-400">
              Click <strong>Edit</strong> to update Status &amp; Vendor per item
            </span>
          </div>

          {saveError && (
            <div className="mx-6 mt-4 p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg flex items-center gap-1.5">
              <X size={13} /> {saveError}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Item Code</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Pending Qty</th>
                  <th className="px-4 py-3 text-right">Unit Price</th>
                  <th className="px-4 py-3 text-right">GST</th>
                  <th className="px-4 py-3 text-right">Line Total</th>
                  <th className="px-4 py-3">Shipping Address</th>
                  <th className="px-4 py-3">Del. Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3 text-center print:hidden">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(po.items || []).map((item) => {
                  const isEditing  = editingCode === item.item_code;
                  const lineBasic  = (parseFloat(item.unit_price)||0) * (parseInt(item.quantity)||0);
                  const lineGst    = lineBasic * ((parseFloat(item.gst_rate)||0) / 100);
                  const lineTotal  = lineBasic + lineGst;

                  return (
                    <tr key={item.item_code}
                      className={`transition-colors ${isEditing ? 'bg-slate-50/80' : 'hover:bg-slate-50'}`}>

                      {/* Item Code */}
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-xs px-1.5 py-0.5 rounded border"
                          style={{ color: 'var(--theme-color)', borderColor: 'var(--theme-color)', backgroundColor: 'rgba(217,53,45,0.05)' }}>
                          {item.item_code}
                        </span>
                      </td>

                      {/* Description */}
                      <td className="px-4 py-3 max-w-[160px]">
                        <p className="font-semibold text-slate-800 line-clamp-2">{item.description || '—'}</p>
                        {item.drawing_number && (
                          <span className="text-[9px] text-slate-400 bg-slate-100 border border-slate-200 px-1 py-0.5 rounded mt-0.5 inline-block">
                            DRW: {item.drawing_number}
                          </span>
                        )}
                      </td>

                      {/* Qty */}
                      <td className="px-4 py-3 text-right font-bold text-slate-800">{item.quantity}</td>

                      {/* Pending Qty */}
                      <td className="px-4 py-3 text-right font-bold text-slate-800">
                        {Math.max(0, (parseInt(item.quantity) || 0) - (parseInt(item.delivered_qty) || 0))}
                      </td>

                      {/* Unit Price */}
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">₹{fmt(item.unit_price)}</td>

                      {/* GST */}
                      <td className="px-4 py-3 text-right">
                        {item.gst_type ? (
                          <>
                            <span className="font-bold text-slate-800">{item.gst_rate}%</span>
                            <span className="text-[10px] text-slate-400 block font-mono">₹{fmt(lineGst)}</span>
                          </>
                        ) : <span className="text-slate-400">—</span>}
                      </td>

                      {/* Line Total */}
                      <td className="px-4 py-3 text-right font-mono font-black text-slate-900">₹{fmt(lineTotal)}</td>

                      {/* Shipping Address */}
                      <td className="px-4 py-3 text-slate-500 max-w-[130px] whitespace-pre-wrap text-[10px]">
                        {item.shipping_address || '—'}
                      </td>

                      {/* Delivery Date */}
                      <td className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">
                        {fmtDate(item.delivery_date)}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <SearchDropdown
                            value={editStatus}
                            onChange={setEditStatus}
                            suggestions={statuses}
                            placeholder="Search status…"
                            onSelect={setEditStatus}
                            onClear={() => setEditStatus('')}
                          />
                        ) : (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${statusColor(item.status)}`}>
                            {item.status || 'pending'}
                          </span>
                        )}
                      </td>

                      {/* Vendor */}
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <SearchDropdown
                            value={editVendor}
                            onChange={setEditVendor}
                            suggestions={customers}
                            placeholder="Search customer…"
                            onSelect={setEditVendor}
                            onClear={() => setEditVendor('')}
                          />
                        ) : (
                          <span className="font-semibold text-slate-800">{item.vendor || '—'}</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-center print:hidden">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => saveEdit(item.item_code)} disabled={isSaving} title="Save"
                              className="p-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded border border-emerald-200 transition-colors cursor-pointer disabled:opacity-50">
                              <Check size={13} />
                            </button>
                            <button onClick={cancelEdit} disabled={isSaving} title="Cancel"
                              className="p-1 bg-red-50 hover:bg-red-100 text-red-700 rounded border border-red-200 transition-colors cursor-pointer disabled:opacity-50">
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => startEdit(item)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-800 bg-transparent hover:bg-slate-100 rounded border border-transparent hover:border-slate-200 transition-all cursor-pointer">
                            <Edit2 size={10} /> Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Financial Breakdown ──────────────────────────────────────────── */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="bg-slate-50 px-6 py-3 border-b border-slate-200">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <Tag size={13} style={{ color: 'var(--theme-color)' }} /> Financial Breakdown
            </span>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-0 text-sm">
              {[
                { label: 'Items Subtotal',       value: itemsBasic },
                { label: 'GST / Tax',            value: gstTotal   },
                { label: 'Add. Basic Value',     value: basicVal   },
                { label: 'Transport / Freight',  value: transport  },
                { label: 'Packing & Forwarding', value: packing    },
                { label: 'Other Charges',        value: other      },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                  <span className="font-semibold text-slate-500">{label}</span>
                  <span className="font-mono font-bold text-slate-800">₹{fmt(value)}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 pt-4 border-t-2 border-slate-200 flex justify-between items-center">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Grand Total PO Value</span>
              <span className="text-2xl font-black text-slate-900">₹{fmt(grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* ── Bottom actions ───────────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-3 print:hidden pb-4">
          <Link
            to={`/updatePurchaseOrder/${po.po_no}?trade_id=${po.trade_id}`}
            className="px-5 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-lg text-sm transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Edit2 size={15} /> Edit Purchase Order
          </Link>
          {po.trade_id && (
            <Link to={`/trade/${po.trade_id}`}
              className="px-5 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-lg text-sm transition-colors cursor-pointer flex items-center gap-1.5">
              <FileText size={15} /> View Trade
            </Link>
          )}
          <button onClick={() => window.print()}
            className="px-5 py-2.5 rounded-lg font-bold text-sm text-white transition-colors cursor-pointer flex items-center gap-1.5"
            style={{ backgroundColor: 'var(--theme-color)' }}
            onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(0.9)'}
            onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}
          >
            <Printer size={15} /> Print / Save as PDF
          </button>
        </div>

      </div>
    </div>
  );
}
