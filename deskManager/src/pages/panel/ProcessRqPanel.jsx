import { Cpu, List, ArrowRight } from 'lucide-react';

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function ProcessRqPanel({ processRq, tradeId }) {
  if (!processRq) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
          <Cpu size={14} className="text-indigo-600" />
          Process Trade Request (RQ_Process)
        </span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded">
            {processRq.rq_process_no}
          </span>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Meta Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pb-5 border-b border-slate-100">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Date</p>
            <p className="text-sm font-bold text-slate-900">{fmtDate(processRq.date)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Seller / Processor</p>
            <p className="text-sm font-bold text-slate-900">{processRq.seller || '—'}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Party / Client</p>
            <p className="text-sm font-bold text-slate-900">{processRq.party || '—'}</p>
          </div>
        </div>

        {/* Note / Message */}
        {processRq.message && (
          <div className="pb-5 border-b border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Process Note / Message</p>
            <p className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3">
              {processRq.message}
            </p>
          </div>
        )}

        {/* Items Table */}
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-2">
            <List size={12} /> Processed Item Mappings ({(processRq.items || []).length})
          </p>
          <div className="border border-slate-200 rounded-xl overflow-x-auto">
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
              <tbody className="divide-y divide-slate-100 bg-white font-semibold text-slate-800">
                {(processRq.items || []).map((item, idx) => (
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
                {(processRq.items || []).length === 0 && (
                  <tr>
                    <td colSpan="7" className="px-4 py-6 text-center text-slate-400 text-xs font-medium">
                      No process items mapped.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
