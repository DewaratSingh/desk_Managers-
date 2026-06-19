import { useState, useEffect, useRef } from 'react';
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
  item_code: '',
  price: ''
};

export default function ArcView() {
  const [viewMode, setViewMode] = useState('list');
  const [arcItems, setArcItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Form states
  const [editingItemCode, setEditingItemCode] = useState(null);
  const [itemInput, setItemInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [price, setPrice] = useState('');
  
  const dropdownRef = useRef(null);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchArcItems(false, searchQuery);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Handle click outside autocomplete suggestions
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchArcItems = async (isLoadMore = false, searchVal = searchQuery) => {
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    setError(null);
    try {
      const currentOffset = isLoadMore ? arcItems.length : 0;
      const res = await fetch(`/api/arc-items?limit=20&offset=${currentOffset}&q=${encodeURIComponent(searchVal || '')}`);
      if (res.ok) {
        const data = await res.json();
        if (isLoadMore) {
          setArcItems(prev => [...prev, ...data]);
        } else {
          setArcItems(data);
        }
        if (data.length < 20) {
          setHasMore(false);
        } else {
          setHasMore(true);
        }
      } else {
        setError('Failed to load ARC items');
      }
    } catch (err) {
      console.error(err);
      setError('Connection error');
    } finally {
      setIsLoading(false);
      setLoadingMore(false);
    }
  };

  const handleItemInput = async (value) => {
    setItemInput(value);
    setSelectedItem(null);
    if (!value.trim()) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    try {
      const res = await fetch(`/api/items?q=${encodeURIComponent(value)}`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data);
        setShowDropdown(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectItem = (item) => {
    setSelectedItem(item);
    setItemInput(item.item_code);
    setShowDropdown(false);
  };

  const handleOpenAddForm = () => {
    setEditingItemCode(null);
    setItemInput('');
    setSelectedItem(null);
    setPrice('');
    setError(null);
    setViewMode('form');
  };

  const handleEdit = (arc) => {
    setEditingItemCode(arc.item_code);
    setSelectedItem({
      item_code: arc.item_code,
      description: arc.description,
      drawing_number: arc.drawing_number,
      long_description: arc.long_description
    });
    setItemInput(arc.item_code);
    setPrice(arc.price.toString());
    setError(null);
    setViewMode('form');
  };

  const handleDelete = async (itemCode) => {
    if (!window.confirm('Are you sure you want to delete this ARC item?')) return;
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch(`/api/arc-items/${encodeURIComponent(itemCode)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setArcItems(arcItems.filter(a => a.item_code !== itemCode));
      } else {
        const errData = await res.json();
        setError(errData.error || 'Failed to delete ARC item');
      }
    } catch (err) {
      console.error(err);
      setError('Connection error during deletion');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToDirectory = () => {
    setEditingItemCode(null);
    setItemInput('');
    setSelectedItem(null);
    setPrice('');
    setError(null);
    setViewMode('list');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError(null);
    
    const targetItemCode = editingItemCode || (selectedItem && selectedItem.item_code);
    if (!targetItemCode || price === '') {
      setError('Please select an item and provide a price');
      return;
    }

    setIsLoading(true);
    try {
      if (editingItemCode) {
        const res = await fetch(`/api/arc-items/${encodeURIComponent(editingItemCode)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ price: parseFloat(price) })
        });
        if (res.ok) {
          const updated = await res.json();
          setArcItems(arcItems.map(a => a.item_code === editingItemCode ? updated : a));
          handleBackToDirectory();
        } else {
          const errData = await res.json();
          setError(errData.error || 'Failed to update ARC item');
        }
      } else {
        const res = await fetch('/api/arc-items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            item_code: targetItemCode,
            price: parseFloat(price)
          })
        });
        if (res.ok) {
          const created = await res.json();
          setArcItems([created, ...arcItems]);
          handleBackToDirectory();
        } else {
          const errData = await res.json();
          setError(errData.error || 'Failed to register ARC item');
        }
      }
    } catch (err) {
      console.error(err);
      setError('Server error while saving');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredArcItems = arcItems;

  return (
    <div className="flex-1 p-6 bg-slate-100 text-slate-900">
      {viewMode === 'list' ? (
        <div className="max-w-4xl mx-auto space-y-5">
          {/* Header */}
          <div className="flex justify-between items-center pb-4 border-b border-slate-300">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 m-0">Annual Rate Contract (ARC)</h1>
              <p className="text-xs text-slate-500 mt-1">
                Manage special pricing contracts for items.
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
              New ARC Item
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
              placeholder="Search ARC items by item code, description, or drawing..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="w-full bg-transparent focus:outline-none text-sm text-slate-900 placeholder:text-slate-400 font-medium"
            />
          </div>

          {/* ARC directory list */}
          <div className="border border-slate-300 rounded-lg overflow-hidden bg-white shadow-sm">
            <div className="bg-slate-100 px-5 py-3 border-b border-slate-300">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <ListFilter size={14} style={{ color: 'var(--theme-color)' }} />
                Current ARC List ({filteredArcItems.length})
              </span>
            </div>

            {isLoading && arcItems.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm font-medium">
                Loading ARC items...
              </div>
            ) : filteredArcItems.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm font-medium">
                {searchQuery ? 'No ARC items match your search.' : 'No ARC items added yet. Click "+ New ARC Item" to add one.'}
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {filteredArcItems.map((arc) => (
                  <div
                    key={arc.item_code}
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white hover:bg-slate-50 transition-colors"
                  >
                    <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span 
                          className="text-xs font-mono font-bold border px-2 py-0.5 rounded tracking-wider"
                          style={{ color: 'var(--theme-color)', borderColor: 'var(--theme-color)', backgroundColor: 'rgba(217, 53, 45, 0.05)' }}
                        >
                          {arc.item_code}
                        </span>
                        {arc.drawing_number && (
                          <span className="text-[10px] text-slate-400 font-bold bg-slate-100 border border-slate-200 px-1.5 py-0.25 rounded">
                            DRW: {arc.drawing_number}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-600 mt-1">
                        {arc.description}
                      </div>
                    </div>

                    <div className="flex items-center gap-5 shrink-0">
                      <div className="text-right">
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Price</div>
                        <div className="font-extrabold text-sm text-slate-800">
                          ₹{parseFloat(arc.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleEdit(arc)}
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
                          <Edit2 size={12} /> Update
                        </button>
                        <button
                          onClick={() => handleDelete(arc.item_code)}
                          className="px-3 py-1.5 text-xs border rounded font-semibold bg-white hover:bg-red-600 hover:text-white border-red-650 text-red-650 transition-colors flex items-center gap-1 cursor-pointer"
                          style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {hasMore && arcItems.length > 0 && (
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-center">
                <button
                  onClick={() => fetchArcItems(true)}
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
        <div className="max-w-2xl mx-auto space-y-5" ref={dropdownRef}>
          {/* Header with Back Button */}
          <button
            onClick={handleBackToDirectory}
            className="mb-3 text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer bg-slate-200 hover:bg-slate-300 px-3 py-1.5 rounded-lg transition-colors self-start"
          >
            <ArrowLeft size={14} />
            Back to Directory
          </button>
          <h1 className="text-2xl font-bold text-slate-900 m-0">
            {editingItemCode ? `Modify ARC Rate` : 'Register ARC Item'}
          </h1>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg flex items-center gap-1.5">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <div className="bg-white border border-slate-300 rounded-lg p-6 shadow-sm">
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-4">
                {/* Item Search Autocomplete */}
                <div className="relative">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                    Item Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    disabled={!!editingItemCode}
                    placeholder="Search by item code or description to link item..."
                    value={itemInput}
                    onChange={(e) => handleItemInput(e.target.value)}
                    onFocus={() => itemInput.trim() && setShowDropdown(true)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm placeholder:text-slate-400 font-medium focus:outline-none disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                    style={!editingItemCode ? {} : { borderColor: 'rgb(226, 232, 240)' }}
                    onFocus={(e) => !editingItemCode && (e.target.style.borderColor = 'var(--theme-color)')}
                    onBlur={(e) => !editingItemCode && (e.target.style.borderColor = 'rgb(203, 213, 225)')}
                    autoComplete="off"
                  />
                  {showDropdown && suggestions.length > 0 && (
                    <div className="absolute z-30 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                      {suggestions.map(i => (
                        <button
                          key={i.item_code}
                          type="button"
                          onClick={() => handleSelectItem(i)}
                          className="w-full text-left px-3.5 py-2 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                        >
                          <div className="font-bold text-xs text-slate-900">{i.item_code}</div>
                          <div className="text-[10px] text-slate-500">{i.description}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedItem && (
                    <div className="mt-3.5 p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 pb-1 mb-0.5">
                        Linked Item Specifications
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="font-semibold text-slate-500">Item Code:</span>{' '}
                          <span 
                            className="font-mono border px-1.5 py-0.25 rounded font-bold"
                            style={{ color: 'var(--theme-color)', borderColor: 'var(--theme-color)', backgroundColor: 'rgba(217, 53, 45, 0.05)' }}
                          >
                            {selectedItem.item_code}
                          </span>
                        </div>
                        {selectedItem.drawing_number && (
                          <div>
                            <span className="font-semibold text-slate-500">Drawing No:</span>{' '}
                            <span className="font-mono bg-slate-100 border border-slate-200 px-1.5 py-0.25 rounded text-slate-700 font-bold">
                              {selectedItem.drawing_number}
                            </span>
                          </div>
                        )}
                        <div className="sm:col-span-2">
                          <span className="font-semibold text-slate-500 block mb-0.5">Description:</span>
                          <span className="text-slate-800 font-medium">{selectedItem.description}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Price */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                    Price (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="0.00"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm placeholder:text-slate-400 font-medium focus:outline-none"
                    onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                    onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                  />
                </div>
              </div>

              {/* Action Buttons */}
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
                  disabled={isLoading || (!selectedItem && !itemInput.trim())}
                  className="px-5 py-2.5 rounded text-sm font-bold text-white transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: 'var(--theme-color)' }}
                  onMouseEnter={(e) => e.target.style.filter = 'brightness(0.9)'}
                  onMouseLeave={(e) => e.target.style.filter = 'none'}
                >
                  {isLoading ? (
                    <><RefreshCw size={14} className="animate-spin" /> Processing...</>
                  ) : editingItemCode ? (
                    <>
                      <RefreshCw size={14} /> Update
                    </>
                  ) : (
                    <>
                      <Plus size={14} /> Save
                    </>
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
