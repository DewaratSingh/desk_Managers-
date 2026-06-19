import { useState, useEffect } from 'react';
import {
  Search,
  Edit2,
  Plus,
  RefreshCw,
  ArrowLeft,
  ListFilter
} from 'lucide-react';

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: ''
};

export default function AddBuyerView() {
  const [viewMode, setViewMode] = useState('list');
  const [buyers, setBuyers] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [searchFocused, setSearchFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchBuyers();
  }, []);

  const fetchBuyers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/buyers');
      if (res.ok) {
        const data = await res.json();
        setBuyers(data);
      }
    } catch (err) {
      console.error('Failed to fetch buyers:', err);
    } finally {
      setIsLoading(false);
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
          setViewMode('list');
        } else {
          const errData = await res.json();
          alert(errData.error || 'Failed to update buyer');
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
          setViewMode('list');
        } else {
          const errData = await res.json();
          alert(errData.error || 'Failed to create buyer');
        }
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred while saving buyer');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = (buyer) => {
    setEditingId(buyer.id);
    setFormData({
      name: buyer.name || '',
      email: buyer.email || '',
      phone: buyer.phone || ''
    });
    setViewMode('form');
  };

  const handleOpenAddForm = () => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setViewMode('form');
  };

  const handleBackToList = () => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setViewMode('list');
  };

  const filteredBuyers = buyers.filter(b =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.phone.includes(searchQuery)
  );

  return (
    <div className="flex-1 p-6 bg-slate-100 text-slate-900">
      {viewMode === 'list' ? (
        <div className="max-w-4xl mx-auto space-y-5">
          {/* Header */}
          <div className="flex justify-between items-center pb-4 border-b border-slate-300">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 m-0">Buyers Directory</h1>
              <p className="text-xs text-slate-500 mt-1">
                Browse and manage buyer contacts.
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
              Add Buyer
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
                Buyers ({filteredBuyers.length})
              </span>
            </div>

            {isLoading && buyers.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm font-medium">
                Loading buyers...
              </div>
            ) : filteredBuyers.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm font-medium">
                No buyers found. Click "+ Add Buyer" to get started.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {filteredBuyers.map((buyer) => (
                  <div
                    key={buyer.id}
                    className="p-5 flex justify-between items-center hover:bg-slate-50 transition-colors gap-6"
                  >
                    {/* Info block */}
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <div className="font-bold text-sm text-slate-900">{buyer.name}</div>
                      <div className="text-xs text-slate-600 mt-1 space-y-0.5">
                        <div><strong className="text-slate-400 font-bold">Email:</strong> {buyer.email}</div>
                        <div><strong className="text-slate-400 font-bold">Phone:</strong> {buyer.phone}</div>
                      </div>
                    </div>

                    {/* Update button */}
                    <button
                      onClick={() => handleEditClick(buyer)}
                      className="px-3 py-1.5 text-xs border border-slate-300 rounded font-semibold bg-white transition-all flex items-center gap-1 cursor-pointer shrink-0"
                      style={{ color: 'var(--theme-color)', borderColor: 'var(--theme-color)' }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = 'var(--theme-color)';
                        e.target.style.color = 'white';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = 'transparent';
                        e.target.style.color = 'var(--theme-color)';
                      }}
                    >
                      <Edit2 size={12} /> Edit
                    </button>
                  </div>
                ))}
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
            onClick={handleBackToList}
            className="mb-3 text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer bg-slate-200 hover:bg-slate-300 px-3 py-1.5 rounded-lg transition-colors self-start"
          >
            <ArrowLeft size={14} />
            Back to Directory
          </button>
          <h1 className="text-2xl font-bold text-slate-900 m-0">
            {editingId ? 'Update Buyer' : 'Add New Buyer'}
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
                  onClick={handleBackToList}
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
