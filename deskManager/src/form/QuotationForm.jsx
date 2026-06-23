import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Plus, RefreshCw, X, CheckSquare, Square, History } from 'lucide-react';
import { toast } from 'react-toastify';
import ItemQuoteHistory from '../components/ItemQuoteHistory.jsx';

const DEFAULT_TERMS = [
  "1. Price Validity: 30 days from date of quote.\n2. Delivery: 4-6 weeks after receipt of technically and commercially clear PO.\n3. Payment Terms: 30% advance with order, balance against delivery.\n4. Warranty: 12 months from dispatch.",
  "1. Payment Terms: Net 45 days.\n2. Price Basis: F.O.R. Shreeji Industries, taxes extra.\n3. Validity: This offer is valid for 15 days.\n4. Delivery: Within 2 weeks from PO.",
  "1. Delivery Terms: Ex-works, freight on to-pay basis.\n2. Payment: Net 30 days credit.\n3. Taxes & Duties: GST extra at actuals.\n4. Price Validity: 45 days from quote.",
  "1. Payment Terms: 50% advance along with order, 50% prior to dispatch.\n2. Delivery Period: 3 weeks from receipt of clear PO.\n3. Validity of Quote: 30 days.\n4. Unloading: In customer scope.",
  "1. Price: Firm and final, packing included.\n2. Payment: 100% within 30 days of dispatch.\n3. Validity: 60 days.\n4. Delivery: 1 week from order confirmation."
];

const labelCls = "block text-xs font-bold text-slate-700 uppercase mb-1.5";
const inputCls = "w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm placeholder:text-slate-400 font-medium focus:outline-none transition-colors duration-150 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed";

export default function QuotationForm({ activeTab }) {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const queryRfqNo = searchParams.get('rfq_no');
  const queryTradeId = searchParams.get('trade_id');
  const editingNo = id || (activeTab === 'updateQuotation' ? id : null);

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

  // Handle query parameter RFQ selection or Edit mode on mount/change
  useEffect(() => {
    if (editingNo) {
      fetchQuotationDetails(editingNo);
    } else {
      // Create Mode
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
    }
  }, [editingNo, queryRfqNo]);

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

  const fetchQuotationDetails = async (qNo) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/quotations/${encodeURIComponent(qNo)}`);
      if (!res.ok) {
        throw new Error('Failed to fetch quotation details');
      }
      const qData = await res.json();

      setSelectedRFQ({
        rfq_no: qData.rfq_no,
        customer_id: qData.customer_id,
        buyer_name: qData.buyer_name,
        trade_id: qData.trade_id
      });

      setFormData({
        quotation_no: qData.quotation_no,
        rfq_no: qData.rfq_no,
        quotation_date: qData.quotation_date ? qData.quotation_date.split('T')[0] : '',
        terms_and_conditions: qData.terms_and_conditions || ''
      });
      setRfqInput(qData.rfq_no);

      // Populate items
      if (Array.isArray(qData.items)) {
        setQuotationItems(
          qData.items.map(item => ({
            item_code: item.item_code,
            quantity: item.quantity,
            unit: item.unit || 'Piece',
            unit_price: item.unit_price,
            description: item.description || '',
            drawing_number: item.drawing_number || '',
            selected: true
          }))
        );
      }

      // Fetch received quotations
      if (Array.isArray(qData.received_quotations) && qData.received_quotations.length > 0) {
        const loadedRqs = [];
        for (const rqNo of qData.received_quotations) {
          try {
            const rqRes = await fetch(`/api/received-quotations?q=${encodeURIComponent(rqNo)}`);
            if (rqRes.ok) {
              const rqData = await rqRes.json();
              const matched = rqData.find(item => item.received_quotation_no === rqNo);
              loadedRqs.push(matched || { received_quotation_no: rqNo });
            } else {
              loadedRqs.push({ received_quotation_no: rqNo });
            }
          } catch {
            loadedRqs.push({ received_quotation_no: rqNo });
          }
        }
        setSelectedRecQtns(loadedRqs);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Connection error while fetching quotation details.');
    } finally {
      setIsLoading(false);
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
        // filter out already selected ones
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
      return acc + (parseFloat(curr.unit_price) || 0) * (parseInt(curr.quantity) || 0);
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
      quotation_no: editingNo ? editingNo : (nextQuotationNo || undefined),
      rfq_no: formData.rfq_no,
      quotation_date: formData.quotation_date,
      terms_and_conditions: formData.terms_and_conditions,
      items: activeItems.map(i => ({
        item_code: i.item_code,
        quantity: parseInt(i.quantity) || 1,
        unit: i.unit,
        unit_price: parseFloat(i.unit_price) || 0
      })),
      received_quotations: selectedRecQtns.map(rq => rq.received_quotation_no)
    };

    try {
      let res;
      if (editingNo) {
        res = await fetch(`/api/quotations/${encodeURIComponent(editingNo)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/quotations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        toast.success(`Quotation ${editingNo ? 'updated' : 'created'} successfully!`);
        const destTradeId = queryTradeId || selectedRFQ?.trade_id;
        if (destTradeId) {
          navigate(`/trade/${destTradeId}`);
        } else {
          navigate('/');
        }
      } else {
        const errData = await res.json();
        setError(errData.error || `Failed to save quotation`);
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
            {editingNo ? 'Modify Quotation' : 'Create Quotation'}
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            {editingNo
              ? 'Update commercial pricing details and terms.'
              : 'Formulate a commercial offer based on customer RFQ specifications.'}
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg flex items-center gap-1.5">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        <div className="bg-white border border-slate-300 rounded-lg p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Quotation No & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Quotation No.</label>
                <input
                  type="text"
                  disabled
                  value={editingNo ? formData.quotation_no : nextQuotationNo || 'Generating...'}
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded text-sm text-slate-500 cursor-not-allowed font-mono font-bold"
                />
                <p className="text-[10px] text-slate-400 font-semibold mt-1.5 pl-1">
                  Quotation reference number is auto-generated.
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

            {/* RFQ Autocomplete Link */}
            <div ref={rfqRef} className="relative">
              <label className={labelCls}>Link to RFQ No. <b className="text-red-500">*</b></label>
              <input
                type="text"
                required
                disabled={!!editingNo || !!queryRfqNo}
                placeholder="Type RFQ No. to link..."
                value={rfqInput}
                onChange={(e) => handleRfqInput(e.target.value)}
                onFocus={() => rfqInput.trim() && setShowRfqDropdown(true)}
                className={inputCls}
                onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                autoComplete="off"
              />
              {showRfqDropdown && rfqSuggestions.length > 0 && (
                <div className="absolute z-30 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                  {rfqSuggestions.map((rfq) => (
                    <button
                      key={rfq.rfq_no}
                      type="button"
                      onClick={() => selectRFQ(rfq)}
                      className="w-full text-left px-3.5 py-2 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                    >
                      <div className="flex justify-between items-center">
                        <div className="font-bold text-xs text-slate-900">{rfq.rfq_no}</div>
                        {rfq.status && rfq.status !== 'rfq' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.25 rounded bg-blue-50 text-blue-700 border border-blue-200">
                            {rfq.status.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Customer: {rfq.customer_id || '—'} &bull; Buyer: {rfq.buyer_name || '—'} &bull; {Array.isArray(rfq.items) ? rfq.items.length : 0} items
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {rfqNotFound && (
                <div className="mt-2 flex items-center gap-1.5 text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 text-[10px] font-bold">
                  <AlertCircle size={12} />
                  No RFQ found matching "{rfqInput}". Please ensure the RFQ exists.
                </div>
              )}
              {(editingNo || queryRfqNo) && (
                <p className="text-[10px] text-slate-400 font-semibold mt-1.5 pl-1">
                  RFQ link cannot be modified for saved or trade-linked quotations.
                </p>
              )}
            </div>

            {/* RFQ Linked Indicator */}
            {selectedRFQ && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <div className="flex justify-between flex-wrap gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <span className="text-emerald-600">✓ RFQ Link Active</span>
                  <span>Customer: {selectedRFQ.customer_id || '—'}</span>
                  <span>Buyer: {selectedRFQ.buyer_name || '—'}</span>
                </div>
              </div>
            )}

            {/* Items and Amounts */}
            {quotationItems.length > 0 && (
              <div className="border border-slate-200 rounded-lg overflow-x-auto mt-2">
                <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center rounded-t-lg">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Select items to quote from RFQ
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const allSelected = quotationItems.every(i => i.selected);
                      setQuotationItems(prev => prev.map(i => ({ ...i, selected: !allSelected })));
                    }}
                    className="text-xs text-blue-600 hover:text-blue-700 font-bold hover:underline cursor-pointer"
                  >
                    {quotationItems.every(i => i.selected) ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div className="divide-y divide-slate-100">
                  {quotationItems.map((item) => (
                    <div
                      key={item.item_code}
                      className={`px-4 py-3 transition-colors ${
                        item.selected ? 'bg-blue-50/10' : 'bg-white opacity-70'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        {/* Checkbox */}
                        <button
                          type="button"
                          onClick={() => toggleItemSelection(item.item_code)}
                          className="focus:outline-none shrink-0 cursor-pointer"
                          style={{ color: 'var(--theme-color)' }}
                        >
                          {item.selected ? <CheckSquare size={18} /> : <Square size={18} className="text-slate-400" />}
                        </button>

                        {/* Details */}
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
                            <span className="text-[10px] text-slate-400 font-bold bg-slate-50 border border-slate-200 px-1.5 py-0.25 rounded">
                              Qty: {item.quantity}
                            </span>
                          </div>
                          {item.description && (
                            <p className="text-[10px] text-slate-500 mt-1 truncate">{item.description}</p>
                          )}
                        </div>

                        {/* Unit Input */}
                        <div className="shrink-0 flex items-center gap-2">
                          <div className="flex flex-col items-end">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                              Unit {item.selected && <b className="text-red-500">*</b>}
                            </label>
                            <input
                              type="text"
                              list="quotation-units-list"
                              required={item.selected}
                              disabled={!item.selected}
                              placeholder="Piece"
                              value={item.unit || ''}
                              onChange={(e) => handleUnitChange(item.item_code, e.target.value)}
                              className="w-16 px-1.5 py-1 text-center font-bold text-xs text-slate-800 bg-white border border-slate-300 rounded focus:outline-none focus:border-[var(--theme-color)] disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                            />
                          </div>
                        </div>

                        {/* Price Input */}
                        <div className="shrink-0 flex items-center gap-2">
                          <div className="flex flex-col items-end">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                              Price (₹) {item.selected && <b className="text-red-500">*</b>}
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              required={item.selected}
                              disabled={!item.selected}
                              placeholder="0.00"
                              value={item.unit_price}
                              onChange={(e) => handlePriceChange(item.item_code, e.target.value)}
                              className="w-24 px-1.5 py-1 text-right font-bold text-xs text-slate-800 bg-white border border-slate-300 rounded focus:outline-none focus:border-[var(--theme-color)] disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                            />
                          </div>
                        </div>

                        {/* History Button */}
                        <button
                          type="button"
                          onClick={() => setHistoryItem(item.item_code)}
                          className="p-1 mt-3.5 text-slate-400 hover:text-[var(--theme-color)] hover:bg-slate-50 rounded transition-colors cursor-pointer shrink-0"
                          title="View Quote History"
                        >
                          <History size={14} />
                        </button>
                      </div>

                      {/* Inline history panel for mobile/small screen */}
                      {historyItem === item.item_code && (
                        <div className="block lg:hidden mt-3 p-4 bg-slate-50 border border-slate-300 rounded-lg space-y-4 animate-fade-in w-full">
                          <ItemQuoteHistory
                            code={historyItem}
                            excludeRfq={formData.rfq_no}
                            onClose={() => setHistoryItem(null)}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Total Preview */}
                <div className="bg-slate-50 px-4 py-2 border-t border-slate-200 flex justify-end">
                  <p className="text-sm font-bold text-slate-800">
                    Total: ₹{calculateTotal(quotationItems).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            )}

            {/* Received Quotations Link (Optional, Multiple) */}
            <div ref={recQtnRef} className="relative">
              <label className={labelCls}>Link to Received Quotation(s) <span className="text-slate-400 font-semibold">(Optional)</span></label>
              <input
                type="text"
                placeholder="Search Received Quotation by ID or buyer name to link..."
                value={recQtnInput}
                onChange={(e) => handleRecQtnInput(e.target.value)}
                onFocus={() => recQtnInput.trim() && setShowRecQtnDropdown(true)}
                className={inputCls}
                onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
                autoComplete="off"
              />
              {showRecQtnDropdown && recQtnInput.trim() !== '' && (
                <div className="absolute z-30 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                  {recQtnSuggestions.length > 0 && (
                    recQtnSuggestions.map((rq) => (
                      <button
                        key={rq.received_quotation_no}
                        type="button"
                        onClick={() => addRecQtn(rq)}
                        className="w-full text-left px-3.5 py-2 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                      >
                        <div className="font-bold text-xs text-slate-900">{rq.received_quotation_no}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Buyer: {rq.buyer_name || '—'} &bull; Date: {fmtDate(rq.quotation_date)} &bull; {Array.isArray(rq.items) ? rq.items.length : 0} items
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Selected Received Quotations Chips */}
              {selectedRecQtns.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selectedRecQtns.map((rq) => (
                    <div
                      key={rq.received_quotation_no}
                      className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 font-semibold rounded text-[10px]"
                    >
                      <span>{rq.received_quotation_no} {rq.buyer_name ? `(${rq.buyer_name})` : ''}</span>
                      <button
                        type="button"
                        onClick={() => removeRecQtn(rq.received_quotation_no)}
                        className="text-blue-400 hover:text-blue-600 cursor-pointer"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Terms and Conditions */}
            <div>
              <label className={labelCls}>Terms & Conditions</label>
              <textarea
                rows={4}
                placeholder="Add billing terms, delivery schedules, price validity, etc..."
                value={formData.terms_and_conditions}
                onChange={set('terms_and_conditions')}
                className={`${inputCls} resize-none`}
                onFocus={(e) => e.target.style.borderColor = 'var(--theme-color)'}
                onBlur={(e) => e.target.style.borderColor = 'rgb(203, 213, 225)'}
              />
            </div>

            {/* Buttons */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-50 rounded-lg font-semibold text-sm text-slate-700 transition-colors cursor-pointer"
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
                  <><RefreshCw size={14} className="animate-spin" /> Processing...</>
                ) : editingNo ? (
                  <><RefreshCw size={14} /> Update Quotation</>
                ) : (
                  <><Plus size={14} /> Save Quotation</>
                )}
              </button>
            </div>
          </form>
        </div>
        </div>

        {/* Right side history panel */}
        {historyItem && (
          <div className="hidden lg:block lg:col-span-2 bg-white border border-slate-300 rounded-lg p-5 shadow-sm space-y-4 animate-fade-in self-start lg:sticky lg:top-5 w-full">
            <ItemQuoteHistory
              code={historyItem}
              excludeRfq={formData.rfq_no}
              onClose={() => setHistoryItem(null)}
            />
          </div>
        )}
      </div>

      <datalist id="quotation-units-list">
        {units.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
    </div>
  );
}
