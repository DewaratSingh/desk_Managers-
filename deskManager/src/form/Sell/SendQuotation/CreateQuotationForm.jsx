import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Plus, RefreshCw, X, CheckSquare, Square, History } from 'lucide-react';
import { toast } from 'react-toastify';
import ItemQuoteHistory from '../../../components/ItemQuoteHistory.jsx';

const DEFAULT_TERMS = [
  "1. Price Validity: 30 days from date of quote.\n2. Delivery: 4-6 weeks after receipt of technically and commercially clear PO.\n3. Payment Terms: 30% advance with order, balance against delivery.\n4. Warranty: 12 months from dispatch.",
  "1. Payment Terms: Net 45 days.\n2. Price Basis: F.O.R. Shreeji Industries, taxes extra.\n3. Validity: This offer is valid for 15 days.\n4. Delivery: Within 2 weeks from PO.",
  "1. Delivery Terms: Ex-works, freight on to-pay basis.\n2. Payment: Net 30 days credit.\n3. Taxes & Duties: GST extra at actuals.\n4. Price Validity: 45 days from quote.",
  "1. Payment Terms: 50% advance along with order, 50% prior to dispatch.\n2. Delivery Period: 3 weeks from receipt of clear PO.\n3. Validity of Quote: 30 days.\n4. Unloading: In customer scope.",
  "1. Price: Firm and final, packing included.\n2. Payment: 100% within 30 days of dispatch.\n3. Validity: 60 days.\n4. Delivery: 1 week from order confirmation."
];

const labelCls = "block text-xs font-bold text-slate-700 uppercase mb-1.5";
const inputCls = "w-full px-3 py-2  bg-[white] border border-slate-300 rounded text-sm placeholder:text-slate-400 font-medium focus:outline-none transition-colors duration-150 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed";

export default function CreateQuotationForm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const queryRfqNo = searchParams.get('rfq_no');
  const queryTradeId = searchParams.get('trade_id');

  const [nextQuotationNo, setNextQuotationNo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [historyItem, setHistoryItem] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    quotation_no: '',
    rfq_no: '',
    quotation_date: '',
    terms_and_conditions: ''
  });

  // RFQ Autocomplete state
  const [rfqInput, setRfqInput] = useState('');
  const [rfqSuggestions, setRfqSuggestions] = useState([]);
  const [showRfqDropdown, setShowRfqDropdown] = useState(false);
  const [rfqNotFound, setRfqNotFound] = useState(false);
  const [selectedRFQ, setSelectedRFQ] = useState(null);

  // Quotation items (mapped from selected RFQ)
  const [quotationItems, setQuotationItems] = useState([]);

  // Received Quotations state (optional mapping)
  const [recQtnInput, setRecQtnInput] = useState('');
  const [recQtnSuggestions, setRecQtnSuggestions] = useState([]);
  const [showRecQtnDropdown, setShowRecQtnDropdown] = useState(false);
  const [selectedRecQtns, setSelectedRecQtns] = useState([]);

  const rfqRef = useRef(null);
  const recQtnRef = useRef(null);
  const rfqManualRef = useRef(false);

  const units = ['Piece', 'Kg', 'Meter', 'Box', 'Set', 'Liter', 'Ton', 'Nos'];

  // Debounced search for RFQs (limit 5)
  useEffect(() => {
    const trimmed = rfqInput.trim();
    if (!trimmed) {
      setRfqSuggestions([]);
      setShowRfqDropdown(false);
      setRfqNotFound(false);
      return;
    }

    if (!rfqManualRef.current) {
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      fetch(`/api/rfqs?q=${encodeURIComponent(trimmed)}&limit=5`)
        .then(r => r.json())
        .then(data => {
          setRfqSuggestions(data);
          setRfqNotFound(data.length === 0);
          setShowRfqDropdown(true);
        })
        .catch(console.error);
    }, 200);

    return () => clearTimeout(delayDebounceFn);
  }, [rfqInput]);

  useEffect(() => {
    fetchNextNo();
    
    // Pick random terms & conditions
    const randomTerm = DEFAULT_TERMS[Math.floor(Math.random() * DEFAULT_TERMS.length)];
    
    setFormData({
      quotation_no: '',
      rfq_no: queryRfqNo || '',
      quotation_date: new Date().toISOString().split('T')[0],
      terms_and_conditions: randomTerm
    });
    setSelectedRFQ(null);
    setQuotationItems([]);
    setSelectedRecQtns([]);
    setRfqInput(queryRfqNo || '');

    if (queryRfqNo) {
      fetchRFQDetails(queryRfqNo);
    }
  }, [queryRfqNo]);

  // Handle click outside dropdowns
  useEffect(() => {
    function handleClickOutside(event) {
      if (rfqRef.current && !rfqRef.current.contains(event.target)) {
        setShowRfqDropdown(false);
      }
      if (recQtnRef.current && !recQtnRef.current.contains(event.target)) {
        setShowRecQtnDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchNextNo = async () => {
    try {
      const res = await fetch('/api/quotations/next-no');
      if (res.ok) {
        const data = await res.json();
        setNextQuotationNo(data.nextNo);
      }
    } catch (err) {
      console.error('Error fetching next quotation no:', err);
    }
  };

  const fetchRFQDetails = async (rfqNo) => {
    try {
      const res = await fetch(`/api/rfqs/${encodeURIComponent(rfqNo)}`);
      if (res.ok) {
        const rfq = await res.json();
        selectRFQ(rfq);
      }
    } catch (err) {
      console.error('Error fetching RFQ details:', err);
    }
  };

  const set = (field) => (e) =>
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  // RFQ Input handler
  const handleRfqInput = (value) => {
    rfqManualRef.current = true;
    setRfqInput(value);
    setFormData(prev => ({ ...prev, rfq_no: '' }));
    setSelectedRFQ(null);
    setQuotationItems([]);
    setShowRfqDropdown(true);
  };

  const selectRFQ = (rfq) => {
    rfqManualRef.current = false;
    setSelectedRFQ(rfq);
    setFormData(prev => ({ ...prev, rfq_no: rfq.rfq_no }));
    setRfqInput(rfq.rfq_no);
    setShowRfqDropdown(false);
    setRfqNotFound(false);

    // Populate items from RFQ
    if (Array.isArray(rfq.items)) {
      setQuotationItems(
        rfq.items.map(i => ({
          item_code: i.item_code,
          quantity: i.quantity,
          unit: i.unit || 'Piece',
          unit_price: 0,
          description: i.description,
          drawing_number: i.drawing_number,
          selected: true
        }))
      );
    }
  };

  // Received Quotations input handler
  const handleRecQtnInput = async (value) => {
    setRecQtnInput(value);
    if (!value.trim()) {
      setRecQtnSuggestions([]);
      setShowRecQtnDropdown(false);
      return;
    }

    try {
      const res = await fetch(`/api/received-quotations?q=${encodeURIComponent(value)}`);
      if (res.ok) {
        const data = await res.json();
        const filtered = data.filter(rq => !selectedRecQtns.some(s => s.received_quotation_no === rq.received_quotation_no));
        setRecQtnSuggestions(filtered);
        setShowRecQtnDropdown(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const addRecQtn = (rq) => {
    setSelectedRecQtns(prev => [...prev, rq]);
    setRecQtnInput('');
    setRecQtnSuggestions([]);
    setShowRecQtnDropdown(false);
  };

  const removeRecQtn = (rqNo) => {
    setSelectedRecQtns(prev => prev.filter(r => r.received_quotation_no !== rqNo));
  };

  // Toggle item selection
  const toggleItemSelection = (itemCode) => {
    setQuotationItems(prev =>
      prev.map(item =>
        item.item_code === itemCode ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const handlePriceChange = (itemCode, price) => {
    setQuotationItems(prev =>
      prev.map(item =>
        item.item_code === itemCode ? { ...item, unit_price: price } : item
      )
    );
  };

  const handleUnitChange = (itemCode, val) => {
    setQuotationItems(prev =>
      prev.map(item =>
        item.item_code === itemCode ? { ...item, unit: val } : item
      )
    );
  };

  const calculateTotal = (itemsList) => {
    return itemsList.reduce((acc, curr) => {
      if (!curr.selected) return acc;
      return acc + (parseFloat(curr.unit_price) || 0) * (parseFloat(curr.quantity) || 0);
    }, 0);
  };

  const fmtDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const handleCancel = () => {
    if (queryTradeId) {
      navigate(`/trade/${queryTradeId}`);
    } else {
      navigate('/');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const activeItems = quotationItems.filter(i => i.selected);
    if (activeItems.length === 0) {
      setError('Please select at least one item to quote.');
      setIsLoading(false);
      return;
    }

    const payload = {
      quotation_no: nextQuotationNo || undefined,
      rfq_no: formData.rfq_no,
      quotation_date: formData.quotation_date,
      terms_and_conditions: formData.terms_and_conditions,
      items: activeItems.map(i => ({
        item_code: i.item_code,
        quantity: parseFloat(i.quantity) || 1,
        unit: i.unit,
        unit_price: parseFloat(i.unit_price) || 0
      })),
      received_quotations: selectedRecQtns.map(rq => rq.received_quotation_no)
    };

    try {
      const res = await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast.success('Quotation created successfully!');
        const destTradeId = queryTradeId || selectedRFQ?.trade_id;
        if (destTradeId) {
          navigate(`/trade/${destTradeId}`);
        } else {
          navigate('/');
        }
      } else {
        const errData = await res.json();
        setError(errData.error || 'Failed to save quotation');
      }
    } catch (err) {
      console.error(err);
      setError('Server connection error while saving quotation.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 p-6 bg-slate-100 text-slate-900 font-sans">
      <div className={historyItem ? "max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-6 items-start" : "max-w-2xl mx-auto space-y-5"}>
        <div className={historyItem ? "lg:col-span-3 space-y-5 flex flex-col w-full" : "space-y-5 flex flex-col w-full"}>
        {/* Header */}
        <div className="pb-2 border-b border-slate-300">
          <button
            type="button"
            onClick={handleCancel}
            className="mb-3 text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer bg-slate-200 hover:bg-slate-300 px-3 py-1.5 rounded-lg transition-colors"
          >
            <ArrowLeft size={14} />
            Back
          </button>
          <h1 className="text-2xl font-bold text-slate-900 m-0">
            Create Quotation
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Formulate a commercial offer based on customer RFQ specifications.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg flex items-center gap-1.5">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        <div className=" bg-[white] border border-slate-300 rounded-lg p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Quotation No & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Quotation No.</label>
                <input
                  type="text"
                  disabled
                  value={nextQuotationNo || 'Generating...'}
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded text-sm text-slate-500 cursor-not-allowed font-mono font-bold"
                />
                <p className="text-[10px] text-slate-400 font-semibold mt-1.5 pl-1">
                  Automatically generated reference number.
                </p>
              </div>

              <div>
                <label className={labelCls}>Quotation Date <b className="text-red-500">*</b></label>
                <input
                  type="date"
                  required
                  value={formData.quotation_date}
                  onChange={set('quotation_date')}
                  className={inputCls}
                  onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                  onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                />
              </div>
            </div>

            {/* RFQ Reference Autocomplete */}
            <div ref={rfqRef} className="relative">
              <label className={labelCls}>Link Customer RFQ <b className="text-red-500">*</b></label>
              <input
                type="text"
                placeholder="Search by RFQ No. to attach specifications..."
                value={rfqInput}
                onChange={(e) => handleRfqInput(e.target.value)}
                onFocus={() => setShowRfqDropdown(true)}
                className={inputCls}
                onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                autoComplete="off"
              />

              {showRfqDropdown && rfqSuggestions.length > 0 && (
                <div className="absolute z-30 w-full mt-1  bg-[white] border border-slate-300 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                  {rfqSuggestions.map(rfq => (
                    <button
                      key={rfq.rfq_no}
                      type="button"
                      onClick={() => selectRFQ(rfq)}
                      className="w-full text-left px-3.5 py-2 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                    >
                      <div className="font-bold text-xs text-slate-900">{rfq.rfq_no}</div>
                      <div className="text-[10px] text-slate-500">
                        Cust: {rfq.customer_id} &bull; Buyer: {rfq.buyer_name} &bull; Items: {rfq.items?.length || 0}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {rfqNotFound && (
                <div className="mt-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
                  <AlertCircle size={13} className="shrink-0" />
                  <span>No RFQ found for "{rfqInput}". Please make sure the RFQ exists.</span>
                </div>
              )}

              {selectedRFQ && (
                <div className="mt-2.5 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1.5">
                  <div className="font-bold text-slate-700 flex items-center gap-2">
                    <span className="text-emerald-600 font-bold">✓ Attached RFQ Details:</span>
                    <span className="font-mono text-slate-900">{selectedRFQ.rfq_no}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-slate-600 text-[11px] pt-1">
                    <div><b className="text-slate-500">Customer:</b> {selectedRFQ.customer_id}</div>
                    <div><b className="text-slate-500">Buyer:</b> {selectedRFQ.buyer_name}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Received Quotations Mapping Section */}
            <div ref={recQtnRef} className="relative">
              <label className={labelCls}>Attach Vendor Quotes (Optional)</label>
              <input
                type="text"
                placeholder="Search incoming vendor quote reference..."
                value={recQtnInput}
                onChange={(e) => handleRecQtnInput(e.target.value)}
                onFocus={() => handleRecQtnInput(recQtnInput)}
                className={inputCls}
                autoComplete="off"
              />

              {showRecQtnDropdown && recQtnSuggestions.length > 0 && (
                <div className="absolute z-30 w-full mt-1  bg-[white] border border-slate-300 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                  {recQtnSuggestions.map(rq => (
                    <button
                      key={rq.received_quotation_no}
                      type="button"
                      onClick={() => addRecQtn(rq)}
                      className="w-full text-left px-3.5 py-2 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                    >
                      <div className="font-bold text-xs text-slate-900">{rq.received_quotation_no}</div>
                      <div className="text-[10px] text-slate-500">
                        Date: {fmtDate(rq.quotation_date)} &bull; Vendor: {rq.vendor_name || rq.buyer_name || '—'}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {selectedRecQtns.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {selectedRecQtns.map(rq => (
                    <span
                      key={rq.received_quotation_no}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold rounded-md"
                    >
                      <span>{rq.received_quotation_no}</span>
                      <button
                        type="button"
                        onClick={() => removeRecQtn(rq.received_quotation_no)}
                        className="hover:text-red-600 focus:outline-none"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Items Table */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={labelCls}>Line Items Specification</label>
                <span className="text-[11px] font-semibold text-slate-500">
                  {quotationItems.filter(i => i.selected).length} selected &bull; Total: ₹{calculateTotal(quotationItems).toFixed(2)}
                </span>
              </div>

              {quotationItems.length > 0 ? (
                <div className="border border-slate-300 rounded-lg overflow-x-auto bg-slate-50">
                  <div className="divide-y divide-slate-200">
                    {quotationItems.map(item => (
                      <div
                        key={item.item_code}
                        className={`px-4 py-3  bg-[white] transition-colors ${
                          item.selected ? 'hover:bg-slate-50' : 'opacity-60 bg-slate-50'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-start gap-2.5 min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => toggleItemSelection(item.item_code)}
                              className="mt-0.5 text-slate-500 hover:text-slate-800 focus:outline-none"
                            >
                              {item.selected ? (
                                <CheckSquare size={16} className="text-blue-600" />
                              ) : (
                                <Square size={16} />
                              )}
                            </button>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono font-bold text-xs text-slate-900 border px-1.5 py-0.25 rounded" style={{ color: 'var(--theme-color)', borderColor: 'var(--theme-color)', backgroundColor: 'rgba(217, 53, 45, 0.05)' }}>
                                  {item.item_code}
                                </span>
                                {item.drawing_number && (
                                  <span className="text-[10px] text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.25 rounded">
                                    DRW: {item.drawing_number}
                                  </span>
                                )}
                              </div>
                              {item.description && (
                                <p className="text-[10px] text-slate-500 mt-1 truncate">{item.description}</p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="flex flex-col items-end">
                              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Qty</label>
                              <div className="w-16 px-1.5 py-1 text-center font-bold text-xs text-slate-800 bg-slate-100 border border-slate-200 rounded">
                                {item.quantity}
                              </div>
                            </div>
                            <div className="flex flex-col items-end">
                              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Unit</label>
                              <input
                                type="text"
                                list="quotation-units-list"
                                disabled={!item.selected}
                                value={item.unit || ''}
                                onChange={(e) => handleUnitChange(item.item_code, e.target.value)}
                                className="w-20 px-1.5 py-1 text-center font-bold text-xs text-slate-800  bg-[white] border border-slate-300 rounded focus:outline-none focus:border-[var(--theme-color)] disabled:bg-slate-100"
                              />
                            </div>
                            <div className="flex flex-col items-end">
                              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Unit Price (₹) *</label>
                              <input
                                type="number"
                                step="0.01"
                                disabled={!item.selected}
                                required={item.selected}
                                placeholder="0.00"
                                value={item.unit_price}
                                onChange={(e) => handlePriceChange(item.item_code, e.target.value)}
                                className="w-24 px-1.5 py-1 text-right font-bold text-xs text-slate-800  bg-[white] border border-slate-300 rounded focus:outline-none focus:border-[var(--theme-color)] disabled:bg-slate-100"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => setHistoryItem(item.item_code)}
                              className="p-1 mt-3.5 text-slate-400 hover:text-[var(--theme-color)] hover:bg-slate-50 rounded transition-colors cursor-pointer shrink-0"
                              title="View Quote History"
                            >
                              <History size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Inline history panel for mobile/small screen */}
                        {historyItem === item.item_code && (
                          <div className="block lg:hidden mt-3 p-4 bg-slate-50 border border-slate-300 rounded-lg space-y-4 animate-fade-in w-full">
                            <ItemQuoteHistory
                              code={historyItem}
                              excludeRfq={formData.rfq_no || null}
                              onClose={() => setHistoryItem(null)}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 border border-slate-200 border-dashed rounded-lg text-center text-xs text-slate-400">
                  Select an RFQ above to automatically extract line items.
                </div>
              )}
            </div>

            {/* Terms and Conditions */}
            <div>
              <label className={labelCls}>Terms and Conditions</label>
              <textarea
                rows={4}
                value={formData.terms_and_conditions}
                onChange={set('terms_and_conditions')}
                className="w-full px-3 py-2  bg-[white] border border-slate-300 rounded text-xs placeholder:text-slate-400 focus:outline-none focus:border-[var(--theme-color)] font-mono leading-relaxed"
                placeholder="Enter standard payment terms, delivery period, price validity..."
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 rounded-lg font-semibold text-sm text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: 'var(--theme-color)' }}
                onMouseEnter={(e) => e.target.style.filter = 'brightness(0.9)'}
                onMouseLeave={(e) => e.target.style.filter = 'none'}
              >
                {isLoading ? (
                  <><RefreshCw size={14} className="animate-spin" /> Saving...</>
                ) : (
                  <><Plus size={14} /> Create Quotation</>
                )}
              </button>
            </div>

          </form>
        </div>
        </div>

        {/* Right side history panel */}
        {historyItem && (
          <div className="hidden lg:block lg:col-span-2  bg-[white] border border-slate-300 rounded-lg p-5 shadow-sm space-y-4 animate-fade-in self-start lg:sticky lg:top-5 w-full">
            <ItemQuoteHistory
              code={historyItem}
              excludeRfq={formData.rfq_no || null}
              onClose={() => setHistoryItem(null)}
            />
          </div>
        )}
      </div>

      <datalist id="quotation-units-list">
        {units.map(u => (
          <option key={u} value={u} />
        ))}
      </datalist>
    </div>
  );
}
