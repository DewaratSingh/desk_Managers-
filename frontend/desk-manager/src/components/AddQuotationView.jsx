import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Edit2,
  Plus,
  RefreshCw,
  ArrowLeft,
  ListFilter,
  AlertCircle,
  FileText
} from 'lucide-react';

const API_BASE_URL = 'http://localhost:5000/api';

const DEFAULT_TERMS = `Delivery: 2 weeks
Transportation: For PG
GST-9% SGST + 9% CGST
Packing Forwarding: NIL
Payment: 30 DAYS CREDIT.
Inspection: At our site before dispatch.
Validity-30 days`;

const EMPTY_FORM = {
  quotation_no: '',
  rfq_no: '',
  quotation_date: '',
  terms_and_conditions: DEFAULT_TERMS
};

export default function AddQuotationView({
  rfqs,
  quotations,
  onAddQuotation,
  onUpdateQuotation,
  isLoading,
  error
}) {
  const [viewMode, setViewMode] = useState('list');
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingNo, setEditingNo] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected RFQ details and its items
  const [selectedRFQ, setSelectedRFQ] = useState(null);
  const [quotationItems, setQuotationItems] = useState([]);

  // RFQ autocomplete
  const [rfqInput, setRfqInput] = useState('');
  const [rfqSuggestions, setRfqSuggestions] = useState([]);
  const [showRfqDropdown, setShowRfqDropdown] = useState(false);
  const rfqRef = useRef(null);

  // Dynamic preview of next quotation number
  const [nextQuotationNo, setNextQuotationNo] = useState('');

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (rfqRef.current && !rfqRef.current.contains(e.target)) {
        setShowRfqDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Fetch next quotation no when entering creation form
  const fetchNextQuotationNo = async () => {
    try {
      const savedToken = localStorage.getItem('dm_token');
      const res = await fetch(`${API_BASE_URL}/quotations/next-no`, {
        headers: { 'Authorization': `Bearer ${savedToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNextQuotationNo(data.next_no);
      }
    } catch (err) {
      console.error('Error fetching next quotation no:', err);
    }
  };

  const handleRfqInput = (val) => {
    setRfqInput(val);
    setFormData((prev) => ({ ...prev, rfq_no: val }));
    setSelectedRFQ(null);
    setQuotationItems([]);

    if (!val.trim()) {
      setRfqSuggestions([]);
      setShowRfqDropdown(false);
      return;
    }

    // Prefix-matching starting from query
    const filtered = rfqs.filter((r) =>
      r.rfq_no.toLowerCase().startsWith(val.toLowerCase())
    );
    setRfqSuggestions(filtered);
    setShowRfqDropdown(true);
  };

  const selectRFQ = (rfq) => {
    setRfqInput(rfq.rfq_no);
    setFormData((prev) => ({ ...prev, rfq_no: rfq.rfq_no }));
    setSelectedRFQ(rfq);
    setShowRfqDropdown(false);

    // Load RFQ items into quotation item list (initializing price to empty string)
    if (Array.isArray(rfq.items)) {
      setQuotationItems(
        rfq.items.map((i) => ({
          item_code: i.item_code,
          description: i.description || '',
          drawing_number: i.drawing_number || '',
          quantity: i.quantity || 1,
          unit_price: ''
        }))
      );
    }
  };

  const rfqNotFound =
    rfqInput.trim().length > 0 &&
    !selectedRFQ &&
    rfqs.filter((r) => r.rfq_no.toLowerCase().startsWith(rfqInput.toLowerCase())).length === 0;

  const handlePriceChange = (item_code, price) => {
    setQuotationItems((prev) =>
      prev.map((i) => {
        if (i.item_code === item_code) {
          // Keep as string to allow decimal editing in input, validate on submit
          return { ...i, unit_price: price };
        }
        return i;
      })
    );
  };

  /* ── Navigation Helpers ── */
  const handleOpenAddForm = () => {
    setEditingNo(null);
    setFormData({
      ...EMPTY_FORM,
      quotation_date: new Date().toISOString().slice(0, 10)
    });
    setRfqInput('');
    setSelectedRFQ(null);
    setQuotationItems([]);
    fetchNextQuotationNo();
    setViewMode('form');
  };

  const handleEditClick = (qtn) => {
    setEditingNo(qtn.quotation_no);
    setFormData({
      quotation_no: qtn.quotation_no,
      rfq_no: qtn.rfq_no,
      quotation_date: qtn.quotation_date ? qtn.quotation_date.slice(0, 10) : '',
      terms_and_conditions: qtn.terms_and_conditions || ''
    });

    setRfqInput(qtn.rfq_no);
    const linkedRFQ = rfqs.find((r) => r.rfq_no === qtn.rfq_no);
    setSelectedRFQ(linkedRFQ || null);

    setQuotationItems(
      Array.isArray(qtn.items)
        ? qtn.items.map((i) => ({
            item_code: i.item_code,
            description: i.description || '',
            drawing_number: i.drawing_number || '',
            quantity: i.quantity || 1,
            unit_price: i.unit_price !== undefined ? i.unit_price : ''
          }))
        : []
    );

    setViewMode('form');
  };

  const handleBackToDirectory = () => {
    setEditingNo(null);
    setFormData(EMPTY_FORM);
    setRfqInput('');
    setSelectedRFQ(null);
    setQuotationItems([]);
    setViewMode('list');
  };

  /* ── Submit Handler ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.rfq_no.trim() || !formData.quotation_date) return;

    if (!editingNo && !selectedRFQ) {
      alert('Please select a valid RFQ from the suggestion dropdown.');
      return;
    }

    if (quotationItems.length === 0) {
      alert('Selected RFQ does not contain any items.');
      return;
    }

    // Validate prices
    for (const item of quotationItems) {
      const price = parseFloat(item.unit_price);
      if (item.unit_price === '' || isNaN(price) || price < 0) {
        alert(`Price for item ${item.item_code} is compulsory and must be at least 0.`);
        return;
      }
    }

    const payload = {
      ...formData,
      items: quotationItems
    };

    if (editingNo) {
      const success = await onUpdateQuotation(editingNo, payload);
      if (success) handleBackToDirectory();
    } else {
      const success = await onAddQuotation(payload);
      if (success) {
        // Clear form to allow adding another
        setFormData({
          ...EMPTY_FORM,
          quotation_date: new Date().toISOString().slice(0, 10)
        });
        setRfqInput('');
        setSelectedRFQ(null);
        setQuotationItems([]);
        fetchNextQuotationNo();
      }
    }
  };

  const set = (field) => (e) =>
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  /* ── Filter Directory ── */
  const filteredQuotations = quotations.filter((q) => {
    const qry = searchQuery.toLowerCase();
    return (
      (q.quotation_no && q.quotation_no.toLowerCase().includes(qry)) ||
      (q.rfq_no && q.rfq_no.toLowerCase().includes(qry))
    );
  });

  const fmtDate = (d) => {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const calculateTotal = (itemsList) => {
    if (!Array.isArray(itemsList)) return 0;
    return itemsList.reduce((sum, i) => sum + (i.quantity || 0) * (parseFloat(i.unit_price) || 0), 0);
  };

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
              <h1 className="text-3xl font-extrabold text-slate-900 m-0">Quotation Registry</h1>
              <p className="text-base text-slate-500 mt-1 font-medium">
                Create and manage commercial quotations linked directly to registered RFQs.
              </p>
            </div>
            <button
              onClick={handleOpenAddForm}
              className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm self-start sm:self-auto"
            >
              <Plus size={20} />
              New Quotation
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
              placeholder="Search by quotation no. or RFQ no..."
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
                Quotation Directory ({filteredQuotations.length})
              </span>
            </div>

            {filteredQuotations.length === 0 ? (
              <div className="p-16 text-center text-slate-400 text-lg font-semibold">
                No quotations found. Click "New Quotation" to create one.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {filteredQuotations.map((q) => (
                  <div
                    key={q.quotation_no}
                    className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white hover:bg-slate-50/75 transition-colors"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-extrabold text-sm text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                          {q.quotation_no}
                        </span>
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                          RFQ: {q.rfq_no}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 font-medium">
                        <span>Date: {fmtDate(q.quotation_date)}</span>
                        <span>•</span>
                        <span>Items: {Array.isArray(q.items) ? q.items.length : 0}</span>
                        <span>•</span>
                        <span className="text-slate-700 font-bold">
                          Total Value: ₹{calculateTotal(q.items).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleEditClick(q)}
                      className="px-6 py-3 text-sm border-2 border-slate-200 hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg text-slate-700 font-bold bg-white transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit2 size={14} /> Update Record
                    </button>
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
              {editingNo ? 'Modify Quotation' : 'Create Quotation'}
            </h1>
            <p className="text-base text-slate-500 mt-1 font-medium">
              {editingNo
                ? 'Update commercial pricing details and terms.'
                : 'Formulate a commercial offer based on customer RFQ specifications.'}
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
              <div className="space-y-5">
                {/* Quotation No & Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider">
                      Quotation No.
                    </label>
                    <input
                      type="text"
                      disabled
                      value={editingNo ? formData.quotation_no : nextQuotationNo || 'Generating...'}
                      className="w-full px-4 py-3 bg-slate-100 border border-slate-300 rounded-lg text-base text-slate-500 cursor-not-allowed font-mono font-bold"
                    />
                    <p className="text-[10px] text-slate-400 font-semibold mt-1.5 pl-1">
                      Quotation reference number is auto-generated.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider">
                      Quotation Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.quotation_date}
                      onChange={set('quotation_date')}
                      className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-base text-slate-900 focus:outline-none focus:border-blue-600 font-medium"
                    />
                  </div>
                </div>

                {/* RFQ Autocomplete Link */}
                <div ref={rfqRef} className="relative">
                  <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider">
                    Link to RFQ No. *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingNo}
                    placeholder="Type RFQ No. to link..."
                    value={rfqInput}
                    onChange={(e) => handleRfqInput(e.target.value)}
                    onFocus={() => rfqInput.trim() && setShowRfqDropdown(true)}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-base text-slate-900 focus:outline-none focus:border-blue-600 placeholder:text-slate-400 font-medium disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                    autoComplete="off"
                  />
                  {showRfqDropdown && rfqSuggestions.length > 0 && (
                    <div className="absolute z-30 w-full mt-1 bg-white border-2 border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
                      {rfqSuggestions.map((rfq) => (
                        <button
                          key={rfq.rfq_no}
                          type="button"
                          onClick={() => selectRFQ(rfq)}
                          className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                        >
                          <div className="font-bold text-sm text-slate-900">{rfq.rfq_no}</div>
                          <div className="text-xs text-slate-500">
                            Customer: {rfq.customer_id || '—'} &bull; Buyer: {rfq.buyer_name || '—'} &bull; {Array.isArray(rfq.items) ? rfq.items.length : 0} items
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {rfqNotFound && (
                    <div className="mt-2 flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs font-bold">
                      <AlertCircle size={13} />
                      No RFQ found matching "{rfqInput}". Please ensure the RFQ exists.
                    </div>
                  )}
                  {editingNo && (
                    <p className="text-[10px] text-slate-400 font-semibold mt-1.5 pl-1">
                      RFQ link cannot be modified for saved quotations.
                    </p>
                  )}
                </div>

                {/* RFQ Linked Indicator */}
                {selectedRFQ && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="flex justify-between flex-wrap gap-4 text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                      <span>✓ RFQ Link Active</span>
                      <span className="text-slate-400">|</span>
                      <span>Customer: {selectedRFQ.customer_id || '—'}</span>
                      <span className="text-slate-400">|</span>
                      <span>Buyer: {selectedRFQ.buyer_name || '—'}</span>
                    </div>
                  </div>
                )}

                {/* Items and Amounts */}
                {quotationItems.length > 0 && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                      <span className="text-xs font-extrabold text-slate-500 uppercase tracking-widest">
                        Item Commercial Pricing Table ({quotationItems.length})
                      </span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {quotationItems.map((item) => (
                        <div
                          key={item.item_code}
                          className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-5 py-4 gap-4 bg-white"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-sm text-blue-700">
                                {item.item_code}
                              </span>
                              {item.drawing_number && (
                                <span className="text-xs text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                                  DRW: {item.drawing_number}
                                </span>
                              )}
                              <span className="text-xs text-slate-400 font-bold bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                                Qty: {item.quantity}
                              </span>
                            </div>
                            {item.description && (
                              <p className="text-xs text-slate-500 mt-1">{item.description}</p>
                            )}
                          </div>

                          <div className="shrink-0 flex items-center gap-3">
                            <div className="flex flex-col items-end">
                              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5">
                                Price / Piece (₹) *
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                required
                                placeholder="0.00"
                                value={item.unit_price}
                                onChange={(e) => handlePriceChange(item.item_code, e.target.value)}
                                className="w-32 px-3 py-1.5 text-right font-bold text-sm text-slate-800 bg-white border-2 border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Terms and Conditions */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider">
                    Terms & Conditions
                  </label>
                  <textarea
                  
                    rows={6}
                    placeholder="Add billing terms, delivery schedules, price validity, etc..."
                    value={formData.terms_and_conditions}
                    onChange={set('terms_and_conditions')}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-base text-slate-900 focus:outline-none focus:border-blue-600 placeholder:text-slate-400 font-medium resize-none"
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
                    ${editingNo ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  {isLoading ? (
                    'Processing...'
                  ) : editingNo ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" /> Update Quotation
                    </>
                  ) : (
                    <>
                      <Plus size={18} /> Save Quotation
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
