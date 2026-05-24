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

export default function AddCustomerView({ 
  customers, 
  onAddCustomer, 
  onUpdateCustomer,
  isLoading,
  error
}) {
  // viewMode: 'list' (default) or 'form'
  const [viewMode, setViewMode] = useState('list');

  // Form state
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    address: ''
  });

  // Editing state
  const [editingId, setEditingId] = useState(null);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Handle Edit Select
  const handleEditClick = (customer) => {
    setEditingId(customer.id);
    setFormData({
      id: customer.id || '',
      name: customer.name || '',
      address: customer.address || ''
    });
    setViewMode('form'); 
  };

  const handleOpenAddForm = () => {
    setEditingId(null);
    setFormData({
      id: '',
      name: '',
      address: ''
    });
    setViewMode('form'); // Switch to full-page form
  };

  const handleBackToDirectory = () => {
    setEditingId(null);
    setFormData({
      id: '',
      name: '',
      address: ''
    });
    setViewMode('list'); // Switch back to directory list
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.id.trim() || !formData.name.trim() || !formData.address.trim()) return;

    if (editingId) {
      // Update Name and Address for the specified ID
      const success = await onUpdateCustomer(editingId, {
        name: formData.name,
        address: formData.address
      });
      if (success) {
        handleBackToDirectory();
      }
    } else {
      // Create new customer with user-written ID
      const success = await onAddCustomer(formData);
      if (success) {
        setFormData({
          id: '',
          name: '',
          address: ''
        });
      }
    }
  };

  // Search filter
  const filteredCustomers = customers.filter(customer => {
    const q = searchQuery.toLowerCase();
    return (
      (customer.id && customer.id.toLowerCase().includes(q)) ||
      (customer.name && customer.name.toLowerCase().includes(q)) ||
      (customer.address && customer.address.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex-1 p-4 sm:p-8 lg:p-10 bg-[#f1f5f9] max-w-5xl mx-auto w-full text-slate-900">
      
      {viewMode === 'list' ? (
        <div className="space-y-6">
          
          {/* Header with Onboard Button */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 m-0">
                Customers Directory
              </h1>
              <p className="text-base text-slate-500 mt-1 font-medium">
                Browse, search, and manage client details.
              </p>
            </div>
            <button
              onClick={handleOpenAddForm}
              className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm self-start sm:self-auto"
            >
              <Plus size={20} />
              Onboard New Customer
            </button>
          </div>

          

          {/* Full-Page Search Box */}
          <div className="flex items-center gap-3 border-2 border-slate-200 rounded-xl px-4 py-4 bg-white shadow-sm">
            <Search size={22} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search customers by Customer ID, name, or address details..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent focus:outline-none text-lg text-slate-855 placeholder:text-slate-400 font-semibold"
            />
          </div>

          {/* Directory Listings */}
          <div className="border-2 border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <div className="bg-slate-55 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <span className="text-sm font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <ListFilter size={16} className="text-blue-600" />
                Customer Database Directory ({filteredCustomers.length})
              </span>
            </div>

            {filteredCustomers.length === 0 ? (
              <div className="p-16 text-center text-slate-405 text-lg font-semibold bg-white">
                No customer records logged. Click "+ Onboard New Customer" to add one.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {filteredCustomers.map((customer) => (
                  <div 
                    key={customer.id} 
                    className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-slate-50/20 transition-colors"
                  >
                    <div className="min-w-0 space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-extrabold text-blue-750 bg-blue-50 border border-blue-200 px-3 py-1 rounded uppercase tracking-wider font-mono">
                          ID: {customer.id}
                        </span>
                        <span className="font-extrabold text-slate-900 text-lg">{customer.name}</span>
                      </div>
                      <div className="text-sm text-slate-655 font-semibold mt-1">
                        <strong className="text-slate-500">Address:</strong> {customer.address}
                      </div>
                    </div>

                    {/* Actions: ONLY Edit Details, NO Delete Button */}
                    <div className="flex gap-2.5 shrink-0">
                      <button
                        onClick={() => handleEditClick(customer)}
                        className="px-6 py-3 text-sm border-2 border-slate-200 hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg text-slate-700 font-bold bg-white transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit2 size={14} /> Update Record
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      ) : (

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
              {editingId ? `Modify Record: Customer ID ${editingId}` : 'Onboard New Customer'}
            </h1>
            <p className="text-base text-slate-500 mt-1 font-medium">
              {editingId ? 'Update details of an existing customer record.' : 'Create a brand new client profile in your PostgreSQL database.'}
            </p>
          </div>

          <div className="bg-white border-2 border-slate-200 rounded-xl p-5 sm:p-8 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-6">
              
              <div className="space-y-5">
                {/* Customer ID (Written by User) */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider">
                    Customer ID *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingId}
                    placeholder="e.g. CUST-101"
                    value={formData.id}
                    onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                    className={`w-full px-4 py-3 border rounded-lg text-base text-slate-850 focus:outline-none placeholder:text-slate-400 font-medium
                      ${editingId 
                        ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed font-semibold' 
                        : 'bg-white border-slate-300 focus:border-blue-600'
                      }
                    `}
                  />
                  {!editingId && (
                    <p className="text-xs text-slate-400 mt-1.5 font-medium">
                      Type a custom ID for this customer. It must be unique.
                    </p>
                  )}
                </div>

                {/* Full Name */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider">
                    Customer Name *
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

                {/* Address */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider">
                    Customer Address *
                  </label>
                  <textarea
                    rows="5"
                    required
                    placeholder="Provide physical street address, building/suite number, city, and state details..."
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-base text-slate-855 focus:outline-none focus:border-blue-600 placeholder:text-slate-400 resize-none font-medium"
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
                      <RefreshCw size={18} className="animate-spin" /> Update details
                    </>
                  ) : (
                    <>
                      <Plus size={18} /> Add Customer
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
