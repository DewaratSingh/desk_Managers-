import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Plus, RefreshCw, ArrowLeft, Trash2, AlertCircle } from 'lucide-react';

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'http://localhost:5000/api'
  : `${window.location.protocol}//${window.location.hostname}:5000/api`;

export default function GRNView({ onCancel }) {
  const [grns, setGrns] = useState([]);
  const [viewMode, setViewMode] = useState('list');
  const [grnNo, setGrnNo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tradeId, setTradeId] = useState(null);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.state && location.state.prefillTradeId) {
      setTradeId(location.state.prefillTradeId);
      setGrnNo('');
      setViewMode('form');
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  const fetchGrns = async (search = '') => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('dm_token');
      const url = `${API_BASE_URL}/grns?limit=100&offset=0${search ? `&search=${encodeURIComponent(search)}` : ''}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        throw new Error('Failed to fetch GRNs');
      }
      const data = await res.json();
      setGrns(data);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGrns(searchQuery);
  }, [searchQuery]);

  const handleOpenAddForm = () => {
    setGrnNo('');
    setTradeId(null);
    setError(null);
    setViewMode('form');
  };

  const handleBackToDirectory = () => {
    setGrnNo('');
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
    if (!grnNo.trim()) return;

    setIsLoading(true);
    setError(null);
    const token = localStorage.getItem('dm_token');
    
    try {
      const res = await fetch(`${API_BASE_URL}/grns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          grn_no: grnNo,
          trade_id: tradeId || null
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save GRN');
      }

      await fetchGrns();
      handleBackToDirectory();
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = async (no) => {
    if (!window.confirm(`Are you sure you want to delete GRN "${no}"?`)) return;
    
    setIsLoading(true);
    setError(null);
    const token = localStorage.getItem('dm_token');
    
    try {
      const res = await fetch(`${API_BASE_URL}/grns/${encodeURIComponent(no)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete GRN');
      }
      setGrns(prev => prev.filter(g => g.grn_no !== no));
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
              <h1 className="text-3xl font-extrabold text-slate-900 m-0">Goods Receipt Notes (GRN)</h1>
              <p className="text-slate-500 mt-1 font-medium">Record and manage Goods Receipt Notes.</p>
            </div>
            <button
              onClick={handleOpenAddForm}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg transition-all shadow-md flex items-center gap-2 cursor-pointer self-start sm:self-auto"
            >
              <Plus size={16} /> New GRN
            </button>
          </div>

          <div className="flex items-center gap-3 bg-white border-2 border-slate-200 rounded-xl px-4 py-3 shadow-sm focus-within:border-blue-600 transition-colors">
            <Search className="text-slate-400 shrink-0" size={20} />
            <input
              type="text"
              placeholder="Search by GRN Number..."
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
            {grns.length === 0 ? (
              <div className="p-16 text-center text-slate-400 text-lg font-semibold">
                No GRN records found.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {grns.map((g) => (
                  <div key={g.grn_no} className="p-5 flex items-center justify-between gap-4 bg-white hover:bg-slate-50/75 transition-colors">
                    <div>
                      <span className="font-mono font-extrabold text-base text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded">
                        {g.grn_no}
                      </span>
                      <p className="text-xs text-slate-400 mt-2 font-semibold">
                        Created: {new Date(g.created_at).toLocaleDateString('en-GB')}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteClick(g.grn_no)}
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
            <h1 className="text-3xl font-extrabold text-slate-900 m-0">Create GRN</h1>
            <p className="text-slate-500 mt-1 font-medium">Record a new Goods Receipt Note.</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 font-semibold text-sm">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="bg-white border-2 border-slate-200 rounded-xl p-6 sm:p-8 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className={labelCls}>GRN Number <b className="text-red-500">*</b></label>
                <input
                  type="text"
                  required
                  placeholder="Enter GRN Number (e.g. GRN-2026-0001)"
                  value={grnNo}
                  onChange={(e) => setGrnNo(e.target.value)}
                  className={inputCls}
                />
              </div>

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
                  {isLoading ? 'Saving...' : 'Save GRN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
