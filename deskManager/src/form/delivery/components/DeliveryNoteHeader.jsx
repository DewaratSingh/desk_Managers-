import React from 'react';

const labelCls = "block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider";
const inputCls = "w-full px-2 py-1 bg-[white] border border-slate-300 rounded text-xs placeholder:text-slate-400 font-semibold focus:outline-none transition-colors duration-150 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed";

export default function DeliveryNoteHeader({ formData, onChange, editingNo, tradeId }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <div>
        <label className={labelCls}>
          Delivery Note No <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="delivery_note_no"
          value={formData.delivery_note_no || ''}
          onChange={onChange}
          disabled={Boolean(editingNo)}
          onFocus={(e) => { e.target.style.borderColor = 'var(--theme-color)'; }}
          onBlur={(e) => { e.target.style.borderColor = 'rgb(203, 213, 225)'; }}
          className={inputCls}
          placeholder="e.g. DN-2026-0001"
          required
        />
      </div>

      <div>
        <label className={labelCls}>
          Delivery Date <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          name="delivery_date"
          value={formData.delivery_date || ''}
          onChange={onChange}
          onFocus={(e) => { e.target.style.borderColor = 'var(--theme-color)'; }}
          onBlur={(e) => { e.target.style.borderColor = 'rgb(203, 213, 225)'; }}
          className={inputCls}
          required
        />
      </div>

      <div>
        <label className={labelCls}>
          Dispatch Through <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="dispatch_through"
          value={formData.dispatch_through || ''}
          onChange={onChange}
          onFocus={(e) => { e.target.style.borderColor = 'var(--theme-color)'; }}
          onBlur={(e) => { e.target.style.borderColor = 'rgb(203, 213, 225)'; }}
          className={inputCls}
          placeholder="e.g. Road, VRL Logistics"
          required
        />
      </div>

      <div>
        <label className={labelCls}>Dispatch Doc No (Optional)</label>
        <input
          type="text"
          name="dispatch_doc_no"
          value={formData.dispatch_doc_no || ''}
          onChange={onChange}
          onFocus={(e) => { e.target.style.borderColor = 'var(--theme-color)'; }}
          onBlur={(e) => { e.target.style.borderColor = 'rgb(203, 213, 225)'; }}
          className={inputCls}
          placeholder="e.g. L.R. No. 493810"
        />
      </div>

      <div>
        <label className={labelCls}>
          Motor Vehicle No <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="motor_vehicle_no"
          value={formData.motor_vehicle_no || ''}
          onChange={onChange}
          onFocus={(e) => { e.target.style.borderColor = 'var(--theme-color)'; }}
          onBlur={(e) => { e.target.style.borderColor = 'rgb(203, 213, 225)'; }}
          className={inputCls}
          placeholder="e.g. MH-12-PQ-1234"
          required
        />
      </div>

      <div className="flex flex-col justify-center">
        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Ref Trade ID</span>
        <span className="text-xs font-bold text-slate-800 font-mono mt-0.5">{tradeId || '—'}</span>
      </div>
    </div>
  );
}
