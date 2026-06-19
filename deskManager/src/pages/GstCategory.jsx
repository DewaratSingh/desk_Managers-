import { useState, useEffect } from 'react';
import {
  Search,
  Edit2,
  Plus,
  RefreshCw,
  ArrowLeft,
  ListFilter,
  Trash2,
  AlertCircle
} from 'lucide-react';

const EMPTY_FORM = {
  type: '',
  rate: ''
};

export default function GstCategoryView() {
  const [viewMode, setViewMode] = useState('list');
  const [gstRates, setGstRates] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [searchFocused, setSearchFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchGstRates(false, searchQuery);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const fetchGstRates = async (isLoadMore = false, searchVal = searchQuery) => {
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    setError(null);
    try {
      const currentOffset = isLoadMore ? gstRates.length : 0;
      const res = await fetch(`/api/gst-rates?limit=20&offset=${currentOffset}&q=${encodeURIComponent(searchVal || '')}`);
      if (res.ok) {
        const data = await res.json();
        if (isLoadMore) {
          setGstRates(prev => [...prev, ...data]);
        } else {
          setGstRates(data);
        }
        if (data.length < 20) {
          setHasMore(false);
        } else {
          setHasMore(true);
        }
      } else {
        setError('Failed to load GST categories');
      }
    } catch (err) {
      console.error(err);
      setError('Connection error');
    } finally {
      setIsLoading(false);
      setLoadingMore(false);
    }
  };

  const set = (field) => (e) =>
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  const handleOpenAddForm = () => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setError(null);
    setViewMode('form');
  };

  const handleEditClick = (g) => {
    setEditingId(g.id);
    setFormData({
      type: g.type || '',
      rate: g.rate !== undefined ? g.rate.toString() : ''
    });
    setError(null);
    setViewMode('form');
  };

  const handleDeleteClick = async (id) => {
    if (!window.confirm('Are you sure you want to delete this GST category?')) return;
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch(`/api/gst-rates/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setGstRates(gstRates.filter(g => g.id !== id));
      } else {
        const errData = await res.json();
        setError(errData.error || 'Failed to delete GST category');
      }
    } catch (err) {
      console.error(err);
      setError('Connection error during deletion');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToDirectory = () => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setError(null);
    setViewMode('list');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!formData.type.trim() || formData.rate === '') return;

    setIsLoading(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/gst-rates/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: formData.type,
            rate: parseFloat(formData.rate)
          })
        });
        if (res.ok) {
          const updated = await res.json();
          setGstRates(gstRates.map(g => g.id === editingId ? updated : g));
          setFormData(EMPTY_FORM);
          setEditingId(null);
          setViewMode('list');
        } else {
          const errData = await res.json();
          setError(errData.error || 'Failed to update GST category');
        }
      } else {
        const res = await fetch('/api/gst-rates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: formData.type,
            rate: parseFloat(formData.rate)
          })
        });
        if (res.ok) {
          const created = await res.json();
          setGstRates([...gstRates, created]);
          setFormData(EMPTY_FORM);
          setEditingId(null);
          setViewMode('list');
        } else {
          const errData = await res.json();
          setError(errData.error || 'Failed to create GST category');
        }
      }
    } catch (err) {
      console.error(err);
      setError('Server error while saving');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredGstRates = gstRates;

  return (
    <div className="flex-1 p-6 bg-slate-100 text-slate-900">
      {/* ================================================================
          VIEW MODE: LIST (default)
         ================================================================ */}
      {viewMode === 'list' ? (
        <div className="max-w-4xl mx-auto space-y-5">
          {/* Header */}
          <div className="flex justify-between items-center pb-4 border-b border-slate-300">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 m-0">GST Categories</h1>
              <p className="text-xs text-slate-500 mt-1">
                Configure GST slabs and types used for commercial quotations and billing.
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
              New Category
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg flex items-center gap-1.5">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {/* Search */}
          <div 
            className="flex items-center gap-2.5 border border-slate-300 rounded-lg px-3 py-2 bg-white shadow-sm transition-colors"
            style={{ borderColor: searchFocused ? 'var(--theme-color)' : 'rgb(203, 213, 225)' }}
          >
            <Search size={18} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search by GST type name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="w-full bg-transparent focus:outline-none text-sm text-slate-900 placeholder:text-slate-400 font-medium"
            />
          </div>

          {/* Directory Grid */}
          <div className="border border-slate-300 rounded-lg overflow-hidden bg-white shadow-sm">
            <div className="bg-slate-100 px-5 py-3 border-b border-slate-300 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <ListFilter size={14} style={{ color: 'var(--theme-color)' }} />
                GST Slab Directory ({filteredGstRates.length})
              </span>
            </div>

            {isLoading && gstRates.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm font-medium">
                Loading GST categories...
              </div>
            ) : filteredGstRates.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm font-medium">
                No GST categories found. Click "New Category" to configure one.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {filteredGstRates.map((g) => (
                  <div
                    key={g.id}
                    className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white hover:bg-slate-50 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-sm text-slate-900">{g.type}</span>
                        <span 
                          className="px-2.5 py-0.5 border text-xs font-bold rounded-full"
                          style={{ color: 'var(--theme-color)', borderColor: 'var(--theme-color)', backgroundColor: 'rgba(217, 53, 45, 0.05)' }}
                        >
                          Rate: {g.rate}%
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <button
                        onClick={() => handleEditClick(g)}
                        className="px-3 py-1.5 text-xs border rounded font-semibold bg-white transition-all flex items-center gap-1 cursor-pointer"
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
                        <Edit2 size={12} /> Update
                      </button>
                      <button
                        onClick={() => handleDeleteClick(g.id)}
                        className="px-3 py-1.5 text-xs border rounded font-semibold bg-white hover:bg-red-600 hover:text-white border-red-600 text-red-600 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {hasMore && gstRates.length > 0 && (
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-center">
                <button
                  onClick={() => fetchGstRates(true)}
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
            VIEW MODE: FORM
           ================================================================ */
        <div className="max-w-2xl mx-auto space-y-5">
          {/* Header */}
          <button
            onClick={handleBackToDirectory}
            className="mb-3 text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer bg-slate-200 hover:bg-slate-300 px-3 py-1.5 rounded-lg transition-colors self-start"
          >
            <ArrowLeft size={14} />
            Back to Directory
          </button>
          <h1 className="text-2xl font-bold text-slate-900 m-0">
            {editingId ? 'Modify GST Category' : 'Create GST Category'}
          </h1>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg flex items-center gap-1.5">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <div className="bg-white border border-slate-300 rounded-lg p-6 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* GST Type Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                    GST Type / Slab Name <b className="text-red-500">*</b>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CGST + SGST 18%"
                    value={formData.type}
                    onChange={set('type')}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm placeholder:text-slate-400 font-medium focus:outline-none"
                    onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                    onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                  />
                </div>

                {/* GST Rate Percent */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                    Total GST Rate (%) <b className="text-red-500">*</b>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    required
                    placeholder="e.g. 18.00"
                    value={formData.rate}
                    onChange={set('rate')}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm placeholder:text-slate-400 font-medium focus:outline-none"
                    onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                    onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                  />
                </div>
              </div>

              {/* Buttons */}
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
                  ) : editingId ? (
                    <><RefreshCw size={14} /> Update</>
                  ) : (
                    <><Plus size={14} /> Save</>
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
