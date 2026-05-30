import React, { useState } from 'react';
import { 
  Search, 
  Edit2, 
  X,
  Plus,
  RefreshCw,
  ArrowLeft,
  UserCheck,
  ListFilter
} from 'lucide-react';

export default function AddBuyerView({ 
  buyers, 
  onAddBuyer, 
  onUpdateBuyer, 
  forceFormOpen,
  onClearForceFormOpen,
  isLoading,
  error,
  fetchMoreData,
  searchResource
}) {
  // viewMode: 'list' (default) or 'form'
  const [viewMode, setViewMode] = useState('list');

  React.useEffect(() => {
    if (forceFormOpen) {
      setEditingId(null);
      setFormData({
        name: '',
        email: '',
        phone: ''
      });
      setViewMode('form');
      onClearForceFormOpen();
    }
  }, [forceFormOpen]);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: ''
  });

  // Editing State
  const [editingId, setEditingId] = useState(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  React.useEffect(() => {
    if (searchResource) {
      const delayDebounceFn = setTimeout(() => {
        searchResource('buyers', searchQuery);
      }, 300);
      return () => clearTimeout(delayDebounceFn);
    }
  }, [searchQuery]);

  // Handle Edit Select
  const handleEditClick = (buyer) => {
    setEditingId(buyer.id);
    setFormData({
      name: buyer.name || '',
      email: buyer.email || '',
      phone: buyer.phone || ''
    });
    setViewMode('form'); // Switch to full-page form
  };

  const handleOpenAddForm = () => {
    setEditingId(null);
    setFormData({
      name: '',
      email: '',
      phone: ''
    });
    setViewMode('form'); // Switch to full-page form
  };

  const handleBackToDirectory = () => {
    setEditingId(null);
    setFormData({
      name: '',
      email: '',
      phone: ''
    });
    setViewMode('list'); // Switch back to directory list
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.phone.trim()) return;

    if (editingId) {
      const success = await onUpdateBuyer(editingId, formData);
      if (success) {
        handleBackToDirectory();
      }
    } else {
      const success = await onAddBuyer(formData);
      if (success) {
        setFormData({
          name: '',
          email: '',
          phone: ''
        });
      }
    }
  };

  // We don't need client-side filter/slice anymore since the API handles it


  return (
    <div className="flex-1 p-4 sm:p-8 lg:p-10 bg-[#f1f5f9] max-w-5xl mx-auto w-full text-slate-900">
      
      {/* =======================================================================
          VIEW MODE: FULL PAGE LIST & SEARCH DIRECTORY (DEFAULT)
         ======================================================================= */}
      {viewMode === 'list' ? (
        <div className="space-y-6">
          
          {/* Header with Onboard Button */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 m-0">
                Buyers Directory
              </h1>
              <p className="text-base text-slate-500 mt-1 font-medium">
                Browse, search, and view buyer contact details.
              </p>
            </div>
            <button
              onClick={handleOpenAddForm}
              className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm self-start sm:self-auto"
            >
              <Plus size={20} />
              Onboard New Buyer
            </button>
          </div>

         

          {/* Full-Page Search Box */}
          <div className="flex items-center gap-3 border-2 border-slate-200 rounded-xl px-4 py-4 bg-white shadow-sm">
            <Search size={22} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search buyers by name, email, or phone number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent focus:outline-none text-lg text-slate-850 placeholder:text-slate-400 font-semibold"
            />
          </div>

          {/* Directory Listings */}
          <div className="border-2 border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <span className="text-sm font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <ListFilter size={16} className="text-blue-600" />
                Buyer Database Directory ({buyers.length})
              </span>
            </div>

            {buyers.length === 0 ? (
              <div className="p-16 text-center text-slate-400 text-lg font-semibold bg-white">
                No buyer records logged. Click "+ Onboard New Buyer" to add one.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {buyers.map((buyer) => (
                  <div 
                    key={buyer.id} 
                    className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-slate-50/20 transition-colors"
                  >
                    <div className="min-w-0 space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="font-extrabold text-slate-900 text-lg">{buyer.name}</span>
                      </div>
                      <div className="text-sm text-slate-600 font-semibold space-y-1">
                        <div><strong className="text-slate-500">Email Address:</strong> {buyer.email}</div>
                        <div><strong className="text-slate-500">Phone Number:</strong> {buyer.phone}</div>
                      </div>
                    </div>

                    {/* Actions: ONLY Edit details, NO Delete Button */}
                    <div className="flex gap-2.5 shrink-0">
                      <button
                        onClick={() => handleEditClick(buyer)}
                        className="px-6 py-3 text-sm border-2 border-slate-200 hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg text-slate-700 font-bold bg-white transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit2 size={14} /> Update Record
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {buyers.length >= 20 && buyers.length % 20 === 0 && (
              <div className="flex justify-center p-4 bg-slate-50 border-t border-slate-200">
                <button
                  onClick={() => fetchMoreData('buyers', buyers.length, searchQuery)}
                  className="px-6 py-2.5 border-2 border-slate-200 hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50 text-slate-700 font-bold text-sm rounded-lg transition-colors cursor-pointer"
                >
                  Load More Buyers
                </button>
              </div>
            )}
          </div>
        </div>

      ) : (

        /* =======================================================================
            VIEW MODE: FULL PAGE DETAILS FORM
           ======================================================================= */
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
              {editingId ? 'Modify Buyer Record' : 'Onboard New Buyer'}
            </h1>
            <p className="text-base text-slate-500 mt-1 font-medium">
              {editingId ? 'Update contact details of an existing buyer account.' : 'Register a new buyer profile in your database.'}
            </p>
          </div>

          <div className="bg-white border-2 border-slate-200 rounded-xl p-5 sm:p-8 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-6">
              
              <div className="space-y-5">
                {/* Buyer Name */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider">
                    Buyer Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Pawan Kumar"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-base text-slate-855 focus:outline-none focus:border-blue-600 placeholder:text-slate-400 font-medium"
                  />
                </div>

                {/* Buyer Email */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider">
                    Buyer Email *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. buyer@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-base text-slate-855 focus:outline-none focus:border-blue-600 placeholder:text-slate-400 font-medium"
                  />
                </div>

                {/* Phone Number */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider">
                    Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 9876501234"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-base text-slate-855 focus:outline-none focus:border-blue-600 placeholder:text-slate-400 font-medium"
                  />
                </div>
              </div>

              {/* Action Submit & Cancel Buttons */}
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
                  className={`
                    px-10 py-4.5 rounded-lg font-bold text-base uppercase tracking-wider text-white transition-colors cursor-pointer flex items-center justify-center gap-2
                    ${editingId 
                      ? 'bg-amber-600 hover:bg-amber-700' 
                      : 'bg-blue-600 hover:bg-blue-700'
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  {isLoading ? 'Processing...' : editingId ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" /> Update Details
                    </>
                  ) : (
                    <>
                      <Plus size={18} /> Add Buyer
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
