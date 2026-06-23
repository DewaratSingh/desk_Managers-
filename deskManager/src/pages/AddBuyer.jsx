import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search,
  Edit2,
  Plus,
  RefreshCw,
  ArrowLeft,
  ListFilter
} from 'lucide-react';
import { toast } from 'react-toastify';

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: ''
};

export default function AddBuyerView() {
  const navigate = useNavigate();
  const location = useLocation();
  const isFormRoute = location.pathname.endsWith('/form');
  const [viewMode, setViewMode] = useState(isFormRoute ? 'form' : 'list');
  const [buyers, setBuyers] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [searchFocused, setSearchFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (isFormRoute) {
      setViewMode('form');
      if (location.state?.editingBuyer) {
        const buyer = location.state.editingBuyer;
        setEditingId(buyer.id);
        setFormData({
          name: buyer.name || '',
          email: buyer.email || '',
          phone: buyer.phone || ''
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
        fetchBuyers(false, searchQuery);
      }, 300);

      return () => clearTimeout(delayDebounceFn);
    }
  }, [searchQuery, isFormRoute]);

  const fetchBuyers = async (isLoadMore = false, searchVal = searchQuery) => {
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    try {
      const currentOffset = isLoadMore ? buyers.length : 0;
      const res = await fetch(`/api/buyers?limit=20&offset=${currentOffset}&q=${encodeURIComponent(searchVal || '')}`);
      if (res.ok) {
        const data = await res.json();
        if (isLoadMore) {
          setBuyers(prev => [...prev, ...data]);
        } else {
          setBuyers(data);
        }
        if (data.length < 20) {
          setHasMore(false);
        } else {
          setHasMore(true);
        }
      }
    } catch (err) {
      console.error('Failed to fetch buyers:', err);
    } finally {
      setIsLoading(false);
      setLoadingMore(false);
    }
  };

  const handleAddBuyer = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.phone.trim()) return;

    setIsLoading(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/buyers/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        if (res.ok) {
          const updated = await res.json();
          setBuyers(buyers.map(b => b.id === editingId ? updated : b));
          setFormData(EMPTY_FORM);
          setEditingId(null);
          toast.success('Contact updated successfully!');
          navigate(-1);
        } else {
          const errData = await res.json();
          toast.error(errData.error || 'Failed to update contact');
        }
      } else {
        const res = await fetch('/api/buyers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        if (res.ok) {
          const created = await res.json();
          setBuyers([created, ...buyers]);
          setFormData(EMPTY_FORM);
          setEditingId(null);
          toast.success('Contact created successfully!');
          navigate(-1);
        } else {
          const errData = await res.json();
          toast.error(errData.error || 'Failed to create contact');
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('An error occurred while saving contact');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = (buyer) => {
    navigate('/buyer/form', { state: { editingBuyer: buyer } });
  };

  const handleOpenAddForm = () => {
    navigate('/buyer/form');
  };

  const handleBackToList = () => {
    navigate(-1);
  };

  const filteredBuyers = buyers;

  return (
    <div className="flex-1 p-6 bg-slate-100 text-slate-900">
      {viewMode === 'list' ? (
        <div className="max-w-4xl mx-auto space-y-5">
          {/* Header */}
          <div className="flex justify-between items-center pb-4 border-b border-slate-300">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 m-0">Contacts Directory</h1>
              <p className="text-xs text-slate-500 mt-1">
                Browse and manage contacts.
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
              Add Contact
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
              placeholder="Search by name, email, or phone..."
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
                Contacts ({filteredBuyers.length})
              </span>
            </div>

            {isLoading && buyers.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm font-medium">
                Loading contacts...
              </div>
            ) : filteredBuyers.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm font-medium">
                No contacts found. Click "+ Add Contact" to get started.
              </div>
            ) : (
              <div className="overflow-x-auto bg-white">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider">
                      <th className="px-5 py-3">Name</th>
                      <th className="px-5 py-3">Email</th>
                      <th className="px-5 py-3">Phone</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {filteredBuyers.map((buyer) => (
                      <tr 
                        key={buyer.id}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-5 py-3.5 font-semibold text-slate-900">
                          {buyer.name}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 font-semibold font-mono">
                          {buyer.email}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 font-semibold">
                          {buyer.phone}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => handleEditClick(buyer)}
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
            {hasMore && buyers.length > 0 && (
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-center">
                <button
                  onClick={() => fetchBuyers(true)}
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
            {editingId ? 'Update Contact' : 'Add New Contact'}
          </h1>

          <div className="bg-white border border-slate-300 rounded-lg p-6 shadow-sm">
            <form onSubmit={handleAddBuyer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm placeholder:text-slate-400 font-medium focus:outline-none"
                  onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                  onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. john@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm placeholder:text-slate-400 font-medium focus:outline-none"
                  onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                  onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Phone <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 9876543210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm placeholder:text-slate-400 font-medium focus:outline-none"
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
    </div>
  );
}
