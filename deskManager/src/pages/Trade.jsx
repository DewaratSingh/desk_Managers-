import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, FileText, RefreshCw } from 'lucide-react';

import RfqPanel       from './panel/RfqPanel';
import QuotationPanel from './panel/QuotationPanel';
import ReceivedQuotationPanel from './panel/ReceivedQuotationPanel';
import PoPanel        from './panel/PoPanel';
import RoPanel        from './panel/RoPanel';
import DeliveryPanel  from './panel/DeliveryPanel';
import InvoicePanel   from './panel/InvoicePanel';

// Status pill colours
const statusStyle = (s) => {
  const v = (s || '').toLowerCase();
  if (v === 'ordered')   return { color: '#4f46e5', borderColor: '#a5b4fc', backgroundColor: '#eef2ff' };
  if (v === 'quotation') return { color: '#0369a1', borderColor: '#7dd3fc', backgroundColor: '#f0f9ff' };
  if (v === 'payment')   return { color: '#15803d', borderColor: '#86efac', backgroundColor: '#f0fdf4' };
  return { color: 'var(--theme-color)', borderColor: 'var(--theme-color)', backgroundColor: 'rgba(217,53,45,0.05)' };
};

export default function TradeView() {
  const { tradeid } = useParams();
  const navigate    = useNavigate();

  const [trade, setTrade]               = useState(null);
  const [rfq, setRfq]                   = useState(null);
  const [quotation, setQuotation]       = useState(null);
  const [receivedQuotation, setReceivedQuotation] = useState(null);
  const [purchaseOrder, setPurchaseOrder] = useState(null);
  const [releaseOrder, setReleaseOrder]   = useState(null);
  const [deliveryNotes, setDeliveryNotes] = useState([]);
  const [invoices, setInvoices]           = useState([]);
  const [isLoading, setIsLoading]       = useState(true);
  const [error, setError]               = useState(null);

  useEffect(() => {
    if (tradeid) fetchTradeDetails(tradeid);
  }, [tradeid]);

  const fetchTradeDetails = async (tradeId) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/trades/${encodeURIComponent(tradeId)}`);
      if (!res.ok) throw new Error('Trade record not found');
      const tradeData = await res.json();
      setTrade(tradeData);

      // Derive which documents exist from the DB array
      const docs   = tradeData.documents || [];
      const rfqDoc = docs.find(d => d.type?.toUpperCase() === 'RFQ');
      const qtnDoc = docs.find(d => d.type?.toUpperCase() === 'QUOTATION');
      const recQtnDoc = docs.find(d => d.type?.toUpperCase() === 'RECEIVED_QUOTATION');
      const poDoc  = docs.find(d => d.type?.toUpperCase() === 'PURCHASE_ORDER' || d.type?.toUpperCase() === 'PO');
      const roDoc  = docs.find(d => d.type?.toUpperCase() === 'RO');
      const dnDocs = docs.filter(d => d.type?.toUpperCase() === 'DN' || d.type?.toUpperCase() === 'DELIVERY_NOTE');
      const invDocs = docs.filter(d => d.type?.toUpperCase() === 'INVOICE');

      await Promise.all([
        rfqDoc?.id ? fetchRFQ(rfqDoc.id)   : Promise.resolve(setRfq(null)),
        qtnDoc?.id ? fetchQTN(qtnDoc.id)   : Promise.resolve(setQuotation(null)),
        recQtnDoc?.id ? fetchReceivedQTN(recQtnDoc.id) : Promise.resolve(setReceivedQuotation(null)),
        poDoc?.id  ? fetchPO(poDoc.id)     : Promise.resolve(setPurchaseOrder(null)),
        roDoc?.id  ? fetchRO(roDoc.id)     : Promise.resolve(setReleaseOrder(null)),
        dnDocs.length > 0
          ? Promise.all(dnDocs.map(d => fetchDN(d.id))).then(notes => setDeliveryNotes(notes.filter(Boolean)))
          : Promise.resolve(setDeliveryNotes([])),
        invDocs.length > 0
          ? Promise.all(invDocs.map(d => fetchInvoice(d.id))).then(invs => setInvoices(invs.filter(Boolean)))
          : Promise.resolve(setInvoices([])),
      ]);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to fetch trade details');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRFQ = async (id) => {
    try {
      const res = await fetch(`/api/rfqs/${encodeURIComponent(id)}`);
      if (res.ok) setRfq(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchQTN = async (id) => {
    try {
      const res = await fetch(`/api/quotations/${encodeURIComponent(id)}`);
      if (res.ok) setQuotation(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchReceivedQTN = async (id) => {
    try {
      const res = await fetch(`/api/received-quotations/${encodeURIComponent(id)}`);
      if (res.ok) setReceivedQuotation(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchPO = async (id) => {
    try {
      const res = await fetch(`/api/purchase-orders/${encodeURIComponent(id)}`);
      if (res.ok) setPurchaseOrder(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchRO = async (id) => {
    try {
      const res = await fetch(`/api/release-orders/${encodeURIComponent(id)}`);
      if (res.ok) setReleaseOrder(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchDN = async (id) => {
    try {
      const res = await fetch(`/api/delivery-notes/${encodeURIComponent(id)}`);
      if (res.ok) return await res.json();
    } catch (err) { console.error(err); }
    return null;
  };

  const fetchInvoice = async (id) => {
    try {
      const res = await fetch(`/api/invoices/${encodeURIComponent(id)}`);
      if (res.ok) return await res.json();
    } catch (err) { console.error(err); }
    return null;
  };

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (isLoading) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="flex flex-col items-center gap-3">
        <RefreshCw className="animate-spin" size={30} style={{ color: 'var(--theme-color)' }} />
        <p className="text-sm font-semibold text-slate-500">Loading Trade Information…</p>
      </div>
    </div>
  );

  // ── Error ────────────────────────────────────────────────────────────────────
  if (error || !trade) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-8 shadow-sm text-center space-y-4">
        <AlertCircle className="mx-auto text-red-500" size={42} />
        <div>
          <h2 className="text-base font-bold text-slate-900">Error Loading Trade</h2>
          <p className="text-xs text-slate-500 mt-1">{error || 'Trade details could not be retrieved.'}</p>
        </div>
        <button onClick={() => navigate('/')}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer">
          Go to Dashboard
        </button>
      </div>
    </div>
  );

  const rawDocs = trade.documents || [];
  const seenDocs = new Set();
  const docs = [];
  for (const doc of rawDocs) {
    if (!doc.type || !doc.id) continue;
    let normType = doc.type.toUpperCase();
    if (normType === 'PURCHASE_ORDER') normType = 'PO';
    if (normType === 'DELIVERY_NOTE') normType = 'DN';
    const key = `${normType}:${doc.id}`;
    if (!seenDocs.has(key)) {
      seenDocs.add(key);
      docs.push({ ...doc, type: normType });
    }
  }

  const hasQuotationDoc = docs.some(d => d.type?.toUpperCase() === 'QUOTATION');
  const hasRecQtnDoc = docs.some(d => d.type?.toUpperCase() === 'RECEIVED_QUOTATION');
  const hasPoDoc = docs.some(d => d.type?.toUpperCase() === 'PURCHASE_ORDER' || d.type?.toUpperCase() === 'PO');
  const hasRoDoc = docs.some(d => d.type?.toUpperCase() === 'RO');

  const panels = [];

  if (rfq) {
    panels.push({
      key: 'rfq',
      label: '① RFQ',
      component: <RfqPanel rfq={rfq} tradeId={trade.trade_id} />
    });
  }

  if (hasQuotationDoc || (rfq && !hasPoDoc)) {
    panels.push({
      key: 'quotation',
      label: '② Quotation',
      component: <QuotationPanel quotation={quotation} rfq={rfq} tradeId={trade.trade_id} />
    });
  }

  if (hasRecQtnDoc) {
    panels.push({
      key: 'received_quotation',
      label: rfq ? '② Received Quotation' : '① Received Quotation',
      component: <ReceivedQuotationPanel receivedQuotation={receivedQuotation} tradeId={trade.trade_id} />
    });
  }

  if (hasPoDoc || hasQuotationDoc || hasRecQtnDoc) {
    panels.push({
      key: 'po',
      label: (rfq && hasQuotationDoc) ? '③ Purchase Order' : '② Purchase Order',
      component: <PoPanel purchaseOrder={purchaseOrder} quotation={quotation || receivedQuotation} tradeId={trade.trade_id} isBuySide={trade.trade_type === 'buy'} />
    });
  }

  const isArc = trade.trade_type === 'ARC';

  if (isArc || hasRoDoc) {
    panels.push({
      key: 'ro',
      label: '① Release Order',
      component: <RoPanel releaseOrder={releaseOrder} purchaseOrder={purchaseOrder} tradeId={trade.trade_id} />
    });
  }

  const showDelivery = isArc ? hasRoDoc : hasPoDoc;

  if (showDelivery) {
    let deliveryLabel = '③ Delivery & Invoicing';
    if (isArc) {
      deliveryLabel = '② Delivery & Invoicing';
    } else if (rfq) {
      deliveryLabel = '④ Delivery & Invoicing';
    }
    panels.push({
      key: 'delivery',
      label: deliveryLabel,
      component: <DeliveryPanel tradeId={trade.trade_id} deliveryNotes={deliveryNotes} invoices={invoices} onRefresh={() => fetchTradeDetails(trade.trade_id)} />
    });
  }

  // Map document types → labels for the pipeline tracker
  const DOC_LABELS = {
    RFQ:            'RFQ',
    QUOTATION:      'Quotation',
    RECEIVED_QUOTATION: 'Received Quotation',
    PURCHASE_ORDER: 'Purchase Order',
    PO:             'Purchase Order',
    RO:             'Release Order',
    INVOICE:        'Invoice',
    DN:             'Delivery Note',
    GRN:            'GRN',
    PAYMENT:        'Payment',
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate('/')}
              className="p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-slate-600 transition-colors cursor-pointer shrink-0">
              <ArrowLeft size={15} />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Trade Record</span>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border"
                  style={statusStyle(trade.status)}>
                  {trade.status}
                </span>
              </div>
              <h1 className="text-lg font-black text-slate-900 leading-tight">{trade.trade_id}</h1>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Document Pipeline Tracker */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
            <FileText size={12} style={{ color: 'var(--theme-color)' }} /> Trade Document Pipeline
          </p>
          {docs.length === 0 ? (
            <p className="text-xs text-slate-400 font-medium">No documents generated yet for this trade.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {docs.map((doc, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  {/* Doc badge */}
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                    <span className="font-bold text-[10px] text-slate-600 uppercase tracking-wider">
                      {DOC_LABELS[doc.type?.toUpperCase()] || doc.type}
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="font-mono text-[10px] font-bold text-slate-800">{doc.id}</span>
                  </div>
                  {/* Arrow between items */}
                  {idx < docs.length - 1 && (
                    <span className="text-slate-300 font-bold text-xs">→</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Section labels + Panels ─────────────────────────────────────── */}
        {panels.map((panel) => (
          <div key={panel.key}>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 pl-1">
              {panel.label}
            </p>
            {panel.component}
          </div>
        ))}

      </div>
    </div>
  );
}
