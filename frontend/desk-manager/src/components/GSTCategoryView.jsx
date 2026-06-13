import React, { useState, useEffect } from 'react';
import { Search, Edit2, Plus, RefreshCw, ArrowLeft, Trash2, ListFilter, AlertCircle } from 'lucide-react';

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'http://localhost:5000/api'
  : `${window.location.protocol}//${window.location.hostname}:5000/api`;

const EMPTY_FORM = {
  type: '',
  rate: ''
};

export default function GSTCategoryView() {
  const [gstRates, setGstRates] = useState([]);
  const [viewMode, setViewMode] = useState('list');
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch GST rates from the backend
  const fetchGstRates = async (search = '') => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('dm_token');
      const url = `${API_BASE_URL}/gst-rates?limit=100&offset=0${search ? `&search=${encodeURIComponent(search)}` : ''}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        throw new Error('Failed to fetch GST categories');
      }
      const data = await res.json();
      setGstRates(data);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGstRates(searchQuery);
  }, [searchQuery]);

  const handleOpenAddForm = () => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setError(null);
    setViewMode('form');
  };

  const handleEditClick = (gst) => {
    setEditingId(gst.id);
    setFormData({
      type: gst.type,
      rate: gst.rate
    });
    setError(null);
    setViewMode('form');
  };

  const handleBackToDirectory = () => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setError(null);
    setViewMode('list');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.type.trim() || formData.rate === '') return;

    setIsLoading(true);
    setError(null);
    const token = localStorage.getItem('dm_token');
    
    try {
      let res;
      if (editingId) {
        // Update
        res = await fetch(`${API_BASE_URL}/gst-rates/${editingId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(formData)
        });
      } else {
        // Create
        res = await fetch(`${API_BASE_URL}/gst-rates`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(formData)
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save GST Category');
      }

      await fetchGstRates();
      handleBackToDirectory();
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = async (id) => {
    if (!window.confirm('Are you sure you want to delete this GST Category? Quotations linked to this rate may show incomplete breakdown values.')) return;
    
    setIsLoading(true);
    setError(null);
    const token = localStorage.getItem('dm_token');
    
    try {
      const res = await fetch(`${API_BASE_URL}/gst-rates/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete GST Category');
      }
      setGstRates(prev => prev.filter(g => g.id !== id));
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const set = (field) => (e) =>
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="flex-1 p-4 sm:p-8 lg:p-10 bg-[#f1f5f9] max-w-5xl mx-auto w-full text-slate-900">
      
      {/* ================================================================
          VIEW MODE: LIST (default)
         ================================================================ */}
      {viewMode === 'list' ? (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 m-0">GST Categories</h1>
              <p className="text-base text-slate-500 mt-1 font-medium">
                Configure GST slabs and types used for commercial quotations and billing.
              </p>
            </div>
            <button
              onClick={handleOpenAddForm}
              className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm self-start sm:self-auto"
            >
              <Plus size={20} />
              New GST Category
            </button>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm font-semibold rounded-xl flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Search */}
          <div className="flex items-center gap-3 border-2 border-slate-200 rounded-xl px-4 py-4 bg-white shadow-sm">
            <Search size={22} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search by GST type name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent focus:outline-none text-lg text-slate-900 placeholder:text-slate-400 font-semibold"
            />
          </div>

          {/* Directory Grid */}
          <div className="border-2 border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
              <span className="text-sm font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <ListFilter size={16} className="text-blue-600" />
                GST Slab Directory ({gstRates.length})
              </span>
            </div>

            {gstRates.length === 0 ? (
              <div className="p-16 text-center text-slate-400 text-lg font-semibold">
                No GST categories found. Click "New GST Category" to configure one.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {gstRates.map((g) => (
                  <div
                    key={g.id}
                    className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white hover:bg-slate-50/75 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-lg text-slate-900">{g.type}</span>
                        <span className="px-2.5 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 font-extrabold text-xs rounded-full">
                          Rate: {g.rate}%
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <button
                        onClick={() => handleEditClick(g)}
                        className="px-4 py-2.5 text-sm border-2 border-slate-200 hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg text-slate-700 font-bold bg-white transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit2 size={14} /> Update
                      </button>
                      <button
                        onClick={() => handleDeleteClick(g.id)}
                        className="px-4 py-2.5 text-sm border-2 border-slate-200 hover:border-red-600 hover:text-red-600 hover:bg-red-50 rounded-lg text-slate-700 font-bold bg-white transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ================================================================
            VIEW MODE: FORM
           ================================================================ */
        <div className="space-y-6">
          {/* Header */}
          <div className="pb-4 border-b border-slate-200">
            <button
              onClick={handleBackToDirectory}
              className="mb-4 text-sm font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer bg-slate-200 hover:bg-slate-300 px-4 py-2 rounded-lg transition-colors"
            >
              <ArrowLeft size={16} />
              Back to Directory
            </button>
            <h1 className="text-3xl font-extrabold text-slate-900 m-0">
              {editingId ? 'Modify GST Category' : 'Create GST Category'}
            </h1>
            <p className="text-base text-slate-500 mt-1 font-medium">
              {editingId
                ? 'Update GST type label or tax rate value.'
                : 'Configure a new GST tax slab for the business catalog.'}
            </p>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm font-semibold rounded-xl flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div className="bg-white border-2 border-slate-200 rounded-xl p-5 sm:p-8 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                
                {/* GST Type Name */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider">
                    GST Type / Slab Name <b className="text-red-500">*</b>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CGST + SGST 18%"
                    value={formData.type}
                    onChange={set('type')}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-base text-slate-900 focus:outline-none focus:border-blue-600 placeholder:text-slate-400 font-medium"
                  />
                </div>

                {/* GST Rate Percent */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider">
                    Total GST Rate (%) <b className="text-red-500">*</b>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    required
                    placeholder="e.g. 18.00"
                    value={formData.rate}
                    onChange={set('rate')}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-base text-slate-900 focus:outline-none focus:border-blue-600 placeholder:text-slate-400 font-medium"
                  />
                </div>
              </div>

              {/* Buttons */}
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
                  disabled={isLoading}
                  className={`px-10 py-4 rounded-lg font-bold text-base uppercase tracking-wider text-white transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed
                    ${editingId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  {isLoading ? (
                    'Processing...'
                  ) : editingId ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" /> Update Category
                    </>
                  ) : (
                    <>
                      <Plus size={18} /> Save Category
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
