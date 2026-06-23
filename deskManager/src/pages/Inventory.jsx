import { useState, useEffect, useRef } from 'react';
import {
  Search,
  Edit2,
  Plus,
  RefreshCw,
  ArrowLeft,
  ListFilter,
  Trash2,
  Package,
  MapPin,
  Tag,
  AlertCircle
} from 'lucide-react';
import { toast } from 'react-toastify';

const EMPTY_FORM = {
  item_code: '',
  quantity_in_stock: '',
  unit: 'Piece',
  location: '',
  rack: '',
  shelf_number: '',
  allocated_quantity: '0',
  rfq_no: '',
  notes: ''
};

export default function InventoryView() {
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'form'
  const [inventoryList, setInventoryList] = useState([]);
  const [items, setItems] = useState([]);
  const [rfqs, setRfqs] = useState([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  
  const [hasMore, setHasMore] = useState(true);
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const [showRfqDropdown, setShowRfqDropdown] = useState(false);

  const itemDropdownRef = useRef(null);
  const rfqDropdownRef = useRef(null);

  const units = ['Piece', 'Kg', 'Meter', 'Box', 'Set', 'Liter', 'Ton', 'Nos'];

  // Handle click outside autocomplete suggestions
  useEffect(() => {
    function handleClickOutside(event) {
      if (itemDropdownRef.current && !itemDropdownRef.current.contains(event.target)) {
        setShowItemDropdown(false);
      }
      if (rfqDropdownRef.current && !rfqDropdownRef.current.contains(event.target)) {
        setShowRfqDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search for inventory list (offset-based)
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchInventory(false, searchQuery);
    }, 200);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Debounced search for items (form datalist, limit 5)
  useEffect(() => {
    if (viewMode !== 'form') return;
    const trimmed = formData.item_code.trim();
    const delayDebounceFn = setTimeout(() => {
      fetchItems(trimmed);
    }, 200);

    return () => clearTimeout(delayDebounceFn);
  }, [formData.item_code, viewMode]);

  // Debounced search for RFQs (form datalist, limit 5)
  useEffect(() => {
    if (viewMode !== 'form') return;
    const trimmed = formData.rfq_no.trim();
    const delayDebounceFn = setTimeout(() => {
      fetchRfqs(trimmed);
    }, 200);

    return () => clearTimeout(delayDebounceFn);
  }, [formData.rfq_no, viewMode]);

  const fetchInventory = async (isLoadMore = false, query = searchQuery) => {
    setIsLoading(true);
    try {
      const currentOffset = isLoadMore ? inventoryList.length : 0;
      const res = await fetch(`/api/inventory?q=${encodeURIComponent(query)}&limit=20&offset=${currentOffset}`);
      if (res.ok) {
        const data = await res.json();
        if (isLoadMore) {
          setInventoryList(prev => [...prev, ...data]);
        } else {
          setInventoryList(data);
        }
        if (data.length < 20) {
          setHasMore(false);
        } else {
          setHasMore(true);
        }
      }
    } catch (err) {
      console.error('Failed to fetch inventory:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchItems = async (query = '') => {
    try {
      const res = await fetch(`/api/items?q=${encodeURIComponent(query)}&limit=5`);
      if (res.ok) {
        setItems(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch items:', err);
    }
  };

  const fetchRfqs = async (query = '') => {
    try {
      const res = await fetch(`/api/rfqs?q=${encodeURIComponent(query)}&limit=5`);
      if (res.ok) {
        setRfqs(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch RFQs:', err);
    }
  };

  const handleItemInput = (val) => {
    setFormData(prev => ({ ...prev, item_code: val }));
    setShowItemDropdown(true);
  };

  const handleSelectItem = (item) => {
    setFormData(prev => ({ ...prev, item_code: item.item_code }));
    setShowItemDropdown(false);
  };

  const handleRfqInput = (val) => {
    setFormData(prev => ({ ...prev, rfq_no: val }));
    setShowRfqDropdown(true);
  };

  const handleSelectRfq = (rfq) => {
    setFormData(prev => ({ ...prev, rfq_no: rfq.rfq_no }));
    setShowRfqDropdown(false);
  };

  const set = (field) => (e) =>
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  const handleOpenAddForm = () => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setViewMode('form');
  };

  const handleEditClick = (item) => {
    setEditingId(item.id);
    setFormData({
      item_code: item.item_code || '',
      quantity_in_stock: item.quantity_in_stock || '',
      unit: item.unit || 'Piece',
      location: item.location || '',
      rack: item.rack || '',
      shelf_number: item.shelf_number || '',
      allocated_quantity: item.allocated_quantity || '0',
      rfq_no: item.rfq_no || '',
      notes: item.notes || ''
    });
    setViewMode('form');
  };

  const handleDeleteClick = async (id) => {
    if (!window.confirm('Are you sure you want to delete this inventory record?')) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/inventory/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setInventoryList(prev => prev.filter(item => item.id !== id));
        toast.success('Inventory record deleted successfully!');
      } else {
        const errData = await res.json();
        toast.error(errData.error || 'Failed to delete inventory record');
      }
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('An error occurred while deleting the record');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToDirectory = () => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setViewMode('list');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.item_code) {
      toast.warn('Please select an item');
      return;
    }
    if (formData.quantity_in_stock === '' || isNaN(parseFloat(formData.quantity_in_stock))) {
      toast.warn('Please enter a valid quantity in stock');
      return;
    }

    setIsSaving(true);
    try {
      const url = editingId ? `/api/inventory/${editingId}` : '/api/inventory';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        const saved = await res.json();
        if (editingId) {
          setInventoryList(prev => prev.map(item => item.id === editingId ? saved : item));
          toast.success('Inventory record updated successfully!');
        } else {
          setInventoryList(prev => [saved, ...prev]);
          toast.success('Inventory record added successfully!');
        }
        handleBackToDirectory();
      } else {
        const errData = await res.json();
        toast.error(errData.error || 'Failed to save inventory record');
      }
    } catch (err) {
      console.error(err);
      toast.error('An error occurred while saving inventory record');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredInventory = inventoryList;

  return (
    <div className="flex-1 p-6 bg-slate-100 text-slate-900">
      {viewMode === 'list' ? (
        <div className="max-w-6xl mx-auto space-y-5">
          {/* Header */}
          <div className="flex justify-between items-center pb-4 border-b border-slate-300">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 m-0">Inventory Stock</h1>
              <p className="text-xs text-slate-500 mt-1">
                Monitor and manage physical item stock levels, warehouse locations, and allocations.
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
              Add Inventory
            </button>
          </div>

          {/* Search Bar */}
          <div 
            className="flex items-center gap-2.5 border border-slate-300 rounded-lg px-3 py-2.5 bg-white shadow-sm transition-colors"
            style={{ borderColor: searchFocused ? 'var(--theme-color)' : 'rgb(203, 213, 225)' }}
          >
            <Search size={18} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search by item code, description, location, rack, shelf..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="w-full bg-transparent focus:outline-none text-sm text-slate-900 placeholder:text-slate-400 font-medium"
            />
          </div>

          {/* Directory Grid */}
          <div className="border border-slate-300 rounded-lg overflow-hidden bg-white shadow-sm">
            <div className="bg-slate-50 px-5 py-3.5 border-b border-slate-300 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <ListFilter size={14} style={{ color: 'var(--theme-color)' }} />
                Stock Records ({filteredInventory.length})
              </span>
            </div>

            {isLoading && inventoryList.length === 0 ? (
              <div className="p-16 text-center text-slate-400 text-sm font-medium animate-pulse flex flex-col items-center justify-center gap-2">
                <RefreshCw size={24} className="animate-spin text-slate-400" />
                Loading inventory...
              </div>
            ) : filteredInventory.length === 0 ? (
              <div className="p-16 text-center text-slate-400 text-sm font-medium flex flex-col items-center justify-center gap-2">
                <Package size={32} className="text-slate-300" />
                <span>No stock records found. Click "Add Inventory" to create one.</span>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                      <th className="px-5 py-3">Item Details</th>
                      <th className="px-5 py-3">Location Details</th>
                      <th className="px-5 py-3 text-right">In Stock</th>
                      <th className="px-5 py-3 text-right">Allocated</th>
                      <th className="px-5 py-3 text-right">Available</th>
                      <th className="px-5 py-3">Linked RFQ</th>
                      <th className="px-5 py-3">Notes</th>
                      <th className="px-5 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {filteredInventory.map((item) => {
                      const qty = parseFloat(item.quantity_in_stock) || 0;
                      const allocated = parseInt(item.allocated_quantity) || 0;
                      const available = qty - allocated;
                      const hasLowStock = available <= 0;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* Item details */}
                          <td className="px-5 py-4 min-w-[200px]">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <Package size={14} className="text-slate-400 shrink-0" />
                              {item.item_code}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 truncate max-w-[250px]" title={item.description}>
                              {item.description || '—'}
                            </div>
                            {item.drawing_number && (
                              <span className="inline-block bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.5 rounded border border-slate-200 font-semibold mt-1">
                                Drw: {item.drawing_number}
                              </span>
                            )}
                          </td>

                          {/* Location */}
                          <td className="px-5 py-4">
                            <div className="font-semibold text-slate-800 flex items-center gap-1">
                              <MapPin size={12} className="text-slate-400 shrink-0" />
                              {item.location || '—'}
                            </div>
                            {(item.rack || item.shelf_number) && (
                              <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                                {item.rack && `Rack: ${item.rack}`}
                                {item.rack && item.shelf_number && ' | '}
                                {item.shelf_number && `Shelf: ${item.shelf_number}`}
                              </div>
                            )}
                          </td>

                          {/* Stock numbers */}
                          <td className="px-5 py-4 text-right font-black text-slate-900">
                            {qty} <span className="text-[10px] font-bold text-slate-400">{item.unit || 'Piece'}</span>
                          </td>
                          <td className="px-5 py-4 text-right font-bold text-slate-500">
                            {allocated}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <span className={`font-black ${hasLowStock ? 'text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded' : 'text-green-600'}`}>
                              {available}
                            </span>
                          </td>

                          {/* Linked RFQ */}
                          <td className="px-5 py-4 font-mono font-bold text-slate-800">
                            {item.rfq_no ? (
                              <span className="flex items-center gap-1 text-[11px]">
                                <Tag size={10} className="text-slate-400" />
                                {item.rfq_no}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>

                          {/* Notes */}
                          <td className="px-5 py-4 text-slate-500 max-w-[200px] truncate" title={item.notes}>
                            {item.notes || '—'}
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleEditClick(item)}
                                className="p-1.5 border border-slate-300 rounded text-slate-600 hover:text-[var(--theme-color)] hover:border-[var(--theme-color)] bg-white transition-colors cursor-pointer"
                                title="Edit Stock"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                onClick={() => handleDeleteClick(item.id)}
                                className="p-1.5 border border-slate-300 rounded text-slate-400 hover:text-red-600 hover:border-red-300 bg-white transition-colors cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Show More Button */}
              {hasMore && (
                <div className="flex justify-center mt-5 animate-fade-in">
                  <button
                    type="button"
                    onClick={() => fetchInventory(true, searchQuery)}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 px-5 py-2.5 bg-white border border-slate-300 hover:border-slate-400 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <><RefreshCw size={12} className="animate-spin text-slate-400" /> Loading...</>
                    ) : (
                      'Show More'
                    )}
                  </button>
                </div>
              )}
              </>
            )}
          </div>
        </div>
      ) : (
        /* ================================================================
            FORM MODE: ADD / EDIT
           ================================================================ */
        <div className="max-w-3xl mx-auto space-y-5">
          <button
            onClick={handleBackToDirectory}
            className="mb-3 text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer bg-slate-200 hover:bg-slate-300 px-3 py-1.5 rounded-lg transition-colors self-start"
          >
            <ArrowLeft size={14} />
            Back to Stock
          </button>

          <h1 className="text-2xl font-bold text-slate-900 m-0">
            {editingId ? 'Update Stock Record' : 'Record New Stock'}
          </h1>

          <div className="bg-white border border-slate-300 rounded-lg p-6 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-5">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Item Code Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                    Catalog Item <span className="text-red-500">*</span>
                  </label>
                  <div className="relative" ref={itemDropdownRef}>
                    <input
                      type="text"
                      required
                      placeholder="Search by item code or description..."
                      value={formData.item_code}
                      onChange={(e) => handleItemInput(e.target.value)}
                      onFocus={() => setShowItemDropdown(true)}
                      disabled={!!editingId}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm font-medium focus:outline-none focus:border-[var(--theme-color)] disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                      autoComplete="off"
                    />
                    {showItemDropdown && items.length > 0 && (
                      <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto overflow-x-hidden animate-fade-in divide-y divide-slate-100">
                        {items.map((item) => (
                          <button
                            key={item.item_code}
                            type="button"
                            onClick={() => handleSelectItem(item)}
                            className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors text-xs cursor-pointer flex flex-col gap-0.5"
                          >
                            <div className="font-bold text-slate-800">{item.item_code}</div>
                            <div className="text-[10px] text-slate-500 truncate font-semibold">{item.description}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {editingId && (
                    <p className="text-[10px] text-slate-400 font-semibold mt-1 pl-1">
                      Item code cannot be changed once stock record is created.
                    </p>
                  )}
                </div>

                {/* Unit Select */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                    Unit of Measurement
                  </label>
                  <input
                    type="text"
                    list="units-datalist"
                    required
                    placeholder="Search or type unit..."
                    value={formData.unit}
                    onChange={set('unit')}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm font-medium focus:outline-none focus:border-[var(--theme-color)]"
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Quantity in stock */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                    Quantity In Stock <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    min="0"
                    placeholder="e.g. 500"
                    value={formData.quantity_in_stock}
                    onChange={set('quantity_in_stock')}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm font-medium focus:outline-none focus:border-[var(--theme-color)]"
                  />
                </div>

                {/* Allocated Quantity */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                    Allocated Quantity
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 50"
                    value={formData.allocated_quantity}
                    onChange={set('allocated_quantity')}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm font-medium focus:outline-none focus:border-[var(--theme-color)]"
                  />
                </div>

                {/* RFQ No Link */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                    Link to RFQ (Optional)
                  </label>
                  <div className="relative" ref={rfqDropdownRef}>
                    <input
                      type="text"
                      placeholder="Search by RFQ number..."
                      value={formData.rfq_no}
                      onChange={(e) => handleRfqInput(e.target.value)}
                      onFocus={() => setShowRfqDropdown(true)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm font-medium focus:outline-none focus:border-[var(--theme-color)]"
                      autoComplete="off"
                    />
                    {showRfqDropdown && rfqs.length > 0 && (
                      <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto overflow-x-hidden animate-fade-in divide-y divide-slate-100">
                        {rfqs.map((rfq) => (
                          <button
                            key={rfq.rfq_no}
                            type="button"
                            onClick={() => handleSelectRfq(rfq)}
                            className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors text-xs cursor-pointer flex flex-col gap-0.5"
                          >
                            <div className="font-bold text-slate-800">{rfq.rfq_no}</div>
                            <div className="text-[10px] text-slate-500 truncate font-semibold">{rfq.customer_name}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Location details */}
              <div className="border-t border-slate-200 pt-4 mt-2">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Warehouse Location</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1.5">
                      Warehouse Location
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Warehouse A"
                      value={formData.location}
                      onChange={set('location')}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm font-medium focus:outline-none focus:border-[var(--theme-color)]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1.5">
                      Rack Number / Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Rack-03"
                      value={formData.rack}
                      onChange={set('rack')}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm font-medium focus:outline-none focus:border-[var(--theme-color)]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1.5">
                      Shelf Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Shelf-12"
                      value={formData.shelf_number}
                      onChange={set('shelf_number')}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm font-medium focus:outline-none focus:border-[var(--theme-color)]"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Internal Remarks / Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Enter any specific storage instructions or details..."
                  value={formData.notes}
                  onChange={set('notes')}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm font-medium focus:outline-none focus:border-[var(--theme-color)] resize-y"
                />
              </div>

              {/* Submit Buttons */}
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
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded text-sm font-bold text-white transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: 'var(--theme-color)' }}
                  onMouseEnter={(e) => e.target.style.filter = 'brightness(0.9)'}
                  onMouseLeave={(e) => e.target.style.filter = 'none'}
                >
                  {isSaving ? (
                    <><RefreshCw size={14} className="animate-spin" /> Saving...</>
                  ) : editingId ? (
                    <><RefreshCw size={14} /> Update Stock</>
                  ) : (
                    <><Plus size={14} /> Add Stock</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Autocomplete Datalists */}
      <datalist id="units-datalist">
        {units.map(u => (
          <option key={u} value={u} />
        ))}
      </datalist>
    </div>
  );
}
