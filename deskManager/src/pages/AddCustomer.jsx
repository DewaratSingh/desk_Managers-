import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search,
  Edit2,
  Plus,
  RefreshCw,
  ArrowLeft,
  ListFilter,
  Eye
} from 'lucide-react';
import { toast } from 'react-toastify';

const EMPTY_FORM = {
  id: '',
  name: '',
  address: ''
};

export default function AddCustomerView() {
  const navigate = useNavigate();
  const location = useLocation();
  const isFormRoute = location.pathname.endsWith('/form');
  const [viewMode, setViewMode] = useState(isFormRoute ? 'form' : 'list');
  const [customers, setCustomers] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [searchFocused, setSearchFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [viewingParty, setViewingParty] = useState(null);

  useEffect(() => {
    if (isFormRoute) {
      setViewMode('form');
      if (location.state?.editingCustomer) {
        const customer = location.state.editingCustomer;
        setEditingId(customer.id);
        setFormData({
          id: customer.id || '',
          name: customer.name || '',
          address: customer.address || ''
        });
      } else {
        setEditingId(null);
        setFormData(EMPTY_FORM);
      }
    } else {
      setViewMode('list');
    }
  }, [location.pathname, location.state, isFormRoute]);

  useEffect(() => {
    if (!isFormRoute) {
      const delayDebounceFn = setTimeout(() => {
        fetchCustomers(false, searchQuery);
      }, 300);

      return () => clearTimeout(delayDebounceFn);
    }
  }, [searchQuery, isFormRoute]);

  const fetchCustomers = async (isLoadMore = false, searchVal = searchQuery) => {
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    try {
      const currentOffset = isLoadMore ? customers.length : 0;
      const res = await fetch(`/api/customers?limit=20&offset=${currentOffset}&q=${encodeURIComponent(searchVal || '')}`);
      if (res.ok) {
        const data = await res.json();
        if (isLoadMore) {
          setCustomers(prev => [...prev, ...data]);
        } else {
          setCustomers(data);
        }
        if (data.length < 20) {
          setHasMore(false);
        } else {
          setHasMore(true);
        }
      }
    } catch (err) {
      console.error('Failed to fetch customers:', err);
    } finally {
      setIsLoading(false);
      setLoadingMore(false);
    }
  };

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    if (!formData.id.trim() || !formData.name.trim() || !formData.address.trim()) return;

    setIsLoading(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/customers/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            address: formData.address
          })
        });
        if (res.ok) {
          const updated = await res.json();
          setCustomers(customers.map(c => c.id === editingId ? updated : c));
          setFormData(EMPTY_FORM);
          setEditingId(null);
          toast.success('Party updated successfully!');
          navigate(-1)
        } else {
          const errData = await res.json();
          toast.error(errData.error || 'Failed to update party');
        }
      } else {
        const res = await fetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        if (res.ok) {
          const created = await res.json();
          setCustomers([created, ...customers]);
          setFormData(EMPTY_FORM);
          setEditingId(null);
          toast.success('Party created successfully!');
          navigate(-1)
        } else {
          const errData = await res.json();
          toast.error(errData.error || 'Failed to create party');
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('An error occurred while saving party');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = (customer) => {
    navigate('/party/form', { state: { editingCustomer: customer } });
  };

  const handleOpenAddForm = () => {
    navigate('/party/form');
  };

  const handleBackToList = () => {
    navigate(-1)
  };

  const filteredCustomers = customers;

  return (
    <div className="flex-1 p-6 bg-slate-100 text-slate-900">
      {viewMode === 'list' ? (
        <div className="max-w-4xl mx-auto space-y-5">
          {/* Header */}
          <div className="flex justify-between items-center pb-4 border-b border-slate-300">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 m-0">Party Directory</h1>
              <p className="text-xs text-slate-500 mt-1">
                Browse and manage parties.
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
              Add Party
            </button>
          </div>

          {/* Search */}
          <div 
            className="flex items-center gap-2.5 border border-slate-300 rounded-lg px-3 py-2 bg-white shadow-sm transition-colors"
            style={{ borderColor: searchFocused ? 'var(--theme-color)' : 'rgb(203, 213, 225)' }}
          >
            <Search size={18} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search by ID, name, or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="w-full bg-transparent focus:outline-none text-sm text-slate-900 placeholder:text-slate-400 font-medium"
            />
          </div>

          {/* Directory */}
          <div className="border border-slate-300 rounded-lg overflow-hidden bg-white shadow-sm">
            <div className="bg-slate-100 px-5 py-3 border-b border-slate-300">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <ListFilter size={14} style={{ color: 'var(--theme-color)' }} />
                Parties ({filteredCustomers.length})
              </span>
            </div>

            {isLoading && customers.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm font-medium">
                Loading parties...
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm font-medium">
                No parties found. Click "+ Add Party" to get started.
              </div>
            ) : (
              <div className="overflow-x-auto bg-white">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider">
                      <th className="px-5 py-3">Party ID</th>
                      <th className="px-5 py-3">Name</th>
                      <th className="px-5 py-3">Address</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {filteredCustomers.map((customer) => (
                      <tr 
                        key={customer.id}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-5 py-3.5 font-mono font-bold text-slate-900">
                          {customer.id}
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-slate-700">
                          {customer.name}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 font-semibold max-w-xs truncate" title={customer.address}>
                          {customer.address}
                        </td>
                        <td className="px-5 py-3.5 text-right space-x-2">
                          <button
                            onClick={() => setViewingParty(customer)}
                            className="px-2.5 py-1.5 text-[11px] border border-slate-300 rounded font-semibold bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400 transition-all inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Eye size={11} /> View
                          </button>
                          <button
                            onClick={() => handleEditClick(customer)}
                            className="px-2.5 py-1.5 text-[11px] border rounded font-semibold bg-white transition-all inline-flex items-center gap-1 cursor-pointer"
                            style={{ color: 'var(--theme-color)', borderColor: 'var(--theme-color)' }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--theme-color)';
                              e.currentTarget.style.color = 'white';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = 'var(--theme-color)';
                            }}
                          >
                            <Edit2 size={11} /> Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {hasMore && customers.length > 0 && (
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-center">
                <button
                  onClick={() => fetchCustomers(true)}
                  disabled={loadingMore}
                  className="px-6 py-2 text-xs font-bold border border-slate-300 rounded-lg hover:border-[var(--theme-color)] bg-white text-slate-700 hover:text-[var(--theme-color)] transition-all cursor-pointer shadow-sm hover:shadow flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingMore ? (
                    <>
                      <RefreshCw size={12} className="animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Show More'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ================================================================
            VIEW MODE: FULL PAGE FORM
           ================================================================ */
        <div className="max-w-2xl mx-auto space-y-5">
          {/* Header with Back */}
          <button
           onClick={() => navigate(-1)}
            className="mb-3 text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer bg-slate-200 hover:bg-slate-300 px-3 py-1.5 rounded-lg transition-colors self-start"
          >
            <ArrowLeft size={14} />
            Back to Directory
          </button>
          <h1 className="text-2xl font-bold text-slate-900 m-0">
            {editingId ? 'Update Party' : 'Add New Party'}
          </h1>

          <div className="bg-white border border-slate-300 rounded-lg p-6 shadow-sm">
            <form onSubmit={handleAddCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Party ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={!!editingId}
                  placeholder="e.g. PART-001"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm placeholder:text-slate-400 font-medium focus:outline-none disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                  onFocus={(e) => !editingId && (e.target.style.borderColor = 'var(--theme-color)')}
                  onBlur={(e) => !editingId && (e.target.style.borderColor = 'rgb(203, 213, 225)')}
                />
                {editingId && (
                  <p className="text-[10px] text-slate-400 font-semibold mt-1 pl-1">
                    Party ID cannot be changed after creation.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Corporation"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm placeholder:text-slate-400 font-medium focus:outline-none"
                  onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                  onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Address <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Enter full address..."
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm placeholder:text-slate-400 font-medium focus:outline-none resize-y"
                  onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                  onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                />
              </div>

              {/* Buttons */}
              <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="px-5 py-2.5 border border-slate-300 rounded text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2.5 rounded text-sm font-bold text-white transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: 'var(--theme-color)' }}
                  onMouseEnter={(e) => e.target.style.filter = 'brightness(0.9)'}
                  onMouseLeave={(e) => e.target.style.filter = 'none'}
                >
                  {isLoading ? (
                    <><RefreshCw size={14} className="animate-spin" /> Processing...</>
                  ) : editingId ? (
                    <><RefreshCw size={14} /> Update</>
                  ) : (
                    <><Plus size={14} /> Add</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingParty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col transform scale-100 transition-all">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Party Details</h3>
              <button 
                onClick={() => setViewingParty(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg bg-transparent border-0 cursor-pointer"
              >
                ×
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs font-semibold text-slate-700">
              <div>
                <span className="block text-slate-400 font-bold uppercase tracking-wider mb-1 text-[10px]">Party ID</span>
                <span className="font-mono text-sm text-slate-900 font-bold bg-slate-50 px-2.5 py-1 rounded border border-slate-200 inline-block">{viewingParty.id}</span>
              </div>
              <div>
                <span className="block text-slate-400 font-bold uppercase tracking-wider mb-1 text-[10px]">Name</span>
                <span className="text-sm text-slate-900 font-bold bg-slate-50 px-2.5 py-1 rounded border border-slate-200 block">{viewingParty.name}</span>
              </div>
              <div>
                <span className="block text-slate-400 font-bold uppercase tracking-wider mb-1 text-[10px]">Address</span>
                <div className="text-sm text-slate-900 font-medium bg-slate-50 px-2.5 py-2.5 rounded border border-slate-200 whitespace-pre-wrap leading-relaxed">{viewingParty.address}</div>
              </div>
            </div>
            <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setViewingParty(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
