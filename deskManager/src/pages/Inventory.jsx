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
  AlertCircle,
  CheckCircle2,
  Layers,
  Building2
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
  status: '',
  trace_item_id: '',
  trace_process: []
};

const fmtQty = (val) => {
  const num = parseFloat(val);
  if (isNaN(num)) return '0';
  return Number(num.toFixed(4)).toString();
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
  
  const [existingPositions, setExistingPositions] = useState([]);
  const [selectedPositionId, setSelectedPositionId] = useState(null);
  const [isLoadingPositions, setIsLoadingPositions] = useState(false);

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
        const processList = fill.trade_id ? [{ type: 'BUY', id: fill.trade_id, unit_price: parseFloat(fill.price) || 0.00 }] : [];
        setFormData({
          item_code: fill.item_code || '',
          quantity: fill.quantity || '',
          price: fill.price || '',
          location: fill.existingDetails?.location || '',
          rack: fill.existingDetails?.rack || '',
          shelf_number: fill.existingDetails?.shelf_number || '',
          trade_id: fill.trade_id || '',
          message: fill.existingDetails?.message || '',
          status: fill.status || '',
          trace_process: processList
        });
        setLinkMetadata(fill);
      } else if (location.state?.editingInventory) {
        const item = location.state.editingInventory;
        setEditingId(item.id);
        setFormData({
          item_code: item.item_code || '',
          quantity: item.quantity || '',
          price: item.price || '',
          calculated_price: item.calculated_price || item.price || '',
          location: item.location || '',
          rack: item.rack || '',
          shelf_number: item.shelf_number || '',
          trade_id: item.trade_id || '',
          message: item.message || '',
          status: item.trace_status || item.status || 'active',
          trace_item_id: item.trace_item_id || item.p_item_id || '',
          trace_process: item.trace_process || []
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

  // Auto-fetch process traceability breakdown when item_code is selected in form mode
  useEffect(() => {
    if (viewMode === 'form' && formData.item_code && (!formData.trace_process || formData.trace_process.length === 0)) {
      fetch(`/api/inventory?q=${encodeURIComponent(formData.item_code.trim())}&limit=1`)
        .then(res => res.ok ? res.json() : [])
        .then(data => {
          if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0].trace_process) && data[0].trace_process.length > 0) {
            setFormData(prev => ({
              ...prev,
              trace_process: data[0].trace_process,
              price: prev.price || data[0].calculated_price || data[0].price
            }));
          }
        })
        .catch(err => console.error(err));
    }
  }, [formData.item_code, viewMode]);

  // Auto-fetch existing stock positions/locations for selected item_code in form mode
  useEffect(() => {
    if (viewMode === 'form' && formData.item_code && formData.item_code.trim() && !editingId) {
      setIsLoadingPositions(true);
      fetch(`/api/inventory/locations-by-item?item_code=${encodeURIComponent(formData.item_code.trim())}`)
        .then(res => res.ok ? res.json() : [])
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            setExistingPositions(data);
            // Auto-select position if formData.location matches
            if (formData.location) {
              const matched = data.find(p => (p.location || '').toLowerCase() === formData.location.toLowerCase());
              if (matched) setSelectedPositionId(matched.id);
            }
          } else {
            setExistingPositions([]);
            setSelectedPositionId(null);
          }
        })
        .catch(err => console.error('Failed to fetch positions for item:', err))
        .finally(() => setIsLoadingPositions(false));
    } else {
      setExistingPositions([]);
      setSelectedPositionId(null);
    }
  }, [formData.item_code, viewMode, editingId]);

  const handleSelectPosition = (pos) => {
    if (pos) {
      setSelectedPositionId(pos.id);
      setFormData(prev => ({
        ...prev,
        location: pos.location || '',
        rack: pos.rack || '',
        shelf_number: pos.shelf_number || '',
        trace_item_id: pos.trace_item_id || prev.trace_item_id
      }));
    } else {
      setSelectedPositionId(null);
      setFormData(prev => ({
        ...prev,
        location: '',
        rack: '',
        shelf_number: ''
      }));
    }
  };

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
    setFormData(prev => ({
      ...prev,
      item_code: item.item_code,
      location: '',
      rack: '',
      shelf_number: ''
    }));
    setSelectedPositionId(null);
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
    if (formData.quantity === '' || isNaN(parseFloat(formData.quantity))) {
      toast.warn('Please enter a valid quantity');
      return;
    }
    if (!editingId && !selectedPositionId && (!formData.location || !formData.location.trim())) {
      toast.warn('Selecting an existing warehouse location or entering a new location is required.');
      return;
    }

    setIsSaving(true);
    try {
      if (linkMetadata && linkMetadata.returnUrl) {
        const targetStatus = formData.status || linkMetadata.status || 'In Inventory';
        const selectedPos = existingPositions.find(p => p.id === selectedPositionId);
        
        const updatedReturnState = {
          ...linkMetadata.returnState,
          selectedItemCode: formData.item_code || linkMetadata.returnState?.selectedItemCode
        };

        toast.success(`Inventory location configured!`);
        navigate(linkMetadata.returnUrl, {
          state: {
            returnState: updatedReturnState,
            updatedQty: parseFloat(formData.quantity) || 0,
            actionType: linkMetadata.actionType,
            status: targetStatus,
            inventoryDetails: {
              inventory_id: selectedPositionId || null,
              trace_item_id: selectedPos?.trace_item_id || formData.trace_item_id || null,
              price: parseFloat(formData.price) || 0.00,
              rack: formData.rack,
              shelf_number: formData.shelf_number,
              location: formData.location,
              message: formData.message || null,
              status: targetStatus,
              configured: true
            }
          }
        });
        setIsSaving(false);
        return;
      }

      const url = editingId ? `/api/inventory/${editingId}` : '/api/inventory';
      const method = editingId ? 'PUT' : 'POST';

      const payload = {
        ...formData,
        selected_inventory_id: selectedPositionId
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        toast.error(errData.error || 'Failed to save inventory record');
        return;
      }

      const saved = await res.json();

      if (editingId) {
        setInventoryList(prev => prev.map(item => item.id === editingId ? saved : item));
        toast.success('Inventory record updated successfully in database!');
      } else {
        setInventoryList(prev => [saved, ...prev]);
        toast.success('Inventory record added successfully to database!');
      }

      handleBackToDirectory();
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
                        <th className="px-5 py-3">Trace Item ID</th>
                        <th className="px-5 py-3">Status</th>
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
                          <td className="px-5 py-4 text-right font-mono font-black text-slate-900">
                            {(item.trace_status || item.status) === 'in process' && (parseFloat(item.process_completed_qty) || 0) < (parseFloat(item.quantity) || 0) ? (
                              <div className="flex flex-col items-end">
                                <span className="text-xs">
                                  {fmtQty(item.process_completed_qty)} / {fmtQty(item.quantity)}
                                </span>
                                <span className="text-[9px] text-indigo-700 font-bold bg-indigo-50 px-1 py-0.2 rounded border border-indigo-200 mt-0.5 font-sans">
                                  Completed / Total
                                </span>
                              </div>
                            ) : (
                              fmtQty(item.quantity)
                            )}
                          </td>

                          {/* Price */}
                          <td className="px-5 py-4 text-right font-black text-slate-900 font-mono">
                            ₹{parseFloat(item.calculated_price || item.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>

                          {/* Trace Item ID */}
                          <td className="px-5 py-4 font-mono font-bold text-slate-800">
                            {(item.trace_item_id || item.p_item_id) ? (
                              <div className="flex flex-col gap-1 items-start">
                                <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] shadow-sm">
                                  TR-{item.trace_item_id || item.p_item_id}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-5 py-4">
                            {(() => {
                              let st = item.trace_status || item.status || 'active';
                              if (st === 'in process' && (parseFloat(item.process_completed_qty) || 0) >= (parseFloat(item.quantity) || 0) && (parseFloat(item.quantity) || 0) > 0) {
                                st = 'In Inventory';
                              }

                              let badgeCls = "bg-slate-100 border-slate-200 text-slate-700";
                              if (st === 'For process') badgeCls = "bg-amber-50 border-amber-300 text-amber-800";
                              else if (st === 'For Sell') badgeCls = "bg-emerald-50 border-emerald-300 text-emerald-800";
                              else if (st === 'In Inventory') badgeCls = "bg-indigo-50 border-indigo-300 text-indigo-800";
                              else if (st === 'manufacturing') badgeCls = "bg-amber-100 border-amber-300 text-amber-800";
                              else if (st === 'in process') badgeCls = "bg-indigo-50 border-indigo-300 text-indigo-800";

                              return (
                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border shadow-xs ${badgeCls}`}>
                                  {st}
                                </span>
                              );
                            })()}
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
            className="mb-3 text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-1.5 rounded-lg transition-colors self-start"
          >
            <ArrowLeft size={14} />
            Back to Stock
          </button>

          <div className="flex items-center justify-between pb-1">
            <h1 className="text-xl font-bold text-slate-900 m-0 flex items-center gap-2">
              <Package size={22} style={{ color: 'var(--theme-color)' }} />
              {editingId ? 'Update Stock Record' : 'Record New Stock'}
            </h1>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-5">
              {linkMetadata && (
                <div
                  className="rounded-xl p-3.5 text-xs font-bold flex items-center gap-2 border"
                  style={{ color: 'var(--theme-color)', borderColor: 'var(--theme-color)', backgroundColor: 'rgba(0,0,0,0.03)' }}
                >
                  <Tag size={15} style={{ color: 'var(--theme-color)' }} className="shrink-0" />
                  <span>Linked Trace Item ID: <strong>{linkMetadata.p_id || linkMetadata.trace_id}</strong></span>
                </div>
              )}
              {(formData.trace_item_id || formData.p_item_id) && (
                <div
                  className="rounded-xl p-3.5 text-xs font-bold flex items-center gap-2 border"
                  style={{ color: 'var(--theme-color)', borderColor: 'var(--theme-color)', backgroundColor: 'rgba(0,0,0,0.03)' }}
                >
                  <Tag size={15} style={{ color: 'var(--theme-color)' }} className="shrink-0" />
                  <span>Linked Trace Item ID: <strong>TR-{formData.trace_item_id || formData.p_item_id}</strong></span>
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
                      onFocus={() => !editingId && (!linkMetadata || !linkMetadata.item_code) && setShowItemDropdown(true)}
                      disabled={!!editingId || (!!linkMetadata && !!linkMetadata.item_code)}
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] focus:border-transparent transition-all disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
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
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] focus:border-transparent transition-all disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
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
                    step="any"
                    required
                    placeholder="e.g. 500"
                    value={formData.quantity}
                    onChange={set('quantity')}
                    disabled={!!editingId}
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] focus:border-transparent transition-all disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
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
                    placeholder="e.g. 15.50"
                    value={(() => {
                      const sumProcess = Array.isArray(formData.trace_process) && formData.trace_process.length > 0
                        ? formData.trace_process.reduce((sum, step) => sum + (parseFloat(step.unit_price) || 0), 0)
                        : 0;
                      return sumProcess > 0 ? sumProcess : (formData.calculated_price || formData.price || '');
                    })()}
                    onChange={set('price')}
                    disabled={!!editingId || !!linkMetadata}
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] focus:border-transparent transition-all disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                  />
                  {(editingId || linkMetadata) && (
                    <p className="text-[10px] text-slate-400 font-semibold mt-1 pl-1">
                      Price is calculated from trace process steps & stock configuration.
                    </p>
                  )}
                </div>
              </div>

              {/* Location details */}
              <div className="border-t border-slate-200 pt-4 mt-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 size={16} style={{ color: 'var(--theme-color)' }} />
                    Warehouse Position <span className="text-red-500">*</span>
                  </h3>
                  {isLoadingPositions && (
                    <span className="text-xs text-slate-500 flex items-center gap-1 font-medium animate-pulse">
                      <RefreshCw size={12} className="animate-spin" style={{ color: 'var(--theme-color)' }} />
                      Searching existing locations for {formData.item_code}...
                    </span>
                  )}
                </div>

                {/* Informative message if no item code selected yet */}
                {!editingId && !formData.item_code && (
                  <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1 text-xs">
                    <div className="font-bold text-amber-900 flex items-center gap-1.5">
                      <AlertCircle size={15} className="text-amber-600" />
                      No Catalog Item Selected
                    </div>
                    <p className="text-amber-800 text-[11px] font-medium m-0">
                      Please select a Catalog Item above to view all existing warehouse stock positions and locations.
                    </p>
                  </div>
                )}

                {/* Existing Location Positions Selector (if positions exist) */}
                {!editingId && formData.item_code && existingPositions.length > 0 && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers size={14} style={{ color: 'var(--theme-color)' }} />
                        Existing Locations with Item Code "{formData.item_code}" ({existingPositions.length})
                      </span>
                      <span className="text-[10px] font-semibold text-slate-500">
                        Select to merge quantity & average unit price, or select new location.
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Option for New Location */}
                      <div
                        onClick={() => handleSelectPosition(null)}
                        style={selectedPositionId === null ? {
                          borderColor: 'var(--theme-color)',
                          backgroundColor: 'rgba(0,0,0,0.02)'
                        } : {}}
                        className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                          selectedPositionId === null
                            ? 'shadow-2xs'
                            : 'border-dashed border-slate-300 hover:border-slate-400 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full border flex items-center justify-center shrink-0"
                            style={{
                              borderColor: selectedPositionId === null ? 'var(--theme-color)' : '#cbd5e1',
                              backgroundColor: selectedPositionId === null ? 'var(--theme-color)' : 'white'
                            }}
                          >
                            {selectedPositionId === null && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                            <Plus size={14} style={{ color: 'var(--theme-color)' }} />
                            Enter Brand New Location
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-semibold mt-1.5 pl-6">
                          Create a separate stock entry at a new location.
                        </p>
                      </div>

                      {/* Options for Existing Locations */}
                      {existingPositions.map((pos) => {
                        const isSelected = selectedPositionId === pos.id;
                        return (
                          <div
                            key={pos.id}
                            onClick={() => handleSelectPosition(pos)}
                            style={isSelected ? {
                              borderColor: 'var(--theme-color)',
                              backgroundColor: 'rgba(0,0,0,0.02)'
                            } : {}}
                            className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                              isSelected
                                ? 'shadow-2xs'
                                : 'border-slate-200 hover:border-slate-300 bg-white'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-4 h-4 rounded-full border flex items-center justify-center shrink-0"
                                  style={{
                                    borderColor: isSelected ? 'var(--theme-color)' : '#cbd5e1',
                                    backgroundColor: isSelected ? 'var(--theme-color)' : 'white'
                                  }}
                                >
                                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                </div>
                                <div>
                                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1">
                                    <MapPin size={12} style={{ color: 'var(--theme-color)' }} />
                                    {pos.location || 'Default Location'}
                                  </div>
                                  {(pos.rack || pos.shelf_number) && (
                                    <div className="text-[10px] text-slate-500 font-medium">
                                      {pos.rack && `Rack: ${pos.rack}`}
                                      {pos.rack && pos.shelf_number && ' | '}
                                      {pos.shelf_number && `Shelf: ${pos.shelf_number}`}
                                    </div>
                                  )}
                                </div>
                              </div>
                              {pos.trace_item_id && (
                                <span
                                  className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 border"
                                  style={{ color: 'var(--theme-color)', borderColor: 'var(--theme-color)', backgroundColor: 'rgba(0,0,0,0.03)' }}
                                >
                                  TR-{pos.trace_item_id}
                                </span>
                              )}
                            </div>

                            <div className="mt-2 pt-2 border-t border-slate-200/70 flex items-center justify-between text-[11px] font-mono">
                              <span className="text-slate-600 font-semibold">
                                Stock: <strong className="text-slate-900">{fmtQty(pos.quantity)} pcs</strong>
                              </span>
                              <span className="text-slate-700 font-bold">
                                ₹{parseFloat(pos.calculated_price || pos.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} / pc
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Input Fields for Location, Rack, Shelf */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1.5">
                      Warehouse Location <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Warehouse A"
                      value={formData.location}
                      onChange={(e) => {
                        setSelectedPositionId(null);
                        set('location')(e);
                      }}
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] focus:border-transparent transition-all"
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
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] focus:border-transparent transition-all"
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
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                {/* Weighted Average Unit Price Preview Card */}
                {(() => {
                  if (!selectedPositionId) return null;
                  const selectedPos = existingPositions.find(p => p.id === selectedPositionId);
                  if (!selectedPos) return null;

                  const existingQty = parseFloat(selectedPos.quantity) || 0;
                  const existingPrice = parseFloat(selectedPos.calculated_price || selectedPos.price) || 0;
                  const addedQty = parseFloat(formData.quantity) || 0;
                  const addedPrice = parseFloat(formData.price) || 0;

                  const finalQty = existingQty + addedQty;
                  const avgPrice = finalQty > 0
                    ? ((existingQty * existingPrice + addedQty * addedPrice) / finalQty)
                    : addedPrice;

                  return (
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2.5 animate-fade-in shadow-2xs">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <span className="font-bold text-slate-900 flex items-center gap-1.5 uppercase text-[11px]">
                          <CheckCircle2 size={14} style={{ color: 'var(--theme-color)' }} />
                          Selected Location Merger & Weighted Average Price Preview
                        </span>
                        <span
                          className="text-[10px] font-mono font-bold bg-white border px-2 py-0.5 rounded shadow-2xs"
                          style={{ color: 'var(--theme-color)', borderColor: 'var(--theme-color)' }}
                        >
                          Merging into TR-{selectedPos.trace_item_id || selectedPos.id}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
                        <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                          <div className="text-[9px] text-slate-500 font-sans uppercase font-bold">Existing Stock</div>
                          <div className="font-black text-slate-900">{fmtQty(existingQty)} pcs</div>
                          <div className="text-[10px] text-slate-600">@ ₹{existingPrice.toFixed(2)}</div>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                          <div className="text-[9px] text-slate-500 font-sans uppercase font-bold">Added Stock</div>
                          <div className="font-black" style={{ color: 'var(--theme-color)' }}>+{fmtQty(addedQty)} pcs</div>
                          <div className="text-[10px] text-slate-600">@ ₹{addedPrice.toFixed(2)}</div>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                          <div className="text-[9px] text-slate-500 font-sans uppercase font-bold">Updated Total Qty</div>
                          <div className="font-black text-emerald-700">{fmtQty(finalQty)} pcs</div>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                          <div className="text-[9px] text-slate-500 font-sans uppercase font-bold">Weighted Avg Price</div>
                          <div className="font-black text-slate-900">₹{avgPrice.toFixed(2)} / pc</div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Trace Item Status Update Input */}
              <div className="border-t border-slate-200 pt-4 mt-2">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Trace Item Status Update
                </label>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="e.g. For process, For Sell, In Inventory, manufacturing, active..."
                      value={formData.status || ''}
                      onChange={set('status')}
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] focus:border-transparent transition-all"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {['For process', 'For Sell', 'In Inventory', 'manufacturing', 'active'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, status: preset }))}
                        style={formData.status === preset ? {
                          backgroundColor: 'var(--theme-color)',
                          borderColor: 'var(--theme-color)',
                          color: '#ffffff'
                        } : {}}
                        className={`px-3 py-1.5 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                          formData.status === preset
                            ? 'shadow-xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 font-semibold mt-1">
                  Updating this status will update the status column of the linked Trace Item in the database.
                </p>
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
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)] focus:border-transparent transition-all resize-y"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-200 flex flex-wrap justify-between items-center gap-3">
                <div className="flex gap-2"></div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleBackToDirectory}
                    className="px-5 py-2.5 border border-slate-300 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
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
