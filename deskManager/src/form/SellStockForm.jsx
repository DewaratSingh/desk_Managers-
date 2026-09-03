import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Search, ShoppingBag, DollarSign, Calendar, MapPin, Loader2, Info } from 'lucide-react';
import { toast } from 'react-toastify';

export default function SellStockForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state || {};

  const {
    item_code: sourceItemCode = '',
    price: sourcePrice = 0,
    quantity: sourceQty = 0,
    p_item_id: pItemId = null,
    trace_item_id: traceItemId = null,
    inventory_id: inventoryId = null,
    source = 'inventory',
    returnState = null
  } = state;

  const [searchQuery, setSearchQuery] = useState('');
  const [trades, setTrades] = useState([]);
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [sellQty, setSellQty] = useState('');
  
  const [isLoadingTrades, setIsLoadingTrades] = useState(false);
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

  // Fetch eligible trades based on search query
  useEffect(() => {
    if (!sourceItemCode) return;
    
    const delayDebounce = setTimeout(() => {
      fetchEligibleTrades();
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, sourceItemCode]);

  const fetchEligibleTrades = async () => {
    setIsLoadingTrades(true);
    try {
      const url = `/api/inventory/sell/eligible-trades?item_code=${encodeURIComponent(sourceItemCode)}&q=${encodeURIComponent(searchQuery)}`;
      // Note: We mapped this under backend/routes/inventory.js so the prefix matches the registered path /api/inventory in App.js
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch eligible trades');
      const data = await res.json();
      setTrades(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load eligible trades');
    } finally {
      setIsLoadingTrades(false);
    }
  };

  const handleSelectTrade = (trade) => {
    setSelectedTrade(trade);
    setShowDropdown(false);
    setSearchQuery(trade.trade_id);
    
    // Default quantity to the smaller of available source qty or remaining order qty
    const remaining = trade.remaining_qty || 0;
    const defaultQty = Math.min(parseInt(sourceQty) || 0, remaining);
    setSellQty(defaultQty > 0 ? defaultQty.toString() : '');
  };

  const handleCancel = () => {
    if (source === 'delivery_note' && returnState) {
      navigate('/addDeliveryNote', { state: { returnState } });
    } else {
      navigate('/inventory');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTrade) {
      toast.error('Please select an eligible trade.');
      return;
    }

    const qty = parseInt(sellQty, 10);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Please enter a valid quantity greater than 0.');
      return;
    }

    if (qty > (parseInt(sourceQty) || 0)) {
      toast.error(`Cannot sell more than available source quantity of ${sourceQty}.`);
      return;
    }

    if (qty > selectedTrade.remaining_qty) {
      toast.error(`Quantity exceeds remaining ordered amount of ${selectedTrade.remaining_qty} in selected trade.`);
      return;
    }

    navigate(`/addDeliveryNote?trade_id=${encodeURIComponent(selectedTrade.trade_id)}`, {
      state: {
        autofillSell: {
          item_code: sourceItemCode,
          delivery_qty: qty,
          inventory_id: inventoryId,
          p_item_id: traceItemId || pItemId,
          trace_item_id: traceItemId || pItemId,
          source: source,
          trade_db_id: selectedTrade.trade_db_id,
          returnState: returnState
        }
      }
    });
  };

  return (
    <main className="min-h-[calc(100vh-72px)] p-6 text-slate-700 bg-slate-50 font-sans">
      <div className="mx-auto max-w-2xl bg-white border border-slate-200 rounded-3xl p-8 shadow-xl shadow-slate-200/50">
        
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
            <h1 className="text-lg font-black text-slate-800 uppercase tracking-wide">
              Sell Allocation Form
            </h1>
            <p className="text-xs text-slate-400 font-semibold">
              Generate customer Delivery Notes and link process trades
            </p>
          </div>
        </div>

        {/* Info Grid */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 grid grid-cols-3 gap-4 mb-6 shadow-inner text-xs font-semibold">
          <div>
            <span className="block text-slate-400 font-bold uppercase tracking-wider mb-1 text-[9px]">Item Code</span>
            <span className="font-mono text-xs font-black text-slate-800 bg-white border border-slate-200 px-2.5 py-1 rounded-lg inline-block">
              {sourceItemCode || '—'}
            </span>
          </div>
          <div>
            <span className="block text-slate-400 font-bold uppercase tracking-wider mb-1 text-[9px]">Source Available Qty</span>
            <span className="text-xs font-black text-slate-800 bg-white border border-slate-200 px-2.5 py-1 rounded-lg inline-block">
              {sourceQty || 0}
            </span>
          </div>
          <div>
            <span className="block text-slate-400 font-bold uppercase tracking-wider mb-1 text-[9px]">Source Unit Price</span>
            <span className="text-xs font-black text-slate-800 font-mono bg-white border border-slate-200 px-2.5 py-1 rounded-lg inline-block">
              ₹{parseFloat(sourcePrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Trade Autocomplete Input */}
          <div className="relative" ref={dropdownRef}>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
              Link to Customer Order Trade (SELL/ARC) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search by Trade ID / RFQ code..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedTrade(null);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                autoComplete="off"
              />
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              
              {isLoadingTrades && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="animate-spin text-slate-400" size={14} />
                </div>
              )}
            </div>

            {/* Dropdown Options */}
            {showDropdown && trades.length > 0 && (
              <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto divide-y divide-slate-100 animate-fade-in">
                {trades.map((t) => (
                  <button
                    key={t.trade_db_id}
                    type="button"
                    onClick={() => handleSelectTrade(t)}
                    className="w-full text-left px-4 py-3 hover:bg-indigo-50/50 transition-colors text-xs font-semibold cursor-pointer flex flex-col gap-1"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-mono font-bold text-slate-800">{t.trade_id}</span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                        t.trade_type === 'ARC' 
                          ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                          : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                      }`}>
                        {t.trade_type}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 flex flex-wrap gap-x-4 gap-y-0.5">
                      <span>Ref: <strong className="text-slate-700">{t.po_no || '—'}</strong></span>
                      <span>Rate: <strong className="text-slate-700 font-mono">₹{parseFloat(t.po_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                      <span>Remaining: <strong className="text-indigo-600">{t.remaining_qty}</strong></span>
                    </div>
                  </button>
                ))}
              </div>
            )}
            
            {showDropdown && searchQuery && trades.length === 0 && !isLoadingTrades && (
              <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg p-4 text-center text-xs font-semibold text-slate-400">
                No eligible trades found containing this item code.
              </div>
            )}
          </div>

          {/* Selected Trade Preview Card */}
          {selectedTrade && (
            <div className="border border-slate-200 bg-indigo-50/20 rounded-2xl p-5 space-y-3 animate-fade-in text-xs font-semibold text-slate-600">
              <h3 className="font-bold text-slate-800 uppercase tracking-wide text-[10px] flex items-center gap-1.5">
                <ShoppingBag size={12} className="text-indigo-500" />
                Target Order Configuration
              </h3>
              
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-100 pt-3">
                <div className="flex justify-between">
                  <span className="text-slate-400">PO / RO reference</span>
                  <span className="font-mono text-slate-900 font-bold">{selectedTrade.po_no || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Unit Price in PO</span>
                  <span className="font-mono text-slate-950 font-bold">₹{parseFloat(selectedTrade.po_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Order Qty</span>
                  <span className="text-slate-900 font-bold">{selectedTrade.order_qty}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Remaining to Deliver</span>
                  <span className="text-indigo-600 font-black">{selectedTrade.remaining_qty}</span>
                </div>
              </div>
              
              {selectedTrade.shipping_address && (
                <div className="border-t border-slate-100 pt-2 flex items-start gap-1">
                  <MapPin size={12} className="text-slate-400 mt-0.5" />
                  <div className="flex-1">
                    <span className="text-[10px] text-slate-400 block">Shipping Destination</span>
                    <span className="text-slate-800 text-[11px] leading-snug">{selectedTrade.shipping_address}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quantity Input & Price Check */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Quantity to Sell <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="1"
                max={selectedTrade ? Math.min(parseInt(sourceQty) || 0, selectedTrade.remaining_qty) : sourceQty}
                placeholder="Enter dispatch amount..."
                value={sellQty}
                onChange={(e) => setSellQty(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Price comparisons side-by-side */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Purchase/Stock Rate</span>
                <span className="text-sm font-black text-slate-700 font-mono">
                  ₹{parseFloat(sourcePrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="border-l border-slate-200 pl-4 h-full flex flex-col justify-center">
                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Customer PO Rate</span>
                <span className="text-sm font-black text-indigo-700 font-mono">
                  {selectedTrade ? `₹${parseFloat(selectedTrade.po_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Alert Warnings */}
          {selectedTrade && sellQty && (
            <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-xs font-semibold text-amber-800 shadow-sm animate-fade-in">
              <Info className="text-amber-500 flex-shrink-0 mt-0.5" size={14} />
              <div className="space-y-1">
                <p className="font-bold text-amber-900 leading-none">Automated Transaction Summary</p>
                <p className="text-amber-700/90 leading-relaxed">
                  Upon completion, this will issue an automated customer Delivery Note under trade <strong className="text-slate-800">{selectedTrade.trade_id}</strong> for <strong className="text-slate-800">{sellQty} units</strong> at <strong className="text-slate-800 font-mono">₹{parseFloat(selectedTrade.po_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} each</strong>.
                  {pItemId ? ` This trade will also be appended to process linkages for P-${pItemId}.` : ''}
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
              disabled={isSaving || !selectedTrade}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-700"
            >
              {isSaving ? (
                <><Loader2 size={14} className="animate-spin" /> Issuing Note...</>
              ) : (
                <>Make Delivery Note</>
              )}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
