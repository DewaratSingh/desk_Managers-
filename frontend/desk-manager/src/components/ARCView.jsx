import React, { useState, useEffect, useRef } from 'react';
import { Tag, Plus, Edit2, Trash2, Search, AlertCircle, RefreshCw } from 'lucide-react';

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'http://localhost:5000/api'
  : `${window.location.protocol}//${window.location.hostname}:5000/api`;

export default function ARCView({ items }) {
  const [arcItems, setArcItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
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
      
      const isUpdate = arcItems.some(a => a.item_code === itemCode);
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
    setItemInput(arc.item_code);
    setSelectedItem({ item_code: arc.item_code, description: arc.description });
    setPrice(arc.price);
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

  return (
    <div className="flex-1 p-4 sm:p-8 lg:p-10 bg-[#f1f5f9] max-w-5xl mx-auto w-full text-slate-900">
      <div className="space-y-6">
        <div className="pb-4 border-b border-slate-200">
          <h1 className="text-3xl font-extrabold text-slate-900 m-0">Annual Rate Contract (ARC)</h1>
          <p className="text-base text-slate-500 mt-1 font-medium">Manage special pricing for items.</p>
        </div>

        {/* Add/Edit Form */}
        <div className="bg-white border-2 border-slate-200 rounded-xl p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Tag size={18} className="text-blue-600" /> 
            Add / Update ARC Item
          </h2>
          <form onSubmit={handleSave} className="flex flex-col sm:flex-row gap-4 items-start">
            <div className="flex-1 w-full relative" ref={inputRef}>
              <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider">Item Search</label>
              <input
                type="text"
                placeholder="Search by item code or description..."
                value={itemInput}
                onChange={(e) => handleItemInput(e.target.value)}
                onFocus={() => itemInput.trim() && setShowDropdown(true)}
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-600"
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
                <div className="mt-2 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded px-2 py-1">
                  Selected: {selectedItem.description}
                </div>
              )}
            </div>
            <div className="w-full sm:w-48">
              <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider">Price (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>
            <div className="pt-6 shrink-0 mt-0.5">
              <button 
                type="submit" 
                disabled={isLoading || (!selectedItem && !itemInput.trim())}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer h-11"
              >
                {isLoading ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />} Save
              </button>
            </div>
          </form>
        </div>

        {/* ARC List */}
        <div className="border-2 border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
            <span className="text-sm font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Tag size={16} className="text-blue-600" /> Current ARC List ({arcItems.length})
            </span>
          </div>
          {arcItems.length === 0 ? (
            <div className="p-16 text-center text-slate-400 text-lg font-semibold">No ARC items added yet.</div>
          ) : (
            <div className="divide-y divide-slate-200">
              {arcItems.map(arc => (
                <div key={arc.item_code} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white hover:bg-slate-50 transition-colors">
                  <div className="flex-1">
                    <div className="font-mono font-extrabold text-sm text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded inline-block mb-1">
                      {arc.item_code}
                    </div>
                    {arc.drawing_number && <span className="text-xs text-slate-400 ml-2">DRW: {arc.drawing_number}</span>}
                    <div className="text-sm text-slate-600">{arc.description}</div>
                  </div>
                  <div className="flex items-center gap-6 shrink-0">
                    <div className="text-right">
                      <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Price</div>
                      <div className="font-black text-lg text-slate-800">₹{parseFloat(arc.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleEdit(arc)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit Price">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => handleDelete(arc.item_code)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete ARC Item">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
