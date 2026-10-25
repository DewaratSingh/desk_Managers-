import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  ArrowLeft, Printer, Edit2, Check, X, FileText,
  ChevronRight, Save, RefreshCw
} from 'lucide-react';

/* ── helpers ─────────────────────────────────────────────────────────────── */
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
const fmtQty = (v) => (parseFloat(v) || 0).toLocaleString('en-IN');

/* ── inline search dropdown (portal-based) ───────────────────────────────── */
function SearchDropdown({ value, onChange, suggestions, placeholder, onSelect, onClear }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const updateCoords = () => {
      if (open && ref.current) {
        const rect = ref.current.getBoundingClientRect();
        setCoords({ top: rect.bottom, left: rect.left, width: rect.width });
      }
    };
    updateCoords();
    if (open) {
      window.addEventListener('scroll', updateCoords, true);
      window.addEventListener('resize', updateCoords);
    }
    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
    };
  }, [open, value]);

  const filtered = value.trim()
    ? suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase()))
    : suggestions;

  const dropdownMenu = open && filtered.length > 0 ? (
    <div
      style={{
        position: 'fixed',
        top: `${coords.top + 2}px`,
        left: `${coords.left}px`,
        width: `${Math.max(160, coords.width)}px`,
        zIndex: 9999,
      }}
      className=" bg-[white] border border-slate-300 rounded shadow-xl overflow-hidden max-h-40 overflow-y-auto"
    >
      {filtered.map((s) => (
        <button
          key={s}
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onSelect(s); setOpen(false); }}
          className="w-full text-left px-3 py-1.5 text-[11px] font-semibold text-slate-800 hover:bg-slate-50 border-b border-slate-100 last:border-0 cursor-pointer transition-colors"
        >
          {s}
        </button>
      ))}
    </div>
  ) : null;

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
          style={{ borderColor: 'var(--theme-secondary)' }}
          className="w-full px-1.5 py-0.5 border rounded text-[11px] font-medium  bg-[white] focus:outline-none placeholder:text-slate-300"
        />
        {value && (
          <button type="button" onClick={onClear}
            className="text-slate-400 hover:text-red-500 cursor-pointer shrink-0">
            <X size={10} />
          </button>
        )}
      </div>
      {dropdownMenu && createPortal(dropdownMenu, document.body)}
    </div>
  );
}

/* ── status badge ────────────────────────────────────────────────────────── */
function StatusBadge({ status }) {
  const v = (status || '').toLowerCase();
  let style = {};
  if (v === 'delivered' || v === 'received' || v === 'completed') {
    style = { color: '#15803d', background: '#f0fdf4', border: '1px solid #86efac' };
  } else if (v === 'shipped' || v === 'in transit') {
    style = { color: '#1d4ed8', background: '#eff6ff', border: '1px solid #93c5fd' };
  } else if (v === 'ordered') {
    style = { color: '#6d28d9', background: '#f5f3ff', border: '1px solid #c4b5fd' };
  } else if (v === 'cancelled') {
    style = { color: '#9f1239', background: '#fff1f2', border: '1px solid #fca5a5' };
  } else if (v === 'awaiting to receive' || v === 'pending') {
    style = { color: '#92400e', background: '#fffbeb', border: '1px solid #fcd34d' };
  } else {
    style = { color: 'var(--theme-secondary)', background: 'rgba(217,53,45,0.05)', border: '1px solid var(--theme-secondary)' };
  }
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wide whitespace-nowrap"
      style={style}
    >
      {status || 'pending'}
    </span>
  );
}

/* ── column header ───────────────────────────────────────────────────────── */
function TH({ children, align = 'left', className = '', style = {} }) {
  return (
    <th
      className={`px-2 py-2 text-[9px] font-black uppercase tracking-widest whitespace-nowrap border-r last:border-r-0 select-none ${className}`}
      style={{
        textAlign: align,
        backgroundColor: 'var(--theme-primary)',
        color: 'var(--text-sidebar)',
        borderColor: 'rgba(255,255,255,0.1)',
        ...style
      }}
    >
      {children}
    </th>
  );
}

/* ── cell ────────────────────────────────────────────────────────────────── */
function TD({ children, align = 'left', className = '', style = {}, ...rest }) {
  return (
    <td
      className={`px-2 py-1.5 text-[11px] border-r last:border-r-0 ${className}`}
      style={{
        textAlign: align,
        borderColor: 'var(--border-color)',
        ...style
      }}
      {...rest}
    >
      {children}
    </td>
  );
}

/* ── main component ──────────────────────────────────────────────────────── */
export default function PurchaseOrderView() {
  const { po_no: rawParam } = useParams();
  const po_no = decodeURIComponent(rawParam);
  const navigate = useNavigate();

  const [po, setPo]               = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState(null);

  const [statuses, setStatuses]   = useState([]);
  const [customers, setCustomers] = useState([]);

  const [editingCode, setEditingCode] = useState(null);
  const [editStatus, setEditStatus]   = useState('');
  const [editVendor, setEditVendor]   = useState('');
  const [isSaving, setIsSaving]       = useState(false);
  const [saveError, setSaveError]     = useState(null);

  useEffect(() => { fetchPo(); }, [po_no]);

  const fetchPo = async () => {
    setIsLoading(true); setError(null);
    try {
      if (po_no && String(po_no).startsWith('PPO-')) {
        const res = await fetch(`/api/process-po/${encodeURIComponent(po_no)}`);
        if (res.ok) {
          const data = await res.json();
          const poData = Array.isArray(data) ? data[0] : data;
          const mappedItems = (poData.target_items && poData.target_items.length > 0)
            ? poData.target_items.map(it => ({
                item_code: it.item_code,
                description: it.description,
                quantity: it.qty,
                delivered_qty: it.delivered_qty || 0,
                unit_price: it.price,
                gst_type: it.gst_type,
                gst_rate: it.gst_rate,
                delivery_date: it.delivery_date || poData.delivery_date,
                status: it.status || poData.status,
                vendor: poData.seller || poData.party
              }))
            : (poData.items || []).map(it => ({
                item_code: it.target_item_code || it.source_item_code,
                description: it.target_description || it.source_description,
                quantity: it.target_item_quantity || it.target_qty || 0,
                delivered_qty: it.delivered_qty || 0,
                unit_price: it.price,
                delivery_date: poData.delivery_date,
                status: poData.status,
                vendor: poData.seller || poData.party
              }));
          setPo({
            ...poData,
            po_date: poData.date_of_start || poData.created_at,
            party_id: poData.party || poData.seller || '—',
            items: mappedItems
          });
          return;
        }
      }
      const res = await fetch(`/api/purchase-orders/${encodeURIComponent(po_no)}`);
      if (!res.ok) throw new Error('Purchase order not found');
      setPo(await res.json());
    } catch (err) { setError(err.message); }
    finally { setIsLoading(false); }
  };

  useEffect(() => {
    const trimmed = editStatus.trim();
    const t = setTimeout(() => {
      fetch(`/api/statuses?q=${encodeURIComponent(trimmed)}&limit=8`)
        .then(r => r.json()).then(setStatuses).catch(console.error);
    }, 200);
    return () => clearTimeout(t);
  }, [editStatus]);

  useEffect(() => {
    const trimmed = editVendor.trim();
    const t = setTimeout(() => {
      fetch(`/api/customers?q=${encodeURIComponent(trimmed)}&limit=8`)
        .then(r => r.json())
        .then(data => setCustomers(data.map(c => c.name).filter(Boolean)))
        .catch(console.error);
    }, 200);
    return () => clearTimeout(t);
  }, [editVendor]);

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

  /* totals */
  const itemsBasic = (po?.items || []).reduce((s, i) =>
    s + (parseFloat(i.unit_price)||0) * (parseFloat(i.quantity)||0), 0);
  const gstTotal = (po?.items || []).reduce((s, i) => {
    const line = (parseFloat(i.unit_price)||0) * (parseFloat(i.quantity)||0);
    return s + line * ((parseFloat(i.gst_rate)||0) / 100);
  }, 0);
  const transport  = parseFloat(po?.transport)       || 0;
  const packing    = parseFloat(po?.packing_forward) || 0;
  const other      = parseFloat(po?.other)           || 0;
  const basicVal   = parseFloat(po?.basic_value)     || 0;
  const grandTotal = itemsBasic + gstTotal + transport + packing + other + basicVal;

  /* ── loading ── */
  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-app)' }}>
      <div className="flex items-center gap-3">
        <RefreshCw size={18} className="animate-spin" style={{ color: 'var(--theme-secondary)' }} />
        <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Loading Purchase Order…</p>
      </div>
    </div>
  );

  /* ── error ── */
  if (error || !po) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8" style={{ backgroundColor: 'var(--bg-app)' }}>
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-semibold max-w-md text-center">
        {error || 'Purchase Order not found.'}
      </div>
      <button onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 px-4 py-2 text-white font-bold rounded-lg text-sm cursor-pointer transition-all"
        style={{ backgroundColor: 'var(--theme-primary)' }}>
        <ArrowLeft size={14} /> Go Back
      </button>
    </div>
  );

  const items = po.items || [];
  const totalQty = items.reduce((s, i) => s + (parseFloat(i.quantity) || 0), 0);
  const deliveredQty = items.reduce((s, i) => s + (parseFloat(i.delivered_qty) || 0), 0);
  const pendingQtyTotal = Math.max(0, totalQty - deliveredQty);

  return (
    <div className="min-h-screen flex flex-col print: bg-[white]" style={{ backgroundColor: 'var(--bg-app)' }}>

      {/* ── sticky topbar ─────────────────────────────────────────────────── */}
      <div
        className="print:hidden sticky top-0 z-30 border-b shadow-sm"
        style={{ backgroundColor: 'var(--theme-primary)', borderColor: 'rgba(255,255,255,0.1)' }}
      >
        <div className="w-full px-4 py-2.5 flex items-center justify-between gap-4">
          {/* left: back + breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'var(--text-sidebar)' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
            >
              <ArrowLeft size={13} /> Back
            </button>

            <div className="flex items-center gap-1.5 text-[11px] font-semibold min-w-0" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {po.trade_id && (
                <>
                  <Link to={`/trade/${po.trade_id}`}
                    className="truncate hover:underline"
                    style={{ color: 'var(--theme-secondary)' }}>
                    {po.trade_id}
                  </Link>
                  <ChevronRight size={11} className="shrink-0" />
                </>
              )}
              {po.quotation_no && (
                <>
                  <span className="truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>{po.quotation_no}</span>
                  <ChevronRight size={11} className="shrink-0" />
                </>
              )}
              <span className="font-black truncate" style={{ color: 'var(--text-sidebar)' }}>{po.po_no}</span>
            </div>
          </div>

          {/* right: action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {po.trade_id && (
              <Link to={`/trade/${po.trade_id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer"
                style={{ color: 'var(--text-sidebar)', borderColor: 'rgba(255,255,255,0.25)', backgroundColor: 'rgba(255,255,255,0.08)' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.16)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'}
              >
                <FileText size={12} /> View Trade
              </Link>
            )}
            <Link
              to={`/updatePurchaseOrder/${po.po_no}?trade_id=${po.trade_id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer"
              style={{ color: 'var(--text-sidebar)', borderColor: 'rgba(255,255,255,0.25)', backgroundColor: 'rgba(255,255,255,0.08)' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.16)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'}
            >
              <Edit2 size={12} /> Edit PO
            </Link>
            <button onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-white cursor-pointer transition-all"
              style={{ backgroundColor: 'var(--theme-secondary)' }}
              onMouseEnter={e => e.currentTarget.style.filter = 'brightness(0.88)'}
              onMouseLeave={e => e.currentTarget.style.filter = 'none'}
            >
              <Printer size={12} /> Print
            </button>
          </div>
        </div>
      </div>

      {/* ── page content ──────────────────────────────────────────────────── */}
      <div className="flex-1 p-4 space-y-4">

        {/* PO info strip */}
        <div
          className="rounded-xl border px-4 py-3 flex flex-wrap gap-6 items-center shadow-sm"
          style={{ backgroundColor: 'var(--bg-form, white)', borderColor: 'var(--border-color)' }}
        >
          {[
            { label: 'PO Number',     value: po.po_no,             mono: true },
            { label: 'PO Date',       value: fmtDate(po.po_date) },
            { label: 'Delivery Date', value: fmtDate(po.delivery_date) },
            { label: 'Quotation',     value: po.quotation_no || '—', mono: true },
            { label: 'Trade',         value: po.trade_id     || '—', mono: true },
            { label: 'Items',         value: items.length },
            { label: 'Total Qty',     value: fmtQty(totalQty) },
            { label: 'Pending Qty',   value: fmtQty(pendingQtyTotal), highlight: pendingQtyTotal > 0 },
          ].map(({ label, value, mono, highlight }) => (
            <div key={label} className="flex flex-col min-w-0">
              <span className="text-[9px] font-black uppercase tracking-widest mb-0.5"
                style={{ color: 'var(--theme-secondary)' }}>
                {label}
              </span>
              <span
                className={`text-[13px] font-black ${mono ? 'font-mono' : ''}`}
                style={{ color: highlight ? 'var(--theme-secondary)' : 'var(--text-primary)' }}
              >
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* save error */}
        {saveError && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg">
            <X size={13} /> {saveError}
          </div>
        )}

        {/* ── Excel-style table ────────────────────────────────────────────── */}
        <div
          className="rounded-xl border overflow-hidden shadow-sm"
          style={{ borderColor: 'var(--border-color)' }}
        >
          {/* toolbar strip */}
          <div
            className="flex items-center justify-between px-4 py-2 border-b"
            style={{ backgroundColor: 'var(--bg-form, white)', borderColor: 'var(--border-color)' }}
          >
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-primary)' }}>
              Ordered Items — {items.length} row{items.length !== 1 ? 's' : ''}
            </span>
            <span className="text-[9px] font-semibold" style={{ color: 'var(--theme-secondary)' }}>
              Click ✏ to edit Status &amp; Vendor inline
            </span>
          </div>

          <div className="overflow-x-auto w-full">
            <table
              className="w-full border-collapse"
              style={{ minWidth: '900px', tableLayout: 'fixed' }}
            >
              {/* col widths */}
              <colgroup>
                <col style={{ width: '34px' }} />   {/* S.N */}
                <col style={{ width: '110px' }} />  {/* Item Code */}
                <col style={{ width: '220px' }} />  {/* Description */}
                <col style={{ width: '70px' }} />   {/* Total Qty */}
                <col style={{ width: '70px' }} />   {/* Pending Qty */}
                <col style={{ width: '90px' }} />   {/* Unit Price */}
                <col style={{ width: '70px' }} />   {/* GST % */}
                <col style={{ width: '100px' }} />  {/* Line Total */}
                <col style={{ width: '80px' }} />   {/* Del. Date */}
                <col style={{ width: '140px' }} />  {/* Status */}
                <col style={{ width: '140px' }} />  {/* Vendor */}
                <col style={{ width: '64px' }} />   {/* Actions */}
              </colgroup>

              <thead>
                <tr>
                  <TH align="center">#</TH>
                  <TH>Item Code</TH>
                  <TH>Description</TH>
                  <TH align="right">Total Qty</TH>
                  <TH align="right">Pending</TH>
                  <TH align="right">Unit Price</TH>
                  <TH align="right">GST</TH>
                  <TH align="right">Line Total</TH>
                  <TH>Del. Date</TH>
                  <TH>Status</TH>
                  <TH>Vendor</TH>
                  <TH align="center" className="print:hidden">Edit</TH>
                </tr>
              </thead>

              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={12}
                      className="py-12 text-center text-[11px] font-bold"
                      style={{ color: 'var(--text-primary)', opacity: 0.4 }}
                    >
                      No items found in this purchase order.
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => {
                    const isEditing  = editingCode === item.item_code;
                    const lineBasic  = (parseFloat(item.unit_price)||0) * (parseFloat(item.quantity)||0);
                    const lineGst    = lineBasic * ((parseFloat(item.gst_rate)||0) / 100);
                    const lineTotal  = lineBasic + lineGst;
                    const pendingQty = Math.max(0, (parseFloat(item.quantity)||0) - (parseFloat(item.delivered_qty)||0));
                    const isEven     = idx % 2 === 0;

                    const rowBg = isEditing
                      ? 'rgba(217,53,45,0.04)'
                      : isEven
                      ? 'var(--bg-form, #ffffff)'
                      : 'rgba(0,0,0,0.018)';

                    return (
                      <tr
                        key={item.item_code}
                        style={{ backgroundColor: rowBg }}
                        className="transition-colors group"
                        onMouseEnter={e => {
                          if (!isEditing) e.currentTarget.style.backgroundColor = 'rgba(217,53,45,0.035)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.backgroundColor = rowBg;
                        }}
                      >
                        {/* S.N */}
                        <TD align="center" className="font-mono font-bold" style={{ color: 'var(--theme-secondary)', opacity: 0.7 }}>
                          {idx + 1}
                        </TD>

                        {/* Item Code */}
                        <TD>
                          <span
                            className="font-mono font-black text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap"
                            style={{
                              color: 'var(--theme-secondary)',
                              borderColor: 'var(--theme-secondary)',
                              backgroundColor: 'rgba(217,53,45,0.05)'
                            }}
                          >
                            {item.item_code}
                          </span>
                          {item.drawing_number && (
                            <span className="block text-[9px] mt-0.5 font-mono" style={{ color: 'var(--text-primary)', opacity: 0.4 }}>
                              DRW: {item.drawing_number}
                            </span>
                          )}
                        </TD>

                        {/* Description */}
                        <TD>
                          <span
                            className="font-semibold block leading-snug text-[11px]"
                            style={{ color: 'var(--text-primary)' }}
                            title={item.description || '—'}
                          >
                            {item.description || <span style={{ opacity: 0.3 }}>—</span>}
                          </span>
                        </TD>

                        {/* Total Qty */}
                        <TD align="right">
                          <span className="font-mono font-bold text-[11px]" style={{ color: 'var(--text-primary)' }}>
                            {fmtQty(item.quantity)}
                          </span>
                        </TD>

                        {/* Pending Qty */}
                        <TD align="right">
                          <span
                            className="font-mono font-black text-[11px]"
                            style={{
                              color: pendingQty > 0 ? 'var(--theme-secondary)' : '#15803d'
                            }}
                          >
                            {fmtQty(pendingQty)}
                          </span>
                        </TD>

                        {/* Unit Price */}
                        <TD align="right">
                          <span className="font-mono font-bold text-[11px]" style={{ color: 'var(--text-primary)' }}>
                            ₹{fmt(item.unit_price)}
                          </span>
                        </TD>

                        {/* GST */}
                        <TD align="right">
                          {item.gst_rate ? (
                            <span className="font-mono text-[10px]" style={{ color: 'var(--text-primary)', opacity: 0.7 }}>
                              {item.gst_rate}%
                              <span className="block text-[9px]" style={{ opacity: 0.55 }}>₹{fmt(lineGst)}</span>
                            </span>
                          ) : (
                            <span style={{ opacity: 0.25, fontSize: '10px' }}>—</span>
                          )}
                        </TD>

                        {/* Line Total */}
                        <TD align="right">
                          <span className="font-mono font-black text-[12px]" style={{ color: 'var(--text-primary)' }}>
                            ₹{fmt(lineTotal)}
                          </span>
                        </TD>

                        {/* Delivery Date */}
                        <TD>
                          <span className="text-[10px] font-semibold whitespace-nowrap" style={{ color: 'var(--text-primary)', opacity: 0.75 }}>
                            {fmtDate(item.delivery_date)}
                          </span>
                        </TD>

                        {/* Status */}
                        <TD>
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
                            <StatusBadge status={item.status} />
                          )}
                        </TD>

                        {/* Vendor */}
                        <TD>
                          {isEditing ? (
                            <SearchDropdown
                              value={editVendor}
                              onChange={setEditVendor}
                              suggestions={customers}
                              placeholder="Search vendor…"
                              onSelect={setEditVendor}
                              onClear={() => setEditVendor('')}
                            />
                          ) : (
                            <span className="text-[11px] font-semibold" style={{ color: item.vendor ? 'var(--text-primary)' : 'rgba(0,0,0,0.2)' }}>
                              {item.vendor || '—'}
                            </span>
                          )}
                        </TD>

                        {/* Actions */}
                        <TD align="center" className="print:hidden">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => saveEdit(item.item_code)}
                                disabled={isSaving}
                                title="Save"
                                className="p-1 rounded cursor-pointer transition-colors disabled:opacity-40 text-white"
                                style={{ backgroundColor: '#15803d' }}
                                onMouseEnter={e => e.currentTarget.style.filter = 'brightness(0.85)'}
                                onMouseLeave={e => e.currentTarget.style.filter = 'none'}
                              >
                                {isSaving ? <RefreshCw size={10} className="animate-spin" /> : <Check size={10} />}
                              </button>
                              <button
                                onClick={cancelEdit}
                                disabled={isSaving}
                                title="Cancel"
                                className="p-1 rounded cursor-pointer transition-colors disabled:opacity-40"
                                style={{ backgroundColor: '#fff1f2', color: '#9f1239', border: '1px solid #fca5a5' }}
                              >
                                <X size={10} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEdit(item)}
                              title="Edit"
                              className="p-1 rounded cursor-pointer transition-colors"
                              style={{ color: 'var(--text-primary)', opacity: 0.35 }}
                              onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = 'var(--theme-secondary)'; }}
                              onMouseLeave={e => { e.currentTarget.style.opacity = '0.35'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                            >
                              <Edit2 size={11} />
                            </button>
                          )}
                        </TD>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* totals footer */}
              {items.length > 0 && (
                <tfoot>
                  <tr style={{ backgroundColor: 'rgba(0,0,0,0.03)', borderTop: `2px solid var(--border-color)` }}>
                    <TD colSpan={3} className="font-black text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
                      Totals
                    </TD>
                    <TD align="right">
                      <span className="font-mono font-black text-[11px]" style={{ color: 'var(--text-primary)' }}>
                        {fmtQty(totalQty)}
                      </span>
                    </TD>
                    <TD align="right">
                      <span className="font-mono font-black text-[11px]" style={{ color: pendingQtyTotal > 0 ? 'var(--theme-secondary)' : '#15803d' }}>
                        {fmtQty(pendingQtyTotal)}
                      </span>
                    </TD>
                    <TD />
                    <TD align="right">
                      <span className="font-mono text-[10px]" style={{ color: 'var(--text-primary)', opacity: 0.6 }}>₹{fmt(gstTotal)}</span>
                    </TD>
                    <TD align="right">
                      <span className="font-mono font-black text-[13px]" style={{ color: 'var(--theme-secondary)' }}>
                        ₹{fmt(itemsBasic + gstTotal)}
                      </span>
                    </TD>
                    <TD colSpan={4} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* ── Financial summary ─────────────────────────────────────────────── */}
        <div
          className="rounded-xl border overflow-hidden shadow-sm"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div
            className="px-4 py-2 border-b"
            style={{
              backgroundColor: 'var(--theme-primary)',
              borderColor: 'rgba(255,255,255,0.1)'
            }}
          >
            <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--text-sidebar)' }}>
              Financial Breakdown
            </span>
          </div>

          <div
            className="overflow-x-auto"
            style={{ backgroundColor: 'var(--bg-form, white)' }}
          >
            <table className="w-full border-collapse" style={{ minWidth: '500px' }}>
              <tbody>
                {[
                  { label: 'Items Subtotal',         value: itemsBasic, muted: false },
                  { label: 'GST / Tax',               value: gstTotal,   muted: true },
                  { label: 'Additional Basic Value',  value: basicVal,   muted: true },
                  { label: 'Transport / Freight',     value: transport,  muted: true },
                  { label: 'Packing & Forwarding',    value: packing,    muted: true },
                  { label: 'Other Charges',           value: other,      muted: true },
                ].map(({ label, value, muted }, i) => (
                  <tr
                    key={label}
                    className="border-b last:border-b-0"
                    style={{ borderColor: 'var(--border-color)' }}
                  >
                    <TD className="text-[11px] font-semibold w-1/2" style={{ color: 'var(--text-primary)', opacity: muted ? 0.6 : 1 }}>
                      {label}
                    </TD>
                    <TD align="right" className="font-mono font-bold text-[12px] w-1/2" style={{ color: 'var(--text-primary)' }}>
                      ₹{fmt(value)}
                    </TD>
                  </tr>
                ))}
                {/* grand total */}
                <tr style={{ backgroundColor: 'var(--theme-primary)' }}>
                  <td className="px-2 py-3 text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-sidebar)' }}>
                    Grand Total PO Value
                  </td>
                  <td className="px-2 py-3 text-right font-mono font-black text-[16px]" style={{ color: 'var(--theme-secondary)' }}>
                    ₹{fmt(grandTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* bottom spacer */}
        <div className="h-6 print:hidden" />
      </div>
    </div>
  );
}
