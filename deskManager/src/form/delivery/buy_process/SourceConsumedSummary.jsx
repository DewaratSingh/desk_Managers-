import React from 'react';

export default function SourceConsumedSummary({ sourceItems = [] }) {
  if (!Array.isArray(sourceItems) || sourceItems.length === 0) return null;

  return (
    <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-3 space-y-1.5 shadow-2xs">
      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
        Source Consumed Summary
      </span>
      <div className="flex flex-wrap gap-1.5 mt-1">
        {sourceItems.map((src, i) => {
          const itemPrice =
            src.unit_price !== undefined && src.unit_price !== null && src.unit_price !== ''
              ? src.unit_price
              : src.price !== undefined && src.price !== null
              ? src.price
              : null;

          return (
            <span
              key={i}
              className="bg-amber-50 text-amber-950 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 shadow-2xs"
            >
              <span className="text-amber-900">{src.item_code}</span>
              <span className="text-amber-700">(Qty: {src.qty || 0}</span>
              {itemPrice !== null && (
                <>
                  <span className="text-slate-400 font-medium">•</span>
                  <span className="text-emerald-700 font-bold">
                    ₹{parseFloat(itemPrice || 0).toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </span>
                </>
              )}
              <span className="text-amber-700">)</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
