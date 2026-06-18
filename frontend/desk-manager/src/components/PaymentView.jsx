import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Plus, RefreshCw, ArrowLeft, Trash2, AlertCircle } from 'lucide-react';

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'http://localhost:5000/api'
  : `${window.location.protocol}//${window.location.hostname}:5000/api`;

export default function PaymentView({ onCancel }) {
  const [payments, setPayments] = useState([]);
  const [viewMode, setViewMode] = useState('list');
  
  const [paymentNo, setPaymentNo] = useState('');
  const [totalAmount, setTotalAmount] = useState('');

  const [poNo, setPoNo] = useState('');
  const [poInput, setPoInput] = useState('');
  const [poSuggestions, setPoSuggestions] = useState([]);
  const [showPoDropdown, setShowPoDropdown] = useState(false);
  const poRef = useRef(null);

  const [roNo, setRoNo] = useState('');
  const [roInput, setRoInput] = useState('');
  const [roSuggestions, setRoSuggestions] = useState([]);
  const [showRoDropdown, setShowRoDropdown] = useState(false);
  const roRef = useRef(null);

  const [isRO, setIsRO] = useState(false);
  const [tradeId, setTradeId] = useState(null);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.state) {
      if (location.state.prefillPoNo) {
        setPoInput(location.state.prefillPoNo);
        setPoNo(location.state.prefillPoNo);
        setRoNo('');
        setRoInput('');
        setIsRO(false);
      } else if (location.state.prefillRoNo) {
        setRoInput(location.state.prefillRoNo);
        setRoNo(location.state.prefillRoNo);
        setPoNo('');
        setPoInput('');
        setIsRO(true);
      }

      if (location.state.prefillTradeId) {
        setTradeId(location.state.prefillTradeId);
      }

      if (location.state.prefillPoNo || location.state.prefillRoNo) {
        setViewMode('form');
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [location.state]);

  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (poRef.current && !poRef.current.contains(e.target)) {
        setShowPoDropdown(false);
      }
      if (roRef.current && !roRef.current.contains(e.target)) {
        setShowRoDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchPayments = async (search = '') => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('dm_token');
      const url = `${API_BASE_URL}/payments?limit=100&offset=0${search ? `&search=${encodeURIComponent(search)}` : ''}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        throw new Error('Failed to fetch payments');
      }
      const data = await res.json();
      setPayments(data);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments(searchQuery);
  }, [searchQuery]);

  const handlePoSearch = async (val) => {
    setPoInput(val);
    setPoNo(''); // Reset if typing
    if (!val.trim()) {
      setPoSuggestions([]);
      setShowPoDropdown(false);
      return;
    }

    try {
      const token = localStorage.getItem('dm_token');
      const res = await fetch(`${API_BASE_URL}/purchase-orders?search=${encodeURIComponent(val)}&limit=5`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPoSuggestions(data);
        setShowPoDropdown(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const selectPo = (po) => {
    setPoInput(po.po_no);
    setPoNo(po.po_no);
    setShowPoDropdown(false);
  };

  const handleRoSearch = async (val) => {
    setRoInput(val);
    setRoNo(''); // Reset if typing
    if (!val.trim()) {
      setRoSuggestions([]);
      setShowRoDropdown(false);
      return;
    }

    try {
      const token = localStorage.getItem('dm_token');
      const res = await fetch(`${API_BASE_URL}/release-orders?search=${encodeURIComponent(val)}&limit=5`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRoSuggestions(data);
        setShowRoDropdown(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const selectRo = (ro) => {
    setRoInput(ro.ro_no);
    setRoNo(ro.ro_no);
    setShowRoDropdown(false);
  };

  const handleOpenAddForm = () => {
    setPaymentNo('');
    setTotalAmount('');
    setPoNo('');
    setPoInput('');
    setRoNo('');
    setRoInput('');
    setIsRO(false);
    setTradeId(null);
    setError(null);
    setViewMode('form');
  };

  const handleBackToDirectory = () => {
    setPaymentNo('');
    setTotalAmount('');
    setPoNo('');
    setPoInput('');
    setRoNo('');
    setRoInput('');
    setIsRO(false);
    setTradeId(null);
    setError(null);
    if (onCancel) {
      onCancel(() => setViewMode('list'));
    } else {
      setViewMode('list');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!paymentNo.trim() || !totalAmount) return;

    setIsLoading(true);
    setError(null);
    const token = localStorage.getItem('dm_token');
    
    try {
      const res = await fetch(`${API_BASE_URL}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          payment_no: paymentNo,
          po_no: !isRO ? (poNo || poInput || null) : null,
          ro_no: isRO ? (roNo || roInput || null) : null,
          total_amount: parseFloat(totalAmount),
          trade_id: tradeId || null
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save Payment');
      }

      await fetchPayments();
      handleBackToDirectory();
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = async (no) => {
    if (!window.confirm(`Are you sure you want to delete Payment record "${no}"?`)) return;
    
    setIsLoading(true);
    setError(null);
    const token = localStorage.getItem('dm_token');
    
    try {
      const res = await fetch(`${API_BASE_URL}/payments/${encodeURIComponent(no)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete Payment');
      }
      setPayments(prev => prev.filter(p => p.payment_no !== no));
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const labelCls = "block text-xs font-extrabold text-slate-500 uppercase mb-2 tracking-wider";
  const inputCls = "w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-base text-slate-900 focus:outline-none focus:border-blue-600 placeholder:text-slate-400 font-medium";

  return (
    <div className="flex-1 p-4 sm:p-8 lg:p-10 bg-[#f1f5f9] max-w-5xl mx-auto w-full text-slate-900">
      {viewMode === 'list' ? (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 m-0">Payments</h1>
              <p className="text-slate-500 mt-1 font-medium">Record and track payments linked to Purchase Orders or Release Orders.</p>
            </div>
            
          </div>

          <div className="flex items-center gap-3 bg-white border-2 border-slate-200 rounded-xl px-4 py-3 shadow-sm focus-within:border-blue-600 transition-colors">
            <Search className="text-slate-400 shrink-0" size={20} />
            <input
              type="text"
              placeholder="Search by Payment Number, PO or RO Number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent focus:outline-none text-base text-slate-900 placeholder:text-slate-400 font-semibold"
            />
            {isLoading && <RefreshCw className="animate-spin text-slate-400" size={18} />}
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 font-semibold text-sm">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="bg-white border-2 border-slate-200 rounded-xl shadow-sm overflow-hidden">
            {payments.length === 0 ? (
              <div className="p-16 text-center text-slate-400 text-lg font-semibold">
                No Payment records found.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {payments.map((p) => (
                  <div key={p.payment_no} className="p-5 flex items-center justify-between gap-4 bg-white hover:bg-slate-50/75 transition-colors">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-mono font-extrabold text-sm text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                          {p.payment_no}
                        </span>
                        {p.po_no && (
                          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                            PO: {p.po_no}
                          </span>
                        )}
                        {p.ro_no && (
                          <span className="text-xs text-amber-500 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                            RO: {p.ro_no}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-700 font-bold">
                        Amount Paid: ₹{parseFloat(p.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteClick(p.payment_no)}
                      className="p-3 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-red-200"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="pb-4 border-b border-slate-200">
            <button
              onClick={handleBackToDirectory}
              className="mb-4 text-sm font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer bg-slate-200 hover:bg-slate-300 px-4 py-2 rounded-lg transition-colors"
            >
              <ArrowLeft size={16} /> Back to Directory
            </button>
            <h1 className="text-3xl font-extrabold text-slate-900 m-0">Record Payment</h1>
            <p className="text-slate-500 mt-1 font-medium">Record a payment transaction.</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 font-semibold text-sm">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="bg-white border-2 border-slate-200 rounded-xl p-6 sm:p-8 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Payment Number <b className="text-red-500">*</b></label>
                  <input
                    type="text"
                    required
                    placeholder="Enter Payment Number (e.g. PAY-2026-0001)"
                    value={paymentNo}
                    onChange={(e) => setPaymentNo(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Total Amount (₹) <b className="text-red-500">*</b></label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Enter Payment Amount"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              {isRO ? (
                <div ref={roRef} className="relative">
                  <label className={labelCls}>Link to Release Order (RO)</label>
                  <input
                    type="text"
                    placeholder="Type RO Number to search..."
                    value={roInput}
                    onChange={(e) => handleRoSearch(e.target.value)}
                    onFocus={() => roInput.trim() && setShowRoDropdown(true)}
                    className={inputCls}
                    autoComplete="off"
                  />
                  {showRoDropdown && roSuggestions.length > 0 && (
                    <div className="absolute z-30 w-full mt-1 bg-white border-2 border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
                      {roSuggestions.map((ro) => (
                        <button
                          key={ro.ro_no}
                          type="button"
                          onClick={() => selectRo(ro)}
                          className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                        >
                          <span className="font-bold text-sm text-blue-700">{ro.ro_no}</span>
                          <span className="text-xs text-slate-500 block">Date: {ro.ro_date ? new Date(ro.ro_date).toLocaleDateString('en-GB') : '—'}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {roNo && (
                    <div className="mt-2 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                      ✓ Release Order linked: {roNo}
                    </div>
                  )}
                </div>
              ) : (
                <div ref={poRef} className="relative">
                  <label className={labelCls}>Link to Purchase Order (PO)</label>
                  <input
                    type="text"
                    placeholder="Type PO Number to search..."
                    value={poInput}
                    onChange={(e) => handlePoSearch(e.target.value)}
                    onFocus={() => poInput.trim() && setShowPoDropdown(true)}
                    className={inputCls}
                    autoComplete="off"
                  />
                  {showPoDropdown && poSuggestions.length > 0 && (
                    <div className="absolute z-30 w-full mt-1 bg-white border-2 border-slate-200 rounded-xl shadow-lg overflow-hidden">
                      {poSuggestions.map((po) => (
                        <button
                          key={po.po_no}
                          type="button"
                          onClick={() => selectPo(po)}
                          className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                        >
                          <span className="font-bold text-sm text-blue-700">{po.po_no}</span>
                          <span className="text-xs text-slate-500 block">Date: {po.po_date ? new Date(po.po_date).toLocaleDateString('en-GB') : '—'}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {poNo && (
                    <div className="mt-2 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                      ✓ Purchase Order linked: {poNo}
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleBackToDirectory}
                  className="px-6 py-3 border-2 border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-sm rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? 'Saving...' : 'Save Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
