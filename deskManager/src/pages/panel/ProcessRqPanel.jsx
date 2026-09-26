import { Cpu, List, ArrowRight, Layers, Package, Calendar, User, Building2 } from 'lucide-react';

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function ProcessRqPanel({ processRq, tradeId }) {
  if (!processRq) return null;

  const sourceItems = processRq.source_items || [];
  const targetItems = processRq.target_items || [];
  const legacyItems = processRq.items || [];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl text-white shadow-2xs" style={{ backgroundColor: 'var(--theme-color)' }}>
            <Cpu size={16} />
          </div>
          <div>
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider block">
              R Quotation (Process RQ)
            </span>
            <span className="text-[10px] text-slate-500 font-medium">Process Trade Request & Conversion Details</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-xl shadow-2xs">
            {processRq.rq_process_no}
          </span>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Meta Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pb-5 border-b border-slate-100 text-xs">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
              <Calendar size={11} /> Date
            </p>
            <p className="text-sm font-bold text-slate-900">{fmtDate(processRq.date)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
              <User size={11} /> Seller / Processor
            </p>
            <p className="text-sm font-bold text-slate-900">{processRq.seller || '—'}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
              <Building2 size={11} /> Party / Client
            </p>
            <p className="text-sm font-bold text-slate-900">{processRq.party || '—'}</p>
          </div>
        </div>

        {/* Note / Message */}
        {processRq.message && (
          <div className="pb-5 border-b border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Process Note / Message</p>
            <p className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3">
              {processRq.message}
            </p>
          </div>
        )}

        {/* 1. SOURCE RAW MATERIALS SECTION */}
        {sourceItems.length > 0 && (
          <div className="border border-amber-200 rounded-2xl bg-amber-50/30 p-5 space-y-3 shadow-2xs">
            <div className="flex items-center gap-2 border-b border-amber-200/70 pb-2">
              <Layers size={16} className="text-amber-600" />
              <h3 className="text-xs font-black text-amber-950 uppercase tracking-wider m-0">
                Source Raw Materials Consumed ({sourceItems.length})
              </h3>
            </div>
            <div className="space-y-2">
              {sourceItems.map((src, idx) => (
                <div key={idx} className="bg-white border border-amber-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                  <div className="space-y-0.5 flex-1">
                    <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                      <span className="font-mono text-xs px-2 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-900">
                        {src.item_code || '—'}
                      </span>
                      {src.trace_item_id && (
                        <span className="text-[9px] font-mono font-bold text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded">
                          TR-{src.trace_item_id}
                        </span>
                      )}
                    </div>
                    {src.description && <div className="text-[10px] text-slate-500">{src.description}</div>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Qty:</span>
                    <span className="text-xs font-mono font-bold text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-lg shadow-2xs">
                      {src.qty || 0}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. TARGET OUTPUT PRODUCTS SECTION */}
        {targetItems.length > 0 && (
          <div className="border border-emerald-200 rounded-2xl bg-emerald-50/30 p-5 space-y-3 shadow-2xs">
            <div className="flex items-center gap-2 border-b border-emerald-200/70 pb-2">
              <Package size={16} className="text-emerald-600" />
              <h3 className="text-xs font-black text-emerald-950 uppercase tracking-wider m-0">
                Target Output Products Produced ({targetItems.length})
              </h3>
            </div>
            <div className="space-y-2">
              {targetItems.map((tgt, idx) => (
                <div key={idx} className="bg-white border border-emerald-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                  <div className="space-y-0.5 flex-1">
                    <div className="font-bold text-slate-900 text-xs">
                      <span className="font-mono text-xs px-2 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-900">
                        {tgt.item_code || '—'}
                      </span>
                    </div>
                    {tgt.description && <div className="text-[10px] text-slate-500">{tgt.description}</div>}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Target Qty:</span>
                      <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg shadow-2xs">
                        {tgt.qty || 0}
                      </span>
                    </div>
                    {tgt.price !== undefined && tgt.price !== null && parseFloat(tgt.price) > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Price:</span>
                        <span className="text-xs font-mono font-bold text-slate-800 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg shadow-2xs">
                          ₹{parseFloat(tgt.price).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LEGACY ITEMS MAPPING TABLE */}
        {legacyItems.length > 0 && sourceItems.length === 0 && targetItems.length === 0 && (
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-2">
              <List size={12} /> Processed Item Mappings ({legacyItems.length})
            </p>
            <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white shadow-2xs">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="px-4 py-2.5">Source Item Code</th>
                    <th className="px-4 py-2.5">Source Description</th>
                    <th className="px-4 py-2.5 text-right w-24">Source Qty</th>
                    <th className="px-3 py-2.5 text-center w-10"></th>
                    <th className="px-4 py-2.5">Target Item Code</th>
                    <th className="px-4 py-2.5">Target Description</th>
                    <th className="px-4 py-2.5 text-right w-24">Target Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                  {legacyItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-800">
                          {item.source_item_code || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <div>{item.source_description || '—'}</div>
                        {item.source_drawing_number && (
                          <div className="text-[9px] text-slate-400 font-bold">DWG: {item.source_drawing_number}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-black text-slate-900">
                        {item.source_item_quantity}
                      </td>

                      <td className="px-3 py-3 text-center text-slate-400">
                        <ArrowRight size={14} className="mx-auto text-indigo-500" />
                      </td>

                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded border border-indigo-200 bg-indigo-50 text-indigo-800">
                          {item.target_item_code || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <div>{item.target_description || '—'}</div>
                        {item.target_drawing_number && (
                          <div className="text-[9px] text-slate-400 font-bold">DWG: {item.target_drawing_number}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-black text-indigo-700">
                        {item.target_item_quantity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
