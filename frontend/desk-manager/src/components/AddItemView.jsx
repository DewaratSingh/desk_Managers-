import React, { useState } from 'react';
import {
  Search,
  Edit2,
  X,
  Plus,
  RefreshCw,
  ArrowLeft,
  Package,
  ListFilter
} from 'lucide-react';

const EMPTY_FORM = {
  item_code: '',
  description: '',
  drawing_number: '',
  long_description: ''
};

export default function AddItemView({
  items,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  isLoading,
  error
}) {
  // viewMode: 'list' (default) | 'form'
  const [viewMode, setViewMode] = useState('list');

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingCode, setEditingCode] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  // Track which items have their long description expanded
  const [expandedItems, setExpandedItems] = useState(new Set());

  const toggleExpand = (item_code) =>
    setExpandedItems((prev) => {
      const next = new Set(prev);
      next.has(item_code) ? next.delete(item_code) : next.add(item_code);
      return next;
    });

  const set = (field) => (e) =>
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  /* ── Navigation helpers ── */
  const handleOpenAddForm = () => {
    setEditingCode(null);
    setFormData(EMPTY_FORM);
    setViewMode('form');
  };

  const handleEditClick = (item) => {
    setEditingCode(item.item_code);
    setFormData({
      item_code: item.item_code || '',
      description: item.description || '',
      drawing_number: item.drawing_number || '',
      long_description: item.long_description || ''
    });
    setViewMode('form');
  };

  const handleBackToDirectory = () => {
    setEditingCode(null);
    setFormData(EMPTY_FORM);
    setViewMode('list');
  };

  /* ── Submit ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.item_code.trim() || !formData.description.trim()) return;

    if (editingCode) {
      // item_code is immutable — only send editable fields
      const success = await onUpdateItem(editingCode, {
        description: formData.description,
        drawing_number: formData.drawing_number,
        long_description: formData.long_description
      });
      if (success) handleBackToDirectory();
    } else {
      const success = await onAddItem(formData);
      if (success) setFormData(EMPTY_FORM); // stay on form, clear inputs
    }
  };

  /* ── Filter ── */
  const filteredItems = items.filter((item) => {
    const q = searchQuery.toLowerCase();
    return (
      (item.item_code && item.item_code.toLowerCase().includes(q)) ||
      (item.description && item.description.toLowerCase().includes(q)) ||
      (item.drawing_number && item.drawing_number.toLowerCase().includes(q)) ||
      (item.long_description && item.long_description.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex-1 p-4 sm:p-8 lg:p-10 bg-[#f1f5f9] max-w-5xl mx-auto w-full text-slate-900">

      {/* ================================================================
          VIEW MODE: LIST (default)
         ================================================================ */}
      {viewMode === 'list' ? (
        <div className="space-y-6">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 m-0">
                Item Catalog
              </h1>
              <p className="text-base text-slate-500 mt-1 font-medium">
                Browse, search, and manage catalog items with drawing references.
              </p>
            </div>
            <button
              onClick={handleOpenAddForm}
              className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm self-start sm:self-auto"
            >
              <Plus size={20} />
              Add New Item
            </button>
          </div>

          

          {/* Search */}
          <div className="flex items-center gap-3 border-2 border-slate-200 rounded-xl px-4 py-4 bg-white shadow-sm">
            <Search size={22} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search by item code, description, or drawing number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent focus:outline-none text-lg text-slate-900 placeholder:text-slate-400 font-semibold"
            />
          </div>

          {/* Directory */}
          <div className="border-2 border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <span className="text-sm font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <ListFilter size={16} className="text-blue-600" />
                Item Directory ({filteredItems.length})
              </span>
            </div>

            {filteredItems.length === 0 ? (
              <div className="p-16 text-center text-slate-400 text-lg font-semibold bg-white">
                No items in catalog. Click "+ Add New Item" to get started.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {filteredItems.map((item) => {
                  const isExpanded = expandedItems.has(item.item_code);
                  const longLines = item.long_description
                    ? item.long_description.split(/\n/)
                    : [];
                  const visibleText = isExpanded
                    ? longLines.join('\n')
                    : longLines.slice(0, 2).join('\n') + (longLines.length > 2 ? '…' : '');

                  return (
                    <div
                      key={item.item_code}
                      style={{
                        padding: '20px 24px',
                        display: 'flex',
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '24px',
                        borderBottom: '1px solid #e2e8f0',
                        backgroundColor: 'white',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}
                    >
                      {/* Info block */}
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>

                        {/* Item Code */}
                        <div style={{ fontSize: '14px', color: '#374151' }}>
                          <span style={{ color: '#6b7280' }}>Item Code: </span>
                          {item.item_code}
                        </div>

                        {/* Drawing Number */}
                        {item.drawing_number && (
                          <div style={{ fontSize: '14px', color: '#374151' }}>
                            <span style={{ color: '#6b7280' }}>Drawing Number: </span>
                            {item.drawing_number}
                          </div>
                        )}

                        {/* Description */}
                        <div style={{ fontSize: '14px', color: '#374151' }}>
                          <span style={{ color: '#6b7280' }}>Description: </span>
                          {item.description}
                        </div>

                        {/* Long Description — no box, plain label:value */}
                        {longLines.length > 0 && (
                          <div style={{ fontSize: '14px', color: '#374151' }}>
                            <span style={{ color: '#6b7280' }}>Long Description: </span>
                            <span style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                              {visibleText}
                            </span>
                            {longLines.length > 2 && (
                              <button
                                onClick={() => toggleExpand(item.item_code)}
                                style={{
                                  marginLeft: '6px',
                                  fontSize: '12px',
                                  color: '#111827',
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  cursor: 'pointer',
                                  textDecoration: 'underline',
                                }}
                              >
                                {isExpanded ? 'Show less' : 'Show more'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Update button */}
                      <button
                        onClick={() => handleEditClick(item)}
                        style={{
                          flexShrink: 0,
                          padding: '8px 18px',
                          fontSize: '13px',
                          fontWeight: '600',
                          color: '#374151',
                          background: 'white',
                          border: '2px solid #e2e8f0',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'border-color 0.15s, color 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.color = '#2563eb'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#374151'; }}
                      >
                        <Edit2 size={13} /> Update Record
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      ) : (

        /* ================================================================
            VIEW MODE: FULL PAGE FORM
           ================================================================ */
        <div className="space-y-6">

          {/* Header with Back */}
          <div className="pb-4 border-b border-slate-200">
            <button
              onClick={handleBackToDirectory}
              className="mb-4 text-sm font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer bg-slate-200 hover:bg-slate-300 px-4 py-2 rounded-lg transition-colors self-start"
            >
              <ArrowLeft size={16} />
              Back to Directory
            </button>
            <h1 className="text-3xl font-extrabold text-slate-900 m-0">
              {editingCode ? 'Modify Item Record' : 'Add New Item'}
            </h1>
            <p className="text-base text-slate-500 mt-1 font-medium">
              {editingCode
                ? 'Update the details of an existing catalog item.'
                : 'Register a new item with its code and drawing reference.'}
            </p>
          </div>

          

          <div className="bg-white border-2 border-slate-200 rounded-xl p-5 sm:p-8 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-5">

                {/* Item Code */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider">
                    Item Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ITM-2024-001"
                    value={formData.item_code}
                    onChange={set('item_code')}
                    disabled={!!editingCode}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-base text-slate-900 focus:outline-none focus:border-blue-600 placeholder:text-slate-400 font-medium disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                  />
                  {editingCode && (
                    <p className="text-[11px] text-slate-400 font-semibold mt-1.5 pl-1">
                      Item code cannot be changed after creation.
                    </p>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider">
                    Description *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Stainless Steel Bracket 50mm"
                    value={formData.description}
                    onChange={set('description')}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-base text-slate-900 focus:outline-none focus:border-blue-600 placeholder:text-slate-400 font-medium"
                  />
                </div>

                {/* Drawing Number */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider">
                    Drawing Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. DRW-2024-SS-050"
                    value={formData.drawing_number}
                    onChange={set('drawing_number')}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-base text-slate-900 focus:outline-none focus:border-blue-600 placeholder:text-slate-400 font-medium"
                  />
                </div>

                {/* Long Description */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider">
                    Long Description
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Detailed specifications, material grades, tolerances, notes…"
                    value={formData.long_description}
                    onChange={set('long_description')}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-base text-slate-900 focus:outline-none focus:border-blue-600 placeholder:text-slate-400 font-medium resize-none"
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-4">
                <button
                  type="button"
                  onClick={handleBackToDirectory}
                  className="px-6 py-4 border-2 border-slate-200 hover:border-slate-300 rounded-lg font-bold text-base uppercase text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`px-10 py-4 rounded-lg font-bold text-base uppercase tracking-wider text-white transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed
                    ${editingCode ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  {isLoading ? (
                    'Processing...'
                  ) : editingCode ? (
                    <><RefreshCw size={18} className="animate-spin" /> Update Details</>
                  ) : (
                    <><Plus size={18} /> Add Item</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
