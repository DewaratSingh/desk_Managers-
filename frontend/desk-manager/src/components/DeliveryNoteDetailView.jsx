import React, { useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Printer, ArrowLeft } from 'lucide-react';
import logoImg from '../assets/image.jpeg';

export default function DeliveryNoteDetailView({ deliveryNotes = [] }) {
  const { delivery_note_no } = useParams();
  const navigate = useNavigate();
  const printRef = useRef(null);

  const dn = deliveryNotes.find(n => n.delivery_note_no === decodeURIComponent(delivery_note_no));

  if (!dn) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
        <p className="text-xl font-bold text-slate-400">Delivery Note not found.</p>
        <button onClick={() => navigate('/')} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded">Back Home</button>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  const fmtDate = (d) => {
    if (!d) return '—';
    const dt = new Date(d);
    return dt.toLocaleDateString('en-GB');
  };

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
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all shadow-md cursor-pointer"
          >
            <Printer size={18} />
            Print Note
          </button>
        </div>
      </div>

      {/* Delivery Note Document */}
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
                  <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none uppercase">Shreeji Industries</h1>
                  <p className="text-xs font-black text-blue-600 uppercase tracking-[0.2em] mt-1">Manufacturer & Trader</p>
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
                Delivery Note
              </div>
              <div className="space-y-1">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Document No</p>
                <p className="text-lg font-mono font-black text-slate-900">{dn.delivery_note_no}</p>
              </div>
            </div>
          </div>

          {/* Transaction Info Grid */}
          <div className="grid grid-cols-2 gap-8 border-b border-slate-100 pb-8">
            <div className="space-y-4">
              <div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Consignee (Deliver To)</h3>
                <div className="space-y-1">
                  <p className="text-base font-black text-slate-900">{dn.customer_name || '—'}</p>
                  <p className="text-xs font-bold text-slate-500 whitespace-pre-line leading-relaxed">
                    {dn.customer_address || 'Address not provided'}
                  </p>
                  <p className="text-xs font-bold text-slate-700 mt-2">ID: {dn.customer_id || '—'}</p>
                </div>
              </div>
            </div>
            <div className="space-y-4 text-right">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</span>
                <span className="text-sm font-black text-slate-900">{fmtDate(dn.delivery_date)}</span>
                
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Order Reference</span>
                <span className="text-sm font-mono font-black text-slate-900">{dn.po_no || dn.ro_no || '—'} ({dn.po_no ? 'PO' : 'RO'})</span>

                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dispatch No</span>
                <span className="text-sm font-black text-slate-900">{dn.dispatch_doc_no || '—'}</span>

                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Through</span>
                <span className="text-sm font-black text-slate-900">{dn.dispatch_through || '—'}</span>

                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vehicle No</span>
                <span className="text-sm font-black text-slate-900 uppercase">{dn.motor_vehicle_no || '—'}</span>
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
                {dn.items.map((item, index) => {
                  const qty = parseFloat(item.quantity) || 0;
                  const rate = parseFloat(item.rate_per_piece) || 0;
                  const total = qty * rate;
                  return (
                    <tr key={index} className="text-slate-800">
                      <td className="px-6 py-5 text-sm font-bold align-top text-slate-400">{index + 1}</td>
                      <td className="px-6 py-5 align-top">
                        <div className="space-y-1">
                          <p className="text-sm font-black text-slate-900 uppercase">{item.item_code}</p>
                          <p className="text-xs font-bold text-slate-500 leading-relaxed">{item.description}</p>
                          {item.drawing_number && (
                            <p className="text-[10px] font-black text-blue-600 uppercase mt-1">DRW NO: {item.drawing_number}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-sm font-black text-center align-top">{qty}</td>
                      <td className="px-6 py-5 text-sm font-bold text-right align-top">₹{rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-5 text-sm font-black text-right align-top text-slate-900">₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer Info */}
          <div className="pt-12 grid grid-cols-2 gap-12">
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Terms & Declaration</p>
                <ul className="text-[10px] font-bold text-slate-500 space-y-1 list-disc pl-4 leading-relaxed">
                  <li>Goods once sold will not be taken back.</li>
                  <li>Subject to Gurgaon Jurisdiction.</li>
                  <li>Material received in good condition and as per specification.</li>
                </ul>
              </div>
            </div>
            <div className="flex flex-col items-end justify-between">
              <div className="text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-16">Receiver's Signature</p>
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
