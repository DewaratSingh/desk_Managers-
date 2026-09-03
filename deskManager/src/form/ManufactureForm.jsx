import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Factory, Package, Calendar, RefreshCw, Loader2, Info } from 'lucide-react';
import { toast } from 'react-toastify';

export default function ManufactureForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state || {};

  const {
    item_code: sourceItemCode = '',
    quantity: sourceQty = 0,
    trace_item_id: sourceTraceItemId = null,
    inventory_id: sourceInventoryId = null
  } = state;

  const [targetItemCode, setTargetItemCode] = useState('');
  const [items, setItems] = useState([]);
  const [quantityUsed, setQuantityUsed] = useState('');
  const [expectedQuantity, setExpectedQuantity] = useState('');
  const [dateOfStarting, setDateOfStarting] = useState(new Date().toISOString().split('T')[0]);
  const [dateOfEnding, setDateOfEnding] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [message, setMessage] = useState('');

  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showItemDropdown, setShowItemDropdown] = useState(false);

  const itemDropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (itemDropdownRef.current && !itemDropdownRef.current.contains(event.target)) {
        setShowItemDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search target items
  useEffect(() => {
    const trimmed = targetItemCode.trim();
    const delayDebounce = setTimeout(() => {
      fetchTargetItems(trimmed);
    }, 200);

    return () => clearTimeout(delayDebounce);
  }, [targetItemCode]);

  const fetchTargetItems = async (query = '') => {
    setIsLoadingItems(true);
    try {
      const res = await fetch(`/api/items?q=${encodeURIComponent(query)}&limit=5`);
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (err) {
      console.error('Failed to fetch items:', err);
    } finally {
      setIsLoadingItems(false);
    }
  };

  const handleSelectTargetItem = (item) => {
    setTargetItemCode(item.item_code);
    setShowItemDropdown(false);
  };

  const handleCancel = () => {
    navigate('/inventory');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!sourceItemCode) {
      toast.error('Source Item Code is missing. Please start from Inventory.');
      return;
    }

    if (!targetItemCode) {
      toast.error('Please select a Target Item Code to manufacture.');
      return;
    }

    if (sourceItemCode === targetItemCode) {
      toast.warn('Source and Target item codes should ideally be different.');
    }

    const qtyUsed = parseInt(quantityUsed, 10);
    const expQty = parseInt(expectedQuantity, 10);

    if (isNaN(qtyUsed) || qtyUsed <= 0) {
      toast.error('Please enter a valid Quantity Used greater than 0');
      return;
    }

    if (qtyUsed > (parseInt(sourceQty, 10) || 0)) {
      toast.error(`Quantity Used (${qtyUsed}) exceeds available source quantity (${sourceQty})`);
      return;
    }

    if (isNaN(expQty) || expQty <= 0) {
      toast.error('Please enter a valid Expected Quantity greater than 0');
      return;
    }

    if (!dateOfStarting) {
      toast.error('Date of Starting is required');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        source_item_code: sourceItemCode,
        target_item_code: targetItemCode,
        quantity_used: qtyUsed,
        expected_quantity: expQty,
        unit_price: parseFloat(unitPrice) || 0.00,
        date_of_starting: dateOfStarting,
        date_of_ending: dateOfEnding || null,
        message: message || null,
        source_trace_item_id: sourceTraceItemId,
        source_inventory_id: sourceInventoryId
      };

      const res = await fetch('/api/manufacture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast.success('Manufacturing job started successfully!');
        navigate('/inventory');
      } else {
        const errData = await res.json();
        toast.error(errData.error || 'Failed to start manufacturing job');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error starting manufacturing job');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="min-h-[calc(100vh-72px)] p-6 text-slate-700 bg-slate-100 font-sans">
      <div className="mx-auto max-w-2xl bg-white border border-slate-300 rounded-2xl p-8 shadow-sm">
        
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 border-b border-slate-200 pb-4">
          <button
            type="button"
            onClick={handleCancel}
            className="p-2 hover:bg-slate-100 rounded-full border border-slate-300 text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
            title="Back to Inventory"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <Factory size={20} style={{ color: 'var(--theme-color)' }} />
              Start Manufacturing Job
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Consume source item stock to generate target manufactured items.
            </p>
          </div>
        </div>

        {/* Info Grid for Source Item */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 gap-4 mb-6 text-xs">
          <div>
            <span className="block text-slate-400 font-bold uppercase tracking-wider mb-1 text-[10px]">Source Item Code</span>
            <span className="font-mono text-xs font-bold text-slate-800 bg-white border border-slate-200 px-2.5 py-1 rounded-md inline-block">
              {sourceItemCode || '—'}
            </span>
          </div>
          <div>
            <span className="block text-slate-400 font-bold uppercase tracking-wider mb-1 text-[10px]">Available Source Stock</span>
            <span className="text-xs font-bold text-slate-800 bg-white border border-slate-200 px-2.5 py-1 rounded-md inline-block">
              {sourceQty || 0} Units
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Target Item Code Autocomplete Input */}
          <div className="relative" ref={itemDropdownRef}>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
              Target Item Code (Produced Item) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                placeholder="Search or enter target item code..."
                value={targetItemCode}
                onChange={(e) => {
                  setTargetItemCode(e.target.value);
                  setShowItemDropdown(true);
                }}
                onFocus={() => setShowItemDropdown(true)}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-[var(--theme-color)]"
                autoComplete="off"
              />
              {isLoadingItems && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="animate-spin text-slate-400" size={14} />
                </div>
              )}
            </div>

            {/* Target Item Autocomplete Dropdown */}
            {showItemDropdown && items.length > 0 && (
              <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto divide-y divide-slate-100 animate-fade-in">
                {items.map((item) => (
                  <button
                    key={item.item_code}
                    type="button"
                    onClick={() => handleSelectTargetItem(item)}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors text-xs font-semibold cursor-pointer flex flex-col gap-0.5"
                  >
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Package size={12} className="text-slate-400" />
                      {item.item_code}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">{item.description}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quantities Row: Quantity Used (Source) & Expected Quantity (Target) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Quantity Used (Source) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="1"
                max={sourceQty || undefined}
                placeholder="e.g. 10"
                value={quantityUsed}
                onChange={(e) => setQuantityUsed(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-[var(--theme-color)]"
              />
              <p className="text-[10px] text-slate-400 font-semibold mt-1">
                Amount deducted from source trace_item stock.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Expected Quantity (Target) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="1"
                placeholder="e.g. 5"
                value={expectedQuantity}
                onChange={(e) => setExpectedQuantity(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-[var(--theme-color)]"
              />
              <p className="text-[10px] text-slate-400 font-semibold mt-1">
                Expected output quantity for the new target item.
              </p>
            </div>
          </div>

          {/* Manufacturing Unit Price Added */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
              Manufacturing Unit Price Added (₹)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 50.00"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-[var(--theme-color)]"
            />
            <p className="text-[10px] text-slate-400 font-semibold mt-1">
              Unit price added for this manufacturing process step (will be added to total item unit price).
            </p>
          </div>

          {/* Dates Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Date of Starting <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={dateOfStarting}
                onChange={(e) => setDateOfStarting(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-[var(--theme-color)]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Date of Ending (Optional)
              </label>
              <input
                type="date"
                value={dateOfEnding}
                onChange={(e) => setDateOfEnding(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-[var(--theme-color)]"
              />
            </div>
          </div>

          {/* Message / Remarks */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
              Message / Remarks
            </label>
            <textarea
              rows={3}
              placeholder="Enter manufacturing specifications or instructions..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-[var(--theme-color)] resize-y"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleCancel}
              className="px-5 py-2.5 border border-slate-300 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              style={{ backgroundColor: 'var(--theme-color)' }}
              onMouseEnter={(e) => e.target.style.filter = 'brightness(0.9)'}
              onMouseLeave={(e) => e.target.style.filter = 'none'}
            >
              {isSaving ? (
                <><RefreshCw size={14} className="animate-spin" /> Starting Job...</>
              ) : (
                <><Factory size={14} /> Start Manufacture Job</>
              )}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
