import React, { useState } from 'react';
import {
  FileText,
  ShoppingCart,
  Truck,
  Receipt,
  CreditCard,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  ArrowRight,
  TrendingUp,
  Package,
  Calendar,
  Building2,
  Layers,
  ArrowUpRight,
  AlertCircle
} from 'lucide-react';

// Status styles for document nodes
const getNodeStyle = (status) => {
  switch (status) {
    case 'completed':
      return {
        bg: 'bg-emerald-50 border-emerald-300 text-emerald-900',
        badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        iconBg: 'bg-emerald-600 text-white',
        line: '#059669' // emerald-600
      };
    case 'in_progress':
      return {
        bg: 'bg-amber-50 border-amber-300 text-amber-900',
        badge: 'bg-amber-100 text-amber-800 border-amber-300',
        iconBg: 'bg-amber-500 text-white',
        line: '#f59e0b' // amber-500
      };
    case 'pending':
    default:
      return {
        bg: 'bg-slate-50 border-slate-200 text-slate-400',
        badge: 'bg-slate-100 text-slate-500 border-slate-200',
        iconBg: 'bg-slate-200 text-slate-400',
        line: '#cbd5e1' // slate-300
      };
  }
};

export default function TradeSummaryGraph({
  trade,
  docs = [],
  rfq,
  quotation,
  receivedQuotation,
  processRq,
  purchaseOrder,
  releaseOrder,
  deliveryNotes = [],
  invoices = [],
  grns = [],
  payments = []
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('graph'); // 'graph' | 'timeline'
  const [hoveredNodeKey, setHoveredNodeKey] = useState(null);

  // Helper for scroll navigation to document sections
  const scrollToPanel = (key) => {
    const el = document.getElementById(`panel-${key}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // ── Financial Calculations ──────────────────────────────────────────────────
  const calculateTotalPoVal = (po) => {
    if (!po) return 0;
    const itemsBasic = (po.items || []).reduce(
      (s, i) => s + (parseFloat(i.unit_price) || 0) * (parseFloat(i.quantity) || 0),
      0
    );
    const gstTotal = parseFloat(po.gst) || 0;
    const transport = parseFloat(po.transport) || 0;
    const packing = parseFloat(po.packing_forward) || 0;
    const other = parseFloat(po.other) || 0;
    const basicVal = parseFloat(po.basic_value) || 0;
    return itemsBasic + gstTotal + transport + packing + other + basicVal;
  };

  const calculateTotalQuotationVal = (q) => {
    if (!q) return 0;
    const itemsBasic = (q.items || []).reduce(
      (s, i) => s + (parseFloat(i.unit_price) || 0) * (parseFloat(i.quantity) || 0),
      0
    );
    const tax = parseFloat(q.tax_amount || q.gst || 0);
    const basicVal = parseFloat(q.basic_value || 0);
    return itemsBasic || (basicVal + tax);
  };

  const mainOrderDoc = purchaseOrder || releaseOrder;
  const totalOrderValue = mainOrderDoc
    ? calculateTotalPoVal(mainOrderDoc)
    : (quotation ? calculateTotalQuotationVal(quotation) : (receivedQuotation ? calculateTotalQuotationVal(receivedQuotation) : 0));

  const totalInvoicedValue = invoices.reduce((sum, inv) => {
    const val = parseFloat(inv.total_amount || inv.grand_total || inv.basic_value || 0);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const totalPaidValue = payments.reduce((sum, pmt) => {
    const val = parseFloat(pmt.amount || pmt.paid_amount || 0);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  // ── Quantity & Delivery Calculations ────────────────────────────────────────
  const totalOrderedQty = (mainOrderDoc?.items || []).reduce(
    (sum, item) => sum + (parseFloat(item.quantity) || 0),
    0
  );

  const totalDeliveredQty = deliveryNotes.reduce((sum, dn) => {
    const dnQty = (dn.items || []).reduce((s, i) => s + (parseFloat(i.quantity) || 0), 0);
    return sum + dnQty;
  }, 0);

  const deliveryProgressPct = totalOrderedQty > 0
    ? Math.min(100, Math.round((totalDeliveredQty / totalOrderedQty) * 100))
    : (deliveryNotes.length > 0 ? 100 : 0);

  const paymentProgressPct = totalOrderValue > 0
    ? Math.min(100, Math.round((totalPaidValue / totalOrderValue) * 100))
    : (payments.length > 0 ? 100 : 0);

  // ── Node Definitions for Graph ──────────────────────────────────────────────
  const isProcessTrade = (trade?.trade_type || '').toUpperCase() === 'PROCESS';
  const isArcTrade = (trade?.trade_type || '').toUpperCase() === 'ARC';

  const graphNodes = [];

  // Stage 1: RFQ / Process RQ
  if (rfq || isProcessTrade || docs.some(d => d.type === 'RFQ' || d.type === 'PR' || d.type === 'RQ_PROCESS')) {
    graphNodes.push({
      key: 'rfq',
      stage: '01',
      title: isProcessTrade ? 'Process Request' : 'Request (RFQ)',
      icon: FileText,
      panelKey: isProcessTrade ? 'process_rq' : 'rfq',
      status: (rfq || processRq) ? 'completed' : 'pending',
      docId: rfq?.rfq_no || processRq?.rq_process_no || (docs.find(d => d.type === 'RFQ' || d.type === 'PR')?.id),
      details: rfq?.buyer_name || processRq?.party || 'Request specs logged',
      meta: rfq?.items ? `${rfq.items.length} items requested` : null,
      date: rfq?.created_at || processRq?.created_at
    });
  }

  // Stage 2: Quotation
  if (quotation || receivedQuotation || docs.some(d => d.type === 'QUOTATION' || d.type === 'RECEIVED_QUOTATION') || rfq) {
    const qDoc = quotation || receivedQuotation;
    const qNo = qDoc?.quotation_no || qDoc?.received_quotation_no || docs.find(d => d.type === 'QUOTATION' || d.type === 'RECEIVED_QUOTATION')?.id;
    graphNodes.push({
      key: quotation ? 'quotation' : 'received_quotation',
      stage: '02',
      title: receivedQuotation ? 'Received Quotation' : 'Sales Quotation',
      icon: ShoppingCart,
      panelKey: quotation ? 'quotation' : 'received_quotation',
      status: qDoc ? 'completed' : (graphNodes.length > 0 && graphNodes[0].status === 'completed' ? 'in_progress' : 'pending'),
      docId: qNo,
      details: qDoc?.supplier_name || qDoc?.customer_name || (totalOrderValue > 0 ? `₹${totalOrderValue.toLocaleString('en-IN')}` : 'Pricing proposal'),
      meta: qDoc?.valid_until ? `Valid: ${new Date(qDoc.valid_until).toLocaleDateString()}` : null,
      date: qDoc?.created_at
    });
  }

  // Stage 3: PO / RO
  const poDoc = purchaseOrder || releaseOrder;
  const poNo = poDoc?.po_no || poDoc?.ro_no || poDoc?.process_po_no || docs.find(d => d.type === 'PO' || d.type === 'PURCHASE_ORDER' || d.type === 'RO')?.id;
  graphNodes.push({
    key: isArcTrade ? 'ro' : 'po',
    stage: '03',
    title: isArcTrade ? 'Release Order (RO)' : 'Purchase Order (PO)',
    icon: ShoppingCart,
    panelKey: isArcTrade ? 'ro' : 'po',
    status: poDoc ? 'completed' : (graphNodes.some(n => n.status === 'completed') ? 'in_progress' : 'pending'),
    docId: poNo,
    details: poDoc?.vendor_name || poDoc?.customer_name || (totalOrderValue > 0 ? `₹${totalOrderValue.toLocaleString('en-IN')}` : 'Order committed'),
    meta: totalOrderedQty > 0 ? `${totalOrderedQty} total qty` : null,
    date: poDoc?.created_at
  });

  // Stage 4: Delivery & GRN
  const hasDN = deliveryNotes.length > 0;
  const dnCount = deliveryNotes.length;
  graphNodes.push({
    key: 'delivery',
    stage: '04',
    title: 'Goods Delivery & GRN',
    icon: Truck,
    panelKey: 'delivery',
    status: deliveryProgressPct === 100 ? 'completed' : (hasDN ? 'in_progress' : (poDoc ? 'in_progress' : 'pending')),
    docId: hasDN ? `${dnCount} Note${dnCount > 1 ? 's' : ''}` : 'Pending Dispatch',
    details: `${totalDeliveredQty} / ${totalOrderedQty || '—'} units delivered`,
    meta: `Fulfillment: ${deliveryProgressPct}%`,
    date: deliveryNotes[0]?.delivery_date || deliveryNotes[0]?.created_at
  });

  // Stage 5: Invoice
  const hasInvoices = invoices.length > 0;
  const invCount = invoices.length;
  graphNodes.push({
    key: 'invoices',
    stage: '05',
    title: 'Invoicing & Billing',
    icon: Receipt,
    panelKey: 'delivery',
    status: hasInvoices ? 'completed' : (hasDN ? 'in_progress' : 'pending'),
    docId: hasInvoices ? `${invCount} Invoice${invCount > 1 ? 's' : ''}` : 'Pending Billing',
    details: totalInvoicedValue > 0 ? `₹${totalInvoicedValue.toLocaleString('en-IN')} billed` : 'Invoice generation',
    meta: hasInvoices ? `Invoiced 100%` : null,
    date: invoices[0]?.invoice_date || invoices[0]?.created_at
  });

  // Stage 6: Payment
  const hasPayments = payments.length > 0;
  graphNodes.push({
    key: 'payments',
    stage: '06',
    title: 'Payment Settlement',
    icon: CreditCard,
    panelKey: 'payments',
    status: paymentProgressPct === 100 ? 'completed' : (hasPayments ? 'in_progress' : 'pending'),
    docId: hasPayments ? `${payments.length} Payment${payments.length > 1 ? 's' : ''}` : 'Pending Settlement',
    details: totalPaidValue > 0 ? `₹${totalPaidValue.toLocaleString('en-IN')} settled` : 'Financial clearance',
    meta: `Settled: ${paymentProgressPct}%`,
    date: payments[0]?.payment_date || payments[0]?.created_at
  });

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden transition-all duration-300">
      
      {/* ── Header Bar ────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white px-5 py-3.5 flex items-center justify-between gap-4">
        
        {/* Left: Title & Quick Status */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-[var(--theme-color)] shrink-0 shadow-inner">
            <Layers size={18} />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black tracking-wide text-white flex items-center gap-2">
                Trade Summary
              </h2>
              <span className="px-2 py-0.5 text-[9px] font-bold uppercase rounded-md bg-white/10 text-slate-200 border border-white/15">
                {trade?.trade_type || 'TRADE'}
              </span>
              <span className="px-2 py-0.5 text-[9px] font-bold uppercase rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {trade?.status || 'Active'}
              </span>
            </div>
            
            <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">
              Ref: <span className="font-mono text-slate-200 font-semibold">{trade?.trade_id}</span>
              {totalOrderValue > 0 && (
                <span className="ml-2 font-bold text-emerald-400">
                  • ₹{totalOrderValue.toLocaleString('en-IN')}
                </span>
              )}
              <span className="ml-2 text-slate-400">
                • {graphNodes.filter(n => n.status === 'completed').length} / {graphNodes.length} Stages Completed
              </span>
            </p>
          </div>
        </div>

        {/* Right: Controls & Expand Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          
          {/* View Tab Switcher (Visible when expanded) */}
          {isExpanded && (
            <div className="hidden sm:flex items-center bg-slate-800 border border-slate-700 rounded-lg p-0.5 text-[11px] font-bold">
              <button
                onClick={() => setActiveTab('graph')}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                  activeTab === 'graph'
                    ? 'bg-[var(--theme-color)] text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Graph Flow
              </button>
              <button
                onClick={() => setActiveTab('timeline')}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                  activeTab === 'timeline'
                    ? 'bg-[var(--theme-color)] text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Timeline
              </button>
            </div>
          )}

          {/* Expand / Minimize Button */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            title={isExpanded ? 'Minimize Trade Summary' : 'Expand Trade Summary'}
          >
            {isExpanded ? (
              <>
                <ChevronUp size={14} />
                <span className="hidden sm:inline">Minimize</span>
              </>
            ) : (
              <>
                <ChevronDown size={14} />
                <span className="hidden sm:inline">Expand Graph</span>
              </>
            )}
          </button>

        </div>
      </div>

      {/* ── Minimized Compact View ────────────────────────────────────────────── */}
      {!isExpanded && (
        <div className="p-4 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100">
          
          {/* Step Pipeline Pills Flow */}
          <div className="flex items-center flex-wrap gap-1.5">
            {graphNodes.map((node, idx) => {
              const style = getNodeStyle(node.status);
              return (
                <React.Fragment key={node.key}>
                  <button
                    onClick={() => {
                      setIsExpanded(true);
                      scrollToPanel(node.panelKey);
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold transition-all cursor-pointer hover:scale-105 ${style.bg}`}
                  >
                    <node.icon size={12} />
                    <span>{node.title}</span>
                    {node.docId && (
                      <span className="font-mono text-[10px] opacity-75">({node.docId})</span>
                    )}
                  </button>
                  {idx < graphNodes.length - 1 && (
                    <ArrowRight size={12} className="text-slate-300" />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Mini Stats Badges */}
          <div className="flex items-center gap-4 text-xs font-bold text-slate-600">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Delivered</span>
              <span className="text-slate-900">{deliveryProgressPct}%</span>
            </div>
            <div className="h-6 w-[1px] bg-slate-200" />
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Payment</span>
              <span className="text-slate-900">{paymentProgressPct}%</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Expanded Full View ────────────────────────────────────────────────── */}
      {isExpanded && (
        <div className="p-5 space-y-6">

          {/* 1. Summary Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            
            {/* Metric 1: Financial Value */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Trade Value</span>
                <TrendingUp size={14} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-lg font-black text-slate-900">
                  ₹{totalOrderValue > 0 ? totalOrderValue.toLocaleString('en-IN') : '—'}
                </p>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                  Billed: ₹{totalInvoicedValue.toLocaleString('en-IN')}
                </p>
              </div>
              {/* Mini progress bar */}
              <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] font-bold">
                <span className="text-slate-400">Settled: ₹{totalPaidValue.toLocaleString('en-IN')}</span>
                <span className="text-emerald-600 font-extrabold">{paymentProgressPct}%</span>
              </div>
            </div>

            {/* Metric 2: Goods Fulfillment */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Fulfillment Status</span>
                <Package size={14} className="text-blue-600" />
              </div>
              <div>
                <p className="text-lg font-black text-slate-900">
                  {deliveryProgressPct}%
                </p>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                  {totalDeliveredQty} of {totalOrderedQty || 0} units delivered
                </p>
              </div>
              {/* Fulfillment progress bar */}
              <div className="mt-2 w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${deliveryProgressPct}%` }}
                />
              </div>
            </div>

            {/* Metric 3: Active Stage */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Active Stage</span>
                <Clock size={14} className="text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-black text-slate-900 truncate capitalize">
                  {graphNodes.find(n => n.status === 'in_progress')?.title || (paymentProgressPct === 100 ? 'Completed & Settled' : 'In Progress')}
                </p>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                  {docs.length} Linked Document{docs.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-200/60 text-[10px] font-bold text-slate-400">
                Created: {trade?.created_at ? new Date(trade.created_at).toLocaleDateString() : '—'}
              </div>
            </div>

            {/* Metric 4: Documents Count */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Document Trail</span>
                <FileText size={14} style={{ color: 'var(--theme-color)' }} />
              </div>
              <div>
                <p className="text-lg font-black text-slate-900">
                  {docs.length} <span className="text-xs text-slate-400 font-semibold">Docs</span>
                </p>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5 truncate">
                  {docs.map(d => d.type).filter(Boolean).join(', ')}
                </p>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-200/60 text-[10px] font-bold text-[var(--theme-color)]">
                100% Audit Tracked
              </div>
            </div>

          </div>

          {/* 2. Interactive Graph of Trade View */}
          {activeTab === 'graph' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Layers size={13} style={{ color: 'var(--theme-color)' }} /> Interactive Trade Flow Graph
                </h3>
                <span className="text-[10px] font-bold text-slate-400">
                  Click any node to navigate to its details
                </span>
              </div>

              {/* Visual Directed Graph Container */}
              <div className="bg-slate-900/95 text-white border border-slate-800 rounded-xl p-6 relative overflow-x-auto shadow-inner">
                
                {/* Node Grid Layout */}
                <div className="flex items-center justify-between min-w-[720px] relative z-10 py-2">
                  
                  {graphNodes.map((node, index) => {
                    const style = getNodeStyle(node.status);
                    const isHovered = hoveredNodeKey === node.key;

                    return (
                      <React.Fragment key={node.key}>
                        {/* Node Item */}
                        <div
                          onMouseEnter={() => setHoveredNodeKey(node.key)}
                          onMouseLeave={() => setHoveredNodeKey(null)}
                          onClick={() => scrollToPanel(node.panelKey)}
                          className={`group relative flex flex-col items-center cursor-pointer transition-all duration-200 ${
                            isHovered ? 'scale-105 z-20' : 'z-10'
                          }`}
                        >
                          {/* Node Header Badge */}
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold shadow-lg transition-all border ${
                            node.status === 'completed'
                              ? 'bg-emerald-500 border-emerald-400 text-white shadow-emerald-500/20'
                              : (node.status === 'in_progress'
                                  ? 'bg-amber-500 border-amber-400 text-white shadow-amber-500/20 animate-pulse'
                                  : 'bg-slate-800 border-slate-700 text-slate-400')
                          }`}>
                            <node.icon size={22} />
                          </div>

                          {/* Node Step Number */}
                          <span className="mt-2 text-[9px] font-black uppercase tracking-widest text-slate-400">
                            Stage {node.stage}
                          </span>

                          {/* Node Title */}
                          <h4 className="text-xs font-bold text-slate-100 mt-0.5 text-center max-w-[110px] leading-tight">
                            {node.title}
                          </h4>

                          {/* Doc ID Pill */}
                          <div className={`mt-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors ${
                            node.status === 'completed'
                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                              : (node.status === 'in_progress'
                                  ? 'bg-amber-950/80 text-amber-300 border-amber-700/60'
                                  : 'bg-slate-800 text-slate-500 border-slate-700')
                          }`}>
                            {node.docId || '—'}
                          </div>

                          {/* Tooltip / Details on hover or always */}
                          <div className="mt-2 text-center text-[10px] text-slate-400 max-w-[120px]">
                            {node.details}
                          </div>

                          {/* Status Badge */}
                          <span className={`mt-1 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider rounded border ${
                            node.status === 'completed'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : (node.status === 'in_progress'
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                  : 'bg-slate-800 text-slate-500 border-slate-700')
                          }`}>
                            {node.status.replace('_', ' ')}
                          </span>

                          {/* Quick Navigation Indicator */}
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-1 text-[9px] font-bold text-[var(--theme-color)] flex items-center gap-0.5">
                            Jump <ArrowUpRight size={10} />
                          </div>
                        </div>

                        {/* Connected Arrow Line between nodes */}
                        {index < graphNodes.length - 1 && (
                          <div className="flex-1 flex items-center justify-center px-2 relative">
                            {/* Connecting Line */}
                            <div className={`h-[2px] w-full transition-all duration-300 ${
                              graphNodes[index].status === 'completed'
                                ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                                : (graphNodes[index].status === 'in_progress'
                                    ? 'bg-gradient-to-r from-amber-500 to-slate-700'
                                    : 'bg-slate-700 stroke-dasharray')
                            }`} />
                            {/* Directional Arrow */}
                            <ArrowRight
                              size={14}
                              className={`absolute transition-colors ${
                                graphNodes[index].status === 'completed'
                                  ? 'text-emerald-400'
                                  : 'text-slate-600'
                              }`}
                            />
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}

                </div>

              </div>
            </div>
          )}

          {/* 3. Timeline View */}
          {activeTab === 'timeline' && (
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Calendar size={13} style={{ color: 'var(--theme-color)' }} /> Chronological Trade Audit Trail
              </h3>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                {docs.length === 0 ? (
                  <p className="text-xs text-slate-400 font-medium text-center py-4">No document events registered yet.</p>
                ) : (
                  docs.map((doc, idx) => (
                    <div key={idx} className="flex items-start gap-3 bg-white border border-slate-200 rounded-lg p-3 shadow-2xs">
                      <div className="p-2 bg-slate-100 text-slate-700 rounded-lg font-bold text-xs">
                        #{idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-slate-900 uppercase tracking-wide">
                            {doc.type}
                          </span>
                          <span className="font-mono text-xs font-bold text-slate-700">
                            {doc.id}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Status: Linked to Trade <span className="font-mono font-semibold">{trade?.trade_id}</span>
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
