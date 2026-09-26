import React, { useState, useEffect } from 'react';
import { Package, Search, RefreshCw, X, AlertCircle, Check } from 'lucide-react';
import { toast } from 'react-toastify';

export default function TargetItemSelectorModal({
  isOpen,
  onClose,
  onApply,
  initialTargetItem = {}
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedItemCode, setSelectedItemCode] = useState('');
  const [selectedItemDesc, setSelectedItemDesc] = useState('');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelectedItemCode(initialTargetItem.item_code || '');
      setSelectedItemDesc(initialTargetItem.description || '');
      setQty(initialTargetItem.qty !== undefined && initialTargetItem.qty !== null ? String(initialTargetItem.qty) : '');
      setPrice(initialTargetItem.price !== undefined && initialTargetItem.price !== null ? String(initialTargetItem.price) : '');
      fetchCatalogItems();
    }
  }, [isOpen, initialTargetItem]);

  const fetchCatalogItems = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/items?limit=200');
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      } else {
        toast.error('Failed to load catalog items');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error fetching catalog items');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectItem = (item) => {
    setSelectedItemCode(item.item_code);
    setSelectedItemDesc(item.description || '');
  };

  const handleConfirm = () => {
    if (!selectedItemCode) {
      toast.error('Please select a Target Item Code');
      return;
    }

    const parsedQty = parseFloat(qty);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      toast.error('Please enter a valid Target Quantity greater than 0');
      return;
    }

    const parsedPrice = price !== '' && !isNaN(parseFloat(price)) ? parseFloat(price) : 0;

    onApply({
      item_code: selectedItemCode,
      description: selectedItemDesc,
      qty: parsedQty,
      price: parsedPrice
    });

    onClose();
  };

  if (!isOpen) return null;

  const filteredItems = items.filter(item => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (item.item_code && item.item_code.toLowerCase().includes(q)) ||
      (item.description && item.description.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl text-white shadow-2xs" style={{ backgroundColor: 'var(--theme-color)' }}>
              <Package size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 m-0">Select Target Output Item</h2>
              <p className="text-[11px] text-slate-500 m-0 font-medium">
                Choose target catalog item and specify output quantity & price
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
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Selected Item Summary Card */}
          {selectedItemCode && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                  Selected Target Item
                </span>
                <span className="font-bold text-slate-900 text-sm">{selectedItemCode}</span>
                {selectedItemDesc && <span className="text-slate-500 text-xs block font-medium">{selectedItemDesc}</span>}
              </div>
              <span className="px-2.5 py-1 text-[10px] font-black rounded-lg border text-emerald-700 bg-emerald-50 border-emerald-200 flex items-center gap-1">
                <Check size={12} /> Selected
              </span>
            </div>
          )}

          {/* Quantity and Price Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Target Quantity (Qty) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                required
                placeholder="e.g. 100"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Unit Price (₹) <span className="text-slate-400 font-normal lowercase">(optional)</span>
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 150.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Search Box */}
          <div className="relative pt-2">
            <Search size={15} className="absolute left-3.5 top-5.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search catalog by item code or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] focus:border-transparent transition-all"
            />
          </div>

          {/* Catalog Item List */}
          <div className="border border-slate-200 rounded-xl max-h-56 overflow-y-auto divide-y divide-slate-100 bg-white">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2 font-medium">
                <RefreshCw size={14} className="animate-spin" /> Loading catalog items...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 font-medium">
                No catalog items found.
              </div>
            ) : (
              filteredItems.map(item => {
                const isSelected = selectedItemCode === item.item_code;
                return (
                  <div
                    key={item.id || item.item_code}
                    onClick={() => handleSelectItem(item)}
                    className={`p-3 text-xs cursor-pointer transition-colors flex items-center justify-between ${
                      isSelected ? 'bg-slate-100/80 font-bold' : 'hover:bg-slate-50 font-medium'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-slate-900">{item.item_code}</div>
                      {item.description && <div className="text-[11px] text-slate-500 font-normal">{item.description}</div>}
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0" style={{ backgroundColor: 'var(--theme-color)' }}>
                        <Check size={12} />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-end gap-3">
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
            className="px-5 py-2 rounded-xl text-xs font-bold text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
            style={{ backgroundColor: 'var(--theme-color)' }}
          >
            <Check size={14} /> Confirm Target Item
          </button>
        </div>
      </div>
    </div>
  );
}
