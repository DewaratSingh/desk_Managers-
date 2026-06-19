import { useState, useEffect } from 'react';
import {
  Search,
  Edit2,
  Plus,
  RefreshCw,
  ArrowLeft,
  ListFilter
} from 'lucide-react';

const EMPTY_FORM = {
  item_code: '',
  description: '',
  drawing_number: '',
  long_description: ''
};

export default function AddItemView({
  items: propsItems,
  onAddItem,
  onUpdateItem,
  forceFormOpen,
  onClearForceFormOpen,
  isLoading: propsIsLoading = false,
  searchResource,
  onCancel
}) {
  const [viewMode, setViewMode] = useState('list');
  const [localItems, setLocalItems] = useState([]);
  const items = propsItems || localItems;
  const [searchFocused, setSearchFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(propsIsLoading);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingCode, setEditingCode] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setIsLoading(propsIsLoading);
  }, [propsIsLoading]);

  useEffect(() => {
    if (!propsItems) {
      const delayDebounceFn = setTimeout(() => {
        fetchItems(false, searchQuery);
      }, 300);
      return () => clearTimeout(delayDebounceFn);
    }
  }, [searchQuery, propsItems]);

  const fetchItems = async (isLoadMore = false, searchVal = searchQuery) => {
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    try {
      const currentOffset = isLoadMore ? items.length : 0;
      const res = await fetch(`/api/items?limit=20&offset=${currentOffset}&q=${encodeURIComponent(searchVal || '')}`);
      if (res.ok) {
        const data = await res.json();
        if (isLoadMore) {
          setLocalItems(prev => [...prev, ...data]);
        } else {
          setLocalItems(data);
        }
        if (data.length < 20) {
          setHasMore(false);
        } else {
          setHasMore(true);
        }
      }
    } catch (err) {
      console.error('Failed to fetch items:', err);
    } finally {
      setIsLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (forceFormOpen) {
      setEditingCode(null);
      setFormData(EMPTY_FORM);
      setViewMode('form');
      if (onClearForceFormOpen) onClearForceFormOpen();
    }
  }, [forceFormOpen]);

  // Controlled parent search ignored when using local state pagination

  const [expandedItems, setExpandedItems] = useState(new Set());

  const toggleExpand = (item_code) =>
    setExpandedItems((prev) => {
      const next = new Set(prev);
      next.has(item_code) ? next.delete(item_code) : next.add(item_code);
      return next;
    });

  const set = (field) => (e) =>
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));

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
    if (onCancel) {
      onCancel(() => setViewMode('list'));
    } else {
      setViewMode('list');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.item_code.trim() || !formData.description.trim()) return;

    setIsLoading(true);
    try {
      if (editingCode) {
        if (onUpdateItem) {
          const success = await onUpdateItem(editingCode, {
            description: formData.description,
            drawing_number: formData.drawing_number,
            long_description: formData.long_description
          });
          if (success) handleBackToDirectory();
        } else {
          const res = await fetch(`/api/items/${editingCode}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              description: formData.description,
              drawing_number: formData.drawing_number,
              long_description: formData.long_description
            })
          });
          if (res.ok) {
            const updated = await res.json();
            setLocalItems(localItems.map(item => item.item_code === editingCode ? updated : item));
            handleBackToDirectory();
          } else {
            const errData = await res.json();
            alert(errData.error || 'Failed to update item');
          }
        }
      } else {
        if (onAddItem) {
          const success = await onAddItem(formData);
          if (success) setFormData(EMPTY_FORM);
        } else {
          const res = await fetch('/api/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
          });
          if (res.ok) {
            const created = await res.json();
            setLocalItems([created, ...localItems]);
            setFormData(EMPTY_FORM);
            setViewMode('list');
          } else {
            const errData = await res.json();
            alert(errData.error || 'Failed to create item');
          }
        }
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred while saving item');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredItems = items;

  return (
    <div className="flex-1 p-6 bg-slate-100 text-slate-900">
      {viewMode === 'list' ? (
        <div className="max-w-4xl mx-auto space-y-5">
          {/* Header */}
          <div className="flex justify-between items-center pb-4 border-b border-slate-300">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 m-0">Item Catalog</h1>
              <p className="text-xs text-slate-500 mt-1">
                Browse and manage catalog items with drawing references.
              </p>
            </div>
            <button
              onClick={handleOpenAddForm}
              className="px-4 py-2 text-white font-semibold text-sm rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
              style={{ backgroundColor: 'var(--theme-color)' }}
              onMouseEnter={(e) => e.target.style.filter = 'brightness(0.9)'}
              onMouseLeave={(e) => e.target.style.filter = 'none'}
            >
              <Plus size={16} />
              Add Item
            </button>
          </div>

          {/* Search */}
          <div 
            className="flex items-center gap-2.5 border border-slate-300 rounded-lg px-3 py-2 bg-white shadow-sm transition-colors"
            style={{ borderColor: searchFocused ? 'var(--theme-color)' : 'rgb(203, 213, 225)' }}
          >
            <Search size={18} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search by item code, description, or drawing..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="w-full bg-transparent focus:outline-none text-sm text-slate-900 placeholder:text-slate-400 font-medium"
            />
          </div>

          {/* Directory */}
          <div className="border border-slate-300 rounded-lg overflow-hidden bg-white shadow-sm">
            <div className="bg-slate-100 px-5 py-3 border-b border-slate-300">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <ListFilter size={14} style={{ color: 'var(--theme-color)' }} />
                Items ({filteredItems.length})
              </span>
            </div>

            {isLoading && items.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm font-medium">
                Loading items...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm font-medium">
                No items in catalog. Click "+ Add Item" to get started.
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
                      className="p-5 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-slate-50 transition-colors gap-4"
                    >
                      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <div className="font-bold text-sm text-slate-900">
                          <span className="text-slate-400 font-medium">Code:</span> {item.item_code}
                        </div>
                        <div className="text-xs text-slate-600 mt-1 space-y-0.5">
                          {item.drawing_number && (
                            <div>
                              <strong className="text-slate-400 font-bold">Drawing:</strong> {item.drawing_number}
                            </div>
                          )}
                          <div>
                            <strong className="text-slate-400 font-bold">Desc:</strong> {item.description}
                          </div>
                          {longLines.length > 0 && (
                            <div>
                              <strong className="text-slate-400 font-bold">Details:</strong>{' '}
                              <span style={{ whiteSpace: 'pre-wrap' }}>{visibleText}</span>
                              {longLines.length > 2 && (
                                <button
                                  onClick={() => toggleExpand(item.item_code)}
                                  style={{
                                    marginLeft: '6px',
                                    fontSize: '11px',
                                    color: 'var(--theme-color)',
                                    background: 'none',
                                    border: 'none',
                                    padding: 0,
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                  }}
                                >
                                  {isExpanded ? 'less' : 'more'}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleEditClick(item)}
                        className="px-3 py-1.5 text-xs border border-slate-300 rounded font-semibold bg-white transition-all flex items-center gap-1 cursor-pointer shrink-0"
                        style={{ color: 'var(--theme-color)', borderColor: 'var(--theme-color)' }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = 'var(--theme-color)';
                          e.target.style.color = 'white';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = 'transparent';
                          e.target.style.color = 'var(--theme-color)';
                        }}
                      >
                        <Edit2 size={12} /> Edit
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {hasMore && items.length > 0 && (
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-center">
                <button
                  onClick={() => fetchItems(true)}
                  disabled={loadingMore}
                  className="px-6 py-2 text-xs font-bold border border-slate-300 rounded-lg hover:border-[var(--theme-color)] bg-white text-slate-700 hover:text-[var(--theme-color)] transition-all cursor-pointer shadow-sm hover:shadow flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingMore ? (
                    <>
                      <RefreshCw size={12} className="animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Show More'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ================================================================
            VIEW MODE: FULL PAGE FORM
           ================================================================ */
        <div className="max-w-2xl mx-auto space-y-5">
          <button
            onClick={handleBackToDirectory}
            className="mb-3 text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer bg-slate-200 hover:bg-slate-300 px-3 py-1.5 rounded-lg transition-colors self-start"
          >
            <ArrowLeft size={14} />
            Back to Directory
          </button>

          <h1 className="text-2xl font-bold text-slate-900 m-0">
            {editingCode ? 'Update Item' : 'Add New Item'}
          </h1>

          <div className="bg-white border border-slate-300 rounded-lg p-6 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Item Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ITM-001"
                  value={formData.item_code}
                  onChange={set('item_code')}
                  disabled={!!editingCode}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm placeholder:text-slate-400 font-medium focus:outline-none disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                  onFocus={(e) => !editingCode && (e.target.style.borderColor = 'var(--theme-color)')}
                  onBlur={(e) => !editingCode && (e.target.style.borderColor = 'rgb(203, 213, 225)')}
                />
                {editingCode && (
                  <p className="text-[10px] text-slate-400 font-semibold mt-1 pl-1">
                    Item code cannot be changed after creation.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Description <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Stainless Steel Bracket"
                  value={formData.description}
                  onChange={set('description')}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm placeholder:text-slate-400 font-medium focus:outline-none"
                  onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                  onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Drawing Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. DRW-050"
                  value={formData.drawing_number}
                  onChange={set('drawing_number')}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm placeholder:text-slate-400 font-medium focus:outline-none"
                  onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                  onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Long Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Detailed specifications, notes…"
                  value={formData.long_description}
                  onChange={set('long_description')}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm placeholder:text-slate-400 font-medium focus:outline-none resize-y"
                  onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                  onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleBackToDirectory}
                  className="px-5 py-2.5 border border-slate-300 rounded text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2.5 rounded text-sm font-bold text-white transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: 'var(--theme-color)' }}
                  onMouseEnter={(e) => e.target.style.filter = 'brightness(0.9)'}
                  onMouseLeave={(e) => e.target.style.filter = 'none'}
                >
                  {isLoading ? (
                    <><RefreshCw size={14} className="animate-spin" /> Processing...</>
                  ) : editingCode ? (
                    <><RefreshCw size={14} /> Update</>
                  ) : (
                    <><Plus size={14} /> Add</>
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
