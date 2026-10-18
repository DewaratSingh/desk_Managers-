import React, { useState, useEffect, useRef } from 'react';
import { Package, Search, RefreshCw, X, AlertCircle, Check } from 'lucide-react';
import { toast } from 'react-toastify';

export default function TargetItemSelectorModal({
  isOpen,
  onClose,
  onApply,
  initialTargetItem = {}
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [selectedItemCode, setSelectedItemCode] = useState('');
  const [selectedItemDesc, setSelectedItemDesc] = useState('');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');

  const searchRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      const code = initialTargetItem?.item_code || '';
      setSelectedItemCode(code);
      setSelectedItemDesc(initialTargetItem?.description || '');
      setSearchQuery(code);
      setQty(initialTargetItem?.qty !== undefined && initialTargetItem?.qty !== null ? String(initialTargetItem.qty) : '');
      setPrice(initialTargetItem?.price !== undefined && initialTargetItem?.price !== null ? String(initialTargetItem.price) : '');
      setShowDropdown(false);

      // Fetch top 5 initial catalog items for quick selection
      fetch('/api/items?limit=5')
        .then(r => r.ok ? r.json() : [])
        .then(data => setSuggestions(Array.isArray(data) ? data.slice(0, 5) : []))
        .catch(() => {});
    }
  }, [isOpen, initialTargetItem?.item_code]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search for catalog items with limit 5
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      fetch('/api/items?limit=5')
        .then(r => r.ok ? r.json() : [])
        .then(data => setSuggestions(Array.isArray(data) ? data.slice(0, 5) : []))
        .catch(() => {});
      return;
    }

    if (selectedItemCode && searchQuery === selectedItemCode) {
      return;
    }

    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/items?q=${encodeURIComponent(trimmed)}&limit=5`)
        .then(r => r.ok ? r.json() : [])
        .then(data => {
          setSuggestions(Array.isArray(data) ? data.slice(0, 5) : []);
          setShowDropdown(true);
        })
        .catch(err => {
          console.error('Error fetching items:', err);
        })
        .finally(() => setLoading(false));
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedItemCode]);

  const handleSelectItem = (item) => {
    setSelectedItemCode(item.item_code);
    setSelectedItemDesc(item.description || '');
    setSearchQuery(item.item_code);
    setShowDropdown(false);
  };

  const handleClearSelection = () => {
    setSelectedItemCode('');
    setSelectedItemDesc('');
    setSearchQuery('');
    setShowDropdown(false);
  };

  const handleConfirm = () => {
    if (!selectedItemCode) {
      toast.error('Please search and select a Target Item');
      return;
    }

    const parsedQty = parseFloat(qty);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      toast.error('Please enter a valid Target Quantity greater than 0');
      return;
    }

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      toast.error('Please enter a valid Expected Unit Price greater than 0');
      return;
    }

    onApply({
      item_code: selectedItemCode,
      description: selectedItemDesc,
      qty: parsedQty,
      price: parsedPrice
    });

    onClose();
  };

  if (!isOpen) return null;

  const totalCalculated = (parseFloat(qty) || 0) * (parseFloat(price) || 0);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in">
      <div className=" bg-[white] border border-slate-200 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-visible">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50 rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl text-white shadow-2xs" style={{ backgroundColor: 'var(--theme-color)' }}>
              <Package size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 m-0">Select Target Output Item</h2>
              <p className="text-[11px] text-slate-500 m-0 font-medium">
                Search target item at top (limit 5) and specify compulsory quantity & expected unit price
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-visible space-y-4 flex-1">
          {/* Top Search Bar with Limit 5 Dropdown */}
          <div ref={searchRef} className="relative">
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 flex items-center justify-between">
              <span>Search Target Item <b className="text-red-500">*</b></span>
              <span className="text-[10px] text-slate-400 font-semibold normal-case">Top 5 suggestions</span>
            </label>
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Type item code or description to search (max 5)..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                className="w-full pl-9 pr-9 py-2  bg-[white] border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] focus:border-transparent transition-all"
                autoComplete="off"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Suggestions Dropdown (Limit 5) */}
            {showDropdown && (
              <div className="absolute z-50 left-0 right-0 mt-1  bg-[white] border border-slate-300 rounded-xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
                {loading ? (
                  <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2 font-medium">
                    <RefreshCw size={14} className="animate-spin" /> Searching items...
                  </div>
                ) : suggestions.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400 font-medium">
                    {searchQuery.trim() ? `No items found matching "${searchQuery}".` : 'No items available.'}
                  </div>
                ) : (
                  suggestions.slice(0, 5).map((item, idx) => {
                    const isSelected = selectedItemCode === item.item_code;
                    return (
                      <button
                        key={`${item.id || item.item_code}-${idx}`}
                        type="button"
                        onClick={() => handleSelectItem(item)}
                        className={`w-full text-left px-3.5 py-2.5 transition-colors border-b border-slate-100 last:border-0 cursor-pointer flex items-center justify-between ${
                          isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-slate-900">{item.item_code}</span>
                            {item.drawing_number && (
                              <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                DRW: {item.drawing_number}
                              </span>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-[11px] text-slate-500 font-normal truncate mt-0.5">{item.description}</p>
                          )}
                        </div>
                        {isSelected ? (
                          <span className="text-xs text-emerald-600 font-bold ml-2 shrink-0 flex items-center gap-1">
                            <Check size={14} /> Selected
                          </span>
                        ) : (
                          <span className="text-[11px] text-blue-600 font-semibold ml-2 shrink-0 hover:underline">
                            Select
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Selected Item Summary Card */}
          {selectedItemCode ? (
            <div className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
              <div className="min-w-0 flex-1 mr-3">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block mb-0.5 flex items-center gap-1">
                  <Check size={12} className="text-emerald-600" /> Selected Target Output Item
                </span>
                <span className="font-mono font-bold text-slate-900 text-sm block">{selectedItemCode}</span>
                {selectedItemDesc && (
                  <span className="text-slate-600 text-xs block font-medium truncate mt-0.5">{selectedItemDesc}</span>
                )}
              </div>
              <button
                type="button"
                onClick={handleClearSelection}
                className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors cursor-pointer shrink-0"
                title="Change item"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl flex items-center gap-2 text-xs text-amber-800 font-medium">
              <AlertCircle size={15} className="text-amber-600 shrink-0" />
              <span>Please search and select a Target Item above to proceed.</span>
            </div>
          )}

          {/* Quantity and Expected Unit Price Inputs (Compulsory) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Target Quantity (Qty) <b className="text-red-500">*</b>
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                required
                placeholder="e.g. 100"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                disabled={!selectedItemCode}
                className="w-full px-3.5 py-2  bg-[white] border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] focus:border-transparent transition-all disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Expected Unit Price (₹) <b className="text-red-500">*</b>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="e.g. 150.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                disabled={!selectedItemCode}
                className="w-full px-3.5 py-2  bg-[white] border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] focus:border-transparent transition-all disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Dynamic Target Total Price Calculation */}
          {selectedItemCode && totalCalculated > 0 && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs font-medium text-slate-700">
              <span className="font-bold uppercase tracking-wider text-[10px] text-slate-500">
                Target Total Price (Qty &times; Expected Unit Price):
              </span>
              <span className="font-mono font-black text-sm text-slate-900">
                ₹{totalCalculated.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-end gap-3 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedItemCode}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--theme-color)' }}
          >
            <Check size={14} /> Confirm Target Item
          </button>
        </div>
      </div>
    </div>
  );
}
