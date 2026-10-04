import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  Search,
  Edit2,
  Plus,
  RefreshCw,
  ArrowLeft,
  ListFilter,
  Trash2,
  AlertCircle,
  FileText,
  Package,
  X
} from 'lucide-react';

export default function ArcView() {
  const navigate = useNavigate();
  const location = useLocation();
  const isFormRoute = location.pathname.endsWith('/form');
  
  // State for view management
  const [viewMode, setViewMode] = useState('list'); // 'list', 'form', 'detail'
  
  // Contract List State
  const [contracts, setContracts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Contract Form State
  const [editingContract, setEditingContract] = useState(null);
  const [companyName, setCompanyName] = useState('');
  const [buyerId, setBuyerId] = useState('');
  
  // Buyer Auto-complete state
  const [buyerInput, setBuyerInput] = useState('');
  const [buyerSuggestions, setBuyerSuggestions] = useState([]);
  const [showBuyerDropdown, setShowBuyerDropdown] = useState(false);
  const [buyerNotFound, setBuyerNotFound] = useState(false);
  const buyerManualRef = useRef(false);
  const buyerRef = useRef(null);
  
  // Contract Detail State (Items)
  const [selectedContract, setSelectedContract] = useState(null);
  const [contractItems, setContractItems] = useState([]);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemInput, setItemInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedCatalogItem, setSelectedCatalogItem] = useState(null);
  const [itemPrice, setItemPrice] = useState('');
  const [itemDate, setItemDate] = useState(new Date().toISOString().split('T')[0]);
  const [itemExpiryDate, setItemExpiryDate] = useState('');
  const [historyItem, setHistoryItem] = useState(null);
  
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (isFormRoute) {
      setViewMode('form');
      if (location.state?.editingContract) {
        const c = location.state.editingContract;
        setEditingContract(c);
        setCompanyName(c.company_name || '');
        setBuyerId(c.buyer_id || '');
        setBuyerInput(c.buyer_name ? `${c.buyer_name} (${c.email || ''})` : (c.buyer_id || ''));
      } else {
        setEditingContract(null);
        setCompanyName('');
        setBuyerId('');
        setBuyerInput('');
      }
    } else if (selectedContract) {
      setViewMode('detail');
    } else {
      setViewMode('list');
      fetchContracts();
    }
  }, [location.pathname, location.state, isFormRoute, selectedContract]);

  // Handle click outside autocomplete suggestions
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
      if (buyerRef.current && !buyerRef.current.contains(event.target)) {
        setShowBuyerDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchBuyers = (query) => {
    fetch(`/api/buyers?q=${encodeURIComponent(query)}&limit=5`)
      .then(r => r.json())
      .then(data => {
        setBuyerSuggestions(data);
        setBuyerNotFound(data.length === 0);
      })
      .catch(console.error);
  };

  useEffect(() => {
    if (!buyerManualRef.current) return;
    const delayDebounceFn = setTimeout(() => {
      searchBuyers(buyerInput.trim());
    }, 200);
    return () => clearTimeout(delayDebounceFn);
  }, [buyerInput]);

  const fetchContracts = async (searchVal = searchQuery) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/contracts?q=${encodeURIComponent(searchVal || '')}`);
      if (res.ok) {
        const data = await res.json();
        setContracts(data);
      } else {
        setError('Failed to load contracts');
      }
    } catch (err) {
      setError('Connection error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchContractDetails = async (id) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/contracts/${id}`);
      if (res.ok) {
        const data = await res.json();
        setContractItems(data.items || []);
        setSelectedContract(data);
      } else {
        setError('Failed to load contract details');
      }
    } catch (err) {
      setError('Connection error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBuyerInput = (value) => {
    buyerManualRef.current = true;
    setBuyerInput(value);
    setBuyerId(''); // reset on manual typing
    setShowBuyerDropdown(true);
  };

  const selectBuyer = (b) => {
    buyerManualRef.current = false;
    setBuyerId(b.id);
    setBuyerInput(`${b.name} (${b.email || ''})`);
    setShowBuyerDropdown(false);
    setBuyerNotFound(false);
  };

  const handleSaveContract = async (e) => {
    e.preventDefault();
    setError(null);
    
    if (!buyerId) {
      setError('Please select and link a valid Buyer');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const payload = { company_name: companyName, buyer_id: buyerId };
      let res;
      if (editingContract) {
        res = await fetch(`/api/contracts/${editingContract.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/contracts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      
      if (res.ok) {
        toast.success(`Contract ${editingContract ? 'updated' : 'created'} successfully!`);
        navigate('/arc');
      } else {
        const errData = await res.json();
        setError(errData.error || 'Failed to save contract');
      }
    } catch (err) {
      setError('Server error while saving contract');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteContract = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this contract and all its items?')) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/contracts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Contract deleted');
        fetchContracts();
      } else {
        toast.error('Failed to delete contract');
      }
    } catch (err) {
      toast.error('Connection error');
    } finally {
      setIsLoading(false);
    }
  };

  // --- Contract Item Handlers ---
  
  const handleItemInput = async (value) => {
    setItemInput(value);
    setSelectedCatalogItem(null);
    if (!value.trim()) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    try {
      const res = await fetch(`/api/items?q=${encodeURIComponent(value)}&limit=5`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data);
        setShowDropdown(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectItem = (item) => {
    setSelectedCatalogItem(item);
    setItemInput(item.item_code);
    setShowDropdown(false);
  };

  const handleSaveContractItem = async (e) => {
    e.preventDefault();
    if (!selectedContract) return;
    
    setError(null);
    setIsLoading(true);
    try {
      if (editingItem) {
        const res = await fetch(`/api/contracts/${selectedContract.id}/items/${editingItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ price: parseFloat(itemPrice), date: itemDate, expiry_date: itemExpiryDate || null })
        });
        if (res.ok) {
          toast.success('Item price updated!');
          fetchContractDetails(selectedContract.id);
          resetItemForm();
        } else {
          const data = await res.json();
          setError(data.error || 'Failed to update item');
        }
      } else {
        const targetItemCode = selectedCatalogItem ? selectedCatalogItem.item_code : itemInput;
        const res = await fetch(`/api/contracts/${selectedContract.id}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_code: targetItemCode, price: parseFloat(itemPrice), date: itemDate, expiry_date: itemExpiryDate || null })
        });
        if (res.ok) {
          toast.success('Item added to contract!');
          fetchContractDetails(selectedContract.id);
          resetItemForm();
        } else {
          const data = await res.json();
          setError(data.error || 'Failed to add item');
        }
      }
    } catch (err) {
      setError('Connection error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteContractItem = async (itemId) => {
    if (!window.confirm('Delete this item from contract?')) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/contracts/${selectedContract.id}/items/${itemId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Item removed');
        fetchContractDetails(selectedContract.id);
      } else {
        toast.error('Failed to remove item');
      }
    } catch (err) {
      toast.error('Connection error');
    } finally {
      setIsLoading(false);
    }
  };

  const resetItemForm = () => {
    setShowItemForm(false);
    setEditingItem(null);
    setItemInput('');
    setSelectedCatalogItem(null);
    setItemPrice('');
    setItemDate(new Date().toISOString().split('T')[0]);
    setItemExpiryDate('');
    setError(null);
  };

  // --- Render Helpers ---

  return (
    <div className="flex-1 p-6 bg-slate-100 text-slate-900 min-h-screen">
      {viewMode === 'list' && (
        <div className="max-w-5xl mx-auto space-y-5">
          <div className="flex justify-between items-center pb-4 border-b border-slate-300">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 m-0">Rate Contracts</h1>
              <p className="text-xs text-slate-500 mt-1">
                Manage rate contracts and their associated items.
              </p>
            </div>
            <button
              onClick={() => navigate('/arc/form')}
              className="px-4 py-2 text-white font-semibold text-sm rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm bg-blue-600 hover:bg-blue-700"
            >
              <Plus size={16} />
              New Contract
            </button>
          </div>

          <div className="flex items-center gap-2.5 border border-slate-300 rounded-lg px-3 py-2 bg-white shadow-sm">
            <Search size={18} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search contracts..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                fetchContracts(e.target.value);
              }}
              className="w-full bg-transparent focus:outline-none text-sm text-slate-900 placeholder:text-slate-400 font-medium"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading && contracts.length === 0 ? (
              <div className="col-span-full p-12 text-center text-slate-400">Loading contracts...</div>
            ) : contracts.length === 0 ? (
              <div className="col-span-full p-12 text-center text-slate-400">No contracts found.</div>
            ) : (
              contracts.map(contract => (
                <div 
                  key={contract.id} 
                  onClick={() => {
                    setSelectedContract(contract);
                    fetchContractDetails(contract.id);
                  }}
                  className="bg-white border border-slate-300 rounded-xl p-5 cursor-pointer hover:border-blue-500 hover:shadow-md transition-all group relative"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="bg-blue-50 text-blue-700 p-2 rounded-lg">
                      <FileText size={20} />
                    </div>
                    <div className="flex gap-1">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/arc/form', { state: { editingContract: contract } });
                        }}
                        className="p-1.5 text-slate-400 hover:text-blue-600 rounded bg-slate-50 hover:bg-blue-50 transition-colors"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={(e) => handleDeleteContract(contract.id, e)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded bg-slate-50 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <h3 className="font-bold text-lg text-slate-900 mb-1">{contract.company_name}</h3>
                  {contract.buyer_name && (
                    <div className="text-xs font-semibold text-slate-500 mb-2">
                      Buyer: <span className="text-slate-700">{contract.buyer_name}</span> {contract.email ? `(${contract.email})` : ''}
                    </div>
                  )}
                  <div className="text-[10px] text-slate-400 font-mono mt-4">
                    Created: {new Date(contract.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {viewMode === 'form' && (
        <div className="max-w-2xl mx-auto space-y-5">
          <button
            onClick={() => navigate(-1)}
            className="mb-3 text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer bg-slate-200 hover:bg-slate-300 px-3 py-1.5 rounded-lg transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Contracts
          </button>
          
          <h1 className="text-2xl font-bold text-slate-900 m-0">
            {editingContract ? 'Edit Contract' : 'New Contract'}
          </h1>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg flex items-center gap-1.5">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <div className="bg-white border border-slate-300 rounded-lg p-6 shadow-sm">
            <form onSubmit={handleSaveContract} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Contract / Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="e.g. Acme Corp Annual Rate"
                />
              </div>
              
              <div ref={buyerRef} className="relative">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Link to Buyer <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Start typing buyer name..."
                  value={buyerInput}
                  onChange={(e) => handleBuyerInput(e.target.value)}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--theme-color)';
                    buyerManualRef.current = true;
                    setShowBuyerDropdown(true);
                    searchBuyers(buyerInput);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:border-blue-500 focus:outline-none"
                  onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                  autoComplete="off"
                  required
                />
                {showBuyerDropdown && buyerSuggestions.length > 0 && (
                  <div className="absolute z-30 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                    {buyerSuggestions.slice(0, 6).map(b => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => selectBuyer(b)}
                        className="w-full text-left px-3.5 py-2 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                      >
                        <div className="font-bold text-xs text-slate-900">{b.name}</div>
                        <div className="text-[10px] text-slate-500">{b.email} &bull; {b.phone}</div>
                      </button>
                    ))}
                  </div>
                )}
                {buyerNotFound && (
                  <div className="mt-2 flex items-center justify-between gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs font-bold">
                    <div className="flex items-center gap-1.5">
                      <AlertCircle size={13} className="shrink-0" />
                      <span>No buyer found for "{buyerInput}".</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/buyer/form')}
                      className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-[9px] transition-colors cursor-pointer uppercase tracking-wider"
                    >
                      Add Buyer
                    </button>
                  </div>
                )}
                {buyerId && (
                  <div className="mt-2 flex flex-wrap gap-2.5 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5">
                    <span className="text-emerald-600">✓ Buyer Linked</span>
                  </div>
                )}
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="px-4 py-2 border border-slate-300 rounded text-sm font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 rounded text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {isLoading && <RefreshCw size={14} className="animate-spin" />}
                  Save Contract
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewMode === 'detail' && selectedContract && (
        <div className="max-w-5xl mx-auto space-y-5">
          <button
            onClick={() => setSelectedContract(null)}
            className="mb-3 text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer bg-slate-200 hover:bg-slate-300 px-3 py-1.5 rounded-lg transition-colors self-start"
          >
            <ArrowLeft size={14} />
            Back to Contracts
          </button>
          
          <div className="bg-white border border-slate-300 rounded-xl p-6 flex justify-between items-start shadow-sm">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 m-0">{selectedContract.company_name}</h1>
              {selectedContract.buyer_name && (
                <div className="mt-2 space-y-1">
                  <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <span className="text-slate-500 uppercase tracking-wider text-[10px] font-bold">Buyer:</span> 
                    {selectedContract.buyer_name}
                  </p>
                  {(selectedContract.email || selectedContract.phone) && (
                    <p className="text-xs font-medium text-slate-500 flex items-center gap-3">
                      {selectedContract.email && <span>Email: {selectedContract.email}</span>}
                      {selectedContract.phone && <span>Phone: {selectedContract.phone}</span>}
                    </p>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={() => setShowItemForm(true)}
              className="px-4 py-2 text-white font-semibold text-sm rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm bg-blue-600 hover:bg-blue-700"
            >
              <Plus size={16} />
              Add Item
            </button>
          </div>

          {/* Item Form Modal/Inline */}
          {showItemForm && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 shadow-inner" ref={dropdownRef}>
              <h3 className="font-bold text-slate-800 mb-4">{editingItem ? 'Edit Item Price' : 'Add Item to Contract'}</h3>
              
              {error && (
                <div className="mb-4 p-2 bg-red-100 text-red-700 text-xs font-semibold rounded flex items-center gap-1">
                  <AlertCircle size={12} /> {error}
                </div>
              )}

              <form onSubmit={handleSaveContractItem} className="flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[250px] relative">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Item Code <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    disabled={!!editingItem}
                    placeholder="Search item..."
                    value={itemInput}
                    onChange={(e) => handleItemInput(e.target.value)}
                    onFocus={() => itemInput.trim() && setShowDropdown(true)}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
                    autoComplete="off"
                  />
                  {showDropdown && suggestions.length > 0 && (
                    <div className="absolute z-30 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {suggestions.map(i => (
                        <button
                          key={i.item_code} type="button" onClick={() => handleSelectItem(i)}
                          className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-slate-100"
                        >
                          <div className="font-bold text-xs">{i.item_code}</div>
                          <div className="text-[10px] text-slate-500">{i.description}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="w-32">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Date</label>
                  <input
                    type="date" required
                    value={itemDate} onChange={(e) => setItemDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                
                <div className="w-32">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Expiry Date</label>
                  <input
                    type="date"
                    value={itemExpiryDate} onChange={(e) => setItemExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                
                <div className="w-32">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Price (₹) <span className="text-red-500">*</span></label>
                  <input
                    type="number" step="0.01" required min="0"
                    value={itemPrice} onChange={(e) => setItemPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                
                <div className="flex gap-2">
                  <button type="button" onClick={resetItemForm} className="px-4 py-2 border border-slate-300 bg-white rounded text-sm font-bold text-slate-700">
                    Cancel
                  </button>
                  <button type="submit" disabled={isLoading || (!editingItem && !selectedCatalogItem && !itemInput.trim())} className="px-4 py-2 rounded text-sm font-bold text-white bg-blue-600 disabled:opacity-50">
                    {isLoading ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Items Table */}
          <div className="bg-white border border-slate-300 rounded-lg overflow-hidden shadow-sm">
            <div className="bg-slate-100 px-5 py-3 border-b border-slate-300 font-bold text-xs text-slate-700 uppercase flex items-center gap-1.5">
              <Package size={14} className="text-blue-600" /> Contract Items ({contractItems.length})
            </div>
            
            {contractItems.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm font-medium">No items added to this contract yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 text-xs uppercase">
                      <th className="px-5 py-3">Item Code</th>
                      <th className="px-5 py-3">Description</th>
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Expiry Date</th>
                      <th className="px-5 py-3">Valid</th>
                      <th className="px-5 py-3 text-right">Prev Price</th>
                      <th className="px-5 py-3 text-right">Current Price</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {contractItems.map(item => {
                      const history = item.history || [];
                      const prevPrice = history.length > 0 ? history[history.length - 1].old_price : null;
                      const isValid = !item.expiry_date || new Date(item.expiry_date) >= new Date(new Date().setHours(0, 0, 0, 0));
                      
                      return (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="px-5 py-3 font-mono font-bold text-blue-600 text-xs">{item.item_code}</td>
                          <td className="px-5 py-3 font-medium text-slate-700 max-w-[200px] truncate" title={item.description}>{item.description}</td>
                          <td className="px-5 py-3 text-slate-600 font-medium">{item.date ? new Date(item.date).toLocaleDateString() : '—'}</td>
                          <td className="px-5 py-3 text-slate-600 font-medium">{item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : '—'}</td>
                          <td className="px-5 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isValid ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                              {isValid ? 'TRUE' : 'FALSE'}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right text-slate-500 font-semibold text-xs">
                            {prevPrice ? `₹${parseFloat(prevPrice).toLocaleString()}` : '—'}
                          </td>
                          <td className="px-5 py-3 text-right font-bold text-emerald-700">₹{parseFloat(item.price).toLocaleString()}</td>
                          <td className="px-5 py-3 text-right space-x-2">
                            {history.length > 0 && (
                              <button
                                onClick={() => setHistoryItem(item)}
                                className="px-2 py-1 text-[11px] font-bold text-slate-600 border border-slate-200 rounded hover:bg-slate-100 transition-colors"
                              >
                                View
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setEditingItem(item);
                                setItemInput(item.item_code);
                                setItemPrice(item.price);
                                setItemDate(item.date ? item.date.split('T')[0] : new Date().toISOString().split('T')[0]);
                                setItemExpiryDate(item.expiry_date ? item.expiry_date.split('T')[0] : '');
                                setShowItemForm(true);
                              }}
                              className="px-2 py-1 text-[11px] font-bold text-blue-600 border border-blue-200 rounded hover:bg-blue-600 hover:text-white transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteContractItem(item.id)}
                              className="px-2 py-1 text-[11px] font-bold text-red-600 border border-red-200 rounded hover:bg-red-600 hover:text-white transition-colors"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
      {historyItem && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Price History</h3>
                <p className="text-xs text-slate-500 font-medium">Item: <span className="font-bold text-blue-600">{historyItem.item_code}</span> - {historyItem.description}</p>
              </div>
              <button onClick={() => setHistoryItem(null)} className="text-slate-400 hover:text-slate-600 p-1 bg-slate-100 rounded hover:bg-slate-200 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              {(!historyItem.history || historyItem.history.length === 0) ? (
                <div className="text-center text-slate-500 text-sm py-8">No price history available for this item.</div>
              ) : (
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-50 font-bold text-slate-500 text-xs uppercase border-b border-slate-200">
                      <th className="px-4 py-2">Updated At</th>
                      <th className="px-4 py-2">Old Date</th>
                      <th className="px-4 py-2">Old Expiry</th>
                      <th className="px-4 py-2 text-right">Old Price</th>
                      <th className="px-4 py-2 text-right">New Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {historyItem.history.map((h, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-2 text-slate-600 font-medium">{new Date(h.changed_at).toLocaleString()}</td>
                        <td className="px-4 py-2 text-slate-500">{h.old_date ? new Date(h.old_date).toLocaleDateString() : '—'}</td>
                        <td className="px-4 py-2 text-slate-500">{h.old_expiry_date ? new Date(h.old_expiry_date).toLocaleDateString() : '—'}</td>
                        <td className="px-4 py-2 text-right font-semibold text-slate-500">₹{parseFloat(h.old_price).toLocaleString()}</td>
                        <td className="px-4 py-2 text-right font-bold text-emerald-600">₹{parseFloat(h.new_price).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
