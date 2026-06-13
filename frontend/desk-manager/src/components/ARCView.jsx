import React, { useState, useEffect, useRef } from 'react';
import { Tag, Plus, Edit2, Trash2, Search, AlertCircle, RefreshCw, ArrowLeft, ListFilter } from 'lucide-react';

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'http://localhost:5000/api'
  : `${window.location.protocol}//${window.location.hostname}:5000/api`;

export default function ARCView({ items }) {
  const [arcItems, setArcItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // View mode & search states
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'form'
  const [searchQuery, setSearchQuery] = useState('');
  const [editingItemCode, setEditingItemCode] = useState(null);

  // Form State
  const [itemInput, setItemInput] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [price, setPrice] = useState('');
  
  // Autocomplete state
  const [showDropdown, setShowDropdown] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    fetchARCItems();
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (inputRef.current && !inputRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchARCItems = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/arc`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('dm_token')}` }
      });
      const data = await res.json();
      setArcItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleItemInput = (val) => {
    setItemInput(val);
    if (!val.trim()) {
      setSuggestions([]);
      setShowDropdown(false);
      setSelectedItem(null);
      return;
    }
    const filtered = items.filter(i => 
      i.item_code.toLowerCase().includes(val.toLowerCase()) || 
      (i.description && i.description.toLowerCase().includes(val.toLowerCase()))
    ).slice(0, 8);
    setSuggestions(filtered);
    setShowDropdown(true);
    if (!selectedItem || selectedItem.item_code !== val) {
      setSelectedItem(null);
    }
  };

  const handleSelectItem = (item) => {
    setItemInput(item.item_code);
    setSelectedItem(item);
    setShowDropdown(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedItem && itemInput) {
      // If user typed item code directly but didn't click
      const exactMatch = items.find(i => i.item_code.toLowerCase() === itemInput.toLowerCase());
      if (!exactMatch) return alert('Please select a valid item.');
      setSelectedItem(exactMatch);
    }

    const itemCode = selectedItem ? selectedItem.item_code : itemInput;
    if (!itemCode || !price) return alert('Item code and price are required');
    
    try {
      setIsLoading(true);
      const payload = { item_code: itemCode, price: parseFloat(price) };
      
      const isUpdate = !!editingItemCode;
      const url = isUpdate ? `${API_BASE_URL}/arc/${itemCode}` : `${API_BASE_URL}/arc`;
      const method = isUpdate ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('dm_token')}`
        },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Failed to save ARC item');
      } else {
        setItemInput('');
        setSelectedItem(null);
        setPrice('');
        setEditingItemCode(null);
        setViewMode('list');
        fetchARCItems();
      }
    } catch (e) {
      console.error(e);
      alert('Error saving ARC item');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (arc) => {
    setEditingItemCode(arc.item_code);
    setItemInput(arc.item_code);
    const fullItem = items.find(i => i.item_code === arc.item_code);
    setSelectedItem(fullItem || { item_code: arc.item_code, description: arc.description, drawing_number: arc.drawing_number });
    setPrice(arc.price);
    setViewMode('form');
  };

  const handleDelete = async (itemCode) => {
    if (!window.confirm('Are you sure you want to delete this ARC item?')) return;
    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE_URL}/arc/${itemCode}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('dm_token')}` }
      });
      if (!res.ok) throw new Error('Delete failed');
      fetchARCItems();
    } catch (e) {
      console.error(e);
      alert('Error deleting ARC item');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAddForm = () => {
    setEditingItemCode(null);
    setItemInput('');
    setSelectedItem(null);
    setPrice('');
    setViewMode('form');
  };

  const handleBackToDirectory = () => {
    setEditingItemCode(null);
    setItemInput('');
    setSelectedItem(null);
    setPrice('');
    setViewMode('list');
  };

  // Client-side filtering of ARC items
  const filteredArcItems = arcItems.filter((arc) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      arc.item_code.toLowerCase().includes(q) ||
      (arc.description && arc.description.toLowerCase().includes(q)) ||
      (arc.drawing_number && arc.drawing_number.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex-1 p-4 sm:p-8 lg:p-10 bg-[#f1f5f9] max-w-5xl mx-auto w-full text-slate-900">
      
      {viewMode === 'list' ? (
        <div className="space-y-6">
          {/* Header with New ARC Button */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 m-0">
                Annual Rate Contract (ARC)
              </h1>
              <p className="text-base text-slate-500 mt-1 font-medium">
                Manage special pricing contracts for items.
              </p>
            </div>
            <button
              onClick={handleOpenAddForm}
              className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm self-start sm:self-auto"
            >
              <Plus size={20} />
              New ARC Item
            </button>
          </div>

          {/* Search bar */}
          <div className="flex items-center gap-3 border-2 border-slate-200 rounded-xl px-4 py-4 bg-white shadow-sm">
            <Search size={22} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search ARC items by item code, description, or drawing number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent focus:outline-none text-lg text-slate-900 placeholder:text-slate-400 font-semibold"
            />
          </div>

          {/* ARC directory list */}
          <div className="border-2 border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
              <span className="text-sm font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <ListFilter size={16} className="text-blue-600" /> Current ARC List ({filteredArcItems.length})
              </span>
            </div>
            {filteredArcItems.length === 0 ? (
              <div className="p-16 text-center text-slate-400 text-lg font-semibold bg-white">
                {searchQuery ? 'No ARC items match your search.' : 'No ARC items added yet. Click "+ New ARC Item" to add one.'}
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {filteredArcItems.map(arc => (
                  <div 
                    key={arc.item_code} 
                    className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-slate-50/20 transition-colors bg-white"
                  >
                    <div className="min-w-0 space-y-2 flex-1">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-extrabold text-blue-750 bg-blue-50 border border-blue-200 px-3 py-1 rounded uppercase tracking-wider font-mono">
                          {arc.item_code}
                        </span>
                        {arc.drawing_number && (
                          <span className="text-xs text-slate-400 font-bold bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                            DRW: {arc.drawing_number}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-600 mt-1">
                        {arc.description}
                      </div>
                    </div>
                    <div className="flex items-center gap-6 shrink-0">
                      <div className="text-right">
                        <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5">Price</div>
                        <div className="font-black text-lg text-slate-800">
                          ₹{parseFloat(arc.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(arc)}
                          className="px-4 py-2 text-sm border-2 border-slate-200 hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg text-slate-700 font-bold bg-white transition-colors flex items-center gap-1.5 cursor-pointer"
                          title="Edit Price"
                        >
                          <Edit2 size={14} /> Update
                        </button>
                        <button
                          onClick={() => handleDelete(arc.item_code)}
                          className="px-4 py-2 text-sm border-2 border-red-200 hover:border-red-600 hover:text-red-600 hover:bg-red-50 rounded-lg text-red-600 font-bold bg-white transition-colors flex items-center gap-1.5 cursor-pointer"
                          title="Delete ARC Item"
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      ) : (
        
        /* Form View */
        <div className="space-y-6">
          {/* Header with Back Button */}
          <div className="pb-4 border-b border-slate-200">
            <button
              onClick={handleBackToDirectory}
              className="mb-4 text-sm font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer bg-slate-200 hover:bg-slate-300 px-4 py-2 rounded-lg transition-colors self-start"
            >
              <ArrowLeft size={16} />
              Back to Directory
            </button>
            <h1 className="text-3xl font-extrabold text-slate-900 m-0">
              {editingItemCode ? `Modify ARC Rate` : 'Register ARC Item'}
            </h1>
            <p className="text-base text-slate-500 mt-1 font-medium">
              {editingItemCode
                ? `Update special contract rate for item: ${editingItemCode}`
                : 'Set special annual pricing contract rate for catalog items.'}
            </p>
          </div>

          <div className="bg-white border-2 border-slate-200 rounded-xl p-5 sm:p-8 shadow-sm">
            <form onSubmit={handleSave} className="space-y-6">
              <div className="space-y-5">
                {/* Item Search Autocomplete */}
                <div className="relative" ref={inputRef}>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider">
                    Item Code <b className="text-red-500">*</b>
                  </label>
                  <input
                    type="text"
                    disabled={!!editingItemCode}
                    placeholder="Search by item code or description to link item..."
                    value={itemInput}
                    onChange={(e) => handleItemInput(e.target.value)}
                    onFocus={() => itemInput.trim() && setShowDropdown(true)}
                    className={`w-full px-4 py-3 border rounded-lg text-base text-slate-800 focus:outline-none placeholder:text-slate-400 font-medium
                      ${editingItemCode 
                        ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed font-semibold' 
                        : 'bg-white border-slate-300 focus:border-blue-600'
                      }
                    `}
                    autoComplete="off"
                  />
                  {showDropdown && suggestions.length > 0 && (
                    <div className="absolute z-30 w-full mt-1 bg-white border-2 border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                      {suggestions.map(i => (
                        <button
                          key={i.item_code}
                          type="button"
                          onClick={() => handleSelectItem(i)}
                          className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                        >
                          <div className="font-bold text-sm text-slate-900">{i.item_code}</div>
                          <div className="text-xs text-slate-500">{i.description}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedItem && (
                    <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                      <div className="text-xs font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-200 pb-1.5 mb-1">
                        Linked Item Specifications
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="font-semibold text-slate-500">Item Code:</span>{' '}
                          <span className="font-mono bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-blue-700 font-bold">
                            {selectedItem.item_code}
                          </span>
                        </div>
                        {selectedItem.drawing_number && (
                          <div>
                            <span className="font-semibold text-slate-500">Drawing No:</span>{' '}
                            <span className="font-mono bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-slate-700 font-bold">
                              {selectedItem.drawing_number}
                            </span>
                          </div>
                        )}
                        <div className="sm:col-span-2">
                          <span className="font-semibold text-slate-500 block mb-0.5">Description:</span>
                          <span className="text-slate-800 font-medium">{selectedItem.description}</span>
                        </div>
                        {selectedItem.long_description && (
                          <div className="sm:col-span-2">
                            <span className="font-semibold text-slate-500 block mb-0.5">Long Description:</span>
                            <span className="text-slate-650 text-xs whitespace-pre-wrap block bg-white border border-slate-200 rounded-lg p-2.5 font-sans leading-relaxed">
                              {selectedItem.long_description}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Price */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider">
                    Price (₹) <b className="text-red-500">*</b>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="0.00"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-base text-slate-900 focus:outline-none focus:border-blue-600 placeholder:text-slate-400 font-medium"
                  />
                </div>
              </div>

              {/* Action Buttons */}
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
                  disabled={isLoading || (!selectedItem && !itemInput.trim())}
                  className="px-10 py-4 rounded-lg font-bold text-base uppercase tracking-wider text-white transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-700"
                >
                  {isLoading ? 'Processing...' : editingItemCode ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" /> Update Details
                    </>
                  ) : (
                    <>
                      <Plus size={18} /> Save ARC Item
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
