import React, { useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Printer, ArrowLeft } from 'lucide-react';
import logoImg from '../assets/image.jpeg';

export default function InvoiceDetailView({ invoices = [] }) {
  const { invoice_no } = useParams();
  const navigate = useNavigate();
  const printRef = useRef(null);

  const inv = invoices.find(
    (n) => n.invoice_no === decodeURIComponent(invoice_no)
  );

  if (!inv) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
        <p className="text-xl font-bold text-slate-400">Invoice not found.</p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
        >
          Back Home
        </button>
      </div>
    );
  }

  const fmtDate = (d) => {
    if (!d) return '—';
    if (typeof d === 'string' && d.match(/^\d{4}-\d{2}-\d{2}/)) {
      const p = d.substring(0, 10).split('-');
      return `${p[2]}/${p[1]}/${p[0]}`;
    }
    const dt = new Date(d);
    return isNaN(dt) ? d : dt.toLocaleDateString('en-GB');
  };

  const total = (inv.items || []).reduce(
    (sum, i) => sum + (parseFloat(i.quantity) || 0) * (parseFloat(i.rate_per_piece) || 0),
    0
  );

  return (
    <div className="flex-1 bg-slate-100 min-h-screen p-4 sm:p-8 lg:p-12 overflow-y-auto">
      {/* Control Bar */}
      <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between print:hidden">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:text-slate-900 font-bold transition-all shadow-sm cursor-pointer"
        >
          <ArrowLeft size={18} />
          Back
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all shadow-md cursor-pointer"
        >
          <Printer size={18} />
          Print Invoice
        </button>
      </div>

      {/* Invoice Document */}
      <div
        ref={printRef}
        className="max-w-4xl mx-auto bg-white shadow-xl rounded-xl overflow-hidden print:shadow-none print:rounded-none border border-slate-200"
      >
        <div className="p-8 sm:p-12 space-y-8">

          {/* Document Header */}
          <div className="flex justify-between items-start border-b-4 border-slate-900 pb-8">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <img src={logoImg} alt="Logo" className="w-16 h-16 object-contain rounded-xl" />
                <div>
                  <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none uppercase">
                    Shreeji Industries
                  </h1>
                  <p className="text-xs font-black text-blue-600 uppercase tracking-[0.2em] mt-1">
                    Manufacturer &amp; Trader
                  </p>
                </div>
              </div>
              <div className="text-xs font-bold text-slate-500 max-w-xs space-y-1">
                <p>G-2, Plot No. 45, Sector-5, IMT Manesar,</p>
                <p>Gurgaon, Haryana - 122050</p>
                <p>Phone: +91 9999999999 | Email: info@shreeji.com</p>
              </div>
            </div>
            <div className="text-right space-y-2">
              <div className="bg-slate-900 text-white px-6 py-2 rounded-lg font-black text-xl uppercase tracking-widest inline-block">
                Invoice
              </div>
              <div className="space-y-1">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Invoice No</p>
                <p className="text-lg font-mono font-black text-slate-900">{inv.invoice_no}</p>
              </div>
            </div>
          </div>

          {/* Transaction Info Grid */}
          <div className="grid grid-cols-2 gap-8 border-b border-slate-100 pb-8">
            <div className="space-y-4">
              <div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">
                  Bill To
                </h3>
                <div className="space-y-1">
                  <p className="text-base font-black text-slate-900">{inv.customer_name || '—'}</p>
                  <p className="text-xs font-bold text-slate-500 whitespace-pre-line leading-relaxed">
                    {inv.customer_address || 'Address not provided'}
                  </p>
                  <p className="text-xs font-bold text-slate-700 mt-2">ID: {inv.customer_id || '—'}</p>
                </div>
              </div>
            </div>
            <div className="space-y-4 text-right">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Invoice Date</span>
                <span className="text-sm font-black text-slate-900">{fmtDate(inv.invoice_date)}</span>

                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Delivery Note</span>
                <span className="text-sm font-mono font-black text-slate-900">{inv.delivery_note_no || '—'}</span>

                {(inv.po_no || inv.ro_no) && (
                  <>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Order Ref</span>
                    <span className="text-sm font-mono font-black text-slate-900">
                      {inv.po_no ? `PO: ${inv.po_no}` : `RO: ${inv.ro_no}`}
                    </span>
                  </>
                )}

                {inv.dispatch_doc_no && (
                  <>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dispatch No</span>
                    <span className="text-sm font-black text-slate-900">{inv.dispatch_doc_no}</span>
                  </>
                )}

                {inv.dispatch_through && (
                  <>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Through</span>
                    <span className="text-sm font-black text-slate-900">{inv.dispatch_through}</span>
                  </>
                )}

                {inv.motor_vehicle_no && (
                  <>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vehicle No</span>
                    <span className="text-sm font-black text-slate-900 uppercase">{inv.motor_vehicle_no}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="overflow-hidden border-2 border-slate-900 rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest w-16">Sl No</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Description of Goods</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-center w-32">Quantity</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-right w-40">Rate/Piece</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-right w-40">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(inv.items || []).map((item, index) => {
                  const qty  = parseFloat(item.quantity)      || 0;
                  const rate = parseFloat(item.rate_per_piece) || 0;
                  const amt  = qty * rate;
                  return (
                    <tr key={index} className="text-slate-800">
                      <td className="px-6 py-5 text-sm font-bold align-top text-slate-400">{index + 1}</td>
                      <td className="px-6 py-5 align-top">
                        <div className="space-y-1">
                          <p className="text-sm font-black text-slate-900 uppercase">{item.item_code}</p>
                          <p className="text-xs font-bold text-slate-500 leading-relaxed">{item.description}</p>
                          {item.drawing_number && (
                            <p className="text-[10px] font-black text-blue-600 uppercase mt-1">
                              DRW NO: {item.drawing_number}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-sm font-black text-center align-top">{qty}</td>
                      <td className="px-6 py-5 text-sm font-bold text-right align-top">
                        ₹{rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-5 text-sm font-black text-right align-top text-slate-900">
                        ₹{amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-900 bg-slate-50">
                  <td colSpan={4} className="px-6 py-4 text-sm font-black text-right text-slate-700 uppercase tracking-wider">
                    Total
                  </td>
                  <td className="px-6 py-4 text-base font-black text-right text-slate-900">
                    ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Footer */}
          <div className="pt-12 grid grid-cols-2 gap-12">
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Terms &amp; Declaration
                </p>
                <ul className="text-[10px] font-bold text-slate-500 space-y-1 list-disc pl-4 leading-relaxed">
                  <li>Goods once sold will not be taken back.</li>
                  <li>Subject to Gurgaon Jurisdiction.</li>
                  <li>Payment due within 30 days of invoice date.</li>
                  <li>E. &amp; O.E.</li>
                </ul>
              </div>
            </div>
            <div className="flex flex-col items-end justify-between">
              <div className="text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-16">
                  For Shreeji Industries
                </p>
                <div className="w-48 border-t-2 border-slate-900 pt-2 font-black text-xs uppercase text-slate-900">
                  Authorized Signatory
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
