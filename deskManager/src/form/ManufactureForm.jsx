import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Search, Hammer, ArrowDown, DollarSign, Calendar, Info, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';

export default function ManufactureForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state || {};

  const {
    item_code: sourceItemCode = '',
    price: sourcePrice = 0,
    quantity: sourceQty = 0,
    p_item_id: sourcePItemId = null,
    inventory_id: sourceInventoryId = null
  } = state;

  const [searchQuery, setSearchQuery] = useState('');
  const [itemsList, setItemsList] = useState([]);
  const [selectedTargetItem, setSelectedTargetItem] = useState(null);
  
  const [costPerUnit, setCostPerUnit] = useState('');
  const [quantityUsed, setQuantityUsed] = useState('');
  const [possibleQuantityProduced, setPossibleQuantityProduced] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [possibleEndDate, setPossibleEndDate] = useState('');
  const [message, setMessage] = useState('');

  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch items list for target item autocomplete lookup
  useEffect(() => {
    fetchItems();
  }, [searchQuery]);

  const fetchItems = async () => {
    setIsLoadingItems(true);
    try {
      const url = `/api/items?q=${encodeURIComponent(searchQuery)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch items');
      const data = await res.json();
      setItemsList(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load target items');
    } finally {
      setIsLoadingItems(false);
    }
  };

  const handleSelectTargetItem = (item) => {
    setSelectedTargetItem(item);
    setShowDropdown(false);
    setSearchQuery(item.item_code);
  };

  const handleCancel = () => {
    navigate('/inventory');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTargetItem) {
      toast.error('Please select a target item code.');
      return;
    }

    if (selectedTargetItem.item_code === sourceItemCode) {
      toast.error('Target item code cannot be the same as the source item code.');
      return;
    }

    const qtyUsed = parseInt(quantityUsed, 10);
    if (isNaN(qtyUsed) || qtyUsed <= 0) {
      toast.error('Please enter a valid quantity used greater than 0.');
      return;
    }

    if (qtyUsed > (parseInt(sourceQty) || 0)) {
      toast.error(`Quantity used cannot exceed available source stock of ${sourceQty}.`);
      return;
    }

    const possibleProduce = parseInt(possibleQuantityProduced, 10);
    if (isNaN(possibleProduce) || possibleProduce <= 0) {
      toast.error('Please enter a valid expected quantity to produce.');
      return;
    }

    const unitCost = parseFloat(costPerUnit);
    if (isNaN(unitCost) || unitCost < 0) {
      toast.error('Please enter a valid manufacturing cost per unit.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        source_item_code: sourceItemCode,
        source_p_item_id: sourcePItemId,
        source_inventory_id: sourceInventoryId,
        target_item_code: selectedTargetItem.item_code,
        possible_cost_per_unit: unitCost,
        quantity_used: qtyUsed,
        possible_quantity_produced: possibleProduce,
        start_date: startDate,
        possible_end_date: possibleEndDate || null,
        message: message
      };

      const res = await fetch('/api/manufacturing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to start manufacturing run');
      }

      toast.success('Manufacturing run initiated successfully!');
      navigate('/inventory');
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to save manufacturing run');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="min-h-[calc(100vh-72px)] p-6 text-slate-700 bg-slate-50 font-sans">
      <div className="mx-auto max-w-2xl bg-white border border-slate-200 rounded-3xl p-8 shadow-xl shadow-slate-200/50 animate-fade-in">
        
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
          <button
            type="button"
            onClick={handleCancel}
            className="p-2 hover:bg-slate-50 rounded-full border border-slate-200 text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
            title="Back"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-lg font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
              <Hammer size={18} className="text-indigo-600" />
              Configure Manufacturing Run
            </h1>
            <p className="text-xs text-slate-400 font-semibold">
              Consume stock to stage a manufacturing job run
            </p>
          </div>
        </div>

        {/* Source Stock Display */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 mb-5 space-y-3 shadow-inner text-xs font-semibold">
          <h3 className="font-bold text-slate-400 uppercase tracking-wide text-[9px] mb-1">
            Raw Material Source Item (From Inventory)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <span className="block text-slate-400 text-[9px] uppercase tracking-wider mb-0.5">Item Code</span>
              <span className="font-mono text-xs font-black text-slate-800 bg-white border border-slate-200 px-2.5 py-1 rounded-lg inline-block">
                {sourceItemCode || '—'}
              </span>
            </div>
            <div>
              <span className="block text-slate-400 text-[9px] uppercase tracking-wider mb-0.5">P-Item Ref ID</span>
              <span className="text-xs font-black text-slate-800 font-mono bg-white border border-slate-200 px-2.5 py-1 rounded-lg inline-block">
                {sourcePItemId ? `P-${sourcePItemId}` : 'None'}
              </span>
            </div>
            <div>
              <span className="block text-slate-400 text-[9px] uppercase tracking-wider mb-0.5">Available Stock</span>
              <span className="text-xs font-black text-slate-800 bg-white border border-slate-200 px-2.5 py-1 rounded-lg inline-block">
                {sourceQty || 0}
              </span>
            </div>
            <div>
              <span className="block text-slate-400 text-[9px] uppercase tracking-wider mb-0.5">Unit Price</span>
              <span className="text-xs font-black text-slate-800 font-mono bg-white border border-slate-200 px-2.5 py-1 rounded-lg inline-block">
                ₹{parseFloat(sourcePrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Transition Arrow Indicator */}
        <div className="flex flex-col items-center justify-center my-4 py-2 border-y border-slate-100">
          <ArrowDown className="text-indigo-500 animate-bounce" size={20} />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
            Manufacture To
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Target Item Selector */}
          <div className="relative" ref={dropdownRef}>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
              Select Output Manufactured Item Code <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search target item by code or description..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedTargetItem(null);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                autoComplete="off"
              />
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              
              {isLoadingItems && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="animate-spin text-slate-400" size={14} />
                </div>
              )}
            </div>

            {/* Suggestions Dropdown */}
            {showDropdown && itemsList.length > 0 && (
              <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-52 overflow-y-auto divide-y divide-slate-100 animate-fade-in">
                {itemsList.map((item) => (
                  <button
                    key={item.item_code}
                    type="button"
                    onClick={() => handleSelectTargetItem(item)}
                    className="w-full text-left px-4 py-2.5 hover:bg-indigo-50/50 transition-colors text-xs font-semibold cursor-pointer flex flex-col gap-0.5"
                  >
                    <span className="font-mono font-bold text-slate-800">{item.item_code}</span>
                    <span className="text-[10px] text-slate-500 line-clamp-1">{item.description || '—'}</span>
                  </button>
                ))}
              </div>
            )}
            
            {showDropdown && searchQuery && itemsList.length === 0 && !isLoadingItems && (
              <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg p-4 text-center text-xs font-semibold text-slate-400">
                No items found.
              </div>
            )}
          </div>

          {/* Details Form Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Quantity Used */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Quantity Used (Raw Material) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="1"
                max={sourceQty}
                placeholder={`Max: ${sourceQty}`}
                value={quantityUsed}
                onChange={(e) => setQuantityUsed(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Possible Produce Qty */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Expected Produce Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="1"
                placeholder="Possible output amount..."
                value={possibleQuantityProduced}
                onChange={(e) => setPossibleQuantityProduced(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Possible Cost Per Unit */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Possible Cost Per Unit (Cost Price) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                placeholder="₹ Possible unit cost..."
                value={costPerUnit}
                onChange={(e) => setCostPerUnit(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Manufacture Start Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Possible End Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Target Completion Date (Optional)
              </label>
              <input
                type="date"
                value={possibleEndDate}
                onChange={(e) => setPossibleEndDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Optional Message */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
              Run Description / Message (Optional)
            </label>
            <textarea
              placeholder="Enter manufacturing notes, batch IDs, or specifications..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows="3"
              className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          {/* Alert Warnings */}
          {quantityUsed && selectedTargetItem && (
            <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-xs font-semibold text-amber-800 shadow-sm animate-fade-in">
              <Info className="text-amber-500 flex-shrink-0 mt-0.5" size={14} />
              <div className="space-y-1">
                <p className="font-bold text-amber-900 leading-none">Material Staging Summary</p>
                <p className="text-amber-700/90 leading-relaxed">
                  Staging this run will instantly deduct <strong className="text-slate-800">{quantityUsed} units</strong> of raw material <strong className="text-slate-800">{sourceItemCode}</strong> from inventory. You can monitor and complete the run later to add the manufactured <strong className="text-slate-800">{selectedTargetItem.item_code}</strong> outputs back to inventory.
                </p>
              </div>
            </div>
          )}

          {/* Submit Actions */}
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
              disabled={isSaving || !selectedTargetItem}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-700"
            >
              {isSaving ? (
                <><Loader2 size={14} className="animate-spin" /> Staging Run...</>
              ) : (
                <>Stage Run</>
              )}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
