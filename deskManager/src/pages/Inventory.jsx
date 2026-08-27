import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search,
  Edit2,
  Plus,
  RefreshCw,
  ArrowLeft,
  ListFilter,
  Package,
  MapPin,
  Tag,
  AlertCircle
} from 'lucide-react';
import { toast } from 'react-toastify';

const EMPTY_FORM = {
  item_code: '',
  quantity: '',
  price: '',
  location: '',
  rack: '',
  shelf_number: '',
  trade_id: '',
  message: '',
  p_item_id: ''
};

export default function InventoryView() {
  const navigate = useNavigate();
  const location = useLocation();
  const isFormRoute = location.pathname.endsWith('/form');
  const [viewMode, setViewMode] = useState(isFormRoute ? 'form' : 'list');
  const [inventoryList, setInventoryList] = useState([]);
  const [items, setItems] = useState([]);
  const [trades, setTrades] = useState([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [linkMetadata, setLinkMetadata] = useState(null);
  
  const [hasMore, setHasMore] = useState(true);
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const [showTradeDropdown, setShowTradeDropdown] = useState(false);

  const itemDropdownRef = useRef(null);
  const tradeDropdownRef = useRef(null);

  useEffect(() => {
    if (isFormRoute) {
      setViewMode('form');
      if (location.state?.autofill) {
        const fill = location.state.autofill;
        setEditingId(null);
        setFormData({
          item_code: fill.item_code || '',
          quantity: fill.quantity || '',
          price: fill.price || '',
          location: fill.existingDetails?.location || '',
          rack: fill.existingDetails?.rack || '',
          shelf_number: fill.existingDetails?.shelf_number || '',
          trade_id: fill.trade_id || '',
          message: fill.existingDetails?.message || ''
        });
        setLinkMetadata(fill);
      } else if (location.state?.editingInventory) {
        const item = location.state.editingInventory;
        setEditingId(item.id);
        setFormData({
          item_code: item.item_code || '',
          quantity: item.quantity || '',
          price: item.price || '',
          location: item.location || '',
          rack: item.rack || '',
          shelf_number: item.shelf_number || '',
          trade_id: item.trade_id || '',
          message: item.message || '',
          p_item_id: item.p_item_id || ''
        });
        setLinkMetadata(null);
      } else {
        setEditingId(null);
        setFormData(EMPTY_FORM);
        setLinkMetadata(null);
      }
    } else {
      setViewMode('list');
    }
  }, [location.pathname, location.state, isFormRoute]);

  // Handle click outside autocomplete suggestions
  useEffect(() => {
    function handleClickOutside(event) {
      if (itemDropdownRef.current && !itemDropdownRef.current.contains(event.target)) {
        setShowItemDropdown(false);
      }
      if (tradeDropdownRef.current && !tradeDropdownRef.current.contains(event.target)) {
        setShowTradeDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search for inventory list (offset-based)
  useEffect(() => {
    if (!isFormRoute) {
      const delayDebounceFn = setTimeout(() => {
        fetchInventory(false, searchQuery);
      }, 200);
      return () => clearTimeout(delayDebounceFn);
    }
  }, [searchQuery, isFormRoute]);

  // Debounced search for items (form datalist, limit 5)
  useEffect(() => {
    if (viewMode !== 'form') return;
    const trimmed = formData.item_code.trim();
    const delayDebounceFn = setTimeout(() => {
      fetchItems(trimmed);
    }, 200);

    return () => clearTimeout(delayDebounceFn);
  }, [formData.item_code, viewMode]);

  // Debounced search for Trades (form datalist, limit 5)
  useEffect(() => {
    if (viewMode !== 'form') return;
    const trimmed = formData.trade_id.trim();
    const delayDebounceFn = setTimeout(() => {
      fetchTrades(trimmed);
    }, 200);

    return () => clearTimeout(delayDebounceFn);
  }, [formData.trade_id, viewMode]);

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

  const fetchTrades = async (query = '') => {
    try {
      const res = await fetch(`/api/trades?q=${encodeURIComponent(query)}&limit=5`);
      if (res.ok) {
        setTrades(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch Trades:', err);
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

  const handleTradeInput = (val) => {
    setFormData(prev => ({ ...prev, trade_id: val }));
    setShowTradeDropdown(true);
  };

  const handleSelectTrade = (trade) => {
    setFormData(prev => ({ ...prev, trade_id: trade.trade_id }));
    setShowTradeDropdown(false);
  };

  const set = (field) => (e) =>
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  const handleOpenAddForm = () => {
    navigate('/inventory/form');
  };

  const handleEditClick = (item) => {
    navigate('/inventory/form', { state: { editingInventory: item } });
  };

  const handleBackToDirectory = () => {
    navigate(-1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.item_code) {
      toast.warn('Please select an item');
      return;
    }
    if (formData.quantity === '' || isNaN(parseInt(formData.quantity))) {
      toast.warn('Please enter a valid quantity');
      return;
    }

    setIsSaving(true);
    try {
      if (linkMetadata) {
        navigate(linkMetadata.returnUrl, {
          state: {
            returnState: linkMetadata.returnState,
            updatedQty: parseInt(formData.quantity) || 0,
            inventoryDetails: {
              price: parseFloat(formData.price) || 0.00,
              rack: formData.rack,
              shelf_number: formData.shelf_number,
              location: formData.location,
              message: formData.message
            }
          }
        });
        toast.success('Inventory stock configured in memory!');
        setIsSaving(false);
        return;
      }

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
        
        if (linkMetadata) {
          navigate(linkMetadata.returnUrl, {
            state: {
              returnState: linkMetadata.returnState,
              updatedQty: parseInt(formData.quantity) || 0
            }
          });
          return;
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

  return (
    <div className="flex-1 p-6 bg-slate-100 text-slate-900">
      {viewMode === 'list' ? (
        <div className="max-w-6xl mx-auto space-y-5">
          {/* Header */}
          <div className="flex justify-between items-center pb-4 border-b border-slate-300">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 m-0">Inventory Stock</h1>
              <p className="text-xs text-slate-500 mt-1">
                Monitor and manage physical item stock levels, warehouse locations, and pricing.
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
              placeholder="Search by item code, location, rack, shelf, trade ID..."
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
                Stock Records ({inventoryList.length})
              </span>
            </div>

            {isLoading && inventoryList.length === 0 ? (
              <div className="p-16 text-center text-slate-400 text-sm font-medium animate-pulse flex flex-col items-center justify-center gap-2">
                <RefreshCw size={24} className="animate-spin text-slate-400" />
                Loading inventory...
              </div>
            ) : inventoryList.length === 0 ? (
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
                        <th className="px-5 py-3 text-right">Quantity</th>
                        <th className="px-5 py-3 text-right">Price</th>
                        <th className="px-5 py-3">Trade ID</th>
                        <th className="px-5 py-3">P-Item ID</th>
                        <th className="px-5 py-3">Message</th>
                        <th className="px-5 py-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {inventoryList.map((item) => (
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

                          {/* Quantity */}
                          <td className="px-5 py-4 text-right font-black text-slate-900">
                            {item.quantity || 0}
                          </td>

                          {/* Price */}
                          <td className="px-5 py-4 text-right font-black text-slate-900 font-mono">
                            ₹{parseFloat(item.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>

                          {/* Linked Trade ID */}
                          <td className="px-5 py-4 font-mono font-bold text-slate-800">
                            {item.trade_id ? (
                              <span className="flex items-center gap-1 text-[11px]">
                                <Tag size={10} className="text-slate-400" />
                                {item.trade_id}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>

                          {/* P-Item ID */}
                          <td className="px-5 py-4 font-mono font-bold text-slate-800">
                            {item.p_item_id ? (
                              <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] shadow-sm">
                                P-{item.p_item_id}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>

                          {/* Message */}
                          <td className="px-5 py-4 text-slate-500 max-w-[200px] truncate" title={item.message}>
                            {item.message || '—'}
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
                            </div>
                          </td>
                        </tr>
                      ))}
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
              {linkMetadata && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-xs font-bold text-indigo-700 flex items-center gap-2">
                  <Tag size={14} className="shrink-0" />
                  <span>Linked P-Item ID: {linkMetadata.p_id}</span>
                </div>
              )}
              {formData.p_item_id && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-xs font-bold text-indigo-700 flex items-center gap-2">
                  <Tag size={14} className="shrink-0" />
                  <span>Linked P-Item ID: P-{formData.p_item_id}</span>
                </div>
              )}
              
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
                      onFocus={() => !editingId && !linkMetadata && setShowItemDropdown(true)}
                      disabled={!!editingId || !!linkMetadata}
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
                  {(editingId || linkMetadata) && (
                    <p className="text-[10px] text-slate-400 font-semibold mt-1 pl-1">
                      Item code cannot be changed once stock record is configured.
                    </p>
                  )}
                </div>

                {/* Link to Trade ID */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                    Link to Trade ID (Optional)
                  </label>
                  <div className="relative" ref={tradeDropdownRef}>
                    <input
                      type="text"
                      placeholder="Search by Trade ID..."
                      value={formData.trade_id}
                      onChange={(e) => handleTradeInput(e.target.value)}
                      onFocus={() => !editingId && !linkMetadata && setShowTradeDropdown(true)}
                      disabled={!!editingId || !!linkMetadata}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm font-medium focus:outline-none focus:border-[var(--theme-color)] disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                      autoComplete="off"
                    />
                    {showTradeDropdown && trades.length > 0 && (
                      <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto overflow-x-hidden animate-fade-in divide-y divide-slate-100">
                        {trades.map((t) => (
                          <button
                            key={t.trade_id}
                            type="button"
                            onClick={() => handleSelectTrade(t)}
                            className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors text-xs cursor-pointer flex flex-col gap-0.5"
                          >
                            <div className="font-bold text-slate-800 font-mono">{t.trade_id}</div>
                            <div className="text-[10px] text-slate-500 truncate font-semibold">Type: {t.trade_type} | Status: {t.status}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {(editingId || linkMetadata) && (
                    <p className="text-[10px] text-slate-400 font-semibold mt-1 pl-1">
                      Trade ID cannot be changed once stock record is configured.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Quantity */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                    Quantity <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="e.g. 500"
                    value={formData.quantity}
                    onChange={set('quantity')}
                    disabled={!!editingId}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm font-medium focus:outline-none focus:border-[var(--theme-color)] disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                  />
                  {editingId && (
                    <p className="text-[10px] text-slate-400 font-semibold mt-1 pl-1">
                      Quantity cannot be changed once stock record is created.
                    </p>
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
                    required
                    min="0"
                    placeholder="e.g. 15.50"
                    value={formData.price}
                    onChange={set('price')}
                    disabled={!!editingId || !!linkMetadata}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm font-medium focus:outline-none focus:border-[var(--theme-color)] disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                  />
                  {(editingId || linkMetadata) && (
                    <p className="text-[10px] text-slate-400 font-semibold mt-1 pl-1">
                      Price cannot be changed once stock record is configured.
                    </p>
                  )}
                </div>
              </div>

              {/* Location details */}
              <div className="border-t border-slate-200 pt-4 mt-2">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Warehouse Position</h3>
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

              {/* Message */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Message / Remarks
                </label>
                <textarea
                  rows={3}
                  placeholder="Enter any specific storage instructions or details..."
                  value={formData.message}
                  onChange={set('message')}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm font-medium focus:outline-none focus:border-[var(--theme-color)] resize-y"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-200 flex flex-wrap justify-between items-center gap-3">
                <div className="flex gap-2">
                  {editingId && (
                    <>
                      <button
                        type="button"
                        className="px-4 py-2 text-xs font-extrabold rounded text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-colors cursor-pointer"
                      >
                        Manufacture
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate('/inventory/sell', {
                          state: {
                            item_code: formData.item_code,
                            p_item_id: formData.p_item_id,
                            inventory_id: editingId,
                            quantity: formData.quantity,
                            price: formData.price,
                            source: 'inventory'
                          }
                        })}
                        className="px-4 py-2 text-xs font-extrabold rounded text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
                      >
                        Sell
                      </button>
                      <button
                        type="button"
                        className="px-4 py-2 text-xs font-extrabold rounded text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
                      >
                        Process
                      </button>
                    </>
                  )}
                </div>
                <div className="flex gap-3">
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
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
