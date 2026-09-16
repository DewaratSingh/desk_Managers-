import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Plus, Trash2, RefreshCw, Cpu, ArrowRight } from 'lucide-react';

const labelCls = "block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider";
const inputCls = "w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs placeholder:text-slate-400 font-semibold focus:outline-none focus:border-indigo-600 transition-colors disabled:bg-slate-100 disabled:text-slate-500";

function SearchableItemSelect({ value, onChange, items, placeholder }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);

  const selectedItem = items.find(it => String(it.id) === String(value));

  useEffect(() => {
    if (selectedItem) {
      setSearchTerm(`${selectedItem.item_code} - ${selectedItem.description}`);
    } else if (!value) {
      setSearchTerm('');
    }
  }, [value, selectedItem]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        if (selectedItem) {
          setSearchTerm(`${selectedItem.item_code} - ${selectedItem.description}`);
        } else if (!value) {
          setSearchTerm('');
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedItem, value]);

  const filteredItems = items.filter(it => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const codeMatches = (it.item_code || '').toLowerCase().includes(term);
    const descMatches = (it.description || '').toLowerCase().includes(term);
    const dwgMatches = (it.drawing_number || '').toLowerCase().includes(term);
    return codeMatches || descMatches || dwgMatches;
  });

  const handleSelect = (item) => {
    onChange(item.id);
    setSearchTerm(`${item.item_code} - ${item.description}`);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        type="text"
        placeholder={placeholder || "Search item..."}
        value={searchTerm}
        onChange={(e) => {
          const val = e.target.value;
          setSearchTerm(val);
          setIsOpen(true);
          if (selectedItem && val !== `${selectedItem.item_code} - ${selectedItem.description}`) {
            onChange('');
          }
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          // Short timeout to allow onMouseDown on suggestions to fire first
          setTimeout(() => {
            if (!value) {
              setSearchTerm('');
            } else if (selectedItem) {
              setSearchTerm(`${selectedItem.item_code} - ${selectedItem.description}`);
            }
          }, 150);
        }}
        className={inputCls}
      />
      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1 bg-white border border-slate-300 rounded-lg shadow-xl overflow-hidden max-h-52 overflow-y-auto text-xs">
          {filteredItems.length === 0 ? (
            <div className="px-3 py-2 text-slate-400 text-[11px] font-semibold italic">
              No matching items found
            </div>
          ) : (
            filteredItems.map(it => (
              <button
                key={it.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(it);
                }}
                onClick={() => handleSelect(it)}
                className={`w-full text-left px-3 py-2 hover:bg-indigo-50 border-b border-slate-100 last:border-0 cursor-pointer transition-colors ${
                  String(it.id) === String(value) ? 'bg-indigo-50 font-bold text-indigo-900' : 'text-slate-800'
                }`}
              >
                <div className="font-bold text-slate-900">
                  {it.item_code} <span className="text-slate-500 font-normal">({it.description})</span>
                </div>
                {it.drawing_number && (
                  <div className="text-[10px] text-slate-400">Dwg: {it.drawing_number}</div>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function ProcessRqForm() {
  const navigate = useNavigate();

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Seller search state
  const [seller, setSeller] = useState('');
  const [sellerInput, setSellerInput] = useState('');
  const [sellerSuggestions, setSellerSuggestions] = useState([]);
  const [showSellerDropdown, setShowSellerDropdown] = useState(false);
  const sellerRef = useRef(null);

  // Party search state
  const [party, setParty] = useState('');
  const [partyInput, setPartyInput] = useState('');
  const [partySuggestions, setPartySuggestions] = useState([]);
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);
  const partyRef = useRef(null);

  const [message, setMessage] = useState('');

  const [availableItems, setAvailableItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  // Table items: array of { source_item_id, source_item_quantity, target_item_id, target_item_quantity }
  const [processItems, setProcessItems] = useState([
    { source_item_id: '', source_item_quantity: 1, target_item_id: '', target_item_quantity: 1 }
  ]);

  useEffect(() => {
    fetchItems();
  }, []);

  // Debounced seller lookup
  useEffect(() => {
    const trimmed = sellerInput.trim();
    if (!trimmed) {
      setSellerSuggestions([]);
      setShowSellerDropdown(false);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/buyers?q=${encodeURIComponent(trimmed)}&limit=5`)
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) setSellerSuggestions(data);
        })
        .catch(console.error);
    }, 200);
    return () => clearTimeout(timer);
  }, [sellerInput]);

  // Debounced party lookup
  useEffect(() => {
    const trimmed = partyInput.trim();
    if (!trimmed) {
      setPartySuggestions([]);
      setShowPartyDropdown(false);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/customers?q=${encodeURIComponent(trimmed)}&limit=5`)
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) setPartySuggestions(data);
        })
        .catch(console.error);
    }, 200);
    return () => clearTimeout(timer);
  }, [partyInput]);

  // Dismiss seller/party dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sellerRef.current && !sellerRef.current.contains(e.target)) {
        setShowSellerDropdown(false);
      }
      if (partyRef.current && !partyRef.current.contains(e.target)) {
        setShowPartyDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchItems = async () => {
    setLoadingItems(true);
    try {
      const res = await fetch('/api/items');
      if (res.ok) {
        const data = await res.json();
        setAvailableItems(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch items:', err);
    } finally {
      setLoadingItems(false);
    }
  };

  const handleAddItemRow = () => {
    setProcessItems(prev => [
      ...prev,
      { source_item_id: '', source_item_quantity: 1, target_item_id: '', target_item_quantity: 1 }
    ]);
  };

  const handleRemoveItemRow = (index) => {
    if (processItems.length <= 1) {
      alert("At least one item mapping is required.");
      return;
    }
    setProcessItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index, field, value) => {
    setProcessItems(prev => prev.map((item, idx) => {
      if (idx !== index) return item;
      return { ...item, [field]: value };
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!date) {
      setError('Date is required.');
      return;
    }

    if (processItems.length === 0) {
      setError('At least one process item pair is required.');
      return;
    }

    for (let i = 0; i < processItems.length; i++) {
      const it = processItems[i];
      if (!it.source_item_id) {
        setError(`Please select a Source Item for row ${i + 1}.`);
        return;
      }
      if (!it.target_item_id) {
        setError(`Please select a Target Item for row ${i + 1}.`);
        return;
      }
      if (parseInt(it.source_item_quantity) <= 0) {
        setError(`Source quantity for row ${i + 1} must be greater than 0.`);
        return;
      }
      if (parseInt(it.target_item_quantity) <= 0) {
        setError(`Target quantity for row ${i + 1} must be greater than 0.`);
        return;
      }
    }

    setIsSaving(true);
    try {
      const payload = {
        date,
        seller,
        party,
        message,
        items: processItems.map(it => ({
          source_item_id: parseInt(it.source_item_id),
          source_item_quantity: parseInt(it.source_item_quantity),
          target_item_id: parseInt(it.target_item_id),
          target_item_quantity: parseInt(it.target_item_quantity)
        }))
      };

      const res = await fetch('/api/rq-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to create Process Trade Request');
      }

      const data = await res.json();
      navigate(`/trade/${encodeURIComponent(data.trade_id)}`);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error saving Process Trade Request.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loadingItems) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="animate-spin text-indigo-600" size={24} style={{ color: 'var(--theme-color)' }} />
          <p className="text-xs font-semibold text-slate-500">Loading catalog items…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 flex items-center justify-center">
      <div className="max-w-5xl w-full bg-white border border-slate-200 shadow-xl rounded-2xl p-5 sm:p-6 space-y-5 animate-fade-in">
        
        {/* Header */}
        <div className="pb-4 border-b border-slate-100 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-700">
              <Cpu size={20} />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-950 m-0">Create Process Trade Request</h1>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                Define process quotation details and map source items to expected target items.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl border border-slate-200 transition-colors shrink-0"
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3.5 text-xs font-bold text-red-600">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Header metadata inputs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className={labelCls}>Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputCls}
                required
              />
            </div>

            {/* Seller Lookup */}
            <div ref={sellerRef} className="relative">
              <label className={labelCls}>Seller / Processor</label>
              <input
                type="text"
                placeholder="Search seller vendor..."
                value={sellerInput}
                onChange={(e) => {
                  setSellerInput(e.target.value);
                  setSeller(e.target.value);
                  setShowSellerDropdown(true);
                }}
                onFocus={() => {
                  if (sellerInput.trim()) setShowSellerDropdown(true);
                }}
                className={inputCls}
                autoComplete="off"
              />
              {showSellerDropdown && sellerSuggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto text-xs">
                  {sellerSuggestions.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSellerInput(b.name);
                        setSeller(b.name);
                        setShowSellerDropdown(false);
                      }}
                      onClick={() => {
                        setSellerInput(b.name);
                        setSeller(b.name);
                        setShowSellerDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-indigo-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                    >
                      <div className="font-bold text-slate-900">{b.name}</div>
                      {(b.email || b.phone) && (
                        <div className="text-[10px] text-slate-500">{b.email} &bull; {b.phone}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Party Lookup */}
            <div ref={partyRef} className="relative">
              <label className={labelCls}>Party / Client</label>
              <input
                type="text"
                placeholder="Search party / customer..."
                value={partyInput}
                onChange={(e) => {
                  setPartyInput(e.target.value);
                  setParty(e.target.value);
                  setShowPartyDropdown(true);
                }}
                onFocus={() => {
                  if (partyInput.trim()) setShowPartyDropdown(true);
                }}
                className={inputCls}
                autoComplete="off"
              />
              {showPartyDropdown && partySuggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto text-xs">
                  {partySuggestions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setPartyInput(c.name);
                        setParty(c.name);
                        setShowPartyDropdown(false);
                      }}
                      onClick={() => {
                        setPartyInput(c.name);
                        setParty(c.name);
                        setShowPartyDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-indigo-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                    >
                      <div className="font-bold text-slate-900">{c.name}</div>
                      {c.address && (
                        <div className="text-[10px] text-slate-500 truncate">{c.address}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className={labelCls}>Process Message / Note</label>
              <input
                type="text"
                placeholder="e.g. Rust removal & zinc plating"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* Process Item Mappings Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Cpu size={14} className="text-indigo-600" />
                Process Item Conversion Mappings
              </h2>
              <button
                type="button"
                onClick={handleAddItemRow}
                className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
              >
                <Plus size={14} /> Add Item Pair
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl shadow-xs bg-white min-h-[220px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="px-3.5 py-2.5 w-12 text-center">#</th>
                    <th className="px-3.5 py-2.5">Source Item</th>
                    <th className="px-3.5 py-2.5 w-28 text-right">Source Qty</th>
                    <th className="px-3.5 py-2.5 text-center w-10"></th>
                    <th className="px-3.5 py-2.5">Target Item</th>
                    <th className="px-3.5 py-2.5 w-28 text-right">Target Qty</th>
                    <th className="px-3.5 py-2.5 text-center w-16">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                  {processItems.map((itemRow, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-3.5 py-3 text-center text-slate-400 font-bold">
                        {idx + 1}
                      </td>

                      {/* Source Item Select */}
                      <td className="px-3.5 py-3">
                        <SearchableItemSelect
                          value={itemRow.source_item_id}
                          onChange={(val) => handleItemChange(idx, 'source_item_id', val)}
                          items={availableItems}
                          placeholder="Search source item..."
                        />
                      </td>

                      {/* Source Item Qty */}
                      <td className="px-3.5 py-3">
                        <input
                          type="number"
                           
                          value={itemRow.source_item_quantity}
                          onChange={(e) => handleItemChange(idx, 'source_item_quantity', e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg font-bold text-right focus:outline-none focus:border-indigo-600"
                          required
                        />
                      </td>

                      {/* Conversion Arrow */}
                      <td className="px-2 py-3 text-center text-slate-400">
                        <ArrowRight size={16} className="mx-auto text-indigo-500" />
                      </td>

                      {/* Target Item Select */}
                      <td className="px-3.5 py-3">
                        <SearchableItemSelect
                          value={itemRow.target_item_id}
                          onChange={(val) => handleItemChange(idx, 'target_item_id', val)}
                          items={availableItems}
                          placeholder="Search target item..."
                        />
                      </td>

                      {/* Target Item Qty */}
                      <td className="px-3.5 py-3">
                        <input
                          type="number"
                           
                          value={itemRow.target_item_quantity}
                          onChange={(e) => handleItemChange(idx, 'target_item_quantity', e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg font-bold text-right focus:outline-none focus:border-indigo-600"
                          required
                        />
                      </td>

                      {/* Remove Action */}
                      <td className="px-3.5 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(idx)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Remove Row"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
              style={{ backgroundColor: 'var(--theme-color)' }}
              onMouseEnter={(e) => e.target.style.filter = 'brightness(0.9)'}
              onMouseLeave={(e) => e.target.style.filter = 'none'}
            >
              {isSaving ? (
                <><RefreshCw size={14} className="animate-spin" /> Creating Trade...</>
              ) : (
                'Create Process Trade'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

